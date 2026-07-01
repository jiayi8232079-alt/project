#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Quick test of Solidworks-MCP automation API (without MCP transport)."""

import io
import os
import sys

ROOT = r"c:\000_OPC\器件资料\tools\solidworks-mcp"
sys.path.insert(0, ROOT)

for stream_name in ("stdout", "stderr"):
    stream = getattr(sys, stream_name, None)
    if stream and hasattr(stream, "reconfigure"):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

from solidworks_mcp.automation import SolidWorksAutomation

OUTPUT = r"c:\000_OPC\器件资料\电机\马达-MCP测试.SLDPRT"


def show(result, label):
    ok = result.get("success")
    print("[{0}] {1}: {2}".format("PASS" if ok else "FAIL", label, result.get("message")))
    if not ok:
        sys.exit(1)


def main():
    sw = SolidWorksAutomation()

    show(sw.connect(), "connect")
    show(sw.create_new_part(), "create_new_part")
    show(sw.create_sketch("Top"), "create_sketch Top")
    show(sw.draw_circle(0, 0, 14), "draw_circle r=14")
    show(sw.exit_sketch(), "close_sketch")
    show(sw.extrude_sketch(19), "extrude 19mm")

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    show(sw.save_document(OUTPUT), "save")
    print("Saved:", OUTPUT)


if __name__ == "__main__":
    main()
