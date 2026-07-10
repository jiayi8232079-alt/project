/**
 * @file tuya_axp2101.c
 * @brief AXP2101 PMIC 最小驱动实现（探测/关TS/充电使能/状态打印）。
 *
 * 寄存器编码全部依据 X-Powers AXP2101 Datasheet V1.4：
 *   reg0x03 chip id=0x4A; reg0x15 VINDPM(3.88+N*0.08V); reg0x16 输入限流[2:0];
 *   reg0x18 bit1 锂电充电使能; reg0x30 ADC 通道使能(bit1=TS); reg0x50 TS pin 控制;
 *   reg0x61 预充; reg0x62 CC; reg0x63 终止; reg0x00/0x01 PMU 状态; reg0x48~0x4A IRQ。
 * I2C 读写沿用本工程既有写法（参考 tuya_imu_i2c.c）：先 send 寄存器地址再 receive。
 */
#include "tuya_axp2101.h"

#include "tkl_i2c.h"
#include "tal_log.h"
#include "tal_system.h"

/* ---------------- AXP2101 寄存器地址 ---------------- */
#define AXP_REG_PMU_STATUS1 (0x00)
#define AXP_REG_PMU_STATUS2 (0x01)
#define AXP_REG_CHIP_ID     (0x03)
#define AXP_REG_VOFF_THLD   (0x24) /* [2:0]: VSYS 欠压关断阈值 2.6V~3.3V */
#define AXP_REG_VINDPM      (0x15)
#define AXP_REG_IIN_LIM     (0x16)
#define AXP_REG_CHG_CTRL    (0x18) /* bit1: 锂电充电使能 */
#define AXP_REG_ADC_EN      (0x30) /* bit1: TS ADC 通道 */
#define AXP_REG_ADC_VBAT_H  (0x34)
#define AXP_REG_ADC_VBUS_H  (0x38)
#define AXP_REG_ADC_VSYS_H  (0x3A)
#define AXP_REG_ADC_TDIE_H  (0x3C)
#define AXP_REG_IRQ_STS0    (0x48)
#define AXP_REG_TS_CTRL     (0x50)
#define AXP_REG_IPRECHG     (0x61)
#define AXP_REG_ICC         (0x62)
#define AXP_REG_ITERM       (0x63)
#define AXP_REG_CV          (0x64) /* [2:0]: 011=4.2V */
#define AXP_REG_BAT_DET     (0x68) /* bit0: 电池检测使能 */
#define AXP_REG_CHGLED      (0x69) /* bit0=使能, [2:1]=显示模式 */
#define AXP_REG_PWR_KEY     (0x27) /* [1:0] 开机时长 [3:2] 关机时长 */
#define AXP_REG_DCDC_EN     (0x80) /* bit0~4 = DCDC1~5 使能 */
#define AXP_REG_DCDC1_CFG   (0x82) /* 1.5V + N*0.1V */
#define AXP_REG_DCDC5_CFG   (0x86) /* 1.4V + N*0.1V（低 5 位） */
#define AXP_REG_ALDO1_CFG   (0x92) /* RTC 1.8V */
#define AXP_REG_ALDO4_CFG   (0x95) /* SD 3.3V */

#define AXP_REG_LDO_EN0     (0x90) /* bit0~3=ALDO1~4 bit4=BLDO1 bit5=BLDO2 ... */
#define AXP_REG_ALDO3_CFG   (0x94) /* [4:0]: 0.5V + N*0.1V */
#define AXP_REG_BLDO1_CFG   (0x96) /* U4.12 -> AVDD_2V8  */
#define AXP_REG_BLDO2_CFG   (0x97) /* U4.14 -> DVDD_1V8  */

/* reg0x80 DCDC 使能位 */
#define AXP_DCDC_EN_DCDC1   (1u << 0)
#define AXP_DCDC_EN_DCDC2   (1u << 1)
#define AXP_DCDC_EN_DCDC3   (1u << 2)
#define AXP_DCDC_EN_DCDC4   (1u << 3)
#define AXP_DCDC_EN_DCDC5   (1u << 4)
#define AXP_DCDC_EN_POCKET  (AXP_DCDC_EN_DCDC1 | AXP_DCDC_EN_DCDC5)
#define AXP_DCDC_DIS_EXTRA  (AXP_DCDC_EN_DCDC2 | AXP_DCDC_EN_DCDC3 | AXP_DCDC_EN_DCDC4 | AXP_DCDC_EN_DCDC5)

