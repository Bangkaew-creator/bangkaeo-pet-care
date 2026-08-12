import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, serverTimestamp, query, where, getCountFromServer, getAggregateFromServer, sum } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 1. ตั้งค่า Firebase
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyCNsfEd11Yv2kNCO_T3s07WJ1eAXUyhssE",
    authDomain: "bangkaew-pet-db.firebaseapp.com",
    projectId: "bangkaew-pet-db",
    storageBucket: "bangkaew-pet-db.firebasestorage.app",
    messagingSenderId: "79581962937",
    appId: "1:79581962937:web:aed2a3297cf269afcc7168"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let sysConfig = null;
let currentStrayBase64 = "";
let map = null; 

const defaultPlaceholder = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512' fill='%23A0B0C0'%3E%3Cpath d='M226.5 92.9c14.3 73-39.9 130-77.2 130-36.5 0-71.4-56.1-57.1-129.1C106.6 20.3 145.4-.1 184.8 0c36.7.1 27.2 19.8 41.7 92.9zm151.7-8.1c-14.3-73-53.1-93.5-89.8-93.5-39.4-.1-78.2 20.3-63.9 93.8 14.3 73 49.2 129.1 85.7 129.1 37.2.1 82.2-56.3 68-129.4zM448 176c-38.6 0-77.8 45.4-93.4 104.9-15.6 59.5-2.5 97.4 36.1 97.4 39.5 0 79-46.7 94.6-106.2C500.9 212.6 486.6 176 448 176zM157.4 280.9c-15.6-59.5-54.8-104.9-93.4-104.9-38.6 0-52.9 36.6-37.3 96.1 15.6 59.5 55.1 106.2 94.6 106.2 38.6.1 51.7-37.9 36.1-97.4zm168.1 48.7c-29.3-10.6-66.9-42.5-139.1-42.5-73.4 0-111 32.3-139.1 42.5-55.5 20.1-133.5 129-87.6 200.7C107.5 515.6 171.3 472 256 472c83.5 0 148.8 43.8 196.4 41.6 46.9-2.1 11.2-126-126.9-184z'/%3E%3C/svg%3E";

// ==========================================
// 2. เริ่มทำงานเมื่อเปิดหน้าเว็บ
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    window.switchPublicTab = function(viewId, element) {
        document.querySelectorAll('.public-view').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.grid-menu-btn').forEach(el => el.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
        if(element) element.classList.add('active');

        if (viewId === 'view-stray' && map !== null) {
            setTimeout(() => { map.invalidateSize(); }, 200);
        }
    };

    loadSystemConfig();
    loadPublicStats();
    loadLostPets();
    setupStrayForm();
    initLeafletMapAndData(); 
});

async function loadSystemConfig() {
    try {
        const confSnap = await getDoc(doc(db, "system_config", "main_config"));
        if(confSnap.exists()) {
            sysConfig = confSnap.data();
            document.getElementById("txt-agency-name").textContent = sysConfig.agency_name || "หน่วยงาน";
            if (sysConfig.agency_logo_base64) {
                const logoImg = document.getElementById("public-agency-logo");
                if(logoImg) { logoImg.src = sysConfig.agency_logo_base64; logoImg.style.display = "block"; }
            }

            // [เพิ่มใหม่] อ่านค่า Theme และเปลี่ยนสีพื้นหลังให้ตรงกับที่แอดมินตั้ง
            if (sysConfig.theme && sysConfig.theme !== "default") {
                document.body.classList.add("theme-" + sysConfig.theme);
            }

            let mooCount = sysConfig.moo_count || 16;
            let mooSelect = document.getElementById("stray-moo");
            if(mooSelect) {
                let mooHtml = '<option value="" disabled selected>เลือกหมู่</option>';
                for(let i=1; i<=mooCount; i++) {
                    mooHtml += `<option value="${i}">หมู่ที่ ${i}</option>`;
                }
                mooSelect.innerHTML = mooHtml;
            }
        }
        document.getElementById("loading").style.display = "none";
        document.getElementById("public-container").style.display = "block";
    } catch(e) { console.error("Error config:", e); }
}

