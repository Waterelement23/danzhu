# Editable glass sphere and a thin flowing cat-eye ribbon, in normalized ball coordinates.
MARBLES=bpy.data.collections.get('Glass_marble_source')
if MARBLES:
 for o in list(MARBLES.objects):bpy.data.objects.remove(o,do_unlink=True)
else:
 MARBLES=bpy.data.collections.new('Glass_marble_source');scene.collection.children.link(MARBLES)
rv=[];ri=[];uv=[]
for j in range(81):
 t=j/80;y=(t-.5)*1.76;angle=-1.4+2.8*t+.22*math.sin(t*math.pi*2)
 width=.57*math.sin(math.pi*t)**.55+.008
 for k in range(17):
  u=k/16;s=(u-.5)*2
  # Slight cupping across the glass ribbon, tapering naturally toward the poles.
  xx=width*s+.12*math.sin(2*math.pi*t);zz=.14*math.sin(math.pi*t)+.09*(s*s-.3)*math.sin(math.pi*t)
  x=xx*math.cos(angle)-zz*math.sin(angle);z=xx*math.sin(angle)+zz*math.cos(angle)
  rv.append([round(x,6),round(y,6),round(z,6)]);uv.append([u,t])
  if j<80 and k<16:
   a=j*17+k;ri.extend([a,a+17,a+1,a+1,a+17,a+18])
mesh=bpy.data.meshes.new('Blown_glass_inner_coloured_ribbon');mesh.from_pydata([(x,-z,y) for x,y,z in rv],[],[ri[i:i+3] for i in range(0,len(ri),3)]);mesh.update()
ribbon=bpy.data.objects.new('Internal flowing ribbon',mesh);MARBLES.objects.link(ribbon)
mat=material('Molten amber ribbon',(.65,.11,.012),.16);mesh.materials.append(mat)
for p in mesh.polygons:p.use_smooth=True
bpy.ops.mesh.primitive_uv_sphere_add(segments=96,ring_count=64,radius=1)
shell=move_collection(bpy.context.object,MARBLES);shell.name='Clear glass shell IOR 1.52'
gm=material('Optical mint glass',(.88,.98,.95),.025)
p=next(n for n in gm.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Transmission Weight'].default_value=1;p.inputs['IOR'].default_value=1.52
shell.data.materials.append(gm)
for p in shell.data.polygons:p.use_smooth=True
# Keep normalized source away from the playable court in the editor, never export as scenery.
for o in MARBLES.objects:o.location=(6,0,1.1);o.hide_render=True
with open(ROOT+'/src/client/generated/marble-ribbon.json','w') as f:json.dump(dict(vertices=rv,indices=ri,uv=uv,sphereSegments=[96,64]),f,separators=(',',':'))
print('Glass source authored',len(rv),'ribbon vertices',len(ri)//3,'triangles')
