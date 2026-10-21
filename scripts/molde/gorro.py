# VESTRA ROOM — gera o molde da Knit Beanie (touca de tricô) sobre a cabeça do
# avatar de referência. Uma calota que acompanha o crânio com a folga do
# tricô, um pouco mais alta no topo (a touca não fica colada), com nervuras
# verticais e a barra dobrada (mais grossa) logo acima das sobrancelhas e das
# orelhas. Sai com as marcas vestra_fit = "avatar_base" e
# vestra_peca = "acessorio": no site a touca segue a pele da cabeça do
# cliente como as peças de baixo seguem a do corpo (src/lib/bottom-fit.ts).
#
# Uso: blender -b --factory-startup -P gorro.py -- avatar_base.glb saida.glb
import bpy, bmesh, sys
from math import cos, pi, sin
from mathutils import Vector
from mathutils.bvhtree import BVHTree

AVATAR, OUT = sys.argv[sys.argv.index("--") + 1:][:2]

CENTER = Vector((0, -0.048, 1.57))  # meio da cabeça (Blender: frente = -y)
# Barra: plano inclinado, mais alta na testa que na nuca (m).
BRIM_Z, BRIM_SLOPE = 1.57, 0.21
EASE = 0.007         # folga do tricô
CROWN = 0.012        # sobra a mais no topo
CUFF = 0.045         # altura da barra dobrada (m, ao longo da cabeça)
CUFF_EXTRA = 0.005   # a dobra é mais grossa
RIBS = 48            # nervuras na volta toda
RIB = (0.0007, 0.0012)  # fundo da nervura: corpo / barra
SEG = RIBS * 4       # pontos por volta
ROWS = 44            # pontos do topo até a barra

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=AVATAR)
src = next(o for o in bpy.data.objects if o.type == "MESH")
src.shape_key_clear()
bm = bmesh.new()
bm.from_mesh(src.data)
bm.transform(src.matrix_world)
tree = BVHTree.FromBMesh(bm)
bm.free()
bpy.data.objects.remove(src)

def brim_z(p):
    return BRIM_Z - BRIM_SLOPE * (p.y - CENTER.y)

def smooth(a, b, x):
    t = min(max((x - a) / (b - a), 0.0), 1.0)
    return t * t * (3 - 2 * t)

columns = []
for j in range(SEG):
    phi = 2 * pi * j / SEG
    # Do topo para baixo, de dentro da cabeça para fora: a pele em cada direção.
    pts = []
    for k in range(181):
        th = pi * 0.75 * k / 180
        d = Vector((sin(th) * cos(phi), sin(th) * sin(phi), cos(th)))
        hit, _, _, dist = tree.ray_cast(CENTER, d, 0.3)
        if hit is None:
            continue
        p = CENTER + d * (dist + EASE + CROWN * max(cos(th), 0) ** 2)
        if pts and p.z < brim_z(p):
            # Corta exatamente na barra.
            a, b = pts[-1][1], p
            t = (a.z - brim_z(a)) / ((a.z - brim_z(a)) - (b.z - brim_z(b)))
            pts.append((th, a.lerp(b, t), d))
            break
        pts.append((th, p, d))
    # Reamostra por comprimento (pontos iguais em todas as colunas).
    acc = [0.0]
    for (_, a, _), (_, b, _) in zip(pts, pts[1:]):
        acc.append(acc[-1] + (b - a).length)
    total = acc[-1]
    col = []
    for r in range(ROWS + 1):
        s = total * r / ROWS
        i = max(k for k in range(len(acc)) if acc[k] <= s + 1e-9)
        i = min(i, len(pts) - 2)
        t = (s - acc[i]) / max(acc[i + 1] - acc[i], 1e-9)
        p = pts[i][1].lerp(pts[i + 1][1], t)
        out = (p - CENTER).normalized()
        from_hem = total - s
        cuff = smooth(CUFF + 0.004, CUFF - 0.002, from_hem)  # 0 no corpo, 1 na barra
        phase = (j % 4) / 4
        rib = RIB[0] + (RIB[1] - RIB[0]) * cuff
        p = p + out * (CUFF_EXTRA * cuff + rib * cos(2 * pi * phase) * min(1, s / 0.02))
        col.append(p)
    # Avesso da dobra: volta para dentro, rente à pele, dando espessura à barra.
    last = col[-1]
    col.append(last - (last - CENTER).normalized() * (EASE + CUFF_EXTRA - 0.002))
    columns.append(col)

n = len(columns[0])
verts = [tuple(columns[j][r]) for r in range(n) for j in range(SEG)]
faces = []
for r in range(n - 1):
    for j in range(SEG):
        a, b = r * SEG + j, r * SEG + (j + 1) % SEG
        faces.append((a, a + SEG, b + SEG, b))

me = bpy.data.meshes.new("gorro")
me.from_pydata(verts, [], faces)
me.update()
bmx = bmesh.new()
bmx.from_mesh(me)
bmesh.ops.remove_doubles(bmx, verts=bmx.verts, dist=1e-5)  # o topo vira um ponto só
bmesh.ops.recalc_face_normals(bmx, faces=bmx.faces)
bmx.to_mesh(me)
bmx.free()
obj = bpy.data.objects.new("Gorro", me)
bpy.context.scene.collection.objects.link(obj)
for p in me.polygons:
    p.use_smooth = True

mat = bpy.data.materials.new("Trico")
mat.use_nodes = True
mat.use_backface_culling = False
bsdf = mat.node_tree.nodes.get("Principled BSDF")
bsdf.inputs["Base Color"].default_value = (0.8, 0.8, 0.8, 1)
bsdf.inputs["Roughness"].default_value = 0.95
me.materials.append(mat)

bpy.context.scene["vestra_fit"] = "avatar_base"
bpy.context.scene["vestra_peca"] = "acessorio"
print(f"MOLDE gorro: {len(me.vertices)} vértices")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_extras=True, use_selection=False)
