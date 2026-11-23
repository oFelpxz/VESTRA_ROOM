# VESTRA ROOM — mede circunferências (como fita métrica: contorno convexo da
# fatia) do avatar, no corpo base e com cada shape key em +1. Serve para
# conferir a calibração em cm (AVATAR_CALIBRATION em src/lib/avatar-builder.ts).
# Use no avatar ANTES de abaixar os braços (saída de avatar_medidas.py): no
# avatar posado a axila entra na fatia do peito e o peito sai ~5 cm maior.
# Uso: blender -b -P circ.py -- avatar.glb
import bpy, sys, math
import numpy as np
from mathutils.geometry import convex_hull_2d
F = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=F)
av = bpy.data.objects["AvatarBase"]
mw = np.array(av.matrix_world)
kb = av.data.shape_keys.key_blocks
B = np.array([d.co for d in kb["Basis"].data])
def world(P): return P @ mw[:3,:3].T + mw[:3,3]
def circ(P, z, xmax):
    s = P[(np.abs(P[:,2] - z) < 0.006) & (np.abs(P[:,0]) < xmax)][:, :2]
    h = [s[i] for i in convex_hull_2d([tuple(p) for p in s])]
    return float(sum(np.linalg.norm(h[i] - h[i-1]) for i in range(len(h))) * 100)
LV = {"cintura": (1.05, 0.25), "peito": (1.24, 0.18), "quadril": (0.90, 0.25)}
P0 = world(B)
print("base:", {k: round(circ(P0, z, x), 1) for k, (z, x) in LV.items()}, "altura", round(P0[:,2].max() - P0[:,2].min(), 3))
for k in kb[1:]:
    P = world(np.array([d.co for d in k.data]))
    print(f"{k.name:10s} +1:", {n: round(circ(P, z, x) - circ(P0, z, x), 1) for n, (z, x) in LV.items()})
