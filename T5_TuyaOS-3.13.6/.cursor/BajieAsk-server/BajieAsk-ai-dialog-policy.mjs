/**
 * BajieAsk · 助手对话策略（MCP Server 进程）
 *
 * 与仓库根目录 `.cursor/rules/no-payment-dialog-mirror.mdc`、`mcp-server/.cursor/rules/no-payment-dialog-mirror.mdc`、
 * `src/BajieAsk-ai-dialog-policy.js` 及本包 `index.mjs` 中 wait_message / reply_message 的 description【对话措辞】保持一致。
 *
 * 要点：
 * - 禁止在助手回复中主动写出或模仿 IDE 付费类系统弹窗典型英文整句（例如含 Payment failed、
 *   Update your payment method、keep using Cursor 等字样的整句或明显恐吓式改写）。
 * - 禁止以「出现付费提示」「要更新支付方式」为由建议用户中断本会话、换对话、换模型或停止保活循环。
 * - 用户逐字引用原文用于排错时除外，且仍不得据此结束对话或引导付费。
 */

export const BAJIE_AI_DIALOG_POLICY_VERSION = 1;
