/* Punto de entrada: comprueba la sesión, gestiona el login/logout y, una vez
   autenticado, conecta el calendario, la agenda, los clientes, los empleados
   y las estadísticas */
document.addEventListener('DOMContentLoaded', async () => {
  const loadingOverlay = document.getElementById('app-loading-overlay');
  const loadingText = document.getElementById('app-loading-text');
  const loginOverlay = document.getElementById('login-overlay');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');

  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') window.location.reload();
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

    submitBtn.disabled = false;
    if (error) {
      loginError.textContent = 'Correo o contraseña incorrectos.';
      loginError.classList.remove('hidden');
      return;
    }

    loginOverlay.classList.add('hidden');
    await bootApp();
  });

  document.getElementById('btn-logout').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
  });

  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    loadingOverlay.classList.add('hidden');
    loginOverlay.classList.remove('hidden');
    document.getElementById('login-email').focus();
    return;
  }

  await bootApp();

  async function bootApp() {
    loadingText.textContent = 'Cargando datos…';
    loadingOverlay.classList.remove('hidden');

    try {
      await DataStore.migrateLocalStorageIfNeeded();
      await DataStore.loadAll();
    } catch (e) {
      console.error('Error cargando datos de Supabase', e);
      loadingText.textContent = 'No se pudieron cargar los datos. Comprueba tu conexión a internet y recarga la página.';
      return;
    }

    loadingOverlay.classList.add('hidden');

    Appointments.init();
    DayDetail.init();
    PendingPayments.init();
    Calendar.init((dateStr) => {
      Appointments.renderList(dateStr);
      DayDetail.open(dateStr);
    });
    Appointments.renderList(Calendar.selectedDate);
    PendingPayments.updateBadge();
    Clients.init();
    Employees.init();
    Schedule.init();
    Company.init();
    Backup.init();
    DataWipe.init();
    Statistics.init();

    DataStore.subscribeRealtime();

    window.addEventListener('citas:changed', () => {
      Calendar.render();
      Appointments.renderList(Calendar.selectedDate);
      PendingPayments.updateBadge();
      if (PendingPayments.isOpen()) PendingPayments.render();
      if (!document.getElementById('view-statistics').classList.contains('hidden')) Statistics.renderAll();
    });
    window.addEventListener('clientes:changed', () => {
      Appointments.populateClientsDatalist();
      if (!document.getElementById('view-clients').classList.contains('hidden')) Clients.renderList();
    });
    window.addEventListener('empleados:changed', () => {
      Appointments.populateEmployeeSelect();
      if (!document.getElementById('view-employees').classList.contains('hidden')) Employees.renderList();
    });
    window.addEventListener('horario:changed', () => {
      Schedule.renderSummary();
    });
    window.addEventListener('empresa:changed', () => {
      Company.renderHeader();
    });

    document.getElementById('btn-today').addEventListener('click', () => {
      Calendar.goToToday();
      Appointments.renderList(Calendar.selectedDate);
    });

    document.getElementById('btn-show-qr').addEventListener('click', () => {
      const url = new URL('qr.html', window.location.href).href;
      window.open(url, 'qr-reserva', 'width=480,height=680');
    });

    const tabs = [
      { tab: 'tab-agenda', view: 'view-agenda', newBtn: 'btn-new-appt' },
      { tab: 'tab-clients', view: 'view-clients', newBtn: 'btn-new-client' },
      { tab: 'tab-employees', view: 'view-employees', newBtn: 'btn-new-employee' },
      { tab: 'tab-statistics', view: 'view-statistics' },
    ];

    function showTab(activeTab) {
      tabs.forEach(({ tab, view, newBtn }) => {
        const isActive = tab === activeTab;
        document.getElementById(tab).classList.toggle('active', isActive);
        document.getElementById(view).classList.toggle('hidden', !isActive);
        if (newBtn) document.getElementById(newBtn).classList.toggle('hidden', !isActive);
      });
      if (activeTab === 'tab-clients') Clients.renderList();
      if (activeTab === 'tab-employees') Employees.renderList();
      if (activeTab === 'tab-statistics') Statistics.renderAll();
    }

    tabs.forEach(({ tab }) => {
      document.getElementById(tab).addEventListener('click', () => showTab(tab));
    });
  }
});
