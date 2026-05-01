/**********************************************************************************
*Function:   tuya_rtc.h
*Description:
*   Tuya P2P模块对外处理接口，提供模块的初始化，数据传入回调，数据传出回调;视频数据的发送及通道数据的接收.
*Date:
*   2020-01-16
*
*Copyright(C),2019-2022, 涂鸦科技 www.tuya.comm
************************************************************************************/
#ifndef __TUYA_MEDIA_SERVICE_RTC_H__
#define __TUYA_MEDIA_SERVICE_RTC_H__

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>
#include <stdbool.h>
#include "tuya_iot_config.h"

#define TUYA_P2P_ID_LEN_MAX 80
#define TUYA_P2P_CHANNEL_NUMBER_MAX 6
#define TUYA_P2P_SESSION_NUMBER_MAX 1024

//
//#define TUYA_P2P_SEND_BUFFER_SIZE_MAX (800*1024)
//#define TUYA_P2P_SEND_BUFFER_SIZE_MIN (500*1024)
//#define TUYA_P2P_RECV_BUFFER_SIZE_MAX (800*1024)
//#define TUYA_P2P_RECV_BUFFER_SIZE_MIN (500*1024)
//

#define TUYA_P2P_VIDEO_BITRATE_MIN (600)
#define TUYA_P2P_VIDEO_BITRATE_MAX (4000)

#define TUYA_P2P_ERROR_SUCCESSFUL						0
#define TUYA_P2P_ERROR_NOT_INITIALIZED					-1
#define TUYA_P2P_ERROR_ALREADY_INITIALIZED				-2
#define TUYA_P2P_ERROR_TIME_OUT				            -3
//#define TUYA_P2P_ERROR_INVALID_ID						-4
#define TUYA_P2P_ERROR_INVALID_PARAMETER				-5
//#define TUYA_P2P_ERROR_DEVICE_NOT_ONLINE				-6
//#define TUYA_P2P_ERROR_FAIL_TO_RESOLVE_NAME			-7
//#define TUYA_P2P_ERROR_INVALID_PREFIX					-8
//#define TUYA_P2P_ERROR_ID_OUT_OF_DATE					-9
//#define TUYA_P2P_ERROR_NO_RELAY_SERVER_AVAILABLE		-10
#define TUYA_P2P_ERROR_INVALID_SESSION_HANDLE			-11
#define TUYA_P2P_ERROR_SESSION_CLOSED_REMOTE			-12
#define TUYA_P2P_ERROR_SESSION_CLOSED_TIMEOUT			-13
#define TUYA_P2P_ERROR_SESSION_CLOSED_CALLED			-14
#define TUYA_P2P_ERROR_REMOTE_SITE_BUFFER_FULL			-15
#define TUYA_P2P_ERROR_USER_LISTEN_BREAK				-16
#define TUYA_P2P_ERROR_MAX_SESSION						-17
#define TUYA_P2P_ERROR_UDP_PORT_BIND_FAILED			    -18
#define TUYA_P2P_ERROR_USER_CONNECT_BREAK				-19
#define TUYA_P2P_ERROR_SESSION_CLOSED_INSUFFICIENT_MEMORY	-20
#define TUYA_P2P_ERROR_INVALID_APILICENSE				-21
#define TUYA_P2P_ERROR_FAIL_TO_CREATE_THREAD			-22
#define TUYA_P2P_ERROR_OUT_OF_SESSION                   -23
#define TUYA_P2P_ERROR_INVALID_PRE_SESSION              -24
#define TUYA_P2P_ERROR_PRE_SESSION_NOT_CONNECTED        -25
#define TUYA_P2P_ERROR_PRE_SESSION_ALREADY_ACTIVE       -26
#define TUYA_P2P_ERROR_PRE_SESSION_NOT_ACTIVE           -27
#define TUYA_P2P_ERROR_PRE_SESSION_SUSPENDED            -28
#define TUYA_P2P_ERROR_OUT_OF_MEMORY                    -29

