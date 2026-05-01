#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

cat > "$TMP_DIR/tuya_cloud_types.h" <<'EOF'
#ifndef __TUYA_CLOUD_TYPES_H__
#define __TUYA_CLOUD_TYPES_H__

#include <stdint.h>
#include <stddef.h>

typedef int OPERATE_RET;
typedef int INT_T;
typedef unsigned int UINT_T;
typedef int BOOL_T;
typedef char CHAR_T;
typedef void VOID;
typedef long long TIME_T;

#define CONST const
#define STATIC static
#define VOID_T void

#ifndef TRUE
#define TRUE 1
#endif
#ifndef FALSE
#define FALSE 0
#endif

#define OPRT_OK 0
#define OPRT_INVALID_PARM (-1)
#define OPRT_MALLOC_FAILED (-3)
#define OPRT_COM_ERROR (-4)
#define OPRT_NOT_FOUND (-6)

#define TUYA_CHECK_NULL_RETURN(x, ret) \
    do { \
        if ((x) == NULL) { \
            return (ret); \
        } \
    } while (0)

#endif
EOF

cat > "$TMP_DIR/tal_log.h" <<'EOF'
#ifndef __TAL_LOG_H__
#define __TAL_LOG_H__

#define TAL_PR_DEBUG(...) do { } while (0)
#define TAL_PR_ERR(...) do { } while (0)

#endif
EOF

cat > "$TMP_DIR/tal_memory.h" <<'EOF'
#ifndef __TAL_MEMORY_H__
#define __TAL_MEMORY_H__

#include <stdlib.h>

#define tal_malloc malloc
#define tal_free free

#endif
EOF

cat > "$TMP_DIR/tal_time_service.h" <<'EOF'
#ifndef __TAL_TIME_SERVICE_H__
#define __TAL_TIME_SERVICE_H__

#include <time.h>
#include "tuya_cloud_types.h"

typedef struct tm POSIX_TM_S;

TIME_T tal_time_get_posix(VOID);

static inline TIME_T tal_time_mktime(POSIX_TM_S *tm_info)
{
    if (tm_info == NULL) {
        return 0;
    }
    return (TIME_T)timegm(tm_info);
}

static inline OPERATE_RET tal_time_get_local_time_custom(TIME_T ts, POSIX_TM_S *tm_info)
{
    time_t raw = (time_t)(ts + (8 * 3600));
    return (gmtime_r(&raw, tm_info) == NULL) ? OPRT_INVALID_PARM : OPRT_OK;
}

#endif
EOF

cat > "$TMP_DIR/ty_cJSON.h" <<'EOF'
#ifndef __TY_CJSON_H__
#define __TY_CJSON_H__

#include "tuya_cloud_types.h"

typedef struct ty_cJSON {
    int type;
    CHAR_T *string;
    CHAR_T *valuestring;
    INT_T valueint;
    struct ty_cJSON *child;
    struct ty_cJSON *next;
} ty_cJSON;

#define TY_CJSON_OBJECT 1
#define TY_CJSON_STRING 2
#define TY_CJSON_NUMBER 3
#define TY_CJSON_ARRAY  4

ty_cJSON *ty_cJSON_CreateObject(void);
ty_cJSON *ty_cJSON_CreateArray(void);
ty_cJSON *ty_cJSON_CreateString(const CHAR_T *value);
void ty_cJSON_AddItemToArray(ty_cJSON *array, ty_cJSON *item);
void ty_cJSON_AddStringToObject(ty_cJSON *object, const CHAR_T *key, const CHAR_T *value);
void ty_cJSON_AddNumberToObject(ty_cJSON *object, const CHAR_T *key, INT_T value);
ty_cJSON *ty_cJSON_GetObjectItem(CONST ty_cJSON *object, const CHAR_T *key);
BOOL_T ty_cJSON_IsNumber(CONST ty_cJSON *item);
BOOL_T ty_cJSON_IsString(CONST ty_cJSON *item);
void ty_cJSON_FreeBuffer(CHAR_T *buffer);
void ty_cJSON_Delete(ty_cJSON *item);

#endif
EOF

cat > "$TMP_DIR/wukong_alarm.h" <<'EOF'
#ifndef __WUKONG_ALARM_H__
#define __WUKONG_ALARM_H__

#include "tuya_cloud_types.h"
#include "ty_cJSON.h"

#define WUKONG_ALARM_ID_LEN 32
#define WUKONG_ALARM_CRON_JOB_ID_LEN 32

typedef enum {
    WUKONG_ALARM_REPEAT_ONCE = 0,
    WUKONG_ALARM_REPEAT_DAILY = 1,
    WUKONG_ALARM_REPEAT_WEEKLY = 2,
    WUKONG_ALARM_REPEAT_MONTHLY = 3,
} WUKONG_ALARM_REPEAT_TYPE_E;

typedef struct {
    BOOL_T enabled;
    WUKONG_ALARM_REPEAT_TYPE_E repeat_type;
    UINT_T hour;
    UINT_T minute;
    UINT_T weekday_mask;
    UINT_T month_day;
    CHAR_T cron_job_id[WUKONG_ALARM_CRON_JOB_ID_LEN + 1];
} WUKONG_ALARM_CFG_T;

OPERATE_RET wukong_alarm_add(CONST WUKONG_ALARM_CFG_T *alarm_cfg, CHAR_T *alarm_id, UINT_T alarm_id_len);
OPERATE_RET wukong_alarm_update(CONST CHAR_T *alarm_id, CONST WUKONG_ALARM_CFG_T *alarm_cfg);
OPERATE_RET wukong_alarm_remove(CONST CHAR_T *alarm_id);
OPERATE_RET wukong_alarm_list(CHAR_T **alarm_list_json);
OPERATE_RET wukong_alarm_find_by_time(CONST WUKONG_ALARM_CFG_T *alarm_cfg, CHAR_T *alarm_id, UINT_T alarm_id_len);

#endif
EOF

cat > "$TMP_DIR/skill_clock.h" <<'EOF'
#ifndef __WUKONG_CLOCK_H__
#define __WUKONG_CLOCK_H__

#include "tuya_cloud_types.h"

typedef enum {
    AI_CLOCK_TIMER_OPR_START = 0,
    AI_CLOCK_TIMER_OPR_PAUSE = 1,
    AI_CLOCK_TIMER_OPR_RESUME = 2,
    AI_CLOCK_TIMER_OPR_STOP = 3,
    AI_CLOCK_TIMER_OPR_RESET = 4,
} TY_AI_CLOCK_TIMER_OPR_TYPE_E;

typedef enum {
    AI_CLOCK_SCHED_OPR_ADD = 0,
    AI_CLOCK_SCHED_OPR_DELETE = 1,
    AI_CLOCK_SCHED_OPR_UPDATE = 2,
} TY_AI_CLOCK_SCHED_OPR_TYPE_E;

typedef enum {
    AI_CLOCK_SCHED_QUERY_BY_TIME = 0,
    AI_CLOCK_SCHED_QUERY_BY_CATEGORY = 1,
    AI_CLOCK_SCHED_QUERY_BY_KEYWORD = 2,
} TY_AI_CLOCK_SCHED_QUERY_METHOD_E;

typedef struct {
    INT_T work_duration;
    INT_T short_break_duration;
    INT_T long_break_duration;
} TY_AI_CLOCK_POMODORO_TIMER_CFG_T;

typedef struct {
    TIME_T start_time;
    TIME_T end_time;
    CHAR_T *location;
    CHAR_T *description;
    INT_T categories;
} TY_AI_CLOCK_SCHED_CFG_T;

typedef struct {
    INT_T categories;
    TIME_T start_time;
    TIME_T end_time;
    CHAR_T *keyword;
} TY_AI_CLOCK_SCHED_QUERY_CFG_T;

TIME_T wukong_clock_time_mktime(CHAR_T *iso_8601_time_str);
OPERATE_RET wukong_clock_set_countdown_timer(TY_AI_CLOCK_TIMER_OPR_TYPE_E opr, INT_T hours, INT_T minutes, INT_T seconds);
OPERATE_RET wukong_clock_set_stopwatch_timer(TY_AI_CLOCK_TIMER_OPR_TYPE_E opr);
OPERATE_RET wukong_clock_set_pomodoro_timer(TY_AI_CLOCK_TIMER_OPR_TYPE_E opr, TY_AI_CLOCK_POMODORO_TIMER_CFG_T *pomodoro);
OPERATE_RET wukong_clock_set_schedule(TY_AI_CLOCK_SCHED_OPR_TYPE_E opr, TY_AI_CLOCK_SCHED_CFG_T *sched);
CHAR_T *wukong_clock_set_schedule_query(TY_AI_CLOCK_SCHED_QUERY_METHOD_E query_method, TY_AI_CLOCK_SCHED_QUERY_CFG_T *sched_query);

#endif
EOF

cat > "$TMP_DIR/wukong_ai_mcp.h" <<'EOF'
#ifndef __WUKONG_AI_MCP_H__
#define __WUKONG_AI_MCP_H__

