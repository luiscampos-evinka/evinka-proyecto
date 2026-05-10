# UNIVERSIDAD DE INGENIERÍA Y TECNOLOGÍA

**Curso:** Proyecto Preprofesional  
**DOCUMENTO DEL PROYECTO:** ENTREGABLE 1 – EVINKA  
**Autor:** Luis Campos  
**Asesor:** [Completar]  
**Lugar y fecha:** Lima, abril de 2026

---

# Índice

1. Introducción  
   1.1. Contexto general del proyecto  
   1.2. Importancia del tema  
   1.3. Propósito del informe  
2. Contexto organizacional  
   2.1. Descripción de la organización  
   2.2. Modelo de negocio básico  
   2.3. Stakeholders principales  
3. Planteamiento del problema  
   3.1. Problema definido  
   3.2. Evidencia preliminar  
   3.3. Causas iniciales identificadas  
4. Propuesta de solución  
   4.1. Alternativas identificadas  
   4.2. Criterios de selección  
   4.3. Justificación preliminar  
   4.4. Metodología de trabajo adoptada  
   4.5. Arquitectura preliminar de la solución  
5. Justificación  
   5.1. Beneficios cualitativos  
   5.2. Alineación estratégica  
6. Stakeholders  
   6.1. Identificación inicial  
7. Riesgos  
   7.1. Lista preliminar de riesgos  
8. Referencias  
9. Anexos  
   9.1. Evidencias preliminares  
   9.2. Flujos funcionales del chatbot EVINKA  
   9.3. Arquitectura técnica preliminar  
   9.4. Estado Center / panel de monitoreo  
   9.5. Cotizador y validación comercial en Excel  

---

# 1. Introducción

## 1.1. Contexto general del proyecto

El presente proyecto nace de una necesidad concreta de EVINKA: estructurar y digitalizar parte de su operación comercial y técnica alrededor de la atención al cliente, la evaluación de instalaciones para cargadores, la coordinación de visitas técnicas, la preparación de cotizaciones y la visualización operativa del estado de su red. En términos prácticos, EVINKA necesitaba dejar atrás una operación fragmentada, dependiente de mensajes sueltos, validaciones manuales y criterios dispersos, para pasar a una solución más ordenada, trazable y escalable.

A partir de esa necesidad se fueron consolidando tres líneas principales de trabajo. La primera fue el **EVINKA Chatbot**, orientado a atender al cliente, solicitar y validar información, leer recibos de luz, guiar el flujo comercial y preparar la base de datos necesaria para la visita técnica y la futura cotización. La segunda fue el **EVINKA Status Center**, pensado como un panel web de monitoreo y consulta operativa para visualizar datos, disponibilidad, exportaciones y resúmenes de estado. La tercera fue el **Cotizador EVINKA**, inicialmente validado en Excel como herramienta comercial estructurada, antes de llevar la lógica al código productivo.

El enfoque real del proyecto no fue únicamente “programar un bot”, sino construir una solución digital integral que conecte operación, atención, evaluación técnica, monitoreo y estructura comercial. Para lograrlo, se combinaron decisiones de producto, automatización, arquitectura técnica, validación iterativa y control operativo. Además, el proyecto se desarrolló sin contenedores ni una plataforma PaaS tradicional; en su lugar, se utilizó una infraestructura basada en servidor Linux, ejecución directa con Node.js, publicación web clásica y orquestación técnica mediante OpenClaw como entorno principal de trabajo, automatización y soporte operativo.

## 1.2. Importancia del tema

La importancia del proyecto radica en que aborda un punto crítico en organizaciones que dependen de flujos técnico-comerciales: la falta de integración entre atención, evaluación, validación y seguimiento. Cuando un proceso de instalación técnica depende de conversaciones dispersas, revisión manual de documentos, criterios no estandarizados y baja trazabilidad, se generan retrasos, errores de coordinación, reprocesos y pérdida de calidad en la atención.

