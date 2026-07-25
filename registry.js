import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

window.currentEditPetId = null; 
window.myPetsData = {}; 

let signaturePad = null;
let bookingPetId = null;
let currentTotalNeuterQuota = 100;
let currentBookedNeuter = 0;

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
});

window.clearSignature = function() { 
    if(signaturePad) signaturePad.clear(); 
}

window.closeConsentModal = function() {
    document.getElementById("consent-modal").style.display = "none";
    if(signaturePad) signaturePad.clear();
    document.getElementById("accept-consent").checked = false;
}

window.acceptBreedWarning = function() {
    document.getElementById("breed-warning-modal").style.display = "none";
    const pet = window.myPetsData[bookingPetId];
    if(!pet) return;
    
    document.getElementById("consent-pet-name").textContent = `${pet.pet_name} (${pet.pet_type})`;
    document.getElementById("accept-consent").checked = false;
    
    document.getElementById("consent-modal").style.display = "flex";
    
    // บังคับให้พื้นที่ลายเซ็นเซ็ตค่าตัวเองเมื่อเปิด Modal ป้องกันบั๊กเซ็นไม่ได้
    setTimeout(() => {
        if(window.resizeSignatureCanvas) window.resizeSignatureCanvas();
    }, 200);
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
            checkUserData();
        }
    } catch (err) { console.error("LIFF Init Error", err); }
}

async function loadSystemConfig() {
    try {
        const confSnap = await getDoc(doc(db, "system_config", "main_config"));
        if(confSnap.exists()) sysConfig = confSnap.data();
    } catch(e) { console.error("Error loading config:", e); }
}

