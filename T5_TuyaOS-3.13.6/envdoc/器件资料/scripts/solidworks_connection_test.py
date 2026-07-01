#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
SolidWorks COM connection test.
Verifies that Python can attach to a running SolidWorks instance via win32com.
"""

from __future__ import print_function

import io
import sys
import traceback


def configure_stdio():
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if stream is None:
            continue
        try:
            if hasattr(stream, "reconfigure"):
                stream.reconfigure(encoding="utf-8", errors="replace")
            elif hasattr(stream, "buffer"):
                wrapped = io.TextIOWrapper(
                    stream.buffer, encoding="utf-8", errors="replace"
                )
                setattr(sys, stream_name, wrapped)
        except Exception:
            pass

PASS = "PASS"
FAIL = "FAIL"
WARN = "WARN"


def log(status, message):
    print("[{0}] {1}".format(status, message))


def try_dispatch(prog_id):
    import win32com.client

    return win32com.client.Dispatch(prog_id)


def try_get_active_object(prog_id):
    import win32com.client

    return win32com.client.GetActiveObject(prog_id)


def get_doc_type_name(doc_type):
    mapping = {
        1: "Part",
        2: "Assembly",
        3: "Drawing",
    }
    return mapping.get(doc_type, "Unknown({0})".format(doc_type))


def com_get(obj, name):
    """Read a COM member that may be exposed as a property or zero-arg method."""
    value = getattr(obj, name)
    if callable(value):
        return value()
    return value


def main():
    print("=" * 60)
    print("SolidWorks Python COM Connection Test")
    print("Python: {0}".format(sys.version.replace("\n", " ")))
    print("=" * 60)

    results = []

    # Step 1: import pywin32
    try:
        import pythoncom
        import win32com.client

        log(PASS, "pywin32 imported successfully")
        results.append(True)
    except Exception as exc:
        log(FAIL, "Cannot import pywin32: {0}".format(exc))
        return 1

    sw = None
    connection_mode = None

    # Step 2: connect to running SolidWorks (preferred)
    try:
        sw = try_get_active_object("SldWorks.Application")
        connection_mode = "GetActiveObject"
        log(PASS, "Connected to running SolidWorks via GetActiveObject")
        results.append(True)
    except Exception as active_exc:
        log(WARN, "No running SolidWorks session: {0}".format(active_exc))
        results.append(False)

        # Step 3: try Dispatch (may start a new instance)
        try:
            sw = try_dispatch("SldWorks.Application")
            connection_mode = "Dispatch"
            log(PASS, "Connected via Dispatch (new or existing instance)")
            results.append(True)
        except Exception as dispatch_exc:
            log(FAIL, "Dispatch failed: {0}".format(dispatch_exc))
            log(FAIL, "SolidWorks may not be installed or COM registration is broken")
            return 1

    # Step 4: basic API calls
    try:
        revision = com_get(sw, "RevisionNumber")
        visible = com_get(sw, "Visible")
        frame_state = com_get(sw, "FrameState")
        log(PASS, "RevisionNumber = {0}".format(revision))
        log(PASS, "Visible = {0}".format(visible))
        log(PASS, "FrameState = {0}".format(frame_state))
        results.append(True)
    except Exception as exc:
        log(FAIL, "Basic API call failed: {0}".format(exc))
        traceback.print_exc()
        return 1

    # Step 5: active document info
    try:
        model = sw.ActiveDoc
        if model is None:
            log(WARN, "No active document open in SolidWorks")
            results.append(True)
        else:
            title = com_get(model, "GetTitle")
            doc_type = com_get(model, "GetType")
            path = com_get(model, "GetPathName")
            log(PASS, "Active document title: {0}".format(title))
            log(PASS, "Active document type: {0}".format(get_doc_type_name(doc_type)))
            if path:
                log(PASS, "Active document path: {0}".format(path))
            else:
                log(WARN, "Active document has not been saved yet")
            results.append(True)
    except Exception as exc:
        log(FAIL, "ActiveDoc query failed: {0}".format(exc))
        traceback.print_exc()
        return 1

    # Step 6: lightweight write test (toggle visibility)
    try:
        original_visible = com_get(sw, "Visible")
        sw.Visible = True
        if com_get(sw, "Visible"):
            log(PASS, "Write test OK (set Visible=True)")
        else:
            log(WARN, "Visible remained False after write attempt")
        sw.Visible = original_visible
        results.append(True)
    except Exception as exc:
        log(FAIL, "Write test failed: {0}".format(exc))
        results.append(False)

    print("-" * 60)
    if all(results):
        print("RESULT: SUCCESS")
        print("Connection mode: {0}".format(connection_mode))
        print("Python can control SolidWorks on this machine.")
        return 0

    print("RESULT: PARTIAL")
    print("Connection established but some checks failed.")
    return 2


if __name__ == "__main__":
    configure_stdio()
    sys.exit(main())