#include "tuya_cloud_types.h"
#include "ty_cJSON.h"

typedef OPERATE_RET (*MCP_TOOL_HANDLER_CB)(
    CONST CHAR_T *name,
    CONST ty_cJSON *arguments,
    ty_cJSON **out_content,
    BOOL_T *out_is_error,
    VOID *user_data
);

typedef struct {
    CONST CHAR_T *name;
    CONST CHAR_T *type;
    CONST CHAR_T *description;
    BOOL_T required;
    BOOL_T has_minimum;
    INT_T minimum;
    BOOL_T has_maximum;
    INT_T maximum;
} MCP_SCHEMA_PROP_T;

OPERATE_RET mcp_server_tool_register(CONST CHAR_T *name,
                                     CONST CHAR_T *description,
                                     MCP_TOOL_HANDLER_CB handler,
                                     VOID *user_data, ...);

#define MCP_SCHEMA_INT_RANGE(n, d, lo, hi) \
    &(MCP_SCHEMA_PROP_T){ .name = (n), .type = "integer", .description = (d), \
        .required = TRUE, .has_minimum = TRUE, .minimum = (lo), \
        .has_maximum = TRUE, .maximum = (hi) }
#define MCP_SCHEMA_INT_OPT_RANGE(n, d, lo, hi) \
    &(MCP_SCHEMA_PROP_T){ .name = (n), .type = "integer", .description = (d), \
        .required = FALSE, .has_minimum = TRUE, .minimum = (lo), \
        .has_maximum = TRUE, .maximum = (hi) }
#define MCP_SCHEMA_STR(n, d) \
    &(MCP_SCHEMA_PROP_T){ .name = (n), .type = "string", .description = (d), \
        .required = TRUE }
#define MCP_SCHEMA_STR_OPT(n, d) \
    &(MCP_SCHEMA_PROP_T){ .name = (n), .type = "string", .description = (d), \
        .required = FALSE }
#define MCP_SCHEMA_END NULL
#define MCP_TOOL_ADD(name, desc, handler, ud, ...) \
    mcp_server_tool_register(name, desc, handler, ud, ##__VA_ARGS__, MCP_SCHEMA_END)

ty_cJSON *mcp_content_make_text(CONST CHAR_T *text);

#endif
EOF

cat > "$TMP_DIR/wukong_tm.h" <<'EOF'
#ifndef __WUKONG_TIME_MANAGE_H__
#define __WUKONG_TIME_MANAGE_H__

#include "tuya_cloud_types.h"

#define WUKONG_TM_ALARM_ID_LEN 32
#define WUKONG_TM_REMINDER_ID_LEN 32
#define WUKONG_TM_ALARM_MESSAGE_LEN 128
#define WUKONG_TM_REMINDER_MESSAGE_LEN 128

typedef enum {
    WUKONG_TM_ALARM_REPEAT_ONCE = 0,
    WUKONG_TM_ALARM_REPEAT_DAILY = 1,
    WUKONG_TM_ALARM_REPEAT_WEEKLY = 2,
    WUKONG_TM_ALARM_REPEAT_MONTHLY = 3,
} WUKONG_TM_ALARM_REPEAT_TYPE_E;

typedef struct {
    BOOL_T enabled;
    WUKONG_TM_ALARM_REPEAT_TYPE_E repeat_type;
    UINT_T hour;
    UINT_T minute;
    UINT_T weekday_mask;
    UINT_T month_day;
    TIME_T start_time;
    CHAR_T message[WUKONG_TM_ALARM_MESSAGE_LEN + 1];
    CHAR_T cron_job_id[33];
} WUKONG_TM_ALARM_CFG_T;

typedef struct {
    BOOL_T enabled;
    TIME_T start_time;
    CHAR_T message[WUKONG_TM_REMINDER_MESSAGE_LEN + 1];
    CHAR_T cron_job_id[33];
} WUKONG_TM_REMINDER_CFG_T;

#define WUKONG_TM_POMODORO_WORK_BEFORE_LONG_MIN 1
#define WUKONG_TM_POMODORO_WORK_BEFORE_LONG_MAX 12

typedef struct {
    INT_T work_duration;
    INT_T short_break_duration;
    INT_T long_break_duration;
    INT_T work_sessions_before_long_break;
} WUKONG_TM_POMODORO_CFG_T;

typedef enum {
    WUKONG_TM_COUNTDOWN_STATE_IDLE = 0,
    WUKONG_TM_COUNTDOWN_STATE_RUNNING,
    WUKONG_TM_COUNTDOWN_STATE_PAUSED,
} WUKONG_TM_COUNTDOWN_STATE_E;

typedef struct {
    BOOL_T active;
    WUKONG_TM_COUNTDOWN_STATE_E state;
    TIME_T remaining_sec;
    TIME_T duration_sec;
    TIME_T elapsed_sec;
} WUKONG_TM_COUNTDOWN_SNAPSHOT_T;

typedef struct {
    BOOL_T active;
    BOOL_T paused;
    TIME_T elapsed_sec;
} WUKONG_TM_STOPWATCH_STATE_T;

typedef enum {
    WUKONG_TM_POMODORO_PHASE_WORK = 0,
    WUKONG_TM_POMODORO_PHASE_SHORT_BREAK,
    WUKONG_TM_POMODORO_PHASE_LONG_BREAK,
} WUKONG_TM_POMODORO_PHASE_E;

typedef struct {
    BOOL_T active;
    BOOL_T paused;
    UINT_T session_id;
    WUKONG_TM_POMODORO_PHASE_E phase;
    UINT_T current_cycle;
    UINT_T completed_work_count;
    TIME_T phase_start_ts;
    TIME_T phase_end_ts;
    TIME_T remaining_sec;
    WUKONG_TM_POMODORO_CFG_T cfg;
} WUKONG_TM_POMODORO_STATE_T;

OPERATE_RET wukong_tm_alarm_add(CONST WUKONG_TM_ALARM_CFG_T *alarm_cfg, CONST CHAR_T *alarm_id);
OPERATE_RET wukong_tm_alarm_update(CONST CHAR_T *alarm_id, CONST WUKONG_TM_ALARM_CFG_T *alarm_cfg);
OPERATE_RET wukong_tm_alarm_get(CONST CHAR_T *alarm_id, WUKONG_TM_ALARM_CFG_T *alarm_cfg);
OPERATE_RET wukong_tm_alarm_remove(CONST CHAR_T *alarm_id);
OPERATE_RET wukong_tm_alarm_remove_by_time(CONST WUKONG_TM_ALARM_CFG_T *alarm_cfg, UINT_T *removed_count);
OPERATE_RET wukong_tm_alarm_list(CHAR_T **alarm_list_json);
OPERATE_RET wukong_tm_alarm_find_by_time(CONST WUKONG_TM_ALARM_CFG_T *alarm_cfg, CHAR_T *alarm_id, UINT_T alarm_id_len);
OPERATE_RET wukong_tm_alarm_ack(CONST CHAR_T *alarm_id);
OPERATE_RET wukong_tm_alarm_ack_active(VOID);
OPERATE_RET wukong_tm_reminder_add(CONST WUKONG_TM_REMINDER_CFG_T *reminder_cfg,
                                   CONST CHAR_T *reminder_id);
OPERATE_RET wukong_tm_reminder_update(CONST CHAR_T *reminder_id, CONST WUKONG_TM_REMINDER_CFG_T *reminder_cfg);
OPERATE_RET wukong_tm_reminder_get(CONST CHAR_T *reminder_id, WUKONG_TM_REMINDER_CFG_T *reminder_cfg);
OPERATE_RET wukong_tm_reminder_remove(CONST CHAR_T *reminder_id);
OPERATE_RET wukong_tm_reminder_remove_by_time(TIME_T start_time, UINT_T *removed_count);
OPERATE_RET wukong_tm_reminder_find_by_time(TIME_T start_time, CHAR_T *reminder_id, UINT_T reminder_id_len);
CHAR_T *wukong_tm_reminder_query_text(TIME_T start_time, TIME_T end_time, CONST CHAR_T *keyword);
OPERATE_RET wukong_tm_countdown_create(INT_T hours, INT_T minutes, INT_T seconds);
OPERATE_RET wukong_tm_countdown_pause(VOID);
OPERATE_RET wukong_tm_countdown_resume(VOID);
OPERATE_RET wukong_tm_countdown_delete(VOID);
OPERATE_RET wukong_tm_countdown_query(WUKONG_TM_COUNTDOWN_SNAPSHOT_T *snapshot);
OPERATE_RET wukong_tm_stopwatch_start(VOID);
OPERATE_RET wukong_tm_stopwatch_pause(VOID);
OPERATE_RET wukong_tm_stopwatch_resume(VOID);
OPERATE_RET wukong_tm_stopwatch_stop(VOID);
OPERATE_RET wukong_tm_stopwatch_reset(VOID);
OPERATE_RET wukong_tm_stopwatch_query(WUKONG_TM_STOPWATCH_STATE_T *state);
OPERATE_RET wukong_tm_pomodoro_start(CONST WUKONG_TM_POMODORO_CFG_T *pomodoro_cfg);
OPERATE_RET wukong_tm_pomodoro_pause(VOID);
OPERATE_RET wukong_tm_pomodoro_resume(VOID);
OPERATE_RET wukong_tm_pomodoro_stop(VOID);
OPERATE_RET wukong_tm_pomodoro_query(WUKONG_TM_POMODORO_STATE_T *state);

#endif
EOF

cat > "$TMP_DIR/stubs.c" <<'EOF'
#include "wukong_ai_mcp.h"
#include "wukong_alarm.h"
#include "skill_clock.h"
#include "wukong_tm.h"

#include <stdarg.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    const char *name;
    const char *description;
    MCP_TOOL_HANDLER_CB handler;
    char prop_names[32][64];
    char prop_descriptions[32][256];
    BOOL_T prop_required[32];
    int prop_count;
} REGISTERED_TOOL_T;

