/* Tendencias: contenido editorial estático (no depende de las citas) con
   inspiración de moda capilar para enseñar a los clientes. Se actualiza a
   mano editando TRENDS_DATA cuando cambien las tendencias de temporada. */
const TRENDS_DATA = [
  {
    id: 'cortes',
    title: 'Cortes',
    subtitle: 'Los cortes que más se piden esta temporada',
    color: 'var(--chart-series-1)',
    icon: '<path d="M6 6a2 2 0 1 0 0-.01"></path><path d="M6 18a2 2 0 1 0 0-.01"></path><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.48" x2="20" y2="20"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line>',
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
    icon: '<path d="M9 3h6l1 4H8l1-4Z"></path><path d="M8 7v6a4 4 0 0 0 8 0V7"></path><path d="M12 17v4"></path><path d="M9 21h6"></path>',
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
    icon: '<path d="M4 18c0-5 3.5-9 8-9s8 4 8 9"></path><path d="M4 18h16"></path><path d="M9 9c0-2.5 1.3-4.5 3-4.5S15 6.5 15 9"></path>',
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
        <div class="stats-chart-header">
          <div>
            <h3>
              <span class="trends-section-icon" style="color:${section.color}" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${section.icon}</svg>
              </span>
              ${escapeHtml(section.title)}
            </h3>
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
