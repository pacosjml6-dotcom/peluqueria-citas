/* Tendencias: contenido editorial estático (no depende de las citas) con
   inspiración de moda capilar para enseñar a los clientes. Se actualiza a
   mano editando TRENDS_DATA cuando cambien las tendencias de temporada.

   No se usan fotografías reales (no hay forma fiable de enlazar imágenes
   de terceros con derechos claros y sin riesgo de que el enlace se rompa),
   así que cada categoría lleva una ilustración vectorial propia dibujada
   a mano en SVG, a juego con el resto de iconos de la app. */
const TRENDS_DATA = [
  {
    id: 'cortes',
    title: 'Cortes',
    subtitle: 'Los cortes que más se piden esta temporada',
    color: 'var(--chart-series-1)',
    bg: 'rgba(42, 120, 214, 0.12)',
    // Tijera abriéndose sobre un mechón que cae, sugiriendo el corte.
    heroIcon: `
      <path d="M4 4c3 4 7 9 8 9s5-5 8-9" stroke-opacity="0.35"></path>
      <path d="M9 15c-1 2-1 4 0 6" stroke-opacity="0.35"></path>
      <circle cx="6.5" cy="6.5" r="2.5"></circle>
      <circle cx="6.5" cy="17.5" r="2.5"></circle>
      <line x1="20" y1="4" x2="8.7" y2="15.3"></line>
      <line x1="14.8" y1="14.7" x2="20" y2="20"></line>
      <line x1="8.7" y1="8.7" x2="12.2" y2="12.2"></line>
    `,
    items: [
      { title: 'Bob italiano', desc: 'Por encima del hombro, líneas limpias y muy favorecedor. El corte femenino más pedido en salón.' },
      { title: 'Shag texturizado', desc: 'Capas suaves y desfiladas que aportan movimiento; ideal para dar cuerpo al cabello fino.' },
      { title: 'Flequillo cortina', desc: 'Sigue siendo tendencia, sobre todo combinado con melenas midi o long bob.' },
      { title: 'Mullet moderno', desc: 'Versión suavizada del clásico, con capas que dan volumen sin resultar agresivo.' },
    ],
  },
  {
    id: 'tintes',
    title: 'Tintes y color',
    subtitle: 'Técnicas y tonos que están arrasando',
    color: 'var(--chart-series-2)',
    bg: 'rgba(235, 104, 52, 0.12)',
    // Tres mechones goteando color, en tonos cobre / miel / rubio.
    heroIcon: `
      <path d="M6 2c-2 4 2 8 0 12" fill="none"></path>
      <circle cx="5.3" cy="15.5" r="1.7" fill="#c0602f" stroke="none"></circle>
      <path d="M12 1c-2 4 2 9 0 13" fill="none"></path>
      <circle cx="11.3" cy="16.5" r="1.9" fill="#e0a24a" stroke="none"></circle>
      <path d="M18 2c-2 4 2 8 0 12" fill="none"></path>
      <circle cx="17.3" cy="15.5" r="1.7" fill="#f2d49b" stroke="none"></circle>
    `,
    items: [
      { title: 'Balayage en tonos beige', desc: 'Frío y arena claro, para un resultado limpio, moderno y de bajo mantenimiento.' },
      { title: 'Rubios grises nórdicos', desc: 'Reflejo perlado grisáceo conseguido con balayage o babylights.' },
      { title: 'Castaños iluminados', desc: 'Base oscura con reflejos cálidos casi imperceptibles que aportan profundidad.' },
      { title: 'Cobrizos editoriales', desc: 'Tonos cobre ricos y dimensionados, entre cálido y profundo, con acabado muy cuidado.' },
    ],
  },
  {
    id: 'peinados',
    title: 'Peinados',
    subtitle: 'Cómo se lleva el pelo puesto esta temporada',
    color: 'var(--chart-series-7)',
    bg: 'rgba(74, 58, 167, 0.12)',
    // Ondas apiladas sugiriendo movimiento y textura natural.
    heroIcon: `
      <path d="M2 6c4-3 6 3 10 0s6-3 10 0" fill="none"></path>
      <path d="M2 12c4-3 6 3 10 0s6-3 10 0" fill="none"></path>
      <path d="M2 18c4-3 6 3 10 0s6-3 10 0" fill="none"></path>
    `,
    items: [
      { title: 'Ondas naturales', desc: 'Movimiento relajado, volumen en la raíz y mechones sueltos, sin looks demasiado pulidos.' },
      { title: 'Revival años 70', desc: 'Capas abundantes, ondas al aire y volumen texturizado a lo largo de toda la melena.' },
      { title: 'Recogidos desenfadados', desc: 'Menos estructura, más naturalidad: el peinado "con vida" gana terreno a lo perfecto.' },
    ],
  },
];

const Trends = {
  init() {
    this.render();
  },

  render() {
    const container = document.getElementById('trends-sections');
    container.innerHTML = TRENDS_DATA.map(section => `
      <section class="stats-chart-card card trends-section">
        <div class="stats-chart-header trends-section-header">
          <span class="trends-hero-badge" style="background:${section.bg}; color:${section.color}" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${section.heroIcon}</svg>
          </span>
          <div>
            <h3>${escapeHtml(section.title)}</h3>
            <p class="stats-chart-subtitle">${escapeHtml(section.subtitle)}</p>
          </div>
        </div>
        <div class="trends-grid">
          ${section.items.map(item => `
            <div class="trend-card" style="border-left-color:${section.color}">
              <div class="trend-card-title">${escapeHtml(item.title)}</div>
              <div class="trend-card-desc">${escapeHtml(item.desc)}</div>
            </div>
          `).join('')}
        </div>
      </section>
    `).join('');
  }
};
