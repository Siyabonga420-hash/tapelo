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
