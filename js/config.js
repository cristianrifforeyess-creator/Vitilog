/* ============ Configuración de VITILOG ============

   CLAVE DE GOOGLE MAPS
   --------------------
   Pega aquí tu clave de la API de Google Maps, entre las comillas.
   Por ejemplo:  const GOOGLE_MAPS_API_KEY = 'AIzaSyD-abc123...';

   Cómo obtenerla (una sola vez):
     1. Entra a  https://console.cloud.google.com/
     2. Crea un proyecto (o usa uno que ya tengas).
     3. Menú "APIs y servicios" -> "Biblioteca" -> busca "Maps JavaScript API"
        -> Habilitar.
     4. Menú "APIs y servicios" -> "Credenciales" -> "Crear credenciales"
        -> "Clave de API". Copia la clave que aparece.
     5. Pégala abajo.

   Requiere activar una cuenta de facturación en Google Cloud. Google
   entrega un uso mensual gratuito que alcanza de sobra para un proyecto
   como este, pero conviene revisar las condiciones vigentes.

   Recomendación de seguridad: en "Credenciales" -> tu clave -> "Restricciones
   de la aplicación", limita la clave a los sitios donde la vas a usar.
   Ten presente que cualquier clave puesta en un sitio web queda visible
   para quien mire el código fuente; por eso la restricción importa.

   Si dejas esto vacío, el sitio funciona igual: muestra automáticamente el
   mapa esquemático de respaldo, que no necesita internet ni clave. */

const GOOGLE_MAPS_API_KEY = '';

/* Estilo del mapa: 'roadmap', 'terrain', 'satellite' o 'hybrid'. */
const GOOGLE_MAPS_TIPO = 'terrain';

/* MODO DEL MAPA
   ------------
     'auto'        -> Si hay clave, usa la API completa de Google Maps.
                      Si no hay clave, usa el mapa incrustado (sin clave).
                      Sin internet, cae al mapa esquemático.
     'clave'       -> Fuerza la API completa. Requiere clave.
                      Marcadores propios y clic directo sobre el mapa.
     'incrustado'  -> Fuerza el mapa de Google incrustado, SIN clave.
                      Necesita internet. Los puntos se eligen desde la lista
                      que aparece bajo el mapa, y este se centra en el elegido.
     'propio'      -> Mapa propio dibujado en SVG con las ubicaciones reales.
                      Muestra TODOS los marcadores, incluidas las empresas
                      registradas. No usa internet ni clave. Es el de fábrica.

   Nota sobre 'incrustado': se apoya en una dirección de Google que no está
   documentada como API pública. Hoy funciona y es de uso muy extendido, pero
   Google podría cambiarla sin aviso. Si eso ocurre, la página cae sola al
   mapa esquemático. */

const MODO_MAPA = 'propio';

/* ============ BASE DE DATOS COMPARTIDA ============

   Mientras esto esté vacío, VITILOG guarda todo en el navegador
   (localStorage): funciona, pero cada dispositivo tiene sus propios datos.

   Al completarlo, las cuentas, las cargas y las plantas pasan a vivir en
   una base compartida, y se ven igual desde cualquier dispositivo.

   Cómo obtener estos dos valores:
     1. Crea una cuenta gratuita en https://supabase.com
     2. Crea un proyecto nuevo.
     3. Abre "SQL Editor" -> New query, pega el archivo sql/esquema.sql
        completo y presiona Run. Eso crea las tablas.
     4. Abre "Project Settings" -> "API" y copia:
          Project URL      -> SUPABASE_URL
          anon public key  -> SUPABASE_ANON_KEY

   Advertencia honesta: la clave "anon" queda visible en el código del
   sitio, y las políticas del esquema son permisivas para que el prototipo
   funcione sin servidor propio. Sirve para el trabajo y para demostrar;
   no la uses con datos reales de personas. */

/* Estos dos valores se dejan VACÍOS a propósito.

   La clave "anon" se escribe desde la propia aplicación:
     entra como administración -> Configuración -> Base compartida.
   Queda guardada en el dispositivo, no en el código.

   Por qué no va aquí: este archivo viaja al repositorio público, y hay
   programas que rastrean GitHub buscando claves de Supabase. Como las
   políticas del esquema son permisivas, quien tuviera la clave podría leer
   y borrar toda la base. Guardándola en el dispositivo, eso no ocurre.

   Si algún día se migra a Supabase Auth con políticas por usuario, la clave
   sí podría ir escrita aquí sin riesgo. */

const SUPABASE_URL = '';
const SUPABASE_ANON_KEY = '';

/* Origen de los datos:
     'auto'  -> usa la base compartida si está configurada; si no, la local.
     'local' -> fuerza localStorage (útil para probar sin internet).
     'nube'  -> fuerza la base compartida (avisa si no puede conectarse). */
const MODO_DATOS = 'auto';
