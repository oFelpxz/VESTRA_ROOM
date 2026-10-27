# VESTRA ROOM — gera o tênis do avatar do provador (sem ele o avatar ficava
# descalço). Não é produto: entra em todo look. Sai dos próprios pés do avatar
# de referência: o casco convexo de cada pé até o tornozelo, arredondado e
# afastado da pele (EASE), com a boca aberta num plano inclinado (mais baixa
# no calcanhar) e a sola um pouco mais larga que o cabedal. Atrás da biqueira
# o cabedal segue o peito do pé e a gola encosta no tornozelo (o casco puro
# ficava um tamanco); língua saindo da boca na frente, gola com borda virada
# para dentro, biqueira de borracha e cinco passadas de cadarço. Três malhas:
# "Cabedal" (lona, com o pesponto do site nas bordas), "Sola" (sola e
# biqueira) e "Cadarco".
# Marcas vestra_fit = "avatar_base" e vestra_peca = "calcado": no site o tênis
# segue a pele dos pés do cliente como as peças de baixo (src/lib/bottom-fit.ts).
#
# Uso: blender -b --factory-startup -P tenis.py -- avatar_base.glb saida.glb
import bpy, bmesh, sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree

AVATAR, OUT = sys.argv[sys.argv.index("--") + 1:][:2]

HULL_Z = 0.115       # pele abaixo disso entra no casco (m)
EASE = 0.006         # folga entre a pele e o tênis (m)
VOXEL = 0.004        # tamanho do remesh (m)
SMOOTH = 4           # passadas de alisamento do casco
# Boca: plano z = COLLAR_Z + COLLAR_SLOPE * (HEEL_Y - y). Blender: frente = -y.
HEEL_Y, COLLAR_Z, COLLAR_SLOPE = 0.03, 0.068, 0.25
SOLE_Z = 0.024       # altura da sola (m)
SOLE_OUT = 0.003     # sola mais larga que o cabedal (m)
TOE_BOX = 0.012      # biqueira: a frente sobe isso acima dos dedos (m)
COLLAR_EASE = 0.0025 # folga na boca: a gola encosta no tornozelo (m)
WRAP_Y = (-0.16, -0.12)  # da biqueira (frente) para trás o cabedal passa a seguir o pé
LIP = 0.004          # borda da gola virada para dentro (m)
TONGUE_UP, TONGUE_HALF, TONGUE_Y = 0.014, 0.017, -0.035  # língua: altura acima da boca, meia largura, até onde vai para trás
# Biqueira de borracha: plano que sobe de SOLE_Z em y = TOE_Y até TOE_H mais alto na ponta.
TOE_Y, TOE_SLOPE = -0.15, 0.35
LACE_Y, LACE_HALF, LACE_R = (-0.128, -0.08), 0.013, 0.0016  # cadarço: faixa do peito do pé, meia largura, raio

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=AVATAR)
src = next(o for o in bpy.data.objects if o.type == "MESH")
src.shape_key_clear()
skin = bmesh.new()
skin.from_mesh(src.data)
skin.transform(src.matrix_world)
skin.normal_update()
tree = BVHTree.FromBMesh(skin)
feet = [v.co.copy() for v in skin.verts if v.co.z < HULL_Z]
bpy.data.objects.remove(src)
# Frente do tornozelo (|x|): o meio dela é o meio da língua.
ankle = [Vector((abs(c.x), c.y, c.z)) for c in feet if 0.08 < c.z < 0.1 and c.y < -0.03]


def smooth(a, b, x):
    t = min(max((x - a) / (b - a), 0.0), 1.0)
    return t * t * (3 - 2 * t)


def collar_z(p):
    return COLLAR_Z + COLLAR_SLOPE * (HEEL_Y - p.y)


def ease_at(p):
    """Folga de 6 mm no pé, caindo para 2,5 mm nos últimos centímetros até a boca."""
    return EASE + (COLLAR_EASE - EASE) * smooth(collar_z(p) - 0.035, collar_z(p) - 0.005, p.z)


def above_collar(p):
    return p.z - collar_z(p)


def bisect(bm, co, no, clear=False, where=lambda c: True):
    """Corta pelo plano só as faces cujo centro `where` aceita (o resto fica sem lasca)."""
    faces = [f for f in bm.faces if where(f.calc_center_median())]
    geom = list({v for f in faces for v in f.verts}) + list({e for f in faces for e in f.edges}) + faces
    bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-6, plane_co=co, plane_no=no, clear_outer=clear)


