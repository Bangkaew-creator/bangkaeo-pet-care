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
const LIFF_ID = "2010813512-UqwFMq5V"; 

let userProfileData = null;
let currentHouseholdKey = "";
let currentPetBase64 = ""; 
let sysConfig = null; 
let isAdmin = false;

window.currentEditPetId = null; 
window.myPetsData = {}; 
window.currentSearchPets = {};

let signaturePad = null;
window.bookingPetId = null;
window.bookingServiceType = null;
let currentTotalNeuterQuota = 100;
let currentTotalVaccineQuota = 300;
let currentBookedNeuter = 0;
let currentBookedVaccine = 0;

const defaultPlaceholder = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512' fill='%23A0B0C0'%3E%3Cpath d='M226.5 92.9c14.3 73-39.9 130-77.2 130-36.5 0-71.4-56.1-57.1-129.1C106.6 20.3 145.4-.1 184.8 0c36.7.1 27.2 19.8 41.7 92.9zm151.7-8.1c-14.3-73-53.1-93.5-89.8-93.5-39.4-.1-78.2 20.3-63.9 93.8 14.3 73 49.2 129.1 85.7 129.1 37.2.1 82.2-56.3 68-129.4zM448 176c-38.6 0-77.8 45.4-93.4 104.9-15.6 59.5-2.5 97.4 36.1 97.4 39.5 0 79-46.7 94.6-106.2C500.9 212.6 486.6 176 448 176zM157.4 280.9c-15.6-59.5-54.8-104.9-93.4-104.9-38.6 0-52.9 36.6-37.3 96.1 15.6 59.5 55.1 106.2 94.6 106.2 38.6.1 51.7-37.9 36.1-97.4zm168.1 48.7c-29.3-10.6-66.9-42.5-139.1-42.5-73.4 0-111 32.3-139.1 42.5-55.5 20.1-133.5 129-87.6 200.7C107.5 515.6 171.3 472 256 472c83.5 0 148.8 43.8 196.4 41.6 46.9-2.1 11.2-126-126.9-184z'/%3E%3C/svg%3E";

document.addEventListener("DOMContentLoaded", () => {
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

    const btnAcceptBreed = document.getElementById("btn-accept-breed-warning");
    if(btnAcceptBreed) btnAcceptBreed.addEventListener("click", window.acceptBreedWarning);

    const btnClearSig = document.getElementById("btn-clear-signature");
    if(btnClearSig) btnClearSig.addEventListener("click", window.clearSignature);

    const btnCloseConsent = document.getElementById("btn-close-consent");
    if(btnCloseConsent) btnCloseConsent.addEventListener("click", window.closeConsentModal);

    const btnConfirmBooking = document.getElementById("btn-confirm-booking");
    if(btnConfirmBooking) btnConfirmBooking.addEventListener("click", submitBooking);

    initializeLiff();
    setupHouseholdForm();
    setupPetForm();
    setupAdminLogin();
    setupAdminSidebar();
    setupAdminSearch();
    setupAdminSettings();
});

// ==========================================
// ส่วนที่ 1: การจัดการทั่วไป และ LIFF
// ==========================================
window.clearSignature = function() { if(signaturePad) signaturePad.clear(); }
window.closeConsentModal = function() {
    document.getElementById("consent-modal").style.display = "none";
    if(signaturePad) signaturePad.clear();
    document.getElementById("accept-consent").checked = false;
}

window.acceptBreedWarning = function() {
    document.getElementById("breed-warning-modal").style.display = "none";
    const pet = window.myPetsData[window.bookingPetId];
    if(!pet) return;
    
    document.getElementById("consent-pet-name").textContent = `${pet.pet_name} (${pet.pet_type})`;
    document.getElementById("accept-consent").checked = false;
    
    document.getElementById("consent-modal").style.display = "flex";
    setTimeout(() => { if(window.resizeSignatureCanvas) window.resizeSignatureCanvas(); }, 200);
}

async function initializeLiff() {
    try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) liff.login();
        else {
            userProfileData = await liff.getProfile();
            const img = document.getElementById("user-profile-img");
            if(img) {
                img.src = userProfileData.pictureUrl;
                img.style.display = "block";
            }
            await loadSystemConfig();
            checkUserRole(); 
        }
    } catch (err) { console.error("LIFF Init Error", err); }
}

async function checkUserRole() {
    try {
        const adminDoc = await getDoc(doc(db, "admins", userProfileData.userId));
        document.getElementById("loading").style.display = "none";
        
        if (adminDoc.exists()) {
            isAdmin = true;
            document.getElementById("admin-container").style.display = "block";
        } else {
            checkUserData(); 
        }
    } catch (error) { console.error("Role Check Error", error); }
}

async function loadSystemConfig() {
    try {
        const confSnap = await getDoc(doc(db, "system_config", "main_config"));
        if(confSnap.exists()) sysConfig = confSnap.data();
    } catch(e) { console.error("Error loading config:", e); }
}

