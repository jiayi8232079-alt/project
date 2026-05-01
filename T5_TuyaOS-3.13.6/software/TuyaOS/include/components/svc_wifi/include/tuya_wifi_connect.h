#ifndef __TUYA_WIFI_CONNECT_H__
#define __TUYA_WIFI_CONNECT_H__

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief wifi reconnect callback function.
 *
 * @param[in] local_disconnect_seconds time of local network disconnection
 * @param[in] cloud_disconnect_seconds time of cloud(mqtt) disconnection
 *
 * @note called after tuya_svc_wifi_init.
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */

typedef OPERATE_RET(* reconnect_cb_fn)(INT_T local_disconnect_seconds, INT_T cloud_disconnect_seconds);

/**
 * @brief reconnect configuration.
 */
typedef struct {
    reconnect_cb_fn              reconnect_fn;
} reconnect_config_t, *ptr_reconnect_config_t;

/**
* @brief wifi prepare before reconnect .
*
*
* @note called before reconnect func start.
*
* @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
*/
OPERATE_RET tuya_wifi_reconnect_prepare(VOID_T);

/**
 * @brief register wifi reconnect func .
 *
 * @param[in] reconnect_fn callback function when wifi connection is lost
 *
 * @note called when wifi monitor found connection is lost.
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */

OPERATE_RET tuya_wifi_register_reconnect_config(reconnect_cb_fn  reconnect_fn);


/**
 * @brief wifi connect to ap .
 *
 *
 * @note called after reconnect func got ssid&passwd
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */

OPERATE_RET tuya_wifi_reconnect_to_ap(VOID_T);

/**
 * @brief Start wifi switch
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_wifi_switch_start(IN CHAR_T *ssid, IN CHAR_T *passwd);

/**
 * @brief Disable fast wifi connect feature
 *
 * @param[in] disable TRUE: disable fast connect; FALSE: enable fast connect
 *
 * @return none
 */
VOID tuya_wifi_disable_fast_conn(BOOL_T disable);
#if defined(ENABLE_MATTER) && (ENABLE_MATTER==1)
/**
 * @brief check wifi is connected or not;
 * 
 * @return connected or not
 */
BOOL_T tuya_wifi_is_connected(VOID_T);
/**
 * @brief Resets the interaction timeout for MATTER CASE .
 * 
 * This function resets the timer that tracks the interaction timeout for a specific case.
 */
VOID_T reset_case_interacte_timeout(VOID_T);

/**
 * @brief Clears the interaction timeout for MATTER CASE .
 * 
 * This function clears the timer that tracks the interaction timeout for a specific case.
 */
VOID_T clear_case_interacte_timeout(VOID_T);

/**
 * @brief Checks if the interaction timeout for MATTER CASE has occurred.
 * 
 * This function checks whether the timer for the interaction timeout of MATTER CASE has expired.
 * 
 * @return TRUE if the interaction timeout has occurred, FALSE otherwise.
 */
BOOL_T is_case_interacte_timeout(VOID_T);
#endif

#ifdef __cplusplus
}
#endif

#endif

