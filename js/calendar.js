/* Render e interacción del calendario mensual */
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const Calendar = {
  refDate: new Date(),
  selectedDate: toISODate(new Date()),
  onDayClick: null,

  init(onDayClick) {
    this.onDayClick = onDayClick;
    document.getElementById('btn-prev-month').addEventListener('click', () => this.changeMonth(-1));
    document.getElementById('btn-next-month').addEventListener('click', () => this.changeMonth(1));
    this.render();
  },

  changeMonth(delta) {
    this.refDate = new Date(this.refDate.getFullYear(), this.refDate.getMonth() + delta, 1);
    this.render();
  },

  goToToday() {
    const today = new Date();
    this.refDate = today;
    this.selectedDate = toISODate(today);
    this.render();
  },

  selectDate(dateStr) {
    this.selectedDate = dateStr;
    this.render();
    if (this.onDayClick) this.onDayClick(dateStr);
  },

  render() {
    const title = document.getElementById('calendar-title');
    const grid = document.getElementById('calendar-grid');
    const counts = Store.countByDate();

    const year = this.refDate.getFullYear();
    const month = this.refDate.getMonth();
    title.textContent = `${MONTH_NAMES[month]} ${year}`;

    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7; // semana empieza en lunes
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
    const todayStr = toISODate(new Date());

    grid.innerHTML = '';

    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startOffset + 1;
      let cellDate;
      let isOutside = false;

      if (dayNum < 1) {
        cellDate = new Date(year, month - 1, daysInPrevMonth + dayNum);
        isOutside = true;
      } else if (dayNum > daysInMonth) {
        cellDate = new Date(year, month + 1, dayNum - daysInMonth);
        isOutside = true;
      } else {
        cellDate = new Date(year, month, dayNum);
      }

      const iso = toISODate(cellDate);
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'calendar-day';
      if (isOutside) cell.classList.add('is-outside');
      if (iso === todayStr) cell.classList.add('is-today');
      else if (iso < todayStr) cell.classList.add('is-past');
      else cell.classList.add('is-future');
      if (iso === this.selectedDate) cell.classList.add('is-selected');

      const num = document.createElement('span');
      num.className = 'day-number';
      num.textContent = cellDate.getDate();
      cell.appendChild(num);

      const count = counts[iso];
      if (count) {
        const badge = document.createElement('span');
        badge.className = 'day-badge';
        badge.textContent = count > 9 ? '9+' : String(count);
        cell.appendChild(badge);
      }

      cell.addEventListener('click', () => this.selectDate(iso));
      grid.appendChild(cell);
    }
  }
};

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
