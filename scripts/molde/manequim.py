# VESTRA ROOM — gera o manequim de vitrine (public/models/manequim.glb) sem
# abrir o Blender: importa o avatar, roda ../manequim_sem_bracos.py (o mesmo
# script da aba Scripting) e exporta.
# Uso: blender -b -P manequim.py -- avatar.glb manequim.glb
import bpy, os, runpy, sys

IN, OUT = sys.argv[sys.argv.index("--") + 1:][:2]
SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "manequim_sem_bracos.py")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=IN)
runpy.run_path(SCRIPT, run_name="__main__")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB")
