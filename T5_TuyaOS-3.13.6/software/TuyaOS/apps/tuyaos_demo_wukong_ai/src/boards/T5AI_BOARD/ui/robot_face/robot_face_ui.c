/**
 * @file robot_face_ui.c
 * @brief LVGL v8 kawaii 机器人脸部表情动画（参考“恋爱/被萌到”风格）
 *
 * 适用屏幕：ST7789V2（横屏 320×240，RGB565）
 *
 * 视觉（全部用 LVGL 图元绘制，零额外二进制资源，避免 FLASH 溢出）：
 *  - 黑色背景
 *  - 双眼：大号“高光眼”——黑色椭圆 + 白色粗描边 + 3 个白色高光圆点（萌系反光）
 *  - 腮红：双颊柔和粉色椭圆
 *  - 嘴巴：lv_arc 装饰弧，温柔微笑
 *  - 爱心：右上角 lv_canvas 绘制两颗粉色爱心（仅“恋爱”情绪显示）
 *
 * 动画（=动图效果）：
 *  - 眨眼：眼白高度周期性压扁（左右错开）
 *  - 高光闪烁：大高光点透明度缓慢呼吸
 *  - 呼吸：双眼整体轻微上下浮动
 *  - 爱心上浮：恋爱情绪下爱心循环上浮 + 淡出
 *
 * 表情（响应 TY_DISPLAY_TP_EMOJI 的 data 字符串）：
 *  - loving / love / lovestruck → 恋爱：显爱心 + 腮红加深 + 微笑
 *  - happy / laughing          → 开心：眼睛弯成细缝（^^）+ 大微笑
 *  - sad                       → 悲伤：嘴角下弯 + 高光下移
 *  - thinking                  → 思考：左眼半闭
 *  - 其它 / NULL               → neutral：常态萌脸
 *
 * 线程安全：
 *  所有 LVGL 对象操作均须在 LVGL 任务（lv_timer_handler 所在线程）上下文内调用；
 *  app_ui_msg_handler 须由 GUI 主线程或通过 lv_async_call 投递。
 */

#include "tuya_ai_display.h"
#include "lvgl.h"
#include <string.h>

/* ─────────────────────── 屏幕与布局常量 ─────────────────────── */

#define SCREEN_W        320
#define SCREEN_H        240

/* 眼睛（高光眼椭圆） */
#define EYE_W           82
#define EYE_H           94
#define EYE_RADIUS      42                 /* 接近胶囊/椭圆 */
#define EYE_BORDER_W    6                  /* 白色描边宽度 */
#define EYE_GAP         56                 /* 两眼内缘间距 */
#define EYES_BLOCK_W    (EYE_W * 2 + EYE_GAP)
#define LEFT_EYE_X      ((SCREEN_W - EYES_BLOCK_W) / 2)        /* = 50 */
#define RIGHT_EYE_X     (LEFT_EYE_X + EYE_W + EYE_GAP)         /* = 188 */
#define EYE_Y           66
#define EYE_BLINK_MIN   8                  /* 闭眼时眼高 */

/* 高光点（眼内白色反光，子对象坐标相对眼白左上角） */
#define SHINE_BIG_D     28
#define SHINE_BIG_X     12
#define SHINE_BIG_Y     12
#define SHINE_MID_D     13
#define SHINE_MID_X     48
#define SHINE_MID_Y     52
#define SHINE_SML_D     8
#define SHINE_SML_X     22
#define SHINE_SML_Y     64

/* 腮红 */
#define BLUSH_W         46
#define BLUSH_H         20
#define BLUSH_Y         158
#define LEFT_BLUSH_X    24
#define RIGHT_BLUSH_X   (SCREEN_W - LEFT_BLUSH_X - BLUSH_W)    /* = 250 */

/* 嘴巴弧（lv_arc 装饰用） */
#define MOUTH_SIZE      64
#define MOUTH_ARC_X     ((SCREEN_W - MOUTH_SIZE) / 2)          /* = 128 */
#define MOUTH_ARC_Y     150
#define MOUTH_ARC_W     5

