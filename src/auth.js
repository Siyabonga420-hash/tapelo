import jwt from 'jsonwebtoken';
export function tokenFor(user) { return jwt.sign({sub:user.id,role:user.role},process.env.JWT_SECRET,{expiresIn:'7d'}); }
export function auth(req,res,next) { const t=(req.headers.authorization||'').match(/^Bearer (.+)$/i)?.[1]; if(!t)return res.status(401).json({error:'Authentication required'}); try{req.user=jwt.verify(t,process.env.JWT_SECRET);next();}catch{return res.status(401).json({error:'Invalid or expired token'});} }
export function manager(req,res,next){if(!['manager','admin'].includes(req.user.role))return res.status(403).json({error:'Manager access required'});next();}
