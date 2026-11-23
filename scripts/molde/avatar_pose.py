# VESTRA ROOM — abaixa os braços do avatar (pose padrão do VESTRA FIT).
#
# 1) monta um esqueleto simples e deixa o Blender calcular os pesos (bone heat)
# 2) aplica a pose no corpo base e em cada shape key (pose_lib.posar)
# 3) salva os pesos, para as roupas encaixadas na pose antiga seguirem a mesma
#
# Uso: blender -b -P avatar_pose.py -- entrada.glb saida.glb pesos.npz [abertura,frente]
# (sem o último argumento usa a pose padrão; com ele, braço reto nesse ângulo,
# em graus: é o corpo usado para encaixar roupas cujas mangas estão em outra pose)
import bpy, sys, os
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pose_lib import OMBRO, COTOVELO, PUNHO, PONTA_MAO, POSE_PADRAO, espelha, juntas_para, pose_reta, posar

ARGS = sys.argv[sys.argv.index("--") + 1:]
IN, OUT, NPZ = ARGS[:3]
POSE = pose_reta(*map(float, ARGS[3].split(","))) if len(ARGS) > 3 else POSE_PADRAO
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=IN)
av = bpy.data.objects["AvatarBase"]

# --- esqueleto: tronco, pernas e cabeça ficam parados; só os braços mexem
TRONCO = [
    ("pelvis", (0, -0.03, 0.90), (0, -0.03, 1.10)),
    ("spine", (0, -0.03, 1.10), (0, -0.03, 1.30)),
    ("chest", (0, -0.03, 1.30), (0, -0.03, 1.42)),
    ("neck", (0, -0.02, 1.42), (0, -0.02, 1.52)),
    ("head", (0, -0.02, 1.52), (0, -0.02, 1.68)),
]
LADO = [
    ("clavicle", (0.03, -0.03, 1.40), tuple(OMBRO)),
    ("upper_arm", tuple(OMBRO), tuple(COTOVELO)),
    ("forearm", tuple(COTOVELO), tuple(PUNHO)),
    ("hand", tuple(PUNHO), tuple(PONTA_MAO)),
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

# --- pesos dos braços por vértice
n = len(av.data.vertices)
idx = {g.name: g.index for g in av.vertex_groups}
W = {k: np.zeros(n) for k in idx}
for v in av.data.vertices:
    for g in v.groups:
        name = av.vertex_groups[g.group].name
        W[name][v.index] = g.weight
tot = sum(W.values()); tot[tot == 0] = 1
for k in W: W[k] = W[k] / tot
pesos = {
    1: np.stack([W["upper_arm.L"], W["forearm.L"] + W["hand.L"]], 1),
    -1: np.stack([W["upper_arm.R"], W["forearm.R"] + W["hand.R"]], 1),
}
sem_peso = int((sum(W.values()) == 0).sum())

# A malha tem vértices duplicados nas costuras de UV (mesmo lugar, lados
# diferentes da costura). O bone heat dá pesos um pouco diferentes a cada
# lado e, na pose, a costura abre uma fenda: iguala os pesos por posição.
M0 = np.array(av.matrix_world)
pos0 = np.array([d.co for d in av.data.shape_keys.key_blocks["Basis"].data]) @ M0[:3, :3].T
_, grupo = np.unique(np.round(pos0, 5), axis=0, return_inverse=True)
grupo = grupo.ravel()
cont = np.bincount(grupo)
for s in (1, -1):
    for c in range(2):
        pesos[s][:, c] = (np.bincount(grupo, pesos[s][:, c]) / cont)[grupo]
print(f"costuras: {len(grupo) - len(cont)} vértices duplicados com pesos igualados")
print(f"pesos: braço L {int((pesos[1].sum(1) > 0.01).sum())} vértices, R {int((pesos[-1].sum(1) > 0.01).sum())}, sem peso {sem_peso}")

# desfaz o vínculo: a pose é aplicada por nós
av.modifiers.clear(); av.parent = None  # o esqueleto está na origem: nada muda
bpy.data.objects.remove(rig)

M = np.array(av.matrix_world); R, T = M[:3, :3], M[:3, 3]; Ri = np.linalg.inv(R)
kb = av.data.shape_keys.key_blocks
base = np.array([d.co for d in kb["Basis"].data]) @ R.T + T
for k in kb:
    Pk = np.array([d.co for d in k.data]) @ R.T + T
    juntas = {s: juntas_para(base, Pk, s) for s in (1, -1)}
    posed = posar(Pk, juntas, pesos, POSE)
    k.data.foreach_set("co", ((posed - T) @ Ri.T).ravel())
av.data.vertices.foreach_set("co", np.array([d.co for d in kb["Basis"].data]).ravel())
av.data.update()
print("pose aplicada em", len(kb), "formas (base + medidas)")

np.savez(NPZ, base=base, upper_L=pesos[1][:, 0], fore_L=pesos[1][:, 1],
         upper_R=pesos[-1][:, 0], fore_R=pesos[-1][:, 1])
bpy.ops.object.select_all(action="DESELECT")
av.select_set(True); bpy.context.view_layer.objects.active = av
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True,
                          export_morph=True, export_apply=True)
