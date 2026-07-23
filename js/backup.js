/* Copia de seguridad completa (citas, clientes, empleados, horario y datos
   de empresa) exportada como un único archivo JSON descargado al PC, y
   restauración a partir de ese mismo archivo. */

const BACKUP_APP_ID = 'GesCi';
const BACKUP_TABLES = ['empresa', 'horario', 'empleados', 'clientes', 'citas'];

const Backup = {
  pendingRestore: null,

  init() {
    document.getElementById('btn-backup').addEventListener('click', () => this.openModal());
    document.getElementById('btn-close-backup-modal').addEventListener('click', () => this.closeModal());
    document.getElementById('backup-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'backup-modal-overlay') this.closeModal();
    });

    document.getElementById('btn-backup-export').addEventListener('click', () => this.exportBackup());

    document.getElementById('btn-backup-restore').addEventListener('click', () => {
      document.getElementById('backup-restore-input').click();
    });
    document.getElementById('backup-restore-input').addEventListener('change', (e) => this.handleFileSelected(e));

    document.getElementById('btn-backup-restore-cancel').addEventListener('click', () => this.closeRestoreConfirm());
    document.getElementById('btn-backup-restore-confirm').addEventListener('click', () => this.confirmRestore());
    document.getElementById('backup-restore-confirm-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'backup-restore-confirm-overlay') this.closeRestoreConfirm();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!document.getElementById('backup-restore-confirm-overlay').classList.contains('hidden')) {
        this.closeRestoreConfirm();
      } else if (!document.getElementById('backup-modal-overlay').classList.contains('hidden')) {
        this.closeModal();
      }
    });
  },

  openModal() {
    document.getElementById('backup-modal-overlay').classList.remove('hidden');
  },

  closeModal() {
    document.getElementById('backup-modal-overlay').classList.add('hidden');
  },

  closeRestoreConfirm() {
    this.pendingRestore = null;
    document.getElementById('backup-restore-confirm-overlay').classList.add('hidden');
  },

  buildFileName() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    return `${BACKUP_APP_ID}_${stamp}.json`;
  },

  /* Lee directamente las filas tal cual están en la base de datos (sin pasar
     por los Store, que las convierten a camelCase), para poder restaurarlas
     más tarde con sus identificadores y relaciones intactos. */
  async collectData() {
    const tables = {};
    for (const table of BACKUP_TABLES) {
      const { data, error } = await supabaseClient.from(table).select('*');
      if (error) throw error;
      tables[table] = data;
    }
    return {
      app: BACKUP_APP_ID,
      version: 1,
      exportedAt: new Date().toISOString(),
      tables,
    };
  },

  async exportBackup() {
    const btn = document.getElementById('btn-backup-export');
    btn.disabled = true;
    try {
      const backup = await this.collectData();
      const json = JSON.stringify(backup, null, 2);
      await this.saveFile(json, this.buildFileName());
      showToast('Copia de seguridad creada correctamente', 'success');
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      console.error('Error creando la copia de seguridad', err);
      showToast('No se pudo crear la copia de seguridad. Inténtalo de nuevo.', 'error');
    } finally {
      btn.disabled = false;
    }
  },

  /* Usa el selector nativo de "Guardar como" cuando el navegador lo soporta
     (Chrome/Edge), para poder elegir carpeta y nombre; si no, recurre a la
     descarga clásica del navegador. */
  async saveFile(content, fileName) {
    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: 'Copia de seguridad de GesCi', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return;
    }

    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  async handleFileSelected(e) {
    const input = e.target;
    const file = input.files[0];
    input.value = '';
    if (!file) return;

    let backup;
    try {
      const text = await file.text();
      backup = JSON.parse(text);
    } catch (err) {
      showToast('El archivo seleccionado no es una copia de seguridad válida', 'error');
      return;
    }

    if (!backup || backup.app !== BACKUP_APP_ID || !backup.tables) {
      showToast('El archivo seleccionado no es una copia de seguridad válida', 'error');
      return;
    }

    this.pendingRestore = backup;
    const exportedAt = backup.exportedAt ? new Date(backup.exportedAt).toLocaleString('es-ES') : 'fecha desconocida';
    document.getElementById('backup-restore-confirm-message').textContent =
      `Vas a restaurar la copia de seguridad del ${exportedAt}. Se sustituirán todas las citas, clientes, empleados, horario y datos de empresa actuales por los del archivo. Esta acción no se puede deshacer.`;
    document.getElementById('backup-restore-confirm-overlay').classList.remove('hidden');
  },

  async confirmRestore() {
    const backup = this.pendingRestore;
    if (!backup) return;

    const btn = document.getElementById('btn-backup-restore-confirm');
    btn.disabled = true;
    try {
      await this.restoreBackup(backup);
      document.getElementById('backup-restore-confirm-overlay').classList.add('hidden');
      document.getElementById('backup-modal-overlay').classList.add('hidden');
      showToast('Copia de seguridad restaurada correctamente. Recargando…', 'success');
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      console.error('Error restaurando la copia de seguridad', err);
      showToast('No se pudo restaurar la copia de seguridad. Inténtalo de nuevo.', 'error');
      btn.disabled = false;
    }
  },

  async deleteAllRows(table, idColumn) {
    const { error } = await supabaseClient.from(table).delete().not(idColumn, 'is', null);
    if (error) throw error;
  },

  async insertRows(table, rows) {
    if (!rows || rows.length === 0) return;
    const { error } = await supabaseClient.from(table).insert(rows);
    if (error) throw error;
  },

  async replaceRows(table, rows, idColumn) {
    await this.deleteAllRows(table, idColumn);
    await this.insertRows(table, rows);
  },

  /* Restaura tabla a tabla respetando las relaciones: primero se vacían las
     citas (dependen de empleados/clientes), luego se restauran las tablas
     "padre" y por último las citas, para que sus employee_id/client_id
     siempre encuentren la fila correspondiente ya insertada. */
  async restoreBackup(backup) {
    const { tables } = backup;
    await this.deleteAllRows('citas', 'id');
    await this.replaceRows('empresa', tables.empresa, 'id');
    await this.replaceRows('horario', tables.horario, 'day_index');
    await this.replaceRows('empleados', tables.empleados, 'id');
    await this.replaceRows('clientes', tables.clientes, 'id');
    await this.insertRows('citas', tables.citas);
  },
};
