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
  }
};
