import bpy, math, random, json, os
from mathutils import Vector
ROOT='/Users/tt/code/other/danzhu/.worktrees/initial'
rng=random.Random(260908)
scene=bpy.data.scenes.new('Danzhu_Refined_Courtyard')
bpy.context.window.scene=scene
scene.unit_settings.system='METRIC'
ENV=bpy.data.collections.new('Courtyard_Environment'); scene.collection.children.link(ENV)
COURT=bpy.data.collections.new('Physical_Court'); scene.collection.children.link(COURT)

def material(name,color,rough=.8,metal=0):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'); p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 return m
mats={
 'soil':material('Compacted warm earth',(.39,.29,.18)),
 'wood':material('Oiled cedar',(.24,.145,.08)),
 'wood2':material('Cedar warm grain',(.32,.20,.11)),
 'edge':material('Dark stained wood',(.075,.085,.067)),
 'wall':material('Warm lime plaster',(.53,.51,.43)),
 'stone':material('Weathered garden granite',(.32,.35,.32)),
 'cushion':material('Woven charcoal cushions',(.105,.14,.135)),
 'pot':material('Charcoal ceramic',(.06,.073,.065),.42),
 'leaf':material('Leaf forest',(.075,.17,.055)),
 'leaf2':material('Leaf sunlit',(.20,.29,.09)),
 'leaf3':material('Leaf new growth',(.29,.37,.14)),
 'trunk':material('Tree bark',(.16,.12,.065)),
 'glass':material('Smoky reflective glass',(.16,.23,.20),.16,.5),
}
def move_collection(obj,col=ENV):
 for c in list(obj.users_collection): c.objects.unlink(obj)
 col.objects.link(obj)
 return obj

def cube(name,pos,size,mat,bevel=0):
 # Coordinates are game x,y-up,z, converted to Blender x,-z,y.
 bpy.ops.mesh.primitive_cube_add(size=1, location=(pos[0],-pos[2],pos[1]));o=move_collection(bpy.context.object)
 o.name=name;o.dimensions=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.data.materials.append(mats[mat])
 if bevel:
  mod=o.modifiers.new('Soft crafted edges','BEVEL');mod.width=bevel;mod.segments=2
  bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o

def ico(name,pos,scale,mat,sub=1):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=(pos[0],-pos[2],pos[1]));o=move_collection(bpy.context.object);o.name=name;o.scale=(scale[0],scale[2],scale[1]);o.data.materials.append(mats[mat]);return o

def cylinder(name,a,b,r1,r2,mat,verts=8):
 va=Vector((a[0],-a[2],a[1]));vb=Vector((b[0],-b[2],b[1]));d=vb-va
 bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=r1,radius2=r2,depth=d.length,location=(va+vb)/2)
 o=move_collection(bpy.context.object);o.name=name;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.data.materials.append(mats[mat]);return o
N=192;extent=1.72

def fade(v):
 t=max(0,min(1,(1.35-abs(v))/.35));return t*t*(3-2*t)

def base(x,z):
 def hill(cx,cz):return math.exp(-((x-cx)**2/.18+(z-cz)**2/.27))
 return .018+fade(x)*fade(z)*.14*(hill(.52,-.48)+hill(-.52,.48))

def detail(x,z):
 f=fade(x)*fade(z)
 # A shallow meandering drainage groove and two branching fissures, all actual mesh relief.
 path=-.22+.17*math.sin(z*3.3)
 groove=-.016*math.exp(-((x-path)/.044)**2)*math.exp(-((z+.12)/.84)**6)
 branch=-.009*math.exp(-((z-(.23+.38*x+.04*math.sin(11*x)))/.025)**2)*math.exp(-((x+.30)/.55)**6)
 crack=-.007*math.exp(-((z-(-.72+.1*math.sin(x*8)))/.023)**2)*math.exp(-((x-.10)/.60)**6)
 # 1–3mm compacted coarse grains: geometric bumps rather than a normal map.
 grain=.0022*(.5+.5*math.sin(x*127+math.sin(z*47)))*(.5+.5*math.cos(z*113-x*17))
 return f*(groove+branch+crack+grain)
heights=[];vertices=[];faces=[];colors=[]
for iz in range(N+1):
 z=-extent+iz*extent*2/N
 for ix in range(N+1):
  x=-extent+ix*extent*2/N;y=round(base(x,z)+detail(x,z),7);heights.append(y);vertices.append((x,-z,y))
  rel=detail(x,z);tone=max(.52,min(1.12,.90+rel*14+(y-.018)*.65))
  colors.append((.49*tone,.37*tone,.235*tone,1))
for iz in range(N):
 for ix in range(N):
  a=iz*(N+1)+ix;b=a+1;c=a+N+1;d=c+1;faces.extend([(a,c,b),(b,c,d)])
mesh=bpy.data.meshes.new('Shared_Physical_Earth');mesh.from_pydata(vertices,[],faces);mesh.update()
obj=bpy.data.objects.new('COURT_exact_collision_surface',mesh);COURT.objects.link(obj);mesh.materials.append(mats['soil'])
for p in mesh.polygons:p.use_smooth=True
attr=mesh.color_attributes.new(name='COLOR_0',type='FLOAT_COLOR',domain='POINT')
for i,c in enumerate(colors):attr.data[i].color=c
# The shared stone mesh is convex; all rendered stones use these same exported vertices.
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1);proto=move_collection(bpy.context.object,COURT)
stone_vertices=[[round(v.co.x,7),round(v.co.z,7),round(-v.co.y,7)] for v in proto.data.vertices]
stone_indices=[i for p in proto.data.polygons for i in p.vertices]
rocks=[dict(x=-.68,z=-.26,radius=.12,height=.135),dict(x=.68,z=.26,radius=.12,height=.135),dict(x=-.31,z=.88,radius=.075,height=.075),dict(x=.31,z=-.88,radius=.075,height=.075)]
for i in range(36):
 x=rng.uniform(-1.23,1.23);z=rng.uniform(-1.2,1.12)
 if abs(x)<.30 and abs(z)<.25:continue
 r=rng.uniform(.015,.031);rocks.append(dict(x=round(x,5),z=round(z,5),radius=round(r,5),height=round(r*rng.uniform(.5,.95),5)))
for i,r in enumerate(rocks):
 o=bpy.data.objects.new('COLLIDER_stone_%02d'%i,proto.data.copy());COURT.objects.link(o);o.location=(r['x'],-r['z'],base(r['x'],r['z'])+detail(r['x'],r['z']));o.scale=(r['radius'],r['radius'],r['height']);o.data.materials.clear();o.data.materials.append(mats['stone'])
bpy.data.objects.remove(proto,do_unlink=True)
data=dict(version='courtyard-blender-1',segments=N,extent=extent,heights=heights,colors=colors,stoneVertices=stone_vertices,stoneIndices=stone_indices,rocks=rocks,features=dict(groove=dict(x=-.22,z=0,depth=.016,width=.088),grainAmplitude=.0022))
with open(ROOT+'/src/shared/generated/court.json','w') as f:json.dump(data,f,separators=(',',':'))
print('Physical court:',len(vertices),'vertices',len(faces),'triangles',len(rocks),'stones')
