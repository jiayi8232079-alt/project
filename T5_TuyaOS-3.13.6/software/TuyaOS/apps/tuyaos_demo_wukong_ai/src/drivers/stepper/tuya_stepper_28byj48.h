/**
 * @file tuya_stepper_28byj48.h
 * @brief 28BYJ48 + ULN2003 四相半步驱动（产品板 CN16/M0、CN17/M1）
 */
#ifndef TUYA_STEPPER_28BYJ48_H
#define TUYA_STEPPER_28BYJ48_H

#include "tuya_cloud_types.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
    STEPPER_M0 = 0,
    STEPPER_M1 = 1,
    STEPPER_MOTOR_MAX,
} stepper_motor_id_t;

typedef struct {
    TUYA_GPIO_NUM_E pin_a;
    TUYA_GPIO_NUM_E pin_b;
    TUYA_GPIO_NUM_E pin_c;
    TUYA_GPIO_NUM_E pin_d;
    UINT32_T step_delay_ms;
    UINT8_T step_delay_half_ms; /**< 额外 0.5ms，与 step_delay_ms 合计为换相周期 */
} stepper_28byj48_cfg_t;

/** 产品板默认引脚（见 Docs/产品板软硬件接口需求表 §5.8） */
extern const stepper_28byj48_cfg_t g_stepper_m0_product_cfg;
extern const stepper_28byj48_cfg_t g_stepper_m1_product_cfg;

OPERATE_RET stepper_28byj48_init(stepper_motor_id_t id, const stepper_28byj48_cfg_t *cfg);
OPERATE_RET stepper_28byj48_rotate(stepper_motor_id_t id, INT32_T steps);
/** 两路电机同步换相旋转（正=一个方向，负=反向）；各自按 cfg 中的换相周期独立调速 */
OPERATE_RET stepper_28byj48_rotate_both(INT32_T steps_m0, INT32_T steps_m1);
/**
 * 与 rotate_both 相同，但 release_coil=FALSE 时保持最后一相励磁不释放，
 * 用于连续插补轨迹，避免段间掉电造成顿挫。
 */
OPERATE_RET stepper_28byj48_rotate_both_ex(INT32_T steps_m0, INT32_T steps_m1, BOOL_T release_coil);
void stepper_28byj48_stop(stepper_motor_id_t id);
void stepper_28byj48_stop_all(void);
OPERATE_RET stepper_28byj48_single_phase(stepper_motor_id_t id, UINT8_T phase_abcd);

#ifdef __cplusplus
}
#endif

#endif /* TUYA_STEPPER_28BYJ48_H */
