# EVINKA Chatbot V1 - Especificación funcional

## Fase actual
Definición funcional de la versión 1 del chatbot base público de EVINKA.

## Objetivo de esta fase
Convertir el alcance inicial en una especificación clara, ordenada y utilizable para diseño, desarrollo y validación.

## Qué falta para completar esta fase
- Confirmar esta especificación funcional base
- Definir los campos exactos a guardar en Supabase para cada paso
- Definir los estados del flujo y reglas de transición
- Definir el primer flujo conversacional detallado

---

## 1. Propósito del chatbot V1
El chatbot principal de EVINKA será un asistente de atención al cliente por WhatsApp.

Su objetivo es guiar al cliente paso a paso en procesos de atención inicial, con prioridad en el flujo de instalación de cargador.

También debe servir como punto de entrada para otras necesidades básicas del cliente, como:
- comprar un cargador
- hablar con un asesor
- resolver temas básicos de atención

---

## 2. Alcance principal de la versión 1
La versión 1 tendrá como flujo principal y prioritario el proceso de instalación de cargador.

El chatbot deberá:
1. iniciar la conversación y detectar intención
2. guiar al cliente por el flujo correcto
3. pedir consentimiento de uso de datos
4. solicitar y registrar información clave del cliente
5. solicitar y procesar el recibo de luz
6. recoger datos del punto de instalación
7. recoger datos del vehículo
8. ofrecer opciones de visita técnica
9. confirmar la cita solo si los datos mínimos están completos
10. guardar el contexto y estado sin perder continuidad
11. derivar a un asesor cuando corresponda
12. permitir reprogramar o cancelar una cita existente usando ticket

---

## 3. Canales y contexto
### Canal principal
- WhatsApp

### Tipo de asistente en esta fase
- asistente público de atención al cliente

### Queda fuera de esta fase
- modo interno tipo Nexus
- monitoreo operativo de EVINKA Connect dentro del flujo público
- mezcla de módulos internos y públicos en una misma conversación

Estos componentes se tratarán después como módulos separados.

---

## 4. Casos de uso que sí cubre V1
### 4.1 Flujo principal: instalación de cargador
El chatbot debe poder completar este flujo de punta a punta.

### 4.2 Flujos secundarios básicos
El chatbot también debe poder:
- recibir consultas para compra de cargador
- derivar a un asesor humano
- atender otros temas básicos con contención inicial

En V1, estos flujos secundarios pueden ser simples y orientados a clasificación o derivación.

#### Rama B del menú inicial: comprar un cargador
Si el usuario responde B en el menú inicial, el chatbot debe responder exactamente:

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

Reglas de esta rama:
- el bot será 100% estricto
- solo acepta A o B
- no acepta texto libre en este paso
- si el usuario responde otra cosa, insiste y vuelve a pedir una letra válida
- si responde A, pasa al mismo flujo de consentimiento definido para la rama A de instalación
- si responde B, deriva a un asesor
- el bot debe guardar esta decisión antes de continuar

Definición adicional:
- la ruta B → A reutiliza exactamente el mismo mensaje y las mismas reglas de consentimiento de la rama A principal, incluyendo la explicación previa del proceso
- la ruta B → B queda cerrada por ahora en derivación a asesor, sin definir todavía la intervención posterior del asesor

#### Rama C del menú inicial: hablar con un asesor
Si el usuario responde C en el menú inicial, el bot debe derivarlo directamente a un asesor.

Reglas de esta rama:
- el bot debe registrar que la intención del usuario es hablar con un asesor
- el bot debe marcar la conversación para handoff
- la intervención exacta del asesor se definirá después
- en esta fase solo queda definido que la rama C termina en derivación a asesor

#### Rama D del menú inicial: reprogramar o cancelar cita
Si el usuario responde D en el menú inicial, el chatbot debe pedir primero el ticket de la cita.

El chatbot debe responder exactamente:

> Perfecto 👍
>
> Para ayudarte con tu cita, por favor envíame tu ticket de reserva.
>
> Ejemplo:
> WA-20260420-73B7E190

Reglas de esta rama:
- en este paso el bot sí acepta texto libre
- el ticket es obligatorio para continuar
- el bot debe buscar la cita asociada a ese ticket

