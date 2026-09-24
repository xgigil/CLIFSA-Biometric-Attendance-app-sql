-- Add RLS policies for admin users to INSERT, UPDATE, and DELETE on hik_biometric_logs

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'hik_biometric_logs' AND policyname = 'Allow admin insert on hik_biometric_logs'
    ) THEN
        CREATE POLICY "Allow admin insert on hik_biometric_logs" ON "public"."hik_biometric_logs"
        FOR INSERT TO authenticated
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
          )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'hik_biometric_logs' AND policyname = 'Allow admin update on hik_biometric_logs'
    ) THEN
        CREATE POLICY "Allow admin update on hik_biometric_logs" ON "public"."hik_biometric_logs"
        FOR UPDATE TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
          )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'hik_biometric_logs' AND policyname = 'Allow admin delete on hik_biometric_logs'
    ) THEN
        CREATE POLICY "Allow admin delete on hik_biometric_logs" ON "public"."hik_biometric_logs"
        FOR DELETE TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
          )
        );
    END IF;
END $$;