/* reg0x90 LDO 使能位（口袋机 power_on 目标） */
#define AXP_LDO_EN_ALDO1    (1u << 0) /* RTC 1.8V */
#define AXP_LDO_EN_ALDO3    (1u << 2) /* U4.16 -> VDDCAM_2V8 */
#define AXP_LDO_EN_ALDO4    (1u << 3) /* SD 3.3V */
#define AXP_LDO_EN_BLDO1    (1u << 4) /* U4.12 -> AVDD_2V8  */
#define AXP_LDO_EN_BLDO2    (1u << 5) /* U4.14 -> DVDD_1V8  */
#define AXP_LDO_EN_ALL06    (0x3Fu)   /* ALDO1~4 + BLDO1/2 */
#define AXP_LDO_EN_POCKET   (AXP_LDO_EN_ALDO1 | AXP_LDO_EN_ALDO3 | AXP_LDO_EN_ALDO4 | \
                             AXP_LDO_EN_BLDO1 | AXP_LDO_EN_BLDO2)
#define AXP_LDO_EN_CAM_MASK (AXP_LDO_EN_ALDO3 | AXP_LDO_EN_BLDO1 | AXP_LDO_EN_BLDO2)

/* 摄像头电源轨目标电压（网表 + AXP2101 引脚：12=BLDO1 14=BLDO2 16=ALDO3） */
#define AXP_CAM_AVDD_MV     (2800) /* BLDO1 -> AVDD_2V8  */
#define AXP_CAM_DVDD_MV     (1800) /* BLDO2 -> DVDD_1V8  */
#define AXP_CAM_VDDCAM_MV   (2800) /* ALDO3 -> VDDCAM_2V8 */

/* 口袋机 setSysPowerDownVoltage(3300) */
#define AXP_SYS_POWERDOWN_MV (3300)

/* 口袋机 power_on 目标电压（mV） */
#define AXP_POCKET_DCDC1_MV  (3300)
#define AXP_POCKET_DCDC5_MV  (3300)
#define AXP_POCKET_RTC_MV    (1800) /* ALDO1 */
#define AXP_POCKET_ALDO4_MV  (3300) /* SD */

/* 共享总线探测重试：GPIO20/21(I2C0) 与屏幕/摄像头/传感器共用，上电初期可能短暂忙 */
#define AXP_PROBE_RETRY     (3)
#define AXP_PROBE_DELAY_MS  (5)

/* ---------------- 底层 I2C 读写 ---------------- */
static OPERATE_RET __axp_read(uint8_t port, uint8_t reg, uint8_t *val)
{
    OPERATE_RET rt = tkl_i2c_master_send(port, TUYA_AXP2101_I2C_ADDR, &reg, 1, TRUE);
    if (rt != OPRT_OK) {
        return rt;
    }
    return tkl_i2c_master_receive(port, TUYA_AXP2101_I2C_ADDR, val, 1, FALSE);
}

static OPERATE_RET __axp_write(uint8_t port, uint8_t reg, uint8_t val)
{
    uint8_t buf[2] = {reg, val};
    OPERATE_RET rt = tkl_i2c_master_send(port, TUYA_AXP2101_I2C_ADDR, buf, 2, FALSE);
    if (rt != OPRT_OK) {
        /* I2C 层就失败：器件可能未应答（地址/总线竞争/掉电），写入根本没到芯片 */
        TAL_PR_ERR("[axp2101] reg0x%02x write 0x%02x i2c failed: %d", reg, val, rt);
    }
    return rt;
}

/* 读-改-写：仅改 mask 覆盖的位，并在写后【回读校验】目标位是否真正落盘到芯片。
 * 设计意图：定位“代码配了寄存器但没写进器件”的情况（I2C NACK / 写保护 / 总线竞争 /
 *           OTP 锁定）。校验只比对 mask 覆盖的位，避免保留位/状态位变化造成误报。
 * 失败处理：记 ERR 但【不中断】后续寄存器配置，以便一次性打印出完整寄存器现场，
 *           判断到底是哪些位没落盘。 */
