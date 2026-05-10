# EVINKA Chatbot V1 — Especificación funcional final

## Fase actual
Cierre y ordenamiento final de la especificación funcional V1.

## Objetivo de esta fase
Dejar una versión limpia, consolidada y utilizable como documento base para diseño e implementación.

## Qué falta para completar esta fase
- Validar esta versión final
- Si queda aprobada, pasar al plan técnico de implementación

---

## 1. Propósito del chatbot
El chatbot principal de EVINKA será un asistente de atención al cliente por WhatsApp.

Su objetivo es guiar al cliente paso a paso en procesos de atención inicial, con prioridad en el flujo de instalación de cargador.

También podrá:
- orientar la compra de un cargador
- derivar a un asesor
- permitir reprogramar o cancelar una cita existente

---

## 2. Alcance funcional de la V1
La V1 debe poder:
1. iniciar conversación y detectar intención
2. pedir consentimiento cuando corresponda
3. solicitar y procesar el recibo de luz
4. capturar datos del cliente o receptor de visita
5. confirmar dirección de instalación
6. capturar datos del vehículo
7. ofrecer agenda según zona y disponibilidad
8. confirmar visitas técnicas
9. permitir reprogramar o cancelar citas por ticket
10. mantener contexto y estado del flujo sin perder continuidad

Queda fuera de esta fase:
- modo interno tipo Nexus
- monitoreo operativo de EVINKA Connect dentro del flujo público
- mezcla de módulos internos y públicos

---

## 3. Menú principal
Cuando el bot reciba un saludo o inicio de conversación, debe responder exactamente:

> ¡Hola! 👋
> Bienvenido a EVINKA.
>
> Te puedo ayudar con una de estas opciones:
>
> A. Instalar un cargador
> B. Comprar un cargador
> C. Hablar con un asesor
> D. Reprogramar o cancelar cita
> Por favor responde con la letra de la opción que deseas.

### Reglas
- solo acepta A, B, C o D
- no acepta texto libre en este punto
- si responde otra cosa, insiste y vuelve a pedir una letra válida
- guarda la intención antes de continuar

---

## 4. Rama A — Instalar un cargador
Si el usuario elige A, el bot responde exactamente:

> Perfecto 👍
>
> Para continuar, primero necesitaremos tu DNI o RUC y un recibo de luz actualizado. Con esa información podremos validar la potencia contratada y confirmar la dirección donde se realizará la instalación.
>
> Luego coordinaremos una visita técnica con nuestro equipo especializado para evaluar la viabilidad de la instalación, las condiciones del sitio y los requerimientos técnicos.
>
> Con esa evaluación podremos preparar una cotización precisa y adecuada para tu caso.
>
> Antes de continuar, EVINKA usará los datos y documentos que nos compartas únicamente para:
>
> - evaluar tu instalación
> - coordinar tu visita técnica
> - preparar tu cotización
>
> ¿Autorizas este uso para esa finalidad?
>
> A. Sí, autorizo
> B. No autorizo
>
> Por favor responde con la letra de la opción que deseas.

### Reglas
- solo acepta A o B
- no acepta texto libre
- si responde A, continúa al flujo compartido de instalación
- si responde B, muestra la salida de no autorización

### Salida si no autoriza
> Entendido 👍
>
> Sin tu autorización no puedo continuar con la evaluación, la visita técnica ni la preparación de una cotización por este medio.
>
> Si cambias de opinión más adelante, puedes volver a escribir y con gusto retomamos el proceso.
>
> Si deseas, también puedes elegir una de estas opciones:
>
> A. Volver al menú principal
> B. Hablar con un asesor
>
> Por favor responde con la letra de la opción que deseas.

---

## 5. Rama B — Comprar un cargador
Si el usuario elige B, el bot responde exactamente:

> Perfecto 👍
>
> Para ayudarte con la compra de un cargador, primero necesitamos definir qué tipo de instalación tienes y qué equipo realmente se puede instalar en tu caso.
>
> Te puedo ayudar con una de estas opciones:
>
> A. Agendar una visita técnica para evaluar qué cargador necesitas
> B. Hablar con un asesor
>
> Por favor responde con la letra de la opción que deseas.

### Reglas
- solo acepta A o B
- si responde A, entra al mismo flujo compartido de instalación que la rama A
- si responde B, deriva a un asesor
- guarda la decisión antes de continuar

---

## 6. Rama C — Hablar con un asesor
Si el usuario elige C:
- se registra la intención
- se marca la conversación para handoff
- se deriva al asesor

---

## 7. Flujo compartido de instalación
Este flujo aplica a:
- A → A
- B → A → A

### 7.1 Solicitud del recibo
Después de autorizar, el bot responde exactamente:

