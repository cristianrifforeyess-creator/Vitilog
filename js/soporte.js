/* ============ Soporte: avisar un problema y que alguien conteste ============

   Quien usa esto está en una viña, con las manos sucias y media barra de
   señal. Si algo falla, no va a escribir un correo ni a buscar un
   formulario: necesita un botón grande y dos salidas inmediatas, llamar
   o mandar un mensaje.

   Por eso son solo esas dos vías, y las dos salen de la aplicación hacia
   algo que el teléfono ya sabe hacer: el marcador y WhatsApp. No hay
   bandeja de tickets que nadie mire, ni chat propio que haya que
   mantener encendido del otro lado.

   LO QUE VIAJA EN EL MENSAJE
   --------------------------
   El mensaje de WhatsApp se arma solo con el contexto operativo: quién
   escribe, con qué perfil, desde qué comuna y sobre qué carga o ruta.
   Sin eso, el primer intercambio se va entero en "¿quién eres y de qué
   carga me hablas?", que es tiempo perdido para los dos.

   El usuario ve el mensaje antes de enviarlo y puede corregirlo: no se
   manda nada a sus espaldas. */
const Soporte = {
  /* A quién se avisa. Se busca el teléfono de la administración en la
     base; si no lo declaró, se usa el de js/config.js. */
  telefono() {
    const admin = (Store.accounts() || []).find(a =>
      Store.rolDe(a) === Store.ROL_ADMIN && (a.telefono || '').trim());
    const crudo = admin ? admin.telefono
      : (typeof SOPORTE_TELEFONO === 'string' ? SOPORTE_TELEFONO : '');
    return this._normalizar(crudo);
  },

  /* Deja el número como lo quieren tel: y wa.me: solo dígitos, con el
     código de país. Acepta +56 9 1234 5678, 912345678, 56912345678… */
  _normalizar(crudo) {
    let d = String(crudo || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.length === 8) d = '569' + d;          // 1234 5678
    else if (d.length === 9 && d[0] === '9') d = '56' + d;
    else if (d.length === 11 && d.startsWith('56')) { /* ya viene bien */ }
    return d;
  },

  hayCanal() { return this.telefono() !== ''; },

  /* -------- Contexto operativo --------
     Sobre qué está reclamando. Se elige lo más probable según el rol: un
     viaje en curso pesa más que una carga publicada hace una semana. */
  asunto() {
    const u = Store.currentUser();
    if (!u) return null;
    const rol = Store.rolDe(u);

    if (rol === Store.ROL_CHOFER) {
      const viaje = Store.servicioActivo && Store.servicioActivo();
      if (viaje) {
        return { tipo: 'Ruta', id: viaje.id,
                 detalle: `${viaje.origenComuna} → ${viaje.destinoNombre}` };
      }
      const estiba = (Store.misEstibas() || [])
        .find(e => e.estado !== 'entregado');
      if (estiba) {
        return { tipo: 'Estiba', id: estiba.id,
                 detalle: `${estiba.origenComuna} → ${estiba.destinoNombre}` };
      }
      return null;
    }

    const activos = (Store.enviosActivos && Store.enviosActivos()) || [];
    if (activos.length) {
      const e = activos[0];
      return { tipo: 'Ruta', id: e.id,
               detalle: `${e.origenComuna} → ${e.destinoNombre}` };
    }

    if (rol === Store.ROL_VINATERO) {
      const mia = (Store.cargasDisponibles() || [])
        .find(c => c.email === Store.currentEmail());
      if (mia) {
        return { tipo: 'Carga', id: mia.id,
                 detalle: `${mia.comuna} · ${mia.volumen} m³` };
      }
    }
    return null;
  },

  /* El texto que se manda. Se arma en líneas sueltas porque WhatsApp
     respeta los saltos y así se lee de un vistazo en el teléfono. */
  mensaje(descripcion) {
    const u = Store.currentUser();
    const a = this.asunto();
    const lineas = [
      '*Soporte AgroConecta*',
      '',
      `Perfil: ${Store.etiquetaCuenta(u)}`,
      `Nombre: ${u.nombre}`,
    ];
    if (u.comuna) lineas.push(`Comuna: ${u.comuna}`);
    if (a) lineas.push(`${a.tipo}: ${a.id} (${a.detalle})`);
    lineas.push('');
    lineas.push(`Problema: ${descripcion || '(sin describir)'}`);
    return lineas.join('\n');
  },

  urlWhatsApp(descripcion) {
    return `https://wa.me/${this.telefono()}?text=`
      + encodeURIComponent(this.mensaje(descripcion));
  },

  urlLlamada() { return 'tel:+' + this.telefono(); },

  /* -------- Pantalla -------- */
  /* Problemas frecuentes, para no obligar a escribir con una mano. Al
     tocarlos rellenan la descripción, que igual se puede editar. */
  FRECUENTES: [
    'No puedo publicar mi carga',
    'El camión no ha llegado',
    'El GPS no se enciende',
    'No veo la carga que publiqué',
    'Problema con el pesaje',
    'No puedo entrar a mi cuenta',
  ],

  abrir() {
    const a = this.asunto();
    const u = Store.currentUser();

    Shell.openModal(`
      <div class="handle"></div>
      <div style="display:flex;align-items:center;gap:12px">
        <div class="li-ic" style="background:rgba(229,57,53,.12);color:var(--danger)">🆘</div>
        <div style="flex:1">
          <b style="font-size:17px">Reportar un problema</b>
          <div class="li-sub">Te contactamos de inmediato</div>
        </div>
      </div>

      <div class="card pad" style="background:var(--surface-alt);margin-top:14px">
        <div class="li-sub">Se enviará con estos datos:</div>
        <div class="li-sub" style="margin-top:4px">
          👤 ${Shell.escape(u.nombre)} · ${Shell.escape(Store.etiquetaCuenta(u))}${
            u.comuna ? ' · ' + Shell.escape(u.comuna) : ''}
        </div>
        ${a ? `<div class="li-sub">📋 ${Shell.escape(a.tipo)} ${Shell.escape(a.id)} · ${Shell.escape(a.detalle)}</div>`
             : `<div class="li-sub">📋 Sin carga ni ruta activa</div>`}
      </div>

      <div class="field" style="margin-top:14px">
        <label for="sop-desc">¿Qué está pasando?</label>
        <div class="chip-select" id="sop-frecuentes" style="margin-bottom:10px"></div>
        <textarea id="sop-desc" rows="3"
                  placeholder="Cuéntanos brevemente el problema"></textarea>
      </div>

      <a class="btn block" id="sop-wa" href="#" target="_blank" rel="noopener"
         style="background:#25D366;display:flex;align-items:center;justify-content:center;gap:8px;min-height:54px">
        💬 Escribir por WhatsApp
      </a>
      <a class="btn block" id="sop-tel" href="${this.urlLlamada()}"
         style="margin-top:10px;display:flex;align-items:center;justify-content:center;gap:8px;min-height:54px">
        📞 Llamar ahora
      </a>
      <button class="btn ghost block" style="margin-top:10px"
              onclick="Shell.closeModal()">Cancelar</button>`);

    const desc = document.getElementById('sop-desc');
    const wa = document.getElementById('sop-wa');

    /* El enlace se rehace con cada tecla: así, cuando el usuario lo
       toca, el mensaje ya lleva lo que acaba de escribir. */
    const refrescar = () => { wa.href = this.urlWhatsApp(desc.value.trim()); };
    refrescar();
    desc.addEventListener('input', refrescar);

    const chips = document.getElementById('sop-frecuentes');
    chips.innerHTML = this.FRECUENTES.map((f, i) =>
      `<button type="button" class="chip" data-f="${i}">${f}</button>`).join('');
    chips.querySelectorAll('.chip').forEach(b => {
      b.onclick = () => {
        desc.value = this.FRECUENTES[+b.dataset.f];
        refrescar();
        desc.focus();
      };
    });

    desc.focus();
  },

  /* -------- Montaje --------
     Un botón flotante en todas las pantallas y otro en la cabecera. Dos
     accesos al mismo sitio porque en terreno se mira el pulgar, no la
     barra de arriba, y en el escritorio al revés. */
  montar() {
    const rol = Store.rolActual();
    // La administración es el soporte: no tiene a quién reportar.
    if (!rol || rol === Store.ROL_ADMIN) return;
    if (!this.hayCanal()) return;

    if (!document.getElementById('fab-soporte')) {
      const b = document.createElement('button');
      b.id = 'fab-soporte';
      b.className = 'fab-soporte';
      b.type = 'button';
      b.title = 'Reportar un problema';
      b.setAttribute('aria-label', 'Reportar un problema');
      b.innerHTML = '<span aria-hidden="true">🆘</span><span class="fab-texto">Ayuda</span>';
      b.onclick = () => this.abrir();
      document.body.appendChild(b);
    }

    // Y el acceso rápido en la cabecera, donde ya hay otros botones.
    const acciones = document.querySelector('.topbar .tb-actions');
    if (acciones && !acciones.querySelector('[data-soporte]')) {
      const b = document.createElement('button');
      b.dataset.soporte = '1';
      b.title = 'Reportar un problema';
      b.setAttribute('aria-label', 'Reportar un problema');
      b.textContent = '🆘';
      b.onclick = () => this.abrir();
      acciones.insertBefore(b, acciones.firstChild);
    }
  },
};
