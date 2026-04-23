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



// Modal kapatma ve verileri yenile fonksiyonu
function closeEndRentalModal() {
    console.log('closeEndRentalModal çağrıldı');
    $('#endRentalSuccessModal').modal('hide');
    console.log('Modal gizlendi');
    setTimeout(() => {
        console.log('Veriler yenileniyor...');
        loadDashboardData();
        loadVehicleMarkers();
    }, 100);
}

// Aktif kiralama bitirme - Modal göster
let pendingRentalData = null; // Global değişken - onay modalında kullanacağız

function endRental(kiralamaId, aracId, sureDakika) {
    pendingRentalData = { kiralamaId, aracId };
    
    // Modal'da bilgileri göster
    document.getElementById('confirm-kiralama-id').textContent = kiralamaId;
    document.getElementById('confirm-sure-dakika').textContent = `${sureDakika} dakika`;
    
    // Modal'ı aç
    $('#confirmEndRentalModal').modal('show');
}

// Onay modalından "Evet, Bitir" butonuna basma
function confirmEndRental() {
    if (!pendingRentalData) return;
    
    const { kiralamaId, aracId } = pendingRentalData;
    
    fetch(`${API_URL}/kiralamalar/bitir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kiralamaId: parseInt(kiralamaId), aracId: parseInt(aracId) })
    })
    .then(res => {
        if (!res.ok) throw new Error(`Hata: ${res.status}`);
        return res.json();
    })
    .then(data => {
        console.log('Kiralama başarıyla bitirildi:', data);
        $('#confirmEndRentalModal').modal('hide');
        
        // Başarı modal'ını doldur ve göster
        document.getElementById('end-kiralama-id').textContent = data.kiralamaId;
        document.getElementById('end-sure-dakika').textContent = `${data.sureDakika} dakika`;
        $('#endRentalSuccessModal').modal('show');
        
        pendingRentalData = null;
    })
    .catch(err => {
        console.error('Kiralama bitirme hatası:', err);
        alert('Kiralama bitirilirken hata oluştu: ' + err.message);
    });
}

// Kiralama Onayı - VERİTABANINA KAYDET
function confirmRentalModal() {
    const aracId = document.getElementById('modal-arac-id').textContent;
    let userName = document.getElementById('modal-user-name').value.trim();
    let userEmail = document.getElementById('modal-user-email').value.trim();
    let userPhone = document.getElementById('modal-user-phone').value.trim();

    // 1. İsim kontrolü
    if (!userName) {
        alert('Lütfen kullanıcı adınızı giriniz.');
        return;
    }
    
    // 2. Email kontrolü
    if (!userEmail) {
        alert('Lütfen e-mail adresinizi giriniz.');
        return;
    }
    
    // Email'i @gmail.com ekleyerek tamamla
    userEmail = userEmail + '@gmail.com';
    
    // 3. Telefon kontrolü
    if (!userPhone) {
        alert('Lütfen telefon numaranızı giriniz.');
        return;
    }
    
    // Telefon formatı: 0551 XXX XX XX (11 rakam olmalı)
    const phoneDigits = userPhone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
        alert('Lütfen geçerli bir telefon numarası giriniz (10 rakam).');
        return;
    }
    
    // Telefonu 0551 XXX XX XX formatında düzenle
    const formattedPhone = '0551' + phoneDigits;
    
    // 4. İsimin ilk harflerini büyük yap (Ad Soyad)
    const nameParts = userName.split(' ').filter(part => part.length > 0);
    const capitalizedName = nameParts.map(part => 
        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    ).join(' ');

    // VERİTABANINA KAYDET
    fetch(`${API_URL}/kiralamalar/baslat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            aracId: parseInt(aracId), 
            userName: capitalizedName, 
            userEmail: userEmail, 
            userPhone: formattedPhone 
        })
    })
    .then(res => {
        if (!res.ok) throw new Error(`Hata: ${res.status}`);
        return res.json();
    })
    .then(data => {
        console.log('Kiralama başarıyla kaydedildi:', data);
        // Modal'ı kapat
        $('#rentalModal').modal('hide');
        document.getElementById('modal-user-name').value = '';
        document.getElementById('modal-user-email').value = '';
        document.getElementById('modal-user-phone').value = '';
        
        // Success modal'ı doldur ve göster
        const now = new Date();
        const timeString = now.toLocaleString('tr-TR');
        
        document.getElementById('success-kiralama-id').textContent = data.kiralamaId;
        document.getElementById('success-arac-id').textContent = aracId;
        document.getElementById('success-user-name').textContent = capitalizedName;
        document.getElementById('success-user-email').textContent = userEmail;
        document.getElementById('success-user-phone').textContent = formattedPhone;
        document.getElementById('success-start-time').textContent = timeString;
        
        // Success modal'ı göster
        $('#successModal').modal('show');
        
        // 2 saniye sonra modal'ı kapat ve verileri yenile
        setTimeout(() => {
            $('#successModal').modal('hide');
            loadDashboardData();
            loadVehicleMarkers();
        }, 2000);
    })
    .catch(err => {
        console.error('Kiralama kaydetme hatası:', err);
        alert('Kiralama kaydedilirken hata oluştu: ' + err.message);
    });
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
            
            // Bitir butonu ekle
            const actionCell = row.insertCell();
            const endButton = document.createElement('button');
            endButton.className = 'btn btn-sm btn-danger';
            endButton.textContent = 'Bitir';
            endButton.style.borderRadius = '6px';
            endButton.style.padding = '4px 8px';
            endButton.style.fontSize = '0.85rem';
            endButton.onclick = () => endRental(rental.kiralama_id, rental.arac_id, rental.sure_dakika);
            actionCell.appendChild(endButton);
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
document.getElementById('modal-user-name').addEventListener('input', function (e) {
    let value = e.target.value;
    
    // Her kelimenin ilk harfini büyük, diğerlerini küçük yap
    let formattedValue = value.split(' ').map(word => {
        if (word.length > 0) {
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }
        return word;
    }).join(' ');

    // Kursör pozisyonunu kaybetmemek için güncelliyoruz
    e.target.value = formattedValue;
});

