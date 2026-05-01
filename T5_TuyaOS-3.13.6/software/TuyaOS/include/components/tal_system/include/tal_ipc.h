/**
 * @file tal_ipc.h
 * @brief inter-processor communication
 * @version 1.0
 * @date 2024-09-13
 *
 * @copyright Copyright (c) 2024 Tuya Inc. All Rights Reserved.
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

#ifndef __TAL_IPC_H__
#define __TAL_IPC_H__

#include "tuya_cloud_types.h"

#ifdef __cplusplus
extern "C" {
#endif

#define MAX_IPC_NAME_LEN (12)

/**
 * @brief Defines the roles for inter-core communication (IPC).
 *
 * This enumeration is used to identify the role of each core in a multi-core
 * communication setup.
 */
typedef enum {
    IPC_ROLE_CLIENT, // The core acts as the client, initiating communication.
    IPC_ROLE_SERVER, // The core acts as the server, responding to client requests.
    IPC_ROLE_P2P,    // The core can act as both client and server in a peer-to-peer setup.

    IPC_ROLE_MAX
} IPC_ROLE_E;

typedef PVOID_T IPC_HANDLE;
typedef PVOID_T IPC_PACKET;

typedef struct {
    BOOL_T is_ptr;
    union {
        UINT_T val;
        VOID *ptr;
    } data;
} IPC_RET_T;

IPC_PACKET ipc_packet_init(UINT_T len);
OPERATE_RET ipc_packet_uninit(IPC_PACKET packet);
OPERATE_RET ipc_packet_reset(IPC_PACKET packet);
OPERATE_RET ipc_packet_push_val(IPC_PACKET packet, UINT_T data);
OPERATE_RET ipc_packet_push_ptr(IPC_PACKET packet, VOID *data);
OPERATE_RET ipc_packet_push_raw(IPC_PACKET packet, VOID *data, UINT_T len);
OPERATE_RET ipc_packet_pop_val(IPC_PACKET packet, UINT_T *data);
OPERATE_RET ipc_packet_pop_ptr(IPC_PACKET packet, VOID **data);
OPERATE_RET ipc_packet_pop_raw(IPC_PACKET packet, VOID **data, UINT_T *len);

/**
 * @brief Callback function for handling received notify messages or responses in inter-core communication.
 *
 * This callback is triggered when a core receives data from another core, either as a response
 * to a request or as a notification message. The input data is processed and, if necessary,
 * a response is generated and sent back.
 *
 * @param[in]  req  Pointer to the input data received from the other core.
 * @param[out] ret Pointer to the response data.
 */
typedef VOID (*IPC_RECV_CB)(IPC_PACKET req, IPC_RET_T *ret);

/**
 * @brief Initializes the IPC communication with a specified role.
 *
 * @param[in]  name   Name of the IPC instance.
 * @param[in]  role   The role for the IPC (Client, Server, or P2P).
 * @param[in]  cb     Callback function to handle received data.
 * @param[out] handle Pointer to the IPC handle.
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tal_ipc_init(CONST CHAR_T *name, IPC_ROLE_E role, IPC_RECV_CB cb, IPC_HANDLE *handle);

/**
 * @brief Sends a request from one core to another and waits for a response.
 *
 * This function initiates an inter-core request, sending input data to the other core
 * and waiting for a reply. The function will block until a response is received.
 * The received data is then placed in the `out_data` buffer.
 *
 * @param[in]  handle  The IPC handle representing the communication channel.
 * @param[in]  req Pointer to the input data to be sent.
 * @param[out] rsp Pointer to the buffer for the response data (shall be freed by caller).
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tal_ipc_request(IPC_HANDLE handle, IPC_PACKET req, IPC_PACKET *rsp);

/**
 * @brief Sends a notification to the other core without expecting a response.
 *
 * @param[in] handle  The IPC handle.
 * @param[in] req    Pointer to the data to be sent.
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tal_ipc_notify(IPC_HANDLE handle, IPC_PACKET req);

#ifdef __cplusplus
}
#endif

#endif /* __TAL_IPC_H__ */
