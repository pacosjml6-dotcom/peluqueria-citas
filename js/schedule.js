/* Configuración del horario laboral: qué días se trabaja y en qué franjas horarias.
   Cada día admite dos turnos: mañana (inicio de mañana a fin de mediodía) y
   tarde (inicio de tarde a fin de tarde). Un turno con los campos vacíos no se trabaja. */
const DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const Schedule = {
  init() {
    this.buildForm();
    this.renderSummary();

    document.getElementById('btn-edit-schedule').addEventListener('click', () => this.openForm());
    document.getElementById('btn-close-schedule-modal').addEventListener('click', () => this.closeForm());
    document.getElementById('btn-cancel-schedule-form').addEventListener('click', () => this.closeForm());
    document.getElementById('schedule-form').addEventListener('submit', (e) => this.handleSubmit(e));

    document.getElementById('schedule-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'schedule-modal-overlay') this.closeForm();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !document.getElementById('schedule-modal-overlay').classList.contains('hidden')) {
        this.closeForm();
      }
    });
  },

  buildForm() {
    const container = document.getElementById('schedule-days-list');
    container.innerHTML = DAY_LABELS.map((label, idx) => `
      <div class="schedule-day-row" data-day="${idx}">
        <div class="schedule-day-name">${label}</div>
        <label class="schedule-closed-toggle">
          <input type="checkbox" class="schedule-closed-checkbox">
          Cerrado
        </label>
        <div class="schedule-shifts">
          <div class="schedule-shift">
            <span class="schedule-shift-label">Mañana</span>
            <input type="time" class="schedule-morning-open-input">
            <span>–</span>
            <input type="time" class="schedule-morning-close-input">
          </div>
          <div class="schedule-shift">
            <span class="schedule-shift-label">Tarde</span>
            <input type="time" class="schedule-afternoon-open-input">
            <span>–</span>
            <input type="time" class="schedule-afternoon-close-input">
          </div>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.schedule-closed-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const row = e.target.closest('.schedule-day-row');
        row.querySelectorAll('input[type="time"]').forEach(input => {
          input.disabled = e.target.checked;
        });
      });
    });
  },

  fillForm() {
    const schedule = ScheduleStore.getAll();
    document.querySelectorAll('.schedule-day-row').forEach(row => {
      const day = schedule[Number(row.dataset.day)];
      const checkbox = row.querySelector('.schedule-closed-checkbox');
      const morningOpen = row.querySelector('.schedule-morning-open-input');
      const morningClose = row.querySelector('.schedule-morning-close-input');
      const afternoonOpen = row.querySelector('.schedule-afternoon-open-input');
      const afternoonClose = row.querySelector('.schedule-afternoon-close-input');

      checkbox.checked = day.closed;
      morningOpen.value = day.morningOpen || '';
      morningClose.value = day.morningClose || '';
      afternoonOpen.value = day.afternoonOpen || '';
      afternoonClose.value = day.afternoonClose || '';

      [morningOpen, morningClose, afternoonOpen, afternoonClose].forEach(input => {
        input.disabled = day.closed;
      });
    });
  },

  openForm() {
    this.fillForm();
    document.getElementById('schedule-modal-overlay').classList.remove('hidden');
  },

  closeForm() {
    document.getElementById('schedule-modal-overlay').classList.add('hidden');
  },

  handleSubmit(e) {
    e.preventDefault();
    const rows = document.querySelectorAll('.schedule-day-row');
    const schedule = [];

    for (const row of rows) {
      const dayLabel = DAY_LABELS[Number(row.dataset.day)];
      const closed = row.querySelector('.schedule-closed-checkbox').checked;
      const morningOpen = row.querySelector('.schedule-morning-open-input').value;
      const morningClose = row.querySelector('.schedule-morning-close-input').value;
      const afternoonOpen = row.querySelector('.schedule-afternoon-open-input').value;
      const afternoonClose = row.querySelector('.schedule-afternoon-close-input').value;

      if (!closed) {
        if (Boolean(morningOpen) !== Boolean(morningClose)) {
          showToast(`Completa la hora de inicio y fin de la mañana en ${dayLabel}`, 'error');
          return;
        }
        if (morningOpen && morningClose && morningOpen >= morningClose) {
          showToast(`En ${dayLabel} el fin de mañana debe ser posterior al inicio de mañana`, 'error');
          return;
        }
        if (Boolean(afternoonOpen) !== Boolean(afternoonClose)) {
          showToast(`Completa la hora de inicio y fin de la tarde en ${dayLabel}`, 'error');
          return;
        }
        if (afternoonOpen && afternoonClose && afternoonOpen >= afternoonClose) {
          showToast(`En ${dayLabel} el fin de tarde debe ser posterior al inicio de tarde`, 'error');
          return;
        }
        if (!morningOpen && !afternoonOpen) {
          showToast(`Indica al menos un turno en ${dayLabel} o márcalo como cerrado`, 'error');
          return;
        }
      }

      schedule.push({
        closed,
        morningOpen: closed ? '' : morningOpen,
        morningClose: closed ? '' : morningClose,
        afternoonOpen: closed ? '' : afternoonOpen,
        afternoonClose: closed ? '' : afternoonClose,
      });
    }

    ScheduleStore.save(schedule);
    this.renderSummary();
    this.closeForm();
    showToast('Horario laboral actualizado correctamente', 'success');

    const dateInput = document.getElementById('appt-date');
    if (dateInput && dateInput.value && !document.getElementById('modal-overlay').classList.contains('hidden')) {
      Appointments.populateTimeSelect(dateInput.value);
      Appointments.checkEmployeeConflict();
    }
  },

  renderSummary() {
    const schedule = ScheduleStore.getAll();
    const el = document.getElementById('schedule-summary');
    el.innerHTML = schedule.map((day, idx) => {
      const ranges = ScheduleStore.getRanges(day);
      if (day.closed || ranges.length === 0) {
        return `
          <div class="schedule-summary-row">
            <span class="schedule-summary-day">${DAY_LABELS[idx]}</span>
            <span class="schedule-summary-hours">Cerrado</span>
          </div>
        `;
      }

      const shiftsHtml = [
        day.morningOpen && day.morningClose
          ? `<span class="schedule-summary-shift"><strong>Mañana</strong> ${day.morningOpen} – ${day.morningClose}</span>`
          : '',
        day.afternoonOpen && day.afternoonClose
          ? `<span class="schedule-summary-shift"><strong>Tarde</strong> ${day.afternoonOpen} – ${day.afternoonClose}</span>`
          : '',
      ].filter(Boolean).join('');

      return `
        <div class="schedule-summary-row">
          <span class="schedule-summary-day">${DAY_LABELS[idx]}</span>
          <span class="schedule-summary-hours">${shiftsHtml}</span>
        </div>
      `;
    }).join('');
  }
};
