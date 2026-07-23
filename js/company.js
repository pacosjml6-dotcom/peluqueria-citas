/* Datos de la empresa (nombre, teléfono, dirección): configurables desde el
   botón "Datos de empresa" y mostrados en la cabecera de la app. */
const Company = {
  init() {
    this.renderHeader();

    document.getElementById('btn-company-settings').addEventListener('click', () => this.openForm());
    document.getElementById('btn-close-company-modal').addEventListener('click', () => this.closeForm());
    document.getElementById('btn-cancel-company-form').addEventListener('click', () => this.closeForm());
    document.getElementById('company-form').addEventListener('submit', (e) => this.handleSubmit(e));

    document.getElementById('company-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'company-modal-overlay') this.closeForm();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !document.getElementById('company-modal-overlay').classList.contains('hidden')) {
        this.closeForm();
      }
    });
  },

  fillForm() {
    const company = CompanyStore.get();
    document.getElementById('company-name').value = company.name;
    document.getElementById('company-phone').value = company.phone;
    document.getElementById('company-address').value = company.address;
  },

  openForm() {
    this.fillForm();
    document.getElementById('company-modal-overlay').classList.remove('hidden');
    document.getElementById('company-name').focus();
  },

  closeForm() {
    document.getElementById('company-modal-overlay').classList.add('hidden');
  },

  async handleSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('company-name').value.trim();
    const phone = document.getElementById('company-phone').value.trim();
    const address = document.getElementById('company-address').value.trim();

    const submitBtn = e.submitter || e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      await CompanyStore.save({ name, phone, address });
      this.renderHeader();
      this.closeForm();
      showToast('Datos de empresa actualizados correctamente', 'success');
    } catch (err) {
      console.error('Error guardando los datos de empresa', err);
      showToast('No se pudieron guardar los datos de empresa. Inténtalo de nuevo.', 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  },

  renderHeader() {
    const company = CompanyStore.get();
    const el = document.getElementById('brand-company-info');
    const parts = [company.name, company.phone].filter(Boolean);
    if (parts.length === 0) {
      el.textContent = '';
      el.classList.add('hidden');
      return;
    }
    el.textContent = parts.join(' · ');
    el.classList.remove('hidden');
  }
};
