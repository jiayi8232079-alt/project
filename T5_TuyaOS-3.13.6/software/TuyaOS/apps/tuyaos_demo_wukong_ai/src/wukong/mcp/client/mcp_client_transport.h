/**
 * @file mcp_client_transport.h
 * @brief 第三方 MCP 传输层抽象
 */

#ifndef __MCP_CLIENT_TRANSPORT_H__
#define __MCP_CLIENT_TRANSPORT_H__

#include "mcp_client_types.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    INT_T status_code;
    CHAR_T *body;
    UINT_T body_len;
} MCP_CLIENT_HTTP_RESP_T;

OPERATE_RET mcp_client_transport_jsonrpc(CONST MCP_CLIENT_SERVER_CFG_T *server,
                                         CONST CHAR_T *method,
                                         ty_cJSON *params,
                                         ty_cJSON **out_result,
                                         INT_T *out_http_status);
VOID mcp_client_transport_free_resp(MCP_CLIENT_HTTP_RESP_T *resp);

#ifdef __cplusplus
}
#endif

#endif /* __MCP_CLIENT_TRANSPORT_H__ */
