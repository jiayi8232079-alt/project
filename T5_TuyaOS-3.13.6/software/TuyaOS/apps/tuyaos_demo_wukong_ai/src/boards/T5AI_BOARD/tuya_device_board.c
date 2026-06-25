/**
 * @file tuya_device_board.c
 * @author www.tuya.com
 * @brief tuya_device_board module is used to
 * @version 0.1
 * @date 2022-10-28
 *
 * @copyright Copyright (c) tuya.inc 2022
 *
 */
#include "tuya_device_board.h"
#include "tuya_cloud_types.h"
#include "tuya_app_config.h"
#include "tkl_pinmux.h"
#include "tkl_i2c.h"
#include "tal_log.h"
#include "tuya_axp2101.h"

#if defined(PRODUCT_BOARD_MOTOR_DEBUG) && (PRODUCT_BOARD_MOTOR_DEBUG == 1)
#include "product_board_motor_debug.h"
#endif

#if defined(ENABLE_TUYA_CAMERA) && ENABLE_TUYA_CAMERA == 1
#include "tal_camera.h"
#endif

/***********************************************************
************************macro define************************
***********************************************************/

/**
 * @brief evb board initialization
 *
 * @param[in] none
 *
 * @return OPRT_OK on success. Others on error, please refer to "tuya_error_code.h".
 */
OPERATE_RET tuya_device_board_init(VOID_T)
{
    OPERATE_RET rt = OPRT_OK;

#if defined(PRODUCT_BOARD_SPI_LCD) && (PRODUCT_BOARD_SPI_LCD == 1)
    /*
     * SPI0 G2 四线必须全部登记，否则 __tkl_check_spi0_pins() 失败，
     * tkl_spi 会回退到 GPIO14~17，P44~P47 上无 SPI 波形。
     * P47 先配 MISO 通过校验；tal_display_spi_open 再将其改回 GPIO 作 D/C。
     */
    tkl_io_pinmux_config(TUYA_IO_PIN_44, TUYA_SPI0_CLK);
    tkl_io_pinmux_config(TUYA_IO_PIN_45, TUYA_SPI0_CS);
    tkl_io_pinmux_config(TUYA_IO_PIN_46, TUYA_SPI0_MOSI);
    tkl_io_pinmux_config(TUYA_IO_PIN_47, TUYA_SPI0_MISO);
    TAL_PR_NOTICE("product SPI LCD: SPI0 G2 pinmux 44/45/46/47");
#endif

    /* AXP2101 PMIC bring-up（I2C0 / P20=SCL、P21=SDA、从地址 0x34）。
     * 注意：本产品板 I2C0(GPIO20/21) 为【共享总线】——屏幕/摄像头/传感器与 AXP2101 共用。
     *   - AXP2101 给屏幕/摄像头/传感器供电，故必须【最早】上电并完成自身配置（此处在 board_init）。
     *   - 速率取 100K，与本工程摄像头(tal_dvp)/触摸(tal_tp)/IMU 在 I2C0 上的一致，避免共享总线速率冲突。
     *   - AXP 仅在本处一次性访问总线，后续不占用；其他外设上电后可各自 re-init/复用同一总线。
     *   - 仅做 探测/关TS/充电使能/状态打印，不改任何 DCDC/LDO 输出轨，避免影响现有供电。 */
    tkl_io_pinmux_config(TUYA_IO_PIN_20, TUYA_IIC0_SCL);
    tkl_io_pinmux_config(TUYA_IO_PIN_21, TUYA_IIC0_SDA);
    TUYA_IIC_BASE_CFG_T axp_i2c_cfg = {
        .role       = TUYA_IIC_MODE_MASTER,
        .speed      = TUYA_IIC_BUS_SPEED_100K,
        .addr_width = TUYA_IIC_ADDRESS_7BIT,
    };
    if (OPRT_OK == tkl_i2c_init(TUYA_I2C_NUM_0, &axp_i2c_cfg)) {
        tuya_axp2101_init(TUYA_I2C_NUM_0);
    } else {
        TAL_PR_ERR("AXP2101: I2C0 init failed");
    }

#if defined(PRODUCT_BOARD_MOTOR_DEBUG) && (PRODUCT_BOARD_MOTOR_DEBUG == 1)
    product_board_motor_debug_start();
#endif

    return rt;
}

#if defined(ENABLE_TUYA_CAMERA) && ENABLE_TUYA_CAMERA == 1
/**
 * @brief DVP (GC2145) camera configuration for T5AI_BOARD.
 *        dvp_frame_handle is intentionally NULL; tal_camera_init() fills it.
 */
OPERATE_RET tuya_board_get_camera_cfg(TAL_CAMERA_CFG_T *cfg)
{
    if (!cfg) {
        return OPRT_INVALID_PARM;
    }

    static TUYA_DVP_USR_CFG_T s_dvp_cfg = {
        .dvp_cfg = {
            .fps          = 20,
            .width        = TUYA_AI_TOY_ISP_WIDTH,
            .height       = TUYA_AI_TOY_ISP_HEIGHT,
            .output_mode  = TUYA_CAMERA_OUTPUT_JPEG_YUV422_BOTH,
            .sync_polarity = 0,
            .encoded_quality = {
                .jpeg_cfg = {
                    .enable   = TRUE,
                    .min_size = 10,
                    .max_size = 25,
                },
            },
        },
        .pin_cfg = {
            .dvp_i2c_idx               = TUYA_I2C_NUM_1,
            .dvp_i2c_clk.pin           = TUYA_GPIO_NUM_13,
            .dvp_i2c_sda.pin           = TUYA_GPIO_NUM_15,
            .dvp_rst_ctrl.pin          = TUYA_GPIO_NUM_51,
            .dvp_rst_ctrl.active_level = TUYA_GPIO_LEVEL_LOW,
            .dvp_pwr_ctrl.pin          = TUYA_GPIO_NUM_MAX,
        },

        .dvp_frame_handle = NULL,   /* overwritten by tal_camera_init() */
    };

    cfg->type = TAL_CAMERA_TYPE_DVP;
    cfg->cfg  = &s_dvp_cfg;
    return OPRT_OK;
}
#endif
