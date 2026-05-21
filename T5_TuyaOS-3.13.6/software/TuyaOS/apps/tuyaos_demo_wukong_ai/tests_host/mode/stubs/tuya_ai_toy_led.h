#ifndef __TUYA_AI_TOY_LED_H__
#define __TUYA_AI_TOY_LED_H__

#include "tuya_cloud_types.h"

OPERATE_RET tuya_ai_toy_led_off(VOID);
OPERATE_RET tuya_ai_toy_led_on(VOID);
OPERATE_RET tuya_ai_toy_led_flash(UINT_T interval_ms);

#endif
