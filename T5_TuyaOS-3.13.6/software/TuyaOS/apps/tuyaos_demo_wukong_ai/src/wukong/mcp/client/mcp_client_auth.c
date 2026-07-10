/**
 * @file mcp_client_auth.c
 * @brief Optional per-server auth header generation for external MCP clients.
 */

#include "mcp_client_auth.h"

#include <stdio.h>
#include <string.h>

#include "mbedtls/md.h"
#include "mcp_client_util.h"
#include "tal_log.h"
#include "tal_memory.h"
#include "tuya_iot_com_api.h"

#define MCP_AUTH_TYPE_PEIBAN_HMAC "peiban-hmac-sha256"
#define MCP_AUTH_HMAC_HEX_LEN     64
#define MCP_AUTH_HMAC_BIN_LEN     32

STATIC UINT_T s_request_seq = 1;

STATIC CONST CHAR_T *__json_string(CONST ty_cJSON *obj, CONST CHAR_T *key)
{
    ty_cJSON *item = NULL;

    if (obj == NULL || key == NULL) {
        return NULL;
    }

    item = ty_cJSON_GetObjectItem(obj, key);
    if (item != NULL && ty_cJSON_IsString(item) && item->valuestring != NULL) {
        return item->valuestring;
    }

    return NULL;
}

STATIC VOID __upsert_header(ty_cJSON *headers, CONST CHAR_T *key, CONST CHAR_T *value)
{
    ty_cJSON *item = NULL;

    if (headers == NULL || key == NULL || value == NULL) {
        return;
    }

    item = ty_cJSON_CreateString(value);
    if (item == NULL) {
        return;
    }

    if (ty_cJSON_HasObjectItem(headers, key)) {
        if (!ty_cJSON_ReplaceItemInObject(headers, key, item)) {
            ty_cJSON_Delete(item);
        }
        return;
    }

    if (!ty_cJSON_AddItemToObject(headers, key, item)) {
        ty_cJSON_Delete(item);
    }
}

STATIC OPERATE_RET __hmac_sha256_hex(CONST CHAR_T *secret, CONST CHAR_T *message,
                                     CHAR_T *out_hex, SIZE_T out_hex_sz)
{
    const mbedtls_md_info_t *md_info = NULL;
    BYTE_T digest[MCP_AUTH_HMAC_BIN_LEN] = {0};
    INT_T i = 0;

    if (secret == NULL || message == NULL || out_hex == NULL ||
        out_hex_sz < MCP_AUTH_HMAC_HEX_LEN + 1) {
        return OPRT_INVALID_PARM;
    }

    md_info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
    if (md_info == NULL) {
        return OPRT_COM_ERROR;
    }

    if (mbedtls_md_hmac(md_info,
                        (CONST BYTE_T *)secret, strlen(secret),
                        (CONST BYTE_T *)message, strlen(message),
                        digest) != 0) {
        return OPRT_COM_ERROR;
    }

    for (i = 0; i < MCP_AUTH_HMAC_BIN_LEN; i++) {
        snprintf(out_hex + i * 2, out_hex_sz - (SIZE_T)(i * 2), "%02x", digest[i]);
    }
    out_hex[MCP_AUTH_HMAC_HEX_LEN] = '\0';
    return OPRT_OK;
}

STATIC OPERATE_RET __apply_peiban_hmac(CONST MCP_CLIENT_SERVER_CFG_T *server,
                                       CONST CHAR_T *json_body,
                                       ty_cJSON *headers)
{
    CONST CHAR_T *secret = NULL;
    CONST CHAR_T *device_id = NULL;
    CONST CHAR_T *session_id = NULL;
    CHAR_T request_id[64] = {0};
    CHAR_T *string_to_sign = NULL;
    CHAR_T signature[MCP_AUTH_HMAC_HEX_LEN + 1] = {0};
    CHAR_T auth_header[MCP_AUTH_HMAC_HEX_LEN + 16] = {0};
    SIZE_T sign_len = 0;
    OPERATE_RET rt = OPRT_OK;

    if (server == NULL || json_body == NULL || headers == NULL || server->auth == NULL) {
        return OPRT_INVALID_PARM;
    }

    secret = __json_string(server->auth, "secret");
    device_id = __json_string(server->auth, "deviceId");
    session_id = __json_string(server->auth, "sessionId");
    if (device_id == NULL || device_id[0] == '\0') {
        device_id = tuya_iot_get_gw_id();
    }

    if (secret == NULL || secret[0] == '\0' || device_id == NULL || device_id[0] == '\0') {
        TAL_PR_WARN("MCP peiban auth missing secret/deviceId mcp=%s", server->id);
        return OPRT_INVALID_PARM;
    }

    snprintf(request_id, sizeof(request_id), "%s-%u-%u",
             device_id, mcp_client_now_unix(), s_request_seq++);
    sign_len = strlen(device_id) + strlen(request_id) + strlen(json_body) + 3;
    string_to_sign = (CHAR_T *)tal_malloc(sign_len);
    if (string_to_sign == NULL) {
        return OPRT_MALLOC_FAILED;
    }
    snprintf(string_to_sign, sign_len, "%s\n%s\n%s", device_id, request_id, json_body);

    rt = __hmac_sha256_hex(secret, string_to_sign, signature, sizeof(signature));
    tal_free(string_to_sign);
    if (rt != OPRT_OK) {
        return rt;
    }

    snprintf(auth_header, sizeof(auth_header), "Bearer %s", signature);
    __upsert_header(headers, "Authorization", auth_header);
    __upsert_header(headers, "X-Device-Id", device_id);
    __upsert_header(headers, "X-Request-Id", request_id);
    if (session_id != NULL && session_id[0] != '\0') {
        __upsert_header(headers, "X-Session-Id", session_id);
    }

    return OPRT_OK;
}

OPERATE_RET mcp_client_auth_apply_headers(CONST MCP_CLIENT_SERVER_CFG_T *server,
                                           CONST CHAR_T *json_body,
                                           ty_cJSON *headers)
{
    CONST CHAR_T *type = NULL;

    if (server == NULL || server->auth == NULL || headers == NULL) {
        return OPRT_OK;
    }

    type = __json_string(server->auth, "type");
    if (type == NULL || type[0] == '\0') {
        return OPRT_OK;
    }

    if (strcmp(type, MCP_AUTH_TYPE_PEIBAN_HMAC) == 0) {
        return __apply_peiban_hmac(server, json_body, headers);
    }

    TAL_PR_WARN("MCP auth type unsupported mcp=%s type=%s", server->id, type);
    return OPRT_NOT_SUPPORTED;
}
