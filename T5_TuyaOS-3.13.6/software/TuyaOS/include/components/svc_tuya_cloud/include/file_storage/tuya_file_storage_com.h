/**
 * @file tuya_file_storage_com.h
 * @brief file storage common include
 * @version 0.1
 * @date 2024-07-04
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

#ifndef _TUYA_FILE_STORAGE_COM_H
#define _TUYA_FILE_STORAGE_COM_H

#include "tuya_cloud_types.h"
#include "httpc.h"

#define VENDOR_TENCENT_COS         "cos"   //cn
#define VENDOR_AMAZON_S3           "s3"    //europe,us-west,india
#define VENDOR_AZURE_BLOB          "azure" //us-east,europe-west
#define ST_URL_LEN     256
#define ST_DATE_LEN    64
#define COS_AUTH_EXPIRE_DEFAULT    300
#define SHA1_HEX_LEN               20
#define SHA1_STRING_LEN            (SHA1_HEX_LEN * 2 + 1)
#define SHA256_HEX_LEN             32
#define SHA256_STRING_LEN          (SHA256_HEX_LEN * 2 + 1)

typedef struct {
    CHAR_T *provider;
    CHAR_T *ak;
    CHAR_T *sk;
    CHAR_T *bucket;
    CHAR_T *endpoint;
    CHAR_T *token;
    CHAR_T *region;
    CHAR_T *pathconfig;
    CHAR_T *object;
} FILE_STORAGE_CONFIG_T;

typedef struct {
    FILE_STORAGE_CONFIG_T *config;
    http_method_t method;
} FILE_STORAGE_HEADER_PARAM_T;

/**
 * @brief This API is used to add http header
 *
 * @param[in] session http seesion
 * @param[in] param header param
 *
 */
VOID tuya_file_storage_add_header_cb(http_session_t session, VOID* param);
#endif