// ==========================================
// ส่วนที่ 2: ระบบฝั่งประชาชน (Dashboard & จัดการสัตว์เลี้ยง)
// ==========================================
async function checkUserData() {
    try {
        const userSnap = await getDoc(doc(db, "users", userProfileData.userId));
        if (userSnap.exists()) {
            const u = userSnap.data();
            currentHouseholdKey = u.house_village_search || `${u.house_no}-${u.village_no}`;
            document.getElementById("display-household-info").textContent = `บ้านเลขที่ ${u.house_no} หมู่ ${u.village_no}`;
            document.getElementById("dashboard-container").style.display = "block";
            
            await updateQuotaAndBanner(); 
            loadMyPets();
        } else {
            document.getElementById("household-setup-container").style.display = "block";
        }
    } catch (error) { console.error("Error", error); }
}

function setupHouseholdForm() {
    const btnRegHouse = document.getElementById("btn-register-household");
    if(btnRegHouse) {
        btnRegHouse.addEventListener("click", async () => {
            const name = document.getElementById("hh-name").value.trim();
            const phone = document.getElementById("hh-phone").value.trim();
            const hNo = document.getElementById("hh-house-no").value.trim();
            const vNo = document.getElementById("hh-village-no").value;

            if(!name || !phone || !hNo || !vNo) return alert("กรุณากรอกข้อมูลให้ครบถ้วน");

            btnRegHouse.disabled = true; 
            btnRegHouse.textContent = "กำลังบันทึก...";

            try {
                await setDoc(doc(db, "users", userProfileData.userId), {
                    owner_name: name, phone_number: phone, house_no: hNo, village_no: vNo,
                    line_displayName: userProfileData.displayName, picture_url: userProfileData.pictureUrl,
                    house_village_search: `${hNo}-${vNo}`, is_head: true, updated_at: serverTimestamp()
                }, { merge: true });

                document.getElementById("household-setup-container").style.display = "none";
                checkUserData(); 
            } catch (e) { alert("เกิดข้อผิดพลาด"); } 
            finally { btnRegHouse.disabled = false; }
        });
    }
}

async function updateQuotaAndBanner() {
    if(!sysConfig || !sysConfig.nt_start_reg || !sysConfig.nt_end_reg) return;

    currentTotalNeuterQuota = sysConfig.quota_neuter || 100;
    currentTotalVaccineQuota = sysConfig.quota_vaccine || 300;
    currentBookedNeuter = 0;
    currentBookedVaccine = 0;

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
    } catch(e) { console.error("Error counting quota:", e); }

    const today = new Date().toISOString().split('T')[0];
    const isWithinDate = today >= sysConfig.nt_start_reg && today <= sysConfig.nt_end_reg;

    if(isWithinDate) {
        document.getElementById("neuter-banner-container").style.display = "block";
        document.getElementById("txt-service-date").textContent = sysConfig.nt_date || "-";
        document.getElementById("txt-service-location").textContent = sysConfig.nt_location || "-";
        
        document.getElementById("txt-neuter-quota").textContent = `${currentBookedNeuter} / ${currentTotalNeuterQuota} คิว`;
        document.getElementById("bar-neuter").style.width = `${Math.min((currentBookedNeuter / currentTotalNeuterQuota) * 100, 100)}%`;

        document.getElementById("txt-vaccine-quota").textContent = `${currentBookedVaccine} / ${currentTotalVaccineQuota} คิว`;
        document.getElementById("bar-vaccine").style.width = `${Math.min((currentBookedVaccine / currentTotalVaccineQuota) * 100, 100)}%`;

        if (currentBookedNeuter >= currentTotalNeuterQuota && currentBookedVaccine >= currentTotalVaccineQuota) {
            document.getElementById("registration-closed-msg").style.display = "block";
        } else {
            document.getElementById("registration-closed-msg").style.display = "none";
        }
    } else {
        document.getElementById("neuter-banner-container").style.display = "none";
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
        const today = new Date().toISOString().split('T')[0];
        const isBookingOpen = sysConfig && sysConfig.nt_start_reg && (today >= sysConfig.nt_start_reg && today <= sysConfig.nt_end_reg);

        snap.forEach(d => {
            const pet = d.data();
            if(pet.status === "cancelled" || pet.status === "deceased" || pet.status === "moved") return;
            count++; window.myPetsData[d.id] = pet; 

            let vacBadge = pet.vaccine_status === "ฉีดแล้ว" ? (parseInt(pet.vaccine_year) === currentVaccineYear ? `<span class="vaccine-badge badge-green">🟢 วัคซีนครอบคลุม (ปี ${pet.vaccine_year})</span>` : `<span class="vaccine-badge badge-red">🔴 ขาดการต่อวัคซีน</span>`) : `<span class="vaccine-badge badge-red">🔴 ยังไม่เคยฉีด</span>`;

            // ความฉลาดของปุ่มจองคิว
            let actionBtn = "";
            let needNeuter = pet.neuter_status === "ยังไม่ทำหมัน";
            let needVaccine = pet.vaccine_status === "ยังไม่เคยฉีด" || parseInt(pet.vaccine_year) < currentVaccineYear;

            if (pet.status === "booked" || pet.status === "checked_in") {
                // กรณีจองคิวโครงการนี้ไปแล้ว
                let statusIcon = pet.status === "checked_in" ? "✅ รับบริการแล้ว" : `🎫 ดูบัตรคิว #${pet.queue_no || '-'}`;
                let cancelBtn = pet.status === "booked" ? `<button class="btn-action-small btn-cancel-neuter" style="margin-top:5px;" onclick="window.cancelBooking('${d.id}')">❌ ยกเลิกจองคิว</button>` : "";
                
                actionBtn = `
                    <div style="text-align: center; margin-bottom: 5px;">
                        <button class="btn-action-small btn-neuter-ticket" style="width:100%;" onclick="window.viewNeuterTicket('${d.id}')">${statusIcon}</button>
                        ${cancelBtn}
                    </div>
                `;
            } else if (isBookingOpen) {
                // กรณียังไม่จอง -> ตรวจสอบว่าขาดอะไร
                if (needNeuter && currentBookedNeuter < currentTotalNeuterQuota) {
                    actionBtn = `<button class="btn-action-small btn-neuter" onclick="window.startBookingFlow('${d.id}', 'ทำหมันและวัคซีน')">✂️ จองคิวทำหมัน</button>`;
                } else if (!needNeuter && needVaccine && currentBookedVaccine < currentTotalVaccineQuota) {
                    actionBtn = `<button class="btn-action-small btn-vaccine" onclick="window.startBookingFlow('${d.id}', 'วัคซีนอย่างเดียว')">💉 จองคิวฉีดวัคซีน</button>`;
                } else if (!needNeuter && !needVaccine) {
                    actionBtn = `<div style="font-size:11px; color:#50E3C2; text-align:center; margin-bottom:5px;">✅ ประวัติครบถ้วน ไม่ต้องจองคิว</div>`;
                }
            } else if (!needNeuter && !needVaccine) {
                actionBtn = `<div style="font-size:11px; color:#50E3C2; text-align:center; margin-bottom:5px;">✅ ประวัติครบถ้วน</div>`;
            }

            container.insertAdjacentHTML('beforeend', `
                <div class="pet-card">
                    <img src="${pet.pet_photo_base64 || defaultPlaceholder}" class="pet-photo">
                    <div class="pet-info">
                        <div class="pet-name">${pet.pet_name}</div>
                        <div>${pet.pet_type} ${pet.pet_gender} | อายุ ${pet.age_year || 0} ปี</div>
                        <div style="font-size: 12px; color: #A0B0C0;">พันธุ์: ${pet.breed || '-'}</div>
                        ${vacBadge}
                        ${pet.neuter_status === "ทำหมันแล้ว" ? '<span class="vaccine-badge badge-green" style="margin-left:5px;">✂️ ทำหมันแล้ว</span>' : ''}
                    </div>
                    <div class="card-actions">
                        ${actionBtn}
                        <button class="btn-action-small" style="color: #F5A623; border-color: rgba(245, 166, 35, 0.4);" onclick="window.viewCertificate('${d.id}')">📄 ใบรับรอง</button>
                        <button class="btn-action-small btn-edit" onclick="window.editPet('${d.id}')">✏️ แก้ไขข้อมูล</button>
                        <button class="btn-action-small btn-delete" onclick="window.softDeletePet('${d.id}')">แจ้งตาย/ย้าย</button>
                    </div>
                </div>
            `);
        });

        if(count === 0) container.innerHTML = `<div style="text-align: center; padding: 20px; background: rgba(255,255,255,0.05); border-radius: 10px;"><p style="color: #A0B0C0;">ยังไม่มีข้อมูลสัตว์เลี้ยงในบ้านของท่าน</p></div>`;
    } catch (e) { console.error(e); }
}

