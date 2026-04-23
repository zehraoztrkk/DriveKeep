const db = require('./db');
(async () => {
  try {
    console.log('Kayıtlar siliniyor...\n');
    
    // 1. ss@gmail.com
    const del1 = await db.query('DELETE FROM kullanici WHERE eposta = $1', ['ss@gmail.com']);
    console.log('✅ ss@gmail.com silindi (' + del1.rowCount + ' kayıt)');
    
    // 2. saa@gmail.com
    const del2 = await db.query('DELETE FROM kullanici WHERE eposta = $1', ['saa@gmail.com']);
    console.log('✅ saa@gmail.com silindi (' + del2.rowCount + ' kayıt)');
    
    // 3. zehra@gmail.com
    const del3 = await db.query('DELETE FROM kullanici WHERE eposta = $1', ['zehra@gmail.com']);
    console.log('✅ zehra@gmail.com silindi (' + del3.rowCount + ' kayıt)');
    
    console.log('\n✨ Tüm kayıtlar başarıyla silindi!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Hata:', err.message);
    process.exit(1);
  }
})();
