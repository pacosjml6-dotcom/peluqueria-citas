/* CRUD de citas: modal de formulario, confirmación de borrado y lista del día */
const CONFLICT_WINDOW_MINUTES = 20;
const SLOT_INTERVAL_MINUTES = 15;

const Appointments = {
  pendingDeleteId: null,

  init() {
    this.populatePhoneCodeSelect();

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

    document.getElementById('appt-phone-code').addEventListener('change', () => this.tryAutoFillFromContact());
    document.getElementById('appt-phone').addEventListener('input', () => this.tryAutoFillFromContact());
    document.getElementById('appt-phone').addEventListener('blur', () => this.tryAutoFillFromContact());
    document.getElementById('appt-email').addEventListener('input', () => this.tryAutoFillFromContact());
    document.getElementById('appt-email').addEventListener('blur', () => this.tryAutoFillFromContact());
    document.getElementById('appt-name').addEventListener('change', () => this.tryAutoFillFromName());

    document.getElementById('appt-employee').addEventListener('change', () => this.checkEmployeeConflict());
    document.getElementById('appt-date').addEventListener('change', () => {
      this.populateTimeSelect(document.getElementById('appt-date').value);
      this.checkEmployeeConflict();
    });
    document.getElementById('appt-time').addEventListener('change', () => this.checkEmployeeConflict());

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

    // Mantiene los colores de estado (verde/rojo) al día mientras la vista está abierta
    setInterval(() => this.renderList(Calendar.selectedDate), 60000);
  },

  populatePhoneCodeSelect() {
    const select = document.getElementById('appt-phone-code');
    const sorted = [...COUNTRY_CODES].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    select.innerHTML = sorted
      .map(c => `<option value="${c.dial}" data-iso="${c.iso}">${isoToFlagEmoji(c.iso)} +${c.dial} ${escapeHtml(c.name)}</option>`)
      .join('');
    select.value = '34';
  },

  populateClientsDatalist() {
    const datalist = document.getElementById('appt-clients-datalist');
    datalist.innerHTML = ClientStore.getAll()
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      .map(c => `<option value="${escapeHtml(c.name)}">`)
      .join('');
  },

  populateEmployeeSelect() {
    const select = document.getElementById('appt-employee');
    const hint = document.getElementById('appt-employee-hint');
    const employees = EmployeeStore.getAll().sort((a, b) => a.name.localeCompare(b.name, 'es'));

    if (employees.length === 0) {
      select.innerHTML = '<option value="">No hay empleados dados de alta</option>';
      select.disabled = true;
      hint.textContent = 'No hay empleados dados de alta todavía. Añade uno primero en la pestaña "Empleados".';
      hint.classList.remove('hidden');
    } else {
      select.disabled = false;
      select.innerHTML = '<option value="">Selecciona un empleado</option>' +
        employees.map(e => `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('');
      hint.classList.add('hidden');
      hint.textContent = '';
    }
  },

  setClientHint(text) {
    const hint = document.getElementById('appt-client-hint');
    if (text) {
      hint.textContent = text;
      hint.classList.remove('hidden');
    } else {
      hint.textContent = '';
      hint.classList.add('hidden');
    }
  },

  tryAutoFillFromContact() {
    const dialCode = document.getElementById('appt-phone-code').value;
    const phoneDigits = document.getElementById('appt-phone').value.trim().replace(/\D/g, '');
    const email = document.getElementById('appt-email').value.trim();
    let match = null;

    if (phoneDigits) {
      match = ClientStore.findByPhone(`+${dialCode}${phoneDigits}`);
    }
    if (!match && email) {
      match = ClientStore.findByEmail(email);
    }

    if (match) {
      document.getElementById('appt-name').value = match.name;
      this.setClientHint(`Cliente ya registrado: se usará el nombre "${match.name}".`);
    } else {
      this.setClientHint('');
    }
  },

  tryAutoFillFromName() {
    const name = document.getElementById('appt-name').value.trim();
    if (!name) return;
    const match = ClientStore.findByName(name);
    if (match) {
      document.getElementById('appt-phone-code').value = match.dialCode;
      document.getElementById('appt-phone').value = match.phoneLocal;
      document.getElementById('appt-email').value = match.email;
      this.setClientHint('Cliente ya registrado: se han rellenado sus datos de contacto.');
    }
  },

  populateTimeSelect(dateStr, keepTime) {
    const select = document.getElementById('appt-time');
    const previous = keepTime !== undefined ? keepTime : select.value;
    const schedule = dateStr ? ScheduleStore.getForDate(dateStr) : null;
    const ranges = schedule && !schedule.closed ? ScheduleStore.getRanges(schedule) : [];

    if (!dateStr || !schedule || schedule.closed || ranges.length === 0) {
      select.innerHTML = '<option value="">-- Sin horas disponibles --</option>';
      select.value = '';
      return;
    }

    const slots = [];
    ranges.forEach(range => {
      for (let t = timeToMinutes(range.open); t < timeToMinutes(range.close); t += SLOT_INTERVAL_MINUTES) {
        slots.push(minutesToTime(t));
      }
    });

    let optionsHtml = '<option value="">Selecciona una hora</option>' +
      slots.map(s => `<option value="${s}">${s}</option>`).join('');

    if (previous && !slots.includes(previous)) {
      optionsHtml += `<option value="${previous}">${previous} (fuera de horario)</option>`;
    }

    select.innerHTML = optionsHtml;
    select.value = previous || '';
  },

  getScheduleIssue(date, time) {
    if (!date) return null;
    const schedule = ScheduleStore.getForDate(date);
    if (!schedule) return null;
    const ranges = schedule.closed ? [] : ScheduleStore.getRanges(schedule);
    if (schedule.closed || ranges.length === 0) return { type: 'closed' };
    if (!time) return null;
    const t = timeToMinutes(time);
    const withinRange = ranges.some(r => t >= timeToMinutes(r.open) && t < timeToMinutes(r.close));
    if (!withinRange) return { type: 'outside', ranges };
    return null;
  },

  findConflict(employeeId, date, time, excludeApptId) {
    if (!employeeId || !date || !time) return null;
    const target = timeToMinutes(time);
    return Store.getByDate(date).find(a => {
      if (a.employeeId !== employeeId) return false;
      if (excludeApptId && a.id === excludeApptId) return false;
      return Math.abs(timeToMinutes(a.time) - target) < CONFLICT_WINDOW_MINUTES;
    }) || null;
  },

  checkEmployeeConflict() {
    const employeeId = document.getElementById('appt-employee').value;
    const date = document.getElementById('appt-date').value;
    const time = document.getElementById('appt-time').value;
    const excludeId = document.getElementById('appt-id').value;
    const warningEl = document.getElementById('appt-employee-warning');
    const saveBtn = document.getElementById('btn-save-appt');

    const scheduleIssue = this.getScheduleIssue(date, time);
    if (scheduleIssue) {
      warningEl.textContent = scheduleIssue.type === 'closed'
        ? '⚠️ El establecimiento está cerrado ese día. Elige otra fecha.'
        : `⚠️ Esa hora está fuera del horario laboral (${formatScheduleRanges(scheduleIssue.ranges)}). Elige una hora dentro de ese horario.`;
      warningEl.classList.remove('hidden');
      saveBtn.disabled = true;
      return true;
    }

    const conflict = this.findConflict(employeeId, date, time, excludeId);

    if (conflict) {
      const employee = EmployeeStore.getAll().find(e => e.id === employeeId);
      const employeeName = employee ? employee.name : 'Este empleado';
      const before = minutesToTime(timeToMinutes(conflict.time) - CONFLICT_WINDOW_MINUTES);
      const after = minutesToTime(timeToMinutes(conflict.time) + CONFLICT_WINDOW_MINUTES);
      warningEl.textContent = `⚠️ ${employeeName} ya tiene una cita a las ${conflict.time} ese día. Elige otro empleado o una hora antes de las ${before} o después de las ${after}.`;
      warningEl.classList.remove('hidden');
      saveBtn.disabled = true;
      return true;
    }

    warningEl.classList.add('hidden');
    warningEl.textContent = '';
    saveBtn.disabled = false;
    return false;
  },

  openForm(appt = null, presetDate = null) {
    const form = document.getElementById('appt-form');
    form.reset();
    document.getElementById('appt-id').value = '';
    document.getElementById('btn-delete-appt').classList.add('hidden');
    document.getElementById('modal-title').textContent = 'Nueva cita';
    document.getElementById('appt-phone-code').value = '34';
    document.getElementById('btn-save-appt').disabled = false;
    this.setClientHint('');
    document.getElementById('appt-employee-warning').classList.add('hidden');

    this.populateClientsDatalist();
    this.populateEmployeeSelect();

    if (appt) {
      document.getElementById('modal-title').textContent = 'Editar cita';
      document.getElementById('appt-id').value = appt.id;
      document.getElementById('appt-name').value = appt.name;
      document.getElementById('appt-phone-code').value = appt.dialCode || '34';
      document.getElementById('appt-phone').value = appt.phoneLocal || appt.phone;
      document.getElementById('appt-email').value = appt.email || '';
      document.getElementById('appt-employee').value = appt.employeeId || '';
      document.getElementById('appt-date').value = appt.date;
      document.getElementById('appt-notes').value = appt.notes || '';
      document.getElementById('btn-delete-appt').classList.remove('hidden');
    } else if (presetDate) {
      document.getElementById('appt-date').value = presetDate;
    }

    this.populateTimeSelect(document.getElementById('appt-date').value, appt ? appt.time : '');

    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('appt-name').focus();
    this.checkEmployeeConflict();
  },

  closeForm() {
    document.getElementById('modal-overlay').classList.add('hidden');
  },

  handleSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('appt-id').value;
    const name = document.getElementById('appt-name').value.trim();
    const dialCode = document.getElementById('appt-phone-code').value;
    const phoneLocalRaw = document.getElementById('appt-phone').value.trim();
    const email = document.getElementById('appt-email').value.trim();
    const employeeId = document.getElementById('appt-employee').value;
    const date = document.getElementById('appt-date').value;
    const time = document.getElementById('appt-time').value;
    const notes = document.getElementById('appt-notes').value.trim();

    if (!name || !phoneLocalRaw || !email || !employeeId || !date || !time) {
      showToast('Completa todos los campos obligatorios', 'error');
      return;
    }

    const phoneDigits = phoneLocalRaw.replace(/\D/g, '');
    if (!phoneDigits) {
      showToast('Introduce un teléfono válido', 'error');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      showToast('Introduce un correo electrónico válido', 'error');
      return;
    }

    const scheduleIssue = this.getScheduleIssue(date, time);
    if (scheduleIssue) {
      this.checkEmployeeConflict();
      showToast(
        scheduleIssue.type === 'closed'
          ? 'El establecimiento está cerrado ese día. Elige otra fecha.'
          : 'Esa hora está fuera del horario laboral. Elige una hora dentro del horario configurado.',
        'error'
      );
      return;
    }

    if (this.findConflict(employeeId, date, time, id)) {
      this.checkEmployeeConflict();
      showToast('Ese empleado ya tiene otra cita dentro de un margen de 20 minutos. Elige otra hora u otro empleado.', 'error');
      return;
    }

    const fullPhone = `+${dialCode}${phoneDigits}`;
    const existingClient = ClientStore.findByPhone(fullPhone) || ClientStore.findByEmail(email);

    let clientId;
    let finalName;

    if (existingClient) {
      // La ficha del cliente manda: el nombre de la cita siempre refleja el suyo, nunca al revés.
      clientId = existingClient.id;
      finalName = existingClient.name;
    } else {
      const newClient = ClientStore.create({ name, dialCode, phoneLocal: phoneLocalRaw, fullPhone, email });
      clientId = newClient.id;
      finalName = newClient.name;
    }

    const data = {
      name: finalName,
      phone: fullPhone,
      dialCode,
      phoneLocal: phoneLocalRaw,
      email,
      employeeId,
      clientId,
      date,
      time,
      notes,
    };

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

    const employees = EmployeeStore.getAll();

    list.innerHTML = '';
    appts.forEach(appt => {
      const employee = employees.find(e => e.id === appt.employeeId);
      const overdue = isApptOverdue(appt.date, appt.time);
      const item = document.createElement('div');
      item.className = `appt-item ${overdue ? 'appt-item-overdue' : 'appt-item-upcoming'}`;
      item.innerHTML = `
        <div class="appt-time">${escapeHtml(appt.time)}</div>
        <div class="appt-info">
          <div class="appt-name">${escapeHtml(appt.name)}</div>
          <div class="appt-notes">${escapeHtml(appt.notes || 'Sin notas')}</div>
          <div class="appt-phone">${escapeHtml(appt.phone)}</div>
          ${employee ? `<div class="appt-employee">Atiende: ${escapeHtml(employee.name)}</div>` : ''}
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

const APPT_OVERDUE_GRACE_MINUTES = 15;

/* Una cita se considera "pasada" si su fecha ya quedó atrás, o si es hoy pero
   su hora ya pasó hace más de 15 minutos. En cualquier otro caso se muestra
   como al día (verde). */
function isApptOverdue(dateStr, timeStr) {
  const now = new Date();
  const todayStr = toISODate(now);
  if (dateStr < todayStr) return true;
  if (dateStr > todayStr) return false;
  const apptMinutes = timeToMinutes(timeStr);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes - apptMinutes > APPT_OVERDUE_GRACE_MINUTES;
}

function formatScheduleRanges(ranges) {
  return ranges.map(r => `${r.open}–${r.close}`).join(' y ');
}

function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(total) {
  const clamped = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

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
