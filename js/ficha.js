/* ============ Resumen de la próxima ruta ============
   Una misma tarjeta para los tres perfiles, que se puede colgar en Inicio,
   Rutas e Historial sin repetir código.

   Responde dos preguntas que antes había que ir a buscar a otra pantalla:

     · ¿Cuánta energía vale esa carga?
     · ¿Cuánto falta para que llegue, desde donde estoy yo ahora?

   LO QUE MIRA CADA PERFIL
   -----------------------
     · Transportista -> su viaje en curso. Él es el vehículo, así que la
       cuenta va de su posición al destino.
     · Viñatero      -> el camión que viene por su carga; si todavía no hay
       camión, su propia carga esperando retiro.
     · Planta        -> el camión que viene en camino a recibir.

   DE DÓNDE SALE EL TIEMPO
   -----------------------
   De la distancia por carretera (js/ruteo.js), no en línea recta, y entre
   la ubicación real de quien mira (su GPS) y el objetivo. Por eso dos
   personas distintas ven tiempos distintos para el mismo camión, que es lo
   correcto: no están en el mismo lugar.

   CUÁNDO SE RECALCULA
   -------------------
   Cuando se mueve el observador y cuando se mueve el vehículo. Lo primero
   con el GPS, lo segundo por la base en vivo. Para no castigar al servicio
   de rutas, la posición del observador se redondea a unos 100 m: moverse
   dentro del patio no dispara consultas nuevas. */
