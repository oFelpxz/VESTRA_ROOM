# VESTRA ROOM — solta uma peça pronta com gravidade em cima do corpo de
# referência (simulação de tecido do Blender) e grava onde cada ponto parou.
# O molde (saia.py, vestido.py, calca.py...) dá a forma "de cabide"; aqui a
# parte solta cai: as pregas da saia abrem, o cetim desce reto, a camiseta
# pesa dos ombros. A parte que veste o corpo (cós, ombros) fica presa.
#
# Não grava um .glb: grava um .bin com a posição de cada ponto antes e
# depois da queda (coordenadas do glTF, Y para cima), que o
# `scripts/aplicar-queda.ts` aplica no .glb original sem mexer em mais nada
# (marcas, tecido, UV e _BRACO continuam).
#
# Uso: blender -b --factory-startup -P cair.py -- avatar_base.glb peca.glb queda.bin modo
#   modo: saia | vestido | calca | bermuda | wide | camiseta | moletom
import bpy, bmesh, struct, sys
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
AVATAR, PECA, OUT, MODO = args[:4]

def smooth(a, b, x):
    t = min(max((x - a) / (b - a), 0.0), 1.0)
    return t * t * (3 - 2 * t)

# Tecido de cada modo (valores do Blender: massa em kg por ponto, rigidez) e
# quanto da peça fica presa: peso 1 = presa, 0 = solta. z em m (pés em 0).
MODOS = {
    # Sarja média; presa da cintura até o quadril (0,845 m), solta do quadril
    # para baixo. Mais pesado que isso o evasê fecha quase todo nas pregas.
    "saia": dict(mass=0.03, tension=30, shear=10, bending=1, frames=90,
                 pin=lambda co: smooth(0.80, 0.845, co.z)),
    # Cetim leve e mole; preso no corpete (acima da cintura) e nas alças.
    "vestido": dict(mass=0.02, tension=25, shear=5, bending=0.05, frames=110,
                    pin=lambda co: smooth(0.90, 0.985, co.z)),
    # Sarja da cargo; presa da cintura ao gancho e na barra (que já está
    # em cima do tênis). A perna entre as duas cede com o peso: o tecido se
    # apoia no joelho e franze um pouco acima da barra. Solta embaixo, a perna
    # balançava e torcia (foi o que acabou com a primeira Wide Denim).
    "calca": dict(mass=0.03, tension=40, compression=3, shear=10, bending=8, frames=80,
                  pin=lambda co: max(smooth(0.70, 0.77, co.z),
                                     1 - smooth(HEM + 0.02, HEM + 0.10, co.z)),
                  sobra=-0.03, onde=lambda co: 1 - smooth(HEM + 0.10, HEM + 0.30, co.z)),
    # Bermuda: mesma coisa, com a barra acima do joelho. Solta, a barra
    # amassava como papel.
    "bermuda": dict(mass=0.03, tension=40, compression=3, shear=10, bending=8, frames=70,
                    pin=lambda co: max(smooth(0.70, 0.77, co.z),
                                       1 - smooth(HEM + 0.02, HEM + 0.07, co.z)),
                    sobra=-0.02, onde=lambda co: 1 - smooth(HEM + 0.07, HEM + 0.20, co.z)),
    # Denim pesado da Wide Denim: mesma ideia da cargo, com a barra presa um
    # pouco mais alto e o denim mais mole na compressão, para a perna larga
    # "sanfonar" sobre o tênis. Sem os pés (a barra já passa por eles no
    # molde) e sem chão: a barra presa não chega lá.
    # `sobra`: o tecido fica esse tanto mais comprido (negativo = cresce) onde
    # `onde` dá 1, como a calça que é mais longa que a perna: entre os dois
    # pinos ele não cabe e franze.
    "wide": dict(mass=0.04, tension=60, compression=1.5, shear=20, bending=5, frames=90,
                 pin=lambda co: max(smooth(0.72, 0.80, co.z),
                                    1 - smooth(HEM + 0.03, HEM + 0.13, co.z)),
                 sobra=-0.07, onde=lambda co: 1 - smooth(HEM + 0.12, HEM + 0.40, co.z),
                 pe_z=0.12, chao=False),
    # Algodão; preso nos ombros e no peito, o resto cai. A camiseta tem
    # painéis em camadas (~1 mm) e costuras que não batem ponto a ponto:
    # tudo a menos de 3 mm vira um ponto só, e sem colisão consigo mesma
    # (as camadas se empurravam e o tecido amassava feito papel-alumínio).
    "camiseta": dict(mass=0.02, tension=30, shear=8, bending=0.5, frames=70,
                     pin=lambda co: smooth(1.30, 1.40, co.z),
                     unir=0.003, auto=False),
    # Moletom felpado do Hoodie Core: mais pesado e mais duro que a camiseta,
    # preso nos ombros e no capuz. Os painéis do CLO não se tocam nas emendas
    # (vão de até ~5 mm): unir a 5 mm fecha as costuras.
    "moletom": dict(mass=0.05, tension=40, shear=12, bending=4, frames=80,
                    pin=lambda co: smooth(1.28, 1.38, co.z),
                    unir=0.005, auto=False),
}
cfg = MODOS[MODO]
# Para testar valores sem editar: AJUSTE="mass=0.05,bending=2"
import os
for kv in filter(None, os.environ.get("AJUSTE", "").split(",")):
    k, v = kv.split("=")
    cfg[k] = float(v) if k != "frames" else int(v)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def importar(path):
    antes = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in antes and o.type == "MESH"]