static REGISTERED_TOOL_T g_registered_tools[16];
static int g_registered_tool_count = 0;
static BOOL_T g_countdown_active = FALSE;
static BOOL_T g_countdown_paused = FALSE;
static TIME_T g_countdown_remaining_sec = 0;
static TIME_T g_countdown_duration_sec = 0;
static BOOL_T g_stopwatch_active = FALSE;
static BOOL_T g_stopwatch_paused = FALSE;
static TIME_T g_stopwatch_seg_start = 0;
static TIME_T g_stopwatch_accum = 0;
static BOOL_T g_pomodoro_active = FALSE;
static TIME_T g_fake_now = 0;
static BOOL_T g_reminder_add_called = FALSE;
static BOOL_T g_reminder_update_called = FALSE;
static CHAR_T g_stub_reminder_id[WUKONG_TM_REMINDER_ID_LEN + 1] = {0};
static WUKONG_TM_REMINDER_CFG_T g_stub_reminder_cfg = {0};
static WUKONG_TM_REMINDER_CFG_T g_last_reminder_add_cfg = {0};
static CHAR_T g_last_reminder_update_id[WUKONG_TM_REMINDER_ID_LEN + 1] = {0};
static WUKONG_TM_REMINDER_CFG_T g_last_reminder_update_cfg = {0};

typedef struct ty_cJSON ty_cJSON;

static ty_cJSON *new_item(int type)
{
    ty_cJSON *item = calloc(1, sizeof(*item));
    if (item != NULL) {
        item->type = type;
    }
    return item;
}

ty_cJSON *ty_cJSON_CreateObject(void) { return new_item(TY_CJSON_OBJECT); }
ty_cJSON *ty_cJSON_CreateArray(void) { return new_item(TY_CJSON_ARRAY); }
ty_cJSON *ty_cJSON_CreateString(const CHAR_T *value)
{
    ty_cJSON *item = new_item(TY_CJSON_STRING);
    if (item != NULL && value != NULL) {
        item->valuestring = strdup(value);
    }
    return item;
}

void ty_cJSON_AddItemToArray(ty_cJSON *array, ty_cJSON *item)
{
    ty_cJSON *cursor = NULL;
    if (array == NULL || item == NULL) {
        return;
    }
    if (array->child == NULL) {
        array->child = item;
        return;
    }
    cursor = array->child;
    while (cursor->next != NULL) {
        cursor = cursor->next;
    }
    cursor->next = item;
}

void ty_cJSON_AddStringToObject(ty_cJSON *object, const CHAR_T *key, const CHAR_T *value)
{
    ty_cJSON *item = NULL;

    if (object == NULL || key == NULL) {
        return;
    }
    item = ty_cJSON_CreateString(value);
    if (item == NULL) {
        return;
    }
    item->string = strdup(key);
    item->next = object->child;
    object->child = item;
}

void ty_cJSON_AddNumberToObject(ty_cJSON *object, const CHAR_T *key, INT_T value)
{
    ty_cJSON *item = NULL;

    if (object == NULL || key == NULL) {
        return;
    }
    item = new_item(TY_CJSON_NUMBER);
    if (item == NULL) {
        return;
    }
    item->string = strdup(key);
    item->valueint = value;
    item->next = object->child;
    object->child = item;
}

ty_cJSON *ty_cJSON_GetObjectItem(CONST ty_cJSON *object, const CHAR_T *key)
{
    ty_cJSON *item = NULL;

    if (object == NULL || key == NULL) {
        return NULL;
    }
    item = object->child;
    while (item != NULL) {
        if (item->string != NULL && strcmp(item->string, key) == 0) {
            return item;
        }
        item = item->next;
    }
    return NULL;
}

BOOL_T ty_cJSON_IsNumber(CONST ty_cJSON *item)
{
    return (item != NULL && item->type == TY_CJSON_NUMBER) ? TRUE : FALSE;
}

BOOL_T ty_cJSON_IsString(CONST ty_cJSON *item)
{
    return (item != NULL && item->type == TY_CJSON_STRING) ? TRUE : FALSE;
}

void ty_cJSON_Delete(ty_cJSON *item)
{
    ty_cJSON *next = NULL;
    ty_cJSON *child = NULL;
    if (item == NULL) {
        return;
    }
    child = item->child;
    while (child != NULL) {
        next = child->next;
        ty_cJSON_Delete(child);
        child = next;
    }
    free(item->string);
    free(item->valuestring);
    free(item);
}

void ty_cJSON_FreeBuffer(CHAR_T *buffer)
{
    free(buffer);
}

OPERATE_RET mcp_server_tool_register(CONST CHAR_T *name,
                                     CONST CHAR_T *description,
                                     MCP_TOOL_HANDLER_CB handler,
                                     VOID *user_data, ...)
{
    (void)user_data;
    va_list ap;
    const MCP_SCHEMA_PROP_T *prop = NULL;

    if (g_registered_tool_count < (int)(sizeof(g_registered_tools) / sizeof(g_registered_tools[0]))) {
        g_registered_tools[g_registered_tool_count].name = name;
        g_registered_tools[g_registered_tool_count].description = description;
        g_registered_tools[g_registered_tool_count].handler = handler;
        g_registered_tools[g_registered_tool_count].prop_count = 0;

        va_start(ap, user_data);
        while ((prop = va_arg(ap, const MCP_SCHEMA_PROP_T *)) != NULL) {
            if (g_registered_tools[g_registered_tool_count].prop_count <
                (int)(sizeof(g_registered_tools[g_registered_tool_count].prop_names) /
                      sizeof(g_registered_tools[g_registered_tool_count].prop_names[0]))) {
                int idx = g_registered_tools[g_registered_tool_count].prop_count++;
                if (prop->name != NULL) {
                    strncpy(g_registered_tools[g_registered_tool_count].prop_names[idx],
                            prop->name,
                            sizeof(g_registered_tools[g_registered_tool_count].prop_names[idx]) - 1);
                }
                if (prop->description != NULL) {
                    strncpy(g_registered_tools[g_registered_tool_count].prop_descriptions[idx],
                            prop->description,
                            sizeof(g_registered_tools[g_registered_tool_count].prop_descriptions[idx]) - 1);
                }
                g_registered_tools[g_registered_tool_count].prop_required[idx] = prop->required;
            }
        }
        va_end(ap);

        g_registered_tool_count++;
    }
    return OPRT_OK;
}

ty_cJSON *mcp_content_make_text(CONST CHAR_T *text)
{
    return ty_cJSON_CreateString(text);
}

OPERATE_RET wukong_alarm_update(CONST CHAR_T *alarm_id, CONST WUKONG_ALARM_CFG_T *alarm_cfg)
{
    (void)alarm_id;
    (void)alarm_cfg;
    return OPRT_OK;
}

OPERATE_RET wukong_alarm_remove(CONST CHAR_T *alarm_id)
{
    (void)alarm_id;
    return OPRT_OK;
}

OPERATE_RET wukong_alarm_list(CHAR_T **alarm_list_json)
{
    if (alarm_list_json != NULL) {
        *alarm_list_json = strdup("{\"alarms\":[]}");
    }
    return OPRT_OK;
}

OPERATE_RET wukong_alarm_find_by_time(CONST WUKONG_ALARM_CFG_T *alarm_cfg, CHAR_T *alarm_id, UINT_T alarm_id_len)
{
    (void)alarm_cfg;
    if (alarm_id != NULL && alarm_id_len > 0) {
        alarm_id[0] = '\0';
    }
    return OPRT_OK;
}

OPERATE_RET wukong_tm_alarm_add(CONST WUKONG_TM_ALARM_CFG_T *alarm_cfg, CONST CHAR_T *alarm_id)
{
    (void)alarm_cfg;
    (void)alarm_id;
    return OPRT_OK;
}

OPERATE_RET wukong_tm_alarm_ack(CONST CHAR_T *alarm_id)
{
    (void)alarm_id;
    return OPRT_OK;
}