typedef enum {
    tuya_p2p_rtc_frame_type_audio,
    tuya_p2p_rtc_frame_type_video_p,
    tuya_p2p_rtc_frame_type_video_i
}tuya_p2p_rtc_frame_type_e; //帧格式.

typedef enum tuya_p2p_rtc_connection_type {
    tuya_p2p_rtc_connection_type_p2p,
    tuya_p2p_rtc_connection_type_webrtc
}tuya_p2p_rtc_connection_type_e;    //p2p普通连接或者WEBRTC连接.

#if defined(ENABLE_UPNP) && (ENABLE_UPNP == 1)

#define TUYA_P2P_UPNP_ADDRESS_LENGTH    16			//IP地址长度
#define TUYA_P2P_UPNP_PROTOCOL_LENGTH   4			//协议长度 tcp or udp

typedef enum {
    tuya_p2p_rtc_upnp_port_protocol_udp,
    tuya_p2p_rtc_upnp_port_protocol_tcp
}tuya_p2p_rtc_upnp_port_protocol;

typedef struct _tuya_p2p_rtc_upnp_port_link_t {
	char protocol[TUYA_P2P_UPNP_PROTOCOL_LENGTH];
	int external_port;
	char remount_host[TUYA_P2P_UPNP_ADDRESS_LENGTH];
	int internal_port;
	char internal_client[TUYA_P2P_UPNP_ADDRESS_LENGTH];
	int route_level;
	int index;
	struct _tuya_p2p_rtc_upnp_port_link_t* next;
}tuya_p2p_rtc_upnp_port_link_t;

#endif

typedef struct tuya_p2p_rtc_audio_codec {
    char name[64];              //名称.
    int sample_rate;            //采样率.
    int channel_number;         //通道编号.
}tuya_p2p_rtc_audio_codec_t;    //音频编码格式.

typedef struct tuya_p2p_rtc_video_codec {
    char name[64];              //名称.
    int clock_rate;             //时钟率.
}tuya_p2p_rtc_video_codec_t;    //视频编码格式.

typedef struct {
    char *buf;                  //缓冲区指针.
    uint32_t size;              //数据大小值.
    uint32_t len;               //长度.
    uint64_t pts;               //pts值.
    uint64_t timestamp;         //时间戳.
    tuya_p2p_rtc_frame_type_e frame_type;   //帧类型,音频，视频I帧/P帧.
}tuya_p2p_rtc_frame_t;      //WEB-RTC使用数据帧结构

typedef struct {
    int32_t handle;             //Sesion会话操作句柄或者ID号.
    tuya_p2p_rtc_connection_type_e connection_type; //连接类型.WEB-rtc或者正常P2P连接.
    tuya_p2p_rtc_audio_codec_t audio_codec;         //音频编码.
    tuya_p2p_rtc_video_codec_t video_codec;         //视频编译.
    char trace_id[128];
    char session_id[64];
    char sub_dev_id[64];
    int32_t stream_type;                            //码流类型 0 -- 主码流 1 -- 子码流
    int32_t is_replay;
    char start_time[32];
    char end_time[32];
}tuya_p2p_rtc_session_info_t;   //RTCsession 会话信息.

///////////////////////////////////////////////////////////////////////////////////////////////////
// tuya p2p sdk 依赖几个外部服务，通过回调或接口实现：
//  1. 信令发送
//      当 tuya p2p sdk 需要发送信令时，会调用上层实现的 tuya_p2p_rtc_signaling_cb_t 进行发送,向MQTT服务器或者local-Cmd通道、UDP-RelayServer发送.
//      数据传出给到Peer端.
//  2. 信令接受
//      当上层收到信令时，通过 tuya_p2p_rtc_set_signaling 接口设置到 tuya p2p sdk,数据传入接口.
//  3. HTTP 服务
//      当 tuya p2p sdk 需要发送日志时，会调用上层实现的 tuya_p2p_rtc_log_cb_t 进行发送,数据传出接口.上报日志信息.
///////////////////////////////////////////////////////////////////////////////////////////////////

