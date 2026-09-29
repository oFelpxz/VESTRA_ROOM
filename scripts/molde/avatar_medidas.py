# VESTRA ROOM — refaz as medidas de circunferência do avatar (peito, cintura,
# quadril) como "faixas" que crescem por igual ao redor do tronco, e mede a
# calibração em cm que o site usa.
#
# Por quê: as shape keys originais vieram de sliders do MakeHuman que não
# correspondem a circunferência (a de cintura era "barriga de grávida", a de
# peito mudava menos de 1 cm). Faixa radial: simétrica, suave, e funciona nos
# dois sentidos (peso negativo afina de verdade).
#
# Uso: blender -b -P avatar_medidas.py -- entrada.glb saida.glb
import bpy, sys, math, json
import numpy as np
from mathutils.geometry import convex_hull_2d

IN, OUT = sys.argv[sys.argv.index("--") + 1:][:2]
GANHO_CM = 30.0  # quanto cada medida em +1 aumenta a própria circunferência

# faixa: (altura do centro, largura da faixa, meia-largura do tronco onde
# começa a proteção dos braços, quanto cresce para os lados e quanto cresce
# para trás, ambos em relação à frente). Alturas em metros no corpo de
# referência. O peito cresce mais para frente: para os lados passaria dos
# ombros, e para trás viraria uma corcunda.
FAIXAS = {
    "chest": (1.21, 0.05, 0.15, 0.5, 0.35),
    "waist": (1.05, 0.06, 0.22, 1.0, 0.8),
    "hip": (0.90, 0.06, 0.24, 1.0, 1.0),
}
NIVEIS = {"chest": (1.24, 0.18), "waist": (1.05, 0.25), "hip": (0.90, 0.25)}
PROTECAO = 0.04  # a faixa some de x0 até x0 + 4 cm (braços/mãos ficam fora)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=IN)
av = bpy.data.objects["AvatarBase"]
M = np.array(av.matrix_world)
R, T = M[:3, :3], M[:3, 3]
kb = av.data.shape_keys.key_blocks
BL = np.array([d.co for d in kb["Basis"].data])  # espaço do objeto
BW = BL @ R.T + T                                  # mundo (Z para cima)


def circ(P, z, xmax):
    s = P[(np.abs(P[:, 2] - z) < 0.006) & (np.abs(P[:, 0]) < xmax)][:, :2]
    h = [s[i] for i in convex_hull_2d([tuple(p) for p in s])]
    return float(sum(np.linalg.norm(h[i] - h[i - 1]) for i in range(len(h))) * 100)


# centro do tronco em profundidade, fatia a fatia
zs = np.arange(0.70, 1.50, 0.01)
yc = []
for z in zs:
    s = BW[(np.abs(BW[:, 2] - z) < 0.006) & (np.abs(BW[:, 0]) < 0.15)]
    yc.append((s[:, 1].min() + s[:, 1].max()) / 2 if len(s) else np.nan)
yc = np.array(yc)
ok = ~np.isnan(yc)
yc = np.interp(zs, zs[ok], yc[ok])


def faixa(z0, sigma, x0, lados, costas):
    """Deslocamento (mundo) de cada vértice para a faixa com ganho 1."""
    g = np.exp(-0.5 * ((BW[:, 2] - z0) / sigma) ** 2)
    ax = np.abs(BW[:, 0])
    m = np.clip(1 - (ax - x0) / PROTECAO, 0, 1)
    m = m * m * (3 - 2 * m)  # suave
    c = np.interp(BW[:, 2], zs, yc)
    d = np.zeros_like(BW)
    d[:, 0] = BW[:, 0] * g * m * lados
    dy = BW[:, 1] - c  # frente é -Y
    d[:, 1] = dy * g * m * np.where(dy > 0, costas, 1.0)
    return d


def set_key(name, dW):
    dL = dW @ np.linalg.inv(R).T
    kb[name].data.foreach_set("co", (BL + dL).ravel())


for name, (z0, sig, x0, lados, costas) in FAIXAS.items():
    d = faixa(z0, sig, x0, lados, costas)
    zc, xm = NIVEIS[name]
    ganho = circ(BW + d, zc, xm) - circ(BW, zc, xm)  # cm por unidade
    set_key(name, d * (GANHO_CM / ganho))
    print(f"{name}: faixa refeita, escala {GANHO_CM / ganho:.3f}")

# calibração: circunferência base e quanto cada key muda cada nível (cm)
base = {n: round(circ(BW, z, x), 1) for n, (z, x) in NIVEIS.items()}
ganhos = {}
for k in ("weight", "chest", "waist", "hip"):
    P = np.array([d.co for d in kb[k].data]) @ R.T + T
    ganhos[k] = {n: round(circ(P, z, x) - base[n], 1) for n, (z, x) in NIVEIS.items()}
print("CALIBRACAO", json.dumps({"base": base, "ganhos": ganhos}))

bpy.ops.object.select_all(action="DESELECT")
av.select_set(True)
bpy.context.view_layer.objects.active = av
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True,
                          export_morph=True, export_apply=True)
