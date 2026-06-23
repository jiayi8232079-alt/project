/**
 * @file product_board_lcd_debug.c
 * @brief 产品板 SPI LCD 上电满屏红色测试（0.0.12 调试固件）
 */
#include "tuya_app_config.h"

#if defined(PRODUCT_BOARD_SPI_LCD) && (PRODUCT_BOARD_SPI_LCD == 1)

#include "product_board_lcd_debug.h"
#include "ty_frame_buff.h"
#include "tal_display_service.h"
#include "tal_system.h"
#include "tal_log.h"

#define LCD_DBG_W               240
#define LCD_DBG_H               320
/* spi_task 异步刷帧，等待完成后再继续 GUI 初始化 */
#define LCD_DBG_FLUSH_WAIT_MS   1000

static void __lcd_dbg_frame_free(UINT8_T *frame_buff)
{
    if (frame_buff != NULL) {
        ty_frame_buff_free(frame_buff);
    }
}

void product_board_lcd_red_screen_test(TY_DISPLAY_HANDLE handle)
{
    ty_frame_buffer_t *fb = NULL;
    UINT8_T *pixels = NULL;
    UINT32_T pix_cnt;
    UINT32_T buf_len;
    OPERATE_RET rt;

    if (handle == NULL || handle->type != DISPLAY_SPI) {
        TAL_PR_ERR("lcd dbg: invalid display handle");
        return;
    }

    pix_cnt = (UINT32_T)LCD_DBG_W * LCD_DBG_H;
    buf_len = pix_cnt * 2;

    fb = (ty_frame_buffer_t *)ty_frame_buff_malloc(TYPE_PSRAM, buf_len);
    if (fb == NULL) {
        TAL_PR_ERR("lcd dbg: pixel buf alloc %u fail", buf_len);
        return;
    }

    pixels = fb->frame;
    /* ST7789 SPI 线序：高字节在前，RGB565 红 = 0xF800 → 0xF8, 0x00 */
    for (UINT32_T i = 0; i < pix_cnt; i++) {
        pixels[i * 2]     = 0xF8;
        pixels[i * 2 + 1] = 0x00;
    }

    fb->fmt = TY_PIXEL_FMT_RGB565;
    fb->x_start = 0;
    fb->y_start = 0;
    fb->width = LCD_DBG_W;
    fb->height = LCD_DBG_H;
    fb->len = buf_len;
    fb->free_cb = __lcd_dbg_frame_free;

    TAL_PR_NOTICE("lcd dbg: red full-screen test start (%dx%d)", LCD_DBG_W, LCD_DBG_H);
    rt = tal_display_flush(handle, fb);
    if (rt != OPRT_OK) {
        TAL_PR_ERR("lcd dbg: tal_display_flush fail %d", rt);
        ty_frame_buff_free(fb);
        return;
    }

    tal_system_sleep(LCD_DBG_FLUSH_WAIT_MS);
    TAL_PR_NOTICE("lcd dbg: red full-screen test done");
}

#endif /* PRODUCT_BOARD_SPI_LCD */
