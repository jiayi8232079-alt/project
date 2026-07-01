import json,time
from pathlib import Path

def pip(x,y,p):
    ins=False
    n=len(p)
    for i in range(n):
        xi,yi=p[i]; xj,yj=p[(i-1)%n]
        if ((yi>y)!=(yj>y)) and (x<(xj-xi)*(y-yi)/(yj-yi+1e-12)+xi): ins=not ins
    return ins

def pads_ok(nx,ny,rel,p):
    for r in rel:
        px,py=nx+r["dx"],ny+r["dy"]; hx,hy=r["hx"],r["hy"]
        for cx,cy in ((px-hx,py-hy),(px+hx,py-hy),(px+hx,py+hy),(px-hx,py+hy)):
            if not pip(cx,cy,p): return False
    return True

def ovl(nx,ny,bb,rs,g):
    l1,r1,b1,t1=nx+bb["minX"]-g,nx+bb["maxX"]+g,ny+bb["minY"]-g,ny+bb["maxY"]+g
    for q in rs:
        if l1<q["r"] and r1>q["l"] and b1<q["t"] and t1>q["b"]: return True
    return False

base=Path(r"c:/000_OPC/器件资料")
data=json.loads((base/"pcb7_layout_data.json").read_text(encoding="utf-8-sig"))
poly=data["poly"]
comps=sorted(data["components"], key=lambda c:c["bb"]["w"]*c["bb"]["h"])
bx0,bx1=min(a[0] for a in poly),max(a[0] for a in poly)
by0,by1=min(a[1] for a in poly),max(a[1] for a in poly)
GAP,STEP=8,25
tr,tp,tf=[],[],[]
t0=time.time()
for ci,c in enumerate(comps):
    bb=c["bb"]; ok=False
    for y in range(int(by0),int(by1-bb["h"])+1,STEP):
        for x in range(int(bx0),int(bx1-bb["w"])+1,STEP):
            nx,ny=x-bb["minX"],y-bb["minY"]
            if pads_ok(nx,ny,bb["rel"],poly) and not ovl(nx,ny,bb,tr,GAP):
                tp.append({"id":c["id"],"d":c["d"],"nx":round(nx,2),"ny":round(ny,2),"layer":1})
                tr.append({"l":nx+bb["minX"]-GAP,"r":nx+bb["maxX"]+GAP,"b":ny+bb["minY"]-GAP,"t":ny+bb["maxY"]+GAP})
                ok=True; break
        if ok: break
    if not ok: tf.append(c)
    if (ci+1)%50==0: print(f"top {ci+1}/{len(comps)} placed={len(tp)}",flush=True)
print(f"top done {len(tp)} fail {len(tf)}",flush=True)
br,bp=[],[]
for c in tf:
    bb=c["bb"]; ok=False
    for y in range(int(by0),int(by1-bb["h"])+1,STEP):
        for x in range(int(bx0),int(bx1-bb["w"])+1,STEP):
            nx,ny=x-bb["minX"],y-bb["minY"]
            if pads_ok(nx,ny,bb["rel"],poly) and not ovl(nx,ny,bb,br,GAP):
                bp.append({"id":c["id"],"d":c["d"],"nx":round(nx,2),"ny":round(ny,2),"layer":2})
                br.append({"l":nx+bb["minX"]-GAP,"r":nx+bb["maxX"]+GAP,"b":ny+bb["minY"]-GAP,"t":ny+bb["maxY"]+GAP})
                ok=True; break
        if ok: break
pl=tp+bp
(base/"pcb7_placements_u.json").write_text(json.dumps(pl,ensure_ascii=False),encoding="utf-8")
fail=[c["d"] for c in tf if c["id"] not in {x["id"] for x in bp}]
print(f"top={len(tp)} bot={len(bp)} fail={len(fail)} tot={len(pl)} t={time.time()-t0:.1f}s",flush=True)
if fail: print("unplaced:",fail,flush=True)