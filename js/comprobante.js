/* ============ Comprobante de Disposición Limpia y Sello Verde ============

   Lo que queda cuando el viaje termina. Después de que la planta pesa la
   carga en la romana y valida la descarga, este módulo arma una tarjeta
   con lo que efectivamente se recibió, y la deja descargar como imagen.

   PARA QUÉ SIRVE DE VERDAD
   ------------------------
   El viñatero no quema sus sarmientos: los entrega. Pero eso, sin algo
   que mostrar, no se puede probar a nadie —ni al comprador que pregunta
   por sus prácticas, ni a un programa de fomento, ni al vecino que sigue
   quemando. La tarjeta existe para que esa decisión deje huella: qué
   volumen salió del predio, cuánta energía representa, quién lo recibió
   y a qué hora.

   Va atada a los ODS 9 y 12 porque es de lo que habla: infraestructura
   que aprovecha un residuo (9) y un residuo que se valoriza en vez de
   arder (12).

   POR QUÉ UNA IMAGEN Y NO UN PDF
   ------------------------------
   Un PDF decente obliga a traer una librería, y acá no entra ninguna. La
   imagen se pega igual en una presentación, en un correo o en un estado
   de WhatsApp, que es donde esto va a terminar. Se arma como SVG —texto
   nítido a cualquier tamaño— y se rasteriza a PNG en el propio
   navegador, con el SVG como respaldo si el navegador no deja.

   LO QUE NO HACE
   --------------
   No es un documento tributario ni una certificación de un tercero. Es
   el registro de la plataforma, y lo dice en el pie. */
