#ifndef __WUKONG_AUDIO_AEC_VAD_H__
#define __WUKONG_AUDIO_AEC_VAD_H__

#include "tuya_cloud_types.h"

typedef enum {
    WUKONG_AUDIO_VAD_STOP = 0,
    WUKONG_AUDIO_VAD_START = 1,
} WUKONG_AUDIO_VAD_FLAG_E;

typedef enum {
    WUKONG_AUDIO_VAD_LOW = 0,
    WUKONG_AUDIO_VAD_MID = 1,
} WUKONG_AUDIO_VAD_THRESHOLD_E;

WUKONG_AUDIO_VAD_FLAG_E wukong_vad_get_flag(VOID);
OPERATE_RET wukong_vad_set_threshold(WUKONG_AUDIO_VAD_THRESHOLD_E level);

#endif
