/* Vista de detalle de un día: desglosa el horario laboral en tramos ocupados
   (a partir de las citas ya registradas) y tramos libres, y permite crear una
   cita nueva directamente desde un hueco libre. */
const DAY_DETAIL_APPT_DURATION_MINUTES = 30;

const DayDetail = {
  currentDate: null,

  init() {
    document.getElementById('btn-close-day-detail').addEventListener('click', () => this.close());
    document.getElementById('day-detail-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'day-detail-overlay') this.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !document.getElementById('day-detail-overlay').classList.contains('hidden')) {
        this.close();
      }
    });
  },

  open(dateStr) {
    this.currentDate = dateStr;
    this.render();
    document.getElementById('day-detail-overlay').classList.remove('hidden');
  },

  close() {
    document.getElementById('day-detail-overlay').classList.add('hidden');
  },

  render() {
    const dateStr = this.currentDate;
    const title = document.getElementById('day-detail-title');
    const label = formatDate(dateStr);
    title.textContent = label.charAt(0).toUpperCase() + label.slice(1);

    const body = document.getElementById('day-detail-body');
    const schedule = ScheduleStore.getForDate(dateStr);
    const ranges = schedule && !schedule.closed ? ScheduleStore.getRanges(schedule) : [];

    if (!schedule || schedule.closed || ranges.length === 0) {
      body.innerHTML = '<div class="empty-state"><p>El establecimiento está cerrado este día.</p></div>';
      return;
    }

    const segments = this.buildSegments(dateStr, ranges);

    body.innerHTML = '';
    segments.forEach(seg => this.renderSegment(body, seg));
  },

  buildSegments(dateStr, ranges) {
    const appts = Store.getByDate(dateStr);
    const now = new Date();
    const isToday = dateStr === toISODate(now);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const segments = [];
    ranges.forEach(range => {
      let cursor = timeToMinutes(range.open);
      const rangeEnd = timeToMinutes(range.close);
      const rangeAppts = appts.filter(a => {
        const t = timeToMinutes(a.time);
        return t >= cursor && t < rangeEnd;
      });

      rangeAppts.forEach(appt => {
        const start = timeToMinutes(appt.time);
        if (start > cursor) {
          segments.push(...this.splitPast({ type: 'free', start: cursor, end: start }, isToday, nowMinutes));
        }
        const end = Math.min(start + DAY_DETAIL_APPT_DURATION_MINUTES, rangeEnd);
        segments.push({ type: 'busy', start, end, appt });
        cursor = Math.max(cursor, end);
      });

      if (cursor < rangeEnd) {
        segments.push(...this.splitPast({ type: 'free', start: cursor, end: rangeEnd }, isToday, nowMinutes));
      }
    });

    return segments;
  },

  splitPast(seg, isToday, nowMinutes) {
    if (!isToday || seg.type !== 'free') return [seg];
    if (seg.end <= nowMinutes) return [{ ...seg, type: 'past' }];
    if (seg.start >= nowMinutes) return [seg];

    const cutoff = Math.min(Math.ceil(nowMinutes / SLOT_INTERVAL_MINUTES) * SLOT_INTERVAL_MINUTES, seg.end);
    const result = [];
    if (cutoff > seg.start) result.push({ ...seg, type: 'past', end: cutoff });
    if (cutoff < seg.end) result.push({ ...seg, start: cutoff });
    return result;
  },

  renderSegment(container, seg) {
    const row = document.createElement('div');
    const timeLabel = `${minutesToTime(seg.start)} – ${minutesToTime(seg.end)}`;

    if (seg.type === 'busy') {
      const employee = EmployeeStore.getAll().find(e => e.id === seg.appt.employeeId);
      row.className = 'day-slot day-slot-busy';
      row.innerHTML = `
        <div class="day-slot-time">${timeLabel}</div>
        <div class="day-slot-info">
          <div class="day-slot-name">${escapeHtml(seg.appt.name)}</div>
          <div class="day-slot-detail">${escapeHtml(seg.appt.notes || 'Sin notas')}${employee ? ' · ' + escapeHtml(employee.name) : ''}</div>
        </div>
      `;
    } else if (seg.type === 'past') {
      row.className = 'day-slot day-slot-muted';
      row.innerHTML = `
        <div class="day-slot-time">${timeLabel}</div>
        <div class="day-slot-info"><div class="day-slot-name">Hora ya pasada</div></div>
      `;
    } else {
      row.className = 'day-slot day-slot-free';
      row.innerHTML = `
        <div class="day-slot-time">${timeLabel}</div>
        <div class="day-slot-info"><div class="day-slot-name">Hueco libre</div></div>
        <span class="day-slot-add" aria-hidden="true">+</span>
      `;
      row.addEventListener('click', () => this.bookSlot(this.currentDate, minutesToTime(seg.start)));
    }

    container.appendChild(row);
  },

  bookSlot(dateStr, time) {
    this.close();
    Appointments.openForm(null, dateStr);
    const timeSelect = document.getElementById('appt-time');
    const hasOption = Array.from(timeSelect.options).some(o => o.value === time);
    if (hasOption) {
      timeSelect.value = time;
      Appointments.checkEmployeeConflict();
    }
  }
};
