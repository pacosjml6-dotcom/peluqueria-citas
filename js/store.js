/* Capa de persistencia: todo el acceso a la base de datos (Supabase) pasa por aquí.
   Cada Store mantiene una caché local en memoria que se llena al arrancar
   (DataStore.loadAll) y se mantiene al día con cada escritura y con Realtime,
   para que el resto de la app pueda seguir leyendo de forma síncrona. */

const SUPABASE_URL = 'https://pmeslxgnlwppcfxvybjc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_z-jwWnnSjiba0Jsb5WryGw_-6CQUogo';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ---- Conversión entre las filas de la base de datos (snake_case) y los
   objetos que usa la aplicación (camelCase, igual que en la versión anterior
   basada en localStorage) ---- */

function citaFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    dialCode: row.dial_code,
    phoneLocal: row.phone_local,
    email: row.email,
    employeeId: row.employee_id,
    clientId: row.client_id,
    date: row.date,
    time: row.time,
    notes: row.notes || '',
    createdByClient: row.created_by_client || false,
    paid: row.paid || false,
  };
}

function citaToRow(data) {
  return {
    name: data.name,
    phone: data.phone,
    dial_code: data.dialCode,
    phone_local: data.phoneLocal,
    email: data.email,
    employee_id: data.employeeId || null,
    client_id: data.clientId || null,
    date: data.date,
    time: data.time,
    notes: data.notes || null,
    paid: data.paid || false,
  };
}

function clientFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    dialCode: row.dial_code,
    phoneLocal: row.phone_local,
    fullPhone: row.full_phone,
    email: row.email,
  };
}

function clientToRow(data) {
  return {
    name: data.name,
    dial_code: data.dialCode,
    phone_local: data.phoneLocal,
    full_phone: data.fullPhone,
    email: data.email,
  };
}

function employeeFromRow(row) {
  return { id: row.id, name: row.name, photo: row.photo || null };
}

function employeeToRow(data) {
  return { name: data.name, photo: data.photo || null };
}

function scheduleDayFromRow(row) {
  return {
    closed: row.closed,
    morningOpen: row.morning_open || '',
    morningClose: row.morning_close || '',
    afternoonOpen: row.afternoon_open || '',
    afternoonClose: row.afternoon_close || '',
  };
}

function scheduleDayToRow(dayIndex, day) {
  return {
    day_index: dayIndex,
    closed: day.closed,
    morning_open: day.morningOpen || null,
    morning_close: day.morningClose || null,
    afternoon_open: day.afternoonOpen || null,
    afternoon_close: day.afternoonClose || null,
  };
}

/* Capa de persistencia de citas */
const Store = {
  cache: [],

  async _load() {
    const { data, error } = await supabaseClient.from('citas').select('*');
    if (error) throw error;
    this.cache = data.map(citaFromRow);
  },

  getAll() {
    return this.cache;
  },

  async create(appt) {
    const { data, error } = await supabaseClient.from('citas').insert(citaToRow(appt)).select().single();
    if (error) throw error;
    const created = citaFromRow(data);
    this.cache.push(created);
    return created;
  },

  async update(id, changes) {
    const idx = this.cache.findIndex(a => a.id === id);
    const merged = idx !== -1 ? { ...this.cache[idx], ...changes } : changes;
    const { data, error } = await supabaseClient.from('citas').update(citaToRow(merged)).eq('id', id).select().single();
    if (error) throw error;
    const updated = citaFromRow(data);
    if (idx !== -1) this.cache[idx] = updated; else this.cache.push(updated);
    return updated;
  },

  async remove(id) {
    const { error } = await supabaseClient.from('citas').delete().eq('id', id);
    if (error) throw error;
    this.cache = this.cache.filter(a => a.id !== id);
  },

  getByDate(dateStr) {
    return this.cache
      .filter(a => a.date === dateStr)
      .sort((a, b) => a.time.localeCompare(b.time));
  },

  countByDate() {
    const map = {};
    this.cache.forEach(a => {
      map[a.date] = (map[a.date] || 0) + 1;
    });
    return map;
  },

  async updateByClientId(clientId, changes) {
    const affected = this.cache.filter(a => a.clientId === clientId);
    if (affected.length === 0) return false;

    const dbChanges = {};
    if (changes.name !== undefined) dbChanges.name = changes.name;
    if (changes.dialCode !== undefined) dbChanges.dial_code = changes.dialCode;
    if (changes.phoneLocal !== undefined) dbChanges.phone_local = changes.phoneLocal;
    if (changes.phone !== undefined) dbChanges.phone = changes.phone;
    if (changes.email !== undefined) dbChanges.email = changes.email;

    const { data, error } = await supabaseClient.from('citas').update(dbChanges).eq('client_id', clientId).select();
    if (error) throw error;

    data.map(citaFromRow).forEach(updated => {
      const idx = this.cache.findIndex(a => a.id === updated.id);
      if (idx !== -1) this.cache[idx] = updated;
    });
    return true;
  }
};