OPERATE_RET wukong_tm_alarm_update(CONST CHAR_T *alarm_id, CONST WUKONG_TM_ALARM_CFG_T *alarm_cfg)
{
    return wukong_alarm_update(alarm_id, (CONST WUKONG_ALARM_CFG_T *)alarm_cfg);
}

OPERATE_RET wukong_tm_alarm_get(CONST CHAR_T *alarm_id, WUKONG_TM_ALARM_CFG_T *alarm_cfg)
{
    (void)alarm_id;
    (void)alarm_cfg;
    return OPRT_NOT_FOUND;
}

OPERATE_RET wukong_tm_alarm_remove(CONST CHAR_T *alarm_id)
{
    return wukong_alarm_remove(alarm_id);
}

OPERATE_RET wukong_tm_alarm_remove_by_time(CONST WUKONG_TM_ALARM_CFG_T *alarm_cfg, UINT_T *removed_count)
{
    (void)alarm_cfg;
    if (removed_count != NULL) {
        *removed_count = 1;
    }
    return OPRT_OK;
}

OPERATE_RET wukong_tm_alarm_list(CHAR_T **alarm_list_json)
{
    return wukong_alarm_list(alarm_list_json);
}

OPERATE_RET wukong_tm_alarm_find_by_time(CONST WUKONG_TM_ALARM_CFG_T *alarm_cfg, CHAR_T *alarm_id, UINT_T alarm_id_len)
{
    return wukong_alarm_find_by_time((CONST WUKONG_ALARM_CFG_T *)alarm_cfg, alarm_id, alarm_id_len);
}

OPERATE_RET wukong_tm_alarm_ack_active(VOID)
{
    return OPRT_OK;
}

TIME_T wukong_clock_time_mktime(CHAR_T *iso_8601_time_str)
{
    (void)iso_8601_time_str;
    return 0;
}

OPERATE_RET wukong_clock_set_countdown_timer(TY_AI_CLOCK_TIMER_OPR_TYPE_E opr, INT_T hours, INT_T minutes, INT_T seconds)
{
    (void)opr;
    (void)hours;
    (void)minutes;
    (void)seconds;
    return OPRT_OK;
}

OPERATE_RET wukong_clock_set_stopwatch_timer(TY_AI_CLOCK_TIMER_OPR_TYPE_E opr)
{
    (void)opr;
    return OPRT_OK;
}

OPERATE_RET wukong_clock_set_pomodoro_timer(TY_AI_CLOCK_TIMER_OPR_TYPE_E opr, TY_AI_CLOCK_POMODORO_TIMER_CFG_T *pomodoro)
{
    (void)opr;
    (void)pomodoro;
    return OPRT_OK;
}

OPERATE_RET wukong_clock_set_schedule(TY_AI_CLOCK_SCHED_OPR_TYPE_E opr, TY_AI_CLOCK_SCHED_CFG_T *sched)
{
    (void)opr;
    (void)sched;
    return OPRT_OK;
}

CHAR_T *wukong_clock_set_schedule_query(TY_AI_CLOCK_SCHED_QUERY_METHOD_E query_method, TY_AI_CLOCK_SCHED_QUERY_CFG_T *sched_query)
{
    (void)query_method;
    (void)sched_query;
    return strdup("[]");
}

TIME_T tal_time_get_posix(VOID)
{
    return g_fake_now;
}

OPERATE_RET wukong_tm_reminder_add(CONST WUKONG_TM_REMINDER_CFG_T *reminder_cfg,
                                   CONST CHAR_T *reminder_id)
{
    if (reminder_cfg == NULL) {
        return OPRT_INVALID_PARM;
    }

    g_reminder_add_called = TRUE;
    g_last_reminder_add_cfg = *reminder_cfg;
    (VOID)reminder_id;
    return OPRT_OK;
}

OPERATE_RET wukong_tm_reminder_update(CONST CHAR_T *reminder_id, CONST WUKONG_TM_REMINDER_CFG_T *reminder_cfg)
{
    if (reminder_id == NULL || reminder_cfg == NULL) {
        return OPRT_INVALID_PARM;
    }

    g_reminder_update_called = TRUE;
    strncpy(g_last_reminder_update_id, reminder_id, sizeof(g_last_reminder_update_id) - 1);
    g_last_reminder_update_id[sizeof(g_last_reminder_update_id) - 1] = '\0';
    g_last_reminder_update_cfg = *reminder_cfg;
    return OPRT_OK;
}

OPERATE_RET wukong_tm_reminder_get(CONST CHAR_T *reminder_id, WUKONG_TM_REMINDER_CFG_T *reminder_cfg)
{
    if (reminder_id == NULL || reminder_cfg == NULL) {
        return OPRT_INVALID_PARM;
    }
    if (strcmp(reminder_id, g_stub_reminder_id) != 0) {
        return OPRT_NOT_FOUND;
    }

    *reminder_cfg = g_stub_reminder_cfg;
    return OPRT_OK;
}

OPERATE_RET wukong_tm_reminder_remove(CONST CHAR_T *reminder_id)
{
    (void)reminder_id;
    return OPRT_OK;
}

OPERATE_RET wukong_tm_reminder_remove_by_time(TIME_T start_time, UINT_T *removed_count)
{
    (void)start_time;
    if (removed_count != NULL) {
        *removed_count = 1;
    }
    return OPRT_OK;
}

OPERATE_RET wukong_tm_reminder_find_by_time(TIME_T start_time, CHAR_T *reminder_id, UINT_T reminder_id_len)
{
    (void)start_time;
    if (reminder_id != NULL && reminder_id_len > 0) {
        reminder_id[0] = '\0';
    }
    return OPRT_OK;
}

CHAR_T *wukong_tm_reminder_query_text(TIME_T start_time, TIME_T end_time, CONST CHAR_T *keyword)
{
    (void)start_time;
    (void)end_time;
    (void)keyword;
    return strdup("{\"reminders\":[]}");
}

void test_set_reminder_snapshot(const char *reminder_id, TIME_T start_time, const char *message)
{
    memset(&g_stub_reminder_cfg, 0, sizeof(g_stub_reminder_cfg));
    memset(&g_last_reminder_add_cfg, 0, sizeof(g_last_reminder_add_cfg));
    memset(&g_last_reminder_update_cfg, 0, sizeof(g_last_reminder_update_cfg));
    memset(g_stub_reminder_id, 0, sizeof(g_stub_reminder_id));
    memset(g_last_reminder_update_id, 0, sizeof(g_last_reminder_update_id));
    g_reminder_add_called = FALSE;
    g_reminder_update_called = FALSE;

    if (reminder_id != NULL) {
        strncpy(g_stub_reminder_id, reminder_id, sizeof(g_stub_reminder_id) - 1);
        g_stub_reminder_id[sizeof(g_stub_reminder_id) - 1] = '\0';
    }

    g_stub_reminder_cfg.enabled = TRUE;
    g_stub_reminder_cfg.start_time = start_time;
    if (message != NULL) {
        strncpy(g_stub_reminder_cfg.message, message, sizeof(g_stub_reminder_cfg.message) - 1);
        g_stub_reminder_cfg.message[sizeof(g_stub_reminder_cfg.message) - 1] = '\0';
    }
}

void test_set_now(TIME_T now)
{
    g_fake_now = now;
}

BOOL_T test_reminder_add_called(void)
{
    return g_reminder_add_called;
}

TIME_T test_last_reminder_add_start_time(void)
{
    return g_last_reminder_add_cfg.start_time;
}

const CHAR_T *test_last_reminder_add_message(void)
{
    return g_last_reminder_add_cfg.message;
}

BOOL_T test_reminder_update_called(void)
{
    return g_reminder_update_called;
}

const CHAR_T *test_last_reminder_update_id(void)
{
    return g_last_reminder_update_id;
}

TIME_T test_last_reminder_update_start_time(void)
{
    return g_last_reminder_update_cfg.start_time;
}

const CHAR_T *test_last_reminder_update_message(void)
{
    return g_last_reminder_update_cfg.message;
}