/* 嘴型角度（LVGL v8 顺时针，0° 在 3 点钟方向） */
#define ANG_SMILE_S     20      /* 下半弧 → 微笑 */
#define ANG_SMILE_E     160
#define ANG_GRIN_S      0       /* 更大的下弧 → 大笑 */
#define ANG_GRIN_E      180
#define ANG_NEUTRAL_S   55
#define ANG_NEUTRAL_E   125
#define ANG_FROWN_S     200     /* 上半弧 → 难过 */
#define ANG_FROWN_E     340

/* 爱心画布（右上角；LV_IMG_CF_TRUE_COLOR_ALPHA 透明底） */
#define HEART_CV_W      64
#define HEART_CV_H      52
#define HEART_CV_X      (SCREEN_W - HEART_CV_W - 4)            /* = 252 */
#define HEART_CV_Y_BASE 12      /* 上浮动画基准 y */

/* 配色 */
#define COL_BLUSH       lv_color_hex(0xFF7AA8u)
#define COL_HEART       lv_color_hex(0xFF5C8Au)

/* ─────────────────────── 表情枚举 ─────────────────────── */
typedef enum {
    EXPR_NEUTRAL = 0,
    EXPR_LOVING,
    EXPR_HAPPY,
    EXPR_SAD,
    EXPR_THINKING,
} robot_expr_t;

/* ─────────────────────── 模块静态变量 ─────────────────────── */
static lv_obj_t *s_left_eye    = NULL;
static lv_obj_t *s_right_eye   = NULL;
static lv_obj_t *s_left_shine  = NULL;   /* 左眼大高光，用于闪烁动画 */
static lv_obj_t *s_right_shine = NULL;
static lv_obj_t *s_left_blush  = NULL;
static lv_obj_t *s_right_blush = NULL;
static lv_obj_t *s_mouth       = NULL;
static lv_obj_t *s_hearts      = NULL;   /* 爱心画布 */

static robot_expr_t s_expr = EXPR_NEUTRAL;

/* 爱心画布缓冲（.bss，约 64*52*3≈10KB） */
static LV_ATTRIBUTE_MEM_ALIGN uint8_t
    s_heart_cbuf[LV_CANVAS_BUF_SIZE_TRUE_COLOR_ALPHA(HEART_CV_W, HEART_CV_H)];

/* ─────────────────────── LVGL 动画 setter ─────────────────────── */

/* 眨眼：设置眼白高度 */
static void blink_anim_cb(void *obj, int32_t val)
{
    lv_obj_set_height((lv_obj_t *)obj, (lv_coord_t)val);
}

/* 呼吸：整体上下浮动眼白 y */
static void breath_anim_cb(void *obj, int32_t val)
{
    lv_obj_set_y((lv_obj_t *)obj, (lv_coord_t)val);
}

/* 高光闪烁：设置子对象背景透明度 */
static void shine_opa_anim_cb(void *obj, int32_t val)
{
    lv_obj_set_style_bg_opa((lv_obj_t *)obj, (lv_opa_t)val, LV_PART_MAIN);
}

/* 爱心上浮：设置整体 y */
static void heart_y_anim_cb(void *obj, int32_t val)
{
    lv_obj_set_y((lv_obj_t *)obj, (lv_coord_t)val);
}

/* 爱心淡出：设置整体透明度 */
static void heart_opa_anim_cb(void *obj, int32_t val)
{
    lv_obj_set_style_opa((lv_obj_t *)obj, (lv_opa_t)val, 0);
}

/* 嘴巴角度 setter */
static void mouth_start_anim_cb(void *obj, int32_t val)
{
    lv_arc_set_bg_start_angle((lv_obj_t *)obj, (uint16_t)val);
}
static void mouth_end_anim_cb(void *obj, int32_t val)
{
    lv_arc_set_bg_end_angle((lv_obj_t *)obj, (uint16_t)val);
}

/* ─────────────────────── 动画辅助 ─────────────────────── */

