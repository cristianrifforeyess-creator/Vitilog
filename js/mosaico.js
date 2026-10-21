/* ============ Mapa real de fondo ============
   Pone las imágenes de OpenStreetMap detrás de los marcadores: calles,
   pueblos, caminos rurales y nombres de verdad, en vez del dibujo a mano.

   CÓMO CONVIVE CON EL DIBUJO
   --------------------------
   El dibujo en SVG no se reemplaza: se esconde mientras haya mosaicos y
   vuelve solo si no se pueden cargar. Así, sin internet —o si el servidor
   de mapas no responde— la aplicación sigue mostrando la Región del Maule
   en vez de un recuadro gris. Es el respaldo, no un plan B a medias.

   POR QUÉ VAN DENTRO DEL SVG
   --------------------------
   Las pantallas acercan el mapa cambiando el viewBox del SVG (al seguir un
   camión, por ejemplo). Si los mosaicos fueran una capa aparte, habría que
   sincronizarla a mano en cada movimiento y siempre quedaría medio paso
   atrás. Puestos dentro, el navegador los acerca y los mueve junto con todo
   lo demás, gratis.

   LAS DOS PROYECCIONES
   --------------------
   Los mosaicos usan Mercator y el dibujo usa una proyección simple. Sobre
   el ancho del Maule, las dos difieren como mucho 2 píxeles (unos 470 m en
   un mapa donde cada píxel son 227 m), así que no se nota. Además, cada
   mosaico se coloca por sus propias esquinas en coordenadas reales, con lo
   que el error dentro de cada uno es todavía menor.

   USO RESPONSABLE
   ---------------
   openstreetmap.org entrega estas imágenes gratis y pide a cambio dos
   cosas: dar crédito y no abusar. El crédito se dibuja en la esquina del
   mapa, y se piden pocos mosaicos a la vez. */
