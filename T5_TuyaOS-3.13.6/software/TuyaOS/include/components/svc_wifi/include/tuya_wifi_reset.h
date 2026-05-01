#ifndef __TUYA_WIFI_RESET_H__
#define __TUYA_WIFI_RESET_H__

#include "gw_intf.h"
#include "tuya_wifi_link.h"
#include "tuya_cloud_wifi_defs.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief wifi clear md
 *
 * @note only called for custom mode
 *
 * @return void
 */

VOID_T wifi_clear_md(VOID);

/**
 * @brief save wifi start mode flag.
 *
 * @param[in] wifi_start_mode
 *
 * @note only called for custom mode
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */

VOID_T wifi_save_start_mode(GW_WF_START_MODE wf_start_mode);

/**
 * @brief update nc_tp when wifi_start_mode changes.
 *
 * @note only called for custom mode
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
VOID_T wifi_update_nc_tp(VOID_T);


/**
 * @brief factory reset nc_tp according to wifi_start_mode and GW_WF_CFG_MTHD_SEL.
 *
 * @note called when wifi params is messed up
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
VOID  wifi_factory_reset_nc_type(P_TUYA_WIFI_CFG_PARAM p_config_params, INOUT GW_WORK_STAT_MAG_S *gw_wsm);

/**
 * @brief set a flag to indicate that iot_wf_gw_unactive_custom_mode is called
 *
 * @param[in] bcustom iot_wf_gw_unactive_custom_mode is called
 *
 * @note if bcustom is set, nc_tp will not updated by wifi start mode when device powered on
 *
 * @return void
 */

VOID_T tuya_wifi_link_set_custom_mode(BOOL_T bcustom);


/**
 * @brief Set wifi netcfg timeout value in seconds
 *
 * @param[in] timeout_s time out value of netcfg.
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */

VOID set_wf_netcfg_timeout(UINT_T timeout_s);

/**
 * @brief start wifi link reset short and long timer.
 *
 * @note according to mthd, timer will start accordingly.
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */

OPERATE_RET tuya_wifi_reset_start_timer(VOID_T);

/**
 * @brief stop wifi link reset short and long timer.
 *
 * @note according to mthd, timer will stop accordingly.
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */

OPERATE_RET tuya_wifi_reset_stop_timer(VOID_T);

/**
 * @brief do wifi link reset.
 *
 * @param[in] mthd
 *
 * @param[in] wifi_start_mode
 *
 * @param[in] force_clean clean wifi status
 *
 * @param[out] p_nc_tp nc_tp after reset
 *
 * @param[out] p_md md after reset
 *
 * @note according to mthd and wifi start mode, nc_tp and md will be updated and saved
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */

OPERATE_RET tuya_wifi_reset_config(IN CONST GW_WF_START_MODE wifi_start_mode, IN CONST BOOL_T force_clean, OUT GW_WF_NWC_STAT_T *p_nc_tp, GW_WF_MD_T* p_md);
#if !defined(ENABLE_MATTER) || (ENABLE_MATTER == 0) 
/**
 * @brief init wifi link reset.
 *
 * @param[in] mthd
 *
 * @param[in] md
 *
 * @note according to mthd and md, wifi reset module will be inited
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */

OPERATE_RET tuya_wifi_reset_init(CONST GW_WF_CFG_MTHD_SEL mthd, GW_WF_MD_T md);

#endif

/**
 * @brief validate wifi params,such as nc_tp.
 *
 * @param[in&out] p_gw_wsm wifi related params
 *
 *
 * @note
 *
 * @return NONE
 */

VOID_T tuya_wifi_params_validate(GW_WORK_STAT_MAG_S* p_gw_wsm);

#if !defined(ENABLE_MATTER) || (ENABLE_MATTER == 0) 
/**
 * @brief reset wifi link when devos and wifi link is NOT inited.
 *
 * @param[in] wifi_start_mode
 *
 * @param[in] force_clean
 *
 * @note only called for fast mode when start up
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */

OPERATE_RET tuya_wifi_reset_fast(IN CONST GW_WF_START_MODE wifi_start_mode, CONST GW_WF_CFG_MTHD_SEL mthd, IN CONST BOOL_T force_clean);

#endif

#if defined(ENABLE_MATTER) && (ENABLE_MATTER == 1)
/**
 * @brief reset wifi params: nc_tp and md according to GW_WF_START_MODE
 *
 * @param[in] wifi_start_mode: wifi netcfg mode
 * @param[in] force_clean: clear wifi ssid&passwd ,and reset nc_tp & md by force
 * @param[inout] p_nc_tp: pointer of nc_tp
 * @param[inout] p_md: pointer of md
 *
 * @note called when reseting tuyaos
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
typedef OPERATE_RET(*wifi_reset_handler_fn)(IN CONST GW_WF_START_MODE wifi_start_mode, IN CONST BOOL_T force_clean, OUT GW_WF_NWC_STAT_T *p_nc_tp, GW_WF_MD_T* p_md);

/**
 * @brief timeout handler when wifi netcfg is ongoing, short timer and long timer
 *
 * @note called when tuyaos netcfg is ongoing 
 *
 * @return NONE
 */
