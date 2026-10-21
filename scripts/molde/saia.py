# VESTRA ROOM — gera o molde da saia midi plissada a partir do próprio avatar
# de referência. A saia é um tubo de anéis da cintura até o meio da canela:
# acima do quadril ela acompanha a pele (o cós mais justo); do quadril para
# baixo abre em evasê e não entra nas pernas. As pregas começam um pouco
# abaixo do quadril e abrem até a barra. Sai nas coordenadas do avatar_base,
# com as marcas vestra_fit = "avatar_base" e vestra_peca = "baixo" (o site
# veste pela cintura e pelas pernas, ver src/lib/bottom-fit.ts).
#
# Uso: blender -b --factory-startup -P saia.py -- avatar_base.glb saida.glb
import bpy, bmesh, sys
from math import cos, pi, sin
from mathutils import Vector
from mathutils.bvhtree import BVHTree

AVATAR, OUT = sys.argv[sys.argv.index("--") + 1:][:2]

# Alturas no corpo de referência (m, eixo Z do Blender; pés em 0).
TOP = 0.985          # cintura (cós)
HEM = 0.33           # barra: meio da canela
BAND = 0.04          # altura do cós
BAND_EASE = 0.006    # o cós fica justo
HIP_EASE = 0.014     # folga no quadril
FLARE = 0.16         # quanto o raio cresce por metro abaixo do quadril (evasê)
LEG_EASE = 0.02      # a saia nunca chega mais perto que isso das pernas
PLEATS = 28          # pregas na volta toda
PLEAT_DEPTH = (0.002, 0.011)  # fundo da prega: no quadril / na barra
SEG = PLEATS * 6     # pontos por anel
RING = 0.01          # distância entre anéis (m)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=AVATAR)
src = next(o for o in bpy.data.objects if o.type == "MESH")
src.shape_key_clear()  # fica só o corpo de referência (Basis)

# Corpo entre a barra e a cintura, só a parte ligada às pernas (as mãos e os
# braços cortados saem), para os raios não baterem nos braços.
bm = bmesh.new()
bm.from_mesh(src.data)
bm.transform(src.matrix_world)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
for z, keep_below in ((TOP + 0.02, True), (HEM - 0.03, False)):
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, z), plane_no=(0, 0, 1),
                           clear_outer=keep_below, clear_inner=not keep_below)
bm.verts.ensure_lookup_table()
seen, islands = set(), []
for v in bm.verts:
    if v in seen:
        continue
    stack, isl = [v], []
    seen.add(v)
    while stack:
        a = stack.pop()
        isl.append(a)
        for e in a.link_edges:
            b = e.other_vert(a)
            if b not in seen:
                seen.add(b)
                stack.append(b)
    islands.append(isl)
islands.sort(key=lambda isl: min(v.co.z for v in isl))
bmesh.ops.delete(bm, geom=[v for isl in islands[1:] for v in isl], context="VERTS")
tree = BVHTree.FromBMesh(bm)
crotch = min(v.co.z for v in bm.verts if abs(v.co.x) < 0.01)
# Centro do corpo (frente/costas) na altura do quadril.
hip_band = [v.co for v in bm.verts if abs(v.co.z - (crotch + 0.1)) < 0.01]
CY = sum(c.y for c in hip_band) / len(hip_band)
bm.free()
bpy.data.objects.remove(src)

def skin_radius(z, a):
    """Raio da pele mais de fora na direção `a` (0 se o raio passa direto)."""
    d = Vector((cos(a), sin(a), 0))
    o = Vector((0, CY, z)) + d * 0.6
    hit, _, _, _ = tree.ray_cast(o, -d, 0.6)
    if hit is None:
        return 0.0
    return (Vector((hit.x, hit.y)) - Vector((0, CY))).length

def bridge(radii, width=10):
    """O tecido passa reto por cima das reentrâncias (vinco dos glúteos)."""
    n = len(radii)
    out = list(radii)
    for j in range(n):
        for k in range(1, width + 1):
            out[j] = max(out[j], (radii[(j - k) % n] + radii[(j + k) % n]) / 2)
    return out

