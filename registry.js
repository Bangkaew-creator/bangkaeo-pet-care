import { db } from "./firebase-config.js";
import { collection, addDoc, getDocs, doc, setDoc, getDoc, updateDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 1. ตั้งค่าตัวแปรระบบ
// ==========================================
const LIFF_ID = "2010813512-UqwFMq5V"; 
let userProfileData = null;
let currentHouseholdKey = "";
let currentPetBase64 = ""; 
let sysConfig = null; 

window.currentEditPetId = null; 
window.myPetsData = {}; 
window.bookingPetId = null;
window.bookingServiceType = null;

let signaturePad = null;
let currentTotalNeuterQuota = 100;
let currentTotalVaccineQuota = 300;
let currentBookedNeuter = 0;
let currentBookedVaccine = 0;

const defaultPlaceholder = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512' fill='%23A0B0C0'%3E%3Cpath d='M226.5 92.9c14.3 73-39.9 130-77.2 130-36.5 0-71.4-56.1-57.1-129.1C106.6 20.3 145.4-.1 184.8 0c36.7.1 27.2 19.8 41.7 92.9zm151.7-8.1c-14.3-73-53.1-93.5-89.8-93.5-39.4-.1-78.2 20.3-63.9 93.8 14.3 73 49.2 129.1 85.7 129.1 37.2.1 82.2-56.3 68-129.4zM448 176c-38.6 0-77.8 45.4-93.4 104.9-15.6 59.5-2.5 97.4 36.1 97.4 39.5 0 79-46.7 94.6-106.2C500.9 212.6 486.6 176 448 176zM157.4 280.9c-15.6-59.5-54.8-104.9-93.4-104.9-38.6 0-52.9 36.6-37.3 96.1 15.6 59.5 55.1 106.2 94.6 106.2 38.6.1 51.7-37.9 36.1-97.4zm168.1 48.7c-29.3-10.6-66.9-42.5-139.1-42.5-73.4 0-111 32.3-139.1 42.5-55.5 20.1-133.5 129-87.6 200.7C107.5 515.6 171.3 472 256 472c83.5 0 148.8 43.8 196.4 41.6 46.9-2.1 11.2-126-126.9-184z'/%3E%3C/svg%3E";

const neuterConsentText = "ข้าพเจ้ายินยอมให้เจ้าหน้าที่ของปศุสัตว์จังหวัดสมุทรปราการทำการวางยาสลบเพื่อการผ่าตัดสัตว์ ซึ่งการวางยาสลบอาจมีผลข้างเคียงของยาเกิดขึ้น หากสัตว์ดังกล่าวได้รับอันตรายถึงชีวิตและเจ้าหน้าที่ได้ให้ความช่วยเหลืออย่างเต็มที่แล้ว ภายใต้จรรยาบรรณของการประกอบวิชาชีพสัตวแพทย์ ข้าพเจ้าจะรับผิดชอบดูแลแผลหลังการผ่าตัดตามคำแนะนำการดูแลสัตว์ภายหลังการผ่าตัดอย่างเคร่งครัด หากเกิดการผิดพลาดในการวางยาสลบ การผ่าตัด และไม่ว่าในกรณีใดๆ ข้าพเจ้าจะไม่เรียกร้องหรือฟ้องดำเนินคดีในทางอาญาและทางแพ่งกับเจ้าหน้าที่และส่วนราชการสังกัดของกรมปศุสัตว์แต่อย่างใด เจ้าหน้าที่ของปศุสัตว์จังหวัดสมุทรปราการ ได้อธิบายและข้าพเจ้าได้อ่านข้อความเข้าใจโดยตลอดแล้ว จึงลงลายมือไว้เป็นหลักฐาน (ออกให้โดยเทศบาลเมืองบางแก้วได้รับการวางยาสลบจากเจ้าหน้าที่ ปศุสัตว์จังหวัดสมุทรปราการ)";
const vaccineConsentText = "ข้าพเจ้ายินยอมให้เจ้าหน้าที่ทำการฉีดวัคซีนป้องกันโรคพิษสุนัขบ้าให้แก่สัตว์เลี้ยงของข้าพเจ้า และข้าพเจ้าจะรับผิดชอบดูแลสัตว์เลี้ยงอย่างใกล้ชิดภายหลังการรับวัคซีนตามคำแนะนำ หากเกิดอาการแพ้ ข้าพเจ้าจะไม่เรียกร้องดำเนินคดีใดๆ";

// 🧠 ฟังก์ชันตัวช่วย: แปลงวันที่ YYYY-MM-DD เป็นภาษาไทย
function formatThaiDate(dateStr) {
    if (!dateStr) return "-";
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (regex.test(dateStr)) {
        const parts = dateStr.split("-");
        const year = parseInt(parts[0]) + 543;
        const month = parseInt(parts[1]);
        const day = parseInt(parts[2]);
        const thaiMonths = ["", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
        return `วันที่ ${day} ${thaiMonths[month]} ${year}`;
    }
    return dateStr; 
}

// ==========================================
// 2. เริ่มทำงานเมื่อโหลดหน้าเว็บ
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    initSignaturePad();
    setupEventListeners();
    initializeLiff();
});

