/**
 * @file tuya_axp2101.h
 * @brief AXP2101 PMIC 充电/电源管理最小驱动（I2C0，从地址 0x34）
 *
 * 适配本板 (Schematic1 / Netlist 2026-06-22)：
 *   - VBUS(USB-C U50 / CN21) -> AXP2101 U4.37
 *   - TS(U4.31) 为 10k/10k 分压(挂 VBUS)、无 NTC：默认会让充电器判温越界而挂起充电，
 *     因此本驱动按官方 T5 Pocket 做法在固件里关闭 TS 对充电的影响。
 *   - 充电与输入限流等寄存器在出厂后无固件配置，本驱动负责使能。
 *   - 0.0.19 起显式打开电池检测与 VBAT/VBUS/VSYS/Tdie ADC，仅用于诊断与安全读数。
 *
 * 注意：本驱动只做 探测/关TS/电池检测/ADC诊断/充电使能/状态打印，**不改任何 DCDC/LDO 输出轨**，
 *       以避免误关给 MCU 供电的 DCDC1 导致掉电。轨配置如需调整请单独评估。
 */
#ifndef __TUYA_AXP2101_H__
#define __TUYA_AXP2101_H__

#include "tuya_cloud_types.h"

#ifdef __cplusplus
extern "C" {
#endif

#define TUYA_AXP2101_I2C_ADDR (0x34) /* 7-bit I2C 地址 */
#define TUYA_AXP2101_CHIP_ID  (0x4A) /* 寄存器 0x03 应读到该值 */

/* 充电参数配置（单位 mV / mA）。取值会被就近量化到 datasheet 支持的档位。 */
typedef struct {
    uint16_t vindpm_mv;     /* 输入电压限 VINDPM：3880~5080，步进 80（建议 4200/4360） */
    uint16_t input_ilim_ma; /* VBUS 输入限流，仅支持 100/500/900/1000/1500/2000 */
    uint16_t iprechg_ma;    /* 预充电流：25mA 步进 */
    uint16_t icc_ma;        /* 恒流充电电流（CC），见 datasheet reg0x62 档位 */
    uint16_t iterm_ma;      /* 充电终止电流：25mA 步进 */
} tuya_axp2101_chg_cfg_t;

/**
 * @brief 读 0x03 校验芯片在位（应为 0x4A）。
 * @note  调用前 I2C 总线须已初始化（与 BMI270/BH1750 共用 I2C0）。
 */
OPERATE_RET tuya_axp2101_probe(uint8_t i2c_port, uint8_t *chip_id);

/**
 * @brief 关闭 TS 对充电的影响（reg0x50 置为“外部输入、不影响充电器”，并关 TS ADC 通道）。
 *        本板 TS 无 NTC、分压挂 VBUS，必须关掉，否则充电被挂起。
 */
OPERATE_RET tuya_axp2101_disable_ts(uint8_t i2c_port);

/**
 * @brief 配置并使能锂电充电（VINDPM/输入限流/预充/CC/终止 + 使能位）。cfg 为 NULL 时用安全默认值。
 */
OPERATE_RET tuya_axp2101_charge_init(uint8_t i2c_port, const tuya_axp2101_chg_cfg_t *cfg);

/**
 * @brief 打印 PMU 状态、IRQ、关键寄存器原始值和 VBAT/VBUS/VSYS ADC 电压，
 *        用于现场定位“无 Vsys / 不充电”。
 */
void tuya_axp2101_dump_status(uint8_t i2c_port);

/**
 * @brief 一键初始化：probe -> disable_ts -> enable_adc/bat_det -> charge_init -> dump_status。
 *        必须在 I2C0 就绪后、尽可能早调用。返回 probe 结果。
 */
OPERATE_RET tuya_axp2101_init(uint8_t i2c_port);

#ifdef __cplusplus
}
#endif

#endif /* __TUYA_AXP2101_H__ */