En el caso de EVINKA, esta situación tiene un impacto directo en la experiencia del cliente, en la productividad interna y en la capacidad de escalar la operación. Un chatbot bien diseñado reduce tiempos de recolección de datos y mejora consistencia; un cotizador validado evita errores comerciales; y un panel de status bien estructurado mejora visibilidad y seguimiento. Por lo tanto, el proyecto no solo responde a una necesidad tecnológica, sino también a una necesidad de orden organizacional, eficiencia operativa y preparación para crecimiento.

Adicionalmente, el proyecto tiene relevancia porque combina dimensiones hoy fundamentales en la transformación digital: automatización conversacional, consumo de APIs, gestión de datos, experiencia de usuario, validación de reglas de negocio, monitoreo operativo y disciplina de costos tecnológicos. En ese sentido, EVINKA funciona como un caso real de implementación progresiva de herramientas digitales sobre una operación concreta.

## 1.3. Propósito del informe

El propósito de este informe es documentar de manera profesional el planteamiento inicial del proyecto, describiendo el contexto de EVINKA, el problema identificado, la lógica de la solución propuesta, la metodología empleada, la arquitectura preliminar construida y las primeras decisiones técnicas y funcionales que sustentan el desarrollo. Este documento corresponde al **primer entregable**, por lo que su foco principal está en justificar el proyecto, mostrar el entendimiento del problema, presentar la propuesta de solución y dejar una base ordenada para los siguientes entregables.

Asimismo, este informe busca dejar constancia de que el proyecto no ha sido una implementación improvisada, sino una construcción iterativa guiada por criterios metodológicos, decisiones de arquitectura, validación con evidencia y una orientación práctica al valor. Aunque varias piezas ya tienen avances funcionales concretos, este entregable se centra en presentar la lógica profesional que da sentido a todo el sistema.

---

# 2. Contexto organizacional

## 2.1. Descripción de la organización

EVINKA es una organización orientada al ecosistema de movilidad eléctrica y soluciones asociadas a cargadores, instalaciones, monitoreo y servicios relacionados. Su operación requiere interacción constante entre el área comercial, la validación técnica y la gestión operativa. Esto implica trabajar con clientes que solicitan información o instalaciones, técnicos que evalúan condiciones reales en campo, y una estructura interna que debe convertir esa información en agenda, cotización y seguimiento.

A nivel funcional, EVINKA necesita coordinar varios tipos de información: datos del cliente, documentos como recibos de luz, validación de potencia contratada, ubicación del punto de instalación, disponibilidad de técnicos, materiales, reglas de cotización y estado operativo de la infraestructura. Por eso, el proyecto desarrollado no se limita a una sola pantalla o a un solo bot, sino a un conjunto articulado de componentes digitales.

Desde una perspectiva organizacional, el proyecto se ubica en la intersección entre operaciones, servicio al cliente, automatización y control. Esto hace que la solución tenga un carácter transversal: impacta atención, ventas, evaluación técnica, monitoreo y toma de decisiones.

## 2.2. Modelo de negocio básico

El modelo de negocio básico asociado a EVINKA combina atención consultiva, evaluación técnica y ejecución de servicios relacionados con cargadores e infraestructura vinculada. Para concretar una instalación o venta, no basta con responder mensajes: es necesario validar la factibilidad técnica, organizar una visita, identificar condiciones del sitio, estimar materiales, calcular costos y dar seguimiento.

Eso significa que el valor no está solamente en vender un equipo, sino en entregar una solución viable, segura y correctamente cotizada. En ese contexto, la estandarización de información y la trazabilidad se vuelven activos estratégicos. Si la empresa logra capturar datos correctos desde el primer contacto, validar documentos con menor error y traducir esa información en decisiones operativas, reduce fricción y mejora capacidad de conversión.

Además, el Status Center aporta valor desde otro frente: permite visualizar y monitorear datos operativos, facilitando la gestión y consulta sobre el estado de la red o de determinados puntos de servicio. Esto fortalece el control interno y la calidad del servicio percibido.

