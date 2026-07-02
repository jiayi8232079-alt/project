/**
 * @file mcp_tool_external_mcp.c
 * @brief 第三方 MCP 管理类 MCP 工具（配置、测试、刷新、点餐场景）
 */

#include "mcp_tool_external_mcp.h"
#include "wukong_ai_mcp.h"

#include "client/mcp_client_config.h"
#include "client/mcp_client_food_scene.h"
#include "client/mcp_client_manager.h"
#include "client/mcp_client_router.h"
#include "client/mcp_client_util.h"

#include <stdio.h>

#include "mcp_content.h"
#include "tal_log.h"

STATIC OPERATE_RET __mcp_config_list(CONST CHAR_T *name, CONST ty_cJSON *args,
                                     ty_cJSON **out_content, BOOL_T *is_error, VOID *user_data)
{
    MCP_CLIENT_SERVER_CFG_T servers[MCP_CLIENT_MAX_SERVERS];
    UINT_T count = 0;
    ty_cJSON *root;
    CHAR_T *text;

    (VOID)name;
    (VOID)args;
    (VOID)user_data;

    mcp_client_config_load(servers, MCP_CLIENT_MAX_SERVERS, &count);
    root = mcp_client_config_to_json(servers, count, TRUE);
    mcp_client_config_free_list(servers, count);

    *out_content = ty_cJSON_CreateArray();
    if (!*out_content)
        return OPRT_MALLOC_FAILED;

    if (!root) {
        ty_cJSON_AddItemToArray(*out_content, mcp_content_make_text("[]"));
        return OPRT_OK;
    }

    text = ty_cJSON_PrintUnformatted(root);
    ty_cJSON_Delete(root);
    if (text) {
        ty_cJSON_AddItemToArray(*out_content, mcp_content_make_text(text));
        ty_cJSON_FreeBuffer(text);
    }
    *is_error = FALSE;
    return OPRT_OK;
}

STATIC OPERATE_RET __mcp_test_connection(CONST CHAR_T *name, CONST ty_cJSON *args,
                                       ty_cJSON **out_content, BOOL_T *is_error, VOID *user_data)
{
    CONST CHAR_T *mcp_id = NULL;
    ty_cJSON *j;
    CHAR_T detail[128];
    OPERATE_RET rt;

    (VOID)name;
    (VOID)user_data;

    if (args) {
        j = ty_cJSON_GetObjectItem(args, "mcpId");
        if (j && ty_cJSON_IsString(j))
            mcp_id = j->valuestring;
    }

    *out_content = ty_cJSON_CreateArray();
    if (!*out_content)
        return OPRT_MALLOC_FAILED;

    if (!mcp_id) {
        ty_cJSON_AddItemToArray(*out_content, mcp_content_make_text("Missing mcpId"));
        *is_error = TRUE;
        return OPRT_OK;
    }

    rt = mcp_client_manager_test_connection(mcp_id, detail, sizeof(detail));
    ty_cJSON_AddItemToArray(*out_content, mcp_content_make_text(detail));
    *is_error = (rt != OPRT_OK);
    return OPRT_OK;
}

STATIC OPERATE_RET __mcp_refresh_tools(CONST CHAR_T *name, CONST ty_cJSON *args,
                                     ty_cJSON **out_content, BOOL_T *is_error, VOID *user_data)
{
    OPERATE_RET rt;
    CHAR_T msg[64];

    (VOID)name;
    (VOID)args;
    (VOID)user_data;

    rt = mcp_client_manager_refresh_all();
    snprintf(msg, sizeof(msg), "refresh rt=%d tools=%u", rt, mcp_client_manager_tool_count());

    *out_content = ty_cJSON_CreateArray();
    if (*out_content)
        ty_cJSON_AddItemToArray(*out_content, mcp_content_make_text(msg));
    *is_error = (rt != OPRT_OK);
    return OPRT_OK;
}

STATIC OPERATE_RET __mcp_list_tools(CONST CHAR_T *name, CONST ty_cJSON *args,
                                    ty_cJSON **out_content, BOOL_T *is_error, VOID *user_data)
{
    ty_cJSON *arr;
    CHAR_T *text;

    (VOID)name;
    (VOID)args;
    (VOID)user_data;

    mcp_client_manager_list_tools_json(&arr, TRUE);
    *out_content = ty_cJSON_CreateArray();
    if (!*out_content) {
        ty_cJSON_Delete(arr);
        return OPRT_MALLOC_FAILED;
    }

    text = arr ? ty_cJSON_PrintUnformatted(arr) : NULL;
    ty_cJSON_Delete(arr);
    if (text) {
        ty_cJSON_AddItemToArray(*out_content, mcp_content_make_text(text));
        ty_cJSON_FreeBuffer(text);
    }
    *is_error = FALSE;
    return OPRT_OK;
}