Si encuentra el ticket, debe mostrar el resumen de la cita y responder exactamente:

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

Reglas de confirmación del ticket:
- la respuesta debe ser estrictamente A o B
- no se debe aceptar texto libre como respuesta válida en este punto
- si el usuario responde otra cosa, el bot debe insistir y pedir nuevamente una letra válida
- si responde A, el flujo continúa
- si responde B, el bot debe pedir nuevamente el ticket

Si responde B, el chatbot debe responder exactamente:

> Entendido 👍
>
> Entonces vuelve a enviarme tu ticket de reserva para revisar otra cita.

Si el ticket no existe o no coincide, el chatbot debe responder exactamente:

> No pude encontrar una cita con ese ticket.
>
> Por favor envíame tu nombre completo y tu DNI o RUC para ayudarte a buscar tus citas registradas.

Reglas de esta recuperación:
- en este paso el bot sí acepta texto libre
- debe buscar en Supabase las citas asociadas al nombre y al DNI o RUC enviados

Si encuentra varias citas por nombre y DNI o RUC, debe responder exactamente:

> Encontré estas citas registradas a tu nombre:
>
> A. [ticket 1] — [fecha] — [hora] — [dirección]
> B. [ticket 2] — [fecha] — [hora] — [dirección]
> C. [ticket 3] — [fecha] — [hora] — [dirección]
>
> Por favor responde con la letra de la cita que deseas gestionar.

Si encuentra una sola cita por nombre y DNI o RUC, debe responder exactamente:

> Encontré esta cita registrada a tu nombre:
>
> A. [ticket] — [fecha] — [hora] — [dirección]
>
> Por favor responde con la letra de la cita que deseas gestionar.

Si no encuentra ninguna cita ni por ticket ni por identidad, debe responder exactamente:

> No pude encontrar citas registradas con esos datos.
>
> Si deseas, puedes elegir una de estas opciones:
>
> A. Intentar nuevamente
> B. Hablar con un asesor
>
> Por favor responde con la letra de la opción que deseas.

Si confirma la cita correcta con A. Sí, el chatbot debe responder exactamente:

> Perfecto 👍
>
> ¿Qué deseas hacer con esta cita?
>
> A. Reprogramar
> B. Cancelar
>
> Por favor responde con la letra de la opción que deseas.

Reglas de esta decisión:
- la respuesta debe ser estrictamente A o B
- no se debe aceptar texto libre como respuesta válida en este punto
- si responde A, el flujo vuelve al bloque de selección de día y horario, usando la cita actual como referencia y luego reemplaza la cita anterior por la nueva
- si responde B, el sistema cancela la cita existente

Si responde B para cancelar, el chatbot debe responder con un mensaje de cierre amable, por ejemplo:

> Entendido 👍
>
> Tu cita ha sido cancelada correctamente.
>
> Lamentamos que no puedas continuar por ahora. Cuando lo desees, estaremos encantados de ayudarte a agendar una nueva visita.
>
> ¡Gracias por confiar en EVINKA! ⚡

---

## 5. Flujo principal V1: instalación de cargador
### Paso 1. Inicio y detección de intención
Mensaje de inicio obligatorio:

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

Reglas de este paso:
- el menú inicial debe mostrarse cuando el bot reciba un saludo o un inicio de conversación
- la respuesta debe ser estrictamente una letra válida: A, B, C o D
- no se debe aceptar texto libre como respuesta válida en este punto
- si el usuario responde otra cosa, el bot debe insistir y pedir nuevamente una letra válida
- al recibir la letra válida, debe guardar la intención principal y avanzar al flujo correspondiente
- debe mantener el contexto del motivo principal

### Paso 2. Consentimiento (rama A: instalación de cargador)
Si el usuario elige la opción A en el menú inicial, el chatbot debe responder exactamente:

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

Reglas de este paso:
- este paso aplica al flujo de instalación de cargador
- la respuesta debe ser estrictamente A o B
- no se debe aceptar texto libre como respuesta válida en este punto
- si el usuario responde otra cosa, el bot debe insistir y pedir nuevamente una letra válida
- si responde A, el flujo continúa, se registra el consentimiento y tanto A → A como B → A pasan al mismo flujo compartido
- si responde B, no debe continuar con captura de datos sensibles ni agendamiento

