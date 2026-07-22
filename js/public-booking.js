/* Página pública de autorreserva de citas (se abre al escanear el código QR
   de la pantalla principal). No requiere iniciar sesión: solo puede crear
   citas nuevas, nunca leer ni modificar citas o clientes ya existentes, para
   no exponer datos personales a través de un enlace público.

   La cita no se crea al enviar el formulario: primero se manda un código de
   6 dígitos al correo del cliente (Edge Function "send-booking-otp") y solo
   si lo confirma en un plazo de OTP_TTL_SECONDS se llega a crear la cita
   (RPC "verify_appointment_otp", ver supabase/booking-otp.sql). Si se agota
   el tiempo, la solicitud queda invalidada y no se crea nada. */

const CONFLICT_WINDOW_MINUTES = 20;
const SLOT_INTERVAL_MINUTES = 15;
const OTP_TTL_SECONDS = 45;

document.addEventListener('DOMContentLoaded', async () => {
  const loading = document.getElementById('booking-loading');
  const page = document.getElementById('booking-page');
  const errorPage = document.getElementById('booking-error');

  try {
    await Promise.all([EmployeeStore._load(), ScheduleStore._load()]);
  } catch (e) {
    console.error('No se pudieron cargar los datos para la reserva', e);
    loading.classList.add('hidden');
    errorPage.classList.remove('hidden');
    return;
  }

  loading.classList.add('hidden');
  page.classList.remove('hidden');
  PublicBooking.init();
});

