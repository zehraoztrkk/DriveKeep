// server.js (GÜNCELLENMİŞ VERSİYON: Geçmiş ve Aktif Kiralamalar Eklendi)
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db'); 
const app = express();
const port = 3000;

app.use(cors()); 
app.use(express.json());
app.use(express.static(path.join(__dirname))); 

// 1. Uç Nokta: TÜM ARAÇLARIN KONUMLARINI GETİRME
app.get('/api/araclar/konum', async (req, res) => {
  const sqlQuery = `SELECT 
        A.arac_id, 
        A.model, 
        AT.tur_adi, 
        A.batarya_seviyesi, 
        A.durum, 
        ST_X(KT.geometri) AS boylam, 
        ST_Y(KT.geometri) AS enlem
    FROM arac A
    INNER JOIN aracturu AT ON A.tur_id = AT.tur_id
    INNER JOIN LATERAL (SELECT geometri FROM konumtakip WHERE arac_id = A.arac_id ORDER BY zaman_damgasi DESC LIMIT 1) AS KT ON TRUE
    WHERE A.durum IN ('bos', 'kiralandi', 'bakim');
  `;
  try {
    const { rows } = await db.query(sqlQuery);
    res.json(rows); 
  } catch (err) {
    console.error('Konum sorgusunda hata:', err);
    res.status(500).send({ message: 'Sunucu hatası.' });
  }
});

// 2. Uç Nokta: Kullanıcıya En Yakın 3 Müsait Aracı Bulma
app.get('/api/araclar/yakin', async (req, res) => {
    const { lat, lon } = req.query; 
    if (!lat || !lon) { return res.status(400).send({ message: 'Enlem ve Boylam gereklidir.' }); }

    const sqlQuery = `WITH user_location AS (SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326) AS user_geom)
        SELECT 
            A.arac_id, 
            A.model, 
            AT.tur_adi, 
            A.batarya_seviyesi, 
            ROUND(ST_Distance(KT.geometri::geography, (SELECT user_geom FROM user_location)::geography)::NUMERIC, 2) AS mesafe_metre,
            ST_Y(KT.geometri) AS enlem,  
            ST_X(KT.geometri) AS boylam  
        FROM arac A
        JOIN aracturu AT ON A.tur_id = AT.tur_id
        INNER JOIN LATERAL (
            SELECT geometri 
            FROM konumtakip 
            WHERE arac_id = A.arac_id 
            ORDER BY zaman_damgasi DESC LIMIT 1
        ) AS KT ON TRUE
        WHERE A.durum = 'bos'
        ORDER BY KT.geometri <-> (SELECT user_geom FROM user_location)  
        LIMIT 3;
    `;

    try {
        const { rows } = await db.query(sqlQuery, [lon, lat]); 
        res.json(rows); 
    } catch (err) {
        console.error('Yakın araç sorgusunda hata:', err);
        res.status(500).send({ message: 'Sunucu hatası.' });
    }
});

// 3. Uç Nokta: Geçmiş Kiralamaları Getirme (Bitiş zamanı NULL OLMAYANLAR)
app.get('/api/kiralamalar/gecmis', async (req, res) => {
    const sql = `
        SELECT 
            k.kiralama_id,
            k.arac_id,
            a.model AS kiralanan_arac,
            u.ad_soyad AS kiralayan_kullanici,
            k.baslangic_zamani,
            k.bitis_zamani,
            k.toplam_ucret AS tahmini_fiyat
        FROM kiralama k
        JOIN arac a ON k.arac_id = a.arac_id
        JOIN kullanici u ON k.kullanici_id = u.kullanici_id
        WHERE k.bitis_zamani IS NOT NULL
        ORDER BY k.bitis_zamani DESC;
    `;
    try {
        const { rows } = await db.query(sql);
        res.json(rows);
    } catch (err) {
        console.error('Geçmiş kiralama sorgu hatası:', err);
        res.status(500).json({ error: 'Veritabanı hatası' });
    }
});

