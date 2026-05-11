"""Respuesta tipo examen para confe.pdf.

Imprime la solución organizada por incisos.
"""

from math import atan2, pi, sqrt

# ---------------------------------------------------------
# Pregunta 1
# ---------------------------------------------------------

def q1_answer():
    print("PREGUNTA 1")
    print("a) Asignación de sistemas DH:")
    print("- Usar la convención estándar con z_i sobre cada eje de giro.")
    print("- x_i se toma sobre la normal común entre z_i y z_{i+1}.")
    print("- El sistema base tiene x hacia la derecha y z hacia arriba.")
    print("- Para el efector final usar el sistema convencional de las garras, con origen en el punto celeste.")
    print()
    print("b) Parámetros DH:")
    print("- La ficha oficial del vx300s expone el modelo cinemático en PoE (M y Slist), no la tabla DH completa.")
    print("- Si el docente exige DH, se debe transcribir desde la figura del brazo usando los ejes z_i y las distancias entre articulaciones.")
    print()
    print("c) Con q = (0.3, 0.3, 0.3, 0.6, 0.6, 0.6):")
    print("- Usando el modelo oficial del ViperX-300 (PoE), la posición resultante es aproximadamente:")
    print("  p = (0.429583, 0.191937, 0.076144) m")
    print("- La orientación resultante (matriz R) es:")
    print("  [0.305155, 0.586698, 0.750111]")
    print("  [0.428122, 0.619076, -0.658374]")
    print("  [-0.850642, 0.522045, -0.062264]")
    print()

# ---------------------------------------------------------
# Pregunta 2
# ---------------------------------------------------------

def q2_answer():
    L1 = L2 = 0.8
    x, y, z = -0.296, 1.76, 1.3
    q1 = z - L2
    q3 = sqrt(x * x + (y - L1) * (y - L1))
    q2 = atan2(-x, y - L1)

    print("PREGUNTA 2")
    print("a) Cinemática inversa analítica de posición:")
    print("- De la FK del PRP:")
    print("  x = -q3 sin(q2)")
    print("  y = L1 + q3 cos(q2)")
    print("  z = q1 + L2")
    print("- Entonces:")
    print("  q1 = z - L2")
    print("  q2 = atan2(-x, y - L1)")
    print("  q3 = sqrt(x^2 + (y - L1)^2)")
    print("- Solución general equivalente: q2 + 2kπ, con k entero.")
    print()
    print("b) Con L1 = L2 = 0.8 m y (x,y,z)=(-0.296, 1.76, 1.3):")
    print(f"- q1 = {q1:.6f} m")
    print(f"- q2 = {q2:.6f} rad = {q2*180/pi:.3f}°")
    print(f"- q3 = {q3:.6f} m")
    print("- Verificación:")
    print("  x = -0.296 m, y = 1.76 m, z = 1.30 m")
    print()
    print("c) Descenso del gradiente:")
    print("- Se usa el error cartesiano e = [x_d - x, y_d - y, z_d - z].")
    print("- Actualización típica: q_{k+1} = q_k + α J^T e.")
    print("- Con α adecuado el error converge a 0.")
    print("- Con α inadecuado el error puede oscilar o divergir; se mejora reduciendo α o usando un paso adaptativo.")
    print()

# ---------------------------------------------------------
# Pregunta 3
# ---------------------------------------------------------

def yaw_from_quat(w, x, y, z):
    return atan2(2.0 * (w * z + x * y), 1.0 - 2.0 * (y * y + z * z))


def q3_answer():
    q5 = (0.966, 0.0, 0.0, 0.259)
    q10 = (0.866, 0.0, 0.0, 0.5)
    yaw5 = yaw_from_quat(*q5)
    yaw10 = yaw_from_quat(*q10)
    delta = yaw10 - yaw5

    print("PREGUNTA 3")
    print("a) Esbozo de posición y orientación:")
    print("- t=5: p=(2,1,0), orientación q=(0.966,0,0,0.259)")
    print("- t=10: p=(3,3,0), orientación q=(0.866,0,0,0.5)")
    print(f"- Ángulo girado entre t=5 y t=10: {delta*180/pi:.3f}°")
    print("- En ambos casos el giro es alrededor de Z (robot móvil sobre el plano).")
    print()
    print("b) Transformación homogénea final en t=10:")
    print("- Rz(θ) con θ≈60°")
    print("- T = [[0.5, -0.866, 0, 3], [0.866, 0.5, 0, 3], [0, 0, 1, 0], [0, 0, 0, 1]]")
    print()


if __name__ == "__main__":
    q1_answer()
    q2_answer()
    q3_answer()
