/**
 * @file mcp_client_policy.c
 * @brief 第三方 MCP 工具权限与确认策略实现
 */

#include "mcp_client_policy.h"

#include <string.h>

STATIC BOOL_T __contains_kw(CONST CHAR_T *name, CONST CHAR_T *kw)
{
    return (name && kw && strstr(name, kw) != NULL);
}

MCP_CLIENT_RISK_E mcp_client_policy_infer_tool_risk(CONST CHAR_T *orig_tool_name)
{
    if (!orig_tool_name)
        return MCP_CLIENT_RISK_QUERY;

    if (__contains_kw(orig_tool_name, "payment") || __contains_kw(orig_tool_name, "pay") ||
        __contains_kw(orig_tool_name, "checkout"))
        return MCP_CLIENT_RISK_PAYMENT;

    if (__contains_kw(orig_tool_name, "create-order") || __contains_kw(orig_tool_name, "create_order") ||
        __contains_kw(orig_tool_name, "redeem") || __contains_kw(orig_tool_name, "order") ||
        __contains_kw(orig_tool_name, "purchase") || __contains_kw(orig_tool_name, "buy"))
        return MCP_CLIENT_RISK_PURCHASE;

    if (__contains_kw(orig_tool_name, "coupon") || __contains_kw(orig_tool_name, "address") ||
        __contains_kw(orig_tool_name, "save") || __contains_kw(orig_tool_name, "update") ||
        __contains_kw(orig_tool_name, "write") || __contains_kw(orig_tool_name, "set") ||
        __contains_kw(orig_tool_name, "claim"))
        return MCP_CLIENT_RISK_WRITE;

    /* 查询类关键词（在 write/purchase/payment 判定之后，故 order/pay/claim 等已被优先拦截，
     * 这里只放行纯浏览语义：查菜单/门店/推荐/商品等，保证"我想吃汉堡→返回选项"可自动执行） */
    if (__contains_kw(orig_tool_name, "query") || __contains_kw(orig_tool_name, "search") ||
        __contains_kw(orig_tool_name, "list") || __contains_kw(orig_tool_name, "get") ||
        __contains_kw(orig_tool_name, "find") || __contains_kw(orig_tool_name, "menu") ||
        __contains_kw(orig_tool_name, "meal") || __contains_kw(orig_tool_name, "food") ||
        __contains_kw(orig_tool_name, "recommend") || __contains_kw(orig_tool_name, "product") ||
        __contains_kw(orig_tool_name, "catalog") || __contains_kw(orig_tool_name, "browse") ||
        __contains_kw(orig_tool_name, "store") || __contains_kw(orig_tool_name, "shop") ||
        __contains_kw(orig_tool_name, "nearby") || __contains_kw(orig_tool_name, "detail") ||
        __contains_kw(orig_tool_name, "price"))
        return MCP_CLIENT_RISK_QUERY;

    return MCP_CLIENT_RISK_WRITE;
}

VOID mcp_client_policy_decide(CONST MCP_CLIENT_SERVER_CFG_T *server,
                              CONST CHAR_T *orig_tool_name,
                              MCP_CLIENT_RISK_E tool_risk,
                              MCP_CLIENT_POLICY_DECISION_T *out)
{
    MCP_CLIENT_RISK_E effective;

    if (!out)
        return;

    memset(out, 0, sizeof(*out));

    effective = tool_risk;
    if (server && server->risk_level > effective)
        effective = server->risk_level;

    out->effective_risk = effective;
    out->require_user_confirm = (server && server->require_user_confirm);

    if (effective >= MCP_CLIENT_RISK_PURCHASE)
        out->require_user_confirm = TRUE;

    if (effective == MCP_CLIENT_RISK_PAYMENT) {
        out->allow_auto_call = FALSE;
        out->require_user_confirm = TRUE;
        return;
    }

    if (effective == MCP_CLIENT_RISK_PURCHASE) {
        out->allow_auto_call = FALSE;
        return;
    }

    if (effective == MCP_CLIENT_RISK_WRITE) {
        out->allow_auto_call = FALSE;
        if (!out->require_user_confirm)
            out->require_user_confirm = TRUE;
        return;
    }

    (VOID)orig_tool_name;
    out->allow_auto_call = TRUE;
}
