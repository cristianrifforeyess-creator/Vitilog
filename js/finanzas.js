/* ============ Finanzas: tarifa, custodia y reparto ============

   ESTO NO MUEVE DINERO REAL.

   No hay pasarela de pagos conectada: no hay Transbank, ni Stripe, ni
   transferencias. Lo que hay es un libro de movimientos que registra
   quién le debe cuánto a quién y en qué estado está cada pago. Las
   cifras son correctas y el flujo es el que tendría el sistema de
   verdad, pero nadie cobra ni recibe nada.

   Se dice acá y se dice en pantalla. Un módulo financiero que no aclara
   que es una simulación es una trampa esperando a que alguien la pise.

   CÓMO SE REPARTE
   ---------------
   Sobre el monto efectivamente cobrado:

     10 %  plataforma (lo que gana AgroConecta)
      5 %  fondo de reserva para imprevistos en ruta
     65 %  transporte, al transportista
     20 %  estiba, a quien cargó

   Tres situaciones cambian ese cuadro:

     · La viña pone su propia gente -> la estiba no se cobra. Se cobra el
       80 % de la tarifa, y sobre ESE monto el transportista se lleva el
       85 %. El porcentaje de la plataforma no sube a costa de nadie.
     · El transportista lleva su propia tropa -> cobra el 85 %: su
       transporte más la estiba, porque la hizo su equipo.
     · Hay un cargador de la red -> 65 % al transportista y 20 % a él.

   CUSTODIA (ESCROW)
   -----------------
   El dinero se retiene al contratar y se libera cuando la planta valida
   la descarga. Antes de eso nadie puede cobrar y nadie puede desdecirse
   sin dejar rastro: es lo que protege al transportista de entregar y
   quedarse esperando, y a la planta de pagar por algo que no llegó. */
