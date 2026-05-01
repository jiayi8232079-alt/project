/**
* @file tal_cellular.h
* @brief Common process - cellular abstration api define
* @version 0.1
* @date 2020-11-09
*
* @copyright Copyright 2020-2021 Tuya Inc. All Rights Reserved.
*
*/

#ifndef __TAL_CELLULAR_H__
#define __TAL_CELLULAR_H__

#include "tuya_cloud_types.h"

#ifdef __cplusplus
extern "C" {
#endif


/* tuyaos definition of cellular network status */
typedef enum {
    TAL_CELLULAR_LINK_DOWN = 0,    ///< the network cable is unplugged
    TAL_CELLULAR_LINK_UP,          ///< the network cable is plugged and IP is got
}TAL_CELLULAR_STAT_E;

#define TAL_CELLULAR_APN_LEN 64
#define TAL_CELLULAR_CCID_LEN 20
#define TAL_CELLULAR_USER_NAME_LEN 32
#define TAL_CELLULAR_USER_PASSWD_LEN 32
#define TAL_CELLULAR_DIAL_UP_CMD_LEN 32

typedef struct
{
    char apn[TAL_CELLULAR_APN_LEN+1];                               ///< Access Point Name
//  char username[TAL_CELLULAR_USER_NAME_LEN+1];                    ///< User Name
//  char password[TAL_CELLULAR_USER_PASSWD_LEN+1];                  ///< User Password
//  char dial_up_phone_num[TAL_CELLULAR_DIAL_UP_CMD_LEN+1];         ///< dial-up phone number
}TAL_CELLULAR_BASE_CFG_T;

/**
 * @brief callback function: CELLULAR_STATUS_CHANGE_CB
 *        when cellular connect status changed, notify tuyaos
 *        with this callback.
 *
 * @param[out]       is_up         the cellular link status is up or not
 */
typedef VOID_T (*TAL_CELLULAR_STATUS_CHANGE_CB)(TAL_CELLULAR_STAT_E stat);

/**
 * @brief  init create cellular link
 *
 * @param[in]   cfg: the configure for cellular link
 * 
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tal_cellular_init(TAL_CELLULAR_BASE_CFG_T *cfg);

/**
 * @brief  get the link status of celluar link
 *
 * @param[out]  is_up: the celluar link status is up or not
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tal_cellular_get_status(TAL_CELLULAR_STAT_E *stat);

/**
 * @brief  set the status change callback
 *
 * @param[in]   cb: the callback when link status changed
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tal_cellular_set_status_cb(TAL_CELLULAR_STATUS_CHANGE_CB cb);

/**
 * @brief  get the ip address of the cellular link
 * 
 * @param[in]   ip: the ip address
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tal_cellular_get_ip(NW_IP_S *ip);

/**
 * @brief  get the ip address of the cellular link
 * 
 * @param[in]   ip: the ip address
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tal_cellular_get_ipv6(NW_IP_TYPE type, NW_IP_S *ip);

/**
 * @brief  get the ccid of the cellular link
 * 
 * @param[out]   ccid: ccid string
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tal_cellular_get_ccid(CHAR_T *ccid);

/**
 * @brief  get the rssi of the cellular link
 * 
 * @param[out]   rssi: rssi value
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tal_cellular_get_rssi(CHAR_T *rssi);

/**
 * @brief  get the voltage of the cellular module
 * 
 * @param[out]   volt: voltage value
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tal_cellular_get_volt(UINT32_T *volt);

#ifdef __cplusplus
} // extern "C"
#endif

#endif // __TAL_CELLULAR_H__

