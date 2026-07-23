/* Vaciar base de datos: permite borrar solo las citas o citas+clientes+
   empleados (el horario laboral y los datos de empresa nunca se tocan,
   son configuración, no datos operativos). Protegido con un PIN de
   seguridad propio de la app (no la contraseña de inicio de sesión):
   se guarda solo su hash SHA-256 en la tabla "app_settings", que no tiene
   ninguna política de acceso público (a diferencia de "empresa"). */
const DataWipe = {
  pinConfigured: false,
  pendingAction: null,

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
    document.getElementById('btn-wipe-appointments').addEventListener('click', () => this.openConfirm('citas'));
    document.getElementById('btn-wipe-everything').addEventListener('click', () => this.openConfirm('todo'));
    document.getElementById('btn-wipe-change-pin').addEventListener('click', () => this.showChangePin());
    document.getElementById('btn-wipe-change-pin-cancel').addEventListener('click', () => this.showActions());
    document.getElementById('wipe-change-pin-form').addEventListener('submit', (e) => this.handleChangePin(e));
    document.getElementById('btn-wipe-confirm-cancel').addEventListener('click', () => this.showActions());
    document.getElementById('wipe-confirm-form').addEventListener('submit', (e) => this.handleConfirmWipe(e));
  },

  async openModal() {
    await this.refreshPinState();
    this.clearErrors();
    if (this.pinConfigured) this.showActions(); else this.showSetup();
    document.getElementById('wipe-modal-overlay').classList.remove('hidden');
  },

  closeModal() {
    document.getElementById('wipe-modal-overlay').classList.add('hidden');
    this.clearErrors();
    document.getElementById('wipe-setup-pin-form').reset();
    document.getElementById('wipe-change-pin-form').reset();
    document.getElementById('wipe-confirm-form').reset();
  },

  clearErrors() {
    ['wipe-setup-pin-error', 'wipe-change-pin-error', 'wipe-confirm-error'].forEach((id) => {
      const el = document.getElementById(id);
      el.textContent = '';
      el.classList.add('hidden');
    });
  },

  hideAllViews() {
    ['wipe-setup-pin-view', 'wipe-actions-view', 'wipe-change-pin-view', 'wipe-confirm-view'].forEach((id) => {
      document.getElementById(id).classList.add('hidden');
    });
  },

  showSetup() {
    this.hideAllViews();
    document.getElementById('wipe-setup-pin-view').classList.remove('hidden');
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

  openConfirm(action) {
    this.pendingAction = action;
    document.getElementById('wipe-confirm-message').textContent = action === 'citas'
      ? 'Vas a eliminar todas las citas. Esta acción no se puede deshacer.'
      : 'Vas a eliminar todas las citas, clientes y empleados. Esta acción no se puede deshacer.';
    document.getElementById('btn-wipe-confirm-submit').textContent = action === 'citas' ? 'Vaciar citas' : 'Vaciar todo';
    this.hideAllViews();
    document.getElementById('wipe-confirm-view').classList.remove('hidden');
    document.getElementById('wipe-confirm-pin').focus();
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

  async handleChangePin(e) {
    e.preventDefault();
    const current = document.getElementById('wipe-change-pin-current').value;
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
      const { data, error } = await supabaseClient.from('app_settings').select('wipe_pin_hash').eq('id', true).maybeSingle();
      if (error) throw error;
      const currentHash = await this.sha256Hex(current);
      if (!data || data.wipe_pin_hash !== currentHash) {
        errorEl.textContent = 'El PIN actual no es correcto';
        errorEl.classList.remove('hidden');
        return;
      }

      const newHash = await this.sha256Hex(next);
      const { error: saveError } = await supabaseClient.from('app_settings').update({ wipe_pin_hash: newHash }).eq('id', true);
      if (saveError) throw saveError;

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

  async handleConfirmWipe(e) {
    e.preventDefault();
    const pin = document.getElementById('wipe-confirm-pin').value;
    const errorEl = document.getElementById('wipe-confirm-error');
    errorEl.classList.add('hidden');

    const submitBtn = document.getElementById('btn-wipe-confirm-submit');
    submitBtn.disabled = true;
    try {
      const { data, error } = await supabaseClient.from('app_settings').select('wipe_pin_hash').eq('id', true).maybeSingle();
      if (error) throw error;
      const enteredHash = await this.sha256Hex(pin);
      if (!data || data.wipe_pin_hash !== enteredHash) {
        errorEl.textContent = 'El PIN no es correcto';
        errorEl.classList.remove('hidden');
        return;
      }

      if (this.pendingAction === 'citas') {
        await this.wipeAppointmentsOnly();
        showToast('Todas las citas se han eliminado', 'success');
      } else {
        await this.wipeEverything();
        showToast('Citas, clientes y empleados se han eliminado', 'success');
      }

      document.getElementById('wipe-confirm-form').reset();
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

  async wipeAppointmentsOnly() {
    await this.deleteAllRows('citas', 'id');
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
