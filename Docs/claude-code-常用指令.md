/init 
/memory
/statusline
/context
/claude -c ？
  --allow-dangerously-skip-permissions   


| 代码审查   | `/review [PR]` |
/simplify
| 上下文可视化 | `/context [all]` |
| 压缩历史     | `/compact [可选：希望保留的重点说明]` |
| 侧问         | `/btw <问题>` |
| 新开会话     | `/clear [可选会话名]`（与 `/compact` 场景不同，见官方说明） |
| 恢复会话     | `/resume [会话]` |

## 三、官方「典型工作流」速查（与视频结构高度同构）

下列与 [Commands - typical workflow](https://code.claude.com/docs/en/commands.md) 一致，可直接作为飞书里的「总流程卡片」：

1. **首次进仓库**：`/init` → `/memory` → `/mcp`、`/agents` → `/permissions`  
2. **开发中**：`/plan` → `/model`、`/effort` → `/context` → `/compact`；侧问用 `/btw`  
3. **发布前**：`/diff` → `/simplify` → `/review` 或 `/security-review`  
4. **会话之间**：`/clear` → `/resume`、`/branch`；Web/多端见 `/teleport`、`/remote-control`  
5. **异常**：`/rewind` → `/doctor`、`/debug` → `/feedback`