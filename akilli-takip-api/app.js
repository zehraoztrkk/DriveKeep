// app.js (SON VE KESİN ÇÖZÜM VERSİYONU: Tüm Listeler Uyumlu, Temizlenmiş ve Kirala Formu Eklendi)

const API_URL = 'http://localhost:3000/api';
const AMASYA_LAT = 40.65;
const AMASYA_LON = 35.84;
let markerLayer = L.layerGroup(); 
let nearestVehicleGroup = L.layerGroup();
let locationMarkerGroup = L.layerGroup();

// 1. Haritayı Başlatma (Amasya Sınırlandırması)
const southwest = L.latLng(40.50, 35.70); 
const northeast = L.latLng(40.80, 36.00); 
const bounds = L.latLngBounds(southwest, northeast);

const map = L.map('mapid', {
    maxBounds: bounds,            
    minZoom: 10,                  
    maxZoom: 19                    
}).setView([AMASYA_LAT, AMASYA_LON], 14); 

// OSM Harita Katmanını Ekleme
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
    maxZoom: 19,
    attribution: '© OpenStreetMap katkıda bulunanları'
}).addTo(map);

markerLayer.addTo(map);
nearestVehicleGroup.addTo(map);
locationMarkerGroup.addTo(map);

// 2. İşaretçi Oluşturma Fonksiyonu
function createVehicleIcon(vehicle) {
    const isRented = vehicle.durum === 'kiralandi';
    const isInMaintenance = vehicle.durum === 'bakim'; 
    const isLowBattery = vehicle.batarya_seviyesi && vehicle.batarya_seviyesi <= 20 && vehicle.tur_adi === 'Scooter';
    
    let color;
    let iconContent;
    let opacity = 1.0;

    if (isInMaintenance) {
        color = '#343a40'; 
        iconContent = '🔧'; 
        opacity = 0.8; 
    } else if (isRented) {
        color = '#777777'; 
        iconContent = vehicle.tur_adi === 'Scooter' ? '🛴' : '🚲';
        opacity = 0.6;
    } else {
        if (isLowBattery) {
            color = '#ffc107'; 
        } else {
            color = vehicle.tur_adi === 'Scooter' ? '#007bff' : '#28a745';
        }
        iconContent = vehicle.tur_adi === 'Scooter' ? '🛴' : '🚲';
    }
    
    const iconHtml = `
        <div style="
            background-color: ${color}; 
            width: 40px; 
            height: 40px; 
            border-radius: 50%;
            border: 3px solid white; 
            text-align: center;
            line-height: 34px;
            font-size: 24px; 
            color: white; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.4);
            opacity: ${opacity}; 
        ">
            ${iconContent}
        </div>
    `;
    
    return L.divIcon({ 
        className: 'custom-vehicle-icon',
        html: iconHtml, 
        iconSize: [40, 40], 
        popupAnchor: [0, -20] 
    });
}


// Yeni Fonksiyon: Kirala butonu tıklandığında pop-up içeriğini form ile değiştiren fonksiyon
function requestRentalDetails(aracId) {
    const popupContent = `
        <div class="p-2">
            <h5 class="text-primary">Kiralama Detayları</h5>
            <p><strong>Araç ID:</strong> ${aracId}</p>
            
            <p class="text-muted small">Bu kiralama simülasyonudur.</p>

            <div class="form-group">
                <label for="rentalUser">Kullanıcı Adı (Simülasyon):</label>
                <input type="text" id="rentalUser" class="form-control form-control-sm" placeholder="Kullanıcı Adı Giriniz (Örn: Mehmet)">
            </div>
            
            <button onclick="confirmRental(${aracId})" class="btn btn-sm btn-success mt-2">Kiralama Başlat</button>
            <button onclick="map.closePopup()" class="btn btn-sm btn-outline-secondary mt-2 ml-2">İptal</button>
        </div>
    `;
    
    // Pop-up içeriğini dinamik olarak günceller
    const popup = map._popup;
    if (popup) {
        popup.setContent(popupContent);
    }
}

// Modal açıldığında Araç ID'sini aktaran fonksiyon

function openRentalModal(aracId) {

    document.getElementById('modal-arac-id').textContent = aracId;

    // Formu temizle

    document.getElementById('modal-user-name').value = '';

}