## 2.3. Stakeholders principales

Los principales stakeholders del proyecto son los siguientes:

- **Cliente final:** persona interesada en instalar o comprar un cargador, coordinar visita o recibir soporte. Es el usuario de entrada del chatbot y el principal afectado por la calidad del flujo.
- **Equipo comercial:** necesita información clara y estructurada para dar seguimiento, cerrar oportunidades y reducir fricción en el proceso de atención.
- **Equipo técnico / visitas:** utiliza la información recopilada para validar viabilidad, confirmar condiciones reales e identificar requerimientos de instalación.
- **Operación / coordinación:** depende de una agenda clara, datos confiables y trazabilidad para ejecutar las acciones correctas.
- **Liderazgo / dirección del proyecto:** requiere visibilidad del avance, consistencia metodológica y una base técnica sólida para escalar el sistema.
- **Usuarios del Status Center:** necesitan consultar información operativa de manera clara, confiable y actualizada.
- **Equipo de desarrollo / automatización:** responsable de diseñar, programar, integrar y mantener los componentes técnicos del sistema.
- **Proveedores externos de servicios digitales:** como Meta, Supabase, OpenAI y Microsoft, que participan como plataformas o integraciones habilitadoras.

---

# 3. Planteamiento del problema

## 3.1. Problema definido

Antes del desarrollo de esta solución, el flujo de EVINKA presentaba una problemática central: la información crítica del cliente, del sitio de instalación y de la evaluación comercial/técnica no estaba suficientemente estructurada ni automatizada desde el inicio del proceso. Esto generaba dependencia de revisiones manuales, interpretaciones variables, mensajes no estandarizados y reprocesos posteriores.

En la práctica, esto se traduce en varios subproblemas:

1. **Recolección desordenada de datos.** El cliente podía compartir información de forma incompleta, ambigua o dispersa, obligando a insistir varias veces por el mismo dato.
2. **Validación manual del recibo y datos eléctricos.** La lectura de dirección, distrito, provincia o potencia contratada implicaba tiempo operativo adicional y riesgo de error.
3. **Dependencia de criterios comerciales no centralizados.** La lógica de cotización y materiales podía dispersarse si no se definía una fuente única de verdad.
4. **Falta de trazabilidad conversacional y operativa.** Sin un flujo estructurado, era más difícil saber en qué etapa estaba cada caso.
5. **Baja visibilidad del estado operativo.** La información de status o disponibilidad no estaba empaquetada de forma óptima para consulta limpia y actualización controlada.
6. **Costo tecnológico potencialmente desordenado.** Sin disciplina sobre modelos, polling, OCR o automatizaciones, el sistema podía volverse costoso e ineficiente.

En síntesis, el problema no era simplemente “falta un bot”, sino la ausencia de una arquitectura operativa digital coherente que conecte atención, validación, cotización y monitoreo.

## 3.2. Evidencia preliminar

La evidencia preliminar que sustenta el problema surge del propio desarrollo y observación del flujo real:

- Se detectó que el chatbot necesitaba manejar opciones guiadas, consentimiento de uso de datos, lectura de recibos, validación manual asistida, agenda y reglas de continuidad conversacional.
- Se verificó la necesidad de leer documentos como recibos de luz y extraer campos puntuales, como dirección del suministro, distrito, provincia y potencia contratada.
- Se confirmó que el cotizador debía separarse en capas claras: parámetros, formulario técnico, catálogo maestro y hoja de cotización; además, se decidió que el catálogo fuese la única fuente de costos y precios.
- Se detectó que el panel de status requería mejor criterio de actualización, reducción de polling excesivo y control de costos por automatizaciones demasiado frecuentes.
- También se identificó la necesidad de reducir errores humanos mediante restricciones, parametrización y validaciones tipo “fail-safe”.