OPERATE_RET wukong_tm_countdown_create(INT_T hours, INT_T minutes, INT_T seconds)
{
    TIME_T total = 0;

    if (g_countdown_active) {
        return OPRT_COM_ERROR;
    }
    total = (TIME_T)hours * 3600 + (TIME_T)minutes * 60 + (TIME_T)seconds;
    g_countdown_active = TRUE;
    g_countdown_paused = FALSE;
    g_countdown_duration_sec = total;
    g_countdown_remaining_sec = total;
    return OPRT_OK;
}
OPERATE_RET wukong_tm_countdown_pause(VOID)
{
    if (!g_countdown_active) {
        return OPRT_NOT_FOUND;
    }
    g_countdown_paused = TRUE;
    return OPRT_OK;
}
OPERATE_RET wukong_tm_countdown_resume(VOID)
{
    if (!g_countdown_active) {
        return OPRT_NOT_FOUND;
    }
    g_countdown_paused = FALSE;
    return OPRT_OK;
}
OPERATE_RET wukong_tm_countdown_delete(VOID)
{
    if (!g_countdown_active) {
        return OPRT_NOT_FOUND;
    }
    g_countdown_active = FALSE;
    g_countdown_paused = FALSE;
    g_countdown_remaining_sec = 0;
    g_countdown_duration_sec = 0;
    return OPRT_OK;
}
OPERATE_RET wukong_tm_countdown_query(WUKONG_TM_COUNTDOWN_SNAPSHOT_T *snapshot)
{
    TIME_T elapsed = 0;

    if (!g_countdown_active || snapshot == NULL) {
        return OPRT_NOT_FOUND;
    }
    memset(snapshot, 0, sizeof(*snapshot));
    snapshot->active = TRUE;
    snapshot->state = g_countdown_paused ? WUKONG_TM_COUNTDOWN_STATE_PAUSED : WUKONG_TM_COUNTDOWN_STATE_RUNNING;
    snapshot->duration_sec = g_countdown_duration_sec;
    snapshot->remaining_sec = g_countdown_remaining_sec;
    elapsed = snapshot->duration_sec - snapshot->remaining_sec;
    if (elapsed < 0) {
        elapsed = 0;
    }
    snapshot->elapsed_sec = elapsed;
    return OPRT_OK;
}
OPERATE_RET wukong_tm_stopwatch_start(VOID)
{
    if (g_stopwatch_active) {
        return OPRT_COM_ERROR;
    }
    g_stopwatch_active = TRUE;
    g_stopwatch_paused = FALSE;
    g_stopwatch_accum = 0;
    g_stopwatch_seg_start = g_fake_now;
    return OPRT_OK;
}
OPERATE_RET wukong_tm_stopwatch_pause(VOID)
{
    if (!g_stopwatch_active || g_stopwatch_paused) {
        return OPRT_NOT_FOUND;
    }
    g_stopwatch_accum += (g_fake_now - g_stopwatch_seg_start);
    g_stopwatch_paused = TRUE;
    return OPRT_OK;
}
OPERATE_RET wukong_tm_stopwatch_resume(VOID)
{
    if (!g_stopwatch_active || !g_stopwatch_paused) {
        return OPRT_NOT_FOUND;
    }
    g_stopwatch_seg_start = g_fake_now;
    g_stopwatch_paused = FALSE;
    return OPRT_OK;
}
OPERATE_RET wukong_tm_stopwatch_stop(VOID)
{
    if (!g_stopwatch_active) {
        return OPRT_NOT_FOUND;
    }
    g_stopwatch_active = FALSE;
    g_stopwatch_paused = FALSE;
    g_stopwatch_accum = 0;
    g_stopwatch_seg_start = 0;
    return OPRT_OK;
}
OPERATE_RET wukong_tm_stopwatch_reset(VOID)
{
    if (!g_stopwatch_active) {
        return OPRT_NOT_FOUND;
    }
    g_stopwatch_active = FALSE;
    g_stopwatch_paused = FALSE;
    g_stopwatch_accum = 0;
    g_stopwatch_seg_start = 0;
    return OPRT_OK;
}
OPERATE_RET wukong_tm_stopwatch_query(WUKONG_TM_STOPWATCH_STATE_T *state)
{
    TIME_T elapsed = 0;

    if (!g_stopwatch_active || state == NULL) {
        return OPRT_NOT_FOUND;
    }
    if (g_stopwatch_paused) {
        elapsed = g_stopwatch_accum;
    } else {
        elapsed = g_stopwatch_accum + (g_fake_now - g_stopwatch_seg_start);
    }
    state->active = TRUE;
    state->paused = g_stopwatch_paused;
    state->elapsed_sec = elapsed;
    return OPRT_OK;
}
OPERATE_RET wukong_tm_pomodoro_start(CONST WUKONG_TM_POMODORO_CFG_T *pomodoro_cfg)
{
    if (g_pomodoro_active) {
        return OPRT_COM_ERROR;
    }
    g_pomodoro_active = TRUE;
    (void)pomodoro_cfg;
    return OPRT_OK;
}
OPERATE_RET wukong_tm_pomodoro_pause(VOID) { return OPRT_OK; }
OPERATE_RET wukong_tm_pomodoro_resume(VOID) { return OPRT_OK; }
OPERATE_RET wukong_tm_pomodoro_stop(VOID) { g_pomodoro_active = FALSE; return OPRT_OK; }
OPERATE_RET wukong_tm_pomodoro_query(WUKONG_TM_POMODORO_STATE_T *state)
{
    if (state == NULL) {
        return OPRT_INVALID_PARM;
    }
    if (!g_pomodoro_active) {
        return OPRT_NOT_FOUND;
    }

    memset(state, 0, sizeof(*state));
    state->active = TRUE;
    state->paused = FALSE;
    state->session_id = 7;
    state->phase = WUKONG_TM_POMODORO_PHASE_SHORT_BREAK;
    state->current_cycle = 2;
    state->completed_work_count = 1;
    state->phase_start_ts = 100;
    state->phase_end_ts = 400;
    state->remaining_sec = 300;
    state->cfg.work_duration = 25;
    state->cfg.short_break_duration = 5;
    state->cfg.long_break_duration = 15;
    state->cfg.work_sessions_before_long_break = 4;
    return OPRT_OK;
}

int test_has_tool(const char *name)
{
    int i = 0;
    for (i = 0; i < g_registered_tool_count; i++) {
        if (strcmp(g_registered_tools[i].name, name) == 0) {
            return 1;
        }
    }
    return 0;
}

const char *test_tool_description(const char *name)
{
    int i = 0;
    for (i = 0; i < g_registered_tool_count; i++) {
        if (strcmp(g_registered_tools[i].name, name) == 0) {
            return g_registered_tools[i].description;
        }
    }
    return NULL;
}

const char *test_prop_description(const char *tool_name, const char *prop_name)
{
    int i = 0;
    int j = 0;

    for (i = 0; i < g_registered_tool_count; i++) {
        if (strcmp(g_registered_tools[i].name, tool_name) != 0) {
            continue;
        }

        for (j = 0; j < g_registered_tools[i].prop_count; j++) {
            if (strcmp(g_registered_tools[i].prop_names[j], prop_name) == 0) {
                return g_registered_tools[i].prop_descriptions[j];
            }
        }
    }

    return NULL;
}

MCP_TOOL_HANDLER_CB test_get_tool_handler(const char *name)
{
    int i = 0;

    for (i = 0; i < g_registered_tool_count; i++) {
        if (strcmp(g_registered_tools[i].name, name) == 0) {
            return g_registered_tools[i].handler;
        }
    }

    return NULL;
}

BOOL_T test_prop_required(const char *tool_name, const char *prop_name)
{
    int i = 0;
    int j = 0;

    for (i = 0; i < g_registered_tool_count; i++) {
        if (strcmp(g_registered_tools[i].name, tool_name) != 0) {
            continue;
        }

        for (j = 0; j < g_registered_tools[i].prop_count; j++) {
            if (strcmp(g_registered_tools[i].prop_names[j], prop_name) == 0) {
                return g_registered_tools[i].prop_required[j];
            }
        }
    }

    return FALSE;
}
EOF

cat > "$TMP_DIR/test_wukong_mcp_tm_tools.c" <<'EOF'
#include <stdio.h>
#include <string.h>

#include "mcp_tool_tm.h"
#include "wukong_ai_mcp.h"

int test_has_tool(const char *name);
const char *test_tool_description(const char *name);
const char *test_prop_description(const char *tool_name, const char *prop_name);
BOOL_T test_prop_required(const char *tool_name, const char *prop_name);
MCP_TOOL_HANDLER_CB test_get_tool_handler(const char *name);
void test_set_now(TIME_T now);
void test_set_reminder_snapshot(const char *reminder_id, TIME_T start_time, const char *message);
BOOL_T test_reminder_add_called(void);
TIME_T test_last_reminder_add_start_time(void);
const CHAR_T *test_last_reminder_add_message(void);
BOOL_T test_reminder_update_called(void);
const CHAR_T *test_last_reminder_update_id(void);
TIME_T test_last_reminder_update_start_time(void);
const CHAR_T *test_last_reminder_update_message(void);

static int expect(int cond, const char *msg)
{
    if (!cond) {
        fprintf(stderr, "%s\n", msg);
        return 1;
    }
    return 0;
}