//
//  ====== token format ======
//  {
//      "username" : "12334939:mbzrxpgjys",
//      "password" : "adfsaflsjfldssia",
//      "ttl" : 86400,
//      "uris" : [
//          "turn:1.2.3.4:9991?transport=udp",
//          "turn:1.2.3.4:9992?transport=tcp",
//          "turns:1.2.3.4:443?transport=tcp"
//      ]
// }
//

///////////////////////////////////////////////////////////////////////////////////////////////////
// Description:
//  信令回调，用于发送信令
//Pararmeter:
//  remote_id: 表示向 remote_id 发送信令
//  signaling: 信令内容的起始地址
//  len: 信令内容的长度
//Return:
//  void
///////////////////////////////////////////////////////////////////////////////////////////////////
typedef void (*tuya_p2p_rtc_signaling_cb_t)(char *remote_id, char *signaling, uint32_t len);

///////////////////////////////////////////////////////////////////////////////////////////////////
// Description:
//  日志回调，用于发送日志
//Pararmeter:
//  log: 日志内容的起始地址
//  len: 日志内容的长度
//Return:
//  void
///////////////////////////////////////////////////////////////////////////////////////////////////
typedef void (*tuya_p2p_rtc_log_cb_t)(int level, char *log, uint32_t len);
typedef int (*tuya_p2p_rtc_log_get_level_cb_t)();
///////////////////////////////////////////////////////////////////////////////////////////////////
// Description:
//  鉴权回调，用于验证offer是否合法
//Parameter:
// 用 hmac-sha256 对 buf 内容计算 hash，再对 hash 结果计算 base64 编码，
// 计算方法：base64(hmac-sha256(key=password, content=buf, length=len))
// 将结果跟 md 比较, 相同返回 0， 不同返回 -1
//Retrun:
//  0:相同. -1:不同.
/////////////////////////////////////////////////////////////////////////////////////////////////
typedef int32_t (*tuya_p2p_rtc_auth_cb_t)(char *buf, uint32_t len, char *md, uint32_t md_len);

///////////////////////////////////////////////////////////////////////////////////////////////////
// Description:
//  http回调，用于发送http请求
//Parameter:
// api: http接口名称
// devId: 设备编号
// content: 请求内容
// content_len: content长度
//Retrun:
//  0:相同. -1:不同.
/////////////////////////////////////////////////////////////////////////////////////////////////
typedef int32_t (*tuya_p2p_rtc_http_cb_t)(char *api, char *devId, char *content, uint32_t content_len);

///////////////////////////////////////////////////////////////////////////////////////////////////
// Description:
// AES加密解密操作回调接口.
//Parameter:
// mode: "aes", "ecb", ...
// crypt: "encrypt", "decrypt"
//Retrun:
//  0:成功. -1:失败.
/////////////////////////////////////////////////////////////////////////////////////////////////
typedef int (*tuya_p2p_rtc_aes_create_cb_t)(void **handle, char *mode, char *crypt, char *key, int key_bits);
typedef int (*tuya_p2p_rtc_aes_destroy_cb_t)(void *handle);
typedef int (*tuya_p2p_rtc_aes_encrypt_cb_t)(void *handle, int length, char *iv, char *input, char *output);
typedef int (*tuya_p2p_rtc_aes_decrypt_cb_t)(void *handle, int length, char *iv, char *input, char *output);

