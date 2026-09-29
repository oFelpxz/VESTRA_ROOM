# VESTRA ROOM — leva uma roupa encaixada numa pose (braços abertos do avatar
# original, ou a pose das mangas de um moletom) para a pose padrão: cada vértice
# da roupa copia o peso de braço/antebraço dos vértices do corpo mais próximos
# e recebe a mesma pose do avatar.
#
# Uso: blender -b -P posar_roupa.py -- roupa.glb pesos.npz saida.glb [abertura,frente]
#   sem abertura,frente: a roupa está no corpo original (braços abertos);
#   com: a roupa foi encaixada no corpo posado assim (avatar_pose.py) e é
#   tratada como peça de painéis (manga longa, ver pesos_por_painel).
import bpy, sys, os
import numpy as np
from mathutils.kdtree import KDTree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pose_lib import juntas_para, juntas_posadas, pose_reta, posar

ARGS = sys.argv[sys.argv.index("--") + 1:]
IN, NPZ, OUT = ARGS[:3]
VIZINHOS, RAIO = 16, 0.03
COSTURA = 0.012          # bordas de painéis a menos disso são a mesma costura (m)
AXILA = 1.24             # altura da axila do corpo de referência (m)
EMBOLA = 0.14            # trecho da manga antes do pulso que absorve o excesso (m)
FOLGA_PUNHO = 0.02       # o punho termina isso depois do pulso (m)
PUNHO_RAIO = 0.05        # raio mínimo do punho fechado (m)
z = np.load(NPZ)
base = z["base"]
pesos_corpo = {
    1: np.stack([z["upper_L"], z["fore_L"]], 1),
    -1: np.stack([z["upper_R"], z["fore_R"]], 1),
}
juntas0 = {s: juntas_para(base, base, s) for s in (1, -1)}
PAINEIS = len(ARGS) > 3
corpo = posar(base, juntas0, pesos_corpo, pose_reta(*map(float, ARGS[3].split(",")))) if PAINEIS else base
juntas = {s: juntas_para(base, corpo, s) for s in (1, -1)}


def kdtree(pts):
    kd = KDTree(len(pts))
    for i, p in enumerate(pts): kd.insert(p, i)
    kd.balance()
    return kd


def transferir(P, pts, pesos_pts):
    """Média gaussiana dos pesos dos VIZINHOS pontos do corpo mais próximos."""
    kd = kdtree(pts)
    idx = np.zeros((len(P), VIZINHOS), int); dist = np.zeros((len(P), VIZINHOS))
    for i, p in enumerate(P):
        for j, (_, k, d) in enumerate(kd.find_n(p, VIZINHOS)):
            idx[i, j] = k; dist[i, j] = d
    s = np.maximum(dist[:, :1], RAIO)
    w = np.exp(-((dist / s) ** 2)); w /= w.sum(1, keepdims=True)
    return (pesos_pts[idx] * w[..., None]).sum(1)


def ilhas(me):
    par = np.arange(len(me.vertices))
    def raiz(a):
        while par[a] != a:
            par[a] = par[par[a]]; a = par[a]
        return a
    for e in me.edges:
        a, b = raiz(e.vertices[0]), raiz(e.vertices[1])
        if a != b: par[a] = b
    return np.unique([raiz(i) for i in range(len(par))], return_inverse=True)[1].ravel()


