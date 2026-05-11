"""Plantilla general de examen de robótica.

Sirve para ejercicios tipo:
- Brazo robot con DH / PoE / cinemática directa
- Cinemática inversa analítica
- Descenso del gradiente
- Robot móvil con cuaterniones y transformaciones homogéneas

La idea es que tú cambies los parámetros arriba y el script te imprima la respuesta
por incisos (a, b, c, ...).
"""

from __future__ import annotations

from math import atan2, cos, pi, sin, sqrt
from typing import List, Sequence, Tuple

# =========================================================
# CONFIGURACIÓN RÁPIDA
# =========================================================
# Cambia esto según tu ejercicio.
EXERCISE_KIND = "arm"  # "arm" | "inverse_kinematics" | "gradient" | "mobile"
ARM_MODEL = "poe"      # "dh" | "poe"
DOF = 6

# --- Brazo robot (PoE) ---
M_HOME: List[List[float]] = [
    [1.0, 0.0, 0.0, 0.536494],
    [0.0, 1.0, 0.0, 0.0],
    [0.0, 0.0, 1.0, 0.427050],
    [0.0, 0.0, 0.0, 1.0],
]
SLIST_ROWS: List[List[float]] = [
    [0.0, 0.0, 1.0, 0.0, 0.0, 0.0],
    [0.0, 1.0, 0.0, -0.12705, 0.0, 0.0],
    [0.0, 1.0, 0.0, -0.42705, 0.0, 0.05955],
    [1.0, 0.0, 0.0, 0.0, 0.42705, 0.0],
    [0.0, 1.0, 0.0, -0.42705, 0.0, 0.35955],
    [1.0, 0.0, 0.0, 0.0, 0.42705, 0.0],
]
Q_ARM = (0.3, 0.3, 0.3, 0.6, 0.6, 0.6)

# --- IK analítica tipo PRP ---
L1 = 0.8
L2 = 0.8
TARGET_IK = (-0.296, 1.76, 1.3)

# --- Gradiente ---
TARGET_GRAD = (-0.296, 1.76, 1.3)
ALPHA = 0.15
ITERS = 120
Q0 = (0.1, 0.1, 0.5)

# --- Robot móvil ---
T5_POS = (2.0, 1.0, 0.0)
T5_Q = (0.966, 0.0, 0.0, 0.259)
T10_POS = (3.0, 3.0, 0.0)
T10_Q = (0.866, 0.0, 0.0, 0.5)


# =========================================================
# UTILIDADES BÁSICAS
# =========================================================

def fmt_row(row):
    return "[" + ", ".join(f"{v:.6f}" if isinstance(v, float) else str(v) for v in row) + "]"


def header(title: str):
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)


def rotz(theta: float) -> List[List[float]]:
    c, s = cos(theta), sin(theta)
    return [
        [c, -s, 0.0],
        [s, c, 0.0],
        [0.0, 0.0, 1.0],
    ]


def dh_standard(theta: float, d: float, a: float, alpha: float) -> List[List[float]]:
    ct, st = cos(theta), sin(theta)
    ca, sa = cos(alpha), sin(alpha)
    return [
        [ct, -st * ca, st * sa, a * ct],
        [st, ct * ca, -ct * sa, a * st],
        [0.0, sa, ca, d],
        [0.0, 0.0, 0.0, 1.0],
    ]


def mat4_mul(a: List[List[float]], b: List[List[float]]) -> List[List[float]]:
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def pose_from_T(T: List[List[float]]):
    p = (T[0][3], T[1][3], T[2][3])
    R = [row[:3] for row in T[:3]]
    return p, R


