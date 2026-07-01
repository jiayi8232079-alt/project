import json
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

base=Path(r"c:/000_OPC/器件资料")
data=json.loads((base/"pcb7_layout_data.json").read_text(encoding="utf-8-sig"))
poly=data["poly"]
bx0,bx1=min(a[0] for a in poly),max(a[0] for a in poly)
by0,by1=min(a[1] for a in poly),max(a[1] for a in poly)
large=['U4','U41','FPC1','U10','CARD1','U1','U40','U32']
comps={c["d"]:c for c in data["components"]}
placed=[]
out=[]
for idx,des in enumerate(large):
    c=comps[des]; bb=c["bb"]
    y0=int(by0)+(idx*120)
    found=False
    for yo in range(0,int(by1-by0-bb["h"])+1,15):
        y=y0+yo
        if y>int(by1-bb["h"]): y-=int(by1-by0-bb["h"])
        for x in range(int(bx0),int(bx1-bb["w"])+1,15):
            nx,ny=x-bb["minX"],y-bb["minY"]
            if pads_ok(nx,ny,bb["rel"],poly):
                out.append({"id":c["id"],"d":des,"nx":round(nx,2),"ny":round(ny,2),"layer":2})
                found=True; break
        if found: break
    print(des, "OK" if found else "FAIL")
(base/"pcb7_large.json").write_text(json.dumps(out),encoding="utf-8")