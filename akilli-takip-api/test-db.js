// test-db.js - Database connection test
const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres', 
  host: 'localhost', 
  database: 'postgres',
  password: 'az', 
  port: 5432,
});

async function testConnection() {
  try {
    console.log('Testing database connection...');
    const result = await pool.query('SELECT 1');
    console.log('✅ Database connection successful');
    
    // List all tables
    console.log('\nChecking tables...');
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log('Tables in database:');
    tables.rows.forEach(row => console.log('  -', row.table_name));
    
    // Check Kullanici table structure
    console.log('\nChecking Kullanici table structure...');
    const kullaniciColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'Kullanici' OR table_name = 'kullanici'
      ORDER BY ordinal_position;
    `);
    if (kullaniciColumns.rows.length === 0) {
      console.log('⚠️ Kullanici table not found!');
    } else {
      console.log('Kullanici columns:');
      kullaniciColumns.rows.forEach(row => {
        console.log(`  - ${row.column_name} (${row.data_type}, nullable: ${row.is_nullable})`);
      });
    }
    
    // Check Kiralama table structure
    console.log('\nChecking Kiralama table structure...');
    const kiralamaColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'Kiralama' OR table_name = 'kiralama'
      ORDER BY ordinal_position;
    `);
    if (kiralamaColumns.rows.length === 0) {
      console.log('⚠️ Kiralama table not found!');
    } else {
      console.log('Kiralama columns:');
      kiralamaColumns.rows.forEach(row => {
        console.log(`  - ${row.column_name} (${row.data_type}, nullable: ${row.is_nullable})`);
      });
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Full error:', err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

testConnection();
