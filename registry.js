import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, getDoc, updateDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
const LIFF_ID = "2010813512-UqwFMq5V"; // ใช้ LIFF ID เดิมได้เลย

let userProfileData = null;
let currentHouseholdKey = "";
let currentPetBase64 = ""; // เก็บรูปภาพ

document.addEventListener("DOMContentLoaded", () => {
    initializeLiff();
    setupHouseholdForm();
    setupPetForm();
});

// ==========================================
// 2. LIFF & โหลดข้อมูลผู้ใช้
// ==========================================
async function initializeLiff() {
    try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) liff.login();
        else {
            userProfileData = await liff.getProfile();
            document.getElementById("user-profile-img").src = userProfileData.pictureUrl;
            document.getElementById("user-profile-img").style.display = "block";
            checkUserData();
        }
    } catch (err) { console.error("LIFF Init Error", err); }
}

async function checkUserData() {
    try {
        const userSnap = await getDoc(doc(db, "users", userProfileData.userId));
        document.getElementById("loading").style.display = "none";
        
        if (userSnap.exists()) {
            // ถ้าเคยลงทะเบียนบ้านแล้ว ให้ข้ามไปหน้าแดชบอร์ดเลย (ดึงข้อมูลมาลิงก์กันอัตโนมัติ)
            const u = userSnap.data();
            currentHouseholdKey = `${u.house_no}-${u.village_no}`;
            document.getElementById("display-household-info").textContent = `บ้านเลขที่ ${u.house_no} หมู่ ${u.village_no}`;
            
            document.getElementById("dashboard-container").style.display = "block";
            loadMyPets(); // โหลดรายการสัตว์เลี้ยง
        } else {
            // ถ้าเพิ่งเข้าครั้งแรก ให้กรอกข้อมูลบ้านเลขที่
            document.getElementById("household-setup-container").style.display = "block";
        }
    } catch (error) { console.error("Error", error); }
}

// ==========================================
// 3. ระบบยืนยันที่อยู่อาศัย (หน้าแรก)
// ==========================================
function setupHouseholdForm() {
    // จัดการ Checkbox หอพัก
    document.getElementById("hh-is-rental").addEventListener("change", (e) => {
        document.getElementById("hh-room-group").style.display = e.target.checked ? "block" : "none";
    });

    document.getElementById("btn-register-household").addEventListener("click", async () => {
        const name = document.getElementById("hh-name").value;
        const phone = document.getElementById("hh-phone").value;
        const hNo = document.getElementById("hh-house-no").value;
        const vNo = document.getElementById("hh-village-no").value;
        const isRental = document.getElementById("hh-is-rental").checked;
        const roomNo = document.getElementById("hh-room-no").value;

        if(!name || !phone || !hNo || !vNo) return alert("กรุณากรอกข้อมูลให้ครบถ้วน");

        const btn = document.getElementById("btn-register-household");
        btn.disabled = true; btn.textContent = "กำลังบันทึก...";

        try {
            await setDoc(doc(db, "users", userProfileData.userId), {
                owner_name: name,
                phone_number: phone,
                house_no: hNo,
                village_no: vNo,
                is_rental: isRental,
                room_no: isRental ? roomNo : "",
                line_displayName: userProfileData.displayName,
                updated_at: serverTimestamp()
            });

            // พาไปหน้าแดชบอร์ด
            currentHouseholdKey = `${hNo}-${vNo}`;
            document.getElementById("display-household-info").textContent = `บ้านเลขที่ ${hNo} หมู่ ${vNo}`;
            
            document.getElementById("household-setup-container").style.display = "none";
            document.getElementById("dashboard-container").style.display = "block";
            loadMyPets();
        } catch (e) {
            console.error(e); alert("เกิดข้อผิดพลาด");
        } finally { btn.disabled = false; btn.textContent = "ยืนยันข้อมูล ➔"; }
    });
}

