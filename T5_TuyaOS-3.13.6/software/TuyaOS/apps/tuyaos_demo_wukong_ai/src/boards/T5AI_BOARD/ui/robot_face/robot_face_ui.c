/**
 * @file robot_face_ui.c
 * @brief LVGL v8 机器人脸部表情动画
 *
 * 适用屏幕：HXR0336N011（ST7789，横屏 320×240，RGB565）
 *
 * 功能：
 *  - 黑色背景 + 圆角矩形机器人头部轮廓
 *  - 双眼：白色圆形 + 深色瞳孔；自动眨眼动画（每 4s）；瞳孔微动（每 2s）
 *  - 嘴巴：lv_arc 装饰弧；每 3s 在微笑和平嘴间平滑过渡
 *  - 响应 TY_DISPLAY_TP_EMOJI 消息：happy/laughing/sad/thinking/其他
 *
 * 线程安全：
 *  所有 LVGL 对象操作均须在 LVGL 任务（lv_timer_handler 所在线程）上下文内调用；
 *  app_ui_msg_handler 须由 GUI 主线程或通过 lv_async_call 投递。
 */

#include "tuya_ai_display.h"
#include "lvgl.h"
#include <string.h>

/* ─────────────────────── 屏幕与布局常量 ─────────────────────── */

#define SCREEN_W    320
#define SCREEN_H    240

/* 机器人头部 */
#define HEAD_W          220
#define HEAD_H          160
#define HEAD_X          ((SCREEN_W - HEAD_W) / 2)   /* = 50  */
#define HEAD_Y          ((SCREEN_H - HEAD_H) / 2)   /* = 40  */
#define HEAD_RADIUS     20
#define HEAD_BORDER_W   3

/* 眼睛（眼白圆形） */
#define EYE_DIAM        30
#define EYE_X_OFFSET    60   /* 眼心距屏幕水平中轴 */
#define EYE_Y           (HEAD_Y + 25)               /* 眼白顶边 y = 65  */
#define LEFT_EYE_X      (HEAD_X + HEAD_W / 2 - EYE_X_OFFSET - EYE_DIAM / 2)  /* = 85  */
#define RIGHT_EYE_X     (HEAD_X + HEAD_W / 2 + EYE_X_OFFSET - EYE_DIAM / 2)  /* = 205 */

/* 瞳孔 */
#define PUPIL_DIAM      12
#define PUPIL_OFFSET    ((EYE_DIAM - PUPIL_DIAM) / 2)  /* 居中时偏移 = 9 */

/* 嘴巴弧（lv_arc 装饰用） */
#define MOUTH_SIZE      80                               /* 弧外接矩形边长 */
#define MOUTH_ARC_X     ((SCREEN_W - MOUTH_SIZE) / 2)   /* = 120 */
#define MOUTH_ARC_Y     (HEAD_Y + 70)                   /* = 110；弧中心 y=150 */
#define MOUTH_ARC_W     4                               /* 弧线宽度（px） */

/* ──────────────── 嘴型角度（LVGL v8 顺时针，0° 在右侧 3点钟） ─────────────── */
/* 微笑：从右(0°)顺时针经过下方(90°)到左(180°) → 下半圆 = 笑脸 */
#define ANG_SMILE_S     0
#define ANG_SMILE_E     180
/* 平嘴：较小的下弧段 → 嘴角微提 */
#define ANG_NEUTRAL_S   60
#define ANG_NEUTRAL_E   120
/* 皱眉：从左(180°)经过上方(270°)到右(360°) → 上半圆 = 哭脸 */
#define ANG_FROWN_S     180
#define ANG_FROWN_E     360

/* ─────────────────────── 表情枚举 ─────────────────────── */
typedef enum {
    EXPR_NEUTRAL = 0,
    EXPR_HAPPY,
    EXPR_SAD,
    EXPR_THINKING,
} robot_expr_t;

/* ─────────────────────── 模块静态变量 ─────────────────────── */
static lv_obj_t *s_left_eye    = NULL;
static lv_obj_t *s_right_eye   = NULL;
static lv_obj_t *s_left_pupil  = NULL;
static lv_obj_t *s_right_pupil = NULL;
static lv_obj_t *s_mouth       = NULL;

/* 当前表情与嘴型状态 */
static robot_expr_t s_expr       = EXPR_NEUTRAL;
static uint8_t      s_mouth_smile = 1;   /* 1=微笑，0=平嘴 */

/* 追踪嘴巴当前角度（用于动画起始值，避免跳变） */
static uint16_t s_mouth_cur_start = ANG_SMILE_S;
static uint16_t s_mouth_cur_end   = ANG_SMILE_E;