def pesos_por_painel(me, P):
    """
    Roupa de painéis (manga longa encaixada com o braço quase colado no
    corpo): o lado de dentro da manga fica mais perto do tronco ou da coxa do
    que do braço e copiaria peso zero (a manga rasga e abre em sino). Então:
    1) cada painel grande é classificado (manga esquerda, direita ou tronco)
       pela mediana do peso copiado; os pequenos (laterais, faixas, punhos)
       ficam com a classe de quem está costurado neles;
    2) vértices de manga copiam só dos vértices de braço do corpo, e o tronco
       só acompanha o braço perto do ombro;
    3) bordas de painéis costurados recebem o mesmo peso, e o resto do painel
       é suavizado a partir delas.
    """
    lab = ilhas(me)
    n_ilhas = lab.max() + 1
    tam = np.bincount(lab, minlength=n_ilhas)

    # costuras: bordas de painéis diferentes a menos de COSTURA
    E = np.array([e.vertices[:] for e in me.edges])
    faces_por_aresta = {}
    for pol in me.polygons:
        for ek in pol.edge_keys: faces_por_aresta[ek] = faces_por_aresta.get(ek, 0) + 1
    borda = np.zeros(len(P), bool)
    for (a, b), c in faces_por_aresta.items():
        if c == 1: borda[a] = borda[b] = True
    ib = np.where(borda)[0]
    kdb = kdtree(P[ib])
    viz = {i: [ib[j] for _, j, _ in kdb.find_range(P[i], COSTURA)] for i in ib}
    costura = {}                                       # (ilha, ilha) -> nº de vértices
    for i, vs in viz.items():
        for k in {lab[j] for j in vs} - {lab[i]}:
            costura[(lab[i], k)] = costura.get((lab[i], k), 0) + 1

    # 1) classes
    geral = {s: transferir(P, corpo, pesos_corpo[s]) for s in (1, -1)}
    classe = np.full(n_ilhas, 9)                       # 0 tronco, 1 / -1 manga, 9 = ?
    for k in np.where(tam >= 300)[0]:
        classe[k] = 0
        for s in (1, -1):
            if np.median(geral[s][lab == k].sum(1)) > 0.5: classe[k] = s
    mudou = True
    while mudou:
        mudou = False
        for k in np.where(classe == 9)[0]:
            votos = {}
            for (a, b), c in costura.items():
                if a == k and classe[b] != 9: votos[classe[b]] = votos.get(classe[b], 0) + c
            if votos:
                classe[k] = max(votos, key=votos.get); mudou = True
    soltas = np.where(classe == 9)[0]                  # sem costura (cordões): o mais perto
    if len(soltas):
        ok = classe[lab] != 9
        kd = kdtree(P[ok]); lab_ok = lab[ok]
        for k in soltas:
            votos = [classe[lab_ok[kd.find(p)[1]]] for p in P[lab == k]]
            classe[k] = max(set(votos), key=votos.count)
    cls = classe[lab]
    print("painéis:", {c: int((classe == c).sum()) for c in (0, 1, -1)}, "vértices de manga:", int((cls != 0).sum()))

    # 2) pesos
    pesos = {s: geral[s].copy() for s in (1, -1)}
    # tronco: com o braço colado, a mão fica ao lado do quadril; só perto do
    # ombro o tronco acompanha o braço (some até AXILA - 12 cm)
    queda = np.clip((P[:, 2] - (AXILA - 0.12)) / 0.12, 0, 1)
    for s in (1, -1):
        t = cls == 0
        pesos[s][t, 0] *= queda[t]
        pesos[s][t, 1] = 0
        braco = pesos_corpo[s].sum(1) > 0.02
        m = cls == s
        pesos[s][m] = transferir(P[m], corpo[braco], pesos_corpo[s][braco])

    # 3) costuras com o mesmo peso. Manga e tronco só se costuram na cava
    # (perto do ombro); mais abaixo, o punho encosta na barra na pose de
    # encaixe mas não é costura
    ombro = [juntas[s][0] for s in (1, -1)]
    def cava(i):
        return min(np.linalg.norm(P[i] - o) for o in ombro) < 0.25
    grupos = []
    for i, vs in viz.items():
        vs = [j for j in vs if cls[j] == cls[i] or cava(i)]
        if len({lab[j] for j in vs}) > 1: grupos.append(vs)
    presos = np.zeros(len(P), bool)
    for _ in range(3):
        for s in (1, -1):
            W = pesos[s]
            for g in grupos: W[g] = W[g].mean(0)
    for g in grupos: presos[g] = True
    print("vértices de costura entre painéis:", int(presos.sum()))

    # suaviza cada painel (pelas arestas) mantendo as costuras
    grau = np.bincount(E.ravel(), minlength=len(P)).astype(float); grau[grau == 0] = 1
    for s in (1, -1):
        W = pesos[s]
        for _ in range(40):
            soma = np.zeros_like(W)
            np.add.at(soma, E[:, 0], W[E[:, 1]]); np.add.at(soma, E[:, 1], W[E[:, 0]])
            novo = 0.5 * W + 0.5 * soma / grau[:, None]
            W = np.where(presos[:, None], W, novo)
        pesos[s] = W
    return pesos, cls


def punho_no_pulso(Q, cls):
    """
    Punho de ribana fica preso no pulso: quando a manga passa do pulso (pessoa
    de braço curto no tamanho), o excesso embola no antebraço em vez de cobrir
    a mão. Comprime a manga ao longo do antebraço, de EMBOLA antes do pulso
    até a ponta, para terminar FOLGA_PUNHO depois dele.
    """
    for s, (S, E, W) in juntas_posadas(juntas).items():
        m = cls == s
        d = (W - E) / np.linalg.norm(W - E)
        t = (Q[m] - W) @ d                          # distância além do pulso
        fim = t.max()
        if fim <= FOLGA_PUNHO: continue
        k = (EMBOLA + FOLGA_PUNHO) / (EMBOLA + fim)
        novo = np.where(t > -EMBOLA, -EMBOLA + (t + EMBOLA) * k, t)
        Q[m] += (novo - t)[:, None] * d
        # e fecha em volta do pulso (a ribana aperta), sem passar de PUNHO_RAIO
        q = Q[m]
        eixo = W + np.outer((q - W) @ d, d)
        radial = q - eixo
        r = np.linalg.norm(radial, axis=1)
        f = np.clip((novo + 0.06) / (FOLGA_PUNHO + 0.06), 0, 1)       # 0 → 1 perto do punho
        alvo = np.maximum(r * 0.7, PUNHO_RAIO)
        r2 = np.where(r > alvo, r + (alvo - r) * f, r)
        Q[m] = eixo + radial * (r2 / np.maximum(r, 1e-9))[:, None]
        print(f"manga {'E' if s > 0 else 'D'}: passava {fim*100:.0f} cm do pulso; embolada até {FOLGA_PUNHO*100:.0f} cm")
    return Q


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=IN)
for o in [o for o in bpy.data.objects if o.type == "MESH"]:
    mw = o.matrix_world.copy()
    P = np.array([mw @ v.co for v in o.data.vertices])
    if PAINEIS:
        pesos, cls = pesos_por_painel(o.data, P)
        Q = punho_no_pulso(posar(P, juntas, pesos), cls)
    else:
        pesos = {s: transferir(P, corpo, pesos_corpo[s]) for s in (1, -1)}
        Q = posar(P, juntas, pesos)
    # quanto cada vértice é manga, com o sinal do lado: no site a manga
    # cresce/encolhe por tamanho em volta do braço e fica fora do caimento
    # do tronco (dressed-avatar.tsx, garment-fit.ts)
    wl, wr = pesos[1].sum(1).clip(0, 1), pesos[-1].sum(1).clip(0, 1)
    a = o.data.attributes.new("_braco", "FLOAT", "POINT")
    a.data.foreach_set("value", np.where(wl >= wr, wl, -wr))
    inv = np.array(mw.inverted())
    o.data.vertices.foreach_set("co", (Q @ inv[:3, :3].T + inv[:3, 3]).ravel())
    o.data.update()
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_extras=True, export_attributes=True)
print("roupa posada:", OUT)
