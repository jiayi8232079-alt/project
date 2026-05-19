/**
 * @file ui_app.c
 * @brief UI dispatch layer for T5AI_BOARD.
 *        Routes app_ui_init / app_ui_msg_handler to the selected UI
 *        backend (wechat or desktop) based on build configuration.
 * @version 1.0
 * @date 2025-04-02
 * @copyright Copyright (c) Tuya Inc.
 */
#include "tuya_ai_display.h"
#include "tuya_board_config.h"
#include "tuya_app_config.h"

/* ---------------------------------------------------------------------------
 * External declarations from UI backends
 * --------------------------------------------------------------------------- */
extern void wechat_ui_init(void);
extern void wechat_ui_msg_handler(TY_DISPLAY_MSG_T *msg);
extern void desktop_ui_init(void);
extern void desktop_ui_msg_handler(TY_DISPLAY_MSG_T *msg);

/* ---------------------------------------------------------------------------
 * Function implementations
 * --------------------------------------------------------------------------- */
/**
 * @brief UI initialization, dispatches to selected backend
 * @return none
 */
void app_ui_init(void)
{
#if defined(ENABLE_T5AI_BOARD_UI_WECHAT) && (ENABLE_T5AI_BOARD_UI_WECHAT == 1)
    wechat_ui_init();
#elif defined(ENABLE_T5AI_BOARD_UI_DESKTOP) && (ENABLE_T5AI_BOARD_UI_DESKTOP == 1)  
    desktop_ui_init();
#endif
}

/**
 * @brief Handle display messages, dispatches to selected backend
 * @param[in] msg display message
 * @return none
 */
void app_ui_msg_handler(TY_DISPLAY_MSG_T *msg)
{
    if (NULL == msg) {
        return;
    }

#if defined(ENABLE_T5AI_BOARD_UI_WECHAT) && (ENABLE_T5AI_BOARD_UI_WECHAT == 1)
    wechat_ui_msg_handler(msg);
#elif defined(ENABLE_T5AI_BOARD_UI_DESKTOP) && (ENABLE_T5AI_BOARD_UI_DESKTOP == 1)
    desktop_ui_msg_handler(msg);
#endif
}
