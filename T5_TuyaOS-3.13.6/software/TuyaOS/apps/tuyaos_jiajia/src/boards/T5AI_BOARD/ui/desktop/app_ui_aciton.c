/**
 * @file app_ui_aciton.c
 * @brief UI action handler for T5AI_BOARD
 * @version 1.0
 * @date 2025-04-02
 * @copyright Copyright (c) Tuya Inc.
 */
#include "lv_vendor.h"
#include "tuya_ai_display.h"
#include "tal_camera.h"
#include "tuya_device_camera.h"
#include "ui_private.h"
#include "wukong_ai_agent.h"
#include "wukong_picture.h"
#include "wukong_picture_input.h"

#define ALBUM_GRID_THUMB_SIZE  96
#define ALBUM_GRID_MAX_SELECT  30

static WUKONG_PICTURE_THUMB_LIST_T s_thumb_list = {0};

STATIC void __display_camera_yuv_fram(TAL_CAMERA_FRAME_T *frame)
{
    if (NULL == frame) {
        return;
    }

    lv_vendor_disp_lock();
    ui_camera_set_preview_yuv_format(frame->width, frame->height, frame->data, frame->length);
    lv_vendor_disp_unlock();
}

/**
 * @brief Handle UI actions posted from control center or other modules.
 *        Acquires LVGL display lock to ensure thread safety.
 * @param[in] msg optional message data
 * @param[in] len message data length
 * @param[in] disp_action action type
 * @return OPRT_OK on success
 */
