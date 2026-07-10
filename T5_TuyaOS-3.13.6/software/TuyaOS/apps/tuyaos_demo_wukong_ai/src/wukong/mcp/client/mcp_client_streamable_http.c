/**
 * @file mcp_client_streamable_http.c
 * @brief streamablehttp MCP 传输（JSON-RPC over HTTPS POST）
 */

#include "mcp_client_transport.h"
#include "mcp_client_auth.h"
#include "mcp_client_util.h"

#include <stdio.h>
#include <string.h>

#include "http_inf.h"
#include "tal_log.h"
#include "tal_memory.h"
#include "tal_system.h"

typedef struct {
    CONST ty_cJSON *headers;
    http_req_t *req;
} MCP_HTTP_HEAD_DATA_T;

STATIC VOID __http_add_headers(http_session_t session, VOID *data)
{
    MCP_HTTP_HEAD_DATA_T *hd = (MCP_HTTP_HEAD_DATA_T *)data;
    ty_cJSON *item;

    if (!session || !hd || !hd->headers || !ty_cJSON_IsObject(hd->headers))
        return;

    item = hd->headers->child;
    while (item) {
        if (hd->req && item->string && ty_cJSON_IsString(item) && item->valuestring)
            http_add_header(session, hd->req, item->string, item->valuestring);
        item = item->next;
    }

    if (hd->req)
        http_add_header(session, hd->req, "Accept", "application/json, text/event-stream");
}

STATIC VOID __http_add_headers_for_req(http_session_t session, CONST ty_cJSON *headers,
                                       CONST http_req_t *req)
{
    MCP_HTTP_HEAD_DATA_T hd;

    memset(&hd, 0, sizeof(hd));
    hd.headers = headers;
    hd.req = (http_req_t *)req;
    __http_add_headers(session, &hd);
}

STATIC OPERATE_RET __http_post_json(CONST MCP_CLIENT_SERVER_CFG_T *server,
                                    CONST CHAR_T *json_body,
                                    MCP_CLIENT_HTTP_RESP_T *out_resp,
                                    INT_T *out_http_status)
{
    ty_cJSON *headers = NULL;
    http_session_t session = NULL;
    http_req_t req;
    http_resp_t *resp_hdr = NULL;
    MCP_CLIENT_HTTP_RESP_T resp;
    OPERATE_RET transport_rt = OPRT_OK;
    OPERATE_RET rt;
    http_hdr_field_sel_t flags;
    INT_T http_rt = 0;
    BYTE_T chunk[1024];
    INT_T read_len = 0;
    UINT_T total = 0;
    CHAR_T *buf = NULL;

    if (!server || !json_body || !out_resp)
        return OPRT_INVALID_PARM;

    memset(&resp, 0, sizeof(resp));
    memset(out_resp, 0, sizeof(*out_resp));

    headers = server->headers ? ty_cJSON_Duplicate(server->headers, 1) : ty_cJSON_CreateObject();
    if (!headers) {
        return OPRT_MALLOC_FAILED;
    }

    rt = mcp_client_auth_apply_headers(server, json_body, headers);
    if (rt != OPRT_OK) {
        ty_cJSON_Delete(headers);
        return rt;
    }

    flags = STANDARD_HDR_FLAGS | HDR_ADD_CONN_KEEP_ALIVE | HDR_ADD_CONTENT_TYPE_JSON;

    http_rt = http_open_session(&session, server->url, 0, 0);
    if (http_rt != 0 || session == NULL) {
        ty_cJSON_Delete(headers);
        return OPRT_COM_ERROR;
    }

    http_set_timeout(session, MCP_CLIENT_HTTP_TIMEOUT_MS);

    memset(&req, 0, sizeof(req));
    req.type = HTTP_POST;
    req.resource = server->url;
    req.version = HTTP_VER_1_1;
    req.content = json_body;
    req.content_len = (INT_T)strlen(json_body);
    req.redirect_cnt = REDIRECT_CNT_DEFAULT;

    http_rt = http_prepare_req(session, &req, flags);
    if (http_rt != 0) {
        ty_cJSON_Delete(headers);
        http_close_session(&session);
        return OPRT_COM_ERROR;
    }

    __http_add_headers_for_req(session, headers, &req);
    ty_cJSON_Delete(headers);

    http_rt = http_send_request(session, &req, TRUE);
    if (http_rt != 0) {
        http_close_session(&session);
        return OPRT_COM_ERROR;
    }

    http_rt = http_get_response_hdr(session, &resp_hdr);
    if (http_rt != 0 || resp_hdr == NULL) {
        http_close_session(&session);
        return OPRT_COM_ERROR;
    }

    resp.status_code = resp_hdr->status_code;
    buf = (CHAR_T *)tal_malloc(MCP_CLIENT_HTTP_RESP_MAX);
    if (!buf) {
        http_close_session(&session);
        return OPRT_MALLOC_FAILED;
    }

    while (1) {
        read_len = http_read_content(session, chunk, sizeof(chunk));
        if (read_len <= 0)
            break;
        if (total + (UINT_T)read_len >= MCP_CLIENT_HTTP_RESP_MAX - 1) {
            transport_rt = OPRT_BUFFER_NOT_ENOUGH;
            break;
        }
        memcpy(buf + total, chunk, (SIZE_T)read_len);
        total += (UINT_T)read_len;
    }

    buf[total] = '\0';
    resp.body = buf;
    resp.body_len = total;
    http_close_session(&session);

    if (resp.status_code == 429) {
        transport_rt = OPRT_EXCEED_UPPER_LIMIT;
    } else if (resp.status_code == 401 || resp.status_code == 403) {
        transport_rt = OPRT_AUTHENTICATION_FAIL;
    } else if (resp.status_code < 200 || resp.status_code >= 300) {
        transport_rt = OPRT_COM_ERROR;
    } else if (transport_rt != OPRT_BUFFER_NOT_ENOUGH) {
        transport_rt = OPRT_OK;
    }

    *out_resp = resp;
    if (out_http_status)
        *out_http_status = resp.status_code;

    return transport_rt;
}