async function checkUserData() {
    try {
        const userSnap = await getDoc(doc(db, "users", userProfileData.userId));
        const loading = document.getElementById("loading");
        if(loading) loading.style.display = "none";
        
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
    currentBookedNeuter = 0;

    try {
        // แก้ไข: ดึงข้อมูลทั้งหมดจากตารางเก่ามานับเองด้วย JS (เพื่อเลี่ยง Index Error)
        const queueRef = collection(db, "vaccine_registrations");
        const snap = await getDocs(queueRef);
        
        snap.forEach(d => {
            const p = d.data();
            // เช็คว่ามีคำว่า "ทำหมัน" หรือไม่ (ดักไว้เผื่อสะกดผิด หรือไม่มีฟิลด์นี้)
            if (p.service_type && String(p.service_type).includes("ทำหมัน") && p.status !== "cancelled") {
                currentBookedNeuter++;
            }
        });
    } catch(e) { console.error("Error counting quota:", e); }

    const today = new Date().toISOString().split('T')[0];
    const isWithinDate = today >= sysConfig.nt_start_reg && today <= sysConfig.nt_end_reg;
    const isQuotaFull = currentBookedNeuter >= currentTotalNeuterQuota;

    if(isWithinDate) {
        document.getElementById("neuter-banner-container").style.display = "block";
        const ntDate = new Date(sysConfig.nt_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
        
        document.getElementById("txt-service-info").innerHTML = `${ntDate}<br><span style="font-size:12px; color:#A0B0C0;">📍 ${sysConfig.nt_location || '-'}</span>`;
        document.getElementById("txt-neuter-quota").textContent = `${currentBookedNeuter} / ${currentTotalNeuterQuota} คิว`;
        
        const pct = Math.min((currentBookedNeuter / currentTotalNeuterQuota) * 100, 100);
        document.getElementById("bar-neuter").style.width = `${pct}%`;

        if (isQuotaFull) {
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

            let neuterBtn = "";
            // ส่วนควบคุมปุ่ม
            if (pet.neuter_status === "ทำหมันแล้ว") {
                neuterBtn = `<div style="font-size:11px; color:#A0B0C0; text-align:center;">✂️ ทำหมันแล้ว</div>`;
            } else if (pet.neuter_booking && pet.neuter_booking.status === "booked") {
                neuterBtn = `
                    <button class="btn-action-small btn-neuter-ticket" onclick="window.viewNeuterTicket('${d.id}')">🎫 ดูบัตรคิว #${pet.neuter_booking.queue_no}</button>
                    <button class="btn-action-small btn-cancel-neuter" onclick="window.cancelBooking('${d.id}')">❌ ยกเลิกจองคิว</button>
                `;
            // แก้ไขเงื่อนไขการโชว์ปุ่มจอง (บางที currentBookedNeuter อาจไม่ได้คำนวณ)
            } else if (isBookingOpen && (currentBookedNeuter < currentTotalNeuterQuota || !currentTotalNeuterQuota)) {
                // อัปเดต: เพิ่ม window. นำหน้าฟังก์ชัน เพื่อให้ HTML หาเจอแน่นอน
                neuterBtn = `<button class="btn-action-small btn-neuter" onclick="window.startBookingFlow('${d.id}')">✂️ จองคิวทำหมัน</button>`;
            }

            container.insertAdjacentHTML('beforeend', `
                <div class="pet-card">
                    <img src="${pet.pet_photo_base64 || defaultPlaceholder}" class="pet-photo">
                    <div class="pet-info">
                        <div class="pet-name">${pet.pet_name}</div>
                        <div>${pet.pet_type} ${pet.pet_gender} | อายุ ${pet.age_year || 0} ปี</div>
                        <div style="font-size: 12px; color: #A0B0C0;">พันธุ์: ${pet.breed || '-'}</div>
                        ${vacBadge}
                    </div>
                    <div class="card-actions">
                        ${neuterBtn}
                        <button class="btn-action-small" style="color: #F5A623; border-color: rgba(245, 166, 35, 0.4);" onclick="window.viewCertificate('${d.id}')">📄 ใบรับรอง</button>
                        <button class="btn-action-small btn-edit" onclick="window.editPet('${d.id}')">✏️ แก้ไข</button>
                        <button class="btn-action-small btn-delete" onclick="window.softDeletePet('${d.id}')">แจ้งตาย/ย้าย</button>
                    </div>
                </div>
            `);
        });

        if(count === 0) container.innerHTML = `<div style="text-align: center; padding: 20px; background: rgba(255,255,255,0.05); border-radius: 10px;"><p style="color: #A0B0C0;">ยังไม่มีข้อมูลสัตว์เลี้ยงในบ้านของท่าน</p></div>`;
    } catch (e) { console.error(e); }
}

async function submitBooking() {
    if(!document.getElementById("accept-consent").checked) return alert("กรุณากดยอมรับเงื่อนไขก่อนจองคิว");
    if(signaturePad.isEmpty()) return alert("กรุณาเซ็นชื่อรับรองในกรอบที่กำหนด");

    const pet = window.myPetsData[bookingPetId];
    const signatureData = signaturePad.toDataURL(); 

    const btnConfirm = document.getElementById("btn-confirm-booking");
    btnConfirm.disabled = true;
    btnConfirm.textContent = "กำลังรันคิว...";

    try {
        // อัปเดต: ค้นหาคิวล่าสุดด้วย JS เพื่อแก้ปัญหา Index
        const queueRef = collection(db, "vaccine_registrations"); 
        const snapQueue = await getDocs(queueRef);
        
        let maxQueue = 0;
        snapQueue.forEach(d => {
            const p = d.data();
            // เช็คว่ามีคำว่า "ทำหมัน" และมีฟิลด์ queue_number
            if (p.service_type && String(p.service_type).includes("ทำหมัน") && p.queue_number) {
                if (p.queue_number > maxQueue) {
                    maxQueue = p.queue_number;
                }
            }
        });
        
        // คิวใหม่คือ คิวสูงสุดที่หาเจอ + 1
        const nextQueueNo = maxQueue + 1;
        const now = new Date();

        const bookingMeta = {
            status: "booked",
            queue_no: nextQueueNo,
            booked_at: now,
            nt_date: sysConfig.nt_date || "-",
            nt_location: sysConfig.nt_location || "-",
            signature_base64: signatureData 
        };
        
        await updateDoc(doc(db, "pets", bookingPetId), { neuter_booking: bookingMeta });

        const userSnap = await getDoc(doc(db, "users", userProfileData.userId));
        const u = userSnap.data();

        await addDoc(queueRef, {
            queue_number: nextQueueNo,
            service_type: "ทำหมันและฉีดวัคซีน",
            owner_name: u.owner_name || "-",
            phone_number: u.phone_number || "-",
            house_no: u.house_no || "-",
            village_no: u.village_no || "-",
            pet_name: pet.pet_name || "-",
            pet_type: pet.pet_type || "-",
            pet_gender: pet.pet_gender || "-",
            pet_breed: pet.breed || "ไม่ระบุ",
            pet_age_years: pet.age_year || 0,
            pet_age_months: pet.age_month || 0,
            pet_color: pet.color || "ไม่ระบุ",
            rearing_style: pet.rearing_style || "ไม่ระบุ",
            userId: userProfileData.userId,
            line_displayName: userProfileData.displayName || "ผู้ใช้",
            picture_url: userProfileData.pictureUrl || "",
            status: "pending", 
            signature: signatureData, 
            timestamp: now
        });

        const msgText = "✅ ยืนยันการจองคิวทำหมัน\nลำดับคิวของท่านคือ: #" + nextQueueNo + "\n🐾 ชื่อสัตว์เลี้ยง: " + pet.pet_name + "\n🏠 บ้านเลขที่: " + u.house_no + " ม." + u.village_no + "\n\n📌 ข้อปฏิบัติและการเตรียมตัวก่อนทำหมัน\n1. งดน้ำ-งดอาหารสัตว์อย่างน้อย 12 ชั่วโมง (ก่อนทำหมัน) และขังสัตว์ไว้ในพื้นที่มิดชิดไม่สามารถออกมากินอาหารได้\n2. สัตว์ที่มาทำหมันต้องสุขภาพดี ไม่ผอม ไม่ป่วย\n3. อายุสัตว์ที่มาทำหมันต้องอายุตั้งแต่ 6-8 เดือนขึ้นไป\n4. สุนัขเพศเมียที่มาทำหมัน ไม่ควรเป็นสัด (อวัยวะเพศบวมแดง) และมีประจำเดือน เพราะจะทำให้เสียเลือดมาก\n5. สุนัขและแมวที่เพิ่งคลอดลูก ควรพักมดลูก 2 เดือน เพราะถ้ามาทำหมันหลังคลอดเลยจะทำให้มดลูกเปื่อยและขาดได้\n6. ถ้ารู้ว่าสัตว์ท้องไม่ควรนำมาทำหมัน หรือถ้าหมอผ่าแล้วเจอจะเย็บปิดทันที\n7. ⚠️ ลำดับคิวที่ท่านได้รับนี้ เป็นเพียง \"คิวการจองสิทธิ์\" เท่านั้น ท่านจะต้องมาติดต่อรับ \"บัตรคิวผ่าตัดทำหมัน\" ที่หน้างานก่อนเวลา 10.00 น. ของวันเข้ารับบริการ\n8. กรุณาเปิดสมุดทะเบียนสัตว์และแสดงบัตรคิวดิจิทัลแก่เจ้าหน้าที่ในวันงาน";

        if (liff.isInClient()) {
            await liff.sendMessages([{ type: "text", text: msgText }]);
        }

        document.getElementById("consent-modal").style.display = "none";
        alert(`🎉 จองคิวสำเร็จ!\nท่านได้รับคิวทำหมันลำดับที่ #${nextQueueNo}`);

        await updateQuotaAndBanner(); 
        loadMyPets(); 
        setTimeout(() => { window.viewNeuterTicket(bookingPetId); }, 500); 

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
    if(!pet || !pet.neuter_booking) return;

    const b = pet.neuter_booking;
    
    // ป้องกัน Error จากวันที่ ถ้าไม่ใช่รูปแบบ Date มาตรฐาน
    let ntDate = "-";
    if(b.nt_date && b.nt_date !== "-") {
        try {
            ntDate = new Date(b.nt_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
        } catch(e) { ntDate = b.nt_date; }
    }

    document.getElementById("tk-queue-no").textContent = `#${String(b.queue_no).padStart(2, '0')}`;
    document.getElementById("tk-pet-name").textContent = `${pet.pet_name} (${pet.pet_type} ${pet.pet_gender})`;
    document.getElementById("tk-date").textContent = ntDate !== "Invalid Date" ? ntDate : "-";
    document.getElementById("tk-location").textContent = b.nt_location || "-";
    document.getElementById("tk-owner").textContent = `${pet.owner_name} (บ้าน ${pet.house_no} ม.${pet.village_no})`;

    document.getElementById("neuter-ticket-modal").style.display = "flex";
}

window.cancelBooking = async function(docId) {
    const pet = window.myPetsData[docId];
    if(!pet || !pet.neuter_booking) return;

    if(!confirm(`ยืนยันการยกเลิกคิวทำหมันของน้อง ${pet.pet_name} ใช่หรือไม่?\n\n(หากยกเลิกแล้ว โควตาของท่านจะถูกส่งคืนให้ระบบทันที)`)) return;

    const loading = document.getElementById("loading");
    if(loading) {
        loading.style.display = "flex";
        loading.textContent = "กำลังยกเลิกคิว...";
    }

    try {
        // ค้นหาคิวในระบบเก่า โดยอิงจาก userId เพื่อเลี่ยง Index Error
        const queueRef = collection(db, "vaccine_registrations");
        const q = query(queueRef, where("userId", "==", userProfileData.userId));
        const snap = await getDocs(q);
        
        snap.forEach(async (d) => {
            const data = d.data();
            if (data.queue_number === pet.neuter_booking.queue_no && data.pet_name === pet.pet_name) {
                await deleteDoc(doc(db, "vaccine_registrations", d.id));
            }
        });

        await updateDoc(doc(db, "pets", docId), {
            neuter_booking: null
        });

        const msgText = `❌ ยกเลิกการจองคิวสำเร็จ\nสิทธิการทำหมันของน้อง ${pet.pet_name} (คิวที่ #${pet.neuter_booking.queue_no}) ถูกยกเลิกและส่งคืนโควตาให้ระบบเรียบร้อยแล้วครับ`;

        if (liff.isInClient()) {
            await liff.sendMessages([{ type: "text", text: msgText }]);
        }

        alert("ยกเลิกคิวสำเร็จ โควตาได้ถูกส่งคืนสู่ระบบแล้วครับ");
        
        await updateQuotaAndBanner(); 
        loadMyPets(); 

    } catch(e) {
        console.error("Cancel Error:", e);
        alert("เกิดข้อผิดพลาดในการยกเลิกคิว");
    } finally {
        if(loading) loading.style.display = "none";
    }
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
        document.getElementById("cert-vac-detail").textContent = pet.vaccine_brand ? `${pet.vaccine_brand} (Lot: ${pet.vaccine_lot || '-'})` : "ข้อมูลวัคซีนบันทึกโดยเจ้าของสัตว์";
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
        try {
            await updateDoc(doc(db, "pets", docId), { status: "deceased", updated_at: serverTimestamp() });
            alert("บันทึกเรียบร้อยแล้ว");
            loadMyPets(); 
        } catch (e) { alert("เกิดข้อผิดพลาด"); }
    }
}

function setupPetForm() {
    const btnShowAdd = document.getElementById("btn-show-add-pet");
    if(btnShowAdd) {
        btnShowAdd.addEventListener("click", () => {
            window.currentEditPetId = null; 
            document.getElementById("form-title").textContent = "+ ขึ้นทะเบียนสัตว์เลี้ยงใหม่";
            
            document.querySelectorAll("#add-pet-container input[type='text'], #add-pet-container input[type='number']").forEach(i => i.value = "");
            document.querySelectorAll("#add-pet-container select").forEach(s => s.selectedIndex = 0);
            document.getElementById("p-age-year").value = "0"; document.getElementById("p-age-month").value = "0";
            document.getElementById("vac-year-group").style.display = "none";
            
            currentPetBase64 = ""; document.getElementById("pet-image-preview").src = defaultPlaceholder;

            document.getElementById("dashboard-container").style.display = "none";
            document.getElementById("add-pet-container").style.display = "block";
        });
    }

    const btnCancelAdd = document.getElementById("btn-cancel-add");
    if(btnCancelAdd) {
        btnCancelAdd.addEventListener("click", () => {
            document.getElementById("add-pet-container").style.display = "none";
            document.getElementById("dashboard-container").style.display = "block";
        });
    }

    const vacStatusSelect = document.getElementById("p-vac-status");
    if(vacStatusSelect) {
        vacStatusSelect.addEventListener("change", (e) => {
            document.getElementById("vac-year-group").style.display = e.target.value === "ฉีดแล้ว" ? "block" : "none";
        });
    }

    const imgUpload = document.getElementById("pet-image-upload");
    if(imgUpload) {
        imgUpload.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if(!file) return;
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
    }

    const btnSavePet = document.getElementById("btn-save-pet");
    if(btnSavePet) {
        btnSavePet.addEventListener("click", async () => {
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

            btnSavePet.disabled = true; btnSavePet.textContent = "กำลังบันทึก...";

            try {
                const petData = {
                    pet_name: pName, pet_type: pType, pet_gender: pGender,
                    breed: document.getElementById("p-breed").value.trim() || "พันธุ์ทาง", color: document.getElementById("p-color").value.trim() || "ไม่ระบุ",
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
                
                document.getElementById("add-pet-container").style.display = "none";
                document.getElementById("dashboard-container").style.display = "block";
                loadMyPets();
            } catch (e) { alert("เกิดข้อผิดพลาดในการบันทึก"); } finally { btnSavePet.disabled = false; btnSavePet.textContent = "💾 บันทึกทะเบียน"; }
        });
    }
}

window.editPet = function(docId) {
    const pet = window.myPetsData[docId];
    if(!pet) return;
    window.currentEditPetId = docId;
    document.getElementById("form-title").textContent = "✏️ แก้ไขข้อมูลสัตว์เลี้ยง";
    
    document.getElementById("p-name").value = pet.pet_name || ""; document.getElementById("p-type").value = pet.pet_type || "";
    document.getElementById("p-gender").value = pet.pet_gender || ""; document.getElementById("p-breed").value = pet.breed || "";
    document.getElementById("p-color").value = pet.color || ""; document.getElementById("p-age-year").value = pet.age_year || 0;
    document.getElementById("p-age-month").value = pet.age_month || 0; document.getElementById("p-rearing").value = pet.rearing_style || "";
    
    document.getElementById("p-vac-status").value = pet.vaccine_status || "";
    document.getElementById("p-vac-year").value = pet.vaccine_year || "";
    document.getElementById("vac-year-group").style.display = pet.vaccine_status === "ฉีดแล้ว" ? "block" : "none";
    document.getElementById("p-neuter-status").value = pet.neuter_status || "";

    currentPetBase64 = pet.pet_photo_base64 || "";
    document.getElementById("pet-image-preview").src = currentPetBase64 || defaultPlaceholder;

    document.getElementById("dashboard-container").style.display = "none";
    document.getElementById("add-pet-container").style.display = "block";
}
