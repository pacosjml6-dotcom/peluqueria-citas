/* CRUD de clientes: modal de formulario, confirmación de borrado y listado */
const Clients = {
  pendingDeleteId: null,

  init() {
    this.populateCountrySelect();

    document.getElementById('btn-new-client').addEventListener('click', () => this.openForm());
    document.getElementById('btn-close-client-modal').addEventListener('click', () => this.closeForm());
    document.getElementById('btn-cancel-client-form').addEventListener('click', () => this.closeForm());
    document.getElementById('client-form').addEventListener('submit', (e) => this.handleSubmit(e));
    document.getElementById('btn-delete-client').addEventListener('click', () => {
      this.askDelete(document.getElementById('client-id').value);
    });
    document.getElementById('btn-client-confirm-cancel').addEventListener('click', () => this.closeConfirm());
    document.getElementById('btn-client-confirm-delete').addEventListener('click', () => this.confirmDelete());

    document.getElementById('client-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'client-modal-overlay') this.closeForm();
    });
    document.getElementById('client-confirm-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'client-confirm-overlay') this.closeConfirm();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!document.getElementById('client-confirm-overlay').classList.contains('hidden')) this.closeConfirm();
      else if (!document.getElementById('client-modal-overlay').classList.contains('hidden')) this.closeForm();
    });

    this.renderList();
  },

  populateCountrySelect() {
    const select = document.getElementById('client-phone-code');
    const sorted = [...COUNTRY_CODES].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    select.innerHTML = sorted
      .map(c => `<option value="${c.dial}" data-iso="${c.iso}">${isoToFlagEmoji(c.iso)} +${c.dial} ${escapeHtml(c.name)}</option>`)
      .join('');
    select.value = '34';
  },

  openForm(client = null) {
    const form = document.getElementById('client-form');
    form.reset();
    document.getElementById('client-id').value = '';
    document.getElementById('btn-delete-client').classList.add('hidden');
    document.getElementById('client-modal-title').textContent = 'Nuevo cliente';
    document.getElementById('client-phone-code').value = '34';

    if (client) {
      document.getElementById('client-modal-title').textContent = 'Editar cliente';
      document.getElementById('client-id').value = client.id;
      document.getElementById('client-name').value = client.name;
      document.getElementById('client-phone-code').value = client.dialCode;
      document.getElementById('client-phone').value = client.phoneLocal;
      document.getElementById('client-email').value = client.email;
      document.getElementById('btn-delete-client').classList.remove('hidden');
    }

    document.getElementById('client-modal-overlay').classList.remove('hidden');
    document.getElementById('client-name').focus();
  },

  closeForm() {
    document.getElementById('client-modal-overlay').classList.add('hidden');
  },

  async handleSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('client-id').value;
    const name = document.getElementById('client-name').value.trim();
    const dialCode = document.getElementById('client-phone-code').value;
    const phoneLocalRaw = document.getElementById('client-phone').value.trim();
    const email = document.getElementById('client-email').value.trim();

    if (!name || !phoneLocalRaw || !email) {
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

    const fullPhone = `+${dialCode}${phoneDigits}`;
    const excludeId = id || null;

    if (ClientStore.findByPhone(fullPhone, excludeId)) {
      showToast('Este teléfono ya está dado de alta', 'error');
      return;
    }

    if (ClientStore.findByEmail(email, excludeId)) {
      showToast('Este correo ya está dado de alta', 'error');
      return;
    }

    const data = { name, dialCode, phoneLocal: phoneLocalRaw, fullPhone, email };
    const submitBtn = e.submitter || e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      if (id) {
        await ClientStore.update(id, data);
        await Store.updateByClientId(id, {
          name,
          dialCode,
          phoneLocal: phoneLocalRaw,
          phone: fullPhone,
          email,
        });
        Calendar.render();
        Appointments.renderList(Calendar.selectedDate);
        showToast('Cliente actualizado correctamente', 'success');
      } else {
        await ClientStore.create(data);
        showToast('Cliente añadido correctamente', 'success');
      }

      this.closeForm();
      this.renderList();
    } catch (err) {
      console.error('Error guardando el cliente', err);
      showToast('No se pudo guardar el cliente. Comprueba tu conexión e inténtalo de nuevo.', 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  },

  askDelete(id) {
    this.pendingDeleteId = id;
    const client = ClientStore.getAll().find(c => c.id === id);
    document.getElementById('client-confirm-message').textContent = client
      ? `Se eliminará a ${client.name} de la lista de clientes.`
      : '¿Seguro que quieres eliminar este cliente?';
    document.getElementById('client-confirm-overlay').classList.remove('hidden');
  },

  closeConfirm() {
    document.getElementById('client-confirm-overlay').classList.add('hidden');
    this.pendingDeleteId = null;
  },

  async confirmDelete() {
    if (!this.pendingDeleteId) return;
    try {
      await ClientStore.remove(this.pendingDeleteId);
      this.closeConfirm();
      this.closeForm();
      showToast('Cliente eliminado', 'success');
      this.renderList();
    } catch (err) {
      console.error('Error eliminando el cliente', err);
      showToast('No se pudo eliminar el cliente. Inténtalo de nuevo.', 'error');
    }
  },

  renderList() {
    const list = document.getElementById('clients-list');
    const clients = ClientStore.getAll().sort((a, b) => a.name.localeCompare(b.name, 'es'));

    if (clients.length === 0) {
      list.innerHTML = '<div class="empty-state"><p>No hay clientes dados de alta todavía.</p></div>';
      return;
    }

    list.innerHTML = '';
    clients.forEach(client => {
      const countryInfo = COUNTRY_CODES.find(c => c.dial === client.dialCode);
      const flag = countryInfo ? isoToFlagEmoji(countryInfo.iso) : '';
      const item = document.createElement('div');
      item.className = 'client-item';
      item.innerHTML = `
        <div class="client-avatar">${escapeHtml(getInitials(client.name))}</div>
        <div class="client-info">
          <div class="client-name">${escapeHtml(client.name)}</div>
          <div class="client-detail">${flag} +${escapeHtml(client.dialCode)} ${escapeHtml(client.phoneLocal)}</div>
          <div class="client-detail">${escapeHtml(client.email)}</div>
        </div>
        <div class="client-actions">
          <button class="btn-icon btn-edit" aria-label="Editar cliente" title="Editar">&#9998;</button>
          <button class="btn-icon btn-delete" aria-label="Eliminar cliente" title="Eliminar">&#128465;</button>
        </div>
      `;
      item.querySelector('.btn-edit').addEventListener('click', () => this.openForm(client));
      item.querySelector('.btn-delete').addEventListener('click', () => this.askDelete(client.id));
      list.appendChild(item);
    });
  }
};

function getInitials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}
