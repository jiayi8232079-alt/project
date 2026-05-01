/**
 * @file tuya_file_storage_upd.h
 * @brief file storage upload
 * @version 0.1
 * @date 2024-04-02
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
#include "tuya_cloud_types.h"

#define UPD_FILE_NAME_LEN          256
typedef enum {
    BIZ_TYPE_LOG,
    BIZ_TYPE_NILM,
    BIZ_TYPE_AI_CAMERA
} FILE_STORAGE_BIZ_TYPE;

/**
 * @brief This API is used to file storage upload
 *
 * @param[in] local_file local file
 * @param[in] type business type, detail see FILE_STORAGE_BIZ_TYPE
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_file_storage_upd(CHAR_T *local_file, FILE_STORAGE_BIZ_TYPE type);

/**
 * @brief This API is used to free resource when upload finish
 *
 */
VOID tuya_file_storage_free();

/**
 * @brief This API is used to file storage upload raw start
 *
 * @param[in] remote_name remote file name
 * @param[in] total_len total length
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_file_storage_upd_raw_start(CHAR_T *remote_name, UINT_T total_len);

/**
 * @brief This API is used to file storage upload raw send
 *
 * @param[in] data data
 * @param[in] len data length
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_file_storage_upd_raw_send(CHAR_T *data, UINT_T len);

/**
 * @brief This API is used to file storage upload raw end
 *
 * @param[in] remote_name remote file name
 * @param[out] file_id file id
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_file_storage_upd_raw_end(CHAR_T *remote_name, UINT_T *file_id);