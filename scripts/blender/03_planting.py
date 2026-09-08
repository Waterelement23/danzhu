# Leaves are merged meshes with thousands of shaped leaf blades rather than cone placeholders.
leaf_v=[[],[],[]];leaf_f=[[],[],[]]
def leaf(center,direction,length,width,kind):
 c=Vector((center[0],-center[2],center[1]));d=Vector((direction[0],-direction[2],direction[1])).normalized()
 side=d.cross(Vector((0,0,1)))
 if side.length<.1:side=d.cross(Vector((0,1,0)))
 side.normalize();tip=c+d*length;middle=c+d*length*.45
 pts=[c,middle+side*width,tip,middle-side*width,middle+Vector((0,0,width*.2))]
 v=leaf_v[kind];f=leaf_f[kind];a=len(v);v.extend([tuple(p) for p in pts]);f.extend([(a,a+1,a+4),(a+1,a+2,a+4),(a+2,a+3,a+4),(a+3,a,a+4)])

def shrub(x,z,r=.30,h=.35):
 for i in range(100):
  ang=rng.random()*math.tau;rad=math.sqrt(rng.random())*r
  px=x+math.cos(ang)*rad;pz=z+math.sin(ang)*rad;py=.05+h*(1-(rad/r)**2)*rng.uniform(.5,1)
  leaf((px,py,pz),(math.cos(ang),rng.uniform(.1,.8),math.sin(ang)),rng.uniform(.07,.14),rng.uniform(.018,.042),rng.randrange(3))

def tree(x,z,h,r):
 cylinder('Textured trunk',(x,.02,z),(x+.07,h*.74,z-.05),.065,.033,'trunk',12)
 for j in range(9):
  ang=j*2.4;end=(x+math.cos(ang)*r*.8,h*.65+(j%3)*h*.10,z+math.sin(ang)*r*.8)
  cylinder('Tree branching',(x+.03,h*.42,z),end,.024,.008,'trunk',7)
 for i in range(760):
  a=rng.random()*math.tau;rr=math.sqrt(rng.random())*r
  py=h*.65+h*.25*(1-(rr/r)**2)+rng.uniform(-.18,.15)
  px=x+math.cos(a)*rr;pz=z+math.sin(a)*rr
  leaf((px,py,pz),(math.cos(a),rng.uniform(-.2,.8),math.sin(a)),rng.uniform(.07,.145),rng.uniform(.025,.05),rng.randrange(3))
for x,z,h,r in [(-1.7,-2.15,1.9,.60),(.0,-2.62,2.3,.72),(1.80,-2.55,2.1,.67),(3.65,-1.6,2.45,.85),(-3.75,1.5,1.7,.60)]:tree(x,z,h,r)
# An irregular planted border hugs the rear and deck edges, clear of the playable square.
for i in range(15):shrub(-1.6+i*.23,-1.95-.15*math.sin(i*1.8),.25+rng.random()*.09,.25+rng.random()*.25)
for x,z in [(-1.89,.0),(-1.87,.53),(-1.95,1.12),(1.91,-.78),(1.94,-1.24),(3.78,.44),(3.72,1.24),(-.65,2.16),(.20,2.24),(1.0,2.15)]:shrub(x,z,.29,.45)
for x,z in [(-2.9,1.7),(3.05,-1.25)]:
 cylinder('Large ceramic planter',(x,.16,z),(x,.57,z),.16,.23,'pot',32)
 cylinder('Planter soil',(x,.555,z),(x,.561,z),.21,.21,'soil',32)
 for j in range(110):
  ang=rng.random()*math.tau
  leaf((x+math.cos(ang)*.10,.60+rng.random()*.25,z+math.sin(ang)*.10),(math.cos(ang),.7,math.sin(ang)),.20,.04,rng.randrange(3))
for kind in range(3):
 mesh=bpy.data.meshes.new('Leaf blades %d'%kind);mesh.from_pydata(leaf_v[kind],[],leaf_f[kind]);mesh.update()
 obj=bpy.data.objects.new('Foliage merged %d'%kind,mesh);ENV.objects.link(obj);mesh.materials.append(mats[['leaf','leaf2','leaf3'][kind]])
 # Double-sided thin leaves export correctly with shared world-space lighting.
 mesh.materials[0].use_backface_culling=False
print('Planting complete; leaf triangles',sum(len(f) for f in leaf_f))