function initSignaturePad() {
    const canvas = document.getElementById('signature-pad');
    if(canvas) {
        signaturePad = new SignaturePad(canvas, { backgroundColor: 'rgb(224, 229, 236)' });
        window.resizeSignatureCanvas = function() {
            const ratio =  Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
            canvas.getContext("2d").scale(ratio, ratio);
            signaturePad.clear(); 
        }
        window.addEventListener("resize", window.resizeSignatureCanvas);
    }
}

function setupEventListeners() {
    document.getElementById("btn-clear-signature")?.addEventListener("click", () => { if(signaturePad) signaturePad.clear(); });
    document.getElementById("btn-close-consent")?.addEventListener("click", () => {
        document.getElementById("consent-modal").style.display = "none";
        if(signaturePad) signaturePad.clear();
        document.getElementById("accept-consent").checked = false;
    });
    
    document.getElementById("btn-accept-breed-warning")?.addEventListener("click", () => {
        document.getElementById("breed-warning-modal").style.display = "none";
        document.getElementById("consent-modal").style.display = "flex";
        setTimeout(() => { if(window.resizeSignatureCanvas) window.resizeSignatureCanvas(); }, 200);
    });

    document.getElementById("btn-confirm-booking")?.addEventListener("click", submitBooking);
    
    setupHouseholdForm();
    setupPetForm();
}

// ==========================================
// 3. LIFF & โหลดข้อมูลเบื้องต้น
// ==========================================
async function initializeLiff() {
    try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) liff.login();
        else {
            userProfileData = await liff.getProfile();
            const img = document.getElementById("user-profile-img");
            if(img) { img.src = userProfileData.pictureUrl; img.style.display = "block"; }
            
            await loadSystemConfig();
            checkUserData();
        }
    } catch (err) { console.error("LIFF Init Error", err); }
}

async function loadSystemConfig() {
    try {
        const confSnap = await getDoc(doc(db, "system_config", "main_config"));
        if(confSnap.exists()) {
            sysConfig = confSnap.data();
            document.getElementById("txt-agency-name").textContent = sysConfig.agency_name || "สมุดประจำตัวสัตว์เลี้ยง";
            document.getElementById("cert-back-agency").textContent = sysConfig.agency_name || "หน่วยงาน";
        }
    } catch(e) { console.error("Error loading config:", e); }
}

async function checkUserData() {
    try {
        const userSnap = await getDoc(doc(db, "users", userProfileData.userId));
        document.getElementById("loading").style.display = "none";
        
        if (userSnap.exists()) {
            const u = userSnap.data();
            currentHouseholdKey = u.house_village_search || `${u.house_no}-${u.village_no}`;
            
            let displayAddress = `บ้านเลขที่ ${u.house_no} หมู่ ${u.village_no}`;
            if(u.is_rental && u.room_no) displayAddress += ` (ห้อง ${u.room_no})`;
            document.getElementById("display-household-info").textContent = displayAddress;
            
            document.getElementById("dashboard-container").style.display = "block";
            
            await loadQuotaAndDashboard(); 
            loadMyPets();
        } else {
            document.getElementById("household-setup-container").style.display = "block";
        }
    } catch (error) { console.error("Error", error); }
}

// ==========================================
// 4. ระบบขึ้นทะเบียนบ้านและสัตว์เลี้ยง
// ==========================================
function setupHouseholdForm() {
    document.getElementById("hh-is-rental")?.addEventListener("change", (e) => {
        document.getElementById("hh-room-group").style.display = e.target.checked ? "block" : "none";
    });

    const btnRegHouse = document.getElementById("btn-register-household");
    if(btnRegHouse) {
        btnRegHouse.addEventListener("click", async () => {
            const name = document.getElementById("hh-name").value.trim();
            const phone = document.getElementById("hh-phone").value.trim();
            const hNo = document.getElementById("hh-house-no").value.trim();
            const vNo = document.getElementById("hh-village-no").value;
            const isRental = document.getElementById("hh-is-rental").checked;
            const roomNo = document.getElementById("hh-room-no").value.trim();

            if(!name || !phone || !hNo || !vNo) return alert("กรุณากรอกข้อมูลบ้านเลขที่ให้ครบถ้วน");
            if(isRental && !roomNo) return alert("กรุณาระบุเลขห้องเช่า");

            btnRegHouse.disabled = true; btnRegHouse.textContent = "กำลังบันทึก...";

            let searchKey = `${hNo}-${vNo}`;
            if(isRental && roomNo) searchKey = `${hNo}-${vNo}-${roomNo}`;

            try {
                await setDoc(doc(db, "users", userProfileData.userId), {
                    owner_name: name, phone_number: phone, house_no: hNo, village_no: vNo,
                    is_rental: isRental, room_no: isRental ? roomNo : "",
                    line_displayName: userProfileData.displayName, picture_url: userProfileData.pictureUrl,
                    house_village_search: searchKey, updated_at: serverTimestamp()
                }, { merge: true });

                document.getElementById("household-setup-container").style.display = "none";
                checkUserData(); 
            } catch (e) { alert("เกิดข้อผิดพลาด"); } 
            finally { btnRegHouse.disabled = false; }
        });
    }
}

