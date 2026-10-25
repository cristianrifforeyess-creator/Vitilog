-- =====================================================================
-- VITILOG · Base de datos compartida (Supabase / PostgreSQL)
-- =====================================================================
-- Cómo usarlo:
--   1. Entra a https://supabase.com y crea un proyecto gratuito.
--   2. Menú lateral -> SQL Editor -> New query.
--   3. Pega TODO este archivo y presiona "Run".
--   4. Menú lateral -> Project Settings -> API. Copia:
--        · Project URL
--        · anon public key
--      y pégalas en js/config.js.
--
-- IMPORTANTE, lee esto antes de usarlo con datos reales:
--   Las políticas de abajo son PERMISIVAS a propósito, para que el
--   prototipo funcione sin servidor propio. Con la clave "anon" —que
--   queda visible en el código del sitio— cualquiera puede leer y
--   escribir estas tablas. Sirve para un trabajo de titulación o una
--   demostración; NO sirve para datos reales de personas.
--   Para producción hay que usar Supabase Auth y políticas por usuario.
-- =====================================================================

-- Necesaria para calcular el hash de la contraseña del administrador.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Cuentas: viñateros, transportistas, plantas receptoras y administración
-- ---------------------------------------------------------------------
create table if not exists cuentas (
  email       text primary key,
  rol         text not null default 'vinatero'
              check (rol in ('vinatero', 'empresa', 'chofer', 'admin')),
  nombre      text not null,
  clave_hash  text not null,
  clave_sal   text not null,
  comuna      text,
  telefono    text default '',
  hectareas   numeric default 0,       -- solo viñateros
  tipo        text,                    -- solo plantas: Biomasa/Compostaje
  encargado   text default '',         -- solo plantas
  patente     text,                    -- solo transportistas
  capacidad   numeric default 0,       -- solo transportistas, en m3
  -- Cómo trabaja el transportista. Se elige DENTRO de su perfil, no al
  -- registrarse: las herramientas son las mismas en los dos casos.
  modalidad   text default 'independiente'
              check (modalidad in ('independiente', 'empresa')),
  empresa_nombre text default '',      -- solo si conduce para una empresa
  disponible  boolean not null default true,   -- el transportista puede apagarse
  activa      boolean not null default true,
  creada      timestamptz not null default now(),
  -- Registro de uso: queda guardado cada vez que la cuenta entra.
  ultimo_acceso timestamptz,
  accesos       integer not null default 0
);

-- Para bases creadas antes de estas columnas. Si ya están, no hacen nada.
alter table cuentas add column if not exists modalidad text default 'independiente';
alter table cuentas add column if not exists empresa_nombre text default '';
alter table cuentas add column if not exists ultimo_acceso timestamptz;
alter table cuentas add column if not exists accesos integer not null default 0;
-- Vínculo del transportista con la planta para la que conduce. Lo declara él
-- mismo en su perfil; con esto la planta puede encargarle retiros.
alter table cuentas add column if not exists empresa_email text;

-- ---------------------------------------------------------------------
-- Cargas de sarmientos publicadas por los viñateros
-- ---------------------------------------------------------------------
create table if not exists cargas (
  id          text primary key,
  owner_email text not null references cuentas(email) on delete cascade,
  comuna      text not null,
  volumen     numeric not null check (volumen > 0),
  destino     text not null default 'Indistinto',
  fecha       text,                    -- fecha disponible, formato dd/mm/aaaa
  notas       text default '',
  estado      text not null default 'publicada'
              check (estado in ('publicada', 'comprometida', 'retirada')),
  creada      timestamptz not null default now()
);

create index if not exists cargas_owner_idx  on cargas (owner_email);
create index if not exists cargas_estado_idx on cargas (estado);

