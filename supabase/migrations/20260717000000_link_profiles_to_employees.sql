-- Add employee_id column to profiles referencing employees
ALTER TABLE public.profiles 
ADD COLUMN employee_id INTEGER REFERENCES public.employees(employee_id) ON DELETE SET NULL;

-- Enable RLS and add policies for hik_biometric_logs
DROP POLICY IF EXISTS "Allow select for own logs or admin" ON public.hik_biometric_logs;
CREATE POLICY "Allow select for own logs or admin" ON public.hik_biometric_logs
FOR SELECT TO authenticated
USING (
  public.is_admin() OR 
  employee_id = (SELECT employee_id FROM public.profiles WHERE id = auth.uid())
);

-- Enable RLS and add policies for employees
DROP POLICY IF EXISTS "Allow select for own employee record or admin" ON public.employees;
CREATE POLICY "Allow select for own employee record or admin" ON public.employees
FOR SELECT TO authenticated
USING (
  public.is_admin() OR
  employee_id = (SELECT employee_id FROM public.profiles WHERE id = auth.uid())
);
