/**
 * @file mcp_client_food_scene.h
 * @brief 机器人点餐场景调用链
 */

#ifndef __MCP_CLIENT_FOOD_SCENE_H__
#define __MCP_CLIENT_FOOD_SCENE_H__

#include "tuya_cloud_types.h"
#include "ty_cJSON.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief 点餐推荐：查附近门店 → 拉菜单（仅 query 类 MCP 工具）
 * @param user_query 用户原话（可为 NULL，用于提取「汉堡/麦当劳」等关键词）
 */
OPERATE_RET mcp_client_food_scene_recommend(CONST CHAR_T *user_query,
                                            ty_cJSON **out_recommendations,
                                            BOOL_T *out_is_error);

/**
 * @brief ASR 关键词命中时异步触发点餐场景（不阻塞 ASR 回调）
 * @return TRUE 表示已调度后台任务
 */
BOOL_T mcp_client_food_scene_try_asr(CONST CHAR_T *asr_text);

#ifdef __cplusplus
}
#endif

#endif /* __MCP_CLIENT_FOOD_SCENE_H__ */
