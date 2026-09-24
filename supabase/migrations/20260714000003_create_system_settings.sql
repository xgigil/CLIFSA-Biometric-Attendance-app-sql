CREATE TABLE public.system_settings (
  id integer PRIMARY KEY,
  work_start_time varchar(8) NOT NULL DEFAULT '09:00',
  grace_period integer NOT NULL DEFAULT 15
);

INSERT INTO public.system_settings (id, work_start_time, grace_period)
VALUES (1, '09:00', 15)
ON CONFLICT (id) DO NOTHING;
