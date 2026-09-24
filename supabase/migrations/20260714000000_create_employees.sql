CREATE TABLE public.employees (
  employee_id integer PRIMARY KEY,
  employee_name text,
  is_active boolean NOT NULL DEFAULT true
);
