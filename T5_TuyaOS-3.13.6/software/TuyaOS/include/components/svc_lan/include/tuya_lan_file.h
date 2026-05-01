/**
 * @file tuya_lan_file.h
 * @author fangweng.hu@tuya.com
 * @brief lan file
 * @version 0.1
 * @date 2024-07-22
 *
 * @copyright Copyright (c) 2023 Tuya Inc. All Rights Reserved.
 *
 * Permission is hereby granted, to any person obtaining a copy of this software and
 * associated documentation files (the "Software"), Under the premise of complying
 * with the license of the third-party open source software contained in the software,
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software.
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 */

#ifndef __TUYA_LAN_FILE_H__
#define __TUYA_LAN_FILE_H__

#include "tuya_cloud_types.h"
#include "tuya_transporter.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef BYTE_T LAN_FILE_CMD_E;
#define LFC_QUERY_ABILITY    1     // query dev ability
#define LFC_PREVIEW_LIST     2     // get pic and video preview list
#define LFC_GET_THUMBNAIL    3     // get pic and video thumbnail
#define LFC_GET_MEDIA_DATA   4     // get pic and video data
#define LFC_PRINT_DEV_PIC    5     // print dev pic
#define LFC_PRINT_APP_PIC    6     // print app pic
#define LFC_PLAY_VIDEO       7     // play video
#define LFC_PULL_AI          8     // pull ai
#define LFC_PREVIEW_LIST_AI  9     // get ai preview list
#define LFC_GET_AI           10    // get ai data
#define LFC_DEL_AI           11    // del ai
#define LFC_DEL_MEDIA        12    // del media

typedef BYTE_T LAN_FILE_SUB_CMD_E;
#define LFSC_TRANS_START     0     // trans start
#define LFSC_TRANS           1     // trans
#define LFSC_TRANS_END       2     // trans end
#define LFSC_GET_FILE_SIZE   3     // get file size
#define LFSC_RECV_UNIT_SIZE  4     // get recv unit size
#define LFSC_SEND_UNIT_SIZE  5     // get send unit size

#pragma pack(1)
#define LAN_FILE_NAME_MAX 64

typedef struct {
    /** file type, 0:pic,1:video,2:AI filter,3:pic&video*/
    UCHAR_T type;
    /** file offset*/
    USHORT_T offset;
    /** file count*/
    USHORT_T count;
} LAN_FILE_PREVIER_LIST_REQ_T;

// need UNI_HTONL when app make data
typedef struct {
    /** file id*/
    CHAR_T id[LAN_FILE_NAME_MAX];
    /** file type, 0:pic,1:video,2:AI filter*/
    UCHAR_T type;
    /** file modify time*/
    UINT_T time_c;
    /** file actual size*/
    UINT_T size;
    /** video duration, vaild only when type was 1*/
    UINT_T duration;
    /** is file can be del from app,0:can't, 1:can*/
    UCHAR_T del;
} LAN_FILE_PREVIER_LIST_RSP_T;

typedef struct {
    /** file id*/
    CHAR_T id[LAN_FILE_NAME_MAX];
} LAN_FILE_REQ_DATA_ID_T, LAN_FILE_TRANS_START_T;

typedef struct {
    /** command*/
    LAN_FILE_CMD_E cmd;
    /** sub command */
    LAN_FILE_SUB_CMD_E sub_cmd;
    /** cmd req data length*/
    UINT_T len;
    /** cmd req data*/
    CHAR_T *data;
} LAN_FILE_TRANS_REQ_T;

typedef struct {
    /** cmd response data length*/
    UINT_T len;
    /** cmd resp data*/
    CHAR_T data[0];
} LAN_FILE_TRANS_RESP_T;

typedef struct {
    /** file id with path*/
    CHAR_T path[2*LAN_FILE_NAME_MAX];
} LAN_FILE_APP_T;

typedef struct {
    /** file data len */
    UINT_T len;
    /** file data */
    UCHAR_T *data;
} LAN_FILE_TRANS_T;

typedef struct {
    /** trans end ret 0:success, other failed*/
    UINT_T ret;
} LAN_FILE_TRANS_END_T;

typedef struct {
    /** bit0:is support print pic,bit1:is support ai,bit2:is support seek play */
    UCHAR_T flag;
    /** pic resolution width*/
    USHORT_T print_width;
    /** pic resolution height*/
    USHORT_T print_height;
    /** bit0: jpg, bit1: png */
    UCHAR_T print_format;
    /** device receive unit size(KB) */
    UCHAR_T unit_size;
    /** pic max size (B) */
    UINT_T print_size;
} LAN_FILE_ABILITY_RSP_T;

typedef struct {
    /** file size*/
    UINT_T len;
} LAN_FILE_SIZE_RSP_T;
#pragma pack()

/**
 * @brief lan file trans notify cb
 *
 * @param[in] req lan file request
 * @param[out] resp lan file response
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
typedef OPERATE_RET(*LAN_FILE_TRANS_NOTIFY)(LAN_FILE_TRANS_REQ_T *req, LAN_FILE_TRANS_RESP_T **resp);

/**
 * @brief set lan file config
 *
 * @param[in] cb lan file cb
 *
 * @note called after iot init, canbe in pre_device_init or device_init
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_lan_file_set_cfg(LAN_FILE_TRANS_NOTIFY cb);

/**
 * @brief lan file command handle
 *
 * @param[in] socket socket fd
 * @param[in] frame_num frame number
 * @param[in] frame_type frame type
 * @param[in] frame_len frame length
 * @param[in] frame_data frame data
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_lan_file_cmd_handle(INT_T socket, UINT_T frame_num, UINT_T frame_type, UINT_T frame_len, CHAR_T *frame_data);

/**
 * @brief lan file cmd report
 *
 * @param[in] cmd command
 * @param[in] ret_code return code
 * @param[in] data data
 * @param[in] len data length
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_lan_file_cmd_report(UCHAR_T cmd, UINT_T ret_code, CHAR_T *data, UINT_T len);
#ifdef __cplusplus
}
#endif
#endif