> Perfecto 👍
>
> Ahora necesito el recibo de luz para continuar con la evaluación de la instalación.
>
> Puedes elegir una de estas opciones:
>
> A. Enviar foto o PDF del recibo
> B. Escribir los datos del recibo
>
> Por favor responde con la letra de la opción que deseas.

### Reglas
- solo acepta A o B
- no acepta texto libre
- guarda la decisión antes de continuar

### 7.2 Rama A del recibo — foto o PDF
Si responde A:

> Perfecto 👍
>
> Por favor envíame una foto clara o el PDF de tu recibo de luz para revisarlo.

### Base técnica de lectura
- OCR: `tesseract.js`
- lector PDF: `pdf-parse`
- renderizado PDF a imagen: `pdfjs-dist legacy build`

### Si el OCR logra leer bien
> Perfecto 👍
>
> He revisado tu recibo y estos son los datos que identifiqué:
>
> - Nombre del titular: (Si aplica)
> - Dirección del suministro: (DIRECCION DEL SUMINISTRO)
> - Potencia contratada: (POTENCIA CONTRATADA DEL SUMINISTRO)
>
> ¿Me confirmas si estos datos son correctos?
>
> A. Sí
> B. No, quiero corregirlos
>
> Por favor responde con la letra de la opción que deseas.

### 7.3 Rama B del recibo — ingreso manual
Si responde B:

> Perfecto 👍
>
> Entonces envíame los datos del recibo. De preferencia incluye esto:
>
> - titular
> - dirección del suministro
> - distrito
> - provincia
> - potencia contratada
>
> Si deseas, puedes enviarlo así:
>
> Titular: María Fernanda López Rojas
> Dirección del suministro: Av. Los Ingenieros 845
> Distrito: La Molina
> Provincia: Lima
> Potencia contratada: 7.4 kW
>
> No es obligatorio copiar exactamente ese formato, pero sí necesito que esos datos se entiendan con claridad para continuar.

### Reglas de lectura manual/corrección
- aquí sí acepta texto libre
- tolera mayúsculas, minúsculas, espacios extra y saltos de línea
- no exige subtítulos ni dos puntos
- no exige `Av.` exacto ni `kW` explícito
- puede aceptar entradas simples en líneas separadas
- no inventa datos faltantes
- solo pide corrección si falta algo importante o si hay ambigüedad

### Si el usuario corrige o ingresa datos manuales y el bot los entiende
> Perfecto 👍
>
> Ya registré los datos corregidos del recibo:
>
> - Nombre del titular: (Si aplica)
> - Dirección del suministro: (DIRECCION DEL SUMINISTRO)
> - Distrito: (DISTRITO)
> - Provincia: (PROVINCIA)
> - Potencia contratada: (POTENCIA CONTRATADA DEL SUMINISTRO)
>
> ¿Me confirmas si estos datos son correctos?
>
> A. Sí
> B. No, quiero corregirlos
>
> Por favor responde con la letra de la opción que deseas.

### Reglas de confirmación del recibo
- solo acepta A o B
- si responde A, pasa al siguiente paso
- si responde B, vuelve a corrección manual
- este bucle se repite hasta que el usuario confirme

### 7.4 Persona que recibirá la visita
Después de confirmar el recibo:

> Gracias, ya tengo el recibo 👍
>
> Paso 2 de 5: persona que recibirá la visita
>
> Ahora necesito confirmar algo importante:
>
> A. Yo mismo voy a recibir al técnico
> B. Otra persona va a recibir al técnico
>
> Por favor responde con la letra de la opción que deseas.

Si responde A:

> Perfecto 👍
>
> Entonces los siguientes datos deben ser tuyos.
>
> Paso 3 de 5: datos de la persona que recibirá la visita
>
> Gracias. Para continuar solo me faltan estos datos:
>
> - nombre completo
> - DNI o RUC
> - teléfono de contacto
> - correo electrónico
>
> Puedes enviarlo todo en un solo mensaje.

Si responde B, usa el mismo bloque cambiando el sustantivo para indicar que los datos deben ser de la otra persona.

### Regla de captura
- estos datos no se leen ni validan
- solo se guardan en Supabase tal como los envía el usuario

### 7.5 Confirmación de dirección
Después de guardar los datos de contacto:

> Perfecto 👍
>
> Ya tengo los datos de contacto.
>
> Paso 4 de 5: dirección exacta del punto de instalación
>
> En el recibo que me compartiste figura esta dirección de suministro:
>
> (DIRECCION DEL SUMINISTRO)
>
> ¿Esa es la dirección exacta donde se realizará la instalación?
>
> A. Sí
> B. No
>
> Por favor responde con la letra de la opción que deseas.