/* 简单 LFSR 伪随机生成器（固定种子，节省调用 rand() 的依赖） */
static uint16_t s_lfsr = 0xA5C3u;

static uint8_t lfsr_next8(void)
{
    /* 16 位 Fibonacci LFSR，多项式 x^16+x^14+x^13+x^11+1 */
    uint8_t bit = (uint8_t)(((s_lfsr >> 0) ^ (s_lfsr >> 2) ^ (s_lfsr >> 3) ^ (s_lfsr >> 5)) & 1u);
    s_lfsr = (uint16_t)((s_lfsr >> 1) | ((uint16_t)bit << 15));
    return (uint8_t)(s_lfsr & 0xFFu);
}

/* ─────────────────────── LVGL 动画回调 ─────────────────────── */

/* 眨眼：设置眼白高度（通过此 setter 驱动 lv_anim） */
static void blink_anim_cb(void *obj, int32_t val)
{
    lv_obj_set_height((lv_obj_t *)obj, (lv_coord_t)val);
}

/* 嘴巴起始角度动画 setter */
static void mouth_start_anim_cb(void *obj, int32_t val)
{
    lv_arc_set_bg_start_angle((lv_obj_t *)obj, (uint16_t)val);
}

/* 嘴巴终止角度动画 setter */
static void mouth_end_anim_cb(void *obj, int32_t val)
{
    lv_arc_set_bg_end_angle((lv_obj_t *)obj, (uint16_t)val);
}

/* ─────────────────────── 动画辅助函数 ─────────────────────── */

/**
 * 为单个眼白对象启动眨眼动画（高度从 EYE_DIAM→4→EYE_DIAM，每 4s 重复一次）
 * @param eye        眼白 lv_obj_t*
 * @param init_delay 首次触发前的延迟（ms），左右眼错开避免同步感
 */
static void start_blink_anim(lv_obj_t *eye, uint32_t init_delay)
{
    lv_anim_t a;
    lv_anim_init(&a);
    lv_anim_set_var(&a, eye);
    lv_anim_set_exec_cb(&a, blink_anim_cb);
    lv_anim_set_values(&a, (int32_t)EYE_DIAM, (int32_t)4);
    lv_anim_set_time(&a, 150);                        /* 闭眼 150ms */
    lv_anim_set_playback_time(&a, 150);               /* 开眼 150ms */
    lv_anim_set_delay(&a, init_delay);                /* 首次延迟 */
    lv_anim_set_repeat_count(&a, LV_ANIM_REPEAT_INFINITE);
    lv_anim_set_repeat_delay(&a, 3700);               /* 两次眨眼间等待 3700ms */
    lv_anim_start(&a);
}

/**
 * 将嘴巴弧从当前角度平滑过渡到目标角度（400ms）
 * 同时更新 s_mouth_cur_start / s_mouth_cur_end 追踪量
 */
static void animate_mouth_to(uint16_t s_to, uint16_t e_to)
{
    lv_anim_t a;

    lv_anim_init(&a);
    lv_anim_set_var(&a, s_mouth);
    lv_anim_set_exec_cb(&a, mouth_start_anim_cb);
    lv_anim_set_values(&a, (int32_t)s_mouth_cur_start, (int32_t)s_to);
    lv_anim_set_time(&a, 400);
    lv_anim_start(&a);

    lv_anim_init(&a);
    lv_anim_set_var(&a, s_mouth);
    lv_anim_set_exec_cb(&a, mouth_end_anim_cb);
    lv_anim_set_values(&a, (int32_t)s_mouth_cur_end, (int32_t)e_to);
    lv_anim_set_time(&a, 400);
    lv_anim_start(&a);

    /* 更新追踪量，下次动画从此角度出发 */
    s_mouth_cur_start = s_to;
    s_mouth_cur_end   = e_to;
}

/* ─────────────────────── 定时器回调 ─────────────────────── */

/**
 * 瞳孔微动：每 2s 随机偏移 ±4px，模拟眼球转动
 * 偏移用 LFSR 生成，范围 -4~+3px，并夹紧在眼白边界内
 */
