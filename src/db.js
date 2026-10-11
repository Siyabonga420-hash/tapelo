import 'dotenv/config';
import pg from 'pg';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? {rejectUnauthorized:false} : undefined, max: 8 });
export const q = (sql, params=[]) => pool.query(sql,params);