window.startBookingFlow = function(docId, serviceType) {
    window.bookingPetId = docId;
    window.bookingServiceType = serviceType; // เก็บค่าว่าจองทำหมัน หรือ วัคซีน
    const pet = window.myPetsData[docId];
    
    document.getElementById("consent-pet-name").textContent = `${pet.pet_name} (${pet.pet_type})`;
    document.getElementById("consent-service-type").textContent = serviceType;
    document.getElementById("accept-consent").checked = false;
    
    if (serviceType === "ทำหมันและวัคซีน") {
        document.getElementById("consent-text").innerHTML = "ข้าพเจ้ายินยอมให้เจ้าหน้าที่ของปศุสัตว์จังหวัดสมุทรปราการทำการวางยาสลบเพื่อการผ่าตัดสัตว์ ซึ่งการวางยาสลบอาจมีผลข้างเคียงของยาเกิดขึ้น หากสัตว์ดังกล่าวได้รับอันตรายถึงชีวิตและเจ้าหน้าที่ได้ให้ความช่วยเหลืออย่างเต็มที่แล้ว ภายใต้จรรยาบรรณของการประกอบวิชาชีพสัตวแพทย์ ข้าพเจ้าจะรับผิดชอบดูแลแผลหลังการผ่าตัดตามคำแนะนำอย่างเคร่งครัด หากเกิดการผิดพลาดในการวางยาสลบ การผ่าตัด ข้าพเจ้าจะไม่เรียกร้องหรือฟ้องดำเนินคดีใดๆ";
        document.getElementById("breed-warning-modal").style.display = "flex"; // โชว์แจ้งเตือนสายพันธุ์ก่อน
    } else {
        // ถ้าแค่วัคซีน ข้ามไปหน้าเซ็นชื่อเลย
        document.getElementById("consent-text").innerHTML = "ข้าพเจ้ายินยอมให้เจ้าหน้าที่ทำการฉีดวัคซีนป้องกันโรคพิษสุนัขบ้าให้แก่สัตว์เลี้ยงของข้าพเจ้า และข้าพเจ้าจะดูแลสัตว์เลี้ยงอย่างใกล้ชิดภายหลังการรับวัคซีนตามคำแนะนำของเจ้าหน้าที่";
        document.getElementById("consent-modal").style.display = "flex";
        setTimeout(() => { if(window.resizeSignatureCanvas) window.resizeSignatureCanvas(); }, 200);
    }
}