static OPERATE_RET __axp_update(uint8_t port, uint8_t reg, uint8_t mask, uint8_t value)
{
    uint8_t old = 0;
    OPERATE_RET rt = __axp_read(port, reg, &old);
    if (rt != OPRT_OK) {
        TAL_PR_ERR("[axp2101] reg0x%02x read-for-update failed: %d", reg, rt);
        return rt;
    }
    uint8_t neo = (uint8_t)((old & (uint8_t)~mask) | (value & mask));
    if (neo != old) {
        rt = __axp_write(port, reg, neo);
        if (rt != OPRT_OK) {
            return rt; /* __axp_write 内已记 ERR */
        }
    }
    /* 无论是否实际写入，都回读确认目标位现处于期望值（写跳过时等于二次确认 old 可信） */
    uint8_t rb = 0;
    rt = __axp_read(port, reg, &rb);
    if (rt != OPRT_OK) {
        TAL_PR_ERR("[axp2101] reg0x%02x readback failed: %d", reg, rt);
        return rt;
    }
    if ((uint8_t)(rb & mask) != (uint8_t)(value & mask)) {
        TAL_PR_ERR("[axp2101] reg0x%02x VERIFY FAIL: want&mask=0x%02x got&mask=0x%02x (full=0x%02x mask=0x%02x)",
                   reg, (uint8_t)(value & mask), (uint8_t)(rb & mask), rb, mask);
    }
    return OPRT_OK;
}

/* ---------------- 编码换算（就近量化到 datasheet 档位） ---------------- */
/* VINDPM: 3.88V + N*0.08V，N=[0..15] */
static uint8_t __enc_vindpm(uint16_t mv)
{
    if (mv < 3880) {
        mv = 3880;
    }
    uint16_t n = (uint16_t)((mv - 3880) / 80);
    if (n > 0x0F) {
        n = 0x0F;
    }
    return (uint8_t)n;
}

/* 输入限流 reg0x16[2:0]: 000=100 001=500 010=900 011=1000 100=1500 101=2000 */
static uint8_t __enc_iinlim(uint16_t ma)
{
    if (ma >= 2000) return 0x05;
    if (ma >= 1500) return 0x04;
    if (ma >= 1000) return 0x03;
    if (ma >= 900)  return 0x02;
    if (ma >= 500)  return 0x01;
    return 0x00; /* 100mA */
}

/* CC 充电电流 reg0x62[4:0]: N<=8 -> 25*N mA; N>8 -> 200+100*(N-8) mA */
static uint8_t __enc_icc(uint16_t ma)
{
    uint8_t n;
    if (ma <= 200) {
        n = (uint8_t)(ma / 25); /* 0..8 */
    } else {
        if (ma > 1000) {
            ma = 1000;
        }
        n = (uint8_t)(8 + (ma - 200) / 100); /* 9..16 */
    }
    if (n > 0x1F) {
        n = 0x1F;
    }
    return n;
}

/* 预充/终止电流：25mA 步进，4bit */
static uint8_t __enc_i25step(uint16_t ma)
{
    uint16_t n = (uint16_t)(ma / 25);
    if (n > 0x0F) {
        n = 0x0F;
    }
    return (uint8_t)n;
}

/* VSYS 欠压关断阈值：reg0x24[2:0] = 2.6V + N*0.1V */
static uint8_t __enc_voff(uint16_t mv)
{
    uint16_t n;

    if (mv < 2600) {
        mv = 2600;
    }
    if (mv > 3300) {
        mv = 3300;
    }
    n = (uint16_t)((mv - 2600) / 100);
    if (n > 0x07) {
        n = 0x07;
    }
    return (uint8_t)n;
}

/* DCDC1: reg0x82[4:0] = (mV - 1500) / 100 */
static uint8_t __enc_dcdc1_mv(uint16_t mv)
{
    uint16_t n;

    if (mv < 1500) {
        mv = 1500;
    }
    n = (uint16_t)((mv - 1500) / 100);
    if (n > 0x1F) {
        n = 0x1F;
    }
    return (uint8_t)n;
}