const PublicBooking = {
  occupied: [],
  otpRequestId: null,
  otpPayload: null,
  otpTimerInterval: null,
  otpDeadline: null,

  init() {
    this.populatePhoneCodeSelect();
    this.populateEmployeeSelect();

    document.getElementById('pb-date').min = toISODate(new Date());
    document.getElementById('public-appt-form').addEventListener('submit', (e) => this.handleSubmit(e));
    document.getElementById('pb-new-booking').addEventListener('click', () => this.resetForm());

    document.getElementById('pb-employee').addEventListener('change', () => this.refreshTimeSlots());
    document.getElementById('pb-date').addEventListener('change', async () => {
      await this.loadOccupiedSlots(document.getElementById('pb-date').value);
      this.refreshTimeSlots();
    });

    document.getElementById('pb-otp-form').addEventListener('submit', (e) => this.handleVerifyOtp(e));
    document.getElementById('pb-otp-resend').addEventListener('click', () => this.handleResendOtp());
    document.getElementById('pb-otp-back').addEventListener('click', () => this.resetForm());
  },

  populatePhoneCodeSelect() {
    const select = document.getElementById('pb-phone-code');
    const sorted = [...COUNTRY_CODES].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    select.innerHTML = sorted
      .map(c => `<option value="${c.dial}" data-iso="${c.iso}">${isoToFlagEmoji(c.iso)} +${c.dial} ${escapeHtml(c.name)}</option>`)
      .join('');
    select.value = '34';
  },

  populateEmployeeSelect() {
    const select = document.getElementById('pb-employee');
    const hint = document.getElementById('pb-employee-hint');
    const employees = EmployeeStore.getAll().sort((a, b) => a.name.localeCompare(b.name, 'es'));

    if (employees.length === 0) {
      select.innerHTML = '<option value="">No hay profesionales disponibles</option>';
      select.disabled = true;
      hint.textContent = 'En este momento no hay profesionales dados de alta. Contacta con el salón por teléfono.';
      hint.classList.remove('hidden');
    } else {
      select.disabled = false;
      select.innerHTML = '<option value="">Selecciona un profesional</option>' +
        employees.map(e => `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('');
      hint.classList.add('hidden');
    }
  },

  async loadOccupiedSlots(dateStr) {
    if (!dateStr) { this.occupied = []; return; }
    const { data, error } = await supabaseClient.rpc('public_occupied_slots', { p_date: dateStr });
    if (error) {
      console.error('No se pudieron comprobar los huecos disponibles', error);
      this.occupied = [];
      return;
    }
    this.occupied = data || [];
  },

  refreshTimeSlots() {
    const dateStr = document.getElementById('pb-date').value;
    const employeeId = document.getElementById('pb-employee').value;
    const select = document.getElementById('pb-time');
    const warningEl = document.getElementById('pb-warning');
    const previous = select.value;

    const schedule = dateStr ? ScheduleStore.getForDate(dateStr) : null;
    const ranges = schedule && !schedule.closed ? ScheduleStore.getRanges(schedule) : [];

    if (!dateStr || !schedule || schedule.closed || ranges.length === 0) {
      select.innerHTML = '<option value="">-- Sin horas disponibles --</option>';
      select.value = '';
      warningEl.classList.add('hidden');
      return;
    }

    const now = new Date();
    const isToday = dateStr === toISODate(now);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const occupiedForEmployee = employeeId
      ? this.occupied.filter(o => o.employee_id === employeeId).map(o => timeToMinutes(o.time))
      : [];

    const slots = [];
    ranges.forEach(range => {
      for (let t = timeToMinutes(range.open); t < timeToMinutes(range.close); t += SLOT_INTERVAL_MINUTES) {
        if (isToday && t < nowMinutes) continue;
        if (occupiedForEmployee.some(o => Math.abs(o - t) < CONFLICT_WINDOW_MINUTES)) continue;
        slots.push(minutesToTime(t));
      }
    });

    if (slots.length === 0) {
      select.innerHTML = '<option value="">-- Sin horas disponibles ese día --</option>';
      select.value = '';
      warningEl.textContent = employeeId
        ? 'Ese profesional no tiene huecos libres ese día. Elige otra fecha u otro profesional.'
        : '';
      warningEl.classList.toggle('hidden', !employeeId);
      return;
    }

    select.innerHTML = '<option value="">Selecciona una hora</option>' +
      slots.map(s => `<option value="${s}">${s}</option>`).join('');
    select.value = slots.includes(previous) ? previous : '';
    warningEl.classList.add('hidden');
  },

  async handleSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('pb-name').value.trim();
    const dialCode = document.getElementById('pb-phone-code').value;
    const phoneLocalRaw = document.getElementById('pb-phone').value.trim();
    const email = document.getElementById('pb-email').value.trim();
    const employeeId = document.getElementById('pb-employee').value;
    const date = document.getElementById('pb-date').value;
    const time = document.getElementById('pb-time').value;
    const notes = document.getElementById('pb-notes').value.trim();

    if (!name || !phoneLocalRaw || !email || !employeeId || !date || !time) {
      showPbToast('Completa todos los campos obligatorios', 'error');
      return;
    }

    const phoneDigits = phoneLocalRaw.replace(/\D/g, '');
    if (!phoneDigits) {
      showPbToast('Introduce un teléfono válido', 'error');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      showPbToast('Introduce un correo electrónico válido', 'error');
      return;
    }

    const submitBtn = document.getElementById('pb-submit');
    submitBtn.disabled = true;

    try {
      // Vuelve a comprobar el hueco justo antes de pedir el código, por si
      // alguien lo ha ocupado mientras se rellenaba el formulario.
      await this.loadOccupiedSlots(date);
      const t = timeToMinutes(time);
      const stillFree = !this.occupied.some(o => o.employee_id === employeeId && Math.abs(timeToMinutes(o.time) - t) < CONFLICT_WINDOW_MINUTES);
      if (!stillFree) {
        this.refreshTimeSlots();
        showPbToast('Ese hueco se acaba de ocupar. Elige otra hora.', 'error');
        return;
      }

      const fullPhone = `+${dialCode}${phoneDigits}`;
      const payload = {
        name, phone: fullPhone, dial_code: dialCode, phone_local: phoneLocalRaw, email,
        employee_id: employeeId, date, time, notes,
      };

      const { data, error } = await supabaseClient.functions.invoke('send-booking-otp', { body: { payload } });
      if (error) throw error;
      if (!data || !data.ok) {
        showPbToast(otpErrorMessage(data && data.error), 'error');
        return;
      }

      this.otpPayload = payload;
      this.showOtpStep(data.requestId, data.expiresInSeconds || OTP_TTL_SECONDS);
    } catch (err) {
      console.error('Error solicitando el código de confirmación', err);
      showPbToast('No se pudo enviar el código de confirmación. Comprueba tu conexión e inténtalo de nuevo.', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  },

  showOtpStep(requestId, seconds) {
    this.otpRequestId = requestId;
    document.getElementById('pb-otp-email-hint').textContent = `Te hemos enviado un código a ${this.otpPayload.email}.`;
    document.getElementById('pb-otp-code').value = '';
    document.getElementById('pb-otp-warning').classList.add('hidden');
    document.getElementById('pb-otp-form').classList.remove('hidden');
    document.getElementById('pb-otp-expired').classList.add('hidden');
    document.getElementById('booking-page').classList.add('hidden');
    document.getElementById('booking-otp').classList.remove('hidden');
    this.startOtpCountdown(seconds);
    document.getElementById('pb-otp-code').focus();
  },

  startOtpCountdown(seconds) {
    clearInterval(this.otpTimerInterval);
    this.otpDeadline = Date.now() + seconds * 1000;
    const totalMs = seconds * 1000;
    const timerEl = document.getElementById('pb-otp-timer');
    const fillEl = document.getElementById('pb-otp-timer-fill');

    const tick = () => {
      const remainingMs = Math.max(0, this.otpDeadline - Date.now());
      timerEl.textContent = `0:${String(Math.ceil(remainingMs / 1000)).padStart(2, '0')}`;
      fillEl.style.width = `${(remainingMs / totalMs) * 100}%`;
      const isLow = remainingMs <= 10000;
      timerEl.classList.toggle('pb-otp-timer-low', isLow);
      fillEl.classList.toggle('pb-otp-timer-fill-low', isLow);
      if (remainingMs <= 0) {
        clearInterval(this.otpTimerInterval);
        this.handleOtpTimeout();
      }
    };
    tick();
    this.otpTimerInterval = setInterval(tick, 250);
  },

  handleOtpTimeout() {
    this.otpRequestId = null;
    document.getElementById('pb-otp-form').classList.add('hidden');
    document.getElementById('pb-otp-expired').classList.remove('hidden');
  },

  async handleVerifyOtp(e) {
    e.preventDefault();
    const code = document.getElementById('pb-otp-code').value.trim();
    const warningEl = document.getElementById('pb-otp-warning');

    if (!/^\d{6}$/.test(code)) {
      warningEl.textContent = 'Introduce los 6 dígitos del código.';
      warningEl.classList.remove('hidden');
      return;
    }
    if (!this.otpRequestId) return;

    const submitBtn = document.getElementById('pb-otp-submit');
    submitBtn.disabled = true;

    try {
      const { data, error } = await supabaseClient.rpc('verify_appointment_otp', {
        p_request_id: this.otpRequestId,
        p_code: code,
      });
      if (error) throw error;

      if (!data || !data.ok) {
        if (data && data.error === 'expired') {
          this.handleOtpTimeout();
          return;
        }
        warningEl.textContent = otpErrorMessage(data && data.error, data && data.attempts_left);
        warningEl.classList.remove('hidden');
        return;
      }

      clearInterval(this.otpTimerInterval);
      document.getElementById('booking-otp').classList.add('hidden');
      this.showSuccess({
        name: this.otpPayload.name,
        date: this.otpPayload.date,
        time: this.otpPayload.time,
        notes: this.otpPayload.notes,
        employeeId: this.otpPayload.employee_id,
      });
    } catch (err) {
      console.error('Error verificando el código', err);
      warningEl.textContent = 'No se pudo comprobar el código. Inténtalo de nuevo.';
      warningEl.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
    }
  },

  async handleResendOtp() {
    if (!this.otpPayload) { this.resetForm(); return; }
    const resendBtn = document.getElementById('pb-otp-resend');
    resendBtn.disabled = true;

    try {
      const { data, error } = await supabaseClient.functions.invoke('send-booking-otp', { body: { payload: this.otpPayload } });
      if (error) throw error;
      if (!data || !data.ok) {
        showPbToast(otpErrorMessage(data && data.error), 'error');
        return;
      }
      this.showOtpStep(data.requestId, data.expiresInSeconds || OTP_TTL_SECONDS);
    } catch (err) {
      console.error('Error reenviando el código', err);
      showPbToast('No se pudo reenviar el código. Inténtalo de nuevo.', 'error');
    } finally {
      resendBtn.disabled = false;
    }
  },

  showSuccess({ name, date, time, notes, employeeId }) {
    const employee = EmployeeStore.getAll().find(e => e.id === employeeId);
    document.getElementById('pb-summary').innerHTML = `
      <div class="public-booking-summary-row"><strong>Nombre:</strong> ${escapeHtml(name)}</div>
      <div class="public-booking-summary-row"><strong>Fecha:</strong> ${escapeHtml(formatDate(date))}</div>
      <div class="public-booking-summary-row"><strong>Hora:</strong> ${escapeHtml(time)}</div>
      ${employee ? `<div class="public-booking-summary-row"><strong>Profesional:</strong> ${escapeHtml(employee.name)}</div>` : ''}
      ${notes ? `<div class="public-booking-summary-row"><strong>Servicio:</strong> ${escapeHtml(notes)}</div>` : ''}
    `;
    document.getElementById('booking-success').classList.remove('hidden');
  },

  resetForm() {
    clearInterval(this.otpTimerInterval);
    this.otpRequestId = null;
    this.otpPayload = null;

    document.getElementById('public-appt-form').reset();
    document.getElementById('pb-phone-code').value = '34';
    document.getElementById('pb-date').min = toISODate(new Date());
    document.getElementById('pb-time').innerHTML = '<option value="">Selecciona primero una fecha</option>';
    document.getElementById('pb-warning').classList.add('hidden');
    this.occupied = [];

    document.getElementById('booking-otp').classList.add('hidden');
    document.getElementById('booking-success').classList.add('hidden');
    document.getElementById('booking-page').classList.remove('hidden');
  }
};

function otpErrorMessage(code, attemptsLeft) {
  switch (code) {
    case 'invalid_code':
      return attemptsLeft != null ? `Código incorrecto. Te quedan ${attemptsLeft} intentos.` : 'Código incorrecto.';
    case 'too_many_attempts':
      return 'Has agotado los intentos. Pide un código nuevo.';
    case 'expired':
      return 'El código ha caducado.';
    case 'slot_taken':
      return 'Ese hueco se acaba de ocupar. Vuelve a intentarlo con otra hora.';
    case 'not_found':
      return 'No se encontró la solicitud. Pide un código nuevo.';
    case 'rate_limited':
      return 'Has pedido demasiados códigos seguidos. Espera un minuto e inténtalo de nuevo.';
    case 'invalid_email':
      return 'El correo no es válido.';
    case 'email_failed':
      return 'No se pudo enviar el correo con el código. Inténtalo de nuevo en un momento.';
    default:
      return 'No se pudo procesar la solicitud. Inténtalo de nuevo.';
  }
}

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(total) {
  const clamped = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

let pbToastTimeout;
function showPbToast(msg, type = 'success') {
  const toast = document.getElementById('pb-toast');
  toast.textContent = msg;
  toast.className = `toast toast-${type}`;
  clearTimeout(pbToastTimeout);
  requestAnimationFrame(() => toast.classList.add('show'));
  pbToastTimeout = setTimeout(() => toast.classList.remove('show'), 2600);
}