static void pupil_move_timer_cb(lv_timer_t *timer)
{
    lv_coord_t dx, dy, px, py;
    (void)timer;

    dx = (lv_coord_t)((int8_t)(lfsr_next8() & 0x07u) - 4);
    dy = (lv_coord_t)((int8_t)(lfsr_next8() & 0x07u) - 4);

    /* 瞳孔位置相对于眼白左上角；夹紧防止越界 */
    px = (lv_coord_t)(PUPIL_OFFSET + dx);
    py = (lv_coord_t)(PUPIL_OFFSET + dy);
    if (px < 0) px = 0;
    if (py < 0) py = 0;
    if (px > (lv_coord_t)(EYE_DIAM - PUPIL_DIAM)) px = (lv_coord_t)(EYE_DIAM - PUPIL_DIAM);
    if (py > (lv_coord_t)(EYE_DIAM - PUPIL_DIAM)) py = (lv_coord_t)(EYE_DIAM - PUPIL_DIAM);

    if (s_left_pupil)  lv_obj_set_pos(s_left_pupil,  px, py);
    if (s_right_pupil) lv_obj_set_pos(s_right_pupil, px, py);
}

/**
 * 嘴型定时切换：每 3s 在"微笑"和"平嘴"之间平滑过渡
 * 仅在 NEUTRAL 表情时生效，避免与显式表情冲突
 */
static void mouth_toggle_timer_cb(lv_timer_t *timer)
{
    (void)timer;
    if (s_expr != EXPR_NEUTRAL) return;

    if (s_mouth_smile) {
        animate_mouth_to(ANG_NEUTRAL_S, ANG_NEUTRAL_E);
    } else {
        animate_mouth_to(ANG_SMILE_S, ANG_SMILE_E);
    }
    s_mouth_smile = (uint8_t)!s_mouth_smile;
}

/* ─────────────────────── LVGL 对象创建辅助 ─────────────────────── */

/**
 * 在指定屏幕坐标创建眼白圆形对象（白色填充，clip_corner 开启）
 */
static lv_obj_t *create_eye_white(lv_obj_t *parent, lv_coord_t x, lv_coord_t y)
{
    lv_obj_t *eye = lv_obj_create(parent);
    lv_obj_set_pos(eye, x, y);
    lv_obj_set_size(eye, (lv_coord_t)EYE_DIAM, (lv_coord_t)EYE_DIAM);
    lv_obj_set_style_radius(eye, LV_RADIUS_CIRCLE, LV_PART_MAIN);
    lv_obj_set_style_bg_color(eye, lv_color_white(), LV_PART_MAIN);
    lv_obj_set_style_bg_opa(eye, LV_OPA_COVER, LV_PART_MAIN);
    lv_obj_set_style_border_width(eye, 0, LV_PART_MAIN);
    lv_obj_set_style_pad_all(eye, 0, LV_PART_MAIN);
    /* 关闭滚动，确保子对象（瞳孔）位置完全由 set_pos 控制 */
    lv_obj_clear_flag(eye, LV_OBJ_FLAG_SCROLLABLE);
    return eye;
}

/**
 * 在眼白内创建瞳孔（深蓝色小圆，子对象；眨眼时被父对象剪裁从而消失）
 */
static lv_obj_t *create_pupil(lv_obj_t *eye)
{
    lv_obj_t *pupil = lv_obj_create(eye);
    lv_obj_set_pos(pupil, (lv_coord_t)PUPIL_OFFSET, (lv_coord_t)PUPIL_OFFSET);
    lv_obj_set_size(pupil, (lv_coord_t)PUPIL_DIAM, (lv_coord_t)PUPIL_DIAM);
    lv_obj_set_style_radius(pupil, LV_RADIUS_CIRCLE, LV_PART_MAIN);
    lv_obj_set_style_bg_color(pupil, lv_color_hex(0x1A1A2Eu), LV_PART_MAIN);
    lv_obj_set_style_bg_opa(pupil, LV_OPA_COVER, LV_PART_MAIN);
    lv_obj_set_style_border_width(pupil, 0, LV_PART_MAIN);
    lv_obj_set_style_pad_all(pupil, 0, LV_PART_MAIN);
    lv_obj_clear_flag(pupil, LV_OBJ_FLAG_SCROLLABLE);
    return pupil;
}

/* ─────────────────────── 对外接口 ─────────────────────── */

/**
 * @brief 初始化机器人脸 UI，创建所有 LVGL 对象并启动循环动画
 *        须在 LVGL 初始化完成、display driver 注册后调用（通常由 app_ui_init() 调用）
 */
