/**
 * @file mcp_client_manager.c
 * @brief 第三方 MCP Client 管理器实现
 */

#include "mcp_client_manager.h"
#include "mcp_client_config.h"
#include "mcp_client_policy.h"
#include "mcp_client_transport.h"
#include "mcp_client_util.h"

#include <stdio.h>
#include <string.h>

#include "mcp_content.h"
#include "tal_log.h"
#include "tal_memory.h"
#include "tal_mutex.h"
#include "tal_workq_service.h"

STATIC MCP_CLIENT_TOOL_CACHE_T s_tools[MCP_CLIENT_MAX_TOOLS];
STATIC UINT_T s_tool_count = 0;
STATIC MUTEX_HANDLE s_mutex = NULL;

STATIC CONST CHAR_T *__mcp_rt_label(OPERATE_RET rt)
{
    switch (rt) {
    case OPRT_OK:
        return "ok";
    case OPRT_COM_ERROR:
        return "com_error";
    case OPRT_BUFFER_NOT_ENOUGH:
        return "buffer_not_enough";
    case OPRT_AUTHENTICATION_FAIL:
        return "auth_fail";
    case OPRT_EXCEED_UPPER_LIMIT:
        return "rate_limit";
    case OPRT_TIMEOUT:
        return "timeout";
    case OPRT_MALLOC_FAILED:
        return "malloc_fail";
    default:
        return "other";
    }
}

/* 启动后异步 refresh，避免在 tuya_app_main 栈上同步 TLS */
STATIC VOID __boot_refresh_worker(VOID_T *data)
{
    (VOID)data;
    (VOID)mcp_client_manager_refresh_all();
}

STATIC VOID __clear_tools(VOID)
{
    UINT_T i;

    for (i = 0; i < s_tool_count; i++) {
        if (s_tools[i].input_schema) {
            ty_cJSON_Delete(s_tools[i].input_schema);
            s_tools[i].input_schema = NULL;
        }
    }
    s_tool_count = 0;
}

STATIC OPERATE_RET __cache_tools_from_server(CONST MCP_CLIENT_SERVER_CFG_T *server)
{
    UINT_T before_count;
    ty_cJSON *params, *result, *tools;
    INT_T http_status = 0;
    OPERATE_RET rt;
    INT_T i, n;

    if (!server || !server->enabled)
        return OPRT_OK;

    before_count = s_tool_count;

    params = ty_cJSON_CreateObject();
    if (!params)
        return OPRT_MALLOC_FAILED;

    rt = mcp_client_transport_jsonrpc(server, "tools/list", params, &result, &http_status);
    ty_cJSON_Delete(params);
    if (rt != OPRT_OK) {
        TAL_PR_WARN("MCP tools/list failed id=%s rt=%d(%s) http=%d",
                    server->id, rt, __mcp_rt_label(rt), http_status);
        return rt;
    }

    tools = ty_cJSON_GetObjectItem(result, "tools");
    if (!tools || !ty_cJSON_IsArray(tools)) {
        ty_cJSON_Delete(result);
        return OPRT_COM_ERROR;
    }

    n = ty_cJSON_GetArraySize(tools);
    for (i = 0; i < n && s_tool_count < MCP_CLIENT_MAX_TOOLS; i++) {
        MCP_CLIENT_TOOL_CACHE_T *cache = &s_tools[s_tool_count];
        ty_cJSON *tj = ty_cJSON_GetArrayItem(tools, i);
        ty_cJSON *name_j, *desc_j, *schema_j;

        if (!tj)
            continue;

        name_j = ty_cJSON_GetObjectItem(tj, "name");
        if (!name_j || !ty_cJSON_IsString(name_j))
            continue;

        memset(cache, 0, sizeof(*cache));
        snprintf(cache->mcp_id, sizeof(cache->mcp_id), "%s", server->id);
        snprintf(cache->orig_name, sizeof(cache->orig_name), "%s", name_j->valuestring);
        mcp_client_build_namespaced(cache->mcp_id, cache->orig_name,
                                    cache->namespaced, sizeof(cache->namespaced));

        desc_j = ty_cJSON_GetObjectItem(tj, "description");
        if (desc_j && ty_cJSON_IsString(desc_j))
            snprintf(cache->description, sizeof(cache->description), "%s", desc_j->valuestring);

        schema_j = ty_cJSON_GetObjectItem(tj, "inputSchema");
        if (!schema_j)
            schema_j = ty_cJSON_GetObjectItem(tj, "input_schema");
        if (schema_j)
            cache->input_schema = ty_cJSON_Duplicate(schema_j, 1);

        cache->inferred_risk = mcp_client_policy_infer_tool_risk(cache->orig_name);
        {
            MCP_CLIENT_POLICY_DECISION_T pol;
            mcp_client_policy_decide(server, cache->orig_name, cache->inferred_risk, &pol);
            cache->require_confirm = pol.require_user_confirm;
        }

        s_tool_count++;
    }

    ty_cJSON_Delete(result);
    TAL_PR_INFO("MCP cached tools id=%s count=%u", server->id, s_tool_count - before_count);
    return OPRT_OK;
}

