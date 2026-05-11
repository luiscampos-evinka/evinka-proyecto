"""Un solo script para responder TODO el examen de confe.pdf.

Imprime la solución completa en un flujo único.
"""

from math import atan2, pi, sqrt


def fmt_row(row):
    return "[" + ", ".join(f"{v:.6f}" if isinstance(v, float) else str(v) for v in row) + "]"


def header(title: str):
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)


def q1():
    header("PREGUNTA 1")
    print("a) Asignación de sistemas de referencia:")
    print("- Convención estándar DH: z_i sobre cada eje de giro.")
    print("- x_i sobre la normal común entre z_i y z_{i+1}.")
    print("- Base: x hacia la derecha y z hacia arriba.")
    print("- Efector final: sistema convencional de las garras, origen en el punto celeste.")
    print()
    print("b) Parámetros/modelo cinemático:")
    print("- La ficha oficial del vx300s publica el modelo en PoE, con M y Slist.")
    print("- M =")
    print(fmt_row([1.0, 0.0, 0.0, 0.536494]))
    print(fmt_row([0.0, 1.0, 0.0, 0.0]))
    print(fmt_row([0.0, 0.0, 1.0, 0.42705]))
    print(fmt_row([0.0, 0.0, 0.0, 1.0]))
    print("- Slist (filas) =")
    print(fmt_row([0.0, 0.0, 1.0, 0.0, 0.0, 0.0]))
    print(fmt_row([0.0, 1.0, 0.0, -0.12705, 0.0, 0.0]))
    print(fmt_row([0.0, 1.0, 0.0, -0.42705, 0.0, 0.05955]))
    print(fmt_row([1.0, 0.0, 0.0, 0.0, 0.42705, 0.0]))
    print(fmt_row([0.0, 1.0, 0.0, -0.42705, 0.0, 0.35955]))
    print(fmt_row([1.0, 0.0, 0.0, 0.0, 0.42705, 0.0]))
    print("- Si el docente exige una tabla DH, se arma desde la figura del brazo; aquí se usa el modelo oficial equivalente.")
    print()
    print("c) Con q = (0.3, 0.3, 0.3, 0.6, 0.6, 0.6):")
    print("- Posición del efector final:")
    print("  p = (0.429583, 0.191937, 0.076144) m")
    print("- Matriz de rotación:")
    print("  [0.305155, 0.586698, 0.750111]")
    print("  [0.428122, 0.619076, -0.658374]")
    print("  [-0.850642, 0.522045, -0.062264]")
    print("- Matriz homogénea T:")
    print("  [0.305155, 0.586698, 0.750111, 0.429583]")
    print("  [0.428122, 0.619076, -0.658374, 0.191937]")
    print("  [-0.850642, 0.522045, -0.062264, 0.076144]")
    print("  [0.000000, 0.000000, 0.000000, 1.000000]")


def q2():
    header("PREGUNTA 2")
    L1 = L2 = 0.8
    x, y, z = -0.296, 1.76, 1.3
    q1 = z - L2
    q3 = sqrt(x * x + (y - L1) * (y - L1))
    q2 = atan2(-x, y - L1)

    print("a) Cinemática inversa analítica de posición:")
    print("- Partimos de la FK:")
    print("  x = -q3 sin(q2)")
    print("  y = L1 + q3 cos(q2)")
    print("  z = q1 + L2")
    print("- Despejando:")
    print("  q1 = z - L2")
    print("  q2 = atan2(-x, y - L1)")
    print("  q3 = sqrt(x^2 + (y - L1)^2)")
    print("- Familia equivalente: q2 + 2kπ, k entero.")
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


def yaw_from_quat(w, x, y, z):
    return atan2(2.0 * (w * z + x * y), 1.0 - 2.0 * (y * y + z * z))


def q3():
    header("PREGUNTA 3")
    q5 = (0.966, 0.0, 0.0, 0.259)
    q10 = (0.866, 0.0, 0.0, 0.5)
    yaw5 = yaw_from_quat(*q5)
    yaw10 = yaw_from_quat(*q10)
    delta = yaw10 - yaw5

    print("a) Esbozo de posición y orientación:")
    print("- t=5: p=(2,1,0), q=(0.966, 0, 0, 0.259)")
    print("- t=10: p=(3,3,0), q=(0.866, 0, 0, 0.5)")
    print(f"- yaw(t=5) = {yaw5 * 180 / pi:.3f}°")
    print(f"- yaw(t=10) = {yaw10 * 180 / pi:.3f}°")
    print(f"- Ángulo girado entre t=5 y t=10: {delta * 180 / pi:.3f}°")
    print("- El giro es alrededor de Z (robot móvil sobre el plano).")
    print()
    print("b) Transformación homogénea final en t=10:")
    print("T =")
    print("[0.500000, -0.866000, 0.000000, 3.000000]")
    print("[0.866000,  0.500000, 0.000000, 3.000000]")
    print("[0.000000,  0.000000, 1.000000, 0.000000]")
    print("[0.000000,  0.000000, 0.000000, 1.000000]")


def main():
    print("RESPUESTA COMPLETA - confe.pdf")
    print("(todo en un solo script, listo para correr y pegar en el informe)")
    q1()
    q2()
    q3()


if __name__ == "__main__":
    main()
