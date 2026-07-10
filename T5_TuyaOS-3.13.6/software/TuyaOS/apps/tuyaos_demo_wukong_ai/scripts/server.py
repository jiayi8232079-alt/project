import asyncio
import logging
import os
from typing import Annotated

from dotenv import load_dotenv
from fastmcp import FastMCP
from pydantic import Field
from starlette.requests import Request
from starlette.responses import PlainTextResponse

from health_recipe_recommender import recommend_health_meals

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
    ingredients: Annotated[
        str,
        Field(description="Available or preferred ingredients, such as chicken and broccoli."),
    ] = "",
    health_goal: Annotated[
        str,
        Field(description="Health goal, such as low salt, glucose control, high protein."),
    ] = "",
    taste: Annotated[
        str,
        Field(description="Taste preference, such as light, fresh, sour-sweet, or mildly spicy."),
    ] = "",
    max_cooking_minutes: Annotated[
        int,
        Field(description="Maximum cooking time in minutes. Use 0 when there is no limit.", ge=0),
    ] = 0,
) -> str:
    """
    Recommend a practical healthy meal plan for the user.
    """
    logger.info(
        (
            "health_meal_recommend called: need=%s people=%s restrictions=%s "
            "ingredients=%s health_goal=%s taste=%s max_cooking_minutes=%s"
        ),
        need,
        people,
        restrictions,
        ingredients,
        health_goal,
        taste,
        max_cooking_minutes,
    )

    return recommend_health_meals(
        need=need,
        people=people,
        restrictions=restrictions,
        ingredients=ingredients,
        health_goal=health_goal,
        taste=taste,
        max_cooking_minutes=max_cooking_minutes,
    )


async def main() -> None:
    host = os.getenv("MCP_SERVER_HOST", "127.0.0.1")
    port = int(os.getenv("MCP_SERVER_PORT", "8765"))
    logger.info("Starting MCP server at http://%s:%s/mcp", host, port)
    await mcp.run_http_async(host=host, port=port)


if __name__ == "__main__":
    asyncio.run(main())
