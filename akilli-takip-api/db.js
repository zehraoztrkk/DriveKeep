// db.js
const { Pool } = require('pg');

// LÜTFEN KENDİ VERİTABANI BİLGİLERİNİZLE GÜNCELLEYİN
const pool = new Pool({
  user: 'postgres', 
  host: 'localhost', 
  database: 'postgres', // Veya DBeaver'da kullandığınız veritabanı adı
  password: 'az', 
  port: 5432,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};