def smooth(a, b, x):
    t = min(max((x - a) / (b - a), 0.0), 1.0)
    return t * t * (3 - 2 * t)

angles = [2 * pi * j / SEG for j in range(SEG)]
heights = []
z = TOP
while z > HEM:
    heights.append(z)
    z -= RING
heights.append(HEM)

# Quadril: o anel mais largo entre o entrepernas e a cintura.
def ring_size(z):
    return sum(skin_radius(z, a) for a in angles[::6])
HIP_Z = max((z for z in heights if crotch < z < TOP - BAND), key=ring_size)
hip_r = bridge([skin_radius(HIP_Z, a) for a in angles])

rings = []
for z in heights:
    row = []
    skins = bridge([skin_radius(z, a) for a in angles])
    for j, a in enumerate(angles):
        skin = skins[j]
        if z >= HIP_Z:
            # Da cintura ao quadril: a pele mais a folga (o cós mais justo).
            ease = HIP_EASE + (BAND_EASE - HIP_EASE) * smooth(TOP - BAND - 0.01, TOP - BAND + 0.005, z)
            r = skin + ease
        else:
            # Abaixo do quadril: evasê a partir do quadril, sem entrar nas pernas.
            r = max(hip_r[j] + HIP_EASE + FLARE * (HIP_Z - z), skin + LEG_EASE)
        # Pregas: dente de serra na volta (a dobra é a quina), mais fundas na barra.
        t = smooth(HIP_Z - 0.02, HIP_Z - 0.12, z)
        depth = PLEAT_DEPTH[0] + (PLEAT_DEPTH[1] - PLEAT_DEPTH[0]) * smooth(HIP_Z, HEM, z)
        phase = (j % (SEG // PLEATS)) / (SEG // PLEATS)
        r += depth * t * (abs(phase - 0.5) * 2 - 0.5)
        # Degrau do cós.
        r += 0.003 * (1 - smooth(0.0, 0.006, abs(z - (TOP - BAND))))
        row.append((cos(a) * r, CY + sin(a) * r, z))
    rings.append(row)

# Suaviza o evasê na vertical (o máximo com as pernas deixa quinas).
for _ in range(4):
    for i in range(1, len(rings) - 1):
        if heights[i] >= HIP_Z:
            continue
        for j in range(SEG):
            p = [(rings[i - 1][j][k] + 2 * rings[i][j][k] + rings[i + 1][j][k]) / 4 for k in (0, 1)]
            rings[i][j] = (p[0], p[1], rings[i][j][2])

me = bpy.data.meshes.new("saia")
verts = [v for row in rings for v in row]
faces = []
for i in range(len(rings) - 1):
    for j in range(SEG):
        a, b = i * SEG + j, i * SEG + (j + 1) % SEG
        # Normais para fora (anéis de cima para baixo, ângulo crescente).
        faces.append((a, b, b + SEG, a + SEG)[::-1])
me.from_pydata(verts, [], faces)
me.update()
obj = bpy.data.objects.new("Saia", me)
bpy.context.scene.collection.objects.link(obj)
for p in me.polygons:
    p.use_smooth = True

mat = bpy.data.materials.new("Tecido")
mat.use_nodes = True
mat.use_backface_culling = False  # por dentro da barra também aparece
bsdf = mat.node_tree.nodes.get("Principled BSDF")
bsdf.inputs["Base Color"].default_value = (0.8, 0.8, 0.8, 1)
bsdf.inputs["Roughness"].default_value = 0.85
me.materials.append(mat)

bpy.context.scene["vestra_fit"] = "avatar_base"
bpy.context.scene["vestra_peca"] = "baixo"
print(f"MOLDE saia: {len(me.vertices)} vértices · quadril {HIP_Z:.3f} m · entrepernas {crotch:.3f} m")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_extras=True, use_selection=False)