Si responde B (no autorizo), el chatbot debe responder exactamente:

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

Reglas de esta salida:
- la respuesta debe ser estrictamente A o B
- no se debe aceptar texto libre como respuesta válida en este punto
- si el usuario responde otra cosa, el bot debe insistir y pedir nuevamente una letra válida
- si responde A, vuelve al menú principal
- si responde B, deriva a un asesor
- con esto queda cerrado por ahora el flujo de no autorización

### Paso 3. Solicitud del recibo de luz
Si el usuario autorizó el uso de datos, el chatbot debe responder exactamente:

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

Reglas de este paso:
- este paso aplica al flujo compartido A → A y B → A
- la respuesta debe ser estrictamente A o B
- no se debe aceptar texto libre como respuesta válida en este punto
- si el usuario responde otra cosa, el bot debe insistir y pedir nuevamente una letra válida
- si responde A, pasa al flujo de envío y lectura de archivo del recibo
- si responde B, pasa al flujo de ingreso manual de datos del recibo
- el bot debe guardar esta decisión antes de continuar

#### Rama A del recibo: enviar foto o PDF
Este paso aplica al flujo compartido A → A y B → A.

Si el usuario responde A en este paso, el chatbot debe responder exactamente:

> Perfecto 👍
>
> Por favor envíame una foto clara o el PDF de tu recibo de luz para revisarlo.

#### Rama B del recibo: escribir los datos manualmente
Este paso aplica al flujo compartido A → A y B → A.

Si el usuario responde B en este paso, el chatbot debe responder exactamente:

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

### Paso 4. Lectura y extracción del recibo
Este paso aplica al flujo compartido A → A y B → A cuando el usuario envía foto o PDF del recibo.

Base técnica definida para esta fase:
- OCR: `tesseract.js`
- lector de PDF: `pdf-parse`
- renderizado de PDF a imágenes: `pdfjs-dist legacy build`

El chatbot debe:
- intentar leer y extraer información relevante del recibo
- identificar si la lectura es suficiente o insuficiente

Si la lectura es suficiente, el chatbot debe responder exactamente:

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

Reglas de este paso:
- la respuesta debe ser estrictamente A o B
- no se debe aceptar texto libre como respuesta válida en este punto
- si el usuario responde otra cosa, el bot debe insistir y pedir nuevamente una letra válida
- si responde A, el flujo continúa con los datos extraídos confirmados
- si responde B, el flujo pasa a corrección manual de datos del recibo

Si el usuario responde B para corregir los datos del recibo, el chatbot debe responder exactamente:

> Perfecto 👍
>
> Entonces envíame los datos correctos del recibo. De preferencia incluye esto:
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

Reglas de corrección manual:
- en este paso el bot sí acepta texto libre
- debe tolerar mayúsculas, minúsculas, espacios extra, saltos de línea y variaciones razonables en la forma de escribir
- no debe exigir coincidencia exacta con el formato de ejemplo
- debe intentar interpretar los datos aunque el cliente no use el formato perfecto
- debe aceptar entradas simples en líneas separadas, por ejemplo:
  - Mario Gomez
  - Av Los Ingenieros 9123
  - La Molina
  - Lima
  - 92
- no es obligatorio usar etiquetas como "Titular:", "Dirección:" o dos puntos
- no es obligatorio escribir abreviaturas exactas como "Av."
- no es obligatorio incluir la unidad "kW" si la potencia se entiende claramente como valor numérico
- solo debe pedir corrección si falta un dato importante o si un campo es ambiguo
- si logra identificar todos los campos, debe resumirlos con un mensaje profesional y pedir confirmación con opciones A o B
- si el usuario confirma A, pasa al mismo siguiente paso compartido que la confirmación positiva del OCR
- no debe inventar datos faltantes ni asumir valores ambiguos

Si logra identificar todos los campos enviados manualmente, el chatbot debe responder exactamente:

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

Si la lectura falla o es incompleta:
- pedir los datos manualmente
- dejar trazabilidad de qué fue extraído y qué fue ingresado manualmente

### Paso 5. Persona que recibirá la visita
Cuando el usuario confirme que los datos del recibo son correctos, el chatbot debe responder exactamente:

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