Esta evidencia no surge de una hipótesis abstracta, sino de iteraciones reales sobre el producto, pruebas funcionales, revisiones de arquitectura y ajustes a reglas de negocio concretas.

## 3.3. Causas iniciales identificadas

Las causas iniciales identificadas del problema son las siguientes:

- Ausencia de un flujo conversacional completamente estructurado desde el primer contacto.
- Dependencia de interpretación humana en documentos o mensajes semi-estructurados.
- Falta de centralización temprana de reglas comerciales y de costos.
- Carencia de una separación clara entre validación conceptual, validación comercial y paso a producción.
- Necesidad de integrar varias plataformas externas bajo una sola lógica operativa.
- Falta de mecanismos preventivos explícitos para errores de entrada, errores de proceso y sobrecostos tecnológicos.

---

# 4. Propuesta de solución

## 4.1. Alternativas identificadas

Durante el desarrollo del proyecto se pueden identificar, al menos, tres alternativas conceptuales para resolver el problema:

### Alternativa 1: mantener el proceso mayormente manual
Esta alternativa implicaba continuar operando con atención humana apoyada solo en herramientas dispersas, mensajes no estructurados y validaciones manuales. Su principal ventaja era no requerir una arquitectura nueva en el corto plazo. Sin embargo, sus desventajas eran claras: escalabilidad limitada, mayor error, dependencia del criterio individual y baja trazabilidad.

### Alternativa 2: desarrollar únicamente un chatbot de respuestas básicas
Esta opción consistía en implementar un bot limitado a menús, respuestas frecuentes y desvío a humano, sin incorporar lógica fuerte de datos, OCR, agenda, estado conversacional ni conexión con el resto del ecosistema. Aunque técnicamente era más sencilla, no resolvía el problema de fondo: la necesidad de estructurar el proceso completo.

### Alternativa 3: construir una solución integral y modular
La tercera alternativa, que fue la elegida, consistía en construir una solución más completa: un chatbot con manejo de estado, lectura de recibos, captura estructurada de datos, soporte a agenda y continuidad de flujo; un panel de status para monitoreo y visualización; y un cotizador validado por etapas, primero en Excel y luego listo para convertirse en lógica productiva. Esta alternativa permitía resolver el problema de forma sistémica y no solo superficial.

## 4.2. Criterios de selección

Los criterios que sustentaron la selección de la alternativa integral fueron los siguientes:

- **Capacidad de resolver el problema de raíz**, no solo responder superficialmente.
- **Escalabilidad**, tanto técnica como operativa.
- **Trazabilidad del flujo**, para saber en qué estado se encuentra cada interacción o proceso.
- **Modularidad**, para evolucionar el sistema por componentes sin rehacer todo.
- **Reducción de errores**, mediante validaciones y parametrización.
- **Viabilidad técnica**, aprovechando herramientas disponibles como Node.js, Supabase, OpenClaw, Meta y frontends web clásicos.
- **Viabilidad incremental**, permitiendo validar primero y productivizar después.
- **Control de costos tecnológicos**, sobre todo en OCR, polling y jobs automáticos.

## 4.3. Justificación preliminar

La solución integral fue seleccionada porque se ajusta mejor al comportamiento real del negocio. EVINKA no necesita un bot decorativo, sino una estructura operativa capaz de ordenar la captura de información, validar condiciones técnicas, mantener consistencia comercial y dar visibilidad operativa.

Además, el proyecto fue pensado de manera incremental. Un ejemplo claro de esto es el cotizador: antes de moverlo a código productivo, se decidió validar la lógica completa en Excel. Esa decisión demuestra que la solución no fue concebida desde el entusiasmo tecnológico, sino desde una lógica de riesgo controlado y aprendizaje validado.

## 4.4. Metodología de trabajo adoptada

La metodología adoptada para el proyecto fue de carácter **híbrido**, porque el trabajo combinó exploración del problema, validación iterativa y ejecución continua. No se trató de un proyecto puramente predictivo ni de uno ágil formal con sprints rígidos; más bien, se construyó una forma de trabajo adaptada al contexto del proyecto y a la evolución del producto.

