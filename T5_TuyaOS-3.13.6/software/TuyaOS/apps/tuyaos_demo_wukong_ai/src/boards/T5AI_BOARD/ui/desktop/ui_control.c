/**
 * @file ui_control.c
 * @brief Control center UI for T5AI_BOARD (320x480), triggered by swipe-down
 * @version 1.0
 * @date 2025-04-02
 * @copyright Copyright (c) Tuya Inc.
 */
#include "ui_private.h"
#include "tuya_ai_display.h"
#include "uni_log.h"

/* ---------------------------------------------------------------------------
 * Font declarations
 * --------------------------------------------------------------------------- */
LV_FONT_DECLARE(AlibabaPuHuiTi3_Regular18_Static);

/* ---------------------------------------------------------------------------
 * Icon declarations
 * --------------------------------------------------------------------------- */
LV_IMG_DECLARE(icon_volume);
LV_IMG_DECLARE(icon_brightness);
LV_IMG_DECLARE(icon_clock_vol);
LV_IMG_DECLARE(icon_up);
LV_IMG_DECLARE(icon_photo_app);
LV_IMG_DECLARE(icon_camera_app);
LV_IMG_DECLARE(icon_arrow_yellow);

/* ---------------------------------------------------------------------------
 * Macros
 * --------------------------------------------------------------------------- */
#define CTRL_BG_COLOR           0x25262A
#define CTRL_SLIDER_BG          0xB8BDDE
#define CTRL_SLIDER_FILL        0xFFF37B
#define CTRL_SLIDER_BG_OPA      28
#define CTRL_SLIDER_W           76
#define CTRL_SLIDER_H           210
#define CTRL_SLIDER_RADIUS      (CTRL_SLIDER_W / 2)
#define CTRL_SLIDER_Y           40
#define CTRL_SLIDER_GAP         16
#define CTRL_ICON_SIZE          24

#define CTRL_CARD_H             75
#define CTRL_CARD_GAP           12
#define CTRL_CARD_RADIUS        16
#define CTRL_CARD_BG            0xB8BDDE
#define CTRL_CARD_BG_OPA        28
#define CTRL_CARD_PAD           12
#define CTRL_CARD_COLS          2

/* ---------------------------------------------------------------------------
 * Type definitions
 * --------------------------------------------------------------------------- */
typedef struct {
    CONST lv_img_dsc_t *icon;
    CONST CHAR_T *label;
    TY_DISPLAY_ACTION_E action;
} CTRL_CARD_CFG_T;

typedef struct {
    lv_obj_t *ctrl_scr;
    lv_obj_t *prev_scr;
    lv_obj_t *volume_sli;
    lv_obj_t *brightness_sli;
    lv_obj_t *alarm_vol_sli;
    lv_obj_t *volume_icon;
    lv_obj_t *brightness_icon;
    lv_obj_t *alarm_vol_icon;
    lv_obj_t *up_icon;
    lv_obj_t *up_btn;
} CTRL_UI_T;

/* ---------------------------------------------------------------------------
 * File scope variables
 * --------------------------------------------------------------------------- */
STATIC CTRL_UI_T s_ctrl_ui = {0};

STATIC CONST CTRL_CARD_CFG_T s_card_cfgs[] = {
    { &icon_photo_app,  "相册", TY_DISP_ACT_OPEN_ALBUM },
    { &icon_camera_app, "相机", TY_DISP_ACT_OPEN_CAMERA },
};

#define CTRL_CARD_COUNT (sizeof(s_card_cfgs) / sizeof(s_card_cfgs[0]))

/* ---------------------------------------------------------------------------
 * Forward declarations
 * --------------------------------------------------------------------------- */
STATIC VOID_T __ctrl_slider_event_cb(lv_event_t *e);
STATIC VOID_T __ctrl_dismiss(VOID_T);
STATIC VOID_T __ctrl_dismiss_cb(lv_event_t *e);
STATIC VOID_T __ctrl_gesture_cb(lv_event_t *e);
STATIC VOID_T __ctrl_open_gesture_cb(lv_event_t *e);
STATIC VOID_T __ctrl_card_click_cb(lv_event_t *e);
STATIC VOID_T __ctrl_create_slider(lv_obj_t *parent, lv_obj_t **sli,
                                   lv_coord_t x, INT_T value);
STATIC lv_obj_t *__ctrl_create_card(lv_obj_t *parent,
                                    CONST CTRL_CARD_CFG_T *cfg,
                                    lv_coord_t x, lv_coord_t y,
                                    lv_coord_t w, lv_coord_t h);