async function submitBooking() {
    if(!document.getElementById("accept-consent").checked) return alert("กรุณากดยอมรับเงื่อนไขก่อนจองคิว");
    if(signaturePad.isEmpty()) return alert("กรุณาเซ็นชื่อรับรองในกรอบที่กำหนด");

    const pet = window.myPetsData[window.bookingPetId];
    const signatureData = signaturePad.toDataURL(); 
    const serviceType = window.bookingServiceType;

    const btnConfirm = document.getElementById("btn-confirm-booking");
    btnConfirm.disabled = true;
    btnConfirm.textContent = "กำลังรันคิว...";

    try {
        // นับคิวแยกตามประเภทบริการ 
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
        const now = new Date();

        // อัปเดตข้อมูลการจองเข้าไปในตัวสัตว์เลี้ยง
        await updateDoc(doc(db, "pets", window.bookingPetId), { 
            service_type: serviceType,
            status: "booked",
            queue_no: nextQueueNo,
            consent_agreed: true,
            signature_base64: signatureData,
            booked_at: now
        });

        // ข้อความ LINE 
        let lineMsg = `✅ ยืนยันการจองคิว ${serviceType} สำเร็จ\nลำดับคิวของท่านคือ: #${nextQueueNo}\n🐾 น้อง: ${pet.pet_name}\n🏠 บ้านเลขที่: ${pet.house_no} ม.${pet.village_no}\n\n`;
        
        if (serviceType === "ทำหมันและวัคซีน") {
            lineMsg += `📌 ข้อปฏิบัติก่อนทำหมัน\n1. งดน้ำ-อาหารสัตว์อย่างน้อย 12 ชั่วโมง\n2. สัตว์ต้องสุขภาพดี ไม่ผอม ไม่ป่วย\n3. อายุ 6-8 เดือนขึ้นไป\n4. ตัวเมียต้องไม่เป็นสัด/มีประจำเดือน\n5. หากรู้ว่าท้องไม่ควรนำมาทำหมัน\n6. มารับบัตรคิวหน้างานก่อน 10.00 น.`;
        } else {
            lineMsg += `📌 ข้อปฏิบัติรับวัคซีน\n1. สัตว์ต้องมีสุขภาพแข็งแรง ไม่ป่วย\n2. กรุณานำสัตว์ใส่ตะกร้าหรือกระเป๋าที่มิดชิดเพื่อความปลอดภัย`;
        }
        lineMsg += `\n\n⚠️ กรุณาแสดงหน้าระบบและบัตรคิวดิจิทัลแก่เจ้าหน้าที่ในวันงาน`;

        if (liff.isInClient()) {
            await liff.sendMessages([{ type: "text", text: lineMsg }]);
        }

        document.getElementById("consent-modal").style.display = "none";
        alert(`🎉 จองคิวสำเร็จ!\nท่านได้รับคิวลำดับที่ #${nextQueueNo}`);

        await updateQuotaAndBanner(); 
        loadMyPets(); 
        setTimeout(() => { window.viewNeuterTicket(window.bookingPetId); }, 500); 

    } catch (e) {
        console.error("Booking Error:", e);
        alert(`เกิดข้อผิดพลาด: ${e.message}`);
    } finally {
        btnConfirm.disabled = false;
        btnConfirm.textContent = "ยืนยันจองคิว";
    }
}

window.viewNeuterTicket = function(docId) {
    const pet = window.myPetsData[docId];
    if(!pet || (pet.status !== "booked" && pet.status !== "checked_in")) return;

    let ntDate = "-";
    if(sysConfig && sysConfig.nt_date) {
        try { ntDate = new Date(sysConfig.nt_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }); } 
        catch(e) { ntDate = sysConfig.nt_date; }
    }

    document.getElementById("tk-header-title").textContent = `บัตรคิว: ${pet.service_type}`;
    document.getElementById("tk-queue-no").textContent = `#${String(pet.queue_no || 0).padStart(2, '0')}`;
    document.getElementById("tk-pet-name").textContent = `${pet.pet_name} (${pet.pet_type} ${pet.pet_gender})`;
    document.getElementById("tk-date").textContent = ntDate !== "Invalid Date" ? ntDate : "-";
    document.getElementById("tk-location").textContent = sysConfig ? sysConfig.nt_location : "-";
    document.getElementById("tk-owner").textContent = `${pet.owner_name} (บ้าน ${pet.house_no} ม.${pet.village_no})`;

    // ซ่อนข้อควรระวังทำหมันถ้าเป็นการฉีดวัคซีนอย่างเดียว
    if (pet.service_type === "วัคซีนอย่างเดียว") {
        document.getElementById("tk-warning-box").innerHTML = `<b style="font-size: 12px; display: block; margin-bottom: 5px;">⚠️ ข้อปฏิบัติ:</b> 1. สัตว์ต้องแข็งแรง ไม่ป่วย<br>2. นำสัตว์ใส่ตะกร้ามิดชิด`;
    }

    document.getElementById("ticket-modal").style.display = "flex";
}

