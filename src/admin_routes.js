import {Router} from 'express';
import {auth} from './auth.js';
import {q} from './db.js';
export const adminRouter=Router();
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
adminRouter.use(auth);
adminRouter.use(wrap(async(req,res,next)=>{
  const result=await q('SELECT role FROM users WHERE id=$1',[req.user.sub]);
  if(result.rows[0]?.role!=='admin')return res.status(403).json({error:'Administrator access required'});
  next();
}));
adminRouter.get('/admin/overview',wrap(async(req,res)=>{
 const r=await q(`SELECT
 (SELECT count(*)::int FROM users) AS users,
 (SELECT count(*)::int FROM users WHERE role='manager') AS managers,
 (SELECT count(*)::int FROM users WHERE role='tenant') AS tenants,
 (SELECT count(*)::int FROM households) AS properties,
 (SELECT COALESCE(sum(rooms_count),0)::int FROM households) AS rooms,
 (SELECT count(*)::int FROM memberships m JOIN users u ON u.id=m.user_id WHERE u.role='tenant') AS occupied,
 (SELECT count(*)::int FROM join_requests WHERE status='pending') AS pending_requests`);
 res.json(r.rows[0]);
}));
adminRouter.get('/admin/users',wrap(async(req,res)=>{
 const r=await q('SELECT id,name,email,role FROM users ORDER BY name LIMIT 1000');res.json(r.rows);
}));
adminRouter.get('/admin/properties',wrap(async(req,res)=>{
 const r=await q(`SELECT h.id,h.name,h.address,h.rooms_count,u.name AS manager_name,
 (SELECT count(*)::int FROM memberships m JOIN users t ON t.id=m.user_id WHERE m.household_id=h.id AND t.role='tenant') AS occupied,
 (SELECT count(*)::int FROM join_requests j WHERE j.household_id=h.id AND j.status='pending') AS pending
 FROM households h LEFT JOIN users u ON u.id=h.manager_id ORDER BY h.name LIMIT 1000`);
 res.json(r.rows);
}));

// Admin user management: validated edits, database-backed role checks, no public privilege escalation.
import {z} from 'zod';
const userId=z.string().uuid();
const profileSchema=z.object({
  name:z.string().trim().min(2).max(100),
  email:z.string().trim().email().max(200)
}).strict();
adminRouter.patch('/admin/users/:id',wrap(async(req,res)=>{
  const id=userId.parse(req.params.id);
  const data=profileSchema.parse(req.body);
  const email=data.email.toLowerCase();
  const result=await q(`UPDATE users SET name=$1,email=$2 WHERE id=$3
    RETURNING id,name,email,role`,[data.name,email,id]);
  if(!result.rowCount)return res.status(404).json({error:'User not found'});
  res.json(result.rows[0]);
}));
// Only tenant <-> manager conversions; admin appointments remain a controlled server-side process.
adminRouter.patch('/admin/users/:id/role',wrap(async(req,res)=>{
  const id=userId.parse(req.params.id);
  const {role}=z.object({role:z.enum(['tenant','manager'])}).strict().parse(req.body);
  if(id===req.user.sub)return res.status(403).json({error:'You cannot change your own role'});
  const existing=await q('SELECT role FROM users WHERE id=$1',[id]);
  if(!existing.rowCount)return res.status(404).json({error:'User not found'});
  if(existing.rows[0].role==='admin')return res.status(403).json({error:'Administrator roles cannot be changed here'});
  if(existing.rows[0].role===role)return res.json({id,role});
  if(role==='tenant'){
    const owns=await q('SELECT 1 FROM households WHERE manager_id=$1 LIMIT 1',[id]);
    if(owns.rowCount)return res.status(409).json({error:'This manager owns properties. Reassign them before changing their role.'});
  }
  if(role==='manager'){
    const active=await q('SELECT 1 FROM memberships WHERE user_id=$1 LIMIT 1',[id]);
    if(active.rowCount)return res.status(409).json({error:'This tenant belongs to a household. Remove their membership before changing their role.'});
  }
  const result=await q(`UPDATE users SET role=$1 WHERE id=$2 AND role IN ('tenant','manager') RETURNING id,name,email,role`,[role,id]);
  if(!result.rowCount)return res.status(409).json({error:'Role changed during request; retry'});
  res.json(result.rows[0]);
}));