// Kiralama Onayı (Simülasyon - Tabloya Geçici Ekleme) - BURAYA YAPIŞTIRDIN

function confirmRentalModal() {

    const aracId = document.getElementById('modal-arac-id').textContent;

    const userName = document.getElementById('modal-user-name').value;

    const mode = document.getElementById('modal-mode').value;



    if (!userName.trim()) {

        alert('Lütfen kullanıcı adınızı giriniz.');

        return;

    }



    const tbody = document.getElementById('active-rentals-table').getElementsByTagName('tbody')[0];

   

    // 1. Yeni satırı oluştur (Stil vermiyoruz, diğerleriyle aynı kalsın)

    let row = tbody.insertRow(0);

   

    // 2. Değerleri diğer satırların formatına göre hazırla

    const modelMetni = `Sürüş Başladı (${mode})`;

    const baslangicSuresi = "0 dk";

    const baslangicFiyati = "10.00 TL";



    // 3. Sütunları doldur (Düz metin olarak, badge veya bold etiketleri olmadan)

    row.insertCell(0).textContent = aracId;           // ID sütunu

    row.insertCell(1).textContent = modelMetni;      // Araç Modeli sütunu

    row.insertCell(2).textContent = userName;         // Kullanıcı sütunu

    row.insertCell(3).textContent = baslangicSuresi;  // Süre sütunu

    row.insertCell(4).textContent = baslangicFiyati;  // Fiyat sütunu



    // 4. Sayaç rakamını güncelle

    const countElement = document.getElementById('active-rentals-count');

    countElement.textContent = parseInt(countElement.textContent || 0) + 1;



    // 5. Modalı kapat ve temizle

    $('#rentalModal').modal('hide');

    document.getElementById('modal-user-name').value = '';



    console.log(`Kiralama eklendi: ${aracId}`);

}

// 3. API'den Veri Çekme ve Haritada Gösterme
async function loadVehicleMarkers() {
    markerLayer.clearLayers();
    try {
        const response = await fetch(`${API_URL}/araclar/konum`);
        if (!response.ok) { throw new Error(`API Hatası: ${response.status}`); }

        const vehicles = await response.json(); 
        
        vehicles.forEach(vehicle => {
            const icon = createVehicleIcon(vehicle);
            const isRented = vehicle.durum === 'kiralandi'; 
            const isInMaintenance = vehicle.durum === 'bakim'; 
            const isLowBattery = vehicle.tur_adi === 'Scooter' && vehicle.batarya_seviyesi <= 20;
            
            const disableRent = isRented || isLowBattery || isInMaintenance; 
            
            // Marker oluşturulur
            const marker = L.marker([vehicle.enlem, vehicle.boylam], {icon: icon});

            const batteryLevel = vehicle.batarya_seviyesi;
            let batteryInfo = '';
            
            if (vehicle.tur_adi === 'Scooter') {
                if (batteryLevel !== null && batteryLevel !== undefined) {
                    let iconClass;
                    let colorClass = 'text-success'; 

                    if (batteryLevel <= 10) {
                        iconClass = 'fa-battery-empty'; 
                        colorClass = 'text-danger';
                    } else if (batteryLevel <= 30) {
                        iconClass = 'fa-battery-quarter'; 
                        colorClass = 'text-danger';
                    } else if (batteryLevel <= 50) {
                        iconClass = 'fa-battery-half'; 
                        colorClass = 'text-warning';
                    } else if (batteryLevel <= 80) {
                        iconClass = 'fa-battery-three-quarters'; 
                        colorClass = 'text-success';
                    } else {
                        iconClass = 'fa-battery-full'; 
                        colorClass = 'text-success';
                    }

                    batteryInfo = `
                        <div style="margin-top: 5px; font-weight: bold;">
                            <i class="fas ${iconClass} fa-lg ${colorClass}" style="margin-right: 5px;"></i> 
                            ${batteryLevel}%
                        </div>
                    `;
                } else {
                    batteryInfo = `<div style="margin-top: 5px;">Pil Durumu: Bilinmiyor</div>`;
                }
            }

            // Pop-up içeriği oluşturulur
            let initialPopupContent = `
                <b>${vehicle.model} (ID: ${vehicle.arac_id})</b><br> 
                Tür: ${vehicle.tur_adi}
                ${batteryInfo} 
            `;

            if (!disableRent) {
                // KIRALANABILIR DURUM
                // KRİTİK DEĞİŞİKLİK: Kirala butonu requestRentalDetails fonksiyonunu çağırıyor
                initialPopupContent += `<button onclick="openRentalModal(${vehicle.arac_id})" class="btn btn-sm btn-danger mt-1" data-toggle="modal" data-target="#rentalModal">Kirala</button>`;
                
                // Pop-up'ı marker'a bağlama
                marker.bindPopup(initialPopupContent);

            } else {
                 let popupContent;
                 if (isInMaintenance) {
                     // BAKIMDA
                     popupContent = `
                        ${initialPopupContent} 
                        <span style="color: #343a40; font-weight: bold;">BAKIMDA. Kiralanamaz.</span>
                    `;
                     marker.bindTooltip(`Bakımda (ID: ${vehicle.arac_id})`, { permanent: false, direction: 'auto' });
                     marker.bindPopup(popupContent);
                 } else if (isRented) {
                     // KIRADA
                     popupContent = `Kirada: ${vehicle.model} (${vehicle.tur_adi}) (ID: ${vehicle.arac_id})`;
                     marker.bindTooltip(popupContent, { permanent: false, direction: 'auto' });
                 } else { 
                     // DÜŞÜK BATARYA
                     popupContent = `
                        ${initialPopupContent}
                        <span style="color: #ffc107; font-weight: bold;">BATARYA DÜŞÜK! Kiralanamaz.</span>
                    `;
                     marker.bindPopup(popupContent);
                 }
            }
            
            marker.addTo(markerLayer);
        });
    } catch (error) {
        console.error("Marker yüklenirken hata:", error);
    }
}

