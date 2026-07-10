/**
 * @file tuya_axp2101_cli.c
 * @brief AXP2101 串口调试命令（对齐口袋机寄存器读写需求）。
 *
 * 用法：
 *   axp dump          — 关键寄存器 + ADC + PMU 状态
 *   axp status        — 同 dump
 *   axp r <reg>       — 读单寄存器，如 axp r 80
 *   axp w <reg> <val> — 写单寄存器，如 axp w 90 3d
 *   axp init          — 重新执行 tuya_axp2101_init
 *   axp power         — 仅执行 power_on（口袋机等价）
 */
#include "tuya_axp2101.h"

#include "tkl_i2c.h"
#include "tal_log.h"
#include <stdlib.h>
#include <string.h>

/* Beken CLI 在 vendor 中编译，应用层仅声明注册接口 */
struct cli_command {
    const char *name;
    const char *help;
    void (*function)(char *pcWriteBuffer, int xWriteBufferLen, int argc, char **argv);
};
int cli_register_commands(const struct cli_command *commands, int num_commands);

#define AXP_CLI_I2C_PORT TUYA_I2C_NUM_0

static int __axp_cli_hex8(const char *s, uint8_t *out)
{
    char *end = NULL;
    long v;

    if (!s || !out) {
        return -1;
    }
    v = strtol(s, &end, 16);
    if (end == s || v < 0 || v > 0xFF) {
        return -1;
    }
    *out = (uint8_t)v;
    return 0;
}

static void __axp_cli_usage(void)
{
    TAL_PR_INFO("axp dump|status | r <reg> | w <reg> <val> | init | power");
}

static void axp_cli_cmd(char *pcWriteBuffer, int xWriteBufferLen, int argc, char **argv)
{
    (void)pcWriteBuffer;
    (void)xWriteBufferLen;

    if (argc < 2) {
        __axp_cli_usage();
        return;
    }

    if (strcmp(argv[1], "dump") == 0 || strcmp(argv[1], "status") == 0) {
        tuya_axp2101_dump_status(AXP_CLI_I2C_PORT);
        return;
    }

    if (strcmp(argv[1], "init") == 0) {
        if (tuya_axp2101_init(AXP_CLI_I2C_PORT) != OPRT_OK) {
            TAL_PR_ERR("axp init failed");
        }
        return;
    }

    if (strcmp(argv[1], "power") == 0) {
        if (tuya_axp2101_power_on(AXP_CLI_I2C_PORT) != OPRT_OK) {
            TAL_PR_ERR("axp power_on failed");
        }
        return;
    }

    if (strcmp(argv[1], "r") == 0) {
        uint8_t reg = 0;
        uint8_t val = 0;

        if (argc < 3 || __axp_cli_hex8(argv[2], &reg) != 0) {
            TAL_PR_ERR("usage: axp r <reg_hex>");
            return;
        }
        if (tuya_axp2101_reg_read(AXP_CLI_I2C_PORT, reg, &val) == OPRT_OK) {
            TAL_PR_INFO("axp reg0x%02x = 0x%02x", reg, val);
        } else {
            TAL_PR_ERR("axp read reg0x%02x failed", reg);
        }
        return;
    }

    if (strcmp(argv[1], "w") == 0) {
        uint8_t reg = 0;
        uint8_t val = 0;

        if (argc < 4 || __axp_cli_hex8(argv[2], &reg) != 0 || __axp_cli_hex8(argv[3], &val) != 0) {
            TAL_PR_ERR("usage: axp w <reg_hex> <val_hex>");
            return;
        }
        if (tuya_axp2101_reg_write(AXP_CLI_I2C_PORT, reg, val) == OPRT_OK) {
            TAL_PR_INFO("axp wrote reg0x%02x = 0x%02x", reg, val);
        } else {
            TAL_PR_ERR("axp write reg0x%02x failed", reg);
        }
        return;
    }

    TAL_PR_ERR("unknown axp subcmd: %s", argv[1]);
    __axp_cli_usage();
}

static const struct cli_command s_axp_cli_commands[] = {
    {"axp", "AXP2101 dump/r/w/init/power (hex reg/val)", axp_cli_cmd},
};

static int s_axp_cli_registered;

void tuya_axp2101_cli_init(void)
{
    int rc;

    if (s_axp_cli_registered) {
        return;
    }
    rc = cli_register_commands(s_axp_cli_commands,
                               (int)(sizeof(s_axp_cli_commands) / sizeof(s_axp_cli_commands[0])));
    if (rc != 0) {
        TAL_PR_ERR("[axp2101] CLI register failed rc=%d (CLI full or too early)", rc);
        return;
    }
    s_axp_cli_registered = 1;
    TAL_PR_NOTICE("[axp2101] CLI ready: axp dump | r <reg> | w <reg> <val>");
}
