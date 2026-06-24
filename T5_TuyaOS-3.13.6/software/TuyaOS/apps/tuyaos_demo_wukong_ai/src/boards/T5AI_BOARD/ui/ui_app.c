/**
 * @file ui_app.c
 * @brief T5AI_BOARD UI 分发层
 *        根据编译配置将 app_ui_init / app_ui_msg_handler 路由到对应 UI 后端：
 *          - PRODUCT_BOARD_SPI_LCD：机器人表情动画（robot_face_ui）
 *          - ENABLE_T5AI_BOARD_UI_WECHAT：微信 UI
 *          - ENABLE_T5AI_BOARD_UI_DESKTOP：桌面 UI（默认）
 * @version 1.1
 * @date 2025-04-02
 * @copyright Copyright (c) Tuya Inc.
 */
#include "tuya_ai_display.h"
#include "tuya_board_config.h"
#include "tuya_app_config.h"

/* ---------------------------------------------------------------------------
 * SPI LCD 产品板：机器人表情 UI
 * --------------------------------------------------------------------------- */
#if defined(PRODUCT_BOARD_SPI_LCD) && (PRODUCT_BOARD_SPI_LCD == 1)
extern void robot_face_ui_init(void);
extern void robot_face_ui_msg_handler(TY_DISPLAY_MSG_T *msg);
#endif

/* ---------------------------------------------------------------------------
 * 微信 UI / 桌面 UI（非 SPI LCD 产品板时使用）
 * --------------------------------------------------------------------------- */
extern void wechat_ui_init(void);
extern void wechat_ui_msg_handler(TY_DISPLAY_MSG_T *msg);
extern void desktop_ui_init(void);
extern void desktop_ui_msg_handler(TY_DISPLAY_MSG_T *msg);

/* ---------------------------------------------------------------------------
 * 函数实现
 * --------------------------------------------------------------------------- */

/**
 * @brief UI 初始化，根据编译开关分发到对应 UI 后端
 */
void app_ui_init(void)
{
#if defined(PRODUCT_BOARD_SPI_LCD) && (PRODUCT_BOARD_SPI_LCD == 1)
    /* SPI LCD 产品板：使用机器人表情动画 UI */
    robot_face_ui_init();
#elif defined(ENABLE_T5AI_BOARD_UI_WECHAT) && (ENABLE_T5AI_BOARD_UI_WECHAT == 1)
    wechat_ui_init();
#elif defined(ENABLE_T5AI_BOARD_UI_DESKTOP) && (ENABLE_T5AI_BOARD_UI_DESKTOP == 1)
    desktop_ui_init();
#endif
}

/**
 * @brief 处理显示消息，分发到对应 UI 后端
 * @param[in] msg 显示消息
 */
void app_ui_msg_handler(TY_DISPLAY_MSG_T *msg)
{
    if (NULL == msg) {
        return;
    }

#if defined(PRODUCT_BOARD_SPI_LCD) && (PRODUCT_BOARD_SPI_LCD == 1)
    robot_face_ui_msg_handler(msg);
#elif defined(ENABLE_T5AI_BOARD_UI_WECHAT) && (ENABLE_T5AI_BOARD_UI_WECHAT == 1)
    wechat_ui_msg_handler(msg);
#elif defined(ENABLE_T5AI_BOARD_UI_DESKTOP) && (ENABLE_T5AI_BOARD_UI_DESKTOP == 1)
    desktop_ui_msg_handler(msg);
#endif
}
