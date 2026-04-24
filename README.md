Amasya Akıllı Takip Kontrol Merkezi 🛴📍
Bu proje, şehir içi mikro-mobilite araçlarının (scooter, bisiklet vb.) anlık takibi, yönetimi ve analizi için geliştirilmiş bir Full-Stack Coğrafi Bilgi Sistemi (GIS) uygulamasıdır. Veri Tabanı Yönetim Sistemleri dersi kapsamında, verimlilik ve düşük batarya yönetimine odaklanılarak tasarlanmıştır.

🚀 Öne Çıkan Özellikler
Mekansal Veri Yönetimi: PostGIS eklentisi kullanılarak araç konumlarının koordinat bazlı (geodata) saklanması ve işlenmesi.

Anlık İzleme Paneli: Leaflet.js entegrasyonu ile araçların harita üzerinde dinamik olarak görselleştirilmesi.

Batarya Yönetimi: Şarj seviyesi %20'nin altına düşen araçların sistem tarafından otomatik olarak filtrelenmesi ve uyarı verilmesi.

Kiralama Analitiği: Aktif kiralama sayısı ve araç durumlarının (boşta, kirada, bakımda) gerçek zamanlı takibi.

RESTful API: Node.js ve Express.js ile geliştirilen, frontend ve veritabanı arasındaki iletişimi sağlayan sağlam backend mimarisi.


🛠 Teknoloji YığınıKatmanKullanılan TeknolojilerFrontendHTML5, CSS3, JavaScript (ES6+), Leaflet.jsBackendNode.js, Express.jsVeritabanıPostgreSQL, PostGIS (Spatial Database)AraçlarDBeaver, VS Code, Git

🏗 Veritabanı Şeması
Projenin kalbinde yer alan PostgreSQL yapısı, ilişkisel veri modelini mekansal sorgularla birleştirir:

arac: Araçların genel bilgileri ve batarya seviyeleri.

aracturu: Araç tiplerinin (Scooter, Elektrikli Bisiklet vb.) yönetimi.

kiralama: Kullanıcı ve araç eşleşmeleri ile kiralama geçmişi.

PostGIS: geometry(Point, 4326) formatında konum verisi işleme.

💻 Kurulum
Repoyu klonlayın: git clone https://github.com/zehraoztrkk/akilli-takip-api.git

Gerekli paketleri yükleyin: npm install

.env dosyanıza veritabanı bilgilerinizi ekleyin.

Sunucuyu başlatın: node server.js
