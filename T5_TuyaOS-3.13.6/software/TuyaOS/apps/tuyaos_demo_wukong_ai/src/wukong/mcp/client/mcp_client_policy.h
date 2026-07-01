/**
 * @file mcp_client_policy.h
 * @brief 第三方 MCP 工具权限与确认策略
 */

#ifndef __MCP_CLIENT_POLICY_H__
#define __MCP_CLIENT_POLICY_H__

#include "mcp_client_types.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    BOOL_T allow_auto_call;
    BOOL_T require_user_confirm;
    MCP_CLIENT_RISK_E effective_risk;
} MCP_CLIENT_POLICY_DECISION_T;

VOID mcp_client_policy_decide(CONST MCP_CLIENT_SERVER_CFG_T *server,
                              CONST CHAR_T *orig_tool_name,
                              MCP_CLIENT_RISK_E tool_risk,
                              MCP_CLIENT_POLICY_DECISION_T *out);

MCP_CLIENT_RISK_E mcp_client_policy_infer_tool_risk(CONST CHAR_T *orig_tool_name);

#ifdef __cplusplus
}
#endif

#endif /* __MCP_CLIENT_POLICY_H__ */
