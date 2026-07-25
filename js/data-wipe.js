/* Vaciar base de datos: permite borrar solo las citas o citas+clientes+
   empleados (el horario laboral y los datos de empresa nunca se tocan,
   son configuración, no datos operativos). Protegido con un PIN de
   seguridad propio de la app (no la contraseña de inicio de sesión):
   se guarda solo su hash SHA-256 en la tabla "app_settings", que no tiene
   ninguna política de acceso público (a diferencia de "empresa").

   Flujo: si no hay PIN configurado, hay que crearlo antes de nada. Si ya
   existe, se pide justo al abrir el botón "Vaciar datos" (antes de ver
   ninguna opción); una vez superado, elegir "solo citas" o "todo" solo
   pide una confirmación normal, sin volver a teclear el PIN. */
const DataWipe = {
  pinConfigured: false,
  pendingAction: null,
  pendingRange: null,

  init() {
    document.getElementById('btn-wipe-data').addEventListener('click', () => this.openModal());
    document.getElementById('btn-close-wipe-modal').addEventListener('click', () => this.closeModal());
    document.getElementById('wipe-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'wipe-modal-overlay') this.closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !document.getElementById('wipe-modal-overlay').classList.contains('hidden')) {
        this.closeModal();
      }
    });

    document.getElementById('wipe-setup-pin-form').addEventListener('submit', (e) => this.handleSetupPin(e));
    document.getElementById('wipe-pin-gate-form').addEventListener('submit', (e) => this.handlePinGate(e));
    document.getElementById('btn-wipe-pin-gate-cancel').addEventListener('click', () => this.closeModal());
    document.getElementById('btn-wipe-appointments').addEventListener('click', () => this.startWipeAppointments());
    document.getElementById('btn-wipe-everything').addEventListener('click', () => this.openConfirm('todo'));
    document.getElementById('btn-wipe-change-pin').addEventListener('click', () => this.showChangePin());
    document.getElementById('btn-wipe-change-pin-cancel').addEventListener('click', () => this.showActions());
    document.getElementById('wipe-change-pin-form').addEventListener('submit', (e) => this.handleChangePin(e));
    document.getElementById('btn-wipe-confirm-cancel').addEventListener('click', () => this.showActions());
    document.getElementById('btn-wipe-confirm-submit').addEventListener('click', () => this.handleConfirmWipe());
  },

  async openModal() {
    await this.refreshPinState();
    this.clearErrors();
    if (this.pinConfigured) this.showPinGate(); else this.showSetup();
    document.getElementById('wipe-modal-overlay').classList.remove('hidden');
  },

  closeModal() {
    document.getElementById('wipe-modal-overlay').classList.add('hidden');
    this.clearErrors();
    document.getElementById('wipe-setup-pin-form').reset();
    document.getElementById('wipe-pin-gate-form').reset();
    document.getElementById('wipe-change-pin-form').reset();
    document.getElementById('wipe-appts-range-start').value = '';
    document.getElementById('wipe-appts-range-end').value = '';
  },

  clearErrors() {
    ['wipe-setup-pin-error', 'wipe-pin-gate-error', 'wipe-change-pin-error'].forEach((id) => {
      const el = document.getElementById(id);
      el.textContent = '';
      el.classList.add('hidden');
    });
  },

  hideAllViews() {
    ['wipe-setup-pin-view', 'wipe-pin-gate-view', 'wipe-actions-view', 'wipe-change-pin-view', 'wipe-confirm-view'].forEach((id) => {
      document.getElementById(id).classList.add('hidden');
    });
  },

  showSetup() {
    this.hideAllViews();
    document.getElementById('wipe-setup-pin-view').classList.remove('hidden');
  },

  showPinGate() {
    this.hideAllViews();
    document.getElementById('wipe-pin-gate-view').classList.remove('hidden');
    document.getElementById('wipe-pin-gate-input').focus();
  },

  showActions() {
    this.hideAllViews();
    this.clearErrors();
    document.getElementById('wipe-actions-view').classList.remove('hidden');
  },

  showChangePin() {
    this.hideAllViews();
    document.getElementById('wipe-change-pin-view').classList.remove('hidden');
  },

  /* "Vaciar solo las citas" admite un rango de fechas opcional (elegido en
     wipe-actions-view antes de llegar aquí): si se indica, solo se piden y
     borran las citas de ese rango; si se deja vacío, se borran todas. */
  startWipeAppointments() {
    const start = document.getElementById('wipe-appts-range-start').value;
    const end = document.getElementById('wipe-appts-range-end').value;

    if ((start && !end) || (!start && end)) {
      showToast('Selecciona las dos fechas del rango, o déjalas vacías para eliminar todas las citas.', 'error');
      return;
    }
    if (start && end && start > end) {
      showToast('La fecha "Desde" no puede ser posterior a "Hasta".', 'error');
      return;
    }

    const range = start && end ? { start, end } : null;
    const count = range
      ? Store.getAll().filter((a) => a.date >= range.start && a.date <= range.end).length
      : Store.getAll().length;

    if (range && count === 0) {
      showToast('No hay citas en ese rango de fechas.', 'error');
      return;
    }

    this.openConfirm('citas', range, count);
  },

  openConfirm(action, range, count) {
    this.pendingAction = action;
    this.pendingRange = range || null;
    const messageEl = document.getElementById('wipe-confirm-message');
    if (action === 'citas') {
      messageEl.textContent = range
        ? `Vas a eliminar ${count} cita${count === 1 ? '' : 's'} entre el ${formatRangeDate(range.start)} y el ${formatRangeDate(range.end)}. Esta acción no se puede deshacer.`
        : 'Vas a eliminar todas las citas. Esta acción no se puede deshacer.';
    } else {
      messageEl.textContent = 'Vas a eliminar todas las citas, clientes y empleados. Esta acción no se puede deshacer.';
    }
    document.getElementById('btn-wipe-confirm-submit').textContent = action === 'citas'
      ? (range ? 'Vaciar citas del rango' : 'Vaciar citas')
      : 'Vaciar todo';
    this.hideAllViews();
    document.getElementById('wipe-confirm-view').classList.remove('hidden');
  },

  async refreshPinState() {
    try {
      const { data, error } = await supabaseClient.from('app_settings').select('wipe_pin_hash').eq('id', true).maybeSingle();
      if (error) throw error;
      this.pinConfigured = !!(data && data.wipe_pin_hash);
    } catch (err) {
      console.error('No se pudo comprobar el PIN de seguridad (¿falta ejecutar supabase/wipe-pin.sql?)', err);
      this.pinConfigured = false;
    }
  },

  async getStoredPinHash() {
    const { data, error } = await supabaseClient.from('app_settings').select('wipe_pin_hash').eq('id', true).maybeSingle();
    if (error) throw error;
    return data ? data.wipe_pin_hash : null;
  },

  async sha256Hex(text) {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  },

  async handleSetupPin(e) {
    e.preventDefault();
    const pin = document.getElementById('wipe-setup-pin').value;
    const confirmPin = document.getElementById('wipe-setup-pin-confirm').value;
    const errorEl = document.getElementById('wipe-setup-pin-error');
    errorEl.classList.add('hidden');

    if (pin.length < 4) {
      errorEl.textContent = 'El PIN debe tener al menos 4 caracteres';
      errorEl.classList.remove('hidden');
      return;
    }
    if (pin !== confirmPin) {
      errorEl.textContent = 'Los PIN no coinciden';
      errorEl.classList.remove('hidden');
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      const hash = await this.sha256Hex(pin);
      const { error } = await supabaseClient.from('app_settings').upsert({ id: true, wipe_pin_hash: hash }, { onConflict: 'id' });
      if (error) throw error;
      this.pinConfigured = true;
      document.getElementById('wipe-setup-pin-form').reset();
      showToast('PIN de seguridad configurado correctamente', 'success');
      this.showActions();
    } catch (err) {
      console.error('Error guardando el PIN de seguridad', err);
      showToast('No se pudo guardar el PIN. Inténtalo de nuevo.', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  },

  async handlePinGate(e) {
    e.preventDefault();
    const pin = document.getElementById('wipe-pin-gate-input').value;
    const errorEl = document.getElementById('wipe-pin-gate-error');
    errorEl.classList.add('hidden');

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      const storedHash = await this.getStoredPinHash();
      const enteredHash = await this.sha256Hex(pin);
      if (!storedHash || storedHash !== enteredHash) {
        errorEl.textContent = 'El PIN no es correcto';
        errorEl.classList.remove('hidden');
        return;
      }
      document.getElementById('wipe-pin-gate-form').reset();
      this.showActions();
    } catch (err) {
      console.error('Error comprobando el PIN de seguridad', err);
      showToast('No se pudo comprobar el PIN. Inténtalo de nuevo.', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  },

  async handleChangePin(e) {
    e.preventDefault();
    const next = document.getElementById('wipe-change-pin-new').value;
    const confirmNext = document.getElementById('wipe-change-pin-new-confirm').value;
    const errorEl = document.getElementById('wipe-change-pin-error');
    errorEl.classList.add('hidden');

    if (next.length < 4) {
      errorEl.textContent = 'El nuevo PIN debe tener al menos 4 caracteres';
      errorEl.classList.remove('hidden');
      return;
    }
    if (next !== confirmNext) {
      errorEl.textContent = 'Los PIN nuevos no coinciden';
      errorEl.classList.remove('hidden');
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      const newHash = await this.sha256Hex(next);
      const { error } = await supabaseClient.from('app_settings').update({ wipe_pin_hash: newHash }).eq('id', true);
      if (error) throw error;

      document.getElementById('wipe-change-pin-form').reset();
      showToast('PIN de seguridad actualizado correctamente', 'success');
      this.showActions();
    } catch (err) {
      console.error('Error cambiando el PIN de seguridad', err);
      showToast('No se pudo cambiar el PIN. Inténtalo de nuevo.', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  },

  async handleConfirmWipe() {
    const submitBtn = document.getElementById('btn-wipe-confirm-submit');
    submitBtn.disabled = true;
    try {
      if (this.pendingAction === 'citas') {
        await this.wipeAppointmentsOnly(this.pendingRange);
        showToast(this.pendingRange ? 'Las citas del rango seleccionado se han eliminado' : 'Todas las citas se han eliminado', 'success');
      } else {
        await this.wipeEverything();
        showToast('Citas, clientes y empleados se han eliminado', 'success');
      }
      this.closeModal();
    } catch (err) {
      console.error('Error vaciando la base de datos', err);
      showToast('No se pudo completar el vaciado. Inténtalo de nuevo.', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  },

  async deleteAllRows(table, idColumn = 'id') {
    const { error } = await supabaseClient.from(table).delete().not(idColumn, 'is', null);
    if (error) throw error;
  },

  async deleteAppointments(range) {
    const query = supabaseClient.from('citas').delete();
    const { error } = range
      ? await query.gte('date', range.start).lte('date', range.end)
      : await query.not('id', 'is', null);
    if (error) throw error;
  },

  async wipeAppointmentsOnly(range) {
    await this.deleteAppointments(range);
    await Store._load();
    window.dispatchEvent(new CustomEvent('citas:changed'));
  },

  async wipeEverything() {
    await this.deleteAllRows('citas', 'id');
    await this.deleteAllRows('clientes', 'id');
    await this.deleteAllRows('empleados', 'id');
    await Promise.all([Store._load(), ClientStore._load(), EmployeeStore._load()]);
    window.dispatchEvent(new CustomEvent('citas:changed'));
    window.dispatchEvent(new CustomEvent('clientes:changed'));
    window.dispatchEvent(new CustomEvent('empleados:changed'));
  },
};

function formatRangeDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}