/* DCDC5: reg0x86[4:0] = (mV - 1400) / 100 */
static uint8_t __enc_dcdc5_mv(uint16_t mv)
{
    uint16_t n;

    if (mv < 1400) {
        mv = 1400;
    }
    n = (uint16_t)((mv - 1400) / 100);
    if (n > 0x1F) {
        n = 0x1F;
    }
    return (uint8_t)n;
}

/* AXP2101 ADC 数据为 14bit：必须先读高 6bit，再读低 8bit。VBAT/VBUS/VSYS 单位为 1mV。 */
static OPERATE_RET __axp_read_adc14(uint8_t port, uint8_t high_reg, uint16_t *raw)
{
    uint8_t high = 0;
    uint8_t low = 0;
    OPERATE_RET rt;

    if (!raw) {
        return OPRT_INVALID_PARM;
    }

    rt = __axp_read(port, high_reg, &high);
    if (rt != OPRT_OK) {
        return rt;
    }
    rt = __axp_read(port, (uint8_t)(high_reg + 1), &low);
    if (rt != OPRT_OK) {
        return rt;
    }

    *raw = (uint16_t)((((uint16_t)high & 0x3F) << 8) | low);
    return OPRT_OK;
}

/* ---------------- 对外接口 ---------------- */
OPERATE_RET tuya_axp2101_probe(uint8_t i2c_port, uint8_t *chip_id)
{
    uint8_t id = 0;
    OPERATE_RET rt = OPRT_COM_ERROR;
    int i;

    /* 共享 I2C0 总线上电初期可能短暂忙，读 chip id 失败/不符时重试 */
    for (i = 0; i < AXP_PROBE_RETRY; i++) {
        rt = __axp_read(i2c_port, AXP_REG_CHIP_ID, &id);
        if (rt == OPRT_OK && id == TUYA_AXP2101_CHIP_ID) {
            break;
        }
        tal_system_sleep(AXP_PROBE_DELAY_MS);
    }
    if (chip_id) {
        *chip_id = id;
    }
    if (rt != OPRT_OK) {
        TAL_PR_ERR("[axp2101] probe i2c failed: %d", rt);
        return rt;
    }
    if (id != TUYA_AXP2101_CHIP_ID) {
        TAL_PR_ERR("[axp2101] unexpected chip id: 0x%02x (expect 0x4A)", id);
        return OPRT_COM_ERROR;
    }
    TAL_PR_INFO("[axp2101] detected, chip id=0x%02x", id);
    return OPRT_OK;
}

OPERATE_RET tuya_axp2101_disable_ts(uint8_t i2c_port)
{
    /* reg0x50: bit4=1 -> TS 为外部输入、不影响充电器；bit[3:2]=00 -> TS 电流源关闭 */
    OPERATE_RET rt = __axp_update(i2c_port, AXP_REG_TS_CTRL, 0x1C, 0x10);
    if (rt != OPRT_OK) {
        return rt;
    }
    /* reg0x30 bit1=0 -> 关闭 TS ADC 测量通道 */
    rt = __axp_update(i2c_port, AXP_REG_ADC_EN, 0x02, 0x00);
    if (rt == OPRT_OK) {
        TAL_PR_INFO("[axp2101] TS measure disabled (won't block charging)");
    }
    return rt;
}

static OPERATE_RET __axp_enable_adc_and_bat_detection(uint8_t i2c_port)
{
    OPERATE_RET rt;

    /* 对齐 T5 Pocket：显式打开电池检测，避免依赖 EFUSE/默认态。 */
    rt = __axp_update(i2c_port, AXP_REG_BAT_DET, 0x01, 0x01);
    if (rt != OPRT_OK) {
        return rt;
    }

    /* 打开 VBAT/VBUS/VSYS/Tdie ADC；不触碰 TS ADC bit1，保持 TS 不参与充电判断。 */
    rt = __axp_update(i2c_port, AXP_REG_ADC_EN, 0x1D, 0x1D);
    if (rt == OPRT_OK) {
        TAL_PR_INFO("[axp2101] ADC enabled: VBAT/VBUS/VSYS/Tdie, battery detection enabled");
    }
    return rt;
}

static OPERATE_RET __axp_set_sys_powerdown_voltage(uint8_t i2c_port, uint16_t mv)
{
    OPERATE_RET rt = __axp_update(i2c_port, AXP_REG_VOFF_THLD, 0x07, __enc_voff(mv));
    if (rt == OPRT_OK) {
        TAL_PR_INFO("[axp2101] system power-down voltage set to %umV", mv);
    }
    return rt;
}