Reglas de este paso:
- este paso aplica al flujo compartido después de la confirmación positiva del recibo
- la respuesta debe ser estrictamente A o B
- no se debe aceptar texto libre como respuesta válida en este punto
- si el usuario responde otra cosa, el bot debe insistir y pedir nuevamente una letra válida
- si responde A o B, el bot debe guardar esta decisión antes de continuar

Si responde A, el chatbot debe responder exactamente:

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

Si responde B, el chatbot debe usar el mismo mensaje, cambiando solo el sustantivo correspondiente para indicar que los datos deben ser de la otra persona que recibirá la visita.

Regla de captura en este paso:
- el bot no debe leer, interpretar ni validar estos datos
- solo debe guardarlos en Supabase tal como el usuario los envíe

Luego de recibir esos datos, el chatbot debe responder exactamente:

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

Reglas de este paso:
- la dirección de instalación debe coincidir con la dirección del recibo o con la dirección corregida previamente por el cliente
- la respuesta debe ser estrictamente A o B
- no se debe aceptar texto libre como respuesta válida en este punto
- si el usuario responde otra cosa, el bot debe insistir y pedir nuevamente una letra válida
- si responde A, el flujo continúa al siguiente paso
- si responde B, el bot no debe continuar con la instalación

Si responde B, el chatbot debe responder exactamente:

> Entendido 👍
>
> El recibo que me envíes debe corresponder exactamente al lugar donde se realizará la instalación.
>
> Por favor vuelve a enviarme el recibo correcto del punto de instalación para continuar.

Reglas de esta salida:
- al responder B, el flujo debe volver al paso del recibo de luz
- desde ahí debe continuar nuevamente con el flujo correspondiente de lectura, corrección y confirmación del recibo

### Paso 6. Dirección del punto de instalación
El chatbot debe pedir y guardar:
- dirección exacta
- distrito
- provincia
- referencias si hacen falta para la visita

### Paso 7. Datos del vehículo
Si el usuario confirma que la dirección del recibo es la dirección correcta de instalación, el chatbot debe responder exactamente:

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

Reglas de este paso:
- el bot debe pedir y guardar marca, modelo y tipo de vehículo
- el tipo debe registrarse como BEV o PHEV
- si el usuario no incluye el tipo de vehículo, el bot debe pedirlo antes de continuar

### Paso 8. Validación mínima antes de agenda
Antes de ofrecer cita, el chatbot debe validar que existan como mínimo:
- consentimiento aceptado
- datos de contacto esenciales
- dirección del punto de instalación confirmada
- datos mínimos del recibo confirmados
- marca y modelo del vehículo
- tipo de vehículo (BEV o PHEV)

Si falta información o es inconsistente:
- no debe confirmar cita
- debe pedir corrección o completar lo faltante

Si ya cuenta con toda la información necesaria, el chatbot debe responder exactamente:

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

Reglas de este paso:
- la respuesta debe ser estrictamente A o B
- no se debe aceptar texto libre como respuesta válida en este punto
- si el usuario responde otra cosa, el bot debe insistir y pedir nuevamente una letra válida
- si responde A, el flujo pasa al bloque de agenda
- si responde B, el chatbot debe responder con la salida definida abajo

Si responde B, el chatbot debe responder exactamente:

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

Reglas de esta salida:
- la respuesta debe ser estrictamente A o B
- no se debe aceptar texto libre como respuesta válida en este punto
- si el usuario responde otra cosa, el bot debe insistir y pedir nuevamente una letra válida
- si responde A, vuelve al menú principal
- si responde B, deriva a un asesor

### Paso 9. Oferta de días y horarios
El chatbot debe:
- mostrar días y horarios disponibles para visita técnica
- permitir que el cliente elija una opción válida

### Paso 9. Agenda y zonificación dinámica
Esta es la versión oficial de la lógica de agenda y zonificación del chatbot.

#### Reglas generales de agenda
- la agenda solo se muestra después de validar correctamente los datos previos del flujo
- antes de ofrecer días y horarios, el bot ya debe tener consentimiento, datos del recibo, datos de la persona que recibirá la visita, dirección de instalación y vehículo
- la visita técnica dura 45 minutos para el cliente, pero la lógica operativa del sistema debe considerar bloques de atención por franjas ya definidas
- solo se agenda de lunes a viernes
- sábado y domingo no se ofrecen