// [อัปเกรด] ดึงข้อมูลสถิติประชากรสัตว์เลี้ยงระดับตำบล (โหลดเร็วด้วย Aggregation)
async function loadPublicStats() {
    try {
        let maxN = sysConfig ? (sysConfig.quota_neuter || 100) : 100;
        let maxV = sysConfig ? (sysConfig.quota_vaccine || 300) : 300;
        let currentYear = sysConfig ? (sysConfig.current_vaccine_year || new Date().getFullYear() + 543) : 2569;
        const currentCamp = sysConfig ? (sysConfig.campaign_id || "") : "";
        
        let curN_booking = 0, curV_booking = 0; 
        let totalPets = 0;
        let totalNeutered = 0;
        let totalVaccinatedThisYear = 0;

        const petsRef = collection(db, "pets");

        // นับยอดรวมทั้งหมดแบบเร็ว
        const activePetsQ = query(petsRef, where("status", "!=", "cancelled")); 
        const snapshotTotal = await getCountFromServer(activePetsQ);
        totalPets = snapshotTotal.data().count;

        // หักลบตัวที่ตายและย้าย
        const deadQ = query(petsRef, where("status", "==", "deceased"));
        const deadSnap = await getCountFromServer(deadQ);
        const movedQ = query(petsRef, where("status", "==", "moved"));
        const movedSnap = await getCountFromServer(movedQ);
        totalPets = totalPets - deadSnap.data().count - movedSnap.data().count;

        // นับตัวทำหมัน
        const neuterQ = query(petsRef, where("neuter_status", "==", "ทำหมันแล้ว"));
        const neuterSnap = await getCountFromServer(neuterQ);
        totalNeutered = neuterSnap.data().count;

        // นับตัวที่วัคซีนปีปัจจุบัน
        const vacQ = query(petsRef, where("vaccine_year", "==", currentYear));
        const vacSnap = await getCountFromServer(vacQ);
        totalVaccinatedThisYear = vacSnap.data().count;

        // ดึงเฉพาะตัวที่มีจองคิวรอบปัจจุบันมานับ (ข้อมูลน้อย ไม่กี่ตัว)
        const bookedQ = query(petsRef, where("campaign_id", "==", currentCamp), where("status", "in", ["booked", "checked_in"]));
        const bookedDocs = await getDocs(bookedQ);
        bookedDocs.forEach(d => {
            const p = d.data();
            if(p.service_type === "ทำหมันและวัคซีน") curN_booking++;
            if(p.service_type === "วัคซีนอย่างเดียว") curV_booking++;
        });

        document.getElementById("stat-total-pets").textContent = totalPets;
        
        let neuterPercent = totalPets > 0 ? Math.round((totalNeutered / totalPets) * 100) : 0;
        document.getElementById("stat-neuter-percent").textContent = `${neuterPercent}%`;
        document.getElementById("stat-neuter-text").textContent = `(${totalNeutered} ตัว)`;

        let vacPercent = totalPets > 0 ? Math.round((totalVaccinatedThisYear / totalPets) * 100) : 0;
        document.getElementById("stat-vac-percent").textContent = `${vacPercent}%`;
        document.getElementById("stat-vac-text").textContent = `(${totalVaccinatedThisYear} ตัว)`;

        document.getElementById("pb-neuter-text").textContent = `${curN_booking} / ${maxN} คิว`;
        document.getElementById("pb-neuter-bar").style.width = `${Math.min((curN_booking/maxN)*100, 100)}%`;
        
        document.getElementById("pb-vaccine-text").textContent = `${curV_booking} / ${maxV} คิว`;
        document.getElementById("pb-vaccine-bar").style.width = `${Math.min((curV_booking/maxV)*100, 100)}%`;
        
    } catch(e) { console.error("Stats Error:", e); }
}