### a) Design Thinking para entender la problemática
Se utilizó una lógica cercana a Design Thinking para entender el problema, levantar puntos de dolor, revisar stakeholders, analizar el flujo actual e identificar qué fricciones existían en la atención, validación y operación. Esta parte fue importante para no comenzar “programando por programar”, sino a partir de una lectura clara del problema y del usuario.

### b) Lean Startup para validar la solución
Se aplicó una lógica de Lean Startup en la construcción iterativa de la solución. En lugar de construir una solución cerrada desde el principio, se fueron probando versiones, ajustando reglas, corrigiendo supuestos y validando con evidencia. La validación del cotizador en Excel antes de llevarlo a código es un ejemplo directo de esta lógica.

### c) Kanban para la gestión del flujo de trabajo
La ejecución táctica se comportó más como un flujo continuo de trabajo priorizado que como ciclos cerrados de Scrum. Por ello, Kanban describe mejor la práctica real: tareas por etapas, prioridades cambiantes, corrección continua, trabajo sobre cuellos de botella y avance incremental de componentes.

### d) Poka-Yoke para prevención de errores
Se integraron principios de prevención de errores en el diseño funcional del sistema. Esto se ve en la parametrización del cotizador, la fuente única de verdad en catálogo, la separación entre obligatorios y condicionales, las confirmaciones de OCR, las respuestas guiadas por letra, las validaciones de datos y la reducción de decisiones ambiguas en el flujo.

En conjunto, la metodología del proyecto puede describirse como una **combinación de enfoque híbrido, Design Thinking, Lean Startup, Kanban y Poka-Yoke**, articulada no como teoría decorativa, sino como una forma real de trabajo aplicada a un producto digital en evolución.

## 4.5. Arquitectura preliminar de la solución

La solución propuesta se compone de cuatro bloques principales.

### 1. Núcleo conversacional: EVINKA Chatbot
Es el componente que recibe mensajes, identifica intención, guía al usuario por un flujo estructurado y registra el estado conversacional. Aquí se concentran reglas como:

- menú principal
- consentimiento de uso de datos
- lectura de recibos
- captura manual asistida
- confirmación de datos
- coordinación de visita técnica
- validación de opciones del flujo

### 2. Capa de datos y persistencia
La persistencia principal se apoya en **Supabase**, utilizado como núcleo de datos y estado mediante acceso REST y almacenamiento complementario. Allí se registran o consultan entidades relevantes para la continuidad del flujo y la trazabilidad.

### 3. Capa operativa y de monitoreo: EVINKA Status Center
Es el panel web orientado a visualización, consulta, exportaciones y monitoreo. Consume datasets generados por scripts y publicados al entorno web, permitiendo presentar un estado consolidado y más legible para usuarios operativos.

### 4. Capa comercial de validación: Cotizador EVINKA
El cotizador fue trabajado primero en Excel como instrumento de validación funcional. Su estructura quedó organizada en cuatro hojas principales:

- `00_PARAMETROS`
- `01_FORM_VISITA`
- `02_CATALOGO`
- `03_COTIZADOR`

Esta separación permitió validar factores, márgenes, calibres, costos, lógica comercial y reglas de selección antes de pasar la solución a código.

### Herramienta principal del proyecto: OpenClaw
La herramienta central utilizada en el desarrollo y operación del proyecto fue **OpenClaw**, no como un simple editor, sino como entorno operativo principal. OpenClaw permitió:

- leer y editar archivos del proyecto
- ejecutar scripts y pruebas
- inspeccionar el workspace
- automatizar tareas programadas
- trabajar con memoria de contexto del proyecto
- generar y validar artefactos
- ayudar en la implementación y mejora continua

En otras palabras, OpenClaw funcionó como el corazón del entorno de desarrollo y automatización del proyecto.

---

# 5. Justificación

