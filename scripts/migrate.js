import 'dotenv/config';
import {readFileSync} from 'node:fs';
import {pool} from '../src/db.js';
try{await pool.query(readFileSync(new URL('../sql/001_init.sql',import.meta.url),'utf8'));await pool.query(readFileSync(new URL('../sql/002_manager.sql',import.meta.url),'utf8'));console.log('Database migration completed');}catch(e){console.error(e);process.exitCode=1;}finally{await pool.end();}
