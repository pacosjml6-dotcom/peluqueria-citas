/* Listado de todas las citas pendientes de cobro (de cualquier día), con el
   mismo interruptor de cobrada/pendiente que la agenda. */
const PendingPayments = {
  init() {
    document.getElementById('btn-pending-payments').addEventListener('click', () => this.open());
    document.getElementById('btn-close-pending-payments').addEventListener('click', () => this.close());
    document.getElementById('pending-payments-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'pending-payments-overlay') this.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !document.getElementById('pending-payments-overlay').classList.contains('hidden')) {
        this.close();
      }
    });
  },

  isOpen() {
    return !document.getElementById('pending-payments-overlay').classList.contains('hidden');
  },

  open() {
    this.render();
    document.getElementById('pending-payments-overlay').classList.remove('hidden');
  },

  close() {
    document.getElementById('pending-payments-overlay').classList.add('hidden');
  },

  getPending() {
    return Store.getAll()
      .filter(a => !a.paid)
      .sort((a, b) => a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date));
  },

  updateBadge() {
    const count = this.getPending().length;
    const badge = document.getElementById('pending-payments-badge');
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.classList.toggle('hidden', count === 0);
  },

  render() {
    this.updateBadge();
    const list = document.getElementById('pending-payments-list');
    const pending = this.getPending();

    if (pending.length === 0) {
      list.innerHTML = '<div class="empty-state"><p>No hay citas pendientes de cobro.</p></div>';
      return;
    }

    const employees = EmployeeStore.getAll();
    list.innerHTML = '';
    pending.forEach(appt => {
      const employee = employees.find(e => e.id === appt.employeeId);
      const item = document.createElement('div');
      item.className = 'appt-item appt-item-pending-row';
      item.innerHTML = `
        <div class="appt-time">
          <div class="appt-pending-date">${escapeHtml(formatShortDate(appt.date))}</div>
          <div>${escapeHtml(appt.time)}</div>
        </div>
        <div class="appt-info">
          <div class="appt-name">${escapeHtml(appt.name)}</div>
          <div class="appt-phone">${escapeHtml(appt.phone)}</div>
          <div class="appt-row-bottom">
            <div class="appt-notes">${escapeHtml(appt.notes || 'Sin notas')}</div>
            ${employee ? `<div class="appt-employee">${escapeHtml(employee.name)}</div>` : ''}
          </div>
        </div>
        <div class="appt-actions">
          <button class="btn-icon btn-paid-toggle is-pending" aria-label="Marcar como cobrada" title="Pendiente de cobro · pulsa para marcar como cobrada">&euro;</button>
          <a class="btn-icon btn-whatsapp" href="${whatsappUrl(appt.phone)}" target="_blank" rel="noopener" aria-label="Abrir chat de WhatsApp" title="Abrir WhatsApp">${WHATSAPP_ICON_SVG}</a>
        </div>
      `;
      item.querySelector('.btn-paid-toggle').addEventListener('click', async () => {
        await Appointments.togglePaid(appt);
        this.render();
      });
      list.appendChild(item);
    });
  }
};

function formatShortDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
}