OPERATE_RET app_ui_action_cb(UINT8_T *msg, INT_T len, TY_DISPLAY_ACTION_E disp_action)
{
    (VOID_T) msg;
    (VOID_T) len;

    lv_vendor_disp_lock();

    switch (disp_action) {
    case TY_DISP_ACT_OPEN_CAMERA:
        PR_DEBUG("camera open");
        tuya_device_camera_set_yuv_frame_cb(__display_camera_yuv_fram);
        tuya_device_camera_start();
        ui_nav_to(UI_SCR_CAMERA);
        break;

    case TY_DISP_ACT_CLOSE_CAMERA:
        PR_DEBUG("camera close");
        tuya_device_camera_stop();
        tuya_device_camera_set_yuv_frame_cb(NULL);
        ui_nav_back();
        break;

    case TY_DISP_ACT_OPEN_ALBUM: {
        ui_nav_to(UI_SCR_ALBUM);
        wukong_picture_open_album();
        uint32_t count = wukong_picture_get_count();
        PR_DEBUG("album open: count=%d, seek to last", count);
        if (count > 0) {
            ui_album_set_empty_state(FALSE);
            wukong_picture_seek_to_photo(count);
            WUKONG_PICTURE_INFO_T pic = {0};
            if (wukong_picture_get_next(&pic) == OPRT_OK && pic.data && pic.len) {
                ui_album_set_jpeg_photo(pic.width, pic.height, pic.data, pic.len);
            }
            wukong_picture_free_pic_info(&pic);
        } else {
            ui_album_set_empty_state(TRUE);
        }
        break;
    }

    case TY_DISP_ACT_CLOSE_ALBUM:
        PR_DEBUG("album close");
        wukong_picture_close_album();
        ui_album_hide();
        ui_nav_back();
        break;

    case TY_DISP_ACT_ALBUM_VIEW_NEXT_PIC: {
        WUKONG_PICTURE_INFO_T pic = {0};
        if (wukong_picture_get_next(&pic) == OPRT_OK && pic.data && pic.len) {
            ui_album_set_jpeg_photo(pic.width, pic.height, pic.data, pic.len);
        }
        wukong_picture_free_pic_info(&pic);
    } break;

    case TY_DISP_ACT_ALBUM_VIEW_PREV_PIC: {
        WUKONG_PICTURE_INFO_T pic = {0};
        if (wukong_picture_get_prev(&pic) == OPRT_OK && pic.data && pic.len) {
            ui_album_set_jpeg_photo(pic.width, pic.height, pic.data, pic.len);
        }
        wukong_picture_free_pic_info(&pic);
    } break;

    case TY_DISP_ACT_TAKE_PHOTO: {
        uint8_t *jpeg = NULL;
        uint32_t len = 0;
        tuya_device_camera_get_jpeg_frame(&jpeg, &len, NULL);

        if (jpeg && len) {
            char name[WUKONG_PICTURE_NAME_MAX_LEN + 1] = {0};
            wukong_picture_save_to_album(jpeg, len, name);
            ui_camera_set_thumbnail_jpeg(jpeg, len);
        }

    } break;

    case TY_DISP_ACT_ALBUM_DELETE_PIC: {
        if (wukong_picture_delete_current() != OPRT_OK) {
            break;
        }
        if (wukong_picture_get_count() == 0) {
            ui_album_set_empty_state(TRUE);
            ui_camera_clear_thumbnail();
            break;
        }
        /* delete_current rescanned and seeked; one get_next loads the correct successor photo */
        WUKONG_PICTURE_INFO_T pic = {0};
        if (wukong_picture_get_next(&pic) == OPRT_OK && pic.data && pic.len) {
            ui_album_set_jpeg_photo(pic.width, pic.height, pic.data, pic.len);
            ui_camera_set_thumbnail_jpeg(pic.data, pic.len);
        }
        wukong_picture_free_pic_info(&pic);
    } break;

    case TY_DISP_ACT_OPEN_ALBUM_GRID: {
        PR_DEBUG("album: all photos grid");
        ui_nav_to(UI_SCR_ALBUM_GRID);
        wukong_picture_free_thumb_list(&s_thumb_list);
        wukong_picture_get_thumb_list(ALBUM_GRID_THUMB_SIZE, ALBUM_GRID_THUMB_SIZE, &s_thumb_list);
        ui_album_grid_set_thumbs(&s_thumb_list);
    } break;

    case TY_DISP_ACT_CLOSE_ALBUM_GRID:
        PR_DEBUG("album grid: close");
        ui_album_grid_hide();
        ui_nav_back();
        wukong_picture_free_thumb_list(&s_thumb_list);
        break;

    case TY_DISP_ACT_ALBUM_BATCH_DELETE: {
        CONST CHAR_T *names[ALBUM_GRID_MAX_SELECT];
        UINT32_T del_count = ui_album_grid_get_pending_delete_names(names, ALBUM_GRID_MAX_SELECT);
        PR_DEBUG("album grid: batch delete %u photos", del_count);
        if (del_count > 0) {
            wukong_picture_delete_batch(names, del_count);
        }
        if (del_count >= s_thumb_list.count) {
            ui_camera_clear_thumbnail();
        }
    } break;

    case TY_DISP_ACT_ALBUM_AI_RECOGNIZE: {
        char cur_name[WUKONG_PICTURE_NAME_MAX_LEN + 1] = {0};
        if (wukong_picture_get_current_name(cur_name) != OPRT_OK) {
            PR_ERR("album AI: no current picture");
            break;
        }
        WUKONG_PICTURE_INFO_T pic = {0};
        if (wukong_picture_get_by_name(cur_name, &pic) != OPRT_OK || pic.data == NULL) {
            PR_ERR("album AI: get picture failed: %s", cur_name);
            wukong_picture_free_pic_info(&pic);
            break;
        }
        PR_DEBUG("album AI: attach %s to chat", cur_name);

        wukong_picture_input_add_from_album(cur_name, NULL);

        wukong_picture_close_album();
        ui_album_hide();
        ui_nav_back();
        if (ui_nav_current() == UI_SCR_CAMERA) {
            tuya_device_camera_stop();
            tuya_device_camera_set_yuv_frame_cb(NULL);
            ui_nav_back();
        }
        ui_chat_set_attachment_jpeg(pic.data, pic.len);
        wukong_picture_free_pic_info(&pic);
    } break;

    default:
        break;
    }

    lv_vendor_disp_unlock();

    return OPRT_OK;
}

/**
 * @brief Register action callback
 * @return none
 */
VOID_T app_ui_action_init(VOID_T) 
{ 
    tuya_ai_display_action_register(app_ui_action_cb); 
}
