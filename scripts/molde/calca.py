# VESTRA ROOM — gera o molde de uma peça de baixo (calça ou bermuda cargo,
# calça wide) a partir do próprio avatar de referência: corta o corpo entre a
# cintura e a barra, afasta o tecido da pele (folga), deixa as pernas retas (ou
# largas, na wide), faz o cós e os bolsos laterais (só nas cargo). Sai nas mesmas coordenadas do avatar_base, com as marcas
# vestra_fit = "avatar_base" e vestra_peca = "baixo" (o site veste pela cintura
# e pelas pernas, ver src/lib/bottom-fit.ts).
#
# Uso: blender -b --factory-startup -P calca.py -- avatar_base.glb saida.glb calca|bermuda|wide
import bpy, bmesh, sys
from math import atan2, cos, sin
from mathutils import Vector
from mathutils.bvhtree import BVHTree

AVATAR, OUT, KIND = sys.argv[sys.argv.index("--") + 1:][:3]
assert KIND in ("calca", "bermuda", "wide")

# Alturas no corpo de referência (m, eixo Z do Blender; pés em 0).
TOP = 0.985                                  # cintura da calça (cós)
# barra: tornozelo (cargo) / quase no chão (wide) / acima do joelho (bermuda)
HEM = {"calca": 0.085, "wide": 0.035, "bermuda": 0.47}[KIND]
BAND = 0.045                                 # altura do cós
HIP_EASE = 0.014                             # folga no quadril
BAND_EASE = 0.008                            # o cós fica mais justo
LEG_EASE = 0.016                             # folga mínima nas pernas
# Perna reta: raio mínimo da perna (m) no joelho e na barra. Na wide a perna
# abre do joelho até a barra.
KNEE_Z = 0.47
LEG_R_KNEE = {"calca": 0.084, "wide": 0.1, "bermuda": 0.088}[KIND]
LEG_R_HEM = {"calca": 0.079, "wide": 0.122, "bermuda": 0.09}[KIND]
# As duas pernas largas não se cruzam: o lado de dentro para antes do meio.
INNER_GAP = 0.004
# Bolso cargo na lateral da coxa.
POCKET_Z = (0.50, 0.65) if KIND == "calca" else (0.52, 0.64)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=AVATAR)
src = next(o for o in bpy.data.objects if o.type == "MESH")
src.shape_key_clear()  # fica só o corpo de referência (Basis)

bm = bmesh.new()
bm.from_mesh(src.data)
bm.transform(src.matrix_world)
# O glTF chega separado nas costuras da UV: junta os vértices repetidos.
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)

def cut(z, keep_below):
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, z), plane_no=(0, 0, 1),
                           clear_outer=keep_below, clear_inner=not keep_below)

cut(TOP, keep_below=True)
cut(HEM, keep_below=False)

# Só a parte ligada que desce até a barra (quadril + pernas): mãos e braços
# cortados saem. (As mãos têm mais vértices que as pernas.)
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

me = bpy.data.meshes.new("calca")
bm.to_mesh(me)
bm.free()
obj = bpy.data.objects.new({"calca": "Calca", "wide": "Wide", "bermuda": "Bermuda"}[KIND], me)
bpy.context.scene.collection.objects.link(obj)
bpy.data.objects.remove(src)

# Malha mais lisa antes de dar forma.
bpy.context.view_layer.objects.active = obj
mod = obj.modifiers.new("sub", "SUBSURF")
mod.levels = 1
bpy.ops.object.modifier_apply(modifier="sub")

bm = bmesh.new()
bm.from_mesh(me)
bm.normal_update()
skin = [v.co.copy() for v in bm.verts]
normals = [v.normal.copy() for v in bm.verts]

# Entrepernas: ponto mais baixo do meio do corpo.
crotch = min(c.z for c in skin if abs(c.x) < 0.01)

# Centro de cada perna por faixa de altura (abaixo do entrepernas).
STEP = 0.01
centers = {}
for c in skin:
    if c.z >= crotch:
        continue
    k = (1 if c.x > 0 else -1, round(c.z / STEP))
    s = centers.setdefault(k, [0.0, 0.0, 0])
    s[0] += c.x; s[1] += c.y; s[2] += 1
def leg_center(side, z):
    k = round(z / STEP)
    for d in (0, 1, -1, 2, -2, 3, -3):
        s = centers.get((side, k + d))
        if s:
            return Vector((s[0] / s[2], s[1] / s[2]))
    return Vector((0.1 * side, -0.02))

def smooth(a, b, x):
    t = min(max((x - a) / (b - a), 0.0), 1.0)
    return t * t * (3 - 2 * t)

