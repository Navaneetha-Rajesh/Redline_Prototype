import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cubouinqyiuokfgzgszg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1Ym91aW5xeWl1b2tmZ3pnc3pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4MzM1OTEsImV4cCI6MjEwNTQwOTU5MX0.R-A9bUYuMIeq1vwVjE4q4tCP2aNa7zVyqazo26iqzRk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);