def shoe(side):
    bm = bmesh.new()
    for co in feet:
        if co.x * side > 0:
            bm.verts.new(co)
            # Biqueira com volume: cópia mais alta do peito do pé e dos dedos.
            up = TOE_BOX * smooth(-0.06, -0.12, co.y) * smooth(0.012, 0.02, co.z)
            if up > 0:
                bm.verts.new(co + Vector((0, 0, up)))
    bmesh.ops.convex_hull(bm, input=bm.verts)
    me = bpy.data.meshes.new("casco")
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new("casco", me)
    bpy.context.scene.collection.objects.link(obj)
    # Casco de triângulos grandes → malha regular, inflada pela folga e
    # alisada de leve (o casco não entra entre os dedos).
    rem = obj.modifiers.new("remesh", "REMESH")
    rem.mode, rem.voxel_size = "VOXEL", VOXEL
    dg = bpy.context.evaluated_depsgraph_get()
    bm = bmesh.new()
    bm.from_object(obj, dg)
    bpy.data.objects.remove(obj)
    bpy.data.meshes.remove(me)
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * EASE
    for _ in range(SMOOTH):
        bmesh.ops.smooth_vert(bm, verts=bm.verts, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    # O casco passa reto do bico ao tornozelo (até 7 cm à frente do peito do
    # pé); atrás da biqueira o cabedal desce até a folga, que afina na boca.
    # Só o que olha para cima (o peito do pé) e a faixa da gola: as laterais
    # ficam do casco, senão o arco do pé afunda o cabedal perto da sola.
    bm.normal_update()
    moved = []
    for v in bm.verts:
        hit, n, _, _ = tree.find_nearest(v.co)
        top = smooth(0.15, 0.5, v.normal.z) * smooth(SOLE_Z + 0.01, SOLE_Z + 0.025, v.co.z)
        w = max(top, smooth(collar_z(v.co) - 0.03, collar_z(v.co) - 0.01, v.co.z)) * smooth(*WRAP_Y, v.co.y)
        if hit is not None and w > 0:
            v.co = v.co.lerp(hit + n * ease_at(v.co), w)
            moved.append(v)
    # Alisa só o que desceu (alisar a sola de novo amassava a linha dela).
    for _ in range(SMOOTH - 1):
        bmesh.ops.smooth_vert(bm, verts=moved, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.normal_update()
    for v in bm.verts:
        p = v.co
        # Nunca mais perto da pele que metade da folga.
        hit, n, _, d = tree.find_nearest(p)
        if hit is not None and (p - hit).dot(n) < 0.5 * ease_at(p):
            p = hit + n * (0.5 * ease_at(p))
        # Chão: sola reta (bico levantado deixaria os dedos à mostra).
        p.z = max(p.z, 0.0)
        v.co = p
    # Boca aberta acima do plano inclinado, menos a língua: tira o que passa
    # da altura da língua e corta a faixa dela (planos: bordas retas).
    cx = sum(c.x for c in ankle) / len(ankle) * side
    collar_no = (0, COLLAR_SLOPE, 1)
    bisect(bm, (0, HEEL_Y, COLLAR_Z + TONGUE_UP), collar_no, clear=True)
    bisect(bm, (0, HEEL_Y, COLLAR_Z), collar_no)
    # Os cortes da língua só acima da boca (descendo até a sola deixavam lascas).
    high = lambda c: above_collar(c) > -0.006
    bisect(bm, (cx - TONGUE_HALF, 0, 0), (1, 0, 0), where=high)
    bisect(bm, (cx + TONGUE_HALF, 0, 0), (1, 0, 0), where=high)
    bisect(bm, (0, TONGUE_Y, 0), (0, 1, 0), where=high)
    tongue = lambda c: abs(c.x - cx) < TONGUE_HALF and c.y < TONGUE_Y
    bmesh.ops.delete(
        bm, context="FACES",
        geom=[f for f in bm.faces if above_collar(f.calc_center_median()) > 0 and not tongue(f.calc_center_median())],
    )
    bmesh.ops.delete(bm, context="VERTS", geom=[v for v in bm.verts if not v.link_faces])
    # Gola com espessura: a borda dobra para dentro, rumo à pele, e desce.
    bm.normal_update()
    rim = [e for e in bm.edges if e.is_boundary]
    ret = bmesh.ops.extrude_edge_only(bm, edges=rim)
    for v in (g for g in ret["geom"] if isinstance(g, bmesh.types.BMVert)):
        hit, _, _, _ = tree.find_nearest(v.co)
        if hit is not None:
            v.co = v.co.lerp(hit, 0.7)
        v.co.z -= LIP
    # Linha da sola e da biqueira de borracha.
    bisect(bm, (0, 0, SOLE_Z), (0, 0, 1))
    # Só na ponta: atrás dela o plano passa rente ao chão e picava a sola.
    bisect(bm, (0, TOE_Y, SOLE_Z), (0, TOE_SLOPE, 1), where=lambda c: c.y < TOE_Y + 0.01)
    bm.normal_update()
    # Sola mais larga: empurra para fora (no plano do chão) o que fica abaixo.
    for v in bm.verts:
        out = Vector((v.normal.x, v.normal.y, 0))
        if out.length > 1e-6 and v.co.z < SOLE_Z + 1e-5:
            v.co += out.normalized() * SOLE_OUT * smooth(0, 0.006, v.co.z)
    return bm


def build(name, mat, keep):
    """Junta as partes dos dois pés que `keep(face)` aceita numa malha só."""
    out = bmesh.new()
    for bm in shoes:
        part = bm.copy()
        bmesh.ops.delete(part, geom=[f for f in part.faces if not keep(f)], context="FACES")
        tmp = bpy.data.meshes.new("tmp")
        part.to_mesh(tmp)
        out.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
        part.free()
    bmesh.ops.recalc_face_normals(out, faces=out.faces)
    me = bpy.data.meshes.new(name)
    out.to_mesh(me)
    out.free()
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(mat)
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return me


def material(name, rgb, rough):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.use_backface_culling = False
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1)
    bsdf.inputs["Roughness"].default_value = rough
    return m


def laces(bm):
    """Cinco passadas de cadarço sobre o peito do pé, encostadas no cabedal."""
    tree_shoe = BVHTree.FromBMesh(bm)
    bm.verts.ensure_lookup_table()
    side = 1 if bm.verts[0].co.x > 0 else -1
    out = []
    for i in range(5):
        y = LACE_Y[0] + (LACE_Y[1] - LACE_Y[0]) * i / 4
        hits = []
        for j in range(25):
            x = side * (0.14 + 0.1 * j / 24)
            loc, n, _, _ = tree_shoe.ray_cast(Vector((x, y, 0.3)), Vector((0, 0, -1)))
            if loc is not None:
                hits.append((loc, n))
        if not hits:
            continue
        # Passa pela crista do peito do pé (o ponto mais alto nessa altura).
        ridge = max(hits, key=lambda h: h[0].z)[0].x
        pts = []
        for k in range(7):
            x = ridge + LACE_HALF * (2 * k / 6 - 1)
            loc, n, _, _ = tree_shoe.ray_cast(Vector((x, y, 0.3)), Vector((0, 0, -1)))
            if loc is not None:
                n = n if n.z > 0 else -n
                pts.append(loc + n * (LACE_R * 1.1))
        if len(pts) < 2:
            continue
        cu = bpy.data.curves.new("cadarco", "CURVE")
        cu.dimensions = "3D"
        cu.bevel_depth, cu.bevel_resolution, cu.use_fill_caps = LACE_R, 2, True
        spl = cu.splines.new("POLY")
        spl.points.add(len(pts) - 1)
        for pt, co in zip(spl.points, pts):
            pt.co = (*co, 1)
        obj = bpy.data.objects.new("cadarco", cu)
        bpy.context.scene.collection.objects.link(obj)
        me = bpy.data.meshes.new_from_object(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()))
        bpy.data.objects.remove(obj)
        bpy.data.curves.remove(cu)
        out.append(me)
    return out


