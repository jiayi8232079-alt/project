#ifndef __WUKONG_AUDIO_INPUT_H__
#define __WUKONG_AUDIO_INPUT_H__

#include "tuya_cloud_types.h"

typedef enum {
    WUKONG_AUDIO_VAD_MANUAL = 0,
    WUKONG_AUDIO_VAD_AUTO = 1,
} WUKONG_AUDIO_VAD_MODE_E;

OPERATE_RET wukong_audio_input_wakeup_mode_set(WUKONG_AUDIO_VAD_MODE_E mode);
OPERATE_RET wukong_audio_input_wakeup_set(BOOL_T enable);
OPERATE_RET wukong_audio_input_reset(VOID);

#endif
