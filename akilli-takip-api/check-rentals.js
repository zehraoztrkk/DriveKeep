const db = require('./db');
(async () => {
  try {
    console.log('Silinecek kullanıcılara ait kiralamalar kontrol ediliyor...\n');
    
    // Kullanıcıları bul
    const emails = ['ss@gmail.com', 'saa@gmail.com', 'zehra@gmail.com'];
    
    for (const email of emails) {
      const userResult = await db.query('SELECT kullanici_id, ad_soyad FROM kullanici WHERE eposta = $1', [email]);
      if (userResult.rows.length > 0) {
        const userId = userResult.rows[0].kullanici_id;
        const userName = userResult.rows[0].ad_soyad;
        
        // Kiramaları bul
        const rentals = await db.query('SELECT kiralama_id FROM kiralama WHERE kullanici_id = $1', [userId]);
        console.log(`👤 ${userName} (${email}) - Kiralama ID: ${userId}`);
        console.log(`   Toplam kiralama: ${rentals.rowCount}`);
        if (rentals.rowCount > 0) {
          console.log(`   Kiralama IDs: ${rentals.rows.map(r => r.kiralama_id).join(', ')}`);
        }
        console.log('');
      }
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Hata:', err.message);
    process.exit(1);
  }
})();
