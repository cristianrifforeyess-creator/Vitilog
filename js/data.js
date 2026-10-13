/* Datos de ejemplo (Región del Maule) — equivalente a MockData de la app. */
const DATA = {
  statsInicio: [
    { ic: '🧭', color: '#2E7D32', val: '3.8 km', lbl: 'Ruta Óptima', sub: 'Recorrido' },
    { ic: '⏱️', color: '#1976D2', val: '18 min', lbl: 'Tiempo Estimado', sub: 'Aproximado' },
    { ic: '📦', color: '#43A047', val: '14 m³', lbl: 'Volumen Estimado', sub: 'Sarmientos' },
    { ic: '🔥', color: '#F9A825', val: '4.2 MWh', lbl: 'Valor Energético', sub: 'Aprovechable' },
  ],

  alertas: [
    { ic: '✅', color: '#2E7D32', titulo: 'Zona lista para recolectar', detalle: 'Sarmientos acumulados en Curicó' },
    { ic: '🏭', color: '#1976D2', titulo: 'Nueva empresa disponible', detalle: 'BioEnergía Maule busca cargas en tu zona' },
    { ic: '💰', color: '#F9A825', titulo: 'Flete optimizado', detalle: 'Ahorro estimado del 30% agrupando cargas' },
  ],

  enCurso: {
    origen: 'Parral', destino: 'Talca', volumen: 20, minutos: 40, km: 88,
    estado: 'enCurso', hechas: 2, totales: 6, eta: '11:45 AM',
  },

  disponibles: [
    { origen: 'Curicó', destino: 'Talca', volumen: 12, minutos: 26, km: 58, pendientes: 5 },
    { origen: 'Linares', destino: 'Molina', volumen: 18, minutos: 32, km: 71, pendientes: 4 },
    { origen: 'Constitución', destino: 'San Javier', volumen: 15, minutos: 28, km: 64, pendientes: 3 },
  ],

  programadas: [
    { origen: 'Molina', destino: 'Curicó', volumen: 10, minutos: 22, km: 40, fecha: '27 de agosto, 2026', hora: '09:00 AM' },
    { origen: 'San Javier', destino: 'Linares', volumen: 16, minutos: 30, km: 55, fecha: '2 de septiembre, 2026', hora: '08:30 AM' },
  ],

  historial: [
    { origen: 'Constitución', destino: 'Talca', volumen: 12, minutos: 26, km: 60, fecha: '19 de agosto, 2026', hora: '10:05 AM' },
    { origen: 'Curicó', destino: 'Molina', volumen: 9, minutos: 18, km: 40, fecha: '12 de agosto, 2026', hora: '12:40 PM' },
    { origen: 'Linares', destino: 'Parral', volumen: 14, minutos: 24, km: 48, fecha: '5 de agosto, 2026', hora: '09:20 AM' },
  ],

  /* Las empresas ya no se listan aparte: salen de "puntos", que es la única
     fuente con coordenadas. Así el mapa y el buscador nunca se contradicen.
     Ver Shell.empresasParaBuscador() en js/shell.js. */

  /* Cargas de sarmientos publicadas por productores. Son las que ve una
     cuenta de empresa/transportista, junto a las que se publiquen desde
     publicar.html en este mismo navegador. */
  cargasDemo: [
    { id: 'demo-1', productor: 'Viña Los Maitenes', comuna: 'Curicó', volumen: 14, destino: 'Biomasa',
      fecha: '27/08/2026', km: 12, notas: 'Acceso por camino interior. Entra camión de hasta 12 m.',
      telefono: '+56 9 7412 3390', email: 'contacto@losmaitenes.cl' },
    { id: 'demo-2', productor: 'Agrícola Santa Rita del Maule', comuna: 'Molina', volumen: 22, destino: 'Compostaje',
      fecha: '29/08/2026', km: 32, notas: 'Sarmientos apilados junto al galpón, listos para cargar.',
      telefono: '+56 9 6620 8145', email: 'operaciones@santaritamaule.cl' },
    { id: 'demo-3', productor: 'Viñedos Don Aurelio', comuna: 'San Javier', volumen: 9, destino: 'Indistinto',
      fecha: '01/09/2026', km: 64, notas: 'Poda reciente. Se puede coordinar el retiro en la mañana.',
      telefono: '+56 9 5238 7701', email: 'aurelio@vinedosdonaurelio.cl' },
    { id: 'demo-4', productor: 'Hacienda Río Claro', comuna: 'Talca', volumen: 31, destino: 'Biomasa',
      fecha: '03/09/2026', km: 58, notas: 'Volumen grande: conviene programar dos viajes.',
      telefono: '+56 9 8890 4412', email: 'logistica@haciendarioclaro.cl' },
    { id: 'demo-5', productor: 'Viña El Peumo', comuna: 'Linares', volumen: 12, destino: 'Compostaje',
      fecha: '05/09/2026', km: 71, notas: 'Los últimos 2 km son de camino de ripio.',
      telefono: '+56 9 4471 6628', email: 'elpeumo@correo.cl' },
    { id: 'demo-6', productor: 'Sociedad Agrícola Parral Sur', comuna: 'Parral', volumen: 18, destino: 'Indistinto',
      fecha: '09/09/2026', km: 88, notas: 'Solicitan aviso con 24 horas de anticipación.',
      telefono: '+56 9 3315 9074', email: 'contacto@parralsur.cl' },
  ],

  /* Alertas del panel de empresa. */
  alertasEmpresa: [
    { ic: '🌾', color: '#2E7D32', titulo: 'Nueva carga publicada', detalle: 'Hacienda Río Claro ofrece 31 m³ en Talca' },
    { ic: '🚚', color: '#EF6C00', titulo: 'Retiro programado', detalle: 'Camión asignado a Molina para el 29/08' },
    { ic: '💰', color: '#F9A825', titulo: 'Flete compartido', detalle: 'Agrupa Curicó y Molina y ahorra 30% del viaje' },
  ],

  /* Rubros disponibles al crear una cuenta de empresa. */
  tiposEmpresa: ['Biomasa', 'Compostaje', 'Transporte'],

  /* Estados por los que pasa un envío, en orden. El seguimiento avanza por
     esta lista; cada estado define su color y qué se puede hacer en él. */
  estadosEnvio: [
    { id: 'programado', label: 'Programado', ic: '📅', color: '#1976D2',
      desc: 'El retiro está agendado y aún no sale' },
    { id: 'en_camino', label: 'En camino', ic: '🚚', color: '#EF6C00',
      desc: 'El camión va en ruta hacia la planta' },
    { id: 'llegando', label: 'Llegando', ic: '📍', color: '#F9A825',
      desc: 'Está a menos de 15 km del destino' },
    { id: 'en_destino', label: 'En destino', ic: '🏭', color: '#6A1B9A',
      desc: 'Llegó a la planta. Ya puedes contactar al chofer' },
    { id: 'entregado', label: 'Entregado', ic: '✅', color: '#2E7D32',
      desc: 'Pesaje confirmado y servicio cerrado' },
  ],

  /* Choferes de ejemplo, para los envíos de demostración. */
  choferesDemo: [
    { nombre: 'Marco Villalobos', telefono: '+56 9 7745 2210', patente: 'KDJS-42' },
    { nombre: 'Patricia Fuentes', telefono: '+56 9 6318 9074', patente: 'LPRT-18' },
    { nombre: 'Hernán Ñanco', telefono: '+56 9 5520 6633', patente: 'JGHW-75' },
  ],

  /* Plantas y centros de acopio. Solo llevan lat/lng: la posición dentro del
     mapa propio se calcula con proyectar(), así cualquier punto nuevo —o una
     empresa que se registre— queda ubicado sin tener que colocarlo a mano. */
  puntos: [
    { id: 'curico', nombre: 'EnerVid SpA', tipo: 'Biomasa', comuna: 'Curicó', desc: 'Planta de biomasa. Recibe sarmientos para generación energética.', cap: 40, activo: true, lat: -35.0100, lng: -71.2050 },
    { id: 'talca', nombre: 'BioEnergía Maule', tipo: 'Biomasa', comuna: 'Talca', desc: 'Centro regional de acopio y valorización energética.', cap: 65, activo: true, lat: -35.4520, lng: -71.6180 },
    { id: 'molina', nombre: 'Compost Valle Central', tipo: 'Compostaje', comuna: 'Molina', desc: 'Planta de compostaje de residuos de poda de vid.', cap: 30, activo: true, lat: -35.1320, lng: -71.2560 },
    { id: 'linares', nombre: 'Centro de Acopio Linares', tipo: 'Acopio', comuna: 'Linares', desc: 'Punto de acopio intermedio para agrupar cargas.', cap: 25, activo: true, lat: -35.8650, lng: -71.5680 },
    { id: 'constitucion', nombre: 'Acopio Costa Constitución', tipo: 'Acopio', comuna: 'Constitución', desc: 'Recepción de sarmientos del secano costero.', cap: 20, activo: true, lat: -35.3480, lng: -72.3900 },
    { id: 'sanjavier', nombre: 'TierraViva Compost', tipo: 'Compostaje', comuna: 'San Javier', desc: 'Planta de compostaje. Actualmente sin cupos disponibles.', cap: 35, activo: false, lat: -35.6120, lng: -71.7060 },
    { id: 'teno', nombre: 'Agroenergía Teno', tipo: 'Biomasa', comuna: 'Teno', desc: 'Caldera de biomasa agrícola. Recibe sarmientos chipeados o enteros.', cap: 28, activo: true, lat: -34.8850, lng: -71.1400 },
    { id: 'sagrada', nombre: 'Vermicompost Sagrada Familia', tipo: 'Compostaje', comuna: 'Sagrada Familia', desc: 'Compostaje y lombricultura a partir de restos de poda.', cap: 18, activo: true, lat: -34.9700, lng: -71.3600 },
    { id: 'linares2', nombre: 'Compost Andes Linares', tipo: 'Compostaje', comuna: 'Linares', desc: 'Planta de compostaje del valle de Linares.', cap: 32, activo: true, lat: -35.8300, lng: -71.5500 },
    { id: 'parral', nombre: 'Bioenergía Parral Sur', tipo: 'Biomasa', comuna: 'Parral', desc: 'Generación eléctrica con residuos agrícolas del sur del Maule.', cap: 45, activo: true, lat: -36.1600, lng: -71.8000 },
  ],

  /* Encuadre inicial del mapa real (centro aproximado de la Región del Maule). */
  mapaVista: { lat: -35.45, lng: -71.70, zoom: 8 },

  /* Marco geográfico del mapa propio. El recuadro cubre 227 km de ancho por
     183 km de alto, y el viewBox de 1000x808 respeta esa misma proporción,
     así que el dibujo no queda deformado. */
  mapaMarco: {
    norte: -34.70, sur: -36.35, oeste: -72.95, este: -70.45,
    ancho: 1000, alto: 808,
  },

  /* Comunas donde puede estar el usuario. */
  comunas: [
    { nombre: 'Curicó', lat: -34.9854, lng: -71.2394 },
    { nombre: 'Talca', lat: -35.4264, lng: -71.6554 },
    { nombre: 'Molina', lat: -35.1116, lng: -71.2803 },
    { nombre: 'Linares', lat: -35.8464, lng: -71.5931 },
    { nombre: 'Constitución', lat: -35.3332, lng: -72.4118 },
    { nombre: 'San Javier', lat: -35.5942, lng: -71.7300 },
    { nombre: 'Sagrada Familia', lat: -34.9539, lng: -71.3853 },
    { nombre: 'Parral', lat: -36.1436, lng: -71.8261 },
    { nombre: 'Romeral', lat: -34.9694, lng: -71.1436 },
    { nombre: 'Teno', lat: -34.8703, lng: -71.1636 },
    { nombre: 'Rauco', lat: -34.9319, lng: -71.3181 },
  ],
};

