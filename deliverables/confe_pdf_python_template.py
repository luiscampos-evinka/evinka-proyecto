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
    print("Solución analítica principal:")
    print(f"q1 = {q1:.6f} m")
    print(f"q2 = {q2:.6f} rad  ({q2 * 180.0 / pi:.3f} deg)")
    print(f"q3 = {q3:.6f} m")

    qf, errors, _ = prp_gradient_descent(target, L1, L2, q0=(0.1, 0.1, 0.5), alpha=0.15, iters=120)
    print("\nDescenso del gradiente:")
    print(f"q_final = ({qf[0]:.6f}, {qf[1]:.6f}, {qf[2]:.6f})")
    print(f"error inicial = {errors[0]:.6f}")
    print(f"error final   = {errors[-1]:.6f}")


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

    print("t=5 yaw:", yaw5)
    print("t=10 yaw:", yaw10)
    print("giro entre instantes:", delta)

    T10 = homogeneous_from_pose(*t10_pose, t10_q)
    print("\nT(t=10):")
    for row in T10:
        print([round(v, 6) for v in row])


# =========================================================
# Pregunta 1: esqueleto para ViperX-300
# =========================================================

def solve_q1_with_dh_table(dh_table: Iterable[Tuple[float, float, float, float]]) -> Matrix4:
    """Completar con la tabla DH estándar real del ViperX-300.

    Cada fila debe ser (theta, d, a, alpha) en radianes/metros.
    """
    return fk_from_dh(list(dh_table))


if __name__ == "__main__":
    # Demos rápidos para las preguntas 2 y 3.
    demo_prp_numeric()
    print("\n" + "=" * 50 + "\n")
    demo_q3_numeric()