window.cancelBooking = async function(docId) {
    const pet = window.myPetsData[docId];
    if(!pet) return;

    if(!confirm(`ยืนยันการยกเลิกคิวของน้อง ${pet.pet_name} ใช่หรือไม่?\n(โควตาจะถูกส่งคืนระบบทันที)`)) return;

    const loading = document.getElementById("loading");
    loading.style.display = "flex"; loading.textContent = "กำลังยกเลิกคิว...";

    try {
        await updateDoc(doc(db, "pets", docId), {
            status: "registered", 
            service_type: null,
            queue_no: null,
            consent_agreed: false
        });

        if (liff.isInClient()) {
            await liff.sendMessages([{ type: "text", text: `❌ ยกเลิกการจองคิวสำเร็จ\nสิทธิ์ของน้อง ${pet.pet_name} ถูกยกเลิกและส่งคืนโควตาเรียบร้อยแล้วครับ` }]);
        }

        alert("ยกเลิกคิวสำเร็จ โควตาได้ถูกส่งคืนแล้ว");
        await updateQuotaAndBanner(); loadMyPets(); 
    } catch(e) {
        console.error(e); alert("เกิดข้อผิดพลาดในการยกเลิกคิว");
    } finally { loading.style.display = "none"; }
}

window.viewCertificate = function(docId) {
    const pet = window.myPetsData[docId];
    if(!pet) return;

    document.getElementById("cert-img").src = pet.pet_photo_base64 || defaultPlaceholder;
    document.getElementById("cert-pet-name").textContent = pet.pet_name;
    document.getElementById("cert-pet-detail").textContent = `${pet.pet_type} | ${pet.pet_gender} | อายุ ${pet.age_year || 0} ปี`;
    document.getElementById("cert-owner").textContent = pet.owner_name;
    document.getElementById("cert-address").textContent = `${pet.house_no} ม.${pet.village_no}`;
    
    if (pet.vaccine_status === "ฉีดแล้ว") {
        document.getElementById("cert-vac-status").textContent = `ฉีดแล้ว (ปี ${pet.vaccine_year})`;
        document.getElementById("cert-vac-status").style.color = "#50E3C2";
        document.getElementById("cert-vac-detail").textContent = pet.vaccine_brand ? `${pet.vaccine_brand} (Lot: ${pet.vaccine_lot || '-'})` : "ข้อมูลยืนยันโดยสัตวแพทย์/เจ้าของ";
    } else {
        document.getElementById("cert-vac-status").textContent = "ยังไม่เคยฉีดวัคซีน";
        document.getElementById("cert-vac-status").style.color = "#ff6b6b";
        document.getElementById("cert-vac-detail").textContent = "-";
    }
    
    document.getElementById("cert-admin-name").textContent = pet.vaccinated_by_admin || "(รอการยืนยันจากหน้างาน)";
    document.getElementById("pet-cert-card").classList.remove("flipped");
    document.getElementById("cert-modal").style.display = "flex";
}

window.softDeletePet = async function(docId) {
    if(confirm("ยืนยันการแจ้งสถานะ (สัตว์เสียชีวิต หรือ ย้ายถิ่นฐาน)?")) {
        try { await updateDoc(doc(db, "pets", docId), { status: "deceased", updated_at: serverTimestamp() }); alert("บันทึกเรียบร้อย"); loadMyPets(); } 
        catch (e) { alert("เกิดข้อผิดพลาด"); }
    }
}

