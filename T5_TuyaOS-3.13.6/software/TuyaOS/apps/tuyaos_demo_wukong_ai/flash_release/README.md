# 烧录发布包（flash_release）

每次需要**可烧录文件夹**时，在此目录下按版本号建子目录，例如 `0.0.52/`。

## 目录约定

```
flash_release/
  README.md                 ← 本说明
  0.0.52/
    MANIFEST.json           ← 版本、MD5、功能清单
    FLASH_CN.md             ← 烧录与验收步骤
    tuyaos_demo_wukong_ai_QIO_0.0.52.bin
```

- **QIO**：整片烧录（bootloader + CP + AP），首次或大改后用这个。
- **UA / UG**：OTA 分包，仅在已有基线且走云端/分段升级时用；日常本地烧录用 **QIO**。

## 以后怎么跟我说（复制即用）

**完整编译 + 烧录包：**

> 编译版本 **0.0.53**，生成 `flash_release/0.0.53` 文件夹（含 QIO + MANIFEST + 烧录说明），并告诉我校验方法和串口验收关键字。

**只验收是否烧对：**

> 我烧的是 `flash_release/0.0.52`，帮我列验收清单（串口版本号、功能点、MD5）。

**修 bug 后出新包：**

> 在 0.0.52 基础上改 XXX， bump 到 0.0.53，编译 QIO 并更新 flash_release。

## 源码版本号位置

改版本时同步修改：`apps/tuyaos_demo_wukong_ai/local.mk` 中的 `VER := x.y.z`。

## 编译命令（SDK 根目录）

```bash
cd software/TuyaOS
make app APP_NAME=tuyaos_demo_wukong_ai APP_VER=0.0.52 CONFIG_ENABLE_MULTI_SECTION_UPGRADE=n
```

产物默认在：`apps/tuyaos_demo_wukong_ai/output/<版本>/`。
