# Cursor 配置（器件资料 / 原理图）

## EasyEDA API Skill

| 项 | 路径 |
|----|------|
| 个人技能（全局） | `C:\Users\Jia Yi\.cursor\skills\easyeda-api` |
| 本工程技能链接 | `.cursor/skills/easyeda-api` |
| 原理图规则 | `.cursor/rules/easyeda-schematic.mdc` |

### 首次使用

1. **重启 Cursor**（使 `CLAUDE_SKILL_DIR` 与技能目录生效）
2. **先启动 Bridge**（保持窗口不关）：
   - 双击：`C:\Users\Jia Yi\.cursor\skills\easyeda-api\scripts\start-bridge-visible.cmd`
   - 或 PowerShell：`& "...\scripts\start-bridge.ps1"`
3. 打开 **嘉立创 EDA 专业版**，安装扩展：[run-api-gateway](https://ext.lceda.cn/item/oshwhub/run-api-gateway)
4. 扩展管理器 → **已安装** → Run API Gateway / JLCEDA：
   - **启用**扩展
   - 开启 **外部交互 / 网络访问** 权限（否则无法连 Bridge）
5. 菜单 **高级 → Run API Gateway → 重新连接**
6. 在对话中说「画原理图…」或「嘉立创EDA，启动！」

### 提示「未找到 Bridge 服务」

1. 确认 Bridge 窗口已打开且显示 `Port: 49620`
2. 在 EDA 中执行 **重新连接**（不要只等自动重试）
3. 检查扩展 **外部交互** 权限已开启
4. 仍失败：Windows 防火墙允许「嘉立创EDA」访问专用网络

### 更新技能

重新下载并覆盖 `C:\Users\Jia Yi\.cursor\skills\easyeda-api-skill-src` 后，junction 会自动指向最新内容。