shoes = [shoe(1), shoe(-1)]
lace_meshes = [me for bm in shoes for me in laces(bm)]
# Borracha: abaixo da linha da sola e, na ponta, abaixo do plano da biqueira.
toe_cap = lambda c: c.y < TOE_Y and c.z - SOLE_Z < TOE_SLOPE * (TOE_Y - c.y)
is_sole = lambda f: f.calc_center_median().z < SOLE_Z or toe_cap(f.calc_center_median())
upper = build("Cabedal", material("Lona", (0.82, 0.81, 0.78), 0.9), lambda f: not is_sole(f))
sole = build("Sola", material("Sola", (0.93, 0.93, 0.92), 0.6), is_sole)
for bm in shoes:
    bm.free()
lace = bmesh.new()
for me in lace_meshes:
    lace.from_mesh(me)
    bpy.data.meshes.remove(me)
lace_me = bpy.data.meshes.new("Cadarco")
lace.to_mesh(lace_me)
lace.free()
for p in lace_me.polygons:
    p.use_smooth = True
lace_me.materials.append(material("Cadarco", (0.9, 0.9, 0.88), 0.8))
bpy.context.scene.collection.objects.link(bpy.data.objects.new("Cadarco", lace_me))
skin.free()

bpy.context.scene["vestra_fit"] = "avatar_base"
bpy.context.scene["vestra_peca"] = "calcado"
bpy.context.scene["vestra_tecido"] = "algodao"
print(f"MOLDE tenis: cabedal {len(upper.vertices)} · sola {len(sole.vertices)} · cadarço {len(lace_me.vertices)} vértices")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_extras=True, use_selection=False)