#if defined(ENABLE_UPNP) && (ENABLE_UPNP == 1)
// upnp callback functions
typedef int (*tuya_p2p_rtc_upnp_alloc_port_cb_t)(tuya_p2p_rtc_upnp_port_protocol protocol, int *local_port, char *address, int *port);
typedef int (*tuya_p2p_rtc_upnp_release_port_cb_t)(tuya_p2p_rtc_upnp_port_protocol protocol, int local_port);
typedef int (*tuya_p2p_rtc_upnp_bind_result_cb_t)(tuya_p2p_rtc_upnp_port_protocol protocol, int local_port, int error_code);
typedef tuya_p2p_rtc_upnp_port_link_t* (*tuya_p2p_rtc_upnp_request_port_list_cb_t)(tuya_p2p_rtc_upnp_port_protocol protocol,unsigned int port); 

#endif

typedef struct tuya_p2p_rtc_cb{
    tuya_p2p_rtc_signaling_cb_t on_signaling;       //信令回馈或者上报的回调接口.
    tuya_p2p_rtc_signaling_cb_t on_moto_signaling;  //同样信令上报回调接口.
    tuya_p2p_rtc_signaling_cb_t on_lan_signaling;   //局域网线程数据上报.
    tuya_p2p_rtc_log_cb_t on_log;                   //日志上报回调接口.
    tuya_p2p_rtc_log_get_level_cb_t on_log_get_level; // 日志回调，应用层将日志内容上报云端
    tuya_p2p_rtc_auth_cb_t on_auth;                 //鉴权认证回调接口.
    tuya_p2p_rtc_http_cb_t on_http;                 // http回调，app端使用，当tuya p2p sdk 需要http接口时调用
    struct {
        tuya_p2p_rtc_aes_create_cb_t on_create;     //AES创建回调接口.
        tuya_p2p_rtc_aes_destroy_cb_t on_destroy;   //AES销毁回调同接口.
        tuya_p2p_rtc_aes_encrypt_cb_t on_encrypt;   //AES加密回调接口.
        tuya_p2p_rtc_aes_decrypt_cb_t on_decrypt;   //AES解密回调接口.
    }aes;
#if defined(ENABLE_UPNP) && (ENABLE_UPNP == 1)
    struct {
        tuya_p2p_rtc_upnp_alloc_port_cb_t on_alloc;         //获取UPNP映射的端口信息.
        tuya_p2p_rtc_upnp_release_port_cb_t on_release;     //释放UPNP映射的端口.
        tuya_p2p_rtc_upnp_bind_result_cb_t on_bind;         //将绑定映射端口结果回馈给UPNP模组.
        tuya_p2p_rtc_upnp_request_port_list_cb_t on_request_port_list; //获取多级路由映射的地址及端口号信息.
    }upnp;
#endif
}tuya_p2p_rtc_cb_t;

// p2p sdk 初始化参数
typedef struct tuya_p2p_rtc_options{
    char local_id[TUYA_P2P_ID_LEN_MAX];                     // 本地 id， 设备端填设备 id，客户端填 uid
    tuya_p2p_rtc_cb_t cb;                                   // 回调接口
    uint32_t max_channel_number;                            // 每个连接最大的通道数
    uint32_t max_session_number;                            // 允许同时发起或接收几个连接
    uint32_t max_pre_session_number;                        // 允许同时发起或接收几个预连接
    uint32_t send_buf_size[TUYA_P2P_CHANNEL_NUMBER_MAX];    // 各个通道的发送缓冲区大小，单位字节
    uint32_t recv_buf_size[TUYA_P2P_CHANNEL_NUMBER_MAX];    // 各个通道的接收缓冲区大小，单位字节
    uint32_t video_bitrate_kbps;                            // 设备端填写视频的码率，客户端不需要设置
    uint32_t preconnect_enable;                             // 是否开启预连接，1:开启，0:关闭
    uint32_t congestion_control_enable;                     // 是否开启拥塞控制功能
    uint32_t fragement_len;                                 // 数据发送接口分包长度
}tuya_p2p_rtc_options_t;
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/***********************************************************
*  Function: tuya_p2p_rtc_get_version
*  Desc:     获取当前p2p模块的sdk版本号.
*  Input:    void
*  Output:   void
*  Return:   uint32_t 当前版本号的值.
***********************************************************/
uint32_t tuya_p2p_rtc_get_version();

