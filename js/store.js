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
  K_THEME: 'vitilog_theme',

  ROL_VINATERO: 'vinatero',
  ROL_EMPRESA: 'empresa',
  ROL_CHOFER: 'chofer',
  ROL_ADMIN: 'admin',

  /* Datos en memoria. Los llena sincronizar() al abrir cada página. */
  _cache: { cuentas: [], cargas: [], puntos: [], envios: [], mensajes: [] },
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
        const [cuentas, cargas, puntos, envios, mensajes] = await Promise.all([
          Nube.listar('cuentas'),
          Nube.listar('cargas'),
          Nube.listar('puntos'),
          Nube.listar('envios'),
          Nube.listar('mensajes'),
        ]);
        this._recordarColumnas(cuentas);
        this._cache.cuentas = (cuentas || []).map(this._cuentaDesdeNube);
        this._cache.cargas = (cargas || []).map(this._cargaDesdeNube);
        this._cache.puntos = (puntos || []).map(this._puntoDesdeNube);
        this._cache.envios = (envios || []).map(this._envioDesdeNube);
        this._cache.mensajes = (mensajes || []).map(this._mensajeDesdeNube);
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
    await this._sembrarLocal();
    this._listo = true;
    return this._aviso;
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
        rol: this.ROL_ADMIN, nombre: 'Administración VITILOG',
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
      disponible: f.disponible !== false,
      activa: f.activa !== false, creada: f.creada,
    };
  },
  _cargaDesdeNube(f) {
    return {
      id: f.id, ownerEmail: f.owner_email, comuna: f.comuna,
      volumen: Number(f.volumen), destino: f.destino, fecha: f.fecha,
      notas: f.notas || '', estado: f.estado || 'publicada', creada: f.creada,
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
    };
  },
  _mensajeDesdeNube(f) {
    return {
      id: f.id, envioId: f.envio_id, autorEmail: f.autor_email,
      autorNombre: f.autor_nombre, texto: f.texto, creado: f.creado,
    };
  },
  _mensajeHaciaNube(m) {
    return {
      id: m.id, envio_id: m.envioId, autor_email: m.autorEmail,
      autor_nombre: m.autorNombre, texto: m.texto, creado: m.creado,
    };
  },

  /* La tabla remota puede ser más antigua que este código: si todavía no
     tiene la columna "modalidad", enviarla haría fallar el guardado entero.
     Por eso se anota qué columnas trae de verdad y se recorta el envío. */
  _columnasCuenta: null,
  _recordarColumnas(filas) {
    if (Array.isArray(filas) && filas.length) {
      this._columnasCuenta = Object.keys(filas[0]);
    }
  },
  _soloColumnasConocidas(fila) {
    if (!this._columnasCuenta) return fila;
    const limpia = {};
    for (const k of Object.keys(fila)) {
      if (this._columnasCuenta.includes(k)) limpia[k] = fila[k];
    }
    return limpia;
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
      disponible: a.disponible !== false,
      activa: a.activa !== false,
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
      await Nube.guardar('cuentas', this._soloColumnasConocidas(this._cuentaHaciaNube(acc)));
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
      empresa_nombre: '',
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
      const suyo = this.nombreRol(this.rolDe(acc));
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
    if (this.enNube()) await Nube.guardar('cargas', this._cargaHaciaNube(carga));
    else this._write(this.K_CARGAS, this._cache.cargas);
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
        productor: dueno ? dueno.nombre : 'Productor VITILOG',
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
      this.rolDe(a) === this.ROL_CHOFER && a.activa !== false && a.disponible !== false);
  },

  /* Cargas que todavía nadie se comprometió a retirar. Es lo que ve el
     chofer en su panel, ordenado por cercanía a su base. */
  cargasDisponibles(desde) {
    const comprometidas = new Set(
      this._cache.envios.filter(e => e.cargaId).map(e => e.cargaId));

    return this._cache.cargas
      .filter(c => !comprometidas.has(c.id) && c.estado !== 'retirada')
      .map(c => {
        const dueno = this.accountByEmail(c.ownerEmail);
        const coord = typeof Shell !== 'undefined' ? Shell.coordComuna(c.comuna) : null;
        return {
          ...c,
          productor: dueno ? dueno.nombre : 'Productor VITILOG',
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

  /* El viaje que el chofer tiene abierto ahora mismo, si lo hay. */
  servicioActivo() {
    return this.misServicios().find(e => e.estado !== 'entregado') || null;
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
    if (this.enNube()) await Nube.guardar('envios', this._envioHaciaNube(envio));
    else this._write(this.K_ENVIOS, this._cache.envios);
    return envio;
  },

  /* Aplica cambios a un envío y los persiste. */
  async actualizarEnvio(id, cambios) {
    const i = this._cache.envios.findIndex(e => e.id === id);
    if (i < 0) return null;
    this._cache.envios[i] = { ...this._cache.envios[i], ...cambios };
    const envio = this._cache.envios[i];
    if (this.enNube()) await Nube.guardar('envios', this._envioHaciaNube(envio));
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
     Mensajes: el chat entre el viñatero y el chofer de cada envío
     ===================================================================== */
  mensajes(envioId) {
    return this._cache.mensajes
      .filter(m => m.envioId === envioId)
      .sort((a, b) => (a.creado || '').localeCompare(b.creado || ''));
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
