---
name: infrastructure-as-code
description: IaC 实战。Terraform/OpenTofu HCL / State / Module / Provider / Plan-Apply / Drift / CI/CD / 安全扫描。配合 cld / k8sops / rls 用。
---

# IaC (Terraform / OpenTofu)

## 适用场景
- 基础设施即代码编写与管理。
- Terraform state 问题排查。
- Module 设计与版本管理。
- CI/CD 中的 plan/apply 流程。
- IaC 安全扫描。

## 不适用
- K8s manifest → `k8sops`。
- 云控制台手动操作。
- Ansible (配置管理, 非 IaC 声明式)。

---

## HCL 基础

```hcl
# Provider
terraform {
  required_version = ">= 1.7"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"     # state locking
    encrypt        = true
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# Variables
variable "region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region"
}

variable "environment" {
  type = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Must be dev, staging, or prod."
  }
}

# Resources
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  tags = { Name = "${var.environment}-vpc" }
}

resource "aws_subnet" "public" {
  count             = 3
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags = { Name = "${var.environment}-public-${count.index}" }
}

# Data source
data "aws_availability_zones" "available" {
  state = "available"
}

# Output
output "vpc_id" {
  value       = aws_vpc.main.id
  description = "VPC ID"
}

# Locals
locals {
  common_tags = {
    Project = "myapp"
    Team    = "platform"
  }
}
```

## State 管理

```bash
# 查看
terraform state list                       # 列出所有资源
terraform state show aws_vpc.main          # 查看具体资源

# 移动 (重构)
terraform state mv aws_vpc.main module.network.aws_vpc.main

# 移除 (不再管理, 不删除实际资源)
terraform state rm aws_vpc.main

# 导入 (已有资源纳入管理)
terraform import aws_vpc.main vpc-12345678
# Terraform 1.5+: import block
import {
  to = aws_vpc.main
  id = "vpc-12345678"
}

# 强制解锁 (小心!)
terraform force-unlock <lock-id>

# State 迁移 (本地→远端)
terraform init -migrate-state
```

## Module 设计

```text
modules/
├── vpc/
│   ├── main.tf          资源定义
│   ├── variables.tf     输入变量
│   ├── outputs.tf       输出
│   └── README.md
└── rds/
    ├── main.tf
    ├── variables.tf
    └── outputs.tf

使用:
module "vpc" {
  source      = "./modules/vpc"
  # 或 registry: source = "terraform-aws-modules/vpc/aws"
  # 或 git: source = "git::https://github.com/org/modules.git//vpc?ref=v1.2.0"
  environment = var.environment
  cidr        = "10.0.0.0/16"
}

module "rds" {
  source    = "./modules/rds"
  vpc_id    = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnet_ids
}

设计原则:
  - 单一职责 (一个 module = 一个逻辑组件)
  - 版本化 (git tag / registry version)
  - 不硬编码 (所有配置通过 variables)
  - 输出必要信息 (其他 module 需要引用的)
  - README + examples
```

## Plan / Apply 工作流

```bash
# 标准流程
terraform init                             # 初始化 (下载 provider/module)
terraform plan -out=tfplan                 # 预览变更 (保存计划)
terraform apply tfplan                     # 执行计划

# 目标资源
terraform plan -target=aws_vpc.main        # 只计划特定资源
terraform apply -target=aws_vpc.main       # 只应用特定资源 (谨慎!)

# 销毁
terraform plan -destroy                    # 预览销毁
terraform destroy                          # 销毁所有资源 (!!!)

# Workspace (环境分离)
terraform workspace new staging
terraform workspace select prod
terraform workspace list
# state 按 workspace 隔离
```

## CI/CD 集成

```text
Atlantis (GitHub/GitLab PR 自动 plan):
  PR 创建 → Atlantis 自动 terraform plan → 评论显示 plan
  review + approve → 评论 "atlantis apply" → 自动 apply

Spacelift / Terraform Cloud:
  UI + policy + drift detection + cost estimation

GitHub Actions 示例:
  on: pull_request
  jobs:
    plan:
      steps:
        - terraform init
        - terraform plan -no-color
        - 在 PR 评论中显示 plan 结果

  on: push (main)
  jobs:
    apply:
      steps:
        - terraform init
        - terraform apply -auto-approve

Drift 检测:
  定时 terraform plan → 如果有差异 → 告警
  → 手动修改了云资源 / state 与实际不一致
```

## 安全

```bash
# tfsec (静态扫描)
tfsec .
# 检测: 公开 S3 / 弱加密 / 安全组过宽 / 无日志

# checkov
checkov -d .
# CIS benchmark / 安全最佳实践

# infracost (成本估算)
infracost breakdown --path .

# Sentinel (Terraform Cloud/Enterprise)
# Policy as Code: 强制规则 (如: 不允许公网 RDS)

# 敏感值
variable "db_password" {
  type      = string
  sensitive = true                         # 不显示在 plan/log 中
}
# 实际值从: 环境变量 TF_VAR_db_password / vault / secrets manager
```

## 常见陷阱

```text
- state 文件含敏感信息: 用远端 backend + 加密 + 访问控制
- terraform destroy 误操作: 用 prevent_destroy lifecycle 保护关键资源
- count vs for_each: for_each 更稳定 (删除中间元素不会重建后续)
- 依赖循环: A depends_on B, B depends_on A → 拆分或 data source
- Provider 版本漂移: lock 文件 (.terraform.lock.hcl) 提交到 git
- 大 state 性能: 拆分为多个 state (per environment / per service)
- apply 中断: state 可能不一致 → terraform refresh 或手动修复
```

## 实战入口
- **developer.hashicorp.com/terraform** — 官方。
- **terraform-aws-modules** — 社区模块。
- **Atlantis** — PR 自动化。
- **tfsec / checkov** — 安全扫描。
- **OpenTofu** — 开源 Terraform fork。

## 自检
1. 云？(AWS / Azure / GCP / 多云)
2. State backend？(S3 / Azure Storage / GCS)
3. Module 还是 flat？
4. CI/CD？(Atlantis / GitHub Actions / Terraform Cloud)
5. 环境分离？(workspace / 目录 / 账号)
6. 安全扫描？

## 相邻技能
- `cld` — 云基础。
- `k8sops` — K8s (terraform 可管理 K8s 资源但不推荐)。
- `rls` — 发布工程。
- `plt` — 平台工程。