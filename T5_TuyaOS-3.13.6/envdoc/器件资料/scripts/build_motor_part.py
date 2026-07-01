#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Build stepper motor part in SolidWorks from 电机/马达.png dimensions.
Creates a new part file only; does not modify other documents.
"""

from __future__ import print_function

import io
import os
import sys
import traceback

import pythoncom
import win32com.client

# SolidWorks API uses meters
def mm(value):
    return value / 1000.0


OUTPUT_DIR = r"c:\000_OPC\器件资料\电机"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "马达.SLDPRT")

PLANE_NAMES = {
    "front": ("前视基准面", "Front Plane"),
    "top": ("上视基准面", "Top Plane"),
    "right": ("右视基准面", "Right Plane"),
}


def configure_stdio():
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if stream is None:
            continue
        try:
            if hasattr(stream, "reconfigure"):
                stream.reconfigure(encoding="utf-8", errors="replace")
            elif hasattr(stream, "buffer"):
                setattr(
                    sys,
                    stream_name,
                    io.TextIOWrapper(stream.buffer, encoding="utf-8", errors="replace"),
                )
        except Exception:
            pass


def log(msg):
    print(msg)


def connect_solidworks():
    try:
        return win32com.client.GetActiveObject("SldWorks.Application")
    except Exception:
        sw = win32com.client.Dispatch("SldWorks.Application")
        sw.Visible = True
        return sw


def get_part_template(sw):
    # swDefaultTemplatePart = 8
    template = sw.GetUserPreferenceStringValue(8)
    if template and os.path.exists(template):
        return template
    candidates = [
        r"C:\ProgramData\SolidWorks\SOLIDWORKS 2024\templates\GB.part.prtdot",
        r"C:\ProgramData\SolidWorks\SOLIDWORKS 2024\templates\Part.prtdot",
        r"C:\ProgramData\SolidWorks\SOLIDWORKS 2023\templates\Part.prtdot",
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    raise RuntimeError("Cannot find SolidWorks part template")


def select_plane_feature(model, plane_key):
    for name in PLANE_NAMES[plane_key]:
        try:
            feat = model.FeatureByName(name)
            if feat and feat.Select2(False, 0):
                return name
        except Exception:
            continue
    return None


def clear_selection(model):
    model.ClearSelection2(True)


def extrude_boss(model, depth):
    model.FeatureManager.FeatureExtrusion2(
        True,
        False,
        False,
        0,
        0,
        depth,
        0.0,
        False,
        False,
        False,
        False,
        0.0,
        0.0,
        False,
        False,
        False,
        False,
        True,
        True,
        True,
        0,
        0,
        False,
    )


def extrude_cut(model, depth):
    model.FeatureManager.FeatureCut2(
        True,
        False,
        False,
        0,
        0,
        depth,
        0.0,
        False,
        False,
        False,
        False,
        0.0,
        0.0,
        False,
        False,
        False,
        False,
        True,
        True,
        True,
        0,
        0,
        False,
    )


def cut_through_all(model):
    # T1 = 1 -> through all
    model.FeatureManager.FeatureCut2(
        True,
        False,
        False,
        1,
        0,
        0.0,
        0.0,
        False,
        False,
        False,
        False,
        0.0,
        0.0,
        False,
        False,
        False,
        False,
        True,
        True,
        True,
        0,
        0,
        False,
    )


def start_sketch_on_plane(model, plane_key):
    clear_selection(model)
    name = select_plane_feature(model, plane_key)
    if not name:
        raise RuntimeError("Plane not found: {0}".format(plane_key))
    model.SketchManager.InsertSketch(True)
    return name


def end_sketch(model):
    model.SketchManager.InsertSketch(True)


def sketch_circle(model, x, y, radius):
    model.SketchManager.CreateCircleByRadius(x, y, 0.0, radius)


def sketch_rectangle(model, x1, y1, x2, y2):
    model.SketchManager.CreateCornerRectangle(x1, y1, 0.0, x2, y2, 0.0)


def sketch_on_top_face(model, z=None):
    if z is None:
        z = mm(19.0)
    if not select_face_by_ray(model, 0.0, 0.0, z, 0.0, 0.0, -1.0):
        raise RuntimeError("Cannot select top face of motor body")
    model.SketchManager.InsertSketch(True)


def select_face_by_ray(model, x, y, z, dir_x, dir_y, dir_z):
    clear_selection(model)
    return model.Extension.SelectByRay(
        x, y, z, dir_x, dir_y, dir_z, mm(1.0), 2, False, 0, 0
    )


def build_main_body(model):
    log("1/6 Main body cylinder Ø28 x 19 mm")
    start_sketch_on_plane(model, "top")
    sketch_circle(model, 0.0, 0.0, mm(14.0))
    end_sketch(model)
    extrude_boss(model, mm(19.0))
    model.ViewZoomtofit2()


def build_mounting_tabs(model):
    log("2/6 Mounting tabs with Ø4 holes, 35 mm spacing")
    if not select_face_by_ray(model, 0.0, 0.0, mm(19.0), 0.0, 0.0, -1.0):
        raise RuntimeError("Cannot select top face for mounting tabs")
    model.SketchManager.InsertSketch(True)
    half_w = mm(3.5)
    inner_x = mm(14.0)
    outer_x = mm(21.0)
    sketch_rectangle(model, inner_x, -half_w, outer_x, half_w)
    sketch_rectangle(model, -outer_x, -half_w, -inner_x, half_w)
    end_sketch(model)
    extrude_boss(model, mm(1.0))

    if not select_face_by_ray(model, mm(17.5), 0.0, mm(20.0), 0.0, 0.0, -1.0):
        select_face_by_ray(model, 0.0, 0.0, mm(20.0), 0.0, 0.0, -1.0)
    model.SketchManager.InsertSketch(True)
    model.SketchManager.CreateCircleByRadius(mm(17.5), 0.0, 0.0, mm(2.0))
    model.SketchManager.CreateCircleByRadius(-mm(17.5), 0.0, 0.0, mm(2.0))
    end_sketch(model)
    cut_through_all(model)


def build_shaft_boss(model):
    log("3/6 Shaft boss Ø9 x 1.5 mm, offset 8 mm")
    if not select_face_by_ray(model, mm(8.0), 0.0, mm(20.0), 0.0, 0.0, -1.0):
        sketch_on_top_face(model, mm(20.0))
    else:
        model.SketchManager.InsertSketch(True)
    sketch_circle(model, mm(8.0), 0.0, mm(4.5))
    end_sketch(model)
    extrude_boss(model, mm(1.5))


def build_main_shaft(model):
    log("4/6 Main shaft Ø5, total height 10 mm from top face")
    if not select_face_by_ray(model, mm(8.0), 0.0, mm(21.5), 0.0, 0.0, -1.0):
        sketch_on_top_face(model, mm(21.5))
    else:
        model.SketchManager.InsertSketch(True)
    sketch_circle(model, mm(8.0), 0.0, mm(2.5))
    end_sketch(model)
    extrude_boss(model, mm(8.5))


def build_shaft_flat(model):
    log("5/6 Shaft D-cut: 3 mm thickness, 6 mm from top")
    start_sketch_on_plane(model, "right")
    flat_y = -mm(1.5)
    z_top = mm(30.0)
    z_flat_bottom = z_top - mm(6.0)
    sketch_rectangle(model, -mm(3.0), z_flat_bottom, flat_y, z_top)
    end_sketch(model)
    cut_through_all(model)


def extrude_boss_both_sides(model, depth):
    model.FeatureManager.FeatureExtrusion2(
        False,
        False,
        False,
        0,
        0,
        depth,
        depth,
        False,
        False,
        False,
        False,
        0.0,
        0.0,
        False,
        False,
        False,
        False,
        True,
        True,
        True,
        0,
        0,
        False,
    )


def build_connector(model):
    log("6/6 Side connector 14.6 mm wide, outer face at 17 mm")
    start_sketch_on_plane(model, "front")
    x_inner = -mm(14.0)
    x_outer = -mm(17.0)
    half_w = mm(7.3)
    sketch_rectangle(model, x_outer, 0.0, x_inner, mm(19.0))
    end_sketch(model)
    extrude_boss_both_sides(model, half_w)

    if select_face_by_ray(model, x_outer, 0.0, mm(17.5), 1.0, 0.0, 0.0):
        model.SketchManager.InsertSketch(True)
        half_slot = mm(3.25)
        z_top = mm(17.5)
        z_bottom = mm(16.0)
        sketch_rectangle(model, -half_slot, z_bottom, half_slot, z_top)
        end_sketch(model)
        extrude_cut(model, mm(1.5))
    else:
        log("WARN: connector slot face not selected, slot skipped")


def save_part(model):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    try:
        if os.path.exists(OUTPUT_FILE):
            os.remove(OUTPUT_FILE)
    except OSError:
        pass
    model.SaveAs3(OUTPUT_FILE, 0, 0)
    if not os.path.exists(OUTPUT_FILE):
        raise RuntimeError("SaveAs failed: {0}".format(OUTPUT_FILE))
    log("Saved: {0}".format(OUTPUT_FILE))


def main():
    configure_stdio()
    log("=" * 60)
    log("Building motor part from 电机/马达.png")
    log("=" * 60)

    sw = connect_solidworks()
    sw.Visible = True

    template = get_part_template(sw)
    log("Template: {0}".format(template))

    sw.NewDocument(template, 0, 0.0, 0.0)
    model = sw.ActiveDoc
    if model is None:
        raise RuntimeError("Failed to create new part document")

    try:
        build_main_body(model)
        build_mounting_tabs(model)
        build_shaft_boss(model)
        build_main_shaft(model)
        build_shaft_flat(model)
        build_connector(model)
        model.ViewZoomtofit2()
        save_part(model)
    except Exception:
        traceback.print_exc()
        log("Model left open in SolidWorks for inspection.")
        return 1

    log("-" * 60)
    log("DONE: Motor part created successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