// 4. Harita Tıklama Olayı: En Yakın Araçları Bulma 
map.on('click', async (e) => {
    nearestVehicleGroup.clearLayers(); 
    locationMarkerGroup.clearLayers();
    
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;
    
    const flagIconHtml = `
        <div style="
            font-size: 28px; 
            line-height: 1; 
            text-shadow: 1px 1px 2px rgba(0,0,0,0.5); 
        ">
            🚩
        </div>
    `;

    L.marker([lat, lon], { 
        icon: L.divIcon({ 
            className: 'custom-flag-icon',
            html: flagIconHtml, 
            iconSize: [30, 30],
            iconAnchor: [6, 28] 
        }) 
    })
    .addTo(locationMarkerGroup); 

    document.getElementById('closest-vehicles').innerHTML = 'En yakın araçlar yükleniyor...';

    try {
        const response = await fetch(`${API_URL}/araclar/yakin?lat=${lat}&lon=${lon}`);
        const closestVehicles = await response.json();
        
        let resultHtml = `<b>Seçilen Konuma En Yakın 3 Müsait Araç:</b><br>`;
        
        if (!Array.isArray(closestVehicles) || closestVehicles.length === 0) {
            document.getElementById('closest-vehicles').innerHTML = 'En yakın araçlar bulunamadı (API hatası veya hepsi kirada/bakımda).';
            return;
        }

        closestVehicles.forEach((v, index) => {
            // Çember boyutu 150 metreye ayarlandı
            L.circle([v.enlem, v.boylam], { radius: 150, color: 'blue', fillOpacity: 0.2 }).addTo(nearestVehicleGroup); 
            
            // Model Adı ve ID'yi gösteriyoruz
            const modelName = `${v.model} (ID: ${v.arac_id})`; 
            
            resultHtml += `<span class="badge badge-success mr-2">${index + 1}. ${modelName} (${v.mesafe_metre}m)</span>`;
        });
        
        document.getElementById('closest-vehicles').innerHTML = resultHtml;

    } catch (error) {
        document.getElementById('closest-vehicles').innerHTML = 'En yakın araçlar bulunamadı (API hatası veya hepsi kirada/bakımda).';
    }
});