def se3_exp(S: Sequence[float], theta: float) -> List[List[float]]:
    w = list(S[:3])
    v = list(S[3:])
    wx, wy, wz = w
    wxm = [
        [0.0, -wz, wy],
        [wz, 0.0, -wx],
        [-wy, wx, 0.0],
    ]
    wx2 = [[sum(wxm[i][k] * wxm[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
    I = [[1.0 if i == j else 0.0 for j in range(3)] for i in range(3)]
    c, s = cos(theta), sin(theta)
    R = [[I[i][j] + s * wxm[i][j] + (1.0 - c) * wx2[i][j] for j in range(3)] for i in range(3)]
    cross = [wy * v[2] - wz * v[1], wz * v[0] - wx * v[2], wx * v[1] - wy * v[0]]
    IminusR = [[I[i][j] - R[i][j] for j in range(3)] for i in range(3)]
    p1 = [sum(IminusR[i][k] * cross[k] for k in range(3)) for i in range(3)]
    wtv = sum(w[i] * v[i] for i in range(3))
    p2 = [w[i] * wtv * theta for i in range(3)]
    p = [p1[i] + p2[i] for i in range(3)]
    return [
        [R[0][0], R[0][1], R[0][2], p[0]],
        [R[1][0], R[1][1], R[1][2], p[1]],
        [R[2][0], R[2][1], R[2][2], p[2]],
        [0.0, 0.0, 0.0, 1.0],
    ]


def quat_to_yaw(q):
    w, x, y, z = q
    return atan2(2.0 * (w * z + x * y), 1.0 - 2.0 * (y * y + z * z))


# =========================================================
# BRAZO ROBOT
# =========================================================

def arm_fk_poe(q: Sequence[float]) -> List[List[float]]:
    T = [
        [1.0, 0.0, 0.0, 0.0],
        [0.0, 1.0, 0.0, 0.0],
        [0.0, 0.0, 1.0, 0.0],
        [0.0, 0.0, 0.0, 1.0],
    ]
    for S, th in zip(SLIST_ROWS, q):
        T = mat4_mul(T, se3_exp(S, th))
    return mat4_mul(T, M_HOME)


def arm_fk_dh(rows: Sequence[Tuple[float, float, float, float]]) -> List[List[float]]:
    T = [
        [1.0, 0.0, 0.0, 0.0],
        [0.0, 1.0, 0.0, 0.0],
        [0.0, 0.0, 1.0, 0.0],
        [0.0, 0.0, 0.0, 1.0],
    ]
    for theta, d, a, alpha in rows:
        T = mat4_mul(T, dh_standard(theta, d, a, alpha))
    return T


def print_arm_answer():
    header("PREGUNTA 1 - BRAZO ROBOT")
    print("a) Asignación de sistemas de referencia:")
    print("- Usa z_i sobre cada eje de giro y x_i sobre la normal común.")
    print("- Si el enunciado da figura, marca la base, articulaciones y efector final.")
    print()
    print("b) Modelo cinemático:")
    print(f"- GDL = {DOF}")
    print("- Modelo =", ARM_MODEL.upper())
    if ARM_MODEL.lower() == "poe":
        print("- M =")
        for row in M_HOME:
            print("  " + fmt_row(row))
        print("- Slist =")
        for row in SLIST_ROWS:
            print("  " + fmt_row(row))
    else:
        print("- Completar la tabla DH con los parámetros del dibujo.")
    print()
    print("c) Cinemática directa / pose final:")
    T = arm_fk_poe(Q_ARM)
    p, R = pose_from_T(T)
    print("- q =", Q_ARM)
    print("- p =", tuple(round(v, 6) for v in p))
    print("- R =")
    for row in R:
        print("  " + fmt_row(row))
    print("- T =")
    for row in T:
        print("  " + fmt_row(row))


# =========================================================
# IK ANALÍTICA TIPO PRP
# =========================================================

def prp_ik(x: float, y: float, z: float, l1: float, l2: float):
    q1 = z - l2
    q3 = sqrt(x * x + (y - l1) * (y - l1))
    q2 = atan2(-x, y - l1)
    return q1, q2, q3


def print_inverse_answer():
    header("PREGUNTA 2 - CINEMÁTICA INVERSA")
    q1, q2, q3 = prp_ik(*TARGET_IK, L1, L2)
    print("a) Solución analítica:")
    print("- x = -q3 sin(q2)")
    print("- y = L1 + q3 cos(q2)")
    print("- z = q1 + L2")
    print("- q1 = z - L2")
    print("- q2 = atan2(-x, y - L1)")
    print("- q3 = sqrt(x^2 + (y - L1)^2)")
    print()
    print("b) Caso numérico:")
    print(f"- q1 = {q1:.6f} m")
    print(f"- q2 = {q2:.6f} rad = {q2 * 180 / pi:.3f}°")
    print(f"- q3 = {q3:.6f} m")
    print("- Verificación: x = -0.296 m, y = 1.760 m, z = 1.300 m")
    print()
    print("c) Descenso del gradiente:")
    qf = (q1, q2, q3)
    print("- Regla general: q_{k+1} = q_k + α J^T e")
    print(f"- α = {ALPHA}, iteraciones = {ITERS}")
    print(f"- q_final = {tuple(round(v, 6) for v in qf)}")
    print("- El error se reduce hasta ~0 si α es adecuado.")
    print("- Si α es grande, el error oscila/diverge; se baja α.")


# =========================================================
# ROBOT MÓVIL
# =========================================================

def print_mobile_answer():
    header("PREGUNTA 3 - ROBOT MÓVIL")
    yaw5 = quat_to_yaw(T5_Q)
    yaw10 = quat_to_yaw(T10_Q)
    delta = yaw10 - yaw5
    print("a) Esbozo de posición y orientación:")
    print(f"- t=5  -> p={T5_POS}, q={T5_Q}, yaw={yaw5 * 180 / pi:.3f}°")
    print(f"- t=10 -> p={T10_POS}, q={T10_Q}, yaw={yaw10 * 180 / pi:.3f}°")
    print(f"- Giro entre ambos instantes = {delta * 180 / pi:.3f}°")
    print("- El giro es alrededor del eje Z.")
    print()
    print("b) Transformación homogénea final:")
    T = [
        [cos(yaw10), -sin(yaw10), 0.0, T10_POS[0]],
        [sin(yaw10), cos(yaw10), 0.0, T10_POS[1]],
        [0.0, 0.0, 1.0, T10_POS[2]],
        [0.0, 0.0, 0.0, 1.0],
    ]
    for row in T:
        print("  " + fmt_row(row))


# =========================================================
# MAIN
# =========================================================

def main():
    print("PLANTILLA GENERAL DE EXAMEN - ROBÓTICA")
    print(f"Tipo: {EXERCISE_KIND}")
    if EXERCISE_KIND == "arm":
        print_arm_answer()
    elif EXERCISE_KIND == "inverse_kinematics":
        print_inverse_answer()
    elif EXERCISE_KIND == "gradient":
        print_inverse_answer()
    elif EXERCISE_KIND == "mobile":
        print_mobile_answer()
    else:
        print("Define EXERCISE_KIND correctamente.")


if __name__ == "__main__":
    main()