/**
 * 启动单眼眨眼循环：眼高 EYE_H↔EYE_BLINK_MIN，约 4s 一次，左右错开
 */
static void start_blink_anim(lv_obj_t *eye, uint32_t init_delay)
{
    lv_anim_t a;
    lv_anim_init(&a);
    lv_anim_set_var(&a, eye);
    lv_anim_set_exec_cb(&a, blink_anim_cb);
    lv_anim_set_values(&a, (int32_t)EYE_H, (int32_t)EYE_BLINK_MIN);
    lv_anim_set_time(&a, 140);
    lv_anim_set_playback_time(&a, 140);
    lv_anim_set_delay(&a, init_delay);
    lv_anim_set_repeat_count(&a, LV_ANIM_REPEAT_INFINITE);
    lv_anim_set_repeat_delay(&a, 3600);
    lv_anim_start(&a);
}

/**
 * 启动眼白呼吸浮动（在基准 y 附近上下 3px，缓慢循环）
 */
static void start_breath_anim(lv_obj_t *eye, uint32_t init_delay)
{
    lv_anim_t a;
    lv_anim_init(&a);
    lv_anim_set_var(&a, eye);
    lv_anim_set_exec_cb(&a, breath_anim_cb);
    lv_anim_set_values(&a, (int32_t)EYE_Y, (int32_t)(EYE_Y + 4));
    lv_anim_set_time(&a, 1400);
    lv_anim_set_playback_time(&a, 1400);
    lv_anim_set_delay(&a, init_delay);
    lv_anim_set_repeat_count(&a, LV_ANIM_REPEAT_INFINITE);
    lv_anim_set_path_cb(&a, lv_anim_path_ease_in_out);
    lv_anim_start(&a);
}

/**
 * 启动高光闪烁（透明度 255↔150 缓慢呼吸）
 */
static void start_shine_anim(lv_obj_t *shine, uint32_t init_delay)
{
    lv_anim_t a;
    lv_anim_init(&a);
    lv_anim_set_var(&a, shine);
    lv_anim_set_exec_cb(&a, shine_opa_anim_cb);
    lv_anim_set_values(&a, 255, 150);
    lv_anim_set_time(&a, 1100);
    lv_anim_set_playback_time(&a, 1100);
    lv_anim_set_delay(&a, init_delay);
    lv_anim_set_repeat_count(&a, LV_ANIM_REPEAT_INFINITE);
    lv_anim_start(&a);
}

/* 平滑切换嘴型到目标角度 */
static void animate_mouth_to(uint16_t s_to, uint16_t e_to)
{
    lv_anim_t a;
    lv_anim_init(&a);
    lv_anim_set_var(&a, s_mouth);
    lv_anim_set_exec_cb(&a, mouth_start_anim_cb);
    lv_anim_set_values(&a, (int32_t)lv_arc_get_bg_angle_start(s_mouth), (int32_t)s_to);
    lv_anim_set_time(&a, 350);
    lv_anim_start(&a);

    lv_anim_init(&a);
    lv_anim_set_var(&a, s_mouth);
    lv_anim_set_exec_cb(&a, mouth_end_anim_cb);
    lv_anim_set_values(&a, (int32_t)lv_arc_get_bg_angle_end(s_mouth), (int32_t)e_to);
    lv_anim_set_time(&a, 350);
    lv_anim_start(&a);
}

/* ─────────────────────── 爱心绘制 ─────────────────────── */

/**
 * 在画布上绘制一颗爱心（两个圆形“凸起” + 一个倒三角“尖角”）
 * @param cx,cy 爱心中心；r 凸起半径；col 填充色
 */