// ==========================================
// 4. โหลดข้อมูลสัตว์เลี้ยง (แดชบอร์ด & สถานะวัคซีน)
// ==========================================
async function loadMyPets() {
    const container = document.getElementById("pet-cards-container");
    container.innerHTML = "<p style='color: #D4AF37; text-align: center;'>กำลังโหลดข้อมูลสัตว์เลี้ยง...</p>";

    try {
        // ดึงข้อมูลสัตว์เลี้ยงทั้งหมดที่ผูกกับบ้านเลขที่นี้ (ดึงของเก่าจากระบบทำหมันมาแสดงด้วย!)
        const q = query(collection(db, "pets"), where("house_village_search", "==", currentHouseholdKey));
        const snap = await getDocs(q);
        
        container.innerHTML = "";
        let count = 0;

        // หาปีปัจจุบันของระบบ เพื่อใช้คำนวณสถานะวัคซีน (ตั้งค่าเริ่มต้นเป็น 2569 ถ้าแอดมินยังไม่เซ็ต)
        const configDoc = await getDoc(doc(db, "system_config", "main_config"));
        let currentVaccineYear = 2569; 
        if (configDoc.exists() && configDoc.data().current_vaccine_year) {
            currentVaccineYear = parseInt(configDoc.data().current_vaccine_year);
        }

        snap.forEach(d => {
            const pet = d.data();
            // ข้ามสัตว์ที่ถูก Soft Delete หรือยกเลิกไปแล้ว
            if(pet.status === "cancelled" || pet.status === "deceased" || pet.status === "moved") return;
            count++;

            // ตรรกะคำนวณสถานะวัคซีน (Color-coded)
            let vacBadge = "";
            let vacYear = parseInt(pet.vaccine_year || 0);

            if (vacYear === currentVaccineYear) {
                vacBadge = `<span class="vaccine-badge badge-green">🟢 ฉีดวัคซีนแล้ว (ปี ${vacYear})</span>`;
            } else if (vacYear === currentVaccineYear - 1) {
                vacBadge = `<span class="vaccine-badge badge-yellow">🟡 ใกล้ถึงกำหนดฉีดซ้ำ (ล่าสุดปี ${vacYear})</span>`;
            } else {
                vacBadge = `<span class="vaccine-badge badge-red">🔴 ขาดการต่อวัคซีน</span>`;
            }

            // รูปภาพสัตว์เลี้ยง (ถ้าไม่มีให้ใช้ Placeholder)
            const imgUrl = pet.pet_photo_base64 || "https://via.placeholder.com/150?text=Pet";

            container.insertAdjacentHTML('beforeend', `
                <div class="pet-card">
                    <img src="${imgUrl}" class="pet-photo" alt="${pet.pet_name}">
                    <div class="pet-info">
                        <div class="pet-name">${pet.pet_name}</div>
                        <div style="font-size: 13px;">${pet.pet_type} ${pet.pet_gender} | อายุ ${pet.age_year || 0} ปี</div>
                        <div style="font-size: 13px; color: #A0B0C0;">พันธุ์: ${pet.breed || '-'}</div>
                        ${vacBadge}
                    </div>
                    <button class="btn-soft-delete" onclick="softDeletePet('${d.id}')">แจ้งตาย/ย้าย</button>
                </div>
            `);
        });

        if (count === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 30px; background: rgba(255,255,255,0.05); border-radius: 10px;">
                    <p style="color: #A0B0C0; margin-bottom: 15px;">ยังไม่มีข้อมูลสัตว์เลี้ยงในบ้านของท่าน</p>
                    <p style="font-size: 13px; color: #6A7A8A;">(หากท่านเคยลงทะเบียนไว้ ระบบอาจกำลังประสานข้อมูล)</p>
                </div>`;
        }
    } catch (e) {
        console.error(e); container.innerHTML = "<p style='color: red;'>เกิดข้อผิดพลาดในการดึงข้อมูล</p>";
    }
}

// ระบบเปลี่ยนสถานะ (Soft Delete)
window.softDeletePet = async function(docId) {
    if(confirm("ยืนยันการแจ้งสถานะ (สัตว์เสียชีวิต หรือ ย้ายถิ่นฐาน)? \nข้อมูลจะถูกซ่อนจากหน้าจอของท่าน แต่ยังคงอยู่ในระบบของเจ้าหน้าที่เทศบาล")) {
        try {
            // อัปเดตสถานะเป็น deceased (เสียชีวิต) แทนการลบไฟล์ทิ้ง
            await updateDoc(doc(db, "pets", docId), { status: "deceased", updated_at: serverTimestamp() });
            alert("บันทึกการเปลี่ยนแปลงสถานะเรียบร้อยแล้ว");
            loadMyPets(); // โหลดหน้าใหม่
        } catch (e) { alert("เกิดข้อผิดพลาด กรุณาลองใหม่"); }
    }
}

// ==========================================
// 5. ระบบบีบอัดรูปภาพ และ ฟอร์มขึ้นทะเบียนสัตว์
// ==========================================
function setupPetForm() {
    // สลับหน้าจอไปฟอร์มเพิ่มสัตว์
    document.getElementById("btn-show-add-pet").addEventListener("click", () => {
        document.getElementById("dashboard-container").style.display = "none";
        document.getElementById("add-pet-container").style.display = "block";
        document.getElementById("pet-image-preview").src = "https://via.placeholder.com/150?text=เพิ่มรูปภาพ";
        currentPetBase64 = "";
    });

    document.getElementById("btn-cancel-add").addEventListener("click", () => {
        document.getElementById("add-pet-container").style.display = "none";
        document.getElementById("dashboard-container").style.display = "block";
    });

    // ระบบบีบอัดภาพ (Resize & Convert to Base64) เมื่อเลือกรูป
    document.getElementById("pet-image-upload").addEventListener("change", (e) => {
        const file = e.target.files[0];
        if(!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                // ย่อขนาดภาพให้ไม่เกิน 500px ป้องกันพื้นที่ Database เต็ม
                const canvas = document.createElement("canvas");
                const MAX_WIDTH = 500; const MAX_HEIGHT = 500;
                let width = img.width; let height = img.height;

                if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
                else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }

                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);

                // แปลงเป็น Base64 แบบ JPEG คุณภาพ 70%
                currentPetBase64 = canvas.toDataURL("image/jpeg", 0.7);
                document.getElementById("pet-image-preview").src = currentPetBase64;
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    // บันทึกข้อมูลสัตว์เลี้ยง
    document.getElementById("btn-save-pet").addEventListener("click", async () => {
        const pName = document.getElementById("p-name").value;
        const pType = document.getElementById("p-type").value;
        const pGender = document.getElementById("p-gender").value;
        const pRearing = document.getElementById("p-rearing").value;

        if(!pName || !pType || !pGender || !pRearing) return alert("กรุณากรอกข้อมูลที่มีดอกจันให้ครบถ้วน");

        const btn = document.getElementById("btn-save-pet");
        btn.disabled = true; btn.textContent = "กำลังบันทึก...";

        try {
            // ดึงข้อมูลผู้ใช้เพื่อฝังลงไปในเอกสารสัตว์เลี้ยง
            const userSnap = await getDoc(doc(db, "users", userProfileData.userId));
            const u = userSnap.data();

            await addDoc(collection(db, "pets"), {
                owner_uid: userProfileData.userId,
                owner_name: u.owner_name,
                phone_number: u.phone_number,
                house_no: u.house_no,
                village_no: u.village_no,
                house_village_search: `${u.house_no}-${u.village_no}`,
                
                pet_name: pName,
                pet_type: pType,
                pet_gender: pGender,
                breed: document.getElementById("p-breed").value,
                color: document.getElementById("p-color").value,
                age_year: parseInt(document.getElementById("p-age-year").value),
                age_month: parseInt(document.getElementById("p-age-month").value),
                rearing_style: pRearing,
                pet_photo_base64: currentPetBase64, // บันทึกรูป Base64
                
                status: "registered", // สถานะขึ้นทะเบียนปกติ (ไม่ได้จองทำหมัน)
                vaccine_year: 0, // ค่าเริ่มต้น ยังไม่ฉีดวัคซีน
                registered_timestamp: serverTimestamp()
            });

            alert("ขึ้นทะเบียนสัตว์เลี้ยงสำเร็จ!");
            
            // ล้างฟอร์มและกลับหน้าแดชบอร์ด
            document.getElementById("p-name").value = "";
            document.getElementById("p-breed").value = "";
            document.getElementById("p-color").value = "";
            document.getElementById("p-age-year").value = "0";
            document.getElementById("p-age-month").value = "0";
            currentPetBase64 = "";
            
            document.getElementById("add-pet-container").style.display = "none";
            document.getElementById("dashboard-container").style.display = "block";
            loadMyPets();

        } catch (e) {
            console.error(e); alert("เกิดข้อผิดพลาดในการบันทึก");
        } finally { btn.disabled = false; btn.textContent = "💾 บันทึกทะเบียน"; }
    });
}
