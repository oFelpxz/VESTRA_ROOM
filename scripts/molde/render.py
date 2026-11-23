# VESTRA ROOM — renderiza corpo + roupa (frente, lado, costas e 3/4), para
# conferir um molde sem abrir o site. As shape keys dos dois arquivos recebem
# as mesmas medidas (ex.: "hip=1,weight=0.5"; "" = corpo de referência).
#
# Uso: blender -b -P render.py -- prefixo corpo.glb roupa.glb|none "medidas"
#   prefixo: caminho ABSOLUTO (o Blender muda a pasta atual)
#   ORTHO=1.2 ALVO=0,0,1.2 (variáveis de ambiente): zoom e centro da câmera
import bpy, os, sys
from mathutils import Vector
out, fb, fr, spec = sys.argv[sys.argv.index("--") + 1:][:4]
vals = {k: float(v) for k, v in (kv.split("=") for kv in spec.split(",") if kv)}
bpy.ops.wm.read_factory_settings(use_empty=True)
groups = []
for f in ((fb, fr) if fr != "none" else (fb,)):
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=f)
    groups.append([o for o in bpy.data.objects if o not in before and o.type == "MESH"])
for g in groups:
    for o in g:
        if o.data.shape_keys:
            for kb in o.data.shape_keys.key_blocks:
                if kb.name in vals: kb.slider_min = -1; kb.value = vals[kb.name]
scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"; scene.display.shading.light = "STUDIO"; scene.display.shading.color_type = "OBJECT"
scene.render.resolution_x = 600; scene.render.resolution_y = 800
for o in groups[0]: o.color = (0.75, 0.75, 0.75, 1)
for o in (groups[1] if len(groups) > 1 else []): o.color = (0.85, 0.35, 0.1, 1)
cd = bpy.data.cameras.new("cam"); cd.type = "ORTHO"; cd.ortho_scale = float(os.environ.get("ORTHO", "2.2"))
cam = bpy.data.objects.new("cam", cd); scene.collection.objects.link(cam); scene.camera = cam
T = Vector(tuple(float(x) for x in os.environ.get("ALVO", "0,0,1.0").split(",")))
for name, d in (("frente", (0, -1, 0)), ("lado", (1, 0, 0)), ("costas", (0, 1, 0)), ("tres4", (0.7, 0.7, 0))):
    cam.location = T + Vector(d) * 5
    cam.rotation_euler = (T - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = f"{out}_{name}.png"; bpy.ops.render.render(write_still=True)