// Read-only system-wide property oversight. Administrator middleware above checks current DB role.
adminRouter.get('/admin/properties/:id/oversight',wrap(async(req,res)=>{
 const propertyId=userId.parse(req.params.id);
 const result=await q(`SELECT h.id,h.name,h.address,h.rooms_count,h.monthly_rent_cents,h.due_day,
  u.name AS manager_name,u.email AS manager_email,
  (SELECT count(*)::int FROM memberships m JOIN users t ON t.id=m.user_id
   WHERE m.household_id=h.id AND t.role='tenant') AS occupied,
  (SELECT count(*)::int FROM join_requests j WHERE j.household_id=h.id AND j.status='pending') AS pending,
  (SELECT count(*)::int FROM join_requests j WHERE j.household_id=h.id AND j.status='approved') AS approved_requests,
  (SELECT count(*)::int FROM join_requests j WHERE j.household_id=h.id AND j.status='rejected') AS rejected_requests
  FROM households h LEFT JOIN users u ON u.id=h.manager_id WHERE h.id=$1`,[propertyId]);
 if(!result.rowCount)return res.status(404).json({error:'Property not found'});
 res.json(result.rows[0]);
}));

// Read-only financial reporting. Only verified payments count as received money.
adminRouter.get('/admin/finance/report',wrap(async(req,res)=>{
 const month=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).parse(req.query.month);
 const property=req.query.property ? userId.parse(req.query.property) : null;
 const start=month+'-01';
 const r=await q(`WITH payments AS (
   SELECT charge_id,COALESCE(SUM(amount_cents),0)::bigint AS paid
   FROM verified_payments GROUP BY charge_id
 ), ledger AS (
   SELECT c.id,c.household_id,c.tenant_id,c.due_date,c.amount_cents,
     LEAST(c.amount_cents,COALESCE(p.paid,0))::bigint AS paid_cents,
     GREATEST(c.amount_cents-COALESCE(p.paid,0),0)::bigint AS outstanding_cents,
     h.name AS property_name,u.name AS tenant_name,u.email AS tenant_email
   FROM charges c
   LEFT JOIN payments p ON p.charge_id=c.id
   LEFT JOIN households h ON h.id=c.household_id
   JOIN users u ON u.id=c.tenant_id
   WHERE c.due_date >= $1::date AND c.due_date < ($1::date + INTERVAL '1 month')
     AND ($2::uuid IS NULL OR c.household_id=$2::uuid)
 ) SELECT id,household_id,tenant_id,due_date,amount_cents,paid_cents,outstanding_cents,
   property_name,tenant_name,tenant_email FROM ledger ORDER BY due_date DESC,property_name,tenant_name LIMIT 5000`,[start,property]);
 const summary=await q(`WITH payments AS (
  SELECT charge_id,COALESCE(SUM(amount_cents),0)::bigint AS paid FROM verified_payments GROUP BY charge_id
 ) SELECT COUNT(*)::int AS charge_count,COALESCE(SUM(c.amount_cents),0)::bigint AS charged_cents,
 COALESCE(SUM(LEAST(c.amount_cents,COALESCE(p.paid,0))),0)::bigint AS paid_cents,
 COALESCE(SUM(GREATEST(c.amount_cents-COALESCE(p.paid,0),0)),0)::bigint AS outstanding_cents
 FROM charges c LEFT JOIN payments p ON p.charge_id=c.id
 WHERE c.due_date >= $1::date AND c.due_date < ($1::date + INTERVAL '1 month')
 AND ($2::uuid IS NULL OR c.household_id=$2::uuid)`,[start,property]);
 res.json({month,property,summary:summary.rows[0],rows:r.rows,truncated:r.rowCount===5000,
 note:'Verified payments only. Payments are attributed to the charge due month, not payment receipt month. Simulated payments are excluded.'});
}));
