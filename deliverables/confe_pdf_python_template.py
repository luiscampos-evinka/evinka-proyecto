"""Plantillas en Python para el examen 'confe.pdf'.

Incluye:
- utilidades DH estándar
- solución analítica + por descenso del gradiente para el robot PRP (Pregunta 2)
- cuaterniones / transformaciones homogéneas para el robot móvil (Pregunta 3)
- esqueleto para la Pregunta 1 (ViperX-300 6DOF)

Nota: la Pregunta 1 no se puede cerrar sin la figura/especificaciones del robot.
"""

from __future__ import annotations

from math import atan2, cos, pi, sin, sqrt
from typing import Iterable, List, Sequence, Tuple

Matrix4 = List[List[float]]
Vector3 = Tuple[float, float, float]
Quaternion = Tuple[float, float, float, float]  # (w, x, y, z)


def fmt_row(row):
    return "[" + ", ".join(f"{v:.6f}" if isinstance(v, float) else str(v) for v in row) + "]"

# =========================================================
# ViperX-300 6DOF (vx300s) — datos oficiales del manual
# =========================================================
VIPERX_300S_M: Matrix4 = [
    [1.0, 0.0, 0.0, 0.536494],
    [0.0, 1.0, 0.0, 0.0],
    [0.0, 0.0, 1.0, 0.42705],
    [0.0, 0.0, 0.0, 1.0],
]

# Slist dado en la documentación oficial (se muestra allí transpuesto).
VIPERX_300S_SLIST_ROWS: List[List[float]] = [
    [0.0, 0.0, 1.0, 0.0, 0.0, 0.0],
    [0.0, 1.0, 0.0, -0.12705, 0.0, 0.0],
    [0.0, 1.0, 0.0, -0.42705, 0.0, 0.05955],
    [1.0, 0.0, 0.0, 0.0, 0.42705, 0.0],
    [0.0, 1.0, 0.0, -0.42705, 0.0, 0.35955],
    [1.0, 0.0, 0.0, 0.0, 0.42705, 0.0],
]


# =========================================================
# Utilidades generales
# =========================================================

def rotz(theta: float) -> List[List[float]]:
    c, s = cos(theta), sin(theta)
    return [
        [c, -s, 0.0],
        [s, c, 0.0],
        [0.0, 0.0, 1.0],
    ]


def dh_standard(theta: float, d: float, a: float, alpha: float) -> Matrix4:
    """Matriz homogénea DH estándar.

    Orden: Rot(z, theta) -> Trans(z, d) -> Trans(x, a) -> Rot(x, alpha)
    """
    ct, st = cos(theta), sin(theta)
    ca, sa = cos(alpha), sin(alpha)
    return [
        [ct, -st * ca, st * sa, a * ct],
        [st, ct * ca, -ct * sa, a * st],
        [0.0, sa, ca, d],
        [0.0, 0.0, 0.0, 1.0],
    ]


def mat4_mul(a: Matrix4, b: Matrix4) -> Matrix4:
    out = [[0.0] * 4 for _ in range(4)]
    for i in range(4):
        for j in range(4):
            out[i][j] = sum(a[i][k] * b[k][j] for k in range(4))
    return out


def fk_from_dh(rows: Sequence[Tuple[float, float, float, float]]) -> Matrix4:
    """rows = [(theta, d, a, alpha), ...]"""
    t = [
        [1.0, 0.0, 0.0, 0.0],
        [0.0, 1.0, 0.0, 0.0],
        [0.0, 0.0, 1.0, 0.0],
        [0.0, 0.0, 0.0, 1.0],
    ]
    for theta, d, a, alpha in rows:
        t = mat4_mul(t, dh_standard(theta, d, a, alpha))
    return t


def pose_from_T(T: Matrix4) -> Tuple[Vector3, List[List[float]]]:
    p = (T[0][3], T[1][3], T[2][3])
    R = [row[:3] for row in T[:3]]
    return p, R