const Mosaico = {
  SERVIDOR: 'https://tile.openstreetmap.org',

  /* Cuántos mosaicos de ancho se buscan. Más que esto es pedir demasiado
     para lo que se gana en nitidez. */
  OBJETIVO_ANCHO: 5,

  /* Límites de acercamiento: menos que 7 no muestra nada útil de la región,
     y más que 14 son demasiadas imágenes para un mapa de este tamaño. */
  ZOOM_MIN: 7,
  ZOOM_MAX: 14,
  MAXIMO_MOSAICOS: 30,

  /* ¿Tiene sentido intentarlo? Sin conexión declarada, ni se molesta. */
  disponible() {
    return typeof navigator === 'undefined' || navigator.onLine !== false;
  },

  /* -------- Matemática de los mosaicos --------
     Cada imagen cubre un cuadrado de la Tierra identificado por (z, x, y).
     Estas tres funciones traducen entre coordenadas y esa cuadrícula. */
  _xDeLng(lng, z) { return (lng + 180) / 360 * Math.pow(2, z); },

  _yDeLat(lat, z) {
    const r = lat * Math.PI / 180;
    return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z);
  },

  _lngDeX(x, z) { return x / Math.pow(2, z) * 360 - 180; },

  _latDeY(y, z) {
    const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
    return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  },

  /* Nivel de acercamiento adecuado para la porción de mundo que se ve. */
  _zoomPara(gradosDeAncho) {
    if (!gradosDeAncho || gradosDeAncho <= 0) return this.ZOOM_MIN;
    const z = Math.round(Math.log2(this.OBJETIVO_ANCHO * 360 / gradosDeAncho));
    return Math.max(this.ZOOM_MIN, Math.min(this.ZOOM_MAX, z));
  },

  /* Qué trozo del mundo está mostrando ese SVG ahora mismo, leído de su
     viewBox y traducido a coordenadas con el marco de data.js. */
  _vistaDe(svg) {
    const m = DATA.mapaMarco;
    const vb = (svg.getAttribute('viewBox') || `0 0 ${m.ancho} ${m.alto}`)
      .split(/[\s,]+/).map(Number);
    const [x, y, w, h] = vb;
    const lng = px => m.oeste + px / m.ancho * (m.este - m.oeste);
    const lat = py => m.norte - py / m.alto * (m.norte - m.sur);
    return {
      oeste: lng(x), este: lng(x + w),
      norte: lat(y), sur: lat(y + h),
      gradosDeAncho: w / m.ancho * (m.este - m.oeste),
    };
  },

  /* -------- Pintar -------- */
  /* Mete los mosaicos en un recuadro de mapa. Se puede llamar las veces que
     haga falta: si la vista no cambió, no rehace nada. */
  pintar(contenedor) {
    if (!contenedor || !this.disponible()) return;
    const svg = contenedor.querySelector('.map-geo');
    if (!svg) return;

    const vista = this._vistaDe(svg);
    const z = this._zoomPara(vista.gradosDeAncho);

    const x0 = Math.floor(this._xDeLng(vista.oeste, z));
    const x1 = Math.floor(this._xDeLng(vista.este, z));
    const y0 = Math.floor(this._yDeLat(vista.norte, z));
    const y1 = Math.floor(this._yDeLat(vista.sur, z));

    const cuantos = (x1 - x0 + 1) * (y1 - y0 + 1);
    if (cuantos <= 0 || cuantos > this.MAXIMO_MOSAICOS) return;

    // Si ya está pintado justo esto, no se vuelve a pedir nada.
    const firma = `${z}:${x0},${y0},${x1},${y1}`;
    if (svg.dataset.mosaico === firma) return;
    svg.dataset.mosaico = firma;

    const NS = 'http://www.w3.org/2000/svg';
    let capa = svg.querySelector('.geo-mosaico');
    if (!capa) {
      capa = document.createElementNS(NS, 'g');
      capa.setAttribute('class', 'geo-mosaico');
      // Al fondo del todo: el dibujo y los marcadores van encima.
      svg.insertBefore(capa, svg.firstChild);
    }

    capa.innerHTML = '';
    let pendientes = 0;
    let fallados = 0;

    for (let tx = x0; tx <= x1; tx++) {
      for (let ty = y0; ty <= y1; ty++) {
        /* Cada imagen se coloca por sus esquinas reales: así queda donde
           corresponde aunque las dos proyecciones no sean idénticas. */
        const ni = proyectar(this._latDeY(ty, z), this._lngDeX(tx, z));
        const se = proyectar(this._latDeY(ty + 1, z), this._lngDeX(tx + 1, z));

        const img = document.createElementNS(NS, 'image');
        img.setAttribute('x', ni.x.toFixed(2));
        img.setAttribute('y', ni.y.toFixed(2));
        img.setAttribute('width', Math.abs(se.x - ni.x).toFixed(2));
        img.setAttribute('height', Math.abs(se.y - ni.y).toFixed(2));
        // Sin esto, los bordes entre imágenes se ven como rayas finas.
        img.setAttribute('preserveAspectRatio', 'none');

        pendientes++;
        /* Se decide imagen por imagen, no con un contador compartido: los
           mapas se redibujan varias veces mientras carga la página, y un
           contador que espera a "todas" se queda colgado cuando un dibujado
           nuevo reemplaza las imágenes del anterior a medio camino. */
        img.addEventListener('load', () => {
          if (!img.isConnected) return;       // la reemplazó un dibujado posterior
          this._mostrar(svg);
        });
        img.addEventListener('error', () => {
          fallados++;
          if (fallados >= pendientes) this._rendirse(svg);
        });

        /* El orden importa y cuesta descubrirlo: si a una <image> de SVG se
           le pone la dirección ANTES de estar en el documento, el navegador
           no la pide nunca, y ponerla después tampoco lo despierta. Primero
           se inserta, después se le da el href. */
        capa.appendChild(img);
        img.setAttribute('href', `${this.SERVIDOR}/${z}/${tx}/${ty}.png`);
      }
    }

    if (pendientes === 0) this._rendirse(svg);
  },

  /* Llegó al menos una imagen: se esconde el dibujo y se muestra el mapa
     real. Las que falten irán apareciendo encima a medida que lleguen. */
  _mostrar(svg) {
    svg.classList.add('con-mosaico');
    this._credito(svg);
  },

  /* No llegó ninguna: sin internet o con el servidor caído. Se borra lo que
     haya a medias y reaparece el dibujo, que es justo lo que uno quiere ver
     en el cerro sin señal. */
  _rendirse(svg) {
    const capa = svg.querySelector('.geo-mosaico');
    if (capa) capa.remove();
    svg.removeAttribute('data-mosaico');
    svg.classList.remove('con-mosaico');
  },

  /* OpenStreetMap pide que se diga de dónde salen las imágenes, y eso
     significa que tiene que verse siempre. Como las pantallas acercan el
     mapa moviendo el viewBox, el crédito se recoloca en la esquina de lo
     que se está viendo ahora, no en la del dibujo completo, y se escala
     para que no crezca al acercar. */
  _credito(svg) {
    const NS = 'http://www.w3.org/2000/svg';
    const m = DATA.mapaMarco;
    const vb = (svg.getAttribute('viewBox') || `0 0 ${m.ancho} ${m.alto}`)
      .split(/[\s,]+/).map(Number);
    const [x, y, w, h] = vb;
    const k = w / m.ancho;          // cuánto está acercado

    let t = svg.querySelector('.geo-credito');
    if (!t) {
      t = document.createElementNS(NS, 'text');
      t.setAttribute('class', 'geo-credito');
      t.textContent = '© OpenStreetMap';
      svg.appendChild(t);
    }
    t.setAttribute('x', (x + w - 8 * k).toFixed(1));
    t.setAttribute('y', (y + h - 8 * k).toFixed(1));
    t.style.fontSize = (13 * k).toFixed(1) + 'px';
  },

  /* Quita los mosaicos y deja el dibujo. */
  limpiar(contenedor) {
    const svg = contenedor && contenedor.querySelector('.map-geo');
    if (!svg) return;
    const capa = svg.querySelector('.geo-mosaico');
    if (capa) capa.remove();
    svg.removeAttribute('data-mosaico');
    svg.classList.remove('con-mosaico');
  },
};
