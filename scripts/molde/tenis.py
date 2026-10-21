# VESTRA ROOM — gera o tênis do avatar do provador (sem ele o avatar ficava
# descalço). Não é produto: entra em todo look. Sai dos próprios pés do avatar
# de referência: o casco convexo de cada pé até o tornozelo, arredondado e
# afastado da pele (EASE), com a boca aberta num plano inclinado (mais baixa
# no calcanhar) e a sola um pouco mais larga que o cabedal. Duas malhas:
# "Cabedal" (lona, com o pesponto do site na boca e na sola) e "Sola".
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


def smooth(a, b, x):
    t = min(max((x - a) / (b - a), 0.0), 1.0)
    return t * t * (3 - 2 * t)


def collar_z(p):
    return COLLAR_Z + COLLAR_SLOPE * (HEEL_Y - p.y)


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
    bm.normal_update()
    for v in bm.verts:
        p = v.co
        # Nunca mais perto da pele que metade da folga.
        hit, n, _, d = tree.find_nearest(p)
        if hit is not None and (p - hit).dot(n) < EASE / 2:
            p = hit + n * (EASE / 2)
        # Chão: sola reta (bico levantado deixaria os dedos à mostra).
        p.z = max(p.z, 0.0)
        v.co = p
    # Boca aberta acima do plano inclinado.
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(
        bm, geom=geom, dist=1e-6,
        plane_co=(0, HEEL_Y, COLLAR_Z), plane_no=(0, COLLAR_SLOPE, 1), clear_outer=True,
    )
    # Linha da sola.
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-6, plane_co=(0, 0, SOLE_Z), plane_no=(0, 0, 1))
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


shoes = [shoe(1), shoe(-1)]
is_sole = lambda f: f.calc_center_median().z < SOLE_Z
upper = build("Cabedal", material("Lona", (0.82, 0.81, 0.78), 0.9), lambda f: not is_sole(f))
sole = build("Sola", material("Sola", (0.93, 0.93, 0.92), 0.6), is_sole)
for bm in shoes:
    bm.free()
skin.free()

bpy.context.scene["vestra_fit"] = "avatar_base"
bpy.context.scene["vestra_peca"] = "calcado"
bpy.context.scene["vestra_tecido"] = "algodao"
print(f"MOLDE tenis: cabedal {len(upper.vertices)} · sola {len(sole.vertices)} vértices")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_extras=True, use_selection=False)