static void draw_one_heart(lv_obj_t *cv, lv_coord_t cx, lv_coord_t cy, lv_coord_t r, lv_color_t col)
{
    lv_draw_rect_dsc_t cd;
    lv_point_t pts[3];

    /* 两个圆形凸起 */
    lv_draw_rect_dsc_init(&cd);
    cd.bg_color = col;
    cd.bg_opa   = LV_OPA_COVER;
    cd.radius   = LV_RADIUS_CIRCLE;
    /* 左凸起：中心 (cx - r/2, cy)，左上角偏移一个半径 */
    lv_canvas_draw_rect(cv, (lv_coord_t)(cx - r - r / 2), (lv_coord_t)(cy - r),
                        (lv_coord_t)(2 * r), (lv_coord_t)(2 * r), &cd);
    /* 右凸起：中心 (cx + r/2, cy) */
    lv_canvas_draw_rect(cv, (lv_coord_t)(cx + r / 2 - r), (lv_coord_t)(cy - r),
                        (lv_coord_t)(2 * r), (lv_coord_t)(2 * r), &cd);

    /* 底部尖角倒三角；顶边与两凸起外缘对齐，尖端向下 */
    lv_draw_rect_dsc_init(&cd);
    cd.bg_color = col;
    cd.bg_opa   = LV_OPA_COVER;
    pts[0].x = (lv_coord_t)(cx - r - r / 2); pts[0].y = (lv_coord_t)cy;
    pts[1].x = (lv_coord_t)(cx + r + r / 2); pts[1].y = (lv_coord_t)cy;
    pts[2].x = (lv_coord_t)cx;               pts[2].y = (lv_coord_t)(cy + (r * 19) / 10);
    lv_canvas_draw_polygon(cv, pts, 3, &cd);
}

/* ─────────────────────── LVGL 对象创建辅助 ─────────────────────── */

/* 创建“高光眼”：黑底 + 白色粗描边的圆角椭圆 */
static lv_obj_t *create_eye(lv_obj_t *parent, lv_coord_t x, lv_coord_t y)
{
    lv_obj_t *eye = lv_obj_create(parent);
    lv_obj_set_pos(eye, x, y);
    lv_obj_set_size(eye, (lv_coord_t)EYE_W, (lv_coord_t)EYE_H);
    lv_obj_set_style_radius(eye, EYE_RADIUS, LV_PART_MAIN);
    lv_obj_set_style_bg_color(eye, lv_color_black(), LV_PART_MAIN);
    lv_obj_set_style_bg_opa(eye, LV_OPA_COVER, LV_PART_MAIN);
    lv_obj_set_style_border_color(eye, lv_color_white(), LV_PART_MAIN);
    lv_obj_set_style_border_width(eye, EYE_BORDER_W, LV_PART_MAIN);
    lv_obj_set_style_border_opa(eye, LV_OPA_COVER, LV_PART_MAIN);
    lv_obj_set_style_pad_all(eye, 0, LV_PART_MAIN);
    /* 关闭滚动，确保子高光点位置完全由 set_pos 控制；闭眼时被父对象裁剪 */
    lv_obj_clear_flag(eye, LV_OBJ_FLAG_SCROLLABLE);
    return eye;
}

/* 在眼内创建一个白色高光圆点 */
static lv_obj_t *create_shine(lv_obj_t *eye, lv_coord_t x, lv_coord_t y, lv_coord_t d)
{
    lv_obj_t *s = lv_obj_create(eye);
    lv_obj_set_pos(s, x, y);
    lv_obj_set_size(s, d, d);
    lv_obj_set_style_radius(s, LV_RADIUS_CIRCLE, LV_PART_MAIN);
    lv_obj_set_style_bg_color(s, lv_color_white(), LV_PART_MAIN);
    lv_obj_set_style_bg_opa(s, LV_OPA_COVER, LV_PART_MAIN);
    lv_obj_set_style_border_width(s, 0, LV_PART_MAIN);
    lv_obj_set_style_pad_all(s, 0, LV_PART_MAIN);
    lv_obj_clear_flag(s, LV_OBJ_FLAG_SCROLLABLE);
    return s;
}

