/**
 * @file mcp_client_food_scene.c
 * @brief 点餐场景：查 MCP 工具 → 查询类调用 → 返回真实菜单 JSON
 */

#include "mcp_client_food_scene.h"
#include "mcp_client_config.h"
#include "mcp_client_manager.h"
#include "mcp_client_router.h"
#include "mcp_client_secrets.h"
#include "mcp_client_util.h"

#include "mcp_content.h"
#include "tal_log.h"
#include "tal_memory.h"
#include "tal_workq_service.h"
#include "tuya_ai_agent.h"
#include "utilities/mix_method.h"
#include "wukong_ai_agent.h"
#include "wukong_ai_skills.h"

#include <stdio.h>
#include <string.h>

#define MCD_MCP_ID              "mcd"
#define FOOD_ASR_TEXT_MAX       256
#define FOOD_SPEAK_SUMMARY_MAX  512
#define FOOD_SPEAK_PREFIX       "直接回复："
#define FOOD_SPEAK_PREFIX_OVER  (sizeof(FOOD_SPEAK_PREFIX))

typedef struct {
    CHAR_T asr_text[FOOD_ASR_TEXT_MAX];
    BOOL_T coupon_only;
} FOOD_ASR_MSG_T;

STATIC BOOL_T __contains_any(CONST CHAR_T *text, CONST CHAR_T *const *kws, UINT_T n)
{
    UINT_T i;

    if (!text)
        return FALSE;
    for (i = 0; i < n; i++) {
        if (kws[i] && strstr(text, kws[i]) != NULL)
            return TRUE;
    }
    return FALSE;
}

STATIC BOOL_T __asr_is_coupon_intent(CONST CHAR_T *text)
{
    CONST CHAR_T *kws[] = {
        "优惠券", "优惠卷", "领券", "有没有优惠", "有优惠", "查优惠", "可用券",
    };

    return __contains_any(text, kws, sizeof(kws) / sizeof(kws[0]));
}

STATIC BOOL_T __asr_is_food_intent(CONST CHAR_T *text)
{
    CONST CHAR_T *kws[] = {
        "麦当劳", "mcdonald", "MCD", "汉堡", "点餐", "点一份", "点一个",
        "吃汉堡", "套餐", "麦乐", "麦辣", "巨无霸",
    };

    return __contains_any(text, kws, sizeof(kws) / sizeof(kws[0]));
}

STATIC CONST MCP_CLIENT_TOOL_CACHE_T *__find_mcd_tool(CONST CHAR_T *orig_name)
{
    CHAR_T ns[MCP_CLIENT_TOOL_NAME_MAX + MCP_CLIENT_ID_MAX + 4];

    if (mcp_client_build_namespaced(MCD_MCP_ID, orig_name, ns, sizeof(ns)) != OPRT_OK)
        return NULL;
    return mcp_client_manager_find_tool(ns);
}

STATIC UINT_T __count_mcd_tools(VOID)
{
    UINT_T i, n, cnt = 0;

    n = mcp_client_manager_tool_count();
    for (i = 0; i < n; i++) {
        CONST MCP_CLIENT_TOOL_CACHE_T *t = mcp_client_manager_get_tool(i);
        if (t && strcmp(t->mcp_id, MCD_MCP_ID) == 0)
            cnt++;
    }
    return cnt;
}

STATIC OPERATE_RET __ensure_mcd_tools(VOID)
{
    OPERATE_RET rt;

    if (__count_mcd_tools() > 0)
        return OPRT_OK;

    rt = mcp_client_config_load_example_mcd();
    if (rt != OPRT_OK)
        return rt;
    return mcp_client_manager_refresh_all();
}

STATIC CONST CHAR_T *__food_search_keyword(CONST CHAR_T *user_query)
{
    if (!user_query || !user_query[0])
        return "麦当劳";
    /* 门店搜索 keyword 不是点餐内容；默认按品牌搜附近店 */
    if (strstr(user_query, "麦当劳") != NULL || strstr(user_query, "MCD") != NULL ||
        strstr(user_query, "mcdonald") != NULL)
        return "麦当劳";
    if (strstr(user_query, "汉堡") != NULL)
        return "麦当劳";
    if (strstr(user_query, "麦乐") != NULL || strstr(user_query, "麦辣") != NULL ||
        strstr(user_query, "巨无霸") != NULL || strstr(user_query, "薯条") != NULL)
        return "麦当劳";
    return "麦当劳";
}