typedef VOID_T(*timeout_handler_fn)(VOID_T);
/**
 * @brief Initialize the WiFi reset functionality
 * 
 * This function initializes the WiFi reset module and prepares it for operation.
 * It should be called during system initialization before any WiFi reset operations
 * are performed.
 * 
 * @param[in] VOID_T No parameters required
 * 
 * @return OPERATE_RET Operation result code
 * @retval OPRT_OK Success
 * @retval Other error codes indicating failure reason
 * 
 * @note This function must be called before using any other WiFi reset functions
 */
OPERATE_RET tuya_wifi_reset_init(VOID_T);
/**
 * @brief Performs a fast WiFi reset operation
 * 
 * This function initiates a fast reset of the WiFi configuration based on the
 * specified start mode and force clean flag.
 * 
 * @param[in] wifi_start_mode The WiFi start mode to be used after reset
 * @param[in] force_clean Flag indicating whether to force clean all WiFi settings
 *                        - TRUE: Force clean all settings
 *                        - FALSE: Perform selective reset
 * 
 * @return OPERATE_RET Returns the operation result
 *         - OPRT_OK: Operation successful
 *         - Error code: Operation failed
 * 
 * @note This is a fast reset operation which may skip certain cleanup steps
 *       compared to a full reset
 */
OPERATE_RET tuya_wifi_reset_fast(IN CONST GW_WF_START_MODE wifi_start_mode,  IN CONST BOOL_T force_clean);
/**
 * @brief tuya wifi reset params when register wifi reset handler
 */

typedef struct __wifi_reset_params_t{
    UINT16_T short_timer_val;
    UINT16_T long_timer_val;
    timeout_handler_fn short_timer_handler;
    timeout_handler_fn long_timer_handler;
    wifi_reset_handler_fn reset_handler;
}WIFI_RESET_PARAMS_T, *WIFI_RESET_PARAMS_PT;


/**
 * @brief reigster wifi reset releated callback funns: reset handler, short time handler ,and long time handler
 *
 * @param[in] wifi_reset_params wifi reset params
 *
 *
 * @note called in tuya_iot_wifi_api
 *
 * @return NONE
 */
OPERATE_RET tuya_wifi_reset_register_handler( WIFI_RESET_PARAMS_T wifi_reset_params );

