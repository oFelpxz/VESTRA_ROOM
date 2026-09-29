# VESTRA ROOM — estima as articulações do braço (lado +X): anda pela linha
# central do braço (só vértices do braço) e imprime o centro e o raio de cada
# fatia. Ombro (topo, logo fora do tronco), cotovelo (maior mudança de
# direção) e punho (menor raio antes da mão) saem dessa lista e estão fixados
# em pose_lib.py (OMBRO, COTOVELO, PUNHO, PONTA_MAO).
# Uso: blender -b -P juntas.py -- avatar.glb
import bpy, sys
import numpy as np
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=sys.argv[sys.argv.index("--") + 1])
av = bpy.data.objects["AvatarBase"]
P = np.array([av.matrix_world @ v.co for v in av.data.vertices])
# linha central: fatias perpendiculares a um eixo aproximado, só |x| > 0.19
arm = P[(P[:, 0] > 0.19) & (P[:, 2] > 0.8) & (P[:, 2] < 1.40)]
start = np.array([0.20, -0.02, 1.30])
d = np.array([0.6, -0.1, -0.78]); d /= np.linalg.norm(d)
c = start; pts = []
for i in range(40):
    nxt = c + d * 0.02
    rel = arm - nxt
    near = arm[(np.abs(rel @ d) < 0.006) & (np.linalg.norm(rel, axis=1) < 0.07)]
    if len(near) < 6: break
    nc = near.mean(0); r = np.linalg.norm(near - nc, axis=1).mean()
    nd = nc - c; nd /= np.linalg.norm(nd); d = 0.6 * d + 0.4 * nd; d /= np.linalg.norm(d)
    c = nc; pts.append((c.copy(), r))
for i, (p, r) in enumerate(pts): print(i, p.round(3), "raio", round(r, 3))
