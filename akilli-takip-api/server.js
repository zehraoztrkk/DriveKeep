// server.js (SON VERSİYON: Tüm Hatalar Giderildi ve Araç ID'leri Eklendi)
const express = require('express');
const cors = require('cors');
const db = require('./db'); 
const app = express();
const port = 3000;

app.use(cors()); 
app.use(express.json());

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
        const { rows } = await db.query(sqlQuery, [lon, lat]); // PostGIS için [Boylam, Enlem]
        res.json(rows); 
    } catch (err) {
        console.error('Yakın araç sorgusunda hata:', err);
        res.status(500).send({ message: 'Sunucu hatası.' });
    }
});

// 3. Uç Nokta: Aktif Kiralamaları Listeleme ve Fiyat Hesaplama
app.get('/api/kiralamalar/aktif', async (req, res) => {
    const sqlQuery = `
        SELECT 
            DISTINCT ON (A.arac_id) 
            K.kiralama_id, 
            U.ad_soyad AS kiralayan_kullanici, 
            A.arac_id,                  -- ARAC ID EKLENDİ
            A.model AS kiralanan_arac,
            AGE(CURRENT_TIMESTAMP, K.baslangic_zamani) AS suren_zaman,
            
            EXTRACT(EPOCH FROM AGE(CURRENT_TIMESTAMP, K.baslangic_zamani)) AS sure_saniye,
            
            -- DB şemasına uygun fiyat sütun adları kullanıldı
            FM.dakika_ucreti, 
            FM.acilis_ucreti 

        FROM Kiralama K 
        JOIN Kullanici U ON K.kullanici_id = U.kullanici_id
        JOIN Arac A ON K.arac_id = A.arac_id
        JOIN AracTuru AT ON A.tur_id = AT.tur_id 
        
        -- Doğru JOIN anahtarı kullanıldı: A.fiyat_model_id = FM.model_id
        JOIN fiyatlandirmamodelleri FM ON A.fiyat_model_id = FM.model_id

        WHERE K.bitis_zamani IS NULL
        
        ORDER BY A.arac_id, K.baslangic_zamani DESC; 
    `;
    try {
        const { rows } = await db.query(sqlQuery);
        
        // FİYAT VE SÜRE HESAPLAMA MANTIĞI
        const activeRentalsWithPrice = rows.map(rental => {
            const sureSaniye = parseFloat(rental.sure_saniye);
            const sureDakika = Math.ceil(sureSaniye / 60); 
            
            const dakikaUcreti = parseFloat(rental.dakika_ucreti) || 0;
            const acilisUcreti = parseFloat(rental.acilis_ucreti) || 0;
            
            const toplamFiyat = acilisUcreti + (sureDakika * dakikaUcreti);
            
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

// 4. Uç Nokta: Şarj Gerektiren Araçları Bulma
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


app.listen(port, () => {
  console.log(`Node.js API sunucusu http://localhost:${port} adresinde çalışıyor.`);
});