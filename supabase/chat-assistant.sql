-- Añade a "empresa" un campo de texto libre con la información de servicios
-- (nombre, duración estimada, precio orientativo...) que usará el asistente
-- de IA (chat-assistant) para responder a la tool get_services(). No se crea
-- una tabla de servicios estructurada: es un texto que el propio salón
-- mantiene desde el modal "Datos de empresa".
--
-- Ejecutar en el SQL Editor de Supabase.

alter table empresa add column if not exists services_info text;
