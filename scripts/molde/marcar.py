# VESTRA ROOM — grava a marca vestra_fit = avatar_base (peça ajustada ao corpo
# de referência): é ela que liga o provador e o modo Manequim para a peça
# (src/components/viewer-3d/mannequin-mark.ts). Opcional: altura da ribana
# da barra em metros (vestra_ribana), para ela abraçar o quadril no provador.
# Uso: blender -b -P marcar.py -- entrada.glb saida.glb [ribana_m]
import bpy, sys
ARGS = sys.argv[sys.argv.index("--") + 1:]
IN, OUT = ARGS[:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=IN)
bpy.context.scene["vestra_fit"] = "avatar_base"
if len(ARGS) > 2:
    bpy.context.scene["vestra_ribana"] = float(ARGS[2])
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_extras=True, export_attributes=True)
