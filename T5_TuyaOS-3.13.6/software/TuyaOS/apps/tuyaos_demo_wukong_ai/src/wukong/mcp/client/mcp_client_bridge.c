/**
 * @file mcp_client_bridge.c
 * @brief 小智 MCP Bridge 预留实现（未启用网络，仅占位）
 */

#include "mcp_client_bridge.h"

#include "tal_log.h"

STATIC MCP_CLIENT_XIAOZHI_BRIDGE_CFG_T s_bridge_cfg;
STATIC BOOL_T s_bridge_running = FALSE;

OPERATE_RET mcp_client_bridge_init(VOID)
{
    memset(&s_bridge_cfg, 0, sizeof(s_bridge_cfg));
    s_bridge_running = FALSE;
    return OPRT_OK;
}

OPERATE_RET mcp_client_bridge_set_config(CONST MCP_CLIENT_XIAOZHI_BRIDGE_CFG_T *cfg)
{
    if (!cfg)
        return OPRT_INVALID_PARM;
    s_bridge_cfg = *cfg;
    return OPRT_OK;
}

OPERATE_RET mcp_client_bridge_start(VOID)
{
    if (!s_bridge_cfg.enabled || !s_bridge_cfg.wss_url[0]) {
        TAL_PR_WARN("Xiaozhi bridge not configured");
        return OPRT_NOT_SUPPORTED;
    }

    /* 预留：连接 wss://api.xiaozhi.me/mcp/?token=... 并暴露聚合 tools */
    TAL_PR_INFO("Xiaozhi bridge start reserved url=%s", s_bridge_cfg.wss_url);
    s_bridge_running = TRUE;
    return OPRT_NOT_SUPPORTED;
}

OPERATE_RET mcp_client_bridge_stop(VOID)
{
    s_bridge_running = FALSE;
    return OPRT_OK;
}

BOOL_T mcp_client_bridge_is_running(VOID)
{
    return s_bridge_running;
}