void robot_face_ui_init(void)
{
    lv_obj_t *scr = lv_scr_act();

    /* ── 背景全黑 ── */
    lv_obj_set_style_bg_color(scr, lv_color_black(), LV_PART_MAIN);
    lv_obj_set_style_bg_opa(scr, LV_OPA_COVER, LV_PART_MAIN);
    lv_obj_clear_flag(scr, LV_OBJ_FLAG_SCROLLABLE);

    /* ── 机器人头部：圆角矩形，仅边框，黑色填充 ── */
    lv_obj_t *head = lv_obj_create(scr);
    lv_obj_set_pos(head, (lv_coord_t)HEAD_X, (lv_coord_t)HEAD_Y);
    lv_obj_set_size(head, (lv_coord_t)HEAD_W, (lv_coord_t)HEAD_H);
    lv_obj_set_style_radius(head, HEAD_RADIUS, LV_PART_MAIN);
    lv_obj_set_style_bg_color(head, lv_color_black(), LV_PART_MAIN);
    lv_obj_set_style_bg_opa(head, LV_OPA_COVER, LV_PART_MAIN);
    lv_obj_set_style_border_color(head, lv_color_hex(0xA0A0A0u), LV_PART_MAIN);
    lv_obj_set_style_border_width(head, HEAD_BORDER_W, LV_PART_MAIN);
    lv_obj_set_style_border_opa(head, LV_OPA_COVER, LV_PART_MAIN);
    lv_obj_set_style_pad_all(head, 0, LV_PART_MAIN);
    lv_obj_clear_flag(head, LV_OBJ_FLAG_SCROLLABLE);

    /* ── 眼睛（挂在 scr 上，方便独立控制高度而不受 head 布局影响） ── */
    s_left_eye  = create_eye_white(scr, (lv_coord_t)LEFT_EYE_X,  (lv_coord_t)EYE_Y);
    s_right_eye = create_eye_white(scr, (lv_coord_t)RIGHT_EYE_X, (lv_coord_t)EYE_Y);

    /* ── 瞳孔（挂在眼白内；眨眼时被父对象剪裁） ── */
    s_left_pupil  = create_pupil(s_left_eye);
    s_right_pupil = create_pupil(s_right_eye);

    /* ── 嘴巴弧（纯装饰，背景透明，隐藏指示器和旋钮） ── */
    s_mouth = lv_arc_create(scr);
    lv_obj_set_pos(s_mouth, (lv_coord_t)MOUTH_ARC_X, (lv_coord_t)MOUTH_ARC_Y);
    lv_obj_set_size(s_mouth, (lv_coord_t)MOUTH_SIZE, (lv_coord_t)MOUTH_SIZE);
    lv_obj_set_style_pad_all(s_mouth, 0, LV_PART_MAIN);

    /* 初始化弧值范围，使指示器弧长为 0 */
    lv_arc_set_mode(s_mouth, LV_ARC_MODE_NORMAL);
    lv_arc_set_range(s_mouth, 0, 100);
    lv_arc_set_value(s_mouth, 0);

    /* 设置背景弧（作为嘴巴形状）角度为微笑 */
    lv_arc_set_bg_angles(s_mouth, ANG_SMILE_S, ANG_SMILE_E);

    /* 背景弧（MAIN）：白色线条 */
    lv_obj_set_style_arc_color(s_mouth, lv_color_white(), LV_PART_MAIN);
    lv_obj_set_style_arc_width(s_mouth, MOUTH_ARC_W, LV_PART_MAIN);
    lv_obj_set_style_arc_opa(s_mouth, LV_OPA_COVER, LV_PART_MAIN);
    /* 背景填充透明，无边框 */
    lv_obj_set_style_bg_opa(s_mouth, LV_OPA_0, LV_PART_MAIN);
    lv_obj_set_style_border_width(s_mouth, 0, LV_PART_MAIN);

    /* 指示器弧（INDICATOR）：完全隐藏 */
    lv_obj_set_style_arc_opa(s_mouth, LV_OPA_0, LV_PART_INDICATOR);
    lv_obj_set_style_arc_width(s_mouth, 0, LV_PART_INDICATOR);

    /* 旋钮（KNOB）：完全隐藏 */
    lv_obj_set_style_bg_opa(s_mouth, LV_OPA_0, LV_PART_KNOB);
    lv_obj_set_style_border_width(s_mouth, 0, LV_PART_KNOB);
    lv_obj_set_style_pad_all(s_mouth, 0, LV_PART_KNOB);

    /* 禁止触摸交互（纯视觉） */
    lv_obj_clear_flag(s_mouth, LV_OBJ_FLAG_CLICKABLE);

    /* ── 启动循环动画 ── */

    /* 眨眼：左右眼错开 200ms，避免同步看起来机械 */
    start_blink_anim(s_left_eye,  500);
    start_blink_anim(s_right_eye, 700);

    /* 瞳孔微动：每 2000ms 随机偏移 */
    lv_timer_create(pupil_move_timer_cb, 2000, NULL);

    /* 嘴型切换：每 3000ms 微笑↔平嘴 */
    lv_timer_create(mouth_toggle_timer_cb, 3000, NULL);
}

