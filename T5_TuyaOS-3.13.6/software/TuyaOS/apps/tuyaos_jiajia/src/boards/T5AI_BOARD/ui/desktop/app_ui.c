/**
 * @file app_ui.c
 * @brief UI message dispatcher for T5AI_BOARD
 * @version 1.0
 * @date 2025-04-02
 * @copyright Copyright (c) Tuya Inc.
 */
#include "tuya_cloud_types.h"
#include "tuya_ai_display.h"
#include "ui_private.h"
#include "wukong_picture.h"

/* ---------------------------------------------------------------------------
 * Function implementations
 * --------------------------------------------------------------------------- */
STATIC VOID_T __view_image_from_album(VOID_T *arg)
{
    char *pic_name = (char *)arg;

    WUKONG_PICTURE_INFO_T pic = {0};
    if (wukong_picture_get_by_name(pic_name, &pic) != OPRT_OK) {
        PR_ERR("get picture by name failed: %s", pic_name);
        return;
    }

    if (pic.data && pic.len) {
        ui_nav_to(UI_SCR_ALBUM);
        ui_chat_disp_image(pic.data, pic.len);
    }

    wukong_picture_free_pic_info(&pic);
}

void app_ui_chat_image(CHAT_MSG_ROLE_TP_E type, char *pic_name)
{
    ui_chat_add_link(type, "查看图片", __view_image_from_album, pic_name, strlen(pic_name)+1);
}


/**
 * @brief Desktop UI initialization, called once at startup
 * @return none
 */
void desktop_ui_init(void)
{
    ui_nav_init();
    app_ui_action_init();
    setup_scr_startup();
}

/**
 * @brief Handle display messages from the platform (desktop UI)
 * @param[in] msg display message
 * @return none
 */
void desktop_ui_msg_handler(TY_DISPLAY_MSG_T *msg)
{
    if (NULL == msg) {
        return;
    }

    switch (msg->type) {
    case TY_DISPLAY_TP_HUMAN_CHAT:
        ui_chat_add_text(CHAT_MSG_ROLE_USER, msg->data);
        break;

    case TY_DISPLAY_TP_AI_CHAT:
        ui_chat_add_text(CHAT_MSG_ROLE_AI, msg->data);
        break;

    case TY_DISPLAY_TP_AI_CHAT_START:
        ui_chat_stream_begin();
        if(NULL != msg->data) {
            ui_chat_stream_append((CONST CHAR_T *)msg->data);
        }
        break;

    case TY_DISPLAY_TP_AI_CHAT_DATA:
        ui_chat_stream_append((CONST CHAR_T *)msg->data);
        break;

    case TY_DISPLAY_TP_AI_CHAT_STOP:
        ui_chat_stream_end();
        break;

    case TY_DISPLAY_TP_AI_IMAGE:
        app_ui_chat_image(CHAT_MSG_ROLE_AI, (char *)msg->data);
        break;

    case TY_DISPLAY_TP_CLEAR_ATTACHMENT:
        ui_chat_clear_attachment();
        break;

    case TY_DISPLAY_TP_STAT_NETCFG:
        desktop_ui_gate_on_netcfg_required();
        break;

    case TY_DISPLAY_TP_CLOUD_CONNECTED:
        desktop_ui_gate_on_cloud_connected();
        break;

    case TY_DISPLAY_TP_AI_CLIENT_READY:
        desktop_ui_gate_on_ai_client_ready();
        break;

    default:
        break;
    }
}
