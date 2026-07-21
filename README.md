# Bella Studio · Gestión de Citas

Aplicación web para gestionar las citas de una peluquería/salón de belleza: alta, edición y cancelación de citas, con un calendario mensual interactivo y una agenda diaria.

## Stack

- HTML5 + CSS3 (variables, Grid/Flexbox) — sin frameworks.
- JavaScript ES6 vanilla, sin build step.
- Persistencia en `localStorage` del navegador (no requiere servidor ni base de datos).

## Cómo ejecutarlo

No necesita instalación ni dependencias.

**Opción 1 — abrir directamente:**
Haz doble clic en `index.html` (o ábrelo desde el navegador con `Ctrl+O`).

**Opción 2 — con un servidor local (opcional, recomendado si el navegador bloquea algo):**
```bash
# con Python
python -m http.server 8000

# o con Node
npx serve .
```
Luego visita `http://localhost:8000`.

## Estructura del proyecto

```
peluqueria-citas/
├── index.html           # Estructura de la página y modales
├── css/
│   └── styles.css       # Estilos, tema visual y responsive
├── js/
│   ├── store.js         # Acceso a localStorage (crear/leer/actualizar/borrar)
│   ├── calendar.js      # Render del calendario mensual e interacción de días
│   ├── appointments.js  # CRUD de citas, modal de formulario y confirmación
│   └── app.js           # Bootstrap: conecta calendario y agenda
└── README.md
```

## Funcionalidades

- **Crear cita**: botón "Nueva cita" abre un formulario con nombre, teléfono, fecha, hora y notas del servicio.
- **Editar cita**: icono de lápiz en cada cita de la lista.
- **Eliminar cita**: icono de papelera, con diálogo de confirmación antes de borrar.
- **Calendario mensual**: navegación entre meses, indicador de "hoy" y una insignia con el número de citas en los días que tienen alguna.
- **Agenda diaria**: al hacer clic en un día del calendario se filtra la lista de citas de ese día, ordenadas por hora.
- **Responsive**: el calendario y la agenda se apilan en una sola columna en pantallas pequeñas.

## Notas

- Los datos se guardan en el `localStorage` del navegador que uses, por lo que son locales a ese navegador/equipo. Borrar los datos de navegación del sitio eliminará las citas guardadas.
- Si se quisiera evolucionar a un backend real (Node/Express + SQLite, por ejemplo), basta con reescribir `js/store.js` para que las funciones `getAll`, `create`, `update` y `remove` llamen a una API en lugar de a `localStorage` — el resto de la aplicación no necesita cambios.
