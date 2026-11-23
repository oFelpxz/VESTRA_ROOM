# VESTRA ROOM — grava no avatar quanto cada vértice é braço (lista 12, item 9).
#
# O provador abaixa os braços da pose padrão (30°) para uma pose relaxada
# (`src/lib/arm-pose.ts`), girando cada vértice no ombro na proporção desse
# peso. O peso sai do bone heat do Blender, como em avatar_pose.py, mas com o
# esqueleto já na pose padrão (o avatar de entrada é o posado).
#
# O .glb NÃO é exportado de novo pelo Blender: o atributo `_BRACO` (peso com o
# sinal do lado, +X / -X, como nas roupas) é acrescentado ao arquivo original,
# que fica com os mesmos vértices, na mesma ordem.
#
# Uso: blender -b -P avatar_braco.py -- avatar_base.glb saida.glb
import bpy, sys, os, json, struct
import numpy as np
from mathutils.kdtree import KDTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pose_lib import OMBRO, COTOVELO, PUNHO, PONTA_MAO, POSE_PADRAO, espelha, _rotacoes

ARGS = sys.argv[sys.argv.index("--") + 1:]
IN, OUT = ARGS[:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=IN)
av = bpy.data.objects["AvatarBase"]

# --- articulações na pose padrão (lado +X)
S, Ru, E2, Rf = _rotacoes((OMBRO, COTOVELO, PUNHO), POSE_PADRAO, 1)
posada = lambda p: E2 + Rf @ (S + Ru @ (p - S) - E2)
W2, M2 = posada(PUNHO), posada(PONTA_MAO)

TRONCO = [
    ("pelvis", (0, -0.03, 0.90), (0, -0.03, 1.10)),
    ("spine", (0, -0.03, 1.10), (0, -0.03, 1.30)),
    ("chest", (0, -0.03, 1.30), (0, -0.03, 1.42)),
    ("neck", (0, -0.02, 1.42), (0, -0.02, 1.52)),
    ("head", (0, -0.02, 1.52), (0, -0.02, 1.68)),
]
LADO = [
    ("clavicle", (0.03, -0.03, 1.40), tuple(S)),
    ("upper_arm", tuple(S), tuple(E2)),
    ("forearm", tuple(E2), tuple(W2)),
    ("hand", tuple(W2), tuple(M2)),
    ("thigh", (0.09, -0.02, 0.90), (0.10, -0.02, 0.48)),
    ("shin", (0.10, -0.02, 0.48), (0.10, 0.0, 0.08)),
    ("foot", (0.10, 0.0, 0.08), (0.10, -0.12, 0.02)),
]
arm_data = bpy.data.armatures.new("Rig")
rig = bpy.data.objects.new("Rig", arm_data)
bpy.context.scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode="EDIT")
for name, h, t in TRONCO:
    b = arm_data.edit_bones.new(name); b.head = h; b.tail = t
for sfx, s in ((".L", 1), (".R", -1)):
    for name, h, t in LADO:
        b = arm_data.edit_bones.new(name + sfx)
        b.head = tuple(espelha(np.array(h))) if s < 0 else h
        b.tail = tuple(espelha(np.array(t))) if s < 0 else t
bpy.ops.object.mode_set(mode="OBJECT")
bpy.ops.object.select_all(action="DESELECT")
av.select_set(True); rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type="ARMATURE_AUTO")

# --- peso do braço inteiro (braço + antebraço + mão), com o sinal do lado
n = len(av.data.vertices)
W = {g.name: np.zeros(n) for g in av.vertex_groups}
for v in av.data.vertices:
    for g in v.groups:
        W[av.vertex_groups[g.group].name][v.index] = g.weight
tot = sum(W.values()); tot[tot == 0] = 1
braco = lambda sfx: sum(W[k + sfx] for k in ("upper_arm", "forearm", "hand")) / tot
peso = braco(".L") - braco(".R")

# Costuras de UV: vértices duplicados no mesmo lugar ficam com o mesmo peso
# (senão a costura abre ao girar o braço).
M = np.array(av.matrix_world)
pos = np.array([v.co for v in av.data.vertices]) @ M[:3, :3].T + M[:3, 3]
_, grupo = np.unique(np.round(pos, 5), axis=0, return_inverse=True)
grupo = grupo.ravel()
peso = (np.bincount(grupo, peso) / np.bincount(grupo))[grupo]

# --- acrescenta o atributo ao .glb original, casando os vértices pela posição
raw = open(IN, "rb").read()
jlen = struct.unpack("<I", raw[12:16])[0]
gltf = json.loads(raw[20:20 + jlen])
bin_off = 20 + jlen
blen = struct.unpack("<I", raw[bin_off:bin_off + 4])[0]
binary = bytearray(raw[bin_off + 8:bin_off + 8 + blen])

prim = gltf["meshes"][0]["primitives"][0]
acc = gltf["accessors"][prim["attributes"]["POSITION"]]
view = gltf["bufferViews"][acc["bufferView"]]
P = np.frombuffer(bytes(binary), np.float32, acc["count"] * 3,
                  view.get("byteOffset", 0) + acc.get("byteOffset", 0)).reshape(-1, 3)
node = next(nd for nd in gltf["nodes"] if nd.get("mesh") == 0)
# pontos do arquivo (y para cima) → mundo do Blender (z para cima), pelo nó
q = node.get("rotation", [0, 0, 0, 1])
x, y, z, w = q
R = np.array([
    [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
])
Yup = P @ R.T                                   # cena do glTF (y para cima)
blender = np.stack([Yup[:, 0], -Yup[:, 2], Yup[:, 1]], 1)
kd = KDTree(len(pos))
for i, p in enumerate(pos):
    kd.insert(p, i)
kd.balance()
achados = [kd.find(p) for p in blender]
ids = np.array([i for _, i, _ in achados])
longe = max(d for _, _, d in achados)
assert longe < 1e-5, f"vértice do arquivo sem par no Blender (a {longe} m)"
valores = peso[ids].astype(np.float32)

while len(binary) % 4:
    binary.append(0)
gltf["bufferViews"].append({"buffer": 0, "byteOffset": len(binary), "byteLength": valores.nbytes})
binary += valores.tobytes()
gltf["accessors"].append({"bufferView": len(gltf["bufferViews"]) - 1, "componentType": 5126,
                          "count": int(len(valores)), "type": "SCALAR"})
prim["attributes"]["_BRACO"] = len(gltf["accessors"]) - 1
gltf["buffers"][0]["byteLength"] = len(binary)
js = json.dumps(gltf, separators=(",", ":")).encode()
js += b" " * (-len(js) % 4)
total = 12 + 8 + len(js) + 8 + len(binary)
with open(OUT, "wb") as f:
    f.write(b"glTF" + struct.pack("<II", 2, total))
    f.write(struct.pack("<I", len(js)) + b"JSON" + js)
    f.write(struct.pack("<I", len(binary)) + b"BIN\x00" + bytes(binary))
lados = [int((valores > 0.5).sum()), int((valores < -0.5).sum())]
print(f"_BRACO: {len(valores)} vértices, braço +X {lados[0]}, -X {lados[1]}")
