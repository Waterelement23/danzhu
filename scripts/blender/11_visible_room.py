# Complete the small garden-room volume visible from the game, through the glazing and in mirrors.
# This is one finished room, with no unseen house wings or upper storeys.
for o in list(ENV.objects):
 if o.name.startswith(('Garden room plaster rear','Garden room north return','Interior floor','Room ','Sewn Room ')):
  bpy.data.objects.remove(o,do_unlink=True)
mats['roomwall']=material('Room warm plaster',(.57,.53,.45),.96)
mats['roomfloor']=material('Room smoked oak',(.19,.115,.061),.74)
mats['roomceiling']=material('Room matte ceiling',(.65,.62,.55),.96)
# Solid side and rear walls overlap the ceiling/roof and floor rather than stopping short.
shell=[]
def room_box(name,pos,size,mat,bevel=0):
 o=cube('Room '+name,pos,size,mat,bevel);return o
shell.append(room_box('foundation plinth',(-3.44,.06,-.45),(1.96,.18,4.30),'stone'))
shell.append(room_box('rear wall',(-4.32,1.19,-.45),(.20,2.22,4.30),'roomwall'))
shell.append(room_box('north return wall',(-3.44,1.19,-2.51),(1.96,2.22,.18),'roomwall'))
shell.append(room_box('south return wall',(-3.44,1.19,1.61),(1.96,2.22,.18),'roomwall'))
shell.append(room_box('floor slab',(-3.44,.13,-.45),(1.96,.12,4.30),'roomfloor'))
shell.append(room_box('ceiling soffit',(-3.44,2.265,-.45),(1.96,.07,4.30),'roomceiling'))
# Glass opening retains its world plane so the runtime planar reflection remains aligned.
shell.append(room_box('glazing lintel',(-2.57,2.175,-.45),(.15,.25,4.16),'edge'))
shell.append(room_box('glazing upper seal',(-2.57,2.035,-.45),(.10,.055,4.01),'edge'))
shell.append(room_box('door sill',(-2.57,.185,-.45),(.15,.055,4.16),'edge'))
for z in [-2.45,1.55]:shell.append(room_box('corner jamb',(-2.56,1.19,z),(.15,2.22,.10),'edge'))
for o in ENV.objects:
 if o.name.startswith('Reflective glass pane'):
  o.dimensions.y=.99
  shell.append(o)
 if o.name.startswith(('Glazing vertical mullion','Glazing horizontal frame')):shell.append(o)
# Cut exterior decking at the facade. The former full-width deck intersected the indoor floor.
for o in list(ENV.objects):
 if o.name.startswith('Cedar deck board') and o.location.x<0:
  z=-o.location.y
  if z<1.70:
   o.location.x=(-2.50-1.825)/2;o.dimensions.x=.675
 if o.name.startswith('Deck dark subframe') and o.location.x<0:
  bpy.data.objects.remove(o,do_unlink=True)
room_box('walkway support',(-2.1625,.04,-.42),(.675,.16,4.26),'edge')
room_box('front deck support',(-2.80,.04,2.16),(1.95,.16,1.08),'edge')
# Indoor boards sit above the continuous slab. No coplanar indoor/outdoor surfaces remain.
for i in range(23):
 z=-2.36+i*.169
 room_box('interior oak board',(-3.43,.197,z),(1.64,.014,.163),'roomfloor',.002)
# Continuous skirting gives wall/floor and corner junctions a readable scale.
room_box('rear skirting',(-4.208,.25,-.45),(.025,.10,3.94),'roomfloor',.002)
for z in [-2.409,1.509]:room_box('return skirting',(-3.42,.25,z),(1.65,.10,.022),'roomfloor',.002)
# A modest built-in bench and storage cabinet provide believable objects behind the glass.
room_box('bench seat',(-3.92,.61,-.35),(.51,.07,1.90),'wood2',.012)
for z in [-1.12,.42]:room_box('bench pedestal',(-3.95,.398,z),(.40,.388,.13),'roomfloor',.008)
# A filled bench pad reuses the established editable cloth construction.
benchpad=pillow('Room bench upholstered pad',(-3.92,.695,-.35),.47,1.79,.12,cloth)
# South-end closed cabinet, with a real top, sides and doors.
room_box('cabinet carcass',(-3.88,.54,1.01),(.54,.67,.76),'roomfloor',.007)
room_box('cabinet top',(-3.88,.895,1.01),(.58,.04,.80),'wood2',.006)
for z in [.82,1.20]:
 room_box('cabinet door',(-3.599,.54,z),(.026,.61,.355),'wood2',.003)
 cylinder('Room cabinet handle',(-3.578,.55,z),(-3.551,.55,z),.011,.011,'handle',10)
# Restrained wall detail with a full frame; avoid bright blank openings that look like missing walls.
room_box('art frame',(-4.198,1.42,-.34),(.045,.54,.73),'wood',.006)
room_box('art inset',(-4.170,1.42,-.34),(.014,.46,.65),'roomceiling')
room_box('art colour block',(-4.159,1.44,-.41),(.008,.20,.23),'leaf2')
room_box('art warm block',(-4.158,1.30,-.17),(.009,.08,.18),'wood2')
# Hidden solid seams must really stop rays. Check the shell itself, without furniture masking holes.
from mathutils.bvhtree import BVHTree
bpy.context.view_layer.update()
sv=[];sf=[]
for o in shell:
 off=len(sv);sv.extend([o.matrix_world@v.co for v in o.data.vertices])
 sf.extend([tuple(off+i for i in p.vertices) for p in o.data.polygons])
bvh=BVHTree.FromPolygons(sv,sf)
checks=0
for direction in [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]:
 for y in [.22,.50,1.10,1.80,2.015,2.05,2.12,2.22]:
  for z in [-2.36,-1.44,-.45,.54,1.46]:
   origin=Vector((-3.30,-z,y));d=Vector((direction[0],-direction[2],direction[1]))
   hit=bvh.ray_cast(origin,d,6)
   assert hit[0] is not None,('Visible room shell leak',direction,y,z)
   checks+=1
# Intersecting deck boards are also checked independently of render appearance.
for o in ENV.objects:
 if o.name.startswith('Cedar deck board') and o.location.x<0 and -o.location.y<1.70:
  assert min((o.matrix_world@Vector(c)).x for c in o.bound_box)>=-2.501
with open(ROOT+'/assets/blender/room-manifest.json','w') as f:json.dump(dict(shellRayChecks=checks,frontPlaneX=-2.58,opaqueWalls=3,ceiling=True,solidFloor=True,indoorFloorTop=.204,scope='one visible garden room; three walls and a framed glazed facade'),f,indent=2)
print('Visible garden room completed:',checks,'shell rays closed; exterior deck clear of interior')
