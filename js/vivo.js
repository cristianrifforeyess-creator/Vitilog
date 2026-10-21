/* ============ VITILOG en vivo ============
   Mantiene abierta una conexión con Supabase Realtime para enterarse de los
   cambios en la base apenas ocurren, sin recargar la página ni preguntar cada
   cierto rato.

   Por qué está escrito a mano y no con la librería de Supabase: el resto del
   sitio no usa ninguna dependencia externa, así funciona abriendo los archivos
   tal cual, sin compilar nada. Realtime habla el protocolo de Phoenix sobre
   WebSocket, que son cuatro mensajes contados:

     · phx_join        -> "quiero escuchar estas tablas"
     · postgres_changes -> "esta fila se insertó, cambió o se borró"
     · heartbeat       -> "sigo acá" (si no se manda, el servidor corta)
     · phx_close/error -> se cayó; hay que reconectar

   Requisito en Supabase: las tablas tienen que estar publicadas. Eso lo deja
   listo sql/esquema.sql con "alter publication supabase_realtime add table".
   Si no lo están, esto no falla: simplemente no llega ningún cambio y el
   sitio sigue andando como antes. */
const Vivo = {
  /* -------- Estado interno -------- */
  _ws: null,
  _ref: 0,                 // contador de mensajes, lo pide el protocolo
  _latido: null,           // temporizador del heartbeat
  _reintento: null,        // temporizador de reconexión
  _intentos: 0,            // para espaciar los reintentos
  _suscriptores: [],       // { tablas: [...], fn }
  _estado: 'apagado',      // apagado | conectando | vivo | caido
  _alCambiarEstado: [],

  /* Tablas que se escuchan. Son las que cambian solas mientras alguien mira
     la pantalla; el catálogo de plantas no hace falta. */
  TABLAS: ['cargas', 'envios', 'mensajes', 'cuentas'],

  /* Cada cuánto se avisa al servidor que seguimos conectados. */
  LATIDO_MS: 25000,

  /* -------- Lo que usan las páginas -------- */

  /* ¿Se puede trabajar en vivo? Solo si hay base compartida configurada:
     sin ella cada dispositivo tiene sus propios datos y no hay nada que
     sincronizar. */
  disponible() {
    return typeof Nube !== 'undefined' && Nube.activa()
      && typeof WebSocket !== 'undefined';
  },

  estado() { return this._estado; },

  /* Avisa cuando una de las tablas indicadas cambia.

     Devuelve una función para darse de baja; conviene llamarla al salir de
     la página para no dejar escuchas colgando.

       const baja = Vivo.escuchar(['cargas'], () => render());
       window.addEventListener('pagehide', baja); */
  escuchar(tablas, fn) {
    const sub = { tablas: [].concat(tablas), fn };
    this._suscriptores.push(sub);
    this.conectar();
    return () => {
      this._suscriptores = this._suscriptores.filter(s => s !== sub);
      if (this._suscriptores.length === 0) this.cerrar();
    };
  },

  /* Avisa cuando cambia el estado de la conexión, para poder mostrarlo. */
  alCambiarEstado(fn) {
    this._alCambiarEstado.push(fn);
    return () => {
      this._alCambiarEstado = this._alCambiarEstado.filter(f => f !== fn);
    };
  },

  /* -------- Conexión -------- */
  conectar() {
    if (!this.disponible()) return;
    if (this._ws && (this._ws.readyState === WebSocket.OPEN
      || this._ws.readyState === WebSocket.CONNECTING)) return;

    this._marcar('conectando');
    try {
      this._ws = new WebSocket(this._url());
    } catch (e) {
      // URL mal formada o WebSocket bloqueado: se reintenta más tarde.
      this._marcar('caido');
      this._programarReintento();
      return;
    }

    this._ws.onopen = () => {
      this._intentos = 0;
      this._unirse();
      this._empezarLatido();
    };
    this._ws.onmessage = ev => this._alMensaje(ev);
    this._ws.onerror = () => { /* el cierre viene enseguida y ahí se maneja */ };
    this._ws.onclose = () => {
      this._pararLatido();
      // Solo se reconecta si alguien sigue escuchando.
      if (this._suscriptores.length) {
        this._marcar('caido');
        this._programarReintento();
      } else {
        this._marcar('apagado');
      }
    };
  },

  cerrar() {
    this._pararLatido();
    clearTimeout(this._reintento);
    this._reintento = null;
    if (this._ws) {
      // Se quita onclose para que no intente reconectar al cerrar a propósito.
      this._ws.onclose = null;
      try { this._ws.close(); } catch (e) { /* ya estaba cerrado */ }
      this._ws = null;
    }
    this._marcar('apagado');
  },

  /* Dirección del WebSocket de Realtime, derivada de la URL del proyecto. */
  _url() {
    const base = Nube.url().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
    const ws = base.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
    return `${ws}/realtime/v1/websocket?apikey=${encodeURIComponent(Nube.clave())}&vsn=1.0.0`;
  },

  _siguienteRef() { return String(++this._ref); },

  _enviar(topic, event, payload) {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return false;
    try {
      this._ws.send(JSON.stringify({ topic, event, payload, ref: this._siguienteRef() }));
      return true;
    } catch (e) {
      return false;
    }
  },

  /* Pide al servidor que mande los cambios de todas las tablas que importan. */
  _unirse() {
    const cambios = this.TABLAS.map(tabla => ({
      event: '*', schema: 'public', table: tabla,
    }));
    this._enviar('realtime:vitilog', 'phx_join', {
      config: {
        broadcast: { self: false },
        presence: { key: '' },
        postgres_changes: cambios,
      },
    });
  },

  _empezarLatido() {
    this._pararLatido();
    this._latido = setInterval(() => {
      this._enviar('phoenix', 'heartbeat', {});
    }, this.LATIDO_MS);
  },

  _pararLatido() {
    if (this._latido) { clearInterval(this._latido); this._latido = null; }
  },

  /* Espera cada vez más entre reintentos, hasta medio minuto. Evita machacar
     al servidor cuando la conexión se cayó de verdad. */
  _programarReintento() {
    clearTimeout(this._reintento);
    const espera = Math.min(30000, 1000 * Math.pow(2, this._intentos++));
    this._reintento = setTimeout(() => this.conectar(), espera);
  },

  _marcar(estado) {
    if (this._estado === estado) return;
    this._estado = estado;
    this._alCambiarEstado.forEach(fn => {
      try { fn(estado); } catch (e) { /* un oyente roto no corta el resto */ }
    });
  },

  /* -------- Mensajes que llegan -------- */
  _alMensaje(ev) {
    let msg;
    try { msg = JSON.parse(ev.data); }
    catch (e) { return; }                    // mensaje ilegible: se ignora

    // Confirmación de que quedamos escuchando.
    if (msg.event === 'phx_reply' && msg.payload && msg.payload.status === 'ok'
      && msg.topic === 'realtime:vitilog') {
      this._marcar('vivo');
      return;
    }

    if (msg.event !== 'postgres_changes') return;

    const datos = msg.payload && msg.payload.data;
    if (!datos || !datos.table) return;

    const tabla = datos.table;
    const tipo = (datos.type || '').toUpperCase();   // INSERT | UPDATE | DELETE
    const fila = tipo === 'DELETE' ? datos.old_record : datos.record;
    if (!fila) return;

    // Se actualiza la copia en memoria y recién ahí se avisa a las pantallas,
    // para que al redibujar ya tengan el dato nuevo.
    try {
      if (typeof Store !== 'undefined' && Store.aplicarCambioRemoto) {
        Store.aplicarCambioRemoto(tabla, tipo, fila);
      }
    } catch (e) {
      /* Si el dato viene raro, se avisa igual: la pantalla puede recargar. */
    }

    this._avisar(tabla, tipo, fila);
  },

  _avisar(tabla, tipo, fila) {
    this._suscriptores.forEach(s => {
      if (!s.tablas.includes(tabla)) return;
      try { s.fn({ tabla, tipo, fila }); }
      catch (e) { /* una pantalla rota no debe cortar a las demás */ }
    });
  },
};
