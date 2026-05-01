#ifndef __TUYA_WIFI_NETCFG_H__
#define __TUYA_WIFI_NETCFG_H__
#include "netcfg_module.h"
#include "tuya_cloud_wifi_defs.h"
#include "tuya_wifi_link.h"
#include "tuya_devos_data.h"

#ifdef __cplusplus
extern "C" {
#endif

#if defined ENABLE_DEVICE_DATA_COLLECT && (ENABLE_DEVICE_DATA_COLLECT==1)
#define CAPTURE_NETCFG_DATA(type, step)                                                                                                                                                        \
    do                                                                                                                                                                                         \
    {                                                                                                                                                                                          \
        OPERATE_RET rt = OPRT_OK;                                                                                                                                                              \
        TUYA_CALL_ERR_LOG(ty_devos_update_netcfg_data(tal_time_get_posix(), TY_DEVOS_NET_CONFIG_DATA, (uint8_t)type, get_wifi_config_params()->start_mode, get_wifi_config_params()->mthd, step, tal_time_get_posix())); \
    } while (0)
#else
#define CAPTURE_NETCFG_DATA(type, step) do{}while(0)
#endif

/**
 * @brief Set device AP config
 *
 * @param[out] ssid SSID to connect
 * @param[out] passwd Password of AP

 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET set_user_def_ap_if(IN CONST CHAR_T *ssid, IN CONST CHAR_T *passwd);

/**
 * @brief Get device AP config
 *
 * @param[out] ssid SSID to connect
 * @param[out] passwd Password of AP

 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET get_dev_ap_if(OUT CHAR_T* ssid, OUT CHAR_T* passwd);

/**
 * @brief Set maximum of clients that are allowed to connect this device
 *
 * @param[in] max_conn Max count
 */
VOID set_max_sta_conn(IN CONST UCHAR_T max_conn);

/**
 * @brief Set device network info
 *
 * @param[in] ip IP addr.
 * @param[in] gw Gateway addr.
 * @param[in] mask Network mask
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
VOID set_nw_ip(IN CONST CHAR_T* ip, IN CONST CHAR_T* mask, IN CONST CHAR_T* gw);


/**
 * @brief Set wifi netcfg timeout value in seconds
 *
 * @param[in] timeout_s time out value of netcfg.
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */

VOID set_wf_netcfg_timeout(UINT_T timeout_s);

/**
 * @brief Configure network with user defined params
 *
 * @param[in] ssid SSID to connect
 * @param[in] passwd Password of AP
 * @param[in] token The token
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_wifi_user_cfg(IN CONST CHAR_T *ssid, IN CONST CHAR_T *passwd, IN CONST CHAR_T *token);

/**
 * @brief change wifi ssid&passwd
 *
 * @param[in] ssid SSID to connect
 * @param[in] passwd Password of AP
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_wifi_modify_and_conn(IN CONST CHAR_T *ssid, IN CONST CHAR_T *passwd);

/**
 * @brief get nc_type for application
 *
 * @param[out] nc_type nc_type for wifi netcfg
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_wifi_fast_get_nc_type(GW_WF_NWC_FAST_STAT_T *nc_type);

/**
 * @brief set ap cfg infomation
 *
 * @param[in] cfg ap cfg infomation
 *
 * @return void
 */
VOID set_ap_cfg_info(WF_AP_CFG_IF_S *cfg);

/**
 * @brief get wifi scan list
 *
 * @param[in/out] wifi_list: wifi_list buffer for scan result
 * @param[out] wifi_list_size: wifi_list buffer size
 * @param[out] max_cnt: max count for wifi list
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_get_wifi_scan_list(CHAR_T* wifi_list, uint16_t wifi_list_size, uint16_t max_cnt);

/**
 * @brief report netcfg status
 *
 * @param[in] type: 0-report 1-query
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET  tuya_ap_rept_netcfg_stat(IN UINT_T type);

/**
 * @brief start device ap
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_wf_start_device_softap(VOID_T);

/**
 * @brief send ap cfg 4g cmd to app
 *
 * @param[in] ret_code 4g connect status
 * @param[in] p_data send data
 * @param[in] data_len data len
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_ap_cfg_4g_send(UINT_T ret_code, CHAR_T *p_data, UINT_T data_len);


/**
 * @brief stop hot reset netcfg
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */

OPERATE_RET tuya_wifi_special_hotreset_netcfg_stop(VOID_T);

#if defined(ENABLE_MATTER) && (ENABLE_MATTER == 1)    
/**
 * @brief subscribe event EVENT_LINK_ACTIVATE and EVENT_POST_ACTIVATE
 * 
 * @note  called when netcfg init
 * 
 * @return None
 */
VOID_T tuya_wifi_netcfg_event_subscription(VOID_T);
/**
 * @brief Modify WiFi configuration and connect to access point on specified channel
 *
 * This function modifies the WiFi configuration with the provided SSID and password,
 * and attempts to connect to the access point on the specified channel.
 *
 * @param[in] ssid Pointer to a null-terminated string containing the SSID of the access point
 * @param[in] passwd Pointer to a null-terminated string containing the password for the access point
 * @param[in] channel The WiFi channel number on which to connect to the access point
 *
 * @return OPERATE_RET Operation result status code
 * @retval OPRT_OK Success
 * @retval Other error codes indicating specific failure reasons
 *
 * @note The SSID and password strings must be valid and null-terminated
 * @note The channel parameter should be a valid WiFi channel number for the region
 */
OPERATE_RET tuya_wifi_modify_and_conn_by_channel(IN CONST CHAR_T *ssid, IN CONST CHAR_T *passwd, IN uint8_t channel);
/**
 * @brief wifi netcfg is done or not
 * 
 * @param[] none
 * 
 * @return true: wifi configed
 */
BOOL_T is_wifi_need_netconfig(VOID_T);

/**
 * @brief Check if the app has set the Matter token.
 *
 * @return TRUE if the Matter token is set, FALSE otherwise.
 */
BOOL_T is_app_set_matter_token(VOID_T);

/**
 * @brief Check if the Wi-Fi is connected to a new SSID.
 *
 * @return TRUE if connected to a new SSID, FALSE otherwise.
 */
BOOL_T is_wifi_connect_new_ssid(VOID_T);

/**
 * @brief Clear the Matter token set by the application.
 */
VOID_T clear_app_set_matter_token(VOID_T);

/**
 * @brief Activate Matter with the given JSON string and commissioning window status.
 *
 * @param jsonStr The JSON string containing Matter configuration.
 * @param IsCommissioningWindowOpen The status of the commissioning window.
 *
 * @return OPERATE_RET The result of the operation.
 */
OPERATE_RET tuya_wifi_active_matter(CHAR_T * jsonStr, BOOL_T IsCommissioningWindowOpen);

/**
 * @brief get configured wifi netcfg
 * 
 * @param[] none
 * 
 * @return true: wifi configed
 */
OPERATE_RET tuya_get_configured_wifi_info(ptrApSsidPasswd pWifiInfo);
/**
 * @brief is low power mode or not
 * 
 * @note  called when needed
 * 
 * @return True: low power mode; False: otherwise
 */
BOOL_T is_wifi_low_power_mode(VOID_T);
#endif//ENABLE_MATTER

/**
 * @brief Capture and boot AP (Access Point) information during Wi-Fi network configuration.
 *
 * This function captures the access point information and boots the AP during the
 * Wi-Fi network configuration process. It is typically called to initialize or
 * retrieve stored AP credentials that will be used for network connectivity.
 *
 * @return OPERATE_RET Returns the operation result status.
 *         - OPRT_OK: Operation successful
 *         - Error code: Operation failed (specific error codes depend on implementation)
 *
 * @note This function should be called during the network configuration phase.
 * @note The captured AP information may be stored in persistent storage.
 */
OPERATE_RET tuya_wifi_netcfg_capture_boot_ap_info(VOID_T);
/**
 * @brief Free boot AP information from RAM
 *
 * This function frees the memory allocated for storing the boot AP information
 * in RAM. It should be called when the boot AP information is no longer needed,
 * such as during device shutdown or reconfiguration.
 *
 * @return void
 */
VOID tuya_wifi_netcfg_free_boot_ap_info(VOID_T);

#ifdef __cplusplus
}
#endif
#endif

