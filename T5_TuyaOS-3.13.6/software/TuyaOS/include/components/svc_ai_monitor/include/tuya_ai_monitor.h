/**
 * @file tuya_ai_monitor.h
 * @author aoding.xia@tuya.com
 * @brief TUYA AI monitor service
 * @version 0.1
 * @date 2025-06-09
 *
 * @copyright Copyright 2014-2025 Tuya Inc. All Rights Reserved.
 *
 */

#ifndef __TUYA_AI_MONITOR_H__
#define __TUYA_AI_MONITOR_H__

#include "tuya_cloud_types.h"
#include "tuya_ai_biz.h"

#ifdef __cplusplus
extern "C" {
#endif

#define AI_PT_CUSTOM_LOG  60        // Custom pt type for log messages

#define AI_EVENT_MONITOR_FILTER     0xF000  // Filter for AI event monitor type filtering
#define AI_EVENT_MONITOR_ALG_CTRL   0xF001  // Algorithm/module control event
#define AI_EVENT_MONITOR_INVALID    0xFFFF  // Invalid event monitor type

/***********************************************************************
 ** ALG_CTRL Module Definitions                                       **
 **********************************************************************/

/* Module IDs for ALG_CTRL event routing */
#define AI_ALG_CTRL_MODULE_AUDIO_DUMP   0x01   // Audio dump control module
#define AI_ALG_CTRL_MODULE_MAX          8      // Maximum number of modules

/* Operation types for ALG_CTRL */
typedef enum {
    AI_ALG_CTRL_OP_SET = 0x00,    // Set parameter
    AI_ALG_CTRL_OP_GET = 0x01,    // Get parameter
} AI_ALG_CTRL_OP_E;

#pragma pack(1)
/**
 * @brief ALG_CTRL request payload structure
 * @note All multi-byte fields are in network byte order (big-endian)
 */
typedef struct {
    UINT8_T  module_id;     // Module ID (AI_ALG_CTRL_MODULE_xxx)
    UINT8_T  op;            // Operation type (AI_ALG_CTRL_OP_E)
    UINT8_T  cmd;           // Command ID (module-specific)
    UINT8_T  reserved;      // Reserved for alignment
    UINT16_T param1;        // Parameter 1 (network byte order)
    UINT16_T param2;        // Parameter 2 (network byte order)
} AI_ALG_CTRL_REQ_T;

/**
 * @brief ALG_CTRL response payload structure
 * @note All multi-byte fields are in network byte order (big-endian)
 */
typedef struct {
    UINT8_T  module_id;     // Module ID
    UINT8_T  op;            // Operation type
    UINT8_T  cmd;           // Command ID
    UINT8_T  result;        // Execution result (OPERATE_RET low 8 bits, 0=success)
    UINT16_T value1;        // Return value 1 (for GET, network byte order)
    UINT16_T value2;        // Return value 2 (for GET, network byte order)
    UINT16_T value3;        // Return value 3 (for GET, network byte order)
    UINT16_T value4;        // Return value 4 (for GET, network byte order)
} AI_ALG_CTRL_RESP_T;
#pragma pack()

/**
 * @brief ALG_CTRL callback function type
 * 
 * @param[in] op        Operation type: AI_ALG_CTRL_OP_SET or AI_ALG_CTRL_OP_GET
 * @param[in] cmd       Command ID (module-specific)
 * @param[in] param1    Input parameter 1
 * @param[in] param2    Input parameter 2
 * @param[out] out_val1 Output value 1 (used for GET operations)
 * @param[out] out_val2 Output value 2 (used for GET operations)
 * @param[out] out_val3 Output value 3 (used for GET operations)
 * @param[out] out_val4 Output value 4 (used for GET operations)
 * 
 * @return OPRT_OK on success. Others on error.
 */
typedef OPERATE_RET (*AI_ALG_CTRL_CB)(UINT8_T op, UINT8_T cmd,
                                       UINT16_T param1, UINT16_T param2,
                                       UINT16_T *out_val1, UINT16_T *out_val2,
                                       UINT16_T *out_val3, UINT16_T *out_val4);

/**
 * @brief Register ALG_CTRL callback for a specific module
 * 
 * @param[in] module_id Module ID (1 ~ AI_ALG_CTRL_MODULE_MAX)
 * @param[in] cb        Callback function
 * 
 * @return OPRT_OK on success. Others on error.
 */
OPERATE_RET tuya_ai_monitor_register_alg_ctrl_cb(UINT8_T module_id, AI_ALG_CTRL_CB cb);

/* AI Monitor custom upstream id */
#define TY_AI_MONITOR_US_LOG 0x8001
#define TY_AI_MONITOR_US_MIC 0x8003
#define TY_AI_MONITOR_US_REF 0x8005
#define TY_AI_MONITOR_US_AEC 0x8007
#define TY_AI_MONITOR_US_KWS 0x8009
#define TY_AI_MONITOR_US_VAD 0x800B

/**
 * @brief AI monitor message types
 */
typedef enum {
    AI_MSG_TYPE_PING            = 4,     // ping message
    AI_MSG_TYPE_PONG            = 5,     // pong message
    AI_MSG_TYPE_VIDEO_STREAM    = 30,    // video stream
    AI_MSG_TYPE_AUDIO_STREAM    = 31,    // audio stream
    AI_MSG_TYPE_IMAGE_STREAM    = 32,    // image stream
    AI_MSG_TYPE_FILE_STREAM     = 33,    // file stream
    AI_MSG_TYPE_TEXT_STREAM     = 34,    // text stream
    AI_MSG_TYPE_EVENT           = 35,    // event message
    AI_MSG_TYPE_ERROR           = 0xFF   // error message
} ai_monitor_msg_type_e;

/**
 * @brief AI monitor server configuration
 */
typedef struct {
    UINT_T port;                    // TCP server port
    UINT_T max_clients;             // maximum client connections
    UINT_T recv_buf_size;           // receive buffer size
    UINT_T send_buf_size;           // send buffer size
    UINT_T heartbeat_interval;      // heartbeat interval in seconds
    UINT_T heartbeat_timeout;       // heartbeat timeout in seconds
    BOOL_T enable_broadcast;        // enable broadcast to all clients
} ai_monitor_config_t;

#define AI_MONITOR_PORT_DEFAULT          5055
#define AI_MONITOR_MAX_CLIENTS_DEFAULT   3
#define AI_MONITOR_CFG_DEFAULT {\
    .port = AI_MONITOR_PORT_DEFAULT, \
    .max_clients = AI_MONITOR_MAX_CLIENTS_DEFAULT, \
    .recv_buf_size = 1024, \
    .send_buf_size = 1024, \
    .heartbeat_interval = 30, \
    .heartbeat_timeout = 60, \
    .enable_broadcast = TRUE \
}

