/**
 * @file mcp_client_integration.h
 * @brief 与 mcp_server_tools 的聚合 hooks
 */

#ifndef __MCP_CLIENT_INTEGRATION_H__
#define __MCP_CLIENT_INTEGRATION_H__

#include "ty_cJSON.h"
#include "tuya_cloud_types.h"

#ifdef __cplusplus
extern "C" {
#endif

VOID mcp_client_integration_append_tools(ty_cJSON *tools_arr, INT_T *payload_len);
BOOL_T mcp_client_integration_is_external_tool(CONST CHAR_T *tool_name);
OPERATE_RET mcp_client_integration_schedule_call(CONST CHAR_T *sid, CONST CHAR_T *eid, CONST CHAR_T *id,
                                                 CONST CHAR_T *tool_name, CONST ty_cJSON *arguments,
                                                 BOOL_T user_confirmed);

#ifdef __cplusplus
}
#endif

#endif /* __MCP_CLIENT_INTEGRATION_H__ */
