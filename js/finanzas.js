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

  /* Tarifa completa de un viaje, con estiba incluida.

     Si la vina es socia y pone su propia gente para cargar, entra en la
     tarifa coordinada: un precio cerrado y mas bajo, porque el viaje se
     programa con anticipacion y el camion no espera a nadie. */
  tarifa({ km = 0, volumen = 0, vinatero = null } = {}) {
    if (vinatero && this.activa(vinatero)) {
      const coordinada = this.BASE + km * 300;
      return this._redondear(Math.min(
        Math.max(coordinada, this.FLETE_COORDINADO_MIN), this.FLETE_COORDINADO_MAX));
    }
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
  PLANES: {
    /* La planta paga por la consola industrial: es la que opera con esto
       todos los dias y la que obtiene el residuo barato. */
    empresa: [
      { id: 'empresa_temporada', label: 'Temporada de poda',
        precio: 250000, mensual: 250000, dias: 30,
        desc: 'Por mes, sin compromiso' },
      { id: 'empresa_anual', label: 'Plan anual',
        precio: 1800000, mensual: 150000, dias: 365,
        desc: '$150.000 al mes · se paga el año' },
    ],
    /* El vinatero paga poco y solo durante la poda: fuera de temporada
       no tiene cargas que publicar, y cobrarle todo el ano seria
       cobrarle por nada. */
    vinatero: [
      { id: 'vina_mensual', label: 'Mensual',
        precio: 25000, mensual: 25000, dias: 30,
        desc: 'Por mes, durante la poda' },
      { id: 'vina_temporada', label: 'Temporada completa',
        precio: 60000, mensual: 15000, dias: 120,
        desc: 'Cuatro meses · $15.000 al mes' },
    ],
    /* El transportista NO PAGA NADA. Nunca.

       Es deliberado y es lo que sostiene el modelo: si se le cobra al
       que pone el camion, se van los camiones, y sin camiones no hay
       nada que cobrarle a nadie. La oferta en terreno es el cuello de
       botella, no la demanda. */
    chofer: [],
  },

  /* Que puede contratar este perfil. Lista vacia = exento. */
  planesDe(cuenta) {
    const u = cuenta || Store.currentUser();
    if (!u) return [];
    const rol = Store.rolDe(u);
    if (rol === Store.ROL_EMPRESA) return this.PLANES.empresa;
    if (rol === Store.ROL_VINATERO) return this.PLANES.vinatero;
    return [];                        // transportista y cargador: exentos
  },

  /* ¿A este perfil se le cobra algo alguna vez? */
  pagaMembresia(cuenta) { return this.planesDe(cuenta).length > 0; },

  /* Lo que incluye cada membresia, para decirlo antes de cobrar. */
  beneficios(rol) {
    if (rol === Store.ROL_EMPRESA) {
      return ['Consola de acopio en tiempo real',
              'Alertas de acumulación crítica regional',
              'Reportes de Sello Verde y trazabilidad ODS 9 y 12'];
    }
    if (rol === Store.ROL_VINATERO) {
      return ['Publica cargas sin límite',
              'Tarifa de flete coordinado desde ' + this.pesos(this.FLETE_COORDINADO_MIN),
              'Seguimiento GPS del camión en vivo'];
    }
    return [];
  },

  /* Cuantas cargas puede tener publicadas una vina sin membresia. */
  CARGAS_LIBRES: 2,

  /* Flete coordinado para socios que ponen su propia cuadrilla. */
  FLETE_COORDINADO_MIN: 70000,
  FLETE_COORDINADO_MAX: 90000,

  plan(cuenta) {
    const u = cuenta || Store.currentUser();
    if (!u || !u.plan || u.plan === 'ninguno') return null;
    const todos = [].concat(this.PLANES.empresa, this.PLANES.vinatero);
    return todos.find(p => p.id === u.plan) || null;
  },

  /* ¿Tiene la suscripcion al día?

     Una cancelada sigue valiendo hasta su fecha: ya esta pagada, y
     cortarla antes seria quedarse con el dinero. Una pendiente no vale
     todavia: no se ha aprobado ni cobrado. */
  activa(cuenta) {
    const u = cuenta || Store.currentUser();
    if (!u || !this.plan(u)) return false;
    if (u.plan_estado !== 'activa' && u.plan_estado !== 'cancelada') return false;
    if (!u.plan_hasta) return false;
    return new Date(u.plan_hasta).getTime() > Date.now();
  },

  pendiente(cuenta) {
    const u = cuenta || Store.currentUser();
    return !!u && u.plan_estado === 'pendiente';
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

  /* Bloque de membresia reutilizable: estado, beneficios y planes. Se
     dibuja igual para la planta y para la vina; lo que cambia son los
     precios y lo que incluye, que ya sabe cada perfil. */
  membresiaHtml(cuenta) {
    const u = cuenta || Store.currentUser();
    const planes = this.planesDe(u);
    if (!planes.length) return '';          // perfiles exentos

    const rol = Store.rolDe(u);
    const activa = this.activa(u);
    const actual = this.plan(u);

    /* Pedida pero todavía sin respuesta. Importa decir que no se ha
       cobrado nada: nadie debe creer que ya pagó. */
    if (this.pendiente(u)) {
      const p = this.plan(u);
      return `
        <div class="card pad" style="border-left:4px solid var(--warning)">
          <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <div>
              <b>${Shell.escape(p ? p.label : 'Membresía')}</b>
              <div class="li-sub">Esperando aprobación de la administración</div>
            </div>
            ${Shell.badge('Pendiente', '#F9A825', '⏳')}
          </div>
          <div class="li-sub" style="margin-top:10px">
            Todavía no se te ha cobrado nada. Cuando la aprueben, empieza a
            correr tu período y se registra el cargo.
          </div>
          <button class="btn ghost block" style="margin-top:12px" data-cancelar-plan>
            Retirar solicitud
          </button>
        </div>`;
    }

    if (activa) {
      const cancelada = u.plan_estado === 'cancelada';
      return `
        <div class="card pad" style="border-left:4px solid ${cancelada ? 'var(--text-secondary)' : 'var(--primary)'}">
          <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <div>
              <b>${Shell.escape(actual.label)}</b>
              <div class="li-sub">
                ${cancelada
                  ? `No se renovará · te quedan ${this.diasRestantes(u)} día(s)`
                  : `Quedan ${this.diasRestantes(u)} día(s)`}
              </div>
            </div>
            ${cancelada
              ? Shell.badge('Cancelada', '#5F6B60', '⏹')
              : Shell.badge('Activa', '#2E7D32', '✅')}
          </div>
          <div style="margin-top:12px;display:grid;gap:5px">
            ${this.beneficios(rol).map(b => `<div class="li-sub">✔ ${Shell.escape(b)}</div>`).join('')}
          </div>
          ${cancelada ? '' : `
            <button class="btn ghost block" style="margin-top:14px" data-cancelar-plan>
              Cancelar renovación
            </button>`}
        </div>`;
    }

    return `
      <div class="card pad" style="border:1.5px dashed var(--warning)">
        <b>${rol === Store.ROL_EMPRESA ? 'Consola industrial bloqueada' : 'Activa tu temporada'}</b>
        <div style="margin-top:10px;display:grid;gap:5px">
          ${this.beneficios(rol).map(b => `<div class="li-sub">✔ ${Shell.escape(b)}</div>`).join('')}
        </div>
        <div class="grid cols-2" style="margin-top:14px">
          ${planes.map(p => `
            <button class="btn" data-plan="${p.id}"
                    style="flex-direction:column;align-items:flex-start;padding:14px;gap:2px">
              <b>${p.label}</b>
              <span style="font-size:19px;font-weight:800">${this.pesos(p.mensual)}<span style="font-size:12px;font-weight:600">/mes</span></span>
              <span style="font-size:11.5px;opacity:.85">${p.desc}</span>
            </button>`).join('')}
        </div>
        <div class="li-sub" style="margin-top:10px;opacity:.8">
          La administración revisa la solicitud antes de activarla.
          Simulación: no se cobra dinero real.
        </div>
      </div>`;
  },

  /* Engancha los botones del bloque de membresía. Lo llaman las páginas
     después de dibujarlo. */
  conectarMembresia(caja, alCambiar) {
    if (!caja) return;
    const refrescar = alCambiar || (() => location.reload());

    caja.querySelectorAll('[data-plan]').forEach(b => {
      b.onclick = async () => {
        b.disabled = true;
        const error = await Store.solicitarPlan(b.dataset.plan);
        if (error) { b.disabled = false; return Shell.toast(error); }
        Shell.toast('Solicitud enviada · queda esperando aprobación');
        refrescar();
      };
    });

    const cancelar = caja.querySelector('[data-cancelar-plan]');
    if (cancelar) {
      cancelar.onclick = async () => {
        cancelar.disabled = true;
        const error = await Store.cancelarPlan();
        if (error) { cancelar.disabled = false; return Shell.toast(error); }
        Shell.toast('Membresía cancelada');
        refrescar();
      };
    }
  },

  /* -------- Formato -------- */
  pesos(n) {
    const v = Math.round(Number(n) || 0);
    return '$' + v.toLocaleString('es-CL');
  },
};
