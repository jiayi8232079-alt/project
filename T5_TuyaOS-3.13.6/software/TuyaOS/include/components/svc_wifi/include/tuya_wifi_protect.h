/**
 * @file tuya_wifi_protect.h
 * @brief wifi protoct header file
 * @version 0.1
 * @date 2024-08-19
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

#ifndef __TUYA_WIFI_PROTECT__
#define __TUYA_WIFI_PROTECT__

#ifdef __cplusplus
extern "C" {
#endif

#include "tuya_cloud_types.h"

enum tuya_wfpt_state {
    TUYA_WFPT_SWICTH_START,
    TUYA_WFPT_SWICTH_ORIGINAL,
    TUYA_WFPT_SWICTH_SUCCESS,
    TUYA_WFPT_SWICTH_FALIED,
};

typedef UCHAR_T tuya_wfpt_state_t;
typedef void tuya_wfpt_state_cb_t (tuya_wfpt_state_t state);

typedef enum {
    TUYA_WFPT_WIFI_MODE  = 0,
    TUYA_WFPT_WIRED_MODE = 1,
    TUYA_WFPT_4G_MODE    = 2,
    TUYA_WFPT_INVALID_MODE    = 0xFF
} tuya_wfpt_mode_t;

#define TUYA_WFPT_BACKUP_FLAG   1 << 0
#define TUYA_WFPT_SWITCH_FLAG   1 << 1
typedef struct {
    UCHAR_T     network;
    SCHAR_T     rssi;
    UINT_T      flags; // Non-WiFi network need this flag
} tuya_wfpt_attr_t;

/**
 * @brief wifi protect init
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_wifi_protect_init(VOID);

/**
 * @brief wifi protect backup ap check
 *
 * @param[in] ap_list ap list
 * @param[in] ap_num number of ap
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_wifi_protect_backup_ap_check(AP_IF_S *ap_list, UCHAR_T ap_num);

/**
 * @brief set wifi protect conf attr
 *
 * @param[in] attr attr cb
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_wifi_protect_conf_attr(INT_T(*conf_attr)(tuya_wfpt_attr_t *attr));

/**
 * @brief disable wifi protect
 *
 * @note called before iot init, canbe in pre_app_init
 *
 */
VOID tuya_wifi_protect_disable(VOID);

/**
 * @brief is wifi protect enable
 *
 * @return TRUE:enable, FALSE:disable
 */
BOOL_T tuya_wifi_protect_is_enable(VOID);

OPERATE_RET wifi_protect_backup_ap_get(void (*buckup_ap_cb) (CHAR_T *ssid, CHAR_T *passwd));
OPERATE_RET wifi_protect_backup_ap_switch(CHAR_T *ssid, CHAR_T *passwd);

/**
 * @brief Manually add current WiFi network to backup list
 * 
 * @return OPRT_OK on success. Others on error
 */
OPERATE_RET wifi_protect_current_ap_add_to_backup(VOID);

/**
 * @brief Check if current WiFi is already in backup list
 * 
 * @return OPRT_OK if current WiFi is in backup list, OPRT_NOT_FOUND if not in list, error code on parameter error
 */
OPERATE_RET wifi_protect_current_ap_in_backup(VOID);

/**
 * @brief Get count of backup WiFi networks (excluding current WiFi)
 * 
 * @return Number of backup WiFi networks
 */
UCHAR_T wifi_protect_backup_ap_count_get(VOID);

/**
 * @brief Test function to add WiFi network to backup list (for external command line testing)
 * 
 * @param[in] ssid WiFi network name
 * @param[in] passwd WiFi password (can be NULL or empty for open networks)
 * 
 * @return OPRT_OK on success. Others on error
 */
OPERATE_RET wifi_protect_test_add_to_backup(CHAR_T *ssid, CHAR_T *passwd);

#ifdef __cplusplus
} // extern "C"
#endif

#endif