### Reglas
- la dirección final de instalación debe coincidir con la del recibo validado o corregido
- si responde A, continúa
- si responde B, vuelve al paso del recibo

### Si responde B
> Entendido 👍
>
> El recibo que me envíes debe corresponder exactamente al lugar donde se realizará la instalación.
>
> Por favor vuelve a enviarme el recibo correcto del punto de instalación para continuar.

### 7.6 Vehículo
Si confirma la dirección:

> Tomaré esa como la dirección correcta de instalación.
>
> Perfecto 👍
>
> Paso 5 de 5: vehículo
>
> Ahora indícame:
>
> - marca
> - modelo
> - si es BEV (Battery Electric Vehicle) o PHEV (Plug-in Hybrid Electric Vehicle)
>
> Ejemplo:
> BYD Yuan Up
> BEV

### Regla
- debe guardar marca, modelo y tipo de vehículo
- si falta el tipo, lo pide antes de continuar

### 7.7 Paso previo a agenda
Si ya tiene todo:

> Perfecto. Ya tengo lo necesario para continuar ✅
>
> Antes de agendar, te explico brevemente qué haremos en la visita técnica:
>
> - revisaremos el tablero eléctrico
> - veremos la distancia hasta el punto de carga
> - validaremos el lugar donde iría el cargador
> - revisaremos si hay condiciones adecuadas para instalar
> - y con eso prepararemos la cotización
>
> La visita dura 45 minutos.
>
> ¿Deseas agendar la visita técnica?
>
> A. Sí
> B. No por ahora
>
> Por favor responde con la letra de la opción que deseas.

Si responde B:

> Entendido 👍
>
> No agendaremos la visita técnica por ahora.
>
> Cuando lo desees más adelante, puedes volver a escribir y con gusto retomamos el proceso desde este punto.
>
> Si deseas, también puedes elegir una de estas opciones:
>
> A. Volver al menú principal
> B. Hablar con un asesor
>
> Por favor responde con la letra de la opción que deseas.

---

## 8. Lógica oficial de agenda y zonificación

### 8.1 Reglas generales
- la agenda solo se muestra después de validar correctamente todos los datos previos
- antes de ofrecer agenda, el bot debe tener: consentimiento, recibo, persona receptora, dirección confirmada y vehículo
- solo se agenda de lunes a viernes
- sábado y domingo no se ofrecen
- la visita dura 45 minutos para el cliente

### 8.2 Horarios válidos
**Lunes, miércoles y viernes**
- 10:00 a. m.
- 11:30 a. m.
- 2:00 p. m.
- 3:30 p. m.

**Martes y jueves**
- 10:00 a. m.
- 11:30 a. m.

### 8.3 Fuente oficial de disponibilidad
- primero se valida en Microsoft Calendar
- luego se valida en Supabase
- ambos deben coincidir
- si no coinciden, no se confirma la cita

### 8.4 Zonificación dinámica
Cada fecha puede estar:
1. libre
2. asignada a una zona

Reglas:
- la primera reserva compatible del día define la zona operativa de esa fecha
- después de eso, solo esa misma zona puede seguir usando ese día
- si una fecha ya fue tomada por otra zona, no se muestra
- el cliente solo ve días libres o ya asignados a su misma zona

### 8.5 Zonas operativas
**LIMA NORTE**
Ancón, Carabayllo, Comas, Independencia, Los Olivos, Puente Piedra, San Martín de Porres, Santa Rosa, Callao (Cercado), Bellavista, Carmen de la Legua-Reynoso, La Perla, La Punta, Ventanilla, Mi Perú, Rímac.

**LIMA CENTRO**
Breña, Jesús María, La Victoria, Lima Cercado, Lince, Magdalena del Mar, Pueblo Libre, San Borja, San Isidro, San Luis, Santiago de Surco (parte urbana tradicional), Surquillo, Barranco, Miraflores, San Miguel.

**LIMA ESTE**
Ate, Chaclacayo, Cieneguilla, El Agustino, La Molina, Lurigancho (Chosica), San Juan de Lurigancho, Santa Anita.

**LIMA SUR**
Lurín, Pachacámac, Pucusana, Punta Hermosa, Punta Negra, San Bartolo, San Juan de Miraflores, Santa María del Mar, Villa El Salvador, Villa María del Triunfo, Chorrillos.

### 8.6 Reglas de cálculo
- la zona del cliente se calcula principalmente con el distrito de la dirección de instalación o del recibo validado
- si el distrito no está en una zona reconocida, no se muestra agenda y se deriva a revisión o asesor
- si cambia el distrito o la zona, se invalidan los días y horarios ofrecidos antes

