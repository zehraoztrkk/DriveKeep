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
            width: 30px; 
            height: 30px; 
            border-radius: 50%;
            border: 2px solid white; 
            text-align: center;
            line-height: 28px;
            font-size: 16px; 
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
        iconSize: [30, 30], 
        popupAnchor: [0, -15] 
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

// Kiralama Onayı (Simülasyon)
function confirmRental(aracId) {
    const userName = document.getElementById('rentalUser').value || 'Anonim Kullanıcı';
    alert(`Kiralama Başlatıldı!\nAraç: ID ${aracId}\nKullanıcı: ${userName}`);
    
    map.closePopup();
    // Veriler değiştiği için harita ve dashboard yenilenmeli
    loadVehicleMarkers(); 
    loadDashboardData(); 
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
    const activeRentalsPromise = fetch(`${API_URL}/kiralamalar/aktif`).then(res => res.json()).catch(err => { console.error("Aktif Kiralama API Hatası:", err); return []; });
    const lowBatteryPromise = fetch(`${API_URL}/bakim/dusuk-batarya`).then(res => res.json()).catch(err => { console.error("Düşük Batarya API Hatası:", err); return []; });

    try {
        const [activeRentals, lowBatteryVehicles] = await Promise.all([activeRentalsPromise, lowBatteryPromise]);

        // KART BİLGİLERİ GÜNCELLEMESİ (SAYILAR)
        document.getElementById('active-rentals-count').textContent = Array.isArray(activeRentals) ? activeRentals.length : 0;
        document.getElementById('low-battery-count').textContent = Array.isArray(lowBatteryVehicles) ? lowBatteryVehicles.length : 0;
        
        // AKTİF KİRALAMALAR TABLOSU GÜNCELLEMESİ (ID Sütunu)
        const tbody = document.getElementById('active-rentals-table').getElementsByTagName('tbody')[0];
        tbody.innerHTML = '';
        
        if (Array.isArray(activeRentals)) {
            activeRentals.forEach(rental => { 
                let row = tbody.insertRow();
                
                // 1. SÜTUN: Araç ID
                row.insertCell().textContent = rental.arac_id; 
                
                // 2. SÜTUN: Araç Modeli (Temizlik uygulanıyor)
                let modelName = rental.kiralanan_arac;
                if (/\(\d+\)$/.test(modelName)) { // Eğer model adında parantez içinde ID varsa onu sil
                    modelName = modelName.replace(/\s*\(\d+\)$/, ''); 
                }
                row.insertCell().textContent = modelName;
                
                // 3. SÜTUN: Kiralayan Kullanıcı
                row.insertCell().textContent = rental.kiralayan_kullanici;
                
                // 4. SÜTUN: Süre (Dakika)
                row.insertCell().textContent = `${rental.sure_dakika} dk`; 
                
                // 5. SÜTUN: Tahmini Fiyat
                row.insertCell().textContent = rental.tahmini_fiyat; 
            });
        }
        
        // --- AKTİF KİRALAMA DETAY LİSTESİ OLUŞTURULMASI (Tüm Araçlar İçin - MODEL TEMİZLİĞİ EKLENDİ) ---
        const activeRentalListContainer = document.getElementById('active-rental-list-container');
        let activeRentalDetailList = document.getElementById('active-rental-detail-list');

        if (activeRentalListContainer) {
            if (!activeRentalDetailList) {
                activeRentalDetailList = document.createElement('ul');
                activeRentalDetailList.id = 'active-rental-detail-list';
                activeRentalDetailList.className = 'list-group list-group-flush mt-2';
                activeRentalListContainer.appendChild(activeRentalDetailList);
            }

            activeRentalDetailList.innerHTML = ''; 

            if (Array.isArray(activeRentals) && activeRentals.length > 0) {
                // Tüm aktif kiralamaları listele
                activeRentals.forEach(rental => {
                    
                    // KRİTİK TEMİZLİK: Parantez içindeki ID'yi model adından kaldırıyoruz.
                    let cleanedModelName = rental.kiralanan_arac;
                    if (/\s*\(\d+\)$/.test(cleanedModelName)) {
                        cleanedModelName = cleanedModelName.replace(/\s*\(\d+\)$/, ''); 
                    }
                    
                    const listItem = document.createElement('li');
                    listItem.className = 'list-group-item d-flex justify-content-between align-items-center p-1 bg-transparent';
                    listItem.style.fontSize = '0.9em';
                    
                    // ID, TEMİZLENMİŞ MODEL ve Kullanıcı
                    listItem.innerHTML = `
                        <div>
                            <strong>ID ${rental.arac_id}:</strong> ${cleanedModelName} 
                        </div>
                        <span>Kiralayan: ${rental.kiralayan_kullanici}</span>
                    `;
                    activeRentalDetailList.appendChild(listItem);
                });
            } else {
                const listItem = document.createElement('li');
                listItem.className = 'list-group-item p-1 bg-transparent text-primary';
                listItem.textContent = 'Şu anda aktif kiralama bulunmamaktadır.';
                activeRentalDetailList.appendChild(listItem);
            }
        }
        // --- AKTİF KİRALAMA DETAY LİSTESİ SONU ---

        
        // --- DÜŞÜK BATARYA DETAY LİSTESİ OLUŞTURULMASI (SADELEŞTİRİLMİŞ & TEMİZLENMİŞ VERSİYON) ---
        const lowBatteryListContainer = document.getElementById('low-battery-list-container');

        if (lowBatteryListContainer) {
            // Geçici olarak listeyi doğrudan HTML konteyneri içine yazıyoruz
            lowBatteryListContainer.innerHTML = ''; 

            if (Array.isArray(lowBatteryVehicles) && lowBatteryVehicles.length > 0) {
                
                let listHtml = '<ul class="list-group list-group-flush mt-2">';
                
                // TÜM DÜŞÜK BATARYALI ARAÇLARI LİSTELEMEK İÇİN
                lowBatteryVehicles.forEach(vehicle => {
                    
                    // KRİTİK TEMİZLİK: Parantez içindeki ID'yi model adından kaldırıyoruz.
                    let cleanedModelName = vehicle.model;
                    if (/\s*\(\d+\)$/.test(cleanedModelName)) {
                        cleanedModelName = cleanedModelName.replace(/\s*\(\d+\)$/, ''); 
                    }
                    
                    // Batarya yüzdesini direkt tam sayı olarak alıyoruz
                    const batteryPct = Math.round(vehicle.batarya_seviyesi); 
                    
                    listHtml += `
                        <li class="list-group-item d-flex justify-content-between align-items-center p-1 bg-transparent" style="font-size: 0.9em;">
                            <div>
                                <strong>ID ${vehicle.arac_id}:</strong> ${cleanedModelName}
                            </div>
                            <span class="badge badge-danger badge-pill">${batteryPct}%</span>
                        </li>
                    `;
                });
                
                listHtml += '</ul>';
                lowBatteryListContainer.innerHTML = listHtml; // HTML'i tek seferde yazıyoruz
                
            } else {
                // Düşük bataryalı araç yoksa gösterilecek mesaj
                lowBatteryListContainer.innerHTML = `
                    <div class="list-group mt-2">
                        <li class="list-group-item p-1 text-success" style="font-size: 0.9em;">Tüm scooterlar yeterli şarja sahip.</li>
                    </div>
                `;
            }
        }
        // --- DÜŞÜK BATARYA DETAY LİSTESİ SONU ---
        
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