/**
 * @brief GW_WF_CFG_MTHD_SEL mode timeout process, such as low power or speicial mode
 *        1) nc_tp and md will be saved to flash
 *        2) if is_update_gw_in_ram is TRUE, nc_tp and md will be saved to ram (gw_cntl.gw_wsm)
 *        3) the flash saved nc_tp and md will affect whether going to wifi netcfg or not after device reboot.
 * 
 *        -----------------------|-------------------------------------------------------------------------------------------------
 *             nc_tp             |    what does it mean?
 *        -----------------------|-------------------------------------------------------------------------------------------------
 *          GWNS_LOW_POWER       |    goto low power                                                                                                
 *          GWNS_UNCFG_SMC       |    goto ez or smart wifi netcfg       
 *          GWNS_UNCFG_AP        |    goto ap wifi netcfg                                                                                                
 *          GWNS_UNCFG_SMC_AP    |    goto ez or ap concurrent wifi netcfg                 
 *          GWNS_OTHER_UNCFG     |    goto other or third party wifi netcfg                                                                                                   
 *          GWNS_TY_SMARTCFG     |    goto already get ssid && passwd from ez mode                                                                                                     
 *          GWNS_TY_AP           |    goto already get ssid && passwd from ap mode                                                                                                                    
 *          GWNS_TY_SMART_AP_CFG |    goto already get ssid && passwd from ez or ap concurrent mode 
 *          GWNS_OTHER_CFGED     |    goto already get ssid && passwd from other or third party mode
 *        -----------------------|--------------------------------------------------------------------------------------------------
 * 
 *        --------------------------|-------------------------------------------------------------------------------------------
 *              md                  |  what does it mean?
 *        --------------------------|-------------------------------------------------------------------------------------------
 *          GWM_NORMAL 			    |  device has NO memory of wifi ssid & password
 *          GWM_SPECIAL_SMT_CFG     |  device has memory of ssid & password form ez, but NOW deice is in ez config
 *          GWM_SPECIAL_AP_CFG 		|  device has memory of ssid & password form ez, but NOW deice is in ap config
 *          GWM_SPECIAL_SMT_AP_CFG 	|  device has memory of ssid & password form ez, but NOW deice is in ez or ap concurrent config 
 *          GWM_SPECIAL_MATTER_CFG	|  device has memory of ssid & password form ez, but NOW deice is in other or third party config 
 *        --------------------------|-------------------------------------------------------------------------------------------
 * 
 *        -----------------------|-----------------------------------------------------------|--
 *                               |   GWM_NORMAL               |  GWM_SPECIAL_SMT_CFG         |  
 *                               |                            |  GWM_SPECIAL_AP_CFG          | 
 *                               |                            |  GWM_SPECIAL_SMT_AP_CFG      | 	
 *                               |                            |  GWM_OTHER_CFG 	             |   
 *        -----------------------|----------------------------|------------------------------|--
 *          GWNS_LOW_POWER       | low Power    Short & Long  |                              |   
 *                               | low Power Auto Long        |       x                      |   
 *                               | Special      Short & Long  |                              |   
 *                               | Special Auto Short & Long  |                              |                                               
 *        -----------------------|----------------------------|------------------------------|--
 *          GWNS_UNCFG_SMC       |         x                  |       x
 *        -----------------------|----------------------------|------------------------------|--
 *          GWNS_UNCFG_SMC_AP    |         x                  |       x                      |
 *        -----------------------|----------------------------|------------------------------|--
 *          GWNS_OTHER_UNCFG     |         x                  |       x                      |                            
 *        -----------------------|----------------------------|------------------------------|--
 *          GWNS_UNCFG_AP        |         x                  |       x                      |                          
 *        -----------------------|----------------------------|------------------------------|--
 *          GWNS_TY_SMARTCFG     |         x                  |  Special      Short & Long   |                                                       
 *                               |                            |  Special Auto Short & Long   |
 *        -----------------------|----------------------------|------------------------------|--
 *          GWNS_TY_AP           |         x                  |  Special      Short & Long   |                                                    
 *                               |                            |  Special Auto Short & Long   |
 *        -----------------------|----------------------------|------------------------------|--
 *          GWNS_TY_SMART_AP_CFG |         x                  |  Special      Short & Long   |                                                                
 *                               |                               Special Auto Short & Long   |
 *        -----------------------|----------------------------|------------------------------|--
 *          GWNS_OTHER_CFGED     |         x                  |  Special      Short & Long   |                                                                            
 *                               |                            |  Special Auto Short & Long   |
 *        -----------------------|----------------------------|------------------------------|---
 * 
 * @param[in] new_nc_tp_to_be_flashed new nc_tp to be saved in flash
 * @param[in] new_md_to_be_flashed new md to be saved in flash
 * @param[in] is_upgrade_gw_in_ram update nc_tp and md in gw_wsm in ram?
 *
 * @note 
 *
 * @return NONE
 */
OPERATE_RET tuya_wifi_reset_timer_expired_proc(OUT GW_WF_NWC_STAT_T new_nc_tp_to_be_flashed, GW_WF_MD_T new_md_to_be_flashed, BOOL_T is_update_gw_in_ram);

/**
 * @brief clean tuya wifi netcfg info: ssid,password and token
 *
 * @param[in] isCleanToken clean token or not
 *
 *
 * @note 
 *
 * @return NONE
 */
void tuya_wifi_reset_clean_ssid_passwd_token(VOID_T);

/**
 * @brief convert md to nc_tp
 *
 * @param[in] md refer to GW_WF_MD_T 
 *
 * @note 
 *
 * @return corresponding nc_tp
 */
GW_WF_NWC_STAT_T  tuya_wifi_reset_md_to_nc_tp(CONST GW_WF_MD_T md);
/**
 * @brief convert nc_tp to md
 *
 * @param[in] nctp refer to GW_WF_NWC_STAT_T
 *
 * @note 
 *
 * @return corresponding md
 */
GW_WF_MD_T tuya_wifi_reset_nc_tp_to_md(CONST GW_WF_NWC_STAT_T nctp);


/**
 * @brief clean tuya wifi netcfg info: ssid,password or token
 *
 * @param[in] isCleanToken clean token or not
 *
 *
 * @note 
 *
 * @return NONE
 */
VOID_T tuya_wifi_clear_netcfg(bool isCleanToken);

/**
 * @brief Get the long timer value for WiFi reset.
 *
 * This function returns the long timer value for WiFi reset.
 *
 * @return The long timer value for WiFi reset.
 */
UINT16_T tuya_wifi_reset_get_long_timer_val(VOID_T);
#endif

#ifdef __cplusplus
}
#endif

#endif