const Finanzas = {
  /* -------- Tarifa de referencia --------
     Lo que cuesta mover sarmientos. Son valores de ejemplo para el
     prototipo; en operación saldrían de un acuerdo comercial. */
  BASE: 18000,          // salida del camión, en pesos
  POR_KM: 950,          // por kilómetro recorrido
  POR_M3: 2200,         // por metro cúbico cargado

  /* Reparto, en fracción del monto cobrado. */
  TASA_APP: 0.10,
  TASA_RESERVA: 0.05,
  TASA_TRANSPORTE: 0.65,
  TASA_ESTIBA: 0.20,

  /* Redondea a un múltiplo de cien: nadie factura pesos sueltos. */
  _redondear(n) { return Math.round((Number(n) || 0) / 100) * 100; },

  /* Tarifa completa de un viaje, con estiba incluida. */
  tarifa({ km = 0, volumen = 0 } = {}) {
    return this._redondear(this.BASE + km * this.POR_KM + volumen * this.POR_M3);
  },

  /* Lo que se cobra de verdad. Si la viña pone su gente, la estiba no
     entra en la cuenta. */
  cobrado(tarifa, conEstiba) {
    return this._redondear(conEstiba ? tarifa : tarifa * (1 - this.TASA_ESTIBA));
  },

  /* -------- El reparto --------
     Devuelve a cuánto queda cada parte. La suma siempre cuadra con el
     total: el ajuste de redondeo se le carga a la plataforma, que es
     quien puede absorberlo. */
  reparto(total, { conEstiba = true, estibaDelChofer = true } = {}) {
    total = Math.round(Number(total) || 0);

    const reserva = this._redondear(total * this.TASA_RESERVA);
    let transporte, estiba;

    if (!conEstiba) {
      // No hubo estiba que pagar: todo el trabajo fue transporte.
      transporte = this._redondear(total * (this.TASA_TRANSPORTE + this.TASA_ESTIBA));
      estiba = 0;
    } else if (estibaDelChofer) {
      // Cargó su propia tropa: le corresponde el total del trabajo.
      transporte = this._redondear(total * (this.TASA_TRANSPORTE + this.TASA_ESTIBA));
      estiba = 0;
    } else {
      transporte = this._redondear(total * this.TASA_TRANSPORTE);
      estiba = this._redondear(total * this.TASA_ESTIBA);
    }

    // La plataforma se queda con lo que sobra, incluido el redondeo.
    const app = total - reserva - transporte - estiba;

    return { total, app, reserva, transporte, estiba,
             chofer: transporte, cuadrilla: estiba };
  },

  /* Explica el reparto en palabras, para mostrarlo sin que parezca magia. */
  explicar(envio) {
    const r = this.repartoDe(envio);
    if (!r) return [];
    const l = [
      { concepto: 'Transporte', quien: envio.chofer || 'Transportista', monto: r.transporte },
    ];
    if (r.estiba > 0) {
      l.push({ concepto: 'Estiba', quien: envio.cuadrillaNombre || 'Cuadrilla', monto: r.estiba });
    }
    l.push({ concepto: 'Fondo de reserva', quien: 'Imprevistos en ruta', monto: r.reserva });
    l.push({ concepto: 'Plataforma', quien: 'AgroConecta', monto: r.app });
    return l;
  },

  /* El reparto que le corresponde a un envío concreto, leyendo sus datos. */
  repartoDe(envio) {
    if (!envio || !envio.tarifa) return null;
    const conEstiba = !!envio.cuadrillaEmail || envio.estibaCobrada === true;
    const propia = !!envio.cuadrillaEmail
      && envio.cuadrillaEmail === envio.choferEmail;
    return this.reparto(
      this.cobrado(envio.tarifa, conEstiba),
      { conEstiba, estibaDelChofer: propia });
  },

  /* -------- Membresía de las plantas --------
     El panel industrial (consola de demanda, acopio en vivo, reportes)
     va detrás de una suscripcion. Las viñas y los transportistas nunca
     ven un cobro: el modelo cobra a quien recibe el residuo. */
  PLANES: [
    { id: 'mensual', label: 'Mensual', precio: 49000, dias: 30,
      desc: 'Se renueva cada mes' },
    { id: 'temporada', label: 'Temporada', precio: 198000, dias: 180,
      desc: 'Seis meses · equivale a 33.000 al mes' },
  ],

  plan(cuenta) {
    const u = cuenta || Store.currentUser();
    if (!u || !u.plan || u.plan === 'ninguno') return null;
    return this.PLANES.find(p => p.id === u.plan) || null;
  },

  /* ¿Tiene la suscripcion al día? */
  activa(cuenta) {
    const u = cuenta || Store.currentUser();
    if (!this.plan(u)) return false;
    if (!u.plan_hasta) return false;
    return new Date(u.plan_hasta).getTime() > Date.now();
  },

  diasRestantes(cuenta) {
    const u = cuenta || Store.currentUser();
    if (!u || !u.plan_hasta) return 0;
    const ms = new Date(u.plan_hasta).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 86400000));
  },

  /* -------- Billetera en pantalla --------
     Un bloque con el saldo y los ultimos movimientos. Lo usan la planta
     (gastos y membresia) y el transportista (ganancias). El vinatero no
     lo ve nunca: el modelo cobra a quien recibe el residuo, y meterle
     una interfaz de pagos a alguien que solo publica sarmientos seria
     ponerle una barrera que no le corresponde. */
  walletHtml(email, { titulo = 'Billetera', positivo = true } = {}) {
    const saldo = Store.saldo(email);
    const movs = Store.movimientosDe(email).slice(0, 8);
    const color = saldo < 0 ? 'var(--danger)'
      : (positivo ? 'var(--primary)' : 'var(--text-primary)');

    return `
      <div class="card pad">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap">
          <div>
            <div class="dato-rotulo">${titulo}</div>
            <div class="dato-grande" style="color:${color};font-size:30px;margin-top:2px">
              ${this.pesos(saldo)}
            </div>
          </div>
          <span class="li-sub">Simulación · no mueve dinero real</span>
        </div>

        ${movs.length === 0
          ? `<div class="li-sub" style="margin-top:14px">Todavía no hay movimientos.</div>`
          : `<div style="margin-top:16px;display:grid;gap:10px">
              ${movs.map(m => `
                <div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline">
                  <div style="min-width:0">
                    <div style="font-size:14px">${Shell.escape(m.concepto)}</div>
                    <div class="li-sub">${new Date(m.creado).toLocaleDateString('es-CL',
                      { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                  </div>
                  <b style="white-space:nowrap;color:${m.monto < 0 ? 'var(--danger)' : 'var(--primary)'}">
                    ${m.monto < 0 ? '' : '+'}${this.pesos(m.monto)}
                  </b>
                </div>`).join('')}
            </div>`}
      </div>`;
  },

  /* -------- Formato -------- */
  pesos(n) {
    const v = Math.round(Number(n) || 0);
    return '$' + v.toLocaleString('es-CL');
  },
};
