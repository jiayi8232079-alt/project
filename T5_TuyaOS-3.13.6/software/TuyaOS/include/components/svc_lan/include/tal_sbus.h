#ifndef __TAL_SBUS_H__
#define __TAL_SBUS_H__

#include <stdint.h>
#include "tuya_cloud_types.h"
#include "tuya_cloud_com_defs.h"
#include "tuya_slist.h"
#include "tal_mutex.h"
#include "tal_thread.h"
#include "tal_workqueue.h"
#include "uni_log.h"

#ifdef __cplusplus
extern "C" {
#endif

#define SBUS_SERVICE_NAME_LEN       16
#define SBUS_BUFFER_LEN             1024    
#define SBUS_SERVICE_PORT           7005

typedef enum {
    TAL_SBUS_SERVICE_NOTIFY,            //！被动监听服务启动
    TAL_SBUS_SERVICE_DISCOVER,          //! 主动调用discover
    TAL_SBUS_SERVICE_REQUEST,           //！主动调用request
    TAL_SBUS_SERVICE_DATA,              //! 被动接收发布的数据
} tal_sbus_service_type_t;

typedef void (*tal_sbus_recv_cb)(tal_sbus_service_type_t type, CHAR_T *service_name, ty_cJSON *service_json, void *user_data);

typedef struct {
    CHAR_T                      name[SBUS_SERVICE_NAME_LEN];
    CHAR_T                     *desc;       //！具体的服务描述
    void                       *user_args;
    int                       (*desc_cb)(void *user_data,   char **desc_data);
} tal_sbus_service_attr_t;

typedef struct {
    UINT_T                      addr;
    uint16_t                    seqto;
    uint16_t                    seqform;
    UINT_T                      ttl;
} tal_sbus_msg_cache_t;


typedef struct {
    int                         fd;
    CHAR_T                      devid[DEV_ID_LEN + 1];
    CHAR_T                      key[16 + 1];
    MUTEX_HANDLE                list_mutex;
    MUTEX_HANDLE                send_mutex;
    SLIST_HEAD                  service_list;
    SLIST_HEAD                  subscribe_list;
    SLIST_HEAD                  msg_list;
    DELAYED_WORK_HANDLE         msg_tm;
    DELAYED_WORK_HANDLE         notify_tm;
    uint16_t                    sequence;   
    tal_sbus_msg_cache_t        msg_cache[5];
    uint8_t                     buffer[SBUS_BUFFER_LEN];
    uint16_t                    buffer_size;
#if TAL_SBUS_ENABLE_THREAD
    THREAD_HANDLE               thread;
#endif
} tal_sbus_t;

OPERATE_RET tal_sbus_init               (tal_sbus_t *sbus);

OPERATE_RET tal_sbus_service_notify     (tal_sbus_t *sbus);

OPERATE_RET tal_sbus_service_register   (tal_sbus_t *sbus, tal_sbus_service_attr_t *arrt);
OPERATE_RET tal_sbus_service_unregister (tal_sbus_t *sbus, char *name);

OPERATE_RET tal_sbus_service_discovery  (tal_sbus_t *sbus, CHAR_T *app_name, CHAR_T *service, UINT_T timeout_ms);
OPERATE_RET tal_sbus_service_request    (tal_sbus_t *sbus, CHAR_T *app_name, CHAR_T *service, CHAR_T *devid, TUYA_IP_ADDR_T addr);

OPERATE_RET tal_sbus_service_subscribe  (tal_sbus_t *sbus, CHAR_T *app_name, CHAR_T *sevrice, tal_sbus_recv_cb cb, void *user_args);
OPERATE_RET tal_sbus_service_unsubscribe(tal_sbus_t *sbus, CHAR_T *app_name, CHAR_T *service);

OPERATE_RET tal_sbus_service_publish    (tal_sbus_t *sbus, CHAR_T *devid, CHAR_T *service, CHAR_T *pubdata, TUYA_IP_ADDR_T addr);

OPERATE_RET tal_sbus_loop_run           (tal_sbus_t *sbus);

//! Utility
OPERATE_RET tal_sbus_key_set            (tal_sbus_t *sbus, char *key);


#ifdef __cplusplus
}
#endif
#endif //__TUYA_SBUS_H__

