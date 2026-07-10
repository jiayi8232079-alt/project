#include "person_tracker.h"
#include "tuya_app_config.h"

#if defined(ENABLE_TUYA_CAMERA) && (ENABLE_TUYA_CAMERA == 1)

#include "tal_log.h"
#include "tal_mutex.h"
#include "tal_system.h"
#include "tal_thread.h"
#include "tuya_device_camera.h"
#include "tuya_stepper_28byj48.h"

#define TRACKER_THREAD_STACK        4096
#define TRACKER_THREAD_PERIOD_MS    80
#define TRACKER_TARGET_TIMEOUT_MS   1200
#define TRACKER_DEADZONE_PCT        6
#define TRACKER_MIN_STEP            8
#define TRACKER_MAX_STEP_M0         96
#define TRACKER_MAX_STEP_M1         160
#define TRACKER_M0_LIMIT_STEPS      1024
#define TRACKER_M1_LIMIT_STEPS      1024
#define TRACKER_HOME_M0             0
#define TRACKER_HOME_M1             (-96)
#define DETECTOR_SAMPLE_STRIDE      3
#define DETECTOR_MIN_SKIN_PIXELS    20
#define DETECTOR_MIN_BBOX_DIV       28
#define TRACKER_LOG_INTERVAL_MS     5000

typedef struct {
    THREAD_HANDLE           thread;
    MUTEX_HANDLE            mutex;
    BOOL_T                  running;
    BOOL_T                  motors_ready;
    BOOL_T                  homing_done;
    INT32_T                 pos_m0;
    INT32_T                 pos_m1;
    person_tracker_target_t target;
    UINT32_T                target_tick_ms;
    UINT32_T                frame_count;
    UINT32_T                last_log_ms;
} person_tracker_ctx_t;

static person_tracker_ctx_t s_tracker = {0};

static INT32_T __abs_i32(INT32_T v)
{
    return (v < 0) ? -v : v;
}

static INT32_T __clamp_i32(INT32_T v, INT32_T min_v, INT32_T max_v)
{
    if (v < min_v) {
        return min_v;
    }
    if (v > max_v) {
        return max_v;
    }
    return v;
}

static INT32_T __axis_error_to_steps(INT32_T err, UINT16_T span, INT32_T max_step)
{
    INT32_T deadzone;
    INT32_T steps;

    if (span == 0) {
        return 0;
    }

    deadzone = ((INT32_T)span * TRACKER_DEADZONE_PCT) / 100;
    if (__abs_i32(err) <= deadzone) {
        return 0;
    }

    steps = (err * max_step) / ((INT32_T)span / 2);
    if (steps == 0) {
        steps = (err > 0) ? TRACKER_MIN_STEP : -TRACKER_MIN_STEP;
    }
    if (steps > 0 && steps < TRACKER_MIN_STEP) {
        steps = TRACKER_MIN_STEP;
    } else if (steps < 0 && steps > -TRACKER_MIN_STEP) {
        steps = -TRACKER_MIN_STEP;
    }

    return __clamp_i32(steps, -max_step, max_step);
}

static INT32_T __limit_axis_steps(INT32_T current_pos, INT32_T steps, INT32_T limit)
{
    INT32_T next_pos = current_pos + steps;

    if (next_pos > limit) {
        return limit - current_pos;
    }
    if (next_pos < -limit) {
        return -limit - current_pos;
    }
    return steps;
}

static BOOL_T __is_skin_yuv(UINT8_T y, UINT8_T u, UINT8_T v)
{
    return (y >= 40U && u >= 70U && u <= 145U && v >= 125U && v <= 190U);
}

static void __boot_homing(void)
{
    INT32_T pan_back;
    INT32_T tilt_back;

    if (!s_tracker.motors_ready) {
        return;
    }

    pan_back = -s_tracker.pos_m0;
    tilt_back = -s_tracker.pos_m1;
    if (pan_back != 0 || tilt_back != 0) {
        stepper_28byj48_rotate_both_ex(pan_back, tilt_back, TRUE);
    }

    s_tracker.pos_m0 = 0;
    s_tracker.pos_m1 = 0;

    stepper_28byj48_rotate_both_ex(TRACKER_HOME_M0, TRACKER_HOME_M1, TRUE);
    s_tracker.pos_m0 = TRACKER_HOME_M0;
    s_tracker.pos_m1 = TRACKER_HOME_M1;
    s_tracker.homing_done = TRUE;
    TAL_PR_NOTICE("person tracker: boot homing -> M0=%d M1=%d",
                  s_tracker.pos_m0, s_tracker.pos_m1);
}

