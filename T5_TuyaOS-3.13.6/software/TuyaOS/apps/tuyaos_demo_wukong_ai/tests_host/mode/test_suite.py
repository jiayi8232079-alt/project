import pytest

_TESTS = [
    (
        "free_mode",
        "Free mode should exit to idle after notify-idle and stay idle on playback end",
        ["src/mode/wukong_ai_mode_free.c"],
        ["stubs_free_mode.c", "test_free_mode.c"],
        ["src/mode", "src/wukong"],
    ),
    (
        "product_board_lcd_debug",
        "Product board LCD debug helper should flush a full red RGB565 frame",
        ["src/boards/T5AI_BOARD/product_board_lcd_debug.c"],
        ["stubs_product_board_lcd_debug.c", "test_product_board_lcd_debug.c"],
        ["src/boards/T5AI_BOARD"],
    ),
]

_IDS = [t[0] for t in _TESTS]


@pytest.mark.parametrize(
    "name,description,sdk_sources,test_sources,extra_includes",
    _TESTS,
    ids=_IDS,
)
def test_mode_behavior(
    name, description, sdk_sources, test_sources, extra_includes, c_test,
):
    for src in test_sources:
        c_test.add_test_source(src)
    for src in sdk_sources:
        c_test.add_sdk_source(src)
    for inc in extra_includes:
        c_test.include_sdk(inc)
    c_test.run()