VOID mcp_client_transport_free_resp(MCP_CLIENT_HTTP_RESP_T *resp)
{
    if (!resp)
        return;
    if (resp->body) {
        tal_free(resp->body);
        resp->body = NULL;
    }
    resp->body_len = 0;
}

STATIC VOID __log_body_diag(CONST CHAR_T *stage, UINT_T body_len, CONST CHAR_T *body)
{
    CHAR_T prefix[129];
    UINT_T n;

    if (!body || body_len == 0) {
        TAL_PR_WARN("MCP jsonrpc %s fail body_len=0", stage);
        return;
    }

    n = body_len > 128 ? 128 : body_len;
    memcpy(prefix, body, n);
    prefix[n] = '\0';
    TAL_PR_WARN("MCP jsonrpc %s fail body_len=%u prefix=%s", stage, body_len, prefix);
}

/* StreamableHTTP 允许服务端以 SSE 帧（text/event-stream）返回 JSON-RPC */
STATIC ty_cJSON *__parse_sse_or_json(CONST CHAR_T *body)
{
    ty_cJSON *root;
    ty_cJSON *fallback = NULL;
    CONST CHAR_T *p;

    root = ty_cJSON_Parse(body);
    if (root)
        return root;

    p = body;
    while ((p = strstr(p, "data:")) != NULL) {
        CONST CHAR_T *s = p + 5;
        CONST CHAR_T *e;
        SIZE_T len;
        CHAR_T *line;

        while (*s == ' ' || *s == '\t')
            s++;
        e = s;
        while (*e && *e != '\n' && *e != '\r')
            e++;

        len = (SIZE_T)(e - s);
        if (len > 0) {
            line = (CHAR_T *)tal_malloc(len + 1);
            if (line) {
                memcpy(line, s, len);
                line[len] = '\0';
                root = ty_cJSON_Parse(line);
                tal_free(line);
                if (root) {
                    if (ty_cJSON_GetObjectItem(root, "jsonrpc") ||
                        ty_cJSON_GetObjectItem(root, "result") ||
                        ty_cJSON_GetObjectItem(root, "error"))
                        return root;
                    if (!fallback)
                        fallback = root;
                    else
                        ty_cJSON_Delete(root);
                }
            }
        }
        p = (*e) ? e + 1 : e;
    }

    return fallback;
}

