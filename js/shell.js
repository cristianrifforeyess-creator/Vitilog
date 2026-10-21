/* ============ Shell compartido: navegación, tema, sesión, utilidades ============ */

/* Menú del productor vitivinícola. */
const NAV_VINATERO = [
  { key: 'inicio', label: 'Inicio', ic: '🏠', href: 'inicio.html' },
  { key: 'rutas', label: 'Rutas', ic: '🛣️', href: 'rutas.html' },
  { key: 'mapa', label: 'Mapa', ic: '🗺️', href: 'mapa.html' },
  { key: 'historial', label: 'Historial', ic: '🕘', href: 'historial.html' },
  { key: 'perfil', label: 'Perfil', ic: '👤', href: 'perfil.html' },
];

/* Menú de la empresa de biomasa / compostaje o transportista. */
const NAV_EMPRESA = [
  { key: 'inicio', label: 'Inicio', ic: '🏠', href: 'inicio-empresa.html' },
  { key: 'cargas', label: 'Cargas', ic: '🌾', href: 'cargas.html' },
  { key: 'rutas', label: 'Retiros', ic: '🚚', href: 'rutas.html' },
  { key: 'mapa', label: 'Mapa', ic: '🗺️', href: 'mapa.html' },
  { key: 'config', label: 'Ajustes', ic: '⚙️', href: 'configuracion.html' },
];

/* Menú del chofer. Su trabajo es tomar servicios y conducir, así que el
   menú es corto a propósito: todo lo demás distrae al volante. */
const NAV_CHOFER = [
  { key: 'inicio', label: 'Servicios', ic: '📋', href: 'inicio-chofer.html' },
  { key: 'viaje', label: 'Mi viaje', ic: '🚚', href: 'viaje.html' },
  { key: 'mapa', label: 'Mapa', ic: '🗺️', href: 'mapa.html' },
  { key: 'config', label: 'Ajustes', ic: '⚙️', href: 'configuracion.html' },
];

/* Menú de la administración de VITILOG. */
const NAV_ADMIN = [
  { key: 'admin', label: 'Panel', ic: '🛠️', href: 'admin.html' },
  { key: 'mapa', label: 'Mapa', ic: '🗺️', href: 'mapa.html' },
  { key: 'config', label: 'Ajustes', ic: '⚙️', href: 'configuracion.html' },
];


/* ============ Mapa propio de la Región del Maule ============
   Dibujo en SVG, sin librerías ni conexión a internet. La geografía está
   trazada sobre coordenadas reales: el viewBox de 1000x808 corresponde al
   recuadro definido en DATA.mapaMarco, y su proporción es la misma que la del
   terreno (227 km x 183 km), así que el mapa no queda deformado.
   Los marcadores van dentro del SVG, de modo que cualquier punto con lat/lng
   —incluidas las empresas registradas— aparece en su lugar exacto. */
const MAPA_SVG = `
<svg class="map-geo" viewBox="0 0 1000 808" preserveAspectRatio="xMidYMid meet" role="img"
     aria-label="Mapa de la Región del Maule">
  <rect class="geo-tierra" x="0" y="0" width="1000" height="808"/>

  <!-- Océano Pacífico, al oeste de la línea de costa real -->
  <path class="geo-mar" d="M380,0 L312,98 L280,196 L216,309 L180,416 L148,504 L92,637 L40,808 L0,808 L0,0 Z"/>

  <!-- Cordillera de la Costa -->
  <g class="geo-cerros">
    <path d="M330,120 L360,70 L390,120 Z"/><path d="M375,150 L405,100 L435,150 Z"/>
    <path d="M300,230 L330,180 L360,230 Z"/><path d="M345,265 L375,215 L405,265 Z"/>
    <path d="M270,350 L300,300 L330,350 Z"/><path d="M315,385 L345,335 L375,385 Z"/>
    <path d="M240,470 L270,420 L300,470 Z"/><path d="M285,500 L315,450 L345,500 Z"/>
    <path d="M205,590 L235,540 L265,590 Z"/><path d="M250,620 L280,570 L310,620 Z"/>
    <path d="M165,710 L195,660 L225,710 Z"/><path d="M215,745 L245,695 L275,745 Z"/>
  </g>

  <!-- Cordillera de los Andes, al este -->
  <path class="geo-andes" d="M810,0 L1000,0 L1000,808 L790,808 C830,700 780,600 825,500 C860,400 800,300 845,200 C870,120 800,60 810,0 Z"/>
  <g class="geo-nieve">
    <path d="M820,110 L860,40 L900,110 Z"/><path d="M885,90 L925,20 L965,90 Z"/>
    <path d="M840,260 L880,190 L920,260 Z"/><path d="M900,240 L940,170 L980,240 Z"/>
    <path d="M815,410 L855,340 L895,410 Z"/><path d="M880,390 L920,320 L960,390 Z"/>
    <path d="M835,560 L875,490 L915,560 Z"/><path d="M895,540 L935,470 L975,540 Z"/>
    <path d="M810,710 L850,640 L890,710 Z"/><path d="M875,690 L915,620 L955,690 Z"/>
  </g>

  <!-- Ruta 5 Sur, por el Valle Central -->
  <path class="geo-ruta" d="M656,0 L668,83 L684,140 L652,191 L600,269 L518,356 L500,402 L488,438 L478,475 L532,561 L500,632 L450,707 L420,808"/>

  <!-- Rótulos geográficos -->
  <g class="geo-texto">
    <text x="70" y="150">OCÉANO</text><text x="70" y="180">PACÍFICO</text>
    <text x="330" y="640" transform="rotate(-72 330 640)">CORDILLERA DE LA COSTA</text>
    <text x="915" y="470" transform="rotate(-90 915 470)">CORDILLERA DE LOS ANDES</text>
    <text x="600" y="790">VALLE CENTRAL</text>
  </g>

  <!-- Aquí se insertan los marcadores -->
  <g class="geo-marcadores"></g>
</svg>`;

