/**
 * @file mcp_client_bridge.h
 * @brief 小智 MCP Bridge 预留（wss 暴露聚合工具，与 streamablehttp Client 分离）
 */

#ifndef __MCP_CLIENT_BRIDGE_H__
#define __MCP_CLIENT_BRIDGE_H__

#include "tuya_cloud_types.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    CHAR_T wss_url[256];
    BOOL_T enabled;
} MCP_CLIENT_XIAOZHI_BRIDGE_CFG_T;

OPERATE_RET mcp_client_bridge_init(VOID);
OPERATE_RET mcp_client_bridge_set_config(CONST MCP_CLIENT_XIAOZHI_BRIDGE_CFG_T *cfg);
OPERATE_RET mcp_client_bridge_start(VOID);
OPERATE_RET mcp_client_bridge_stop(VOID);
BOOL_T mcp_client_bridge_is_running(VOID);

#ifdef __cplusplus
}
#endif

#endif /* __MCP_CLIENT_BRIDGE_H__ */
