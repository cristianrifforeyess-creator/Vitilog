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

/* PEGA AQUÍ LOS DOS VALORES DE TU PROYECTO.

   Mientras estén vacíos, quien abra el enlace público NO se conecta a tu
   base: arranca una copia local y vacía en su propio navegador. Por eso
   parecía que las cuentas "se borraban" al entrar desde otro dispositivo.

   Al completarlos, el sitio entero queda apuntando a una sola base y las
   cuentas, las cargas y los viajes se ven iguales desde cualquier parte.

   Los encuentras en Supabase -> Project Settings -> API:
     Project URL      -> SUPABASE_URL
     anon public key  -> SUPABASE_ANON_KEY

   Ejemplo de cómo queda:
     const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
     const SUPABASE_ANON_KEY = 'eyJhbGciOi...';

   LO QUE HAY QUE TENER CLARO ANTES DE PUBLICARLOS
   -----------------------------------------------
   La clave "anon" está pensada para ir en el código de un sitio web: no es
   un secreto en sí misma. Lo que la hace peligrosa acá son las políticas
   del esquema, que son permisivas para que el prototipo funcione sin
   servidor propio. Con esta clave publicada, cualquiera puede leer y borrar
   todas las tablas, incluidos los hashes de las contraseñas.

   Por eso, mientras siga así:
     · usa contraseñas desechables, nunca una que uses en otro servicio;
     · no cargues datos reales de personas;
     · borra el proyecto de Supabase cuando termines de mostrarlo.

   La solución de fondo es mover el inicio de sesión a Supabase Auth con
   políticas por usuario. Ahí la clave se publica sin ningún riesgo. */

const SUPABASE_URL = 'https://gjzxmrguecgebrzxclbu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdqenhtcmd1ZWNnZWJyenhjbGJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MDk1MjUsImV4cCI6MjEwNzQ4NTUyNX0.u_w0pRAH3jnSYOmXXODyXoIGeAEhbVqBK0LTI_fWOso';

/* Origen de los datos:
     'auto'  -> usa la base compartida si está configurada; si no, la local.
     'local' -> fuerza localStorage (útil para probar sin internet).
     'nube'  -> fuerza la base compartida (avisa si no puede conectarse). */
const MODO_DATOS = 'auto';
