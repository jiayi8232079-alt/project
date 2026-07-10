#ifndef __MCP_CLIENT_AUTH_H__
#define __MCP_CLIENT_AUTH_H__

#include "mcp_client_types.h"

#ifdef __cplusplus
extern "C" {
#endif

OPERATE_RET mcp_client_auth_apply_headers(CONST MCP_CLIENT_SERVER_CFG_T *server,
                                           CONST CHAR_T *json_body,
                                           ty_cJSON *headers);

#ifdef __cplusplus
}
#endif

#endif /* __MCP_CLIENT_AUTH_H__ */