// ==========================================
// 3. ระบบกระดานประกาศสัตว์สูญหาย
// ==========================================
async function loadLostPets() {
    const container = document.getElementById("lost-pets-list");
    try {
        const q = query(collection(db, "pets"), where("is_lost", "==", true));
        const snap = await getDocs(q);

        if (snap.empty) {
            container.innerHTML = `<div style="background: var(--bg-overlay); border-radius: 10px; padding: 15px; text-align: center;"><div style="color: var(--accent-success); font-size: 14px;">ขณะนี้ไม่มีประกาศสัตว์สูญหาย</div></div>`;
            return;
        }

        container.innerHTML = "";
        snap.forEach(d => {
            const pet = d.data();
            if (pet.status === "cancelled" || pet.status === "deceased") return; 

            container.insertAdjacentHTML('beforeend', `
                <div style="background: var(--bg-overlay); border-radius: 10px; padding: 15px; margin-bottom: 15px; border-left: 5px solid var(--accent-warning); display: flex; gap: 15px; align-items: center;">
                    <img src="${pet.pet_photo_base64 || defaultPlaceholder}" style="width: 80px; height: 80px; border-radius: 10px; object-fit: cover; border: 2px solid var(--accent-warning); flex-shrink: 0; background: var(--bg-card);">
                    <div style="flex-grow: 1; text-align: left;">
                        <div style="color: var(--accent-warning); font-size: 16px; font-weight: bold; margin-bottom: 2px;">น้อง${pet.pet_name}</div>
                        <div style="color: var(--text-main); font-size: 12px; margin-bottom: 2px;">${pet.pet_type} ${pet.pet_gender} | พันธุ์: ${pet.breed || '-'}</div>
                        <div style="background: var(--bg-overlay-light); padding: 5px 10px; border-radius: 5px; display: inline-block; margin-top: 5px; border: 1px solid var(--border-muted);">
                            <a href="tel:${pet.phone_number}" style="color: var(--accent-primary); font-size: 12px; font-weight: bold; text-decoration: none;">📞 โทรแจ้งเบาะแส: ${pet.phone_number}</a>
                        </div>
                    </div>
                </div>
            `);
        });
    } catch (e) { console.error("Error lost pets:", e); }
}

// ==========================================
// 4. ระบบแจ้งเบาะแสสัตว์จรจัด (Leaflet Map)
// ==========================================
async function initLeafletMapAndData() {
    map = L.map('stray-map').setView([13.6300, 100.6650], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);

    const listContainer = document.getElementById("public-stray-list");
    
    try {
        const snap = await getDocs(collection(db, "stray_reports"));
        if (snap.empty) {
            listContainer.innerHTML = "<p style='text-align: center; color: var(--text-muted); font-size: 12px;'>ยังไม่มีข้อมูลเบาะแสในพื้นที่</p>";
            return;
        }

        listContainer.innerHTML = "";
        
        const redIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });
        const greenIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });

        let hasData = false;
        snap.forEach(d => {
            const r = d.data();
            if(!r.lat || !r.lng) return;
            hasData = true;

            const isDone = r.status === "completed";
            const badge = isDone ? `<span class="stray-badge-done">✅ ลงพื้นที่แล้ว</span>` : `<span class="stray-badge-pending">🔴 รอดำเนินการ</span>`;
            const iconToUse = isDone ? greenIcon : redIcon;

            L.marker([r.lat, r.lng], {icon: iconToUse})
             .addTo(map)
             .bindPopup(`<b>หมู่ ${r.moo}</b><br>${r.landmark}<br>สุนัข ${r.dog_count} | แมว ${r.cat_count}<br>${badge}`);

            listContainer.insertAdjacentHTML('beforeend', `
                <div class="stray-list-item">
                    <div>
                        <div style="font-weight: bold; color: var(--accent-primary);">📍 หมู่ ${r.moo} (${r.location_category || 'อื่นๆ'})</div>
                        <div style="color: var(--text-muted); font-size: 11px;">${r.landmark} | 🐕 ${r.dog_count}, 🐈 ${r.cat_count}</div>
                    </div>
                    <div>${badge}</div>
                </div>
            `);
        });

        if(!hasData) listContainer.innerHTML = "<p style='text-align: center; color: var(--text-muted); font-size: 12px;'>ยังไม่มีข้อมูลเบาะแสในพื้นที่</p>";

    } catch (e) {
        console.error("Error loading stray map:", e);
        listContainer.innerHTML = "<p style='color: var(--accent-danger);'>โหลดข้อมูลล้มเหลว</p>";
    }
}