STATIC ty_cJSON *__parse_mcp_json_from_text(CONST CHAR_T *text)
{
    CONST CHAR_T *start;

    if (!text || !text[0])
        return NULL;
    start = strstr(text, "{\"success\"");
    if (!start)
        start = strstr(text, "{\"data\"");
    if (!start)
        start = strchr(text, '{');
    return start ? ty_cJSON_Parse(start) : NULL;
}

STATIC BOOL_T __json_api_success(ty_cJSON *root)
{
    ty_cJSON *j;

    if (!root)
        return FALSE;
    j = ty_cJSON_GetObjectItem(root, "success");
    return j && ty_cJSON_IsBool(j) && ty_cJSON_IsTrue(j);
}

STATIC BOOL_T __json_find_string_recursive(ty_cJSON *node, CONST CHAR_T *key,
                                           CHAR_T *out, SIZE_T out_sz)
{
    ty_cJSON *item;
    INT_T i, n;

    if (!node || !key || !out || out_sz == 0)
        return FALSE;

    if (ty_cJSON_IsObject(node)) {
        item = ty_cJSON_GetObjectItem(node, key);
        if (item && ty_cJSON_IsString(item) && item->valuestring[0]) {
            snprintf(out, out_sz, "%s", item->valuestring);
            return TRUE;
        }
        for (item = node->child; item; item = item->next) {
            if (__json_find_string_recursive(item, key, out, out_sz))
                return TRUE;
        }
    } else if (ty_cJSON_IsArray(node)) {
        n = ty_cJSON_GetArraySize(node);
        for (i = 0; i < n; i++) {
            if (__json_find_string_recursive(ty_cJSON_GetArrayItem(node, i), key, out, out_sz))
                return TRUE;
        }
    }
    return FALSE;
}

STATIC BOOL_T __json_first_store_code(ty_cJSON *root, CHAR_T *out, SIZE_T out_sz)
{
    ty_cJSON *data, *first, *sc;

    if (!root || !out || out_sz == 0)
        return FALSE;
    out[0] = '\0';
    data = ty_cJSON_GetObjectItem(root, "data");
    if (!data || !ty_cJSON_IsArray(data))
        return __json_find_string_recursive(root, "storeCode", out, out_sz);
    first = ty_cJSON_GetArrayItem(data, 0);
    if (!first)
        return FALSE;
    sc = ty_cJSON_GetObjectItem(first, "storeCode");
    if (sc && ty_cJSON_IsString(sc) && sc->valuestring[0]) {
        snprintf(out, out_sz, "%s", sc->valuestring);
        return TRUE;
    }
    return __json_find_string_recursive(first, "storeCode", out, out_sz);
}

STATIC BOOL_T __json_first_store_name(ty_cJSON *root, CHAR_T *out, SIZE_T out_sz)
{
    ty_cJSON *data, *first, *sn;

    if (!root || !out || out_sz == 0)
        return FALSE;
    out[0] = '\0';
    data = ty_cJSON_GetObjectItem(root, "data");
    if (!data || !ty_cJSON_IsArray(data))
        return __json_find_string_recursive(root, "storeName", out, out_sz);
    first = ty_cJSON_GetArrayItem(data, 0);
    if (!first)
        return FALSE;
    sn = ty_cJSON_GetObjectItem(first, "storeName");
    if (sn && ty_cJSON_IsString(sn) && sn->valuestring[0]) {
        snprintf(out, out_sz, "%s", sn->valuestring);
        return TRUE;
    }
    return __json_find_string_recursive(first, "storeName", out, out_sz);
}

STATIC ty_cJSON *__json_meals_categories(ty_cJSON *root)
{
    ty_cJSON *data, *cats;

    if (!root)
        return NULL;
    data = ty_cJSON_GetObjectItem(root, "data");
    if (!data)
        return NULL;
    if (ty_cJSON_IsObject(data)) {
        cats = ty_cJSON_GetObjectItem(data, "categories");
        return (cats && ty_cJSON_IsArray(cats)) ? cats : NULL;
    }
    return ty_cJSON_IsArray(data) ? data : NULL;
}

