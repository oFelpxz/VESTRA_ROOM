# VESTRA ROOM — alinha um moletom (capuz em volta do pescoço) ao corpo já posado
# na posição das mangas (avatar_pose.py com abertura,frente).
# 1) centraliza em X  2) desce até o tecido apoiar nos ombros
# 3) centraliza em profundidade no peito
# Uso: blender -b -P alinhar_moletom.py -- corpo.glb roupa.glb saida.glb [escala]
import bpy, sys
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ARGS = sys.argv[sys.argv.index("--") + 1:]
CORPO, IN, OUT = ARGS[:3]
ESCALA = float(ARGS[3]) if len(ARGS) > 3 else 1.0
FOLGA_OMBRO = 0.012     # tecido acima do ombro (m)
PESCOCO = np.array([0.0, -0.025, 1.42])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=CORPO)
av = bpy.data.objects["AvatarBase"]
BP = np.array([av.matrix_world @ v.co for v in av.data.vertices])
body = BVHTree.FromPolygons([Vector(p) for p in BP], [p.vertices[:] for p in av.data.polygons])
bpy.data.objects.remove(av)

bpy.ops.import_scene.gltf(filepath=IN)
cloth = [o for o in bpy.data.objects if o.type == "MESH"]
for o in cloth:
    mw = o.matrix_world.copy(); o.parent = None; o.data.transform(mw); o.matrix_world.identity()
for o in [o for o in bpy.data.objects if o.type == "EMPTY"]: bpy.data.objects.remove(o)
sizes = [len(o.data.vertices) for o in cloth]
P = np.concatenate([np.array([v.co for v in o.data.vertices]) for o in cloth])

# escala em volta do pescoço (1 = tamanho real do arquivo)
c0 = np.array([0.0, 0.0, P[:, 2].max()])
P = c0 + (P - c0) * ESCALA

# 1) X: meio entre as bordas das mangas
P[:, 0] -= (P[:, 0].min() + P[:, 0].max()) / 2

def meio_y(A, z0, z1, lim):
    ys = []
    for z in np.arange(z0, z1, 0.02):
        s = A[(np.abs(A[:, 2] - z) < 0.005) & (np.abs(A[:, 0]) < lim)]
        if len(s): ys.append((s[:, 1].min() + s[:, 1].max()) / 2)
    return float(np.median(ys))

def apoio(P):
    """Quanto o tecido está acima do ombro (percentil baixo das colunas)."""
    sel = P[(np.abs(P[:, 0]) > 0.12) & (np.abs(P[:, 0]) < 0.19) & (P[:, 2] > 1.2)]
    cols = {}
    for p in sel:
        k = (round(p[0] * 100), round(p[1] * 100))
        cols.setdefault(k, []).append(p[2])
    gaps = []
    for (kx, ky), zs in cols.items():
        loc, nor, _, _ = body.ray_cast(Vector((kx / 100, ky / 100, 2.0)), Vector((0, 0, -1)))
        if loc is None or loc.z < 1.2 or nor.z < 0.6: continue
        acima = [z - loc.z for z in zs if z - loc.z > -0.06]
        if acima: gaps.append(min(acima))
    return float(np.percentile(gaps, 5)), len(gaps)

# 2)+3) desce e centraliza em profundidade, alternando (um mexe no outro)
P[:, 2] += PESCOCO[2] + 0.19 - P[:, 2].max()   # chute: topo da gola ~19 cm acima do pescoço
for it in range(4):
    dy = meio_y(BP, 1.12, 1.30, 0.14) - meio_y(P, 1.12, 1.30, 0.19)
    P[:, 1] += dy
    g, n = apoio(P)
    dz = FOLGA_OMBRO - g
    P[:, 2] += dz
    print(f"passo {it}: dy {dy*100:+.1f} cm  dz {dz*100:+.1f} cm  ({n} colunas no ombro)")

print(f"barra em z={P[:, 2].min():.3f}  topo da gola z={P[:, 2].max():.3f}")
off = 0
for o, n in zip(cloth, sizes):
    o.data.vertices.foreach_set("co", P[off:off + n].ravel()); o.data.update(); off += n
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_extras=True)