STATIC OPERATE_RET __mcp_call_namespaced(CONST CHAR_T *name, CONST ty_cJSON *args,
                                         ty_cJSON **out_content, BOOL_T *is_error, VOID *user_data)
{
    CONST CHAR_T *ns = NULL;
    BOOL_T confirmed = FALSE;
    ty_cJSON *j, *arguments = NULL;

    (VOID)name;
    (VOID)user_data;

    if (args) {
        j = ty_cJSON_GetObjectItem(args, "tool");
        if (j && ty_cJSON_IsString(j))
            ns = j->valuestring;
        arguments = ty_cJSON_GetObjectItem(args, "arguments");
        j = ty_cJSON_GetObjectItem(args, "userConfirmed");
        if (j && ty_cJSON_IsBool(j))
            confirmed = ty_cJSON_IsTrue(j);
    }

    if (!ns) {
        *out_content = ty_cJSON_CreateArray();
        if (*out_content)
            ty_cJSON_AddItemToArray(*out_content, mcp_content_make_text("Missing tool"));
        *is_error = TRUE;
        return OPRT_OK;
    }

    return mcp_client_router_call(ns, arguments, confirmed, out_content, is_error);
}

STATIC OPERATE_RET __mcp_food_recommend(CONST CHAR_T *name, CONST ty_cJSON *args,
                                        ty_cJSON **out_content, BOOL_T *is_error, VOID *user_data)
{
    CONST CHAR_T *user_query = NULL;
    ty_cJSON *j;

    (VOID)name;
    (VOID)user_data;

    if (args) {
        j = ty_cJSON_GetObjectItem(args, "userQuery");
        if (j && ty_cJSON_IsString(j))
            user_query = j->valuestring;
    }
    return mcp_client_food_scene_recommend(user_query, out_content, is_error);
}

STATIC OPERATE_RET __mcp_load_example(CONST CHAR_T *name, CONST ty_cJSON *args,
                                      ty_cJSON **out_content, BOOL_T *is_error, VOID *user_data)
{
    OPERATE_RET rt;

    (VOID)name;
    (VOID)args;
    (VOID)user_data;

    rt = mcp_client_config_load_example_mcd();
    if (rt == OPRT_OK)
        mcp_client_manager_refresh_all();

    *out_content = ty_cJSON_CreateArray();
    if (*out_content)
        ty_cJSON_AddItemToArray(*out_content,
            mcp_content_make_text(rt == OPRT_OK ? "McDonald example config loaded" : "Load failed"));
    *is_error = (rt != OPRT_OK);
    return OPRT_OK;
}

OPERATE_RET mcp_tool_external_mcp_init(VOID)
{
    MCP_TOOL_ADD("device_mcp_config_list",
                 "List configured third-party MCP servers (secrets redacted)",
                 __mcp_config_list, NULL, NULL);

    MCP_TOOL_ADD("device_mcp_test_connection",
                 "Test connection to a third-party MCP server by mcpId",
                 __mcp_test_connection, NULL,
                 MCP_SCHEMA_STR("mcpId", "MCP server id e.g. mcd"),
                 NULL);

    MCP_TOOL_ADD("device_mcp_refresh_tools",
                 "Refresh aggregated tools/list from all enabled MCP servers",
                 __mcp_refresh_tools, NULL, NULL);

    MCP_TOOL_ADD("device_mcp_list_tools",
                 "Return cached namespaced external MCP tools",
                 __mcp_list_tools, NULL, NULL);

    MCP_TOOL_ADD("device_mcp_call_tool",
                 "Call a namespaced external MCP tool (e.g. mcd.query-meals)",
                 __mcp_call_namespaced, NULL,
                 MCP_SCHEMA_STR("tool", "Namespaced tool name"),
                 MCP_SCHEMA_BOOL_OPT("userConfirmed", "User confirmed high-risk action"),
                 NULL);

    MCP_TOOL_ADD("device_mcp_food_recommend",
                 "McDonald order: query-nearby-stores(searchType=2,city from device config) "
                 "then query-meals. For 优惠券 use available-coupons / query-my-coupons. "
                 "Prefer over NLG for 麦当劳/汉堡/点餐/优惠券.",
                 __mcp_food_recommend, NULL,
                 MCP_SCHEMA_STR_OPT("userQuery", "User utterance e.g. 点一份麦当劳"),
                 NULL);

    MCP_TOOL_ADD("device_mcp_load_mcd_example",
                 "Load McDonald MCP example config (placeholder token)",
                 __mcp_load_example, NULL, NULL);

    return OPRT_OK;
}
