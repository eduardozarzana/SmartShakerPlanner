import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = "https://ardzsloaomwjakqbcxsr.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyZHpzbG9hb213amFrcWJjeHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg2NDIyMDYsImV4cCI6MjA2NDIxODIwNn0.SaQJvU2S9CbvwNKhZ1Sqxh0-yxuJDDs-SkufF3zNLkE";

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);