STATIC OPERATE_RET __parse_jsonrpc_result(CONST CHAR_T *body, UINT_T body_len,
                                          ty_cJSON **out_result, INT_T http_status)
{
    ty_cJSON *root, *result, *error;

    if (!body || !out_result)
        return OPRT_INVALID_PARM;

    root = __parse_sse_or_json(body);
    if (!root) {
        __log_body_diag("parse", body_len, body);
        return OPRT_COM_ERROR;
    }

    error = ty_cJSON_GetObjectItem(root, "error");
    if (error) {
        __log_body_diag("jsonrpc_error", body_len, body);
        ty_cJSON_Delete(root);
        if (http_status == 429)
            return OPRT_EXCEED_UPPER_LIMIT;
        return OPRT_COM_ERROR;
    }

    result = ty_cJSON_GetObjectItem(root, "result");
    if (!result) {
        __log_body_diag("missing_result", body_len, body);
        ty_cJSON_Delete(root);
        return OPRT_COM_ERROR;
    }

    *out_result = ty_cJSON_Duplicate(result, 1);
    ty_cJSON_Delete(root);
    if (!*out_result) {
        __log_body_diag("dup_result", body_len, body);
        return OPRT_MALLOC_FAILED;
    }
    return OPRT_OK;
}

OPERATE_RET mcp_client_transport_jsonrpc(CONST MCP_CLIENT_SERVER_CFG_T *server,
                                         CONST CHAR_T *method,
                                         ty_cJSON *params,
                                         ty_cJSON **out_result,
                                         INT_T *out_http_status)
{
    ty_cJSON *req;
    CHAR_T *payload;
    MCP_CLIENT_HTTP_RESP_T resp;
    OPERATE_RET rt;
    static UINT_T s_req_id = 1;

    if (!server || !method || !out_result)
        return OPRT_INVALID_PARM;

    if (server->type != MCP_CLIENT_TYPE_STREAMABLEHTTP)
        return OPRT_NOT_SUPPORTED;

    if (!server->url[0])
        return OPRT_INVALID_PARM;

    *out_result = NULL;

    req = ty_cJSON_CreateObject();
    if (!req)
        return OPRT_MALLOC_FAILED;

    ty_cJSON_AddStringToObject(req, "jsonrpc", "2.0");
    ty_cJSON_AddNumberToObject(req, "id", s_req_id++);
    ty_cJSON_AddStringToObject(req, "method", method);
    if (params)
        ty_cJSON_AddItemToObject(req, "params", ty_cJSON_Duplicate(params, 1));

    payload = ty_cJSON_PrintUnformatted(req);
    ty_cJSON_Delete(req);
    if (!payload)
        return OPRT_MALLOC_FAILED;

    TAL_PR_DEBUG("MCP transport rpc mcp=%s method=%s", server->id, method);

    rt = __http_post_json(server, payload, &resp, out_http_status);
    ty_cJSON_FreeBuffer(payload);
    if (rt != OPRT_OK) {
        if (rt == OPRT_BUFFER_NOT_ENOUGH)
            TAL_PR_WARN("MCP transport rsp truncated mcp=%s method=%s max=%u",
                        server->id, method, (UINT_T)MCP_CLIENT_HTTP_RESP_MAX);
        mcp_client_transport_free_resp(&resp);
        return rt;
    }

    if (!resp.body) {
        mcp_client_transport_free_resp(&resp);
        return OPRT_COM_ERROR;
    }

    rt = __parse_jsonrpc_result(resp.body, resp.body_len, out_result, resp.status_code);
    mcp_client_transport_free_resp(&resp);
    return rt;
}
