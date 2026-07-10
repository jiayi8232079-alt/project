/**
 * @file tuya_stepper_28byj48.c
 * @brief 28BYJ48 半步相序驱动；换相禁止在 mic 回调中调用
 */
#include "tuya_stepper_28byj48.h"
#include "tkl_gpio.h"
#include "tal_system.h"
#include "tal_log.h"

#define STEPPER_HALF_STEPS_PER_REV  4096U
/** 换相周期换算为 0.5ms 单位，便于 M1 等 1.5ms 这类非整毫秒延时 */
#define STEPPER_PERIOD_HALF_MS(cfg) \
    ((UINT32_T)(cfg)->step_delay_ms * 2U + (UINT32_T)(cfg)->step_delay_half_ms)

static const UINT8_T s_half_step[8][4] = {
    {1, 0, 0, 0}, {1, 1, 0, 0}, {0, 1, 0, 0}, {0, 1, 1, 0},
    {0, 0, 1, 0}, {0, 0, 1, 1}, {0, 0, 0, 1}, {1, 0, 0, 1},
};

typedef struct {
    stepper_28byj48_cfg_t cfg;
    INT8_T phase;
    UINT8_T inited;
    volatile UINT8_T run;
} stepper_inst_t;

static stepper_inst_t s_motor[STEPPER_MOTOR_MAX];

/* M0 步数少（30°=342步），放慢节拍与 M1（8192步@1ms）同步：
 * 同步耗时 = 8192ms；M0 delay = 8192/342 ≈ 24ms/步 */
const stepper_28byj48_cfg_t g_stepper_m0_product_cfg = {
    .pin_a = TUYA_GPIO_NUM_22,
    .pin_b = TUYA_GPIO_NUM_23,
    .pin_c = TUYA_GPIO_NUM_24,
    .pin_d = TUYA_GPIO_NUM_25,
    .step_delay_ms = 4,
    .step_delay_half_ms = 0,
};

const stepper_28byj48_cfg_t g_stepper_m1_product_cfg = {
    .pin_a = TUYA_GPIO_NUM_50,
    .pin_b = TUYA_GPIO_NUM_49,
    .pin_c = TUYA_GPIO_NUM_18,
    .pin_d = TUYA_GPIO_NUM_19,
    .step_delay_ms = 1,
    .step_delay_half_ms = 0,
};

static OPERATE_RET __gpio_out_init(TUYA_GPIO_NUM_E pin)
{
    TUYA_GPIO_BASE_CFG_T gpio_cfg = {
        .mode = TUYA_GPIO_PULLDOWN,
        .direct = TUYA_GPIO_OUTPUT,
        .level = TUYA_GPIO_LEVEL_LOW,
    };

    return tkl_gpio_init(pin, &gpio_cfg);
}

static void __apply_phase(const stepper_28byj48_cfg_t *cfg, UINT8_T idx)
{
    const UINT8_T *p = s_half_step[idx & 7U];

    tkl_gpio_write(cfg->pin_a, p[0] ? TUYA_GPIO_LEVEL_HIGH : TUYA_GPIO_LEVEL_LOW);
    tkl_gpio_write(cfg->pin_b, p[1] ? TUYA_GPIO_LEVEL_HIGH : TUYA_GPIO_LEVEL_LOW);
    tkl_gpio_write(cfg->pin_c, p[2] ? TUYA_GPIO_LEVEL_HIGH : TUYA_GPIO_LEVEL_LOW);
    tkl_gpio_write(cfg->pin_d, p[3] ? TUYA_GPIO_LEVEL_HIGH : TUYA_GPIO_LEVEL_LOW);
}

static void __release_coils(const stepper_28byj48_cfg_t *cfg)
{
    tkl_gpio_write(cfg->pin_a, TUYA_GPIO_LEVEL_LOW);
    tkl_gpio_write(cfg->pin_b, TUYA_GPIO_LEVEL_LOW);
    tkl_gpio_write(cfg->pin_c, TUYA_GPIO_LEVEL_LOW);
    tkl_gpio_write(cfg->pin_d, TUYA_GPIO_LEVEL_LOW);
}

OPERATE_RET stepper_28byj48_init(stepper_motor_id_t id, const stepper_28byj48_cfg_t *cfg)
{
    OPERATE_RET rt;

    if (id >= STEPPER_MOTOR_MAX || cfg == NULL) {
        return OPRT_INVALID_PARM;
    }

    rt = __gpio_out_init(cfg->pin_a);
    rt |= __gpio_out_init(cfg->pin_b);
    rt |= __gpio_out_init(cfg->pin_c);
    rt |= __gpio_out_init(cfg->pin_d);
    if (rt != OPRT_OK) {
        TAL_PR_ERR("stepper M%d gpio init fail %d", id, rt);
        return rt;
    }

    s_motor[id].cfg = *cfg;
    s_motor[id].phase = 0;
    s_motor[id].run = 0;
    s_motor[id].inited = 1;
    __release_coils(&s_motor[id].cfg);

    TAL_PR_NOTICE("stepper M%d init A=%d B=%d C=%d D=%d delay=%ums",
                  id, cfg->pin_a, cfg->pin_b, cfg->pin_c, cfg->pin_d, cfg->step_delay_ms);
    return OPRT_OK;
}

