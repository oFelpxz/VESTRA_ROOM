# VESTRA ROOM — subdivide (simples, sem arredondar) os objetos da roupa com
# menos de MAX_VERTS vértices. Malha esparsa deixa a pele passar entre os
# vértices mesmo com todos eles fora do corpo; os atributos (`_BRACO`, UV)
# são interpolados.
#
# Uso: blender -b -P subdiv.py -- entrada.glb saida.glb MAX_VERTS
import bpy, sys
a = sys.argv[sys.argv.index("--") + 1:]
IN, OUT, MAXV = a[0], a[1], int(a[2])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=IN)
for o in [o for o in bpy.data.objects if o.type == "MESH"]:
    n = len(o.data.vertices)
    if n >= MAXV: continue
    bpy.context.view_layer.objects.active = o
    for s in bpy.context.view_layer.objects: s.select_set(s == o)
    m = o.modifiers.new("sub", "SUBSURF"); m.subdivision_type = "SIMPLE"; m.levels = 1
    bpy.ops.object.modifier_apply(modifier="sub")
    print(o.name, n, "->", len(o.data.vertices))
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_extras=True, export_attributes=True)