function setupStrayForm() {
    document.getElementById("stray-img-upload")?.addEventListener("change", (e) => {
        const file = e.target.files[0]; if(!file) return;
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement("canvas");
                const MAX_WIDTH = 600; let width = img.width; let height = img.height;
                if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
                else { if (height > MAX_WIDTH) { width *= MAX_WIDTH / height; height = MAX_WIDTH; } }
                canvas.width = width; canvas.height = height;
                canvas.getContext("2d").drawImage(img, 0, 0, width, height);
                currentStrayBase64 = canvas.toDataURL("image/jpeg", 0.7);
                document.getElementById("stray-img-preview").src = currentStrayBase64;
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    document.getElementById("btn-get-gps")?.addEventListener("click", () => {
        const btn = document.getElementById("btn-get-gps");
        const display = document.getElementById("gps-display");
        btn.textContent = "กำลังเชื่อมต่อดาวเทียม...";
        btn.disabled = true;

        if (!navigator.geolocation) {
            alert("อุปกรณ์ของคุณไม่รองรับการดึงพิกัด GPS");
            btn.textContent = "📍 กดเพื่อดึงพิกัดตำแหน่งของคุณ";
            btn.disabled = false;
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                document.getElementById("stray-lat").value = lat;
                document.getElementById("stray-lng").value = lng;
                display.style.display = "block";
                display.innerHTML = `✅ ได้รับพิกัดแล้ว<br>Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
                btn.textContent = "📍 อัปเดตพิกัดใหม่";
                btn.disabled = false;
            },
            (error) => {
                alert("ไม่สามารถดึงพิกัดได้ กรุณาเปิด GPS และอนุญาตให้เบราว์เซอร์เข้าถึงตำแหน่งที่ตั้ง");
                btn.textContent = "📍 กดเพื่อดึงพิกัดตำแหน่งของคุณ";
                btn.disabled = false;
            },
            { enableHighAccuracy: true } 
        );
    });

    document.getElementById("btn-submit-stray")?.addEventListener("click", async () => {
        const feederName = document.getElementById("stray-feeder-name").value.trim() || "ไม่ประสงค์ออกนาม";
        const feederPhone = document.getElementById("stray-feeder-phone").value.trim();
        const feederIdCard = document.getElementById("stray-feeder-idcard").value.trim(); 
        const moo = document.getElementById("stray-moo").value;
        const locCategory = document.getElementById("stray-loc-category").value; 
        const landmark = document.getElementById("stray-location-desc").value.trim();
        const lat = document.getElementById("stray-lat").value;
        const lng = document.getElementById("stray-lng").value;
        const dogCount = parseInt(document.getElementById("stray-dog-count").value) || 0;
        const catCount = parseInt(document.getElementById("stray-cat-count").value) || 0;

        if(!feederPhone || !moo || !locCategory || !landmark || !lat || !lng) {
            return alert("กรุณากรอกเบอร์โทร, หมู่, หมวดหมู่สถานที่, จุดสังเกต และกดดึงพิกัด GPS ให้ครบถ้วนครับ");
        }
        if(dogCount === 0 && catCount === 0) {
            return alert("กรุณาระบุจำนวนสุนัขหรือแมวที่พบอย่างน้อย 1 ตัวครับ");
        }

        const btnSubmit = document.getElementById("btn-submit-stray");
        btnSubmit.disabled = true; btnSubmit.textContent = "กำลังส่งข้อมูลเข้าศูนย์...";

        try {
            await addDoc(collection(db, "stray_reports"), {
                reporter_name: feederName, reporter_phone: feederPhone, reporter_id_card: feederIdCard, 
                moo: moo, location_category: locCategory, landmark: landmark,
                lat: parseFloat(lat), lng: parseFloat(lng),
                dog_count: dogCount, cat_count: catCount,
                dog_vac_done: 0, dog_neu_done: 0, cat_vac_done: 0, cat_neu_done: 0,
                photo_base64: currentStrayBase64, status: "pending", 
                reported_at: serverTimestamp()
            });

            alert("ส่งข้อมูลแจ้งเบาะแสสำเร็จ! ขอบคุณที่ร่วมดูแลชุมชนครับ 🙏");
            location.reload(); 
        } catch(e) {
            console.error(e);
            alert("เกิดข้อผิดพลาดในการส่งข้อมูล: " + e.message);
            btnSubmit.disabled = false; btnSubmit.textContent = "🚨 ส่งข้อมูลแจ้งเบาะแส";
        } 
    });
}
