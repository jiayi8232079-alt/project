#ifndef __TUYA_AI_DISPLAY_H__
#define __TUYA_AI_DISPLAY_H__

#include "tuya_cloud_types.h"

typedef enum {
    TY_DISPLAY_TP_CHAT_MODE = 0,
    TY_DISPLAY_TP_CHAT_STAT,
    TY_DISPLAY_TP_HUMAN_CHAT,
    TY_DISPLAY_TP_AI_CHAT_START,
    TY_DISPLAY_TP_AI_CHAT_DATA,
    TY_DISPLAY_TP_AI_CHAT_STOP,
    TY_DISPLAY_TP_EMOJI,
} TY_DISPLAY_MSG_TYPE_E;

OPERATE_RET tuya_ai_display_msg(VOID *data, UINT_T len, TY_DISPLAY_MSG_TYPE_E type);

#endif
