/* ============ Ruteo real sobre la red vial chilena ============
   Reemplaza el cálculo en línea recta por distancias y tiempos de verdad,
   siguiendo los caminos que existen.

   Usa OSRM (Open Source Routing Machine) sobre datos de OpenStreetMap, que
   incluyen la red vial del Maule hasta los caminos rurales. No necesita
   clave ni registro, así que el sitio sigue funcionando tal cual, sin
   configurar nada.

   Tres servicios, para tres preguntas distintas:
     · ruta()     -> ¿cuánto hay de A a B y por dónde pasa el camino?
     · matriz()   -> ¿cuánto hay entre todos estos puntos, de a pares?
     · optimizar()-> ¿en qué orden conviene hacer estas paradas?

   HONESTIDAD SOBRE EL PERFIL DE CAMIÓN
   ------------------------------------
   El servidor público de OSRM solo trae el perfil "driving", pensado para
   un automóvil liviano. Un camión cargado anda más lento, frena antes y toma las curvas
   con más cuidado, así que a los tiempos se les aplica una corrección
   (FACTOR_CAMION). Las distancias sí son exactas: son las del camino real.
   Para tiempos de camión de verdad habría que contratar un servicio con
   perfil de vehículo pesado.

   SI EL SERVICIO NO RESPONDE
   --------------------------
   Nunca se rompe la pantalla: se cae a una estimación en línea recta
   corregida, y lo dice. Más vale un número aproximado y avisado que una
   pantalla en blanco. */