STATIC VOID __trim_trailing_spaces(CHAR_T *s)
{
    SIZE_T n;

    if (!s)
        return;
    n = strlen(s);
    while (n > 0 && (s[n - 1] == ' ' || s[n - 1] == '\t'))
        s[--n] = '\0';
}

STATIC VOID __summary_coupons_from_markdown(CONST CHAR_T *text, CHAR_T *out, SIZE_T out_sz)
{
    CONST CHAR_T *p;
    INT_T added = 0;

    if (!out || out_sz == 0)
        return;
    out[0] = '\0';
    if (!text)
        return;

    p = text;
    while ((p = strstr(p, "优惠券标题：")) != NULL && added < 4) {
        CONST CHAR_T *title_start = p + strlen("优惠券标题：");
        CONST CHAR_T *title_end = title_start;
        CONST CHAR_T *status;
        CHAR_T title[80];

        while (*title_end && *title_end != '\\' && *title_end != '\n' && *title_end != '\r')
            title_end++;
        if (title_end <= title_start || (SIZE_T)(title_end - title_start) >= sizeof(title)) {
            p = title_end;
            continue;
        }
        memcpy(title, title_start, (SIZE_T)(title_end - title_start));
        title[title_end - title_start] = '\0';
        __trim_trailing_spaces(title);

        status = strstr(title_end, "状态：");
        if (!status || !strstr(status, "可领取")) {
            p = title_end;
            continue;
        }
        if (added > 0)
            strncat(out, "、", out_sz - strlen(out) - 1);
        strncat(out, title, out_sz - strlen(out) - 1);
        added++;
        p = title_end;
    }
}

STATIC VOID __summary_meals_from_json(ty_cJSON *root, CONST CHAR_T *user_query,
                                      CHAR_T *out, SIZE_T out_sz)
{
    ty_cJSON *cats;
    INT_T i, n, meal_cnt = 0;
    CHAR_T cat_line[160];
    SIZE_T cat_len = 0;

    if (!out || out_sz == 0)
        return;
    out[0] = '\0';
    cats = __json_meals_categories(root);
    if (!cats)
        return;

    cat_line[0] = '\0';
    n = ty_cJSON_GetArraySize(cats);
    for (i = 0; i < n && cat_len < sizeof(cat_line) - 24; i++) {
        ty_cJSON *cat = ty_cJSON_GetArrayItem(cats, i);
        ty_cJSON *name_j = cat ? ty_cJSON_GetObjectItem(cat, "name") : NULL;
        ty_cJSON *meals = cat ? ty_cJSON_GetObjectItem(cat, "meals") : NULL;
        INT_T m;

        if (meals && ty_cJSON_IsArray(meals))
            meal_cnt += ty_cJSON_GetArraySize(meals);
        if (!name_j || !ty_cJSON_IsString(name_j) || !name_j->valuestring[0])
            continue;
        if (cat_line[0])
            strncat(cat_line, "、", sizeof(cat_line) - cat_len - 1);
        strncat(cat_line, name_j->valuestring, sizeof(cat_line) - strlen(cat_line) - 1);
        cat_len = strlen(cat_line);
        if (i >= 3)
            break;
    }

    if (meal_cnt > 0 && cat_line[0])
        snprintf(out, out_sz, "共%d款商品，包括%s等分类", meal_cnt, cat_line);
    else if (meal_cnt > 0)
        snprintf(out, out_sz, "共查到%d款商品", meal_cnt);
    else
        snprintf(out, out_sz, "菜单数据为空");

    if (user_query && (strstr(user_query, "麦乐鸡") || strstr(user_query, "薯条") ||
                       strstr(user_query, "汉堡") || strstr(user_query, "套餐"))) {
        SIZE_T used = strlen(out);
        if (used + 32 < out_sz)
            strncat(out, "，如需点餐请说具体餐品名称", out_sz - used - 1);
    }
}

