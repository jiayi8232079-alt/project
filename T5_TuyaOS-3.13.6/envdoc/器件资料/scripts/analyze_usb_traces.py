#!/usr/bin/env python3
"""Analyze USB trace segments from exported JSON."""
import json
import math
from collections import defaultdict
from pathlib import Path

INPUT = Path(__file__).resolve().parents[1] / "usb_segments_export.json"
OUT = Path(__file__).resolve().parents[1] / "usb_trace_analysis.json"

# User 6-layer stack (top to bottom)
STACK_6L = [
    {"eda_layer": 1, "name": "L1", "role": "顶层 · 器件"},
    {"eda_layer": 15, "name": "L2", "role": "内层1 · GND"},
    {"eda_layer": 16, "name": "L3", "role": "内层2 · SIG"},
    {"eda_layer": 17, "name": "L4", "role": "内层3 · PWR"},  # INNER_3 typical
    {"eda_layer": 18, "name": "L5", "role": "内层4 · GND"},  # INNER_4 typical
    {"eda_layer": 2, "name": "L6", "role": "底层 · 器件"},
]

# Observed routing layers in PCB8 data
EDA_LAYER_LABEL = {
    1: "L1 顶层(器件)",
    2: "L6 底层(器件)",  # EPCB_LayerId.BOTTOM = 2
    16: "L3 内层2(SIG)",  # INNER_2 = 16 — user maps SIG here
    15: "L2 内层1(GND)",
}


def layer_label(layer_id: int) -> str:
    return EDA_LAYER_LABEL.get(layer_id, f"EDA层{layer_id}")


def pt(p):
    if isinstance(p, dict):
        return round(float(p["x"]), 1), round(float(p["y"]), 1)
    return round(float(p[0]), 1), round(float(p[1]), 1)


def endpoint(s):
    return pt(s["start"]), pt(s["end"])


def merge_chains(segments, tol=1.0):
    segs = [dict(s) for s in segments]
    chains = []
    while segs:
        chain = [segs.pop(0)]
        changed = True
        while changed:
            changed = False
            for i, s in enumerate(segs):
                c_s0, c_s1 = endpoint(chain[0])
                c_e0, c_e1 = endpoint(chain[-1])
                s_start, s_end = endpoint(s)
                for attach_to_end, ce in ((True, c_e1), (False, c_s0)):
                    for flip, se in ((False, s_start), (True, s_end)):
                        if math.hypot(ce[0] - se[0], ce[1] - se[1]) > tol:
                            continue
                        seg = s
                        if flip:
                            seg = {
                                **s,
                                "start": s["end"],
                                "end": s["start"],
                                "from": s.get("to"),
                                "to": s.get("from"),
                            }
                        if attach_to_end:
                            chain.append(seg)
                        else:
                            chain.insert(0, seg)
                        segs.pop(i)
                        changed = True
                        break
                    if changed:
                        break
                if changed:
                    break
        total_len = sum(x.get("length_mil", x.get("lenMil", 0)) for x in chain)
        chains.append(
            {
                "segment_count": len(chain),
                "length_mil": round(total_len, 2),
                "length_mm": round(total_len * 0.0254, 2),
                "layer": chain[0]["layer"],
                "layer_label": chain[0].get("layerName") or layer_label(chain[0]["layer"]),
                "width_mil": chain[0].get("width_mil", chain[0].get("w")),
                "from": chain[0].get("from"),
                "to": chain[-1].get("to"),
                "start": chain[0]["start"],
                "end": chain[-1]["end"],
                "segment_ids": [x["id"] for x in chain],
            }
        )
    chains.sort(key=lambda c: -c["length_mil"])
    return chains


