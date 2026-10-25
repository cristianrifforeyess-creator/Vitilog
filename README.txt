VITILOG · Versión Web (simulación de la app)
============================================

Sitio en HTML + CSS + JS puro. Un archivo HTML por interfaz.
La "base de datos local" usa localStorage (cuentas, sesión, publicaciones y tema).

Cómo abrirla
------------
Opción 1 (más simple): abre "login.html" (o "index.html") con doble clic en tu navegador.
Opción 2 (recomendada): sírvela por HTTP para que localStorage funcione igual que en producción.
   Si tienes Python:  python -m http.server 8080   (y abre http://localhost:8080)

Dos tipos de acceso
-------------------
El login tiene dos pestañas y cada cuenta pertenece a una de ellas:

  · Viñatero              -> productor vitivinícola. Publica sus sarmientos,
                             busca empresas y hace seguimiento de las rutas.
  · Empresa / Transportista -> empresa de biomasa, compostaje o transporte.
                             Ve las cargas de sarmientos publicadas por los
                             viñateros, las filtra y contacta al productor.

Al registrarse, la empresa indica además su rubro (Biomasa / Compostaje /
Transporte) y una persona de contacto. Si un correo se usa en la pestaña
equivocada, el sistema avisa cuál corresponde.

Cada rol tiene su propio menú y su propia página de inicio; si intentas abrir
una página del otro rol, te devuelve a tu inicio.

Interfaces (un HTML cada una)
-----------------------------
  index.html          -> redirige al login o al inicio según la sesión
  login.html          -> acceso y registro, con las dos pestañas

  Viñatero:
  inicio.html         -> panel principal (AgroConecta)
  rutas.html          -> rutas (disponibles / programadas / en curso)
  historial.html      -> historial de recolecciones
  perfil.html         -> perfil del viñatero + empresas conectadas
  publicar.html       -> formulario para publicar sarmientos
  empresas.html       -> buscador de empresas (biomasa / compostaje)

  Empresa / Transportista:
  inicio-empresa.html -> panel principal (resumen de la oferta y últimas cargas)
  cargas.html         -> cargas de sarmientos publicadas, con filtros por
                         comuna, rubro y volumen mínimo, y contacto directo

  Compartidas:
  mapa.html           -> mapa con marcadores (Google Maps si hay clave)
  configuracion.html  -> datos de cuenta + modo claro/oscuro (se adapta al rol)

Carpetas
--------
  css/styles.css      -> estilos (tema claro y oscuro)
  js/config.js        -> clave de Google Maps (pégala ahí para el mapa real)
  js/data.js          -> datos de ejemplo (Región del Maule) y cargas de muestra
  js/store.js         -> base de datos local (localStorage), cuentas y roles
  js/shell.js         -> navegación por rol, tema, sesión y utilidades
  js/comprobante.js   -> Comprobante de Disposición Limpia y Sello Verde
  js/demo.js          -> datos de demostración (solo lo carga admin.html)

Nota: las contraseñas se guardan en texto plano (prototipo). Los datos son
locales por navegador; no se sincronizan entre equipos. Las cargas que ve una
empresa son las de ejemplo de data.js más las que se publiquen desde
publicar.html en ese mismo navegador.

Mapa
----
mapa.html puede mostrar el mapa de tres formas. Se elige con MODO_MAPA en
js/config.js; por omisión queda en 'auto', que decide solo:

  1. Google Maps completo   -> si pegaste una clave de API en js/config.js.
                               Marcadores propios y clic directo en el mapa.
  2. Google Maps incrustado -> si NO hay clave pero sí hay internet. Mapa real
                               de Google sin necesidad de clave. Como este modo
                               no admite marcadores propios, bajo el mapa
                               aparece la lista de empresas: al tocar una, el
                               mapa se centra en ella; el botón "Ficha" abre
                               sus datos y el contacto.
  3. Mapa esquemático       -> si no hay internet, si Google rechaza la clave o
                               si lo fuerzas. Dibujo en SVG con la costa, las
                               cordilleras, el Río Maule y la Ruta 5. No hace
                               ninguna petición a internet.

El modo 2 se apoya en una dirección de Google que no está documentada como API
pública. Hoy funciona y es de uso muy extendido, pero podría cambiar sin aviso;
si eso ocurriera, la página cae sola al modo 3.

Cada punto de js/data.js tiene lat/lng (ubicación real, para Google Maps) y
x/y en porcentaje (posición dentro del recuadro, para el mapa esquemático).

Ubicación del usuario
---------------------
Al registrarse, tanto el viñatero como la empresa/transportista eligen su
comuna de una lista (js/data.js -> comunas). Esa comuna tiene coordenadas, así
que el mapa la marca automáticamente:

  · Viñatero -> el marcador dice "Tu viñedo".
  · Empresa  -> el marcador dice "Tu base".

Sobre el mapa hay un botón "Usar mi ubicación actual" que pide la ubicación
real al navegador (GPS). Requiere que el usuario acepte el permiso y que la
página se sirva por http://localhost o https://. Abierta con doble clic sobre
el archivo (file://) los navegadores bloquean la ubicación; en ese caso el
botón avisa y se sigue usando la comuna registrada.

Con la ubicación conocida, la página calcula la distancia en línea recta hasta
cada planta, ordena la lista por cercanía y muestra arriba cuál es la planta
más cercana con cupos donde dejar los sarmientos.

Puntos de entrega
-----------------
Las plantas de biomasa y de compostaje son los lugares donde se dejan los
sarmientos: aparecen con marcador más grande, borde verde en la lista y la
etiqueta "Aquí puedes dejar tus sarmientos". Los centros de acopio solo agrupan
cargas antes de llevarlas a una planta, y se muestran más discretos.

Empresas en el mapa
-------------------
Todas las empresas y centros salen de una única lista: js/data.js -> puntos.
Antes había además una lista "empresas" separada, con distancias escritas a
mano, que repetía a varias de las mismas empresas; se eliminó para que el mapa
y el buscador no puedan contradecirse.

En el mapa aparecen:
  · Las 10 plantas y centros fijos de js/data.js (biomasa, compostaje y acopio).
  · Las empresas que se registraron en la plataforma, ubicadas por la comuna
    que eligieron, con el sello "Registrada en VITILOG". Al contactarlas se
    usan su correo y teléfono reales, no los de demostración.

La cuenta con la sesión abierta no se duplica: ya sale marcada como "Tu base".

empresas.html (Buscar Empresas) muestra solo las que reciben sarmientos
—biomasa y compostaje—, ordenadas por cercanía y con la distancia calculada
desde la comuna del usuario. Los transportistas registrados aparecen en el
mapa, pero no en ese buscador, porque no son un lugar donde dejar el residuo.

Cómo se guardan los datos en el navegador
-----------------------------------------
Todo lo que es "base de datos" vive en una sola llave de localStorage,
vitilog_db, con una lista por tabla:

  { version, guardado, cuentas, cargas, puntos, envios, mensajes, movimientos }

Antes había una llave por tabla. Se juntaron por dos razones: media docena de
escrituras por cada cambio, y la posibilidad de quedar a medias —las cargas
guardadas y los envíos no— si el navegador cortaba la página en el momento
justo. Con un objeto único, o se guarda todo o no se guarda nada.

Las versiones viejas se migran solas la primera vez que se abre el sitio: se
leen las llaves sueltas, se escribe el objeto nuevo y recién entonces se
borran las viejas. No hay que hacer nada.

Aparte quedan, a propósito, las cosas que son de este aparato y no de la base:
  vitilog_session    -> con qué cuenta entraste
  vitilog_theme      -> claro u oscuro
  vitilog_chat_visto -> qué mensajes ya leíste
  vitilog_nube_url / vitilog_nube_key -> credenciales de Supabase
  vitilog_ruteo      -> caché de rutas de OSRM

Si estuvieran dentro del objeto de datos, restablecer la demostración te
echaría de tu propia sesión y te volvería a pedir las credenciales.

Datos de demostración
---------------------
En Administración -> Resumen hay un botón discreto, "Restablecer demo /
Cargar datos oficiales". Deja el escenario completo y siempre el mismo:
dos viñas (Curicó y Linares), una planta en Talca, un transportista con
tropa, un cargador individual, cuatro cargas publicadas, un viaje en curso
que consolida Curicó y Molina, y una entrega cerrada con pesaje validado y
su Sello Verde.

Todas las cuentas sembradas terminan en @demo.agroconecta.cl y entran con la
clave demo1234. Todo lo que crea lleva identificadores que empiezan con
"demo-": esa es la única forma de limpiar lo de la demostración sin tocar lo
de nadie más.

Con la base compartida conectada, el botón SOLO reemplaza los registros de
demostración. Vaciar todo queda disponible únicamente con base local, porque
en la compartida borraría las cuentas y las cargas de los demás.

Base de datos compartida
------------------------
VITILOG funciona con dos orígenes de datos intercambiables, que se eligen con
MODO_DATOS en js/config.js:

  local -> localStorage. Cada navegador tiene sus propios datos. Es lo que
           usa de fábrica y no necesita configurar nada.
  nube  -> Supabase. Las cuentas, las cargas y las plantas se comparten entre
           todos los dispositivos.

Para activar la base compartida:
  1. Crea una cuenta gratuita en https://supabase.com y un proyecto nuevo.
  2. Abre "SQL Editor" y ejecuta el archivo sql/esquema.sql completo.
  3. Copia el Project URL y la anon key desde "Project Settings" -> "API"
     y pégalas en js/config.js.

Si la base compartida está configurada pero falla la conexión, el sitio sigue
funcionando con los datos locales y avisa con un mensaje: así nadie cree que
está viendo datos sincronizados cuando no lo están.

Contraseñas
-----------
Ya no se guardan en texto plano: se almacena sha256(sal + contraseña), con una
sal distinta por cuenta. Las cuentas creadas antes de este cambio siguen
funcionando, y al cambiar su contraseña pasan al formato nuevo.

Aun así, esto NO es autenticación de nivel productivo. La clave "anon" de
Supabase queda visible en el código del sitio y las políticas del esquema son
permisivas, para que el prototipo funcione sin servidor propio. Para uso real
hay que migrar a Supabase Auth con políticas por usuario.

Administración
--------------
Hay un tercer tipo de cuenta, "admin", que no se puede crear desde el sitio:
se siembra al preparar la base. Se entra por la pestaña "Administración" del
login y lleva a admin.html, que permite:

  · Resumen  -> cuántos viñateros, empresas, cargas y plantas hay, y el
                volumen publicado por comuna.
  · Cuentas  -> suspender, reactivar o eliminar cuentas. Una cuenta suspendida
                no puede iniciar sesión.
  · Cargas   -> ver y eliminar cualquier publicación.
  · Plantas  -> agregar plantas o centros de acopio (la comuna define las
                coordenadas), abrir o cerrar sus cupos, y eliminarlos.
                Lo que se agrega aquí aparece de inmediato en el mapa y en el
                buscador de empresas.

En modo local se crea sola una cuenta admin@vitilog.cl con la contraseña
admin1234, y el panel la marca con el aviso "Clave por defecto". En modo nube
la contraseña se define al ejecutar sql/esquema.sql. Cámbiala en ambos casos.

Cambiar la contraseña
---------------------
Configuración tiene una sección "Contraseña" para cambiarla desde la propia
aplicación. Pide la contraseña actual, exige un mínimo de 4 caracteres y que
la nueva se escriba dos veces.

Si la cuenta todavía usa la contraseña sembrada por defecto, aparece un aviso
amarillo hasta que se cambie. Cámbiala antes de compartir el sitio.

Qué NO subir al hosting
-----------------------
Este README y la carpeta sql/ son documentación: no hacen falta para que el
sitio funcione y quedarían accesibles públicamente (por ejemplo en
tusitio.netlify.app/README.txt). El paquete que se despliega los deja fuera.

Seguimiento de retiros
----------------------
rutas.html tiene una pestaña "Seguimiento" con los retiros en curso, y
seguimiento.html muestra uno en detalle: mapa del recorrido, línea de estados,
distancia que falta y llegada estimada. Se refresca solo cada 5 segundos.

Un retiro pasa por cinco estados:
  programado -> en_camino -> llegando -> en_destino -> entregado

La posición del camión viene de dos fuentes, y la pantalla no las distingue:
  · GPS real  -> si el chofer abre el seguimiento y pulsa "Reportar mi
                 ubicación", su posición queda guardada en el envío y el
                 viñatero la ve actualizarse. Aparece como "Posición GPS".
  · Estimada  -> si nadie reporta, la posición se calcula por el tiempo
                 transcurrido desde la salida sobre el trayecto recta
                 origen-destino. Aparece como "Posición estimada".

El retiro lo crea la empresa desde cargas.html con "Programar retiro"
(indica chofer, teléfono, patente y duración estimada). El viñatero también
puede generar uno de prueba desde la pestaña Seguimiento cuando no tiene
ninguno, para ver cómo funciona.

Chat y cierre del servicio
--------------------------
El chat de cada retiro permanece bloqueado hasta que el camión llega a
destino. Se hizo así a propósito: la conversación queda junto a la
confirmación de la entrega y no se dispersa durante el viaje.

Al pasar a "en destino" se envía una notificación del navegador (si el
usuario dio permiso) y además un aviso en pantalla, para que se vea aunque
el permiso esté denegado.

Desde ahí se registra el pesaje —volumen recibido, peso en balanza y
observaciones— y se cierra el servicio. El envío pasa a "entregado" y queda
en la lista de entregas cerradas.

Las notificaciones y el GPS necesitan https:// o http://localhost. Abierto
como archivo local, el aviso en pantalla sigue funcionando.

Perfil de chofer y telemetría
-----------------------------
Hay un cuarto tipo de cuenta, "chofer", que trabaja por su cuenta y es
independiente de las empresas receptoras. Se registra desde el login igual
que los demás, indicando teléfono, patente y capacidad del camión.

El circuito completo es:

  1. El viñatero publica una carga (publicar.html). Al terminar se le informa
     a cuántos choferes quedó visible y cuántos tienen base cerca.
  2. El chofer la ve en inicio-chofer.html, ordenada por distancia a su base.
     Si aparecen cargas nuevas mientras tiene la página abierta, recibe una
     notificación.
  3. El chofer la acepta eligiendo a qué planta la llevará. Eso crea el envío
     y la carga deja de ofrecerse a los demás choferes.
  4. En viaje.html pulsa "Iniciar viaje" y comienza a transmitir su GPS.
  5. El viñatero ve la posición real en seguimiento.html, con la antigüedad
     de la señal y la precisión en metros.
  6. Al llegar se abre el chat, se registra el pesaje y se cierra el servicio.

Consumo de la transmisión
-------------------------
watchPosition avisa cada vez que el GPS detecta movimiento, lo que en
carretera puede ser varias veces por segundo. Escribir todo eso gastaría
batería y datos sin ganar precisión, así que solo se guarda cuando pasaron
15 segundos O el camión se movió 120 metros, lo que ocurra después. Ambos
valores se ajustan en Shell.iniciarTransmision().

El mapa no consume ninguna API: está dibujado en SVG dentro del propio
sitio, así que acercarlo o redibujarlo no genera peticiones ni costo.

Si la señal se corta
--------------------
Cuando pasan más de 2 minutos sin posición nueva, la señal se da por perdida:
la pantalla vuelve a la posición estimada por tiempo y lo dice explícitamente.
Mostrar una posición vieja como si fuera actual sería peor que estimarla.

IMPORTANTE: entre dos dispositivos
----------------------------------
La transmisión del chofer solo llega al viñatero si está activada la base
compartida (Supabase). En modo local cada navegador guarda sus propios datos,
así que el GPS del celular del chofer nunca cruzaría al equipo del viñatero.
Para una demostración en un solo equipo funciona; para uso real hay que
configurar Supabase como explica la sección "Base de datos compartida".
