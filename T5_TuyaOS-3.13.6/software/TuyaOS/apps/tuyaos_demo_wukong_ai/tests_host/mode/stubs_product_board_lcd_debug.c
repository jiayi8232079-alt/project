#include "tal_display_service.h"
#include "tuya_cloud_types.h"
#include <stdlib.h>

unsigned int g_mock_flush_calls = 0;
unsigned int g_mock_sleep_calls = 0;
unsigned int g_mock_last_sleep_ms = 0;
unsigned int g_mock_last_flush_len = 0;
void *g_mock_last_flush_ptr = NULL;
ty_frame_buffer_t *g_mock_last_frame = NULL;
unsigned int g_mock_frame_free_calls = 0;
unsigned int g_mock_last_free_len = 0;

void *ty_frame_buff_malloc(RAM_TYPE_E type, UINT32_T size)
{
    ty_frame_buffer_t *fb = (ty_frame_buffer_t *)malloc(sizeof(ty_frame_buffer_t));
    if (fb == NULL) {
        return NULL;
    }

    fb->type = type;
    fb->frame = (UINT8_T *)malloc(size);
    if (fb->frame == NULL) {
        free(fb);
        return NULL;
    }

    fb->pdata = NULL;
    fb->len = size;
    fb->free_cb = NULL;
    fb->fmt = TY_PIXEL_FMT_RGB565;
    fb->x_start = 0;
    fb->y_start = 0;
    fb->width = 0;
    fb->height = 0;
    return fb;
}

OPERATE_RET ty_frame_buff_free(void *frame_buff)
{
    ty_frame_buffer_t *fb = (ty_frame_buffer_t *)frame_buff;
    if (fb == NULL) {
        return OPRT_INVALID_PARM;
    }

    g_mock_frame_free_calls++;
    g_mock_last_free_len = fb->len;
    free(fb->frame);
    free(fb);
    return OPRT_OK;
}

OPERATE_RET tal_display_flush(TY_DISPLAY_HANDLE handle, ty_frame_buffer_t *frame_buff)
{
    (void)handle;
    g_mock_flush_calls++;
    g_mock_last_frame = frame_buff;
    g_mock_last_flush_ptr = frame_buff ? frame_buff->frame : NULL;
    g_mock_last_flush_len = frame_buff ? frame_buff->len : 0;
    return OPRT_OK;
}

void tal_system_sleep(UINT_T ms)
{
    g_mock_sleep_calls++;
    g_mock_last_sleep_ms = ms;
}
