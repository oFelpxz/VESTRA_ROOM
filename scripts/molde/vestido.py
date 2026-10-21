# VESTRA ROOM — gera o molde do Vestido Slip Acetinado a partir do próprio
# avatar de referência, no mesmo esquema da saia (saia.py): um tubo de anéis
# do decote reto (logo acima do busto) até abaixo do joelho. O corpete
# acompanha o tronco com pouca folga e passa reto entre os seios e no vinco
# das costas; da cintura ao quadril assenta e, do quadril para baixo, abre num
# evasê leve, sem pregas, sem entrar nas pernas. Duas alcinhas finas passam
# por cima dos ombros. Sai com as marcas vestra_fit = "avatar_base" e
# vestra_peca = "baixo": no site o vestido segue a pele do cliente como as
# peças de baixo (src/lib/bottom-fit.ts).
#
# Uso: blender -b --factory-startup -P vestido.py -- avatar_base.glb saida.glb
import bpy, bmesh, sys
from math import cos, pi, sin
from mathutils import Vector
from mathutils.bvhtree import BVHTree

AVATAR, OUT = sys.argv[sys.argv.index("--") + 1:][:2]

# Alturas no corpo de referência (m, eixo Z do Blender; pés em 0).
NECK = 1.235         # decote: borda de cima do corpete (abaixo da axila)
WAIST = 0.985        # cintura: daqui para cima o raio sai de dentro do tronco
HEM = 0.38           # barra: abaixo do joelho
BODICE_EASE = 0.008  # folga do corpete
WAIST_EASE = 0.012
HIP_EASE = 0.016
FLARE = 0.11         # quanto o raio cresce por metro abaixo do quadril (evasê)
LEG_EASE = 0.02      # nunca mais perto que isso das pernas
SEG = 168            # pontos por anel
RING = 0.01          # distância entre anéis (m)
STRAP_X = 0.09       # alcinhas: distância do meio (m)
STRAP_W = 0.008      # largura (m)
STRAP_GAP = 0.003    # afastamento da pele (m)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=AVATAR)
src = next(o for o in bpy.data.objects if o.type == "MESH")
src.shape_key_clear()  # fica só o corpo de referência (Basis)

bm = bmesh.new()
bm.from_mesh(src.data)
bm.transform(src.matrix_world)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
# Corpo inteiro: o corpete e as alcinhas usam raios de dentro para fora (o
# primeiro ponto é o tronco; os braços ficam do lado de fora dele).
whole = BVHTree.FromBMesh(bm)

# Saia: corpo entre a barra e a cintura, só a parte ligada às pernas (sem as
# mãos), com raios de fora para dentro, como na saia.py.
for z, keep_below in ((WAIST + 0.02, True), (HEM - 0.03, False)):
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
lower = BVHTree.FromBMesh(bm)
crotch = min(v.co.z for v in bm.verts if abs(v.co.x) < 0.01)
hip_band = [v.co for v in bm.verts if abs(v.co.z - (crotch + 0.1)) < 0.01]
CY = sum(c.y for c in hip_band) / len(hip_band)  # meio do corpo (frente/costas)
bm.free()
bpy.data.objects.remove(src)

def skin_radius(z, a):
    """Raio da pele na direção `a`: de dentro do tronco acima da cintura, de fora abaixo."""
    d = Vector((cos(a), sin(a), 0))
    c = Vector((0, CY, z))
    if z > WAIST:
        hit, _, _, _ = whole.ray_cast(c, d, 0.6)
    else:
        hit, _, _, _ = lower.ray_cast(c + d * 0.6, -d, 0.6)
    if hit is None:
        return 0.0
    return (Vector((hit.x, hit.y)) - Vector((0, CY))).length

def bridge(radii, width):
    """O tecido passa reto por cima das reentrâncias (entre os seios, vinco das costas)."""
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
z = NECK
while z > HEM:
    heights.append(z)
    z -= RING
heights.append(HEM)

def ring_size(z):
    return sum(skin_radius(z, a) for a in angles[::6])
HIP_Z = max((z for z in heights if crotch < z < WAIST - 0.04), key=ring_size)
hip_r = bridge([skin_radius(HIP_Z, a) for a in angles], 10)

# Perto da axila o tronco já começa a virar braço: nos lados, o corpete não
# abre mais que a largura logo abaixo (SIDE_Z).
SIDE_Z = 1.19
side_cap = bridge([skin_radius(SIDE_Z, a) for a in angles], 18)

