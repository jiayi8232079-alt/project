#include "wukong_test.h"
#include "tal_display_service.h"

void product_board_lcd_red_screen_test(TY_DISPLAY_HANDLE handle);

extern unsigned int g_mock_flush_calls;
extern unsigned int g_mock_sleep_calls;
extern unsigned int g_mock_last_sleep_ms;
extern unsigned int g_mock_last_flush_len;
extern void *g_mock_last_flush_ptr;
extern ty_frame_buffer_t *g_mock_last_frame;
extern unsigned int g_mock_frame_free_calls;
extern unsigned int g_mock_last_free_len;

static void reset_mocks(void)
{
    g_mock_flush_calls = 0;
    g_mock_sleep_calls = 0;
    g_mock_last_sleep_ms = 0;
    g_mock_last_flush_len = 0;
    g_mock_last_flush_ptr = NULL;
    g_mock_last_frame = NULL;
    g_mock_frame_free_calls = 0;
    g_mock_last_free_len = 0;
}

int main(void)
{
    ty_display_device_s device = {.type = DISPLAY_SPI};

    reset_mocks();
    product_board_lcd_red_screen_test(NULL);
    EXPECT_EQ(g_mock_flush_calls, 0,
              "null display handle should not flush");

    reset_mocks();
    product_board_lcd_red_screen_test(&device);
    EXPECT_EQ(g_mock_flush_calls, 1,
              "valid SPI handle should flush exactly once");
    EXPECT_EQ(g_mock_sleep_calls, 1,
              "valid SPI handle should wait for async flush completion");
    EXPECT_EQ(g_mock_last_sleep_ms, 1000,
              "red screen test should wait 1000ms after flush");
    EXPECT_EQ(g_mock_last_frame->width, 240,
              "red screen width should cover full panel");
    EXPECT_EQ(g_mock_last_frame->height, 320,
              "red screen height should cover full panel");
    EXPECT_EQ(g_mock_last_frame->x_start, 0,
              "red screen should start from left edge");
    EXPECT_EQ(g_mock_last_frame->y_start, 0,
              "red screen should start from top edge");
    EXPECT_EQ(g_mock_last_frame->fmt, TY_PIXEL_FMT_RGB565,
              "red screen should use RGB565 pixels");
    EXPECT_EQ(g_mock_last_flush_len, 240 * 320 * 2,
              "red screen buffer length should match full screen RGB565");
    EXPECT_EQ(g_mock_last_frame->frame[0], 0xF8,
              "red screen high byte should be 0xF8");
    EXPECT_EQ(g_mock_last_frame->frame[1], 0x00,
              "red screen low byte should be 0x00");
    EXPECT_EQ(g_mock_last_frame->frame[g_mock_last_flush_len - 2], 0xF8,
              "last pixel high byte should stay red");
    EXPECT_EQ(g_mock_last_frame->frame[g_mock_last_flush_len - 1], 0x00,
              "last pixel low byte should stay red");

    g_mock_last_frame->free_cb((UINT8_T *)g_mock_last_frame);
    EXPECT_EQ(g_mock_frame_free_calls, 1,
              "frame free callback should release frame buffer");
    EXPECT_EQ(g_mock_last_free_len, 240 * 320 * 2,
              "released frame buffer should keep original length metadata");

    TEST_END();
}