function setupPetForm() {
    document.getElementById("btn-show-add-pet")?.addEventListener("click", () => {
        window.currentEditPetId = null; 
        document.getElementById("form-title").textContent = "+ ขึ้นทะเบียนสัตว์เลี้ยงใหม่";
        document.getElementById("p-name").value = ""; document.getElementById("p-breed").value = "";
        document.getElementById("p-color").value = ""; document.getElementById("p-age-year").value = "0";
        document.getElementById("p-age-month").value = "0"; document.getElementById("p-vac-year").value = "";
        document.getElementById("p-type").selectedIndex = 0; document.getElementById("p-gender").selectedIndex = 0;
        document.getElementById("p-rearing").selectedIndex = 0; document.getElementById("p-vac-status").selectedIndex = 0;
        document.getElementById("p-neuter-status").selectedIndex = 0;
        
        document.getElementById("vac-year-group").style.display = "none";
        currentPetBase64 = ""; document.getElementById("pet-image-preview").src = defaultPlaceholder;
        
        document.getElementById("dashboard-container").style.display = "none";
        document.getElementById("add-pet-container").style.display = "block";
    });

    document.getElementById("btn-cancel-add")?.addEventListener("click", () => {
        document.getElementById("add-pet-container").style.display = "none";
        document.getElementById("dashboard-container").style.display = "block";
    });

    document.getElementById("p-vac-status")?.addEventListener("change", (e) => {
        document.getElementById("vac-year-group").style.display = e.target.value === "ฉีดแล้ว" ? "block" : "none";
    });

    document.getElementById("pet-image-upload")?.addEventListener("change", (e) => {
        const file = e.target.files[0]; if(!file) return;
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement("canvas");
                const MAX_WIDTH = 400; let width = img.width; let height = img.height;
                if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
                else { if (height > MAX_WIDTH) { width *= MAX_WIDTH / height; height = MAX_WIDTH; } }
                canvas.width = width; canvas.height = height;
                canvas.getContext("2d").drawImage(img, 0, 0, width, height);
                currentPetBase64 = canvas.toDataURL("image/jpeg", 0.7);
                document.getElementById("pet-image-preview").src = currentPetBase64;
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    document.getElementById("btn-save-pet")?.addEventListener("click", async () => {
        const pName = document.getElementById("p-name").value.trim();
        const pType = document.getElementById("p-type").value;
        const pGender = document.getElementById("p-gender").value;
        const pRearing = document.getElementById("p-rearing").value;
        const pVacStatus = document.getElementById("p-vac-status").value;
        const pNeuterStatus = document.getElementById("p-neuter-status").value;

        if(!pName || !pType || !pGender || !pRearing || !pVacStatus || !pNeuterStatus) return alert("กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบถ้วน");

        let pVacYear = 0;
        if (pVacStatus === "ฉีดแล้ว") {
            pVacYear = parseInt(document.getElementById("p-vac-year").value);
            if(!pVacYear) return alert("กรุณาระบุปี พ.ศ. ที่ฉีดวัคซีนล่าสุด");
        }

        const btnSavePet = document.getElementById("btn-save-pet");
        btnSavePet.disabled = true; btnSavePet.textContent = "กำลังบันทึก...";

        try {
            const petData = {
                pet_name: pName, pet_type: pType, pet_gender: pGender,
                breed: document.getElementById("p-breed").value.trim() || "ไม่ระบุ",
                color: document.getElementById("p-color").value.trim() || "ไม่ระบุ",
                age_year: parseInt(document.getElementById("p-age-year").value) || 0,
                age_month: parseInt(document.getElementById("p-age-month").value) || 0,
                rearing_style: pRearing, vaccine_status: pVacStatus, vaccine_year: pVacYear, neuter_status: pNeuterStatus,
                pet_photo_base64: currentPetBase64, updated_at: serverTimestamp()
            };

            if (window.currentEditPetId) {
                await updateDoc(doc(db, "pets", window.currentEditPetId), petData);
            } else {
                const userSnap = await getDoc(doc(db, "users", userProfileData.userId));
                const u = userSnap.data();
                petData.owner_uid = userProfileData.userId; petData.owner_name = u.owner_name; petData.phone_number = u.phone_number;
                petData.house_no = u.house_no; petData.village_no = u.village_no; petData.room_no = u.room_no || "";
                petData.house_village_search = u.house_village_search; 
                petData.status = "registered"; petData.registered_timestamp = serverTimestamp();
                await addDoc(collection(db, "pets"), petData);
            }
            
            document.getElementById("add-pet-container").style.display = "none"; 
            document.getElementById("dashboard-container").style.display = "block"; 
            loadMyPets();
        } catch (e) { alert("เกิดข้อผิดพลาดในการบันทึก"); } 
        finally { btnSavePet.disabled = false; btnSavePet.textContent = "💾 บันทึกทะเบียน"; }
    });
}

// ==========================================
// 5. ระบบ Dashboard & โควตา (Smart Logic)
// ==========================================
async function loadQuotaAndDashboard() {
    if(!sysConfig) return;

    const startDate = sysConfig.nt_start_reg || sysConfig.start_date || "";
    const endDate = sysConfig.nt_end_reg || sysConfig.end_date || "";
    
    currentTotalNeuterQuota = sysConfig.quota_neuter || 100;
    currentTotalVaccineQuota = sysConfig.quota_vaccine || 300;
    currentBookedNeuter = 0; currentBookedVaccine = 0;

    try {
        const petsRef = collection(db, "pets");
        const snap = await getDocs(petsRef);
        
        snap.forEach(d => {
            const p = d.data();
            if (p.status === "booked" || p.status === "checked_in") {
                if (p.service_type === "ทำหมันและวัคซีน") currentBookedNeuter++;
                if (p.service_type === "วัคซีนอย่างเดียว") currentBookedVaccine++;
            }
        });
    } catch(e) { console.error("Quota Error:", e); }

    const today = new Date().toISOString().split('T')[0];
    const isWithinDate = startDate && endDate && (today >= startDate && today <= endDate);

    if(isWithinDate || (currentBookedNeuter > 0 || currentBookedVaccine > 0)) {
        document.getElementById("campaign-banner-container").style.display = "block";
        
        // ใช้ formatThaiDate แปลงวันที่อัตโนมัติ
        document.getElementById("txt-service-date").textContent = formatThaiDate(sysConfig.nt_date || sysConfig.service_date);
        document.getElementById("txt-service-location").textContent = sysConfig.nt_location || sysConfig.service_location || "-";
        
        document.getElementById("txt-neuter-quota").textContent = `${currentBookedNeuter} / ${currentTotalNeuterQuota} คิว`;
        document.getElementById("bar-neuter").style.width = `${Math.min((currentBookedNeuter / currentTotalNeuterQuota) * 100, 100)}%`;

        document.getElementById("txt-vaccine-quota").textContent = `${currentBookedVaccine} / ${currentTotalVaccineQuota} คิว`;
        document.getElementById("bar-vaccine").style.width = `${Math.min((currentBookedVaccine / currentTotalVaccineQuota) * 100, 100)}%`;

        if (currentBookedNeuter >= currentTotalNeuterQuota && currentBookedVaccine >= currentTotalVaccineQuota) {
            document.getElementById("registration-closed-msg").style.display = "block";
        }
    }
}

async function loadMyPets() {
    const container = document.getElementById("pet-cards-container");
    container.innerHTML = "<p style='color: #D4AF37; text-align: center;'>กำลังโหลดข้อมูลสัตว์เลี้ยง...</p>";

    try {
        const q = query(collection(db, "pets"), where("house_village_search", "==", currentHouseholdKey));
        const snap = await getDocs(q);
        
        container.innerHTML = "";
        window.myPetsData = {}; 
        let count = 0;

        const currentVaccineYear = sysConfig ? (sysConfig.current_vaccine_year || 2569) : 2569;
        
        const startDate = sysConfig?.nt_start_reg || sysConfig?.start_date || "";
        const endDate = sysConfig?.nt_end_reg || sysConfig?.end_date || "";
        const today = new Date().toISOString().split('T')[0];
        const isBookingOpen = startDate && endDate && (today >= startDate && today <= endDate);

        snap.forEach(d => {
            const pet = d.data();
            if(pet.status === "cancelled" || pet.status === "deceased" || pet.status === "moved") return;
            count++; window.myPetsData[d.id] = pet; 

            let vacBadge = pet.vaccine_status === "ฉีดแล้ว" 
                ? (parseInt(pet.vaccine_year) >= currentVaccineYear ? `<span class="vaccine-badge badge-green">🟢 วัคซีนครอบคลุม (ปี ${pet.vaccine_year})</span>` : `<span class="vaccine-badge badge-red">🔴 ขาดการต่อวัคซีน</span>`) 
                : `<span class="vaccine-badge badge-red">🔴 ยังไม่เคยฉีด</span>`;

            let actionBtn = "";
            let needNeuter = pet.neuter_status === "ยังไม่ทำหมัน";
            let needVaccine = pet.vaccine_status === "ยังไม่เคยฉีด" || parseInt(pet.vaccine_year) < currentVaccineYear;

            if (pet.status === "booked" || pet.status === "checked_in") {
                let statusIcon = pet.status === "checked_in" ? "✅ รับบริการแล้ว" : `🎫 บัตรคิว #${pet.queue_no || '-'}`;
                let cancelBtn = pet.status === "booked" ? `<button class="btn-action-small btn-cancel-neuter" onclick="window.cancelBooking('${d.id}')">❌ ยกเลิกจองคิว</button>` : "";
                actionBtn = `<button class="btn-action-small btn-neuter-ticket" onclick="window.viewNeuterTicket('${d.id}')">${statusIcon}</button>${cancelBtn}`;
            } else if (isBookingOpen) {
                if (needNeuter && currentBookedNeuter < currentTotalNeuterQuota) {
                    actionBtn = `<button class="btn-action-small btn-neuter" onclick="window.startBookingFlow('${d.id}', 'ทำหมันและวัคซีน')">✂️ จองคิวทำหมัน</button>`;
                } else if (!needNeuter && needVaccine && currentBookedVaccine < currentTotalVaccineQuota) {
                    actionBtn = `<button class="btn-action-small btn-vaccine" onclick="window.startBookingFlow('${d.id}', 'วัคซีนอย่างเดียว')">💉 จองคิววัคซีน</button>`;
                } else if (!needNeuter && !needVaccine) {
                    actionBtn = `<div style="font-size:12px; color:#50E3C2; text-align:center; padding: 5px; font-weight: bold;">✅ ประวัติครบถ้วน</div>`;
                }
            } else if (!needNeuter && !needVaccine) {
                actionBtn = `<div style="font-size:12px; color:#50E3C2; text-align:center; padding: 5px; font-weight: bold;">✅ ประวัติครบถ้วน</div>`;
            }

            container.insertAdjacentHTML('beforeend', `
                <div class="pet-card">
                    <div class="pet-card-left">
                        <img src="${pet.pet_photo_base64 || defaultPlaceholder}" class="pet-photo">
                        <div class="pet-info">
                            <div class="pet-name">${pet.pet_name}</div>
                            <div>${pet.pet_type} ${pet.pet_gender} | อายุ ${pet.age_year || 0} ปี</div>
                            <div>พันธุ์: ${pet.breed || '-'}</div>
                            ${vacBadge}
                            ${pet.neuter_status === "ทำหมันแล้ว" ? '<br><span class="vaccine-badge badge-green">✂️ ทำหมันแล้ว</span>' : ''}
                        </div>
                    </div>
                    <div class="card-actions">
                        ${actionBtn}
                        <button class="btn-action-small" style="color: #D4AF37; border-color: rgba(212, 175, 55, 0.4);" onclick="window.viewCertificate('${d.id}')">📄 ใบรับรอง</button>
                        <button class="btn-action-small btn-edit" onclick="window.editPet('${d.id}')">✏️ แก้ไข</button>
                        <button class="btn-action-small btn-delete" onclick="window.softDeletePet('${d.id}')">แจ้งตาย/ย้าย</button>
                    </div>
                </div>
            `);
        });

        if(count === 0) container.innerHTML = `<div style="text-align: center; padding: 20px; background: rgba(255,255,255,0.05); border-radius: 10px;"><p style="color: #A0B0C0;">ยังไม่มีข้อมูลสัตว์เลี้ยงในสมุดทะเบียน</p></div>`;
    } catch (e) { console.error(e); }
}

// ==========================================
// 6. ฟังก์ชันควบคุมการทำงานของการ์ดแต่ละใบ
// ==========================================
window.editPet = function(docId) {
    const pet = window.myPetsData[docId];
    if(!pet) return;
    window.currentEditPetId = docId; 
    document.getElementById("form-title").textContent = "✏️ แก้ไขข้อมูลสัตว์เลี้ยง";
    document.getElementById("p-name").value = pet.pet_name || ""; document.getElementById("p-type").value = pet.pet_type || "สุนัข";
    document.getElementById("p-gender").value = pet.pet_gender || "ตัวผู้"; document.getElementById("p-breed").value = pet.breed === "ไม่ระบุ" ? "" : pet.breed;
    document.getElementById("p-color").value = pet.color === "ไม่ระบุ" ? "" : pet.color; document.getElementById("p-age-year").value = pet.age_year || 0;
    document.getElementById("p-age-month").value = pet.age_month || 0; document.getElementById("p-rearing").value = pet.rearing_style || "เลี้ยงระบบปิด (ในบ้านตลอด)";
    document.getElementById("p-vac-status").value = pet.vaccine_status || "ยังไม่เคยฉีด"; document.getElementById("p-vac-year").value = pet.vaccine_year || "";
    document.getElementById("vac-year-group").style.display = pet.vaccine_status === "ฉีดแล้ว" ? "block" : "none";
    document.getElementById("p-neuter-status").value = pet.neuter_status || "ยังไม่ทำหมัน";
    currentPetBase64 = pet.pet_photo_base64 || ""; document.getElementById("pet-image-preview").src = currentPetBase64 || defaultPlaceholder;
    document.getElementById("dashboard-container").style.display = "none"; document.getElementById("add-pet-container").style.display = "block";
}

window.softDeletePet = async function(docId) {
    const pet = window.myPetsData[docId];
    if(!pet) return;
    
    const action = prompt(`กรุณาระบุสาเหตุที่ต้องการแจ้งของน้อง ${pet.pet_name}\nพิมพ์ "1" = เสียชีวิต\nพิมพ์ "2" = ย้ายที่อยู่`);
    
    if(action === "1" || action === "2") {
        const newStatus = action === "1" ? "deceased" : "moved";
        try {
            await updateDoc(doc(db, "pets", docId), { 
                status: newStatus, 
                updated_at: serverTimestamp() 
            });
            alert("บันทึกการแจ้งสถานะเรียบร้อยแล้ว ข้อมูลจะถูกเก็บไว้ในประวัติของระบบครับ");
            loadMyPets(); 
        } catch(e) { alert("เกิดข้อผิดพลาดในการอัปเดตสถานะ"); }
    }
}

// 📄 อัปเกรดใบรับรอง (Flip Card) ให้เหมือนหน้าแอดมิน
window.viewCertificate = function(docId) {
    const pet = window.myPetsData[docId];
    if(!pet) return;

    document.getElementById("cert-img").src = pet.pet_photo_base64 || defaultPlaceholder;
    document.getElementById("cert-pet-name").textContent = pet.pet_name;
    document.getElementById("cert-pet-detail").textContent = `${pet.pet_type} | ${pet.pet_gender} | อายุ ${pet.age_year || 0} ปี`;
    document.getElementById("cert-owner").textContent = pet.owner_name;
    
    let certAddress = `${pet.house_no} ม.${pet.village_no}`;
    if(pet.room_no) certAddress += ` (ห้อง ${pet.room_no})`;
    document.getElementById("cert-address").textContent = certAddress;
    
    if (pet.vaccine_status === "ฉีดแล้ว") {
        document.getElementById("cert-vac-status").innerHTML = `ฉีดแล้ว (ปี ${pet.vaccine_year}) <br><span style="font-size:11px; color:#E0E5EC;">วันที่ฉีด: ${pet.vaccine_date || '-'}</span>`;
        document.getElementById("cert-vac-status").style.color = "#50E3C2";
        document.getElementById("cert-vac-detail").innerHTML = `ยี่ห้อ: ${pet.vaccine_brand || '-'} (Lot: ${pet.vaccine_lot || '-'})<br>EXP: ${pet.vaccine_exp || '-'}`;
    } else {
        document.getElementById("cert-vac-status").textContent = "ยังไม่เคยฉีดวัคซีน";
        document.getElementById("cert-vac-status").style.color = "#ff6b6b";
        document.getElementById("cert-vac-detail").textContent = "-";
    }
    
    document.getElementById("cert-admin-name").textContent = pet.vaccinated_by_admin || "-";
    
    if (sysConfig && sysConfig.admin_sig_base64) {
        document.getElementById("cert-admin-sig").src = sysConfig.admin_sig_base64;
        document.getElementById("cert-admin-sig").style.display = "block";
    } else { 
        document.getElementById("cert-admin-sig").style.display = "none"; 
    }

    document.getElementById("pet-cert-card").classList.remove("flipped");
    document.getElementById("cert-modal").style.display = "flex";
}

window.startBookingFlow = function(docId, serviceType) {
    window.bookingPetId = docId;
    window.bookingServiceType = serviceType;
    const pet = window.myPetsData[docId];
    
    document.getElementById("consent-pet-name").textContent = `${pet.pet_name} (${pet.pet_type})`;
    document.getElementById("consent-service-type").textContent = serviceType;
    document.getElementById("accept-consent").checked = false;
    document.getElementById("consent-text").innerHTML = serviceType === "ทำหมันและวัคซีน" ? neuterConsentText : vaccineConsentText;
    
    if (serviceType === "ทำหมันและวัคซีน") {
        document.getElementById("breed-warning-modal").style.display = "flex";
    } else {
        document.getElementById("consent-modal").style.display = "flex";
        setTimeout(() => { if(window.resizeSignatureCanvas) window.resizeSignatureCanvas(); }, 200);
    }
}

async function submitBooking() {
    if(!document.getElementById("accept-consent").checked) return alert("กรุณากดยอมรับเงื่อนไข");
    if(signaturePad.isEmpty()) return alert("กรุณาเซ็นชื่อรับรอง");

    const pet = window.myPetsData[window.bookingPetId];
    const signatureData = signaturePad.toDataURL("image/png"); 
    const serviceType = window.bookingServiceType;

    const btnConfirm = document.getElementById("btn-confirm-booking");
    btnConfirm.disabled = true; btnConfirm.textContent = "กำลังรันคิว...";

    try {
        const petsRef = collection(db, "pets"); 
        const snapAll = await getDocs(petsRef);
        let serviceQueueCount = 0;
        snapAll.forEach(d => {
            const p = d.data();
            if (p.service_type === serviceType && (p.status === "booked" || p.status === "checked_in")) {
                serviceQueueCount++;
            }
        });
        
        const nextQueueNo = serviceQueueCount + 1;

        await updateDoc(doc(db, "pets", window.bookingPetId), { 
            service_type: serviceType,
            status: "booked",
            queue_no: nextQueueNo,
            consent_agreed: true,
            signature_base64: signatureData,
            signed_timestamp: serverTimestamp()
        });

        let lineMsg = `✅ ยืนยันการลงทะเบียน (จองสิทธิ์สำเร็จ)\nลำดับคิวจองสิทธิ์ที่: ${nextQueueNo}\n🏠 บ้านเลขที่: ${pet.house_no} หมู่ ${pet.village_no}\n🐾 ชื่อสัตว์เลี้ยง: น้อง${pet.pet_name}\n(ระบบได้บันทึกใบยินยอมและลายเซ็นของท่านเรียบร้อยแล้ว)\n\n`;
        
        if (serviceType === "ทำหมันและวัคซีน") {
            lineMsg += `📌 ข้อปฏิบัติและการเตรียมตัวก่อนทำหมัน\n1. งดน้ำ-งดอาหารสัตว์อย่างน้อย 12 ชั่วโมง (ก่อนทำหมัน) และขังสัตว์ไว้ในพื้นที่มิดชิดไม่สามารถออกมากินอาหารได้\n2. สัตว์ที่มาทำหมันต้องสุขภาพดี ไม่ผอม ไม่ป่วย\n3. อายุสัตว์ที่มาทำหมันต้องอายุตั้งแต่ 6-8 เดือนขึ้นไป\n4. สุนัขเพศเมียที่มาทำหมัน ไม่ควรเป็นสัด (อวัยวะเพศบวมแดง) และมีประจำเดือน เพราะจะทำให้เสียเลือดมาก\n5. สุนัขและแมวที่เพิ่งคลอดลูก ควรพักมดลูก 2 เดือน เพราะถ้ามาทำหมันหลังคลอดเลยจะทำให้มดลูกเปื่อยและขาดได้\n6. ถ้ารู้ว่าสัตว์ท้องไม่ควรนำมาทำหมัน หรือถ้าหมอผ่าแล้วเจอจะเย็บปิดทันที\n7. ⚠️ ลำดับคิวที่ท่านได้รับนี้ เป็นเพียง "คิวการจองสิทธิ์" เท่านั้น ท่านจะต้องมาติดต่อรับ "บัตรคิวผ่าตัดทำหมัน" ที่หน้างานก่อนเวลา 10.00 น. ของวันเข้ารับบริการ\n8. กรุณาแสดงข้อความนี้แก่เจ้าหน้าที่ในวันรับบริการ (เจ้าหน้าที่จะตรวจสอบข้อมูลและลายเซ็นจากระบบ)`;
        } else {
            lineMsg += `📌 ข้อปฏิบัติและการเตรียมตัวรับวัคซีน\nสัตว์ต้องมีสุขภาพแข็งแรง ไม่ป่วย และควรนำสัตว์ใส่ตะกร้าหรือกระเป๋าที่มิดชิดเพื่อความปลอดภัย`;
        }

        if (liff.isInClient()) await liff.sendMessages([{ type: "text", text: lineMsg }]);

        document.getElementById("consent-modal").style.display = "none";
        alert(`🎉 จองคิวสำเร็จ!\nท่านได้รับคิวลำดับที่ #${nextQueueNo}`);
        
        await loadQuotaAndDashboard(); 
        loadMyPets(); 
        setTimeout(() => { window.viewNeuterTicket(window.bookingPetId); }, 500); 

    } catch (e) { alert(`เกิดข้อผิดพลาด: ${e.message}`); } 
    finally { btnConfirm.disabled = false; btnConfirm.textContent = "ยืนยันจองคิว"; }
}

window.viewNeuterTicket = function(docId) {
    const pet = window.myPetsData[docId];
    if(!pet || (pet.status !== "booked" && pet.status !== "checked_in")) return;

    document.getElementById("tk-header-title").textContent = `บัตรคิว: ${pet.service_type}`;
    document.getElementById("tk-agency-name").textContent = sysConfig ? sysConfig.agency_name : "เทศบาล...";
    document.getElementById("tk-queue-no").textContent = `#${String(pet.queue_no || 0).padStart(2, '0')}`;
    document.getElementById("tk-pet-name").textContent = `${pet.pet_name} (${pet.pet_type} ${pet.pet_gender})`;
    
    // ใช้ formatThaiDate แปลงวันที่อัตโนมัติ
    document.getElementById("tk-date").textContent = formatThaiDate(sysConfig.nt_date || sysConfig.service_date);
    document.getElementById("tk-location").textContent = sysConfig ? (sysConfig.nt_location || sysConfig.service_location) : "-";
    
    let tkAddress = `${pet.house_no} ม.${pet.village_no}`;
    if(pet.room_no) tkAddress += ` (ห้อง ${pet.room_no})`;
    document.getElementById("tk-owner").textContent = `${pet.owner_name} (บ้าน ${tkAddress})`;

    if (pet.service_type === "วัคซีนอย่างเดียว") {
        document.getElementById("tk-warning-box").innerHTML = `<b style="font-size: 12px; display: block; margin-bottom: 5px;">⚠️ ข้อปฏิบัติและการเตรียมตัวรับวัคซีน:</b> สัตว์ต้องมีสุขภาพแข็งแรง ไม่ป่วย และควรนำสัตว์ใส่ตะกร้าหรือกระเป๋าที่มิดชิดเพื่อความปลอดภัย`;
    } else {
        document.getElementById("tk-warning-box").innerHTML = `<b style="font-size: 12px; display: block; margin-bottom: 5px;">⚠️ ข้อปฏิบัติและการเตรียมตัวก่อนทำหมัน:</b>
        1. งดน้ำ-งดอาหารสัตว์อย่างน้อย 12 ชั่วโมง (ก่อนทำหมัน) และขังสัตว์ไว้ในพื้นที่มิดชิดไม่สามารถออกมากินอาหารได้<br>
        2. สัตว์ที่มาทำหมันต้องสุขภาพดี ไม่ผอม ไม่ป่วย<br>
        3. อายุสัตว์ที่มาทำหมันต้องอายุตั้งแต่ 6-8 เดือนขึ้นไป<br>
        4. สุนัขเพศเมียที่มาทำหมัน ไม่ควรเป็นสัด (อวัยวะเพศบวมแดง) และมีประจำเดือน เพราะจะทำให้เสียเลือดมาก<br>
        5. สุนัขและแมวที่เพิ่งคลอดลูก ควรพักมดลูก 2 เดือน เพราะถ้ามาทำหมันหลังคลอดเลยจะทำให้มดลูกเปื่อยและขาดได้<br>
        6. ถ้ารู้ว่าสัตว์ท้องไม่ควรนำมาทำหมัน หรือถ้าหมอผ่าแล้วเจอจะเย็บปิดทันที<br>
        7. ⚠️ ลำดับคิวที่ท่านได้รับนี้ เป็นเพียง "คิวการจองสิทธิ์" เท่านั้น ท่านจะต้องมาติดต่อรับ "บัตรคิวผ่าตัดทำหมัน" ที่หน้างานก่อนเวลา 10.00 น. ของวันเข้ารับบริการ<br>
        8. กรุณาแสดงข้อความนี้แก่เจ้าหน้าที่ในวันรับบริการ (เจ้าหน้าที่จะตรวจสอบข้อมูลและลายเซ็นจากระบบ)`;
    }

    document.getElementById("ticket-modal").style.display = "flex";
}

window.cancelBooking = async function(docId) {
    const pet = window.myPetsData[docId];
    if(!pet) return;

    if(confirm(`ยืนยันการยกเลิกคิว?\n(โควตาจะถูกส่งคืนระบบทันที)`)) {
        try {
            await updateDoc(doc(db, "pets", docId), { status: "registered", service_type: null, queue_no: null, consent_agreed: false });
            
            if (liff.isInClient()) {
                await liff.sendMessages([{ type: "text", text: `❌ ท่านได้ยกเลิกคิวจองสิทธิ์ของน้อง${pet.pet_name} และคืนสิทธิ์เข้าสู่ระบบเรียบร้อยแล้วครับ` }]);
            }

            alert("ยกเลิกคิวและคืนโควตาสำเร็จ");
            await loadQuotaAndDashboard(); loadMyPets(); 
        } catch(e) { alert("เกิดข้อผิดพลาดในการยกเลิก"); }
    }
}
