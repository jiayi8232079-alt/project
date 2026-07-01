/**
 * @file mcp_client_types.h
 * @brief 第三方 MCP Client 聚合 — 公共类型与常量
 */

#ifndef __MCP_CLIENT_TYPES_H__
#define __MCP_CLIENT_TYPES_H__

#include "tuya_cloud_types.h"
#include "ty_cJSON.h"

#ifdef __cplusplus
extern "C" {
#endif

#define MCP_CLIENT_KV_KEY           "wk_mcp_client_cfg"
#define MCP_CLIENT_MAX_SERVERS      8
#define MCP_CLIENT_MAX_TOOLS        64
#define MCP_CLIENT_ID_MAX           32
#define MCP_CLIENT_NAME_MAX         64
#define MCP_CLIENT_URL_MAX          256
#define MCP_CLIENT_TOOL_NAME_MAX    64
#define MCP_CLIENT_TOOL_DESC_MAX    256
#define MCP_CLIENT_HTTP_TIMEOUT_MS  15000
#define MCP_CLIENT_HTTP_RESP_MAX    (32 * 1024)

/** MCP Server 传输类型（MVP 仅实现 streamablehttp） */
typedef enum {
    MCP_CLIENT_TYPE_UNKNOWN = 0,
    MCP_CLIENT_TYPE_STDIO,           /**< 预留 */
    MCP_CLIENT_TYPE_SSE,             /**< 预留 */
    MCP_CLIENT_TYPE_WEBSOCKET,       /**< 预留 */
    MCP_CLIENT_TYPE_STREAMABLEHTTP,
} MCP_CLIENT_TRANSPORT_E;

/** 服务端默认风险等级 */
typedef enum {
    MCP_CLIENT_RISK_QUERY = 0,
    MCP_CLIENT_RISK_WRITE,
    MCP_CLIENT_RISK_PURCHASE,
    MCP_CLIENT_RISK_PAYMENT,
} MCP_CLIENT_RISK_E;

/** 单条 MCP Server 配置（headers 含 Token，禁止完整打日志） */
typedef struct {
    CHAR_T id[MCP_CLIENT_ID_MAX];
    CHAR_T name[MCP_CLIENT_NAME_MAX];
    MCP_CLIENT_TRANSPORT_E type;
    CHAR_T url[MCP_CLIENT_URL_MAX];
    ty_cJSON *headers;
    BOOL_T enabled;
    MCP_CLIENT_RISK_E risk_level;
    BOOL_T require_user_confirm;
    UINT_T created_at;
    UINT_T updated_at;
} MCP_CLIENT_SERVER_CFG_T;

/** 聚合后的 namespaced 工具缓存项 */
typedef struct {
    CHAR_T mcp_id[MCP_CLIENT_ID_MAX];
    CHAR_T orig_name[MCP_CLIENT_TOOL_NAME_MAX];
    CHAR_T namespaced[MCP_CLIENT_TOOL_NAME_MAX + MCP_CLIENT_ID_MAX + 4];
    CHAR_T description[MCP_CLIENT_TOOL_DESC_MAX];
    ty_cJSON *input_schema;
    MCP_CLIENT_RISK_E inferred_risk;
    BOOL_T require_confirm;
} MCP_CLIENT_TOOL_CACHE_T;

#ifdef __cplusplus
}
#endif

#endif /* __MCP_CLIENT_TYPES_H__ */
