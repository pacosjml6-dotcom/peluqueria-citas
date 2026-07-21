/* Punto de entrada: conecta el calendario, la agenda y los clientes */
document.addEventListener('DOMContentLoaded', () => {
  Appointments.init();
  Calendar.init((dateStr) => Appointments.renderList(dateStr));
  Appointments.renderList(Calendar.selectedDate);
  Clients.init();

  document.getElementById('btn-today').addEventListener('click', () => {
    Calendar.goToToday();
    Appointments.renderList(Calendar.selectedDate);
  });

  const tabAgenda = document.getElementById('tab-agenda');
  const tabClients = document.getElementById('tab-clients');
  const viewAgenda = document.getElementById('view-agenda');
  const viewClients = document.getElementById('view-clients');
  const btnNewAppt = document.getElementById('btn-new-appt');
  const btnNewClient = document.getElementById('btn-new-client');

  function showAgenda() {
    tabAgenda.classList.add('active');
    tabClients.classList.remove('active');
    viewAgenda.classList.remove('hidden');
    viewClients.classList.add('hidden');
    btnNewAppt.classList.remove('hidden');
    btnNewClient.classList.add('hidden');
  }

  function showClients() {
    tabClients.classList.add('active');
    tabAgenda.classList.remove('active');
    viewClients.classList.remove('hidden');
    viewAgenda.classList.add('hidden');
    btnNewClient.classList.remove('hidden');
    btnNewAppt.classList.add('hidden');
  }

  tabAgenda.addEventListener('click', showAgenda);
  tabClients.addEventListener('click', showClients);
});