OPERATE_RET mcp_client_manager_init(VOID)
{
    OPERATE_RET rt;

    rt = tal_mutex_create_init(&s_mutex);
    if (rt != OPRT_OK)
        return rt;

    mcp_client_config_init();
    if (tal_workq_schedule(WORKQ_SYSTEM, __boot_refresh_worker, NULL) != OPRT_OK)
        return mcp_client_manager_refresh_all();
    return OPRT_OK;
}

OPERATE_RET mcp_client_manager_deinit(VOID)
{
    if (s_mutex) {
        tal_mutex_lock(s_mutex);
        __clear_tools();
        tal_mutex_unlock(s_mutex);
        tal_mutex_release(s_mutex);
        s_mutex = NULL;
    }
    return OPRT_OK;
}

OPERATE_RET mcp_client_manager_refresh_all(VOID)
{
    MCP_CLIENT_SERVER_CFG_T servers[MCP_CLIENT_MAX_SERVERS];
    UINT_T count = 0, i;
    OPERATE_RET rt;

    rt = mcp_client_config_load(servers, MCP_CLIENT_MAX_SERVERS, &count);
    if (rt != OPRT_OK)
        return rt;

    if (s_mutex)
        tal_mutex_lock(s_mutex);
    __clear_tools();

    for (i = 0; i < count; i++) {
        if (servers[i].enabled)
            __cache_tools_from_server(&servers[i]);
    }

    if (s_mutex)
        tal_mutex_unlock(s_mutex);

    mcp_client_config_free_list(servers, count);
    return OPRT_OK;
}

OPERATE_RET mcp_client_manager_test_connection(CONST CHAR_T *mcp_id, CHAR_T *detail, SIZE_T detail_sz)
{
    MCP_CLIENT_SERVER_CFG_T server;
    ty_cJSON *params, *result;
    INT_T http_status = 0;
    OPERATE_RET rt;

    if (!mcp_id)
        return OPRT_INVALID_PARM;

    rt = mcp_client_config_get(mcp_id, &server);
    if (rt != OPRT_OK)
        return rt;

    params = ty_cJSON_CreateObject();
    ty_cJSON_AddStringToObject(params, "protocolVersion", "2024-11-05");
    ty_cJSON_AddItemToObject(params, "capabilities", ty_cJSON_CreateObject());
    {
        ty_cJSON *ci = ty_cJSON_CreateObject();
        ty_cJSON_AddStringToObject(ci, "name", "wukong-mcp-client");
        ty_cJSON_AddStringToObject(ci, "version", "0.0.46");
        ty_cJSON_AddItemToObject(params, "clientInfo", ci);
    }

    rt = mcp_client_transport_jsonrpc(&server, "initialize", params, &result, &http_status);
    ty_cJSON_Delete(params);

    if (server.headers)
        ty_cJSON_Delete(server.headers);

    if (detail && detail_sz > 0) {
        if (rt == OPRT_OK)
            snprintf(detail, detail_sz, "ok http=%d", http_status);
        else if (rt == OPRT_AUTHENTICATION_FAIL)
            snprintf(detail, detail_sz, "auth failed http=%d", http_status);
        else if (rt == OPRT_EXCEED_UPPER_LIMIT)
            snprintf(detail, detail_sz, "rate limited http=%d", http_status);
        else if (rt == OPRT_TIMEOUT)
            snprintf(detail, detail_sz, "timeout");
        else
            snprintf(detail, detail_sz, "error rt=%d http=%d", rt, http_status);
    }

    if (result)
        ty_cJSON_Delete(result);

    return rt;
}

OPERATE_RET mcp_client_manager_list_tools_json(ty_cJSON **out_array, BOOL_T redact)
{
    ty_cJSON *arr;
    UINT_T i;

    (VOID)redact;

    if (!out_array)
        return OPRT_INVALID_PARM;

    arr = ty_cJSON_CreateArray();
    if (!arr)
        return OPRT_MALLOC_FAILED;

    if (s_mutex)
        tal_mutex_lock(s_mutex);

    for (i = 0; i < s_tool_count; i++) {
        ty_cJSON *item = ty_cJSON_CreateObject();
        if (!item)
            continue;
        ty_cJSON_AddStringToObject(item, "name", s_tools[i].namespaced);
        ty_cJSON_AddStringToObject(item, "description", s_tools[i].description);
        ty_cJSON_AddStringToObject(item, "mcpId", s_tools[i].mcp_id);
        ty_cJSON_AddStringToObject(item, "originalName", s_tools[i].orig_name);
        ty_cJSON_AddBoolToObject(item, "requireUserConfirm", s_tools[i].require_confirm);
        if (s_tools[i].input_schema)
            ty_cJSON_AddItemReferenceToObject(item, "inputSchema", s_tools[i].input_schema);
        ty_cJSON_AddItemToArray(arr, item);
    }

    if (s_mutex)
        tal_mutex_unlock(s_mutex);

    *out_array = arr;
    return OPRT_OK;
}

