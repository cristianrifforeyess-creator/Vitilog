/* ============ Datos de demostración ============

   Deja la aplicación con un escenario completo y siempre el mismo:
   Curicó, Molina, Talca y Linares, con cargas publicadas, un camión en
   ruta consolidando dos predios y una entrega ya pesada y validada.

   PARA QUÉ
   --------
   Para mostrar la aplicación sin depender de lo que haya quedado de la
   última prueba. Una demostración en vivo con el libro de movimientos a
   medias, un envío trabado o ninguna carga publicada no se puede
   explicar; y arreglarla a mano delante de la gente es peor.

   Todas las cuentas sembradas terminan en @demo.agroconecta.cl, y todo
   lo que se crea acá lleva identificadores que empiezan con "demo-". Esa
   es la única manera de poder limpiar lo de la demostración sin tocar lo
   de nadie más, y por eso es una regla y no una convención suelta.

   CUIDADO CON LA BASE COMPARTIDA
   ------------------------------
   Con Supabase conectado, la base es de todos: borrar "todo" borraría
   también las cuentas y las cargas de quienes estén usando la
   aplicación. Así que en ese modo esto solo reemplaza los registros de
   demostración. Vaciar de verdad queda disponible únicamente cuando los
   datos son locales de este navegador, donde lo único en juego es lo
   propio. */
