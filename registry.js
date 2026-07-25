import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, getDoc, updateDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
const LIFF_ID = "2010813512-UqwFMq5V"; // ใช้ LIFF ID เดิม

let userProfileData = null;
let currentHouseholdKey = "";
let currentPetBase64 = ""; 
window.currentEditPetId = null; // ตัวแปรเก็บ ID สัตว์ตอนกดแก้ไข
window.myPetsData = {}; // เก็บข้อมูลสัตว์ไว้ดึงตอนแก้ไข

// รูปรอยเท้าแบบ SVG สำหรับเป็นค่าเริ่มต้น
const defaultPlaceholder = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512' fill='%23A0B0C0'%3E%3Cpath d='M226.5 92.9c14.3 73-39.9 130-77.2 130-36.5 0-71.4-56.1-57.1-129.1C106.6 20.3 145.4-.1 184.8 0c36.7.1 27.2 19.8 41.7 92.9zm151.7-8.1c-14.3-73-53.1-93.5-89.8-93.5-39.4-.1-78.2 20.3-63.9 93.8 14.3 73 49.2 129.1 85.7 129.1 37.2.1 82.2-56.3 68-129.4zM448 176c-38.6 0-77.8 45.4-93.4 104.9-15.6 59.5-2.5 97.4 36.1 97.4 39.5 0 79-46.7 94.6-106.2C500.9 212.6 486.6 176 448 176zM157.4 280.9c-15.6-59.5-54.8-104.9-93.4-104.9-38.6 0-52.9 36.6-37.3 96.1 15.6 59.5 55.1 106.2 94.6 106.2 38.6.1 51.7-37.9 36.1-97.4zm168.1 48.7c-29.3-10.6-66.9-42.5-139.1-42.5-73.4 0-111 32.3-139.1 42.5-55.5 20.1-133.5 129-87.6 200.7C107.5 515.6 171.3 472 256 472c83.5 0 148.8 43.8 196.4 41.6 46.9-2.1 11.2-126-126.9-184z'/%3E%3C/svg%3E";

document.addEventListener("DOMContentLoaded", () => {
    initializeLiff();
    setupHouseholdForm();
    setupPetForm();
});

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
            const u = userSnap.data();
            currentHouseholdKey = `${u.house_no}-${u.village_no}`;
            document.getElementById("display-household-info").textContent = `บ้านเลขที่ ${u.house_no} หมู่ ${u.village_no}`;
            
            document.getElementById("dashboard-container").style.display = "block";
            loadMyPets();
        } else {
            document.getElementById("household-setup-container").style.display = "block";
        }
    } catch (error) { console.error("Error", error); }
}

