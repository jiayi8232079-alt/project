/**
 * @file mcp_client_config.c
 * @brief 第三方 MCP Server 配置 KV 读写
 */

#include "mcp_client_config.h"
#include "mcp_client_util.h"

#include <string.h>

#include "tal_log.h"
#include "tal_memory.h"
#include "tuya_ws_db.h"

STATIC BOOL_T s_cfg_inited = FALSE;

OPERATE_RET mcp_client_config_init(VOID)
{
    s_cfg_inited = TRUE;
    return OPRT_OK;
}

VOID mcp_client_config_free_list(MCP_CLIENT_SERVER_CFG_T *servers, UINT_T count)
{
    UINT_T i;

    if (!servers)
        return;

    for (i = 0; i < count; i++) {
        if (servers[i].headers) {
            ty_cJSON_Delete(servers[i].headers);
            servers[i].headers = NULL;
        }
    }
}

OPERATE_RET mcp_client_config_from_json_entry(ty_cJSON *obj, MCP_CLIENT_SERVER_CFG_T *out)
{
    ty_cJSON *j;

    if (!obj || !out || !ty_cJSON_IsObject(obj))
        return OPRT_INVALID_PARM;

    memset(out, 0, sizeof(*out));

    j = ty_cJSON_GetObjectItem(obj, "id");
    if (!j || !ty_cJSON_IsString(j))
        return OPRT_INVALID_PARM;
    snprintf(out->id, sizeof(out->id), "%s", j->valuestring);

    j = ty_cJSON_GetObjectItem(obj, "name");
    if (j && ty_cJSON_IsString(j))
        snprintf(out->name, sizeof(out->name), "%s", j->valuestring);

    j = ty_cJSON_GetObjectItem(obj, "type");
    out->type = mcp_client_type_from_string(j && ty_cJSON_IsString(j) ? j->valuestring : NULL);

    j = ty_cJSON_GetObjectItem(obj, "url");
    if (j && ty_cJSON_IsString(j))
        snprintf(out->url, sizeof(out->url), "%s", j->valuestring);

    j = ty_cJSON_GetObjectItem(obj, "headers");
    if (j && ty_cJSON_IsObject(j))
        out->headers = ty_cJSON_Duplicate(j, 1);

    j = ty_cJSON_GetObjectItem(obj, "enabled");
    out->enabled = (j && ty_cJSON_IsBool(j)) ? ty_cJSON_IsTrue(j) : TRUE;

    j = ty_cJSON_GetObjectItem(obj, "riskLevel");
    out->risk_level = mcp_client_risk_from_string(j && ty_cJSON_IsString(j) ? j->valuestring : NULL);

    j = ty_cJSON_GetObjectItem(obj, "requireUserConfirm");
    out->require_user_confirm = (j && ty_cJSON_IsBool(j)) ? ty_cJSON_IsTrue(j) : FALSE;

    j = ty_cJSON_GetObjectItem(obj, "createdAt");
    out->created_at = (j && ty_cJSON_IsNumber(j)) ? (UINT_T)j->valueint : mcp_client_now_unix();

    j = ty_cJSON_GetObjectItem(obj, "updatedAt");
    out->updated_at = (j && ty_cJSON_IsNumber(j)) ? (UINT_T)j->valueint : mcp_client_now_unix();

    return OPRT_OK;
}

STATIC OPERATE_RET __entry_to_json(CONST MCP_CLIENT_SERVER_CFG_T *s, ty_cJSON *obj, BOOL_T redact)
{
    ty_cJSON *headers;

    if (!s || !obj)
        return OPRT_INVALID_PARM;

    ty_cJSON_AddStringToObject(obj, "id", s->id);
    ty_cJSON_AddStringToObject(obj, "name", s->name);
    ty_cJSON_AddStringToObject(obj, "type", mcp_client_type_to_string(s->type));
    ty_cJSON_AddStringToObject(obj, "url", s->url);
    ty_cJSON_AddBoolToObject(obj, "enabled", s->enabled);

    switch (s->risk_level) {
    case MCP_CLIENT_RISK_PAYMENT:  ty_cJSON_AddStringToObject(obj, "riskLevel", "payment"); break;
    case MCP_CLIENT_RISK_PURCHASE: ty_cJSON_AddStringToObject(obj, "riskLevel", "purchase"); break;
    case MCP_CLIENT_RISK_WRITE:    ty_cJSON_AddStringToObject(obj, "riskLevel", "write"); break;
    default:                       ty_cJSON_AddStringToObject(obj, "riskLevel", "query"); break;
    }

    ty_cJSON_AddBoolToObject(obj, "requireUserConfirm", s->require_user_confirm);
    ty_cJSON_AddNumberToObject(obj, "createdAt", s->created_at);
    ty_cJSON_AddNumberToObject(obj, "updatedAt", s->updated_at);

    if (s->headers) {
        headers = redact ? ty_cJSON_Duplicate(s->headers, 1) : ty_cJSON_Duplicate(s->headers, 1);
        if (headers && redact) {
            ty_cJSON *item = headers->child;
            while (item) {
                if (item->string && ty_cJSON_IsString(item) &&
                    (strstr(item->string, "Auth") || strstr(item->string, "auth") ||
                     strstr(item->string, "token") || strstr(item->string, "Token"))) {
                    ty_cJSON_SetValuestring(item, "Bearer ***");
                }
                item = item->next;
            }
        }
        if (headers)
            ty_cJSON_AddItemToObject(obj, "headers", headers);
    }

    return OPRT_OK;
}