STATIC OPERATE_RET __build_speak_summary(ty_cJSON *arr, CONST CHAR_T *asr_text, BOOL_T coupon_only,
                                         BOOL_T is_error, CHAR_T *out, SIZE_T out_sz)
{
    INT_T i, n;
    CHAR_T store_name[96];
    CHAR_T meal_part[FOOD_SPEAK_SUMMARY_MAX / 2];
    CHAR_T coupon_part[FOOD_SPEAK_SUMMARY_MAX / 2];
    BOOL_T have_store = FALSE;
    BOOL_T have_meals = FALSE;
    BOOL_T have_coupon = FALSE;

    if (!out || out_sz == 0)
        return OPRT_INVALID_PARM;
    out[0] = '\0';
    store_name[0] = meal_part[0] = coupon_part[0] = '\0';

    if (is_error && (!arr || !ty_cJSON_IsArray(arr) || ty_cJSON_GetArraySize(arr) == 0)) {
        snprintf(out, out_sz, "麦当劳查询失败，请稍后再试。");
        return OPRT_OK;
    }

    if (!arr || !ty_cJSON_IsArray(arr)) {
        snprintf(out, out_sz, "未获取到麦当劳数据。");
        return OPRT_OK;
    }

    n = ty_cJSON_GetArraySize(arr);
    for (i = 0; i < n; i++) {
        ty_cJSON *item = ty_cJSON_GetArrayItem(arr, i);
        ty_cJSON *text_j = item ? ty_cJSON_GetObjectItem(item, "text") : NULL;
        CONST CHAR_T *text;
        ty_cJSON *parsed;

        if (!text_j || !ty_cJSON_IsString(text_j) || !text_j->valuestring[0])
            continue;
        text = text_j->valuestring;
        if (text[0] == '{' && strstr(text, "\"scene\""))
            continue;

        parsed = __parse_mcp_json_from_text(text);
        if (parsed) {
            if (__json_api_success(parsed)) {
                if (!have_store && __json_first_store_name(parsed, store_name, sizeof(store_name)))
                    have_store = TRUE;
                if (__json_meals_categories(parsed)) {
                    __summary_meals_from_json(parsed, asr_text, meal_part, sizeof(meal_part));
                    have_meals = (meal_part[0] != '\0');
                }
            }
            ty_cJSON_Delete(parsed);
        }
        if (strstr(text, "优惠券标题") || strstr(text, "麦麦省")) {
            __summary_coupons_from_markdown(text, coupon_part, sizeof(coupon_part));
            if (coupon_part[0])
                have_coupon = TRUE;
        }
    }

    if (coupon_only) {
        if (have_coupon)
            snprintf(out, out_sz, "查询到可领优惠券：%s。", coupon_part);
        else
            snprintf(out, out_sz, "暂时没有查到可领取的麦当劳优惠券。");
        return OPRT_OK;
    }

    if (have_store && have_meals) {
        snprintf(out, out_sz, "已在%s查到菜单，%s。", store_name, meal_part);
        if (have_coupon) {
            SIZE_T used = strlen(out);
            snprintf(out + used, out_sz - used, "可领优惠券：%s。", coupon_part);
        }
        return OPRT_OK;
    }
    if (have_store) {
        snprintf(out, out_sz, "已找到门店%s，但菜单暂时无法获取。", store_name);
        return OPRT_OK;
    }
    snprintf(out, out_sz, "没有在%s找到可用麦当劳门店，请确认设备城市配置。", MCD_MCP_DEFAULT_CITY);
    return OPRT_OK;
}

STATIC VOID __food_scene_show_text(CONST CHAR_T *summary)
{
    WUKONG_AI_TEXT_T text;

    if (!summary || !summary[0])
        return;
    text.data = (CHAR_T *)summary;
    text.datalen = strlen(summary);
    text.timeindex = 0;
    wukong_ai_event_notify(WUKONG_AI_EVENT_TEXT_STREAM_START, &text);
    wukong_ai_event_notify(WUKONG_AI_EVENT_TEXT_STREAM_STOP, &text);
}