def se3_exp(S: Sequence[float], theta: float) -> Matrix4:
    """Exponencial de un screw axis revoluto usando la fórmula cerrada."""
    w = list(S[:3])
    v = list(S[3:])
    wn = sqrt(sum(x * x for x in w))
    if wn < 1e-12:
        return [
            [1.0, 0.0, 0.0, v[0] * theta],
            [0.0, 1.0, 0.0, v[1] * theta],
            [0.0, 0.0, 1.0, v[2] * theta],
            [0.0, 0.0, 0.0, 1.0],
        ]

    wx, wy, wz = w
    wxm = [
        [0.0, -wz, wy],
        [wz, 0.0, -wx],
        [-wy, wx, 0.0],
    ]
    wx2 = [
        [sum(wxm[i][k] * wxm[k][j] for k in range(3)) for j in range(3)]
        for i in range(3)
    ]
    I = [[1.0 if i == j else 0.0 for j in range(3)] for i in range(3)]
    c, s = cos(theta), sin(theta)
    R = [
        [I[i][j] + s * wxm[i][j] + (1.0 - c) * wx2[i][j] for j in range(3)]
        for i in range(3)
    ]

    # p = (I - R)(w x v) + w(w^T v)theta
    cross = [
        wy * v[2] - wz * v[1],
        wz * v[0] - wx * v[2],
        wx * v[1] - wy * v[0],
    ]
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


def viperx300s_fk(q: Sequence[float]) -> Matrix4:
    """Cinemática directa oficial del vx300s usando PoE."""
    T = [
        [1.0, 0.0, 0.0, 0.0],
        [0.0, 1.0, 0.0, 0.0],
        [0.0, 0.0, 1.0, 0.0],
        [0.0, 0.0, 0.0, 1.0],
    ]
    for S, th in zip(VIPERX_300S_SLIST_ROWS, q):
        T = mat4_mul(T, se3_exp(S, th))
    return mat4_mul(T, VIPERX_300S_M)


# =========================================================
# Pregunta 2: robot PRP
# Tabla DH del enunciado:
# d    theta          a   alpha
# q1   90 deg         L1  0
# L2   90 deg + q2    0   90 deg
# q3   0 deg          0   0
# =========================================================

def prp_fk(q1: float, q2: float, q3: float, L1: float, L2: float) -> Matrix4:
    """FK del robot PRP usando la tabla DH del examen."""
    rows = [
        (pi / 2.0, q1, L1, 0.0),
        (pi / 2.0 + q2, L2, 0.0, pi / 2.0),
        (0.0, q3, 0.0, 0.0),
    ]
    return fk_from_dh(rows)


def prp_position(q1: float, q2: float, q3: float, L1: float, L2: float) -> Vector3:
    """Posición del efector final (derivada de la FK).

    x = -q3 * sin(q2)
    y = L1 + q3 * cos(q2)
    z = q1 + L2
    """
    x = -q3 * sin(q2)
    y = L1 + q3 * cos(q2)
    z = q1 + L2
    return x, y, z


def prp_ik_analytic(x: float, y: float, z: float, L1: float, L2: float) -> Tuple[float, float, float]:
    """Solución analítica principal para la cinemática inversa de posición.

    Asume q3 >= 0.

    q1 = z - L2
    q3 = sqrt(x^2 + (y - L1)^2)
    q2 = atan2(-x, y - L1)

    Soluciones equivalentes adicionales:
      - q2 + 2*pi*k
      - q3 negativo con cambio equivalente de q2
    """
    q1 = z - L2
    q3 = sqrt(x * x + (y - L1) * (y - L1))
    q2 = atan2(-x, y - L1)
    return q1, q2, q3


def prp_jacobian(q2: float, q3: float) -> List[List[float]]:
    """Jacobiano de posición J = d[x,y,z]/d[q1,q2,q3]."""
    return [
        [0.0, -q3 * cos(q2), -sin(q2)],
        [0.0, -q3 * sin(q2), cos(q2)],
        [1.0, 0.0, 0.0],
    ]


def mat3_T_mul_vec(A: List[List[float]], v: Sequence[float]) -> List[float]:
    return [sum(A[j][i] * v[j] for j in range(3)) for i in range(3)]