/* Capa de persistencia de clientes */
const ClientStore = {
  cache: [],

  async _load() {
    const { data, error } = await supabaseClient.from('clientes').select('*');
    if (error) throw error;
    this.cache = data.map(clientFromRow);
  },

  getAll() {
    return this.cache;
  },

  async create(client) {
    const { data, error } = await supabaseClient.from('clientes').insert(clientToRow(client)).select().single();
    if (error) throw error;
    const created = clientFromRow(data);
    this.cache.push(created);
    return created;
  },

  async update(id, changes) {
    const idx = this.cache.findIndex(c => c.id === id);
    const merged = idx !== -1 ? { ...this.cache[idx], ...changes } : changes;
    const { data, error } = await supabaseClient.from('clientes').update(clientToRow(merged)).eq('id', id).select().single();
    if (error) throw error;
    const updated = clientFromRow(data);
    if (idx !== -1) this.cache[idx] = updated; else this.cache.push(updated);
    return updated;
  },

  async remove(id) {
    const { error } = await supabaseClient.from('clientes').delete().eq('id', id);
    if (error) throw error;
    this.cache = this.cache.filter(c => c.id !== id);
  },

  findByPhone(fullPhone, excludeId = null) {
    return this.cache.find(c => c.fullPhone === fullPhone && c.id !== excludeId);
  },

  findByEmail(email, excludeId = null) {
    const normalized = email.trim().toLowerCase();
    return this.cache.find(c => c.email.trim().toLowerCase() === normalized && c.id !== excludeId);
  },

  findByName(name, excludeId = null) {
    const normalized = name.trim().toLowerCase();
    return this.cache.find(c => c.name.trim().toLowerCase() === normalized && c.id !== excludeId);
  }
};

/* Capa de persistencia de empleados */
const EmployeeStore = {
  cache: [],

  async _load() {
    const { data, error } = await supabaseClient.from('empleados').select('*');
    if (error) throw error;
    this.cache = data.map(employeeFromRow);
  },

  getAll() {
    return this.cache;
  },

  async create(employee) {
    const { data, error } = await supabaseClient.from('empleados').insert(employeeToRow(employee)).select().single();
    if (error) throw error;
    const created = employeeFromRow(data);
    this.cache.push(created);
    return created;
  },

  async update(id, changes) {
    const idx = this.cache.findIndex(e => e.id === id);
    const merged = idx !== -1 ? { ...this.cache[idx], ...changes } : changes;
    const { data, error } = await supabaseClient.from('empleados').update(employeeToRow(merged)).eq('id', id).select().single();
    if (error) throw error;
    const updated = employeeFromRow(data);
    if (idx !== -1) this.cache[idx] = updated; else this.cache.push(updated);
    return updated;
  },

  async remove(id) {
    const { error } = await supabaseClient.from('empleados').delete().eq('id', id);
    if (error) throw error;
    this.cache = this.cache.filter(e => e.id !== id);
  }
};

