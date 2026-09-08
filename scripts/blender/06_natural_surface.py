# Replace drawn-looking trenches with weathered compacted earth. No bump/normal maps.
from mathutils import noise
N=256
# Continue the earth colour into the surrounding courtyard, without a rectangular colour seam.
soil_shader=next(n for n in mats['soil'].node_tree.nodes if n.type=='BSDF_PRINCIPLED')
soil_shader.inputs['Base Color'].default_value=(.295,.191,.093,1)
soil_shader.inputs['Roughness'].default_value=1
mats['soil'].diffuse_color=(.295,.191,.093,1)
terrain=COURT.objects['COURT_exact_collision_surface']

def coherent(x,z,scale,seed):
 return noise.noise_vector(Vector((x*scale+seed,z*scale-seed*.71,seed*.37)),noise_basis='PERLIN_ORIGINAL').x

def base(x,z):
 f=fade(x)*fade(z)
 broad=.044*math.exp(-((x-.48)**2/.24+(z+.39)**2/.38))+.059*math.exp(-((x+.61)**2/.32+(z-.42)**2/.22))
 return .018+f*(broad+.011*coherent(x,z,2.7,17)+.004*coherent(x,z,7.1,31))

def components(x,z):
 f=fade(x)*fade(z)
 # Discontinuous worn pockets, with variable width, rather than continuous sinusoidal cracks.
 wear=-.007*f*max(0,coherent(x,z,10.5,57))**2
 # Densely packed, sub-centimetre height variation; all stored in the collision vertices.
 grain=f*(.0018*coherent(x,z,43,83)+.0012*coherent(x,z,71,113))
 return wear,grain

def detail(x,z):return sum(components(x,z))
heights=[];vertices=[];colors=[];faces=[];relief_components={'wear':[],'grain':[]}
for iz in range(N+1):
 z=-extent+iz*2*extent/N
 for ix in range(N+1):
  x=-extent+ix*2*extent/N;wear,grain=components(x,z);y=round(base(x,z)+wear+grain,7)
  heights.append(y);vertices.append((x,-z,y));relief_components['wear'].append(round(wear,7));relief_components['grain'].append(round(grain,7))
  # Mineral colour varies independently of altitude; crevices are not painted dark lines.
  mineral=coherent(x,z,35,223);patch=coherent(x,z,4.3,167);fine=coherent(x,z,88,311)
  tone=1+.13*patch+.16*mineral+.085*fine
  colors.append(tuple(round(c*tone,5) for c in (.295,.191,.093))+(1,))
for iz in range(N):
 for ix in range(N):
  a=iz*(N+1)+ix;b=a+1;c=a+N+1;d=c+1;faces.extend([(a,c,b),(b,c,d)])
old=terrain.data
mesh=bpy.data.meshes.new('Natural_compacted_earth_SHARED_collision');mesh.from_pydata(vertices,[],faces);mesh.update();terrain.data=mesh
for p in mesh.polygons:p.use_smooth=True
attr=mesh.color_attributes.new(name='COLOR_0',type='FLOAT_COLOR',domain='POINT')
for i,c in enumerate(colors):attr.data[i].color=c
if old.users==0:bpy.data.meshes.remove(old)
# Retain existing obstacle positions, adding small, unevenly embedded gravel between them.
for o in list(COURT.objects):
 if o.name.startswith('COLLIDER_stone_') and int(o.name.rsplit('_',1)[1])>=37:bpy.data.objects.remove(o,do_unlink=True)
rocks=rocks[:37]
rr=random.Random(90421)
for i in range(115):
 x=rr.uniform(-1.36,1.36);z=rr.uniform(-1.30,1.23)
 if any(math.hypot(x-r['x'],z-r['z'])<r['radius']+.025 for r in rocks):continue
 r=rr.uniform(.0055,.0125);rocks.append(dict(x=round(x,5),z=round(z,5),radius=round(r,5),height=round(r*rr.uniform(.3,.65),5)))
for i,r in enumerate(rocks):
 key='COLLIDER_stone_%02d'%i
 o=COURT.objects.get(key)
 if not o:
  o=bpy.data.objects.new(key,COURT.objects['COLLIDER_stone_00'].data.copy());COURT.objects.link(o)
 o.location=(r['x'],-r['z'],base(r['x'],r['z'])+detail(r['x'],r['z']));o.scale=(r['radius'],r['radius'],r['height'])
data.update(version='courtyard-natural-2',segments=N,heights=heights,colors=colors,rocks=rocks,features=dict(surface='compacted earth',relief='irregular worn pockets and embedded grains',grainMaxHeight=.003,seed=90421))
with open(ROOT+'/assets/blender/terrain-components.json','w') as f:json.dump(relief_components,f,separators=(',',':'))
print('Natural dirt',len(vertices),'vertices',len(rocks),'physical stones')
