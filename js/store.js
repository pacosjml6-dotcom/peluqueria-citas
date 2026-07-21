/* Capa de persistencia: todo el acceso a LocalStorage pasa por aquí */
const STORAGE_KEY = 'peluqueria_citas_v1';

const Store = {
  getAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Error leyendo citas de LocalStorage', e);
      return [];
    }
  },

  save(all) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  },

  create(appt) {
    const all = this.getAll();
    const newAppt = { id: generateId(), ...appt };
    all.push(newAppt);
    this.save(all);
    return newAppt;
  },

  update(id, changes) {
    const all = this.getAll();
    const idx = all.findIndex(a => a.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...changes };
    this.save(all);
    return all[idx];
  },

  remove(id) {
    const all = this.getAll().filter(a => a.id !== id);
    this.save(all);
  },

  getByDate(dateStr) {
    return this.getAll()
      .filter(a => a.date === dateStr)
      .sort((a, b) => a.time.localeCompare(b.time));
  },

  countByDate() {
    const map = {};
    this.getAll().forEach(a => {
      map[a.date] = (map[a.date] || 0) + 1;
    });
    return map;
  },

  updateByClientId(clientId, changes) {
    const all = this.getAll();
    let updated = false;
    all.forEach(a => {
      if (a.clientId === clientId) {
        Object.assign(a, changes);
        updated = true;
      }
    });
    if (updated) this.save(all);
    return updated;
  }
};

function generateId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/* Capa de persistencia de clientes */
const CLIENTS_STORAGE_KEY = 'peluqueria_clientes_v1';

const ClientStore = {
  getAll() {
    try {
      const raw = localStorage.getItem(CLIENTS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Error leyendo clientes de LocalStorage', e);
      return [];
    }
  },

  save(all) {
    localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(all));
  },

  create(client) {
    const all = this.getAll();
    const newClient = { id: generateId(), ...client };
    all.push(newClient);
    this.save(all);
    return newClient;
  },

  update(id, changes) {
    const all = this.getAll();
    const idx = all.findIndex(c => c.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...changes };
    this.save(all);
    return all[idx];
  },

  remove(id) {
    const all = this.getAll().filter(c => c.id !== id);
    this.save(all);
  },

  findByPhone(fullPhone, excludeId = null) {
    return this.getAll().find(c => c.fullPhone === fullPhone && c.id !== excludeId);
  },

  findByEmail(email, excludeId = null) {
    const normalized = email.trim().toLowerCase();
    return this.getAll().find(c => c.email.trim().toLowerCase() === normalized && c.id !== excludeId);
  },

  findByName(name, excludeId = null) {
    const normalized = name.trim().toLowerCase();
    return this.getAll().find(c => c.name.trim().toLowerCase() === normalized && c.id !== excludeId);
  }
};

/* Capa de persistencia de empleados */
const EMPLOYEES_STORAGE_KEY = 'peluqueria_empleados_v1';

const EmployeeStore = {
  getAll() {
    try {
      const raw = localStorage.getItem(EMPLOYEES_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Error leyendo empleados de LocalStorage', e);
      return [];
    }
  },

  save(all) {
    localStorage.setItem(EMPLOYEES_STORAGE_KEY, JSON.stringify(all));
  },

  create(employee) {
    const all = this.getAll();
    const newEmployee = { id: generateId(), ...employee };
    all.push(newEmployee);
    this.save(all);
    return newEmployee;
  },

  update(id, changes) {
    const all = this.getAll();
    const idx = all.findIndex(e => e.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...changes };
    this.save(all);
    return all[idx];
  },

  remove(id) {
    const all = this.getAll().filter(e => e.id !== id);
    this.save(all);
  }
};

/* Capa de persistencia del horario laboral del establecimiento.
   Índice de día: 0=Lunes ... 6=Domingo, igual que usa el calendario. */
const SCHEDULE_STORAGE_KEY = 'peluqueria_horario_v2';

/* Cada día tiene dos franjas: mañana (inicio de mañana a fin del mediodía) y
   tarde (inicio de la tarde a fin de la tarde). Una franja vacía significa que
   ese turno no se trabaja ese día. */
const DEFAULT_SCHEDULE = [
  { closed: false, morningOpen: '09:00', morningClose: '14:00', afternoonOpen: '15:30', afternoonClose: '19:30' }, // Lunes
  { closed: false, morningOpen: '09:00', morningClose: '14:00', afternoonOpen: '15:30', afternoonClose: '19:30' }, // Martes
  { closed: false, morningOpen: '09:00', morningClose: '14:00', afternoonOpen: '15:30', afternoonClose: '19:30' }, // Miércoles
  { closed: false, morningOpen: '09:00', morningClose: '14:00', afternoonOpen: '15:30', afternoonClose: '19:30' }, // Jueves
  { closed: false, morningOpen: '09:00', morningClose: '14:00', afternoonOpen: '15:30', afternoonClose: '19:30' }, // Viernes
  { closed: false, morningOpen: '10:00', morningClose: '14:00', afternoonOpen: '', afternoonClose: '' },          // Sábado
  { closed: true, morningOpen: '', morningClose: '', afternoonOpen: '', afternoonClose: '' },                     // Domingo
];

const ScheduleStore = {
  getAll() {
    try {
      const raw = localStorage.getItem(SCHEDULE_STORAGE_KEY);
      if (!raw) return DEFAULT_SCHEDULE.map(d => ({ ...d }));
      return JSON.parse(raw).map(day => this.normalize(day));
    } catch (e) {
      console.error('Error leyendo horario de LocalStorage', e);
      return DEFAULT_SCHEDULE.map(d => ({ ...d }));
    }
  },

  normalize(day) {
    if (day.morningOpen !== undefined) return day;
    // Compatibilidad con el formato anterior de una única franja horaria
    return {
      closed: day.closed,
      morningOpen: day.open || '',
      morningClose: day.close || '',
      afternoonOpen: '',
      afternoonClose: '',
    };
  },

  save(schedule) {
    localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(schedule));
  },

  getForDate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const idx = (date.getDay() + 6) % 7;
    return this.getAll()[idx];
  },

  getRanges(day) {
    const ranges = [];
    if (day.morningOpen && day.morningClose) ranges.push({ open: day.morningOpen, close: day.morningClose });
    if (day.afternoonOpen && day.afternoonClose) ranges.push({ open: day.afternoonOpen, close: day.afternoonClose });
    return ranges;
  }
};