/**
 * @brief initialize AI monitor TCP server
 *
 * @param[in] config server configuration
 * @param[in] callbacks callback functions
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_ai_monitor_init(CONST ai_monitor_config_t *config);

/**
 * @brief deinitialize AI monitor TCP server
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_ai_monitor_deinit(VOID);

/**
 * @brief check if server is running
 *
 * @return TRUE if running, FALSE otherwise
 */
BOOL_T tuya_ai_monitor_is_running(VOID);

/**
 * @brief broadcast message to all connected clients
 *
 * @param[in] id channel ID
 * @param[in] attr attribute information
 * @param[in] head header information
 * @param[in] data payload data
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_ai_monitor_broadcast(USHORT_T id, AI_BIZ_ATTR_INFO_T *attr, AI_BIZ_HEAD_INFO_T *head, CHAR_T *data);

/**
 * @brief broadcast text data to all connected clients
 *
 * @param[in] data text data to broadcast
 * @param[in] len length of the text data
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_ai_monitor_broadcast_text(CHAR_T *data, UINT_T len);

/**
 * @brief broadcast log data to all connected clients
 * 
 * @param[in] data log data to broadcast
 * @param[in] len length of the log data
 * 
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_ai_monitor_broadcast_log(CHAR_T *data, UINT_T len);

/**
 * @brief broadcast audio data to all connected clients
 * 
 * @param[in] data_id ID for the audio data
 * @param[in] stype stream type(Start/Ing/End)
 * @param[in] data audio data to broadcast
 * @param[in] len length of the audio data
 * 
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_ai_monitor_broadcast_audio(USHORT_T data_id, AI_STREAM_TYPE stype, AI_AUDIO_CODEC_TYPE codec_type, CHAR_T *data, UINT_T len);

OPERATE_RET tuya_ai_monitor_broadcast_audio_mic(AI_STREAM_TYPE stype, CHAR_T *data, UINT_T len);

OPERATE_RET tuya_ai_monitor_broadcast_audio_ref(AI_STREAM_TYPE stype, CHAR_T *data, UINT_T len);

OPERATE_RET tuya_ai_monitor_broadcast_audio_aec(AI_STREAM_TYPE stype, CHAR_T *data, UINT_T len);

OPERATE_RET tuya_ai_monitor_broadcast_audio_kws(AI_STREAM_TYPE stype, CHAR_T *data, UINT_T len);

OPERATE_RET tuya_ai_monitor_broadcast_audio_vad(AI_STREAM_TYPE stype, CHAR_T *data, UINT_T len);

/**
 * @brief dump server status information
 *
 */
VOID tuya_ai_monitor_dump_status(VOID);

#ifdef __cplusplus
}
#endif
#endif //__TUYA_AI_MONITOR_H__