/* Colores por tipo (marcador / icono). */
function tipoColor(tipo, activo) {
  if (activo === false) return '#E53935';
  if (tipo === 'Biomasa') return '#F9A825';
  if (tipo === 'Compostaje') return '#43A047';
  if (tipo === 'Transporte') return '#6A1B9A';
  return '#1976D2';
}

/* Convierte coordenadas reales en la posición dentro del mapa propio.
   Es una proyección plana: a esta escala (unos 200 km) la diferencia con una
   proyección cartográfica formal es despreciable. */
function proyectar(lat, lng) {
  const m = DATA.mapaMarco;
  return {
    x: (lng - m.oeste) / (m.este - m.oeste) * m.ancho,
    y: (m.norte - lat) / (m.norte - m.sur) * m.alto,
  };
}

/* Datos de un estado de envío a partir de su identificador. */
function estadoEnvio(id) {
  return DATA.estadosEnvio.find(e => e.id === id) || DATA.estadosEnvio[0];
}

/* Posición de un estado dentro de la secuencia (0 a 4). */
function pasoEstado(id) {
  const i = DATA.estadosEnvio.findIndex(e => e.id === id);
  return i < 0 ? 0 : i;
}

/* ¿Es un punto donde se pueden dejar los sarmientos?
   Las plantas de biomasa y de compostaje reciben el residuo para valorizarlo.
   Los centros de acopio solo agrupan cargas antes de llevarlas a una planta. */
function recibeSarmientos(tipo) {
  return tipo === 'Biomasa' || tipo === 'Compostaje';
}

/* Ícono por destino/rubro del residuo. */
function tipoIcono(tipo) {
  if (tipo === 'Biomasa') return '🔥';
  if (tipo === 'Compostaje') return '♻️';
  if (tipo === 'Transporte') return '🚚';
  return '🌿';
}
function tipoPin(tipo, activo) {
  const c = tipoColor(tipo, activo);
  return `<span style="color:${c}">📍</span>`;
}
