# Blender courtyard implementation plan

Scope: Use the installed user-level Blender MCP to author an editable courtyard inspired by the supplied reference: glass facade and timber deck at left, slat fence and dense planting at rear, deck/lounge/table at right, stone borders. Keep the central 3m marble court playable. All visible court grooves, fissures, coarse grains and small stones must affect physical contact; no fake bump/normal relief in the court.

1. Install matching Blender MCP addon, enable and verify connection; preserve source and reusable generation scripts.
2. Author detailed courtyard and a physically defined earth surface in Blender using deterministic data; save .blend and export GLB. The court has actual triangulated shallow grooves and grain relief plus explicit stone meshes.
3. Export the exact court vertices/triangles and stone positions/radii into a versioned shared data file. Three.js and Rapier read the same geometry, with identical axes and metres. No hidden decorative court relief.
4. Load environment GLB in Three.js, replacing prototype environment, retain camera/input and lighting. Cap asset complexity; verify actual browser output and load errors.
5. Test groove contact, grain relief, stone deflection, mesh equality, serving and networking. Document actual dimensions, asset budgets, MCP setup and limits; commit locally.

Architecture: scripts/blender/ holds reproducible Python; assets/blender/ source; public/models/ runtime GLB; src/shared/generated/ terrain data; map.ts supplies mesh/support heights; physics.ts consumes mesh; client scene loads assets and draws the same court mesh.

## Completed validation

Blender 5.1.2 and addon 1.6/protocol 5 connected through MCP. Editable source and runtime GLB saved; exact terrain and convex stone geometry exported. All 31 tests passed, including four physical-surface checks. Full two-context browser, mouse, touch, and reconnection checks passed. Production build passed with documented large-chunk warnings. Desktop idle frame sample: about 16.7ms/frame; not a device-performance certification. No public deployment or remote push performed.
