/**
 * @file mcp_client_secrets.h
 * @brief 第三方 MCP 端点与令牌的编译期占位（"写死"入口）
 *
 * 两种配置令牌的方式，任选其一：
 *  1) 写死（改这里 + 重新编译）：把下面 MCD_MCP_TOKEN 换成真实 Bearer 令牌。
 *  2) 运行时上传（免重编）：调用 MCP 工具 device_mcp_set_token(token="...", mcpId="mcd")，
 *     令牌会写入设备 KV（wk_mcp_client_cfg）并立即刷新工具列表。
 *
 * 令牌属敏感信息：正式版建议改为从涂鸦云下发或放入未入库的本地头，切勿把真实令牌提交到公共仓库。
 */

#ifndef __MCP_CLIENT_SECRETS_H__
#define __MCP_CLIENT_SECRETS_H__

/* 麦当劳 MCP 端点（StreamableHTTP，JSON-RPC over HTTPS POST） */
#ifndef MCD_MCP_URL
#define MCD_MCP_URL     "https://mcp.mcd.cn"
#endif

/* 令牌占位：保持 "YOUR_MCP_TOKEN" 表示"尚未写死"，此时改用运行时 device_mcp_set_token 上传。
 * 只填令牌本体即可，"Bearer " 前缀由代码自动补齐。
 * 安全提醒：此处为真实令牌，切勿把本文件提交到公共仓库；建议改由涂鸦云下发或本地未入库头覆盖。 */
#ifndef MCD_MCP_TOKEN
#define MCD_MCP_TOKEN   "YOUR_MCP_TOKEN"
#endif

/* 占位判定：令牌为空或仍是占位符时视为"未写死真实令牌" */
#define MCD_MCP_TOKEN_IS_PLACEHOLDER() \
    (MCD_MCP_TOKEN[0] == '\0' || strcmp(MCD_MCP_TOKEN, "YOUR_MCP_TOKEN") == 0)

#endif /* __MCP_CLIENT_SECRETS_H__ */