const Shell = {
  /* Aplica el tema guardado lo antes posible. */
  applyTheme() {
    document.documentElement.setAttribute('data-theme', Store.isDark() ? 'dark' : 'light');
  },

  /* Menú y página de inicio que corresponden a cada rol. */
  navFor(rol) {
    if (rol === Store.ROL_ADMIN) return NAV_ADMIN;
    if (rol === Store.ROL_CHOFER) return NAV_CHOFER;
    return rol === Store.ROL_EMPRESA ? NAV_EMPRESA : NAV_VINATERO;
  },
  homeFor(rol) {
    if (rol === Store.ROL_ADMIN) return 'admin.html';
    if (rol === Store.ROL_CHOFER) return 'inicio-chofer.html';
    return rol === Store.ROL_EMPRESA ? 'inicio-empresa.html' : 'inicio.html';
  },

  /* Inicializa una página protegida. Devuelve una promesa porque primero
     carga los datos (de la base compartida o de localStorage).
     · Sin sesión -> vuelve al login.
     · Con la opción "rol", si la cuenta es de otro tipo la manda a su inicio. */
  async init(activeKey, { guard = true, rol = null } = {}) {
    this.applyTheme();
    await Store.sincronizar();

    const user = Store.currentUser();
    if (guard && !user) {
      location.href = 'login.html';
      return false;
    }
    const rolActual = user ? Store.rolDe(user) : Store.ROL_VINATERO;
    if (rol && rolActual !== rol) {
      location.href = this.homeFor(rolActual);
      return false;
    }
    this._renderNav(activeKey, rolActual);
    this._ensureOverlays();
    this.pintarMapas();
    this._avisarOrigen();
    // Varias páginas arman su contenido después de init(); al terminar de
    // cargar el documento se vuelve a pasar por los mapas que aparecieron.
    document.addEventListener('DOMContentLoaded', () => this.pintarMapas());
    return true;
  },

  /* Si se pidió la base compartida y no se pudo, hay que decirlo: el usuario
     estaría viendo datos locales creyendo que están sincronizados. */
  _avisarOrigen() {
    const problema = Store.aviso();
    if (!problema) return;
    setTimeout(() => this.toast('⚠️ ' + problema), 600);
  },

  /* Dibuja la geografía de respaldo dentro de cada recuadro de mapa.
     Es idempotente y respeta los recuadros marcados como mapa real. */
  pintarMapas() {
    document.querySelectorAll('.map-sim').forEach(box => {
      if (box.dataset.mapaReal) return;
      if (!box.querySelector('.map-geo')) box.insertAdjacentHTML('afterbegin', MAPA_SVG);
    });
  },

  /* Dibuja los marcadores dentro del mapa propio a partir de lat/lng.
     Al ir dentro del SVG comparten el sistema de coordenadas del dibujo, así
     que quedan en su lugar exacto sin importar el tamaño del recuadro. */
  dibujarMarcadores(contenedor, puntos, { alHacerClic = null, usuario = null, escala = 1, etiquetas = true } = {}) {
    const capa = contenedor.querySelector('.geo-marcadores');
    if (!capa) return;
    const NS = 'http://www.w3.org/2000/svg';
    const nuevo = t => document.createElementNS(NS, t);
    capa.innerHTML = '';

    // Solo se rotula una vez por comuna, para que no se amontonen los nombres.
    const rotuladas = new Set();

    (puntos || []).forEach(p => {
      if (typeof p.lat !== 'number' || typeof p.lng !== 'number') return;
      const pos = proyectar(p.lat, p.lng);
      const entrega = recibeSarmientos(p.tipo);

      const g = nuevo('g');
      g.setAttribute('class', 'marcador' + (entrega ? ' entrega' : '') + (p.registrada ? ' registrada' : ''));
      g.setAttribute('transform', `translate(${pos.x.toFixed(1)},${pos.y.toFixed(1)})`);

      const titulo = nuevo('title');
      titulo.textContent = `${p.nombre} · ${p.tipo} · ${p.comuna}`
        + (p.activo === false ? ' (sin cupos)' : '');
      g.appendChild(titulo);

      const halo = nuevo('circle');
      halo.setAttribute('class', 'halo');
      halo.setAttribute('r', (entrega ? 22 : 16) * escala);
      g.appendChild(halo);

      const centro = nuevo('circle');
      centro.setAttribute('class', 'centro');
      centro.setAttribute('r', (entrega ? 13 : 9) * escala);
      centro.setAttribute('fill', tipoColor(p.tipo, p.activo));
      g.appendChild(centro);

      if (etiquetas && !rotuladas.has(p.comuna)) {
        rotuladas.add(p.comuna);
        const t = nuevo('text');
        t.setAttribute('class', 'nombre');
        t.setAttribute('y', -30 * escala);
        if (escala !== 1) t.setAttribute('font-size', 22 * escala);
        t.textContent = p.comuna;
        g.appendChild(t);
      }

      if (alHacerClic) g.addEventListener('click', () => alHacerClic(p));
      capa.appendChild(g);
    });

    if (usuario && typeof usuario.lat === 'number') {
      const pos = proyectar(usuario.lat, usuario.lng);
      const g = nuevo('g');
      g.setAttribute('class', 'marcador yo');
      g.setAttribute('transform', `translate(${pos.x.toFixed(1)},${pos.y.toFixed(1)})`);

      const titulo = nuevo('title');
      titulo.textContent = usuario.etiqueta + (usuario.comuna ? ' · ' + usuario.comuna : '');
      g.appendChild(titulo);

      const halo = nuevo('circle');
      halo.setAttribute('class', 'halo-yo');
      halo.setAttribute('r', 26 * escala);
      g.appendChild(halo);

      const casa = nuevo('text');
      casa.setAttribute('class', 'icono-yo');
      casa.setAttribute('y', 9 * escala);
      if (escala !== 1) casa.setAttribute('font-size', 30 * escala);
      casa.textContent = usuario.origen === 'gps' ? '🎯' : '🏠';
      g.appendChild(casa);

      const t = nuevo('text');
      t.setAttribute('class', 'nombre yo');
      t.setAttribute('y', -32 * escala);
      if (escala !== 1) t.setAttribute('font-size', 22 * escala);
      t.textContent = usuario.etiqueta;
      g.appendChild(t);

      capa.appendChild(g);
    }
  },

  /* Recorta el mapa alrededor de un punto, respetando la forma del recuadro.
     Se usa en la vista previa pequeña del inicio. */
  encuadrarMapa(svg, centro, anchoGrados = 1.0) {
    if (!svg || !centro || typeof centro.lat !== 'number') return;
    const m = DATA.mapaMarco;
    const caja = svg.getBoundingClientRect();
    const proporcion = caja.width ? caja.height / caja.width : 0.4;
    const w = anchoGrados / (m.este - m.oeste) * m.ancho;
    const h = Math.max(w * proporcion, 1);
    const p = proyectar(centro.lat, centro.lng);
    svg.setAttribute('viewBox',
      `${(p.x - w / 2).toFixed(1)} ${(p.y - h / 2).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  },

  /* ¿Hay una clave de Google Maps configurada en js/config.js? */
  hayClaveMaps() {
    return typeof GOOGLE_MAPS_API_KEY === 'string' && GOOGLE_MAPS_API_KEY.trim() !== '';
  },

  /* Carga la API de Google Maps una sola vez.
     Devuelve una promesa: si falla (sin clave, sin internet o clave inválida)
     la página se queda con el mapa esquemático. */
  cargarGoogleMaps({ timeout = 10000 } = {}) {
    if (this._promesaMaps) return this._promesaMaps;

    this._promesaMaps = new Promise((resolve, reject) => {
      if (!this.hayClaveMaps()) return reject(new Error('sin-clave'));
      if (window.google && window.google.maps) return resolve();

      const reloj = setTimeout(() => reject(new Error('sin-conexion')), timeout);

      // Google llama a esta función si la clave es inválida o se pasó de cuota.
      window.gm_authFailure = () => { clearTimeout(reloj); reject(new Error('clave-rechazada')); };

      // Patrón de carga recomendado por Google: loading=async + callback.
      window.__vitilogMapsListo = () => { clearTimeout(reloj); resolve(); };

      const s = document.createElement('script');
      s.async = true;
      s.src = 'https://maps.googleapis.com/maps/api/js'
        + '?key=' + encodeURIComponent(GOOGLE_MAPS_API_KEY)
        + '&language=es&region=CL&loading=async&callback=__vitilogMapsListo';
      s.onerror = () => { clearTimeout(reloj); reject(new Error('sin-conexion')); };
      document.head.appendChild(s);
    });

    return this._promesaMaps;
  },

  /* Google carga la librería aunque la clave sea inválida, pero en ese caso
     no llega a dibujar el mapa. Se comprueba que haya aparecido el lienzo. */
  verificarMapaDibujado(contenedor, { espera = 2500 } = {}) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (contenedor.querySelector('.gm-style')) resolve();
        else reject(new Error('clave-rechazada'));
      }, espera);
    });
  },

  /* Arma la URL del mapa incrustado de Google, que NO necesita clave de API.
     Ojo: es un punto de acceso que Google no documenta. Funciona hoy y se usa
     mucho, pero podría cambiar sin aviso; por eso siempre queda el respaldo. */
  urlMapaIncrustado({ lat, lng, zoom = 8, etiqueta = '' } = {}) {
    const tipo = (typeof GOOGLE_MAPS_TIPO !== 'undefined' ? GOOGLE_MAPS_TIPO : 'terrain');
    const t = { roadmap: 'm', satellite: 'k', hybrid: 'h', terrain: 'p' }[tipo] || 'p';
    // Con etiqueta se marca el punto; sin ella solo se centra la vista.
    const ubicacion = etiqueta
      ? 'q=' + encodeURIComponent(`${lat},${lng} (${etiqueta})`)
      : 'q=' + encodeURIComponent(`${lat},${lng}`) + '&iwloc=near';
    return `https://maps.google.com/maps?${ubicacion}&z=${zoom}&t=${t}&hl=es&output=embed`;
  },

  /* -------- Ubicación del usuario -------- */

  /* Coordenadas de una comuna del listado de data.js. */
  coordComuna(nombre) {
    const buscado = String(nombre || '').trim().toLowerCase();
    const c = DATA.comunas.find(x => x.nombre.toLowerCase() === buscado);
    return c ? { lat: c.lat, lng: c.lng } : null;
  },

  /* Ubicación asociada a la cuenta, a partir de la comuna que eligió al
     registrarse. Sirve igual para el viñatero y para la empresa. */
  ubicacionCuenta() {
    const u = Store.currentUser();
    if (!u) return null;
    const c = this.coordComuna(u.comuna);
    if (!c) return null;
    const esEmpresa = Store.rolDe(u) === Store.ROL_EMPRESA;
    return {
      ...c,
      comuna: u.comuna,
      nombre: u.nombre,
      etiqueta: esEmpresa ? 'Tu base' : 'Tu viñedo',
      origen: 'comuna',
    };
  },

  /* Pide la ubicación actual al navegador.
     Requiere permiso del usuario y que la página se sirva por http://localhost
     o https://. Abierta como archivo (file://) los navegadores la bloquean. */
  pedirGPS({ timeout = 10000 } = {}) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('sin-soporte'));
      navigator.geolocation.getCurrentPosition(
        pos => resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precision: Math.round(pos.coords.accuracy),
          etiqueta: 'Estás aquí',
          origen: 'gps',
        }),
        err => reject(new Error(
          err.code === 1 ? 'permiso-denegado'
          : err.code === 3 ? 'tiempo-agotado'
          : 'sin-senal')),
        { enableHighAccuracy: true, timeout, maximumAge: 60000 }
      );
    });
  },

  motivoGPS(err) {
    const causa = err && err.message;
    if (causa === 'permiso-denegado') return 'No diste permiso de ubicación. Puedes habilitarlo desde el candado de la barra de direcciones.';
    if (causa === 'tiempo-agotado') return 'La ubicación tardó demasiado. Inténtalo de nuevo.';
    if (causa === 'sin-soporte') return 'Este navegador no permite compartir la ubicación.';
    if (causa === 'sin-origen-seguro') return 'Para usar la ubicación, abre el sitio por http://localhost o https:// (no funciona con doble clic en el archivo).';
    return 'No se pudo obtener tu ubicación.';
  },

  /* ¿El navegador permitirá pedir la ubicación en esta página? */
  puedePedirGPS() {
    return !!navigator.geolocation && (window.isSecureContext || location.hostname === 'localhost');
  },

  /* -------- Empresas ubicadas en el mapa -------- */

  /* =====================================================================
     Pantallas que se actualizan solas
     ===================================================================== */
  /* Conecta una pantalla con los cambios de la base.

     Si hay base compartida, escucha en vivo por WebSocket y redibuja apenas
     algo cambia. Si no la hay (o el navegador bloquea los WebSocket), vuelve
     a preguntar cada cierto rato, que es lento pero nunca deja la pantalla
     desactualizada. En los dos casos se corta solo al salir de la página.

       const baja = Shell.enVivo(['cargas'], render);

     Devuelve la función para darse de baja a mano, si hiciera falta. */
  enVivo(tablas, alCambiar, { cadaMs = 20000 } = {}) {
    let cancelada = false;
    let baja = null;
    let reloj = null;

    const avisar = info => {
      if (cancelada) return;
      try { alCambiar(info); }
      catch (e) { /* un error al redibujar no debe matar la escucha */ }
    };

    if (typeof Vivo !== 'undefined' && Vivo.disponible()) {
      baja = Vivo.escuchar(tablas, avisar);
    } else {
      /* Respaldo: se recarga la base cada tanto. Solo mientras la pestaña
         esté a la vista, para no gastar datos ni batería de fondo. */
      reloj = setInterval(async () => {
        if (document.hidden || cancelada) return;
        try {
          await Store.sincronizar({ forzar: true });
          avisar({ tabla: null, tipo: 'RECARGA', fila: null });
        } catch (e) { /* se reintenta en el siguiente giro */ }
      }, cadaMs);
    }

    const cortar = () => {
      if (cancelada) return;
      cancelada = true;
      if (baja) baja();
      if (reloj) clearInterval(reloj);
      window.removeEventListener('pagehide', cortar);
    };
    window.addEventListener('pagehide', cortar);
    return cortar;
  },

  /* Etiqueta chica que dice si la pantalla se está actualizando sola. */
  indicadorVivo(estado) {
    const mapa = {
      vivo: ['#2E7D32', '🟢', 'En vivo'],
      conectando: ['#F9A825', '🟡', 'Conectando…'],
      caido: ['#E53935', '🔴', 'Sin conexión en vivo'],
      apagado: ['#78909C', '⚪', 'Actualización periódica'],
    };
    const [color, ic, texto] = mapa[estado] || mapa.apagado;
    return this.badge(texto, color, ic);
  },

  /* Cómo se presenta un transportista: por su cuenta o conduciendo para una
     empresa. Es el mismo perfil con las mismas herramientas; esto solo sirve
     para que el viñatero sepa con quién está tratando. */
  etiquetaModalidad(cuenta) {
    if (!cuenta) return '';
    if (cuenta.modalidad === 'empresa') {
      const nombre = (cuenta.empresa_nombre || '').trim();
      return nombre ? 'Conduce para ' + nombre : 'Parte de una empresa de transporte';
    }
    return 'Transportista independiente';
  },

  /* Empresas que se registraron en este navegador, ubicadas por la comuna que
     eligieron. Se excluye la cuenta con la sesión abierta: esa ya aparece
     marcada aparte como "Tu base". */
  empresasRegistradas() {
    const propia = Store.currentEmail();
    return Store.accounts()
      .filter(a => Store.rolDe(a) === Store.ROL_EMPRESA && a.email !== propia)
      .map(a => {
        const c = this.coordComuna(a.comuna);
        if (!c) return null;                       // comuna que el mapa no ubica
        return {
          id: 'cuenta-' + a.email,
          nombre: a.nombre,
          tipo: a.tipo || 'Biomasa',
          comuna: a.comuna,
          desc: 'Empresa registrada en VITILOG.'
            + (a.encargado ? ' Contacto: ' + a.encargado + '.' : ''),
          cap: null, activo: true, registrada: true,
          email: a.email, telefono: a.telefono || '',
          lat: c.lat, lng: c.lng,
        };
      })
      .filter(Boolean);
  },

  /* Todo lo que va al mapa: las plantas y centros fijos de data.js más las
     empresas que se registraron en la plataforma. */
  puntosMapa() {
    return Store.puntos().concat(this.empresasRegistradas());
  },

  /* Lo que muestra el buscador de empresas: solo las que reciben sarmientos
     (biomasa y compostaje), con la distancia calculada desde el usuario. */
  empresasParaBuscador() {
    const yo = this.ubicacionCuenta();
    return this.puntosMapa()
      .filter(p => recibeSarmientos(p.tipo))
      .map(p => ({ ...p, km: this.distanciaKm(yo, p) }))
      .sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9));
  },

  /* =====================================================================
     Seguimiento de envíos
     =====================================================================
     La posición del camión viene de dos fuentes posibles:
       · GPS real -> si el chofer abre la app, su ubicación se publica en
                     el envío y el viñatero la ve actualizarse.
       · Simulada -> si nadie reporta, la posición se calcula por el tiempo
                     transcurrido desde la salida. Persiste entre recargas.
     Ambas escriben en los mismos campos, así que la pantalla no distingue. */

  /* Punto intermedio entre dos coordenadas (t va de 0 a 1). */
  interpolar(a, b, t) {
    const k = Math.max(0, Math.min(1, t));
    return { lat: a.lat + (b.lat - a.lat) * k, lng: a.lng + (b.lng - a.lng) * k };
  },

  /* Avance esperado según el tiempo transcurrido desde la salida. */
  progresoPorTiempo(envio) {
    if (!envio.salida || !envio.minutosTotal) return envio.progreso || 0;
    const transcurrido = (Date.now() - new Date(envio.salida).getTime()) / 60000;
    return Math.max(0, Math.min(1, transcurrido / envio.minutosTotal));
  },

  /* Estado que corresponde a un avance dado y a la distancia que falta.
     "Llegando" exige las dos condiciones: estar cerca y llevar buena parte
     del camino hecho. Si no, un trayecto corto arrancaría ya en "llegando". */
  estadoPorAvance(envio, progreso, kmRestantes) {
    // Mientras el transportista no acepte, el viaje no empezó: ningún
    // cálculo de avance debe adelantarlo.
    if (envio.estado === 'asignado') return 'asignado';
    if (progreso <= 0) return 'programado';
    if (progreso >= 1) return envio.estado === 'entregado' ? 'entregado' : 'en_destino';
    const cerca = kmRestantes != null && kmRestantes <= 15;
    if (cerca && progreso >= 0.75) return 'llegando';
    return 'en_camino';
  },

  /* Recalcula posición, estado y llegada estimada de un envío.
     Devuelve los datos ya listos para mostrar, sin tocar la base. */
  calcularSeguimiento(envio) {
    const origen = { lat: envio.origenLat, lng: envio.origenLng };
    const destino = { lat: envio.destinoLat, lng: envio.destinoLng };

    // Si hay posición reportada por GPS, manda sobre la simulación. Pero si
    // dejó de llegar hace rato, se vuelve a la estimación: mostrar una
    // posición vieja como si fuera actual sería peor que estimarla.
    const hayGps = typeof envio.vehLat === 'number'
      && typeof envio.vehLng === 'number'
      && !this.senalPerdida(envio);
    const progreso = envio.estado === 'entregado' ? 1 : this.progresoPorTiempo(envio);
    const posicion = hayGps ? { lat: envio.vehLat, lng: envio.vehLng }
                            : this.interpolar(origen, destino, progreso);

    const kmTotal = this.distanciaKm(origen, destino);
    const kmRestantes = this.distanciaKm(posicion, destino);
    const estado = (envio.estado === 'entregado' || envio.estado === 'asignado')
                 ? envio.estado
                 : this.estadoPorAvance(envio, progreso, kmRestantes);

    // Minutos que faltan, proporcionales a la distancia que queda.
    const minutosRestantes = (kmTotal > 0 && estado !== 'en_destino' && estado !== 'entregado')
      ? Math.max(0, Math.round(envio.minutosTotal * (kmRestantes / kmTotal)))
      : 0;

    return {
      posicion, progreso, estado, kmTotal, kmRestantes, minutosRestantes,
      fuente: hayGps ? 'gps' : 'estimada',
      eta: minutosRestantes > 0
        ? new Date(Date.now() + minutosRestantes * 60000)
            .toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
        : null,
    };
  },

  /* Guarda el estado recalculado si cambió. Devuelve el estado anterior
     cuando hubo transición, para poder avisar al usuario. */
  async sincronizarEnvio(envio) {
    const s = this.calcularSeguimiento(envio);
    if (s.estado === envio.estado && Math.abs(s.progreso - (envio.progreso || 0)) < 0.01) {
      return { seguimiento: s, cambio: null };
    }
    const anterior = envio.estado;
    await Store.actualizarEnvio(envio.id, { estado: s.estado, progreso: s.progreso });
    return { seguimiento: s, cambio: anterior !== s.estado ? anterior : null };
  },

  /* El chofer publica su ubicación real en el envío, una sola vez. */
  async reportarPosicion(envioId) {
    const gps = await this.pedirGPS();
    return Store.reportarPosicionEnvio(envioId, gps);
  },

  /* =====================================================================
     Transmisión continua de posición (lado del chofer)
     =====================================================================
     watchPosition avisa cada vez que el GPS detecta movimiento, lo que en
     carretera puede ser varias veces por segundo. Escribir todo eso en la
     base gastaría datos y batería sin aportar precisión, así que se guarda
     solo cuando pasó bastante tiempo O el camión se movió lo suficiente. */
  _emisor: null,

  iniciarTransmision(envioId, {
    cadaSegundos = 15,      // nunca se escribe más seguido que esto
    cadaMetros = 120,       // ni si el camión casi no se movió
    alActualizar = null,    // aviso para refrescar la pantalla
    alFallar = null,
  } = {}) {
    if (!navigator.geolocation) {
      if (alFallar) alFallar(new Error('sin-soporte'));
      return false;
    }
    this.detenerTransmision();

    let ultimaEscritura = 0;
    let ultimaPos = null;

    const vigia = navigator.geolocation.watchPosition(
      async pos => {
        const actual = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precision: Math.round(pos.coords.accuracy),
        };
        const ahora = Date.now();
        const segundos = (ahora - ultimaEscritura) / 1000;
        const metros = ultimaPos ? this.distanciaKm(ultimaPos, actual) * 1000 : Infinity;

        // Primera lectura siempre se guarda; después, solo si toca.
        if (ultimaEscritura && segundos < cadaSegundos && metros < cadaMetros) return;

        ultimaEscritura = ahora;
        ultimaPos = actual;
        try {
          await Store.reportarPosicionEnvio(envioId, actual);
          if (alActualizar) alActualizar(actual, { segundos, metros });
        } catch (e) {
          if (alFallar) alFallar(e);
        }
      },
      err => {
        if (alFallar) {
          alFallar(new Error(err.code === 1 ? 'permiso-denegado'
            : err.code === 3 ? 'tiempo-agotado' : 'sin-senal'));
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );

    this._emisor = { vigia, envioId };
    return true;
  },

  detenerTransmision() {
    if (this._emisor) {
      navigator.geolocation.clearWatch(this._emisor.vigia);
      this._emisor = null;
    }
  },

  transmitiendo() { return this._emisor !== null; },

  /* Hace cuánto llegó la última posición, en texto legible. */
  frescura(envio) {
    if (!envio || !envio.posicionAt) return null;
    const seg = Math.round((Date.now() - new Date(envio.posicionAt).getTime()) / 1000);
    if (seg < 60) return 'hace ' + seg + ' s';
    const min = Math.round(seg / 60);
    if (min < 60) return 'hace ' + min + ' min';
    return 'hace ' + Math.round(min / 60) + ' h';
  },

  /* Una señal se considera perdida si no llega nada en dos minutos. */
  senalPerdida(envio) {
    if (!envio || !envio.posicionAt) return false;
    return (Date.now() - new Date(envio.posicionAt).getTime()) > 120000;
  },

  /* Acerca el mapa hasta encuadrar el recorrido completo.
     Sin esto, un viaje de pocos kilómetros queda como un punto único sobre
     un mapa de 227 km y los tres marcadores se amontonan. */
  encuadrarRuta(svg, envio, seguimiento) {
    if (!svg) return;
    const puntos = [
      proyectar(envio.origenLat, envio.origenLng),
      proyectar(envio.destinoLat, envio.destinoLng),
      proyectar(seguimiento.posicion.lat, seguimiento.posicion.lng),
    ];
    const xs = puntos.map(p => p.x), ys = puntos.map(p => p.y);
    const m = DATA.mapaMarco;

    // Margen generoso: los marcadores y sus rótulos ocupan espacio propio.
    const MARGEN = 70, MINIMO = 300;
    let x1 = Math.min(...xs) - MARGEN, x2 = Math.max(...xs) + MARGEN;
    let y1 = Math.min(...ys) - MARGEN, y2 = Math.max(...ys) + MARGEN;

    let ancho = Math.max(x2 - x1, MINIMO);
    const caja = svg.getBoundingClientRect();
    const proporcion = caja.width ? caja.height / caja.width : 0.6;
    let alto = Math.max(y2 - y1, ancho * proporcion);
    ancho = Math.max(ancho, alto / proporcion);

    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
    // Se mantiene dentro del dibujo para no mostrar vacío fuera del marco.
    const px = Math.min(Math.max(cx - ancho / 2, 0), Math.max(0, m.ancho - ancho));
    const py = Math.min(Math.max(cy - alto / 2, 0), Math.max(0, m.alto - alto));

    svg.setAttribute('viewBox', `${px.toFixed(1)} ${py.toFixed(1)} ${ancho.toFixed(1)} ${alto.toFixed(1)}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    // Al acercar, los marcadores deben encogerse para no tapar el mapa.
    svg.dataset.escalaRuta = (ancho / m.ancho).toFixed(3);
  },

  /* Dibuja el recorrido y el camión sobre el mapa propio. */
  dibujarRuta(contenedor, envio, seguimiento) {
    const capa = contenedor.querySelector('.geo-marcadores');
    if (!capa) return;
    const NS = 'http://www.w3.org/2000/svg';
    const nuevo = t => document.createElementNS(NS, t);

    const o = proyectar(envio.origenLat, envio.origenLng);
    const d = proyectar(envio.destinoLat, envio.destinoLng);
    const v = proyectar(seguimiento.posicion.lat, seguimiento.posicion.lng);

    // Tramo completo, en gris, y encima el tramo ya recorrido.
    const total = nuevo('line');
    total.setAttribute('class', 'ruta-total');
    total.setAttribute('x1', o.x); total.setAttribute('y1', o.y);
    total.setAttribute('x2', d.x); total.setAttribute('y2', d.y);
    capa.appendChild(total);

    const hecho = nuevo('line');
    hecho.setAttribute('class', 'ruta-hecha');
    hecho.setAttribute('x1', o.x); hecho.setAttribute('y1', o.y);
    hecho.setAttribute('x2', v.x); hecho.setAttribute('y2', v.y);
    capa.appendChild(hecho);

    // Si el mapa está acercado, todo se dibuja proporcionalmente más chico.
    const svg = contenedor.querySelector('.map-geo');
    const k = svg && svg.dataset.escalaRuta ? parseFloat(svg.dataset.escalaRuta) : 1;

    const marca = (pos, clase, icono, etiqueta, arriba) => {
      const g = nuevo('g');
      g.setAttribute('class', clase);
      g.setAttribute('transform', `translate(${pos.x.toFixed(1)},${pos.y.toFixed(1)})`);
      const halo = nuevo('circle');
      halo.setAttribute('class', 'halo');
      halo.setAttribute('r', 20 * k);
      g.appendChild(halo);
      const t = nuevo('text');
      t.setAttribute('class', 'icono-ruta');
      t.setAttribute('y', 9 * k);
      // En línea, no como atributo: la hoja de estilos le ganaría al atributo.
      t.style.fontSize = (26 * k) + 'px';
      t.textContent = icono;
      g.appendChild(t);
      if (etiqueta) {
        const e = nuevo('text');
        e.setAttribute('class', 'nombre');
        // Origen y destino se rotulan en lados opuestos para no pisarse.
        e.setAttribute('y', (arriba ? -30 : 42) * k);
        e.style.fontSize = (20 * k) + 'px';
        e.style.strokeWidth = (4.5 * k) + 'px';
        e.textContent = etiqueta;
        g.appendChild(e);
      }
      capa.appendChild(g);
    };

    marca(o, 'marcador ruta-origen', '🍇', envio.origenComuna, true);
    marca(d, 'marcador ruta-destino', '🏭', envio.destinoNombre, false);
    marca(v, 'marcador ruta-vehiculo', '🚚', null, true);
  },

  /* =====================================================================
     Notificaciones del navegador
     ===================================================================== */
  puedeNotificar() {
    return typeof Notification !== 'undefined' && window.isSecureContext;
  },

  async pedirPermisoNotificaciones() {
    if (!this.puedeNotificar()) return 'no-disponible';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    try { return await Notification.requestPermission(); }
    catch (e) { return 'denied'; }
  },

  /* Avisa por notificación del sistema y además con un mensaje en pantalla,
     para que el aviso se vea aunque el permiso esté denegado. */
  notificar(titulo, cuerpo) {
    this.toast(titulo + (cuerpo ? ' · ' + cuerpo : ''));
    if (!this.puedeNotificar() || Notification.permission !== 'granted') return;
    try { new Notification(titulo, { body: cuerpo, icon: 'data:,', tag: 'vitilog' }); }
    catch (e) { /* algunos navegadores la bloquean fuera de un service worker */ }
  },

  /* Distancia en línea recta entre dos coordenadas, en kilómetros. */
  distanciaKm(a, b) {
    if (!a || !b) return null;
    const R = 6371;                       // radio de la Tierra en km
    const rad = g => g * Math.PI / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2
      + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(h)));
  },

  /* Decide qué mapa mostrar según js/config.js y el estado de la conexión. */
  modoMapa() {
    const modo = (typeof MODO_MAPA !== 'undefined' ? MODO_MAPA : 'propio');
    if (modo !== 'auto') return modo;
    if (navigator.onLine === false) return 'propio';
    return this.hayClaveMaps() ? 'clave' : 'incrustado';
  },

  /* Mensaje para el usuario según por qué no se pudo usar Google Maps. */
  motivoRespaldo(err) {
    const causa = err && err.message;
    if (causa === 'modo-propio') return '';
    if (causa === 'sin-clave') return 'Falta la clave de Google Maps en js/config.js.';
    if (causa === 'clave-rechazada') return 'Google rechazó la clave: revisa que la "Maps JavaScript API" esté habilitada.';
    return 'No se pudo conectar con Google Maps.';
  },

  _renderNav(active, rol) {
    const nav = this.navFor(rol);
    const etiquetaRol = rol === Store.ROL_ADMIN ? '🛠️ Administración VITILOG'
      : rol === Store.ROL_EMPRESA ? '🏭 Cuenta de planta receptora'
      : rol === Store.ROL_CHOFER ? '🚚 Cuenta de transportista'
      : '🍇 Cuenta de viñatero';
    const links = nav.map(n => `
      <a class="nav-link ${n.key === active ? 'active' : ''}" href="${n.href}">
        <span class="ic">${n.ic}</span> ${n.label}
      </a>`).join('');

    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      // Configuración solo va al pie si el menú del rol no la incluye ya.
      const configEnMenu = nav.some(n => n.href === 'configuracion.html');
      sidebar.innerHTML = `
        <div class="brand"><div class="logo">🌿</div><b>VITILOG</b></div>
        <div class="nav-role">${etiquetaRol}</div>
        ${links}
        <div class="spacer"></div>
        ${configEnMenu ? '' : `<a class="nav-link ${active === 'config' ? 'active' : ''}" href="configuracion.html"><span class="ic">⚙️</span> Configuración</a>`}
        <a class="nav-link" href="#" onclick="Shell.logout();return false;"><span class="ic">🚪</span> Cerrar sesión</a>`;
    }

    const bottom = document.getElementById('bottomnav');
    if (bottom) {
      bottom.innerHTML = nav.map(n => `
        <a class="${n.key === active ? 'active' : ''}" href="${n.href}">
          <span class="ic">${n.ic}</span>${n.label}
        </a>`).join('');
    }
  },

  _ensureOverlays() {
    if (!document.getElementById('toast')) {
      const t = document.createElement('div');
      t.className = 'toast'; t.id = 'toast';
      document.body.appendChild(t);
    }
    if (!document.getElementById('modalbg')) {
      const m = document.createElement('div');
      m.className = 'modal-bg'; m.id = 'modalbg';
      m.innerHTML = '<div class="modal" id="modal"></div>';
      m.addEventListener('click', e => { if (e.target === m) Shell.closeModal(); });
      document.body.appendChild(m);
    }
  },

  logout() {
    Store.logout();
    location.href = 'login.html';
  },

  toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._tt);
    this._tt = setTimeout(() => t.classList.remove('show'), 2400);
  },

  openModal(html) {
    this._ensureOverlays();
    document.getElementById('modal').innerHTML = html;
    document.getElementById('modalbg').classList.add('open');
  },
  closeModal() {
    const m = document.getElementById('modalbg');
    if (m) m.classList.remove('open');
  },

  /* Datos de contacto de demostración a partir del nombre. */
  contactoDemo(nombre) {
    const slug = nombre.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
    let h = 0; for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) | 0;
    h = Math.abs(h);
    const tel = `+56 9 ${1000 + (h % 9000)} ${1000 + ((h / 7 | 0) % 9000)}`;
    return { tel, email: `${slug}@vitilog.cl` };
  },

  /* Abre la ficha de contacto. Con "opciones" se pueden pasar el teléfono,
     el correo y el ícono reales (por ejemplo, los de un viñatero). */
  contactar(nombre, tipo, opciones = {}) {
    const demo = this.contactoDemo(nombre);
    const c = {
      tel: opciones.tel || demo.tel,
      email: opciones.email || demo.email,
    };
    const ic = opciones.ic || '🏢';
    this.openModal(`
      <div class="handle"></div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
        <div class="li-ic" style="background:rgba(46,125,50,.12);color:var(--primary)">${ic}</div>
        <div><b style="font-size:17px">${this.escape(nombre)}</b><div class="li-sub">${this.escape(tipo)}</div></div>
      </div>
      <a class="opt" href="tel:${c.tel.replace(/\s/g, '')}"><span class="ic">📞</span><div><b>Llamar</b><span>${c.tel}</span></div></a>
      <a class="opt" href="mailto:${c.email}?subject=Consulta%20VITILOG"><span class="ic">✉️</span><div><b>Enviar correo</b><span>${c.email}</span></div></a>
      <button class="opt" onclick="Shell.copiar('${c.tel} · ${c.email}')"><span class="ic">📋</span><div><b>Copiar datos</b><span>Teléfono y correo</span></div></button>
      <button class="btn ghost block" style="margin-top:6px" onclick="Shell.closeModal()">Cerrar</button>`);
  },

  copiar(text) {
    navigator.clipboard?.writeText(text).catch(() => {});
    this.closeModal();
    this.toast('Datos de contacto copiados');
  },

  escape(s) {
    return String(s).replace(/[&<>"']/g, m => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  },

  badge(text, color, ic) {
    return `<span class="badge" style="color:${color};background:${color}22">${ic ? ic + ' ' : ''}${text}</span>`;
  },
};

/* Aplica el tema de inmediato (evita parpadeo) aunque init() no se haya llamado. */
Shell.applyTheme();