/* Capa de persistencia del horario laboral del establecimiento.
   Índice de día: 0=Lunes ... 6=Domingo, igual que usa el calendario. */

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
  cache: DEFAULT_SCHEDULE.map(d => ({ ...d })),

  async _load() {
    const { data, error } = await supabaseClient.from('horario').select('*').order('day_index');
    if (error) throw error;
    if (data.length === 7) this.cache = data.map(scheduleDayFromRow);
  },

  getAll() {
    return this.cache;
  },

  async save(schedule) {
    const rows = schedule.map((day, idx) => scheduleDayToRow(idx, day));
    const { error } = await supabaseClient.from('horario').upsert(rows, { onConflict: 'day_index' });
    if (error) throw error;
    this.cache = schedule.map(d => ({ ...d }));
  },

  getForDate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const idx = (date.getDay() + 6) % 7;
    return this.cache[idx];
  },

  getRanges(day) {
    const ranges = [];
    if (day.morningOpen && day.morningClose) ranges.push({ open: day.morningOpen, close: day.morningClose });
    if (day.afternoonOpen && day.afternoonClose) ranges.push({ open: day.afternoonOpen, close: day.afternoonClose });
    return ranges;
  }
};

/* Carga inicial de todas las tablas y sincronización en tiempo real entre
   dispositivos: cuando alguien crea/edita/borra algo desde otro navegador,
   recargamos la tabla afectada y avisamos al resto de la app con un evento. */
const DataStore = {
  MIGRATION_FLAG_KEY: 'peluqueria_migrated_to_supabase_v1',

  async loadAll() {
    await Promise.all([
      Store._load(),
      ClientStore._load(),
      EmployeeStore._load(),
      ScheduleStore._load(),
    ]);
  },

  /* Sube a Supabase los datos que hubiera en localStorage de la versión
     anterior de la app (basada en el navegador), una única vez, para no
     perder las citas/clientes/empleados/horario ya guardados. */
  async migrateLocalStorageIfNeeded() {
    if (localStorage.getItem(this.MIGRATION_FLAG_KEY)) return;

    const oldClients = JSON.parse(localStorage.getItem('peluqueria_clientes_v1') || '[]');
    const oldEmployees = JSON.parse(localStorage.getItem('peluqueria_empleados_v1') || '[]');
    const oldAppts = JSON.parse(localStorage.getItem('peluqueria_citas_v1') || '[]');
    const oldScheduleRaw = localStorage.getItem('peluqueria_horario_v2');

    if (oldClients.length === 0 && oldEmployees.length === 0 && oldAppts.length === 0 && !oldScheduleRaw) {
      localStorage.setItem(this.MIGRATION_FLAG_KEY, '1');
      return;
    }

    const clientIdMap = {};
    const employeeIdMap = {};

    for (const c of oldClients) {
      const { data, error } = await supabaseClient.from('clientes').insert(clientToRow(c)).select().single();
      if (!error) clientIdMap[c.id] = data.id;
      else console.error('No se pudo migrar el cliente', c, error);
    }

    for (const e of oldEmployees) {
      const { data, error } = await supabaseClient.from('empleados').insert(employeeToRow(e)).select().single();
      if (!error) employeeIdMap[e.id] = data.id;
      else console.error('No se pudo migrar el empleado', e, error);
    }

    for (const a of oldAppts) {
      const row = citaToRow({
        ...a,
        clientId: clientIdMap[a.clientId] || null,
        employeeId: employeeIdMap[a.employeeId] || null,
      });
      const { error } = await supabaseClient.from('citas').insert(row);
      if (error) console.error('No se pudo migrar la cita', a, error);
    }

    if (oldScheduleRaw) {
      const parsed = JSON.parse(oldScheduleRaw).map(day => (
        day.morningOpen !== undefined
          ? day
          : { closed: day.closed, morningOpen: day.open || '', morningClose: day.close || '', afternoonOpen: '', afternoonClose: '' }
      ));
      const rows = parsed.map((day, idx) => scheduleDayToRow(idx, day));
      const { error } = await supabaseClient.from('horario').upsert(rows, { onConflict: 'day_index' });
      if (error) console.error('No se pudo migrar el horario', error);
    }

    localStorage.setItem(this.MIGRATION_FLAG_KEY, '1');
  },

  subscribeRealtime() {
    supabaseClient
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'citas' }, async () => {
        await Store._load();
        window.dispatchEvent(new CustomEvent('citas:changed'));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, async () => {
        await ClientStore._load();
        window.dispatchEvent(new CustomEvent('clientes:changed'));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'empleados' }, async () => {
        await EmployeeStore._load();
        window.dispatchEvent(new CustomEvent('empleados:changed'));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'horario' }, async () => {
        await ScheduleStore._load();
        window.dispatchEvent(new CustomEvent('horario:changed'));
      })
      .subscribe();
  }
};