ty_cJSON *mcp_client_config_to_json(CONST MCP_CLIENT_SERVER_CFG_T *servers, UINT_T count, BOOL_T redact_secrets)
{
    ty_cJSON *root, *arr;
    UINT_T i;

    root = ty_cJSON_CreateObject();
    arr = ty_cJSON_CreateArray();
    if (!root || !arr) {
        ty_cJSON_Delete(root);
        ty_cJSON_Delete(arr);
        return NULL;
    }

    ty_cJSON_AddItemToObject(root, "servers", arr);
    for (i = 0; i < count; i++) {
        ty_cJSON *item = ty_cJSON_CreateObject();
        if (!item)
            continue;
        __entry_to_json(&servers[i], item, redact_secrets);
        ty_cJSON_AddItemToArray(arr, item);
    }

    return root;
}

OPERATE_RET mcp_client_config_load(MCP_CLIENT_SERVER_CFG_T *servers, UINT_T max_count, UINT_T *out_count)
{
    BYTE_T *data = NULL;
    UINT_T data_len = 0;
    ty_cJSON *root, *arr;
    OPERATE_RET rt;
    UINT_T i, n;

    if (!servers || !out_count || max_count == 0)
        return OPRT_INVALID_PARM;

    *out_count = 0;
    if (!s_cfg_inited)
        mcp_client_config_init();

    rt = wd_common_read(MCP_CLIENT_KV_KEY, &data, &data_len);
    if (rt != OPRT_OK || !data || data_len == 0) {
        if (data)
            wd_common_free_data(data);
        return OPRT_OK;
    }

    root = ty_cJSON_Parse((CONST CHAR_T *)data);
    wd_common_free_data(data);
    if (!root)
        return OPRT_COM_ERROR;

    arr = ty_cJSON_GetObjectItem(root, "servers");
    if (!arr || !ty_cJSON_IsArray(arr)) {
        ty_cJSON_Delete(root);
        return OPRT_COM_ERROR;
    }

    n = (UINT_T)ty_cJSON_GetArraySize(arr);
    for (i = 0; i < n && *out_count < max_count; i++) {
        ty_cJSON *item = ty_cJSON_GetArrayItem(arr, (INT_T)i);
        if (mcp_client_config_from_json_entry(item, &servers[*out_count]) == OPRT_OK)
            (*out_count)++;
    }

    ty_cJSON_Delete(root);
    return OPRT_OK;
}

OPERATE_RET mcp_client_config_save(CONST MCP_CLIENT_SERVER_CFG_T *servers, UINT_T count)
{
    ty_cJSON *root;
    CHAR_T *json_str;
    OPERATE_RET rt;

    if (!servers)
        return OPRT_INVALID_PARM;

    root = mcp_client_config_to_json(servers, count, FALSE);
    if (!root)
        return OPRT_MALLOC_FAILED;

    json_str = ty_cJSON_PrintUnformatted(root);
    ty_cJSON_Delete(root);
    if (!json_str)
        return OPRT_MALLOC_FAILED;

    rt = wd_common_write(MCP_CLIENT_KV_KEY, (CONST BYTE_T *)json_str, strlen(json_str));
    ty_cJSON_FreeBuffer(json_str);
    return rt;
}