// ฟอร์มข้อมูลสัตว์เลี้ยง
function setupPetForm() {
    document.getElementById("btn-show-add-pet").addEventListener("click", () => {
        window.currentEditPetId = null; 
        document.getElementById("form-title").textContent = "+ ขึ้นทะเบียนสัตว์เลี้ยงใหม่";
        document.querySelectorAll("#add-pet-container input[type='text'], #add-pet-container input[type='number']").forEach(i => i.value = "");
        document.querySelectorAll("#add-pet-container select").forEach(s => s.selectedIndex = 0);
        document.getElementById("p-age-year").value = "0"; document.getElementById("p-age-month").value = "0";
        document.getElementById("vac-year-group").style.display = "none";
        currentPetBase64 = ""; document.getElementById("pet-image-preview").src = defaultPlaceholder;
        document.getElementById("dashboard-container").style.display = "none"; document.getElementById("add-pet-container").style.display = "block";
    });

    document.getElementById("btn-cancel-add").addEventListener("click", () => {
        document.getElementById("add-pet-container").style.display = "none"; document.getElementById("dashboard-container").style.display = "block";
    });

    document.getElementById("p-vac-status").addEventListener("change", (e) => {
        document.getElementById("vac-year-group").style.display = e.target.value === "ฉีดแล้ว" ? "block" : "none";
    });

    document.getElementById("pet-image-upload").addEventListener("change", (e) => {
        const file = e.target.files[0]; if(!file) return;
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement("canvas");
                const MAX_WIDTH = 500; let width = img.width; let height = img.height;
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

    document.getElementById("btn-save-pet").addEventListener("click", async () => {
        const pName = document.getElementById("p-name").value.trim();
        const pType = document.getElementById("p-type").value;
        const pGender = document.getElementById("p-gender").value;
        const pRearing = document.getElementById("p-rearing").value;
        const pVacStatus = document.getElementById("p-vac-status").value;
        const pNeuterStatus = document.getElementById("p-neuter-status").value;

        if(!pName || !pType || !pGender || !pRearing || !pVacStatus || !pNeuterStatus) return alert("กรุณากรอกข้อมูลให้ครบถ้วน");

        let pVacYear = 0;
        if (pVacStatus === "ฉีดแล้ว") {
            pVacYear = parseInt(document.getElementById("p-vac-year").value);
            if(!pVacYear) return alert("กรุณาระบุปีที่ฉีดวัคซีนล่าสุด");
        }

        const btnSavePet = document.getElementById("btn-save-pet");
        btnSavePet.disabled = true; btnSavePet.textContent = "กำลังบันทึก...";

        try {
            const petData = {
                pet_name: pName, pet_type: pType, pet_gender: pGender, breed: document.getElementById("p-breed").value.trim() || "พันธุ์ทาง", color: document.getElementById("p-color").value.trim() || "ไม่ระบุ",
                age_year: parseInt(document.getElementById("p-age-year").value) || 0, age_month: parseInt(document.getElementById("p-age-month").value) || 0,
                rearing_style: pRearing, vaccine_status: pVacStatus, vaccine_year: pVacYear, neuter_status: pNeuterStatus,
                pet_photo_base64: currentPetBase64, updated_at: serverTimestamp()
            };

            if (window.currentEditPetId) {
                await updateDoc(doc(db, "pets", window.currentEditPetId), petData);
            } else {
                const userSnap = await getDoc(doc(db, "users", userProfileData.userId));
                const u = userSnap.data();
                petData.owner_uid = userProfileData.userId; petData.owner_name = u.owner_name; petData.phone_number = u.phone_number;
                petData.house_no = u.house_no; petData.village_no = u.village_no; petData.house_village_search = `${u.house_no}-${u.village_no}`;
                petData.status = "registered"; petData.registered_timestamp = serverTimestamp();
                await addDoc(collection(db, "pets"), petData);
            }
            
            document.getElementById("add-pet-container").style.display = "none"; document.getElementById("dashboard-container").style.display = "block"; loadMyPets();
        } catch (e) { alert("เกิดข้อผิดพลาดในการบันทึก"); } finally { btnSavePet.disabled = false; btnSavePet.textContent = "💾 บันทึกทะเบียน"; }
    });
}

window.editPet = function(docId) {
    const pet = window.myPetsData[docId];
    if(!pet) return;
    window.currentEditPetId = docId; document.getElementById("form-title").textContent = "✏️ แก้ไขข้อมูลสัตว์เลี้ยง";
    document.getElementById("p-name").value = pet.pet_name || ""; document.getElementById("p-type").value = pet.pet_type || "";
    document.getElementById("p-gender").value = pet.pet_gender || ""; document.getElementById("p-breed").value = pet.breed || "";
    document.getElementById("p-color").value = pet.color || ""; document.getElementById("p-age-year").value = pet.age_year || 0;
    document.getElementById("p-age-month").value = pet.age_month || 0; document.getElementById("p-rearing").value = pet.rearing_style || "";
    document.getElementById("p-vac-status").value = pet.vaccine_status || ""; document.getElementById("p-vac-year").value = pet.vaccine_year || "";
    document.getElementById("vac-year-group").style.display = pet.vaccine_status === "ฉีดแล้ว" ? "block" : "none";
    document.getElementById("p-neuter-status").value = pet.neuter_status || "";
    currentPetBase64 = pet.pet_photo_base64 || ""; document.getElementById("pet-image-preview").src = currentPetBase64 || defaultPlaceholder;
    document.getElementById("dashboard-container").style.display = "none"; document.getElementById("add-pet-container").style.display = "block";
}

// ==========================================
// ส่วนที่ 3: ระบบฝั่งเจ้าหน้าที่ (Admin)
// ==========================================
function setupAdminLogin() {
    document.getElementById("btn-staff-login").addEventListener("click", () => document.getElementById("secret-modal").style.display = "flex");
    document.getElementById("btn-close-secret").addEventListener("click", () => { document.getElementById("secret-modal").style.display = "none"; document.getElementById("secret-input").value = ""; });

    document.getElementById("btn-verify-secret").addEventListener("click", async () => {
        const code = document.getElementById("secret-input").value;
        if(!code) return alert("กรุณากรอกรหัส");
        try {
            const configDoc = await getDoc(doc(db, "system_config", "main_config"));
            if(configDoc.exists() && configDoc.data().admin_secret_code === code) {
                await setDoc(doc(db, "admins", userProfileData.userId), { role: "staff", name: userProfileData.displayName, added_at: serverTimestamp() });
                alert("เข้าสู่ระบบเจ้าหน้าที่สำเร็จ"); location.reload();
            } else { alert("รหัสลับไม่ถูกต้อง"); }
        } catch (error) { console.error(error); }
    });
}

function setupAdminSidebar() {
    const sidebar = document.getElementById("admin-sidebar");
    window.switchAdminView = function(viewId) {
        document.querySelectorAll(".admin-view, #dashboard-container").forEach(el => el.style.display = "none");
        document.getElementById(viewId).style.display = "block";
        sidebar.style.right = "-250px";
    }

    document.getElementById("menu-checkin").addEventListener("click", () => window.switchAdminView("admin-container"));
    document.getElementById("menu-report").addEventListener("click", () => { window.switchAdminView("report-container"); generateReport(); });
    document.getElementById("menu-user-list").addEventListener("click", () => { window.switchAdminView("user-list-container"); loadUserList(); });
    document.getElementById("menu-settings").addEventListener("click", () => { window.switchAdminView("settings-container"); loadAdminSettings(); });
    
    document.getElementById("menu-logout").addEventListener("click", async () => {
        if(confirm("ต้องการออกจากระบบแอดมินใช่หรือไม่?")) {
            await deleteDoc(doc(db, "admins", userProfileData.userId));
            location.reload();
        }
    });
}

// --- หน้า Check-in (อัปเดตสมุดทะเบียนออโต้) ---
function setupAdminSearch() {
    const searchInput = document.getElementById("admin-search-input");
    const searchBtn = document.getElementById("btn-admin-search");

    searchBtn.addEventListener("click", async () => {
        const keyword = searchInput.value.trim();
        if(!keyword) return alert("กรุณาพิมพ์ บ้านเลขที่-หมู่");
        const res = document.getElementById("admin-result-container");
        res.innerHTML = "<p style='text-align:center; color:#D4AF37;'>กำลังค้นหา...</p>";

        try {
            const q = query(collection(db, "pets"), where("house_village_search", "==", keyword));
            const snap = await getDocs(q);
            if(snap.empty) { res.innerHTML = "<p style='text-align:center; color:#ff6b6b;'>ไม่พบข้อมูล</p>"; return; }

            res.innerHTML = ""; window.currentSearchPets = {};
            snap.forEach((d) => {
                const pet = d.data(); const docId = d.id;
                // โชว์เฉพาะสัตว์ที่มีการจองคิว
                if(pet.status !== "booked" && pet.status !== "checked_in") return; 

                window.currentSearchPets[docId] = pet;
                
                const badge = pet.consent_agreed ? `<span class="status-badge badge-green" style="cursor:pointer;" onclick="window.viewConsent('${docId}')">📄 ใบยินยอม (กดดู)</span>` : `<span class="status-badge badge-red">📄 ยังไม่เซ็น</span>`;
                const isCheckedIn = pet.status === "checked_in";
                const cText = isCheckedIn ? "ยกเลิกติ๊กถูก" : "✔ ติ๊กรับบริการ";
                const cardClass = isCheckedIn ? "admin-card checked" : "admin-card";
                const bStyle = isCheckedIn ? "background: transparent; color: #ff6b6b; border: 1px solid #ff6b6b;" : "";

                res.insertAdjacentHTML('beforeend', `
                    <div class="${cardClass}" id="card-${docId}">
                        <div style="flex: 1;">
                            <strong style="color: #D4AF37; font-size: 16px;">น้อง${pet.pet_name}</strong> <span style="font-size:12px; color:#A0B0C0;">(คิว #${pet.queue_no || '-'})</span>
                            <br><span style="color:#A0B0C0; font-size: 14px;">(${pet.pet_type} ${pet.pet_gender} - ${pet.service_type})</span>
                            <br>${badge}
                        </div>
                        <div>
                            <button type="button" class="neumorphic-btn gold-btn" style="padding: 8px; font-size: 13px; ${bStyle}" onclick="window.toggleCheckIn('${docId}', ${!isCheckedIn})">${cText}</button>
                        </div>
                    </div>
                `);
            });
            if(res.innerHTML === "") res.innerHTML = "<p style='text-align:center; color:#ff6b6b;'>ไม่มีรายการจองคิวในบ้านนี้</p>";
        } catch (e) { console.error(e); res.innerHTML = "<p>เกิดข้อผิดพลาด</p>"; }
    });
}

window.toggleCheckIn = async function(docId, toCheckIn) {
    const pet = window.currentSearchPets[docId];
    if(!pet) return;

    let updateData = { status: toCheckIn ? "checked_in" : "booked" };
    
    // อัปเดตประวัติสมุดทะเบียนให้อัตโนมัติเมื่อมารับบริการ
    if (toCheckIn) {
        const currentYear = sysConfig ? (sysConfig.current_vaccine_year || 2569) : 2569;
        updateData.vaccine_status = "ฉีดแล้ว";
        updateData.vaccine_year = currentYear;
        updateData.vaccinated_by_admin = userProfileData.displayName || "เจ้าหน้าที่ปศุสัตว์";
        if (pet.service_type === "ทำหมันและวัคซีน") {
            updateData.neuter_status = "ทำหมันแล้ว";
        }
    }

    try { 
        await updateDoc(doc(db, "pets", docId), updateData); 
        document.getElementById("btn-admin-search").click(); // โหลดใหม่
    } catch (e) { alert("อัปเดตไม่สำเร็จ"); }
}

window.viewConsent = function(docId) {
    const p = window.currentSearchPets[docId];
    if (p && p.signature_base64) {
        document.getElementById("consent-pet-name").textContent = `น้อง${p.pet_name}`;
        document.getElementById("consent-signature-img").src = p.signature_base64;
        document.getElementById("consent-modal").style.display = "flex";
    } else alert("ไม่พบข้อมูลลายเซ็น");
}

// --- หน้า Report ---
async function generateReport() {
    try {
        const snap = await getDocs(collection(db, "pets"));
        const stats = {
            r: { n: { d: { m:0, f:0 }, c: { m:0, f:0 } }, v: { d: { m:0, f:0 }, c: { m:0, f:0 } } },
            c: { n: { d: { m:0, f:0 }, c: { m:0, f:0 } }, v: { d: { m:0, f:0 }, c: { m:0, f:0 } } }
        };

        snap.forEach((d) => {
            const p = d.data();
            if (p.status !== "booked" && p.status !== "checked_in") return;
            
            const s = p.service_type === "ทำหมันและวัคซีน" ? "n" : "v";
            const t = p.pet_type === "สุนัข" ? "d" : "c";
            const g = p.pet_gender === "ตัวผู้" ? "m" : "f";

            stats.r[s][t][g]++;
            if (p.status === "checked_in") stats.c[s][t][g]++;
        });

        renderTable("table-registered", stats.r);
        renderTable("table-checked-in", stats.c);
    } catch (e) { alert("ดึงข้อมูลรายงานไม่สำเร็จ"); }
}

function renderTable(tableId, data) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    const tot = (o) => o.d.m + o.d.f + o.c.m + o.c.f;
    const n = data.n, v = data.v;
    const tn = tot(n), tv = tot(v);

    tbody.innerHTML = `
        <tr><td style="text-align: left;">ทำหมัน + ฉีดวัคซีน</td><td>${n.d.m}</td><td>${n.d.f}</td><td>${n.c.m}</td><td>${n.c.f}</td><td style="font-weight: bold;">${tn}</td></tr>
        <tr><td style="text-align: left;">ฉีดวัคซีนอย่างเดียว</td><td>${v.d.m}</td><td>${v.d.f}</td><td>${v.c.m}</td><td>${v.c.f}</td><td style="font-weight: bold;">${tv}</td></tr>
        <tr style="background: rgba(212, 175, 55, 0.1); font-weight: bold;"><td>รวมสุทธิ</td><td>${n.d.m + v.d.m}</td><td>${n.d.f + v.d.f}</td><td>${n.c.m + v.c.m}</td><td>${n.c.f + v.c.f}</td><td style="color: #D4AF37; font-size: 16px;">${tn + tv}</td></tr>
    `;
}

// --- หน้ารายชื่อ ---
async function loadUserList() {
    const tbody = document.querySelector("#table-user-list tbody");
    tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; color:#D4AF37;'>กำลังโหลดข้อมูล...</td></tr>";
    
    try {
        const snap = await getDocs(collection(db, "pets"));
        let bookings = [];

        snap.forEach(d => {
            const p = d.data();
            if(p.status === "booked" || p.status === "checked_in") {
                bookings.push(p);
            }
        });

        bookings.sort((a,b) => (a.queue_no || 999) - (b.queue_no || 999));
        
        tbody.innerHTML = "";
        bookings.forEach(p => {
            let statusIcon = p.status === "checked_in" ? "✅" : "⏳";
            tbody.insertAdjacentHTML("beforeend", `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="font-weight:bold; color:#D4AF37;">${p.queue_no || '-'}</td>
                    <td>${p.house_no} ม.${p.village_no}</td>
                    <td>${p.owner_name}</td>
                    <td>${p.phone_number}</td>
                    <td>${p.pet_name} <span style="font-size:10px; color:#A0B0C0;">(${p.pet_type})</span></td>
                    <td style="font-size:12px;">${statusIcon} ${p.service_type}</td>
                </tr>
            `);
        });

        if(bookings.length === 0) tbody.innerHTML = "<tr><td colspan='6' style='text-align:center;'>ยังไม่มีข้อมูลการจองคิว</td></tr>";
    } catch(e) {
        console.error(e); tbody.innerHTML = "<tr><td colspan='6'>เกิดข้อผิดพลาด</td></tr>";
    }
}

// --- หน้าตั้งค่า ---
function setupAdminSettings() {
    document.getElementById("btn-save-settings").addEventListener("click", async () => {
        const btn = document.getElementById("btn-save-settings");
        btn.disabled = true; btn.textContent = "กำลังบันทึก...";
        try {
            await setDoc(doc(db, "system_config", "main_config"), {
                nt_start_reg: document.getElementById("setting-start-date").value, 
                nt_end_reg: document.getElementById("setting-end-date").value, 
                nt_date: document.getElementById("setting-date").value,
                nt_location: document.getElementById("setting-location").value,
                quota_neuter: parseInt(document.getElementById("setting-quota-neuter").value) || 0,
                quota_vaccine: parseInt(document.getElementById("setting-quota-vaccine").value) || 0,
                current_vaccine_year: 2569 // Default year
            }, { merge: true });
            alert("บันทึกการตั้งค่าแล้ว"); window.switchAdminView('admin-container'); loadSystemConfig();
        } catch (e) { alert("เกิดข้อผิดพลาด"); } finally { btn.disabled = false; btn.textContent = "💾 บันทึกการตั้งค่า"; }
    });
}

async function loadAdminSettings() {
    try {
        const configDoc = await getDoc(doc(db, "system_config", "main_config"));
        if(configDoc.exists()) {
            const c = configDoc.data();
            document.getElementById("setting-start-date").value = c.nt_start_reg || "";
            document.getElementById("setting-end-date").value = c.nt_end_reg || "";
            document.getElementById("setting-date").value = c.nt_date || "";
            document.getElementById("setting-location").value = c.nt_location || "";
            document.getElementById("setting-quota-neuter").value = c.quota_neuter || 100;
            document.getElementById("setting-quota-vaccine").value = c.quota_vaccine || 300;
        }
    } catch (e) { console.error(e); }
}