OPERATE_RET tuya_axp2101_charge_init(uint8_t i2c_port, const tuya_axp2101_chg_cfg_t *cfg)
{
    tuya_axp2101_chg_cfg_t def = {
        .vindpm_mv     = 4200, /* 对齐 T5 Pocket：支持 4.6V 输入源时保留更多充电余量 */
        .input_ilim_ma = 500,  /* 与官方 T5 Pocket 一致 */
        .iprechg_ma    = 200,  /* 对齐 T5 Pocket，低电压电池预充更快 */
        .icc_ma        = 1000, /* AXP2101 线性充电最大 1A；实际仍受输入限流和系统负载约束 */
        .iterm_ma      = 25,
    };
    const tuya_axp2101_chg_cfg_t *c = cfg ? cfg : &def;
    OPERATE_RET rt;

    rt = __axp_update(i2c_port, AXP_REG_VINDPM, 0x0F, __enc_vindpm(c->vindpm_mv));
    if (rt != OPRT_OK) return rt;

    rt = __axp_update(i2c_port, AXP_REG_IIN_LIM, 0x07, __enc_iinlim(c->input_ilim_ma));
    if (rt != OPRT_OK) return rt;

    rt = __axp_update(i2c_port, AXP_REG_IPRECHG, 0x0F, __enc_i25step(c->iprechg_ma));
    if (rt != OPRT_OK) return rt;

    rt = __axp_update(i2c_port, AXP_REG_ICC, 0x1F, __enc_icc(c->icc_ma));
    if (rt != OPRT_OK) return rt;

    /* reg0x63: bit4=终止使能, [3:0]=25mA 步进 */
    rt = __axp_update(i2c_port, AXP_REG_ITERM, 0x1F, (uint8_t)(0x10 | __enc_i25step(c->iterm_ma)));
    if (rt != OPRT_OK) return rt;

    /* reg0x64[2:0]=011 -> CV 目标 4.2V（亦为芯片默认，显式写入抵御非默认 OTP） */
    rt = __axp_update(i2c_port, AXP_REG_CV, 0x07, 0x03);
    if (rt != OPRT_OK) return rt;

    /* reg0x69: bit0=1 使能 CHGLED，[2:1]=00 Type A（按充电状态指示） */
    rt = __axp_update(i2c_port, AXP_REG_CHGLED, 0x07, 0x01);
    if (rt != OPRT_OK) return rt;

    /* reg0x18 bit1: 使能锂电充电（读-改-写，保留 fuel gauge/watchdog 位） */
    rt = __axp_update(i2c_port, AXP_REG_CHG_CTRL, 0x02, 0x02);
    if (rt != OPRT_OK) return rt;

    TAL_PR_INFO("[axp2101] charge init: VINDPM=%umV ILIM=%umA ICC=%umA CV=4.2V enabled",
                c->vindpm_mv, c->input_ilim_ma, c->icc_ma);
    return OPRT_OK;
}

/* 一次性回读关键寄存器原始值，供与 datasheet 逐位比对，定位“无 VSYS / 不供电”现场。
 * 覆盖：状态(0x00/0x01)、公共配置(0x10)、BATFET 控制(0x12)、最小系统电压 Vsysmin(0x14)、
 *       充电输入(0x15 VINDPM / 0x16 输入限流 / 0x18 充电使能)、ADC/TS(0x30/0x50)、
 *       充电参数(0x61~0x64/0x69)、DCDC 开关与各路电压(0x80~0x86)、LDO 开关(0x90/0x91)。
 * 注意：此处【纯读】，不写任何 DCDC/LDO 开关，故不会影响现有供电。 */