/***********************************************************
*  Function: tuya_p2p_rtc_get_version
*  Desc:     获取当前p2p模块的技能值.即当前p2p模块所支持的类型,ICE/UPD-Relay/TCP-Relay.
*  Input:    void
*  Output:   void
*  Return:   uint32_t 当前模块所赋于的技能值.
***********************************************************/
uint32_t tuya_p2p_rtc_get_skill();

/***********************************************************
*  Function: tuya_p2p_rtc_init
*  Desc:     初始化p2p模块.使用p2p模块必需初始化此函数.
*  Input:    void
*  Output:   void
*  Return:   0:表示初始化失败； 1:表示初始化成功.
***********************************************************/
int32_t tuya_p2p_rtc_init(tuya_p2p_rtc_options_t *opt);

/***********************************************************
*  Function: tuya_p2p_rtc_deinit
*  Desc:     反初始化p2p模块
*  Input:    void
*  Output:   void
*  Return:   0:表示初始化成功. 其它表示失败.
***********************************************************/
int32_t tuya_p2p_rtc_deinit();

/***********************************************************
*  Function: tuya_p2p_rtc_set_signaling
*  Desc:     外部数据传入接口.传入服务器下发的信令数据给到p2p模块.
*  Input:    remote_id,输入参数,远程对端的id号;
*  Input:    msg,输入参数,信令字符串;
*  Input:    msglen,输入参数,信令字符串长度值;
*  Output:   void
*  Return:   0:表示初始化成功. 其它表示失败.
***********************************************************/
int32_t tuya_p2p_rtc_set_signaling(char *remote_id, char *msg, uint32_t msglen);

/***********************************************************
*  Function: tuya_p2p_rtc_set_signaling_v2
*  Desc:     外部数据传入接口.传入服务器下发的信令数据给到p2p模块.带用户字符串.
*  Input:    remote_id,输入参数,远程对端的id号;
*  Input:    msg,输入参数,信令字符串;
*  Input:    msglen,输入参数,信令字符串长度值;
*  Input:    user_str,输入参数，用户的字符串数组;
*  Output:   void
*  Return:   0:表示初始化成功. 其它表示失败.
***********************************************************/
int32_t tuya_p2p_rtc_set_signaling_v2(char *remote_id, char *msg, uint32_t msglen, char *user_str);

/***********************************************************
*  Function: tuya_p2p_rtc_get_signaling_user_string
*  Desc:     s根据远端的ID从信令数据中获取用户字符串数据.
*  Input:    remote_id,输入参数,远程对端的id号;
*  Input:    msg,输入参数,信令字符串;
*  Input:    msglen,输入参数,信令字符串长度值;
*  Output:   user_str,输出参数，用户的字符串数组;
*  Input:    user_str_size，输入参数，用户字符串组的长度值.
*  Return:   0:表示初始化成功. 其它表示失败.
***********************************************************/
int32_t tuya_p2p_rtc_get_signaling_user_string(char *remote_id, char *msg, uint32_t msglen, char *user_str, int user_str_size);

// 发起连接需要授权信息，调用 tuya_p2p_rtc_connect 前需通过外部的 HTTP 服务获取授权信息，
// 获取到的授权信息按照要求组成 json 字符串传入, json 格式间上文
/***********************************************************
*  Function: tuya_p2p_rtc_connect
*  Desc:     (APP侧调用函数)根据远端的ID号以及服务器获取的token信息，trace_id连接对端(IPC侧).
*  Input:    remote_id,输入参数,远程对端的id号;
*  Input:    token,输入参数,从HTTP服务器上获取到的建立链的服务器地址信息.
*  Input:    token_len,输入参数,token信息数据的长度值;
*  Input:    trace_id,输入参数，连接需要的TRACE ID号.
*  Input:    lan_mode,输入参数，局域网连接模式.
*  Input:    timeout_ms,输入参数，超时时间长度值.
*  Return:   0:表示初始化成功. -1:表示失败.
***********************************************************/
int32_t tuya_p2p_rtc_connect(char *remote_id, char *token, uint32_t token_len, char *trace_id, int lan_mode, int timeout_ms);

