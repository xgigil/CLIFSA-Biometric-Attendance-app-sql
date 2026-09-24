-- Update handle_profile_name to retrieve name or full_name from auth.users on insert
CREATE OR REPLACE FUNCTION public.handle_profile_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF NEW.name IS NULL THEN
    NEW.name := (SELECT COALESCE(raw_user_meta_data->>'name', raw_user_meta_data->>'full_name') FROM auth.users WHERE id = NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

-- Create trigger function to update profile name when auth.users raw_user_meta_data updates
CREATE OR REPLACE FUNCTION public.handle_update_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.profiles
  SET name = COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name')
  WHERE id = NEW.id;
  RETURN NEW;
END;
$function$;

-- Create trigger on auth.users for updates
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data)
  EXECUTE FUNCTION public.handle_update_user();
