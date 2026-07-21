/* Punto de entrada: conecta el calendario, la agenda, los clientes, los empleados y las estadísticas */
document.addEventListener('DOMContentLoaded', () => {
  Appointments.init();
  Calendar.init((dateStr) => Appointments.renderList(dateStr));
  Appointments.renderList(Calendar.selectedDate);
  Clients.init();
  Employees.init();
  Schedule.init();
  Statistics.init();

  document.getElementById('btn-today').addEventListener('click', () => {
    Calendar.goToToday();
    Appointments.renderList(Calendar.selectedDate);
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
});
