# Thin dielectric glazing: reflective at grazing angles and transmitting the room behind it.
p=next(n for n in mats['glass'].node_tree.nodes if n.type=='BSDF_PRINCIPLED')
p.inputs['Base Color'].default_value=(.72,.83,.77,1)
p.inputs['Metallic'].default_value=0;p.inputs['Roughness'].default_value=.045
p.inputs['Transmission Weight'].default_value=.95;p.inputs['IOR'].default_value=1.52
mats['glass'].diffuse_color=(.72,.83,.77,1)
for o in list(ENV.objects):
 if o.name.startswith('Glazing brushed handle'):bpy.data.objects.remove(o,do_unlink=True)
mats['handle']=material('Brushed door hardware',(.30,.33,.31),.25,.85)
for z in [-.495,-.405]:
 cylinder('Glazing brushed handle',(-2.515,.88,z),(-2.515,1.13,z),.010,.010,'handle',12)
 for y in [.90,1.11]:cylinder('Glazing brushed handle mount',(-2.565,y,z),(-2.515,y,z),.007,.007,'handle',10)
print('Clear dielectric glazing and door handles ready')
