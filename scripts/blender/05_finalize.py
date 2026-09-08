# Final consistency pass before export. Reproducible after stages 01–03.
def exported_height(x,z):
 gx=max(0,min(N-1e-9,(x+extent)/(2*extent/N)));gz=max(0,min(N-1e-9,(z+extent)/(2*extent/N)))
 ix=int(gx);iz=int(gz);u=gx-ix;v=gz-iz;a=iz*(N+1)+ix;b=a+1;c=a+N+1;d=c+1
 return heights[a]+u*(heights[b]-heights[a])+v*(heights[c]-heights[a]) if u+v<=1 else heights[d]+(1-u)*(heights[c]-heights[d])+(1-v)*(heights[b]-heights[d])
for i,r in enumerate(rocks):
 r['y']=exported_height(r['x'],r['z'])
 COURT.objects['COLLIDER_stone_%02d'%i].location.z=r['y']
with open(ROOT+'/src/shared/generated/court.json','w') as f:json.dump(data,f,separators=(',',':'))
# Match the Blender authoring preview to exported earth vertex colours.
terrain_obj=COURT.objects['COURT_exact_collision_surface']
cm=mats['soil'].copy();cm.name='Physical earth vertex colour';terrain_obj.data.materials.clear();terrain_obj.data.materials.append(cm)
attr_node=cm.node_tree.nodes.new('ShaderNodeVertexColor');attr_node.layer_name='COLOR_0'
shader=next(n for n in cm.node_tree.nodes if n.type=='BSDF_PRINCIPLED');cm.node_tree.links.new(attr_node.outputs['Color'],shader.inputs['Base Color'])
glass=next(n for n in mats['glass'].node_tree.nodes if n.type=='BSDF_PRINCIPLED');glass.inputs['Metallic'].default_value=.12;glass.inputs['Roughness'].default_value=.22
# Discard decorative leaves over the playing square; all visible relief inside it is physical.
import bmesh
removed=0
for o in list(ENV.objects):
 if not o.name.startswith('Foliage merged'):continue
 bm=bmesh.new();bm.from_mesh(o.data)
 overlap_faces=[f for f in bm.faces if any(abs(v.co.x)<1.64 and abs(v.co.y)<1.64 for v in f.verts)]
 removed+=len(overlap_faces);bmesh.ops.delete(bm,geom=overlap_faces,context='FACES');bm.to_mesh(o.data);bm.free()
print('Finalized stone heights and vertex materials; removed border-overlap leaf triangles',removed)