## 5.1. Beneficios cualitativos

Los beneficios cualitativos esperados del proyecto son los siguientes:

- Mayor orden en la operación comercial y técnica.
- Mejor experiencia del cliente en el contacto inicial.
- Reducción de ambigüedad en la recolección de datos.
- Menor carga manual en validaciones repetitivas.
- Mayor consistencia en la cotización.
- Mejor visibilidad operativa mediante el Status Center.
- Mayor capacidad de escalar procesos con menos fricción.
- Base tecnológica más clara para futuras integraciones.

Adicionalmente, el proyecto aporta profesionalización de la operación. No solo automatiza tareas, sino que impone una estructura de trabajo más robusta, lo que mejora calidad y control.

## 5.2. Alineación estratégica

La propuesta está alineada con necesidades estratégicas típicas de una organización en crecimiento que busca digitalizar su operación sin perder control. En particular, la solución se alinea con:

- **Eficiencia operativa**, al reducir reprocesos y tiempos muertos.
- **Experiencia del cliente**, al ordenar el contacto y la continuidad del flujo.
- **Calidad comercial**, al validar lógica de cotización y centralizar costos.
- **Visibilidad del negocio**, mediante paneles y datasets operativos.
- **Escalabilidad**, gracias a una arquitectura modular.
- **Aprendizaje organizacional**, al documentar reglas, flujos y decisiones.

---

# 6. Stakeholders

## 6.1. Identificación inicial

A continuación, se presenta una identificación preliminar de stakeholders con su relación principal respecto al proyecto:

- **Luis Campos:** impulsor del proyecto, tomador de decisiones y principal responsable de la dirección funcional del sistema.
- **Clientes EVINKA:** usuarios externos que interactúan con el chatbot y reciben valor directo del ordenamiento del flujo.
- **Asesores comerciales:** usuarios internos que necesitan que el sistema entregue información útil, legible y accionable.
- **Técnicos de visita:** reciben datos necesarios para evaluar instalaciones y alimentar la cotización.
- **Equipo de operación / seguimiento:** depende de la continuidad y trazabilidad del proceso.
- **Usuarios del Status Center:** consultan información operativa para monitoreo y seguimiento.
- **Meta / WhatsApp Cloud API:** proveedor del canal de mensajería.
- **Supabase:** proveedor de persistencia, almacenamiento y acceso a datos.
- **OpenAI:** proveedor de capacidades de OCR multimodal y redacción asistida en funciones específicas.
- **Microsoft Graph:** proveedor de capacidades potenciales de agenda y correo en componentes asociados.
- **OpenClaw:** plataforma principal de ejecución, automatización, orquestación y desarrollo del entorno de trabajo.

---

# 7. Riesgos

## 7.1. Lista preliminar de riesgos

Se identifican los siguientes riesgos preliminares:

1. **Errores de extracción OCR.** Un recibo poco legible o ambiguo puede generar lectura parcial o incorrecta.
2. **Cambios en reglas de negocio.** La lógica comercial puede variar durante el proyecto, obligando a reestructurar partes del flujo.
3. **Dependencia de servicios externos.** APIs de Meta, Supabase, OpenAI o Microsoft pueden cambiar comportamiento, cuotas o costos.
4. **Sobrecosto por automatizaciones frecuentes.** Polling, jobs muy seguidos o modelos costosos pueden aumentar innecesariamente el gasto.
5. **Errores en cotización si no existe fuente única de verdad.** Por eso se definió el catálogo como base central.
6. **Desalineación entre validación conceptual y despliegue real.** Una lógica válida en entorno de prueba puede necesitar ajustes al pasar a producción.
7. **Dependencia de permisos de despliegue.** Algunas publicaciones, como archivos servidos en web, pueden requerir permisos adicionales en servidor.
8. **Riesgo de complejidad incremental.** Al crecer el número de componentes, también crece la necesidad de control documental y técnico.

