-- Fix security issues from linter warnings

-- 1. Fix function search path issues by setting search_path for all SECURITY DEFINER functions
CREATE OR REPLACE FUNCTION public.encrypt_financial_data(data TEXT, key_purpose TEXT DEFAULT 'budget')
RETURNS BYTEA AS $$
DECLARE
  current_key_id TEXT;
  encryption_key BYTEA;
  master_key TEXT;
BEGIN
  -- Get the master key from settings
  master_key := current_setting('app.encryption_master_key', true);
  IF master_key IS NULL OR master_key = '' THEN
    RAISE EXCEPTION 'Encryption master key not configured';
  END IF;
  
  -- Get or create current active key for this purpose
  SELECT key_id INTO current_key_id 
  FROM public.encryption_keys 
  WHERE is_active = true 
    AND expires_at > now() 
    AND metadata->>'purpose' = key_purpose
  ORDER BY created_at DESC 
  LIMIT 1;
  
  -- If no active key exists, create one
  IF current_key_id IS NULL THEN
    current_key_id := 'key_' || key_purpose || '_' || extract(epoch from now())::text;
    
    -- Generate a strong random encryption key
    encryption_key := gen_random_bytes(32);
    
    INSERT INTO public.encryption_keys (key_id, encrypted_key, expires_at, metadata)
    VALUES (
      current_key_id,
      pgp_sym_encrypt(encode(encryption_key, 'base64'), master_key),
      now() + interval '90 days',
      jsonb_build_object('purpose', key_purpose, 'algorithm', 'AES-256')
    );
  ELSE
    -- Decrypt existing key
    SELECT pgp_sym_decrypt(encrypted_key, master_key)::bytea INTO encryption_key
    FROM public.encryption_keys 
    WHERE key_id = current_key_id;
  END IF;
  
  -- Encrypt the data with versioned key reference
  RETURN pgp_sym_encrypt(
    jsonb_build_object(
      'data', data,
      'key_id', current_key_id,
      'timestamp', now(),
      'version', '2.0'
    )::text,
    encode(encryption_key, 'base64')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- 2. Fix decrypt function
CREATE OR REPLACE FUNCTION public.decrypt_financial_data(encrypted_data BYTEA)
RETURNS TEXT AS $$
DECLARE
  master_key TEXT;
  decrypted_json JSONB;
  data_key_id TEXT;
  encryption_key BYTEA;
  result TEXT;
BEGIN
  master_key := current_setting('app.encryption_master_key', true);
  IF master_key IS NULL OR master_key = '' THEN
    RETURN '[ENCRYPTION_KEY_NOT_CONFIGURED]';
  END IF;
  
  BEGIN
    -- Try to decrypt as new format first
    SELECT pgp_sym_decrypt(encrypted_data, master_key)::jsonb INTO decrypted_json;
    
    -- Extract key ID and data
    data_key_id := decrypted_json->>'key_id';
    
    -- Get the encryption key
    SELECT encode(pgp_sym_decrypt(ek.encrypted_key, master_key)::bytea, 'base64') INTO encryption_key
    FROM public.encryption_keys ek 
    WHERE ek.key_id = data_key_id;
    
    -- Decrypt the actual data
    result := pgp_sym_decrypt(encrypted_data, encryption_key);
    
    RETURN (result::jsonb)->>'data';
    
  EXCEPTION WHEN OTHERS THEN
    -- Fallback to old decryption method
    BEGIN
      RETURN pgp_sym_decrypt(encrypted_data, master_key);
    EXCEPTION WHEN OTHERS THEN
      RETURN '[DECRYPTION_ERROR]';
    END;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- 3. Fix key rotation check function
CREATE OR REPLACE FUNCTION public.check_key_rotation_needed()
RETURNS TABLE(key_id TEXT, expires_at TIMESTAMP WITH TIME ZONE, days_remaining INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ek.key_id,
    ek.expires_at,
    EXTRACT(days FROM (ek.expires_at - now()))::INTEGER as days_remaining
  FROM public.encryption_keys ek
  WHERE ek.is_active = true 
    AND ek.expires_at <= now() + interval '7 days'  -- Warn 7 days before expiry
    AND ek.rotation_status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- 4. Fix rotation function
CREATE OR REPLACE FUNCTION public.rotate_encryption_keys(force_rotation BOOLEAN DEFAULT false)
RETURNS JSONB AS $$
DECLARE
  old_key RECORD;
  new_key_id TEXT;
  new_encryption_key BYTEA;
  master_key TEXT;
  rotation_count INTEGER := 0;
  result JSONB := '{"rotated_keys": [], "errors": []}'::jsonb;
BEGIN
  master_key := current_setting('app.encryption_master_key', true);
  IF master_key IS NULL OR master_key = '' THEN
    RAISE EXCEPTION 'Encryption master key not configured';
  END IF;
  
  -- Find keys that need rotation
  FOR old_key IN 
    SELECT * FROM public.encryption_keys 
    WHERE is_active = true 
      AND (expires_at <= now() + interval '7 days' OR force_rotation = true)
      AND rotation_status = 'active'
  LOOP
    BEGIN
      -- Generate new key
      new_key_id := 'key_' || (old_key.metadata->>'purpose') || '_' || extract(epoch from now())::text;
      new_encryption_key := gen_random_bytes(32);
      
      -- Create new key entry
      INSERT INTO public.encryption_keys (key_id, encrypted_key, expires_at, key_version, metadata)
      VALUES (
        new_key_id,
        pgp_sym_encrypt(encode(new_encryption_key, 'base64'), master_key),
        now() + interval '90 days',
        old_key.key_version + 1,
        old_key.metadata || jsonb_build_object('rotated_from', old_key.key_id)
      );
      
      -- Mark old key as rotated
      UPDATE public.encryption_keys 
      SET rotation_status = 'rotated', is_active = false
      WHERE id = old_key.id;
      
      -- Re-encrypt data with new key (for budget data)
      IF old_key.metadata->>'purpose' = 'budget' THEN
        UPDATE public.projects 
        SET budget_encrypted = public.encrypt_financial_data(
          public.decrypt_financial_data(budget_encrypted),
          'budget'
        )
        WHERE budget_encrypted IS NOT NULL;
      END IF;
      
      rotation_count := rotation_count + 1;
      result := jsonb_set(
        result,
        '{rotated_keys}',
        (result->'rotated_keys') || jsonb_build_object(
          'old_key_id', old_key.key_id,
          'new_key_id', new_key_id,
          'purpose', old_key.metadata->>'purpose'
        )
      );
      
    EXCEPTION WHEN OTHERS THEN
      result := jsonb_set(
        result,
        '{errors}',
        (result->'errors') || jsonb_build_object(
          'key_id', old_key.key_id,
          'error', SQLERRM
        )
      );
    END;
  END LOOP;
  
  -- Log the rotation
  INSERT INTO public.audit_logs (table_name, operation, user_id, new_data)
  VALUES (
    'encryption_keys',
    'KEY_ROTATION',
    auth.uid(),
    jsonb_build_object(
      'rotation_count', rotation_count,
      'timestamp', now(),
      'result', result
    )
  );
  
  RETURN result || jsonb_build_object('total_rotated', rotation_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- 5. Fix get_decrypted_budget function
CREATE OR REPLACE FUNCTION public.get_decrypted_budget(project_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  encrypted_budget BYTEA;
  decrypted_value TEXT;
BEGIN
  -- Check if user has access to this project
  IF NOT EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = project_id 
      AND (p.owner_id = auth.uid() OR public.get_current_user_role() = 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied to project budget';
  END IF;
  
  SELECT budget_encrypted INTO encrypted_budget
  FROM public.projects 
  WHERE id = project_id;
  
  IF encrypted_budget IS NULL THEN
    RETURN NULL;
  END IF;
  
  decrypted_value := public.decrypt_financial_data(encrypted_budget);
  
  IF decrypted_value LIKE '[%ERROR%]' THEN
    RAISE EXCEPTION 'Failed to decrypt budget data';
  END IF;
  
  RETURN decrypted_value::NUMERIC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- 6. Fix auto encrypt budget trigger function  
CREATE OR REPLACE FUNCTION public.auto_encrypt_budget()
RETURNS TRIGGER AS $$
BEGIN
  -- Encrypt budget if it's provided and not already encrypted
  IF NEW.budget IS NOT NULL AND NEW.budget_encrypted IS NULL THEN
    NEW.budget_encrypted := public.encrypt_financial_data(NEW.budget::text, 'budget');
    -- Clear the plaintext budget for security
    NEW.budget := NULL;
  END IF;
  
  -- Update budget_encrypted if budget is modified
  IF TG_OP = 'UPDATE' AND NEW.budget IS NOT NULL AND NEW.budget != OLD.budget THEN
    NEW.budget_encrypted := public.encrypt_financial_data(NEW.budget::text, 'budget');
    NEW.budget := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = 'public';