# Preserve editable source. Merge only disposable export copies by material to reduce draw calls.
for existing in list(scene.objects):
 if existing.type in {'LIGHT','CAMERA'} and existing.name.startswith(('Warm afternoon sun','Game perspective')):
  bpy.data.objects.remove(existing,do_unlink=True)
scene.render.engine='CYCLES';scene.cycles.samples=24
scene.world=bpy.data.worlds.new('Courtyard daylight');scene.world.use_nodes=True
bg=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs['Color'].default_value=(.70,.77,.86,1);bg.inputs['Strength'].default_value=.45
ld=bpy.data.lights.new('Warm afternoon sun','SUN');ld.energy=2.4;ld.angle=.06
lo=bpy.data.objects.new('Warm afternoon sun',ld);scene.collection.objects.link(lo);lo.rotation_euler=(.52,-.45,-.55)
cam_data=bpy.data.cameras.new('Game perspective');cam=bpy.data.objects.new('Game perspective',cam_data);scene.collection.objects.link(cam)
cam.location=(0,-3.1,5.1);cam.rotation_euler=(Vector((0,0,.05))-cam.location).to_track_quat('-Z','Y').to_euler();cam_data.lens=38;scene.camera=cam
scene.render.resolution_x=1440;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/assets/blender/refined-courtyard.blend',compress=True)
export_col=bpy.data.collections.new('Export_Temporary');scene.collection.children.link(export_col)
groups={}
for source in list(ENV.objects):
 if source.type!='MESH':continue
 o=source.copy();o.data=source.data.copy();export_col.objects.link(o)
 key=o.data.materials[0].name if o.data.materials else 'none';groups.setdefault(key,[]).append(o)
export_objects=[]
for key,objects in groups.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0]
 if len(objects)>1:bpy.ops.object.join()
 obj=objects[0];obj.name='Courtyard_'+key;export_objects.append(obj)
bpy.ops.object.select_all(action='DESELECT')
for o in export_objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=ROOT+'/public/models/refined-courtyard.glb',export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_apply=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in export_objects)
manifest=dict(blender=bpy.app.version_string,addon='blender-mcp 1.6 protocol 5',environmentMeshes=len(export_objects),environmentTriangles=triangles,glbBytes=os.path.getsize(ROOT+'/public/models/refined-courtyard.glb'),courtVertices=len(COURT.objects['COURT_exact_collision_surface'].data.vertices),courtTriangles=len(COURT.objects['COURT_exact_collision_surface'].data.polygons),physicalStones=len(rocks),units='metres',axes='game x,y-up,z; Blender x,-z,y; glTF Y-up',seed=260908)
with open(ROOT+'/assets/blender/manifest.json','w') as f:json.dump(manifest,f,indent=2)
for o in export_objects:bpy.data.objects.remove(o,do_unlink=True)
bpy.data.collections.remove(export_col)
print(json.dumps(manifest))