const Ficha = {
  /* Rendimiento energético del sarmiento. Es una estimación de referencia,
     la misma que usa el resumen de la planta: 14 m³ ≈ 4,2 MWh. */
  MWH_POR_M3: 0.3,

  /* Cada cuánto se acepta recalcular por movimiento del observador. */
  METROS_PARA_RECALCULAR: 150,

  energia(m3) {
    return Math.round((Number(m3) || 0) * this.MWH_POR_M3 * 10) / 10;
  },

  /* Minutos a texto corto: 45 min, 1 h 20 min, 2 h. */
  duracion(min) {
    if (min == null || isNaN(min)) return null;
    const m = Math.max(0, Math.round(min));
    if (m < 60) return m + ' min';
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h} h ${r} min` : `${h} h`;
  },

  /* Hora de llegada, para decirla además de la cuenta regresiva. */
  horaLlegada(min) {
    if (min == null || isNaN(min)) return null;
    const d = new Date(Date.now() + min * 60000);
    return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  },

  /* =====================================================================
     Lo que ya aportaste: el acumulado del perfil
     =====================================================================
     Es la otra mitad del resumen. Mientras la ficha de abajo mira hacia
     adelante (lo que viene), esta mira hacia atrás: cuánto lleva aportado
     esta cuenta desde que se registró.

     Cada perfil aporta algo distinto, así que cada uno cuenta lo suyo:
     el viñatero publica sarmientos, el transportista los traslada y la
     planta los recibe. Se actualiza sola con cada publicación nueva. */
  aporte() {
    const yo = Store.currentEmail();
    const rol = Store.rolActual();
    if (!yo) return null;

    const entregado = e => e.estado === 'entregado';
    const m3De = e => (Number(e.volumenRecibido) || Number(e.volumenDeclarado) || 0)
      + (e.paradas || []).reduce((t, p) => t + (Number(p.volumen) || 0), 0);

    if (rol === Store.ROL_CHOFER) {
      const mios = Store.envios().filter(e => e.choferEmail === yo);
      const hechos = mios.filter(entregado);
      const m3 = hechos.reduce((t, e) => t + m3De(e), 0);
      return {
        titulo: 'Lo que has trasladado',
        datos: [
          { val: hechos.length, lbl: 'Viajes completados' },
          { val: Math.round(m3 * 10) / 10 + ' m³', lbl: 'Volumen trasladado' },
          { val: this.energia(m3) + ' MWh', lbl: 'Energía movida', color: 'var(--warning)' },
          { val: mios.length - hechos.length, lbl: 'En curso' },
        ],
      };
    }

    if (rol === Store.ROL_CARGADOR) {
      const mias = Store.misEstibas();
      const hechas = mias.filter(entregado);
      const m3 = hechas.reduce((t, e) => t + m3De(e), 0);
      return {
        titulo: 'Lo que has cargado',
        datos: [
          { val: hechas.length, lbl: 'Estibas completadas' },
          { val: Math.round(m3 * 10) / 10 + ' m³', lbl: 'Volumen cargado' },
          { val: this.energia(m3) + ' MWh', lbl: 'Energía movida', color: 'var(--warning)' },
          { val: mias.length - hechas.length, lbl: 'Pendientes' },
        ],
      };
    }

    if (rol === Store.ROL_EMPRESA) {
      const mios = Store.envios().filter(e => e.empresaEmail === yo);
      const recibidos = mios.filter(entregado);
      const m3 = recibidos.reduce((t, e) => t + m3De(e), 0);
      return {
        titulo: 'Lo que has recibido',
        datos: [
          { val: recibidos.length, lbl: 'Recepciones' },
          { val: Math.round(m3 * 10) / 10 + ' m³', lbl: 'Volumen recibido' },
          { val: this.energia(m3) + ' MWh', lbl: 'Energía aprovechable', color: 'var(--warning)' },
          { val: mios.length - recibidos.length, lbl: 'En camino' },
        ],
      };
    }

    // Viñatero
    const mias = Store.cargasPublicadas().filter(c => c.email === yo);
    const m3 = mias.reduce((t, c) => t + (Number(c.volumen) || 0), 0);
    const retirados = Store.envios().filter(e => e.vinateroEmail === yo && entregado(e));
    return {
      titulo: 'La carga que has aportado',
      datos: [
        { val: mias.length, lbl: 'Cargas publicadas' },
        { val: Math.round(m3 * 10) / 10 + ' m³', lbl: 'Sarmientos aportados' },
        { val: this.energia(m3) + ' MWh', lbl: 'Energía equivalente', color: 'var(--warning)' },
        { val: retirados.length, lbl: 'Retiros completados' },
      ],
    };
  },

  _htmlAporte(a) {
    /* El título lo pone el módulo porque cambia según el perfil: no es lo
       mismo aportar sarmientos que trasladarlos o recibirlos. */
    return `
      <div class="section-title">${a.titulo}</div>
      <div class="card pad ficha-ruta">
        <div class="ficha-datos">
          ${a.datos.map(d => `
            <div>
              <div class="dato-grande" ${d.color ? `style="color:${d.color}"` : ''}>${d.val}</div>
              <div class="dato-rotulo">${d.lbl}</div>
            </div>`).join('')}
        </div>
      </div>`;
  },

  /* Deja el acumulado al día: se redibuja con cada carga o envío nuevo. */
  montarAporte(contenedor) {
    if (!contenedor) return () => {};
    const pintar = () => {
      const a = this.aporte();
      contenedor.innerHTML = a ? this._htmlAporte(a) : '';
    };
    pintar();
    const baja = Shell.enVivo(['cargas', 'envios'], pintar);
    return baja;
  },

  /* -------- Qué mostrarle a quien está mirando --------
     Devuelve null si no hay nada próximo que resumir. */
  objetivo() {
    const rol = Store.rolActual();

    if (rol === Store.ROL_CHOFER) {
      const e = Store.servicioActivo();
      if (!e) return null;
      const seg = Shell.calcularSeguimiento(e);
      return {
        tipo: 'viaje',
        envio: e,
        titulo: 'Tu viaje en curso',
        subtitulo: `${e.origenComuna} → ${e.destinoNombre}`,
        // El transportista va con la carga: lo que falta es llegar.
        destino: { lat: e.destinoLat, lng: e.destinoLng },
        volumen: (Number(e.volumenDeclarado) || 0)
          + (e.paradas || []).reduce((t, p) => t + (Number(p.volumen) || 0), 0),
        estado: seg.estado,
        href: 'viaje.html',
      };
    }

    // El cargador no tiene ruta propia: su trabajo es en la viña.
    if (rol === Store.ROL_CARGADOR) return null;

    // Viñatero y planta: primero un camión en movimiento, si lo hay.
    const activos = Store.enviosActivos ? Store.enviosActivos() : [];
    const enRuta = activos.find(e => e.estado !== 'entregado');
    if (enRuta) {
      const seg = Shell.calcularSeguimiento(enRuta);
      return {
        tipo: 'camion',
        envio: enRuta,
        titulo: rol === Store.ROL_EMPRESA ? 'Próxima recepción' : 'Tu carga va en camino',
        subtitulo: `${enRuta.origenComuna} → ${enRuta.destinoNombre}`,
        // Lo que importa es dónde va el camión ahora mismo.
        destino: seg.posicion,
        volumen: (Number(enRuta.volumenDeclarado) || 0)
          + (enRuta.paradas || []).reduce((t, p) => t + (Number(p.volumen) || 0), 0),
        estado: seg.estado,
        gps: seg.fuente === 'gps',
        href: 'seguimiento.html?id=' + encodeURIComponent(enRuta.id),
      };
    }

    if (rol === Store.ROL_VINATERO) {
      // Sin camión asignado: la carga propia que sigue esperando.
      const mias = Store.cargasDisponibles()
        .filter(c => c.email === Store.currentEmail() && c.lat != null);
      if (!mias.length) return null;
      const c = mias[0];

      /* Acá NO se mide desde quien mira. El viñatero está parado junto a su
         propia carga, así que esa distancia siempre daría cero y el tiempo
         un minuto: un dato inútil ocupando el lugar más visible de la
         tarjeta. Lo que de verdad falta saber es cuánto tendrían que viajar
         los sarmientos hasta la planta más cercana que los reciba. */
      const planta = this._plantaMasCercana(c);
      if (!planta) {
        return {
          tipo: 'carga', carga: c,
          titulo: 'Tu carga esperando retiro',
          subtitulo: `${c.comuna} · disponible desde el ${c.fecha || 'por confirmar'}`,
          volumen: c.volumen,
          sinTiempo: 'No hay plantas con cupos para ese destino',
          href: 'rutas.html',
        };
      }
      return {
        tipo: 'carga',
        carga: c,
        titulo: 'Tu carga esperando retiro',
        subtitulo: `${c.comuna} · disponible desde el ${c.fecha || 'por confirmar'}`,
        origen: { lat: c.lat, lng: c.lng },
        destino: { lat: planta.lat, lng: planta.lng },
        rotuloTiempo: `Hasta ${planta.nombre}`,
        /* Se explica por qué sale esa planta y no otra: el viñatero no la
           eligió, la escogió la aplicación por cercanía. Sin esto el nombre
           aparecía suelto y daba a entender que el retiro ya estaba
           acordado con ella. */
        referencia: `hasta ${planta.nombre}, la planta más cercana que recibe `
          + (c.destino === 'Indistinto' ? 'sarmientos' : c.destino.toLowerCase()),
        volumen: c.volumen,
        href: 'rutas.html',
      };
    }

    if (rol === Store.ROL_EMPRESA) {
      // Sin camión en ruta: la carga libre más grande, que es la que más
      // energía aporta si se llega a retirar.
      const libres = Store.cargasDisponibles().filter(c => c.lat != null);
      if (!libres.length) return null;
      const c = libres.slice().sort((a, b) => b.volumen - a.volumen)[0];
      return {
        tipo: 'carga',
        carga: c,
        titulo: 'Carga disponible más grande',
        subtitulo: `${c.comuna} · ${Shell.escape(c.productor || 'Productor')}`,
        destino: { lat: c.lat, lng: c.lng },
        volumen: c.volumen,
        href: 'cargas.html',
      };
    }

    return null;
  },

  /* Planta con cupos más cercana a una carga, por carretera no se puede
     saber sin consultar: para elegir candidata basta la línea recta, y el
     tiempo exacto se calcula después sobre la elegida. */
  _plantaMasCercana(carga) {
    const plantas = (Shell.empresasParaBuscador() || []).filter(p =>
      p.activo && p.lat != null
      && (carga.destino === 'Indistinto' || p.tipo === carga.destino));
    if (!plantas.length) return null;
    return plantas
      .map(p => ({ ...p, _km: Ruteo.rectaKm(carga, p) || 1e9 }))
      .sort((a, b) => a._km - b._km)[0];
  },

  /* -------- Dibujo -------- */
  _html(obj, ruta, estadoGps, origenEsGps) {
    const mwh = this.energia(obj.volumen);
    const est = obj.estado ? estadoEnvio(obj.estado) : null;

    /* El tiempo tarda en llegar: hasta entonces se dice que se está
       calculando, en vez de mostrar un número inventado. */
    const tiempo = ruta ? this.duracion(ruta.minutos) : null;
    /* La hora de llegada solo tiene sentido si alguien ya va en camino. En
       una carga que todavía espera retiro nadie salió, así que anunciar una
       hora seria inventarla. */
    const hora = (ruta && !obj.origen) ? this.horaLlegada(ruta.minutos) : null;

    /* De dónde se midió importa tanto como el número: no es lo mismo
       "desde donde estás" que "desde tu comuna" cuando el GPS está apagado,
       y dar a entender lo primero sería mentir. */
    const desde = obj.referencia
      ? obj.referencia                                   // "hasta BioEnergía Maule"
      : (origenEsGps ? 'desde donde estás' : 'desde tu comuna');

    const nota = obj.sinTiempo
      ? obj.sinTiempo
      : !ruta
        ? (estadoGps || 'Calculando distancia…')
        : (ruta.real
            ? `🛣️ ${ruta.km} km por carretera ${desde}`
            : `📏 ${ruta.km} km estimados ${desde} (el servicio de rutas no respondió)`);

    return `
      <div class="card pad ficha-ruta">
        <div class="ficha-cabecera">
          <div class="li-ic" style="background:${est ? est.color + '22' : 'rgba(46,125,50,.12)'};color:${est ? est.color : 'var(--primary)'}">
            ${est ? est.ic : (obj.tipo === 'carga' ? '🌾' : '🚚')}
          </div>
          <div class="ficha-titulo">
            <b>${Shell.escape(obj.titulo)}</b>
            <span class="li-sub">${obj.subtitulo}</span>
          </div>
          ${est ? Shell.badge(est.label, est.color) : ''}
        </div>

        <div class="ficha-datos">
          <div>
            <div class="dato-grande">${ruta ? ruta.km + ' km' : '—'}</div>
            <div class="dato-rotulo">Ruta óptima</div>
          </div>
          <div>
            <div class="dato-grande">${tiempo || '—'}</div>
            <div class="dato-rotulo">${obj.rotuloTiempo
              || (obj.tipo === 'viaje' ? 'Te falta' : 'Tiempo estimado')}</div>
          </div>
          <div>
            <div class="dato-grande">${obj.volumen} m³</div>
            <div class="dato-rotulo">Volumen</div>
          </div>
          <div>
            <div class="dato-grande" style="color:var(--warning)">${mwh} MWh</div>
            <div class="dato-rotulo">Valor energético</div>
          </div>
        </div>

        <div class="ficha-pie">
          <span class="li-sub">${nota}${hora ? ' · llegada ~' + hora : ''}</span>
          <button class="link-btn" data-ir>Ver detalle ›</button>
        </div>
      </div>`;
  },

  /* -------- Montaje --------
     Deja la tarjeta viva dentro del contenedor: se actualiza sola cuando
     cambia la base o cuando el observador se mueve. Devuelve una función
     para desmontarla. */
  montar(contenedor, { seccion = null } = {}) {
    if (!contenedor) return () => {};

    let viva = true;
    let miPos = null;        // dónde está quien mira
    let ruta = null;         // último cálculo de distancia y tiempo
    let calculando = false;
    let estadoGps = 'Ubícate para calcular el tiempo…';
    let origenEsGps = false;   // ¿la medición parte del GPS o de la comuna?
    let vigia = null;
    let bajaVivo = null;

    const pintar = () => {
      if (!viva) return;
      const obj = this.objetivo();
      /* Sin nada próximo que resumir se esconde la sección entera, título
         incluido: un encabezado solo, sin nada debajo, se ve como un error. */
      if (seccion) seccion.style.display = obj ? '' : 'none';
      if (!obj) {
        contenedor.innerHTML = '';
        return;
      }
      contenedor.innerHTML = this._html(obj, ruta, estadoGps, origenEsGps);
      const ir = contenedor.querySelector('[data-ir]');
      if (ir) ir.onclick = () => { location.href = obj.href; };
    };

    /* Recalcula distancia y tiempo. Solo si hay dónde y hacia dónde, y sin
       pisar un cálculo que ya está en curso. */
    const recalcular = async () => {
      if (!viva || calculando) return;
      const obj = this.objetivo();
      if (!obj || !obj.destino || obj.destino.lat == null) return;
      // Sin origen propio hace falta saber dónde está quien mira.
      if (!obj.origen && !miPos) return;

      calculando = true;
      try {
        /* Algunas fichas miden entre dos puntos fijos (la carga y la planta)
           en vez de desde el observador. Ahí la posición de quien mira no
           pinta nada y el resultado es el mismo para todos. */
        const desde = obj.origen || miPos;
        const r = await Ruteo.ruta([desde, obj.destino], { conGeometria: false });
        if (!viva) return;
        if (r) { ruta = r; pintar(); }
      } finally {
        calculando = false;
      }
    };

    /* Posición de quien mira. Se redondea a ~100 m antes de usarla: así dos
       lecturas del GPS casi iguales reutilizan el cálculo anterior en vez
       de pedir una ruta nueva. */
    const anotarPosicion = pos => {
      const nueva = {
        lat: Math.round(pos.coords.latitude * 1000) / 1000,
        lng: Math.round(pos.coords.longitude * 1000) / 1000,
      };
      const lejos = !miPos
        || !origenEsGps
        || (Shell.distanciaKm(miPos, nueva) || 0) * 1000 >= this.METROS_PARA_RECALCULAR;
      miPos = nueva;
      origenEsGps = true;
      if (lejos) recalcular();
    };

    const sinGps = () => {
      /* Sin permiso de ubicación todavía se puede ser útil: se usa la
         comuna declarada en la cuenta como punto de partida, avisando que
         es aproximado. */
      const base = Shell.ubicacionCuenta && Shell.ubicacionCuenta();
      if (base && base.lat != null) {
        miPos = { lat: base.lat, lng: base.lng };
        origenEsGps = false;
        estadoGps = '📍 Calculado desde tu comuna, no desde tu GPS';
        recalcular();
      } else {
        estadoGps = 'Activa la ubicación para ver el tiempo estimado';
        pintar();
      }
    };

    pintar();
    // Si la ficha mide entre dos puntos fijos, no hay que esperar al GPS.
    recalcular();

    // Ubicación del observador: una lectura y después seguimiento continuo.
    if (navigator.geolocation && Shell.puedePedirGPS && Shell.puedePedirGPS()) {
      navigator.geolocation.getCurrentPosition(anotarPosicion, sinGps,
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 12000 });
      try {
        vigia = navigator.geolocation.watchPosition(anotarPosicion, () => {},
          { enableHighAccuracy: false, maximumAge: 60000, timeout: 30000 });
      } catch (e) { /* algunos navegadores lo niegan: ya hay una lectura */ }
    } else {
      sinGps();
    }

    // El vehículo también se mueve: eso llega por la base en vivo.
    bajaVivo = Shell.enVivo(['envios', 'cargas'], () => { recalcular(); pintar(); });

    return () => {
      viva = false;
      if (vigia != null && navigator.geolocation) navigator.geolocation.clearWatch(vigia);
      if (bajaVivo) bajaVivo();
    };
  },
};
