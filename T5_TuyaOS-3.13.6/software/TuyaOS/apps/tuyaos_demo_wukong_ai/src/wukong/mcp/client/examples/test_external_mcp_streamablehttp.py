#!/usr/bin/env python3
"""Host-side smoke test for streamablehttp MCP (e.g. McDonald's). Usage:
  export MCD_MCP_TOKEN='your-token'
  python3 test_external_mcp_streamablehttp.py
"""
import json
import os
import sys
import urllib.request

URL = os.environ.get("MCP_URL", "https://mcp.mcd.cn")
TOKEN = os.environ.get("MCD_MCP_TOKEN", "")

if not TOKEN or TOKEN == "YOUR_MCP_TOKEN":
    print("Set MCD_MCP_TOKEN to your Bearer token", file=sys.stderr)
    sys.exit(1)


def rpc(method, params=None, req_id=1):
    body = {"jsonrpc": "2.0", "id": req_id, "method": method}
    if params is not None:
        body["params"] = params
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        URL,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "Authorization": f"Bearer {TOKEN}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read().decode("utf-8", errors="replace")
    return json.loads(raw)


def main():
    init = rpc(
        "initialize",
        {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "wukong-host-test", "version": "0.0.43"},
        },
    )
    print("initialize:", json.dumps(init, ensure_ascii=False)[:500])

    tools = rpc("tools/list", {})
    items = tools.get("result", {}).get("tools", [])
    print(f"tools/list: {len(items)} tools")
    for t in items[:10]:
        print(" -", t.get("name"))

    if items:
        name = items[0]["name"]
        print(f"tools/call sample skipped for safety (first tool: {name})")


if __name__ == "__main__":
    main()
