# VESTRA ROOM — alinha a Boxy Tee 01 ao avatar automaticamente.
# 1) endireita (giro em Z medido pelas mangas; inclinação pela costura lateral)
# 2) escala e centraliza no pescoço  3) centraliza em profundidade
# 4) apoia nos ombros  5) testa combinações e fica com a que menos deixa o
#    corpo atravessar o tecido.
# Os nomes das malhas (gola, painéis, mangas) e o giro são os do arquivo
# boxy_tee_01.glb; outra camiseta precisa conferir esses valores.
#
# Uso: blender -b -P alinhar_camiseta.py -- corpo.glb camiseta.glb saida.glb
# (corpo: o avatar original, braços abertos — ver scripts/molde/README.md)
import bpy, math, sys, itertools
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
CORPO, IN, OUT = sys.argv[sys.argv.index("--") + 1:][:3]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=CORPO)
av = bpy.data.objects["AvatarBase"]
BP = np.array([av.matrix_world @ v.co for v in av.data.vertices])
BN = np.array([(av.matrix_world.to_3x3() @ v.normal).normalized() for v in av.data.vertices])
body_tree = BVHTree.FromPolygons([Vector(p) for p in BP], [p.vertices[:] for p in av.data.polygons])
bpy.ops.import_scene.gltf(filepath=IN)
root = bpy.data.objects["Sketchfab_model"]
meshes = [o for o in bpy.data.objects if o.type == "MESH" and o != av]
M0 = root.matrix_world.copy()
LOCAL = {o.name: np.array([v.co for v in o.data.vertices]) for o in meshes}
def world(names, W):
    out = []
    for o in meshes:
        if o.name in names:
            rel = (root.matrix_world.inverted() @ o.matrix_world)  # filho -> raiz
            m = np.array(W @ rel)
            P = LOCAL[o.name]; out.append(P @ m[:3,:3].T + m[:3,3])
    return np.vstack(out)
COL = ("Object_6", "Object_8"); PAN = ("Object_10", "Object_14")
cc = Vector(world(COL, M0).mean(0))
NECK = Vector((0.0, -0.025, 1.42))
# pele do tronco a checar (0,95–1,45 m, sem braços)
chk = np.where((BP[:,2] > 0.95) & (BP[:,2] < 1.42) & (np.abs(BP[:,0]) < 0.17))[0][::3]

def place(tilt, S):
    R = Matrix.Rotation(math.radians(2.5), 4, "Y") @ Matrix.Rotation(math.radians(tilt), 4, "X") @ Matrix.Rotation(math.radians(28.8), 4, "Z")
    W = Matrix.Translation(NECK) @ Matrix.Scale(S, 4) @ R @ Matrix.Translation(-cc) @ M0
    sh = world(PAN, W)
    dys = []
    for z in np.arange(1.00, 1.26, 0.025):
        b = BP[(np.abs(BP[:,2] - z) < 0.006) & (np.abs(BP[:,0]) < 0.14)]
        t = sh[np.abs(sh[:,2] - z) < 0.006]
        if len(b) and len(t):
            dys.append((b[:,1].min() + b[:,1].max()) / 2 - (t[:,1].min() + t[:,1].max()) / 2)
    dy = float(np.median(dys)); sh[:,1] += dy
    sel = sh[(np.abs(sh[:,0]) > 0.10) & (np.abs(sh[:,0]) < 0.16)]
    cols = {}
    for p in sel:
        k = (round(p[0] * 100), round(p[1] * 100))
        if p[2] > cols.get(k, -9): cols[k] = p[2]
    gaps = []
    for (kx, ky), z in cols.items():
        hit = body_tree.ray_cast(Vector((kx / 100, ky / 100, 1.9)), Vector((0, 0, -1)))
        if hit[0] is not None and hit[0].z > 1.2: gaps.append(z - hit[0].z)
    dz = 0.006 - float(np.percentile(gaps, 2))
    return Matrix.Translation((0, dy, dz)) @ W

def exposed(W):
    t = world(PAN + ("Object_18", "Object_20"), W)
    faces = []; off = 0; verts = []
    for o in meshes:
        if o.name in PAN + ("Object_18", "Object_20"):
            faces += [[i + off for i in p.vertices] for p in o.data.polygons]; off += len(o.data.vertices)
    tree = BVHTree.FromPolygons([Vector(p) for p in t], faces)
    n = 0
    for i in chk:
        if tree.ray_cast(Vector(BP[i]), Vector(BN[i]), 0.25)[0] is None: n += 1
    return n

best = None
for tilt, S in itertools.product((0, 3, 6, 9.6), (0.90, 0.92, 0.95)):
    W = place(tilt, S); e = exposed(W)
    print(f"inclinação {tilt:4.1f}°  escala {S:.2f}  pele de fora {e}")
    if best is None or e < best[0]: best = (e, tilt, S, W)
print("ESCOLHIDO", best[:3])
root.matrix_world = best[3]
bpy.ops.object.select_all(action="DESELECT")
for o in [root] + list(root.children_recursive): o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True, export_extras=True)
