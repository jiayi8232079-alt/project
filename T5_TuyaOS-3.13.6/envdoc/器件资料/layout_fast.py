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

def run(poly,comps,gap=10,step=30):
    p=poly[::4]
    if p[-1]!=poly[-1]: p.append(poly[-1])
    bx0,bx1=min(a[0] for a in p),max(a[0] for a in p)
    by0,by1=min(a[1] for a in p),max(a[1] for a in p)
    slots=[(x,y) for y in range(int(by0),int(by1)+1,step) for x in range(int(bx0),int(bx1)+1,step) if pip(x,y,p)]
    print("slots",len(slots),"poly",len(p),flush=True)
    cs=sorted(comps,key=lambda c:c["bb"]["w"]*c["bb"]["h"],reverse=True)
    tr,tp,tf=[],[],[]
    for c in cs:
        bb=c["bb"]; ok=False
        for ax,ay in slots:
            nx,ny=ax-bb["minX"],ay-bb["minY"]
            if pads_ok(nx,ny,bb["rel"],p) and not ovl(nx,ny,bb,tr,gap):
                tp.append({"id":c["id"],"d":c["d"],"nx":round(nx,2),"ny":round(ny,2),"layer":1})
                tr.append({"l":nx+bb["minX"]-gap,"r":nx+bb["maxX"]+gap,"b":ny+bb["minY"]-gap,"t":ny+bb["maxY"]+gap})
                ok=True; break
        if not ok: tf.append(c)
    print("top",len(tp),"fail",len(tf),flush=True)
    br,bp=[],[]
    n=len(tf)
    for i,c in enumerate(tf):
        bb=c["bb"]; ok=False
        stride=max(1,len(slots)//max(n,1))
        for j in range(0,len(slots),stride):
            ax,ay=slots[j]
            nx,ny=ax-bb["minX"],ay-bb["minY"]
            if pads_ok(nx,ny,bb["rel"],p) and not ovl(nx,ny,bb,br,gap):
                bp.append({"id":c["id"],"d":c["d"],"nx":round(nx,2),"ny":round(ny,2),"layer":2})
                br.append({"l":nx+bb["minX"]-gap,"r":nx+bb["maxX"]+gap,"b":ny+bb["minY"]-gap,"t":ny+bb["maxY"]+gap})
                ok=True; break
        if not ok:
            for y in range(int(by0),int(by1-bb["h"])+1,step):
                for x in range(int(bx0),int(bx1-bb["w"])+1,step):
                    nx,ny=x-bb["minX"],y-bb["minY"]
                    if pads_ok(nx,ny,bb["rel"],p) and not ovl(nx,ny,bb,br,gap):
                        bp.append({"id":c["id"],"d":c["d"],"nx":round(nx,2),"ny":round(ny,2),"layer":2})
                        br.append({"l":nx+bb["minX"]-gap,"r":nx+bb["maxX"]+gap,"b":ny+bb["minY"]-gap,"t":ny+bb["maxY"]+gap})
                        ok=True; break
                if ok: break
    fail=[c for c in tf if c["id"] not in {x["id"] for x in bp}]
    return tp+bp,len(tp),len(bp),fail

base=Path(r"c:/000_OPC/器件资料")
data=json.loads((base/"pcb7_layout_data.json").read_text(encoding="utf-8-sig"))
t0=time.time()
pl,tn,bn,fail=run(data["poly"],data["components"])
(base/"pcb7_placements_u.json").write_text(json.dumps(pl,ensure_ascii=False),encoding="utf-8")
print(f"top={tn} bot={bn} fail={len(fail)} tot={len(pl)} t={time.time()-t0:.1f}s",flush=True)
if fail: print([c["d"] for c in fail[:25]],flush=True)