-- Add name column to profiles
ALTER TABLE public.profiles ADD COLUMN name TEXT;

-- Populate name from auth.users metadata for existing profiles
UPDATE public.profiles p
SET name = u.raw_user_meta_data->>'name'
FROM auth.users u
WHERE p.id = u.id AND u.raw_user_meta_data->>'name' IS NOT NULL;

-- Create trigger to auto-populate name on new profile creation
CREATE OR REPLACE FUNCTION public.handle_profile_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF NEW.name IS NULL THEN
    NEW.name := (SELECT raw_user_meta_data->>'name' FROM auth.users WHERE id = NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER set_profile_name
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_name();