OPERATE_RET stepper_28byj48_single_phase(stepper_motor_id_t id, UINT8_T phase_abcd)
{
    stepper_inst_t *inst;

    if (id >= STEPPER_MOTOR_MAX || !s_motor[id].inited) {
        return OPRT_INVALID_PARM;
    }

    inst = &s_motor[id];
    tkl_gpio_write(inst->cfg.pin_a, (phase_abcd & 0x01U) ? TUYA_GPIO_LEVEL_HIGH : TUYA_GPIO_LEVEL_LOW);
    tkl_gpio_write(inst->cfg.pin_b, (phase_abcd & 0x02U) ? TUYA_GPIO_LEVEL_HIGH : TUYA_GPIO_LEVEL_LOW);
    tkl_gpio_write(inst->cfg.pin_c, (phase_abcd & 0x04U) ? TUYA_GPIO_LEVEL_HIGH : TUYA_GPIO_LEVEL_LOW);
    tkl_gpio_write(inst->cfg.pin_d, (phase_abcd & 0x08U) ? TUYA_GPIO_LEVEL_HIGH : TUYA_GPIO_LEVEL_LOW);
    return OPRT_OK;
}

void stepper_28byj48_stop(stepper_motor_id_t id)
{
    if (id >= STEPPER_MOTOR_MAX || !s_motor[id].inited) {
        return;
    }

    s_motor[id].run = 0;
    __release_coils(&s_motor[id].cfg);
}

void stepper_28byj48_stop_all(void)
{
    UINT8_T i;

    for (i = 0; i < STEPPER_MOTOR_MAX; i++) {
        stepper_28byj48_stop((stepper_motor_id_t)i);
    }
}

OPERATE_RET stepper_28byj48_rotate(stepper_motor_id_t id, INT32_T steps)
{
    stepper_inst_t *inst;
    INT8_T dir;
    UINT32_T count;

    if (id >= STEPPER_MOTOR_MAX || !s_motor[id].inited || steps == 0) {
        return OPRT_INVALID_PARM;
    }

    inst = &s_motor[id];
    dir = (steps > 0) ? 1 : -1;
    count = (steps > 0) ? (UINT32_T)steps : (UINT32_T)(-steps);

    inst->run = 1;
    while (count-- > 0U && inst->run) {
        UINT32_T rem = 0;
        UINT32_T period = STEPPER_PERIOD_HALF_MS(&inst->cfg);

        if (period == 0U) {
            period = 2U;
        }

        inst->phase = (INT8_T)((inst->phase + dir + 8) % 8);
        __apply_phase(&inst->cfg, (UINT8_T)inst->phase);
        while (rem < period) {
            tal_system_sleep(1);
            rem += 2U;
        }
    }

    stepper_28byj48_stop(id);
    return OPRT_OK;
}

OPERATE_RET stepper_28byj48_rotate_both_ex(INT32_T steps_m0, INT32_T steps_m1, BOOL_T release_coil)
{
    stepper_inst_t *m0 = &s_motor[STEPPER_M0];
    stepper_inst_t *m1 = &s_motor[STEPPER_M1];
    INT8_T dir0, dir1;
    UINT32_T n0, n1, i0, i1;
    UINT32_T rem0 = 0, rem1 = 0;
    UINT32_T period0, period1;

    if (!m0->inited || !m1->inited) {
        return OPRT_INVALID_PARM;
    }

    dir0 = (steps_m0 >= 0) ? 1 : -1;
    dir1 = (steps_m1 >= 0) ? 1 : -1;
    n0 = (steps_m0 >= 0) ? (UINT32_T)steps_m0 : (UINT32_T)(-steps_m0);
    n1 = (steps_m1 >= 0) ? (UINT32_T)steps_m1 : (UINT32_T)(-steps_m1);
    period0 = STEPPER_PERIOD_HALF_MS(&m0->cfg);
    period1 = STEPPER_PERIOD_HALF_MS(&m1->cfg);
    if (period0 == 0U) {
        period0 = 2U;
    }
    if (period1 == 0U) {
        period1 = 2U;
    }

    m0->run = 1;
    m1->run = 1;
    i0 = 0;
    i1 = 0;
    while ((i0 < n0 || i1 < n1) && (m0->run || m1->run)) {
        rem0 += 2U;
        rem1 += 2U;
        if (i0 < n0 && rem0 >= period0) {
            rem0 -= period0;
            m0->phase = (INT8_T)((m0->phase + dir0 + 8) % 8);
            __apply_phase(&m0->cfg, (UINT8_T)m0->phase);
            i0++;
        }
        if (i1 < n1 && rem1 >= period1) {
            rem1 -= period1;
            m1->phase = (INT8_T)((m1->phase + dir1 + 8) % 8);
            __apply_phase(&m1->cfg, (UINT8_T)m1->phase);
            i1++;
        }
        tal_system_sleep(1);
    }

    if (release_coil) {
        stepper_28byj48_stop(STEPPER_M0);
        stepper_28byj48_stop(STEPPER_M1);
    }
    return OPRT_OK;
}

OPERATE_RET stepper_28byj48_rotate_both(INT32_T steps_m0, INT32_T steps_m1)
{
    return stepper_28byj48_rotate_both_ex(steps_m0, steps_m1, TRUE);
}
