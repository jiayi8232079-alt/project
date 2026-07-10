import asyncio
import logging
import os
import signal
import sys
from contextlib import suppress
from typing import Annotated

from dotenv import load_dotenv
from fastmcp import FastMCP
from pydantic import Field
from starlette.requests import Request
from starlette.responses import PlainTextResponse

from health_recipe_recommender import recommend_health_meals

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
)
logger = logging.getLogger("tuya-mcp-service")

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


def configure_stdio() -> None:
    if sys.platform != "win32":
        return

    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8")


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def local_connect_host(host: str) -> str:
    if host in {"", "0.0.0.0", "::"}:
        return "127.0.0.1"
    return host


def mask_value(value: str) -> str:
    if len(value) <= 10:
        return "***"
    return f"{value[:6]}...{value[-4:]}"


async def wait_for_port(
    host: str,
    port: int,
    server_task: asyncio.Task[None],
    timeout: float = 15.0,
) -> None:
    connect_host = local_connect_host(host)
    deadline = asyncio.get_running_loop().time() + timeout
    last_error: BaseException | None = None

    while asyncio.get_running_loop().time() < deadline:
        if server_task.done():
            try:
                error = server_task.exception()
            except asyncio.CancelledError as exc:
                raise RuntimeError("Local MCP server stopped before listening") from exc
            if error:
                raise RuntimeError("Local MCP server failed to start") from error
            raise RuntimeError("Local MCP server stopped before listening")

        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(connect_host, port),
                timeout=0.5,
            )
            writer.close()
            await writer.wait_closed()
            logger.info("Local MCP server is listening at %s:%s", connect_host, port)
            return
        except (OSError, asyncio.TimeoutError) as exc:
            last_error = exc
            await asyncio.sleep(0.2)

    raise TimeoutError(
        f"Timed out waiting for local MCP server at {connect_host}:{port}"
    ) from last_error


async def run_mcp_server(host: str, port: int) -> None:
    logger.info("Starting local MCP server at http://%s:%s/mcp", host, port)
    await mcp.run_http_async(show_banner=False, host=host, port=port)


async def run_bridge(stop_event: asyncio.Event, server_host: str, server_port: int) -> None:
    try:
        from mcp_sdk import create_mcpsdk
    except ImportError as exc:
        raise RuntimeError(
            "mcp_sdk is not installed. Install it with: "
            "pip install git+https://github.com/tuya/tuya-mcp-sdk.git#subdirectory=mcp-python"
        ) from exc

    endpoint = require_env("TUYA_MCP_ENDPOINT")
    access_id = require_env("TUYA_MCP_ACCESS_ID")
    access_secret = require_env("TUYA_MCP_ACCESS_SECRET")
    expected_custom_endpoint = (
        f"http://{local_connect_host(server_host)}:{server_port}/mcp"
    )
    custom_endpoint = os.getenv("CUSTOM_MCP_SERVER_ENDPOINT", expected_custom_endpoint)

    if custom_endpoint != expected_custom_endpoint:
        logger.warning(
            "CUSTOM_MCP_SERVER_ENDPOINT is %s, local server is %s",
            custom_endpoint,
            expected_custom_endpoint,
        )

    logger.info("Connecting Tuya MCP SDK")
    logger.info("Endpoint: %s", endpoint)
    logger.info("Access ID: %s", mask_value(access_id))
    logger.info("Custom MCP Server: %s", custom_endpoint)

    async with create_mcpsdk(
        endpoint=endpoint,
        access_id=access_id,
        access_secret=access_secret,
        custom_mcp_server_endpoint=custom_endpoint,
    ) as sdk:
        await sdk.start_background()
        logger.info("Bridge started. Check Tuya platform service status.")

        while not stop_event.is_set() and sdk.is_running:
            if sdk.is_connected:
                logger.info("Tuya MCP bridge connected")
            else:
                logger.warning("Tuya MCP bridge reconnecting")

            with suppress(asyncio.TimeoutError):
                await asyncio.wait_for(stop_event.wait(), timeout=30)

    logger.info("Bridge stopped")


async def main() -> None:
    configure_stdio()

    host = os.getenv("MCP_SERVER_HOST", "127.0.0.1")
    port = int(os.getenv("MCP_SERVER_PORT", "8765"))
    stop_event = asyncio.Event()

    def stop() -> None:
        logger.info("Shutdown requested")
        stop_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            asyncio.get_running_loop().add_signal_handler(sig, stop)
        except NotImplementedError:
            signal.signal(sig, lambda *_: stop())

    server_task = asyncio.create_task(run_mcp_server(host, port))

    try:
        await wait_for_port(host, port, server_task)
        await run_bridge(stop_event, host, port)
    finally:
        server_task.cancel()
        with suppress(asyncio.CancelledError):
            await server_task


if __name__ == "__main__":
    asyncio.run(main())