/* ---------------------------------------------------------------------------
 * Function implementations
 * --------------------------------------------------------------------------- */

/**
 * @brief Create a vertical slider with rounded-pill style
 * @param[in] parent parent screen object
 * @param[out] sli pointer to store created slider handle
 * @param[in] x horizontal position
 * @param[in] value initial slider value (0-100)
 * @return none
 */
STATIC VOID_T __ctrl_create_slider(lv_obj_t *parent, lv_obj_t **sli,
                                   lv_coord_t x, INT_T value)
{
    *sli = lv_slider_create(parent);
    lv_slider_set_range(*sli, 0, 100);
    lv_slider_set_value(*sli, value, LV_ANIM_OFF);
    lv_obj_set_pos(*sli, x, CTRL_SLIDER_Y);
    lv_obj_set_size(*sli, CTRL_SLIDER_W, CTRL_SLIDER_H);

    lv_obj_set_style_radius(*sli, CTRL_SLIDER_RADIUS, LV_PART_MAIN);
    lv_obj_set_style_bg_opa(*sli, CTRL_SLIDER_BG_OPA, LV_PART_MAIN);
    lv_obj_set_style_bg_color(*sli, lv_color_hex(CTRL_SLIDER_BG), LV_PART_MAIN);

    lv_obj_set_style_radius(*sli, CTRL_SLIDER_RADIUS, LV_PART_INDICATOR);
    lv_obj_set_style_bg_color(*sli, lv_color_hex(CTRL_SLIDER_FILL), LV_PART_INDICATOR);

    lv_obj_set_style_bg_opa(*sli, LV_OPA_TRANSP, LV_PART_KNOB);

    lv_obj_clear_flag(*sli, LV_OBJ_FLAG_GESTURE_BUBBLE);
    lv_obj_add_event_cb(*sli, __ctrl_slider_event_cb, LV_EVENT_VALUE_CHANGED, NULL);
}

/**
 * @brief Create a shortcut card with icon, label and arrow
 * @param[in] parent parent screen object
 * @param[in] cfg card configuration (icon + label)
 * @param[in] x horizontal position
 * @param[in] y vertical position
 * @param[in] w card width
 * @param[in] h card height
 * @return created card object
 */