STATIC OPERATE_RET __food_scene_speak_result(CONST CHAR_T *asr_text, ty_cJSON *out,
                                             BOOL_T is_error, BOOL_T coupon_only)
{
    CHAR_T summary[FOOD_SPEAK_SUMMARY_MAX];
    CHAR_T *prompt = NULL;
    UINT_T plen;
    OPERATE_RET rt;

    if (__build_speak_summary(out, asr_text, coupon_only, is_error, summary, sizeof(summary)) != OPRT_OK)
        return OPRT_OK;
    if (!summary[0])
        return OPRT_OK;

    __food_scene_show_text(summary);

    /* 打断云端泛聊 NLG，改用 MCP 摘要触发 TTS */
    tuya_ai_agent_event(AI_EVENT_CHAT_BREAK, 0);

    plen = FOOD_SPEAK_PREFIX_OVER + (UINT_T)strlen(summary) + 1;
    prompt = (CHAR_T *)tal_malloc(plen);
    if (!prompt)
        return OPRT_MALLOC_FAILED;
    snprintf(prompt, plen, "%s%s", FOOD_SPEAK_PREFIX, summary);
    TAL_PR_NOTICE("Food scene speak -> AI: %.256s", prompt);

    tuya_ai_input_start(TRUE);
    rt = wukong_ai_agent_send_text(prompt);
    tuya_ai_input_stop();
    tal_free(prompt);
    return rt;
}

STATIC OPERATE_RET __content_first_text(CONST ty_cJSON *content_arr, CHAR_T **out_text)
{
    INT_T i, n;
    ty_cJSON *item, *text_j;

    if (!out_text)
        return OPRT_INVALID_PARM;
    *out_text = NULL;
    if (!content_arr || !ty_cJSON_IsArray(content_arr))
        return OPRT_COM_ERROR;

    n = ty_cJSON_GetArraySize(content_arr);
    for (i = 0; i < n; i++) {
        item = ty_cJSON_GetArrayItem(content_arr, i);
        text_j = item ? ty_cJSON_GetObjectItem(item, "text") : NULL;
        if (text_j && ty_cJSON_IsString(text_j) && text_j->valuestring[0]) {
            *out_text = mm_strdup(text_j->valuestring);
            return (*out_text) ? OPRT_OK : OPRT_MALLOC_FAILED;
        }
    }
    return OPRT_NOT_FOUND;
}

STATIC VOID __append_content_array(ty_cJSON *dst, CONST ty_cJSON *src)
{
    INT_T i, n;

    if (!dst || !src || !ty_cJSON_IsArray(src))
        return;
    n = ty_cJSON_GetArraySize(src);
    for (i = 0; i < n; i++) {
        ty_cJSON *item = ty_cJSON_GetArrayItem(src, i);
        if (item)
            ty_cJSON_AddItemToArray(dst, ty_cJSON_Duplicate(item, 1));
    }
}

STATIC OPERATE_RET __call_mcd_tool(CONST CHAR_T *orig_name, ty_cJSON *arguments,
                                   ty_cJSON **out_content, BOOL_T *out_is_error)
{
    CHAR_T ns[MCP_CLIENT_TOOL_NAME_MAX + MCP_CLIENT_ID_MAX + 4];

    if (mcp_client_build_namespaced(MCD_MCP_ID, orig_name, ns, sizeof(ns)) != OPRT_OK)
        return OPRT_INVALID_PARM;
    /* 点餐场景由用户语音触发，QUERY 类工具视为已确认 */
    return mcp_client_router_call(ns, arguments, TRUE, out_content, out_is_error);
}