/* 创建一团腮红（柔和粉色椭圆） */
static lv_obj_t *create_blush(lv_obj_t *parent, lv_coord_t x, lv_coord_t y)
{
    lv_obj_t *b = lv_obj_create(parent);
    lv_obj_set_pos(b, x, y);
    lv_obj_set_size(b, (lv_coord_t)BLUSH_W, (lv_coord_t)BLUSH_H);
    lv_obj_set_style_radius(b, LV_RADIUS_CIRCLE, LV_PART_MAIN);
    lv_obj_set_style_bg_color(b, COL_BLUSH, LV_PART_MAIN);
    lv_obj_set_style_bg_opa(b, LV_OPA_70, LV_PART_MAIN);
    lv_obj_set_style_border_width(b, 0, LV_PART_MAIN);
    lv_obj_set_style_pad_all(b, 0, LV_PART_MAIN);
    lv_obj_clear_flag(b, LV_OBJ_FLAG_SCROLLABLE);
    return b;
}

/* ─────────────────────── 表情应用 ─────────────────────── */

/* 显示/隐藏爱心并控制上浮动画 */
static void hearts_set_active(bool active)
{
    if (NULL == s_hearts) return;

    if (active) {
        lv_obj_clear_flag(s_hearts, LV_OBJ_FLAG_HIDDEN);

        lv_anim_t a;
        /* 上浮 */
        lv_anim_init(&a);
        lv_anim_set_var(&a, s_hearts);
        lv_anim_set_exec_cb(&a, heart_y_anim_cb);
        lv_anim_set_values(&a, (int32_t)(HEART_CV_Y_BASE + 8), (int32_t)(HEART_CV_Y_BASE - 8));
        lv_anim_set_time(&a, 1300);
        lv_anim_set_playback_time(&a, 1300);
        lv_anim_set_repeat_count(&a, LV_ANIM_REPEAT_INFINITE);
        lv_anim_set_path_cb(&a, lv_anim_path_ease_in_out);
        lv_anim_start(&a);
        /* 淡出呼吸 */
        lv_anim_init(&a);
        lv_anim_set_var(&a, s_hearts);
        lv_anim_set_exec_cb(&a, heart_opa_anim_cb);
        lv_anim_set_values(&a, 255, 140);
        lv_anim_set_time(&a, 1300);
        lv_anim_set_playback_time(&a, 1300);
        lv_anim_set_repeat_count(&a, LV_ANIM_REPEAT_INFINITE);
        lv_anim_start(&a);
    } else {
        lv_anim_del(s_hearts, heart_y_anim_cb);
        lv_anim_del(s_hearts, heart_opa_anim_cb);
        lv_obj_add_flag(s_hearts, LV_OBJ_FLAG_HIDDEN);
    }
}

/* 恢复双眼到睁开 + 眨眼 + 呼吸的常态 */
static void eyes_reset_open(void)
{
    lv_anim_del(s_left_eye,  blink_anim_cb);
    lv_anim_del(s_right_eye, blink_anim_cb);
    if (s_left_eye)  lv_obj_set_height(s_left_eye,  (lv_coord_t)EYE_H);
    if (s_right_eye) lv_obj_set_height(s_right_eye, (lv_coord_t)EYE_H);
    start_blink_anim(s_left_eye,  500);
    start_blink_anim(s_right_eye, 700);
}

/**
 * 应用一个表情（设置眼/嘴/腮红/爱心）
 */
