/* ============ Conexión con la base de datos compartida ============
   Habla directamente con la API REST de Supabase (PostgREST) usando fetch.
   No necesita ninguna librería externa: mismo estilo que el resto del sitio.

   Se activa cuando js/config.js tiene la URL y la clave del proyecto.
   Si no, el sitio funciona igual con la base local (localStorage). */
const Nube = {
  /* -------- De dónde salen la dirección y la clave --------
     Primero se mira lo guardado en el dispositivo (lo que se escribe desde
     Configuración). Si no hay nada, se usa lo que diga js/config.js.
     Así la clave no necesita viajar al repositorio. */
  K_URL: 'vitilog_nube_url',
  K_KEY: 'vitilog_nube_key',

  _guardado(clave) {
    try { return (localStorage.getItem(clave) || '').trim(); }
    catch (e) { return ''; }
  },

  url() {
    return this._guardado(this.K_URL)
      || (typeof SUPABASE_URL === 'string' ? SUPABASE_URL.trim() : '');
  },
  clave() {
    return this._guardado(this.K_KEY)
      || (typeof SUPABASE_ANON_KEY === 'string' ? SUPABASE_ANON_KEY.trim() : '');
  },

  /* Guarda o borra la configuración de este dispositivo. */
  configurar(url, clave) {
    try {
      if (url && clave) {
        localStorage.setItem(this.K_URL, url.trim());
        localStorage.setItem(this.K_KEY, clave.trim());
      } else {
        localStorage.removeItem(this.K_URL);
        localStorage.removeItem(this.K_KEY);
      }
      return true;
    } catch (e) { return false; }
  },

  /* ¿Está configurada la base compartida? */
  activa() {
    return this.url() !== '' && this.clave() !== '';
  },

  /* Tolera que la URL venga con o sin "/rest/v1" al final: en el panel de
     Supabase se copia de las dos formas según dónde se mire. */
  _base() {
    return this.url().replace(/\/+$/, '').replace(/\/rest\/v1$/, '') + '/rest/v1/';
  },

  _cabeceras(extra = {}) {
    const k = this.clave();
    return {
      'apikey': k,
      'Authorization': 'Bearer ' + k,
      'Content-Type': 'application/json',
      ...extra,
    };
  },

  async _pedir(ruta, opciones = {}) {
    const r = await fetch(this._base() + ruta, {
      ...opciones,
      headers: this._cabeceras(opciones.headers),
    });
    if (!r.ok) {
      const detalle = await r.text().catch(() => '');
      throw new Error(`${r.status} ${r.statusText} · ${detalle.slice(0, 200)}`);
    }
    if (r.status === 204) return null;
    const texto = await r.text();
    return texto ? JSON.parse(texto) : null;
  },

  /* -------- Lectura -------- */
  listar(tabla, filtro = '') {
    return this._pedir(`${tabla}?select=*${filtro ? '&' + filtro : ''}`);
  },

  /* -------- Escritura -------- */
  /* Inserta o actualiza según la clave primaria. */
  guardar(tabla, fila) {
    return this._pedir(tabla, {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(fila),
    });
  },

  actualizar(tabla, filtro, cambios) {
    return this._pedir(`${tabla}?${filtro}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(cambios),
    });
  },

  borrar(tabla, filtro) {
    return this._pedir(`${tabla}?${filtro}`, { method: 'DELETE' });
  },

  /* Comprueba que la conexión y las tablas existan. Devuelve null si todo
     está bien, o un mensaje explicando el problema. */
  async revisar() {
    if (!this.activa()) return 'La base compartida no está configurada en js/config.js.';
    try {
      await this.listar('cuentas', 'limit=1');
      return null;
    } catch (e) {
      const m = String(e.message || e);
      if (m.startsWith('401') || m.startsWith('403')) {
        return 'La clave de Supabase fue rechazada. Revisa SUPABASE_ANON_KEY en js/config.js.';
      }
      if (m.includes('404') || m.includes('does not exist')) {
        return 'Falta crear las tablas. Ejecuta sql/esquema.sql en el editor SQL de Supabase.';
      }
      return 'No se pudo conectar con la base compartida: ' + m;
    }
  },
};
