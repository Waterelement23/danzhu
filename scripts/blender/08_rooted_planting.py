# Replace independently scattered foliage with plants grown from connected stems.
for o in list(ENV.objects):
 if o.name.startswith(('Foliage merged','Textured trunk','Tree branching','Large ceramic planter','Planter soil','Rooted ','Plant bed','Raised planter')):
  bpy.data.objects.remove(o,do_unlink=True)
prng=random.Random(90833)
leaf_v=[[],[],[]];leaf_f=[[],[],[]]
stem_v=[];stem_f=[]
root_records=[];leaf_count=0

def stem(a,b,r1=.006,r2=.003):
 va=Vector((a[0],-a[2],a[1]));vb=Vector((b[0],-b[2],b[1]));d=(vb-va).normalized()
 side=d.cross(Vector((0,0,1)))
 if side.length<.1:side=d.cross(Vector((0,1,0)))
 side.normalize();up=d.cross(side);offset=len(stem_v)
 for p,r in [(va,r1),(vb,r2)]:
  for k in range(6):stem_v.append(tuple(p+r*(side*math.cos(k*math.tau/6)+up*math.sin(k*math.tau/6))))
 for k in range(6):
  a=offset+k;b=offset+(k+1)%6;c=a+6;dd=b+6;stem_f.extend([(a,b,c),(b,dd,c)])

def shoot(start,end,length=.115):
 global leaf_count
 stem(start,end,.007,.0018)
 d=Vector(end)-Vector(start)
 for k in range(1,7):
  t=k/7;p=Vector(start)+d*t
  for sign in [-1,1]:
   angle=math.atan2(d.z,d.x)+sign*1.1+.16*prng.random()
   direction=(math.cos(angle),prng.uniform(.1,.5),math.sin(angle))
   petiole=Vector(direction).normalized()*.022
   q=p+petiole;stem(p,q,.0018,.0008)
   leaf(q,direction,length*prng.uniform(.7,1.12),length*.24,prng.randrange(3));leaf_count+=1

def bush(x,y,z,r=.22,h=.40):
 root_records.append(dict(x=x,y=y,z=z))
 trunk=(x,y,z);fork=(x+.015,y+h*.28,z-.01);stem(trunk,fork,.018,.010)
 for j in range(12):
  angle=j*2.399+prng.random()*.3;reach=r*prng.uniform(.65,1)
  tip=(x+math.cos(angle)*reach,y+h*prng.uniform(.55,1),z+math.sin(angle)*reach)
  shoot(fork,tip,.085)

def planted_tree(x,y,z,h=1.9,r=.50):
 root_records.append(dict(x=x,y=y,z=z))
 root=(x,y,z);top=(x+.04,y+h*.82,z-.04);stem(root,top,.065,.017)
 for j in range(12):
  t=.38+j*.035;p=Vector(root).lerp(Vector(top),t)
  a=j*2.4;tip=Vector((x+math.cos(a)*r*.74,y+h*(.65+(j%3)*.085),z+math.sin(a)*r*.74))
  stem(p,tip,.019,.005)
  for k in range(4):
   q=p.lerp(tip,.40+k*.18);a2=a+(k%2*2-1)*.7
   end=q+Vector((math.cos(a2)*r*.35,.15+prng.random()*.14,math.sin(a2)*r*.35))
   shoot(q,end,.095)

