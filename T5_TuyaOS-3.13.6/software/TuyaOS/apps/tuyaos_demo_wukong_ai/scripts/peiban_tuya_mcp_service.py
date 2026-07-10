#!/usr/bin/env python3
"""
Tuya custom MCP bridge for peiban backend tools.

This process is intended to run on a cloud/server host, not on the TuyaOS
device. It connects outbound to Tuya MCP WebSocket, exposes peiban.* tools to
the Tuya agent, and forwards every tool call to the peiban backend /mcp API.
"""

import asyncio
import hashlib
import hmac
import json
import logging
import os
import signal
import sys
import uuid
from contextlib import suppress
from typing import Annotated, Any
from urllib import error, request

from dotenv import load_dotenv
from fastmcp import Context, FastMCP
from pydantic import Field
from starlette.requests import Request
from starlette.responses import PlainTextResponse

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
)
logger = logging.getLogger("peiban-tuya-mcp")

mcp = FastMCP("Peiban Tuya Custom MCP Adapter")

DEVICE_ID_KEYS = (
    "tuyaDeviceId",
    "tuya_device_id",
    "deviceId",
    "device_id",
    "devId",
    "dev_id",
    "iotId",
    "iot_id",
    "uuid",
)
SESSION_ID_KEYS = (
    "sessionId",
    "session_id",
    "conversationId",
    "conversation_id",
    "chatId",
    "chat_id",
)


@mcp.custom_route("/health", methods=["GET"])
async def health_check(_: Request) -> PlainTextResponse:
    return PlainTextResponse("OK")


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def optional_env(name: str, default: str) -> str:
    value = os.getenv(name)
    return value if value else default


def mask_value(value: str) -> str:
    if len(value) <= 10:
        return "***"
    return f"{value[:6]}...{value[-4:]}"


def local_connect_host(host: str) -> str:
    if host in {"", "0.0.0.0", "::"}:
        return "127.0.0.1"
    return host


def to_plain_dict(value: Any) -> dict[str, Any]:
    if value is None:
        return {}
    if isinstance(value, dict):
        return value
    model_dump = getattr(value, "model_dump", None)
    if callable(model_dump):
        dumped = model_dump()
        return dumped if isinstance(dumped, dict) else {}
    as_dict = getattr(value, "dict", None)
    if callable(as_dict):
        dumped = as_dict()
        return dumped if isinstance(dumped, dict) else {}
    return {}


def extract_tuya_meta(ctx: Context) -> dict[str, Any]:
    try:
        request_context = ctx.request_context
        meta = getattr(request_context, "meta", None) if request_context else None
        return to_plain_dict(meta)
    except Exception:
        logger.debug("Failed to read FastMCP request meta", exc_info=True)
        return {}


def find_nested_value(value: Any, keys: tuple[str, ...], depth: int = 0) -> str | None:
    if value is None or depth > 5:
        return None
    if not isinstance(value, (dict, list)):
        value = to_plain_dict(value)

    if isinstance(value, dict):
        for key in keys:
            found = value.get(key)
            if found not in (None, ""):
                return str(found)
        for child in value.values():
            found = find_nested_value(child, keys, depth + 1)
            if found:
                return found
    elif isinstance(value, list):
        for child in value:
            found = find_nested_value(child, keys, depth + 1)
            if found:
                return found
    return None


def load_device_id_map() -> dict[str, str]:
    raw = os.getenv("PEIBAN_TUYA_DEVICE_ID_MAP", "").strip()
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            raise ValueError("PEIBAN_TUYA_DEVICE_ID_MAP must be a JSON object")
        return {str(k): str(v) for k, v in parsed.items()}
    except Exception as exc:
        raise RuntimeError("Invalid PEIBAN_TUYA_DEVICE_ID_MAP JSON") from exc


def resolve_device_id(ctx: Context) -> str:
    meta = extract_tuya_meta(ctx)
    meta_device_id = find_nested_value(meta, DEVICE_ID_KEYS)
    if meta_device_id:
        device_map = load_device_id_map()
        return device_map.get(meta_device_id, meta_device_id)

    default_device_id = os.getenv("PEIBAN_DEFAULT_DEVICE_ID", "").strip()
    if default_device_id:
        return default_device_id

    raise RuntimeError(
        "Cannot resolve device id from Tuya meta. Set PEIBAN_DEFAULT_DEVICE_ID "
        "for local smoke tests, or configure Tuya meta/device mapping."
    )


