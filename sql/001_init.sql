CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, email text NOT NULL UNIQUE,
 password_hash text NOT NULL, role text NOT NULL DEFAULT 'tenant' CHECK (role IN ('tenant','manager','admin')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS households (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, address text,
 manager_id uuid REFERENCES users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS memberships (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id, household_id)
);
CREATE TABLE IF NOT EXISTS charges (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 household_id uuid REFERENCES households(id) ON DELETE SET NULL,
 amount_cents integer NOT NULL CHECK(amount_cents>0), due_date date NOT NULL,
 description text NOT NULL DEFAULT 'Monthly rent', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS verified_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), charge_id uuid NOT NULL REFERENCES charges(id) ON DELETE CASCADE,
 amount_cents integer NOT NULL CHECK(amount_cents>0), reference text, recorded_by uuid REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS simulated_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), charge_id uuid NOT NULL REFERENCES charges(id) ON DELETE CASCADE,
 tenant_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 amount_cents integer NOT NULL CHECK(amount_cents>0), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS chores (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
 title text NOT NULL, assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
 due_date date, completed boolean NOT NULL DEFAULT false, completed_at timestamptz,
 created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
 sender_id uuid NOT NULL REFERENCES users(id), recipient_id uuid REFERENCES users(id),
 body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS announcements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
 author_id uuid REFERENCES users(id), title text NOT NULL, body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 kind text NOT NULL, title text NOT NULL, body text NOT NULL, ref_id uuid,
 dedupe_key text UNIQUE, is_read boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_memberships_household ON memberships(household_id);
CREATE INDEX IF NOT EXISTS idx_charges_tenant ON charges(tenant_id,due_date DESC);
CREATE INDEX IF NOT EXISTS idx_messages_household ON messages(household_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id,is_read,created_at DESC);
CREATE TABLE IF NOT EXISTS invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
 code_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, uses_remaining integer NOT NULL DEFAULT 1 CHECK(uses_remaining>=0),
 created_at timestamptz NOT NULL DEFAULT now()
);
