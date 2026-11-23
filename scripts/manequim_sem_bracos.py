# VESTRA ROOM — manequim de vitrine (item 3D-04).
#
# Transforma o "AvatarBase" num manequim sem braços, como os de loja: corta
# cada braço na altura do ombro e fecha o corte. As mangas da roupa passam a
# cair do jeito que foram modeladas, sem braço atravessando o tecido. Também
# afina as axilas, como nos manequins de loja.
#
# Como usar: aba "Scripting" -> "New" -> colar -> Run (▶). Cmd+Z desfaz.

import math

import bmesh
import bpy

AVATAR_NAME = "AvatarBase"
CUT_X = 0.185        # distância do meio do corpo onde o braço é cortado (m)
CUT_Z = (0.70, 1.60)  # só nessa faixa de altura (não encosta em pés/cabeça)
# Abaixo desta altura o quadril chega perto de CUT_X; ali só sai o que está
# bem mais para fora (antebraço e mão).
HIP_TOP_Z = 1.00
HIP_SAFE_X = 0.25
# Axilas: entre essas alturas, o que passa de AXILA_X é puxado para dentro
# (AXILA_K = 0,3 → sobra 30% da largura além de AXILA_X).
AXILA_Z = (1.05, 1.42)
AXILA_X = 0.13
AXILA_K = 0.3


def is_arm(p):
    if not CUT_Z[0] < p.z < CUT_Z[1]:
        return False
    return abs(p.x) > (CUT_X if p.z > HIP_TOP_Z else HIP_SAFE_X)

avatar = bpy.data.objects.get(AVATAR_NAME)
if avatar is None:
    raise RuntimeError(f'Não achei o objeto "{AVATAR_NAME}" na cena.')

# Shape keys impedem apagar vértices com segurança; o manequim usa o corpo
# de referência (todas as medidas em zero), então elas não fazem falta.
if avatar.data.shape_keys:
    avatar.shape_key_clear()

mw = avatar.matrix_world
bm = bmesh.new()
bm.from_mesh(avatar.data)
doomed = [v for v in bm.verts if is_arm(mw @ v.co)]
bmesh.ops.delete(bm, geom=doomed, context="VERTS")

# Fecha só os dois buracos do corte, no ombro (a malha tem outras bordas
# abertas, que devem ficar como estão).
edges = [
    e for e in bm.edges
    if e.is_boundary and all(
        abs((mw @ v.co).x) > CUT_X - 0.04 and HIP_TOP_Z < (mw @ v.co).z < CUT_Z[1]
        for v in e.verts
    )
]
bmesh.ops.holes_fill(bm, edges=edges, sides=0)

# Afina a lateral do tronco na altura das axilas: sem isso ela aparece entre
# a manga e o corpo da roupa. Máximo no meio da faixa, suave nas pontas.
for v in bm.verts:
    p = mw @ v.co
    if AXILA_Z[0] < p.z < AXILA_Z[1] and abs(p.x) > AXILA_X:
        t = (p.z - AXILA_Z[0]) / (AXILA_Z[1] - AXILA_Z[0])
        k = 1 - (1 - AXILA_K) * math.sin(math.pi * t)
        p.x = math.copysign(AXILA_X + (abs(p.x) - AXILA_X) * k, p.x)
        v.co = mw.inverted() @ p

bm.to_mesh(avatar.data)
bm.free()
avatar.data.update()
print(f"manequim: {len(doomed)} vértices dos braços removidos")
