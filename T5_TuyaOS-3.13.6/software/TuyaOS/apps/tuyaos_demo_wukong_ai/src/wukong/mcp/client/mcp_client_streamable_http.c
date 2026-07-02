/**
 * @file mcp_client_streamable_http.c
 * @brief streamablehttp MCP 传输（JSON-RPC over HTTPS POST）
 */

#include "mcp_client_transport.h"
#include "mcp_client_util.h"

#include <stdio.h>
#include <string.h>

#include "http_inf.h"
#include "tal_log.h"
#include "tal_memory.h"
#include "tal_semaphore.h"
#include "tal_system.h"

typedef struct {
    SEM_HANDLE sem;
    MCP_CLIENT_HTTP_RESP_T resp;
    OPERATE_RET transport_rt;
} MCP_HTTP_SYNC_CTX_T;

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

STATIC OPERATE_RET __http_sync_cb(HTTP_INF_H_S *hand)
{
    MCP_HTTP_SYNC_CTX_T *ctx;
    BYTE_T chunk[1024];
    INT_T read_len;
    UINT_T total = 0;
    CHAR_T *buf;

    if (!hand || !hand->pri_data || !*hand->pri_data)
        return OPRT_INVALID_PARM;

    ctx = (MCP_HTTP_SYNC_CTX_T *)*hand->pri_data;
    ctx->resp.status_code = hand->status_code;
    ctx->transport_rt = OPRT_OK;

    if (hand->status_code == 429) {
        ctx->transport_rt = OPRT_EXCEED_UPPER_LIMIT;
        tal_semaphore_post(ctx->sem);
        return OPRT_OK;
    }

    if (hand->status_code == 401 || hand->status_code == 403) {
        ctx->transport_rt = OPRT_AUTHENTICATION_FAIL;
        tal_semaphore_post(ctx->sem);
        return OPRT_OK;
    }

    if (hand->status_code < 200 || hand->status_code >= 300) {
        ctx->transport_rt = OPRT_COM_ERROR;
        tal_semaphore_post(ctx->sem);
        return OPRT_OK;
    }

    buf = (CHAR_T *)tal_malloc(MCP_CLIENT_HTTP_RESP_MAX);
    if (!buf) {
        ctx->transport_rt = OPRT_MALLOC_FAILED;
        tal_semaphore_post(ctx->sem);
        return OPRT_OK;
    }

    while (1) {
        read_len = httpc_inf_read_content_raw(hand, chunk, sizeof(chunk));
        if (read_len <= 0)
            break;
        if (total + (UINT_T)read_len >= MCP_CLIENT_HTTP_RESP_MAX - 1) {
            ctx->transport_rt = OPRT_BUFFER_NOT_ENOUGH;
            break;
        }
        memcpy(buf + total, chunk, (SIZE_T)read_len);
        total += (UINT_T)read_len;
    }

    buf[total] = '\0';
    ctx->resp.body = buf;
    ctx->resp.body_len = total;
    /* 缓冲区溢出时保留 OPRT_BUFFER_NOT_ENOUGH，勿覆盖为 OPRT_OK */
    tal_semaphore_post(ctx->sem);
    return OPRT_OK;
}

STATIC OPERATE_RET __http_post_json(CONST MCP_CLIENT_SERVER_CFG_T *server,
                                    CONST CHAR_T *json_body,
                                    MCP_CLIENT_HTTP_RESP_T *out_resp,
                                    INT_T *out_http_status)
{
    MCP_HTTP_SYNC_CTX_T ctx;
    MCP_HTTP_HEAD_DATA_T head_data;
    PVOID_T pri = &ctx;
    OPERATE_RET rt;
    http_hdr_field_sel_t flags;

    if (!server || !json_body || !out_resp)
        return OPRT_INVALID_PARM;

    memset(&ctx, 0, sizeof(ctx));
    memset(out_resp, 0, sizeof(*out_resp));

    rt = tal_semaphore_create_init(&ctx.sem, 0, 1);
    if (rt != OPRT_OK)
        return rt;

    head_data.headers = server->headers;
    flags = STANDARD_HDR_FLAGS | HDR_ADD_CONN_KEEP_ALIVE | HDR_ADD_CONTENT_TYPE_JSON;

    rt = http_inf_client_post_field_session(server->url, __http_sync_cb,
                                            (CONST BYTE_T *)json_body, strlen(json_body),
                                            __http_add_headers, &head_data,
                                            NULL, &pri, flags, FALSE);
    if (rt != OPRT_OK) {
        tal_semaphore_release(ctx.sem);
        return rt;
    }

    rt = tal_semaphore_wait(ctx.sem, MCP_CLIENT_HTTP_TIMEOUT_MS);
    tal_semaphore_release(ctx.sem);
    if (rt != OPRT_OK)
        return OPRT_TIMEOUT;

    *out_resp = ctx.resp;
    if (out_http_status)
        *out_http_status = ctx.resp.status_code;

    return ctx.transport_rt;
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
