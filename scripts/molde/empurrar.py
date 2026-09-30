# VESTRA ROOM — afasta o tecido onde o corpo atravessa, com um campo de
# deslocamento suave (grade 3D borrada): todas as camadas da roupa (frente,
# avesso, gola) se movem juntas e sem "espinhos". É a mesma ideia do
# `pushOut` do site (src/lib/garment-fit.ts), com mais resolução.
#
# Uso: blender -b -P empurrar.py -- entrada.glb saida.glb corpo.glb
import bpy, sys, time
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
IN, OUT, CORPO = sys.argv[sys.argv.index("--") + 1:][:3]
MARGEM = 0.008      # folga mínima entre pele e tecido (m)
CEL = 0.007         # tamanho da célula da grade (m)
SIGMA = 4.5         # borrão, em células (~3 cm)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=CORPO)
av = bpy.data.objects["AvatarBase"]
body = BVHTree.FromPolygons([av.matrix_world @ v.co for v in av.data.vertices], [p.vertices[:] for p in av.data.polygons])
bpy.ops.import_scene.gltf(filepath=IN)
cloth = [o for o in bpy.data.objects if o.type == "MESH" and o != av]
# achata a hierarquia: coordenadas de mundo direto na malha
for o in cloth:
    mw = o.matrix_world.copy(); o.parent = None; o.data.transform(mw); o.matrix_world.identity()
for o in [o for o in bpy.data.objects if o.type == "EMPTY"]: bpy.data.objects.remove(o)
sizes = [len(o.data.vertices) for o in cloth]
P = np.concatenate([np.array([v.co for v in o.data.vertices]) for o in cloth])
print("vértices da roupa", len(P))

def violations(P):
    idx, disp = [], []
    for i, p in enumerate(P):
        loc, nor, _, d = body.find_nearest(Vector(p), 0.08)
        if loc is None: continue
        s = (Vector(p) - loc).dot(nor)
        if s < MARGEM:
            idx.append(i); disp.append(np.array(loc + nor * MARGEM) - p)
    return np.array(idx, dtype=int), np.array(disp).reshape(-1, 3)

def blur(g):
    r = int(3 * SIGMA); k = np.exp(-0.5 * (np.arange(-r, r + 1) / SIGMA) ** 2)
    for ax in range(3):
        g = np.apply_along_axis(lambda m: np.convolve(m, k, mode="same"), ax, g)
    return g

lo = P.min(0) - 0.1; shape = np.ceil((P.max(0) + 0.1 - lo) / CEL).astype(int) + 1
def sample(G, Q):
    f = (Q - lo) / CEL; i0 = np.floor(f).astype(int); t = f - i0
    out = 0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (t[:,0] if dx else 1 - t[:,0]) * (t[:,1] if dy else 1 - t[:,1]) * (t[:,2] if dz else 1 - t[:,2])
                out = out + G[i0[:,0] + dx, i0[:,1] + dy, i0[:,2] + dz] * w[:, None]
    return out

for it in range(12):
    t0 = time.time()
    idx, disp = violations(P)
    print(f"passo {it}: {len(idx)} vértices encostando/atravessando  (máx {np.linalg.norm(disp, axis=1).max() if len(idx) else 0:.3f} m)  {time.time()-t0:.1f}s")
    if len(idx) == 0: break
    D = np.zeros(tuple(shape) + (3,)); Wt = np.zeros(tuple(shape))
    c = np.round((P[idx] - lo) / CEL).astype(int)
    for a in range(3): np.add.at(D[..., a], (c[:,0], c[:,1], c[:,2]), disp[:, a])
    np.add.at(Wt, (c[:,0], c[:,1], c[:,2]), 1)
    # média local dos deslocamentos + queda suave nas bordas; máx por célula
    # preservado com um fator de reforço para convergir em poucos passos
    Db = np.stack([blur(D[..., a]) for a in range(3)], -1); Wb = blur(Wt)
    field = Db / np.maximum(Wb, 1e-9)[..., None] * np.clip(Wb / (Wb.max() * 0.02), 0, 1)[..., None]
    P = P + sample(field, P) * 1.15

off = 0
for o, n in zip(cloth, sizes):
    o.data.vertices.foreach_set("co", P[off:off + n].ravel()); o.data.update(); off += n
bpy.data.objects.remove(av)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_extras=True, export_attributes=True)
