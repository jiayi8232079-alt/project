/**
 * @file mcp_client_router.c
 * @brief namespaced 工具路由器
 */

#include "mcp_client_router.h"
#include "mcp_client_manager.h"

OPERATE_RET mcp_client_router_call(CONST CHAR_T *namespaced, CONST ty_cJSON *arguments,
                                   BOOL_T user_confirmed, ty_cJSON **out_content,
                                   BOOL_T *out_is_error)
{
    return mcp_client_manager_call_tool(namespaced, arguments, user_confirmed,
                                        out_content, out_is_error);
}
