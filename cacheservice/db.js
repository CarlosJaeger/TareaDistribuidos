import pkg from 'pg';
const { Pool } = pkg;

export const pool = new Pool({
  user: 'user',
  host: 'localhost',
  database: 'yahoo_dataset',
  password: '1234',
  port: 5432
});
