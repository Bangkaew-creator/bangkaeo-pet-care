import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
const defaultPlaceholder = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512' fill='%23A0B0C0'%3E%3Cpath d='M226.5 92.9c14.3 73-39.9 130-77.2 130-36.5 0-71.4-56.1-57.1-129.1C106.6 20.3 145.4-.1 184.8 0c36.7.1 27.2 19.8 41.7 92.9zm151.7-8.1c-14.3-73-53.1-93.5-89.8-93.5-39.4-.1-78.2 20.3-63.9 93.8 14.3 73 49.2 129.1 85.7 129.1 37.2.1 82.2-56.3 68-129.4zM448 176c-38.6 0-77.8 45.4-93.4 104.9-15.6 59.5-2.5 97.4 36.1 97.4 39.5 0 79-46.7 94.6-106.2C500.9 212.6 486.6 176 448 176zM157.4 280.9c-15.6-59.5-54.8-104.9-93.4-104.9-38.6 0-52.9 36.6-37.3 96.1 15.6 59.5 55.1 106.2 94.6 106.2 38.6.1 51.7-37.9 36.1-97.4zm168.1 48.7c-29.3-10.6-66.9-42.5-139.1-42.5-73.4 0-111 32.3-139.1 42.5-55.5 20.1-133.5 129-87.6 200.7C107.5 515.6 171.3 472 256 472c83.5 0 148.8 43.8 196.4 41.6 46.9-2.1 11.2-126-126.9-184z'/%3E%3C/svg%3E";

// ==========================================
// 2. เริ่มทำงานเมื่อเปิดหน้าเว็บ
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // ให้เปิดแท็บแรกเสมอ
    window.switchPublicTab = function(viewId, element) {
        document.querySelectorAll('.public-view').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.public-tab').forEach(el => el.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
        element.classList.add('active');
    };

    loadSystemConfig();
    loadPublicStats();
    setupStrayForm();
    loadLostPets(); // [เพิ่มใหม่] เรียกฟังก์ชันโหลดข้อมูลสัตว์หาย
});

// ดึงข้อมูลโลโก้และชื่อเทศบาล
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
        }
        document.getElementById("loading").style.display = "none";
        document.getElementById("public-container").style.display = "block";
    } catch(e) { console.error("Error loading config:", e); }
}

// ดึงข้อมูลสถิติประชากรสัตว์เลี้ยง
async function loadPublicStats() {
    try {
        let maxN = sysConfig ? (sysConfig.quota_neuter || 100) : 100;
        let maxV = sysConfig ? (sysConfig.quota_vaccine || 300) : 300;
        
        let curN = 0, curV = 0;
        let dogCount = 0, catCount = 0;

        const petsSnap = await getDocs(collection(db, "pets"));
        petsSnap.forEach(d => {
            const p = d.data();
            if(p.status === "cancelled" || p.status === "deceased" || p.status === "moved") return;
            
            if (p.status === "booked" || p.status === "checked_in") {
                if(p.service_type === "ทำหมันและวัคซีน") curN++;
                if(p.service_type === "วัคซีนอย่างเดียว") curV++;
            }

            if (p.pet_type === "สุนัข") dogCount++;
            if (p.pet_type === "แมว") catCount++;
        });

        document.getElementById("pb-neuter-text").textContent = `${curN} / ${maxN} คิว`;
        document.getElementById("pb-neuter-bar").style.width = `${Math.min((curN/maxN)*100, 100)}%`;
        
        document.getElementById("pb-vaccine-text").textContent = `${curV} / ${maxV} คิว`;
        document.getElementById("pb-vaccine-bar").style.width = `${Math.min((curV/maxV)*100, 100)}%`;

        document.getElementById("stat-dog").textContent = dogCount;
        document.getElementById("stat-cat").textContent = catCount;
        
    } catch(e) { console.error("Stats Error:", e); }
}

