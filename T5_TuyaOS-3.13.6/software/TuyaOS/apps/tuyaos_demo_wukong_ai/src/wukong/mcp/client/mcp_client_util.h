/**
 * @file mcp_client_util.h
 * @brief 第三方 MCP Client — 工具函数（命名空间、脱敏、时间戳）
 */

#ifndef __MCP_CLIENT_UTIL_H__
#define __MCP_CLIENT_UTIL_H__

#include "mcp_client_types.h"

#ifdef __cplusplus
extern "C" {
#endif

UINT_T mcp_client_now_unix(VOID);
OPERATE_RET mcp_client_build_namespaced(CONST CHAR_T *mcp_id, CONST CHAR_T *orig_name,
                                        CHAR_T *out, SIZE_T out_sz);
OPERATE_RET mcp_client_parse_namespaced(CONST CHAR_T *namespaced, CHAR_T *mcp_id, SIZE_T mcp_id_sz,
                                        CHAR_T *orig_name, SIZE_T orig_name_sz);
VOID mcp_client_redact_headers_for_log(CONST ty_cJSON *headers, CHAR_T *out, SIZE_T out_sz);
VOID mcp_client_redact_json_for_log(CONST ty_cJSON *obj, CHAR_T *out, SIZE_T out_sz);
MCP_CLIENT_TRANSPORT_E mcp_client_type_from_string(CONST CHAR_T *s);
CONST CHAR_T *mcp_client_type_to_string(MCP_CLIENT_TRANSPORT_E type);
MCP_CLIENT_RISK_E mcp_client_risk_from_string(CONST CHAR_T *s);

#ifdef __cplusplus
}
#endif

#endif /* __MCP_CLIENT_UTIL_H__ */
