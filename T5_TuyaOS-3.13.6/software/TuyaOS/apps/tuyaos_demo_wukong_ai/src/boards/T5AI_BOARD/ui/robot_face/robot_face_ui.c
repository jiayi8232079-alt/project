/**
 * @file robot_face_ui.c
 * @brief LVGL v8 俏皮发光圆脸（参考实体机器人屏显：黑底 + 双发光圆环眼 + U 形微笑）
 *
 * 适用屏幕：SPI ST7789V2 横屏 320×240，RGB565
 *  （工程开启 RGB565 color swap，故所有发光统一用纯白，保证硬件显色正确、最亮）
 *
 * 视觉：纯 LVGL 图元，无图片资源
 *  - 黑底
 *  - 双眼：纯白单层发光圆环（lv_arc 画满 360° 背景弧），黑色中空
 *  - 嘴：白色 U 形微笑弧
 *
 * 让表情“活”起来（比静态照片更俏皮）：
 *  - 整张脸做极轻微上下浮动（idle float），像在呼吸，时刻有“生命感”
 *  - 行为调度器按加权随机穿插多种小动作，节奏带抖动避免机械感：
 *      · 单次眨眼 / 连续双眨（最常见）
 *      · 单眼 wink（左右随机）—— 俏皮核心
 *      · 左右张望 glance（整脸横移一下再回来，像好奇打量）
 *      · 眯眼坏笑 squint（双眼压扁 + 嘴角短促咧开）
 *  - 嘴角持续轻微摆动
 *
 * 表情（TY_DISPLAY_TP_EMOJI 的 data 字符串）：
 *  - happy / laughing            → 咧嘴 grin
 *  - loving / love / lovestruck  → 微笑（柔光更亮）
 *  - sad                         → 嘴角下弯，收敛俏皮动作（只眨眼）
 *  - thinking                    → 左眼半眯 + 中性嘴
 *  - listening / wake / awake    → 唤醒/聆听：聚焦睁眼 + 中性嘴
 *  - querying / searching        → 查询中：整脸轻微扫动 + 三点循环 + 中性嘴
 *  - 其它                        → neutral 微笑
 *
 * 状态联动（TY_DISPLAY_TP_CHAT_STAT 的 data[0]，取值同 gui_common.h 的 GUI_STAT_*）：
 *  - INIT / IDLE → neutral 待机（待机动画保持不变）
 *  - LISTEN      → 唤醒/聆听表情（被唤醒、开始听用户说话）
 *  - THINK       → 查询中表情（联网 / MCP 查询、等待外部结果）
 *  - 其它阶段    → 不强制改表情，交由云端 emoji 驱动
 */

#include "tuya_ai_display.h"
#include "gui_common.h"
#include "lvgl.h"
#include <string.h>

#define SCREEN_W            320
#define SCREEN_H            240

/* 圆环眼 */
#define EYE_D               50          /* 外径 */
#define EYE_RING_W          4           /* 细线圆环，贴近实物屏显 */
#define EYE_HALO_W          10          /* 仅保留为隐藏动画占位，默认不显示第二层圆 */

/* 最高亮度：RGB565 纯白（color swap 安全色） */
#define COL_GLOW            lv_color_white()
#define COL_GLOW_HALO       lv_color_white()
#define HALO_OPA_MAX        LV_OPA_0    /* 参考渲染图只要单层眼圈，避免出现“双圈” */
#define HALO_OPA_SAD        LV_OPA_0
#define MOUTH_OPA_SAD       LV_OPA_80
#define EYE_GAP             54
#define EYES_BLOCK_W        (EYE_D * 2 + EYE_GAP)
#define LEFT_EYE_X          ((SCREEN_W - EYES_BLOCK_W) / 2)
#define RIGHT_EYE_X         (LEFT_EYE_X + EYE_D + EYE_GAP)
#define EYE_Y               68
#define EYE_BLINK_MIN       6           /* legacy squint; blink uses eyelids */
#define EYE_LID_CLOSE_H     (EYE_D / 2 + 6)
#define EYE_SQUINT_H        (EYE_D * 3 / 5)  /* 眯眼坏笑时的高度 */
#define EYE_THINK_H         (EYE_D / 2)  /* thinking 时左眼半眯高度 */

/* 嘴巴弧 */
#define MOUTH_SIZE          40
#define MOUTH_ARC_X         ((SCREEN_W - MOUTH_SIZE) / 2)
#define MOUTH_ARC_Y         114
#define MOUTH_ARC_W         5

#define ANG_SMILE_S         38
#define ANG_SMILE_E         142
#define ANG_GRIN_S          28
#define ANG_GRIN_E          152
#define ANG_FROWN_S         208
#define ANG_FROWN_E         332
#define ANG_NEUTRAL_S       42
#define ANG_NEUTRAL_E       138

/* 整脸浮动 / 张望幅度 */
#define FACE_FLOAT_DY       3
#define FACE_GLANCE_DX      10

/* 唤醒态：聚焦睁眼 pop 的起步压扁高度（复用眨眼/眯眼语汇，落点回到 EYE_D 全开） */
#define WAKE_POP_FROM_H     EYE_SQUINT_H

/* 查询态：整脸轻微左右扫动幅度（小于张望，连续 ease-in-out 表达“思考/查询中”） */
#define QUERY_SCAN_DX       8

/* 查询态：思考小点（... 循环），复用纯白像素风，居中置于嘴部下方 */
#define DOT_D               8
#define DOT_GAP             10
#define DOTS_BLOCK_W        (DOT_D * 3 + DOT_GAP * 2)
#define DOTS_X0             ((SCREEN_W - DOTS_BLOCK_W) / 2)
#define DOTS_Y              (MOUTH_ARC_Y + MOUTH_SIZE + 10)
#define DOT_OPA_DIM         LV_OPA_20
#define DOT_OPA_BRIGHT      LV_OPA_COVER