// ==========================================
// 3. ระบบกระดานประกาศสัตว์สูญหาย (Lost & Found)
// ==========================================
async function loadLostPets() {
    const container = document.getElementById("lost-pets-list");
    container.innerHTML = "<p style='color: #D4AF37; text-align: center; margin-bottom: 20px;'>กำลังโหลดข้อมูลประกาศ...</p>";

    try {
        // Query ดึงเฉพาะตัวที่มีสถานะ is_lost = true
        const q = query(collection(db, "pets"), where("is_lost", "==", true));
        const snap = await getDocs(q);

        if (snap.empty) {
            container.innerHTML = `
                <div style="background: rgba(0,0,0,0.2); border-radius: 10px; padding: 15px; margin-bottom: 15px; border: 1px dashed rgba(255,255,255,0.1); text-align: center;">
                    <div style="color: #50E3C2; font-size: 14px; margin-bottom: 5px; font-weight: bold;">ขณะนี้ไม่มีประกาศสัตว์สูญหาย</div>
                    <div style="color: #A0B0C0; font-size: 13px;">ขอให้เด็กๆ ทุกตัวปลอดภัยอยู่ในบ้านครับ 🏡</div>
                </div>`;
            return;
        }

        container.innerHTML = "";
        let count = 0;

        snap.forEach(d => {
            const pet = d.data();
            // เช็คซ้ำอีกรอบเผื่อตัวที่แจ้งตายไปแล้ว
            if (pet.status === "cancelled" || pet.status === "deceased") return; 
            count++;

            container.insertAdjacentHTML('beforeend', `
                <div style="background: rgba(0,0,0,0.2); border-radius: 10px; padding: 15px; margin-bottom: 15px; border-left: 5px solid #F5A623; display: flex; gap: 15px; align-items: center;">
                    <img src="${pet.pet_photo_base64 || defaultPlaceholder}" style="width: 80px; height: 80px; border-radius: 10px; object-fit: cover; border: 2px solid #F5A623; flex-shrink: 0; background: #1b2941;">
                    <div style="flex-grow: 1; text-align: left;">
                        <div style="color: #F5A623; font-size: 16px; font-weight: bold; margin-bottom: 2px;">น้อง${pet.pet_name}</div>
                        <div style="color: #E0E5EC; font-size: 12px; margin-bottom: 2px;">${pet.pet_type} ${pet.pet_gender} | พันธุ์: ${pet.breed || '-'}</div>
                        <div style="color: #A0B0C0; font-size: 12px; margin-bottom: 8px;">สี/ตำหนิ: ${pet.color || '-'}</div>
                        <div style="background: rgba(212, 175, 55, 0.1); padding: 5px 10px; border-radius: 5px; display: inline-block;">
                            <a href="tel:${pet.phone_number}" style="color: #D4AF37; font-size: 12px; font-weight: bold; text-decoration: none;">📞 โทรแจ้งเบาะแส: ${pet.phone_number}</a>
                        </div>
                    </div>
                </div>
            `);
        });

        if(count === 0) {
            container.innerHTML = `<div style="background: rgba(0,0,0,0.2); border-radius: 10px; padding: 15px; margin-bottom: 15px; border: 1px dashed rgba(255,255,255,0.1); text-align: center;"><div style="color: #50E3C2; font-size: 14px;">ขณะนี้ไม่มีประกาศสัตว์สูญหาย</div></div>`;
        }

    } catch (e) {
        console.error("Error loading lost pets:", e);
        container.innerHTML = "<p style='color: #ff6b6b; text-align: center;'>เกิดข้อผิดพลาดในการโหลดข้อมูล</p>";
    }
}

