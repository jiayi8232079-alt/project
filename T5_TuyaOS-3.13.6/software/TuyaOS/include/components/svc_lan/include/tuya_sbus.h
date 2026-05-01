#ifndef __TUYA_SBUS_H__
#define __TUYA_SBUS_H__

#include "tal_sbus.h"

#ifdef __cplusplus
extern "C" {
#endif

#define EVENT_SBUS_START    "sbus.start"

typedef struct {
    CHAR_T  devid[DEV_ID_LEN + 1];
    uint8_t stat;
} tuya_sbus_pipe_stat_t;


typedef struct {
    int (*bind)     (tal_sbus_t *sbus,  CHAR_T *service_json, CHAR_T *user_data);
    int (*unbind)   (tal_sbus_t *sbus,  CHAR_T *service_json, CHAR_T *user_data);
    int (*stat)     (tal_sbus_t *sbus,  CHAR_T *service_json, tuya_sbus_pipe_stat_t **stat, UINT8_T *count, CHAR_T *user_data);
} tuya_sbus_pipe_ops_t;


typedef enum {
    SBUS_PIPE_CLIENT,
    SBUS_PIPE_SERVER,
} sbus_pipe_type_t;

typedef enum {
    SBUS_PIPE_EVENT_BIND,
    SBUS_PIPE_EVENT_CONNECTED,
    SBUS_PIPE_EVENT_CLOSE,
    SBUS_PIPE_EVENT_UNBIND,
    SBUS_PIPE_EVENT_DATA,
} sbus_pipe_event_t;

typedef VOID *tuya_sbus_pipe_t;

typedef int (*sbus_pipe_event_cb)(sbus_pipe_event_t event, uint8_t *devid, uint8_t *data, uint16_t datalen);

typedef struct {
    CHAR_T                     *service_bind;
    sbus_pipe_event_cb          event_cb;
} tuya_sbus_client_pipe_cfg_t;

typedef struct {
    INT_T                       proto;
    UINT32_T                    port;
    CHAR_T                     *service_bind;
    tal_sbus_service_attr_t     attr;
    sbus_pipe_event_cb          event_cb;
} tuya_sbus_server_pipe_cfg_t;


OPERATE_RET tuya_sbus_init(void);
tal_sbus_t *tuya_sbus_get(void);
OPERATE_RET tuya_sbus_service_pipe_register     (CHAR_T *service,  tuya_sbus_pipe_ops_t *pipe_ops, VOID *user_data);

tuya_sbus_pipe_t *tuya_sbus_client_pipe_create  (tuya_sbus_client_pipe_cfg_t *cfg);

tuya_sbus_pipe_t *tuya_sbus_server_pipe_create  (tuya_sbus_server_pipe_cfg_t *cfg);

OPERATE_RET       tuya_sbus_pipe_send           (tuya_sbus_pipe_t *ctx, uint8_t *data, uint32_t datalen, int flag);

OPERATE_RET       tuya_sbus_pipe_is_establish   (tuya_sbus_pipe_t *ctx);


#ifdef __cplusplus
}

#endif
#endif //__TUYA_SBUS_H__
