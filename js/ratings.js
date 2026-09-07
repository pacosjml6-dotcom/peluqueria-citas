/* Valoraciones: citas que el cliente ha valorado (1 a 5 estrellas) al pulsar
   una de las opciones del correo de encuesta de satisfacción (ver
   supabase/functions/send-satisfaction-survey y rate-appointment). Solo
   lectura: la valoración la escribe la Edge Function con la service role
   key; esta pantalla solo la muestra, reutilizando los mismos gráficos y
   tabla que ya usa Estadísticas (renderRankingChart, renderStatsTable). */
const Ratings = {
  init() {
    this.renderAll();
  },

  renderAll() {
    const rated = Store.getAll()
      .filter(a => a.rating)
      .sort((a, b) => (b.ratedAt || '').localeCompare(a.ratedAt || ''));
    const surveyed = Store.getAll().filter(a => a.surveySentAt).length;

    this.renderKpis(rated, surveyed);
    this.renderDistribution(rated);
    this.renderList(rated);
  },

  renderKpis(rated, surveyed) {
    const total = rated.length;
    const avg = total ? rated.reduce((sum, a) => sum + a.rating, 0) / total : 0;

    document.getElementById('ratings-kpi-average').textContent = total ? avg.toFixed(1) : '—';
    document.getElementById('ratings-kpi-average-sub').textContent = total ? 'sobre 5' : 'Sin valoraciones todavía';

    document.getElementById('ratings-kpi-total').textContent = total;
    document.getElementById('ratings-kpi-total-sub').textContent =
      total === 0 ? 'Sin valoraciones todavía' : `de ${surveyed} encuesta${surveyed === 1 ? '' : 's'} enviada${surveyed === 1 ? '' : 's'}`;

    const rate = surveyed ? Math.round((total / surveyed) * 100) : 0;
    document.getElementById('ratings-kpi-response').textContent = surveyed ? `${rate}%` : '—';
    document.getElementById('ratings-kpi-response-sub').textContent =
      surveyed ? 'de las encuestas enviadas' : 'Aún no se ha enviado ninguna encuesta';
  },

  renderDistribution(rated) {
    const container = document.getElementById('ratings-distribution');
    if (rated.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Todavía no hay valoraciones.</p></div>';
      return;
    }
    const items = [5, 4, 3, 2, 1].map(n => ({
      label: '★'.repeat(n) + '☆'.repeat(5 - n),
      value: rated.filter(a => a.rating === n).length,
    }));
    renderRankingChart(container, items);
  },

  renderList(rated) {
    const container = document.getElementById('ratings-list');
    if (rated.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Todavía no hay valoraciones.</p></div>';
      return;
    }
    const employees = EmployeeStore.getAll();
    const rows = rated.slice(0, 50).map(a => {
      const employee = employees.find(e => e.id === a.employeeId);
      const stars = '★'.repeat(a.rating) + '☆'.repeat(5 - a.rating);
      const ratedAtStr = a.ratedAt
        ? new Date(a.ratedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
        : '—';
      return [a.name, employee ? employee.name : 'Sin asignar', formatStatsDate(a.date), stars, ratedAtStr];
    });
    renderStatsTable(container, ['Cliente', 'Empleado', 'Fecha de la cita', 'Valoración', 'Valorada el'], rows);
  }
};