OPERATE_RET mcp_client_config_get(CONST CHAR_T *id, MCP_CLIENT_SERVER_CFG_T *out)
{
    MCP_CLIENT_SERVER_CFG_T list[MCP_CLIENT_MAX_SERVERS];
    UINT_T count = 0, i;
    OPERATE_RET rt;

    if (!id || !out)
        return OPRT_INVALID_PARM;

    rt = mcp_client_config_load(list, MCP_CLIENT_MAX_SERVERS, &count);
    if (rt != OPRT_OK)
        return rt;

    for (i = 0; i < count; i++) {
        if (strcmp(list[i].id, id) == 0) {
            memcpy(out, &list[i], sizeof(*out));
            if (list[i].headers)
                out->headers = ty_cJSON_Duplicate(list[i].headers, 1);
            mcp_client_config_free_list(list, count);
            return OPRT_OK;
        }
    }

    mcp_client_config_free_list(list, count);
    return OPRT_NOT_FOUND;
}

OPERATE_RET mcp_client_config_upsert(CONST MCP_CLIENT_SERVER_CFG_T *entry)
{
    MCP_CLIENT_SERVER_CFG_T list[MCP_CLIENT_MAX_SERVERS];
    UINT_T count = 0, i;
    BOOL_T found = FALSE;
    OPERATE_RET rt;

    if (!entry)
        return OPRT_INVALID_PARM;

    rt = mcp_client_config_load(list, MCP_CLIENT_MAX_SERVERS, &count);
    if (rt != OPRT_OK)
        return rt;

    for (i = 0; i < count; i++) {
        if (strcmp(list[i].id, entry->id) == 0) {
            if (list[i].headers)
                ty_cJSON_Delete(list[i].headers);
            memcpy(&list[i], entry, sizeof(*entry));
            list[i].headers = entry->headers ? ty_cJSON_Duplicate(entry->headers, 1) : NULL;
            list[i].updated_at = mcp_client_now_unix();
            found = TRUE;
            break;
        }
    }

    if (!found) {
        if (count >= MCP_CLIENT_MAX_SERVERS) {
            mcp_client_config_free_list(list, count);
            return OPRT_BUFFER_NOT_ENOUGH;
        }
        memcpy(&list[count], entry, sizeof(*entry));
        list[count].headers = entry->headers ? ty_cJSON_Duplicate(entry->headers, 1) : NULL;
        if (list[count].created_at == 0)
            list[count].created_at = mcp_client_now_unix();
        list[count].updated_at = mcp_client_now_unix();
        count++;
    }

    rt = mcp_client_config_save(list, count);
    mcp_client_config_free_list(list, count);
    return rt;
}

OPERATE_RET mcp_client_config_remove(CONST CHAR_T *id)
{
    MCP_CLIENT_SERVER_CFG_T list[MCP_CLIENT_MAX_SERVERS];
    UINT_T count = 0, i, w;
    OPERATE_RET rt;

    if (!id)
        return OPRT_INVALID_PARM;

    rt = mcp_client_config_load(list, MCP_CLIENT_MAX_SERVERS, &count);
    if (rt != OPRT_OK)
        return rt;

    for (i = 0, w = 0; i < count; i++) {
        if (strcmp(list[i].id, id) == 0) {
            if (list[i].headers)
                ty_cJSON_Delete(list[i].headers);
            continue;
        }
        if (i != w)
            list[w] = list[i];
        w++;
    }

    if (w == count)
        return OPRT_NOT_FOUND;

    rt = mcp_client_config_save(list, w);
    mcp_client_config_free_list(list, count);
    return rt;
}

OPERATE_RET mcp_client_config_load_example_mcd(VOID)
{
    MCP_CLIENT_SERVER_CFG_T entry;

    memset(&entry, 0, sizeof(entry));
    snprintf(entry.id, sizeof(entry.id), "mcd");
    snprintf(entry.name, sizeof(entry.name), "麦当劳 MCP");
    entry.type = MCP_CLIENT_TYPE_STREAMABLEHTTP;
    snprintf(entry.url, sizeof(entry.url), "https://mcp.mcd.cn");
    entry.headers = ty_cJSON_Parse("{\"Authorization\":\"Bearer YOUR_MCP_TOKEN\"}");
    entry.enabled = TRUE;
    entry.risk_level = MCP_CLIENT_RISK_PURCHASE;
    entry.require_user_confirm = TRUE;
    entry.created_at = mcp_client_now_unix();
    entry.updated_at = entry.created_at;

    TAL_PR_INFO("MCP example config upsert id=%s url=%s (token placeholder)", entry.id, entry.url);
    return mcp_client_config_upsert(&entry);
}
