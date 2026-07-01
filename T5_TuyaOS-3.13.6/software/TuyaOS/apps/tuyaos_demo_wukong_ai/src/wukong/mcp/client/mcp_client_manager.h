/**
 * @file mcp_client_manager.h
 * @brief 第三方 MCP Client 管理器（连接、tools/list 缓存、测试）
 */

#ifndef __MCP_CLIENT_MANAGER_H__
#define __MCP_CLIENT_MANAGER_H__

#include "mcp_client_types.h"

#ifdef __cplusplus
extern "C" {
#endif

OPERATE_RET mcp_client_manager_init(VOID);
OPERATE_RET mcp_client_manager_deinit(VOID);
OPERATE_RET mcp_client_manager_refresh_all(VOID);
OPERATE_RET mcp_client_manager_test_connection(CONST CHAR_T *mcp_id, CHAR_T *detail, SIZE_T detail_sz);
OPERATE_RET mcp_client_manager_list_tools_json(ty_cJSON **out_array, BOOL_T redact);
UINT_T mcp_client_manager_tool_count(VOID);
CONST MCP_CLIENT_TOOL_CACHE_T *mcp_client_manager_get_tool(UINT_T index);
CONST MCP_CLIENT_TOOL_CACHE_T *mcp_client_manager_find_tool(CONST CHAR_T *namespaced);
OPERATE_RET mcp_client_manager_call_tool(CONST CHAR_T *namespaced, CONST ty_cJSON *arguments,
                                         BOOL_T user_confirmed, ty_cJSON **out_content,
                                         BOOL_T *out_is_error);

#ifdef __cplusplus
}
#endif

#endif /* __MCP_CLIENT_MANAGER_H__ */