typedef enum {
    EXPR_NEUTRAL = 0,
    EXPR_LOVING,
    EXPR_HAPPY,
    EXPR_SAD,
    EXPR_THINKING,
    EXPR_WAKE,        /* 唤醒/聆听：被唤醒、开始听用户说话 */
    EXPR_QUERYING,    /* 查询中：联网 / MCP 查询、等待外部结果 */
} robot_expr_t;

/* s_face 为承载全部表情元素的容器：整体浮动/张望只需动它一个对象 */
static lv_obj_t *s_face          = NULL;
static lv_obj_t *s_left_eye      = NULL;
static lv_obj_t *s_right_eye     = NULL;
static lv_obj_t *s_left_lid_top  = NULL;
static lv_obj_t *s_left_lid_bot  = NULL;
static lv_obj_t *s_right_lid_top = NULL;
static lv_obj_t *s_right_lid_bot = NULL;
static lv_obj_t *s_left_halo     = NULL;
static lv_obj_t *s_right_halo    = NULL;
static lv_obj_t *s_mouth         = NULL;
static lv_obj_t *s_dot[3]        = {NULL, NULL, NULL};  /* 查询态思考小点（... 循环） */
static lv_timer_t *s_play_timer  = NULL;

static robot_expr_t s_expr = EXPR_NEUTRAL;
/* 查询态扫动/思考小点动画是否在运行：用于切换其它表情时幂等清理 */
static BOOL_T s_query_active = FALSE;

/* 每只眼睛的“基线高度”：眨眼/眯眼结束后回弹到此值（thinking 时左眼为半眯） */
static lv_coord_t s_left_base_h  = EYE_D;
static lv_coord_t s_right_base_h = EYE_D;
/* 当前嘴形基线角度：俏皮动作里的临时咧嘴结束后回到此角度 */
static uint16_t s_mouth_s = ANG_SMILE_S;
static uint16_t s_mouth_e = ANG_SMILE_E;

/* 轻量伪随机：不引入 rand()，用 LCG 叠加 tick 提供足够的随机性穿插动作 */
static uint32_t s_rng = 0x2545F491u;
static uint32_t prand(void)
{
    s_rng = s_rng * 1664525u + 1013904223u + lv_tick_get();
    return s_rng;
}

/* ── 动画 setter ── */

static void blink_h_anim_cb(void *obj, int32_t val)
{
    lv_obj_set_height((lv_obj_t *)obj, (lv_coord_t)val);
}

static void lid_top_anim_cb(void *obj, int32_t val)
{
    lv_obj_set_height((lv_obj_t *)obj, (lv_coord_t)val);
}

static void lid_bot_anim_cb(void *obj, int32_t val)
{
    lv_obj_t *lid = (lv_obj_t *)obj;
    lv_coord_t h = (lv_coord_t)val;

    lv_obj_set_height(lid, h);
    lv_obj_set_y(lid, (lv_coord_t)(EYE_Y + EYE_D - h));
}

static void eye_opa_anim_cb(void *obj, int32_t val)
{
    lv_obj_set_style_arc_opa((lv_obj_t *)obj, (lv_opa_t)val, LV_PART_MAIN);
}

static void face_x_anim_cb(void *obj, int32_t val)
{
    lv_obj_set_x((lv_obj_t *)obj, (lv_coord_t)val);
}

static void face_y_anim_cb(void *obj, int32_t val)
{
    lv_obj_set_y((lv_obj_t *)obj, (lv_coord_t)val);
}

static void mouth_start_anim_cb(void *obj, int32_t val)
{
    lv_arc_set_bg_start_angle((lv_obj_t *)obj, (uint16_t)val);
}

static void mouth_end_anim_cb(void *obj, int32_t val)
{
    lv_arc_set_bg_end_angle((lv_obj_t *)obj, (uint16_t)val);
}

static void mouth_y_anim_cb(void *obj, int32_t val)
{
    lv_obj_set_y((lv_obj_t *)obj, (lv_coord_t)val);
}

/* 查询态思考小点：动画驱动背景透明度做明灭循环 */
static void dot_opa_anim_cb(void *obj, int32_t val)
{
    lv_obj_set_style_bg_opa((lv_obj_t *)obj, (lv_opa_t)val, LV_PART_MAIN);
}

/* 唤醒态柔光脉冲：动画驱动柔光环透明度短促提亮再回落到基线 */
static void halo_opa_anim_cb(void *obj, int32_t val)
{
    lv_obj_set_style_arc_opa((lv_obj_t *)obj, (lv_opa_t)val, LV_PART_MAIN);
}

/* ── 通用弧样式：把 lv_arc 画成一圈发光圆环 ── */

