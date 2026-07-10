/**
 * @file tuya_axp2101_cli_cp.c
 * @brief CP 侧 `axp` 命令桩：串口 shell 跑在 CP，AXP 驱动在 AP，须 mailbox 转发。
 *
 * BK7258 双核下 UART CLI 由 CP 的 shell_task 解析；应用 `axp` 仅在 AP 注册无效。
 * 本文件由 tuyaos_adapter（CP）编译，在 CP 注册同名命令并转发整行到 AP 执行。
 */
#include <common/bk_include.h>
#include <components/shell_task.h>
#include <os/str.h>
#include <os/mem.h>

/* Beken CLI 在 vendor 中编译，此处仅声明 CP 注册所需接口 */
struct cli_command {
    const char *name;
    const char *help;
    void (*function)(char *pcWriteBuffer, int xWriteBufferLen, int argc, char **argv);
};
int cli_register_commands(const struct cli_command *commands, int num_commands);

#define AXP_CP_FWD_LINE_MAX 128

static void axp_cli_cp_forward(char *pcWriteBuffer, int xWriteBufferLen, int argc, char **argv)
{
    int i;
    int pos = 0;
    char line[AXP_CP_FWD_LINE_MAX];

    (void)pcWriteBuffer;
    (void)xWriteBufferLen;

    if (argc < 1) {
        return;
    }

    os_memset(line, 0, sizeof(line));
    for (i = 0; i < argc && pos < (int)sizeof(line) - 3; i++) {
        if (i > 0) {
            line[pos++] = ' ';
        }
        pos += os_snprintf(&line[pos], (int)sizeof(line) - pos, "%s", argv[i]);
    }
    if (pos >= (int)sizeof(line) - 2) {
        bk_printf("axp: cmd too long\r\n");
        return;
    }
    line[pos++] = '\r';
    line[pos++] = '\n';
    shell_cmd_forward(line, (uint16_t)pos);
}

static const struct cli_command s_axp_cp_cli_commands[] = {
    {"axp", "AXP2101 dump/r/w/init/power (forward to AP)", axp_cli_cp_forward},
};

void tuya_axp2101_cli_cp_init(void)
{
    cli_register_commands(s_axp_cp_cli_commands,
                          (int)(sizeof(s_axp_cp_cli_commands) / sizeof(s_axp_cp_cli_commands[0])));
}
