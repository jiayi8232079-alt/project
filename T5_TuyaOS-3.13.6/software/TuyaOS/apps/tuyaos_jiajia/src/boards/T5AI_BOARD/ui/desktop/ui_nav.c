/**
 * @file ui_nav.c
 * @brief Screen navigation stack manager for T5AI_BOARD
 * @version 1.0
 * @date 2025-04-02
 * @copyright Copyright (c) Tuya Inc.
 */
#include "ui_private.h"

/* ---------------------------------------------------------------------------
 * Macros
 * --------------------------------------------------------------------------- */
#define NAV_STACK_DEPTH  8

/* ---------------------------------------------------------------------------
 * Type definitions
 * --------------------------------------------------------------------------- */
typedef lv_obj_t *(*ui_nav_get_scr_fn)(VOID_T);

typedef struct {
    UI_SCR_ID_E id;
    ui_nav_get_scr_fn get_scr;
} UI_NAV_ENTRY_T;

/* ---------------------------------------------------------------------------
 * File scope variables
 * --------------------------------------------------------------------------- */
STATIC UI_SCR_ID_E s_nav_stack[NAV_STACK_DEPTH];
STATIC INT_T s_nav_top = -1;

STATIC CONST UI_NAV_ENTRY_T s_nav_table[] = {
    { UI_SCR_HOME,   NULL },
    { UI_SCR_CHAT,   ui_chat_get_scr },
    { UI_SCR_CAMERA, ui_camera_get_scr },
    { UI_SCR_ALBUM,  ui_album_get_scr },
    { UI_SCR_ALBUM_GRID, ui_album_grid_get_scr },
};

#define NAV_TABLE_SIZE (sizeof(s_nav_table) / sizeof(s_nav_table[0]))

/* ---------------------------------------------------------------------------
 * Function implementations
 * --------------------------------------------------------------------------- */

/**
 * @brief Find lv_obj screen pointer by screen ID
 * @param[in] id screen ID
 * @return screen object or NULL
 */
STATIC lv_obj_t *__nav_id_to_scr(UI_SCR_ID_E id)
{
    UINT32_T i;
    for (i = 0; i < NAV_TABLE_SIZE; i++) {
        if (s_nav_table[i].id == id && s_nav_table[i].get_scr) {
            return s_nav_table[i].get_scr();
        }
    }
    return NULL;
}

/**
 * @brief Ensure a screen is created and load it
 * @param[in] id screen ID to show
 * @return none
 */
STATIC VOID_T __nav_show_scr(UI_SCR_ID_E id)
{
    switch (id) {
    case UI_SCR_HOME:
        setup_scr_home(6, 20, "星期三", 2, 4);
        break;
    case UI_SCR_CHAT:
        ui_chat_show();
        break;
    case UI_SCR_CAMERA:
        ui_camera_show();
        break;
    case UI_SCR_ALBUM:
        ui_album_show();
        break;
    case UI_SCR_ALBUM_GRID:
        ui_album_grid_show();
        break;
    default:
        break;
    }
}

/**
 * @brief Initialize the navigation stack
 * @return none
 */
VOID_T ui_nav_init(VOID_T)
{
    s_nav_top = -1;
}

/**
 * @brief Navigate to a screen, pushing current onto the stack
 * @param[in] id target screen ID
 * @return none
 */
VOID_T ui_nav_to(UI_SCR_ID_E id)
{
    if (id == UI_SCR_NONE || id >= UI_SCR_MAX) {
        return;
    }

    if (s_nav_top >= 0 && s_nav_stack[s_nav_top] == id) {
        return;
    }

    if (s_nav_top < NAV_STACK_DEPTH - 1) {
        s_nav_top++;
    } else {
        UINT32_T i;
        for (i = 0; i < NAV_STACK_DEPTH - 1; i++) {
            s_nav_stack[i] = s_nav_stack[i + 1];
        }
    }
    s_nav_stack[s_nav_top] = id;

    __nav_show_scr(id);
}

/**
 * @brief Go back to the previous screen in the stack
 * @return none
 */
VOID_T ui_nav_back(VOID_T)
{
    if (s_nav_top <= 0) {
        return;
    }

    s_nav_top--;
    UI_SCR_ID_E prev = s_nav_stack[s_nav_top];

    __nav_show_scr(prev);
}

/**
 * @brief Replace current screen without pushing (for screen refresh)
 * @param[in] id target screen ID
 * @return none
 */
VOID_T ui_nav_replace(UI_SCR_ID_E id)
{
    if (id == UI_SCR_NONE || id >= UI_SCR_MAX) {
        return;
    }

    if (s_nav_top < 0) {
        s_nav_top = 0;
    }
    s_nav_stack[s_nav_top] = id;

    __nav_show_scr(id);
}

/**
 * @brief Get the current screen ID
 * @return current screen ID, UI_SCR_NONE if stack is empty
 */
UI_SCR_ID_E ui_nav_current(VOID_T)
{
    if (s_nav_top < 0) {
        return UI_SCR_NONE;
    }
    return s_nav_stack[s_nav_top];
}

/**
 * @brief Get the previous screen ID (one below top of stack)
 * @return previous screen ID, UI_SCR_NONE if no previous
 */
UI_SCR_ID_E ui_nav_previous(VOID_T)
{
    if (s_nav_top < 1) {
        return UI_SCR_NONE;
    }
    return s_nav_stack[s_nav_top - 1];
}
