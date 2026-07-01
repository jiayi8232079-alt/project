/**
 * @file mcp_client_food_scene.h
 * @brief 机器人点餐场景调用链预留
 */

#ifndef __MCP_CLIENT_FOOD_SCENE_H__
#define __MCP_CLIENT_FOOD_SCENE_H__

#include "tuya_cloud_types.h"
#include "ty_cJSON.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief 点餐推荐场景：仅调用查询类 MCP 工具（门店/菜单/优惠）
 * @note 创建订单类工具需 user_confirmed=TRUE 且由上层二次确认
 */
OPERATE_RET mcp_client_food_scene_recommend(ty_cJSON **out_recommendations, BOOL_T *out_is_error);

#ifdef __cplusplus
}
#endif

#endif /* __MCP_CLIENT_FOOD_SCENE_H__ */
