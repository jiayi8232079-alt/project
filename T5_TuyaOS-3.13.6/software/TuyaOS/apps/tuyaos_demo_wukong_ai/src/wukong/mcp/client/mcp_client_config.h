/**
 * @file mcp_client_config.h
 * @brief 第三方 MCP Server 配置持久化（wd_common KV）
 */

#ifndef __MCP_CLIENT_CONFIG_H__
#define __MCP_CLIENT_CONFIG_H__

#include "mcp_client_types.h"

#ifdef __cplusplus
extern "C" {
#endif

OPERATE_RET mcp_client_config_init(VOID);
OPERATE_RET mcp_client_config_load(MCP_CLIENT_SERVER_CFG_T *servers, UINT_T max_count, UINT_T *out_count);
OPERATE_RET mcp_client_config_save(CONST MCP_CLIENT_SERVER_CFG_T *servers, UINT_T count);
OPERATE_RET mcp_client_config_upsert(CONST MCP_CLIENT_SERVER_CFG_T *entry);
OPERATE_RET mcp_client_config_remove(CONST CHAR_T *id);
OPERATE_RET mcp_client_config_get(CONST CHAR_T *id, MCP_CLIENT_SERVER_CFG_T *out);
OPERATE_RET mcp_client_config_load_example_mcd(VOID);
/** 运行时上传/更新某个 MCP Server 的 Bearer 令牌（自动补 "Bearer " 前缀，持久化到 KV） */
OPERATE_RET mcp_client_config_set_token(CONST CHAR_T *id, CONST CHAR_T *token);
/** 开机确保默认第三方 MCP（麦当劳）配置存在；已写死真实令牌时同步进 KV */
OPERATE_RET mcp_client_config_ensure_defaults(VOID);
VOID mcp_client_config_free_list(MCP_CLIENT_SERVER_CFG_T *servers, UINT_T count);
ty_cJSON *mcp_client_config_to_json(CONST MCP_CLIENT_SERVER_CFG_T *servers, UINT_T count, BOOL_T redact_secrets);
OPERATE_RET mcp_client_config_from_json_entry(ty_cJSON *obj, MCP_CLIENT_SERVER_CFG_T *out);

#ifdef __cplusplus
}
#endif

#endif /* __MCP_CLIENT_CONFIG_H__ */
