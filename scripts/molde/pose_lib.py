# VESTRA ROOM — pose dos braços por esqueleto (skinning linear), em numpy.
#
# O Blender só é usado para calcular os pesos (quanto cada vértice segue cada
# osso, "bone heat"). A pose em si é aplicada aqui: assim cada shape key é
# posada com as articulações NO LUGAR DELA (uma pessoa alta dobra o braço no
# ombro dela, não no do corpo base).
#
# Coordenadas de mundo do Blender: Z para cima, frente = -Y, lado +X e -X.
import numpy as np

# Articulações do corpo de referência (lado +X; o -X é espelhado).
OMBRO = np.array([0.180, -0.020, 1.330])
COTOVELO = np.array([0.345, -0.045, 1.125])
PUNHO = np.array([0.458, -0.231, 0.985])
PONTA_MAO = np.array([0.525, -0.330, 0.880])

# Pose padrão do VESTRA FIT: braço 30° da vertical, antebraço quase reto.
POSE_PADRAO = {
    "braco": np.array([0.50, -0.08, -0.866]),
    "antebraco": np.array([0.40, -0.18, -0.90]),
}

RAIO_JUNTA = 0.05  # vértices usados para acompanhar a articulação por shape key


def pose_reta(abertura, frente):
    """Braço esticado (lado +X), `abertura` graus da vertical para fora e
    `frente` graus para a frente. Serve para posar o corpo na posição das
    mangas de uma roupa antes de encaixá-la."""
    a, f = np.radians(abertura), np.radians(frente)
    d = np.array([np.sin(a), -np.sin(f), -np.cos(a) * np.cos(f)])
    d /= np.linalg.norm(d)
    return {"braco": d, "antebraco": d}


def espelha(p):
    return p * np.array([-1.0, 1.0, 1.0])


def rot_alinha(a, b):
    """Rotação mínima que leva a direção a na direção b (Rodrigues)."""
    a = a / np.linalg.norm(a)
    b = b / np.linalg.norm(b)
    v = np.cross(a, b)
    c = float(np.dot(a, b))
    if np.linalg.norm(v) < 1e-9:
        return np.eye(3)
    k = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + k + k @ k * (1 / (1 + c))


def juntas_para(base, P, lado):
    """Articulações acompanhando a malha P (média do deslocamento em volta)."""
    out = []
    for j in (OMBRO, COTOVELO, PUNHO):
        j = j if lado > 0 else espelha(j)
        near = np.linalg.norm(base - j, axis=1) < RAIO_JUNTA
        out.append(j + (P[near] - base[near]).mean(0))
    return out


def _rotacoes(juntas_lado, pose, lado):
    S, E, W = juntas_lado
    m = np.array([1, 1, 1]) if lado > 0 else np.array([-1, 1, 1])
    Ru = rot_alinha(E - S, pose["braco"] * m)
    E2 = S + Ru @ (E - S)                         # cotovelo depois de girar o braço
    W2 = S + Ru @ (W - S)
    Rf = rot_alinha(W2 - E2, pose["antebraco"] * m)   # antebraço, girando no cotovelo novo
    return S, Ru, E2, Rf


def juntas_posadas(juntas, pose=POSE_PADRAO):
    """Ombro, cotovelo e punho de cada lado depois de posar."""
    out = {}
    for lado in (1, -1):
        S, Ru, E2, Rf = _rotacoes(juntas[lado], pose, lado)
        W = juntas[lado][2]
        out[lado] = (S, E2, E2 + Rf @ (S + Ru @ (W - S) - E2))
    return out


def posar(P, juntas, pesos, pose=POSE_PADRAO):
    """
    P: vértices a posar (N×3, mundo); juntas: dict lado -> (ombro, cotovelo,
    punho) do corpo em que P está (ver juntas_para); pesos: dict lado -> (N×2)
    pesos [braço, antebraço+mão]. Retorna P posado. O que sobra do peso fica
    com o tronco (parado).
    """
    out = P.copy()
    for lado in (1, -1):
        S, Ru, E2, Rf = _rotacoes(juntas[lado], pose, lado)
        wu, wf = pesos[lado][:, 0], pesos[lado][:, 1]
        pu = (P - S) @ Ru.T + S                   # como se tudo seguisse o braço
        pf = ((pu - E2) @ Rf.T) + E2              # ... e depois o antebraço
        out += wu[:, None] * (pu - P) + wf[:, None] * (pf - P)
    return out
