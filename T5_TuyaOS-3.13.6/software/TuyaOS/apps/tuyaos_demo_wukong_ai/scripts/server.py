import asyncio
import logging
import os
from typing import Annotated

from dotenv import load_dotenv
from fastmcp import FastMCP
from pydantic import Field
from starlette.requests import Request
from starlette.responses import PlainTextResponse

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("shanmao-mcp-server")

mcp = FastMCP("Shanmao Health Meal Demo")


@mcp.custom_route("/health", methods=["GET"])
async def health_check(_: Request) -> PlainTextResponse:
    return PlainTextResponse("OK")


@mcp.tool
def health_meal_recommend(
    need: Annotated[
        str,
        Field(description="User's meal or recipe need, such as low salt dinner."),
    ],
    people: Annotated[
        str,
        Field(description="Target person, such as elderly, child, or family."),
    ] = "elderly",
    restrictions: Annotated[
        str,
        Field(description="Dietary restrictions, such as low salt, low sugar, no seafood."),
    ] = "",
) -> str:
    """
    Recommend a practical healthy meal plan for the user.
    """
    # TODO: Replace this mock block with a real Shanmao MCP/API call when
    # Shanmao provides the machine-to-machine endpoint and auth method.
    logger.info(
        "health_meal_recommend called: need=%s people=%s restrictions=%s",
        need,
        people,
        restrictions,
    )

    return (
        f"已为{people}生成健康餐建议。"
        f"需求：{need}。"
        f"限制：{restrictions or '无特殊限制'}。"
        "推荐：清蒸鱼或鸡胸肉补充优质蛋白，搭配西兰花、番茄鸡蛋汤和少量杂粮饭；"
        "调味少盐少油，避免重辣、油炸和高糖饮料。"
    )


async def main() -> None:
    host = os.getenv("MCP_SERVER_HOST", "127.0.0.1")
    port = int(os.getenv("MCP_SERVER_PORT", "8765"))
    logger.info("Starting MCP server at http://%s:%s/mcp", host, port)
    await mcp.run_http_async(host=host, port=port)


if __name__ == "__main__":
    asyncio.run(main())