def calc_diff_impedance_mil(w_mil: float, spacing_mil: float, layer_id: int) -> dict:
    """
    Approximate USB 2.0 differential impedance (Ω) for 1.6mm 6-layer JLC-like stack.
    Reference: outer microstrip (L1 ref L2 GND) or inner stripline (L3 ref L2+L5 GND).
    Uses simplified coupled microstrip / stripline formulas; NOT a substitute for 嘉立创阻抗神器.
    """
    w = w_mil * 0.0254  # mm
    s = spacing_mil * 0.0254
    er = 4.2  # NP-155F typical

    if layer_id == 1:
        # L1 microstrip, H ~ 0.2mm to L2 GND (typical 6L 1.6mm prepreg)
        h = 0.20
        # Single-ended Zo (Hammerstad microstrip)
        u = w / h
        if u <= 1:
            z0 = (60 / math.sqrt(er + 1.41)) * math.log(8 * h / w + w / (4 * h))
        else:
            z0 = (120 * math.pi) / (math.sqrt(er + 1.41) * (u + 1.393 + 0.667 * math.log(u + 1.444)))
        # Differential ~ 2*Zo*(1 - 0.48*exp(-0.96*s/h)) for loose coupling approx
        zdiff = 2 * z0 * (1 - 0.48 * math.exp(-0.96 * (s / h if h else 0)))
        ref = "L2 GND"
        model = "顶层微带线 (L1→L2)"
    elif layer_id in (16, 15):
        h = 0.18
        u = w / h
        z0 = (80 / math.sqrt(er + 1.41)) * math.log(1.9 * (2 * h + w) / (0.8 * w + h)) if u < 2 else 50
        zdiff = 2 * z0 * 0.82
        ref = "L2+L5 GND (带状线近似)"
        model = "内层带状线 (L3 SIG)"
    elif layer_id == 2:
        h = 0.20
        u = w / h
        z0 = (60 / math.sqrt(er + 1.41)) * math.log(8 * h / w + w / (4 * h)) if u <= 1 else 55
        zdiff = 2 * z0 * 0.85
        ref = "L5 GND"
        model = "底层微带线 (L6→L5)"
    else:
        zdiff = None
        ref = "未知"
        model = "未建模"

    return {
        "model": model,
        "reference_plane": ref,
        "assumed_spacing_mil": spacing_mil,
        "z_diff_ohm_est": round(zdiff, 1) if zdiff else None,
        "target_ohm": 90,
        "note": "估算值，下单前须用嘉立创阻抗神器按选定叠层编号复核",
    }


def main():
    raw = json.loads(INPUT.read_text(encoding="utf-8-sig"))
    segs = raw["segments"] if isinstance(raw, dict) and "segments" in raw else raw
    for s in segs:
        if "length_mil" not in s and "lenMil" in s:
            s["length_mil"] = s["lenMil"]
        if "width_mil" not in s and "w" in s:
            s["width_mil"] = s["w"]

    by_width = defaultdict(lambda: defaultdict(list))
    for s in segs:
        w = s.get("width_mil", s.get("w", 0))
        by_width[round(w, 2)][s["net"]].append(s)

    width_summary = {}
    for w in sorted(by_width.keys()):
        width_summary[str(w)] = {}
        for net, lst in sorted(by_width[w].items()):
            layers = defaultdict(float)
            for x in lst:
                layers[layer_label(x["layer"])] += x.get("length_mil", x.get("lenMil", 0))
            width_summary[str(w)][net] = {
                "segment_count": len(lst),
                "total_length_mil": round(sum(x.get("length_mil", x.get("lenMil", 0)) for x in lst), 2),
                "total_length_mm": round(sum(x.get("length_mil", x.get("lenMil", 0)) for x in lst) * 0.0254, 2),
                "length_by_layer": dict(layers),
            }

    # USB_DP/DN parallel pairs measured ~12.7 mil center-to-center on PCB8
    # edge gap ≈ center - width = 12.7 - 5.7 ≈ 7.0 mil
    spacing_assume = 7.0

    chains_by_net = {}
    for w, nets in by_width.items():
        if w not in (5.7, 5, 7):
            continue
        for net, lst in nets.items():
            chains = merge_chains(lst)
            for c in chains:
                if w == 5.7 and "DP" in net or "DM" in net or "DN" in net:
                    c["impedance"] = calc_diff_impedance_mil(c["width_mil"], spacing_assume, c["layer"])
                elif net == "USB_VBUS":
                    c["impedance"] = {
                        "model": "单端电源",
                        "note": "VBUS 非差分 90Ω 目标",
                    }
            chains_by_net[net] = chains

    # All individual segments for VBUS (few segments)
    vbus_detail = [s for s in segs if s["net"] == "USB_VBUS"]

    out = {
        "stack_6layer_user": STACK_6L,
        "eda_layer_mapping_note": "走线数据中 layer=1 顶层, layer=2 底层(BOTTOM), layer=16 内层2(INNER_2/SIG)",
        "width_summary": width_summary,
        "chains_by_net": chains_by_net,
        "vbus_segments": vbus_detail,
        "spacing_assumption_mil": spacing_assume,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT}")
    print(json.dumps(width_summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
