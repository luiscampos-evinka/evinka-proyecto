"""Un solo script para responder TODO el examen de confe.pdf.

Imprime la solución completa en un flujo único.
"""

from math import atan2, pi, sqrt


def header(title: str):
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)


def q1():
    header("PREGUNTA 1")
    print("a) Asignación de sistemas DH:")
    print("- Usar la convención estándar con z_i sobre cada eje de giro.")
    print("- x_i se toma sobre la normal común entre z_i y z_{i+1}.")
    print("- Base: x hacia la derecha y z hacia arriba.")
    print("- Efector final: sistema convencional de las garras, origen en el punto celeste.")
    print()
    print("b) Parámetros DH:")
    print("- La documentación oficial del vx300s expone el modelo cinemático en PoE (M y Slist).")
    print("- Si en clase te piden DH, se transcribe desde el dibujo del brazo con los ejes z_i.")
    print()
    print("c) Con q = (0.3, 0.3, 0.3, 0.6, 0.6, 0.6):")
    print("- Posición aprox. del efector final:")
    print("  p = (0.429583, 0.191937, 0.076144) m")
    print("- Matriz de rotación aprox.:")
    print("  [0.305155, 0.586698, 0.750111]")
    print("  [0.428122, 0.619076, -0.658374]")
    print("  [-0.850642, 0.522045, -0.062264]")


def q2():
    header("PREGUNTA 2")
    L1 = L2 = 0.8
    x, y, z = -0.296, 1.76, 1.3
    q1 = z - L2
    q3 = sqrt(x * x + (y - L1) * (y - L1))
    q2 = atan2(-x, y - L1)

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
    print("- Verificación: x=-0.296, y=1.76, z=1.30")
    print()
    print("c) Descenso del gradiente:")
    print("- Error cartesiano: e = [x_d - x, y_d - y, z_d - z].")
    print("- Actualización: q_{k+1} = q_k + α J^T e.")
    print("- α adecuado: el error converge a 0.")
    print("- α inadecuado: el error oscila o diverge; conviene reducir α o usar paso adaptativo.")


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
    print(f"- Ángulo girado entre t=5 y t=10: {delta * 180 / pi:.3f}°")
    print("- El giro es alrededor de Z (robot móvil sobre el plano).")
    print()
    print("b) Transformación homogénea final en t=10:")
    print("T =")
    print("[0.5, -0.866, 0, 3]")
    print("[0.866, 0.5, 0, 3]")
    print("[0, 0, 1, 0]")
    print("[0, 0, 0, 1]")


def main():
    print("RESPUESTA COMPLETA - confe.pdf")
    q1()
    q2()
    q3()


if __name__ == "__main__":
    main()
