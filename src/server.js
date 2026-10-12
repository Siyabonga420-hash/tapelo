import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import {ZodError} from 'zod';
import {router} from './routes.js';
import {managerRouter} from './manager_routes.js';
import {adminRouter} from './admin_routes.js';
import {q} from './db.js';
import {ensureSecuritySchema,writeAudit,hashIdentifier} from './security_audit.js';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {startReminders} from './jobs.js';
if(!process.env.JWT_SECRET||process.env.JWT_SECRET.length<32)throw new Error('JWT_SECRET must contain at least 32 characters');
const app=express();
app.disable('x-powered-by');app.use(helmet());
const allowed=(process.env.CORS_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
app.use(cors({origin:(origin,cb)=>{if(!origin||allowed.includes(origin))return cb(null,true);cb(new Error('CORS origin not permitted'));}}));
app.use(express.json({limit:'4mb'}));
app.get('/manager',(req,res)=>{res.removeHeader('Content-Security-Policy');res.type('html').send(readFileSync(join(dirname(fileURLToPath(import.meta.url)),'manager.html'),'utf8'));});
app.use('/api/auth',rateLimit({windowMs:15*60*1000,limit:20,standardHeaders:'draft-7',legacyHeaders:false}));
app.get('/api/public/households/:id/photo', async (req,res,next) => {
  try {
    const {q} = await import('./db.js');
    const {z} = await import('zod');
    const id = z.z.string().uuid().parse(req.params.id);
    const r = await q('SELECT photo_mime,photo_data FROM households WHERE id=$1',[id]);
    if (!r.rowCount || !r.rows[0].photo_data) return res.sendStatus(404);
    res.set('Content-Type',r.rows[0].photo_mime);
    res.set('Cache-Control','public,max-age=3600');
    res.send(r.rows[0].photo_data);
  } catch(e) { next(e); }
});
// Capture login outcomes without storing passwords, raw emails or IP addresses.
app.use('/api/auth/login',(req,res,next)=>{
  const emailHash=hashIdentifier(req.body?.email);
  const ipHash=hashIdentifier(req.ip);
  res.on('finish',()=>{
    const action=res.statusCode===200?'auth.login_succeeded':res.statusCode===401?'auth.login_failed':null;
    if(action)writeAudit({action,details:{email_hash:emailHash,ip_hash:ipHash,status:res.statusCode}})
      .catch(e=>console.error('Login audit write failed:',e.message));
  });
  next();
});
// Always verify current DB role for privileged manager routes.
app.use('/api/manager',async(req,res,next)=>{
  try {
    const {auth}=await import('./auth.js');
    auth(req,res,async()=>{
      try {
        const result=await q('SELECT role FROM users WHERE id=$1',[req.user.sub]);
        if(!['manager','admin'].includes(result.rows[0]?.role))return res.status(403).json({error:'Manager access required'});
        next();
      } catch(e){next(e);}
    });
  } catch(e){next(e);}
});
app.use('/api/auth/register',async(req,res,next)=>{try{const r=await q("SELECT value FROM platform_settings WHERE key='registration_enabled'");if(r.rows[0]?.value===false)return res.status(403).json({error:'Registration is currently disabled'});next();}catch(e){next(e);}});
app.use('/api',router);
app.use('/api',managerRouter);
app.use('/api',adminRouter);
app.use((req,res)=>res.status(404).json({error:'Route not found'}));
app.use((err,req,res,next)=>{if(err instanceof ZodError)return res.status(400).json({error:'Invalid input',details:err.flatten()});if(err.code==='23505')return res.status(409).json({error:'Record already exists'});if(err.code==='23503')return res.status(400).json({error:'Related record not found'});if(err.message==='CORS origin not permitted')return res.status(403).json({error:err.message});console.error(err);res.status(err.status||500).json({error:err.status?err.message:'Internal server error'});});
const port=Number(process.env.PORT)||10000;
ensureSecuritySchema().then(()=>app.listen(port,'0.0.0.0',()=>{console.log(`RentMate API listening on ${port}`);startReminders();})).catch(e=>{console.error('Security schema initialization failed:',e);process.exit(1);});