const Ruteo = {
  SERVIDOR: 'https://router.project-osrm.org',

  /* Cuánto más lento anda un camión cargado que un auto. Es una corrección
     declarada, no una medición: ver la nota de arriba. */
  FACTOR_CAMION: 1.25,

  /* Si no hay respuesta del servidor, se estima. Un camino real siempre es
     más largo que la línea recta; en el valle central del Maule, donde la
     red es bastante reticulada, el desvío ronda este factor. */
  FACTOR_DESVIO: 1.32,
  KMH_CAMION: 62,

  /* Cuánto se espera antes de rendirse y estimar. */
  TIEMPO_LIMITE_MS: 8000,

  K_CACHE: 'vitilog_ruteo',
  _memoria: null,

  /* -------- Memoria de consultas --------
     Las mismas comunas se consultan una y otra vez. Guardar el resultado
     evita cargar el servidor público y hace que la pantalla responda al
     instante la segunda vez. */
  _cache() {
    if (this._memoria) return this._memoria;
    try { this._memoria = JSON.parse(localStorage.getItem(this.K_CACHE)) || {}; }
    catch (e) { this._memoria = {}; }
    return this._memoria;
  },

  _guardarCache() {
    try {
      const c = this._cache();
      // No crece sin límite: se quedan las 120 consultas más recientes.
      const claves = Object.keys(c);
      if (claves.length > 120) {
        claves.sort((a, b) => (c[a].t || 0) - (c[b].t || 0));
        claves.slice(0, claves.length - 120).forEach(k => delete c[k]);
      }
      localStorage.setItem(this.K_CACHE, JSON.stringify(c));
    } catch (e) { /* almacenamiento lleno o bloqueado: da igual */ }
  },

  /* Las coordenadas se redondean a ~11 m: pedir la ruta de nuevo por un
     metro de diferencia no aporta nada y rompería la memoria. */
  _clave(prefijo, puntos) {
    return prefijo + ':' + puntos
      .map(p => p.lat.toFixed(4) + ',' + p.lng.toFixed(4)).join(';');
  },

  /* -------- Utilidades -------- */
  _validos(puntos) {
    return Array.isArray(puntos) && puntos.length >= 2 && puntos.every(p =>
      p && typeof p.lat === 'number' && typeof p.lng === 'number'
      && !isNaN(p.lat) && !isNaN(p.lng));
  },

  /* OSRM espera longitud,latitud (al revés de lo habitual). */
  _coords(puntos) {
    return puntos.map(p => `${p.lng},${p.lat}`).join(';');
  },

  async _pedir(ruta) {
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), this.TIEMPO_LIMITE_MS);
    try {
      const r = await fetch(this.SERVIDOR + ruta, { signal: control.signal });
      if (!r.ok) throw new Error('El servicio de rutas respondió ' + r.status);
      const datos = await r.json();
      if (datos.code !== 'Ok') throw new Error(datos.message || datos.code);
      return datos;
    } finally {
      clearTimeout(reloj);
    }
  },

  /* Distancia en línea recta, en kilómetros (fórmula del semiverseno). */
  rectaKm(a, b) {
    if (!a || !b) return null;
    const R = 6371;
    const rad = x => x * Math.PI / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2
      + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  },

  /* Respaldo cuando el servicio no contesta: línea recta corregida. */
  _estimar(puntos) {
    let km = 0;
    for (let i = 1; i < puntos.length; i++) {
      km += this.rectaKm(puntos[i - 1], puntos[i]) || 0;
    }
    km *= this.FACTOR_DESVIO;
    return {
      km: Math.round(km * 10) / 10,
      minutos: Math.max(1, Math.round(km / this.KMH_CAMION * 60)),
      geometria: puntos.map(p => ({ lat: p.lat, lng: p.lng })),
      real: false,
    };
  },

  /* -------- Ruta entre dos o más puntos --------
     Devuelve { km, minutos, geometria, real }. "real" dice si viene del
     servicio o si es una estimación, para poder avisarlo en pantalla. */
  async ruta(puntos, { conGeometria = true } = {}) {
    if (!this._validos(puntos)) return null;

    const clave = this._clave(conGeometria ? 'r' : 'rs', puntos);
    const guardado = this._cache()[clave];
    if (guardado) return guardado.v;

    try {
      const extra = conGeometria ? 'overview=full&geometries=geojson' : 'overview=false';
      const d = await this._pedir(
        `/route/v1/driving/${this._coords(puntos)}?${extra}`);
      const r = d.routes[0];
      const resultado = {
        km: Math.round(r.distance / 100) / 10,
        minutos: Math.max(1, Math.round(r.duration * this.FACTOR_CAMION / 60)),
        geometria: conGeometria && r.geometry
          ? r.geometry.coordinates.map(c => ({ lat: c[1], lng: c[0] }))
          : puntos.map(p => ({ lat: p.lat, lng: p.lng })),
        real: true,
      };
      this._cache()[clave] = { v: resultado, t: Date.now() };
      this._guardarCache();
      return resultado;
    } catch (e) {
      return this._estimar(puntos);
    }
  },

  /* -------- Matriz de distancias --------
     Para comparar varias cargas de una vez sin pedir una ruta por cada una.
     Devuelve { km: [[...]], minutos: [[...]], real }. */
  async matriz(puntos) {
    if (!this._validos(puntos)) return null;

    const clave = this._clave('m', puntos);
    const guardado = this._cache()[clave];
    if (guardado) return guardado.v;

    try {
      const d = await this._pedir(
        `/table/v1/driving/${this._coords(puntos)}?annotations=duration,distance`);
      const resultado = {
        km: d.distances.map(fila => fila.map(v =>
          v == null ? null : Math.round(v / 100) / 10)),
        minutos: d.durations.map(fila => fila.map(v =>
          v == null ? null : Math.max(1, Math.round(v * this.FACTOR_CAMION / 60)))),
        real: true,
      };
      this._cache()[clave] = { v: resultado, t: Date.now() };
      this._guardarCache();
      return resultado;
    } catch (e) {
      // Estimación: línea recta corregida entre cada par.
      const km = puntos.map(a => puntos.map(b =>
        Math.round((this.rectaKm(a, b) || 0) * this.FACTOR_DESVIO * 10) / 10));
      return {
        km,
        minutos: km.map(f => f.map(v => Math.max(1, Math.round(v / this.KMH_CAMION * 60)))),
        real: false,
      };
    }
  },

  /* -------- Orden óptimo de las paradas --------
     El camión sale de donde está, pasa a buscar carga a varias viñas y
     termina en la planta. Decidir el orden a ojo puede costar muchos
     kilómetros de más; esto lo resuelve.

     Devuelve { orden, km, minutos, geometria, real }, donde "orden" son los
     índices de las paradas intermedias en el orden en que conviene hacerlas. */
  async optimizar(origen, paradas, destino) {
    const todos = [origen, ...paradas, destino];
    if (!this._validos(todos)) return null;

    // Con una sola parada no hay nada que ordenar.
    if (paradas.length <= 1) {
      const r = await this.ruta(todos);
      return r && { ...r, orden: paradas.map((_, i) => i) };
    }

    const clave = this._clave('o', todos);
    const guardado = this._cache()[clave];
    if (guardado) return guardado.v;

    try {
      const d = await this._pedir(
        `/trip/v1/driving/${this._coords(todos)}`
        + '?source=first&destination=last&roundtrip=false'
        + '&overview=full&geometries=geojson');
      const viaje = d.trips[0];

      /* waypoint_index dice en qué lugar del recorrido quedó cada punto.
         Se descartan el origen y el destino, que están fijos, y se traduce
         de vuelta al índice de la parada. */
      const orden = d.waypoints
        .map((w, i) => ({ i: i - 1, pos: w.waypoint_index }))
        .filter(x => x.i >= 0 && x.i < paradas.length)
        .sort((a, b) => a.pos - b.pos)
        .map(x => x.i);

      const resultado = {
        orden,
        km: Math.round(viaje.distance / 100) / 10,
        minutos: Math.max(1, Math.round(viaje.duration * this.FACTOR_CAMION / 60)),
        geometria: viaje.geometry
          ? viaje.geometry.coordinates.map(c => ({ lat: c[1], lng: c[0] }))
          : todos.map(p => ({ lat: p.lat, lng: p.lng })),
        real: true,
      };
      this._cache()[clave] = { v: resultado, t: Date.now() };
      this._guardarCache();
      return resultado;
    } catch (e) {
      /* Respaldo: se visitan en orden de cercanía al punto anterior. No es
         el óptimo, pero es mucho mejor que el orden en que se aceptaron. */
      const pend = paradas.map((p, i) => ({ p, i }));
      const orden = [];
      let actual = origen;
      while (pend.length) {
        let mejor = 0;
        let mejorKm = Infinity;
        pend.forEach((x, j) => {
          const km = this.rectaKm(actual, x.p);
          if (km != null && km < mejorKm) { mejorKm = km; mejor = j; }
        });
        orden.push(pend[mejor].i);
        actual = pend[mejor].p;
        pend.splice(mejor, 1);
      }
      const est = this._estimar([origen, ...orden.map(i => paradas[i]), destino]);
      return { ...est, orden };
    }
  },
};
