# VESTRA ROOM — acrescenta ao avatar as shape keys "male" e "female": o corpo
# masculino e o feminino do MakeHuman, a partir do corpo neutro (o avatar é o
# neutro do MPFB, gênero 0,5). A diferença vem do próprio MPFB (gênero 1 e 0
# menos o neutro), então as outras medidas continuam valendo por cima.
#
# Precisa do MPFB instalado no Blender (Preferences → Get Extensions → MPFB;
# feito com a versão 2.0.17). Por isso roda SEM --factory-startup.
#
# O avatar veio de outra versão do MPFB e o busto difere até ~8 mm do neutro
# de hoje: cada vértice é ligado ao da malha do MPFB pela posição onde ela
# bate exata e, no resto, pela vizinhança na malha (mesma topologia).
#
# Uso: blender -b -P avatar_genero.py -- entrada.glb saida.glb
import bpy, sys, importlib, addon_utils
import numpy as np
from mathutils.kdtree import KDTree

IN, OUT = sys.argv[sys.argv.index("--") + 1:][:2]
GENEROS = {"male": 1.0, "female": 0.0}  # gênero no MPFB (0,5 = neutro)

bpy.ops.wm.read_factory_settings(use_empty=True)
addon_utils.enable("bl_ext.blender_org.mpfb", default_set=True)
mpfb = "bl_ext.blender_org.mpfb.services."
HumanService = importlib.import_module(mpfb + "humanservice").HumanService
TargetService = importlib.import_module(mpfb + "targetservice").TargetService

bpy.ops.import_scene.gltf(filepath=IN)
av = bpy.data.objects["AvatarBase"]
M = np.array(av.matrix_world)
R, T = M[:3, :3], M[:3, 3]
kb = av.data.shape_keys.key_blocks
BW = np.array([d.co for d in kb["Basis"].data]) @ R.T + T  # mundo (Z para cima)
TRIS = [p.vertices[:] for p in av.data.polygons]


def corpo_mpfb(genero):
    """Vértices (mundo) e faces do corpo do MPFB com esse gênero."""
    macros = TargetService.get_default_macro_info_dict()
    macros["gender"] = genero
    h = HumanService.create_human(macro_detail_dict=macros)
    me = h.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh()
    P = np.array([v.co[:] for v in me.vertices])
    F = [p.vertices[:] for p in me.polygons]
    bpy.data.objects.remove(h)
    return P, F


def ligar(A, N, faces):
    """Índice na malha do MPFB de cada vértice do avatar (que tem cópias nas
    costuras da textura)."""
    U, inv = np.unique(np.round(A, 6), axis=0, return_inverse=True)
    inv = inv.ravel()
    vizA = [set() for _ in U]  # vizinhos pelos triângulos do avatar
    for t in TRIS:
        w = inv[list(t)]
        for x in w:
            vizA[x].update(int(y) for y in w if y != x)
    vizN = [set() for _ in N]  # vértices que dividem uma face no MPFB
    for f in faces:
        for x in f:
            vizN[x].update(y for y in f if y != x)
    kd = KDTree(len(N))
    for i, p in enumerate(N):
        kd.insert(p, i)
    kd.balance()
    img = -np.ones(len(U), int)
    livres = set(range(len(N)))
    for j, p in enumerate(U):
        _, i, d = kd.find(p)
        if d < 1e-5 and i in livres:
            img[j] = i
            livres.discard(i)
    exatos = len(N) - len(livres)
    while (img < 0).any():
        faltam = np.where(img < 0)[0]
        opcoes = {}
        for j in faltam:
            conhecidos = [img[b] for b in vizA[j] if img[b] >= 0]
            if conhecidos:
                opcoes[j] = (set.intersection(*(vizN[k] for k in conhecidos)) & livres, len(conhecidos))
        # primeiro quem só tem uma opção; senão, o que tem mais vizinhos já
        # ligados vai para a opção mais perto
        unicos = [j for j, (c, _) in opcoes.items() if len(c) == 1]
        if unicos:
            for j in unicos:
                c = next(iter(opcoes[j][0]))
                if c in livres:
                    img[j] = c
                    livres.discard(c)
            continue
        com = [j for j, (c, _) in opcoes.items() if c]
        if not com:
            raise RuntimeError(f"{len(faltam)} vértices sem par na malha do MPFB")
        j = max(com, key=lambda j: opcoes[j][1])
        c = min(opcoes[j][0], key=lambda c: np.linalg.norm(N[c] - U[j]))
        img[j] = c
        livres.discard(c)
    # conferência: um par para cada vértice, e todo triângulo do avatar cai
    # numa face do MPFB
    assert len(np.unique(img)) == len(N), "ligação não é um para um"
    for t in TRIS:
        a, b, c = img[inv[list(t)]]
        assert b in vizN[a] and c in vizN[a] and c in vizN[b], "triângulo fora das faces"
    print(f"ligação: {exatos} vértices pela posição, {len(N) - exatos} pela malha")
    return img[inv]


neutro, faces = corpo_mpfb(0.5)
idx = ligar(BW, neutro, faces)
print(f"neutro do MPFB x avatar: até {np.abs(neutro[idx] - BW).max() * 1000:.1f} mm")
for nome, genero in GENEROS.items():
    P, _ = corpo_mpfb(genero)
    dW = P[idx] - neutro[idx]
    k = av.shape_key_add(name=nome, from_mix=False)
    k.data.foreach_set("co", ((BW + dW - T) @ np.linalg.inv(R).T).ravel())
    k.value = 0  # a key nova nasce em 1 e iria assim para o .glb
    alt = (P[:, 2].max() - P[:, 2].min()) - (neutro[:, 2].max() - neutro[:, 2].min())
    print(f"{nome}: até {np.linalg.norm(dW, axis=1).max() * 100:.1f} cm; altura {alt * 100:+.1f} cm")

bpy.ops.object.select_all(action="DESELECT")
av.select_set(True)
bpy.context.view_layer.objects.active = av
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True,
                          export_morph=True, export_apply=True)
