# Stuffed cloth consists of two inflated sewn panels, not a bevelled solid block.
for o in list(ENV.objects):
 if o.name.startswith(('Seat cushion','Back cushion','Loose linen pillow','Soft ','Sewn ')):
  bpy.data.objects.remove(o,do_unlink=True)
cloth=material('Woven sage upholstery',(.15,.21,.19),.92)
linen=material('Woven oat pillow',(.46,.40,.29),.91)
piping=material('Upholstery seam cord',(.09,.135,.12),.9)
# Tileable normal + roughness maps describe alternating warp and weft yarns.
S=256
normal_pixels=[];rough_pixels=[]
def yarn(i,j):
 x=(i%S)/16;y=(j%S)/16;ix=math.floor(x);iy=math.floor(y);fx=x-ix;fy=y-iy
 warp=(ix+iy)%2==0
 across=fx if warp else fy;along=fy if warp else fx
 return .35*math.sin(math.pi*across)**2*(.65+.35*math.sin(math.pi*along)**2)
for j in range(S):
 for i in range(S):
  dx=(yarn(i+1,j)-yarn(i-1,j))*1.7;dy=(yarn(i,j+1)-yarn(i,j-1))*1.7
  n=Vector((-dx,-dy,1)).normalized();normal_pixels.extend((n.x*.5+.5,n.y*.5+.5,n.z*.5+.5,1))
  r=.80+.14*(1-yarn(i,j));rough_pixels.extend((r,r,r,1))
def texture_image(name,pixels):
 old=bpy.data.images.get(name)
 if old:bpy.data.images.remove(old)
 im=bpy.data.images.new(name,width=S,height=S,alpha=True);im.colorspace_settings.name='Non-Color';im.pixels.foreach_set(pixels);im.pack();return im
normal_image=texture_image('Linen warp weft normal',normal_pixels)
rough_image=texture_image('Linen yarn roughness',rough_pixels)
for m in [cloth,linen]:
 p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Sheen Weight'].default_value=.28;p.inputs['Sheen Roughness'].default_value=.8;p.inputs['Sheen Tint'].default_value=(.25,.30,.27,1)
 nt=m.node_tree.nodes.new('ShaderNodeTexImage');nt.image=normal_image
 nm=m.node_tree.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.7
 m.node_tree.links.new(nt.outputs['Color'],nm.inputs['Color']);m.node_tree.links.new(nm.outputs['Normal'],p.inputs['Normal'])
 rt=m.node_tree.nodes.new('ShaderNodeTexImage');rt.image=rough_image;m.node_tree.links.new(rt.outputs['Color'],p.inputs['Roughness'])

def pillow(name,pos,w,d,thickness,mat,orientation='seat',lean=0):
 vs=[];fs=[];tex=[];steps=32
 def point(u,v,h):
  xx=u*w/2*(1-.075*abs(v)**8);zz=v*d/2*(1-.075*abs(u)**8)
  return (xx,-zz,h) if orientation=='seat' else (-h,-zz,xx)
 for side in [1,-1]:
  for j in range(steps+1):
   v=-1+j*2/steps
   for i in range(steps+1):
    u=-1+i*2/steps
    inflate=max(0,(1-u*u)*(1-v*v))**.60
    wrinkle=.006*math.sin(u*28+v*7)*math.exp(-((1-abs(v))/.16)**2)*(1-u*u)*(1-v*v)
    h=side*(.018+(thickness/2-.018)*inflate+wrinkle)
    vs.append(point(u,v,h));tex.append(((u+1)*w/2*24,(v+1)*d/2*24))
  offset=0 if side==1 else (steps+1)**2
  for j in range(steps):
   for i in range(steps):
    a=offset+j*(steps+1)+i;b=a+1;c=a+steps+1;dd=c+1
    fs.extend([(a,c,b),(b,c,dd)] if side==1 else [(a,b,c),(b,dd,c)])
 # Close the narrow seam band between the two sewn faces.
 edge=list(range(steps+1))+[j*(steps+1)+steps for j in range(1,steps+1)]+[steps*(steps+1)+i for i in range(steps-1,-1,-1)]+[j*(steps+1) for j in range(steps-1,0,-1)]
 off=(steps+1)**2
 for k,a in enumerate(edge):
  b=edge[(k+1)%len(edge)];fs.extend([(a,b,a+off),(b,b+off,a+off)])
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(vs,[],fs);mesh.update()
 # Recalculate a consistent exterior orientation for both panel arrangements.
 import bmesh
 bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
 uv=mesh.uv_layers.new(name='Woven metres')
 for p in mesh.polygons:
  p.use_smooth=True
  for li in p.loop_indices:uv.data[li].uv=tex[mesh.loops[li].vertex_index]
 o=bpy.data.objects.new(name,mesh);ENV.objects.link(o);o.location=(pos[0],-pos[2],pos[1]);mesh.materials.append(mat)
 o.rotation_euler.y=lean
 # A continuous fine seam follows the pinched perimeter.
 curve=bpy.data.curves.new(name+' piping','CURVE');curve.dimensions='3D';curve.bevel_depth=.003;curve.bevel_resolution=2
 spl=curve.splines.new('POLY');spl.points.add(len(edge)-1)
 for k,idx in enumerate(edge):
  u=(idx%(steps+1))/steps*2-1;v=(idx//(steps+1))/steps*2-1
  spl.points[k].co=(*point(u,v,0),1)
 spl.use_cyclic_u=True
 seam=bpy.data.objects.new('Sewn '+name,curve);ENV.objects.link(seam);seam.location=o.location;seam.rotation_euler=o.rotation_euler;curve.materials.append(piping)
 bpy.context.view_layer.objects.active=seam;seam.select_set(True);bpy.ops.object.convert(target='MESH');seam.select_set(False)
 return o
for z in [-.10,.68]:
 pillow('Soft filled seat',(2.66,.63,z),.99,.75,.255,cloth)
 pillow('Soft filled back',(3.075,.94,z),.60,.75,.255,cloth,'back',-.13)
for z,lean in [(-.03,-.23),(.83,-.31)]:
 o=pillow('Soft loose linen pillow',(2.89,.91,z),.43,.44,.24,linen,'back',lean)
 o.rotation_euler.x=.14 if z<0 else -.18
 # Keep the seam on the same rotated pillow.
 seam=ENV.objects.get('Sewn '+o.name)
 if seam:seam.rotation_euler=o.rotation_euler
print('Stuffed upholstery: six sewn cushions, woven normal and roughness textures')
