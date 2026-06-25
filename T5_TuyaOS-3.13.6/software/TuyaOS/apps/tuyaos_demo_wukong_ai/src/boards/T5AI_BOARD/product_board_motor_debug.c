/**
 * @file product_board_motor_debug.c
 * @brief 产品板 M0/M1 步进电机联调
 *   - CN16/M0 左右：往复旋转，与上下轴同时正向、同时反向
 *   - CN17/M1 上下：往复旋转，正向 4 整圈 → 反向 4 整圈循环
 */
#include "tuya_app_config.h"

#if defined(PRODUCT_BOARD_MOTOR_DEBUG) && (PRODUCT_BOARD_MOTOR_DEBUG == 1)

#include "product_board_motor_debug.h"
#include "tuya_stepper_28byj48.h"
#include "tal_log.h"
#include "tal_thread.h"
#include "tal_system.h"

/* 半步模式一整圈 4096 步；角度→步数 = (4096*deg+180)/360 */
#define MOTOR_DEMO_STEPS_PER_REV   4096U
#define MOTOR_DEMO_DEG_TO_STEPS(deg) \
    ((MOTOR_DEMO_STEPS_PER_REV * (UINT32_T)(deg) + 180U) / 360U)

/* CN16/M0 左右：每方向 30° */
#define MOTOR_DEMO_LR_HALF_STEPS   MOTOR_DEMO_DEG_TO_STEPS(30)

/* CN17/M1 上下：每方向 2 整圈 */
#define MOTOR_DEMO_UD_HALF_STEPS   (MOTOR_DEMO_STEPS_PER_REV * 2U)

static void __motor_debug_thread(void *arg)
{
    OPERATE_RET rt_m0;
    OPERATE_RET rt_m1;
    UINT32_T loop = 0;

    (void)arg;

    tal_system_sleep(2000);

    rt_m0 = stepper_28byj48_init(STEPPER_M0, &g_stepper_m0_product_cfg);
    rt_m1 = stepper_28byj48_init(STEPPER_M1, &g_stepper_m1_product_cfg);
    if (rt_m0 != OPRT_OK || rt_m1 != OPRT_OK) {
        TAL_PR_ERR("motor demo: init fail M0=%d M1=%d", rt_m0, rt_m1);
        return;
    }

    TAL_PR_NOTICE("motor demo: LR ±30deg(%u steps) UD ±2rev(%u steps)",
                  MOTOR_DEMO_LR_HALF_STEPS, MOTOR_DEMO_UD_HALF_STEPS);

    while (1) {
        /* 两轴同时正向：M0 转 30°，M1 转 2 圈；M0 先到位保持，M1 结束后两轴同时反向 */
        TAL_PR_NOTICE("motor demo: [%u] fwd", loop);
        stepper_28byj48_rotate_both_ex(
            (INT32_T)MOTOR_DEMO_LR_HALF_STEPS,
            (INT32_T)MOTOR_DEMO_UD_HALF_STEPS,
            FALSE);

        /* 两轴同时反向 */
        TAL_PR_NOTICE("motor demo: [%u] rev", loop);
        stepper_28byj48_rotate_both_ex(
            -(INT32_T)MOTOR_DEMO_LR_HALF_STEPS,
            -(INT32_T)MOTOR_DEMO_UD_HALF_STEPS,
            FALSE);

        loop++;
    }
}

void product_board_motor_debug_start(void)
{
    THREAD_CFG_T thrd = {
        /* 低于音频/KWS 线程，避免长时间占 CPU 影响语音 */
        .priority = THREAD_PRIO_3,
        .stackDepth = 4096,
        .thrdname = "motor_dbg",
    };
    THREAD_HANDLE handle = NULL;

    if (tal_thread_create_and_start(&handle, NULL, NULL, __motor_debug_thread, NULL, &thrd) != OPRT_OK) {
        TAL_PR_ERR("motor dbg: thread create fail");
    }
}

#endif /* PRODUCT_BOARD_MOTOR_DEBUG */
