# VESTRA ROOM — reduz a malha (Decimate, preservando UV): o caimento roda no
# navegador a cada troca de tamanho/medida, e menos vértices = mais rápido.
# Uso: blender -b -P reduzir.py -- entrada.glb saida.glb proporção
import bpy, sys
IN, OUT, RATIO = sys.argv[sys.argv.index("--") + 1:][:3]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=IN)
antes = depois = 0
for o in [o for o in bpy.data.objects if o.type == "MESH"]:
    antes += len(o.data.vertices)
    m = o.modifiers.new("dec", "DECIMATE"); m.ratio = float(RATIO); m.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier="dec")
    depois += len(o.data.vertices)
for img in bpy.data.images: print("IMG", img.name, tuple(img.size))
print(f"vértices {antes} -> {depois}")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_extras=True)