rings = []
for z in heights:
    skins = bridge([skin_radius(z, a) for a in angles], 18 if z > WAIST else 10)
    if z > SIDE_Z:
        skins = [min(r, side_cap[j] + 0.004) if abs(cos(angles[j])) > 0.6 else r
                 for j, r in enumerate(skins)]
    row = []
    for j, a in enumerate(angles):
        if z >= HIP_Z:
            # Corpete → cintura → quadril: a pele mais a folga de cada altura.
            ease = HIP_EASE + (WAIST_EASE - HIP_EASE) * smooth(HIP_Z, WAIST, z)
            ease += (BODICE_EASE - WAIST_EASE) * smooth(WAIST, WAIST + 0.08, z)
            r = skins[j] + ease
        else:
            r = max(hip_r[j] + HIP_EASE + FLARE * (HIP_Z - z), skins[j] + LEG_EASE)
        row.append((cos(a) * r, CY + sin(a) * r, z))
    rings.append(row)

# Suaviza na vertical: a troca de raio na cintura e o máximo com as pernas
# deixam quinas.
for _ in range(4):
    for i in range(1, len(rings) - 1):
        for j in range(SEG):
            p = [(rings[i - 1][j][k] + 2 * rings[i][j][k] + rings[i + 1][j][k]) / 4 for k in (0, 1)]
            rings[i][j] = (p[0], p[1], rings[i][j][2])

verts = [v for row in rings for v in row]
faces = []
for i in range(len(rings) - 1):
    for j in range(SEG):
        a, b = i * SEG + j, i * SEG + (j + 1) % SEG
        faces.append((a, b, b + SEG, a + SEG)[::-1])

# Alcinhas: no plano x = ±STRAP_X, raios de dentro do peito (z 1,30) para fora,
# da frente (para baixo) por cima do ombro até as costas. Começam um pouco
# abaixo do decote, escondidas por dentro do corpete.
STEPS = 120
for side in (1, -1):
    cols = []
    for x in (side * (STRAP_X - STRAP_W / 2), side * (STRAP_X + STRAP_W / 2)):
        c = Vector((x, CY, 1.30))
        col = []
        for s in range(STEPS + 1):
            phi = -0.35 * pi + 1.7 * pi * s / STEPS  # frente embaixo → topo → costas embaixo
            d = Vector((0, -cos(phi), sin(phi)))
            hit, _, _, dist = whole.ray_cast(c, d, 0.4)
            col.append(None if hit is None else c + d * (dist + STRAP_GAP))
        cols.append(col)
    keep = [s for s in range(STEPS + 1)
            if all(col[s] is not None and col[s].z > NECK - 0.015 for col in cols)]
    # Só o trecho contínuo que passa pelo topo do ombro.
    top = max(keep, key=lambda s: cols[0][s].z)
    run = [top]
    while run[0] - 1 in keep:
        run.insert(0, run[0] - 1)
    while run[-1] + 1 in keep:
        run.append(run[-1] + 1)
    base = len(verts)
    for s in run:
        verts.extend([tuple(cols[0][s]), tuple(cols[1][s])])
    for k in range(len(run) - 1):
        a = base + 2 * k
        f = (a, a + 1, a + 3, a + 2)
        faces.append(f if side > 0 else f[::-1])
    print(f"alcinha {side:+d}: {len(run)} pontos, topo {cols[0][top].z:.3f} m")

me = bpy.data.meshes.new("vestido")
me.from_pydata(verts, [], faces)
me.update()
obj = bpy.data.objects.new("Vestido", me)
bpy.context.scene.collection.objects.link(obj)
for p in me.polygons:
    p.use_smooth = True

mat = bpy.data.materials.new("Cetim")
mat.use_nodes = True
mat.use_backface_culling = False  # por dentro do decote e da barra também aparece
bsdf = mat.node_tree.nodes.get("Principled BSDF")
bsdf.inputs["Base Color"].default_value = (0.8, 0.8, 0.8, 1)
bsdf.inputs["Roughness"].default_value = 0.35  # acetinado: brilho suave
me.materials.append(mat)

bpy.context.scene["vestra_fit"] = "avatar_base"
bpy.context.scene["vestra_peca"] = "baixo"
print(f"MOLDE vestido: {len(me.vertices)} vértices · quadril {HIP_Z:.3f} m · entrepernas {crotch:.3f} m")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_extras=True, use_selection=False)
