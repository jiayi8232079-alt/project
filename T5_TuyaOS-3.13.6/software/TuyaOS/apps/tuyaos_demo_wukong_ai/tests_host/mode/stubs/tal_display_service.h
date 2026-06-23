#ifndef __TAL_DISPLAY_SERVICE_H__
#define __TAL_DISPLAY_SERVICE_H__

#include "tuya_cloud_types.h"

typedef enum {
    DISPLAY_SPI = 1,
} TUYA_DISPLAY_TYPE_E;

typedef enum {
    TY_PIXEL_FMT_RGB565 = 0,
} DISPLAY_PIXEL_FORMAT_E;

typedef enum {
    TYPE_SRAM = 0,
    TYPE_PSRAM,
} RAM_TYPE_E;

typedef void (*frame_buff_free_cb)(UINT8_T *frame_buff);

typedef struct {
    RAM_TYPE_E type;
    DISPLAY_PIXEL_FORMAT_E fmt;
    uint16_t x_start;
    uint16_t y_start;
    uint16_t width;
    uint16_t height;
    frame_buff_free_cb free_cb;
    UINT32_T len;
    uint8_t *frame;
    uint8_t *pdata;
} ty_frame_buffer_t;

typedef struct {
    TUYA_DISPLAY_TYPE_E type;
} ty_display_device_s;

typedef ty_display_device_s *TY_DISPLAY_HANDLE;

void *ty_frame_buff_malloc(RAM_TYPE_E type, UINT32_T size);
OPERATE_RET ty_frame_buff_free(void *frame_buff);
OPERATE_RET tal_display_flush(TY_DISPLAY_HANDLE handle, ty_frame_buffer_t *frame_buff);
void tal_system_sleep(UINT_T ms);

#endif