// 4. Uç Nokta: Aktif Kiralamaları Listeleme ve Fiyat Hesaplama
// Not: Bu endpoint zaten mevcuttu, talep ettiğiniz basitleştirilmiş haliyle veya 
// süre/fiyat hesaplayan detaylı haliyle kullanabilirsiniz. Aşağıda detaylı hali korunmuştur.
app.get('/api/kiralamalar/aktif', async (req, res) => {
    const sqlQuery = `
        SELECT 
            DISTINCT ON (A.arac_id) 
            K.kiralama_id, 
            U.ad_soyad AS kiralayan_kullanici, 
            A.arac_id,
            A.model AS kiralanan_arac,
            EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - K.baslangic_zamani)) AS sure_saniye,
            FM.dakika_ucreti, 
            FM.acilis_ucreti 
        FROM kiralama K 
        JOIN kullanici U ON K.kullanici_id = U.kullanici_id
        JOIN arac A ON K.arac_id = A.arac_id
        JOIN fiyatlandirmamodelleri FM ON A.fiyat_model_id = FM.model_id
        WHERE K.bitis_zamani IS NULL
        ORDER BY A.arac_id, K.baslangic_zamani DESC; 
    `;
    try {
        const { rows } = await db.query(sqlQuery);
        const activeRentalsWithPrice = rows.map(rental => {
            const sureSaniye = parseFloat(rental.sure_saniye);
            const sureDakika = Math.ceil(sureSaniye / 60); 
            const toplamFiyat = parseFloat(rental.acilis_ucreti || 0) + (sureDakika * parseFloat(rental.dakika_ucreti || 0));
            return {
                ...rental,
                tahmini_fiyat: toplamFiyat.toFixed(2) + ' TL',
                sure_dakika: sureDakika,
            };
        });
        res.json(activeRentalsWithPrice); 
    } catch (err) {
        console.error('Aktif kiralama sorgusunda hata:', err);
        res.status(500).send({ message: 'Aktif kiralama verisi alınamadı.' });
    }
});

// 5. Uç Nokta: Şarj Gerektiren Araçları Bulma
app.get('/api/bakim/dusuk-batarya', async (req, res) => {
  const sqlQuery = `SELECT A.arac_id, A.model, A.batarya_seviyesi
    FROM arac A
    WHERE A.tur_id = 1 AND A.durum = 'bos' AND A.batarya_seviyesi <= 20.00;
  `;
  try {
    const { rows } = await db.query(sqlQuery);
    res.json(rows); 
  } catch (err) {
    res.status(500).send({ message: 'Düşük batarya verisi alınamadı.' });
  }
});

// 6. Uç Nokta: Kiralama Başlatma
app.post('/api/kiralamalar/baslat', async (req, res) => {
  const { aracId, userName, userEmail, userPhone } = req.body;
  console.log('Kiralama isteği alındı:', { aracId, userName, userEmail, userPhone });
  
  if (!aracId || !userName || !userEmail || !userPhone) {
    return res.status(400).send({ message: 'Araç ID, kullanıcı adı, e-mail ve telefon gereklidir.' });
  }
  try {
    console.log('Kullanıcı sorgulanıyor:', userEmail);
    // Email'e göre sorgu yap (email unique, ad değil)
    let userResult = await db.query('SELECT kullanici_id FROM kullanici WHERE eposta = $1', [userEmail]);
    let kullaniciId;
    if (userResult.rows.length === 0) {
      console.log('Yeni kullanıcı oluşturuluyor:', userName);
      const insertUser = await db.query('INSERT INTO kullanici (ad_soyad, eposta, telefon) VALUES ($1, $2, $3) RETURNING kullanici_id', [userName, userEmail, userPhone]);
      kullaniciId = insertUser.rows[0].kullanici_id;
      console.log('Yeni kullanıcı oluşturuldu, ID:', kullaniciId, 'Email:', userEmail, 'Telefon:', userPhone);
    } else {
      kullaniciId = userResult.rows[0].kullanici_id;
      console.log('Mevcut kullanıcı bulundu, ID:', kullaniciId);
      // Telefon güncelleme yapmıyoruz çünkü telefon da UNIQUE
    }
    
    console.log('Kiralama oluşturuluyor:', { kullaniciId, aracId });
    const insertRental = await db.query(
      'INSERT INTO kiralama (kullanici_id, arac_id, baslangic_zamani) VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING kiralama_id',
      [kullaniciId, aracId]
    );
    console.log('Kiralama oluşturuldu, ID:', insertRental.rows[0].kiralama_id);
    
    console.log('Araç durumu güncelleniyor...');
    await db.query('UPDATE arac SET durum = $1 WHERE arac_id = $2', ['kiralandi', aracId]);
    console.log('Araç durumu güncellendi');
    
    res.json({ message: 'Kiralama başlatıldı.', kiralamaId: insertRental.rows[0].kiralama_id });
  } catch (err) {
    console.error('Kiralama başlatma hatası:', err.message);
    console.error('Detaylı hata:', err);
    res.status(500).send({ message: 'Kiralama başlatılamadı: ' + err.message });
  }
});