// 5. Rapor Verilerini Yükleme (KARTLARIN ALTINA LİSTE OLUŞTURMA İŞLEMİ)
async function loadDashboardData() {
    try {
        // API'den verileri çekiyoruz
        const activeRentalsPromise = fetch(`${API_URL}/kiralamalar/aktif`).then(res => res.json()).catch(() => []);
        const completedRentalsPromise = fetch(`${API_URL}/kiralamalar/gecmis`).then(res => res.json()).catch(() => []);
        const lowBatteryPromise = fetch(`${API_URL}/bakim/dusuk-batarya`).then(res => res.json()).catch(() => []);

        const [activeRentals, completedRentals, lowBatteryVehicles] = await Promise.all([
            activeRentalsPromise, 
            completedRentalsPromise, 
            lowBatteryPromise
        ]);

        // --- 1. SAĞ PANEL: KİRALAMA GEÇMİŞİ (BİTMİŞ SÜRÜŞLER) ---
        document.getElementById('active-rentals-count').textContent = completedRentals.length;
        const listContainer = document.getElementById('active-rental-list-container');
        listContainer.innerHTML = ''; 

        if (completedRentals.length > 0) {
            const ul = document.createElement('ul');
            ul.className = 'list-group list-group-flush mt-2';

            completedRentals.forEach(rental => {
                let modelName = rental.kiralanan_arac ? rental.kiralanan_arac.replace(/\s*\(\d+\)$/, '') : "Bilinmiyor";
                const li = document.createElement('li');
                li.className = 'list-group-item d-flex justify-content-between align-items-center p-1 bg-transparent';
                li.style.fontSize = '0.9em';
                li.innerHTML = `
                    <div><strong>ID ${rental.arac_id}:</strong> ${modelName}</div>
                    <span class="text-muted">Kiralayan: ${rental.kiralayan_kullanici}</span>
                `;
                ul.appendChild(li);
            });
            listContainer.appendChild(ul);
        } else {
            listContainer.innerHTML = '<div class="p-2 text-muted small">Henüz tamamlanan sürüş yok.</div>';
        }

        // --- 2. ALT TABLO: AKTİF SÜRÜŞLER (SADECE bitis_zamani NULL OLANLAR) ---
        const tbody = document.getElementById('active-rentals-table').getElementsByTagName('tbody')[0];
        tbody.innerHTML = '';

        activeRentals.forEach(rental => { 
            let row = tbody.insertRow();
            row.insertCell().textContent = rental.arac_id; 
            let modelName = rental.kiralanan_arac ? rental.kiralanan_arac.replace(/\s*\(\d+\)$/, '') : "Bilinmiyor";
            row.insertCell().textContent = modelName;
            row.insertCell().textContent = rental.kiralayan_kullanici;
            row.insertCell().textContent = `${rental.sure_dakika || 0} dk`; 
            row.insertCell().textContent = rental.tahmini_fiyat || "0.00 TL"; 
        });

        // --- 3. SAĞ PANEL ALT: DÜŞÜK BATARYA ---
        document.getElementById('low-battery-count').textContent = lowBatteryVehicles.length;
        const lowBatteryListContainer = document.getElementById('low-battery-list-container');
        lowBatteryListContainer.innerHTML = ''; 

        if (lowBatteryVehicles.length > 0) {
            let listHtml = '<ul class="list-group list-group-flush mt-2">';
            lowBatteryVehicles.forEach(vehicle => {
                let cleanedModelName = vehicle.model ? vehicle.model.replace(/\s*\(\d+\)$/, '') : "Bilinmiyor";
                const batteryPct = Math.round(vehicle.batarya_seviyesi); 
                listHtml += `
                    <li class="list-group-item d-flex justify-content-between align-items-center p-1 bg-transparent" style="font-size: 0.9em;">
                        <div><strong>ID ${vehicle.arac_id}:</strong> ${cleanedModelName}</div>
                        <span class="badge badge-danger badge-pill">${batteryPct}%</span>
                    </li>`;
            });
            listHtml += '</ul>';
            lowBatteryListContainer.innerHTML = listHtml;
        } else {
            lowBatteryListContainer.innerHTML = '<div class="p-1 text-success small">Tüm araçlar şarjlı.</div>';
        }
        
    } catch (error) {
        console.error("Genel Rapor Yükleme Hatası:", error);
    }
}

// Uygulama Başlatma
loadVehicleMarkers();
loadDashboardData();
// Otomatik güncellemeleri başlat
setInterval(loadVehicleMarkers, 60000); 
setInterval(loadDashboardData, 30000);