Como respuesta preliminar a estos riesgos, el proyecto ya viene aplicando mitigaciones como validación iterativa, pruebas controladas, parametrización, control de polling, defaults económicos en modelos y separación por componentes.

---

# 8. Referencias

- Project Management Institute. (2025). *The Standard for Project Management and a Guide to the Project Management Body of Knowledge*.  
- Scrum Manager. (2026). *Scrum Master – Temario troncal v.4.0*.  
- Ries, E. *The Lean Startup*.  
- Lewrick, M., Link, P., & Leifer, L. *The Design Thinking Toolbox*.  
- PMO Global Alliance / PMI. *PMO Health Assessment*.  
- PMO Global Alliance / PMI. *PMO Service Insights Assessment*.  
- Materiales académicos del curso Proyecto Preprofesional y gestión de proyectos aplicados al presente trabajo.  
- Documentación técnica y archivos de trabajo generados durante el desarrollo del proyecto EVINKA.  

---

# 9. Anexos

## 9.1. Evidencias preliminares

**Espacio sugerido para insertar evidencias:**

- captura del workspace del proyecto
- estructura de carpetas principales
- capturas del flujo de desarrollo
- ejemplos de pruebas o validaciones realizadas
- evidencia de iteraciones del cotizador

**[ESPACIO PARA IMAGEN / CAPTURA A1]**

**[ESPACIO PARA IMAGEN / CAPTURA A2]**

## 9.2. Flujos funcionales del chatbot EVINKA

Descripción resumida del flujo del bot:

1. saludo y menú principal  
2. consentimiento de uso de datos  
3. solicitud de DNI/RUC y recibo  
4. lectura OCR o ingreso manual del recibo  
5. confirmación de datos detectados  
6. identificación de persona que recibirá al técnico  
7. explicación de visita técnica  
8. agenda / coordinación  
9. preparación de continuidad comercial

**[ESPACIO PARA DIAGRAMA DE FLUJO B1 – MENÚ PRINCIPAL]**

**[ESPACIO PARA DIAGRAMA DE FLUJO B2 – RECEPCIÓN Y VALIDACIÓN DEL RECIBO]**

**[ESPACIO PARA DIAGRAMA DE FLUJO B3 – AGENDA Y CONTINUIDAD]**

## 9.3. Arquitectura técnica preliminar

### Lenguajes y tecnologías utilizadas

- **JavaScript (Node.js con módulos ESM):** backend principal, scripts, automatizaciones y lógica del bot.
- **HTML, CSS y JavaScript vanilla:** frontend web del Status Center y componentes visuales.
- **Excel / ExcelJS:** validación y generación de cotizadores en etapa pre-productiva.
- **JSON / REST:** intercambio de datos entre servicios y persistencia estructurada.

### Herramientas utilizadas

- **OpenClaw:** entorno principal de desarrollo, automatización, ejecución, edición y soporte operativo.
- **Node.js:** runtime principal para scripts, backend y procesos.
- **Supabase:** base de datos / capa REST / storage.
- **Meta WhatsApp Cloud API:** canal principal de mensajería del bot.
- **OpenAI:** OCR multimodal y redacción asistida en ciertos procesos específicos.
- **Microsoft Graph:** integración prevista y parcialmente conectada para correo y calendario.
- **ExcelJS:** generación programática de archivos Excel de validación.

### Cómo se desarrolló el sistema

El sistema fue desarrollado directamente sobre un **workspace de OpenClaw** alojado en un entorno Linux, trabajando sobre archivos reales del proyecto, scripts Node.js y componentes web. No se utilizó Docker; en su lugar, el despliegue y ejecución se realizaron de forma directa en el servidor, utilizando el runtime nativo, rutas locales, publicación a directorios web y automatizaciones programadas.

### Cómo se despliega

El despliegue depende del componente:

- el **chatbot** se ejecuta como servicio Node.js que escucha webhooks de Meta
- el **Status Center** se publica como aplicación web servida desde directorios del host
- los **datasets** se generan mediante scripts y se copian a rutas públicas del sitio web
- los **jobs automáticos** se controlan mediante cron jobs gestionados desde OpenClaw Gateway
- los **archivos de validación** como el cotizador Excel se generan localmente y se suben a Supabase Storage

### Dónde se guarda la información

- **workspace local / servidor:** código fuente, scripts, datasets intermedios, archivos generados
- **Supabase:** datos persistentes, storage de archivos, recursos de apoyo y documentos
- **directorios web del host:** archivos publicados para consumo del sitio, por ejemplo datasets de status
- **memoria y archivos de proyecto en OpenClaw:** contexto operativo, documentación y continuidad del trabajo

**[ESPACIO PARA DIAGRAMA TÉCNICO C1 – ARQUITECTURA GENERAL]**

**[ESPACIO PARA DIAGRAMA TÉCNICO C2 – FLUJO WHATSAPP → BOT → DATOS]**

## 9.4. Estado Center / panel de monitoreo

El Status Center fue concebido como una capa de visualización operativa para EVINKA. Su función principal es transformar datos dispersos o capturados desde diversas fuentes en un dataset legible, consultable y útil para monitoreo. Para ello se desarrolló una aplicación web y scripts de consolidación que preparan información y la publican en formato consumible por el panel.

Aspectos importantes del componente:

- generación de `overview-data.json`
- consumo de fuentes live y/o snapshots
- criterio visual alineado con experiencia de EVINKA Connect
- control de frecuencia de actualización
- optimización del polling para reducir costo y ruido
- soporte a exportaciones y vistas asociadas

**[ESPACIO PARA IMAGEN D1 – DASHBOARD PRINCIPAL]**

**[ESPACIO PARA IMAGEN D2 – MAPA / DISPONIBILIDAD]**

**[ESPACIO PARA IMAGEN D3 – EXPORTACIONES / STATUS]**

## 9.5. Cotizador y validación comercial en Excel

El cotizador fue tratado como una fase de validación esencial del proyecto. Antes de codificar la lógica comercial en producción, se estructuró una solución en Excel con el objetivo de validar reglas, cálculos, factores, costos, márgenes y criterios técnicos.

La estructura final de validación quedó organizada en:

- `00_PARAMETROS`: factores y límites editables  
- `01_FORM_VISITA`: datos de visita técnica  
- `02_CATALOGO`: maestro único de costos y reglas  
- `03_COTIZADOR`: hoja que consume catálogo y calcula

Entre los criterios ya validados se encuentran:

- catálogo como fuente única de verdad
- separación entre obligatorios y condicionales
- cálculo de margen con divisor parametrizable
- selección de cable principal por distancia y calibre
- factor general de costos movido al catálogo
- iteración de versiones hasta llegar a validaciones avanzadas

**[ESPACIO PARA IMAGEN E1 – ESTRUCTURA DEL COTIZADOR]**

**[ESPACIO PARA IMAGEN E2 – CATÁLOGO MAESTRO]**

**[ESPACIO PARA IMAGEN E3 – FLUJO DE VALIDACIÓN EXCEL → CÓDIGO]**

---

# Cierre preliminar

Como primer entregable, este documento busca demostrar que el proyecto EVINKA ya cuenta con una base sólida de definición del problema, lógica de solución, metodología de trabajo y arquitectura preliminar. El desarrollo realizado hasta ahora muestra que no se trata de una idea aislada, sino de una construcción concreta, modular y profesional, sostenida sobre herramientas reales, decisiones de diseño justificadas y una estrategia clara de validación progresiva.

En los siguientes entregables corresponderá profundizar en objetivos, alcance, EDT, cronograma, presupuesto, KPIs, plan de implementación, control, resultados proyectados y documentación técnica más cerrada. Sin embargo, incluso en esta fase inicial, ya es posible sostener que el proyecto tiene coherencia, valor organizacional y una base tecnológica adecuada para continuar su evolución.