const Demo = {
  DOMINIO: '@demo.agroconecta.cl',

  /* Clave de las cuentas sembradas. Es pública a propósito: son cuentas
     de exhibición y se muestra en pantalla para poder entrar con ellas.
     Ninguna cuenta real usa esto. */
  CLAVE: 'demo1234',

  PREFIJO: 'demo-',

  /* -------- El reparto --------
     Dos viñas del norte del valle, una del sur, una planta en el centro
     y el equipo que mueve la carga. Las comunas son las de data.js, así
     que todo cae en el mapa sin coordenadas a mano. */
  CUENTAS: [
    {
      email: 'vina.curico@demo.agroconecta.cl',
      rol: 'vinatero', nombre: 'Viña Los Maitenes',
      comuna: 'Curicó', telefono: '+56 9 7412 3390', hectareas: 42,
    },
    {
      email: 'vina.linares@demo.agroconecta.cl',
      rol: 'vinatero', nombre: 'Viña El Peumo',
      comuna: 'Linares', telefono: '+56 9 4471 6628', hectareas: 18,
    },
    {
      email: 'planta.talca@demo.agroconecta.cl',
      rol: 'empresa', nombre: 'BioEnergía Maule',
      comuna: 'Talca', telefono: '+56 9 8890 4412',
      tipo: 'Biomasa', encargado: 'Operaciones de patio',
    },
    {
      email: 'transporte@demo.agroconecta.cl',
      rol: 'chofer', nombre: 'Marco Villalobos',
      comuna: 'Talca', telefono: '+56 9 7745 2210',
      patente: 'KDJS-42', capacidad: 28,
      vehiculo: 'barandas',
      /* Vinculado a la planta de Talca: así el panel de la empresa tiene
         flota que mostrar y se puede demostrar el encargo de un retiro,
         que es el único flujo que no se puede enseñar con un
         transportista suelto. */
      modalidad: 'empresa',
      empresa_nombre: 'BioEnergía Maule',
      empresa_email: 'planta.talca@demo.agroconecta.cl',
      /* Lleva su propia tropa: así la demostración muestra el caso en que
         la estiba la resuelve el transportista y no la plataforma. */
      estiba: 'cuadrilla', cuadrilla_nombre: 'Tropa Villalobos',
      cuadrilla_personas: 3,
      disponible: true,
    },
    {
      email: 'cargador@demo.agroconecta.cl',
      rol: 'chofer', nombre: 'Hernán Ñanco',
      comuna: 'Linares', telefono: '+56 9 5520 6633',
      /* No conduce: es el cargador individual al que la administración
         le deriva el trabajo desde la pestaña Estiba. */
      modalidad: 'cargador', estiba: 'cuadrilla',
      cuadrilla_nombre: 'Cuadrilla Ñanco', cuadrilla_personas: 4,
      disponible: true,
    },
  ],

  correo(prefijo) { return prefijo + this.DOMINIO; },
  esCuentaDemo(email) {
    return String(email || '').toLowerCase().endsWith(this.DOMINIO);
  },
  esRegistroDemo(id) {
    return String(id || '').startsWith(this.PREFIJO);
  },

  /* Fecha en el formato que usa publicar.html: dd/mm/aaaa. */
  _fecha(diasDesdeHoy) {
    const d = new Date();
    d.setDate(d.getDate() + diasDesdeHoy);
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
  },

  _hace(minutos) {
    return new Date(Date.now() - minutos * 60000).toISOString();
  },

  /* -------- Las cargas --------
     Cuatro casos distintos a propósito: una lista para cargar, una que
     pide cuadrilla, una grande en el sur, y una que todavía está tirada
     entre las hileras —sin consolidar y con acceso difícil— para poder
     mostrar el aviso que le sale al transportista. */
  cargas() {
    return [
      {
        id: this.PREFIJO + 'c1', ownerEmail: this.correo('vina.curico'),
        comuna: 'Curicó', volumen: 14, destino: 'Biomasa',
        fecha: this._fecha(1), estado: 'publicada',
        notas: 'Acopiado en la cabecera del cuartel 3, junto al camino interior.',
        acceso: 'normal', manoObra: 'propia', consolidado: true,
        creada: this._hace(2880),
      },
      {
        id: this.PREFIJO + 'c2', ownerEmail: this.correo('vina.curico'),
        comuna: 'Molina', volumen: 9, destino: 'Compostaje',
        fecha: this._fecha(1), estado: 'publicada',
        notas: 'Callejón firme, pero conviene camión mediano.',
        acceso: 'estrecho', manoObra: 'solicita', consolidado: true,
        creada: this._hace(2820),
      },
      {
        id: this.PREFIJO + 'c3', ownerEmail: this.correo('vina.linares'),
        comuna: 'Linares', volumen: 18, destino: 'Biomasa',
        fecha: this._fecha(3), estado: 'publicada',
        notas: 'Poda terminada. Pedimos cuadrilla, no tenemos gente esta semana.',
        acceso: 'normal', manoObra: 'solicita', consolidado: true,
        creada: this._hace(1440),
      },
      {
        id: this.PREFIJO + 'c4', ownerEmail: this.correo('vina.linares'),
        comuna: 'Linares', volumen: 12, destino: 'Indistinto',
        fecha: this._fecha(6), estado: 'publicada',
        notas: 'Todavía repartido entre las hileras; lo juntamos esta semana.',
        acceso: 'dificil', manoObra: 'solicita', consolidado: false,
        creada: this._hace(600),
      },
    ];
  },

  /* La planta que recibe en la demostración. Se busca en los puntos
     reales para que el mapa y el seguimiento cuadren. */
  _planta() {
    return Store.puntos().find(p => p.id === 'talca')
      || Store.puntos().find(p => recibeSarmientos(p.tipo) && p.activo !== false)
      || null;
  },

  /* -------- Los dos envíos --------
     Uno en ruta, consolidando Curicó y Molina, para mostrar la barra de
     tolva y las paradas. Y uno cerrado con pesaje validado, que es el
     único que permite mostrar el Sello Verde. */
  envios() {
    const planta = this._planta();
    if (!planta) return [];

    const chofer = this.CUENTAS.find(c => c.email === this.correo('transporte'));
    const curico = Shell.coordComuna('Curicó');
    const molina = Shell.coordComuna('Molina');
    const linares = Shell.coordComuna('Linares');
    if (!curico || !molina || !linares) return [];

    const comun = {
      empresaEmail: this.correo('planta.talca'),
      choferEmail: chofer.email,
      chofer: chofer.nombre,
      choferTelefono: chofer.telefono,
      patente: chofer.patente,
      destinoId: planta.id, destinoNombre: planta.nombre,
      destinoLat: planta.lat, destinoLng: planta.lng,
      precision: null,
    };

    return [
      {
        ...comun,
        id: this.PREFIJO + 'env-curso',
        cargaId: this.PREFIJO + 'c1',
        vinateroEmail: this.correo('vina.curico'),
        origenComuna: 'Curicó', origenLat: curico.lat, origenLng: curico.lng,
        estado: 'en_camino',
        salida: this._hace(38),
        minutosTotal: 74,
        progreso: 0.5,
        vehLat: null, vehLng: null, posicionAt: null,
        volumenDeclarado: 14,
        volumenRecibido: null, pesoRecibido: null, observaciones: '',
        /* La segunda viña del viaje: es lo que hace que la barra de tolva
           muestre dos tramos y no uno. */
        paradas: [{
          cargaId: this.PREFIJO + 'c2', comuna: 'Molina',
          lat: molina.lat, lng: molina.lng, volumen: 9,
          productor: 'Viña Los Maitenes', telefono: '+56 9 7412 3390',
          recogida: false,
        }],
        cuadrillaEmail: chofer.email,
        cuadrillaNombre: chofer.cuadrilla_nombre,
        validadoPor: '', validadoAt: null, porteriaAt: null,
        tarifa: null, estibaCobrada: false,
        escrowEstado: 'ninguno', escrowAt: null, liquidadoAt: null,
        creado: this._hace(120),
      },
      {
        ...comun,
        id: this.PREFIJO + 'env-cerrado',
        cargaId: null,
        vinateroEmail: this.correo('vina.linares'),
        origenComuna: 'Linares', origenLat: linares.lat, origenLng: linares.lng,
        estado: 'entregado',
        salida: this._hace(1560),
        minutosTotal: 96,
        progreso: 1,
        vehLat: planta.lat, vehLng: planta.lng, posicionAt: this._hace(1460),
        volumenDeclarado: 16,
        /* Lo recibido nunca calza exacto con lo declarado: el sarmiento se
           asienta en el viaje. Que la demostración lo muestre así evita
           prometer una precisión que no existe. */
        volumenRecibido: 15.5,
        pesoRecibido: 4120,
        observaciones: 'Material seco, sin restos de alambre.',
        paradas: [],
        cuadrillaEmail: this.correo('cargador'),
        cuadrillaNombre: 'Cuadrilla Ñanco',
        validadoPor: this.correo('planta.talca'),
        validadoAt: this._hace(1455),
        porteriaAt: this._hace(1575),
        tarifa: null, estibaCobrada: false,
        escrowEstado: 'ninguno', escrowAt: null, liquidadoAt: null,
        creado: this._hace(1600),
      },
    ];
  },

  /* =====================================================================
     Limpiar
     ===================================================================== */
  /* Qué hay ahora mismo de la demostración, para poder contarlo antes y
     después y no mentir en el aviso. */
  inventario() {
    const cuentas = Store.accounts().filter(a => this.esCuentaDemo(a.email));
    const cargas = Store.cargas().filter(c =>
      this.esRegistroDemo(c.id) || this.esCuentaDemo(c.ownerEmail));
    const envios = Store.envios().filter(e =>
      this.esRegistroDemo(e.id) || this.esCuentaDemo(e.vinateroEmail)
      || this.esCuentaDemo(e.empresaEmail) || this.esCuentaDemo(e.choferEmail));
    const movimientos = Store.movimientos().filter(m =>
      this.esRegistroDemo(m.envioId) || this.esCuentaDemo(m.email));
    return { cuentas, cargas, envios, movimientos };
  },

  /* Borra solo lo de la demostración. Sirve igual con base local o
     compartida, porque no toca nada que no haya creado este módulo. */
  async limpiar() {
    const inv = this.inventario();
    for (const m of inv.movimientos) await Store.borrarMovimiento(m.id);
    for (const e of inv.envios) await Store.borrarEnvio(e.id);
    for (const c of inv.cargas) await Store.removeCarga(c.id);
    for (const a of inv.cuentas) await Store.borrarCuenta(a.email);
    return {
      cuentas: inv.cuentas.length, cargas: inv.cargas.length,
      envios: inv.envios.length, movimientos: inv.movimientos.length,
    };
  },

  /* Vaciar de verdad: todo lo de este navegador, incluidas las cuentas
     reales. Solo con base local, y la cuenta de administración se vuelve
     a sembrar sola para no quedar fuera. */
  async vaciarTodo() {
    if (Store.enNube()) {
      return 'Con la base compartida no se puede vaciar todo: borraría las cuentas de los demás.';
    }
    const correo = Store.currentEmail();
    Store.vaciarBaseLocal();
    await Store.sincronizar({ forzar: true });   // vuelve a sembrar plantas y administración
    Store.setSession(correo);                    // y no te echa de tu propia sesión
    return null;
  },

  /* =====================================================================
     Sembrar
     ===================================================================== */
  /* Deja el escenario completo. Primero limpia lo de la demostración
     anterior: si no, cada pasada duplicaría cargas y el libro quedaría
     con el doble de movimientos. */
  async cargar() {
    if (Store.rolActual() !== Store.ROL_ADMIN) return { error: 'Solo la administración' };
    if (typeof Shell === 'undefined' || typeof Finanzas === 'undefined') {
      return { error: 'Faltan módulos de la aplicación' };
    }

    const borrado = await this.limpiar();

    for (const c of this.CUENTAS) {
      const error = await Store.crearCuenta(c, this.CLAVE);
      if (error) return { error };
    }

    for (const c of this.cargas()) await Store.addCarga(c);

    const envios = this.envios();
    if (!envios.length) {
      return { error: 'No hay plantas con coordenadas para armar los envíos' };
    }
    for (const e of envios) await Store.addEnvio(e);

    /* El dinero no se escribe a mano: se pasa por las mismas funciones
       que usa la aplicación. Así las cifras de la demostración son las
       que saldrían de verdad, y si la tarifa cambia, cambian con ella. */
    const planta = this._planta();
    for (const e of envios) {
      const km = Shell.distanciaKm(
        { lat: e.origenLat, lng: e.origenLng },
        { lat: planta.lat, lng: planta.lng }) || 0;
      const vol = (e.volumenDeclarado || 0)
        + (e.paradas || []).reduce((t, p) => t + (p.volumen || 0), 0);
      const tarifa = Finanzas.tarifa({ km, volumen: vol });
      await Store.retenerFlete(e.id, tarifa, !!e.cuadrillaEmail);
    }
    // El cerrado ya pasó por la romana: su flete está repartido.
    await Store.liquidarFlete(this.PREFIJO + 'env-cerrado');

    return {
      borrado,
      cuentas: this.CUENTAS.length,
      cargas: this.cargas().length,
      envios: envios.length,
    };
  },
};