### 8.7 Mensaje de días disponibles
> Perfecto 👍
>
> Estos son los días disponibles para tu zona:
>
> A. Lunes (fecha exacta dia/mes)
> B. Martes (fecha exacta dia/mes)
> C. Miércoles (fecha exacta dia/mes)
> D. Jueves (fecha exacta dia/mes)
> E. Viernes (fecha exacta dia/mes)
>
> Por favor responde con la letra de la opción que prefieras.

Reglas:
- solo muestra días realmente disponibles para la zona del cliente
- si un día ya está tomado por otra zona, no se ofrece
- la lista puede tener menos opciones
- no acepta texto libre

### 8.8 Mensaje de horarios disponibles
> Perfecto.
>
> Estos son los horarios disponibles para ese día:
>
> C. 2:00 p. m.
> D. 3:30 p. m.
>
> Por favor responde con la letra de la opción que prefieras.

Reglas:
- muestra solo horarios disponibles en Microsoft Calendar y validados con Supabase
- el usuario no puede escribir una hora libre
- si cambia el día, recalcula horarios
- antes de confirmar, vuelve a validar disponibilidad final

### 8.9 Confirmación de cita
Cuando se confirme:
- agenda en Microsoft Calendar
- registra en Supabase
- envía invitación al correo del cliente
- envía correo de confirmación
- guarda fecha, hora, dirección y zona

Mensaje exacto:

> Listo ✅
> Tu visita técnica quedó confirmada.
>
> Fecha: Lunes 20/04/2026
> Hora: 2:00 p. m.
> Dirección: Jirón Huaraz 2096 Pueblo Libre Lima
>
> Si más adelante necesitas reprogramar o cancelar, escríbenos por este mismo medio.
>
> ¡Gracias por elegir EVINKA! ⚡

---

## 9. Rama D — Reprogramar o cancelar cita
Si el usuario elige D, el bot responde:

> Perfecto 👍
>
> Para ayudarte con tu cita, por favor envíame tu ticket de reserva.
>
> Ejemplo:
> WA-20260420-73B7E190

### Si encuentra el ticket
> Encontré esta cita registrada:
>
> Ticket: [ticket]
> Fecha: [fecha]
> Hora: [hora]
> Dirección: [dirección]
>
> ¿Confirmas que esta es la cita que deseas gestionar?
>
> A. Sí
> B. No
>
> Por favor responde con la letra de la opción que deseas.

Si responde B:

> Entendido 👍
>
> Entonces vuelve a enviarme tu ticket de reserva para revisar otra cita.

### Si no encuentra el ticket
> No pude encontrar una cita con ese ticket.
>
> Por favor envíame tu nombre completo y tu DNI o RUC para ayudarte a buscar tus citas registradas.

### Si encuentra varias citas por identidad
> Encontré estas citas registradas a tu nombre:
>
> A. [ticket 1] — [fecha] — [hora] — [dirección]
> B. [ticket 2] — [fecha] — [hora] — [dirección]
> C. [ticket 3] — [fecha] — [hora] — [dirección]
>
> Por favor responde con la letra de la cita que deseas gestionar.

### Si encuentra una sola cita por identidad
> Encontré esta cita registrada a tu nombre:
>
> A. [ticket] — [fecha] — [hora] — [dirección]
>
> Por favor responde con la letra de la cita que deseas gestionar.

### Si no encuentra ninguna cita
> No pude encontrar citas registradas con esos datos.
>
> Si deseas, puedes elegir una de estas opciones:
>
> A. Intentar nuevamente
> B. Hablar con un asesor
>
> Por favor responde con la letra de la opción que deseas.

### Si confirma la cita correcta
> Perfecto 👍
>
> ¿Qué deseas hacer con esta cita?
>
> A. Reprogramar
> B. Cancelar
>
> Por favor responde con la letra de la opción que deseas.

### Reprogramar
- vuelve al bloque de selección de día y hora
- usa la cita actual como referencia
- agenda la nueva cita
- reemplaza la anterior

### Cancelar
- cancela la cita existente
- responde:

> Entendido 👍
>
> Tu cita ha sido cancelada correctamente.
>
> Lamentamos que no puedas continuar por ahora. Cuando lo desees, estaremos encantados de ayudarte a agendar una nueva visita.
>
> ¡Gracias por confiar en EVINKA! ⚡

---

## 10. Reglas globales del sistema
- el bot debe mantener el contexto del flujo sin reiniciarse
- no debe aceptar texto libre en pasos que son estrictamente por letras
- no debe confirmar citas con datos incompletos
- no debe confirmar citas con dirección no validada
- no debe crear citas duplicadas
- si un dato crítico cambia, debe recalcular zona y disponibilidad
- debe registrar correctamente conversación, datos del cliente y estado del flujo
