# SolidWorks MCP 配置说明

通过 **Solidworks-MCP**，Cursor 可以用自然语言调用 SolidWorks（建零件、画草图、拉伸等）。

## 环境要求

- Windows 10/11
- SolidWorks 已安装并授权（本机：2024 / API 28.5.0）
- Python **3.12**（路径：`C:\Espressif\Python312\python.exe`）
- 使用前请先**打开 SolidWorks**

## 已完成的配置

| 项目 | 路径 |
|------|------|
| MCP 服务代码 | `c:\000_OPC\器件资料\tools\solidworks-mcp\` |
| Cursor MCP 配置 | `C:\Users\Jia Yi\.cursor\mcp.json` |
| 连通性测试脚本 | `c:\000_OPC\器件资料\scripts\test_solidworks_mcp_api.py` |

## 启用步骤

1. 打开 SolidWorks
2. **重启 Cursor**（或：设置 → MCP → 刷新 `solidworks` 服务器）
3. 在对话中说：**「连接 SolidWorks」** 或 **「Connect to SolidWorks」**
4. 确认 MCP 工具列表中出现 `connect_solidworks`、`create_new_part`、`draw_circle` 等

## 本地验证（不经过 Cursor）

```powershell
py -3.12 "c:\000_OPC\器件资料\scripts\test_solidworks_mcp_api.py"
```

预期输出：`RESULT` 全部 PASS，并生成 `c:\000_OPC\器件资料\电机\马达-MCP测试.SLDPRT`（Ø28×19 圆柱测试体）。

## 可用 MCP 工具（22 个）

- **连接**：`connect_solidworks`、`get_solidworks_info`
- **文档**：`create_new_part`、`save_document`、`open_document` …
- **草图**：`create_sketch`、`draw_circle`、`draw_rectangle`、`draw_line` …
- **特征**：`extrude_sketch`、`cut_extrude`、`fillet_edges` …
- **高级**：`execute_python`（在 SW 上下文执行自定义 Python）

## 本机已修复的问题

1. **中文基准面**：`上视基准面` / `前视基准面` / `右视基准面` 自动识别
2. **零件模板**：改用 `gb_part.prtdot`，不再使用英文 Tutorial 空模板
3. **依赖**：移除无效的 `asyncio-compat` 包

## 下一步：用 MCP 建马达

重启 Cursor 后，可直接说：

> 连接 SolidWorks，新建零件，按 电机/马达.png 尺寸分步建模：主体 Ø28×19 → 安装耳 → 偏心轴 → 接插件

建议**分步**进行，每步完成后在 SolidWorks 里核对再继续。
