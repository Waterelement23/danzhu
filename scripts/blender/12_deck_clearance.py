# Run after 11_visible_room, before 04_export. Also supports the saved editable scene.
import bpy, json, math, os
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOT = '/Users/tt/code/other/danzhu/.worktrees/initial'
scene = bpy.context.scene
ENV = next(c for c in scene.collection.children if c.name.startswith('Courtyard_Environment'))
COURT = next(c for c in scene.collection.children if c.name.startswith('Physical_Court'))
rocks = json.load(open(ROOT + '/src/shared/generated/court.json'))['rocks']
stone_objects = [o for o in ENV.objects if o.name.startswith(('Garden stepping stone', 'Garden edge boulder'))]
wood_objects = [o for o in ENV.objects if o.name.startswith(('Cedar deck board', 'Entry timber board', 'Deck dark subframe', 'Room walkway support', 'Room front deck support'))]

def world_vertices(o):
    return [o.matrix_world @ v.co for v in o.data.vertices]

def bounds(o):
    verts = world_vertices(o)
    return [(min(v[i] for v in verts), max(v[i] for v in verts)) for i in range(3)]

def bvh(o):
    return BVHTree.FromPolygons(world_vertices(o), [list(p.vertices) for p in o.data.polygons])

def overlaps():
    trees = {o.name: bvh(o) for o in stone_objects + wood_objects}
    return [(s.name, w.name) for s in stone_objects for w in wood_objects if trees[s.name].overlap(trees[w.name])]

before = overlaps()
if not scene.get('deck_clearance_v1'):
    # Keep the full stepping stones visible in the narrow dirt strip, 3 cm off the deck.
    # Bake world X only so their varied outlines and orientations remain intact.
    for o in stone_objects:
        if not o.name.startswith('Garden stepping stone'):
            continue
        verts = world_vertices(o)
        lo, hi = bounds(o)[0]
        for vertex, co in zip(o.data.vertices, verts):
            co.x = -1.795 + (co.x - lo) / (hi - lo) * .22
            vertex.co = co
        o.matrix_world = Matrix.Identity(4)
        o.data.update()
    # Separate the northern boulder from the first stepping stone without approaching the facade.
    north = next(o for o in stone_objects if o.name == 'Garden edge boulder.003')
    north.location.x = -2.10
    bpy.context.view_layer.update()

    pockets = []
    for stone in stone_objects:
        if not stone.name.startswith('Garden edge boulder') or stone.name.endswith('.004'):
            continue
        box = bounds(stone)
        # Straight construction cuts, extending to the deck's inner edge; no timber under the rock.
        # Z bounds are in Blender world coordinates. A 4 cm envelope remains around the entire rock.
        x0, x1 = box[0][0] - .04, box[0][1] + .04
        if stone.location.x < 0:
            x1 = max(x1, -1.78)
        else:
            x0 = min(x0, 1.78)
        y0, y1 = box[1][0] - .04, box[1][1] + .04
        bpy.ops.mesh.primitive_cube_add(size=1, location=((x0+x1)/2, (y0+y1)/2, .1))
        cutter = bpy.context.object
        cutter.name = 'Temporary deck soil pocket'
        cutter.dimensions = (x1-x0, y1-y0, 1.0)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        edited = []
        for wood in wood_objects:
            wb = bounds(wood)
            if not (wb[0][0] < x1 and wb[0][1] > x0 and wb[1][0] < y1 and wb[1][1] > y0):
                continue
            bpy.context.view_layer.objects.active = wood
            mod = wood.modifiers.new('Stone bed clearance', 'BOOLEAN')
            mod.operation = 'DIFFERENCE'
            mod.solver = 'EXACT'
            mod.object = cutter
            bpy.ops.object.modifier_apply(modifier=mod.name)
            edited.append(wood.name)
        bpy.data.objects.remove(cutter, do_unlink=True)
        pockets.append(dict(stone=stone.name, clearanceMetres=.04, trimmedTimber=edited))
    scene['deck_clearance_v1'] = True
    scene['deck_clearance_before'] = json.dumps(before)
    scene['deck_clearance_pockets'] = json.dumps(pockets)

bpy.context.view_layer.update()
after = overlaps()
assert not after, 'Rock/timber surface intersections remain: ' + str(after)
# Conservative volume clearance: no timber vertex may enter the rock's world AABB.
# This catches containment too, which surface-intersection tests alone would miss.
contained = []
for stone in stone_objects:
    sb = bounds(stone)
    for wood in wood_objects:
        for v in world_vertices(wood):
            if all(sb[i][0] + 1e-6 < v[i] < sb[i][1] - 1e-6 for i in range(3)):
                contained.append((stone.name, wood.name))
                break
assert not contained, 'Timber remains inside stone envelope: ' + str(contained)
assert all(bounds(o)[0][1] <= -1.575 + 1e-6 for o in stone_objects if o.name.startswith('Garden stepping stone'))
report = dict(stonesChecked=len(stone_objects), timberObjectsChecked=len(wood_objects),
              intersectionsBefore=json.loads(scene['deck_clearance_before']),
              intersectionsAfter=after, timberVerticesInsideStoneBounds=contained,
              steppingStoneDeckGapMetres=.03, pockets=json.loads(scene['deck_clearance_pockets']))
with open(ROOT + '/assets/blender/deck-clearance-manifest.json', 'w') as f:
    json.dump(report, f, indent=2)
print(json.dumps(report))
