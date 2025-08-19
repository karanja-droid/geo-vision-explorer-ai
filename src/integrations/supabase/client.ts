
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rgtyhffyvpqenrqnkfqc.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJndHloZmZ5dnBxZW5ycW5rZnFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzODc4MDYsImV4cCI6MjA2OTk2MzgwNn0.ylzNsFbexxg-IWqmelInLkfN-PydJDzrSRCmnU4HGsE'

export const supabase = createClient<Database>(supabaseUrl, supabaseKey)
