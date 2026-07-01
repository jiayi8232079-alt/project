/**
 * @file mcp_client_util.c
 * @brief 第三方 MCP Client — 工具函数实现
 */

#include "mcp_client_util.h"

#include <stdio.h>
#include <string.h>

#include "tal_time_service.h"

UINT_T mcp_client_now_unix(VOID)
{
    TIME_T t = 0;

    tal_time_get(&t);
    return (UINT_T)t;
}

OPERATE_RET mcp_client_build_namespaced(CONST CHAR_T *mcp_id, CONST CHAR_T *orig_name,
                                        CHAR_T *out, SIZE_T out_sz)
{
    INT_T n;

    if (!mcp_id || !orig_name || !out || out_sz == 0)
        return OPRT_INVALID_PARM;

    n = snprintf(out, out_sz, "%s.%s", mcp_id, orig_name);
    if (n < 0 || (SIZE_T)n >= out_sz)
        return OPRT_BUFFER_NOT_ENOUGH;

    return OPRT_OK;
}

OPERATE_RET mcp_client_parse_namespaced(CONST CHAR_T *namespaced, CHAR_T *mcp_id, SIZE_T mcp_id_sz,
                                        CHAR_T *orig_name, SIZE_T orig_name_sz)
{
    CONST CHAR_T *dot;

    if (!namespaced || !mcp_id || !orig_name)
        return OPRT_INVALID_PARM;

    dot = strchr(namespaced, '.');
    if (!dot || dot == namespaced)
        return OPRT_INVALID_PARM;

    if ((SIZE_T)(dot - namespaced) >= mcp_id_sz)
        return OPRT_BUFFER_NOT_ENOUGH;

    memcpy(mcp_id, namespaced, (SIZE_T)(dot - namespaced));
    mcp_id[dot - namespaced] = '\0';

    if (strlen(dot + 1) >= orig_name_sz)
        return OPRT_BUFFER_NOT_ENOUGH;

    strcpy(orig_name, dot + 1);
    return OPRT_OK;
}

STATIC VOID __redact_value(CONST CHAR_T *key, CONST CHAR_T *val, CHAR_T *out, SIZE_T out_sz)
{
    if (!key || !out || out_sz == 0)
        return;

    if (val && (strstr(key, "auth") || strstr(key, "Auth") ||
                strstr(key, "token") || strstr(key, "Token") ||
                strstr(key, "phone") || strstr(key, "address") ||
                strstr(key, "password") || strstr(key, "secret"))) {
        snprintf(out, out_sz, "***");
        return;
    }

    if (val)
        snprintf(out, out_sz, "%s", val);
    else
        out[0] = '\0';
}

VOID mcp_client_redact_headers_for_log(CONST ty_cJSON *headers, CHAR_T *out, SIZE_T out_sz)
{
    ty_cJSON *item;

    if (!out || out_sz == 0)
        return;

    out[0] = '{';
    out[1] = '\0';

    if (!headers || !ty_cJSON_IsObject(headers))
        return;

    item = headers->child;
    while (item) {
        CHAR_T val_buf[32];
        CHAR_T piece[96];
        SIZE_T cur = strlen(out);

        __redact_value(item->string, ty_cJSON_IsString(item) ? item->valuestring : NULL,
                       val_buf, sizeof(val_buf));
        snprintf(piece, sizeof(piece), "%s%s:\"%s\"", (cur > 1) ? "," : "",
                 item->string ? item->string : "?", val_buf);
        if (cur + strlen(piece) + 2 < out_sz)
            strncat(out, piece, out_sz - cur - 1);
        item = item->next;
    }

    if (strlen(out) + 1 < out_sz)
        strncat(out, "}", out_sz - strlen(out) - 1);
}

VOID mcp_client_redact_json_for_log(CONST ty_cJSON *obj, CHAR_T *out, SIZE_T out_sz)
{
    ty_cJSON *flat;
    CHAR_T *raw;

    if (!out || out_sz == 0)
        return;

    if (!obj) {
        snprintf(out, out_sz, "(null)");
        return;
    }

    flat = ty_cJSON_Duplicate(obj, 1);
    if (!flat) {
        snprintf(out, out_sz, "(oom)");
        return;
    }

    if (ty_cJSON_IsObject(flat)) {
        ty_cJSON *item = flat->child;
        while (item) {
            if (item->string &&
                (strstr(item->string, "auth") || strstr(item->string, "Auth") ||
                 strstr(item->string, "token") || strstr(item->string, "Token") ||
                 strstr(item->string, "phone") || strstr(item->string, "address") ||
                 strstr(item->string, "password") || strstr(item->string, "order"))) {
                if (ty_cJSON_IsString(item))
                    ty_cJSON_SetValuestring(item, "***");
            }
            item = item->next;
        }
    }

    raw = ty_cJSON_PrintUnformatted(flat);
    ty_cJSON_Delete(flat);
    if (!raw) {
        snprintf(out, out_sz, "(print fail)");
        return;
    }

    snprintf(out, out_sz, "%s", raw);
    ty_cJSON_FreeBuffer(raw);
}

MCP_CLIENT_TRANSPORT_E mcp_client_type_from_string(CONST CHAR_T *s)
{
    if (!s)
        return MCP_CLIENT_TYPE_UNKNOWN;
    if (strcmp(s, "streamablehttp") == 0)
        return MCP_CLIENT_TYPE_STREAMABLEHTTP;
    if (strcmp(s, "stdio") == 0)
        return MCP_CLIENT_TYPE_STDIO;
    if (strcmp(s, "sse") == 0)
        return MCP_CLIENT_TYPE_SSE;
    if (strcmp(s, "websocket") == 0)
        return MCP_CLIENT_TYPE_WEBSOCKET;
    return MCP_CLIENT_TYPE_UNKNOWN;
}

CONST CHAR_T *mcp_client_type_to_string(MCP_CLIENT_TRANSPORT_E type)
{
    switch (type) {
    case MCP_CLIENT_TYPE_STREAMABLEHTTP: return "streamablehttp";
    case MCP_CLIENT_TYPE_STDIO:          return "stdio";
    case MCP_CLIENT_TYPE_SSE:            return "sse";
    case MCP_CLIENT_TYPE_WEBSOCKET:      return "websocket";
    default:                             return "unknown";
    }
}

MCP_CLIENT_RISK_E mcp_client_risk_from_string(CONST CHAR_T *s)
{
    if (!s)
        return MCP_CLIENT_RISK_QUERY;
    if (strcmp(s, "payment") == 0)
        return MCP_CLIENT_RISK_PAYMENT;
    if (strcmp(s, "purchase") == 0)
        return MCP_CLIENT_RISK_PURCHASE;
    if (strcmp(s, "write") == 0)
        return MCP_CLIENT_RISK_WRITE;
    return MCP_CLIENT_RISK_QUERY;
}