static void style_glow_arc(lv_obj_t *arc, lv_coord_t ring_w, lv_color_t col, lv_opa_t opa)
{
    lv_obj_set_style_pad_all(arc, 0, LV_PART_MAIN);
    lv_arc_set_mode(arc, LV_ARC_MODE_NORMAL);
    lv_arc_set_range(arc, 0, 100);
    lv_arc_set_value(arc, 0);
    lv_arc_set_bg_angles(arc, 0, 360);
    lv_obj_set_style_arc_color(arc, col, LV_PART_MAIN);
    lv_obj_set_style_arc_width(arc, ring_w, LV_PART_MAIN);
    lv_obj_set_style_arc_opa(arc, opa, LV_PART_MAIN);
    lv_obj_set_style_arc_rounded(arc, true, LV_PART_MAIN);
    lv_obj_set_style_arc_opa(arc, LV_OPA_0, LV_PART_INDICATOR);
    lv_obj_set_style_arc_width(arc, 0, LV_PART_INDICATOR);
    lv_obj_set_style_bg_opa(arc, LV_OPA_0, LV_PART_MAIN);
    lv_obj_set_style_border_width(arc, 0, LV_PART_MAIN);
    lv_obj_set_style_bg_opa(arc, LV_OPA_0, LV_PART_KNOB);
    lv_obj_set_style_pad_all(arc, 0, LV_PART_KNOB);
    lv_obj_clear_flag(arc, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_clear_flag(arc, LV_OBJ_FLAG_SCROLLABLE);
}

/* ── 对象创建 ── */

static lv_obj_t *create_face_container(lv_obj_t *parent)
{
    lv_obj_t *face = lv_obj_create(parent);

    /* 全屏透明容器：子元素绝对坐标不变，整脸浮动/张望只动容器自身 */
    lv_obj_set_size(face, (lv_coord_t)SCREEN_W, (lv_coord_t)SCREEN_H);
    lv_obj_set_pos(face, 0, 0);
    lv_obj_set_style_bg_opa(face, LV_OPA_0, LV_PART_MAIN);
    lv_obj_set_style_border_width(face, 0, LV_PART_MAIN);
    lv_obj_set_style_pad_all(face, 0, LV_PART_MAIN);
    lv_obj_set_style_radius(face, 0, LV_PART_MAIN);
    lv_obj_clear_flag(face, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_clear_flag(face, LV_OBJ_FLAG_CLICKABLE);
    return face;
}

static lv_obj_t *create_ring_eye_halo(lv_obj_t *parent, lv_coord_t x, lv_coord_t y)
{
    lv_obj_t *halo = lv_arc_create(parent);

    lv_obj_set_pos(halo, x, y);
    lv_obj_set_size(halo, (lv_coord_t)EYE_D, (lv_coord_t)EYE_D);
    style_glow_arc(halo, EYE_HALO_W, COL_GLOW_HALO, HALO_OPA_MAX);
    lv_obj_add_flag(halo, LV_OBJ_FLAG_HIDDEN);
    return halo;
}

static lv_obj_t *create_ring_eye(lv_obj_t *parent, lv_coord_t x, lv_coord_t y)
{
    lv_obj_t *eye = lv_arc_create(parent);

    lv_obj_set_pos(eye, x, y);
    lv_obj_set_size(eye, (lv_coord_t)EYE_D, (lv_coord_t)EYE_D);
    style_glow_arc(eye, EYE_RING_W, COL_GLOW, LV_OPA_COVER);
    return eye;
}

static lv_obj_t *create_eye_lid(lv_obj_t *parent, lv_coord_t x, lv_coord_t y, BOOL_T is_top)
{
    lv_obj_t *lid = lv_obj_create(parent);

    lv_obj_set_pos(lid, x, y);
    lv_obj_set_size(lid, (lv_coord_t)EYE_D, 0);
    lv_obj_set_style_bg_color(lid, lv_color_black(), LV_PART_MAIN);
    lv_obj_set_style_bg_opa(lid, LV_OPA_COVER, LV_PART_MAIN);
    lv_obj_set_style_border_width(lid, 0, LV_PART_MAIN);
    lv_obj_set_style_pad_all(lid, 0, LV_PART_MAIN);
    lv_obj_set_style_radius(lid, is_top ? (lv_coord_t)(EYE_D / 2) : 0, LV_PART_MAIN);
    lv_obj_clear_flag(lid, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_clear_flag(lid, LV_OBJ_FLAG_CLICKABLE);
    return lid;
}

static lv_obj_t *create_smile_mouth(lv_obj_t *parent)
{
    lv_obj_t *mouth = lv_arc_create(parent);

    lv_obj_set_pos(mouth, (lv_coord_t)MOUTH_ARC_X, (lv_coord_t)MOUTH_ARC_Y);
    lv_obj_set_size(mouth, (lv_coord_t)MOUTH_SIZE, (lv_coord_t)MOUTH_SIZE);
    lv_arc_set_bg_angles(mouth, ANG_SMILE_S, ANG_SMILE_E);
    style_glow_arc(mouth, MOUTH_ARC_W, COL_GLOW, LV_OPA_COVER);
    return mouth;
}

/* 查询态思考小点：纯白实心圆点，默认隐藏，仅进入查询态时显示并做明灭循环 */
static lv_obj_t *create_think_dot(lv_obj_t *parent, lv_coord_t x, lv_coord_t y)
{
    lv_obj_t *dot = lv_obj_create(parent);

    lv_obj_set_pos(dot, x, y);
    lv_obj_set_size(dot, (lv_coord_t)DOT_D, (lv_coord_t)DOT_D);
    lv_obj_set_style_radius(dot, LV_RADIUS_CIRCLE, LV_PART_MAIN);
    lv_obj_set_style_bg_color(dot, COL_GLOW, LV_PART_MAIN);
    lv_obj_set_style_bg_opa(dot, DOT_OPA_DIM, LV_PART_MAIN);
    lv_obj_set_style_border_width(dot, 0, LV_PART_MAIN);
    lv_obj_set_style_pad_all(dot, 0, LV_PART_MAIN);
    lv_obj_clear_flag(dot, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_clear_flag(dot, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_flag(dot, LV_OBJ_FLAG_HIDDEN);
    return dot;
}

/* ── 持续动画：整脸浮动 + 嘴角摆动 ── */

static void start_face_float(void)
{
    lv_anim_t a;

    if (NULL == s_face) {
        return;
    }
    lv_anim_del(s_face, face_y_anim_cb);
    lv_anim_init(&a);
    lv_anim_set_var(&a, s_face);
    lv_anim_set_exec_cb(&a, face_y_anim_cb);
    /* 绕中线上下各浮动 FACE_FLOAT_DY，黑底兜底，越界部分不可见 */
    lv_anim_set_values(&a, (int32_t)(-FACE_FLOAT_DY), (int32_t)FACE_FLOAT_DY);
    lv_anim_set_time(&a, 2400);
    lv_anim_set_playback_time(&a, 2400);
    lv_anim_set_repeat_count(&a, LV_ANIM_REPEAT_INFINITE);
    lv_anim_set_path_cb(&a, lv_anim_path_ease_in_out);
    lv_anim_start(&a);
}

static void start_mouth_wiggle(void)
{
    lv_anim_t a;

    if (NULL == s_mouth) {
        return;
    }
    lv_anim_del(s_mouth, mouth_y_anim_cb);
    lv_anim_init(&a);
    lv_anim_set_var(&a, s_mouth);
    lv_anim_set_exec_cb(&a, mouth_y_anim_cb);
    lv_anim_set_values(&a, (int32_t)MOUTH_ARC_Y, (int32_t)(MOUTH_ARC_Y + 3));
    lv_anim_set_time(&a, 800);
    lv_anim_set_playback_time(&a, 800);
    lv_anim_set_repeat_count(&a, LV_ANIM_REPEAT_INFINITE);
    lv_anim_set_path_cb(&a, lv_anim_path_ease_in_out);
    lv_anim_start(&a);
}

static void stop_mouth_wiggle(void)
{
    if (NULL == s_mouth) {
        return;
    }
    lv_anim_del(s_mouth, mouth_y_anim_cb);
    lv_obj_set_y(s_mouth, (lv_coord_t)MOUTH_ARC_Y);
}

/* ── 一次性俏皮动作（全部用 playback 自动回弹到基线，无需善后定时器） ── */

/* 单眼眨眼：黑底眼睑上下闭合，圆环保持圆形不压扁 */
static void blink_eye_lids(lv_obj_t *top, lv_obj_t *bot, uint8_t count)
{
    lv_anim_t a;

    if (top) {
        lv_anim_del(top, lid_top_anim_cb);
        lv_obj_set_height(top, 0);
        lv_anim_init(&a);
        lv_anim_set_var(&a, top);
        lv_anim_set_exec_cb(&a, lid_top_anim_cb);
        lv_anim_set_values(&a, 0, (int32_t)EYE_LID_CLOSE_H);
        lv_anim_set_time(&a, 85);
        lv_anim_set_playback_time(&a, 110);
        lv_anim_set_repeat_count(&a, count);
        lv_anim_set_repeat_delay(&a, 70);
        lv_anim_set_path_cb(&a, lv_anim_path_ease_in);
        lv_anim_start(&a);
    }

    if (bot) {
        lv_anim_del(bot, lid_bot_anim_cb);
        lv_obj_set_height(bot, 0);
        lv_obj_set_y(bot, (lv_coord_t)(EYE_Y + EYE_D));
        lv_anim_init(&a);
        lv_anim_set_var(&a, bot);
        lv_anim_set_exec_cb(&a, lid_bot_anim_cb);
        lv_anim_set_values(&a, 0, (int32_t)EYE_LID_CLOSE_H);
        lv_anim_set_time(&a, 85);
        lv_anim_set_playback_time(&a, 110);
        lv_anim_set_repeat_count(&a, count);
        lv_anim_set_repeat_delay(&a, 70);
        lv_anim_set_path_cb(&a, lv_anim_path_ease_in);
        lv_anim_start(&a);
    }
}

/* 单只眼连同柔光一起眨：count=1 单眨，count=2 双眨 */
static void blink_pair(lv_obj_t *eye, lv_obj_t *halo, lv_obj_t *lid_top, lv_obj_t *lid_bot,
                       lv_coord_t base_h, uint8_t count)
{
    (void)eye;
    (void)halo;
    (void)base_h;
    blink_eye_lids(lid_top, lid_bot, count);
}

static void blink_both(uint8_t count)
{
    blink_pair(s_left_eye,  s_left_halo,  s_left_lid_top,  s_left_lid_bot,  s_left_base_h,  count);
    blink_pair(s_right_eye, s_right_halo, s_right_lid_top, s_right_lid_bot, s_right_base_h, count);
}

/* 整脸横移一下再回来：像好奇地往一侧瞄了一眼 */
static void do_glance(int dir)
{
    lv_anim_t a;

    if (NULL == s_face) {
        return;
    }
    lv_anim_del(s_face, face_x_anim_cb);
    lv_obj_set_x(s_face, 0);

    lv_anim_init(&a);
    lv_anim_set_var(&a, s_face);
    lv_anim_set_exec_cb(&a, face_x_anim_cb);
    lv_anim_set_values(&a, 0, (int32_t)(dir * FACE_GLANCE_DX));
    lv_anim_set_time(&a, 260);
    lv_anim_set_playback_time(&a, 300);
    lv_anim_set_path_cb(&a, lv_anim_path_ease_in_out);
    lv_anim_start(&a);
}

/* 嘴角短促咧开一下再回到基线（俏皮坏笑用） */
static void mouth_pulse_grin(void)
{
    lv_anim_t a;

    if (NULL == s_mouth) {
        return;
    }
    lv_anim_init(&a);
    lv_anim_set_var(&a, s_mouth);
    lv_anim_set_exec_cb(&a, mouth_start_anim_cb);
    lv_anim_set_values(&a, (int32_t)s_mouth_s, (int32_t)ANG_GRIN_S);
    lv_anim_set_time(&a, 200);
    lv_anim_set_playback_time(&a, 240);
    lv_anim_start(&a);

    lv_anim_init(&a);
    lv_anim_set_var(&a, s_mouth);
    lv_anim_set_exec_cb(&a, mouth_end_anim_cb);
    lv_anim_set_values(&a, (int32_t)s_mouth_e, (int32_t)ANG_GRIN_E);
    lv_anim_set_time(&a, 200);
    lv_anim_set_playback_time(&a, 240);
    lv_anim_start(&a);
}

/* 双眼压扁眯一下 + 嘴角咧开：整体“坏笑”表情 */
static void do_squint_grin(void)
{
    lv_obj_t *eyes[2];
    lv_obj_t *halos[2];
    lv_coord_t bases[2];
    int i;

    eyes[0]  = s_left_eye;   eyes[1]  = s_right_eye;
    halos[0] = s_left_halo;  halos[1] = s_right_halo;
    bases[0] = s_left_base_h; bases[1] = s_right_base_h;

    for (i = 0; i < 2; i++) {
        lv_obj_t *pair[2];
        int k;

        pair[0] = eyes[i];
        pair[1] = halos[i];
        for (k = 0; k < 2; k++) {
            lv_anim_t a;

            if (NULL == pair[k]) {
                continue;
            }
            lv_anim_del(pair[k], blink_h_anim_cb);
            lv_obj_set_height(pair[k], bases[i]);

            lv_anim_init(&a);
            lv_anim_set_var(&a, pair[k]);
            lv_anim_set_exec_cb(&a, blink_h_anim_cb);
            lv_anim_set_values(&a, (int32_t)bases[i], (int32_t)EYE_SQUINT_H);
            lv_anim_set_time(&a, 180);
            lv_anim_set_playback_time(&a, 220);
            lv_anim_set_playback_delay(&a, 160); /* 眯住一小会儿 */
            lv_anim_set_path_cb(&a, lv_anim_path_ease_in_out);
            lv_anim_start(&a);
        }
    }
    mouth_pulse_grin();
}

/* ── 唤醒态：聚焦睁眼 + 轻微亮起（一次性，落点回到全开基线） ── */

/* 双眼连同柔光从半眯快速睁大到 EYE_D，表现“睁眼/聚焦” */
static void wake_focus_pop(void)
{
    lv_obj_t *objs[4];
    int i;

    objs[0] = s_left_eye;   objs[1] = s_left_halo;
    objs[2] = s_right_eye;  objs[3] = s_right_halo;

    for (i = 0; i < 4; i++) {
        lv_anim_t a;

        if (NULL == objs[i]) {
            continue;
        }
        lv_anim_del(objs[i], blink_h_anim_cb);
        lv_obj_set_height(objs[i], (lv_coord_t)WAKE_POP_FROM_H);  /* 起步半眯 */

        lv_anim_init(&a);
        lv_anim_set_var(&a, objs[i]);
        lv_anim_set_exec_cb(&a, blink_h_anim_cb);
        lv_anim_set_values(&a, (int32_t)WAKE_POP_FROM_H, (int32_t)EYE_D);
        lv_anim_set_time(&a, 200);
        lv_anim_set_path_cb(&a, lv_anim_path_ease_out);
        lv_anim_start(&a);
    }
}

/* 唤醒态：主环轻微提亮脉冲（不再使用第二层柔光圈） */
static void wake_glow_pulse(void)
{
    lv_obj_t *eyes[2];
    int i;

    eyes[0] = s_left_eye;
    eyes[1] = s_right_eye;
    for (i = 0; i < 2; i++) {
        lv_anim_t a;

        if (NULL == eyes[i]) {
            continue;
        }
        lv_anim_del(eyes[i], eye_opa_anim_cb);
        lv_anim_init(&a);
        lv_anim_set_var(&a, eyes[i]);
        lv_anim_set_exec_cb(&a, eye_opa_anim_cb);
        lv_anim_set_values(&a, (int32_t)LV_OPA_70, (int32_t)LV_OPA_COVER);
        lv_anim_set_time(&a, 220);
        lv_anim_set_playback_time(&a, 380);
        lv_anim_set_path_cb(&a, lv_anim_path_ease_out);
        lv_anim_start(&a);
    }
}

/* ── 查询态：整脸轻微左右扫动 + 三个思考小点循环 ── */

/* 复用整脸 X 位移（与张望同一 exec_cb；查询态已在调度器关闭张望，二者不抢占） */
static void start_eye_scan(void)
{
    lv_anim_t a;

    if (NULL == s_face) {
        return;
    }
    lv_anim_del(s_face, face_x_anim_cb);
    lv_obj_set_x(s_face, (lv_coord_t)(-QUERY_SCAN_DX));

    lv_anim_init(&a);
    lv_anim_set_var(&a, s_face);
    lv_anim_set_exec_cb(&a, face_x_anim_cb);
    lv_anim_set_values(&a, (int32_t)(-QUERY_SCAN_DX), (int32_t)QUERY_SCAN_DX);
    lv_anim_set_time(&a, 900);
    lv_anim_set_playback_time(&a, 900);
    lv_anim_set_repeat_count(&a, LV_ANIM_REPEAT_INFINITE);
    lv_anim_set_path_cb(&a, lv_anim_path_ease_in_out);
    lv_anim_start(&a);
}

static void start_query_anims(void)
{
    int i;

    s_query_active = TRUE;

    for (i = 0; i < 3; i++) {
        lv_anim_t a;

        if (NULL == s_dot[i]) {
            continue;
        }
        lv_obj_clear_flag(s_dot[i], LV_OBJ_FLAG_HIDDEN);
        lv_anim_del(s_dot[i], dot_opa_anim_cb);
        lv_obj_set_style_bg_opa(s_dot[i], DOT_OPA_DIM, LV_PART_MAIN);

        lv_anim_init(&a);
        lv_anim_set_var(&a, s_dot[i]);
        lv_anim_set_exec_cb(&a, dot_opa_anim_cb);
        lv_anim_set_values(&a, (int32_t)DOT_OPA_DIM, (int32_t)DOT_OPA_BRIGHT);
        lv_anim_set_time(&a, 200);
        lv_anim_set_playback_time(&a, 200);
        lv_anim_set_repeat_delay(&a, 200);
        /* 三点用起始延时错相（首拍延时永久保留相位差），形成 1→2→3 循环波 */
        lv_anim_set_delay(&a, (uint32_t)(i * 200));
        lv_anim_set_repeat_count(&a, LV_ANIM_REPEAT_INFINITE);
        lv_anim_set_path_cb(&a, lv_anim_path_ease_in_out);
        lv_anim_start(&a);
    }

    start_eye_scan();
}

/* 离开查询态时清理扫动与思考小点（幂等：非查询态直接返回，对待机/情绪表情无副作用） */
static void stop_query_anims(void)
{
    int i;

    if (!s_query_active) {
        return;
    }
    s_query_active = FALSE;

    for (i = 0; i < 3; i++) {
        if (s_dot[i]) {
            lv_anim_del(s_dot[i], dot_opa_anim_cb);
            lv_obj_add_flag(s_dot[i], LV_OBJ_FLAG_HIDDEN);
        }
    }
    if (s_face) {
        lv_anim_del(s_face, face_x_anim_cb);
        lv_obj_set_x(s_face, 0);  /* 复位到中线，张望从 0 起算 */
    }
}

/* ── 基线设置 ── */

static void set_eye_base_height(lv_obj_t *eye, lv_obj_t *halo, lv_coord_t h)
{
    if (eye) {
        lv_anim_del(eye, blink_h_anim_cb);
        lv_obj_set_height(eye, h);
    }
    if (halo) {
        lv_anim_del(halo, blink_h_anim_cb);
        lv_obj_set_height(halo, h);
    }
}

static void set_halo_brightness(lv_obj_t *halo, lv_opa_t opa)
{
    if (halo) {
        /* 清理唤醒态发光脉冲，避免残留动画覆盖新设的基线亮度 */
        lv_anim_del(halo, halo_opa_anim_cb);
        lv_obj_set_style_arc_color(halo, COL_GLOW_HALO, LV_PART_MAIN);
        lv_obj_set_style_arc_opa(halo, opa, LV_PART_MAIN);
    }
}

static void set_mouth_glow(lv_opa_t opa)
{
    if (s_mouth) {
        lv_obj_set_style_arc_color(s_mouth, COL_GLOW, LV_PART_MAIN);
        lv_obj_set_style_arc_opa(s_mouth, opa, LV_PART_MAIN);
    }
}

/* 永久改变嘴形并记录为新基线（供俏皮动作回弹用） */
static void set_mouth_shape(uint16_t s_to, uint16_t e_to)
{
    lv_anim_t a;

    if (NULL == s_mouth) {
        return;
    }
    lv_anim_init(&a);
    lv_anim_set_var(&a, s_mouth);
    lv_anim_set_exec_cb(&a, mouth_start_anim_cb);
    lv_anim_set_values(&a, (int32_t)lv_arc_get_bg_angle_start(s_mouth), (int32_t)s_to);
    lv_anim_set_time(&a, 280);
    lv_anim_start(&a);

    lv_anim_init(&a);
    lv_anim_set_var(&a, s_mouth);
    lv_anim_set_exec_cb(&a, mouth_end_anim_cb);
    lv_anim_set_values(&a, (int32_t)lv_arc_get_bg_angle_end(s_mouth), (int32_t)e_to);
    lv_anim_set_time(&a, 280);
    lv_anim_start(&a);

    s_mouth_s = s_to;
    s_mouth_e = e_to;
}

/* ── 行为调度：加权随机穿插俏皮动作，节奏带抖动 ── */

static void schedule_next(void)
{
    if (s_play_timer) {
        /* 1.8 ~ 3.7s 抖动，避免机械周期感 */
        lv_timer_set_period(s_play_timer, 1200 + (prand() % 1600));
    }
}

static void behavior_timer_cb(lv_timer_t *timer)
{
    uint32_t r;

    (void)timer;

    /* 查询态由左右扫动 + 思考小点表达，跳过随机俏皮动作（避免与扫动抢 face_x） */
    if (s_expr == EXPR_QUERYING) {
        schedule_next();
        return;
    }

    r = prand() % 100U;

    /* 难过时收敛俏皮动作；唤醒时保留眨眼与 wink */
    if (s_expr == EXPR_SAD) {
        r = 0U;
    } else if (s_expr == EXPR_WAKE) {
        r = (prand() % 100U);
        if (r >= 55U) {
            r = 0U;
        }
    }

    if (r < 45U) {
        blink_both(1);                       /* 单眨：最常见 */
    } else if (r < 60U) {
        blink_both(2);                       /* 双眨 */
    } else if (r < 78U) {
        if (prand() & 1U) {
            blink_pair(s_left_eye, s_left_halo, s_left_lid_top, s_left_lid_bot, s_left_base_h, 1);
        } else {
            blink_pair(s_right_eye, s_right_halo, s_right_lid_top, s_right_lid_bot, s_right_base_h, 1);
        }
    } else if (r < 92U) {
        do_glance((prand() & 1U) ? 1 : -1);  /* 左右张望 */
    } else {
        do_squint_grin();                    /* 眯眼坏笑 */
    }

    schedule_next();
}

/* ── 表情 ── */

static void apply_expression(robot_expr_t e)
{
    /* 切换任意表情前，先清理查询态扫动与思考小点（幂等：非查询态无副作用） */
    stop_query_anims();

    switch (e) {
    case EXPR_LOVING:
        s_left_base_h = EYE_D;
        s_right_base_h = EYE_D;
        set_eye_base_height(s_left_eye,  s_left_halo,  EYE_D);
        set_eye_base_height(s_right_eye, s_right_halo, EYE_D);
        set_halo_brightness(s_left_halo,  HALO_OPA_MAX);
        set_halo_brightness(s_right_halo, HALO_OPA_MAX);
        set_mouth_glow(LV_OPA_COVER);
        set_mouth_shape(ANG_SMILE_S, ANG_SMILE_E);
        start_mouth_wiggle();
        break;

    case EXPR_HAPPY:
        s_left_base_h = EYE_D;
        s_right_base_h = EYE_D;
        set_eye_base_height(s_left_eye,  s_left_halo,  EYE_D);
        set_eye_base_height(s_right_eye, s_right_halo, EYE_D);
        set_halo_brightness(s_left_halo,  HALO_OPA_MAX);
        set_halo_brightness(s_right_halo, HALO_OPA_MAX);
        set_mouth_glow(LV_OPA_COVER);
        set_mouth_shape(ANG_GRIN_S, ANG_GRIN_E);
        start_mouth_wiggle();
        break;

    case EXPR_SAD:
        s_left_base_h = EYE_D;
        s_right_base_h = EYE_D;
        set_eye_base_height(s_left_eye,  s_left_halo,  EYE_D);
        set_eye_base_height(s_right_eye, s_right_halo, EYE_D);
        set_halo_brightness(s_left_halo,  HALO_OPA_SAD);
        set_halo_brightness(s_right_halo, HALO_OPA_SAD);
        set_mouth_glow(MOUTH_OPA_SAD);
        set_mouth_shape(ANG_FROWN_S, ANG_FROWN_E);
        stop_mouth_wiggle();
        break;

    case EXPR_THINKING:
        /* 左眼半眯（设为基线，眨眼/眯眼会从半眯回弹），右眼正常 */
        s_left_base_h = EYE_THINK_H;
        s_right_base_h = EYE_D;
        set_eye_base_height(s_left_eye,  s_left_halo,  EYE_THINK_H);
        set_eye_base_height(s_right_eye, s_right_halo, EYE_D);
        set_halo_brightness(s_left_halo,  HALO_OPA_MAX);
        set_halo_brightness(s_right_halo, HALO_OPA_MAX);
        set_mouth_glow(LV_OPA_COVER);
        set_mouth_shape(ANG_NEUTRAL_S, ANG_NEUTRAL_E);
        stop_mouth_wiggle();
        break;

    case EXPR_WAKE:
        /* 唤醒/聆听：复用全开圆环眼基线，仅做聚焦睁眼 + 柔光提亮 + 中性嘴，收起俏皮摆动 */
        s_left_base_h = EYE_D;
        s_right_base_h = EYE_D;
        set_eye_base_height(s_left_eye,  s_left_halo,  EYE_D);
        set_eye_base_height(s_right_eye, s_right_halo, EYE_D);
        set_halo_brightness(s_left_halo,  HALO_OPA_MAX);
        set_halo_brightness(s_right_halo, HALO_OPA_MAX);
        set_mouth_glow(LV_OPA_COVER);
        set_mouth_shape(ANG_NEUTRAL_S, ANG_NEUTRAL_E);
        stop_mouth_wiggle();
        wake_focus_pop();
        wake_glow_pulse();
        break;

    case EXPR_QUERYING:
        /* 查询中：复用全开圆环眼基线，中性嘴 + 整脸轻微扫动 + 三点循环 */
        s_left_base_h = EYE_D;
        s_right_base_h = EYE_D;
        set_eye_base_height(s_left_eye,  s_left_halo,  EYE_D);
        set_eye_base_height(s_right_eye, s_right_halo, EYE_D);
        set_halo_brightness(s_left_halo,  HALO_OPA_MAX);
        set_halo_brightness(s_right_halo, HALO_OPA_MAX);
        set_mouth_glow(LV_OPA_COVER);
        set_mouth_shape(ANG_NEUTRAL_S, ANG_NEUTRAL_E);
        stop_mouth_wiggle();
        start_query_anims();
        break;

    default: /* EXPR_NEUTRAL */
        s_left_base_h = EYE_D;
        s_right_base_h = EYE_D;
        set_eye_base_height(s_left_eye,  s_left_halo,  EYE_D);
        set_eye_base_height(s_right_eye, s_right_halo, EYE_D);
        set_halo_brightness(s_left_halo,  HALO_OPA_MAX);
        set_halo_brightness(s_right_halo, HALO_OPA_MAX);
        set_mouth_glow(LV_OPA_COVER);
        set_mouth_shape(ANG_SMILE_S, ANG_SMILE_E);
        start_mouth_wiggle();
        break;
    }
}

void robot_face_ui_init(void)
{
    lv_obj_t *scr = lv_scr_act();

    lv_obj_set_style_bg_color(scr, lv_color_black(), LV_PART_MAIN);
    lv_obj_set_style_bg_opa(scr, LV_OPA_COVER, LV_PART_MAIN);
    lv_obj_clear_flag(scr, LV_OBJ_FLAG_SCROLLABLE);

    s_face = create_face_container(scr);

    /* 先柔光后主环，保证主环在上层；嘴最后建 */
    s_left_halo  = create_ring_eye_halo(s_face, (lv_coord_t)LEFT_EYE_X,  (lv_coord_t)EYE_Y);
    s_right_halo = create_ring_eye_halo(s_face, (lv_coord_t)RIGHT_EYE_X, (lv_coord_t)EYE_Y);
    s_left_eye   = create_ring_eye(s_face, (lv_coord_t)LEFT_EYE_X,  (lv_coord_t)EYE_Y);
    s_right_eye  = create_ring_eye(s_face, (lv_coord_t)RIGHT_EYE_X, (lv_coord_t)EYE_Y);
    s_left_lid_top  = create_eye_lid(s_face, (lv_coord_t)LEFT_EYE_X,  (lv_coord_t)EYE_Y, TRUE);
    s_left_lid_bot  = create_eye_lid(s_face, (lv_coord_t)LEFT_EYE_X,  (lv_coord_t)(EYE_Y + EYE_D), FALSE);
    s_right_lid_top = create_eye_lid(s_face, (lv_coord_t)RIGHT_EYE_X, (lv_coord_t)EYE_Y, TRUE);
    s_right_lid_bot = create_eye_lid(s_face, (lv_coord_t)RIGHT_EYE_X, (lv_coord_t)(EYE_Y + EYE_D), FALSE);
    if (s_left_lid_top) {
        lv_obj_move_foreground(s_left_lid_top);
    }
    if (s_left_lid_bot) {
        lv_obj_move_foreground(s_left_lid_bot);
    }
    if (s_right_lid_top) {
        lv_obj_move_foreground(s_right_lid_top);
    }
    if (s_right_lid_bot) {
        lv_obj_move_foreground(s_right_lid_bot);
    }
    s_mouth      = create_smile_mouth(s_face);

    /* 思考小点（查询态用）：默认隐藏，居中置于嘴部下方 */
    s_dot[0] = create_think_dot(s_face, (lv_coord_t)DOTS_X0,                          (lv_coord_t)DOTS_Y);
    s_dot[1] = create_think_dot(s_face, (lv_coord_t)(DOTS_X0 + (DOT_D + DOT_GAP)),     (lv_coord_t)DOTS_Y);
    s_dot[2] = create_think_dot(s_face, (lv_coord_t)(DOTS_X0 + 2 * (DOT_D + DOT_GAP)), (lv_coord_t)DOTS_Y);

    s_left_base_h  = EYE_D;
    s_right_base_h = EYE_D;

    start_face_float();
    start_mouth_wiggle();

    /* 行为调度器：首拍 1.5s 后开始，之后由回调自行抖动续期 */
    s_play_timer = lv_timer_create(behavior_timer_cb, 1500, NULL);

    s_expr = EXPR_NEUTRAL;
    apply_expression(EXPR_NEUTRAL);
}

/* 云端情绪 emoji 名 → 表情；新增 listening/wake/awake 与 querying/searching 作为第二触发路径 */
static robot_expr_t robot_face_emoji_to_expr(const char *emoji)
{
    if (strcmp(emoji, "loving") == 0 || strcmp(emoji, "love") == 0 ||
        strcmp(emoji, "lovestruck") == 0) {
        return EXPR_LOVING;
    } else if (strcmp(emoji, "happy") == 0 || strcmp(emoji, "laughing") == 0) {
        return EXPR_HAPPY;
    } else if (strcmp(emoji, "sad") == 0) {
        return EXPR_SAD;
    } else if (strcmp(emoji, "thinking") == 0) {
        return EXPR_THINKING;
    } else if (strcmp(emoji, "listening") == 0 || strcmp(emoji, "wake") == 0 ||
               strcmp(emoji, "awake") == 0) {
        return EXPR_WAKE;
    } else if (strcmp(emoji, "querying") == 0 || strcmp(emoji, "searching") == 0) {
        return EXPR_QUERYING;
    }
    return EXPR_NEUTRAL;
}

/* 对话状态机状态字节（TY_DISPLAY_TP_CHAT_STAT，取值同 gui_common.h 的 GUI_STAT_*）→ 表情；
 * 返回 FALSE 表示该阶段不强制改表情（UPLOAD/SPEAK 等交给云端 emoji 驱动）。 */
static BOOL_T robot_face_chat_state_to_expr(UINT8_T st, robot_expr_t *out)
{
    switch (st) {
    case GUI_STAT_INIT:
    case GUI_STAT_IDLE:
        *out = EXPR_NEUTRAL;    /* 待机：恢复俏皮中性脸（待机动画保持不变） */
        return TRUE;
    case GUI_STAT_LISTEN:
        *out = EXPR_WAKE;       /* 被唤醒，正在聆听用户 */
        return TRUE;
    case GUI_STAT_THINK:
        *out = EXPR_QUERYING;   /* 处理中：联网 / MCP 查询、等待外部结果 */
        return TRUE;
    default:
        return FALSE;
    }
}

void robot_face_ui_msg_handler(TY_DISPLAY_MSG_T *msg)
{
    robot_expr_t new_expr;

    if (NULL == msg) {
        return;
    }

    if (TY_DISPLAY_TP_EMOJI == msg->type) {
        if (NULL == msg->data) {
            return;
        }
        new_expr = robot_face_emoji_to_expr((const char *)msg->data);
    } else if (TY_DISPLAY_TP_CHAT_STAT == msg->type) {
        if (NULL == msg->data) {
            return;
        }
        if (!robot_face_chat_state_to_expr(msg->data[0], &new_expr)) {
            return;
        }
    } else if (TY_DISPLAY_TP_HUMAN_CHAT == msg->type ||
               TY_DISPLAY_TP_STAT_WAKEUP == msg->type ||
               TY_DISPLAY_TP_STAT_LISTEN == msg->type) {
        new_expr = EXPR_WAKE;
    } else if (TY_DISPLAY_TP_AI_CHAT_START == msg->type ||
               TY_DISPLAY_TP_AI_CHAT_DATA == msg->type ||
               TY_DISPLAY_TP_STAT_SPEAK == msg->type) {
        new_expr = EXPR_HAPPY;
    } else if (TY_DISPLAY_TP_AI_CHAT_STOP == msg->type ||
               TY_DISPLAY_TP_STAT_IDLE == msg->type ||
               TY_DISPLAY_TP_STAT_SLEEP == msg->type) {
        new_expr = EXPR_NEUTRAL;
    } else {
        return;
    }

    if (new_expr == s_expr) {
        return;
    }
    s_expr = new_expr;
    apply_expression(new_expr);
}