static void __axp_dump_regs(uint8_t port)
{
    static const uint8_t regs[] = {
        0x00, 0x01, 0x10, 0x12, 0x14, 0x15, 0x16, 0x18, 0x24, 0x27, 0x30,
        0x34, 0x35, 0x38, 0x39, 0x3A, 0x3B, 0x3C, 0x3D, 0x50, 0x61,
        0x62, 0x63, 0x64, 0x68, 0x69, 0x80, 0x81, 0x82, 0x83, 0x84,
        0x85, 0x86, 0x90, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97,
    };
    int i;

    TAL_PR_INFO("[axp2101] --- register dump (compare with datasheet) ---");
    for (i = 0; i < (int)sizeof(regs); i++) {
        uint8_t v = 0;
        if (__axp_read(port, regs[i], &v) == OPRT_OK) {
            TAL_PR_INFO("[axp2101] reg0x%02x = 0x%02x", regs[i], v);
        } else {
            TAL_PR_ERR("[axp2101] reg0x%02x read failed", regs[i]);
        }
    }
}

static void __axp_dump_adc(uint8_t port)
{
    uint16_t vbat = 0, vbus = 0, vsys = 0, tdie = 0;
    OPERATE_RET rt_vbat = __axp_read_adc14(port, AXP_REG_ADC_VBAT_H, &vbat);
    OPERATE_RET rt_vbus = __axp_read_adc14(port, AXP_REG_ADC_VBUS_H, &vbus);
    OPERATE_RET rt_vsys = __axp_read_adc14(port, AXP_REG_ADC_VSYS_H, &vsys);
    OPERATE_RET rt_tdie = __axp_read_adc14(port, AXP_REG_ADC_TDIE_H, &tdie);

    if (rt_vbat == OPRT_OK && rt_vbus == OPRT_OK && rt_vsys == OPRT_OK) {
        TAL_PR_INFO("[axp2101] ADC voltage: VBAT=%umV(raw=%u) VBUS=%umV(raw=%u) VSYS=%umV(raw=%u)",
                    vbat, vbat, vbus, vbus, vsys, vsys);
    } else {
        TAL_PR_ERR("[axp2101] ADC voltage read failed: vbat=%d vbus=%d vsys=%d",
                   rt_vbat, rt_vbus, rt_vsys);
    }
    if (rt_tdie == OPRT_OK) {
        TAL_PR_INFO("[axp2101] ADC tdie raw=%u (datasheet unit: 0.1mV/LSB)", tdie);
    }
}

void tuya_axp2101_dump_status(uint8_t i2c_port)
{
    uint8_t s0 = 0, s1 = 0, irq0 = 0, irq1 = 0, irq2 = 0;

    /* 先打印关键寄存器原始值（含 DCDC/LDO/VSYS 相关），便于现场与 datasheet 比对 */
    __axp_dump_regs(i2c_port);
    __axp_dump_adc(i2c_port);

    if (__axp_read(i2c_port, AXP_REG_PMU_STATUS1, &s0) != OPRT_OK) {
        TAL_PR_ERR("[axp2101] dump: read status1 failed");
        return;
    }
    __axp_read(i2c_port, AXP_REG_PMU_STATUS2, &s1);
    __axp_read(i2c_port, AXP_REG_IRQ_STS0 + 0, &irq0);
    __axp_read(i2c_port, AXP_REG_IRQ_STS0 + 1, &irq1);
    __axp_read(i2c_port, AXP_REG_IRQ_STS0 + 2, &irq2);

    /* reg0x00(comm_stat0): bit5 VBUS good, bit4 BATFET, bit3 电池在位, bit1 热调节, bit0 输入限流 */
    TAL_PR_INFO("[axp2101] STATUS0=0x%02x vbus_good=%d batfet=%d bat_present=%d bat_active=%d thermal=%d ilim=%d",
                s0, (s0 >> 5) & 1, (s0 >> 4) & 1, (s0 >> 3) & 1, (s0 >> 2) & 1, (s0 >> 1) & 1, s0 & 1);
    /* reg0x01(comm_stat1): bit[6:5] 00待机/01充电/10放电, bit4 系统开机, bit3 VINDPM, bit[2:0] 充电阶段 */
    TAL_PR_INFO("[axp2101] STATUS1=0x%02x bat_dir=%d sys_on=%d vindpm=%d chg_stage=%d",
                s1, (s1 >> 5) & 3, (s1 >> 4) & 1, (s1 >> 3) & 1, s1 & 0x07);
    TAL_PR_INFO("[axp2101] IRQ[0..2]=0x%02x 0x%02x 0x%02x (对照 datasheet 0x48~0x4A 找 TS/charger fault)",
                irq0, irq1, irq2);
}