STATIC OPERATE_RET __query_nearby_store(CONST CHAR_T *keyword, CHAR_T *store_code, SIZE_T store_sz,
                                        ty_cJSON **out_content, BOOL_T *out_is_error)
{
    ty_cJSON *args, *content = NULL;
    CHAR_T *text = NULL;
    ty_cJSON *parsed;
    OPERATE_RET rt;

    if (!__find_mcd_tool("query-nearby-stores"))
        return OPRT_NOT_FOUND;

    args = ty_cJSON_CreateObject();
    if (!args)
        return OPRT_MALLOC_FAILED;
    /* searchType=1 查收藏店（常为空）；searchType=2 按 city+keyword 搜附近门店 */
    ty_cJSON_AddNumberToObject(args, "beType", 1);
    ty_cJSON_AddNumberToObject(args, "searchType", 2);
    ty_cJSON_AddStringToObject(args, "city", MCD_MCP_DEFAULT_CITY);
    ty_cJSON_AddStringToObject(args, "keyword", keyword ? keyword : "麦当劳");

    TAL_PR_INFO("Food scene nearby-stores city=%s keyword=%s", MCD_MCP_DEFAULT_CITY,
                keyword ? keyword : "麦当劳");

    rt = __call_mcd_tool("query-nearby-stores", args, &content, out_is_error);
    ty_cJSON_Delete(args);
    if (rt != OPRT_OK)
        return rt;

    if (out_content && content)
        *out_content = content;
    else if (content)
        ty_cJSON_Delete(content);

    if (out_is_error && *out_is_error)
        return OPRT_OK;

    if (!content || __content_first_text(content, &text) != OPRT_OK)
        return OPRT_OK;

    parsed = __parse_mcp_json_from_text(text);
    if (parsed) {
        if (__json_api_success(parsed)) {
            if (!__json_first_store_code(parsed, store_code, store_sz))
                TAL_PR_WARN("Food scene nearby OK but no storeCode, text=%.256s", text);
        } else {
            ty_cJSON *msg = ty_cJSON_GetObjectItem(parsed, "message");
            TAL_PR_WARN("Food scene nearby-stores API fail: %s",
                        (msg && ty_cJSON_IsString(msg)) ? msg->valuestring : "unknown");
            if (out_is_error)
                *out_is_error = TRUE;
        }
        ty_cJSON_Delete(parsed);
    } else {
        TAL_PR_WARN("Food scene nearby-stores no JSON in response, text=%.256s", text);
        if (out_is_error)
            *out_is_error = TRUE;
    }
    tal_free(text);
    return OPRT_OK;
}

STATIC OPERATE_RET __query_meals(CONST CHAR_T *store_code, ty_cJSON **out_content,
                                 BOOL_T *out_is_error)
{
    ty_cJSON *args;

    if (!store_code || !store_code[0])
        return OPRT_INVALID_PARM;
    if (!__find_mcd_tool("query-meals"))
        return OPRT_NOT_FOUND;

    args = ty_cJSON_CreateObject();
    if (!args)
        return OPRT_MALLOC_FAILED;
    ty_cJSON_AddStringToObject(args, "storeCode", store_code);
    ty_cJSON_AddNumberToObject(args, "orderType", 1);
    ty_cJSON_AddNumberToObject(args, "beType", 1);

    return __call_mcd_tool("query-meals", args, out_content, out_is_error);
}

STATIC OPERATE_RET __query_available_coupons(ty_cJSON **out_content, BOOL_T *out_is_error)
{
    ty_cJSON *args;
    OPERATE_RET rt;

    if (!__find_mcd_tool("available-coupons"))
        return OPRT_NOT_FOUND;
    args = ty_cJSON_CreateObject();
    if (!args)
        return OPRT_MALLOC_FAILED;
    rt = __call_mcd_tool("available-coupons", args, out_content, out_is_error);
    ty_cJSON_Delete(args);
    return rt;
}

STATIC OPERATE_RET __query_my_coupons(ty_cJSON **out_content, BOOL_T *out_is_error)
{
    ty_cJSON *args;
    OPERATE_RET rt;

    if (!__find_mcd_tool("query-my-coupons"))
        return OPRT_NOT_FOUND;
    args = ty_cJSON_CreateObject();
    if (!args)
        return OPRT_MALLOC_FAILED;
    rt = __call_mcd_tool("query-my-coupons", args, out_content, out_is_error);
    ty_cJSON_Delete(args);
    return rt;
}

STATIC OPERATE_RET __query_store_coupons(CONST CHAR_T *store_code, ty_cJSON **out_content,
                                         BOOL_T *out_is_error)
{
    ty_cJSON *args;

    if (!store_code || !store_code[0])
        return OPRT_INVALID_PARM;
    if (!__find_mcd_tool("query-store-coupons"))
        return OPRT_NOT_FOUND;

    args = ty_cJSON_CreateObject();
    if (!args)
        return OPRT_MALLOC_FAILED;
    ty_cJSON_AddStringToObject(args, "storeCode", store_code);
    ty_cJSON_AddNumberToObject(args, "orderType", 1);
    ty_cJSON_AddNumberToObject(args, "beType", 1);
    return __call_mcd_tool("query-store-coupons", args, out_content, out_is_error);
}

