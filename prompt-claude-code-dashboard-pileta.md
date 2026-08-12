# Prompt para Claude Code — Dashboard Pileta (Demo v1)

## Contexto
Estoy construyendo un dashboard de gestión para una amiga que tiene una pileta privada con clientes y clases. Hoy lleva todo en Excel y se le hace tedioso. Esta primera versión es un **demo con datos de ejemplo** (sin backend, sin datos reales) para mostrarle el concepto a su clienta y validar que el enfoque le sirve, antes de construir la versión conectada a datos reales.

## ⚠️ Supuestos a confirmar antes de correr esto
- **Estados**: al día = vence en más de 7 días · por vencer = vence en los próximos 7 días · vencido = ya pasó la fecha. Ajustar el umbral si no es así.
- **"Hace cuánto están"**: lo interpreté como antigüedad del cliente (ej: "Cliente hace 8 meses"), no tiempo desde el último pago.
- **Las clases son grupales y fijas por semana**: cada horario (día + hora) tiene siempre el mismo grupo de clientes asignado, que asiste todas las semanas — no es una lista distinta cada día.
- Sin login ni backend todavía — es solo para mostrar el concepto.

## Stack técnico
- React + Vite, JavaScript (no hace falta TypeScript para este demo)
- Tailwind CSS
- Sin backend: datos de ejemplo en `src/data/`, organizados para poder reemplazarse fácil por datos reales después
- Responsive: tiene que verse bien en celular (la clienta lo va a mirar desde el teléfono) y en desktop

## Funcionalidad

### 1. Pantalla de inicio (resumen general)
Lo primero que se ve al abrir:
- Clientes al día / por vencer esta semana / vencidos — números grandes, de un vistazo
- Cuántas clases hay hoy y el cupo total ocupado
- Accesos directos a los paneles de Clientes y Horarios

### 2. Panel de Clientes
- Lista de todos los clientes: nombre, estado (con color), fecha de pago, fecha de vencimiento, antigüedad como cliente
- Buscador por nombre
- Filtro rápido por estado (todos / al día / por vencer / vencidos)
- Click en un cliente → ficha con detalle (teléfono de ejemplo, historial simulado de pagos)

### 3. Panel de Horarios — Hoy
- Los horarios son fijos por semana: mismo día + hora + grupo de clientes, todas las semanas
- Vista "HOY" filtra ese horario semanal según el día actual, ordenado por hora
- Cada horario muestra cupo ocupado/total (ej: "8/12")
- Click en un horario → lista de participantes de ese grupo (siempre los mismos)

## Datos de ejemplo
- 18-20 clientes con nombres argentinos, estados variados (al día, por vencer en distintos plazos, vencidos hace distintos períodos)
- Un horario semanal fijo (lunes a sábado) con nombres realistas (Aquagym, Natación Adultos, Natación Niños, Clases Particulares, Hidroterapia), cupos variados — algunos llenos, otros con lugar
- Cada horario con su grupo fijo de participantes asignado (los mismos todas las semanas); la vista "HOY" muestra solo los del día que corresponde
- Los IDs de cliente en `mockClientes.js` y `mockHorarios.js` coinciden entre sí, para poder cruzar la info más adelante (ej: ver en la ficha de un cliente a qué horarios pertenece)

## Estilo visual (dirección de diseño)
Pensalo como una identidad propia, no una plantilla de dashboard genérica.

**Paleta:**
- Agua Profunda `#0B4F6C` — color principal (headers, navegación)
- Cloro `#2EC4B6` — acento vivo (elementos activos, hover, links)
- Sol `#F2A541` — acento cálido (alertas "por vencer", CTAs secundarios)
- Espuma `#F5FAFA` — fondo general
- Profundidad `#0D2B33` — texto principal
- Estados: éxito `#4CA771` (al día) · alerta `#F2A541` (por vencer) · error `#E15554` (vencido) — versiones desaturadas, no semáforo genérico chillón

**Tipografía:**
- Títulos: una sans con carácter (ej. Space Grotesk)
- Cuerpo: sans limpia y legible (ej. Inter)
- Números, fechas y cupos: una monoespaciada (ej. JetBrains Mono) para que los datos se alineen prolijos — es funcional, ayuda a escanear la tabla rápido, no es decoración

**Elemento de identidad:**
Un motivo de líneas de carril de pileta (rayas finas alternadas) como acento en headers de sección o dividers — guiño concreto al mundo de la pileta, no un ícono genérico de gotita de agua. Usarlo en un solo lugar bien resuelto, no repetido por toda la pantalla.

**Evitar:**
- Fondo crema + serif de alto contraste + acento terracota (cliché de diseño con IA)
- Fondo oscuro + verde ácido
- Layout tipo diario con líneas finas y esquinas 100% rectas
- Cards genéricas de ícono + número grande sin personalidad

## Estructura sugerida
```
src/
  components/
    ResumenGeneral.jsx
    ClientesPanel.jsx
    ClienteFicha.jsx
    HorariosPanel.jsx
    ClaseDetalle.jsx
  data/
    mockClientes.js
    mockHorarios.js
  App.jsx
```

## Fuera de alcance por ahora
- Login / usuarios
- Base de datos real
- Recordatorios automáticos (WhatsApp/mail)
- Exportar a Excel/PDF
- Alta o edición real de clientes (por ahora solo se muestra el concepto)

## Al terminar
Hacé un resumen corto de qué construiste y qué decisiones de diseño tomaste, para poder revisarlo rápido en el chat.