int main(void)
{
    const char *alarm_desc = NULL;
    const char *alarm_query_desc = NULL;
    const char *schedule_desc = NULL;
    const char *schedule_query_desc = NULL;
    const char *alarm_message_desc = NULL;
    const char *alarm_repeat_desc = NULL;
    const char *alarm_new_repeat_desc = NULL;
    const char *schedule_message_desc = NULL;
    const char *schedule_description_desc = NULL;
    const char *schedule_year_desc = NULL;
    const char *schedule_month_desc = NULL;
    const char *schedule_day_desc = NULL;
    const char *schedule_hour_desc = NULL;
    const char *schedule_minute_desc = NULL;
    const char *schedule_new_hour_desc = NULL;
    const char *schedule_new_message_desc = NULL;
    const char *schedule_start_ts_set_desc = NULL;
    const char *schedule_query_start_desc = NULL;
    const char *schedule_query_end_desc = NULL;
    const char *schedule_query_start_time_desc = NULL;
    const char *schedule_id_desc = NULL;
    MCP_TOOL_HANDLER_CB countdown_handler = NULL;
    MCP_TOOL_HANDLER_CB stopwatch_handler = NULL;
    MCP_TOOL_HANDLER_CB pomodoro_handler = NULL;
    MCP_TOOL_HANDLER_CB schedule_handler = NULL;
    ty_cJSON *args = NULL;
    ty_cJSON *out_content = NULL;
    BOOL_T is_error = FALSE;
    const char *query_text = NULL;

    if (expect(mcp_tool_tm_init() == 0, "expected unified time-management init to succeed")) {
        return 1;
    }

    if (expect(test_has_tool("device_alarm_set"), "expected device_alarm_set to be registered")) {
        return 1;
    }
    if (expect(test_has_tool("device_alarm_query"), "expected device_alarm_query to be registered")) {
        return 1;
    }
    if (expect(test_has_tool("device_countdown_timer_set"), "expected device_countdown_timer_set to be registered")) {
        return 1;
    }
    if (expect(test_has_tool("device_stopwatch_timer_set"), "expected device_stopwatch_timer_set to be registered")) {
        return 1;
    }
    if (expect(test_has_tool("device_pomodoro_timer_set"), "expected device_pomodoro_timer_set to be registered")) {
        return 1;
    }
    if (expect(test_has_tool("device_schedule_set"), "expected device_schedule_set to be registered")) {
        return 1;
    }
    if (expect(test_has_tool("device_schedule_query"), "expected device_schedule_query to be registered")) {
        return 1;
    }

    alarm_desc = test_tool_description("device_alarm_set");
    alarm_query_desc = test_tool_description("device_alarm_query");
    schedule_desc = test_tool_description("device_schedule_set");
    schedule_query_desc = test_tool_description("device_schedule_query");
    alarm_message_desc = test_prop_description("device_alarm_set", "message");
    alarm_repeat_desc = test_prop_description("device_alarm_set", "repeat_type");
    alarm_new_repeat_desc = test_prop_description("device_alarm_set", "new_repeat_type");
    schedule_message_desc = test_prop_description("device_schedule_set", "message");
    schedule_description_desc = test_prop_description("device_schedule_set", "description");
    schedule_year_desc = test_prop_description("device_schedule_set", "year");
    schedule_month_desc = test_prop_description("device_schedule_set", "month");
    schedule_day_desc = test_prop_description("device_schedule_set", "day");
    schedule_hour_desc = test_prop_description("device_schedule_set", "hour");
    schedule_minute_desc = test_prop_description("device_schedule_set", "minute");
    schedule_id_desc = test_prop_description("device_schedule_set", "id");
    schedule_new_hour_desc = test_prop_description("device_schedule_set", "new_hour");
    schedule_new_message_desc = test_prop_description("device_schedule_set", "new_message");
    schedule_start_ts_set_desc = test_prop_description("device_schedule_set", "start_timestamp");
    schedule_query_start_desc = test_prop_description("device_schedule_query", "start_timestamp");
    schedule_query_end_desc = test_prop_description("device_schedule_query", "end_timestamp");
    schedule_query_start_time_desc = test_prop_description("device_schedule_query", "start_time");

    if (expect(alarm_desc != NULL &&
               strstr(alarm_desc, "Manage local alarms") != NULL &&
               strstr(alarm_desc, "wake-up") != NULL &&
               strstr(alarm_desc, "device_schedule_set") != NULL &&
               strstr(alarm_desc, "repeat_type") != NULL &&
               strstr(alarm_desc, "weekday_mask") != NULL &&
               strstr(alarm_desc, "Update merges") != NULL &&
               strstr(alarm_desc, "闹钟") == NULL,
               "expected alarm tool description to focus on alarms")) {
        return 1;
    }
    if (expect(alarm_query_desc != NULL &&
               strstr(alarm_query_desc, "Query local alarms") != NULL &&
               strstr(alarm_query_desc, "reminders") != NULL,
               "expected alarm query description to be in English")) {
        return 1;
    }
    if (expect(schedule_desc != NULL &&
               strstr(schedule_desc, "reminder") != NULL &&
               strstr(schedule_desc, "year") != NULL &&
               strstr(schedule_desc, "minute") != NULL &&
               strstr(schedule_desc, "today") != NULL &&
               strstr(schedule_desc, "Update merges") != NULL &&
               strstr(schedule_desc, "start_timestamp") != NULL &&
               strstr(schedule_desc, "明天") == NULL &&
               strstr(schedule_desc, "小时和分钟") == NULL,
               "expected schedule tool description to focus on reminders")) {
        return 1;
    }
    if (expect(schedule_query_desc != NULL &&
               strstr(schedule_query_desc, "Query local reminders") != NULL &&
               strstr(schedule_query_desc, "start_timestamp") != NULL,
               "expected schedule query description to be in English and use timestamps")) {
        return 1;
    }
    if (expect(alarm_message_desc != NULL &&
               strstr(alarm_message_desc, "Semantic alarm note") != NULL &&
               strstr(alarm_message_desc, "storage and query") != NULL,
               "expected alarm message field description to mention semantic record")) {
        return 1;
    }
    if (expect(alarm_repeat_desc != NULL &&
               strstr(alarm_repeat_desc, "daily") != NULL &&
               strstr(alarm_repeat_desc, "recurring") != NULL,
               "expected alarm repeat_type description to guide recurring alarms")) {
        return 1;
    }
    if (expect(alarm_new_repeat_desc == NULL,
               "expected alarm new_repeat_type field to be removed from schema")) {
        return 1;
    }
    if (expect(schedule_message_desc != NULL &&
               strstr(schedule_message_desc, "Reminder message") != NULL &&
               strstr(schedule_message_desc, "description") == NULL,
               "expected schedule message field description to focus on message only")) {
        return 1;
    }
    if (expect(schedule_description_desc == NULL,
               "expected schedule description field to be removed")) {
        return 1;
    }
    if (expect(schedule_year_desc != NULL &&
               strstr(schedule_year_desc, "year") != NULL,
               "expected schedule year field description")) {
        return 1;
    }
    if (expect(schedule_month_desc != NULL &&
               strstr(schedule_month_desc, "month") != NULL,
               "expected schedule month field description")) {
        return 1;
    }
    if (expect(schedule_day_desc != NULL &&
               strstr(schedule_day_desc, "day") != NULL,
               "expected schedule day field description")) {
        return 1;
    }
    if (expect(schedule_hour_desc != NULL &&
               strstr(schedule_hour_desc, "hour") != NULL,
               "expected schedule hour field description")) {
        return 1;
    }
    if (expect(schedule_minute_desc != NULL &&
               strstr(schedule_minute_desc, "minute") != NULL,
               "expected schedule minute field description")) {
        return 1;
    }
    if (expect(schedule_id_desc != NULL &&
               strstr(schedule_id_desc, "identifier") != NULL,
               "expected schedule id field description")) {
        return 1;
    }
    if (expect(schedule_new_hour_desc == NULL,
               "expected schedule new_hour field to be removed")) {
        return 1;
    }
    if (expect(schedule_new_message_desc == NULL,
               "expected schedule new_message field to be removed")) {
        return 1;
    }
    if (expect(schedule_start_ts_set_desc == NULL,
               "expected schedule set start_timestamp field to be removed")) {
        return 1;
    }
    if (expect(test_prop_required("device_schedule_set", "categories") == FALSE,
               "expected schedule categories field to be optional")) {
        return 1;
    }
    if (expect(schedule_query_start_desc != NULL &&
               strstr(schedule_query_start_desc, "lower bound") != NULL,
               "expected schedule query start_timestamp property")) {
        return 1;
    }
    if (expect(schedule_query_end_desc != NULL &&
               strstr(schedule_query_end_desc, "upper bound") != NULL,
               "expected schedule query end_timestamp property")) {
        return 1;
    }
    if (expect(schedule_query_start_time_desc == NULL,
               "expected legacy start_time query property to be removed")) {
        return 1;
    }

    countdown_handler = test_get_tool_handler("device_countdown_timer_set");
    stopwatch_handler = test_get_tool_handler("device_stopwatch_timer_set");
    pomodoro_handler = test_get_tool_handler("device_pomodoro_timer_set");
    schedule_handler = test_get_tool_handler("device_schedule_set");
    if (expect(countdown_handler != NULL, "expected countdown tool handler to be registered")) {
        return 1;
    }
    if (expect(stopwatch_handler != NULL, "expected stopwatch tool handler to be registered")) {
        return 1;
    }
    if (expect(pomodoro_handler != NULL, "expected pomodoro tool handler to be registered")) {
        return 1;
    }
    if (expect(schedule_handler != NULL, "expected schedule tool handler to be registered")) {
        return 1;
    }

    test_set_now(1774832400);

    args = ty_cJSON_CreateObject();
    ty_cJSON_AddNumberToObject(args, "operation", 0);
    ty_cJSON_AddNumberToObject(args, "hour_duration", 0);
    ty_cJSON_AddNumberToObject(args, "minute_duration", 1);
    ty_cJSON_AddNumberToObject(args, "second_duration", 30);
    if (expect(countdown_handler("device_countdown_timer_set", args, &out_content, &is_error, NULL) == OPRT_OK,
               "expected countdown create to succeed")) {
        ty_cJSON_Delete(args);
        return 1;
    }
    ty_cJSON_Delete(args);
    ty_cJSON_Delete(out_content);
    out_content = NULL;

    args = ty_cJSON_CreateObject();
    ty_cJSON_AddNumberToObject(args, "operation", 0);
    ty_cJSON_AddNumberToObject(args, "hour_duration", 0);
    ty_cJSON_AddNumberToObject(args, "minute_duration", 2);
    ty_cJSON_AddNumberToObject(args, "second_duration", 0);
    if (expect(countdown_handler("device_countdown_timer_set", args, &out_content, &is_error, NULL) == OPRT_OK,
               "expected duplicate countdown create tool call to succeed")) {
        ty_cJSON_Delete(args);
        return 1;
    }
    query_text = out_content->child->valuestring;
    if (expect(strstr(query_text, "\"success\":false") != NULL &&
               strstr(query_text, "\"reason\":\"already_exists\"") != NULL,
               "expected duplicate countdown create to return already_exists")) {
        ty_cJSON_Delete(args);
        ty_cJSON_Delete(out_content);
        return 1;
    }
    ty_cJSON_Delete(args);
    ty_cJSON_Delete(out_content);
    out_content = NULL;

    args = ty_cJSON_CreateObject();
    ty_cJSON_AddNumberToObject(args, "operation", 4);
    if (expect(countdown_handler("device_countdown_timer_set", args, &out_content, &is_error, NULL) == OPRT_OK,
               "expected countdown query to succeed")) {
        ty_cJSON_Delete(args);
        return 1;
    }
    query_text = out_content->child->valuestring;
    if (expect(strstr(query_text, "\"success\":true") != NULL &&
               strstr(query_text, "\"duration_sec\":90") != NULL &&
               strstr(query_text, "\"remaining_sec\":90") != NULL &&
               strstr(query_text, "\"elapsed_sec\":0") != NULL,
               "expected countdown query JSON with duration/remaining/elapsed")) {
        ty_cJSON_Delete(args);
        ty_cJSON_Delete(out_content);
        return 1;
    }
    ty_cJSON_Delete(args);
    ty_cJSON_Delete(out_content);
    out_content = NULL;

    args = ty_cJSON_CreateObject();
    ty_cJSON_AddNumberToObject(args, "operation", 1);
    if (expect(countdown_handler("device_countdown_timer_set", args, &out_content, &is_error, NULL) == OPRT_OK,
               "expected countdown pause to succeed")) {
        ty_cJSON_Delete(args);
        return 1;
    }
    query_text = out_content->child->valuestring;
    if (expect(strstr(query_text, "\"success\":true") != NULL &&
               strstr(query_text, "\"remaining_sec\":90") != NULL &&
               strstr(query_text, "\"elapsed_sec\":0") != NULL,
               "expected countdown pause MCP result with remaining_sec and elapsed_sec")) {
        ty_cJSON_Delete(args);
        ty_cJSON_Delete(out_content);
        return 1;
    }
    ty_cJSON_Delete(args);
    ty_cJSON_Delete(out_content);
    out_content = NULL;

    args = ty_cJSON_CreateObject();
    ty_cJSON_AddNumberToObject(args, "operation", 0);
    ty_cJSON_AddStringToObject(args, "id", "reminder-new");
    ty_cJSON_AddNumberToObject(args, "year", 2026);
    ty_cJSON_AddNumberToObject(args, "month", 3);
    ty_cJSON_AddNumberToObject(args, "day", 30);
    ty_cJSON_AddNumberToObject(args, "hour", 17);
    ty_cJSON_AddNumberToObject(args, "minute", 20);
    ty_cJSON_AddStringToObject(args, "message", "提醒喝水");
    if (expect(schedule_handler("device_schedule_set", args, &out_content, &is_error, NULL) == OPRT_OK,
               "expected schedule add with time only to return tool result")) {
        ty_cJSON_Delete(args);
        return 1;
    }
    query_text = out_content->child->valuestring;
    if (expect(strstr(query_text, "\"success\":true") != NULL,
               "expected schedule add with time only to succeed")) {
        ty_cJSON_Delete(args);
        ty_cJSON_Delete(out_content);
        return 1;
    }
    if (expect(test_reminder_add_called() == TRUE,
               "expected schedule add with time only to call reminder_add")) {
        ty_cJSON_Delete(args);
        ty_cJSON_Delete(out_content);
        return 1;
    }
    if (expect(test_last_reminder_add_start_time() == 1774862400,
               "expected schedule add with time only to default date to today")) {
        ty_cJSON_Delete(args);
        ty_cJSON_Delete(out_content);
        return 1;
    }
    if (expect(strcmp(test_last_reminder_add_message(), "提醒喝水") == 0,
               "expected schedule add with time only to preserve message")) {
        ty_cJSON_Delete(args);
        ty_cJSON_Delete(out_content);
        return 1;
    }
    ty_cJSON_Delete(args);
    ty_cJSON_Delete(out_content);
    out_content = NULL;

    args = ty_cJSON_CreateObject();
    ty_cJSON_AddNumberToObject(args, "operation", 0);
    if (expect(stopwatch_handler("device_stopwatch_timer_set", args, &out_content, &is_error, NULL) == OPRT_OK,
               "expected stopwatch start to succeed")) {
        ty_cJSON_Delete(args);
        return 1;
    }
    ty_cJSON_Delete(args);
    ty_cJSON_Delete(out_content);
    out_content = NULL;

    args = ty_cJSON_CreateObject();
    ty_cJSON_AddNumberToObject(args, "operation", 0);
    if (expect(stopwatch_handler("device_stopwatch_timer_set", args, &out_content, &is_error, NULL) == OPRT_OK,
               "expected duplicate stopwatch start tool call to succeed")) {
        ty_cJSON_Delete(args);
        return 1;
    }
    query_text = out_content->child->valuestring;
    if (expect(strstr(query_text, "\"success\":false") != NULL &&
               strstr(query_text, "\"reason\":\"already_exists\"") != NULL &&
               strstr(query_text, "\"active\":true") != NULL,
               "expected duplicate stopwatch start to return already_exists with current snapshot")) {
        ty_cJSON_Delete(args);
        ty_cJSON_Delete(out_content);
        return 1;
    }
    ty_cJSON_Delete(args);
    ty_cJSON_Delete(out_content);
    out_content = NULL;

    test_set_now(1774832500);
    args = ty_cJSON_CreateObject();
    ty_cJSON_AddNumberToObject(args, "operation", 5);
    if (expect(stopwatch_handler("device_stopwatch_timer_set", args, &out_content, &is_error, NULL) == OPRT_OK,
               "expected stopwatch query to succeed")) {
        ty_cJSON_Delete(args);
        return 1;
    }
    query_text = out_content->child->valuestring;
    if (expect(strstr(query_text, "\"success\":true") != NULL &&
               strstr(query_text, "\"elapsed_sec\":100") != NULL &&
               strstr(query_text, "\"paused\":false") != NULL,
               "expected stopwatch query to return elapsed_sec while running")) {
        ty_cJSON_Delete(args);
        ty_cJSON_Delete(out_content);
        return 1;
    }
    ty_cJSON_Delete(args);
    ty_cJSON_Delete(out_content);
    out_content = NULL;

    args = ty_cJSON_CreateObject();
    ty_cJSON_AddNumberToObject(args, "operation", 1);
    if (expect(stopwatch_handler("device_stopwatch_timer_set", args, &out_content, &is_error, NULL) == OPRT_OK,
               "expected stopwatch pause to succeed")) {
        ty_cJSON_Delete(args);
        return 1;
    }
    query_text = out_content->child->valuestring;
    if (expect(strstr(query_text, "\"success\":true") != NULL &&
               strstr(query_text, "\"elapsed_sec\":100") != NULL,
               "expected stopwatch pause MCP result to include elapsed_sec")) {
        ty_cJSON_Delete(args);
        ty_cJSON_Delete(out_content);
        return 1;
    }
    ty_cJSON_Delete(args);
    ty_cJSON_Delete(out_content);
    out_content = NULL;

    args = ty_cJSON_CreateObject();
    ty_cJSON_AddNumberToObject(args, "operation", 2);
    if (expect(stopwatch_handler("device_stopwatch_timer_set", args, &out_content, &is_error, NULL) == OPRT_OK,
               "expected stopwatch resume to succeed")) {
        ty_cJSON_Delete(args);
        return 1;
    }
    ty_cJSON_Delete(args);
    ty_cJSON_Delete(out_content);
    out_content = NULL;

    test_set_now(1774832510);
    args = ty_cJSON_CreateObject();
    ty_cJSON_AddNumberToObject(args, "operation", 5);
    if (expect(stopwatch_handler("device_stopwatch_timer_set", args, &out_content, &is_error, NULL) == OPRT_OK,
               "expected stopwatch query after resume to succeed")) {
        ty_cJSON_Delete(args);
        return 1;
    }
    query_text = out_content->child->valuestring;
    if (expect(strstr(query_text, "\"elapsed_sec\":110") != NULL,
               "expected stopwatch query to reflect time after resume")) {
        ty_cJSON_Delete(args);
        ty_cJSON_Delete(out_content);
        return 1;
    }
    ty_cJSON_Delete(args);
    ty_cJSON_Delete(out_content);
    out_content = NULL;

    args = ty_cJSON_CreateObject();
    ty_cJSON_AddNumberToObject(args, "operation", 3);
    if (expect(stopwatch_handler("device_stopwatch_timer_set", args, &out_content, &is_error, NULL) == OPRT_OK,
               "expected stopwatch stop to succeed")) {
        ty_cJSON_Delete(args);
        return 1;
    }
    query_text = out_content->child->valuestring;
    if (expect(strstr(query_text, "\"success\":true") != NULL &&
               strstr(query_text, "\"elapsed_sec\":110") != NULL,
               "expected stopwatch stop MCP result to include final elapsed_sec")) {
        ty_cJSON_Delete(args);
        ty_cJSON_Delete(out_content);
        return 1;
    }
    ty_cJSON_Delete(args);
    ty_cJSON_Delete(out_content);
    out_content = NULL;

    args = ty_cJSON_CreateObject();
    ty_cJSON_AddNumberToObject(args, "operation", 5);
    if (expect(stopwatch_handler("device_stopwatch_timer_set", args, &out_content, &is_error, NULL) == OPRT_OK,
               "expected stopwatch query when idle to return tool result")) {
        ty_cJSON_Delete(args);
        return 1;
    }
    query_text = out_content->child->valuestring;
    if (expect(strstr(query_text, "\"success\":true") != NULL &&
               strstr(query_text, "\"active\":false") != NULL,
               "expected stopwatch query when idle to report inactive")) {
        ty_cJSON_Delete(args);
        ty_cJSON_Delete(out_content);
        return 1;
    }
    ty_cJSON_Delete(args);
    ty_cJSON_Delete(out_content);
    out_content = NULL;

    args = ty_cJSON_CreateObject();
    ty_cJSON_AddNumberToObject(args, "operation", 0);
    if (expect(pomodoro_handler("device_pomodoro_timer_set", args, &out_content, &is_error, NULL) == OPRT_OK,
               "expected pomodoro start tool call to succeed")) {
        ty_cJSON_Delete(args);
        return 1;
    }
    ty_cJSON_Delete(args);
    ty_cJSON_Delete(out_content);
    out_content = NULL;

    args = ty_cJSON_CreateObject();
    ty_cJSON_AddNumberToObject(args, "operation", 4);
    if (expect(pomodoro_handler("device_pomodoro_timer_set", args, &out_content, &is_error, NULL) == OPRT_OK,
               "expected pomodoro query tool call to succeed")) {
        ty_cJSON_Delete(args);
        return 1;
    }
    if (expect(out_content != NULL && out_content->child != NULL && out_content->child->valuestring != NULL,
               "expected pomodoro query tool call to return text content")) {
        ty_cJSON_Delete(args);
        ty_cJSON_Delete(out_content);
        return 1;
    }
    query_text = out_content->child->valuestring;
    if (expect(strstr(query_text, "\"active\":true") != NULL,
               "expected pomodoro query result to include active state")) {
        ty_cJSON_Delete(args);
        ty_cJSON_Delete(out_content);
        return 1;
    }
    if (expect(strstr(query_text, "\"phase\":1") != NULL &&
               strstr(query_text, "\"remaining_sec\":300") != NULL &&
               strstr(query_text, "\"work_sessions_before_long_break\":4") != NULL,
               "expected pomodoro query result to include runtime snapshot")) {
        ty_cJSON_Delete(args);
        ty_cJSON_Delete(out_content);
        return 1;
    }
    ty_cJSON_Delete(args);
    ty_cJSON_Delete(out_content);
    out_content = NULL;

    args = ty_cJSON_CreateObject();
    ty_cJSON_AddNumberToObject(args, "operation", 0);
    ty_cJSON_AddNumberToObject(args, "current_cycle", 3);
    if (expect(pomodoro_handler("device_pomodoro_timer_set", args, &out_content, &is_error, NULL) == OPRT_OK,
               "expected active pomodoro pseudo-update tool call to succeed")) {
        ty_cJSON_Delete(args);
        return 1;
    }
    query_text = out_content->child->valuestring;
    if (expect(strstr(query_text, "\"success\":false") != NULL &&
               strstr(query_text, "\"reason\":\"already_exists\"") != NULL &&
               strstr(query_text, "\"remaining_sec\":300") != NULL &&
               strstr(query_text, "\"current_cycle\":2") != NULL,
               "expected active pomodoro pseudo-update to return current snapshot unchanged")) {
        ty_cJSON_Delete(args);
        ty_cJSON_Delete(out_content);
        return 1;
    }
    ty_cJSON_Delete(args);
    ty_cJSON_Delete(out_content);
    out_content = NULL;

    args = ty_cJSON_CreateObject();
    ty_cJSON_AddNumberToObject(args, "operation", 0);
    if (expect(pomodoro_handler("device_pomodoro_timer_set", args, &out_content, &is_error, NULL) == OPRT_OK,
               "expected duplicate pomodoro start tool call to succeed")) {
        ty_cJSON_Delete(args);
        return 1;
    }
    query_text = out_content->child->valuestring;
    if (expect(strstr(query_text, "\"success\":false") != NULL &&
               strstr(query_text, "\"reason\":\"already_exists\"") != NULL &&
               strstr(query_text, "\"session_id\":7") != NULL,
               "expected duplicate pomodoro start to return already_exists with current snapshot")) {
        ty_cJSON_Delete(args);
        ty_cJSON_Delete(out_content);
        return 1;
    }
    ty_cJSON_Delete(args);
    ty_cJSON_Delete(out_content);

    test_set_reminder_snapshot("reminder-2", 1774850400, "今天下午五点开会");
    args = ty_cJSON_CreateObject();
    ty_cJSON_AddNumberToObject(args, "operation", 2);
    ty_cJSON_AddStringToObject(args, "id", "reminder-2");
    ty_cJSON_AddNumberToObject(args, "year", 2026);
    ty_cJSON_AddNumberToObject(args, "month", 3);
    ty_cJSON_AddNumberToObject(args, "day", 30);
    ty_cJSON_AddNumberToObject(args, "hour", 18);
    ty_cJSON_AddNumberToObject(args, "minute", 30);
    ty_cJSON_AddStringToObject(args, "message", "今天下午六点半开会");
    if (expect(schedule_handler("device_schedule_set", args, &out_content, &is_error, NULL) == OPRT_OK,
               "expected schedule update tool call to succeed")) {
        ty_cJSON_Delete(args);
        return 1;
    }
    if (expect(test_reminder_update_called() == TRUE,
               "expected schedule update to call reminder_update")) {
        ty_cJSON_Delete(args);
        ty_cJSON_Delete(out_content);
        return 1;
    }
    if (expect(strcmp(test_last_reminder_update_id(), "reminder-2") == 0,
               "expected schedule update to target the matched reminder id")) {
        ty_cJSON_Delete(args);
        ty_cJSON_Delete(out_content);
        return 1;
    }
    if (expect(test_last_reminder_update_start_time() == 1774866600,
               "expected schedule update to refresh reminder start_time")) {
        ty_cJSON_Delete(args);
        ty_cJSON_Delete(out_content);
        return 1;
    }
    if (expect(strcmp(test_last_reminder_update_message(), "今天下午六点半开会") == 0,
               "expected schedule update to pass new_message into reminder_update")) {
        ty_cJSON_Delete(args);
        ty_cJSON_Delete(out_content);
        return 1;
    }
    ty_cJSON_Delete(args);
    ty_cJSON_Delete(out_content);

    return 0;
}
EOF

cc -D_GNU_SOURCE -std=c99 -Wall -Wextra -Werror \
    -I"$TMP_DIR" \
    -I"$ROOT_DIR/src/wukong/mcp/tools" \
    "$TMP_DIR/stubs.c" \
    "$ROOT_DIR/src/wukong/mcp/tools/mcp_tool_tm.c" \
    "$TMP_DIR/test_wukong_mcp_tm_tools.c" \
    -o "$TMP_DIR/test_wukong_mcp_tm_tools"

"$TMP_DIR/test_wukong_mcp_tm_tools"
