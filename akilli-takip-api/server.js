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
    FROM Arac A
    INNER JOIN AracTuru AT ON A.tur_id = AT.tur_id
    INNER JOIN LATERAL (SELECT geometri FROM KonumTakip WHERE arac_id = A.arac_id ORDER BY zaman_damgasi DESC LIMIT 1) AS KT ON TRUE
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
        FROM Arac A
        JOIN AracTuru AT ON A.tur_id = AT.tur_id
        INNER JOIN LATERAL (
            SELECT geometri 
            FROM KonumTakip 
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
        FROM Kiralama k
        JOIN Arac a ON k.arac_id = a.arac_id
        JOIN Kullanici u ON k.kullanici_id = u.kullanici_id
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
        FROM Kiralama K 
        JOIN Kullanici U ON K.kullanici_id = U.kullanici_id
        JOIN Arac A ON K.arac_id = A.arac_id
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
    FROM Arac A
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
  const { aracId, userName } = req.body;
  if (!aracId || !userName) {
    return res.status(400).send({ message: 'Araç ID ve kullanıcı adı gereklidir.' });
  }
  try {
    let userResult = await db.query('SELECT kullanici_id FROM Kullanici WHERE ad_soyad = $1', [userName]);
    let kullaniciId;
    if (userResult.rows.length === 0) {
      const insertUser = await db.query('INSERT INTO Kullanici (ad_soyad) VALUES ($1) RETURNING kullanici_id', [userName]);
      kullaniciId = insertUser.rows[0].kullanici_id;
    } else {
      kullaniciId = userResult.rows[0].kullanici_id;
    }
    const insertRental = await db.query(
      'INSERT INTO Kiralama (kullanici_id, arac_id, baslangic_zamani) VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING kiralama_id',
      [kullaniciId, aracId]
    );
    await db.query('UPDATE Arac SET durum = $1 WHERE arac_id = $2', ['kiralandi', aracId]);
    res.json({ message: 'Kiralama başlatıldı.', kiralamaId: insertRental.rows[0].kiralama_id });
  } catch (err) {
    console.error('Kiralama başlatma hatası:', err);
    res.status(500).send({ message: 'Kiralama başlatılamadı.' });
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
        FROM Kiralama K 
        JOIN Kullanici U ON K.kullanici_id = U.kullanici_id
        JOIN Arac A ON K.arac_id = A.arac_id
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

app.listen(port, () => {
  console.log(`Node.js API sunucusu http://localhost:${port} adresinde çalışıyor.`);
});