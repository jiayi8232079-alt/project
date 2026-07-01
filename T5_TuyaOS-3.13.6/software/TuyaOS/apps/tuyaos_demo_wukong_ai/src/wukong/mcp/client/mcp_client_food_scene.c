/**
 * @file mcp_client_food_scene.c
 * @brief 点餐场景：查 MCP 工具 → 查询类调用 → 推荐（下单需确认）
 */

#include "mcp_client_food_scene.h"
#include "mcp_client_manager.h"
#include "mcp_client_router.h"

#include "mcp_content.h"
#include "tal_log.h"

OPERATE_RET mcp_client_food_scene_recommend(ty_cJSON **out_recommendations, BOOL_T *out_is_error)
{
    UINT_T i, n;
    ty_cJSON *summary;
    CHAR_T *text;

    if (!out_recommendations || !out_is_error)
        return OPRT_INVALID_PARM;

    *out_recommendations = ty_cJSON_CreateArray();
    if (!*out_recommendations)
        return OPRT_MALLOC_FAILED;

    *out_is_error = FALSE;
    n = mcp_client_manager_tool_count();

    summary = ty_cJSON_CreateObject();
    if (!summary) {
        ty_cJSON_Delete(*out_recommendations);
        return OPRT_MALLOC_FAILED;
    }

    ty_cJSON_AddStringToObject(summary, "scene", "food_recommend");
    ty_cJSON_AddStringToObject(summary, "hint",
        "Query-only tools may run automatically; create-order requires user confirmation on device.");

    for (i = 0; i < n; i++) {
        CONST MCP_CLIENT_TOOL_CACHE_T *t = mcp_client_manager_get_tool(i);
        ty_cJSON *entry;

        if (!t || t->inferred_risk > MCP_CLIENT_RISK_QUERY)
            continue;

        entry = ty_cJSON_CreateObject();
        if (!entry)
            continue;
        ty_cJSON_AddStringToObject(entry, "tool", t->namespaced);
        ty_cJSON_AddStringToObject(entry, "description", t->description);
        ty_cJSON_AddItemToObject(summary, t->namespaced, entry);
    }

    text = ty_cJSON_PrintUnformatted(summary);
    ty_cJSON_Delete(summary);
    if (text) {
        ty_cJSON_AddItemToArray(*out_recommendations, mcp_content_make_text(text));
        ty_cJSON_FreeBuffer(text);
    }

    TAL_PR_INFO("Food scene recommend prepared query-tool map");
    return OPRT_OK;
}
