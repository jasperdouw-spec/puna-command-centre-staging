import mysql,{type Pool} from 'mysql2/promise';
let pool:Pool|undefined;
export function database():Pool {if(pool)return pool;const keys=['DB_HOST','DB_NAME','DB_USER','DB_PASSWORD'];for(const k of keys)if(!process.env[k])throw new Error('Database configuration incomplete');pool=mysql.createPool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,waitForConnections:true,connectionLimit:5,decimalNumbers:false,timezone:'Z'});return pool}
