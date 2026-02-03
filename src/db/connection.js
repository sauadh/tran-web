const { Pool } = require("pg");

const pool = new Pool({
  user: "diary_user",
  host: "localhost",
  database: "diary",
  password: "password123",
  port: 5432,
   connectionString: process.env.DATABASE_URL, // Your database URL
  max: 20,                   // max number of connections in pool
  idleTimeoutMillis: 30000,  // close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // fail if cannot connect in 2 sec
});

pool.on("error", (err, client) => {
  console.error("Unexpected DB error", err);
});

pool.query("SELECT NOW()", (err, res) => {
  if (err) console.error("DB connection error:", err);
  else console.log("DB connected:", res.rows[0]);
});

module.exports = pool;