/**
 * @brief 响应 AI 表情消息，更新机器人脸部表情
 * @param msg  TY_DISPLAY_MSG_T*，type == TY_DISPLAY_TP_EMOJI 时处理
 *
 * 支持的 data 字符串（msg->data）：
 *  "happy" / "laughing" → 大笑：眼睛眯成 6px 细缝，嘴保持微笑
 *  "sad"               → 悲伤：嘴角向下弧（皱眉），眼睛正常
 *  "thinking"          → 思考：左眼半闭 10px，右眼正常眨眼，嘴平
 *  其余 / NULL          → 恢复 neutral：眼睛正常大小 + 重启眨眼
 */
void robot_face_ui_msg_handler(TY_DISPLAY_MSG_T *msg)
{
    robot_expr_t new_expr;
    const char  *emoji;

    if (NULL == msg) return;
    if (msg->type != TY_DISPLAY_TP_EMOJI) return;
    if (NULL == msg->data) return;

    emoji = (const char *)msg->data;

    if (strcmp(emoji, "happy") == 0 || strcmp(emoji, "laughing") == 0) {
        new_expr = EXPR_HAPPY;
    } else if (strcmp(emoji, "sad") == 0) {
        new_expr = EXPR_SAD;
    } else if (strcmp(emoji, "thinking") == 0) {
        new_expr = EXPR_THINKING;
    } else {
        new_expr = EXPR_NEUTRAL;
    }

    if (new_expr == s_expr) return;
    s_expr = new_expr;

    switch (new_expr) {

    case EXPR_HAPPY:
        /* 大笑：停止眨眼动画，双眼压成 6px 细缝（瞳孔被剪裁不可见） */
        lv_anim_del(s_left_eye,  blink_anim_cb);
        lv_anim_del(s_right_eye, blink_anim_cb);
        if (s_left_eye)  lv_obj_set_height(s_left_eye,  (lv_coord_t)6);
        if (s_right_eye) lv_obj_set_height(s_right_eye, (lv_coord_t)6);
        /* 嘴型确保处于微笑状态 */
        animate_mouth_to(ANG_SMILE_S, ANG_SMILE_E);
        s_mouth_smile = 1;
        break;

    case EXPR_SAD:
        /* 悲伤：嘴巴翻转为上弧（皱眉），眼睛恢复正常 */
        lv_anim_del(s_left_eye,  blink_anim_cb);
        lv_anim_del(s_right_eye, blink_anim_cb);
        if (s_left_eye)  lv_obj_set_height(s_left_eye,  (lv_coord_t)EYE_DIAM);
        if (s_right_eye) lv_obj_set_height(s_right_eye, (lv_coord_t)EYE_DIAM);
        /* 重新启动眨眼（情绪状态下继续自然眨眼） */
        start_blink_anim(s_left_eye,  300);
        start_blink_anim(s_right_eye, 500);
        animate_mouth_to(ANG_FROWN_S, ANG_FROWN_E);
        s_mouth_smile = 0;
        break;

    case EXPR_THINKING:
        /* 思考：左眼半闭（h=10，停止眨眼），右眼继续眨眼；嘴角平 */
        lv_anim_del(s_left_eye,  blink_anim_cb);
        if (s_left_eye) lv_obj_set_height(s_left_eye, (lv_coord_t)10);
        /* 右眼重启眨眼（如之前被停止） */
        lv_anim_del(s_right_eye, blink_anim_cb);
        if (s_right_eye) lv_obj_set_height(s_right_eye, (lv_coord_t)EYE_DIAM);
        start_blink_anim(s_right_eye, 200);
        animate_mouth_to(ANG_NEUTRAL_S, ANG_NEUTRAL_E);
        s_mouth_smile = 0;
        break;

    default: /* EXPR_NEUTRAL */
        /* 恢复：双眼恢复全高度并重启眨眼，嘴型恢复微笑 */
        lv_anim_del(s_left_eye,  blink_anim_cb);
        lv_anim_del(s_right_eye, blink_anim_cb);
        if (s_left_eye)  lv_obj_set_height(s_left_eye,  (lv_coord_t)EYE_DIAM);
        if (s_right_eye) lv_obj_set_height(s_right_eye, (lv_coord_t)EYE_DIAM);
        start_blink_anim(s_left_eye,  500);
        start_blink_anim(s_right_eye, 700);
        animate_mouth_to(ANG_SMILE_S, ANG_SMILE_E);
        s_mouth_smile = 1;
        break;
    }
}
