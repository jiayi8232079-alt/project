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

#include <string.h>

/* 麦当劳 MCP 端点（StreamableHTTP，JSON-RPC over HTTPS POST） */
#ifndef MCD_MCP_URL
#define MCD_MCP_URL     "https://mcp.mcd.cn"
#endif

/* query-nearby-stores(searchType=2) 必填；按设备所在城市修改 */
#ifndef MCD_MCP_DEFAULT_CITY
#define MCD_MCP_DEFAULT_CITY    "上海"
#endif

#ifndef MCD_MCP_TOKEN
#define MCD_MCP_TOKEN   "19baGDXS9r7SGojS5vU6K4pB1jjm6bKk"
#endif

#define MCD_MCP_TOKEN_IS_PLACEHOLDER() \
    (MCD_MCP_TOKEN[0] == '\0' || strcmp(MCD_MCP_TOKEN, "YOUR_MCP_TOKEN") == 0)

#endif /* __MCP_CLIENT_SECRETS_H__ */
