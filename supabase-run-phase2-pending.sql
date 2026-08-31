-- Phase 2 catch-up: run these files in Supabase SQL Editor if audit-supabase.mjs reports MISSING.
-- Order matters. Skip files you have already applied without errors.

-- 1) Lobby matchmaking (match_or_create_seek with tournament support)
--    File: supabase-migration-lichess-clock-start.sql

-- 2) Arena auto-pairing RPCs
--    File: supabase-migration-tournaments-arena-autopair.sql

-- 3) Distributed rate limits (optional; set USE_DB_RATE_LIMIT=1 on Vercel)
--    File: supabase-migration-trust-phase-g.sql

-- 4) Login by username without service role
--    File: supabase-migration-login-email-rpc.sql

-- 5) Puzzle catalog seed (if puzzles table is empty)
--    File: supabase-seed-zadachi-lichess.sql  (large; may take several minutes)
