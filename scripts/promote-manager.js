// Run only from a trusted machine. Never expose this as a public API endpoint.
import 'dotenv/config';
import {pool} from '../src/db.js';
const email=process.argv[2]?.toLowerCase();
if(!email){console.error('Usage: node scripts/promote-manager.js email@example.com');process.exit(1);}
try{const r=await pool.query("UPDATE users SET role='manager' WHERE email=$1 RETURNING id,email,role",[email]);console.log(r.rows[0]||'User not found: register first');}finally{await pool.end();}
