# deployment 目录说明

当前目录下主要有两类 SQL：

1. `qiaoguo_health_full_20260308.sql`
   - 当前本地数据库完整导出
   - 包含演示/运行数据
   - 适合本地备份，不适合直接上线

2. `qiaoguo_health_clean_20260308.sql`
   - 干净生产库
   - 只保留结构和基础配置
   - 适合导入宝塔新环境

重新生成干净库：

```bash
cd /Users/karl/Desktop/陪了个伴管理系统
./deployment/export_clean_db.sh deployment/qiaoguo_health_clean_$(date +%Y%m%d).sql
```

脚本不会修改当前本地数据库，只会导出一份新的 SQL。
