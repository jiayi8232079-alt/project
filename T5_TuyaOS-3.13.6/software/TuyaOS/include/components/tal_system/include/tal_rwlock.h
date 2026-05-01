/**
 * @file tal_rwlock.h
 * @author riven.li@tuya.com
 * @brief  Common process - Initialization
 * @version 0.1
 * @date 2026-02-11
 *
 * @copyright Copyright 2021-2031 Tuya Inc. All Rights Reserved.
 *
 */
#ifndef __TAL_RWLOCK_H__
#define __TAL_RWLOCK_H__

#include "tuya_cloud_types.h"

#ifdef __cplusplus
extern "C" {
#endif

#ifndef __SOURCE_RWLOCK__
typedef struct { UINT8_T dummy; } * RWLOCK_HANDLE;
#endif

typedef struct {
    UINT8_T dummy;
} RWLOCK_CREATE_CONFIG_T;

/**
 * @brief Create and init a reader-writer-lock
 *
 * @param hnd[out] pointer to a RWLOCK_HANDLE to receive rwlock handle
 * @param config[in] reserved, pass NULL for default, another ignored.
 * @return OPERATE_RET OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tal_rwlock_create_init(RWLOCK_HANDLE* hnd, RWLOCK_CREATE_CONFIG_T* config);

/**
 * @brief Destory and free a reader-writer-lock
 * if return code is OPRT_OK, handle passed in will no longer function and should be set to NULL;
 * @param hnd[in] rwlock handle to release
 * @return  OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tal_rwlock_release(RWLOCK_HANDLE hnd);

/**
 * @brief lock a reader-writer-lock as reader
 *
 * @param hnd[in] rwlock handle to lock
 * @return OPERATE_RET OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tal_rwlock_read_lock(RWLOCK_HANDLE hnd);

/**
 * @brief unlock a reader-writer-lock as reader
 *
 * @param hnd[in] rwlock handle to unlock
 * @return OPERATE_RET OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tal_rwlock_read_unlock(RWLOCK_HANDLE hnd);

/**
 * @brief lock a reader-writer-lock as writer
 *
 * @param hnd[in] rwlock handle to lock
 * @return OPERATE_RET OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tal_rwlock_write_lock(RWLOCK_HANDLE hnd);

/**
 * @brief unlock a reader-writer-lock as writer
 *
 * @param hnd[in] rwlock handle to unlock
 * @return OPERATE_RET OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tal_rwlock_write_unlock(RWLOCK_HANDLE hnd);

#ifdef __cplusplus
}
#endif /* __cplusplus */

#endif