STATIC lv_obj_t *__ctrl_create_card(lv_obj_t *parent,
                                    CONST CTRL_CARD_CFG_T *cfg,
                                    lv_coord_t x, lv_coord_t y,
                                    lv_coord_t w, lv_coord_t h)
{
    lv_obj_t *card = lv_obj_create(parent);
    lv_obj_set_pos(card, x, y);
    lv_obj_set_size(card, w, h);
    lv_obj_set_scrollbar_mode(card, LV_SCROLLBAR_MODE_OFF);
    lv_obj_set_style_border_width(card, 0, 0);
    lv_obj_set_style_radius(card, CTRL_CARD_RADIUS, 0);
    lv_obj_set_style_bg_opa(card, CTRL_CARD_BG_OPA, 0);
    lv_obj_set_style_bg_color(card, lv_color_hex(CTRL_CARD_BG), 0);
    lv_obj_set_style_pad_all(card, 0, 0);

    lv_obj_t *icon = lv_img_create(card);
    lv_img_set_src(icon, cfg->icon);
    lv_obj_set_pos(icon, CTRL_CARD_PAD, CTRL_CARD_PAD);

    lv_obj_t *arrow = lv_img_create(card);
    lv_img_set_src(arrow, &icon_arrow_yellow);
    lv_obj_set_pos(arrow, w - CTRL_CARD_PAD - CTRL_ICON_SIZE, CTRL_CARD_PAD);

    lv_obj_t *label = lv_label_create(card);
    lv_label_set_text(label, cfg->label);
    lv_obj_set_pos(label, CTRL_CARD_PAD, h - 18 - CTRL_CARD_PAD);
    lv_obj_set_style_text_color(label, lv_color_hex(0xFFFFFF), 0);
    lv_obj_set_style_text_font(label, &AlibabaPuHuiTi3_Regular18_Static, 0);

    lv_obj_add_flag(card, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(card, __ctrl_card_click_cb, LV_EVENT_CLICKED, (VOID_T *)cfg);

    return card;
}

/**
 * @brief Slider value changed callback (placeholder for actual control logic)
 * @param[in] e LVGL event
 * @return none
 */
STATIC VOID_T __ctrl_slider_event_cb(lv_event_t *e)
{
    lv_obj_t *sli = lv_event_get_target(e);
    INT_T val = lv_slider_get_value(sli);

    if (sli == s_ctrl_ui.volume_sli) {
        TAL_PR_DEBUG("volume: %d", val);
    } else if (sli == s_ctrl_ui.brightness_sli) {
        TAL_PR_DEBUG("brightness: %d", val);
    } else if (sli == s_ctrl_ui.alarm_vol_sli) {
        TAL_PR_DEBUG("alarm_vol: %d", val);
    }
}

/**
 * @brief Card click callback, dismisses control center and posts action
 * @param[in] e LVGL event
 * @return none
 */
STATIC VOID_T __ctrl_card_click_cb(lv_event_t *e)
{
    CONST CTRL_CARD_CFG_T *cfg = (CONST CTRL_CARD_CFG_T *)lv_event_get_user_data(e);
    if (cfg == NULL) {
        return;
    }

    TAL_PR_DEBUG("card clicked: %s, action: %d", cfg->label, cfg->action);
    __ctrl_dismiss();
    tuya_ai_display_action_post(NULL, 0, cfg->action);
}

/**
 * @brief Switch back to previous screen and delete control center
 * @return none
 */
STATIC VOID_T __ctrl_dismiss(VOID_T)
{
    if (s_ctrl_ui.ctrl_scr == NULL) {
        return;
    }

    if (s_ctrl_ui.prev_scr) {
        lv_scr_load(s_ctrl_ui.prev_scr);
    }

    lv_obj_del(s_ctrl_ui.ctrl_scr);
    s_ctrl_ui.ctrl_scr = NULL;
    s_ctrl_ui.prev_scr = NULL;
}

/**
 * @brief Dismiss button click callback
 * @param[in] e LVGL event
 * @return none
 */
STATIC VOID_T __ctrl_dismiss_cb(lv_event_t *e)
{
    (VOID_T)e;
    __ctrl_dismiss();
}

/**
 * @brief Control center gesture callback, swipe-up to dismiss
 * @param[in] e LVGL event
 * @return none
 */
STATIC VOID_T __ctrl_gesture_cb(lv_event_t *e)
{
    (VOID_T)e;
    lv_dir_t dir = lv_indev_get_gesture_dir(lv_indev_get_act());
    if (dir == LV_DIR_TOP) {
        __ctrl_dismiss();
    }
}

/**
 * @brief Build and show the control center overlay screen
 * @param[in] volume current volume (0-100)
 * @param[in] brightness current brightness (0-100)
 * @param[in] alarm_vol current alarm volume (0-100)
 * @return none
 */
VOID_T setup_scr_control(UINT8_T volume, UINT8_T brightness, UINT8_T alarm_vol)
{
    lv_coord_t scr_w = LV_HOR_RES;
    lv_coord_t total_w = CTRL_SLIDER_W * 3 + CTRL_SLIDER_GAP * 2;
    lv_coord_t x_start = (scr_w - total_w) / 2;

    s_ctrl_ui.prev_scr = lv_scr_act();

    s_ctrl_ui.ctrl_scr = lv_obj_create(NULL);
    lv_obj_set_size(s_ctrl_ui.ctrl_scr, LV_HOR_RES, LV_VER_RES);
    lv_obj_set_scrollbar_mode(s_ctrl_ui.ctrl_scr, LV_SCROLLBAR_MODE_OFF);
    lv_obj_set_style_bg_color(s_ctrl_ui.ctrl_scr, lv_color_hex(CTRL_BG_COLOR), 0);
    lv_obj_set_style_pad_all(s_ctrl_ui.ctrl_scr, 0, 0);

    /* ---- Three vertical sliders ---- */
    __ctrl_create_slider(s_ctrl_ui.ctrl_scr, &s_ctrl_ui.volume_sli,
                         x_start, volume);
    __ctrl_create_slider(s_ctrl_ui.ctrl_scr, &s_ctrl_ui.brightness_sli,
                         x_start + CTRL_SLIDER_W + CTRL_SLIDER_GAP, brightness);
    __ctrl_create_slider(s_ctrl_ui.ctrl_scr, &s_ctrl_ui.alarm_vol_sli,
                         x_start + (CTRL_SLIDER_W + CTRL_SLIDER_GAP) * 2, alarm_vol);

    /* ---- Icons centered at bottom of each slider ---- */
    lv_coord_t icon_y = CTRL_SLIDER_Y + CTRL_SLIDER_H - CTRL_ICON_SIZE - 16;

    s_ctrl_ui.volume_icon = lv_img_create(s_ctrl_ui.ctrl_scr);
    lv_img_set_src(s_ctrl_ui.volume_icon, &icon_volume);
    lv_obj_set_pos(s_ctrl_ui.volume_icon,
                   x_start + (CTRL_SLIDER_W - CTRL_ICON_SIZE) / 2, icon_y);

    s_ctrl_ui.brightness_icon = lv_img_create(s_ctrl_ui.ctrl_scr);
    lv_img_set_src(s_ctrl_ui.brightness_icon, &icon_brightness);
    lv_obj_set_pos(s_ctrl_ui.brightness_icon,
                   x_start + CTRL_SLIDER_W + CTRL_SLIDER_GAP +
                   (CTRL_SLIDER_W - CTRL_ICON_SIZE) / 2, icon_y);

    s_ctrl_ui.alarm_vol_icon = lv_img_create(s_ctrl_ui.ctrl_scr);
    lv_img_set_src(s_ctrl_ui.alarm_vol_icon, &icon_clock_vol);
    lv_obj_set_pos(s_ctrl_ui.alarm_vol_icon,
                   x_start + (CTRL_SLIDER_W + CTRL_SLIDER_GAP) * 2 +
                   (CTRL_SLIDER_W - CTRL_ICON_SIZE) / 2, icon_y);

    /* ---- Shortcut cards below sliders ---- */
    lv_coord_t card_y = CTRL_SLIDER_Y + CTRL_SLIDER_H + CTRL_SLIDER_GAP;
    lv_coord_t card_w = (total_w - CTRL_CARD_GAP * (CTRL_CARD_COLS - 1)) / CTRL_CARD_COLS;
    UINT32_T i;

    for (i = 0; i < CTRL_CARD_COUNT; i++) {
        UINT32_T col = i % CTRL_CARD_COLS;
        UINT32_T row = i / CTRL_CARD_COLS;
        lv_coord_t cx = x_start + col * (card_w + CTRL_CARD_GAP);
        lv_coord_t cy = card_y + row * (CTRL_CARD_H + CTRL_CARD_GAP);
        __ctrl_create_card(s_ctrl_ui.ctrl_scr, &s_card_cfgs[i],
                           cx, cy, card_w, CTRL_CARD_H);
    }

    /* ---- Bottom dismiss arrow (swipe-up hint) ---- */
    s_ctrl_ui.up_icon = lv_img_create(s_ctrl_ui.ctrl_scr);
    lv_img_set_src(s_ctrl_ui.up_icon, &icon_up);
    lv_obj_align(s_ctrl_ui.up_icon, LV_ALIGN_BOTTOM_MID, 0, -30);

    s_ctrl_ui.up_btn = lv_btn_create(s_ctrl_ui.ctrl_scr);
    lv_obj_remove_style_all(s_ctrl_ui.up_btn);
    lv_obj_set_size(s_ctrl_ui.up_btn, 100, 40);
    lv_obj_align(s_ctrl_ui.up_btn, LV_ALIGN_BOTTOM_MID, 0, -20);
    lv_obj_add_event_cb(s_ctrl_ui.up_btn, __ctrl_dismiss_cb, LV_EVENT_CLICKED, NULL);

    lv_obj_add_event_cb(s_ctrl_ui.ctrl_scr, __ctrl_gesture_cb, LV_EVENT_GESTURE, NULL);

    lv_obj_update_layout(s_ctrl_ui.ctrl_scr);
    lv_scr_load(s_ctrl_ui.ctrl_scr);
    lv_indev_wait_release(lv_indev_get_act());
}

/**
 * @brief Check whether control center is currently visible
 * @return TRUE if visible, FALSE otherwise
 */
BOOL_T ui_control_is_active(VOID_T)
{
    return (s_ctrl_ui.ctrl_scr != NULL) ? TRUE : FALSE;
}

/**
 * @brief Gesture callback that opens control center on swipe-down
 * @param[in] e LVGL event
 * @return none
 */
STATIC VOID_T __ctrl_open_gesture_cb(lv_event_t *e)
{
    (VOID_T)e;
    lv_dir_t dir = lv_indev_get_gesture_dir(lv_indev_get_act());
    if (dir == LV_DIR_BOTTOM && !ui_control_is_active()) {
        setup_scr_control(50, 50, 50);
    }
}

/**
 * @brief Register swipe-down gesture on any screen to open control center
 * @param[in] scr screen object to register gesture on
 * @return none
 * @note Call this in every screen's setup function after creating the screen
 */
VOID_T ui_control_register_gesture(lv_obj_t *scr)
{
    if (scr) {
        lv_obj_add_event_cb(scr, __ctrl_open_gesture_cb, LV_EVENT_GESTURE, NULL);
    }
}
