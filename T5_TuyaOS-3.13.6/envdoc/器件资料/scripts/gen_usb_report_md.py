#!/usr/bin/env python3
"""Generate USB detail markdown section from usb_trace_analysis.json."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ANALYSIS = ROOT / "usb_trace_analysis.json"
EXPORT = ROOT / "usb_segments_export.json"


def fmt_conn(p):
    if not p:
        return "（未匹配到焊盘，可能为过孔/扇出点）"
    return f"{p.get('des','?')}.{p.get('pad','?')} (net:{p.get('net','')}, 距端点{p.get('dist','?')}mil)"


def main():
    a = json.loads(ANALYSIS.read_text(encoding="utf-8"))
    exp = json.loads(EXPORT.read_text(encoding="utf-8-sig"))
    segs = exp["segments"]

    lines = []
    lines.append("## USB 走线明细（按线宽分类）\n")
    lines.append("> 差分线距测量：USB_DP 与 USB_DN 平行段 **中心距约 12.7 mil**，线宽 5.7 mil → **线隙（边到边）约 7.0 mil**。\n")
    lines.append("> 差分阻抗目标：**90 Ω ±10%**（USB 2.0）。下表阻抗为按六层叠层（1.6 mm、εr≈4.2）的**工程估算**，**下单前必须用 [嘉立创阻抗神器](https://www.jlc.com/portal/server_guide_37381.html) 按实际叠层编号复核**。\n")

    # --- width 5.7 ---
    lines.append("### 线宽 5.7 mil — 差分信号（USB / 4G / U_DP/DN）\n")
    lines.append("| 网络 | 合并路径 | 所在层 | 线宽(mil) | 线隙估(mil) | 长度(mil) | 长度(mm) | 起点→终点(器件) | Zdiff估算(Ω) | 达标? |")
    lines.append("|------|----------|--------|-----------|-------------|-----------|----------|-----------------|-------------|-------|")
    for net, chains in sorted(a["chains_by_net"].items()):
        if net == "USB_VBUS":
            continue
        for i, c in enumerate(chains, 1):
            imp = c.get("impedance", {})
            z = imp.get("z_diff_ohm_est", "—")
            ok = "✓" if isinstance(z, (int, float)) and 81 <= z <= 99 else ("⚠" if isinstance(z, (int, float)) else "—")
            fr = fmt_conn(c.get("from"))
            to = fmt_conn(c.get("to"))
            path = f"路径{i}" if len(chains) > 1 else "全程"
            lines.append(
                f"| {net} | {path} ({c['segment_count']}段) | {c['layer_label']} | {c['width_mil']} | 7.0 | {c['length_mil']} | {c['length_mm']} | {fr} → {to} | {z} | {ok} |"
            )
    lines.append("")

    # segment-level for 5.7 - optional appendix
    lines.append("<details><summary>5.7 mil 逐段明细（117段中的差分段，点击展开）</summary>\n")
    lines.append("| 网络 | 层 | 线宽 | 长度(mil) | 起点坐标 | 终点坐标 | 起点器件 | 终点器件 | segment_id |")
    lines.append("|------|-----|------|-----------|----------|----------|----------|----------|------------|")
    for s in sorted(segs, key=lambda x: (x["net"], -x["length_mil"])):
        if round(s["width_mil"], 1) != 5.7:
            continue
        fr = fmt_conn(s.get("from"))
        to = fmt_conn(s.get("to"))
        st = f"({s['start']['x']}, {s['start']['y']})"
        en = f"({s['end']['x']}, {s['end']['y']})"
        lines.append(
            f"| {s['net']} | {s.get('layerName', s['layer'])} | {s['width_mil']} | {s['length_mil']} | {st} | {en} | {fr} | {to} | `{s['id'][:12]}…` |"
        )
    lines.append("\n</details>\n")

    # --- width 7 ---
    lines.append("### 线宽 7.0 mil — USB_VBUS（电源）\n")
    lines.append("| 网络 | 层 | 线宽(mil) | 长度(mil) | 长度(mm) | 起点坐标 | 终点坐标 | 起点器件 | 终点器件 |")
    lines.append("|------|-----|-----------|-----------|----------|----------|----------|----------|----------|")
    for s in sorted(segs, key=lambda x: -x["length_mil"]):
        if round(s["width_mil"], 1) != 7.0:
            continue
        fr, to = fmt_conn(s.get("from")), fmt_conn(s.get("to"))
        lines.append(
            f"| {s['net']} | {s.get('layerName', s['layer'])} | {s['width_mil']} | {s['length_mil']} | {s['length_mm']} | ({s['start']['x']},{s['start']['y']}) | ({s['end']['x']},{s['end']['y']}) | {fr} | {to} |"
        )
    lines.append("\n> **注意**：7 mil 的 VBUS 有 **349 mil** 走在 **L3 内层(SIG)**，电源走内层信号层会导致 SI/PI 与叠层意图不一致，建议改到 L4(PWR) 或顶层铺铜。\n")

    # --- width 5 ---
    lines.append("### 线宽 5.0 mil — USB_VBUS（电源）\n")
    lines.append("| 网络 | 层 | 线宽(mil) | 长度(mil) | 起点器件 | 终点器件 |")
    lines.append("|------|-----|-----------|-----------|----------|----------|")
    for s in segs:
        if round(s["width_mil"], 1) != 5.0:
            continue
        lines.append(
            f"| {s['net']} | {s.get('layerName', s['layer'])} | {s['width_mil']} | {s['length_mil']} | {fmt_conn(s.get('from'))} | {fmt_conn(s.get('to'))} |"
        )
    lines.append("")

    # impedance summary
    lines.append("### 阻抗估算汇总（5.7 mil 差分，线隙 7 mil）\n")
    lines.append("| 所在层 | 阻抗模型 | 参考平面 | Zdiff估算(Ω) | 相对90Ω |")
    lines.append("|--------|----------|----------|-------------|---------|")
    models = {}
    for net, chains in a["chains_by_net"].items():
        if net == "USB_VBUS":
            continue
        for c in chains:
            imp = c.get("impedance", {})
            key = (c["layer_label"], imp.get("model", ""))
            if key not in models and imp.get("z_diff_ohm_est"):
                models[key] = imp
    for (layer, model), imp in sorted(models.items()):
        z = imp["z_diff_ohm_est"]
        rel = f"{z - 90:+.1f}" if z else "—"
        lines.append(f"| {layer} | {model} | {imp.get('reference_plane','')} | {z} | {rel} |")

    out = ROOT / "_usb_detail_section.md"
    out.write_text("\n".join(lines), encoding="utf-8")
    print("ok", out)


if __name__ == "__main__":
    main()
