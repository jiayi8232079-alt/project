/**
 * @file mcp_client_integration.c
 * @brief 将第三方 MCP 工具合并进 tools/list，并拦截 namespaced tools/call
 */

#include "mcp_client_integration.h"
#include "mcp_client_manager.h"

#include "mcp_server.h"
#include "mcp_server_internal.h"
#include "tal_log.h"
#include "tal_memory.h"
#include "tal_workq_service.h"
#include "utilities/mix_method.h"

typedef struct {
    CHAR_T *sid;
    CHAR_T *eid;
    CHAR_T *id;
    CHAR_T *tool_name;
    ty_cJSON *arguments;
    BOOL_T user_confirmed;
} EXT_TOOL_CALL_MSG_T;

STATIC VOID __ext_tool_worker(VOID_T *data)
{
    EXT_TOOL_CALL_MSG_T *msg = (EXT_TOOL_CALL_MSG_T *)data;
    ty_cJSON *content = NULL;
    BOOL_T is_error = FALSE;
    ty_cJSON *result;

    if (!msg)
        return;

    mcp_client_manager_call_tool(msg->tool_name, msg->arguments, msg->user_confirmed,
                                 &content, &is_error);

    result = ty_cJSON_CreateObject();
    if (result) {
        if (content)
            ty_cJSON_AddItemToObject(result, "content", content);
        else
            ty_cJSON_AddItemToObject(result, "content", ty_cJSON_CreateArray());
        if (is_error)
            ty_cJSON_AddBoolToObject(result, "isError", TRUE);
        mcp_server_reply_result(msg->sid, msg->eid, msg->id, result);
    } else if (content) {
        ty_cJSON_Delete(content);
    }

    tal_free(msg->sid);
    tal_free(msg->eid);
    tal_free(msg->id);
    tal_free(msg->tool_name);
    if (msg->arguments)
        ty_cJSON_Delete(msg->arguments);
    tal_free(msg);
}

VOID mcp_client_integration_append_tools(ty_cJSON *tools_arr, INT_T *payload_len)
{
    UINT_T i, n;
    INT_T base_len = payload_len ? *payload_len : 0;

    if (!tools_arr)
        return;

    n = mcp_client_manager_tool_count();
    for (i = 0; i < n; i++) {
        CONST MCP_CLIENT_TOOL_CACHE_T *t = mcp_client_manager_get_tool(i);
        ty_cJSON *tj, *ts;
        INT_T tl;

        if (!t)
            continue;

        tj = ty_cJSON_CreateObject();
        if (!tj)
            continue;

        ty_cJSON_AddStringToObject(tj, "name", t->namespaced);
        ty_cJSON_AddStringToObject(tj, "description", t->description);
        if (t->input_schema)
            ty_cJSON_AddItemReferenceToObject(tj, "inputSchema", t->input_schema);
        else
            ty_cJSON_AddObjectToObject(tj, "inputSchema");

        ts = ty_cJSON_PrintUnformatted(tj);
        if (ts) {
            tl = (INT_T)strlen(ts);
            if (payload_len && base_len + tl + 128 > MCP_MAX_PAYLOAD_SIZE) {
                ty_cJSON_FreeBuffer(ts);
                ty_cJSON_Delete(tj);
                break;
            }
            if (payload_len)
                base_len += tl;
            ty_cJSON_FreeBuffer(ts);
        }

        ty_cJSON_AddItemToArray(tools_arr, tj);
    }

    if (payload_len)
        *payload_len = base_len;
}

BOOL_T mcp_client_integration_is_external_tool(CONST CHAR_T *tool_name)
{
    return (tool_name && strchr(tool_name, '.') != NULL &&
            mcp_client_manager_find_tool(tool_name) != NULL);
}

OPERATE_RET mcp_client_integration_schedule_call(CONST CHAR_T *sid, CONST CHAR_T *eid, CONST CHAR_T *id,
                                                 CONST CHAR_T *tool_name, CONST ty_cJSON *arguments,
                                                 BOOL_T user_confirmed)
{
    EXT_TOOL_CALL_MSG_T *msg;
    OPERATE_RET rt;

    msg = (EXT_TOOL_CALL_MSG_T *)tal_calloc(1, sizeof(*msg));
    if (!msg)
        return OPRT_MALLOC_FAILED;

    msg->sid = mm_strdup(sid);
    msg->eid = mm_strdup(eid);
    msg->id = mm_strdup(id);
    msg->tool_name = mm_strdup(tool_name);
    if (!msg->sid || !msg->eid || !msg->id || !msg->tool_name)
        goto err;

    msg->arguments = arguments ? ty_cJSON_Duplicate(arguments, 1) : NULL;
    msg->user_confirmed = user_confirmed;

    rt = tal_workq_schedule(WORKQ_SYSTEM, __ext_tool_worker, msg);
    if (rt != OPRT_OK)
        goto err;

    return OPRT_OK;

err:
    tal_free(msg->sid);
    tal_free(msg->eid);
    tal_free(msg->id);
    tal_free(msg->tool_name);
    if (msg->arguments)
        ty_cJSON_Delete(msg->arguments);
    tal_free(msg);
    return OPRT_MALLOC_FAILED;
}
