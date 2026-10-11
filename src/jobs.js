import cron from 'node-cron';
import {q} from './db.js';
// Notifications are stored in Neon. Clients fetch them via GET /api/notifications.
// Daily reminder job, scheduled 08:00 UTC. A unique dedupe key prevents repeats.
export function startReminders(){
 if(process.env.ENABLE_REMINDERS!=='true')return;
 cron.schedule('0 8 * * *',async()=>{
  try{
   const r=await q(`SELECT c.id,c.tenant_id,c.due_date,(c.amount_cents-COALESCE(p.paid,0))::int AS outstanding FROM charges c LEFT JOIN (SELECT charge_id,sum(amount_cents) paid FROM verified_payments GROUP BY charge_id) p ON p.charge_id=c.id WHERE c.due_date BETWEEN CURRENT_DATE-7 AND CURRENT_DATE+3 AND c.amount_cents>COALESCE(p.paid,0)`);
   for(const c of r.rows){const day=new Date().toISOString().slice(0,10);await q(`INSERT INTO notifications(user_id,kind,title,body,ref_id,dedupe_key) VALUES($1,'reminder','Rent reminder',$2,$3,$4) ON CONFLICT(dedupe_key) DO NOTHING`,[c.tenant_id,`You have R${(c.outstanding/100).toFixed(2)} outstanding. Due date: ${c.due_date.toISOString().slice(0,10)}.`,c.id,`rent:${c.id}:${day}`]);}
   console.log(`Reminder check completed: ${r.rowCount} outstanding charges`);
  }catch(e){console.error('Reminder job error:',e.message);}
 },{timezone:'UTC'});
}

import {startMonthlyBilling} from './billing.js';
startMonthlyBilling();
