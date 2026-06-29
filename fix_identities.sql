DO $$ 
BEGIN
    UPDATE auth.identities 
    SET 
        provider_id = user_id::text
    WHERE provider_id IS NULL OR provider_id = '';
END $$;