function setupHouseholdForm() {
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

async function loadMyPets() {
    const container = document.getElementById("pet-cards-container");
    container.innerHTML = "<p style='color: #D4AF37; text-align: center;'>กำลังโหลดข้อมูลสัตว์เลี้ยง...</p>";

    try {
        const q = query(collection(db, "pets"), where("house_village_search", "==", currentHouseholdKey));
        const snap = await getDocs(q);
        
        container.innerHTML = "";
        window.myPetsData = {}; // รีเซ็ตข้อมูลแคช
        let count = 0;

        const configDoc = await getDoc(doc(db, "system_config", "main_config"));
        let currentVaccineYear = 2569; 
        if (configDoc.exists() && configDoc.data().current_vaccine_year) {
            currentVaccineYear = parseInt(configDoc.data().current_vaccine_year);
        }

        snap.forEach(d => {
            const pet = d.data();
            if(pet.status === "cancelled" || pet.status === "deceased" || pet.status === "moved") return;
            count++;
            
            window.myPetsData[d.id] = pet; // เก็บข้อมูลไว้ให้ฟังก์ชัน Edit ดึงไปใช้

            let vacBadge = "";
            let vacYear = parseInt(pet.vaccine_year || 0);

            if (pet.vaccine_status === "ฉีดแล้ว") {
                if (vacYear === currentVaccineYear) {
                    vacBadge = `<span class="vaccine-badge badge-green">🟢 วัคซีนครอบคลุม (ปี ${vacYear})</span>`;
                } else if (vacYear === currentVaccineYear - 1) {
                    vacBadge = `<span class="vaccine-badge badge-yellow">🟡 ใกล้ถึงกำหนดฉีดซ้ำ (ล่าสุด ${vacYear})</span>`;
                } else {
                    vacBadge = `<span class="vaccine-badge badge-red">🔴 ขาดการต่อวัคซีน</span>`;
                }
            } else {
                vacBadge = `<span class="vaccine-badge badge-red">🔴 ยังไม่เคยฉีดวัคซีน</span>`;
            }

            const imgUrl = pet.pet_photo_base64 || defaultPlaceholder;
            const neuterText = pet.neuter_status === "ทำหมันแล้ว" ? " (ทำหมันแล้ว)" : "";

            container.insertAdjacentHTML('beforeend', `
                <div class="pet-card">
                    <img src="${imgUrl}" class="pet-photo" alt="${pet.pet_name}">
                    <div class="pet-info">
                        <div class="pet-name">${pet.pet_name}</div>
                        <div style="font-size: 13px;">${pet.pet_type} ${pet.pet_gender} | อายุ ${pet.age_year || 0} ปี${neuterText}</div>
                        <div style="font-size: 13px; color: #A0B0C0;">พันธุ์: ${pet.breed || '-'}</div>
                        ${vacBadge}
                    </div>
                    <div class="card-actions">
                        <button class="btn-action-small btn-edit" onclick="editPet('${d.id}')">✏️ แก้ไข</button>
                        <button class="btn-action-small btn-delete" onclick="softDeletePet('${d.id}')">แจ้งตาย/ย้าย</button>
                    </div>
                </div>
            `);
        });

        if (count === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 30px; background: rgba(255,255,255,0.05); border-radius: 10px;">
                    <p style="color: #A0B0C0; margin-bottom: 15px;">ยังไม่มีข้อมูลสัตว์เลี้ยงในบ้านของท่าน</p>
                </div>`;
        }
    } catch (e) {
        console.error(e); container.innerHTML = "<p style='color: red;'>เกิดข้อผิดพลาดในการดึงข้อมูล</p>";
    }
}

// ฟังก์ชันเปิดโหมดแก้ไข (ดึงข้อมูลเดิมมาใส่ฟอร์ม)
window.editPet = function(docId) {
    const pet = window.myPetsData[docId];
    if(!pet) return;

    window.currentEditPetId = docId;
    document.getElementById("form-title").textContent = "✏️ แก้ไขข้อมูลสัตว์เลี้ยง";
    document.getElementById("btn-save-pet").textContent = "💾 บันทึกการแก้ไข";
    
    // ใส่ค่าเดิมลงในช่อง
    document.getElementById("p-name").value = pet.pet_name || "";
    document.getElementById("p-type").value = pet.pet_type || "";
    document.getElementById("p-gender").value = pet.pet_gender || "";
    document.getElementById("p-breed").value = pet.breed || "";
    document.getElementById("p-color").value = pet.color || "";
    document.getElementById("p-age-year").value = pet.age_year || 0;
    document.getElementById("p-age-month").value = pet.age_month || 0;
    document.getElementById("p-rearing").value = pet.rearing_style || "";
    
    document.getElementById("p-vac-status").value = pet.vaccine_status || "";
    document.getElementById("p-vac-year").value = pet.vaccine_year || "";
    document.getElementById("vac-year-group").style.display = pet.vaccine_status === "ฉีดแล้ว" ? "block" : "none";
    document.getElementById("p-neuter-status").value = pet.neuter_status || "";

    currentPetBase64 = pet.pet_photo_base64 || "";
    document.getElementById("pet-image-preview").src = currentPetBase64 || defaultPlaceholder;

    document.getElementById("dashboard-container").style.display = "none";
    document.getElementById("add-pet-container").style.display = "block";
}

window.softDeletePet = async function(docId) {
    if(confirm("ยืนยันการแจ้งสถานะ (สัตว์เสียชีวิต หรือ ย้ายถิ่นฐาน)? \nข้อมูลจะถูกซ่อนจากหน้าจอของท่าน แต่ยังคงอยู่ในระบบของเทศบาล")) {
        try {
            await updateDoc(doc(db, "pets", docId), { status: "deceased", updated_at: serverTimestamp() });
            alert("บันทึกการเปลี่ยนแปลงสถานะเรียบร้อยแล้ว");
            loadMyPets(); 
        } catch (e) { alert("เกิดข้อผิดพลาด กรุณาลองใหม่"); }
    }
}

function setupPetForm() {
    // ปุ่มเปิดฟอร์ม (โหมดเพิ่มใหม่)
    document.getElementById("btn-show-add-pet").addEventListener("click", () => {
        window.currentEditPetId = null; // รีเซ็ตค่าว่าไม่ใช่การแก้
        document.getElementById("form-title").textContent = "+ ขึ้นทะเบียนสัตว์เลี้ยงใหม่";
        document.getElementById("btn-save-pet").textContent = "💾 บันทึกทะเบียน";
        
        // ล้างฟอร์ม
        document.querySelectorAll("#add-pet-container input[type='text'], #add-pet-container input[type='number']").forEach(i => i.value = "");
        document.querySelectorAll("#add-pet-container select").forEach(s => s.selectedIndex = 0);
        document.getElementById("p-age-year").value = "0";
        document.getElementById("p-age-month").value = "0";
        document.getElementById("vac-year-group").style.display = "none";
        
        currentPetBase64 = "";
        document.getElementById("pet-image-preview").src = defaultPlaceholder;

        document.getElementById("dashboard-container").style.display = "none";
        document.getElementById("add-pet-container").style.display = "block";
    });

    document.getElementById("btn-cancel-add").addEventListener("click", () => {
        document.getElementById("add-pet-container").style.display = "none";
        document.getElementById("dashboard-container").style.display = "block";
    });

    // แสดงซ่อนช่องปีวัคซีน
    document.getElementById("p-vac-status").addEventListener("change", (e) => {
        document.getElementById("vac-year-group").style.display = e.target.value === "ฉีดแล้ว" ? "block" : "none";
    });

    // อัปโหลดและบีบอัดภาพ Base64
    document.getElementById("pet-image-upload").addEventListener("change", (e) => {
        const file = e.target.files[0];
        if(!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement("canvas");
                const MAX_WIDTH = 500; const MAX_HEIGHT = 500;
                let width = img.width; let height = img.height;

                if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
                else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }

                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);

                currentPetBase64 = canvas.toDataURL("image/jpeg", 0.7);
                document.getElementById("pet-image-preview").src = currentPetBase64;
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    // บันทึก หรือ อัปเดตข้อมูล
    document.getElementById("btn-save-pet").addEventListener("click", async () => {
        const pName = document.getElementById("p-name").value;
        const pType = document.getElementById("p-type").value;
        const pGender = document.getElementById("p-gender").value;
        const pRearing = document.getElementById("p-rearing").value;
        const pVacStatus = document.getElementById("p-vac-status").value;
        const pNeuterStatus = document.getElementById("p-neuter-status").value;

        if(!pName || !pType || !pGender || !pRearing || !pVacStatus || !pNeuterStatus) {
            return alert("กรุณากรอกข้อมูลที่มีดอกจันให้ครบถ้วน");
        }

        let pVacYear = 0;
        if (pVacStatus === "ฉีดแล้ว") {
            pVacYear = parseInt(document.getElementById("p-vac-year").value);
            if(!pVacYear) return alert("กรุณาระบุปีที่ฉีดวัคซีนล่าสุด");
        }

        const btn = document.getElementById("btn-save-pet");
        btn.disabled = true; btn.textContent = "กำลังบันทึก...";

        try {
            const petData = {
                pet_name: pName,
                pet_type: pType,
                pet_gender: pGender,
                breed: document.getElementById("p-breed").value,
                color: document.getElementById("p-color").value,
                age_year: parseInt(document.getElementById("p-age-year").value),
                age_month: parseInt(document.getElementById("p-age-month").value),
                rearing_style: pRearing,
                vaccine_status: pVacStatus,
                vaccine_year: pVacYear,
                neuter_status: pNeuterStatus,
                pet_photo_base64: currentPetBase64,
                updated_at: serverTimestamp()
            };

            if (window.currentEditPetId) {
                // อัปเดตข้อมูลสัตว์ตัวเดิม
                await updateDoc(doc(db, "pets", window.currentEditPetId), petData);
                alert("แก้ไขข้อมูลสัตว์เลี้ยงสำเร็จ!");
            } else {
                // เพิ่มข้อมูลสัตว์ตัวใหม่
                const userSnap = await getDoc(doc(db, "users", userProfileData.userId));
                const u = userSnap.data();
                
                petData.owner_uid = userProfileData.userId;
                petData.owner_name = u.owner_name;
                petData.phone_number = u.phone_number;
                petData.house_no = u.house_no;
                petData.village_no = u.village_no;
                petData.house_village_search = `${u.house_no}-${u.village_no}`;
                petData.status = "registered";
                petData.registered_timestamp = serverTimestamp();

                await addDoc(collection(db, "pets"), petData);
                alert("ขึ้นทะเบียนสัตว์เลี้ยงสำเร็จ!");
            }
            
            document.getElementById("add-pet-container").style.display = "none";
            document.getElementById("dashboard-container").style.display = "block";
            loadMyPets();

        } catch (e) {
            console.error(e); alert("เกิดข้อผิดพลาดในการบันทึก");
        } finally { 
            btn.disabled = false; 
            btn.textContent = window.currentEditPetId ? "💾 บันทึกการแก้ไข" : "💾 บันทึกทะเบียน"; 
        }
    });
}