// 7. Uç Nokta: Geçmiş Kiralamalar (TÜM LİSTE)
app.get('/api/kiralamalar/gecmis', async (req, res) => {
    const sqlQuery = `
        SELECT 
            K.kiralama_id, 
            U.ad_soyad AS kiralayan_kullanici, 
            A.arac_id,                                  
            A.model AS kiralanan_arac,
            K.baslangic_zamani,
            K.bitis_zamani,
            EXTRACT(EPOCH FROM (K.bitis_zamani - K.baslangic_zamani)) AS sure_saniye,
            FM.dakika_ucreti, 
            FM.acilis_ucreti 
        FROM kiralama K 
        JOIN kullanici U ON K.kullanici_id = U.kullanici_id
        JOIN arac A ON K.arac_id = A.arac_id
        JOIN fiyatlandirmamodelleri FM ON A.fiyat_model_id = FM.model_id
        WHERE K.bitis_zamani IS NOT NULL
        ORDER BY K.bitis_zamani DESC; -- En son biten sürüş en üstte görünür
    `;
    try {
        const { rows } = await db.query(sqlQuery);
        
        // Frontend'in beklediği formatta fiyat hesaplama
        const completedRentals = rows.map(rental => {
            const sureDakika = Math.ceil(rental.sure_saniye / 60);
            const toplamFiyat = parseFloat(rental.acilis_ucreti) + (sureDakika * parseFloat(rental.dakika_ucreti));
            return {
                ...rental,
                sure_dakika: sureDakika,
                tahmini_fiyat: toplamFiyat.toFixed(2) + ' TL'
            };
        });

        res.json(completedRentals); 
    } catch (err) {
        console.error('Geçmiş kiralama sorgu hatası:', err);
        res.status(500).send({ message: 'Geçmiş veriler alınamadı.' });
    }
});

// 8. Uç Nokta: Kiralama Bitirme
app.post('/api/kiralamalar/bitir', async (req, res) => {
  const { kiralamaId, aracId } = req.body;
  console.log('Kiralama bitirme isteği alındı:', { kiralamaId, aracId });
  
  if (!kiralamaId || !aracId) {
    return res.status(400).send({ message: 'Kiralama ID ve Araç ID gereklidir.' });
  }
  
  try {
    // Kiralama bitirme
    console.log('Kiralama güncelleniyor:', kiralamaId);
    const updateRental = await db.query(
      'UPDATE kiralama SET bitis_zamani = CURRENT_TIMESTAMP WHERE kiralama_id = $1 RETURNING kiralama_id, baslangic_zamani, bitis_zamani',
      [kiralamaId]
    );
    
    if (updateRental.rows.length === 0) {
      return res.status(404).send({ message: 'Kiralama bulunamadı.' });
    }
    
    // Araç durumunu güncelle
    console.log('Araç durumu güncelleniyor:', aracId);
    await db.query('UPDATE arac SET durum = $1 WHERE arac_id = $2', ['bos', aracId]);
    
    const rentalData = updateRental.rows[0];
    const sureSaniye = Math.floor((new Date(rentalData.bitis_zamani) - new Date(rentalData.baslangic_zamani)) / 1000);
    const sureDakika = Math.ceil(sureSaniye / 60);
    
    console.log('Kiralama başarıyla bitirildi');
    res.json({ 
      message: 'Kiralama başarıyla bitirildi.', 
      kiralamaId: rentalData.kiralama_id,
      sureDakika: sureDakika,
      baslangic_zamani: rentalData.baslangic_zamani,
      bitis_zamani: rentalData.bitis_zamani
    });
  } catch (err) {
    console.error('Kiralama bitirme hatası:', err.message);
    console.error('Detaylı hata:', err);
    res.status(500).send({ message: 'Kiralama bitirilirken hata oluştu: ' + err.message });
  }
});

app.listen(port, () => {
  console.log(`Node.js API sunucusu http://localhost:${port} adresinde çalışıyor.`);
});