STATIC OPERATE_RET __coupon_scene_run(ty_cJSON **out_recommendations, BOOL_T *out_is_error)
{
    ty_cJSON *avail = NULL;
    ty_cJSON *mine = NULL;
    BOOL_T avail_err = FALSE;
    BOOL_T mine_err = FALSE;
    OPERATE_RET rt;

    if (!out_recommendations || !out_is_error)
        return OPRT_INVALID_PARM;

    *out_recommendations = ty_cJSON_CreateArray();
    if (!*out_recommendations)
        return OPRT_MALLOC_FAILED;
    *out_is_error = FALSE;

    rt = __ensure_mcd_tools();
    if (rt != OPRT_OK) {
        ty_cJSON_AddItemToArray(*out_recommendations,
            mcp_content_make_text("MCD MCP not configured; call device_mcp_load_mcd_example first"));
        *out_is_error = TRUE;
        return OPRT_OK;
    }

    (VOID)__query_available_coupons(&avail, &avail_err);
    if (avail) {
        __append_content_array(*out_recommendations, avail);
        ty_cJSON_Delete(avail);
    }
    (VOID)__query_my_coupons(&mine, &mine_err);
    if (mine) {
        __append_content_array(*out_recommendations, mine);
        ty_cJSON_Delete(mine);
    }

    *out_is_error = (avail_err || mine_err);
    TAL_PR_INFO("Coupon scene done avail_err=%d mine_err=%d items=%d",
                avail_err, mine_err, ty_cJSON_GetArraySize(*out_recommendations));
    return OPRT_OK;
}

STATIC OPERATE_RET __food_scene_run(CONST CHAR_T *user_query, ty_cJSON **out_recommendations,
                                    BOOL_T *out_is_error)
{
    CHAR_T store_code[64];
    CONST CHAR_T *keyword;
    ty_cJSON *nearby_content = NULL;
    ty_cJSON *meals_content = NULL;
    ty_cJSON *coupon_content = NULL;
    ty_cJSON *meta;
    CHAR_T *meta_text;
    BOOL_T nearby_err = FALSE;
    BOOL_T meals_err = FALSE;
    BOOL_T coupon_err = FALSE;
    BOOL_T want_coupon;
    OPERATE_RET rt;

    if (!out_recommendations || !out_is_error)
        return OPRT_INVALID_PARM;

    *out_recommendations = ty_cJSON_CreateArray();
    if (!*out_recommendations)
        return OPRT_MALLOC_FAILED;
    *out_is_error = FALSE;

    rt = __ensure_mcd_tools();
    if (rt != OPRT_OK) {
        ty_cJSON_AddItemToArray(*out_recommendations,
            mcp_content_make_text("MCD MCP not configured; call device_mcp_load_mcd_example first"));
        *out_is_error = TRUE;
        return OPRT_OK;
    }

    if (__count_mcd_tools() == 0) {
        ty_cJSON_AddItemToArray(*out_recommendations,
            mcp_content_make_text("MCD tools/list empty; check token or MCP_CLIENT_HTTP_RESP_MAX"));
        *out_is_error = TRUE;
        return OPRT_OK;
    }

    keyword = __food_search_keyword(user_query);
    want_coupon = user_query && __asr_is_coupon_intent(user_query);
    memset(store_code, 0, sizeof(store_code));

    meta = ty_cJSON_CreateObject();
    if (meta) {
        ty_cJSON_AddStringToObject(meta, "scene", want_coupon ? "food_and_coupon" : "food_recommend");
        ty_cJSON_AddStringToObject(meta, "keyword", keyword);
        ty_cJSON_AddStringToObject(meta, "city", MCD_MCP_DEFAULT_CITY);
    }

    (VOID)__query_nearby_store(keyword, store_code, sizeof(store_code),
                               &nearby_content, &nearby_err);
    if (nearby_content) {
        __append_content_array(*out_recommendations, nearby_content);
        ty_cJSON_Delete(nearby_content);
    }

    if (store_code[0]) {
        TAL_PR_INFO("Food scene storeCode=%s, querying meals", store_code);
        (VOID)__query_meals(store_code, &meals_content, &meals_err);
        if (meals_content) {
            __append_content_array(*out_recommendations, meals_content);
            ty_cJSON_Delete(meals_content);
        }
        if (want_coupon) {
            (VOID)__query_store_coupons(store_code, &coupon_content, &coupon_err);
            if (coupon_content) {
                __append_content_array(*out_recommendations, coupon_content);
                ty_cJSON_Delete(coupon_content);
            }
        }
    } else {
        TAL_PR_WARN("Food scene no storeCode from nearby-stores, skip query-meals");
        if (meta)
            ty_cJSON_AddStringToObject(meta, "warning", "no storeCode from query-nearby-stores");
    }

    if (meta) {
        if (store_code[0])
            ty_cJSON_AddStringToObject(meta, "storeCode", store_code);
        meta_text = ty_cJSON_PrintUnformatted(meta);
        ty_cJSON_Delete(meta);
        if (meta_text) {
            ty_cJSON_AddItemToArray(*out_recommendations, mcp_content_make_text(meta_text));
            ty_cJSON_FreeBuffer(meta_text);
        }
    }

    *out_is_error = (nearby_err || meals_err || coupon_err);
    TAL_PR_INFO("Food scene done nearby_err=%d meals_err=%d coupon_err=%d items=%d",
                nearby_err, meals_err, coupon_err, ty_cJSON_GetArraySize(*out_recommendations));
    return OPRT_OK;
}