#### Reglas de horarios
- lunes, miércoles y viernes:
  - 10:00 a. m.
  - 11:30 a. m.
  - 2:00 p. m.
  - 3:30 p. m.
- martes y jueves:
  - 10:00 a. m.
  - 11:30 a. m.
- el bot solo debe mostrar horarios válidos según el día seleccionado
- el usuario no puede escribir una hora libre fuera de esos bloques
- si cambia el día, el sistema recalcula los horarios válidos de ese nuevo día

#### Regla central de zonificación dinámica
- cada fecha puede estar en uno de estos estados:
  1. libre
  2. asignada a una zona
- si una fecha aún está libre, la primera reserva compatible del día define la zona operativa de esa fecha
- después de eso, solo clientes de esa misma zona podrán ver ese día como disponible
- si una fecha ya fue tomada por otra zona, no debe mostrarse al cliente
- el cliente solo verá días que estén libres o ya asignados a su misma zona

#### Zonas operativas
##### LIMA NORTE
- Ancón
- Carabayllo
- Comas
- Independencia
- Los Olivos
- Puente Piedra
- San Martín de Porres
- Santa Rosa
- Callao (Cercado)
- Bellavista
- Carmen de la Legua-Reynoso
- La Perla
- La Punta
- Ventanilla
- Mi Perú
- Rímac

##### LIMA CENTRO
- Breña
- Jesús María
- La Victoria
- Lima (Cercado de Lima)
- Lince
- Magdalena del Mar
- Pueblo Libre
- San Borja
- San Isidro
- San Luis
- Santiago de Surco (parte urbana tradicional)
- Surquillo
- Barranco
- Miraflores
- San Miguel

##### LIMA ESTE
- Ate
- Chaclacayo
- Cieneguilla
- El Agustino
- La Molina
- Lurigancho (Chosica)
- San Juan de Lurigancho
- Santa Anita

##### LIMA SUR
- Lurín
- Pachacámac
- Pucusana
- Punta Hermosa
- Punta Negra
- San Bartolo
- San Juan de Miraflores
- Santa María del Mar
- Villa El Salvador
- Villa María del Triunfo
- Chorrillos

#### Reglas de cálculo
- la zona del cliente se calcula usando principalmente el distrito de la dirección de instalación o del recibo validado
- si el distrito no está reconocido en la tabla de zonas, no se debe mostrar agenda y el caso debe derivarse a revisión o asesor
- si el cliente corrige la dirección y cambia de distrito, el sistema debe recalcular la zona y volver a consultar la disponibilidad
- si cambia la zona, se invalidan las fechas y horarios ofrecidos anteriormente

#### Reglas de confirmación
- el bot no debe confirmar una cita si falta dirección final, zona, día o horario válidos
- el bot no debe crear citas duplicadas
- el bot no debe confirmar citas con dirección indefinida o datos incompletos
- antes de registrar la cita, debe hacerse una validación final de disponibilidad
- cuando se confirme una cita, debe registrarse la fecha, el horario, la dirección y la zona del cliente

#### Fuente oficial de disponibilidad
- la disponibilidad de agenda se valida primero en Microsoft Calendar
- después se valida contra Supabase
- ambos deben coincidir antes de ofrecer un día u horario
- si Microsoft Calendar y Supabase no coinciden, el bot no debe confirmar la cita y el caso debe quedar en revisión
- la zona operativa puede inferirse y validarse usando la información de citas ya registradas en Supabase

#### Mensaje de días disponibles
Cuando el usuario pase al bloque de agenda, el chatbot debe responder con este formato, mostrando solo los días realmente disponibles para la zona del cliente:

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

