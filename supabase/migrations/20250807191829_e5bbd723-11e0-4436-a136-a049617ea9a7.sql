-- Setup automated key rotation every 30 days
SELECT cron.schedule(
  'encryption-key-rotation-check',
  '0 2 */30 * *', -- Run at 2 AM every 30 days
  $$
  SELECT
    net.http_post(
        url:='https://rgtyhffyvpqenrqnkfqc.supabase.co/functions/v1/encryption-key-rotation',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.cron_secret_token', true) || '"}'::jsonb,
        body:='{"automated": true}'::jsonb
    ) as request_id;
  $$
);