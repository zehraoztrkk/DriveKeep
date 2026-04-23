const db = require('./db');
(async () => {
  try {
    console.log('Silme işlemi başlanıyor...\n');
    
    const emails = ['ss@gmail.com', 'saa@gmail.com', 'zehra@gmail.com'];
    
    for (const email of emails) {
      const userResult = await db.query('SELECT kullanici_id FROM kullanici WHERE eposta = $1', [email]);
      if (userResult.rows.length > 0) {
        const userId = userResult.rows[0].kullanici_id;
        
        // Önce bu kullanıcıya ait kiramaları sil
        const delRentals = await db.query('DELETE FROM kiralama WHERE kullanici_id = $1', [userId]);
        console.log(`🗑️  ${email} - Kiralamalar silindi (${delRentals.rowCount} kayıt)`);
        
        // Sonra kullanıcıyı sil
        const delUser = await db.query('DELETE FROM kullanici WHERE kullanici_id = $1', [userId]);
        console.log(`🗑️  ${email} - Kullanıcı silindi (${delUser.rowCount} kayıt)`);
      } else {
        console.log(`⚠️  ${email} - Bulunamadı`);
      }
    }
    
    console.log('\n✨ Tüm kayıtlar başarıyla silindi!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Hata:', err.message);
    process.exit(1);
  }
})();
