-- Migration: Seed default super admin on fresh install
-- Email: hassansaava@gmail.com
-- This is idempotent — will not create duplicates

INSERT INTO super_admins (email, password_hash, full_name, is_active)
VALUES (
  'hassansaava@gmail.com',
  '$2b$10$LAXF8IdzNXN9ajSG9WzTseDlY..h.BE/yD8v/ZjdoVXK0TMK6S6Ji',
  'Super Admin',
  true
)
ON CONFLICT (email) DO NOTHING;
