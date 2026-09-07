-- Contenido de la pestaña "Tendencias", generado por IA y guardado aquí en
-- vez de dejarlo fijo en el código: así se puede actualizar sin tocar
-- js/trends.js, a mano desde el botón "Actualizar tendencias" o solo con el
-- cron mensual (ver supabase/functions/generate-trends).
--
-- Los iconos, colores y el enlace de "Ver inspiración" de cada estilo siguen
-- fijos en js/trends.js (no dependen de la moda), así que aquí solo se
-- guarda el subtítulo y la lista de estilos (título + descripción) de cada
-- categoría. Fila única (id fijo a "true"), igual que "empresa".
--
-- Ejecutar en el SQL Editor de Supabase (o `supabase db push`) DESPUÉS de
-- auth-policies.sql.

create table if not exists tendencias (
  id boolean primary key default true,
  data jsonb not null default '[]'::jsonb,
  generated_at timestamptz,
  constraint tendencias_singleton check (id)
);

-- Contenido inicial: el mismo que había fijo en js/trends.js, para que la
-- pestaña no aparezca vacía hasta la primera generación automática/manual.
insert into tendencias (id, data, generated_at) values (true, '[
  {
    "id": "cortes",
    "subtitle": "Los cortes de mujer que más se piden esta temporada",
    "items": [
      { "title": "Bob italiano", "desc": "Por encima del hombro, líneas limpias y muy favorecedor. El corte femenino más pedido en salón." },
      { "title": "Shag texturizado", "desc": "Capas suaves y desfiladas que aportan movimiento; ideal para dar cuerpo al cabello fino." },
      { "title": "Flequillo cortina", "desc": "Sigue siendo tendencia, sobre todo combinado con melenas midi o long bob." },
      { "title": "Mullet moderno", "desc": "Versión suavizada del clásico, con capas que dan volumen sin resultar agresivo." }
    ]
  },
  {
    "id": "cortes-masculinos",
    "subtitle": "Los cortes de hombre que más se piden esta temporada",
    "items": [
      { "title": "Crop francés texturizado", "desc": "Flequillo corto y texturizado arriba combinado con fade en los laterales." },
      { "title": "Buzz cut", "desc": "Rapado uniforme muy corto, de bajo mantenimiento y muy versátil." },
      { "title": "Low fade con raya definida", "desc": "Degradado bajo y sutil rematado con una raya marcada a un lado." },
      { "title": "Undercut peinado hacia atrás", "desc": "Laterales muy cortos y parte superior larga peinada hacia atrás, estilo slick back." }
    ]
  },
  {
    "id": "tintes",
    "subtitle": "Técnicas y tonos que están arrasando",
    "items": [
      { "title": "Balayage en tonos beige", "desc": "Frío y arena claro, para un resultado limpio, moderno y de bajo mantenimiento." },
      { "title": "Rubios grises nórdicos", "desc": "Reflejo perlado grisáceo conseguido con balayage o babylights." },
      { "title": "Castaños iluminados", "desc": "Base oscura con reflejos cálidos casi imperceptibles que aportan profundidad." },
      { "title": "Cobrizos editoriales", "desc": "Tonos cobre ricos y dimensionados, entre cálido y profundo, con acabado muy cuidado." }
    ]
  },
  {
    "id": "peinados",
    "subtitle": "Cómo se lleva el pelo puesto esta temporada",
    "items": [
      { "title": "Ondas naturales", "desc": "Movimiento relajado, volumen en la raíz y mechones sueltos, sin looks demasiado pulidos." },
      { "title": "Revival años 70", "desc": "Capas abundantes, ondas al aire y volumen texturizado a lo largo de toda la melena." },
      { "title": "Recogidos desenfadados", "desc": "Menos estructura, más naturalidad: el peinado \"con vida\" gana terreno a lo perfecto." }
    ]
  },
  {
    "id": "barbas",
    "subtitle": "Los estilos de barba con más demanda",
    "items": [
      { "title": "Barba corta degradada", "desc": "Densidad uniforme con fade en los laterales; el estilo más pedido en barbería." },
      { "title": "Barba candado", "desc": "Perilla y bigote conectados por una línea fina, dejando las mejillas rasuradas." },
      { "title": "Barba desconectada", "desc": "Bigote y barba trabajados como piezas independientes, con un hueco marcado entre ambos." },
      { "title": "Barba tipo boxeada", "desc": "Contorno muy definido y recto, manteniendo el volumen natural del pelo por dentro." }
    ]
  }
]'::jsonb, null)
on conflict (id) do nothing;

alter table tendencias enable row level security;

drop policy if exists "authenticated access" on tendencias;
create policy "authenticated access" on tendencias
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter publication supabase_realtime add table tendencias;