# Corpo de referência (Basis) como obstáculo.
corpo = importar(AVATAR)
for o in corpo:
    if o.data.shape_keys:
        o.shape_key_clear()
    col = o.modifiers.new("col", "COLLISION").settings
    col.thickness_outer = 0.003
    col.cloth_friction = 5

# Sem os pés (calça larga): do tornozelo para baixo nada segura o tecido.
if cfg.get("pe_z"):
    for o in corpo:
        bm = bmesh.new()
        bm.from_mesh(o.data)
        pe = [v for v in bm.verts if (o.matrix_world @ v.co).z < cfg["pe_z"]]
        bmesh.ops.delete(bm, geom=pe, context="VERTS")
        bm.to_mesh(o.data)
        bm.free()

# Chão.
if cfg.get("chao", True):
    bpy.ops.mesh.primitive_plane_add(size=4, location=(0, 0, 0))
    chao = bpy.context.active_object
    chao.modifiers.new("col", "COLLISION").settings.thickness_outer = 0.002

# A peça vira uma malha só, com os pontos repetidos (costuras do glTF) unidos,
# para o tecido não abrir nas costuras durante a queda.
pecas = importar(PECA)
bm = bmesh.new()
for o in pecas:
    tmp = bmesh.new()
    tmp.from_mesh(o.data)
    tmp.transform(o.matrix_world)
    me = bpy.data.meshes.new("tmp")
    tmp.to_mesh(me)
    tmp.free()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
for o in pecas:
    bpy.data.objects.remove(o)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=cfg.get("unir", 1e-4))
me = bpy.data.meshes.new("peca")
bm.to_mesh(me)
bm.free()
obj = bpy.data.objects.new("Peca", me)
scene.collection.objects.link(obj)
rest = [v.co.copy() for v in me.vertices]
HEM = min(v.co.z for v in me.vertices)  # altura da barra (m), usada nos pinos

# Pedaços sem nenhum ponto preso (bolsos da cargo, costurados por cima da perna
# mas soltos na malha) cairiam até o chão: saem da simulação, e o
# `aplicar-queda.ts` move cada ponto deles junto com a perna mais perto.
bm = bmesh.new()
bm.from_mesh(me)
bm.verts.ensure_lookup_table()
visto = set()
soltos = []
for v in bm.verts:
    if v.index in visto:
        continue
    ilha, fila = [], [v]
    visto.add(v.index)
    while fila:
        a = fila.pop()
        ilha.append(a)
        for e in a.link_edges:
            b = e.other_vert(a)
            if b.index not in visto:
                visto.add(b.index)
                fila.append(b)
    if all(cfg["pin"](a.co) <= 0 for a in ilha):
        soltos += ilha
if soltos:
    bmesh.ops.delete(bm, geom=soltos, context="VERTS")
    bm.to_mesh(me)
    print(f"QUEDA: {len(soltos)} pontos de pedaços soltos ficam fora")
bm.free()
rest = [v.co.copy() for v in me.vertices]

grupo = obj.vertex_groups.new(name="pino")
for v in me.vertices:
    w = cfg["pin"](v.co)
    if w > 0:
        grupo.add([v.index], w, "REPLACE")

if "sobra" in cfg:
    onde = obj.vertex_groups.new(name="sobra")
    for v in me.vertices:
        onde.add([v.index], 1 - cfg["onde"](v.co), "REPLACE")

cloth = obj.modifiers.new("tecido", "CLOTH")
s = cloth.settings
if "sobra" in cfg:
    s.vertex_group_shrink = "sobra"
    # No Blender o peso 0 do grupo leva shrink_min e o 1, shrink_max (ao
    # contrário não funciona): o grupo guarda 1 - onde.
    s.shrink_min, s.shrink_max = cfg["sobra"], 0
s.quality = 10
s.mass = cfg["mass"]
s.tension_stiffness = s.compression_stiffness = cfg["tension"]
if "compression" in cfg:
    s.compression_stiffness = cfg["compression"]
s.shear_stiffness = cfg["shear"]
s.bending_stiffness = cfg["bending"]
s.air_damping = 2
s.tension_damping = s.compression_damping = s.shear_damping = 5
s.vertex_group_mass = "pino"
s.pin_stiffness = 1
c = cloth.collision_settings
c.distance_min = 0.003
c.use_self_collision = cfg.get("auto", True)
c.self_distance_min = 0.0015
c.collision_quality = 4

F = cfg["frames"]
scene.frame_start, scene.frame_end = 1, F
cloth.point_cache.frame_start, cloth.point_cache.frame_end = 1, F
for f in range(1, F + 1):
    scene.frame_set(f)

dg = bpy.context.evaluated_depsgraph_get()
fim = obj.evaluated_get(dg).data
assert len(fim.vertices) == len(rest)
mov = max((fim.vertices[i].co - rest[i]).length for i in range(len(rest)))

# glTF: (x, y, z) = Blender (x, z, -y).
with open(OUT, "wb") as fh:
    fh.write(struct.pack("<i", len(rest)))
    for lista in (rest, [v.co for v in fim.vertices]):
        for p in lista:
            fh.write(struct.pack("<3f", p.x, p.z, -p.y))
print(f"QUEDA {MODO}: {len(rest)} pontos · maior deslocamento {mov * 100:.1f} cm")
