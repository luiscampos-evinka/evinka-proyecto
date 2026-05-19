# Separación por país: Perú / Colombia

## Decisión vigente
EVINKA mantiene **una sola plataforma** y **un solo monorepo**, pero con separación operativa real entre **Perú (PE)** y **Colombia (CO)**.

## Qué sí puede ser compartido
- motor base del chatbot
- infraestructura backend común
- componentes UI reutilizables
- utilidades de scripts y auditoría
- patrones generales de roles y trazabilidad

## Qué debe quedar separado
- configuración comercial
- catálogos y reglas de negocio
- copy legal / documental
- cotizaciones
- visitas, órdenes y conformidades
- branding y distribución móvil
- automatizaciones que dependan del país

## Implementación actual visible
- `apps/evinka-suite` ya maneja variantes PE/CO
- `apps/cotizador-web` ya debe resolver textos y comportamiento según país activo
- `deliverables/app-peru/` y `deliverables/app-colombia/` ya separan releases

## Regla dura
Ningún ajuste para Colombia debe afectar Perú por accidente, y viceversa.

## Guía práctica
Cuando se toque una funcionalidad, revisar siempre estas 3 preguntas:
1. ¿esto es compartido o país-específico?
2. si es país-específico, ¿PE y CO quedan aislados?
3. ¿la documentación deja claro dónde vive esa separación?

## Colombia
Para Colombia, el criterio actual es no copiar Perú de forma ciega. Debe mantenerse una capa propia para:
- reglas comerciales CO
- plantillas y documentos CO
- catálogos técnicos CO
- agenda / citas / instalaciones CO
- etiquetas documentales CO (`NIT`, `CC`, ciudad base, host, etc.)

## Recomendación de naming
- `country: 'PE' | 'CO'`
- `allowedCountries`
- `app-peru` / `app-colombia`
- `pe-suite.evinka.net` / `co-suite.evinka.net`

## Checklist antes de liberar
- copy correcto por país
- host correcto por país
- labels documentales correctos
- artefactos de release en carpeta correcta
- validación de que un cambio CO no rompe PE