/***********************************************************
*  Function: tuya_p2p_rtc_connect_break
*  Desc:     添加控制类型的信息给到rtc模块，断开当前connect连接.(以信令方式控制.)
*  Input:    NULL
*  Return:   0:表示初始化成功. -1:表示失败.
***********************************************************/
int32_t tuya_p2p_rtc_connect_break();

/***********************************************************
*  Function: tuya_p2p_rtc_listen
*  Desc:     IPC侧获取p2p建立完成的session新会话结点.
*  Input:    NULL
*  Return:   0:表示初始化成功. -1:表示失败.
***********************************************************/
int32_t tuya_p2p_rtc_listen();
/***********************************************************
*  Function: tuya_p2p_rtc_connect_break
*  Desc:     添加控制类型的信息给到rtc模块，断开当前listen侦听状态.(以信令方式控制.)
*  Input:    NULL
*  Return:   0:表示初始化成功. -1:表示失败.
***********************************************************/
int32_t tuya_p2p_rtc_listen_break();

/***********************************************************
*  Function: tuya_p2p_rtc_get_session_info
*  Desc:     根据new_rtc_session会话的handle句柄，获取rtc结点的所以信息.
*  Input:    handle,输入参数，session会话结点的handle句柄.
*  Output:   info,输出参数，返回rtc session结点信息. 
*  Return:   0:表示初始化成功. -1:表示失败.
***********************************************************/
int32_t tuya_p2p_rtc_get_session_info(int32_t handle, tuya_p2p_rtc_session_info_t *info);

/***********************************************************
*  Function: tuya_p2p_rtc_check
*  Desc:     根据输入的session会话handle句柄,检测当前会话是否还可用.
*  Input:    handle,输入参数，session会话结点的handle句柄.
*  Return:   0:表示成功. -1:表示失败.
***********************************************************/
int32_t tuya_p2p_rtc_check(int32_t handle);

/***********************************************************
*  Function: tuya_p2p_rtc_close
*  Desc:     关闭RTC会话结点.同时添加关闭的信息到incoming的队列中.(WEB-RTC)
*  Input:    handle:new-rtc-session会话对应的handle操作句柄.
*  Input:    reason:关闭new-rtc-session会话的原因.
*  Return:   0:表示成功.
***********************************************************/
int32_t tuya_p2p_rtc_close(int32_t handle,int32_t reason);

/***********************************************************
*  Function: tuya_p2p_rtc_send_frame
*  Desc:     外接传入接口，使用Frame帧方式，发送音视频数据以帧格式.(WEB-RTC)
*  Input:    handle,输入参数，session会话结点的handle句柄.
*  Input:    frame,发送的帧指针.
*  Return:   0:表示成功. -1:表示失败.
***********************************************************/
int32_t tuya_p2p_rtc_send_frame(int32_t handle, tuya_p2p_rtc_frame_t *frame);

/***********************************************************
*  Function: tuya_p2p_rtc_recv_frame
*  Desc:     外接传出接口，网络接收到的音频数据，以Frame帧格式打包输出.(WEB-RTC)
*  Input:    handle,输入参数，session会话结点的handle句柄.
*  Input:    frame,接收视频帧指针.
*  Return:   0:表示成功. -1:表示失败.
***********************************************************/
int32_t tuya_p2p_rtc_recv_frame(int32_t handle, tuya_p2p_rtc_frame_t *frame);

