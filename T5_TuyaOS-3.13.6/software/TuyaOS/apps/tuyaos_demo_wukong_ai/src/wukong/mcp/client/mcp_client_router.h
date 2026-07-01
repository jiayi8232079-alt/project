/**
 * @file mcp_client_router.h
 * @brief namespaced 工具路由（mcpId.toolName → 真实 MCP）
 */

#ifndef __MCP_CLIENT_ROUTER_H__
#define __MCP_CLIENT_ROUTER_H__

#include "mcp_client_types.h"
#include "ty_cJSON.h"

#ifdef __cplusplus
extern "C" {
#endif

OPERATE_RET mcp_client_router_call(CONST CHAR_T *namespaced, CONST ty_cJSON *arguments,
                                   BOOL_T user_confirmed, ty_cJSON **out_content,
                                   BOOL_T *out_is_error);

#ifdef __cplusplus
}
#endif

#endif /* __MCP_CLIENT_ROUTER_H__ */
