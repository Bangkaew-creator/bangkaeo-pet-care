import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
        // โควตา (อิงจาก sysConfig ถ้ามี หรือตั้งค่าเริ่มต้น 100/300)
        let maxN = sysConfig ? (sysConfig.quota_neuter || 100) : 100;
        let maxV = sysConfig ? (sysConfig.quota_vaccine || 300) : 300;
        
        let curN = 0, curV = 0;
        let dogCount = 0, catCount = 0;

        const petsSnap = await getDocs(collection(db, "pets"));
        petsSnap.forEach(d => {
            const p = d.data();
            if(p.status === "cancelled" || p.status === "deceased" || p.status === "moved") return;
            
            // นับสถิติยอดจองและการรับบริการจริง
            if (p.status === "booked" || p.status === "checked_in") {
                if(p.service_type === "ทำหมันและวัคซีน") curN++;
                if(p.service_type === "วัคซีนอย่างเดียว") curV++;
            }

            // นับสถิติประชากร (สุนัข/แมว ที่ยังมีชีวิตอยู่และอยู่ในระบบ)
            if (p.pet_type === "สุนัข") dogCount++;
            if (p.pet_type === "แมว") catCount++;
        });

        // อัปเดต UI Progress Bar ของโควตา
        document.getElementById("pb-neuter-text").textContent = `${curN} / ${maxN} คิว`;
        document.getElementById("pb-neuter-bar").style.width = `${Math.min((curN/maxN)*100, 100)}%`;
        
        document.getElementById("pb-vaccine-text").textContent = `${curV} / ${maxV} คิว`;
        document.getElementById("pb-vaccine-bar").style.width = `${Math.min((curV/maxV)*100, 100)}%`;

        // อัปเดต UI ประชากร
        document.getElementById("stat-dog").textContent = dogCount;
        document.getElementById("stat-cat").textContent = catCount;
        
    } catch(e) { console.error("Stats Error:", e); }
}

// ==========================================
// 3. ระบบแจ้งเบาะแสสัตว์จรจัด (Stray Report)
// ==========================================
function setupStrayForm() {
    // 3.1 ฟังก์ชันอัปโหลดและย่อขนาดรูปภาพ (ลดภาระฐานข้อมูล)
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

    // 3.2 ฟังก์ชันดึงพิกัด GPS (Geolocation API)
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
            { enableHighAccuracy: true } // ร้องขอพิกัดแม่นยำสูง
        );
    });

    // 3.3 ฟังก์ชันบันทึกข้อมูลเข้าฐานข้อมูล Firestore
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
            // สร้าง Collection ใหม่ชื่อ "stray_reports" สำหรับแยกข้อมูลสัตว์จรจัดโดยเฉพาะ
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
                status: "pending", // สถานะตั้งต้น: รอตรวจสอบ
                admin_action: "", // ช่องว่างสำหรับให้แอดมินมาอัปเดตผลการดำเนินงานทีหลัง
                reported_at: serverTimestamp()
            });

            alert("ส่งข้อมูลแจ้งเบาะแสสำเร็จ! ขอบคุณที่ร่วมเป็นส่วนหนึ่งในการดูแลพื้นที่ตำบลบางแก้วครับ 🙏");
            
            // รีเซ็ตฟอร์มกลับเป็นค่าเริ่มต้น
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
            
            // คืนค่ารูปภาพกลับเป็น Placeholder
            document.getElementById("stray-img-preview").src = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512' fill='%23A0B0C0'%3E%3Cpath d='M448 80c8.8 0 16 7.2 16 16V415.8l-5-6.5-136-176c-4.5-5.9-11.6-9.3-19-9.3s-14.4 3.4-19 9.3L202 340.7l-30.5-42.7C167 291.7 159.8 288 152 288s-15 3.7-19.5 10.1l-80 112L48 416.3l0-.3V96c0-8.8 7.2-16 16-16H448zM64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H64zm80 192a48 48 0 1 0 0-96 48 48 0 1 0 0 96z'/%3E%3C/svg%3E";
            
            // สลับกลับไปโชว์แท็บสถิติให้สวยงาม
            window.switchPublicTab('view-stats', document.querySelector('.public-tab'));
            
        } catch(e) {
            console.error(e);
            alert("เกิดข้อผิดพลาดในการส่งข้อมูล: " + e.message);
        } finally {
            btnSubmit.disabled = false; btnSubmit.textContent = "🚨 ส่งข้อมูลแจ้งเบาะแส";
        }
    });
}