-- ---------------------------------------------------------------------
-- Plantas y centros de acopio (los administra VITILOG)
-- ---------------------------------------------------------------------
create table if not exists puntos (
  id          text primary key,
  nombre      text not null,
  tipo        text not null default 'Biomasa'
              check (tipo in ('Biomasa', 'Compostaje', 'Acopio', 'Transporte')),
  comuna      text not null,
  descripcion text default '',
  capacidad   numeric,
  activo      boolean not null default true,
  lat         double precision not null,
  lng         double precision not null,
  creada      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Envíos: el seguimiento de un camión desde la viña hasta la planta
-- ---------------------------------------------------------------------
create table if not exists envios (
  id                text primary key,
  carga_id          text references cargas(id) on delete set null,
  vinatero_email    text references cuentas(email) on delete set null,
  empresa_email     text references cuentas(email) on delete set null,
  chofer_email      text references cuentas(email) on delete set null,

  chofer            text not null,
  chofer_telefono   text not null,
  patente           text,

  origen_comuna     text not null,
  origen_lat        double precision not null,
  origen_lng        double precision not null,

  destino_id        text,
  destino_nombre    text not null,
  destino_lat       double precision not null,
  destino_lng       double precision not null,

  estado            text not null default 'programado'
                    check (estado in ('asignado','programado','en_camino','llegando','en_destino','entregado')),
  salida            timestamptz,
  minutos_total     numeric not null default 30 check (minutos_total > 0),
  progreso          numeric not null default 0 check (progreso between 0 and 1),

  -- Última posición reportada por el GPS del chofer, si la hubo.
  -- posicion_at permite saber hace cuánto llegó y si se perdió la señal.
  veh_lat           double precision,
  veh_lng           double precision,
  precision_m       numeric,          -- precision del GPS en metros
  posicion_at       timestamptz,

  volumen_declarado numeric not null default 0,
  volumen_recibido  numeric,
  peso_recibido     numeric,
  observaciones     text default '',
  creado            timestamptz not null default now()
);

create index if not exists envios_vinatero_idx on envios (vinatero_email);
create index if not exists envios_empresa_idx  on envios (empresa_email);
create index if not exists envios_estado_idx   on envios (estado);

-- Para bases creadas antes del estado "asignado" (el retiro que una planta
-- encarga y el transportista todavía no acepta).
alter table envios drop constraint if exists envios_estado_check;
alter table envios add constraint envios_estado_check
  check (estado in ('asignado','programado','en_camino','llegando','en_destino','entregado'));

-- Paradas extra de un viaje consolidado: el camión pasa a buscar carga a
-- varias viñas antes de llegar a la planta. Cada parada guarda la carga, la
-- comuna, el volumen y si ya se recogió.
alter table envios add column if not exists paradas jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------
-- Estiba y desestiba: quien sube la carga al camion y quien la valida
-- al llegar. Todo opcional a proposito: el que ya tiene resuelta su
-- cuadrilla no tiene que declarar nada.
-- ---------------------------------------------------------------------

-- La vina dice si carga con su propia gente o pide cuadrilla por la app.
alter table cargas add column if not exists mano_obra text default 'propia';
-- Como es el acceso al campo. Define que camiones pueden entrar.
alter table cargas add column if not exists acceso text default 'normal';

-- El transportista declara su vehiculo, y si ademas ofrece estiba.
alter table cuentas add column if not exists vehiculo text;
alter table cuentas add column if not exists estiba text default 'no';
alter table cuentas add column if not exists cuadrilla_nombre text default '';
alter table cuentas add column if not exists cuadrilla_personas integer default 0;

-- Quien quedo a cargo de la estiba de un envio, y la validacion oficial
-- de descarga y pesaje que hace el operador de patio de la planta.
alter table envios add column if not exists cuadrilla_email text;
alter table envios add column if not exists cuadrilla_nombre text default '';
alter table envios add column if not exists validado_por text;
alter table envios add column if not exists validado_at timestamptz;

-- ---------------------------------------------------------------------
-- Mensajes: el chat de cada envío
-- ---------------------------------------------------------------------
create table if not exists mensajes (
  id           text primary key,
  envio_id     text not null references envios(id) on delete cascade,
  autor_email  text,
  autor_nombre text not null,
  texto        text not null check (length(trim(texto)) > 0),
  creado       timestamptz not null default now()
);

create index if not exists mensajes_envio_idx on mensajes (envio_id, creado);

-- ---------------------------------------------------------------------
-- Permisos (ver la advertencia del encabezado)
-- ---------------------------------------------------------------------
alter table cuentas  enable row level security;
alter table cargas   enable row level security;
alter table puntos   enable row level security;
alter table envios   enable row level security;
alter table mensajes enable row level security;

drop policy if exists proto_cuentas  on cuentas;
drop policy if exists proto_cargas   on cargas;
drop policy if exists proto_puntos   on puntos;
drop policy if exists proto_envios   on envios;
drop policy if exists proto_mensajes on mensajes;

create policy proto_cuentas  on cuentas  for all using (true) with check (true);
create policy proto_cargas   on cargas   for all using (true) with check (true);
create policy proto_puntos   on puntos   for all using (true) with check (true);
create policy proto_envios   on envios   for all using (true) with check (true);
create policy proto_mensajes on mensajes for all using (true) with check (true);

-- ---------------------------------------------------------------------
-- Cuenta de administración
-- ---------------------------------------------------------------------
-- La contraseña inicial es 'admin1234', la misma del modo local.
-- CÁMBIALA apenas entres: Configuración -> Contraseña, dentro de la propia
-- aplicación. No hace falta tocar este archivo.
-- El hash se calcula igual que en el navegador: sha256(sal || clave).
insert into cuentas (email, rol, nombre, clave_sal, clave_hash, comuna)
values (
  'admin@vitilog.cl',
  'admin',
  'Administración VITILOG',
  'vitilog-admin',
  encode(digest('vitilog-admin' || 'admin1234', 'sha256'), 'hex'),
  'Talca'
)
on conflict (email) do nothing;

-- ---------------------------------------------------------------------
-- Plantas y centros iniciales (los mismos de js/data.js)
-- ---------------------------------------------------------------------
insert into puntos (id, nombre, tipo, comuna, descripcion, capacidad, activo, lat, lng) values
  ('curico',       'EnerVid SpA',                  'Biomasa',    'Curicó',          'Planta de biomasa. Recibe sarmientos para generación energética.', 40, true,  -35.0100, -71.2050),
  ('talca',        'BioEnergía Maule',             'Biomasa',    'Talca',           'Centro regional de acopio y valorización energética.',            65, true,  -35.4520, -71.6180),
  ('molina',       'Compost Valle Central',        'Compostaje', 'Molina',          'Planta de compostaje de residuos de poda de vid.',                30, true,  -35.1320, -71.2560),
  ('linares',      'Centro de Acopio Linares',     'Acopio',     'Linares',         'Punto de acopio intermedio para agrupar cargas.',                 25, true,  -35.8650, -71.5680),
  ('constitucion', 'Acopio Costa Constitución',    'Acopio',     'Constitución',    'Recepción de sarmientos del secano costero.',                     20, true,  -35.3480, -72.3900),
  ('sanjavier',    'TierraViva Compost',           'Compostaje', 'San Javier',      'Planta de compostaje. Actualmente sin cupos disponibles.',        35, false, -35.6120, -71.7060),
  ('teno',         'Agroenergía Teno',             'Biomasa',    'Teno',            'Caldera de biomasa agrícola. Recibe sarmientos chipeados o enteros.', 28, true, -34.8850, -71.1400),
  ('sagrada',      'Vermicompost Sagrada Familia', 'Compostaje', 'Sagrada Familia', 'Compostaje y lombricultura a partir de restos de poda.',          18, true,  -34.9700, -71.3600),
  ('linares2',     'Compost Andes Linares',        'Compostaje', 'Linares',         'Planta de compostaje del valle de Linares.',                      32, true,  -35.8300, -71.5500),
  ('parral',       'Bioenergía Parral Sur',        'Biomasa',    'Parral',          'Generación eléctrica con residuos agrícolas del sur del Maule.',  45, true,  -36.1600, -71.8000)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Finanzas: membresia de las plantas, custodia del flete y libro de
-- movimientos.
--
-- IMPORTANTE: esto NO mueve dinero real. No hay pasarela de pagos
-- conectada. Es un registro de quien le debe cuanto a quien, con las
-- cifras y los estados que tendria el sistema de verdad.
-- ---------------------------------------------------------------------

-- Suscripcion de la planta receptora y saldo de su billetera.
alter table cuentas add column if not exists plan text default 'ninguno';
alter table cuentas add column if not exists plan_hasta timestamptz;
-- Una membresia no se activa sola: la pide la cuenta y la aprueba la
-- administracion. ninguno | pendiente | activa | rechazada | cancelada
alter table cuentas add column if not exists plan_estado text default 'ninguno';
alter table cuentas add column if not exists plan_pedido_at timestamptz;
alter table cuentas add column if not exists wallet_saldo numeric not null default 0;

-- Lo acordado por el flete y en que estado esta la custodia.
alter table envios add column if not exists tarifa numeric;
alter table envios add column if not exists estiba_cobrada boolean default false;
alter table envios add column if not exists escrow_estado text default 'ninguno';
alter table envios add column if not exists escrow_at timestamptz;
alter table envios add column if not exists liquidado_at timestamptz;

-- Libro de movimientos. Una fila por cada vez que una cifra cambia de
-- manos: asi el panel de administracion no tiene que recalcular nada,
-- solo sumar lo que paso.
create table if not exists movimientos (
  id        text primary key,
  envio_id  text references envios(id) on delete set null,
  email     text,                     -- a quien afecta; null si es de la plataforma
  tipo      text not null,            -- retencion | liberacion | abono | comision | reserva | membresia
  concepto  text not null default '',
  monto     numeric not null,
  creado    timestamptz not null default now()
);

create index if not exists movimientos_email_idx on movimientos (email);
create index if not exists movimientos_envio_idx on movimientos (envio_id);

alter table movimientos enable row level security;
drop policy if exists movimientos_todo on movimientos;
create policy movimientos_todo on movimientos for all using (true) with check (true);

-- ---------------------------------------------------------------------
-- Consolidación en cabecera y aviso de portería
-- ---------------------------------------------------------------------
-- consolidado: el viñatero declaró, al publicar, que el sarmiento ya está
-- acopiado en la cabecera o el callejón, donde un camión pesado puede
-- llegar y cargar. Es obligatorio marcarlo para publicar, pero la columna
-- parte en false porque las cargas publicadas antes de esto no declararon
-- nada y no se les puede suponer una respuesta.
alter table cargas add column if not exists consolidado boolean default false;

-- porteria_at: hora en que el camión avisó que estaba en el portón del
-- predio. Se guarda la hora y no un sí/no porque lo que interesa después
-- es cuánto esperó para que le abrieran.
alter table envios add column if not exists porteria_at timestamptz;

-- ---------------------------------------------------------------------
-- Tiempo real: qué tablas avisan sus cambios por WebSocket
-- ---------------------------------------------------------------------
-- Sin esto, js/vivo.js se conecta pero no recibe nada: Supabase solo
-- transmite los cambios de las tablas que estén en esta publicación.
-- Las líneas se pueden volver a ejecutar sin problema.
do $$
declare t text;
begin
  foreach t in array array['cuentas', 'cargas', 'envios', 'mensajes', 'puntos', 'movimientos'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Para que un UPDATE o un DELETE viajen con la fila completa y no solo con
-- la llave: es lo que necesita la aplicación para refrescar sin recargar.
alter table cuentas  replica identity full;
alter table cargas   replica identity full;
alter table envios   replica identity full;
alter table mensajes replica identity full;
alter table puntos   replica identity full;
alter table movimientos replica identity full;