def leg_radius(z):
    if z >= KNEE_Z:
        return LEG_R_KNEE * (1 - smooth(KNEE_Z, crotch, z)) + 0.0
    t = (KNEE_Z - z) / max(KNEE_Z - HEM, 1e-6)
    return LEG_R_KNEE + (LEG_R_HEM - LEG_R_KNEE) * min(t, 1.0)

for v, c, n in zip(bm.verts, skin, normals):
    # Quadril: o tecido afasta da pele pela normal; o cós, menos.
    ease = HIP_EASE + (BAND_EASE - HIP_EASE) * smooth(TOP - BAND - 0.01, TOP - BAND + 0.005, c.z)
    hip = c + n * ease
    # Perna: tubo em volta do centro da perna, com raio mínimo (perna reta).
    side = 1 if c.x > 0 else -1
    ctr = leg_center(side, min(c.z, crotch - 0.005))
    d = Vector((c.x - ctr.x, c.y - ctr.y))
    r = d.length
    ang = atan2(d.y, d.x)
    r2 = max(r + LEG_EASE, leg_radius(c.z))
    leg = Vector((ctr.x + cos(ang) * r2, ctr.y + sin(ang) * r2, c.z))
    if KIND == "wide" and side * leg.x < INNER_GAP:
        leg.x = side * INNER_GAP
    # Do entrepernas para cima vale o quadril; abaixo, a perna.
    w = smooth(crotch - 0.07, crotch + 0.01, c.z)
    v.co = leg.lerp(hip, w)

# Degrau do cós: a borda de baixo dele salta um pouco para fora.
for v, c, n in zip(bm.verts, skin, normals):
    lift = 0.003 * (1 - smooth(0.0, 0.006, abs(c.z - (TOP - BAND))))
    v.co += n * lift

# Suaviza a forma (sem mexer nas bordas da cintura e da barra). No gancho
# (frente e costas, perto do meio) suaviza bem mais: o tecido passa reto por
# cima do vinco do corpo, em vez de marcar.
inner = [v for v in bm.verts if not v.is_boundary]
for _ in range(6):
    bmesh.ops.smooth_vert(bm, verts=inner, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
crotch_area = [v for v in inner if abs(v.co.x) < 0.075 and crotch - 0.06 < v.co.z < crotch + 0.16]
for _ in range(25):
    bmesh.ops.smooth_vert(bm, verts=crotch_area, factor=0.6, use_axis_x=True, use_axis_y=True, use_axis_z=True)
legs = [v for v in inner if v.co.z < crotch - 0.08]
for _ in range(10):
    bmesh.ops.smooth_vert(bm, verts=legs, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
bm.normal_update()

# Bolsos cargo: uma placa retangular na lateral de cada coxa, projetada no
# tecido (raio a partir do centro da perna) e um pouco para fora; a aba de
# cima sai mais.
tree = BVHTree.FromBMesh(bm)
pocket_faces = 0
def patch(side, z0, z1, a0, a1, out, nz=10, na=8):
    global pocket_faces
    grid = []
    for i in range(nz + 1):
        z = z0 + (z1 - z0) * i / nz
        ctr = leg_center(side, z)
        row = []
        for j in range(na + 1):
            a = a0 + (a1 - a0) * j / na
            d = Vector((cos(a) * side, sin(a), 0))
            o = Vector((ctr.x, ctr.y, z))
            hit, _, _, _ = tree.ray_cast(o, d)
            p = (hit if hit else o + d * 0.09) + d * out
            row.append(bm.verts.new(p))
        grid.append(row)
    for i in range(nz):
        for j in range(na):
            q = [grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]]
            bm.faces.new(q if side > 0 else q[::-1])
            pocket_faces += 1
for side in (1, -1) if KIND != "wide" else ():
    patch(side, POCKET_Z[0], POCKET_Z[1], -0.55, 0.55, 0.006)
    patch(side, POCKET_Z[1] - 0.035, POCKET_Z[1] + 0.004, -0.6, 0.6, 0.011, nz=3)
bm.normal_update()
bm.to_mesh(me)
bm.free()
me.update()
for p in me.polygons:
    p.use_smooth = True

mat = bpy.data.materials.new("Tecido")
mat.use_nodes = True
bsdf = mat.node_tree.nodes.get("Principled BSDF")
bsdf.inputs["Base Color"].default_value = (0.8, 0.8, 0.8, 1)
bsdf.inputs["Roughness"].default_value = 0.9
me.materials.append(mat)

bpy.context.scene["vestra_fit"] = "avatar_base"
bpy.context.scene["vestra_peca"] = "baixo"
print(f"MOLDE {KIND}: {len(me.vertices)} vértices · entrepernas {crotch:.3f} m · bolsos {pocket_faces} faces")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_extras=True, use_selection=False)