static void __publish_no_target(UINT16_T frame_w, UINT16_T frame_h)
{
    person_tracker_target_t target = {
        .valid   = FALSE,
        .frame_w = frame_w,
        .frame_h = frame_h,
    };

    person_tracker_update_target(&target);
}

static void __detect_skin_target(TAL_CAMERA_FRAME_T *frame)
{
    UINT32_T x;
    UINT32_T y;
    UINT32_T skin_count = 0;
    UINT32_T sum_x = 0;
    UINT32_T sum_y = 0;
    UINT16_T min_x;
    UINT16_T min_y;
    UINT16_T max_x = 0;
    UINT16_T max_y = 0;
    UINT32_T min_len;
    UINT32_T bbox_w;
    UINT32_T bbox_h;
    person_tracker_target_t target = {0};

    if (!frame || !frame->data || frame->width == 0 || frame->height == 0) {
        return;
    }

    min_len = (UINT32_T)frame->width * (UINT32_T)frame->height * 2U;
    if (frame->fmt != TUYA_FRAME_FMT_YUV422 || frame->length < min_len) {
        return;
    }

    min_x = frame->width;
    min_y = frame->height;

    for (y = 0; y < frame->height; y += DETECTOR_SAMPLE_STRIDE) {
        UINT8_T *row = frame->data + ((UINT32_T)frame->width * 2U * y);

        for (x = 0; (x + 1U) < frame->width; x += DETECTOR_SAMPLE_STRIDE) {
            UINT32_T idx = x * 2U;
            UINT8_T y0 = row[idx + 0U];
            UINT8_T u0 = row[idx + 1U];
            UINT8_T y1 = row[idx + 2U];
            UINT8_T v0 = row[idx + 3U];

            if (__is_skin_yuv(y0, u0, v0) || __is_skin_yuv(y1, u0, v0)) {
                skin_count++;
                sum_x += x;
                sum_y += y;
                if (x < min_x) {
                    min_x = (UINT16_T)x;
                }
                if (y < min_y) {
                    min_y = (UINT16_T)y;
                }
                if (x > max_x) {
                    max_x = (UINT16_T)x;
                }
                if (y > max_y) {
                    max_y = (UINT16_T)y;
                }
            }
        }
    }

    if (skin_count < DETECTOR_MIN_SKIN_PIXELS) {
        __publish_no_target(frame->width, frame->height);
        return;
    }

    bbox_w = (UINT32_T)max_x - (UINT32_T)min_x + 1U;
    bbox_h = (UINT32_T)max_y - (UINT32_T)min_y + 1U;
    if (bbox_w < ((UINT32_T)frame->width / DETECTOR_MIN_BBOX_DIV) ||
        bbox_h < ((UINT32_T)frame->height / DETECTOR_MIN_BBOX_DIV)) {
        __publish_no_target(frame->width, frame->height);
        return;
    }

    target.valid = TRUE;
    target.center_x = (UINT16_T)(sum_x / skin_count);
    target.center_y = (UINT16_T)(sum_y / skin_count);
    target.frame_w = frame->width;
    target.frame_h = frame->height;
    target.confidence = (skin_count > 100U) ? 100U : (UINT8_T)skin_count;
    person_tracker_update_target(&target);
}

static BOOL_T __copy_fresh_target(person_tracker_target_t *out)
{
    UINT32_T now;
    BOOL_T fresh = FALSE;

    tal_mutex_lock(s_tracker.mutex);
    now = tal_system_get_millisecond();
    if (s_tracker.target.valid &&
        ((now - s_tracker.target_tick_ms) <= TRACKER_TARGET_TIMEOUT_MS)) {
        *out = s_tracker.target;
        fresh = TRUE;
    }
    tal_mutex_unlock(s_tracker.mutex);

    return fresh;
}

