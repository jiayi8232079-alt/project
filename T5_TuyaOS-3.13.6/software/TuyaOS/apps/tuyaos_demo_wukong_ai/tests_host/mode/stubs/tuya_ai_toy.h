#ifndef __TUYA_AI_TOY_H__
#define __TUYA_AI_TOY_H__

#include "tuya_cloud_types.h"

OPERATE_RET tuya_ai_toy_idle_timer_ctrl(BOOL_T enable);
OPERATE_RET tuya_ai_toy_lowpower_timer_ctrl(BOOL_T enable);
OPERATE_RET tuya_ai_output_stop(BOOL_T force);

#endif