UINT_T mcp_client_manager_tool_count(VOID)
{
    return s_tool_count;
}

CONST MCP_CLIENT_TOOL_CACHE_T *mcp_client_manager_get_tool(UINT_T index)
{
    if (index >= s_tool_count)
        return NULL;
    return &s_tools[index];
}

CONST MCP_CLIENT_TOOL_CACHE_T *mcp_client_manager_find_tool(CONST CHAR_T *namespaced)
{
    UINT_T i;

    if (!namespaced)
        return NULL;

    for (i = 0; i < s_tool_count; i++) {
        if (strcmp(s_tools[i].namespaced, namespaced) == 0)
            return &s_tools[i];
    }
    return NULL;
}

OPERATE_RET mcp_client_manager_call_tool(CONST CHAR_T *namespaced, CONST ty_cJSON *arguments,
                                         BOOL_T user_confirmed, ty_cJSON **out_content,
                                         BOOL_T *out_is_error)
{
    MCP_CLIENT_SERVER_CFG_T server;
    CONST MCP_CLIENT_TOOL_CACHE_T *tool;
    MCP_CLIENT_POLICY_DECISION_T pol;
    ty_cJSON *params, *result, *content_arr;
    CHAR_T mcp_id[MCP_CLIENT_ID_MAX];
    CHAR_T orig_name[MCP_CLIENT_TOOL_NAME_MAX];
    CHAR_T log_args[256];
    INT_T http_status = 0;
    OPERATE_RET rt;
    CHAR_T *result_text;

    if (!namespaced || !out_content || !out_is_error)
        return OPRT_INVALID_PARM;

    *out_content = NULL;
    *out_is_error = FALSE;

    tool = mcp_client_manager_find_tool(namespaced);
    if (!tool)
        return OPRT_NOT_FOUND;

    rt = mcp_client_parse_namespaced(namespaced, mcp_id, sizeof(mcp_id),
                                     orig_name, sizeof(orig_name));
    if (rt != OPRT_OK)
        return rt;

    rt = mcp_client_config_get(mcp_id, &server);
    if (rt != OPRT_OK)
        return rt;

    mcp_client_policy_decide(&server, orig_name, tool->inferred_risk, &pol);
    if (pol.require_user_confirm && !user_confirmed) {
        if (server.headers)
            ty_cJSON_Delete(server.headers);
        *out_content = ty_cJSON_CreateArray();
        if (*out_content)
            ty_cJSON_AddItemToArray(*out_content,
                mcp_content_make_text("Tool requires user confirmation before execution"));
        *out_is_error = TRUE;
        return OPRT_OK;
    }

    if (!pol.allow_auto_call && !user_confirmed) {
        if (server.headers)
            ty_cJSON_Delete(server.headers);
        *out_content = ty_cJSON_CreateArray();
        if (*out_content)
            ty_cJSON_AddItemToArray(*out_content,
                mcp_content_make_text("High-risk tool blocked until user confirms"));
        *out_is_error = TRUE;
        return OPRT_OK;
    }

    params = ty_cJSON_CreateObject();
    ty_cJSON_AddStringToObject(params, "name", orig_name);
    if (arguments)
        ty_cJSON_AddItemToObject(params, "arguments", ty_cJSON_Duplicate(arguments, 1));

    mcp_client_redact_json_for_log(arguments, log_args, sizeof(log_args));
    TAL_PR_NOTICE("MCP tool call ns=%s args=%s confirmed=%d", namespaced, log_args, user_confirmed);

    rt = mcp_client_transport_jsonrpc(&server, "tools/call", params, &result, &http_status);
    ty_cJSON_Delete(params);
    if (server.headers)
        ty_cJSON_Delete(server.headers);

    if (rt != OPRT_OK) {
        if (rt == OPRT_BUFFER_NOT_ENOUGH)
            TAL_PR_WARN("MCP tools/call rsp truncated ns=%s max=%u", namespaced,
                        (UINT_T)MCP_CLIENT_HTTP_RESP_MAX);
        *out_content = ty_cJSON_CreateArray();
        if (*out_content)
            ty_cJSON_AddItemToArray(*out_content, mcp_content_make_text("External MCP call failed"));
        *out_is_error = TRUE;
        return OPRT_OK;
    }

    content_arr = ty_cJSON_GetObjectItem(result, "content");
    if (content_arr && ty_cJSON_IsArray(content_arr)) {
        *out_content = ty_cJSON_Duplicate(content_arr, 1);
        if (ty_cJSON_IsTrue(ty_cJSON_GetObjectItem(result, "isError")))
            *out_is_error = TRUE;
        ty_cJSON_Delete(result);
        return OPRT_OK;
    }

    result_text = ty_cJSON_PrintUnformatted(result);
    ty_cJSON_Delete(result);

    *out_content = ty_cJSON_CreateArray();
    if (*out_content && result_text) {
        ty_cJSON_AddItemToArray(*out_content, mcp_content_make_text(result_text));
        ty_cJSON_FreeBuffer(result_text);
    }
    return OPRT_OK;
}