static void apply_expression(robot_expr_t e)
{
    switch (e) {

    case EXPR_LOVING:
        /* 恋爱：睁眼萌脸 + 微笑 + 腮红加深 + 爱心 */
        eyes_reset_open();
        if (s_left_blush)  lv_obj_set_style_bg_opa(s_left_blush,  LV_OPA_COVER, LV_PART_MAIN);
        if (s_right_blush) lv_obj_set_style_bg_opa(s_right_blush, LV_OPA_COVER, LV_PART_MAIN);
        animate_mouth_to(ANG_SMILE_S, ANG_SMILE_E);
        hearts_set_active(true);
        break;

    case EXPR_HAPPY:
        /* 开心：双眼弯成细缝（^^），大微笑，无爱心 */
        lv_anim_del(s_left_eye,  blink_anim_cb);
        lv_anim_del(s_right_eye, blink_anim_cb);
        if (s_left_eye)  lv_obj_set_height(s_left_eye,  (lv_coord_t)EYE_BLINK_MIN);
        if (s_right_eye) lv_obj_set_height(s_right_eye, (lv_coord_t)EYE_BLINK_MIN);
        if (s_left_blush)  lv_obj_set_style_bg_opa(s_left_blush,  LV_OPA_70, LV_PART_MAIN);
        if (s_right_blush) lv_obj_set_style_bg_opa(s_right_blush, LV_OPA_70, LV_PART_MAIN);
        animate_mouth_to(ANG_GRIN_S, ANG_GRIN_E);
        hearts_set_active(false);
        break;

    case EXPR_SAD:
        /* 悲伤：睁眼 + 嘴角下弯 */
        eyes_reset_open();
        if (s_left_blush)  lv_obj_set_style_bg_opa(s_left_blush,  LV_OPA_40, LV_PART_MAIN);
        if (s_right_blush) lv_obj_set_style_bg_opa(s_right_blush, LV_OPA_40, LV_PART_MAIN);
        animate_mouth_to(ANG_FROWN_S, ANG_FROWN_E);
        hearts_set_active(false);
        break;

    case EXPR_THINKING:
        /* 思考：左眼半闭，右眼正常眨眼，嘴角平 */
        lv_anim_del(s_left_eye, blink_anim_cb);
        if (s_left_eye) lv_obj_set_height(s_left_eye, (lv_coord_t)(EYE_H / 2));
        lv_anim_del(s_right_eye, blink_anim_cb);
        if (s_right_eye) lv_obj_set_height(s_right_eye, (lv_coord_t)EYE_H);
        start_blink_anim(s_right_eye, 200);
        animate_mouth_to(ANG_NEUTRAL_S, ANG_NEUTRAL_E);
        hearts_set_active(false);
        break;

    default: /* EXPR_NEUTRAL：常态萌脸 */
        eyes_reset_open();
        if (s_left_blush)  lv_obj_set_style_bg_opa(s_left_blush,  LV_OPA_70, LV_PART_MAIN);
        if (s_right_blush) lv_obj_set_style_bg_opa(s_right_blush, LV_OPA_70, LV_PART_MAIN);
        animate_mouth_to(ANG_SMILE_S, ANG_SMILE_E);
        hearts_set_active(false);
        break;
    }
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

    /* ── 双眼 ── */
    s_left_eye  = create_eye(scr, (lv_coord_t)LEFT_EYE_X,  (lv_coord_t)EYE_Y);
    s_right_eye = create_eye(scr, (lv_coord_t)RIGHT_EYE_X, (lv_coord_t)EYE_Y);

    /* ── 高光点（大点留引用做闪烁动画） ── */
    s_left_shine  = create_shine(s_left_eye,  SHINE_BIG_X, SHINE_BIG_Y, SHINE_BIG_D);
    create_shine(s_left_eye,  SHINE_MID_X, SHINE_MID_Y, SHINE_MID_D);
    create_shine(s_left_eye,  SHINE_SML_X, SHINE_SML_Y, SHINE_SML_D);
    s_right_shine = create_shine(s_right_eye, SHINE_BIG_X, SHINE_BIG_Y, SHINE_BIG_D);
    create_shine(s_right_eye, SHINE_MID_X, SHINE_MID_Y, SHINE_MID_D);
    create_shine(s_right_eye, SHINE_SML_X, SHINE_SML_Y, SHINE_SML_D);

    /* ── 腮红 ── */
    s_left_blush  = create_blush(scr, (lv_coord_t)LEFT_BLUSH_X,  (lv_coord_t)BLUSH_Y);
    s_right_blush = create_blush(scr, (lv_coord_t)RIGHT_BLUSH_X, (lv_coord_t)BLUSH_Y);

    /* ── 嘴巴弧（纯装饰，隐藏指示器和旋钮） ── */
    s_mouth = lv_arc_create(scr);
    lv_obj_set_pos(s_mouth, (lv_coord_t)MOUTH_ARC_X, (lv_coord_t)MOUTH_ARC_Y);
    lv_obj_set_size(s_mouth, (lv_coord_t)MOUTH_SIZE, (lv_coord_t)MOUTH_SIZE);
    lv_obj_set_style_pad_all(s_mouth, 0, LV_PART_MAIN);
    lv_arc_set_mode(s_mouth, LV_ARC_MODE_NORMAL);
    lv_arc_set_range(s_mouth, 0, 100);
    lv_arc_set_value(s_mouth, 0);
    lv_arc_set_bg_angles(s_mouth, ANG_SMILE_S, ANG_SMILE_E);
    lv_obj_set_style_arc_color(s_mouth, lv_color_white(), LV_PART_MAIN);
    lv_obj_set_style_arc_width(s_mouth, MOUTH_ARC_W, LV_PART_MAIN);
    lv_obj_set_style_arc_opa(s_mouth, LV_OPA_COVER, LV_PART_MAIN);
    lv_obj_set_style_bg_opa(s_mouth, LV_OPA_0, LV_PART_MAIN);
    lv_obj_set_style_border_width(s_mouth, 0, LV_PART_MAIN);
    lv_obj_set_style_arc_opa(s_mouth, LV_OPA_0, LV_PART_INDICATOR);
    lv_obj_set_style_arc_width(s_mouth, 0, LV_PART_INDICATOR);
    lv_obj_set_style_bg_opa(s_mouth, LV_OPA_0, LV_PART_KNOB);
    lv_obj_set_style_border_width(s_mouth, 0, LV_PART_KNOB);
    lv_obj_set_style_pad_all(s_mouth, 0, LV_PART_KNOB);
    lv_obj_clear_flag(s_mouth, LV_OBJ_FLAG_CLICKABLE);

    /* ── 爱心画布（默认隐藏，仅恋爱情绪显示） ── */
    s_hearts = lv_canvas_create(scr);
    lv_canvas_set_buffer(s_hearts, s_heart_cbuf, HEART_CV_W, HEART_CV_H, LV_IMG_CF_TRUE_COLOR_ALPHA);
    lv_obj_set_pos(s_hearts, (lv_coord_t)HEART_CV_X, (lv_coord_t)HEART_CV_Y_BASE);
    lv_canvas_fill_bg(s_hearts, lv_color_black(), LV_OPA_TRANSP);
    draw_one_heart(s_hearts, 22, 24, 9, COL_HEART);    /* 大爱心 */
    draw_one_heart(s_hearts, 46, 36, 6, COL_HEART);    /* 小爱心 */
    lv_obj_add_flag(s_hearts, LV_OBJ_FLAG_HIDDEN);

    /* ── 启动常驻循环动画（=动图） ── */
    start_blink_anim(s_left_eye,  500);
    start_blink_anim(s_right_eye, 700);
    start_breath_anim(s_left_eye,  0);
    start_breath_anim(s_right_eye, 200);
    start_shine_anim(s_left_shine,  0);
    start_shine_anim(s_right_shine, 400);

    /* 初始为常态萌脸 */
    s_expr = EXPR_NEUTRAL;
    apply_expression(EXPR_NEUTRAL);
}

/**
 * @brief 响应 AI 表情消息，更新机器人脸部表情
 * @param msg  TY_DISPLAY_MSG_T*，type == TY_DISPLAY_TP_EMOJI 时处理
 */
void robot_face_ui_msg_handler(TY_DISPLAY_MSG_T *msg)
{
    robot_expr_t new_expr;
    const char  *emoji;

    if (NULL == msg) return;
    if (msg->type != TY_DISPLAY_TP_EMOJI) return;
    if (NULL == msg->data) return;

    emoji = (const char *)msg->data;

    if (strcmp(emoji, "loving") == 0 || strcmp(emoji, "love") == 0 ||
        strcmp(emoji, "lovestruck") == 0) {
        new_expr = EXPR_LOVING;
    } else if (strcmp(emoji, "happy") == 0 || strcmp(emoji, "laughing") == 0) {
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

    apply_expression(new_expr);
}