const Comprobante = {
  /* Lienzo del comprobante. Proporción de tarjeta ancha: se lee bien en
     un teléfono apoyado de lado y no se deforma en una diapositiva. */
  ANCHO: 1000,
  ALTO: 620,

  /* ¿Se puede emitir ya? Solo con la descarga validada por la planta:
     antes de la romana no hay volumen real que acreditar. */
  disponible(envio) {
    return !!envio && envio.estado === 'entregado'
      && (envio.volumenRecibido != null || envio.volumenDeclarado > 0);
  },

  /* -------- Los datos que van impresos --------
     Se arman acá y no al dibujar, para poder revisarlos por separado. */
  datos(envio) {
    const m3 = Number(envio.volumenRecibido != null
      ? envio.volumenRecibido : envio.volumenDeclarado) || 0;

    const vina = Store.accountByEmail(envio.vinateroEmail);
    const planta = Store.accountByEmail(envio.empresaEmail);

    return {
      folio: this.folio(envio),
      m3,
      mwh: (typeof Ficha !== 'undefined') ? Ficha.energia(m3) : Math.round(m3 * 3) / 10,
      kg: envio.pesoRecibido != null ? Number(envio.pesoRecibido) : null,
      origen: envio.origenComuna || '',
      destino: envio.destinoNombre || '',
      productor: vina ? vina.nombre : 'Productor AgroConecta',
      planta: planta ? planta.nombre : (envio.destinoNombre || ''),
      transportista: envio.chofer || '',
      patente: envio.patente || '',
      paradas: (envio.paradas || []).length,
      validadoPor: envio.validadoPor || '',
      cuando: envio.validadoAt || envio.salida || null,
      observaciones: envio.observaciones || '',
    };
  },

  /* Número de folio. No pretende ser un correlativo oficial: es una
     referencia estable para poder nombrar este retiro y encontrarlo.

     Lleva la fecha del pesaje y cuatro caracteres sacados del
     identificador del envío. Se calculan con un hash y no cortando el
     final del identificador, que fue lo primero que probé: "demo-env-
     cerrado" terminaba dando el folio AC-2026-ERRADO, que es justo lo
     que uno no quiere leer en un comprobante. */
  folio(envio) {
    const d = new Date(envio.validadoAt || envio.creado || Date.now());
    const p = n => String(n).padStart(2, '0');
    const fecha = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
    return 'AC-' + fecha + '-' + this._clave(String(envio.id || ''));
  },

  /* Cuatro caracteres estables a partir de un texto. Hash sencillo —el de
     toda la vida, multiplicar y sumar— porque acá no hace falta más: solo
     se necesita que el mismo envío dé siempre el mismo folio. */
  _clave(texto) {
    let h = 0;
    for (let i = 0; i < texto.length; i++) {
      h = (h * 31 + texto.charCodeAt(i)) >>> 0;
    }
    return (h % 1679616).toString(36).toUpperCase().padStart(4, '0').slice(-4);
  },

  _fecha(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-CL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  },

  /* Recorta un texto largo: el SVG no sabe cortar líneas solo, y un
     nombre de fantasía de cuarenta letras se sale del marco. */
  _corto(texto, max) {
    const t = String(texto || '').trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  },

  _esc(s) { return (typeof Shell !== 'undefined') ? Shell.escape(s) : String(s); },

  /* -------- El dibujo --------
     Sin emoji y sin imágenes externas a propósito: al rasterizar, un
     archivo de fuera no carga y un emoji depende de lo que tenga
     instalado el aparato. Todo lo que se ve acá son formas y texto. */
  svg(d) {
    const W = this.ANCHO, H = this.ALTO;
    const F = 'Segoe UI, Roboto, Helvetica, Arial, sans-serif';
    const esc = s => this._esc(s);

    // Una de las tres cifras grandes del centro.
    const cifra = (x, valor, unidad, rotulo) => `
      <text x="${x}" y="352" font-family="${F}" font-size="52" font-weight="700"
            fill="#4A154B" text-anchor="middle">${esc(valor)}<tspan
            font-size="26" font-weight="600" dx="4">${esc(unidad)}</tspan></text>
      <text x="${x}" y="382" font-family="${F}" font-size="15"
            fill="#6B5B6E" text-anchor="middle">${esc(rotulo)}</text>`;

    // Un dato de trazabilidad del pie, con su rótulo encima.
    const dato = (x, y, titulo, valor) => `
      <text x="${x}" y="${y}" font-family="${F}" font-size="13"
            fill="#8B7B8E" letter-spacing="0.6">${esc(titulo.toUpperCase())}</text>
      <text x="${x}" y="${y + 22}" font-family="${F}" font-size="17"
            font-weight="600" fill="#2D1B2E">${esc(valor || '—')}</text>`;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"
     viewBox="0 0 ${W} ${H}" role="img"
     aria-label="Comprobante de disposición limpia, folio ${esc(d.folio)}">
  <defs>
    <linearGradient id="franja" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4A154B"/>
      <stop offset="1" stop-color="#8E5A8F"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" rx="22" fill="#FFFFFF"/>
  <rect width="${W}" height="${H}" rx="22" fill="none" stroke="#E9D8FD" stroke-width="2"/>

  <!-- Cabecera -->
  <path d="M0 22 Q0 0 22 0 H${W - 22} Q${W} 0 ${W} 22 V124 H0 Z" fill="url(#franja)"/>

  <!-- Marca: el anillo de trazabilidad con el racimo, dibujado acá mismo
       para no depender del archivo del logo al rasterizar. -->
  <g transform="translate(44 34)">
    <circle cx="28" cy="28" r="25" fill="none" stroke="#D8B4E2" stroke-width="4"
            stroke-dasharray="104 14" stroke-linecap="round"/>
    <circle cx="22" cy="22" r="5.4" fill="#F3E8FF"/>
    <circle cx="34" cy="22" r="5.4" fill="#F3E8FF"/>
    <circle cx="28" cy="32" r="5.4" fill="#F3E8FF"/>
    <circle cx="28" cy="42" r="4.2" fill="#F3E8FF"/>
  </g>

  <text x="112" y="56" font-family="${F}" font-size="25" font-weight="700" fill="#FFFFFF">
    Comprobante de Disposición Limpia
  </text>
  <text x="112" y="84" font-family="${F}" font-size="15.5" fill="#E9D8FD">
    Sello Verde · ODS 9 Industria e innovación · ODS 12 Consumo responsable
  </text>
  <text x="112" y="106" font-family="${F}" font-size="13.5" fill="#D8B4E2">
    AgroConecta por VITILOG · Región del Maule
  </text>

  <text x="${W - 44}" y="60" font-family="${F}" font-size="13" fill="#D8B4E2"
        text-anchor="end" letter-spacing="1.2">FOLIO</text>
  <text x="${W - 44}" y="86" font-family="${F}" font-size="21" font-weight="700"
        fill="#FFFFFF" text-anchor="end">${esc(d.folio)}</text>

  <!-- Qué se hizo -->
  <text x="44" y="172" font-family="${F}" font-size="17" fill="#2D1B2E">
    Se retiró y valorizó el sarmiento de poda de
    <tspan font-weight="700">${esc(this._corto(d.productor, 36))}</tspan>,
  </text>
  <text x="44" y="200" font-family="${F}" font-size="17" fill="#2D1B2E">
    comuna de <tspan font-weight="700">${esc(d.origen)}</tspan>, con destino a
    <tspan font-weight="700">${esc(this._corto(d.destino, 32))}</tspan>.
  </text>

  <!-- Lo que de verdad acredita: que esto no se quemó -->
  <rect x="44" y="222" width="${W - 88}" height="52" rx="12" fill="#F0FFF4"
        stroke="#38A169" stroke-width="1.5"/>
  <path d="M64 248 l7 7 13 -15" fill="none" stroke="#2F855A" stroke-width="3.4"
        stroke-linecap="round" stroke-linejoin="round"/>
  <text x="98" y="254" font-family="${F}" font-size="16" font-weight="600" fill="#2F855A">
    Este volumen no se quemó a campo abierto: salió del predio y entró a valorización.
  </text>

  <!-- Las tres cifras -->
  ${cifra(210, d.m3, ' m³', 'Volumen recibido en romana')}
  ${cifra(500, d.mwh, ' MWh', 'Energía equivalente')}
  ${cifra(790, d.kg != null ? d.kg.toLocaleString('es-CL') : '—',
          d.kg != null ? ' kg' : '', 'Peso en balanza')}

  <line x1="44" y1="412" x2="${W - 44}" y2="412" stroke="#E9D8FD" stroke-width="1.5"/>

  <!-- Trazabilidad -->
  ${dato(44, 444, 'Transportista', this._corto(
      d.transportista + (d.patente ? ' · ' + d.patente : ''), 32))}
  ${dato(360, 444, 'Validado por', this._corto(d.validadoPor, 28))}
  ${dato(680, 444, 'Fecha y hora del pesaje', this._fecha(d.cuando))}

  ${d.paradas ? `<text x="44" y="506" font-family="${F}" font-size="14" fill="#6B5B6E">
    Retiro consolidado: ${d.paradas + 1} predios en un mismo viaje.
  </text>` : ''}
  ${d.observaciones ? `<text x="44" y="528" font-family="${F}" font-size="14" fill="#6B5B6E">
    Observaciones de recepción: ${esc(this._corto(d.observaciones, 86))}
  </text>` : ''}

  <!-- Pie: qué es y qué no es este documento -->
  <path d="M0 ${H - 54} H${W} V${H - 22} Q${W} ${H} ${W - 22} ${H} H22 Q0 ${H} 0 ${H - 22} Z"
        fill="#F7F2FA"/>
  <text x="44" y="${H - 31}" font-family="${F}" font-size="12.5" fill="#6B5B6E">
    Registro de trazabilidad emitido por la plataforma AgroConecta. No es un documento tributario.
  </text>
  <text x="${W - 44}" y="${H - 31}" font-family="${F}" font-size="12.5" fill="#8B7B8E"
        text-anchor="end">Referencia: folio ${esc(d.folio)}</text>
</svg>`;
  },

  /* -------- Descarga --------
     Se intenta PNG, que es lo que la gente espera de una imagen. Si el
     navegador no puede rasterizar —pasa en algunos móviles antiguos— se
     entrega el SVG, que abre igual y además se imprime mejor. */
  async descargar(envio) {
    const d = this.datos(envio);
    const dibujo = this.svg(d);
    const nombre = 'sello-verde-' + d.folio;

    try {
      const png = await this._aPng(dibujo);
      this._bajar(png, nombre + '.png');
      return 'png';
    } catch (e) {
      this._bajar(new Blob([dibujo], { type: 'image/svg+xml;charset=utf-8' }),
                  nombre + '.svg');
      return 'svg';
    }
  },

  /* SVG a PNG con el propio navegador. El SVG viaja como data URL: así la
     imagen no "ensucia" el lienzo y toBlob sigue permitido, que es justo
     lo que no pasaría con un archivo traído de otro dominio. */
  _aPng(dibujo) {
    return new Promise((resolve, reject) => {
      const lienzo = document.createElement('canvas');
      const escala = 2;                 // al doble: en una diapositiva se nota
      lienzo.width = this.ANCHO * escala;
      lienzo.height = this.ALTO * escala;

      const img = new Image();
      img.onload = () => {
        try {
          const ctx = lienzo.getContext('2d');
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, lienzo.width, lienzo.height);
          ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
          lienzo.toBlob(b => b ? resolve(b) : reject(new Error('sin imagen')), 'image/png');
        } catch (e) { reject(e); }
      };
      img.onerror = () => reject(new Error('el navegador no pudo dibujar el comprobante'));

      /* unescape(encodeURIComponent(...)) es la forma de pasar por btoa un
         texto con acentos sin que se queje. */
      img.src = 'data:image/svg+xml;base64,'
        + btoa(unescape(encodeURIComponent(dibujo)));
    });
  },

  _bajar(blob, nombre) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Se suelta después, o el navegador cancela la descarga a medio camino.
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  },

  /* -------- Pantalla --------
     Se muestra lo mismo que se descarga. Un botón que baja un archivo que
     no se vio antes da desconfianza, y con razón. */
  abrir(envioId) {
    const envio = Store.envioPorId(envioId);
    if (!envio) return Shell.toast('Ese retiro ya no existe');
    if (!this.disponible(envio)) {
      return Shell.toast('El comprobante se emite cuando la planta valida el pesaje');
    }

    const d = this.datos(envio);
    Shell.openModal(`
      <div class="handle"></div>
      <b style="font-size:18px">Sello Verde</b>
      <p class="section-sub" style="margin-top:4px">
        ${Shell.escape(d.origen)} → ${Shell.escape(d.destino)} · folio ${Shell.escape(d.folio)}
      </p>
      <div class="sello-marco" style="margin-top:14px">${this.svg(d)}</div>
      <p class="sello-nota">
        Acredita ${d.m3} m³ retirados y ${d.mwh} MWh equivalentes, con el pesaje
        validado por la planta. Sirve para mostrar que el sarmiento de esta
        temporada no se quemó.
      </p>
      <button class="btn block" style="margin-top:14px" id="sello-bajar">
        ⬇️ Descargar comprobante
      </button>
      <button class="btn ghost block" style="margin-top:10px"
              onclick="Shell.closeModal()">Cerrar</button>`);

    const boton = document.getElementById('sello-bajar');
    boton.onclick = async () => {
      boton.disabled = true;
      boton.textContent = 'Preparando la imagen…';
      const formato = await this.descargar(envio);
      Shell.toast(formato === 'png'
        ? 'Comprobante descargado'
        : 'Descargado como SVG: este navegador no pudo generar la imagen');
      boton.disabled = false;
      boton.textContent = '⬇️ Descargar comprobante';
    };
  },

  /* El botón que abre todo esto, para las listas de entregas cerradas. */
  boton(envio, { clase = 'btn ghost block', texto = '🌿 Sello Verde' } = {}) {
    if (!this.disponible(envio)) return '';
    return `<button class="${clase}" data-sello="${Shell.escape(envio.id)}">${texto}</button>`;
  },

  /* Deja conectados todos los botones que haya dentro de un contenedor. */
  conectar(contenedor) {
    (contenedor || document).querySelectorAll('[data-sello]').forEach(b => {
      b.onclick = ev => {
        ev.stopPropagation();
        this.abrir(b.dataset.sello);
      };
    });
  },
};
