/* ============ Avisos: lo que de verdad está pasando ============

   Las tarjetas de "Alertas recientes" y la campana de la barra superior.

   DE DÓNDE SALEN
   --------------
   De los datos del propio usuario, siempre. Antes eran tres frases fijas
   en data.js —"BioEnergía Maule busca cargas en tu zona", "ahorro
   estimado del 30%"— iguales para todos y verdaderas para nadie. Una
   notificación inventada es peor que ninguna: enseña a no mirar la
   campana, y el día que avise algo real tampoco se va a mirar.

   CÓMO SE ORDENAN
   ---------------
   Primero lo que exige hacer algo ahora —un camión esperando en la
   portería, una descarga sin pesar—, después lo que conviene saber, y al
   final lo que es solo información. Por eso cada aviso lleva una
   urgencia y la lista se ordena por ella: no por fecha, que es lo
   cómodo pero deja lo urgente debajo de lo reciente.

   Cada aviso que se puede resolver lleva a dónde resolverlo. Un aviso
   sin salida obliga a buscar la pantalla a mano, y en el teléfono eso es
   media docena de toques. */
const Avisos = {
  /* Urgencias, de mayor a menor. El número solo sirve para ordenar. */
  ACTUAR: 3,      // hay alguien esperando
  CONVIENE: 2,    // se puede perder una oportunidad
  INFO: 1,

  /* -------- Utilidades -------- */
  _horasDesde(iso) {
    if (!iso) return null;
    const ms = Date.now() - new Date(iso).getTime();
    return isNaN(ms) ? null : ms / 3600000;
  },

  _diasDesde(iso) {
    const h = this._horasDesde(iso);
    return h == null ? null : Math.floor(h / 24);
  },

  _hora(iso) {
    return iso ? new Date(iso).toLocaleTimeString('es-CL',
      { hour: '2-digit', minute: '2-digit' }) : '';
  },

  /* =====================================================================
     Los avisos de cada perfil
     ===================================================================== */
  lista() {
    const rol = Store.rolActual();
    if (!rol) return [];
    let avisos = [];
    if (rol === Store.ROL_VINATERO) avisos = this._vinatero();
    else if (rol === Store.ROL_EMPRESA) avisos = this._empresa();
    else if (rol === Store.ROL_CHOFER) avisos = this._chofer();
    else if (rol === Store.ROL_ADMIN) avisos = this._admin();

    avisos = avisos.concat(this._comunes());
    return avisos.sort((a, b) => (b.urgencia || 1) - (a.urgencia || 1));
  },

  /* -------- Viñatero -------- */
  _vinatero() {
    const yo = Store.currentEmail();
    const out = [];
    const envios = Store.misEnvios();

    envios.forEach(e => {
      if (e.vinateroEmail !== yo) return;

      /* El camión está en el portón esperando que le abran. Es el aviso
         más urgente que puede dar esta aplicación: hay una persona y un
         camión detenidos, costando plata, por una tranca con candado. */
      const enPorteria = this._horasDesde(e.porteriaAt);
      if (e.estado !== 'entregado' && enPorteria != null && enPorteria < 4) {
        out.push({
          ic: '🏁', color: 'var(--warning)', urgencia: this.ACTUAR,
          titulo: 'El camión está en tu portería',
          detalle: `${e.chofer || 'El transportista'} avisó a las ${this._hora(e.porteriaAt)}`
            + (e.patente ? ` · ${e.patente}` : ''),
          ir: 'seguimiento.html?id=' + encodeURIComponent(e.id),
        });
        return;
      }

      if (e.estado === 'en_camino' || e.estado === 'llegando') {
        const seg = (typeof Shell !== 'undefined') ? Shell.calcularSeguimiento(e) : null;
        out.push({
          ic: '🚚', color: 'var(--in-progress)', urgencia: this.CONVIENE,
          titulo: 'Tu carga va en camino',
          detalle: `${e.origenComuna} → ${e.destinoNombre}`
            + (seg && seg.kmRestantes != null ? ` · faltan ${seg.kmRestantes} km` : ''),
          ir: 'seguimiento.html?id=' + encodeURIComponent(e.id),
        });
      }

      // Entrega cerrada hace poco: el comprobante está esperando.
      const dias = this._diasDesde(e.validadoAt);
      if (e.estado === 'entregado' && dias != null && dias <= 7) {
        const m3 = e.volumenRecibido != null ? e.volumenRecibido : e.volumenDeclarado;
        out.push({
          ic: '🌿', color: 'var(--leaf)', urgencia: this.INFO,
          titulo: 'Tu Sello Verde está listo',
          detalle: `${m3} m³ recibidos en ${e.destinoNombre}. Descarga el comprobante.`,
          ir: 'historial.html',
        });
      }
    });

    /* Publicada y sin que nadie la tome. A los tres días deja de ser
       normal y vale la pena decirlo, con el motivo más probable. */
    const comprometidas = new Set();
    Store.envios().forEach(e => {
      if (e.cargaId) comprometidas.add(e.cargaId);
      (e.paradas || []).forEach(p => comprometidas.add(p.cargaId));
    });
    Store.misCargas()
      .filter(c => !comprometidas.has(c.id) && c.estado !== 'retirada')
      .forEach(c => {
        const dias = this._diasDesde(c.creada);
        if (dias == null || dias < 3) return;
        out.push({
          ic: '⏳', color: 'var(--warning)', urgencia: this.CONVIENE,
          titulo: `Nadie ha tomado tus ${c.volumen} m³ de ${c.comuna}`,
          detalle: c.consolidado === false
            ? `Publicada hace ${dias} días. Está marcada como no consolidada: `
              + 'eso espanta a los transportistas.'
            : `Publicada hace ${dias} días.`,
          ir: 'rutas.html',
        });
      });

    return out;
  },

  /* -------- Planta receptora -------- */
  _empresa() {
    const yo = Store.currentEmail();
    const out = [];

    Store.misEnvios().forEach(e => {
      if (e.empresaEmail !== yo) return;

      /* Llegó y espera la romana. Mientras no se valide, el transportista
         sigue amarrado a este retiro y no puede tomar otro. */
      if (e.estado === 'en_destino') {
        out.push({
          ic: '⚖️', color: 'var(--warning)', urgencia: this.ACTUAR,
          titulo: 'Hay un camión esperando el pesaje',
          detalle: `${e.origenComuna} → ${e.destinoNombre} · ${e.volumenDeclarado} m³ declarados`,
          ir: 'seguimiento.html?id=' + encodeURIComponent(e.id),
        });
      }

      // Encargado a un transportista que todavía no contesta.
      const horas = this._horasDesde(e.creado);
      if (e.estado === 'asignado' && horas != null && horas > 2) {
        out.push({
          ic: '📨', color: 'var(--warning)', urgencia: this.CONVIENE,
          titulo: 'Tu transportista no ha respondido',
          detalle: `${e.chofer || 'Sin nombre'} lleva ${Math.floor(horas)} h sin aceptar`
            + ` el retiro de ${e.origenComuna}.`,
          ir: 'cargas.html',
        });
      }

      // Pagado y retenido, en espera de que se valide la descarga.
      if (e.escrowEstado === 'retenido' && e.estado === 'entregado') {
        out.push({
          ic: '🔒', color: 'var(--primary)', urgencia: this.CONVIENE,
          titulo: 'Flete en custodia sin liquidar',
          detalle: `${e.origenComuna} → ${e.destinoNombre}`,
          ir: 'seguimiento.html?id=' + encodeURIComponent(e.id),
        });
      }
    });

    /* Cargas nuevas sin dueño. Se cuentan juntas: seis avisos iguales
       no son seis noticias, son una. */
    const base = (typeof Shell !== 'undefined') ? Shell.ubicacionCuenta() : null;
    const nuevas = Store.cargasDisponibles(base)
      .filter(c => { const h = this._horasDesde(c.creada); return h == null || h <= 72; });
    if (nuevas.length) {
      const m3 = nuevas.reduce((t, c) => t + (Number(c.volumen) || 0), 0);
      const cerca = base ? nuevas.filter(c => c.km != null && c.km <= 60).length : 0;
      out.push({
        ic: '🌾', color: 'var(--leaf)', urgencia: this.CONVIENE,
        titulo: `${nuevas.length} carga(s) esperando retiro`,
        detalle: `${m3} m³ publicados`
          + (cerca ? ` · ${cerca} a menos de 60 km de ${base.comuna}` : ''),
        ir: 'cargas.html',
      });
    }

    return out;
  },

  /* -------- Transportista y cargador -------- */
  _chofer() {
    const out = [];

    Store.serviciosAsignados().forEach(e => {
      out.push({
        ic: '📨', color: 'var(--warning)', urgencia: this.ACTUAR,
        titulo: 'Te encargaron un retiro',
        detalle: `${e.origenComuna} → ${e.destinoNombre} · ${e.volumenDeclarado} m³.`
          + ' Acéptalo o recházalo para que la planta sepa.',
        ir: 'inicio-chofer.html',
      });
    });

    (Store.misEstibas() || []).forEach(e => {
      if (e.estado === 'entregado') return;
      /* Si el viaje además es suyo, la cuadrilla es su propia tropa: no
         es un trabajo que le derivaron, es el que ya está haciendo.
         Avisarle que "asiste a Marco Villalobos" cuando él es Marco
         Villalobos solo confunde. */
      if (e.choferEmail === Store.currentEmail()) return;
      out.push({
        ic: '👥', color: 'var(--info)', urgencia: this.CONVIENE,
        titulo: 'Tienes una estiba asignada',
        detalle: `${e.origenComuna} → ${e.destinoNombre}`
          + (e.chofer ? ` · asistes a ${e.chofer}` : ''),
        ir: 'inicio-chofer.html',
      });
    });

    /* Va a medio llenar y hay cargas que le caben. Es plata que se pierde
       en el mismo viaje, así que vale decirlo. */
    const viaje = Store.servicioActivo();
    if (viaje) {
      const libre = Store.capacidadRestante(viaje);
      const caben = libre > 0 ? Store.cargasQueCaben(viaje).length : 0;
      if (caben) {
        out.push({
          ic: '📦', color: 'var(--leaf)', urgencia: this.CONVIENE,
          titulo: `Te caben ${libre} m³ más`,
          detalle: `Hay ${caben} carga(s) libre(s) que entran en lo que te queda.`,
          ir: 'viaje.html',
        });
      }

      const pendientes = (viaje.paradas || []).filter(p => !p.recogida).length;
      if (pendientes) {
        out.push({
          ic: '📍', color: 'var(--in-progress)', urgencia: this.INFO,
          titulo: `${pendientes} parada(s) por cargar`,
          detalle: 'Márcalas a medida que subas el sarmiento.',
          ir: 'viaje.html',
        });
      }
    }

    return out;
  },

  /* -------- Administración -------- */
  _admin() {
    const out = [];

    const pedidos = Store.solicitudesDePlan ? Store.solicitudesDePlan() : [];
    if (pedidos.length) {
      out.push({
        ic: '💳', color: 'var(--warning)', urgencia: this.ACTUAR,
        titulo: `${pedidos.length} membresía(s) esperando aprobación`,
        detalle: pedidos.map(c => c.nombre).join(', '),
        ir: 'admin.html',
      });
    }

    const sinDerivar = Store.envios().filter(e =>
      e.estado !== 'entregado' && !e.cuadrillaEmail
      && Store.cargas().some(c => c.id === e.cargaId && c.manoObra === 'solicita'));
    if (sinDerivar.length) {
      out.push({
        ic: '👥', color: 'var(--warning)', urgencia: this.ACTUAR,
        titulo: `${sinDerivar.length} retiro(s) piden cuadrilla y no tienen`,
        detalle: 'Derívalos desde la pestaña Estiba.',
        ir: 'admin.html',
      });
    }

    const faltan = Store.columnasQueFaltan();
    if (faltan.length) {
      out.push({
        ic: '🗄️', color: 'var(--danger)', urgencia: this.ACTUAR,
        titulo: 'La base compartida está desactualizada',
        detalle: `Faltan ${faltan.length} columna(s): ${faltan.slice(0, 3).join(', ')}`
          + '. Corre sql/esquema.sql.',
        ir: 'admin.html',
      });
    }

    return out;
  },

  /* -------- Lo que vale para cualquier perfil -------- */
  _comunes() {
    const u = Store.currentUser();
    if (!u) return [];
    const out = [];

    const falta = Store.perfilIncompleto(u);
    if (falta.length) {
      out.push({
        ic: '👤', color: 'var(--warning)', urgencia: this.CONVIENE,
        titulo: 'Te faltan datos en tu perfil',
        detalle: falta.map(f => f.campo).join(', ') + '.',
        ir: 'configuracion.html',
      });
    }

    if (typeof Finanzas !== 'undefined') {
      if (Finanzas.pendiente(u)) {
        out.push({
          ic: '⏳', color: 'var(--primary)', urgencia: this.INFO,
          titulo: 'Tu membresía está en revisión',
          detalle: 'La administración de AgroConecta la está revisando.',
        });
      } else if (Finanzas.activa(u)) {
        const dias = Finanzas.diasRestantes(u);
        if (dias != null && dias <= 7) {
          out.push({
            ic: '💳', color: 'var(--warning)', urgencia: this.CONVIENE,
            titulo: `Tu membresía vence en ${dias} día(s)`,
            detalle: u.plan_estado === 'cancelada'
              ? 'Está cancelada: no se renueva sola.'
              : 'Renuévala para no perder el acceso.',
          });
        }
      }
    }

    return out;
  },

  /* =====================================================================
     Pantalla
     ===================================================================== */
  _tarjeta(a, { comoFila = false } = {}) {
    const ir = a.ir
      ? ` onclick="location.href='${a.ir}'" style="cursor:pointer"`
      : '';
    return `
      <div class="${comoFila ? 'list-item' : 'card list-item'}"${ir}>
        <div class="li-ic" style="background:${Shell.tinte(a.color)};color:${a.color}">${a.ic}</div>
        <div class="li-body">
          <div class="li-title">${Shell.escape(a.titulo)}</div>
          <div class="li-sub">${Shell.escape(a.detalle || '')}</div>
        </div>
        ${a.ir ? '<div class="li-chev">›</div>' : ''}
      </div>`;
  },

  /* Las tarjetas del inicio. Si no hay nada que avisar se dice, en vez de
     rellenar con algo: "todo al día" es una respuesta. */
  html({ max = 4 } = {}) {
    const avisos = this.lista();
    if (!avisos.length) {
      return `
        <div class="card pad" style="display:flex;align-items:center;gap:12px">
          <div class="li-ic" style="background:${Shell.tinte('var(--leaf)')};color:var(--leaf)">✅</div>
          <div class="li-body">
            <div class="li-title">Todo al día</div>
            <div class="li-sub">No hay nada esperando por ti.</div>
          </div>
        </div>`;
    }
    return avisos.slice(0, max).map(a => this._tarjeta(a)).join('');
  },

  /* Cuántos piden hacer algo ahora. Es lo que va en la campana: un número
     que cuenta avisos informativos deja de significar nada. */
  pendientes() {
    return this.lista().filter(a => a.urgencia === this.ACTUAR).length;
  },

  modal() {
    const avisos = this.lista();
    Shell.openModal(`
      <div class="handle"></div>
      <b style="font-size:18px">Avisos</b>
      <div class="li-sub" style="margin-top:4px">
        ${avisos.length ? 'Sobre tus cargas, tus retiros y tu cuenta'
                        : 'No hay nada pendiente ahora mismo'}
      </div>
      <div style="margin-top:12px">
        ${avisos.length
          ? avisos.map(a => this._tarjeta(a, { comoFila: true })).join(
              '<div style="height:1px;background:var(--border)"></div>')
          : `<div class="empty"><div class="ic">✅</div><p>Todo al día.</p></div>`}
      </div>
      <button class="btn ghost block" style="margin-top:12px"
              onclick="Shell.closeModal()">Cerrar</button>`);
  },

  /* Engancha la campana de la barra superior y le pone el contador. */
  montarCampana(boton) {
    const b = (typeof boton === 'string') ? document.getElementById(boton) : boton;
    if (!b) return;
    b.onclick = () => this.modal();
    const n = this.pendientes();
    b.textContent = n ? '🔔' : '🔕';
    b.title = n ? `${n} aviso(s) que necesitan tu atención` : 'Sin avisos pendientes';
    b.setAttribute('aria-label', b.title);
  },
};