/* ALDO/BLDO 电压编码 reg0x94/0x96/0x97[4:0]: 0.5V + N*0.1V，N=[0..31] */
static uint8_t __enc_ldo_mv(uint16_t mv)
{
    uint16_t n;

    if (mv < 500) {
        mv = 500;
    }
    n = (uint16_t)((mv - 500) / 100);
    if (n > 0x1F) {
        n = 0x1F;
    }
    return (uint8_t)n;
}

static uint16_t __dec_ldo_mv(uint8_t enc)
{
    return (uint16_t)(500 + (enc & 0x1F) * 100);
}

/* 配置后回读摄像头三路 LDO，便于与万用表实测对照 */
static void __axp_dump_camera_rails(uint8_t port)
{
    uint8_t en = 0, b1 = 0, b2 = 0, a3 = 0;

    if (__axp_read(port, AXP_REG_LDO_EN0, &en) != OPRT_OK) {
        TAL_PR_ERR("[axp2101] camera rail dump: read reg0x90 failed");
        return;
    }
    __axp_read(port, AXP_REG_BLDO1_CFG, &b1);
    __axp_read(port, AXP_REG_BLDO2_CFG, &b2);
    __axp_read(port, AXP_REG_ALDO3_CFG, &a3);
    TAL_PR_INFO("[axp2101] camera rails verify: reg0x90=0x%02x BLDO1(en=%d %umV) BLDO2(en=%d %umV) ALDO3(en=%d %umV)",
                en,
                (en >> 4) & 1, __dec_ldo_mv(b1),
                (en >> 5) & 1, __dec_ldo_mv(b2),
                (en >> 2) & 1, __dec_ldo_mv(a3));
}

OPERATE_RET tuya_axp2101_reg_read(uint8_t i2c_port, uint8_t reg, uint8_t *val)
{
    if (!val) {
        return OPRT_INVALID_PARM;
    }
    return __axp_read(i2c_port, reg, val);
}

OPERATE_RET tuya_axp2101_reg_write(uint8_t i2c_port, uint8_t reg, uint8_t val)
{
    return __axp_write(i2c_port, reg, val);
}

OPERATE_RET tuya_axp2101_power_key_config(uint8_t i2c_port)
{
    /* 对齐 XPowers：128ms 开机(0) + 4s 关机(0) -> reg0x27[3:0]=0 */
    OPERATE_RET rt = __axp_update(i2c_port, AXP_REG_PWR_KEY, 0x0F, 0x00);
    if (rt == OPRT_OK) {
        TAL_PR_INFO("[axp2101] power key: press-on 128ms, press-off 4s");
    }
    return rt;
}

OPERATE_RET tuya_axp2101_power_on(uint8_t i2c_port)
{
    OPERATE_RET rt;

    /* 口袋机：先关 DCDC2/3/4/5（不动 DCDC1，避免 MCU 掉电） */
    rt = __axp_update(i2c_port, AXP_REG_DCDC_EN, AXP_DCDC_DIS_EXTRA, 0x00);
    if (rt != OPRT_OK) {
        return rt;
    }

    /* 关全部 ALDO/BLDO，再统一设压使能 */
    rt = __axp_update(i2c_port, AXP_REG_LDO_EN0, AXP_LDO_EN_ALL06, 0x00);
    if (rt != OPRT_OK) {
        return rt;
    }

    rt = __axp_update(i2c_port, AXP_REG_DCDC1_CFG, 0x1F, __enc_dcdc1_mv(AXP_POCKET_DCDC1_MV));
    if (rt != OPRT_OK) return rt;
    rt = __axp_update(i2c_port, AXP_REG_DCDC5_CFG, 0x1F, __enc_dcdc5_mv(AXP_POCKET_DCDC5_MV));
    if (rt != OPRT_OK) return rt;
    rt = __axp_update(i2c_port, AXP_REG_ALDO1_CFG, 0x1F, __enc_ldo_mv(AXP_POCKET_RTC_MV));
    if (rt != OPRT_OK) return rt;
    rt = __axp_update(i2c_port, AXP_REG_ALDO3_CFG, 0x1F, __enc_ldo_mv(AXP_CAM_VDDCAM_MV));
    if (rt != OPRT_OK) return rt;
    rt = __axp_update(i2c_port, AXP_REG_ALDO4_CFG, 0x1F, __enc_ldo_mv(AXP_POCKET_ALDO4_MV));
    if (rt != OPRT_OK) return rt;
    rt = __axp_update(i2c_port, AXP_REG_BLDO1_CFG, 0x1F, __enc_ldo_mv(AXP_CAM_AVDD_MV));
    if (rt != OPRT_OK) return rt;
    rt = __axp_update(i2c_port, AXP_REG_BLDO2_CFG, 0x1F, __enc_ldo_mv(AXP_CAM_DVDD_MV));
    if (rt != OPRT_OK) return rt;

    rt = __axp_update(i2c_port, AXP_REG_DCDC_EN, AXP_DCDC_EN_POCKET, AXP_DCDC_EN_POCKET);
    if (rt != OPRT_OK) return rt;
    rt = __axp_update(i2c_port, AXP_REG_LDO_EN0, AXP_LDO_EN_POCKET, AXP_LDO_EN_POCKET);
    if (rt != OPRT_OK) return rt;

    tal_system_sleep(20);
    TAL_PR_INFO("[axp2101] pocket power_on: DCDC1/5=3.3V ALDO1=1.8V ALDO3/4 BLDO1/2 enabled");
    return OPRT_OK;
}