def round_pot(x,z,r=.25,h=.42):
 # Open tapered wall with inner rim and visible soil; base rests on the deck surface.
 base=.17
 # Hollow lathed vessel: only the rim spans inner and outer walls, so soil is visible.
 pv=[];pf=[];rings=[(r*.72,base),(r,base+h),(r*.90,base+h),(r*.64,base+.035)]
 for radius,y in rings:
  for k in range(40):
   a=k*math.tau/40;pv.append((x+radius*math.cos(a),-z-radius*math.sin(a),y))
 for j in range(3):
  for k in range(40):
   a=j*40+k;b=j*40+(k+1)%40;c=a+40;dd=b+40;pf.extend([(a,b,c),(b,dd,c)])
 pm=bpy.data.meshes.new('Hollow ceramic vessel');pm.from_pydata(pv,[],pf);pm.update()
 po=bpy.data.objects.new('Rooted planter outer',pm);ENV.objects.link(po);pm.materials.append(mats['pot'])
 for poly in pm.polygons:poly.use_smooth=True
 cylinder('Rooted planter soil',(x,base+h-.035,z),(x,base+h-.025,z),r*.90,r*.90,'soil',40)
 bpy.ops.mesh.primitive_torus_add(major_radius=r*.95,minor_radius=.016,major_segments=40,minor_segments=8,location=(x,-z,base+h))
 rim=move_collection(bpy.context.object);rim.name='Rooted planter rolled rim';rim.data.materials.append(mats['pot'])
 return base+h-.025

def trough(x,z,w,d,h=.30,base=.17):
 t=.035
 cube('Raised planter bottom',(x,base+t/2,z),(w,t,d),'wood')
 for sx in [-1,1]:cube('Raised planter side',(x+sx*(w-t)/2,base+h/2,z),(t,h,d),'wood',.006)
 for sz in [-1,1]:cube('Raised planter rail',(x,base+h/2,z+sz*(d-t)/2),(w,h,t),'wood',.006)
 cube('Plant bed in planter',(x,base+h-.05,z),(w-.05,.06,d-.05),'soil')
 return base+h-.02
# Rear soil bed is genuinely on earth, between the playing area and the fence.
for x,z in [(-1.25,-2.28),(0,-2.65),(1.30,-2.45)]:planted_tree(x,-.02,z,1.65 if x else 2.15,.46)
for j in range(10):bush(-1.42+j*.31,-.02,-2.07,.19,.32+prng.random()*.12)
# Deck plants all have containers; roots end in visible planter soil.
for x,z in [(-2.10,-.08),(-2.10,.76),(2.06,-.78),(2.13,-1.44)]:
 y=trough(x,z,.40,.54,.27);bush(x,y,z,.21,.46)
y=trough(0,2.42,2.18,.42,.28,base=.11)
for x in [-.76,-.26,.26,.76]:bush(x,y,2.42,.20,.35)
for x,z,h in [(-2.94,1.95,1.30),(3.38,-1.32,1.75)]:
 y=round_pot(x,z,.27,.45);planted_tree(x,y,z,h,.38)
for x,z in [(3.49,.6),(3.48,1.32)]:
 y=round_pot(x,z,.19,.32);bush(x,y,z,.22,.42)
# Batched stems preserve every physical connection without thousands of draw calls.
mesh=bpy.data.meshes.new('Connected woody stems');mesh.from_pydata(stem_v,[],stem_f);mesh.update()
o=bpy.data.objects.new('Rooted connected stems',mesh);ENV.objects.link(o);mesh.materials.append(mats['trunk'])
for p in mesh.polygons:p.use_smooth=True
for kind in range(3):
 mesh=bpy.data.meshes.new('Attached leaf blades');mesh.from_pydata(leaf_v[kind],[],leaf_f[kind]);mesh.update()
 o=bpy.data.objects.new('Rooted attached leaves %d'%kind,mesh);ENV.objects.link(o);mesh.materials.append(mats[['leaf','leaf2','leaf3'][kind]])
 mesh.materials[0].use_backface_culling=False
# No trimming leaf tips: validate that complete plant geometry stays outside the physical court.
for vs in leaf_v:
 assert all(abs(v[0])>1.72 or abs(v[1])>1.72 for v in vs),'Plant overhang reaches the playable court'
with open(ROOT+'/assets/blender/planting-manifest.json','w') as f:json.dump(dict(roots=root_records,attachedLeaves=leaf_count,stemSegments=len(stem_f)//12,deckPlantsHaveContainers=True),f,indent=2)
print('Connected planting:',leaf_count,'attached leaves;',len(stem_f)//12,'stem segments')