// Sayfa veya Modal yüklendiğinde çalışması için garantiye alıyoruz
document.addEventListener('input', function (e) {
    
    // Sadece hedef input "modal-user-email" ise çalış
    if (e.target && e.target.id === 'modal-user-email') {
        const emailInput = e.target;
        const quickList = document.getElementById('email-quick-list');
        const domains = ['@gmail.com', '@hotmail.com', '@outlook.com', '@icloud.com'];
        
        const val = emailInput.value;
        quickList.innerHTML = ''; // Her yazımda listeyi temizle

        // Eğer kullanıcı bir şeyler yazdıysa ve henüz @ koymadıysa butonları çıkar
        if (val.length > 0 && !val.includes('@')) {
            domains.forEach(domain => {
                const btn = document.createElement('button');
                btn.type = 'button';
                // Bootstrap sınıfları ve ekstra stil
                btn.className = 'btn btn-sm btn-outline-primary';
                btn.style.borderRadius = '20px';
                btn.style.fontSize = '12px';
                btn.style.padding = '2px 10px';
                btn.innerText = domain;

                // Tıklama olayı
                btn.onmousedown = function(event) {
                    event.preventDefault(); // Input'tan odağın kaçmasını engeller
                    emailInput.value = val + domain;
                    quickList.innerHTML = '';
                };
                
                quickList.appendChild(btn);
            });
        }
    }
});

// Input'tan çıkıldığında butonları temizle (Blur yerine mousedown kullandığımız için güvenli)
document.addEventListener('focusout', function(e) {
    if (e.target.id === 'modal-user-email') {
        // Kısa bir gecikme veriyoruz ki mousedown işlemi tamamlanabilsin
        setTimeout(() => {
            const qList = document.getElementById('email-quick-list');
            if(qList) qList.innerHTML = '';
        }, 200);
    }
});
// E-posta inputunu seçelim
const emailInput = document.getElementById('modal-user-email');

emailInput.addEventListener('keydown', function(e) {
    // 1. Kullanıcı boşluk tuşuna (Space) bastığı anda engelle
    if (e.key === " " || e.keyCode === 32) {
        e.preventDefault();
        return false;
    }
});

emailInput.addEventListener('input', function(e) {
    // 2. Eğer kullanıcı boşluk içeren bir metni yapıştırırsa boşlukları anında temizle
    let value = e.target.value;
    if (value.includes(" ")) {
        e.target.value = value.replace(/\s/g, "");
    }
    
    // ... Burada senin önceki e-posta tamamlama (buton gösterme) kodların devam edebilir ...
});


const phoneInput = document.getElementById('modal-user-phone');

phoneInput.addEventListener('input', function (e) {
    // 1. Sadece rakamları al ve maksimum 11 hane ile sınırla
    let input = e.target.value.replace(/\D/g, '');
    
    // 2. İlk rakam 0 değilse başına 0 ekle
    if (input.length > 0 && input[0] !== '0') {
        input = '0' + input;
    }
    
    // 3. Maksimum 11 karakteri geçmesin (05xx xxx xx xx = 11 hane)
    input = input.substring(0, 11);

    // 4. Formatlama mantığı
    let size = input.length;
    let formatted = "";

    if (size > 0) {
        // İlk grup: (0XXX
        formatted += "(" + input.substring(0, 4);
    }
    if (size >= 5) {
        // Parantezi kapat ve ikinci grubu ekle: (0XXX) XXX
        formatted += ") " + input.substring(4, 7);
    }
    if (size >= 8) {
        // Tire ekle ve üçüncü grubu ekle: (0XXX) XXX-XX
        formatted += "-" + input.substring(7, 9);
    }
    if (size >= 10) {
        // Son tireyi ekle ve son grubu ekle: (0XXX) XXX-XX-XX
        formatted += "-" + input.substring(9, 11);
    }

    // 5. Değeri inputa geri gönder
    e.target.value = formatted;
});

// Silme yaparken parantez veya tireye takılmayı önleyen akıllı silme
phoneInput.addEventListener('keydown', function(e) {
    const val = e.target.value;
    if (e.key === 'Backspace') {
        // Eğer silinen karakter format karakteriyse bir önceki rakamı da sil
        if (val.endsWith(' ') || val.endsWith('-') || val.endsWith('(')) {
            // Hiçbir şey yapma, input event'i zaten rakamı silince formatı düzeltecek
        }
    }
});
// Uygulama Başlatma
loadVehicleMarkers();
loadDashboardData();

// endRentalSuccessModal kapandığında verileri yenile
$('#endRentalSuccessModal').on('hidden.bs.modal', function () {
    loadDashboardData();
    loadVehicleMarkers();
});
// Otomatik güncellemeleri başlat
setInterval(loadVehicleMarkers, 60000); 
setInterval(loadDashboardData, 30000);

