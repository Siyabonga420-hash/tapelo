// Standalone entrypoint for Render Cron Job. Safe to run daily: unique billing_month index prevents duplicates.
import 'dotenv/config';
import {billAll} from './manager_routes.js';
import {pool} from './db.js';
try { console.log('Automated monthly billing:',await billAll()); }
catch(e){console.error(e);process.exitCode=1;}
finally {await pool.end();}
