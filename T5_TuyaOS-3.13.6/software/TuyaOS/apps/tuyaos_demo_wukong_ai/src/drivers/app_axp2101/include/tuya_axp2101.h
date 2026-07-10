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
 * v3（对齐 T5 口袋机）：init 含 `power_on` 全轨显式配置（DCDC1/5 + ALDO1/3/4 + BLDO1/2）、
 *       VOFF=3300mV、电源键 128ms/4s；并提供串口 `axp` 调试命令。
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
 * @brief 一键初始化（对齐口袋机 board_axp2101_init 主流程）：
 *        probe -> disable_ts -> ADC/电池检测 -> VOFF 3.3V -> charge_init
 *        -> power_on(DCDC/LDO) -> 电源键时序 -> dump_status。
 */
OPERATE_RET tuya_axp2101_init(uint8_t i2c_port);

/**
 * @brief 对齐口袋机 __board_axp2101_power_on()：先关 DCDC2/3/4/5 与全部 LDO，
 *        再设压并使能 DCDC1/5、RTC(ALDO1)、ALDO3/4、BLDO1/2（含摄像头与 SD 轨）。
 */
OPERATE_RET tuya_axp2101_power_on(uint8_t i2c_port);

/**
 * @brief 配置电源键：短按开机 128ms、长按关机 4s（reg0x27）。
 */
OPERATE_RET tuya_axp2101_power_key_config(uint8_t i2c_port);

/**
 * @brief 读/写单字节寄存器（供串口调试与二次开发）。
 */
OPERATE_RET tuya_axp2101_reg_read(uint8_t i2c_port, uint8_t reg, uint8_t *val);
OPERATE_RET tuya_axp2101_reg_write(uint8_t i2c_port, uint8_t reg, uint8_t val);

/**
 * @brief 打开 DVP 摄像头(GC2145)三路电源轨（与 power_on 中 ALDO3/BLDO1/2 一致，可重复调用）。
 */
OPERATE_RET tuya_axp2101_camera_power_on(uint8_t i2c_port);

/**
 * @brief 注册 AP 侧串口命令 `axp`（dump/r/w/init/power/status）。须在 CLI 子系统就绪后调用。
 */
void tuya_axp2101_cli_init(void);

/**
 * @brief CP 侧 `axp` 转发桩（shell 在 CP、驱动在 AP）。由 cp_cli_tuya_test_init 调用，应用勿直接调。
 */
void tuya_axp2101_cli_cp_init(void);

#ifdef __cplusplus
}
#endif

#endif /* __TUYA_AXP2101_H__ */
