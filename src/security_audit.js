import {q} from './db.js';
import {createHash} from 'node:crypto';

export async function ensureSecuritySchema(){
  await q(`CREATE TABLE IF NOT EXISTS platform_settings (
    key text PRIMARY KEY, value jsonb NOT NULL, updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now())`);
  await q(`CREATE TABLE IF NOT EXISTS security_audit_logs (
    id bigserial PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(),
    actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
    action text NOT NULL, target_id text, details jsonb NOT NULL DEFAULT '{}'::jsonb)`);
  await q('CREATE INDEX IF NOT EXISTS idx_rm_audit_time ON security_audit_logs(created_at DESC)');
  await q('CREATE INDEX IF NOT EXISTS idx_rm_audit_action_time ON security_audit_logs(action,created_at DESC)');
  const defaults={platform_name:'RentMate',support_email:'',maintenance_notice:'',registration_enabled:true};
  for(const [key,value] of Object.entries(defaults))
    await q('INSERT INTO platform_settings(key,value) VALUES($1,$2::jsonb) ON CONFLICT DO NOTHING',[key,JSON.stringify(value)]);
}
export async function writeAudit({actor=null,action,target=null,details={}}){
  await q('INSERT INTO security_audit_logs(actor_id,action,target_id,details) VALUES($1,$2,$3,$4::jsonb)',[actor,action,target,JSON.stringify(details)]);
}
export function hashIdentifier(value){return createHash('sha256').update(String(value||'').trim().toLowerCase()).digest('hex').slice(0,16);}
