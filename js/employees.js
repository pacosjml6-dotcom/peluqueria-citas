/* CRUD de empleados: modal de formulario, foto circular, confirmación de borrado,
   listado y conteo de citas asignadas por empleado en un rango de fechas elegible */
const Employees = {
  pendingDeleteId: null,
  currentPhotoDataUrl: null,
  currentPreset: 'month',
  rangeStart: null,
  rangeEnd: null,

  init() {
    document.getElementById('btn-new-employee').addEventListener('click', () => this.openForm());
    document.getElementById('btn-close-employee-modal').addEventListener('click', () => this.closeForm());
    document.getElementById('btn-cancel-employee-form').addEventListener('click', () => this.closeForm());
    document.getElementById('employee-form').addEventListener('submit', (e) => this.handleSubmit(e));
    document.getElementById('btn-delete-employee').addEventListener('click', () => {
      this.askDelete(document.getElementById('employee-id').value);
    });
    document.getElementById('employee-photo-input').addEventListener('change', (e) => this.handlePhotoChange(e));
    document.getElementById('btn-remove-employee-photo').addEventListener('click', () => this.clearPhoto());

    document.getElementById('btn-employee-confirm-cancel').addEventListener('click', () => this.closeConfirm());
    document.getElementById('btn-employee-confirm-delete').addEventListener('click', () => this.confirmDelete());

    document.getElementById('employee-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'employee-modal-overlay') this.closeForm();
    });
    document.getElementById('employee-confirm-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'employee-confirm-overlay') this.closeConfirm();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!document.getElementById('employee-confirm-overlay').classList.contains('hidden')) this.closeConfirm();
      else if (!document.getElementById('employee-modal-overlay').classList.contains('hidden')) this.closeForm();
    });

    this.populateFilterPresets();
    document.getElementById('employees-range-start').addEventListener('change', () => this.handleCustomRangeChange());
    document.getElementById('employees-range-end').addEventListener('change', () => this.handleCustomRangeChange());

    this.setPreset(this.currentPreset);
  },

  populateFilterPresets() {
    const container = document.getElementById('employees-filter-presets');
    container.innerHTML = STATS_PRESETS
      .map(p => `<button type="button" class="filter-preset-btn" data-preset="${p.id}">${p.label}</button>`)
      .join('');
    container.querySelectorAll('.filter-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => this.setPreset(btn.dataset.preset));
    });
  },

  setPreset(id) {
    this.currentPreset = id;
    const computed = computeRangeForPreset(id);
    if (computed) {
      this.rangeStart = computed.start;
      this.rangeEnd = computed.end;
    }
    this.syncPresetButtons();
    this.renderList();
  },

  syncPresetButtons() {
    document.querySelectorAll('#employees-filter-presets .filter-preset-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === this.currentPreset);
    });
  },

  handleCustomRangeChange() {
    const start = document.getElementById('employees-range-start').value;
    const end = document.getElementById('employees-range-end').value;
    if (!start || !end || start > end) {
      showToast('Selecciona un rango de fechas válido', 'error');
      return;
    }
    this.rangeStart = start;
    this.rangeEnd = end;
    this.currentPreset = 'custom';
    this.syncPresetButtons();
    this.renderList();
  },

  getEffectiveRange() {
    if (this.currentPreset !== 'all') {
      return { start: this.rangeStart, end: this.rangeEnd };
    }
    const all = Store.getAll();
    if (all.length === 0) {
      const today = toISODate(new Date());
      return { start: today, end: today };
    }
    const dates = all.map(a => a.date).sort();
    return { start: dates[0], end: dates[dates.length - 1] };
  },

  openForm(employee = null) {
    const form = document.getElementById('employee-form');
    form.reset();
    document.getElementById('employee-id').value = '';
    document.getElementById('btn-delete-employee').classList.add('hidden');
    document.getElementById('employee-modal-title').textContent = 'Nuevo empleado';
    document.getElementById('employee-appointments-section').classList.add('hidden');
    this.setPhotoPreview(null);

    if (employee) {
      document.getElementById('employee-modal-title').textContent = 'Editar empleado';
      document.getElementById('employee-id').value = employee.id;
      document.getElementById('employee-name').value = employee.name;
      this.setPhotoPreview(employee.photo || null);
      document.getElementById('btn-delete-employee').classList.remove('hidden');
      document.getElementById('employee-appointments-section').classList.remove('hidden');
    }

    document.getElementById('employee-modal-overlay').classList.remove('hidden');
    document.getElementById('employee-name').focus();
  },

  closeForm() {
    document.getElementById('employee-modal-overlay').classList.add('hidden');
  },

  handlePhotoChange(e) {
    const input = e.target;
    const file = input.files && input.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Selecciona un archivo de imagen válido', 'error');
      input.value = '';
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      showToast('La imagen es demasiado grande (máx. 3 MB)', 'error');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => this.setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  },

  clearPhoto() {
    this.setPhotoPreview(null);
    document.getElementById('employee-photo-input').value = '';
  },

  setPhotoPreview(dataUrl) {
    this.currentPhotoDataUrl = dataUrl;
    const img = document.getElementById('employee-photo-preview');
    const placeholder = document.getElementById('employee-photo-placeholder');
    const removeBtn = document.getElementById('btn-remove-employee-photo');

    if (dataUrl) {
      img.src = dataUrl;
      img.classList.remove('hidden');
      placeholder.classList.add('hidden');
      removeBtn.classList.remove('hidden');
    } else {
      img.src = '';
      img.classList.add('hidden');
      placeholder.classList.remove('hidden');
      removeBtn.classList.add('hidden');
    }
  },

  async handleSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('employee-id').value;
    const name = document.getElementById('employee-name').value.trim();

    if (!name) {
      showToast('Introduce el nombre del empleado', 'error');
      return;
    }

    const data = { name, photo: this.currentPhotoDataUrl || null };
    const submitBtn = e.submitter || e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      if (id) {
        await EmployeeStore.update(id, data);
        showToast('Empleado actualizado correctamente', 'success');
      } else {
        await EmployeeStore.create(data);
        showToast('Empleado añadido correctamente', 'success');
      }

      this.closeForm();
      this.renderList();
    } catch (err) {
      console.error('Error guardando el empleado', err);
      showToast('No se pudo guardar el empleado. Comprueba tu conexión e inténtalo de nuevo.', 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  },

  askDelete(id) {
    this.pendingDeleteId = id;
    const employee = EmployeeStore.getAll().find(e => e.id === id);
    document.getElementById('employee-confirm-message').textContent = employee
      ? `Se eliminará a ${employee.name} de la lista de empleados.`
      : '¿Seguro que quieres eliminar este empleado?';
    document.getElementById('employee-confirm-overlay').classList.remove('hidden');
  },

  closeConfirm() {
    document.getElementById('employee-confirm-overlay').classList.add('hidden');
    this.pendingDeleteId = null;
  },

  async confirmDelete() {
    if (!this.pendingDeleteId) return;
    try {
      await EmployeeStore.remove(this.pendingDeleteId);
      this.closeConfirm();
      this.closeForm();
      showToast('Empleado eliminado', 'success');
      this.renderList();
    } catch (err) {
      console.error('Error eliminando el empleado', err);
      showToast('No se pudo eliminar el empleado. Inténtalo de nuevo.', 'error');
    }
  },

  renderList() {
    const list = document.getElementById('employees-list');
    const employees = EmployeeStore.getAll().sort((a, b) => a.name.localeCompare(b.name, 'es'));

    const range = this.getEffectiveRange();
    document.getElementById('employees-range-start').value = range.start;
    document.getElementById('employees-range-end').value = range.end;
    document.getElementById('employees-range-summary').textContent =
      `Citas asignadas del ${formatStatsDate(range.start)} al ${formatStatsDate(range.end)}.`;

    const apptsInRange = Store.getAll().filter(a => a.date >= range.start && a.date <= range.end);
    const countByEmployee = new Map();
    apptsInRange.forEach(a => {
      if (!a.employeeId) return;
      countByEmployee.set(a.employeeId, (countByEmployee.get(a.employeeId) || 0) + 1);
    });

    if (employees.length === 0) {
      list.innerHTML = '<div class="empty-state"><p>No hay empleados dados de alta todavía.</p></div>';
      return;
    }

    list.innerHTML = '';
    employees.forEach(employee => {
      const avatarInner = employee.photo
        ? `<img src="${employee.photo}" alt="" class="employee-avatar-img">`
        : escapeHtml(getInitials(employee.name));

      const count = countByEmployee.get(employee.id) || 0;
      const noun = count === 1 ? 'cita asignada' : 'citas asignadas';

      const item = document.createElement('div');
      item.className = 'client-item employee-item';
      item.innerHTML = `
        <div class="client-avatar employee-avatar">${avatarInner}</div>
        <div class="client-info">
          <div class="client-name">${escapeHtml(employee.name)}</div>
          <div class="client-detail">${count} ${noun}</div>
        </div>
        <div class="client-actions">
          <button class="btn-icon btn-edit" aria-label="Editar empleado" title="Editar">&#9998;</button>
          <button class="btn-icon btn-delete" aria-label="Eliminar empleado" title="Eliminar">&#128465;</button>
        </div>
      `;
      item.querySelector('.btn-edit').addEventListener('click', () => this.openForm(employee));
      item.querySelector('.btn-delete').addEventListener('click', () => this.askDelete(employee.id));
      list.appendChild(item);
    });
  }
};