// ==========================================
// 4. ระบบแจ้งเบาะแสสัตว์จรจัด (Stray Report)
// ==========================================
function setupStrayForm() {
    // 4.1 ฟังก์ชันอัปโหลดและย่อขนาดรูปภาพ
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

    // 4.2 ฟังก์ชันดึงพิกัด GPS
    document.getElementById("btn-get-gps")?.addEventListener("click", () => {
        const btn = document.getElementById("btn-get-gps");
        const display = document.getElementById("gps-display");
        
        btn.textContent = "กำลังเชื่อมต่อดาวเทียม...";
        btn.disabled = true;

        if (!navigator.geolocation) {
            alert("อุปกรณ์ของคุณไม่รองรับการดึงพิกัด GPS");
            btn.textContent = "📍 กดเพื่อดึงพิกัดตำแหน่งปัจจุบันของคุณ";
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
                display.innerHTML = `✅ ได้รับพิกัดแล้ว<br>Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}<br><a href="https://maps.google.com/?q=${lat},${lng}" target="_blank" style="color:#D4AF37; text-decoration:underline;">ดูบนแผนที่ Google Maps</a>`;
                
                btn.textContent = "📍 อัปเดตพิกัดใหม่";
                btn.disabled = false;
            },
            (error) => {
                alert("ไม่สามารถดึงพิกัดได้ กรุณาเปิด GPS และอนุญาตให้เบราว์เซอร์เข้าถึงตำแหน่งที่ตั้ง (Location)");
                btn.textContent = "📍 กดเพื่อดึงพิกัดตำแหน่งปัจจุบันของคุณ";
                btn.disabled = false;
            },
            { enableHighAccuracy: true } 
        );
    });

    // 4.3 ฟังก์ชันบันทึกข้อมูลเข้าฐานข้อมูล Firestore
    document.getElementById("btn-submit-stray")?.addEventListener("click", async () => {
        const feederName = document.getElementById("stray-feeder-name").value.trim() || "ไม่ประสงค์ออกนาม";
        const feederPhone = document.getElementById("stray-feeder-phone").value.trim();
        const moo = document.getElementById("stray-moo").value;
        const landmark = document.getElementById("stray-location-desc").value.trim();
        const lat = document.getElementById("stray-lat").value;
        const lng = document.getElementById("stray-lng").value;
        const dogCount = parseInt(document.getElementById("stray-dog-count").value) || 0;
        const catCount = parseInt(document.getElementById("stray-cat-count").value) || 0;

        if(!feederPhone || !moo || !landmark || !lat || !lng) {
            return alert("กรุณากรอกเบอร์โทรศัพท์, หมู่ที่พบ, จุดสังเกต และกดดึงพิกัด GPS ให้ครบถ้วนครับ");
        }

        if(dogCount === 0 && catCount === 0) {
            return alert("กรุณาระบุจำนวนสุนัขหรือแมวที่พบอย่างน้อย 1 ตัวครับ");
        }

        const btnSubmit = document.getElementById("btn-submit-stray");
        btnSubmit.disabled = true; btnSubmit.textContent = "กำลังส่งข้อมูลเข้าศูนย์...";

        try {
            await addDoc(collection(db, "stray_reports"), {
                reporter_name: feederName,
                reporter_phone: feederPhone,
                moo: moo,
                landmark: landmark,
                lat: parseFloat(lat),
                lng: parseFloat(lng),
                dog_count: dogCount,
                cat_count: catCount,
                photo_base64: currentStrayBase64,
                status: "pending", 
                admin_action: "", 
                reported_at: serverTimestamp()
            });

            alert("ส่งข้อมูลแจ้งเบาะแสสำเร็จ! ขอบคุณที่ร่วมเป็นส่วนหนึ่งในการดูแลพื้นที่ตำบลบางแก้วครับ 🙏");
            
            document.getElementById("stray-feeder-name").value = "";
            document.getElementById("stray-feeder-phone").value = "";
            document.getElementById("stray-moo").selectedIndex = 0;
            document.getElementById("stray-location-desc").value = "";
            document.getElementById("stray-dog-count").value = "0";
            document.getElementById("stray-cat-count").value = "0";
            document.getElementById("gps-display").style.display = "none";
            document.getElementById("stray-lat").value = "";
            document.getElementById("stray-lng").value = "";
            document.getElementById("btn-get-gps").textContent = "📍 กดเพื่อดึงพิกัดตำแหน่งปัจจุบันของคุณ";
            currentStrayBase64 = "";
            
            document.getElementById("stray-img-preview").src = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512' fill='%23A0B0C0'%3E%3Cpath d='M448 80c8.8 0 16 7.2 16 16V415.8l-5-6.5-136-176c-4.5-5.9-11.6-9.3-19-9.3s-14.4 3.4-19 9.3L202 340.7l-30.5-42.7C167 291.7 159.8 288 152 288s-15 3.7-19.5 10.1l-80 112L48 416.3l0-.3V96c0-8.8 7.2-16 16-16H448zM64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H64zm80 192a48 48 0 1 0 0-96 48 48 0 1 0 0 96z'/%3E%3C/svg%3E";
            
            window.switchPublicTab('view-stats', document.querySelector('.public-tab'));
            
        } catch(e) {
            console.error(e);
            alert("เกิดข้อผิดพลาดในการส่งข้อมูล: " + e.message);
        } finally {
            btnSubmit.disabled = false; btnSubmit.textContent = "🚨 ส่งข้อมูลแจ้งเบาะแส";
        }
    });
}
