/**
 * @file tuya_dp_struct_array.h
 * @author fangweng.hu@tuya.com
 * @brief dp struct and array handle
 * @version 0.1
 * @date 2024-04-23
 *
 * @copyright Copyright (c) 2023 Tuya Inc. All Rights Reserved.
 *
 * Permission is hereby granted, to any person obtaining a copy of this software and
 * associated documentation files (the "Software"), Under the premise of complying
 * with the license of the third-party open source software contained in the software,
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software.
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 */
#ifndef __TY_DP_STRUCT_ARRAY_H__
#define __TY_DP_STRUCT_ARRAY_H__

#include "ty_cJSON.h"
#include "tuya_cloud_com_defs.h"
#include "tuya_cloud_types.h"

/**
 * @brief check if was basic dp type
 *
 * @param[in]  type dp type
 *
 * @return true/fase
 */
BOOL_T tuya_dp_is_baisc_type(CHAR_T *type);

/**
 * @brief check if basic dp type report vaild
 *
 * @param[in]  typeSpec type spec
 * @param[in]  buf report buf
 *
 * @return true/fase
 */
BOOL_T tuya_dp_check_report_value_vaild(ty_cJSON *typeSpec, CHAR_T *buf);

/**
 * @brief check if basic dp type ctrl vaild
 *
 * @param[in]  typeSpec type spec
 * @param[in]  dp_json dp json
 *
 * @return true/fase
 */
BOOL_T tuya_dp_check_ctrl_value_vaild(ty_cJSON *typeSpec, ty_cJSON *dp_json);

/**
 * @brief get basic type dp type length
 *
 * @param[in]  typeSpec schema json
 *
 * @return basic dp type length
 */
INT_T tuya_dp_get_baisc_type_len(ty_cJSON *typeSpec);

/**
 * @brief get array each length
 *
 * @param[in] schema_json schema json
 * @param[out] each_len each array len
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_dp_array_each_len(ty_cJSON *schema_json, UINT_T *each_len);

/**
 * @brief make basic dp buf
 *
 * @param[in] typeSpec schema json
 * @param[in] dp_json dp json
 * @param[out] basic_buf basic buf
 * @param[inout] offset buf offset
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_dp_basic_type_serialize(ty_cJSON *typeSpec, ty_cJSON *dp_json, CHAR_T *basic_buf, UINT_T *offset);

/**
 * @brief get struct dp total length
 *
 * @param[in]  schema_json schema json
 * @param[out] struct_len struct length
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_dp_struct_get_len(ty_cJSON *schema_json, UINT_T *struct_len);

/**
 * @brief make struct buf
 *
 * @param[in] dp_json ctrl dp json
 * @param[in] schema_json schema json
 * @param[out] struct_buf struct buf
 * @param[inout] offset buf offset
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_dp_struct_serialize(ty_cJSON *dp_json, ty_cJSON *schema_json, CHAR_T *struct_buf, UINT_T *offset);

/**
 * @brief make array buf
 *
 * @param[in] dp_json ctrl dp json
 * @param[in] schema_json schema json
 * @param[out] array_buf struct buf
 * @param[inout] offset buf offset
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_dp_array_serialize(ty_cJSON *dp_json, ty_cJSON *schema_json, CHAR_T *array_buf, UINT_T *offset);

/**
 * @brief array buf to json
 *
 * @param[in]  buf array buf
 * @param[in]  len array lem
 * @param[in]  schema_json schema json
 * @param[out] array_root out json
 * @param[out] offset buf offset
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_dp_array_deserialize(CHAR_T *buf, UINT_T len, ty_cJSON *schema_json, ty_cJSON *array_root, UINT_T *offset);

/**
 * @brief struct buf to json
 *
 * @param[in]  buf report buf
 * @param[in]  schema_json schema json
 * @param[out] struct_root out json
 * @param[out] offset buf offset
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_dp_struct_deserialize(CHAR_T *buf, ty_cJSON *schema_json, ty_cJSON *struct_root, UINT_T *offset);

/**
 * @brief parse struct schema
 *
 * @param[in]  property schema property
 * @param[out]  prop prop
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_dp_struct_schema_parse(ty_cJSON *property, DP_PROP_STRUCT_S *prop);

/**
 * @brief parse array schema
 *
 * @param[in]  property schema property
 * @param[out]  prop prop
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_dp_array_schema_parse(ty_cJSON *property, DP_PROP_ARRAY_S *prop);

/**
 * @brief dp ctrl struct serialize
 *
 * @param[in]  prop schema prop
 * @param[in]  dp_json dp json
 * @param[in]  flag is force serialize
 * @param[out]  serialize serialize buf
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_dp_struct_ctrl(DP_PROP_STRUCT_S prop, ty_cJSON *dp_json, TY_OBJ_STRUCT_S *serialize, BOOL_T flag);

/**
 * @brief dp ctrl array serialize
 *
 * @param[in]  schema_json schema json
 * @param[in]  dp_json dp json
 * @param[out]  serialize serialize buf
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_dp_array_ctrl(CHAR_T *schema_json, ty_cJSON *dp_json, TY_OBJ_ARRAY_S *serialize);

/**
 * @brief struct dp report deserialize
 *
 * @param[in]  serialize report buf
 * @param[out]  prop deserialize buf
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_dp_struct_report(TY_OBJ_STRUCT_S serialize, DP_PROP_STRUCT_S *prop);

/**
 * @brief array dp report deserialize
 *
 * @param[in]  serialize report buf
 * @param[out]  prop deserialize buf
 *
 * @return OPRT_OK on success. Others on error, please refer to tuya_error_code.h
 */
OPERATE_RET tuya_dp_array_report(TY_OBJ_ARRAY_S serialize, DP_PROP_ARRAY_S *prop);

/**
 * @brief enable dp struct
 *
 */
VOID tuya_dp_struct_enable();

/**
 * @brief enable dp array
 *
 */
VOID tuya_dp_array_enable();

/**
 * @brief enable dp struct and array
 *
 * @note called before iot init, canbe in pre_app_init
 *
 * @return void
 */
VOID tuya_dp_struct_array_enable();

typedef OPERATE_RET(*DP_STRUCT_CTRL_JSON)(ty_cJSON *dp_json);
/**
 * @brief set dp struct json ctrl
 *
 * @note called before iot init, canbe in pre_app_init
 *
 * @return void
 */
VOID tuya_dp_struct_set_ctrl_json_cb(DP_STRUCT_CTRL_JSON cb);

/**
 * @brief set dp struct network byte exchange
 *
 * @note called when in mcu sdk, soc sdk no need
 *
 * @return void
 */
VOID tuya_dp_struct_array_set_end();

/**
 * @brief get dp struct network byte exchange status
 *
 * @return TRUE/FALSE
 */
BOOL_T tuya_dp_struct_array_get_end();

#endif