Reglas de este mensaje:
- el bot solo debe mostrar días que estén libres o ya asignados a la misma zona del cliente
- si un día ya fue asignado a otra zona, no debe ofrecerse
- la lista real puede tener menos de cinco opciones, según disponibilidad
- el usuario debe responder con la letra de una opción válida
- no se debe aceptar texto libre como selección de día en este punto
- antes de mostrar los días, el sistema debe consultar primero Microsoft Calendar y luego validar consistencia con Supabase
- si el cliente cambia de zona o cambia la dirección, se recalculan días y horarios desde cero
+
+#### Mensaje de horarios disponibles
+Cuando el usuario elija un día válido, el chatbot debe responder con este formato, mostrando solo los horarios realmente disponibles para ese día:
+
+> Perfecto.
+>
+> Estos son los horarios disponibles para ese día:
+>
+> C. 2:00 p. m.
+> D. 3:30 p. m.
+>
+> Por favor responde con la letra de la opción que prefieras.
+
+Reglas de este mensaje:
+- los horarios ofrecidos deben salir de la validación real de disponibilidad en Microsoft Calendar
+- luego deben validarse nuevamente contra Supabase
+- solo se muestran horarios válidos para ese día según las reglas operativas del sistema
+- el usuario no puede escribir una hora libre fuera de las opciones ofrecidas
+- si la disponibilidad cambió antes de confirmar, el sistema debe recalcular y volver a ofrecer opciones válidas

### Paso 10. Confirmación de cita
Cuando el usuario elija un horario válido y se confirme la disponibilidad final, el sistema debe:
- agendar internamente la cita en Microsoft Calendar
- registrar la cita en Supabase
- enviar invitación de calendario al correo del cliente, sea Gmail, Hotmail o correo empresarial
- enviar también un correo de confirmación de la cita
- registrar fecha, horario, dirección y zona del cliente

Luego, el chatbot debe responder exactamente:

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

### Paso 11. Gestión posterior
La base funcional debe contemplar que más adelante se pueda:
- reprogramar una cita
- cancelar una cita

En V1, esto puede quedar definido como capacidad prevista, aunque no necesariamente completa en la primera entrega técnica.

---

## 6. Capacidades obligatorias del sistema en V1
El chatbot debe ser capaz de:
- registrar correctamente la conversación
- registrar correctamente los datos del cliente
- mantener el estado del flujo sin reiniciarse
- recuperar contexto de la conversación en cada paso
- validar mejor respuestas libres
- validar respuestas basadas en opciones
- evitar confirmar citas con datos incompletos o incorrectos
- derivar a un asesor si el caso lo requiere

---

## 7. Reglas funcionales clave
1. El flujo no debe perder contexto entre mensajes.
2. El flujo no debe reiniciarse si el usuario cambia momentáneamente de tema.
3. No se debe confirmar una cita si faltan datos mínimos.
4. Las respuestas libres deben validarse antes de aceptarse como definitivas.
5. Las respuestas por opciones deben mapearse correctamente al estado interno.
6. Si el bot no puede continuar con seguridad, debe escalar o pedir aclaración.
7. Debe existir trazabilidad de los datos obtenidos por extracción y de los ingresados manualmente.

---

## 8. Datos funcionales mínimos a capturar en V1
### Datos de conversación
- canal
- estado_conversacion
- paso_actual
- resumen
- consentimiento
- historial de mensajes

### Datos del cliente
- nombre
- DNI o RUC
- correo electrónico
- teléfono

### Datos de instalación
- dirección
- distrito
- provincia
- referencias

### Datos del recibo
- archivo o imagen recibida
- origen del dato (extraído o manual)
- campos relevantes del recibo
- estado de validación básica

### Datos del vehículo
- marca
- modelo

### Datos de cita
- fecha seleccionada
- horario seleccionado
- estado de cita
- código o identificador de cita

---

## 9. Qué no incluye esta versión
La V1 no incluirá en esta fase:
- módulo interno tipo Nexus
- monitoreo operativo de EVINKA Connect dentro del mismo flujo
- automatizaciones internas mezcladas con el flujo público
- operación completa de correo y calendario como módulo amplio
- lógica interna avanzada ajena al flujo público de atención

---

## 10. Resultado esperado de la V1
Al terminar esta fase, EVINKA debe tener una definición clara de un chatbot que:
- atiende por WhatsApp
- guía al cliente en el flujo de instalación de cargador
- captura los datos críticos
- mantiene contexto
- propone y confirma visitas técnicas de forma controlada
- deja preparado el camino para integraciones y módulos posteriores
