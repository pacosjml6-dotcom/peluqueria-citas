/* Widget de chat con el asistente de IA. Se usa tanto en el panel interno
   (index.html, personal ya autenticado) como en la página pública de
   autorreserva (reservar.html, sin login) — el propio Edge Function
   "chat-assistant" decide, mirando la sesión de Supabase, qué puede
   consultar en cada caso. Este archivo solo se encarga de la interfaz: no
   sabe nada de citas, clientes ni horarios, todo pasa por la función.

   Se activa llamando a ChatAssistant.init() una vez la página esté lista
   (ver js/app.js y js/public-booking.js). */

const ChatAssistant = {
  history: [],
  sending: false,
  storageKey: 'peluqueria_chat_history_v1',
  maxHistoryMessages: 20,

  init() {
    if (document.getElementById('chatbot-root')) return;
    this.injectMarkup();
    this.loadHistory();
    this.renderHistory();
    this.bindEvents();
  },

  injectMarkup() {
    const root = document.createElement('div');
    root.id = 'chatbot-root';
    root.innerHTML = `
      <button id="chatbot-bubble" class="chatbot-bubble" type="button" aria-label="Abrir asistente de chat">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v9c0 1.1-.9 2-2 2H9l-5 4v-4H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
        </svg>
      </button>
      <div id="chatbot-panel" class="chatbot-panel hidden" role="dialog" aria-modal="false" aria-labelledby="chatbot-title">
        <div class="chatbot-header">
          <span id="chatbot-title">Asistente virtual</span>
          <button id="chatbot-close" class="btn-icon" type="button" aria-label="Cerrar chat">&times;</button>
        </div>
        <div id="chatbot-messages" class="chatbot-messages"></div>
        <form id="chatbot-form" class="chatbot-form">
          <input type="text" id="chatbot-input" placeholder="Escribe tu pregunta…" maxlength="500" autocomplete="off" aria-label="Escribe tu pregunta">
          <button type="submit" id="chatbot-send" class="chatbot-send" aria-label="Enviar mensaje">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M3 11l18-8-8 18-2.5-7.5L3 11z"></path></svg>
          </button>
        </form>
      </div>
    `;
    document.body.appendChild(root);
  },

  bindEvents() {
    document.getElementById('chatbot-bubble').addEventListener('click', () => this.togglePanel());
    document.getElementById('chatbot-close').addEventListener('click', () => this.togglePanel(false));
    document.getElementById('chatbot-form').addEventListener('submit', (e) => this.handleSubmit(e));
  },

  togglePanel(force) {
    const panel = document.getElementById('chatbot-panel');
    const willOpen = force !== undefined ? force : panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !willOpen);
    if (willOpen) {
      document.getElementById('chatbot-input').focus();
      this.scrollToBottom();
    }
  },

  loadHistory() {
    try {
      const raw = sessionStorage.getItem(this.storageKey);
      this.history = raw ? JSON.parse(raw) : [];
    } catch {
      this.history = [];
    }
  },

  persistHistory() {
    try {
      sessionStorage.setItem(this.storageKey, JSON.stringify(this.history.slice(-this.maxHistoryMessages)));
    } catch {
      /* almacenamiento no disponible (modo privado, cuota llena…): no es crítico */
    }
  },

  renderHistory() {
    const container = document.getElementById('chatbot-messages');
    container.innerHTML = '';
    if (this.history.length === 0) {
      this.appendBubble('assistant', '¡Hola! Puedo ayudarte con horarios, servicios, disponibilidad, reservar una cita y consultar tus próximas citas. ¿En qué puedo ayudarte?');
      return;
    }
    this.history.forEach((m) => this.appendBubble(m.role, m.content));
  },

  appendBubble(role, text) {
    const container = document.getElementById('chatbot-messages');
    const bubble = document.createElement('div');
    bubble.className = `chatbot-msg chatbot-msg-${role}`;
    bubble.innerHTML = chatEscapeHtml(text).replace(/\n/g, '<br>');
    container.appendChild(bubble);
    this.scrollToBottom();
    return bubble;
  },

  scrollToBottom() {
    const container = document.getElementById('chatbot-messages');
    container.scrollTop = container.scrollHeight;
  },

  async handleSubmit(e) {
    e.preventDefault();
    if (this.sending) return;

    const input = document.getElementById('chatbot-input');
    const text = input.value.trim();
    if (!text) return;

    const previousHistory = this.history.map((m) => ({ role: m.role, content: m.content }));

    this.history.push({ role: 'user', content: text });
    this.history = this.history.slice(-this.maxHistoryMessages);
    this.persistHistory();
    this.appendBubble('user', text);
    input.value = '';

    this.sending = true;
    document.getElementById('chatbot-send').disabled = true;
    const typingBubble = this.appendBubble('assistant', '…');
    typingBubble.classList.add('chatbot-msg-typing');

    try {
      const { data, error } = await supabaseClient.functions.invoke('chat-assistant', {
        body: { message: text, history: previousHistory },
      });

      typingBubble.remove();

      if (error || !data || !data.ok) {
        this.appendBubble('assistant', 'No he podido responder ahora mismo. Inténtalo de nuevo en un momento o contacta directamente con el salón.');
        return;
      }

      this.history.push({ role: 'assistant', content: data.reply });
      this.history = this.history.slice(-this.maxHistoryMessages);
      this.persistHistory();
      this.appendBubble('assistant', data.reply);
    } catch (err) {
      console.error('Error consultando al asistente de chat', err);
      typingBubble.remove();
      this.appendBubble('assistant', 'No he podido responder ahora mismo. Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
      this.sending = false;
      document.getElementById('chatbot-send').disabled = false;
      input.focus();
    }
  },
};

function chatEscapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