STATIC VOID __log_scene_result(CONST CHAR_T *tag, ty_cJSON *out, BOOL_T is_error)
{
    CHAR_T *summary;

    if (!out)
        return;
    summary = ty_cJSON_PrintUnformatted(out);
    if (summary) {
        TAL_PR_NOTICE("%s result err=%d: %.512s", tag, is_error, summary);
        ty_cJSON_FreeBuffer(summary);
    }
}

STATIC VOID __food_asr_worker(VOID_T *data)
{
    FOOD_ASR_MSG_T *msg = (FOOD_ASR_MSG_T *)data;
    ty_cJSON *out = NULL;
    BOOL_T is_error = FALSE;

    if (!msg)
        return;

    if (msg->coupon_only) {
        TAL_PR_NOTICE("Coupon scene ASR route: %s", msg->asr_text);
        if (__coupon_scene_run(&out, &is_error) == OPRT_OK) {
            __log_scene_result("Coupon scene ASR", out, is_error);
            (VOID)__food_scene_speak_result(msg->asr_text, out, is_error, TRUE);
        }
    } else {
        TAL_PR_NOTICE("Food scene ASR route: %s", msg->asr_text);
        if (__food_scene_run(msg->asr_text, &out, &is_error) == OPRT_OK) {
            __log_scene_result("Food scene ASR", out, is_error);
            (VOID)__food_scene_speak_result(msg->asr_text, out, is_error, FALSE);
        }
    }
    if (out)
        ty_cJSON_Delete(out);
    tal_free(msg);
}

OPERATE_RET mcp_client_food_scene_recommend(CONST CHAR_T *user_query,
                                            ty_cJSON **out_recommendations,
                                            BOOL_T *out_is_error)
{
    return __food_scene_run(user_query, out_recommendations, out_is_error);
}

BOOL_T mcp_client_food_scene_try_asr(CONST CHAR_T *asr_text)
{
    FOOD_ASR_MSG_T *msg;
    OPERATE_RET rt;
    BOOL_T food = __asr_is_food_intent(asr_text);
    BOOL_T coupon = __asr_is_coupon_intent(asr_text);

    if (!asr_text || !asr_text[0] || (!food && !coupon))
        return FALSE;

    msg = (FOOD_ASR_MSG_T *)tal_malloc(sizeof(*msg));
    if (!msg)
        return FALSE;
    snprintf(msg->asr_text, sizeof(msg->asr_text), "%s", asr_text);
    msg->coupon_only = (coupon && !food);

    rt = tal_workq_schedule(WORKQ_SYSTEM, __food_asr_worker, msg);
    if (rt != OPRT_OK) {
        tal_free(msg);
        return FALSE;
    }
    return TRUE;
}
