ALTER TABLE households ADD COLUMN IF NOT EXISTS rooms_count integer NOT NULL DEFAULT 1;
ALTER TABLE households ADD COLUMN IF NOT EXISTS monthly_rent_cents integer NOT NULL DEFAULT 250000;
ALTER TABLE households ADD COLUMN IF NOT EXISTS due_day integer NOT NULL DEFAULT 1;
ALTER TABLE households ADD COLUMN IF NOT EXISTS photo_mime text;
ALTER TABLE households ADD COLUMN IF NOT EXISTS photo_data bytea;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS room_number integer;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS monthly_rent_cents integer;
CREATE TABLE IF NOT EXISTS join_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
 tenant_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz,
 UNIQUE(household_id,tenant_id));
ALTER TABLE charges ADD COLUMN IF NOT EXISTS billing_month date;
CREATE UNIQUE INDEX IF NOT EXISTS uq_monthly_charge ON charges(tenant_id,household_id,billing_month) WHERE billing_month IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_join_requests_household ON join_requests(household_id,status);