def resolve_session_id(ctx: Context) -> str:
    meta = extract_tuya_meta(ctx)
    meta_session_id = find_nested_value(meta, SESSION_ID_KEYS)
    if meta_session_id:
        return meta_session_id[:128]
    try:
        return ctx.session_id[:128]
    except Exception:
        return optional_env("PEIBAN_DEFAULT_SESSION_ID", "tuya-custom-mcp")


def parse_json_object(raw: str, field_name: str) -> dict[str, Any]:
    if not raw.strip():
        return {}
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise ValueError(f"{field_name} must be a JSON object")
    return parsed


def build_headers(body_json: str, device_id: str, session_id: str) -> dict[str, str]:
    request_id = f"tuya-mcp-{uuid.uuid4().hex[:16]}"
    headers = {
        "Content-Type": "application/json",
        "X-Device-Id": device_id,
        "X-Request-Id": request_id,
        "X-Session-Id": session_id,
    }

    secret = os.getenv("PEIBAN_MCP_HMAC_SECRET", "")
    if secret:
        string_to_sign = f"{device_id}\n{request_id}\n{body_json}"
        signature = hmac.new(
            secret.encode("utf-8"),
            string_to_sign.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        headers["Authorization"] = f"Bearer {signature}"

    return headers


def post_peiban_mcp(
    tool_name: str,
    arguments: dict[str, Any],
    ctx: Context,
) -> dict[str, Any]:
    endpoint = optional_env("PEIBAN_MCP_ENDPOINT", "http://127.0.0.1:3000/mcp")
    timeout = float(optional_env("PEIBAN_MCP_TIMEOUT_SECONDS", "15"))
    device_id = resolve_device_id(ctx)
    session_id = resolve_session_id(ctx)
    body = {
        "jsonrpc": "2.0",
        "id": f"tuya-{uuid.uuid4().hex[:12]}",
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": arguments,
        },
    }
    body_json = json.dumps(body, separators=(",", ":"), ensure_ascii=False)
    headers = build_headers(body_json, device_id, session_id)

    logger.info("Forwarding tool=%s device=%s", tool_name, mask_value(device_id))
    http_request = request.Request(
        endpoint,
        data=body_json.encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        with request.urlopen(http_request, timeout=timeout) as response:
            response_body = response.read().decode("utf-8")
    except error.HTTPError as exc:
        exc.read()
        raise RuntimeError(f"Peiban MCP HTTP error: {exc.code}") from exc
    except error.URLError as exc:
        raise RuntimeError(f"Peiban MCP connection error: {exc.reason}") from exc

    try:
        parsed = json.loads(response_body)
    except json.JSONDecodeError as exc:
        raise RuntimeError("Peiban MCP returned non-JSON response") from exc

    return unwrap_peiban_response(parsed)


def unwrap_peiban_response(response_obj: dict[str, Any]) -> dict[str, Any]:
    # Nest response interceptor wraps controller output as { code, message, data }.
    mcp_response = response_obj.get("data", response_obj)
    if not isinstance(mcp_response, dict):
        return {"success": False, "error": {"message": "Invalid peiban response"}}

    if "error" in mcp_response:
        return {"success": False, "error": mcp_response["error"]}

    result = mcp_response.get("result", mcp_response)
    if not isinstance(result, dict):
        return {"success": True, "data": result}

    content = result.get("content")
    if isinstance(content, list) and content:
        first = content[0]
        text = first.get("text") if isinstance(first, dict) else None
        if isinstance(text, str):
            try:
                parsed_text = json.loads(text)
                if isinstance(parsed_text, dict):
                    return parsed_text
                return {"success": True, "data": parsed_text}
            except json.JSONDecodeError:
                return {"success": True, "data": {"text": text}}

    return {"success": True, "data": result}


def as_tool_text(data: dict[str, Any]) -> str:
    return json.dumps(data, separators=(",", ":"), ensure_ascii=False)


@mcp.tool(
    name="peiban.elder.getProfile",
    title="查询老人基础信息",
    description="查询当前涂鸦设备绑定老人的基础档案与健康概况。",
)
def elder_get_profile(ctx: Context) -> str:
    return as_tool_text(post_peiban_mcp("peiban.elder.getProfile", {}, ctx))


@mcp.tool(
    name="peiban.health.getTodaySummary",
    title="查询今日健康摘要",
    description="查询当前涂鸦设备绑定老人的今日健康摘要、用药统计、未处理告警和健康建议。",
)
def health_get_today_summary(
    ctx: Context,
    date: Annotated[
        str,
        Field(description="日期，格式 YYYY-MM-DD；留空表示今天。"),
    ] = "",
) -> str:
    arguments = {"date": date} if date else {}
    return as_tool_text(post_peiban_mcp("peiban.health.getTodaySummary", arguments, ctx))


@mcp.tool(
    name="peiban.medication.getTodayReminders",
    title="查询今日用药提醒",
    description="查询当前涂鸦设备绑定老人的今日用药提醒、时间和执行状态。",
)
def medication_get_today_reminders(
    ctx: Context,
    date: Annotated[
        str,
        Field(description="日期，格式 YYYY-MM-DD；留空表示今天。"),
    ] = "",
) -> str:
    arguments = {"date": date} if date else {}
    return as_tool_text(
        post_peiban_mcp("peiban.medication.getTodayReminders", arguments, ctx)
    )


@mcp.tool(
    name="peiban.device.getBindingStatus",
    title="查询设备绑定状态",
    description="查询当前涂鸦设备在 peiban 后端的绑定、在线、电量与固件状态。",
)
def device_get_binding_status(ctx: Context) -> str:
    return as_tool_text(post_peiban_mcp("peiban.device.getBindingStatus", {}, ctx))


@mcp.tool(
    name="peiban.device.reportEvent",
    title="上报设备事件",
    description="上报当前涂鸦设备事件流水，例如在线、离线、DP 变化、AI 对话、故障、SOS 或跌倒。",
)
def device_report_event(
    ctx: Context,
    type: Annotated[
        str,
        Field(description="事件类型，例如 online、offline、dp_change、sos、fall、ai_dialog、fault。"),
    ],
    level: Annotated[
        str,
        Field(description="事件等级：info、warning、critical。"),
    ] = "info",
    payload_json: Annotated[
        str,
        Field(description="可选事件扩展数据，JSON object 字符串；留空表示无扩展数据。"),
    ] = "",
    dedup_key: Annotated[
        str,
        Field(description="可选去重键；同一事件重复上报时使用。"),
    ] = "",
) -> str:
    arguments: dict[str, Any] = {"type": type, "level": level}
    payload = parse_json_object(payload_json, "payload_json")
    if payload:
        arguments["payload"] = payload
    if dedup_key:
        arguments["dedupKey"] = dedup_key
    return as_tool_text(post_peiban_mcp("peiban.device.reportEvent", arguments, ctx))


@mcp.tool(
    name="peiban.alert.create",
    title="创建老人告警",
    description="为当前设备绑定老人创建告警。高风险告警应由设备/涂鸦事件链路确认后调用。",
)
def alert_create(
    ctx: Context,
    type: Annotated[
        str,
        Field(description="告警类型：fall、sos、vital_anomaly、manual。"),
    ] = "manual",
    severity: Annotated[
        str,
        Field(description="告警等级：info、warn、emergency、warning、critical。"),
    ] = "warn",
    reason: Annotated[
        str,
        Field(description="告警原因或需要通知家属的话。"),
    ] = "",
    payload_json: Annotated[
        str,
        Field(description="可选告警扩展数据，JSON object 字符串；留空表示无扩展数据。"),
    ] = "",
) -> str:
    arguments: dict[str, Any] = {"type": type, "severity": severity}
    if reason:
        arguments["reason"] = reason
    payload = parse_json_object(payload_json, "payload_json")
    if payload:
        arguments["payload"] = payload
    return as_tool_text(post_peiban_mcp("peiban.alert.create", arguments, ctx))


def configure_stdio() -> None:
    if sys.platform != "win32":
        return
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8")


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
                error_obj = server_task.exception()
            except asyncio.CancelledError as exc:
                raise RuntimeError("Local MCP server stopped before listening") from exc
            if error_obj:
                raise RuntimeError("Local MCP server failed to start") from error_obj
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

    logger.info("Connecting Tuya MCP SDK")
    logger.info("Tuya endpoint: %s", endpoint)
    logger.info("Tuya access ID: %s", mask_value(access_id))
    logger.info("Local custom MCP server: %s", custom_endpoint)
    logger.info("Peiban MCP endpoint: %s", optional_env("PEIBAN_MCP_ENDPOINT", "http://127.0.0.1:3000/mcp"))
    if not os.getenv("PEIBAN_MCP_HMAC_SECRET"):
        logger.warning(
            "PEIBAN_MCP_HMAC_SECRET is empty. This is only suitable for local "
            "development when the peiban backend allows unsigned MCP calls."
        )

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

    host = optional_env("MCP_SERVER_HOST", "127.0.0.1")
    port = int(optional_env("MCP_SERVER_PORT", "8766"))
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