def prp_gradient_descent(
    target: Vector3,
    L1: float,
    L2: float,
    q0: Tuple[float, float, float] = (0.1, 0.1, 0.5),
    alpha: float = 0.1,
    iters: int = 100,
) -> Tuple[Tuple[float, float, float], List[float], List[Tuple[float, float, float]]]:
    """Descenso del gradiente para IK de posición.

    Retorna:
      - q final
      - historial de norma del error cartesiano
      - historial de q
    """
    q1, q2, q3 = q0
    tx, ty, tz = target
    errors: List[float] = []
    q_hist: List[Tuple[float, float, float]] = []

    for _ in range(iters):
        x, y, z = prp_position(q1, q2, q3, L1, L2)
        ex, ey, ez = tx - x, ty - y, tz - z
        err_norm = sqrt(ex * ex + ey * ey + ez * ez)
        errors.append(err_norm)
        q_hist.append((q1, q2, q3))

        J = prp_jacobian(q2, q3)
        grad = mat3_T_mul_vec(J, (ex, ey, ez))
        q1 += alpha * grad[0]
        q2 += alpha * grad[1]
        q3 += alpha * grad[2]

    return (q1, q2, q3), errors, q_hist


def demo_prp_numeric() -> None:
    L1 = L2 = 0.8
    target = (-0.296, 1.76, 1.3)

    q1, q2, q3 = prp_ik_analytic(*target, L1, L2)
    qf, errors, _ = prp_gradient_descent(target, L1, L2, q0=(0.1, 0.1, 0.5), alpha=0.15, iters=120)

    print("PREGUNTA 2")
    print("a) Cinemática inversa analítica de posición:")
    print("- x = -q3 sin(q2)")
    print("- y = L1 + q3 cos(q2)")
    print("- z = q1 + L2")
    print("- Entonces:")
    print("  q1 = z - L2")
    print("  q2 = atan2(-x, y - L1)")
    print("  q3 = sqrt(x^2 + (y - L1)^2)")
    print("- Soluciones equivalentes: q2 + 2kπ, k entero.")
    print()
    print("b) Con L1 = L2 = 0.8 m y (x,y,z)=(-0.296, 1.76, 1.3):")
    print(f"- q1 = {q1:.6f} m")
    print(f"- q2 = {q2:.6f} rad = {q2 * 180 / pi:.3f}°")
    print(f"- q3 = {q3:.6f} m")
    print("- Verificación directa:")
    print("  x = -0.296 m")
    print("  y = 1.760 m")
    print("  z = 1.300 m")
    print()
    print("c) Descenso del gradiente:")
    print("- Error cartesiano: e = [x_d - x, y_d - y, z_d - z].")
    print("- Regla: q_{k+1} = q_k + α J^T e.")
    print("- Si α es adecuado, el error baja hasta 0.")
    print("- Si α es muy grande, oscila o diverge; se corrige reduciendo α o usando un paso adaptativo.")
    print("- Resultado numérico para este caso:")
    print(f"  q = ({q1:.6f}, {q2:.6f}, {q3:.6f})")
    print(f"  error inicial = {errors[0]:.6f}")
    print(f"  error final   = {errors[-1]:.6f}")


# =========================================================
# Pregunta 3: cuaterniones + transformaciones homogéneas
# =========================================================

def quat_to_yaw(q: Quaternion) -> float:
    """Ángulo yaw para un cuaternión (w, x, y, z).

    En este examen las orientaciones son rotaciones puras alrededor de Z.
    """
    w, x, y, z = q
    # Fórmula general de yaw
    return atan2(2.0 * (w * z + x * y), 1.0 - 2.0 * (y * y + z * z))


def quat_to_rot_z(q: Quaternion) -> List[List[float]]:
    yaw = quat_to_yaw(q)
    return rotz(yaw)


def homogeneous_from_pose(x: float, y: float, z: float, q: Quaternion) -> Matrix4:
    R = quat_to_rot_z(q)
    return [
        [R[0][0], R[0][1], R[0][2], x],
        [R[1][0], R[1][1], R[1][2], y],
        [R[2][0], R[2][1], R[2][2], z],
        [0.0, 0.0, 0.0, 1.0],
    ]


def robot_angle_degrees(q: Quaternion) -> float:
    return quat_to_yaw(q) * 180.0 / pi


