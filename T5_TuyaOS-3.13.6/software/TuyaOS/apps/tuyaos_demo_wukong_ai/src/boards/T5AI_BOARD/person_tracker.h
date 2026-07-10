#ifndef PERSON_TRACKER_H
#define PERSON_TRACKER_H

#include "tuya_cloud_types.h"
#include "tal_camera.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    BOOL_T   valid;
    UINT16_T center_x;
    UINT16_T center_y;
    UINT16_T frame_w;
    UINT16_T frame_h;
    UINT8_T  confidence;
} person_tracker_target_t;

OPERATE_RET person_tracker_start(VOID);
void person_tracker_stop(VOID);
void person_tracker_update_target(const person_tracker_target_t *target);
void person_tracker_on_yuv_frame(TAL_CAMERA_FRAME_T *frame);

#ifdef __cplusplus
}
#endif

#endif /* PERSON_TRACKER_H */