/***********************************************************
*  Function: tuya_p2p_rtc_send_data_internal
*  Desc:     向指定的通道上发送数据.
*  Input:    handle,输入参数，session会话结点的handle句柄.
*  Input：   channel_id,输入参数，指定发送数据的通道号.
*  Input:    buf,输出参数,需要发送数据的数据指针.
*  Input:    len,输出参数,需要发送数据的长度值;
*  Input:    timeout_ms,输入参数,发送数据的超时时长;
*  Return:   >0:表示成功. -1:表示失败.
*  返回值
*  >=0: 发送成功的字节数
*  TUYA_P2P_ERROR_TIME_OUT：发送超时
*  其他：失败失败
***********************************************************/
int32_t tuya_p2p_rtc_send_data(int32_t handle, uint32_t channel_id, char *buf, int32_t len, int32_t timeout_ms);

/***********************************************************
*  Function: tuya_p2p_rtc_recv_data
*  Desc:     对外函数接口，在指定的通道上获取数据.
*  Input:    handle,输入参数，session会话结点的handle句柄.
*  Input:    buf,输出参数,接收到的数据指针.
*  Input:    len,输出参数,接收到的数据的长度值;
*  Input:    timeout_ms,输入参数,接收数据的超时时长;
*  Return:   >0:表示成功. -1:表示失败.
*  返回值
*  0: 接收成功，*len 表示收到的字节数
*  TUYA_P2P_ERROR_TIME_OUT：接收超时
*  其他：接收失败
***********************************************************/
int32_t tuya_p2p_rtc_recv_data(int32_t handle, uint32_t channel_id, char *buf, int32_t *len, int32_t timeout_ms);

/***********************************************************
*  Function: tuya_p2p_rtc_check_buffer
*  Desc:     获取当前数据发送的缓冲已经使用了剩余的值及接收缓冲已经使用了剩余的值.
*  Input:    handle,输入参数，session会话结点的handle句柄.
*  Input:    channel_id,输入参数,当前需要发送数据的通道号.[命令通道、视频数据通道等待、对讲通道.]
*  Input:    write_size,输出参数,发送缓冲剩余值;
*  Input:    read_size,输出参数,接收缓冲还剩余多少可以接收的值;
*  Output:   send_free_size,输出参数，发送缓冲剩余值
*  Return:   0:表示成功. -1:表示失败.
***********************************************************/
int32_t tuya_p2p_rtc_check_buffer(int32_t handle, uint32_t channel_id, uint32_t *write_size, uint32_t *read_size, uint32_t *send_free_size);

/***********************************************************
*  Function: tuya_p2p_rtc_set_remote_online
*  Desc:     通过信令处理设置远端上线.*当前版本不支持此功能，兼容编译.
*  Input:    remote_id,输入参数，远程ID号..
*  Return:   0:表示成功. -1:表示失败.
***********************************************************/
int32_t tuya_p2p_rtc_set_remote_online(char *remote_id);

/***********************************************************
*  Function: tuya_p2p_getwaitsnd
*  Desc:     获取当前还在等待发送的数据长度值.
*  Input:    handle,输入参数，session会话结点的handle句柄.
*  Input:    channel_id,输入参数,当前需要发送数据的通道号.[命令通道、视频数据通道等待、对讲通道.]
*  Return:   0:表示成功. -1:表示失败.
***********************************************************/
int tuya_p2p_getwaitsnd(int32_t handle, uint32_t channel_id);

/***********************************************************
 * Function: tuya_p2p_rtc_congestion_control_enable
 * Desc:     拥塞控制使能开关
 * Input:    enable，1:打开拥塞控制功能，0:关闭拥塞控制功能
 * Return:   0:表示成功. -1:表示失败
***********************************************************/
int tuya_p2p_rtc_congestion_control_enable(int enable);

#ifdef __cplusplus
}
#endif

#endif
