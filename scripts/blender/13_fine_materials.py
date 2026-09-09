# Refine only non-playable garden stones and existing upholstered materials.
# Run after 12_deck_clearance, then recheck 12 and export with 04.
import bpy, json, math, os
import numpy as np
from mathutils import Vector
from mathutils.noise import noise_vector
ROOT = '/Users/tt/code/other/danzhu/.worktrees/initial'
scene = bpy.context.scene
ENV = next(c for c in scene.collection.children if c.name.startswith('Courtyard_Environment'))
COURT = next(c for c in scene.collection.children if c.name.startswith('Physical_Court'))
rocks = json.load(open(ROOT + '/src/shared/generated/court.json'))['rocks']
S = 512
rng = np.random.default_rng(260909)
v, u = np.mgrid[0:S,0:S].astype(np.float32)/S

def field(frequency):
    # Periodic value noise gives irregular grains without directional wave patterns.
    grid=rng.normal(size=(frequency,frequency)).astype(np.float32)
    x=u*frequency;y=v*frequency
    ix=np.floor(x).astype(int);iy=np.floor(y).astype(int)
    fx=x-ix;fy=y-iy
    fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy)
    a=grid[iy%frequency,ix%frequency];b=grid[iy%frequency,(ix+1)%frequency]
    c=grid[(iy+1)%frequency,ix%frequency];d=grid[(iy+1)%frequency,(ix+1)%frequency]
    out=(a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy
    return out/max(float(out.std()),1e-6)

def image_texture(name, values, color=False):
    old=bpy.data.images.get(name)
    if old: bpy.data.images.remove(old)
    im=bpy.data.images.new(name,width=S,height=S,alpha=False)
    im.colorspace_settings.name='sRGB' if color else 'Non-Color'
    values=np.clip(values,0,1)
    if values.ndim==2: values=np.repeat(values[:,:,None],3,axis=2)
    rgba=np.concatenate([values,np.ones((S,S,1),dtype=np.float32)],axis=2)
    im.pixels.foreach_set(rgba.astype(np.float32).ravel());im.pack()
    return im

def normal_texture(name,height,pitch):
    dx=(np.roll(height,-1,axis=1)-np.roll(height,1,axis=1))/(2*pitch)
    dy=(np.roll(height,-1,axis=0)-np.roll(height,1,axis=0))/(2*pitch)
    normal=np.stack([-dx,-dy,np.ones_like(dx)],axis=2)
    normal/=np.linalg.norm(normal,axis=2,keepdims=True)
    return image_texture(name,normal*.5+.5)

def apply_maps(mat, color_image, normal_image, rough_image, strength, sheen=0):
    p=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    for n in list(mat.node_tree.nodes):
        if n.type not in {'BSDF_PRINCIPLED','OUTPUT_MATERIAL'}: mat.node_tree.nodes.remove(n)
    for im, target in [(color_image,'Base Color'),(rough_image,'Roughness')]:
        if im:
            node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=im
            mat.node_tree.links.new(node.outputs['Color'],p.inputs[target])
    node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=normal_image
    nm=mat.node_tree.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=strength
    mat.node_tree.links.new(node.outputs['Color'],nm.inputs['Color'])
    mat.node_tree.links.new(nm.outputs['Normal'],p.inputs['Normal'])
    p.inputs['Metallic'].default_value=0
    p.inputs['Sheen Weight'].default_value=sheen
    p.inputs['Sheen Roughness'].default_value=.85

# Muted mineral variation and very shallow fine pores, not deep painted cracks.
cloud=field(5);grain=field(90);fine=field(190)
shade=.54+.008*cloud+.018*grain+.008*fine
stone_color=image_texture('Fine granite mineral colour',np.stack([shade*1.02,shade*1.025,shade*.985],axis=2),True)
stone_normal=normal_texture('Fine granite pores normal',.00005*grain+.000015*fine,.32/S)
stone_rough=image_texture('Fine granite mineral roughness',.80+.025*cloud+.028*grain)
# Separate from the untouched shared gameplay stones, even in the editable Blender preview.
stone_material=bpy.data.materials.get('Fine weathered garden stone')
if not stone_material:
    stone_material=bpy.data.materials['Weathered garden granite'].copy()
    stone_material.name='Fine weathered garden stone'
apply_maps(stone_material,stone_color,stone_normal,stone_rough,.25)
stone_objects=[o for o in ENV.objects if o.name.startswith(('Garden edge boulder','Garden stepping stone'))]
for o in stone_objects:
    if not o.get('fine_stone_v1'):
        old=[o.matrix_world@v.co for v in o.data.vertices]
        original=[(min(v[i] for v in old),max(v[i] for v in old)) for i in range(3)]
        bpy.context.view_layer.objects.active=o
        mod=o.modifiers.new('Rounded weathered stone','SUBSURF');mod.levels=2
        bpy.ops.object.modifier_apply(modifier=mod.name)
        coords=[]
        for vertex in o.data.vertices:
            co=o.matrix_world@vertex.co
            n=noise_vector(co*9.1,noise_basis='PERLIN_ORIGINAL')
            co+=n*.004
            coords.append(co)
        now=[(min(v[i] for v in coords),max(v[i] for v in coords)) for i in range(3)]
        inv=o.matrix_world.inverted()
        for vertex,co in zip(o.data.vertices,coords):
            # Keep original contact heights and deck-clearance envelope exactly.
            for i in range(3):
                co[i]=original[i][0]+(co[i]-now[i][0])/(now[i][1]-now[i][0])*(original[i][1]-original[i][0])
            vertex.co=inv@co
        o['fine_stone_v1']=True
    o.data.materials.clear();o.data.materials.append(stone_material)
    # Local box projection keeps the top free of the pinching of spherical UVs.
    coords=[o.matrix_world@v.co for v in o.data.vertices]
    center=sum(coords,Vector())/len(coords)
    uv=o.data.uv_layers.active or o.data.uv_layers.new(name='Stone mineral UV')
    for poly in o.data.polygons:
        poly.use_smooth=True
        normal=(o.matrix_world.to_3x3().inverted().transposed()@poly.normal).normalized()
        axis=max(range(3),key=lambda i:abs(normal[i]))
        axes=[i for i in range(3) if i!=axis]
        for li in poly.loop_indices:
            co=coords[o.data.loops[li].vertex_index]-center
            uv.data[li].uv=(co[axes[0]]/.32,co[axes[1]]/.32)
    o.data.update()

# 32 yarns per 1/24 m tile: about 1.3 mm spacing, with irregular low-contrast fibres.
x=u*32+.055*np.sin(2*np.pi*v*3)
y=v*32+.05*np.sin(2*np.pi*u*5)
ix=np.floor(x).astype(int);iy=np.floor(y).astype(int)
fx=x-ix;fy=y-iy
warp=(ix+iy)%2==0
cross=np.where(warp,fx,fy);along=np.where(warp,fy,fx)
yarn=np.sin(np.pi*cross)**2*(.8+.2*np.sin(np.pi*along)**2)
slub=field(38)
fabric_normal=normal_texture('Fine soft woven normal',.000025*yarn+.000002*slub,(1/24)/S)
fabric_rough=image_texture('Fine soft woven roughness',.86-.035*yarn+.008*slub)
for name in ['Woven sage upholstery','Woven oat pillow']:
    mat=bpy.data.materials[name]
    tint=np.array([.15,.21,.19] if 'sage' in name else [.46,.40,.29])
    linear=tint[None,None,:]*(.94+.055*yarn+.012*slub)[:,:,None]
    srgb=np.where(linear<=.0031308,linear*12.92,1.055*np.maximum(linear,0)**(1/2.4)-.055)
    fabric_color=image_texture('Fine yarn colour '+name,srgb,True)
    apply_maps(mat,fabric_color,fabric_normal,fabric_rough,.45,.22)
    shader=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    shader.inputs['Sheen Tint'].default_value=(.42,.46,.42,1) if 'sage' in name else (.64,.57,.46,1)

report=dict(stones=len(stone_objects),stoneTriangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in stone_objects),
            stoneBoundsPreserved=True,textureSize=S,sharedImages=7,fabricYarnSpacingMillimetres=1000/(32*24),
            stoneNormalStrength=.25,fabricNormalStrength=.45,gameplayGeometryChanged=False)
with open(ROOT+'/assets/blender/fine-materials-manifest.json','w') as f:json.dump(report,f,indent=2)
print(json.dumps(report))
