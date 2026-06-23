/**
 * @file product_board_lcd_debug.h
 * @brief 产品板 SPI LCD 调试接口（0.0.12 调试用）
 */
#ifndef PRODUCT_BOARD_LCD_DEBUG_H
#define PRODUCT_BOARD_LCD_DEBUG_H

#include "tal_display_service.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief LCD open 后刷满屏 RGB565 红色，用于验证 SPI 像素通路（与 LVGL 无关）
 */
void product_board_lcd_red_screen_test(TY_DISPLAY_HANDLE handle);

#ifdef __cplusplus
}
#endif

#endif
