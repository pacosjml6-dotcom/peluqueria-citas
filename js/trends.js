/* Tendencias: contenido editorial estático (no depende de las citas) con
   inspiración de moda capilar para enseñar a los clientes. Se actualiza a
   mano editando TRENDS_DATA cuando cambien las tendencias de temporada.

   No se usan fotografías reales (no hay forma fiable de enlazar imágenes
   de terceros con derechos claros y sin riesgo de que el enlace se rompa),
   así que cada categoría lleva una ilustración vectorial propia dibujada
   a mano en SVG, a juego con el resto de iconos de la app.

   Por el mismo motivo, cada estilo enlaza a una búsqueda de imágenes de
   Google (en vez de a un artículo concreto de una revista, cuyo enlace
   puede caducar, o a Pinterest, que pide iniciar sesión para ver los
   resultados) para que el cliente vea ejemplos visuales sin necesidad
   de tener cuenta en ningún sitio. */
function imageSearch(query) {
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
}

const TRENDS_DATA = [
  {
    id: 'cortes',
    title: 'Cortes femeninos',
    subtitle: 'Los cortes de mujer que más se piden esta temporada',
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
      { title: 'Bob italiano', desc: 'Por encima del hombro, líneas limpias y muy favorecedor. El corte femenino más pedido en salón.', link: imageSearch('bob italiano corte de pelo') },
      { title: 'Shag texturizado', desc: 'Capas suaves y desfiladas que aportan movimiento; ideal para dar cuerpo al cabello fino.', link: imageSearch('shag texturizado corte de pelo') },
      { title: 'Flequillo cortina', desc: 'Sigue siendo tendencia, sobre todo combinado con melenas midi o long bob.', link: imageSearch('flequillo cortina melena midi') },
      { title: 'Mullet moderno', desc: 'Versión suavizada del clásico, con capas que dan volumen sin resultar agresivo.', link: imageSearch('mullet moderno corte de pelo') },
    ],
  },
  {
    id: 'cortes-masculinos',
    title: 'Cortes masculinos',
    subtitle: 'Los cortes de hombre que más se piden esta temporada',
    color: 'var(--chart-series-4)',
    bg: 'rgba(237, 161, 0, 0.12)',
    // Peine con púas, representando el arreglo y peinado masculino.
    heroIcon: `
      <rect x="3" y="4" width="18" height="4" rx="1" stroke-opacity="0.35"></rect>
      <line x1="5" y1="8" x2="5" y2="14"></line>
      <line x1="8.4" y1="8" x2="8.4" y2="15.5"></line>
      <line x1="11.8" y1="8" x2="11.8" y2="13"></line>
      <line x1="15.2" y1="8" x2="15.2" y2="16"></line>
      <line x1="18.6" y1="8" x2="18.6" y2="12.5"></line>
    `,
    items: [
      { title: 'Crop francés texturizado', desc: 'Flequillo corto y texturizado arriba combinado con fade en los laterales.', link: imageSearch('corte crop francés texturizado hombre') },
      { title: 'Buzz cut', desc: 'Rapado uniforme muy corto, de bajo mantenimiento y muy versátil.', link: imageSearch('buzz cut corte de pelo hombre') },
      { title: 'Low fade con raya definida', desc: 'Degradado bajo y sutil rematado con una raya marcada a un lado.', link: imageSearch('low fade raya definida corte hombre') },
      { title: 'Undercut peinado hacia atrás', desc: 'Laterales muy cortos y parte superior larga peinada hacia atrás, estilo slick back.', link: imageSearch('undercut slick back corte hombre') },
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
      { title: 'Balayage en tonos beige', desc: 'Frío y arena claro, para un resultado limpio, moderno y de bajo mantenimiento.', link: imageSearch('balayage tonos beige') },
      { title: 'Rubios grises nórdicos', desc: 'Reflejo perlado grisáceo conseguido con balayage o babylights.', link: imageSearch('rubio gris nórdico balayage') },
      { title: 'Castaños iluminados', desc: 'Base oscura con reflejos cálidos casi imperceptibles que aportan profundidad.', link: imageSearch('castaño iluminado reflejos') },
      { title: 'Cobrizos editoriales', desc: 'Tonos cobre ricos y dimensionados, entre cálido y profundo, con acabado muy cuidado.', link: imageSearch('tinte cobrizo editorial') },
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
      { title: 'Ondas naturales', desc: 'Movimiento relajado, volumen en la raíz y mechones sueltos, sin looks demasiado pulidos.', link: imageSearch('ondas naturales peinado') },
      { title: 'Revival años 70', desc: 'Capas abundantes, ondas al aire y volumen texturizado a lo largo de toda la melena.', link: imageSearch('peinado revival años 70') },
      { title: 'Recogidos desenfadados', desc: 'Menos estructura, más naturalidad: el peinado "con vida" gana terreno a lo perfecto.', link: imageSearch('recogido desenfadado peinado') },
    ],
  },
  {
    id: 'barbas',
    title: 'Barbas',
    subtitle: 'Los estilos de barba con más demanda',
    color: 'var(--chart-series-3)',
    bg: 'rgba(27, 175, 122, 0.12)',
    // Silueta de mandíbula con barba y una línea de bigote.
    heroIcon: `
      <circle cx="12" cy="7.5" r="4" stroke-opacity="0.35"></circle>
      <path d="M5 9c-1.2 3-1 6.2 1.2 8.4 2 2 3.8 2.8 5.8 2.8s3.8-.8 5.8-2.8C20 15.2 20.2 12 19 9"></path>
      <path d="M8.7 14.2c1 1 2.1 1.5 3.3 1.5s2.3-.5 3.3-1.5"></path>
    `,
    items: [
      { title: 'Barba corta degradada', desc: 'Densidad uniforme con fade en los laterales; el estilo más pedido en barbería.', link: imageSearch('barba corta degradada fade') },
      { title: 'Barba candado', desc: 'Perilla y bigote conectados por una línea fina, dejando las mejillas rasuradas.', link: imageSearch('barba candado estilo') },
      { title: 'Barba desconectada', desc: 'Bigote y barba trabajados como piezas independientes, con un hueco marcado entre ambos.', link: imageSearch('barba desconectada bigote') },
      { title: 'Barba tipo boxeada', desc: 'Contorno muy definido y recto, manteniendo el volumen natural del pelo por dentro.', link: imageSearch('barba boxeada estilo') },
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
              ${item.link ? `<a class="trend-card-link" href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer" style="color:${section.color}">Ver inspiración →</a>` : ''}
            </div>
          `).join('')}
        </div>
      </section>
    `).join('');
  }
};