static void __tracker_thread(void *arg)
{
    (void)arg;

    tal_system_sleep(800);
    __boot_homing();

    while (s_tracker.running) {
        person_tracker_target_t target = {0};
        INT32_T pan_steps;
        INT32_T tilt_steps;

        if (!s_tracker.motors_ready || !__copy_fresh_target(&target)) {
            stepper_28byj48_stop_all();
            tal_system_sleep(TRACKER_THREAD_PERIOD_MS);
            continue;
        }

        pan_steps = __axis_error_to_steps(
            (INT32_T)target.center_x - ((INT32_T)target.frame_w / 2),
            target.frame_w,
            TRACKER_MAX_STEP_M0);
        tilt_steps = __axis_error_to_steps(
            (INT32_T)target.center_y - ((INT32_T)target.frame_h / 2),
            target.frame_h,
            TRACKER_MAX_STEP_M1);
        pan_steps = __limit_axis_steps(s_tracker.pos_m0, pan_steps, TRACKER_M0_LIMIT_STEPS);
        tilt_steps = __limit_axis_steps(s_tracker.pos_m1, tilt_steps, TRACKER_M1_LIMIT_STEPS);

        if (pan_steps != 0 || tilt_steps != 0) {
            if (stepper_28byj48_rotate_both_ex(pan_steps, tilt_steps, TRUE) == OPRT_OK) {
                s_tracker.pos_m0 += pan_steps;
                s_tracker.pos_m1 += tilt_steps;
            }
        } else {
            stepper_28byj48_stop_all();
            tal_system_sleep(TRACKER_THREAD_PERIOD_MS);
        }
    }

    stepper_28byj48_stop_all();
    s_tracker.thread = NULL;
}

OPERATE_RET person_tracker_start(VOID)
{
    OPERATE_RET rt_m0;
    OPERATE_RET rt_m1;
    THREAD_CFG_T thrd = {
        .priority   = THREAD_PRIO_3,
        .stackDepth = TRACKER_THREAD_STACK,
        .thrdname   = "person_trk",
    };

    if (s_tracker.running) {
        return OPRT_OK;
    }

    if (!s_tracker.mutex) {
        if (tal_mutex_create_init(&s_tracker.mutex) != OPRT_OK) {
            TAL_PR_ERR("person tracker: mutex create fail");
            return OPRT_COM_ERROR;
        }
    }

    rt_m0 = stepper_28byj48_init(STEPPER_M0, &g_stepper_m0_product_cfg);
    rt_m1 = stepper_28byj48_init(STEPPER_M1, &g_stepper_m1_product_cfg);
    s_tracker.motors_ready = (rt_m0 == OPRT_OK && rt_m1 == OPRT_OK);
    if (!s_tracker.motors_ready) {
        TAL_PR_ERR("person tracker: motor init fail M0=%d M1=%d", rt_m0, rt_m1);
        return OPRT_COM_ERROR;
    }
    s_tracker.pos_m0 = 0;
    s_tracker.pos_m1 = 0;

    s_tracker.running = TRUE;
    tuya_device_camera_set_tracking_yuv_frame_cb(person_tracker_on_yuv_frame);

    if (tal_thread_create_and_start(&s_tracker.thread, NULL, NULL,
                                    __tracker_thread, NULL, &thrd) != OPRT_OK) {
        s_tracker.running = FALSE;
        tuya_device_camera_set_tracking_yuv_frame_cb(NULL);
        TAL_PR_ERR("person tracker: thread create fail");
        return OPRT_COM_ERROR;
    }

    TAL_PR_NOTICE("person tracker: started, waiting for detector target");
    return OPRT_OK;
}

void person_tracker_stop(VOID)
{
    s_tracker.running = FALSE;
    tuya_device_camera_set_tracking_yuv_frame_cb(NULL);
    stepper_28byj48_stop_all();
}

void person_tracker_update_target(const person_tracker_target_t *target)
{
    if (!target || !s_tracker.mutex) {
        return;
    }

    tal_mutex_lock(s_tracker.mutex);
    s_tracker.target = *target;
    s_tracker.target_tick_ms = tal_system_get_millisecond();
    tal_mutex_unlock(s_tracker.mutex);
}

void person_tracker_on_yuv_frame(TAL_CAMERA_FRAME_T *frame)
{
    UINT32_T now;

    s_tracker.frame_count++;
    now = tal_system_get_millisecond();
    if ((now - s_tracker.last_log_ms) >= TRACKER_LOG_INTERVAL_MS) {
        TAL_PR_NOTICE("person tracker: frames=%u homing=%d target=%d pos M0=%d M1=%d",
                      s_tracker.frame_count,
                      s_tracker.homing_done,
                      s_tracker.target.valid,
                      s_tracker.pos_m0,
                      s_tracker.pos_m1);
        s_tracker.last_log_ms = now;
    }

    __detect_skin_target(frame);
}

#endif /* ENABLE_TUYA_CAMERA */