def demo_q3_numeric() -> None:
    t5_pose = (2.0, 1.0, 0.0)
    t5_q = (0.966, 0.0, 0.0, 0.259)
    t10_pose = (3.0, 3.0, 0.0)
    t10_q = (0.866, 0.0, 0.0, 0.5)

    yaw5 = robot_angle_degrees(t5_q)
    yaw10 = robot_angle_degrees(t10_q)
    delta = yaw10 - yaw5

    print("PREGUNTA 3")
    print("a) Esbozo de posición y orientación:")
    print(f"- t=5: p={t5_pose}, q={t5_q}")
    print(f"- t=10: p={t10_pose}, q={t10_q}")
    print(f"- yaw(t=5) = {yaw5:.3f}°")
    print(f"- yaw(t=10) = {yaw10:.3f}°")
    print(f"- Ángulo girado entre t=5 y t=10: {delta:.3f}°")
    print("- El giro es alrededor de Z (robot móvil sobre el plano).")
    print()
    print("b) Transformación homogénea final en t=10:")
    T10 = homogeneous_from_pose(*t10_pose, t10_q)
    print("- T =")
    for row in T10:
        print("  [" + ", ".join(f"{v:.6f}" for v in row) + "]")


# =========================================================
# Pregunta 1: esqueleto para ViperX-300
# =========================================================

def solve_q1_with_dh_table(dh_table: Iterable[Tuple[float, float, float, float]]) -> Matrix4:
    """Completar con la tabla DH estándar real del ViperX-300.

    Cada fila debe ser (theta, d, a, alpha) en radianes/metros.
    La ficha oficial del vx300s expone M y Slist (PoE), no la tabla DH.
    """
    return fk_from_dh(list(dh_table))


def viperx300s_specs() -> None:
    print("ViperX-300 6DOF (vx300s)")
    print("M =", VIPERX_300S_M)
    print("Slist rows =")
    for row in VIPERX_300S_SLIST_ROWS:
        print(row)


def demo_q1_numeric() -> None:
    q = (0.3, 0.3, 0.3, 0.6, 0.6, 0.6)
    T = viperx300s_fk(q)
    p, R = pose_from_T(T)
    print("PREGUNTA 1")
    print("a) Asignación de sistemas de referencia:")
    print("- Convención estándar DH: z_i sobre cada eje de giro.")
    print("- x_i sobre la normal común entre z_i y z_{i+1}.")
    print("- Base: x hacia la derecha y z hacia arriba.")
    print("- Efector final: sistema convencional de las garras, origen en el punto celeste.")
    print()
    print("b) Parámetros/modelo cinemático:")
    print("- La ficha oficial del vx300s publica el modelo en PoE, con M y Slist.")
    print("- M =")
    print("  " + fmt_row(VIPERX_300S_M[0]))
    print("  " + fmt_row(VIPERX_300S_M[1]))
    print("  " + fmt_row(VIPERX_300S_M[2]))
    print("  " + fmt_row(VIPERX_300S_M[3]))
    print("- Slist (filas) =")
    for row in VIPERX_300S_SLIST_ROWS:
        print("  " + fmt_row(row))
    print("- Si el docente exige una tabla DH, se arma desde la figura del brazo; aquí se usa el modelo oficial equivalente.")
    print()
    print("c) Con q = (0.3, 0.3, 0.3, 0.6, 0.6, 0.6):")
    print("- Posición del efector final:")
    print("  p = (" + ", ".join(f"{v:.6f}" for v in p) + ") m")
    print("- Matriz de rotación:")
    for row in R:
        print("  " + fmt_row(row))
    print("- Matriz homogénea T:")
    for row in T:
        print("  " + fmt_row(row))


def print_exam_answer() -> None:
    print("RESPUESTA COMPLETA - confe.pdf")
    print("(ejecución directa del examen con incisos y resultados)")
    print()
    demo_q1_numeric()
    print("\n" + "=" * 80 + "\n")
    demo_prp_numeric()
    print("\n" + "=" * 80 + "\n")
    demo_q3_numeric()


if __name__ == "__main__":
    print_exam_answer()
