import asyncio
import logging
import os
import signal
import sys

from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("tuya-mcp-bridge")


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def mask_value(value: str) -> str:
    if len(value) <= 10:
        return "***"
    return f"{value[:6]}...{value[-4:]}"


async def main() -> None:
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
    custom_endpoint = os.getenv(
        "CUSTOM_MCP_SERVER_ENDPOINT", "http://127.0.0.1:8765/mcp"
    )

    stop_event = asyncio.Event()

    def stop() -> None:
        logger.info("Shutdown requested")
        stop_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            asyncio.get_running_loop().add_signal_handler(sig, stop)
        except NotImplementedError:
            signal.signal(sig, lambda *_: stop())

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
            await asyncio.sleep(30)

    logger.info("Bridge stopped")


if __name__ == "__main__":
    if sys.platform == "win32":
        for stream in (sys.stdout, sys.stderr):
            reconfigure = getattr(stream, "reconfigure", None)
            if callable(reconfigure):
                reconfigure(encoding="utf-8")
    asyncio.run(main())
