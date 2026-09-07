/* Tendencias: el marco visual de cada categoría (icono, color, y el enlace
   de "Ver inspiración" de cada estilo) es fijo aquí, porque no depende de la
   moda. El contenido en sí (subtítulo + estilos concretos de cada
   categoría) SÍ cambia con la moda: se genera con IA y se guarda en la
   tabla "tendencias" (ver supabase/trends-content.sql y la Edge Function
   "generate-trends"), en vez de quedarse fijo aquí. TrendsContentStore
   (js/store.js) es quien lo carga y lo mantiene al día en tiempo real.

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

const TREND_CATEGORIES = [
  {
    id: 'cortes',
    title: 'Cortes femeninos',
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
  },
  {
    id: 'cortes-masculinos',
    title: 'Cortes masculinos',
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
  },
  {
    id: 'tintes',
    title: 'Tintes y color',
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
  },
  {
    id: 'peinados',
    title: 'Peinados',
    color: 'var(--chart-series-7)',
    bg: 'rgba(74, 58, 167, 0.12)',
    // Ondas apiladas sugiriendo movimiento y textura natural.
    heroIcon: `
      <path d="M2 6c4-3 6 3 10 0s6-3 10 0" fill="none"></path>
      <path d="M2 12c4-3 6 3 10 0s6-3 10 0" fill="none"></path>
      <path d="M2 18c4-3 6 3 10 0s6-3 10 0" fill="none"></path>
    `,
  },
  {
    id: 'barbas',
    title: 'Barbas',
    color: 'var(--chart-series-3)',
    bg: 'rgba(27, 175, 122, 0.12)',
    // Silueta de mandíbula con barba y una línea de bigote.
    heroIcon: `
      <circle cx="12" cy="7.5" r="4" stroke-opacity="0.35"></circle>
      <path d="M5 9c-1.2 3-1 6.2 1.2 8.4 2 2 3.8 2.8 5.8 2.8s3.8-.8 5.8-2.8C20 15.2 20.2 12 19 9"></path>
      <path d="M8.7 14.2c1 1 2.1 1.5 3.3 1.5s2.3-.5 3.3-1.5"></path>
    `,
  },
];

const Trends = {
  refreshing: false,

  init() {
    this.render();
    const btn = document.getElementById('btn-refresh-trends');
    if (btn) btn.addEventListener('click', () => this.refresh());
  },

  render() {
    const container = document.getElementById('trends-sections');
    const contentById = new Map(TrendsContentStore.getSections().map(s => [s.id, s]));

    this.renderGeneratedNote();

    container.innerHTML = TREND_CATEGORIES.map(category => {
      const content = contentById.get(category.id);
      const subtitle = content?.subtitle || '';
      const items = content?.items || [];

      return `
      <section class="stats-chart-card card trends-section">
        <div class="stats-chart-header trends-section-header">
          <span class="trends-hero-badge" style="background:${category.bg}; color:${category.color}" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${category.heroIcon}</svg>
          </span>
          <div>
            <h3>${escapeHtml(category.title)}</h3>
            <p class="stats-chart-subtitle">${escapeHtml(subtitle)}</p>
          </div>
        </div>
        ${items.length === 0
          ? '<div class="empty-state"><p>Todavía no hay contenido generado para esta categoría.</p></div>'
          : `<div class="trends-grid">
              ${items.map(item => `
                <div class="trend-card" style="border-left-color:${category.color}">
                  <div class="trend-card-title">${escapeHtml(item.title)}</div>
                  <div class="trend-card-desc">${escapeHtml(item.desc)}</div>
                  <a class="trend-card-link" href="${escapeHtml(imageSearch(item.title))}" target="_blank" rel="noopener noreferrer" style="color:${category.color}">Ver inspiración →</a>
                </div>
              `).join('')}
            </div>`}
      </section>
    `;
    }).join('');
  },

  renderGeneratedNote() {
    const el = document.getElementById('trends-generated-note');
    if (!el) return;
    if (!TrendsContentStore.generatedAt) {
      el.textContent = 'Contenido inicial, todavía sin regenerar.';
      return;
    }
    const date = new Date(TrendsContentStore.generatedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    el.textContent = `Actualizado por última vez el ${date}.`;
  },

  async refresh() {
    if (this.refreshing) return;
    this.refreshing = true;
    const btn = document.getElementById('btn-refresh-trends');
    const originalLabel = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Actualizando…';
    }

    try {
      const { data, error } = await supabaseClient.functions.invoke('generate-trends', { body: {} });
      if (error || !data?.ok) throw error || new Error('generation_failed');
      showToast('Tendencias actualizadas');
      // La suscripción realtime (js/store.js) ya recarga TrendsContentStore
      // y vuelve a llamar a render(), pero por si acaso la conexión
      // realtime no está disponible, se fuerza también aquí.
      await TrendsContentStore._load();
      this.render();
    } catch (err) {
      console.error('No se pudo actualizar el contenido de tendencias', err);
      showToast('No se pudieron actualizar las tendencias. Inténtalo de nuevo.', 'error');
    } finally {
      this.refreshing = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalLabel;
      }
    }
  }
};
