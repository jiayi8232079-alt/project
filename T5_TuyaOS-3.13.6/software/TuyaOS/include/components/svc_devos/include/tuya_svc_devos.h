/**
 * @file tuya_svc_devos.h
 * @brief DevOS initialization and schedule
 * @version 0.1
 * @date 2019-04-25
 *
 * @copyright Copyright 2019-2021 Tuya Inc. All Rights Reserved.
 */

#ifndef __TUYA_SVC_DEVOS_H__
#define __TUYA_SVC_DEVOS_H__

#include "tuya_cloud_com_defs.h"

#ifdef __cplusplus
extern "C" {
#endif

#define EVENT_DEVOS_STATE_CHANGE "devos.stat.chg" // devos state changed

/* netcfg state */
typedef enum {
    NW_CFG_STAGE_NETCFG,            // current in netcfg stage
    NW_CFG_STAGE_PROXY_ACTIVE,      // current in proxy activiate stage
    NW_CFG_STAGE_CONN_AP,           // current in connect ap stage
    NW_CFG_STAGE_CLOUD_ACTIVE       // current in active stage
} DEVOS_NW_CFG_STAGE_E;

/* devos state machine */
typedef enum {
    DEVOS_STATE_INIT,            // device is inited
    DEVOS_STATE_UNREGISTERED,    // device is not activated
    DEVOS_STATE_REGISTERING,     // token/meta is got, start to activate
    DEVOS_STATE_ACTIVATED,       // device is activated and full-functional
    DEVOS_STATE_UPGRADING,       // device is in OTA

    DEVOS_STATE_MAX
} DEVOS_STATE_E;

/**
 * @brief Init param of IoT device
 */
typedef struct {
    /** device need factory reset first */
    BOOL_T factory_reset;
    /** device ability*/
    GW_ABI abi;
    /** device ota channel */
    DEV_TYPE_T tp;

    /** The key of firmware, assigned by TUYA */
    CHAR_T *firmware_key;
    /** The key of product, assigned by TUYA */
    CHAR_T *product_key;
    /** The version of firmware, format is "x.y.z" */
    CHAR_T *sw_ver;

    /** The count of attach modules */
    UINT_T attr_num;
    /** The attributes of attach modules */
    GW_ATTACH_ATTR_T *attrs;
} devos_init_t;

/**
 * @brief Init device
 *
 * @param[in] cfg device configuration
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_svc_devos_init(IN devos_init_t *cfg);

/**
 * @brief Reinit device
 *
 * @param[in] void
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_svc_devos_reinit(VOID_T);

/**
 * @brief Get current devos state
 *
 * @return see DEVOS_STATE_E
 */
DEVOS_STATE_E tuya_svc_devos_get_state(VOID);

/**
 * @brief Set current devos state (dispatch event)
 *
 * @param[in] state see DEVOS_STATE_E
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_svc_devos_set_state(IN DEVOS_STATE_E state);

/**
 * @brief Set current devos netcfg state
 *
 * @param[in] state see DEVOS_NW_CFG_STAGE_E
 * @param[in] status, 0-success, others-error
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_svc_devos_set_netcfg_stat(IN DEVOS_NW_CFG_STAGE_E stage, IN UINT_T status);

/**
 * @brief Get current devos netcfg state
 *
 * @return netcfg state info string
 */
CHAR_T* tuya_svc_devos_get_netcfg_stat(UINT8_T type);

/**
 * @brief Set current devos time
 *
 * @param[in] time_sec posix timestamp
 * @param[in] update_source, 1-cloud sync, 0-other
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 *
 **/
OPERATE_RET tuya_svc_devos_set_time(TIME_T time_sec, INT_T update_source);

/**
 * @brief enable remote reboot
 *
 * @note called before iot init, canbe in pre_app_init
 *
 * @return void
 */
VOID tuya_svc_devos_rmt_reboot_enable();

/**
 * @brief set devos proxy activated
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_set_devos_proxy_actived();

/**
 * @brief set pin 2 localkey
 *
 */
VOID tuya_set_pin_to_localkey();

/**
 * @brief set schema
 *
 * @param[in] schema Schema json string
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_devos_set_schema(CHAR_T *schema);

/**
 * @brief Callback for getting schema info
 *
 * @param[in] schema
 */
typedef OPERATE_RET (*TUYA_GET_SCHEMA_CB)(CHAR_T** schema_id, CHAR_T** schema);

/**
 * @brief set regist callback function for getting built-in schema
 *
 * @param[in] callback function for getting built-in schema
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_iot_reg_built_in_schema(TUYA_GET_SCHEMA_CB cb);

/**
 * @brief check current device need built-in schema
 *
 * @return BOOL_T
 */
BOOL_T tuya_devos_need_built_in_schema(VOID_T);

#ifdef __cplusplus
}
#endif

#endif //__TUYA_SVC_DEVOS_H__