OPERATE_RET tuya_axp2101_camera_power_on(uint8_t i2c_port)
{
    OPERATE_RET rt;

    /* 先设电压再使能，避免上电瞬间过压；电压寄存器低 5 位有效 */
    rt = __axp_update(i2c_port, AXP_REG_BLDO1_CFG, 0x1F, __enc_ldo_mv(AXP_CAM_AVDD_MV));
    if (rt != OPRT_OK) return rt;
    rt = __axp_update(i2c_port, AXP_REG_BLDO2_CFG, 0x1F, __enc_ldo_mv(AXP_CAM_DVDD_MV));
    if (rt != OPRT_OK) return rt;
    rt = __axp_update(i2c_port, AXP_REG_ALDO3_CFG, 0x1F, __enc_ldo_mv(AXP_CAM_VDDCAM_MV));
    if (rt != OPRT_OK) return rt;

    /* reg0x90：使能 BLDO1/BLDO2/ALDO3（对应 U4.12/14/16），不改动其它 LDO 位 */
    rt = __axp_update(i2c_port, AXP_REG_LDO_EN0, AXP_LDO_EN_CAM_MASK, AXP_LDO_EN_CAM_MASK);
    if (rt != OPRT_OK) return rt;

    /* 摄像头模拟/数字轨上电后需稳定时间，再由上层做复位/检测 */
    tal_system_sleep(20);
    TAL_PR_INFO("[axp2101] camera rails on: BLDO1=%umV BLDO2=%umV ALDO3=%umV",
                AXP_CAM_AVDD_MV, AXP_CAM_DVDD_MV, AXP_CAM_VDDCAM_MV);
    __axp_dump_camera_rails(i2c_port);
    return OPRT_OK;
}

OPERATE_RET tuya_axp2101_init(uint8_t i2c_port)
{
    uint8_t id = 0;
    OPERATE_RET rt = tuya_axp2101_probe(i2c_port, &id);
    if (rt != OPRT_OK) {
        return rt;
    }
    rt = tuya_axp2101_disable_ts(i2c_port);
    if (rt != OPRT_OK) {
        return rt;
    }
    rt = __axp_enable_adc_and_bat_detection(i2c_port);
    if (rt != OPRT_OK) {
        return rt;
    }
    rt = tuya_axp2101_charge_init(i2c_port, NULL);
    if (rt != OPRT_OK) {
        return rt;
    }
    rt = __axp_set_sys_powerdown_voltage(i2c_port, AXP_SYS_POWERDOWN_MV);
    if (rt != OPRT_OK) {
        return rt;
    }
    rt = tuya_axp2101_power_on(i2c_port);
    if (rt != OPRT_OK) {
        return rt;
    }
    rt = tuya_axp2101_power_key_config(i2c_port);
    if (rt != OPRT_OK) {
        return rt;
    }
    tuya_axp2101_dump_status(i2c_port);
    tuya_axp2101_cli_init();
    return OPRT_OK;
}
