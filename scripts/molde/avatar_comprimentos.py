# VESTRA ROOM — mede, no avatar já posado (avatar_v3), os comprimentos que o
# site calibra em cm: altura, entrepernas, braço (ombro → pulso) e ombros
# (ombro a ombro), no corpo base e com cada shape key em +1. Imprime o bloco
# `lengths` de AVATAR_CALIBRATION (src/lib/avatar-builder.ts).
# (Quanto a altura muda as circunferências sai de avatar_medidas.py.)
# Uso: blender -b -P avatar_comprimentos.py -- avatar_v3.glb
import bpy, sys
import numpy as np

F = sys.argv[sys.argv.index("--") + 1]
# ombro e pulso do lado +X na pose padrão (Blender: Z para cima, frente = -Y);
# os mesmos de src/lib/garment-dress.ts
OMBRO = np.array([0.18, -0.02, 1.33])
PULSO = np.array([0.415, -0.088, 0.869])
RAIO = 0.05

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=F)
av = bpy.data.objects["AvatarBase"]
M = np.array(av.matrix_world)
kb = av.data.shape_keys.key_blocks
world = lambda k: np.array([d.co for d in k.data]) @ M[:3, :3].T + M[:3, 3]
B = world(kb["Basis"])

lados = (np.array([1, 1, 1]), np.array([-1, 1, 1]))
perto = lambda j: [np.where(np.linalg.norm(B - j * s, axis=1) < RAIO)[0] for s in lados]
ombros, pulsos = perto(OMBRO), perto(PULSO)
# linha do meio entre as pernas: o ponto mais baixo é a virilha
meio = np.where((np.abs(B[:, 0]) < 0.012) & (B[:, 2] > 0.55) & (B[:, 2] < 1.0))[0]


def medir(P):
    chao = P[:, 2].min()
    return {
        "height": P[:, 2].max() - chao,
        "inseam": P[meio, 2].min() - chao,
        "arm": np.mean([np.linalg.norm(P[p].mean(0) - P[o].mean(0)) for o, p in zip(ombros, pulsos)]),
        "shoulder": P[ombros[0], 0].max() - P[ombros[1], 0].min(),
    }


m0 = medir(B)
cm = lambda d: {k: round(float(v) * 100, 1) for k, v in d.items()}
print("base:", cm(m0))
ganhos = {}
for k in kb[1:]:
    d = {n: v - m0[n] for n, v in medir(world(k)).items()}
    g = {n: v for n, v in cm(d).items() if abs(v) >= 0.5}
    if g:
        ganhos[k.name] = g
    print(f"{k.name:10s} +1:", cm(d))
print("CALIBRACAO lengths:", {"base": cm(m0), "gain": ganhos})
