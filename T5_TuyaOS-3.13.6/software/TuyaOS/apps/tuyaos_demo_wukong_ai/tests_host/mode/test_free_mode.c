#include "wukong_test.h"
#include "wukong_ai_mode.h"
#include "wukong_ai_agent.h"
#include "wukong_audio_aec_vad.h"

void stub_reset_state(void);
OPERATE_RET wukong_ai_free_notify_idle_cb(VOID *data, INT_T len);
OPERATE_RET wukong_ai_free_event_cb(VOID *data, INT_T len);
OPERATE_RET wukong_ai_free_vad(VOID *data, INT_T len);

extern int g_idle_timer_calls;
extern BOOL_T g_idle_timer_last;
extern int g_lowpower_timer_calls;
extern BOOL_T g_lowpower_timer_last;
extern int g_wakeup_set_calls;
extern BOOL_T g_wakeup_set_last;
extern BOOL_T g_agent_ready;
extern int g_input_start_calls;
extern int g_input_stop_calls;
extern int g_set_scode_calls;
extern int g_agent_event_calls;
extern WUKONG_AUDIO_VAD_FLAG_E g_vad_flag;
extern int g_vad_threshold_calls;
extern WUKONG_AUDIO_VAD_THRESHOLD_E g_vad_threshold_last;
extern AI_CHAT_MODE_PARAM_T s_ai_free;

int main(void)
{
    WUKONG_AI_EVENT_T event = {0};
    WUKONG_AUDIO_VAD_FLAG_E vad_flag = WUKONG_AUDIO_VAD_STOP;

    stub_reset_state();

    s_ai_free.state = AI_CHAT_LISTEN;
    s_ai_free.wakeup_stat = TRUE;
    EXPECT_OK(wukong_ai_free_notify_idle_cb(NULL, 0),
              "notify-idle should succeed");
    EXPECT_EQ(s_ai_free.state, AI_CHAT_IDLE,
              "notify-idle should move free mode to idle state");
    EXPECT_EQ(s_ai_free.wakeup_stat, FALSE,
              "notify-idle should clear wakeup flag");
    EXPECT_EQ(g_wakeup_set_calls, 1,
              "notify-idle should disable wakeup input immediately");
    EXPECT_EQ(g_wakeup_set_last, FALSE,
              "notify-idle should turn off wakeup input");
    EXPECT_EQ(g_idle_timer_calls, 1,
              "notify-idle should stop idle timer");
    EXPECT_EQ(g_idle_timer_last, FALSE,
              "notify-idle should stop idle timer after exiting chat");
    EXPECT_EQ(g_lowpower_timer_calls, 1,
              "notify-idle should resume lowpower timer");
    EXPECT_EQ(g_lowpower_timer_last, TRUE,
              "notify-idle should resume lowpower timer after exit");

    stub_reset_state();
    s_ai_free.state = AI_CHAT_LISTEN;
    s_ai_free.wakeup_stat = TRUE;
    event.type = WUKONG_AI_EVENT_PLAY_END;
    EXPECT_OK(wukong_ai_free_event_cb(&event, 0),
              "play-end event should succeed while wakeup active");
    EXPECT_EQ(s_ai_free.state, AI_CHAT_LISTEN,
              "play-end should keep free mode listening during multi-turn chat");

    stub_reset_state();
    s_ai_free.state = AI_CHAT_IDLE;
    s_ai_free.wakeup_stat = FALSE;
    event.type = WUKONG_AI_EVENT_PLAY_END;
    EXPECT_OK(wukong_ai_free_event_cb(&event, 0),
              "play-end event should succeed while idle");
    EXPECT_EQ(s_ai_free.state, AI_CHAT_IDLE,
              "play-end should remain idle after notify-idle cleared wakeup flag");

    stub_reset_state();
    s_ai_free.wakeup_stat = FALSE;
    vad_flag = WUKONG_AUDIO_VAD_STOP;
    EXPECT_OK(wukong_ai_free_vad(&vad_flag, sizeof(vad_flag)),
              "vad stop without wakeup should be ignored safely");
    EXPECT_EQ(g_input_stop_calls, 0,
              "vad stop without wakeup should not stop audio upload");

    TEST_END();
}
