/* ============ Base de datos de VITILOG ============

   Funciona con dos orígenes intercambiables:
     · local -> localStorage. Cada navegador tiene sus propios datos.
     · nube  -> Supabase. Los datos se comparten entre todos los dispositivos.

   Se elige en js/config.js. En ambos casos el resto del sitio usa la misma
   interfaz: los datos se cargan una vez en memoria con sincronizar() y las
   consultas siguen siendo instantáneas.

   Hay tres tipos de cuenta:
     · vinatero -> productor vitivinícola que publica sus sarmientos.
     · empresa  -> biomasa, compostaje o transporte; busca esos residuos.
     · admin    -> administración de VITILOG. No se registra desde el sitio. */
const Store = {
  K_ACCOUNTS: 'vitilog_accounts',
  K_SESSION: 'vitilog_session',
  K_CARGAS: 'vitilog_cargas',
  K_PUNTOS: 'vitilog_puntos',
  K_ENVIOS: 'vitilog_envios',
  K_MENSAJES: 'vitilog_mensajes',
  K_MOVIMIENTOS: 'vitilog_movimientos',
  K_THEME: 'vitilog_theme',

  ROL_VINATERO: 'vinatero',
  ROL_EMPRESA: 'empresa',
  ROL_CHOFER: 'chofer',
  ROL_ADMIN: 'admin',

  /* Datos en memoria. Los llena sincronizar() al abrir cada página. */
  _cache: { cuentas: [], cargas: [], puntos: [], envios: [], mensajes: [], movimientos: [] },
  _listo: false,
  _aviso: null,          // problema de conexión, si lo hubo

  /* -------- Origen de los datos -------- */
  modo() {
    const pedido = (typeof MODO_DATOS !== 'undefined' ? MODO_DATOS : 'auto');
    const hayNube = (typeof Nube !== 'undefined' && Nube.activa());
    if (pedido === 'local') return 'local';
    if (pedido === 'nube') return 'nube';
    return hayNube ? 'nube' : 'local';
  },
  enNube() { return this.modo() === 'nube'; },
  aviso() { return this._aviso; },

  _read(key, def) {
    try { return JSON.parse(localStorage.getItem(key)) ?? def; }
    catch (e) { return def; }
  },
  _write(key, val) { localStorage.setItem(key, JSON.stringify(val)); },

  /* =====================================================================
     Carga inicial
     ===================================================================== */
  async sincronizar({ forzar = false } = {}) {
    if (this._listo && !forzar) return this._aviso;
    this._aviso = null;

    if (this.modo() === 'nube') {
      try {
        const [cuentas, cargas, puntos, envios, mensajes, movimientos] = await Promise.all([
          Nube.listar('cuentas'),
          Nube.listar('cargas'),
          Nube.listar('puntos'),
          Nube.listar('envios'),
          Nube.listar('mensajes'),
          Nube.listar('movimientos').catch(() => []),
        ]);
        this._recordarColumnas('cuentas', cuentas);
        this._recordarColumnas('cargas', cargas);
        this._recordarColumnas('envios', envios);
        this._cache.cuentas = (cuentas || []).map(this._cuentaDesdeNube);
        this._cache.cargas = (cargas || []).map(this._cargaDesdeNube);
        this._cache.puntos = (puntos || []).map(this._puntoDesdeNube);
        this._cache.envios = (envios || []).map(this._envioDesdeNube);
        this._cache.mensajes = (mensajes || []).map(this._mensajeDesdeNube);
        this._cache.movimientos = (movimientos || []).map(this._movimientoDesdeNube);
        this._listo = true;
        return null;
      } catch (e) {
        // Sin conexión se sigue con lo local, para no dejar el sitio inservible.
        this._aviso = (typeof Nube !== 'undefined' ? await Nube.revisar() : null)
          || ('No se pudo leer la base compartida: ' + e.message);
      }
    }

    this._cache.cuentas = this._read(this.K_ACCOUNTS, []);
    this._cache.cargas = this._read(this.K_CARGAS, []);
    this._cache.puntos = this._read(this.K_PUNTOS, []);
    this._cache.envios = this._read(this.K_ENVIOS, []);
    this._cache.mensajes = this._read(this.K_MENSAJES, []);
    this._cache.movimientos = this._read(this.K_MOVIMIENTOS, []);
    await this._sembrarLocal();
    this._listo = true;
    return this._aviso;
  },

  /* =====================================================================
     Cambios que llegan en vivo (los trae js/vivo.js)
     ===================================================================== */
  /* Qué sabe hacer el almacén con cada tabla: dónde guardarla en memoria,
     cómo traducir la fila que manda Postgres y cuál es su llave. */
  _TABLAS_VIVAS: {
    cargas:   { cache: 'cargas',   mapa: '_cargaDesdeNube',   llave: 'id' },
    envios:   { cache: 'envios',   mapa: '_envioDesdeNube',   llave: 'id' },
    mensajes: { cache: 'mensajes', mapa: '_mensajeDesdeNube', llave: 'id' },
    movimientos: { cache: 'movimientos', mapa: '_movimientoDesdeNube', llave: 'id' },
    cuentas:  { cache: 'cuentas',  mapa: '_cuentaDesdeNube',  llave: 'email' },
    puntos:   { cache: 'puntos',   mapa: '_puntoDesdeNube',   llave: 'id' },
  },

  /* Mete en la copia en memoria una fila que cambió en la base, sin volver a
     descargarlo todo. Devuelve true si algo cambió de verdad. */
  aplicarCambioRemoto(tabla, tipo, fila) {
    const def = this._TABLAS_VIVAS[tabla];
    if (!def || !fila) return false;

    const lista = this._cache[def.cache];
    if (!Array.isArray(lista)) return false;

    const traducir = this[def.mapa];
    if (typeof traducir !== 'function') return false;

    const registro = traducir.call(this, fila);
    const llave = def.llave;
    const mismo = x => String(x[llave]) === String(registro[llave]);
    const i = lista.findIndex(mismo);

    if (tipo === 'DELETE') {
      if (i < 0) return false;
      lista.splice(i, 1);
    } else if (i >= 0) {
      lista[i] = registro;
    } else {
      lista.push(registro);
    }
    return true;
  },

  /* En modo local se siembran las plantas de data.js y una cuenta de
     administración, para que el sitio sea usable de entrada. */
  async _sembrarLocal() {
    if (this._cache.puntos.length === 0 && typeof DATA !== 'undefined' && DATA.puntos) {
      this._cache.puntos = DATA.puntos.map(p => ({ ...p }));
      this._write(this.K_PUNTOS, this._cache.puntos);
    }
    if (!this._cache.cuentas.some(c => this.rolDe(c) === this.ROL_ADMIN)) {
      const { hash, sal } = await this._cifrar('admin1234');
      this._cache.cuentas.push({
        rol: this.ROL_ADMIN, nombre: 'Administración AgroConecta',
        email: 'admin@vitilog.cl', clave_hash: hash, clave_sal: sal,
        comuna: 'Talca', telefono: '', activa: true, porDefecto: true,
      });
      this._write(this.K_ACCOUNTS, this._cache.cuentas);
    }
  },

  /* -------- Traducción entre la tabla y el objeto que usa el sitio -------- */
  _cuentaDesdeNube(f) {
    return {
      email: f.email, rol: f.rol, nombre: f.nombre,
      clave_hash: f.clave_hash, clave_sal: f.clave_sal,
      comuna: f.comuna || '', telefono: f.telefono || '',
      hectareas: Number(f.hectareas) || 0,
      tipo: f.tipo || undefined, encargado: f.encargado || '',
      patente: f.patente || '',
      capacidad: Number(f.capacidad) || 0,
      modalidad: f.modalidad === 'empresa' ? 'empresa' : 'independiente',
      empresa_nombre: f.empresa_nombre || '',
      empresa_email: f.empresa_email || '',
      vehiculo: f.vehiculo || '',
      estiba: f.estiba || 'no',
      cuadrilla_nombre: f.cuadrilla_nombre || '',
      cuadrilla_personas: Number(f.cuadrilla_personas) || 0,
      plan: f.plan || 'ninguno',
      plan_hasta: f.plan_hasta || null,
      wallet_saldo: Number(f.wallet_saldo) || 0,
      disponible: f.disponible !== false,
      activa: f.activa !== false, creada: f.creada,
      ultimo_acceso: f.ultimo_acceso || null,
      accesos: Number(f.accesos) || 0,
    };
  },
  _cargaDesdeNube(f) {
    return {
      id: f.id, ownerEmail: f.owner_email, comuna: f.comuna,
      volumen: Number(f.volumen), destino: f.destino, fecha: f.fecha,
      notas: f.notas || '', estado: f.estado || 'publicada', creada: f.creada,
      manoObra: f.mano_obra || 'propia',
      acceso: f.acceso || 'normal',
    };
  },
  _puntoDesdeNube(f) {
    return {
      id: f.id, nombre: f.nombre, tipo: f.tipo, comuna: f.comuna,
      desc: f.descripcion || '', cap: f.capacidad != null ? Number(f.capacidad) : null,
      activo: f.activo !== false, lat: Number(f.lat), lng: Number(f.lng),
    };
  },
  _cargaHaciaNube(c) {
    return {
      id: c.id, owner_email: c.ownerEmail, comuna: c.comuna, volumen: c.volumen,
      destino: c.destino, fecha: c.fecha, notas: c.notas || '',
      estado: c.estado || 'publicada',
      mano_obra: c.manoObra || 'propia',
      acceso: c.acceso || 'normal',
    };
  },
  _puntoHaciaNube(p) {
    return {
      id: p.id, nombre: p.nombre, tipo: p.tipo, comuna: p.comuna,
      descripcion: p.desc || '', capacidad: p.cap, activo: p.activo !== false,
      lat: p.lat, lng: p.lng,
    };
  },
  _envioDesdeNube(f) {
    return {
      id: f.id, cargaId: f.carga_id,
      vinateroEmail: f.vinatero_email, empresaEmail: f.empresa_email,
      choferEmail: f.chofer_email,
      chofer: f.chofer, choferTelefono: f.chofer_telefono, patente: f.patente,
      posicionAt: f.posicion_at,
      origenComuna: f.origen_comuna, origenLat: Number(f.origen_lat), origenLng: Number(f.origen_lng),
      destinoId: f.destino_id, destinoNombre: f.destino_nombre,
      destinoLat: Number(f.destino_lat), destinoLng: Number(f.destino_lng),
      estado: f.estado, salida: f.salida, minutosTotal: Number(f.minutos_total) || 0,
      progreso: Number(f.progreso) || 0,
      precision: f.precision_m != null ? Number(f.precision_m) : null,
      vehLat: f.veh_lat != null ? Number(f.veh_lat) : null,
      vehLng: f.veh_lng != null ? Number(f.veh_lng) : null,
      volumenDeclarado: Number(f.volumen_declarado) || 0,
      volumenRecibido: f.volumen_recibido != null ? Number(f.volumen_recibido) : null,
      pesoRecibido: f.peso_recibido != null ? Number(f.peso_recibido) : null,
      observaciones: f.observaciones || '', creado: f.creado,
      /* Paradas extra del viaje consolidado. Llegan como JSON desde la base. */
      paradas: Array.isArray(f.paradas) ? f.paradas : [],
      cuadrillaEmail: f.cuadrilla_email || '',
      cuadrillaNombre: f.cuadrilla_nombre || '',
      validadoPor: f.validado_por || '',
      validadoAt: f.validado_at || null,
      tarifa: f.tarifa != null ? Number(f.tarifa) : null,
      estibaCobrada: f.estiba_cobrada === true,
      escrowEstado: f.escrow_estado || 'ninguno',
      escrowAt: f.escrow_at || null,
      liquidadoAt: f.liquidado_at || null,
    };
  },
  _envioHaciaNube(e) {
    return {
      id: e.id, carga_id: e.cargaId || null,
      vinatero_email: e.vinateroEmail, empresa_email: e.empresaEmail || null,
      chofer_email: e.choferEmail || null,
      chofer: e.chofer, chofer_telefono: e.choferTelefono, patente: e.patente || null,
      posicion_at: e.posicionAt || null,
      origen_comuna: e.origenComuna, origen_lat: e.origenLat, origen_lng: e.origenLng,
      destino_id: e.destinoId, destino_nombre: e.destinoNombre,
      destino_lat: e.destinoLat, destino_lng: e.destinoLng,
      estado: e.estado, salida: e.salida, minutos_total: e.minutosTotal,
      progreso: e.progreso, veh_lat: e.vehLat, veh_lng: e.vehLng,
      precision_m: e.precision ?? null,
      volumen_declarado: e.volumenDeclarado,
      volumen_recibido: e.volumenRecibido, peso_recibido: e.pesoRecibido,
      observaciones: e.observaciones || '',
      paradas: Array.isArray(e.paradas) ? e.paradas : [],
      cuadrilla_email: e.cuadrillaEmail || null,
      cuadrilla_nombre: e.cuadrillaNombre || '',
      validado_por: e.validadoPor || null,
      validado_at: e.validadoAt || null,
      tarifa: e.tarifa != null ? e.tarifa : null,
      estiba_cobrada: e.estibaCobrada === true,
      escrow_estado: e.escrowEstado || 'ninguno',
      escrow_at: e.escrowAt || null,
      liquidado_at: e.liquidadoAt || null,
    };
  },
  _mensajeDesdeNube(f) {
    return {
      id: f.id, envioId: f.envio_id, autorEmail: f.autor_email,
      autorNombre: f.autor_nombre, texto: f.texto, creado: f.creado,
    };
  },
  _movimientoDesdeNube(f) {
    return {
      id: f.id, envioId: f.envio_id, email: f.email || '',
      tipo: f.tipo, concepto: f.concepto || '',
      monto: Number(f.monto) || 0, creado: f.creado,
    };
  },
  _movimientoHaciaNube(m) {
    return {
      id: m.id, envio_id: m.envioId || null, email: m.email || null,
      tipo: m.tipo, concepto: m.concepto || '',
      monto: m.monto, creado: m.creado,
    };
  },
  _mensajeHaciaNube(m) {
    return {
      id: m.id, envio_id: m.envioId, autor_email: m.autorEmail,
      autor_nombre: m.autorNombre, texto: m.texto, creado: m.creado,
    };
  },

  /* La tabla remota puede ser más antigua que este código: si todavía no
     tiene la columna "modalidad" o "paradas", mandarla haría fallar el
     guardado entero. Por eso se anota qué columnas trae de verdad cada
     tabla y se recorta lo que se envía.

     Es deliberado que falte en silencio: vale más guardar el resto que
     perderlo todo porque la base está a medio actualizar. */
  _columnas: {},
  _recordarColumnas(tabla, filas) {
    if (Array.isArray(filas) && filas.length) {
      this._columnas[tabla] = Object.keys(filas[0]);
    }
  },
  _soloColumnasConocidas(tabla, fila) {
    const conocidas = this._columnas[tabla];
    if (!conocidas) return fila;
    const limpia = {};
    for (const k of Object.keys(fila)) {
      if (conocidas.includes(k)) limpia[k] = fila[k];
    }
    return limpia;
  },

  /* Para la administración: qué columnas esperadas no están en la base.
     Si aparece algo acá, falta correr sql/esquema.sql. */
  columnasQueFaltan() {
    const esperadas = {
      cuentas: ['modalidad', 'empresa_nombre', 'empresa_email', 'ultimo_acceso',
                'accesos', 'vehiculo', 'estiba', 'cuadrilla_nombre', 'cuadrilla_personas',
                'plan', 'wallet_saldo'],
      cargas: ['mano_obra', 'acceso'],
      envios: ['paradas', 'cuadrilla_email', 'cuadrilla_nombre', 'validado_por',
               'validado_at', 'tarifa', 'escrow_estado'],
    };
    const faltan = [];
    for (const [tabla, cols] of Object.entries(esperadas)) {
      const hay = this._columnas[tabla];
      if (!hay) continue;
      cols.forEach(c => { if (!hay.includes(c)) faltan.push(tabla + '.' + c); });
    }
    return faltan;
  },

  /* Qué columnas de la cuenta viajan a la base compartida. Si un campo no
     está acá, se queda solo en el dispositivo: por eso van también los datos
     del transportista (camión, modalidad y disponibilidad). */
  _cuentaHaciaNube(a) {
    return {
      email: a.email, rol: this.rolDe(a), nombre: a.nombre,
      clave_hash: a.clave_hash, clave_sal: a.clave_sal,
      comuna: a.comuna || '', telefono: a.telefono || '',
      hectareas: Number(a.hectareas) || 0,
      tipo: a.tipo || null, encargado: a.encargado || '',
      patente: a.patente || null,
      capacidad: Number(a.capacidad) || 0,
      modalidad: a.modalidad === 'empresa' ? 'empresa' : 'independiente',
      empresa_nombre: a.empresa_nombre || '',
      empresa_email: a.empresa_email || '',
      vehiculo: a.vehiculo || null,
      estiba: a.estiba || 'no',
      cuadrilla_nombre: a.cuadrilla_nombre || '',
      cuadrilla_personas: Number(a.cuadrilla_personas) || 0,
      plan: a.plan || 'ninguno',
      plan_hasta: a.plan_hasta || null,
      wallet_saldo: Number(a.wallet_saldo) || 0,
      disponible: a.disponible !== false,
      activa: a.activa !== false,
      ultimo_acceso: a.ultimo_acceso || null,
      accesos: Number(a.accesos) || 0,
    };
  },

  /* =====================================================================
     Contraseñas
     ===================================================================== */
  /* Se guarda sha256(sal + clave), nunca la contraseña en claro.
     No es autenticación de nivel productivo —para eso está Supabase Auth—
     pero evita que las contraseñas queden legibles en la base. */
  async _cifrar(clave, sal = null) {
    sal = sal || (crypto.getRandomValues
      ? [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, '0')).join('')
      : String(Date.now()));
    if (!crypto.subtle) return { hash: 'plano:' + sal + ':' + clave, sal };
    const datos = new TextEncoder().encode(sal + clave);
    const buf = await crypto.subtle.digest('SHA-256', datos);
    const hash = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    return { hash, sal };
  },

  async _claveCoincide(cuenta, clave) {
    if (!cuenta) return false;
    // Cuentas creadas antes de que existiera el cifrado.
    if (cuenta.password !== undefined && !cuenta.clave_hash) return cuenta.password === clave;
    const { hash } = await this._cifrar(clave, cuenta.clave_sal);
    return hash === cuenta.clave_hash;
  },

  /* =====================================================================
     Cuentas
     ===================================================================== */
  accounts() { return this._cache.cuentas; },
  accountByEmail(email) {
    const e = (email || '').trim().toLowerCase();
    return this._cache.cuentas.find(a => (a.email || '').toLowerCase() === e) || null;
  },

  async upsertAccount(acc) {
    const lista = this._cache.cuentas;
    const i = lista.findIndex(a => (a.email || '').toLowerCase() === acc.email.toLowerCase());
    if (i >= 0) lista[i] = acc; else lista.push(acc);
    if (this.enNube()) {
      await Nube.guardar('cuentas', this._soloColumnasConocidas('cuentas', this._cuentaHaciaNube(acc)));
    } else {
      this._write(this.K_ACCOUNTS, lista);
    }
  },

  async borrarCuenta(email) {
    this._cache.cuentas = this._cache.cuentas.filter(a => a.email !== email);
    this._cache.cargas = this._cache.cargas.filter(c => c.ownerEmail !== email);
    if (this.enNube()) {
      await Nube.borrar('cuentas', 'email=eq.' + encodeURIComponent(email));
    } else {
      this._write(this.K_ACCOUNTS, this._cache.cuentas);
      this._write(this.K_CARGAS, this._cache.cargas);
    }
  },

  /* -------- Roles -------- */
  rolDe(acc) {
    if (!acc) return this.ROL_VINATERO;
    if (acc.rol === this.ROL_EMPRESA) return this.ROL_EMPRESA;
    if (acc.rol === this.ROL_CHOFER) return this.ROL_CHOFER;
    if (acc.rol === this.ROL_ADMIN) return this.ROL_ADMIN;
    return this.ROL_VINATERO;
  },
  rolActual() {
    const u = this.currentUser();
    return u ? this.rolDe(u) : null;
  },
  esEmpresa() { return this.rolActual() === this.ROL_EMPRESA; },
  esChofer() { return this.rolActual() === this.ROL_CHOFER; },
  esAdmin() { return this.rolActual() === this.ROL_ADMIN; },
  nombreRol(rol) {
    if (rol === this.ROL_EMPRESA) return 'Planta receptora';
    if (rol === this.ROL_CHOFER) return 'Transportista';
    if (rol === this.ROL_ADMIN) return 'Administración';
    return 'Viñatero';
  },

  /* -------- Sesión -------- */
  currentEmail() { return this._read(this.K_SESSION, null); },
  setSession(email) {
    if (email == null) localStorage.removeItem(this.K_SESSION);
    else this._write(this.K_SESSION, email);
  },
  currentUser() {
    const e = this.currentEmail();
    return e ? this.accountByEmail(e) : null;
  },

  /* =====================================================================
     Registro e inicio de sesión
     ===================================================================== */
  async registerVinatero({ nombre, email, password, comuna }) {
    email = (email || '').trim();
    if (this.accountByEmail(email)) return 'Ya existe una cuenta con ese correo';
    const { hash, sal } = await this._cifrar(password);
    await this.upsertAccount({
      rol: this.ROL_VINATERO,
      nombre: (nombre || '').trim() || 'Viñatero',
      email, clave_hash: hash, clave_sal: sal,
      comuna: (comuna || '').trim() || 'Región del Maule',
      telefono: '', hectareas: 0, activa: true,
    });
    this.setSession(email);
    return null;
  },

  async registerEmpresa({ nombre, email, password, comuna, tipo, encargado }) {
    email = (email || '').trim();
    if (this.accountByEmail(email)) return 'Ya existe una cuenta con ese correo';
    const { hash, sal } = await this._cifrar(password);
    await this.upsertAccount({
      rol: this.ROL_EMPRESA,
      nombre: (nombre || '').trim() || 'Empresa',
      email, clave_hash: hash, clave_sal: sal,
      comuna: (comuna || '').trim() || 'Región del Maule',
      tipo: tipo || 'Biomasa',
      encargado: (encargado || '').trim(),
      telefono: '', activa: true,
    });
    this.setSession(email);
    return null;
  },

  /* Cuenta de transportista: acepta los servicios que publican los viñateros.
     Sea independiente o de empresa, es este mismo perfil. */
  async registerChofer({ nombre, email, password, comuna, telefono, patente, capacidad }) {
    email = (email || '').trim();
    if (this.accountByEmail(email)) return 'Ya existe una cuenta con ese correo';
    const { hash, sal } = await this._cifrar(password);
    await this.upsertAccount({
      rol: this.ROL_CHOFER,
      nombre: (nombre || '').trim() || 'Transportista',
      email, clave_hash: hash, clave_sal: sal,
      comuna: (comuna || '').trim() || 'Región del Maule',
      telefono: (telefono || '').trim(),
      patente: (patente || '').trim().toUpperCase(),
      capacidad: Number(capacidad) || 0,
      /* Parte como independiente. Si conduce para una empresa, lo cambia
         después en Configuración: así el registro queda corto. */
      modalidad: 'independiente',
      empresa_nombre: '', empresa_email: '',
      disponible: true, activa: true,
    });
    this.setSession(email);
    return null;
  },

  register(datos) {
    if (datos.rol === this.ROL_EMPRESA) return this.registerEmpresa(datos);
    if (datos.rol === this.ROL_CHOFER) return this.registerChofer(datos);
    return this.registerVinatero(datos);
  },

  async login({ email, password, rol }) {
    const acc = this.accountByEmail(email);
    if (!acc) return 'No existe una cuenta con ese correo';
    if (!await this._claveCoincide(acc, password)) return 'Contraseña incorrecta';
    if (acc.activa === false) return 'Esta cuenta está suspendida. Contacta a la administración.';
    if (rol && this.rolDe(acc) !== rol) {
      const suyo = this.etiquetaCuenta(acc);
      return `Ese correo está registrado como ${suyo}. Usa la pestaña correspondiente.`;
    }
    this.setSession(acc.email);
    return null;
  },

  logout() { this.setSession(null); },

  async updateAccount(patch) {
    const acc = this.currentUser();
    if (!acc) return;
    const actualizado = { ...acc, ...patch };
    await this.upsertAccount(actualizado);
    this.setSession(actualizado.email);
  },

  /* Cambio de contraseña (lo usa Configuración y la administración). */
  async cambiarClave(email, nueva) {
    const acc = this.accountByEmail(email);
    if (!acc) return 'No existe esa cuenta';
    const { hash, sal } = await this._cifrar(nueva);
    await this.upsertAccount({ ...acc, clave_hash: hash, clave_sal: sal, password: undefined, porDefecto: false });
    return null;
  },

  /* =====================================================================
     Cargas publicadas
     ===================================================================== */
  cargas() { return this._cache.cargas; },
  misCargas() {
    const e = this.currentEmail();
    return this._cache.cargas.filter(c => c.ownerEmail === e);
  },

  async addCarga(carga) {
    this._cache.cargas.unshift(carga);
    if (this.enNube()) {
      await Nube.guardar('cargas', this._soloColumnasConocidas('cargas', this._cargaHaciaNube(carga)));
    } else {
      this._write(this.K_CARGAS, this._cache.cargas);
    }
  },

  async removeCarga(id) {
    this._cache.cargas = this._cache.cargas.filter(c => c.id !== id);
    if (this.enNube()) await Nube.borrar('cargas', 'id=eq.' + encodeURIComponent(id));
    else this._write(this.K_CARGAS, this._cache.cargas);
  },

  /* Cargas visibles para una empresa: las publicadas por los viñateros
     más las de ejemplo de data.js. */
  cargasPublicadas() {
    const reales = this._cache.cargas.map(c => {
      const dueno = this.accountByEmail(c.ownerEmail);
      return {
        ...c,
        productor: dueno ? dueno.nombre : 'Productor AgroConecta',
        telefono: dueno ? dueno.telefono : '',
        email: c.ownerEmail,
      };
    });
    const demo = (typeof DATA !== 'undefined' && DATA.cargasDemo) ? DATA.cargasDemo : [];
    return reales.concat(demo);
  },

  /* =====================================================================
     Plantas y centros de acopio
     ===================================================================== */
  puntos() {
    if (this._cache.puntos.length) return this._cache.puntos;
    return (typeof DATA !== 'undefined' && DATA.puntos) ? DATA.puntos : [];
  },

  async guardarPunto(punto) {
    const lista = this._cache.puntos;
    const i = lista.findIndex(p => p.id === punto.id);
    if (i >= 0) lista[i] = punto; else lista.push(punto);
    if (this.enNube()) await Nube.guardar('puntos', this._puntoHaciaNube(punto));
    else this._write(this.K_PUNTOS, lista);
  },

  async borrarPunto(id) {
    this._cache.puntos = this._cache.puntos.filter(p => p.id !== id);
    if (this.enNube()) await Nube.borrar('puntos', 'id=eq.' + encodeURIComponent(id));
    else this._write(this.K_PUNTOS, this._cache.puntos);
  },

  /* =====================================================================
     Vínculo entre la carga publicada y el chofer que la toma
     ===================================================================== */

  /* Choferes registrados y disponibles para tomar servicios. */
  choferesDisponibles() {
    return this._cache.cuentas.filter(a =>
      this.rolDe(a) === this.ROL_CHOFER && a.activa !== false
      && a.disponible !== false
      // El cargador individual no conduce: no cuenta como transportista.
      && !this.esSoloCargador(a));
  },

  /* Que le falta por declarar a esta cuenta.

     No se obliga a nada al registrarse —pedir diez datos de entrada
     espanta a cualquiera— pero despues conviene recordarlo: un
     transportista sin vehiculo declarado no aparece en los filtros de
     compatibilidad, y uno sin telefono no puede ser contactado.

     Devuelve una lista de { campo, por que } para poder explicar el
     motivo y no solo pedir el dato. */
  perfilIncompleto(cuenta) {
    const u = cuenta || this.currentUser();
    if (!u) return [];
    const rol = this.rolDe(u);
    const falta = [];

    const hay = v => v != null && String(v).trim() !== '' && String(v) !== '0';

    if (!hay(u.telefono)) {
      falta.push({ campo: 'Teléfono', porque: 'sin él nadie puede llamarte para coordinar' });
    }
    if (!hay(u.comuna)) {
      falta.push({ campo: 'Comuna', porque: 'se usa para calcular distancias y ordenar las cargas' });
    }

    if (rol === this.ROL_CHOFER && this.esSoloCargador(u)) {
      if (u.estiba === 'cuadrilla' && !hay(u.cuadrilla_personas)) {
        falta.push({ campo: 'Cuántos son en tu tropa', porque: 'se asignan primero los equipos más grandes' });
      }
      return falta;      // no conduce: no se le pide nada del camión
    }

    if (rol === this.ROL_CHOFER) {
      if (u.estiba === 'cuadrilla' && !hay(u.cuadrilla_personas)) {
        falta.push({ campo: 'Cuántos son en tu tropa', porque: 'se asignan primero los equipos más grandes' });
      }
      if (!hay(u.patente)) {
        falta.push({ campo: 'Patente', porque: 'el viñatero la ve para reconocer tu camión' });
      }
      if (!hay(u.capacidad)) {
        falta.push({ campo: 'Capacidad de carga', porque: 'sin ella no se puede sumar paradas a tu viaje' });
      }
      if (!hay(u.vehiculo)) {
        falta.push({ campo: 'Tipo de vehículo', porque: 'define a qué campos puedes entrar' });
      }
    }

    if (rol === this.ROL_CHOFER && u.estiba === 'cuadrilla' && !hay(u.cuadrilla_personas)) {
      falta.push({ campo: 'Cuántos son en tu tropa', porque: 'se asignan primero los equipos más grandes' });
    }

    return falta;
  },

  /* =====================================================================
     Estiba: quien sube la carga, y que camion puede entrar
     ===================================================================== */
  /* Quien puede hacer la estiba. Son siempre cargadores individuales:
     el transportista conduce y no carga. */
  cuadrillasDisponibles() {
    return this._cache.cuentas.filter(a => {
      if (this.rolDe(a) !== this.ROL_CHOFER) return false;
      if (a.activa === false || a.disponible === false) return false;
      // El cargador individual, y el transportista que lleva su tropa.
      return this.esSoloCargador(a) ? a.estiba !== 'no' : a.estiba === 'cuadrilla';
    });
  },

  /* Los trabajos de estiba asignados a esta cuenta, para que el
     transportista que ademas carga vea lo que le derivaron. */
  misEstibas() {
    const correo = this.currentEmail();
    return this._cache.envios
      .filter(e => e.cuadrillaEmail === correo)
      .sort((a, b) => (b.creado || '').localeCompare(a.creado || ''));
  },

  /* Cuantas personas pone esa cuenta para cargar. */
  personasDeEstiba(cuenta) {
    if (!cuenta) return 0;
    if (cuenta.estiba === 'cuadrilla') return Number(cuenta.cuadrilla_personas) || 2;
    if (cuenta.estiba === 'propio') return 1;
    return 0;
  },

  /* Como se llama la estiba de esa cuenta, para mostrarla. */
  nombreDeEstiba(cuenta) {
    if (!cuenta) return '';
    if (cuenta.estiba === 'cuadrilla') {
      return (cuenta.cuadrilla_nombre || '').trim() || ('Tropa de ' + cuenta.nombre);
    }
    if (cuenta.estiba === 'propio') return cuenta.nombre;
    return '';
  },

  /* El transportista toma una carga que pide cuadrilla: si el ofrece
     estiba, se asigna solo. Si no, se busca una en la red.

     La asignacion es automatica a proposito, pero no obligatoria: si no
     hay nadie disponible la carga igual se puede tomar, y queda anotado
     que va sin cuadrilla en vez de bloquear el retiro. */
  asignarCuadrilla(carga, chofer) {
    if (!carga || carga.manoObra !== 'solicita') return null;

    /* Si el transportista lleva su propia tropa, se usa esa: ya va al
       campo con ellos. El transportista no carga el mismo —conduce— pero
       su equipo si. */
    if (chofer && !this.esSoloCargador(chofer) && chofer.estiba === 'cuadrilla') {
      return { email: chofer.email, nombre: this.nombreDeEstiba(chofer), propia: true };
    }

    // Si no, un cargador de la red, empezando por el equipo mas grande.
    const libres = this.cuadrillasDisponibles()
      .filter(a => !chofer || a.email !== chofer.email)
      .sort((a, b) => this.personasDeEstiba(b) - this.personasDeEstiba(a));
    if (!libres.length) return null;
    return { email: libres[0].email, nombre: this.nombreDeEstiba(libres[0]), propia: false };
  },

  /* Que vehiculos pueden entrar a ese campo y llevarse esa carga.
     Devuelve { puede, motivo } para un vehiculo concreto. */
  compatibilidad(carga, vehiculoId) {
    const v = (typeof DATA !== 'undefined' ? DATA.vehiculos : []).find(x => x.id === vehiculoId);
    if (!v) return { puede: true, motivo: '' };   // sin vehiculo declarado no se estorba

    const acc = (typeof DATA !== 'undefined' ? DATA.accesos : [])
      .find(x => x.id === (carga.acceso || 'normal'));

    if (acc && !v.accesos.includes(acc.id)) {
      return { puede: false, motivo: `Tu ${v.label.toLowerCase()} no entra: ${acc.desc.toLowerCase()}` };
    }
    if (acc && carga.volumen > acc.maxVolumen) {
      return { puede: false, motivo: `${carga.volumen} m³ es mucho para ese acceso` };
    }
    return { puede: true, motivo: '' };
  },

  /* =====================================================================
     Flota: los transportistas que trabajan para una planta receptora
     ===================================================================== */
  /* El que solo carga: entra como transportista, pero no conduce ni
     pertenece a ninguna empresa. Lo suyo es la estiba, y la ruta o el
     chofer al que asiste se los asigna la administracion. */
  esSoloCargador(cuenta) {
    const u = cuenta || this.currentUser();
    return !!u && this.rolDe(u) === this.ROL_CHOFER && u.modalidad === 'cargador';
  },

  /* Cargadores individuales registrados y disponibles. */
  cargadoresIndividuales() {
    return this._cache.cuentas.filter(a =>
      this.esSoloCargador(a) && a.activa !== false && a.disponible !== false);
  },

  /* Como se llama esta cuenta en pantalla. Hace falta porque el cargador
     individual se registra como transportista pero no lo es: mostrarle
     "Transportista" seria confundirlo con quien conduce. */
  etiquetaCuenta(cuenta) {
    if (this.esSoloCargador(cuenta)) return 'Cargador';
    return this.nombreRol(this.rolDe(cuenta));
  },

  /* La administracion deriva a un cargador a un retiro concreto: le da la
     ruta y, con ella, el chofer al que va a asistir. */
  async derivarCargador(envioId, correoCargador) {
    const envio = this.envioPorId(envioId);
    if (!envio) return 'Ese retiro ya no existe';
    if (!correoCargador) {
      await this.actualizarEnvio(envioId, { cuadrillaEmail: '', cuadrillaNombre: '' });
      return null;
    }
    const c = this.accountByEmail(correoCargador);
    if (!c) return 'Esa cuenta no existe';
    await this.actualizarEnvio(envioId, {
      cuadrillaEmail: c.email,
      cuadrillaNombre: this.nombreDeEstiba(c) || c.nombre,
    });
    return null;
  },

  /* Transportistas vinculados a una empresa. El vínculo lo declara el propio
     transportista en su perfil, así nadie queda enganchado sin saberlo. */
  flotaDe(empresaEmail) {
    const correo = (empresaEmail || '').toLowerCase();
    if (!correo) return [];
    return this._cache.cuentas.filter(a =>
      this.rolDe(a) === this.ROL_CHOFER
      && a.activa !== false
      && !this.esSoloCargador(a)
      && (a.empresa_email || '').toLowerCase() === correo);
  },

  /* Mi flota, si quien mira es una planta receptora. */
  miFlota() {
    return this.flotaDe(this.currentEmail());
  },

  /* Servicios que una planta le encargó a este transportista y que todavía
     no acepta ni rechaza. */
  serviciosAsignados() {
    const correo = this.currentEmail();
    return this._cache.envios.filter(e =>
      e.choferEmail === correo && e.estado === 'asignado');
  },

  /* El transportista toma el servicio: recién acá empieza a correr el viaje
     y tiene sentido encender el GPS. */
  async aceptarServicio(envioId) {
    const envio = this.envioPorId(envioId);
    if (!envio) return 'Ese servicio ya no existe';
    if (envio.choferEmail !== this.currentEmail()) return 'Ese servicio no es tuyo';
    if (envio.estado !== 'asignado') return 'Ese servicio ya no está pendiente';
    await this.actualizarEnvio(envioId, {
      estado: 'en_camino',
      salida: new Date().toISOString(),
    });
    return null;
  },

  /* El transportista no puede tomarlo: la carga vuelve a quedar libre. */
  async rechazarServicio(envioId) {
    const envio = this.envioPorId(envioId);
    if (!envio) return 'Ese servicio ya no existe';
    if (envio.choferEmail !== this.currentEmail()) return 'Ese servicio no es tuyo';
    if (envio.estado !== 'asignado') return 'Ese servicio ya no está pendiente';
    await this.borrarEnvio(envioId);
    return null;
  },

  /* =====================================================================
     Recolección múltiple: varias viñas en un mismo viaje
     ===================================================================== */
  /* Cuántos m³ le quedan libres al camión en este viaje. Cuenta la carga
     original más todas las paradas ya aceptadas. */
  capacidadRestante(envio, cuenta = null) {
    const chofer = cuenta || this.accountByEmail(envio && envio.choferEmail);
    const total = Number(chofer && chofer.capacidad) || 0;
    if (!total || !envio) return 0;
    const ocupado = (Number(envio.volumenDeclarado) || 0)
      + (envio.paradas || []).reduce((s, p) => s + (Number(p.volumen) || 0), 0);
    return Math.max(0, Math.round((total - ocupado) * 10) / 10);
  },

  /* Cargas que caben en lo que queda del camión y que todavía nadie tomó.
     No se filtran por cercanía acá: de eso se encarga quien llame, que es
     el único que sabe por dónde va el camión. */
  cargasQueCaben(envio, cuenta = null) {
    const libre = this.capacidadRestante(envio, cuenta);
    if (libre <= 0) return [];
    const yaEn = new Set((envio.paradas || []).map(p => p.cargaId));
    return this.cargasDisponibles()
      .filter(c => !yaEn.has(c.id) && c.volumen <= libre);
  },

  /* Suma una viña al viaje en curso. El orden óptimo lo decide quien llama
     (con el servicio de ruteo) y lo pasa en "orden". */
  async agregarParada(envioId, carga, { orden = null, km = null, minutos = null } = {}) {
    const envio = this.envioPorId(envioId);
    if (!envio) return 'Ese viaje ya no existe';
    if (envio.choferEmail !== this.currentEmail()) return 'Ese viaje no es tuyo';
    if (envio.estado === 'entregado') return 'Ese viaje ya está cerrado';

    const libre = this.capacidadRestante(envio);
    if (carga.volumen > libre) {
      return `No te caben ${carga.volumen} m³: quedan ${libre} m³ libres.`;
    }

    const paradas = (envio.paradas || []).concat([{
      cargaId: carga.id,
      comuna: carga.comuna,
      lat: carga.lat,
      lng: carga.lng,
      volumen: carga.volumen,
      productor: carga.productor || '',
      telefono: carga.telefono || '',
      recogida: false,
    }]);

    // Si vino un orden optimizado, se reordenan las paradas con él.
    const ordenadas = (orden && orden.length === paradas.length)
      ? orden.map(i => paradas[i]) : paradas;

    const cambios = { paradas: ordenadas };
    if (minutos) cambios.minutosTotal = minutos;
    await this.actualizarEnvio(envioId, cambios);
    return null;
  },

  /* El transportista marca que ya cargó en una de las paradas. */
  async marcarParadaRecogida(envioId, cargaId) {
    const envio = this.envioPorId(envioId);
    if (!envio) return 'Ese viaje ya no existe';
    const paradas = (envio.paradas || []).map(p =>
      p.cargaId === cargaId ? { ...p, recogida: true } : p);
    await this.actualizarEnvio(envioId, { paradas });
    return null;
  },

  /* Cargas que todavía nadie se comprometió a retirar. Es lo que ve el
     chofer en su panel, ordenado por cercanía a su base. */
  cargasDisponibles(desde) {
    /* Una carga deja de estar libre tanto si alguien creó un envío para
       ella como si quedó incluida como parada de un viaje consolidado. */
    const comprometidas = new Set();
    this._cache.envios.forEach(e => {
      if (e.cargaId) comprometidas.add(e.cargaId);
      (e.paradas || []).forEach(p => comprometidas.add(p.cargaId));
    });

    return this._cache.cargas
      .filter(c => !comprometidas.has(c.id) && c.estado !== 'retirada')
      .map(c => {
        const dueno = this.accountByEmail(c.ownerEmail);
        const coord = typeof Shell !== 'undefined' ? Shell.coordComuna(c.comuna) : null;
        return {
          ...c,
          productor: dueno ? dueno.nombre : 'Productor AgroConecta',
          telefono: dueno ? dueno.telefono : '',
          email: c.ownerEmail,
          lat: coord ? coord.lat : null,
          lng: coord ? coord.lng : null,
          km: (coord && desde && typeof Shell !== 'undefined')
            ? Shell.distanciaKm(desde, coord) : null,
        };
      })
      .sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9));
  },

  /* Los servicios de un chofer. */
  misServicios() {
    const correo = this.currentEmail();
    return this._cache.envios
      .filter(e => e.choferEmail === correo)
      .sort((a, b) => (b.salida || '').localeCompare(a.salida || ''));
  },

  /* El viaje que el transportista tiene abierto ahora mismo, si lo hay.
     Un servicio que todavía no acepta no cuenta como viaje en curso. */
  servicioActivo() {
    return this.misServicios().find(e =>
      e.estado !== 'entregado' && e.estado !== 'asignado') || null;
  },

  /* =====================================================================
     Envíos: el seguimiento de un camión desde la viña hasta la planta
     ===================================================================== */
  envios() { return this._cache.envios; },

  envioPorId(id) {
    return this._cache.envios.find(e => e.id === id) || null;
  },

  /* Los envíos que le corresponden al usuario según su rol. */
  misEnvios() {
    const correo = this.currentEmail();
    const rol = this.rolActual();
    if (rol === this.ROL_ADMIN) return this._cache.envios;
    return this._cache.envios.filter(e =>
      e.vinateroEmail === correo || e.empresaEmail === correo);
  },

  /* Envíos todavía en curso, los más recientes primero. */
  enviosActivos() {
    return this.misEnvios()
      .filter(e => e.estado !== 'entregado')
      .sort((a, b) => (b.salida || '').localeCompare(a.salida || ''));
  },

  async addEnvio(envio) {
    this._cache.envios.unshift(envio);
    if (this.enNube()) {
      await Nube.guardar('envios', this._soloColumnasConocidas('envios', this._envioHaciaNube(envio)));
    }
    else this._write(this.K_ENVIOS, this._cache.envios);
    return envio;
  },

  /* Aplica cambios a un envío y los persiste. */
  async actualizarEnvio(id, cambios) {
    const i = this._cache.envios.findIndex(e => e.id === id);
    if (i < 0) return null;
    this._cache.envios[i] = { ...this._cache.envios[i], ...cambios };
    const envio = this._cache.envios[i];
    if (this.enNube()) {
      await Nube.guardar('envios', this._soloColumnasConocidas('envios', this._envioHaciaNube(envio)));
    }
    else this._write(this.K_ENVIOS, this._cache.envios);
    return envio;
  },

  /* Trae de la base solo este envío, para ver la última posición que
     reportó el chofer sin recargar todo lo demás. */
  async refrescarEnvio(id) {
    if (!this.enNube()) return this.envioPorId(id);
    try {
      const filas = await Nube.listar('envios', 'id=eq.' + encodeURIComponent(id));
      if (filas && filas[0]) {
        const fresco = this._envioDesdeNube(filas[0]);
        const i = this._cache.envios.findIndex(e => e.id === id);
        if (i >= 0) this._cache.envios[i] = fresco; else this._cache.envios.push(fresco);
      }
    } catch (e) { /* sin conexión: se queda con lo que tenía */ }
    return this.envioPorId(id);
  },

  /* El chofer publica su posición. Se guarda la hora para poder decir
     hace cuánto se actualizó y detectar si la señal se perdió. */
  async reportarPosicionEnvio(id, { lat, lng, precision }) {
    return this.actualizarEnvio(id, {
      vehLat: lat, vehLng: lng,
      precision: precision ?? null,
      posicionAt: new Date().toISOString(),
    });
  },

  async borrarEnvio(id) {
    this._cache.envios = this._cache.envios.filter(e => e.id !== id);
    this._cache.mensajes = this._cache.mensajes.filter(m => m.envioId !== id);
    if (this.enNube()) {
      await Nube.borrar('envios', 'id=eq.' + encodeURIComponent(id));
    } else {
      this._write(this.K_ENVIOS, this._cache.envios);
      this._write(this.K_MENSAJES, this._cache.mensajes);
    }
  },

  /* =====================================================================
     Dinero: custodia, reparto y billetera

     NADA DE ESTO MUEVE DINERO REAL. Es un libro de movimientos: deja
     registrado quien le debe cuanto a quien y en que estado esta cada
     pago. Las cifras son correctas; el cobro no existe.
     ===================================================================== */
  movimientos() { return this._cache.movimientos || []; },

  async addMovimiento({ envioId, email, tipo, concepto, monto }) {
    const m = {
      id: 'mov-' + Date.now() + '-' + Math.random().toString(16).slice(2, 7),
      envioId: envioId || null, email: email || '',
      tipo, concepto: concepto || '', monto: Math.round(Number(monto) || 0),
      creado: new Date().toISOString(),
    };
    this._cache.movimientos.push(m);
    if (this.enNube()) {
      await Nube.guardar('movimientos', this._movimientoHaciaNube(m));
    } else {
      this._write(this.K_MOVIMIENTOS, this._cache.movimientos);
    }
    return m;
  },

  /* Lo que esta cuenta tiene a su favor: lo abonado menos lo gastado. */
  saldo(email) {
    const correo = (email || this.currentEmail() || '').toLowerCase();
    return this.movimientos()
      .filter(m => (m.email || '').toLowerCase() === correo)
      .reduce((t, m) => t + m.monto, 0);
  },

  movimientosDe(email) {
    const correo = (email || this.currentEmail() || '').toLowerCase();
    return this.movimientos()
      .filter(m => (m.email || '').toLowerCase() === correo)
      .sort((a, b) => (b.creado || '').localeCompare(a.creado || ''));
  },

  /* Lo que se queda la plataforma y el fondo de reserva: son los
     movimientos sin dueno. */
  totalPlataforma(tipo) {
    return this.movimientos()
      .filter(m => !m.email && (!tipo || m.tipo === tipo))
      .reduce((t, m) => t + m.monto, 0);
  },

  /* -------- Custodia --------
     Al contratar, el monto queda retenido: ni la planta lo tiene ni el
     transportista puede cobrarlo. */
  async retenerFlete(envioId, tarifa, conEstiba) {
    const envio = this.envioPorId(envioId);
    if (!envio) return 'Ese retiro ya no existe';
    if (envio.escrowEstado === 'retenido') return 'Ya está retenido';

    const total = Finanzas.cobrado(tarifa, conEstiba);
    await this.actualizarEnvio(envioId, {
      tarifa, estibaCobrada: !!conEstiba,
      escrowEstado: 'retenido', escrowAt: new Date().toISOString(),
    });
    // Le sale del bolsillo a la planta, aunque todavia no llegue a nadie.
    if (envio.empresaEmail) {
      await this.addMovimiento({
        envioId, email: envio.empresaEmail, tipo: 'retencion',
        concepto: `Flete retenido · ${envio.origenComuna} → ${envio.destinoNombre}`,
        monto: -total,
      });
    }
    return null;
  },

  /* -------- Liquidacion --------
     La planta valido la descarga: recien ahi se reparte. */
  async liquidarFlete(envioId) {
    const envio = this.envioPorId(envioId);
    if (!envio) return 'Ese retiro ya no existe';
    if (envio.escrowEstado !== 'retenido') return null;   // nada que liquidar

    const r = Finanzas.repartoDe(envio);
    if (!r) return null;

    if (envio.choferEmail && r.chofer > 0) {
      await this.addMovimiento({
        envioId, email: envio.choferEmail, tipo: 'abono',
        concepto: r.estiba > 0 ? 'Transporte' : 'Transporte y estiba',
        monto: r.chofer,
      });
    }
    if (envio.cuadrillaEmail && r.cuadrilla > 0
        && envio.cuadrillaEmail !== envio.choferEmail) {
      await this.addMovimiento({
        envioId, email: envio.cuadrillaEmail, tipo: 'abono',
        concepto: 'Estiba', monto: r.cuadrilla,
      });
    }
    await this.addMovimiento({
      envioId, email: '', tipo: 'reserva',
      concepto: 'Fondo de imprevistos', monto: r.reserva,
    });
    await this.addMovimiento({
      envioId, email: '', tipo: 'comision',
      concepto: 'Comisión de la plataforma', monto: r.app,
    });

    await this.actualizarEnvio(envioId, {
      escrowEstado: 'liquidado', liquidadoAt: new Date().toISOString(),
    });
    return null;
  },

  /* -------- Membresia de la planta -------- */
  async contratarPlan(planId) {
    const u = this.currentUser();
    if (!u || this.rolDe(u) !== this.ROL_EMPRESA) return 'Solo las plantas tienen membresía';
    const plan = Finanzas.PLANES.find(p => p.id === planId);
    if (!plan) return 'Ese plan no existe';

    // Si renueva antes de vencer, se suma a lo que le queda.
    const desde = (u.plan_hasta && new Date(u.plan_hasta) > new Date())
      ? new Date(u.plan_hasta) : new Date();
    desde.setDate(desde.getDate() + plan.dias);

    await this.updateAccount({ plan: plan.id, plan_hasta: desde.toISOString() });
    await this.addMovimiento({
      email: u.email, tipo: 'membresia',
      concepto: `Membresía ${plan.label}`, monto: -plan.precio,
    });
    return null;
  },

  /* =====================================================================
     Mensajes: el chat entre el viñatero y el chofer de cada envío
     ===================================================================== */
  mensajes(envioId) {
    return this._cache.mensajes
      .filter(m => m.envioId === envioId)
      .sort((a, b) => (a.creado || '').localeCompare(b.creado || ''));
  },

  /* -------- Qué mensajes ya vio esta persona --------
     Se guarda en el dispositivo, no en la base: es una marca de lectura
     personal, y compartirla entre dispositivos no vale la complicación.
     Formato: { 'id-del-envio': 'fecha ISO del ultimo visto' }. */
  K_CHAT_VISTO: 'vitilog_chat_visto',

  _vistos() {
    try { return JSON.parse(localStorage.getItem(this.K_CHAT_VISTO)) || {}; }
    catch (e) { return {}; }
  },

  /* Mensajes escritos por otra persona que llegaron después de la última
     vez que se abrió ese chat. */
  mensajesNoLeidos(envioId) {
    const desde = this._vistos()[envioId] || '';
    const yo = (this.currentEmail() || '').toLowerCase();
    return this.mensajes(envioId).filter(m =>
      (m.autorEmail || '').toLowerCase() !== yo && (m.creado || '') > desde);
  },

  /* Todos los no leídos del usuario, de todos sus envíos en curso. */
  totalNoLeidos() {
    return this.misEnvios()
      .reduce((t, e) => t + this.mensajesNoLeidos(e.id).length, 0);
  },

  /* Se llama al abrir el chat: desde acá todo queda como leído. */
  marcarChatVisto(envioId) {
    try {
      const v = this._vistos();
      v[envioId] = new Date().toISOString();
      localStorage.setItem(this.K_CHAT_VISTO, JSON.stringify(v));
    } catch (e) { /* almacenamiento bloqueado: se seguirá avisando, no es grave */ }
  },

  async addMensaje({ envioId, texto }) {
    const u = this.currentUser();
    const mensaje = {
      id: 'm-' + Date.now() + '-' + Math.random().toString(16).slice(2, 7),
      envioId,
      autorEmail: this.currentEmail(),
      autorNombre: u ? u.nombre : 'Usuario',
      texto: String(texto || '').trim(),
      creado: new Date().toISOString(),
    };
    if (!mensaje.texto) return null;
    this._cache.mensajes.push(mensaje);
    if (this.enNube()) await Nube.guardar('mensajes', this._mensajeHaciaNube(mensaje));
    else this._write(this.K_MENSAJES, this._cache.mensajes);
    return mensaje;
  },

  /* Trae solo los mensajes nuevos desde la base compartida, sin recargar
     todo lo demás. Lo usa el chat para refrescarse cada pocos segundos. */
  async refrescarMensajes(envioId) {
    if (!this.enNube()) return this.mensajes(envioId);
    try {
      const filas = await Nube.listar('mensajes', 'envio_id=eq.' + encodeURIComponent(envioId));
      const nuevos = (filas || []).map(this._mensajeDesdeNube);
      this._cache.mensajes = this._cache.mensajes
        .filter(m => m.envioId !== envioId)
        .concat(nuevos);
    } catch (e) { /* sin conexión: se queda con lo que ya tenía */ }
    return this.mensajes(envioId);
  },

  /* -------- Tema -------- */
  isDark() { return this._read(this.K_THEME, false) === true; },
  setDark(v) { this._write(this.K_THEME, v === true); },
};
