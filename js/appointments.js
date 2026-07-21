/* CRUD de citas: modal de formulario, confirmación de borrado y lista del día */
const Appointments = {
  pendingDeleteId: null,

  init() {
    document.getElementById('btn-new-appt').addEventListener('click', () => {
      this.openForm(null, Calendar.selectedDate);
    });
    document.getElementById('btn-close-modal').addEventListener('click', () => this.closeForm());
    document.getElementById('btn-cancel-form').addEventListener('click', () => this.closeForm());
    document.getElementById('appt-form').addEventListener('submit', (e) => this.handleSubmit(e));
    document.getElementById('btn-delete-appt').addEventListener('click', () => {
      this.askDelete(document.getElementById('appt-id').value);
    });
    document.getElementById('btn-confirm-cancel').addEventListener('click', () => this.closeConfirm());
    document.getElementById('btn-confirm-delete').addEventListener('click', () => this.confirmDelete());

    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') this.closeForm();
    });
    document.getElementById('confirm-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'confirm-overlay') this.closeConfirm();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!document.getElementById('confirm-overlay').classList.contains('hidden')) this.closeConfirm();
      else if (!document.getElementById('modal-overlay').classList.contains('hidden')) this.closeForm();
    });
  },

  openForm(appt = null, presetDate = null) {
    const form = document.getElementById('appt-form');
    form.reset();
    document.getElementById('appt-id').value = '';
    document.getElementById('btn-delete-appt').classList.add('hidden');
    document.getElementById('modal-title').textContent = 'Nueva cita';

    if (appt) {
      document.getElementById('modal-title').textContent = 'Editar cita';
      document.getElementById('appt-id').value = appt.id;
      document.getElementById('appt-name').value = appt.name;
      document.getElementById('appt-phone').value = appt.phone;
      document.getElementById('appt-date').value = appt.date;
      document.getElementById('appt-time').value = appt.time;
      document.getElementById('appt-notes').value = appt.notes || '';
      document.getElementById('btn-delete-appt').classList.remove('hidden');
    } else if (presetDate) {
      document.getElementById('appt-date').value = presetDate;
    }

    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('appt-name').focus();
  },

  closeForm() {
    document.getElementById('modal-overlay').classList.add('hidden');
  },

  handleSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('appt-id').value;
    const data = {
      name: document.getElementById('appt-name').value.trim(),
      phone: document.getElementById('appt-phone').value.trim(),
      date: document.getElementById('appt-date').value,
      time: document.getElementById('appt-time').value,
      notes: document.getElementById('appt-notes').value.trim(),
    };

    if (!data.name || !data.phone || !data.date || !data.time) {
      showToast('Completa todos los campos obligatorios', 'error');
      return;
    }

    if (id) {
      Store.update(id, data);
      showToast('Cita actualizada correctamente', 'success');
    } else {
      Store.create(data);
      showToast('Cita creada correctamente', 'success');
    }

    this.closeForm();
    Calendar.selectedDate = data.date;
    Calendar.render();
    this.renderList(data.date);
  },

  askDelete(id) {
    this.pendingDeleteId = id;
    const appt = Store.getAll().find(a => a.id === id);
    document.getElementById('confirm-message').textContent = appt
      ? `Se eliminará la cita de ${appt.name} el ${formatDate(appt.date)} a las ${appt.time}.`
      : '¿Seguro que quieres eliminar esta cita?';
    document.getElementById('confirm-overlay').classList.remove('hidden');
  },

  closeConfirm() {
    document.getElementById('confirm-overlay').classList.add('hidden');
    this.pendingDeleteId = null;
  },

  confirmDelete() {
    if (!this.pendingDeleteId) return;
    const appt = Store.getAll().find(a => a.id === this.pendingDeleteId);
    Store.remove(this.pendingDeleteId);
    this.closeConfirm();
    this.closeForm();
    showToast('Cita eliminada', 'success');
    Calendar.render();
    this.renderList(appt ? appt.date : Calendar.selectedDate);
  },

  renderList(dateStr) {
    const list = document.getElementById('appointments-list');
    const title = document.getElementById('agenda-title');
    const appts = Store.getByDate(dateStr);
    const todayStr = toISODate(new Date());

    title.textContent = dateStr === todayStr ? 'Agenda de hoy' : `Agenda del ${formatDate(dateStr)}`;

    if (appts.length === 0) {
      list.innerHTML = '<div class="empty-state"><p>No hay citas programadas para este día.</p></div>';
      return;
    }

    list.innerHTML = '';
    appts.forEach(appt => {
      const item = document.createElement('div');
      item.className = 'appt-item';
      item.innerHTML = `
        <div class="appt-time">${escapeHtml(appt.time)}</div>
        <div class="appt-info">
          <div class="appt-name">${escapeHtml(appt.name)}</div>
          <div class="appt-notes">${escapeHtml(appt.notes || 'Sin notas')}</div>
          <div class="appt-phone">${escapeHtml(appt.phone)}</div>
        </div>
        <div class="appt-actions">
          <button class="btn-icon btn-edit" aria-label="Editar cita" title="Editar">&#9998;</button>
          <button class="btn-icon btn-delete" aria-label="Eliminar cita" title="Eliminar">&#128465;</button>
        </div>
      `;
      item.querySelector('.btn-edit').addEventListener('click', () => this.openForm(appt));
      item.querySelector('.btn-delete').addEventListener('click', () => this.askDelete(appt.id));
      list.appendChild(item);
    });
  }
};

function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

let toastTimeout;
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast toast-${type}`;
  clearTimeout(toastTimeout);
  requestAnimationFrame(() => toast.classList.add('show'));
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 2600);
}
