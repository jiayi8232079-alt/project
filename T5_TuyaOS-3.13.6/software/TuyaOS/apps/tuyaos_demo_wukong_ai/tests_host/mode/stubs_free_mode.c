#include <string.h>

#include "wukong_ai_mode.h"

#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wunused-parameter"
#pragma GCC diagnostic ignored "-Wreturn-type"
#pragma GCC diagnostic ignored "-Wunused-variable"
#define static
#include "../wukong_ai_mode_free.c"
#undef static
#pragma GCC diagnostic pop

int g_idle_timer_calls = 0;
BOOL_T g_idle_timer_last = FALSE;
int g_lowpower_timer_calls = 0;
BOOL_T g_lowpower_timer_last = FALSE;
int g_wakeup_set_calls = 0;
BOOL_T g_wakeup_set_last = FALSE;
int g_output_stop_calls = 0;
int g_player_stop_calls = 0;
int g_input_reset_calls = 0;
int g_alert_calls = 0;
BOOL_T g_agent_ready = TRUE;
int g_input_start_calls = 0;
int g_input_stop_calls = 0;
int g_set_scode_calls = 0;
int g_agent_event_calls = 0;
WUKONG_AUDIO_VAD_FLAG_E g_vad_flag = WUKONG_AUDIO_VAD_STOP;
int g_vad_threshold_calls = 0;
WUKONG_AUDIO_VAD_THRESHOLD_E g_vad_threshold_last = WUKONG_AUDIO_VAD_LOW;
char g_current_scode[] = AI_AGENT_SCODE_CHAT;
char *_chat_sub_str[] = {"hold", "oneshot", "wakeup", "free"};
char *_device_mode_str[] = {"chat", "translate", "p2p", "record", "picture", "detection"};
char *_state_str[] = {"INIT", "IDLE", "LISTEN", "UPLOAD", "THINK", "SPEAK", "UNKNOWN"};

void stub_reset_state(void)
{
    g_idle_timer_calls = 0;
    g_idle_timer_last = FALSE;
    g_lowpower_timer_calls = 0;
    g_lowpower_timer_last = FALSE;
    g_wakeup_set_calls = 0;
    g_wakeup_set_last = FALSE;
    g_output_stop_calls = 0;
    g_player_stop_calls = 0;
    g_input_reset_calls = 0;
    g_alert_calls = 0;
    g_agent_ready = TRUE;
    g_input_start_calls = 0;
    g_input_stop_calls = 0;
    g_set_scode_calls = 0;
    g_agent_event_calls = 0;
    g_vad_flag = WUKONG_AUDIO_VAD_STOP;
    g_vad_threshold_calls = 0;
    g_vad_threshold_last = WUKONG_AUDIO_VAD_LOW;
    s_ai_free.wakeup_stat = FALSE;
    s_ai_free.state = AI_CHAT_IDLE;
    s_ai_cur_state = AI_CHAT_INVALID;
}

OPERATE_RET tuya_ai_toy_idle_timer_ctrl(BOOL_T enable)
{
    g_idle_timer_calls++;
    g_idle_timer_last = enable;
    return OPRT_OK;
}

OPERATE_RET tuya_ai_toy_lowpower_timer_ctrl(BOOL_T enable)
{
    g_lowpower_timer_calls++;
    g_lowpower_timer_last = enable;
    return OPRT_OK;
}

OPERATE_RET tuya_ai_output_stop(BOOL_T force)
{
    (void)force;
    g_output_stop_calls++;
    return OPRT_OK;
}

OPERATE_RET tuya_ai_toy_led_off(void) { return OPRT_OK; }
OPERATE_RET tuya_ai_toy_led_on(void) { return OPRT_OK; }
OPERATE_RET tuya_ai_toy_led_flash(UINT_T interval_ms) { (void)interval_ms; return OPRT_OK; }
OPERATE_RET tuya_ai_display_msg(VOID *data, UINT_T len, TY_DISPLAY_MSG_TYPE_E type)
{ (void)data; (void)len; (void)type; return OPRT_OK; }

OPERATE_RET wukong_audio_input_wakeup_mode_set(WUKONG_AUDIO_VAD_MODE_E mode)
{
    (void)mode;
    return OPRT_OK;
}

OPERATE_RET wukong_audio_input_wakeup_set(BOOL_T enable)
{
    g_wakeup_set_calls++;
    g_wakeup_set_last = enable;
    return OPRT_OK;
}

OPERATE_RET wukong_audio_input_reset(void)
{
    g_input_reset_calls++;
    return OPRT_OK;
}

OPERATE_RET wukong_audio_player_alert(TY_AI_TOY_ALERT_TYPE_E type, BOOL_T send_eof)
{
    (void)type;
    (void)send_eof;
    g_alert_calls++;
    return OPRT_OK;
}

OPERATE_RET wukong_audio_player_stop(AI_PLAYER_TYPE_E type)
{
    (void)type;
    g_player_stop_calls++;
    return OPRT_OK;
}

OPERATE_RET wukong_audio_player_resume(void) { return OPRT_OK; }
OPERATE_RET wukong_audio_player_pause(void) { return OPRT_OK; }
OPERATE_RET wukong_audio_player_replay(void) { return OPRT_OK; }

void tuya_ai_input_start_s(char *scode, BOOL_T force)
{
    (void)scode;
    (void)force;
    g_input_start_calls++;
}

void tuya_ai_input_stop(void)
{
    g_input_stop_calls++;
}

char *tuya_ai_agent_get_scode(void *unused)
{
    (void)unused;
    return g_current_scode;
}

BOOL_T tuya_ai_agent_is_ready(void)
{
    return g_agent_ready;
}

OPERATE_RET tuya_ai_agent_set_scode(const char *scode)
{
    (void)scode;
    g_set_scode_calls++;
    return OPRT_OK;
}

OPERATE_RET tuya_ai_agent_event(INT_T event, INT_T param)
{
    (void)event;
    (void)param;
    g_agent_event_calls++;
    return OPRT_OK;
}

WUKONG_AUDIO_VAD_FLAG_E wukong_vad_get_flag(void)
{
    return g_vad_flag;
}

OPERATE_RET wukong_vad_set_threshold(WUKONG_AUDIO_VAD_THRESHOLD_E level)
{
    g_vad_threshold_calls++;
    g_vad_threshold_last = level;
    return OPRT_OK;
}

OPERATE_RET wukong_kws_enable(void) { return OPRT_OK; }
OPERATE_RET wukong_kws_disable(void) { return OPRT_OK; }
