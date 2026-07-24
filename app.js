import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, getDoc, updateDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 1. ตั้งค่า Firebase และ ตัวแปรระบบ
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

const LIFF_ID = "2010813512-Wln3PzpL"; 
let userProfileData = null;
let pets = []; 
let canvasInstances = []; 
window.currentSearchPets = {}; // สำหรับดึงข้อมูลตอนพิมพ์ใบเดี่ยว

document.addEventListener("DOMContentLoaded", () => {
    initializeLiff();
    setupNavigation();
    setupRentalLogic();
    setupPetSystem();
    setupFinalSubmit();
    setupAdminLogin();
    setupAdminSearch();
    setupSidebarAndSettings();
    setupReportPrint();
    setupPrintAllConsents(); // ฟังก์ชันพิมพ์ใบยินยอมทั้งหมด
});

// ==========================================
// 2. LIFF Init & Role Check
// ==========================================
async function initializeLiff() {
    try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) liff.login();
        else {
            userProfileData = await liff.getProfile();
            checkUserRole();
        }
    } catch (err) { console.error("LIFF Init Error", err); }
}

async function checkUserRole() {
    try {
        const adminDoc = await getDoc(doc(db, "admins", userProfileData.userId));
        document.getElementById("loading").style.display = "none";
        if(adminDoc.exists()) {
            document.getElementById("admin-container").style.display = "block";
        } else {
            document.getElementById("app-container").style.display = "block";
            loadDashboardData(); 
            loadUserData(); // โหลดข้อมูลเจ้าของเดิม (Auto-fill)
        }
    } catch (error) { console.error("Role Check Error", error); }
}

// ฟังก์ชันดึงข้อมูลเจ้าของที่เคยลงทะเบียนไว้มากรอกอัตโนมัติ
async function loadUserData() {
    try {
        const userSnap = await getDoc(doc(db, "users", userProfileData.userId));
        if(userSnap.exists()) {
            const u = userSnap.data();
            document.getElementById("owner-name").value = u.owner_name || "";
            document.getElementById("phone-number").value = u.phone_number || "";
            document.getElementById("house-no").value = u.house_no || "";
            document.getElementById("village-no").value = u.village_no || "";
            if(u.is_rental) {
                document.getElementById("is-rental").checked = true;
                document.getElementById("room-no-group").style.display = "block";
                document.getElementById("room-no").value = u.room_no || "";
            }
        }
    } catch (e) { console.error("Load user error", e); }
}

// ==========================================
// 3. ระบบประชาชน: Dashboard & My Pets
// ==========================================
async function loadDashboardData() {
    try {
        const configDoc = await getDoc(doc(db, "system_config", "main_config"));
        let maxNeuter = 100, maxVaccine = 300; 
        let startDate = "", endDate = "";

        if(configDoc.exists()) {
            const c = configDoc.data();
            maxNeuter = c.quota_neuter || 100; 
            maxVaccine = c.quota_vaccine || 300;
            startDate = c.start_date || ""; 
            endDate = c.end_date || ""; 

            const serviceInfo = [];
            if(c.service_date) serviceInfo.push(`${c.service_date}`);
            if(c.service_location) serviceInfo.push(`📍 ${c.service_location}`);
            if(serviceInfo.length > 0) document.getElementById("txt-service-info").innerHTML = serviceInfo.join("<br>");
            else document.getElementById("txt-service-info").style.display = "none";
        }

        const petsSnap = await getDocs(collection(db, "pets"));
        let curNeuter = 0, curVaccine = 0;
        
        // 1. สร้างตัวแปร Object เพื่อใช้จัดกลุ่มตามที่อยู่
        const groupedPets = {};
        
        petsSnap.forEach(d => {
            const data = d.data();
            if(data.status !== "cancelled") {
                // นับโควตา
                if(data.service_type === "ทำหมันและวัคซีน") curNeuter++;
                if(data.service_type === "วัคซีนอย่างเดียว") curVaccine++;
                
                // ดึงเฉพาะข้อมูลของคนๆ นี้มาจัดกลุ่ม
                if(data.owner_uid === userProfileData.userId) {
                    const searchKey = data.house_village_search || "ไม่ระบุที่อยู่";
                    
                    // ถ้ายังไม่มีกลุ่มของบ้านเลขที่นี้ ให้สร้าง Array ว่างขึ้นมาก่อน
                    if (!groupedPets[searchKey]) {
                        groupedPets[searchKey] = [];
                    }
                    // ดันข้อมูลสัตว์เลี้ยงเข้าไปในกลุ่มบ้านเลขที่นั้นๆ
                    groupedPets[searchKey].push({ id: d.id, ...data });
                }
            }
        });

        // 2. นำข้อมูลที่จัดกลุ่มแล้วมาสร้างเป็น HTML
        let myPetsHtml = "";
        for (const addressKey in groupedPets) {
            // สร้างหัวข้อบ้านเลขที่
            let addressHeader = "ไม่ระบุที่อยู่";
            if (addressKey && addressKey.includes("-")) {
                const parts = addressKey.split("-");
                addressHeader = `🏠 บ้านเลขที่ ${parts[0]} หมู่ที่ ${parts[1]}`;
            }

            // เปิดกรอบสำหรับแต่ละบ้าน
            myPetsHtml += `
            <div style="margin-bottom: 20px; background: rgba(0, 0, 0, 0.15); padding: 12px; border-radius: 10px; border: 1px solid rgba(212, 175, 55, 0.2);">
                <div style="color: #D4AF37; font-size: 15px; font-weight: bold; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px dashed rgba(212, 175, 55, 0.4);">
                    ${addressHeader}
                </div>
            `;

            // วนลูปนำสัตว์เลี้ยงในบ้านนั้นมาแสดง
            groupedPets[addressKey].forEach(pet => {
                const badge = pet.status === "checked_in" ? `<span style="color:#50E3C2; font-size:12px; margin-left: 5px;">(✅ รับบริการแล้ว)</span>` : ``;
                const cancelBtn = pet.status === "booked" ? `<button type="button" class="btn-cancel-pet" onclick="cancelMyPet('${pet.id}')">❌ ยกเลิกสิทธิ์คืนโควตา</button>` : ``;

                myPetsHtml += `
                <div class="pet-item" style="margin-bottom: 8px; border-left: 3px solid #D4AF37;">
                    <strong>${pet.pet_name}</strong> ${badge}<br>
                    <span style="color:#A0B0C0; font-size: 13px;">${pet.pet_type} ${pet.pet_gender} - ${pet.service_type}</span>
                    <br>${cancelBtn}
                </div>`;
            });

            // ปิดกรอบบ้าน
            myPetsHtml += `</div>`;
        }

        // อัปเดตตัวเลขโควตาบนหน้าจอ
        document.getElementById("txt-neuter-quota").textContent = `${curNeuter} / ${maxNeuter} คิว`;
        document.getElementById("bar-neuter").style.width = `${Math.min((curNeuter/maxNeuter)*100, 100)}%`;
        document.getElementById("txt-vaccine-quota").textContent = `${curVaccine} / ${maxVaccine} คิว`;
        document.getElementById("bar-vaccine").style.width = `${Math.min((curVaccine/maxVaccine)*100, 100)}%`;

        // แสดงผลรายการ
        if(myPetsHtml !== "") {
            document.getElementById("my-registered-pets").style.display = "block";
            document.getElementById("my-pets-list").innerHTML = myPetsHtml;
        } else {
            document.getElementById("my-registered-pets").style.display = "none";
        }

        // เช็กเปิด-ปิดระบบอัตโนมัติตามวันที่และโควตา
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }); 
        let isOpen = true;
        
        if (startDate && todayStr < startDate) isOpen = false; 
        if (endDate && todayStr > endDate) isOpen = false; 
        if (curNeuter >= maxNeuter && curVaccine >= maxVaccine) isOpen = false; 

        const btnStart = document.getElementById("btn-start-register");
        const msgClosed = document.getElementById("registration-closed-msg");
        if(isOpen) {
            btnStart.style.display = "block";
            msgClosed.style.display = "none";
        } else {
            btnStart.style.display = "none";
            msgClosed.style.display = "block";
        }

    } catch (error) { console.error(error); }
}

window.cancelMyPet = async function(docId) {
    if(confirm("คุณต้องการยกเลิกคิวนี้เพื่อคืนสิทธิ์ให้ผู้อื่น ใช่หรือไม่?")) {
        try {
            await updateDoc(doc(db, "pets", docId), { status: "cancelled" });
            alert("ยกเลิกสิทธิ์เรียบร้อยแล้ว โควตาได้ถูกส่งคืนสู่ระบบครับ");
            loadDashboardData(); 
        } catch (e) { alert("เกิดข้อผิดพลาด กรุณาลองใหม่"); }
    }
}

// ==========================================
// 4. ระบบประชาชน: แบบฟอร์ม & ตะกร้า
// ==========================================
function setupNavigation() {
    document.querySelectorAll('.btn-next').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const currentStep = e.target.closest('.step-content');
            const inputs = currentStep.querySelectorAll('input[required], select[required]');
            let isValid = true;
            inputs.forEach(i => { if (!i.value) isValid = false; });
            if (isValid) changeStep(e.target.getAttribute('data-next'));
            else alert("กรุณากรอกข้อมูลให้ครบถ้วน");
        });
    });

    document.querySelectorAll('.btn-back').forEach(btn => {
        btn.addEventListener('click', (e) => changeStep(e.target.getAttribute('data-back')));
    });

    const btnNextStep1 = document.getElementById("btn-next-step1");
    if(btnNextStep1) {
        btnNextStep1.addEventListener("click", () => {
            const step1 = document.getElementById("step-1");
            const inputs = step1.querySelectorAll('input[required], select[required]');
            let isValid = true;
            inputs.forEach(i => { if (!i.value) isValid = false; });
            if (!isValid) return alert("กรุณากรอกข้อมูลให้ครบถ้วน");

            // ตรวจสอบเบอร์โทรศัพท์ว่าครบ 10 หลักหรือไม่
            const phoneVal = document.getElementById("phone-number").value.replace(/\D/g, ''); 
            if (phoneVal.length !== 10) {
                return alert("กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (10 หลัก)");
            }

            if (!document.getElementById("is-resident").checked) {
                return alert("กรุณายืนยันว่าท่านเป็นผู้มีทะเบียนบ้านในตำบลบางแก้ว");
            }

            document.getElementById("breed-warning-modal").style.display = "flex";
        });
    }

    const btnAcceptBreed = document.getElementById("btn-accept-breed-warning");
    if(btnAcceptBreed) {
        btnAcceptBreed.addEventListener("click", () => {
            document.getElementById("breed-warning-modal").style.display = "none";
            changeStep("2");
        });
    }
}

function changeStep(stepId) {
    document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
    document.getElementById(`step-${stepId}`).classList.add('active');
    if(stepId === "3") renderConsentForms();
}

function setupRentalLogic() {
    document.getElementById("is-rental").addEventListener("change", (e) => {
        const roomGroup = document.getElementById("room-no-group");
        const roomInput = document.getElementById("room-no");
        if (e.target.checked) { roomGroup.style.display = "block"; roomInput.required = true; } 
        else { roomGroup.style.display = "none"; roomInput.required = false; roomInput.value = ""; }
    });
}

function setupPetSystem() {
    document.getElementById("btn-add-pet").addEventListener("click", async () => {
        const name = document.getElementById("pet-name").value;
        const type = document.getElementById("pet-type").value;
        const gender = document.getElementById("pet-gender").value;
        const service = document.getElementById("service-type").value;

        if(!name || !type || !gender || !service) return alert("กรุณากรอกข้อมูลสัตว์เลี้ยงให้ครบ");

        // ป้องกันคนกดรัวๆ ระหว่างที่ระบบกำลังดึงข้อมูลเช็กโควตา
        const btnAdd = document.getElementById("btn-add-pet");
        btnAdd.textContent = "กำลังตรวจสอบโควตา...";
        btnAdd.disabled = true;

        try {
            // 1. ดึงข้อมูลโควตาสูงสุดที่แอดมินตั้งค่าไว้
            const configDoc = await getDoc(doc(db, "system_config", "main_config"));
            let maxN = 100, maxV = 300;
            if (configDoc.exists()) {
                maxN = configDoc.data().quota_neuter || 100;
                maxV = configDoc.data().quota_vaccine || 300;
            }

            // 2. ดึงข้อมูลว่าตอนนี้มีคนจองคิวไปแล้วกี่ตัว (ไม่นับตัวที่ยกเลิก)
            const allPetsSnap = await getDocs(collection(db, "pets"));
            let currentN = 0, currentV = 0;
            allPetsSnap.forEach(d => {
                if (d.data().status !== "cancelled") {
                    if (d.data().service_type === "ทำหมันและวัคซีน") currentN++;
                    if (d.data().service_type === "วัคซีนอย่างเดียว") currentV++;
                }
            });

            // 3. นับจำนวนที่อยู่ในตะกร้าของคนที่กำลังกดอยู่
            const cartN = pets.filter(p => p.service === "ทำหมันและวัคซีน").length;
            const cartV = pets.filter(p => p.service === "วัคซีนอย่างเดียว").length;

            // 4. เริ่มตรวจสอบเงื่อนไขทั้งหมดก่อนยอมให้บันทึก
            if (service === "ทำหมันและวัคซีน") {
                // เช็ก 4.1: โควตารวมของโครงการเต็มหรือยัง?
                if ((currentN + cartN) >= maxN) {
                    alert(`ขออภัยครับ โควตา "ทำหมัน" เต็มแล้ว (${maxN} คิว)`);
                    return resetAddBtn(btnAdd);
                }

                // เช็ก 4.2: บ้านเลขที่นี้ใช้สิทธิ์เกิน 2 ตัวหรือยัง?
                const hNo = document.getElementById("house-no").value;
                const vNo = document.getElementById("village-no").value;
                if(!hNo || !vNo) {
                    alert("กรุณาย้อนกลับไปกรอกบ้านเลขที่และหมู่ในหน้าแรกก่อนครับ");
                    return resetAddBtn(btnAdd);
                }

                const searchKey = `${hNo}-${vNo}`;
                const q = query(collection(db, "pets"), where("house_village_search", "==", searchKey));
                const snap = await getDocs(q);
                
                let dbNeuterCount = 0;
                snap.forEach(d => {
                    const p = d.data();
                    if(p.status !== "cancelled" && p.service_type === "ทำหมันและวัคซีน") dbNeuterCount++;
                });

                if ((dbNeuterCount + cartN) >= 2) {
                    alert("ขออภัยครับ บ้านเลขที่นี้ใช้สิทธิ์ทำหมันครบ 2 ตัวตามโควตาแล้ว");
                    return resetAddBtn(btnAdd);
                }

            } else if (service === "วัคซีนอย่างเดียว") {
                // เช็ก 4.3: โควตาฉีดวัคซีนเต็มหรือยัง?
                if ((currentV + cartV) >= maxV) {
                    alert(`ขออภัยครับ โควตา "ฉีดวัคซีน" เต็มแล้ว (${maxV} คิว)`);
                    return resetAddBtn(btnAdd);
                }
            }

            // หากผ่านเงื่อนไขทุกอย่าง ให้นำเข้าตะกร้าได้
            pets.push({ name, type, gender, service, signed: false });
            document.getElementById("pet-name").value = "";
            document.getElementById("pet-type").value = "";
            document.getElementById("pet-gender").value = "";
            document.getElementById("service-type").value = "";
            updatePetListUI();

        } catch(e) {
            console.error(e);
            alert("เกิดข้อผิดพลาดในการตรวจสอบโควตา");
        } finally {
            resetAddBtn(btnAdd);
        }
    });
    
    document.getElementById("btn-go-consent").addEventListener("click", () => changeStep("3"));
}

function resetAddBtn(btnElement) {
    btnElement.textContent = "+ บันทึกข้อมูลสัตว์ตัวนี้";
    btnElement.disabled = false;
}

function updatePetListUI() {
    const c = document.getElementById("pet-list-container");
    const b = document.getElementById("btn-go-consent");
    c.innerHTML = "";
    pets.forEach((p, i) => {
        c.insertAdjacentHTML('beforeend', `<div class="pet-item"><strong>${i+1}. ${p.name}</strong> (${p.type} ${p.gender})<br><span style="color:#D4AF37;">บริการ: ${p.service}</span><button type="button" class="remove-btn" onclick="removePet(${i})">❌ ลบ</button></div>`);
    });
    b.style.opacity = pets.length > 0 ? "1" : "0.5";
    b.style.pointerEvents = pets.length > 0 ? "auto" : "none";
}
window.removePet = function(index) { pets.splice(index, 1); updatePetListUI(); }

// ==========================================
// 5. ระบบประชาชน: ใบยินยอม & ลายเซ็น
// ==========================================
function renderConsentForms() {
    const c = document.getElementById("dynamic-consent-container");
    c.innerHTML = ""; canvasInstances = [];
    
    // [แก้ไข Syntax Error ตรงนี้: เปลี่ยนจากใช้ " " เป็น ` ` (Backtick) เพื่อให้พิมพ์แบบหลายบรรทัดได้]
    const legalText = `ข้าพเจ้ายินยอมให้เจ้าหน้าที่ของปศุสัตว์จังหวัดสมุทรปราการทำการวางยาสลบเพื่อการผ่าตัดสัตว์ ซึ่งการวางยาสลบอาจมีผลข้างเคียงของยาเกิดขึ้น หากสัตว์ดังกล่าวได้รับอันตรายถึงชีวิตและเจ้าหน้าที่ได้ให้ความช่วยเหลืออย่างเต็มที่แล้ว ภายใต้จรรยาบรรณของการประกอบวิชาชีพสัตวแพทย์ ข้าพเจ้าจะรับผิดชอบดูแลแผลหลังการผ่าตัดตามคำแนะนำการดูแลสัตว์ภายหลังการผ่าตัดอย่างเคร่งครัด หากเกิดการผิดพลาดในการวางยาสลบ การผ่าตัด และไม่ว่าในกรณีใดๆ ข้าพเจ้าจะไม่เรียกร้องหรือฟ้องดำเนินคดีในทางอาญาและทางเพ่งกับเจ้าหน้าที่และส่วนราชการสังกัดของกรมปศุสัตว์แต่อย่างใด
เจ้าหน้าที่ของปศุสัตว์จังหวัดสมุทรปราการ ได้อธิบายและข้าพเจ้าได้อ่านข้อความเข้าใจโดยตลอดแล้ว จึงลงลายมือไว้เป็นหลักฐาน (ออกให้โดยเทศบาลเมืองบางแก้วได้รับการวางยาสลบจากเจ้าหน้าที่ ปศุสัตว์จังหวัดสมุทรปราการ)`;
    
    pets.forEach((p, i) => {
        c.insertAdjacentHTML('beforeend', `<div class="card neumorphic"><h3 class="section-title">ใบยินยอม ${i+1}: ${p.name}</h3><div class="terms-box neumorphic-inner"><p>${legalText}</p></div><div class="input-group checkbox-group"><input type="checkbox" id="accept-${i}" class="neumorphic-checkbox" onchange="toggleSignature(${i})"><label for="accept-${i}">ข้าพเจ้ายอมรับเงื่อนไข</label></div><div id="sig-section-${i}" class="disabled-section"><label>ลงลายมือชื่อเจ้าของ</label><canvas id="canvas-${i}" class="signature-pad"></canvas><button type="button" class="clear-btn" onclick="clearCanvas(${i})">ลบลายเซ็น</button></div></div>`);
    });
    setTimeout(() => { pets.forEach((_, i) => initCanvas(i)); checkAllSigned(); }, 300);
}

window.toggleSignature = function(i) {
    document.getElementById(`sig-section-${i}`).classList.toggle("active", document.getElementById(`accept-${i}`).checked);
    checkAllSigned();
}

function initCanvas(i) {
    const c = document.getElementById(`canvas-${i}`);
    if(!c) return;
    c.width = c.offsetWidth; c.height = c.offsetHeight;
    const ctx = c.getContext("2d");
    ctx.strokeStyle = "#141E30"; ctx.lineWidth = 3; ctx.lineCap = "round";
    let drawing = false;
    const pos = (e) => { const r = c.getBoundingClientRect(); return { x: (e.clientX||(e.touches&&e.touches[0].clientX))-r.left, y: (e.clientY||(e.touches&&e.touches[0].clientY))-r.top }; };
    const start = (e) => { drawing = true; draw(e); };
    const stop = () => { drawing = false; ctx.beginPath(); checkAllSigned(); };
    const draw = (e) => { if(!drawing)return; e.preventDefault(); const p=pos(e); ctx.lineTo(p.x,p.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(p.x,p.y); };
    c.addEventListener("mousedown", start); c.addEventListener("mouseup", stop); c.addEventListener("mousemove", draw);
    c.addEventListener("touchstart", start, {passive:false}); c.addEventListener("touchend", stop); c.addEventListener("touchmove", draw, {passive:false});
    canvasInstances[i] = { canvas: c, ctx };
}
window.clearCanvas = function(i) { canvasInstances[i].ctx.clearRect(0,0,canvasInstances[i].canvas.width,canvasInstances[i].canvas.height); checkAllSigned(); }

function checkAllSigned() {
    let valid = true;
    pets.forEach((_, i) => {
        const checked = document.getElementById(`accept-${i}`).checked;
        const c = canvasInstances[i]?.canvas;
        const blank = document.createElement('canvas'); if(c) { blank.width=c.width; blank.height=c.height; }
        if(!checked || !c || c.toDataURL() === blank.toDataURL()) valid = false;
    });
    document.getElementById("btn-submit").disabled = !valid;
}

// ==========================================
// ฟังก์ชันบันทึกข้อมูลและส่งข้อความ LINE
// ==========================================
function setupFinalSubmit() {
    document.getElementById("btn-submit").addEventListener("click", async () => {
        document.getElementById("btn-submit").disabled = true;
        document.getElementById("btn-submit").textContent = "กำลังบันทึกข้อมูล...";
        
        try {
            const allPetsSnap = await getDocs(collection(db, "pets"));
            let currentQ = 0;
            allPetsSnap.forEach(d => { if(d.data().status !== "cancelled") currentQ++; });

            const hn = document.getElementById("house-no").value, vn = document.getElementById("village-no").value;
            const rental = document.getElementById("is-rental").checked;
            
            await setDoc(doc(db, "users", userProfileData.userId), {
                owner_name: document.getElementById("owner-name").value,
                phone_number: document.getElementById("phone-number").value,
                house_no: hn, village_no: vn, is_rental: rental, room_no: rental ? document.getElementById("room-no").value : "",
                line_displayName: userProfileData.displayName, updated_at: serverTimestamp()
            });

            for (let i=0; i<pets.length; i++) {
                await addDoc(collection(db, "pets"), {
                    owner_uid: userProfileData.userId,
                    house_village_search: `${hn}-${vn}`,
                    pet_name: pets[i].name, pet_type: pets[i].type, pet_gender: pets[i].gender, service_type: pets[i].service,
                    status: "booked", consent_agreed: true, signature_base64: canvasInstances[i].canvas.toDataURL("image/png"), signed_timestamp: serverTimestamp()
                });
            }

            let queueText = "";
            if (pets.length === 1) queueText = `${currentQ + 1}`;
            else queueText = `${currentQ + 1} ถึง ${currentQ + pets.length}`;
            
            let petNames = pets.map(p => p.name).join(", ");

            if (liff.isInClient()) {
                await liff.sendMessages([
                    {
                        type: "text",
                        text: `✅ ยืนยันการลงทะเบียน (จองสิทธิ์สำเร็จ)\nลำดับคิวจองสิทธิ์ที่: ${queueText}\n🏠 บ้านเลขที่: ${hn} หมู่ ${vn}\n🐾 ชื่อสัตว์เลี้ยง: น้อง${petNames}\n(ระบบได้บันทึกใบยินยอมและลายเซ็นของท่านเรียบร้อยแล้ว)\n\n📌 ข้อปฏิบัติและการเตรียมตัวก่อนทำหมัน\n1. งดน้ำ-งดอาหารสัตว์อย่างน้อย 12 ชั่วโมง (ก่อนทำหมัน) และขังสัตว์ไว้ในพื้นที่มิดชิดไม่สามารถออกมากินอาหารได้\n2. สัตว์ที่มาทำหมันต้องสุขภาพดี ไม่ผอม ไม่ป่วย\n3. อายุสัตว์ที่มาทำหมันต้องอายุตั้งแต่ 6-8 เดือนขึ้นไป\n4. สุนัขเพศเมียที่มาทำหมัน ไม่ควรเป็นสัด (อวัยวะเพศบวมแดง) และมีประจำเดือน เพราะจะทำให้เสียเลือดมาก\n5. สุนัขและแมวที่เพิ่งคลอดลูก ควรพักมดลูก 2 เดือน เพราะถ้ามาทำหมันหลังคลอดเลยจะทำให้มดลูกเปื่อยและขาดได้\n6. ถ้ารู้ว่าสัตว์ท้องไม่ควรนำมาทำหมัน หรือถ้าหมอผ่าแล้วเจอจะเย็บปิดทันที\n7. ⚠️ ลำดับคิวที่ท่านได้รับนี้ เป็นเพียง "คิวการจองสิทธิ์" เท่านั้น ท่านจะต้องมาติดต่อรับ "บัตรคิวผ่าตัดทำหมัน" ที่หน้างานก่อนเวลา 10.00 น. ของวันเข้ารับบริการ\n8. กรุณาแสดงข้อความนี้แก่เจ้าหน้าที่ในวันรับบริการ (เจ้าหน้าที่จะตรวจสอบข้อมูลและลายเซ็นจากระบบ)`
                    }
                ]);
            }

            alert("ลงทะเบียนสำเร็จ!");
            
            // เช็กว่าแอดมินกำลังใช้งานอยู่หรือไม่
            const btnBackAdmin = document.getElementById("btn-back-to-admin");
            if (btnBackAdmin && btnBackAdmin.style.display === "block") {
                // หากแอดมินกรอกให้ -> รีเซ็ตฟอร์มกลับหน้าแรก ไม่ต้องปิดหน้าต่าง
                document.getElementById("btn-submit").disabled = false; 
                document.getElementById("btn-submit").textContent = "ยืนยันการลงทะเบียน";
                document.getElementById("registration-form").reset();
                pets = [];
                updatePetListUI();
                changeStep("0");
                loadDashboardData();
            } else {
                // หากประชาชนกรอกเอง -> ปิดหน้าต่าง LINE อัตโนมัติ
                liff.closeWindow();
            }

        } catch (e) { 
            console.error(e);
            alert("เกิดข้อผิดพลาด"); 
            document.getElementById("btn-submit").disabled = false; 
            document.getElementById("btn-submit").textContent = "ยืนยันการลงทะเบียน";
        }
    });
}

// ==========================================
// 6. ระบบเจ้าหน้าที่: Login & Sidebar
// ==========================================
function setupAdminLogin() {
    const btnStaff = document.getElementById("btn-staff-login");
    const modal = document.getElementById("secret-modal");
    if(btnStaff) btnStaff.addEventListener("click", () => modal.style.display = "flex");
    
    document.getElementById("btn-close-secret").addEventListener("click", () => {
        modal.style.display = "none"; document.getElementById("secret-input").value = "";
    });

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

function setupSidebarAndSettings() {
    const sidebar = document.getElementById("admin-sidebar");
    document.querySelectorAll(".hamburger-btn").forEach(btn => {
        btn.addEventListener("click", () => sidebar.style.right = "0");
    });
    document.getElementById("btn-close-sidebar").addEventListener("click", () => sidebar.style.right = "-250px");

    document.getElementById("menu-checkin").addEventListener("click", () => switchAdminView("admin-container"));
    document.getElementById("menu-report").addEventListener("click", () => {
        switchAdminView("report-container"); generateReport();
    });
    document.getElementById("menu-user-list").addEventListener("click", () => {
        switchAdminView("user-list-container"); loadUserList();
    });
    document.getElementById("menu-settings").addEventListener("click", () => {
        switchAdminView("settings-container"); loadAdminSettings();
    });

    // เมนูสำหรับลงทะเบียนแทนประชาชน
    const menuProxy = document.getElementById("menu-register-proxy");
    if(menuProxy) {
        menuProxy.addEventListener("click", () => {
            document.querySelectorAll(".admin-view").forEach(el => el.style.display = "none");
            sidebar.style.right = "-250px"; // ปิด Sidebar
            
            document.getElementById("app-container").style.display = "block"; // เปิดหน้าฟอร์มประชาชน
            document.getElementById("btn-back-to-admin").style.display = "block"; // โชว์ปุ่มกลับ
            
            // รีเซ็ตฟอร์มให้ว่างเปล่า พร้อมสำหรับลงทะเบียนให้คนใหม่
            document.getElementById("registration-form").reset();
            pets = []; 
            updatePetListUI();
            changeStep("0"); 
            loadDashboardData();
        });
    }

    // ปุ่มกลับหน้าแอดมินจากหน้าลงทะเบียน
    const btnBackAdmin = document.getElementById("btn-back-to-admin");
    if(btnBackAdmin) {
        btnBackAdmin.addEventListener("click", () => {
            document.getElementById("app-container").style.display = "none";
            btnBackAdmin.style.display = "none";
            switchAdminView("admin-container"); 
        });
    }

    document.getElementById("btn-save-settings").addEventListener("click", async () => {
        const btn = document.getElementById("btn-save-settings");
        btn.disabled = true; btn.textContent = "กำลังบันทึก...";
        try {
            await setDoc(doc(db, "system_config", "main_config"), {
                start_date: document.getElementById("setting-start-date").value, 
                end_date: document.getElementById("setting-end-date").value, 
                service_date: document.getElementById("setting-date").value,
                service_location: document.getElementById("setting-location").value,
                quota_neuter: parseInt(document.getElementById("setting-quota-neuter").value) || 0,
                quota_vaccine: parseInt(document.getElementById("setting-quota-vaccine").value) || 0
            }, { merge: true });
            alert("บันทึกการตั้งค่าแล้ว"); switchAdminView("admin-container");
        } catch (e) { alert("เกิดข้อผิดพลาด"); } finally { btn.disabled = false; btn.textContent = "💾 บันทึกการตั้งค่า"; }
    });
}
window.switchAdminView = function(viewId) {
    document.querySelectorAll(".admin-view").forEach(el => el.style.display = "none");
    document.getElementById(viewId).style.display = "block";
    document.getElementById("admin-sidebar").style.right = "-250px";
}

async function loadAdminSettings() {
    try {
        const configDoc = await getDoc(doc(db, "system_config", "main_config"));
        if(configDoc.exists()) {
            const c = configDoc.data();
            document.getElementById("setting-start-date").value = c.start_date || "";
            document.getElementById("setting-end-date").value = c.end_date || "";
            document.getElementById("setting-date").value = c.service_date || "";
            document.getElementById("setting-location").value = c.service_location || "";
            document.getElementById("setting-quota-neuter").value = c.quota_neuter || 100;
            document.getElementById("setting-quota-vaccine").value = c.quota_vaccine || 300;
        }
    } catch (e) { console.error(e); }
}

// ==========================================
// 7. ระบบเจ้าหน้าที่: Check-in & พิมพ์ A4 แบบใบเดียว
// ==========================================
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
                window.currentSearchPets[docId] = pet;
                
                const badge = pet.consent_agreed ? `<span class="status-badge badge-green" style="cursor:pointer;" onclick="viewConsent('${docId}')">📄 เซ็นแล้ว (กดดู)</span>` : `<span class="status-badge badge-red">📄 ยังไม่เซ็น</span>`;
                const isCheckedIn = pet.status === "checked_in";
                const cText = isCheckedIn ? "ยกเลิกติ๊กถูก" : "✔ ติ๊กรับบริการ";
                const cardClass = isCheckedIn ? "admin-card checked" : "admin-card";
                const bStyle = isCheckedIn ? "background: transparent; color: #ff6b6b; border: 1px solid #ff6b6b;" : "";

                res.insertAdjacentHTML('beforeend', `
                    <div class="${cardClass}" id="card-${docId}">
                        <div style="flex: 1;">
                            <strong style="color: #D4AF37; font-size: 16px;">น้อง${pet.pet_name}</strong> 
                            <br><span style="color:#A0B0C0; font-size: 14px;">(${pet.pet_type} ${pet.pet_gender} - ${pet.service_type})</span>
                            <br>${badge}
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 5px;">
                            <button type="button" class="neumorphic-btn gold-btn" style="padding: 8px; font-size: 13px; ${bStyle}" onclick="toggleCheckIn('${docId}', ${!isCheckedIn})">${cText}</button>
                            <button type="button" class="neumorphic-btn outline-btn" style="padding: 8px; font-size: 13px; color: #81A1C1; border-color: #81A1C1;" onclick="printConsentA4('${docId}')">🖨️ พิมพ์ใบยินยอม</button>
                        </div>
                    </div>
                `);
            });
        } catch (e) { console.error(e); res.innerHTML = "<p>เกิดข้อผิดพลาด</p>"; }
    });

    searchInput.addEventListener("keypress", (e) => { if (e.key === "Enter") { e.preventDefault(); searchBtn.click(); } });
}

window.toggleCheckIn = async function(docId, toCheckIn) {
    try { await updateDoc(doc(db, "pets", docId), { status: toCheckIn ? "checked_in" : "booked" }); document.getElementById("btn-admin-search").click(); } 
    catch (e) { alert("อัปเดตไม่สำเร็จ"); }
}

window.viewConsent = function(docId) {
    const p = window.currentSearchPets[docId];
    if (p && p.signature_base64) {
        document.getElementById("consent-pet-name").textContent = `ข้อมูล: น้อง${p.pet_name}`;
        document.getElementById("consent-signature-img").src = p.signature_base64;
        document.getElementById("consent-modal").style.display = "flex";
    } else alert("ไม่พบข้อมูลลายเซ็น");
}

window.printConsentA4 = async function(docId) {
    const pet = window.currentSearchPets[docId];
    if(!pet || !pet.signature_base64) return alert("ไม่สามารถพิมพ์ได้ เนื่องจากยังไม่มีลายเซ็น");
    try {
        // หาอันดับคิว (จัดเรียงตามเวลาที่เซ็น)
        const snapAll = await getDocs(collection(db, "pets"));
        let allPets = [];
        snapAll.forEach(d => {
            const p = d.data();
            if(p.status !== "cancelled" && p.signature_base64 && p.consent_agreed) {
                allPets.push({ id: d.id, time: p.signed_timestamp ? p.signed_timestamp.toMillis() : 0 });
            }
        });
        allPets.sort((a,b) => a.time - b.time);
        const qIndex = allPets.findIndex(p => p.id === docId);
        const queueNo = qIndex !== -1 ? qIndex + 1 : "-";

        const userSnap = await getDoc(doc(db, "users", pet.owner_uid));
        if(!userSnap.exists()) return alert("ไม่พบข้อมูลเจ้าของ");
        const user = userSnap.data();

        document.getElementById("p-queue-no").textContent = `คิวที่: ${queueNo}`;
        document.getElementById("p-owner-name").textContent = user.owner_name;
        document.getElementById("p-owner-name-sig").textContent = user.owner_name;
        document.getElementById("p-phone").textContent = user.phone_number;
        document.getElementById("p-house").textContent = user.house_no;
        document.getElementById("p-village").textContent = user.village_no;
        document.getElementById("p-pet-name").textContent = pet.pet_name;
        document.getElementById("p-pet-type").textContent = pet.pet_type;
        document.getElementById("p-pet-gender").textContent = pet.pet_gender;
        document.getElementById("p-signature").src = pet.signature_base64;

        document.body.classList.add('print-consent-mode');
        window.print();
        document.body.classList.remove('print-consent-mode');
    } catch (e) { console.error(e); alert("เกิดข้อผิดพลาดในการดึงข้อมูล"); }
}

// ==========================================
// 8. ระบบเจ้าหน้าที่: พิมพ์ A4 ทั้งหมดรวดเดียว (Batch Print)
// ==========================================
function setupPrintAllConsents() {
    const btnPrintAll = document.getElementById("btn-print-all-consents");
    if(btnPrintAll) {
        btnPrintAll.addEventListener("click", async () => {
            btnPrintAll.textContent = "กำลังโหลดข้อมูล...";
            btnPrintAll.disabled = true;

            try {
                const snap = await getDocs(collection(db, "pets"));
                let validPets = [];
                snap.forEach(d => {
                    const pet = d.data();
                    if(pet.status !== "cancelled" && pet.signature_base64 && pet.consent_agreed) {
                        validPets.push({ id: d.id, ...pet });
                    }
                });

                // เรียงตามเวลาที่เซ็น เพื่อรันคิว
                validPets.sort((a, b) => {
                    const tA = a.signed_timestamp ? a.signed_timestamp.toMillis() : 0;
                    const tB = b.signed_timestamp ? b.signed_timestamp.toMillis() : 0;
                    return tA - tB;
                });

                if(validPets.length === 0) {
                    alert("ยังไม่มีข้อมูลผู้ที่เซ็นใบยินยอม");
                    btnPrintAll.textContent = "🖨️ พิมพ์ใบยินยอมทั้งหมด (เรียงตามคิว)";
                    btnPrintAll.disabled = false;
                    return;
                }

                // โหลดข้อมูล User ทั้งหมดมาเก็บไว้ (จะได้ไม่ต้องดึงทีละคน)
                const usersCache = {};
                const usersSnap = await getDocs(collection(db, "users"));
                usersSnap.forEach(u => { usersCache[u.id] = u.data(); });

                const container = document.getElementById("print-all-consents-container");
                container.innerHTML = ""; // เคลียร์กล่อง

                // สร้าง HTML ใส่กระดาษทีละหน้า
                validPets.forEach((pet, index) => {
                    const user = usersCache[pet.owner_uid] || {};
                    const queueNo = index + 1;
                    
                    const html = `
                    <div class="consent-page">
                        <div class="queue-badge">คิวที่: ${queueNo}</div>
                        <h2 style="text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 5px;">ใบยินยอมผ่าตัดทำหมัน</h2>
                        <h3 style="text-align: center; font-size: 18px; margin-bottom: 30px;">กับเทศบาลเมืองบางแก้ว ร่วมกับปศุสัตว์จังหวัดสมุทรปราการ</h3>
                        
                        <div style="font-size: 16px; line-height: 2;">
                            <p><strong>ข้าพเจ้า (ชื่อเจ้าของ):</strong> <span>${user.owner_name || "-"}</span></p>
                            <p><strong>เบอร์โทรศัพท์:</strong> <span>${user.phone_number || "-"}</span></p>
                            <p><strong>ที่อยู่ปัจจุบัน:</strong> บ้านเลขที่ <span>${user.house_no || "-"}</span> หมู่ที่ <span>${user.village_no || "-"}</span> ตำบลบางแก้ว อำเภอบางพลี จังหวัดสมุทรปราการ</p>
                            
                            <p style="margin-top: 15px;"><strong>มีความประสงค์ขอรับบริการทำหมัน/ฉีดวัคซีน ให้แก่สัตว์เลี้ยงดังนี้:</strong></p>
                            <p><strong>ชื่อสัตว์เลี้ยง:</strong> <span>${pet.pet_name}</span> &nbsp;&nbsp;&nbsp; <strong>ประเภท:</strong> <span>${pet.pet_type}</span> &nbsp;&nbsp;&nbsp; <strong>เพศ:</strong> <span>${pet.pet_gender}</span></p>

                            <p style="margin-top: 30px; text-indent: 40px; text-align: justify;">
                                ข้าพเจ้ายินยอมให้สัตวแพทย์ดำเนินการผ่าตัดทำหมัน โดยรับทราบความเสี่ยงที่อาจเกิดภาวะแทรกซ้อนจากการวางยาสลบ หรือปัจจัยทางสุขภาพของสัตว์เลี้ยงที่มองไม่เห็นภายนอก ซึ่งสัตวแพทย์ผู้ปฏิบัติทำการผ่าตัดทำหมันได้ปฏิบัติถูกต้องตามหลักวิชาการ หากสัตว์ของข้าพเจ้าตาย หรือเกิดความผิดปกติใดๆ ในระหว่างการดำเนินการหลังการผ่าตัด การผ่าตัดทำหมัน และ/หรือ ฉีดวัคซีนป้องกันโรคพิษสุนัขบ้าให้แก่สัตว์เลี้ยง ข้าพเจ้าจะไม่ถือว่าเป็นความผิดของเจ้าหน้าที่และจะไม่เอาผิด หรือเรียกร้องค่าเสียหายใดๆกับเจ้าหน้าที่ ข้าพเจ้าขอลงลายมือชื่อไว้เป็นหลักฐาน
                            </p>
                        </div>

                        <div style="margin-top: 50px; text-align: center;">
                            <img src="${pet.signature_base64}" style="max-height: 100px; display: block; margin: 0 auto; border-bottom: 1px dotted #000;">
                            <p style="margin-top: 10px;">(ลงชื่อ) .............................................................. ผู้ยินยอม</p>
                            <p style="margin-top: 5px;">(<span>${user.owner_name || "-"}</span>)</p>
                        </div>
                    </div>
                    `;
                    container.insertAdjacentHTML('beforeend', html);
                });

                document.body.classList.add('print-all-consents-mode');
                window.print();
                document.body.classList.remove('print-all-consents-mode');

            } catch(e) {
                console.error(e); alert("เกิดข้อผิดพลาดในการโหลดข้อมูล");
            } finally {
                btnPrintAll.textContent = "🖨️ พิมพ์ใบยินยอมทั้งหมด (เรียงตามคิว)";
                btnPrintAll.disabled = false;
            }
        });
    }
}

// ==========================================
// 9. ระบบเจ้าหน้าที่: รายงานสรุป PDF
// ==========================================
function setupReportPrint() {
    const btnPrint = document.getElementById("btn-print-report");
    if(btnPrint) {
        btnPrint.addEventListener("click", () => {
            document.body.classList.add('print-report-mode');
            window.print();
            document.body.classList.remove('print-report-mode');
        });
    }
}

async function generateReport() {
    try {
        const snap = await getDocs(collection(db, "pets"));
        const stats = {
            r: { n: { d: { m:0, f:0 }, c: { m:0, f:0 } }, v: { d: { m:0, f:0 }, c: { m:0, f:0 } } },
            c: { n: { d: { m:0, f:0 }, c: { m:0, f:0 } }, v: { d: { m:0, f:0 }, c: { m:0, f:0 } } }
        };

        snap.forEach((d) => {
            const p = d.data();
            if (p.status === "cancelled") return;
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

// ==========================================
// 10. ระบบเจ้าหน้าที่: ตรวจสอบรายชื่อ & ติดตามคิว
// ==========================================
window.userListData = []; // ตัวแปรเก็บข้อมูลเพื่อใช้ฟิลเตอร์

async function loadUserList() {
    const tbody = document.querySelector("#table-user-list tbody");
    tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; color:#D4AF37;'>กำลังโหลดข้อมูล...</td></tr>";
    
    try {
        const [usersSnap, petsSnap] = await Promise.all([
            getDocs(collection(db, "users")),
            getDocs(collection(db, "pets"))
        ]);

        // 1. นำข้อมูล User มาทำเป็น Cache ไว้ค้นหาชื่อและเบอร์โทรอย่างรวดเร็ว
        const usersCache = {};
        usersSnap.forEach(d => {
            usersCache[d.id] = d.data();
        });

        const houseStats = {}; // ใช้จัดกลุ่มตาม UID + บ้านเลขที่

        // 2. วนลูปสัตว์เลี้ยงทั้งหมด เพื่อแยกกลุ่มตามบ้านเลขที่
        petsSnap.forEach(d => {
            const p = d.data();
            if(p.status === "cancelled") return; // ข้ามตัวที่ยกเลิก
            
            const uid = p.owner_uid;
            const user = usersCache[uid] || {};
            
            // ใช้บ้านเลขที่ของสัตว์เลี้ยงตัวนั้นๆ เป็นคีย์ (ถ้าไม่มีให้ดึงจากโปรไฟล์เจ้าของ)
            const rawAddress = p.house_village_search || `${user.house_no}-${user.village_no}`;
            
            // คีย์สำหรับจัดกลุ่ม: รหัสคนลงทะเบียน + บ้านเลขที่
            const groupKey = `${uid}_${rawAddress}`;

            // ถ้ายังไม่มีกลุ่มของบ้านหลังนี้ ให้สร้างใหม่
            if(!houseStats[groupKey]) {
                let displayAddress = "ไม่ระบุ";
                if(rawAddress.includes("-")) {
                    const parts = rawAddress.split("-");
                    displayAddress = `${parts[0]} ม.${parts[1]}`;
                } else {
                    displayAddress = rawAddress;
                }

                houseStats[groupKey] = {
                    name: user.owner_name || "ไม่ระบุ",
                    phone: user.phone_number || "-",
                    address: displayAddress,
                    n_booked: 0, v_booked: 0,
                    n_checked: 0, v_checked: 0,
                    total_booked: 0, total_checked: 0
                };
            }

            // นับยอดตามบริการและสถานะ แยกใส่บ้านใครบ้านมัน
            if(p.status === "booked") {
                houseStats[groupKey].total_booked++;
                if(p.service_type === "ทำหมันและวัคซีน") houseStats[groupKey].n_booked++;
                if(p.service_type === "วัคซีนอย่างเดียว") houseStats[groupKey].v_booked++;
            } else if(p.status === "checked_in") {
                houseStats[groupKey].total_checked++;
                if(p.service_type === "ทำหมันและวัคซีน") houseStats[groupKey].n_checked++;
                if(p.service_type === "วัคซีนอย่างเดียว") houseStats[groupKey].v_checked++;
            }
        });

        // 3. แปลงเป็น Array เพื่อนำไปแสดงผล
        window.userListData = Object.values(houseStats).filter(u => (u.total_booked + u.total_checked) > 0);
        
        renderUserTable(); 
    } catch(e) {
        console.error(e);
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; color:#ff6b6b;'>เกิดข้อผิดพลาดในการดึงข้อมูล</td></tr>";
    }
}

window.renderUserTable = function() {
    const filter = document.getElementById("filter-user-status").value;
    const tbody = document.querySelector("#table-user-list tbody");
    tbody.innerHTML = "";
    
    let count = 0;
    window.userListData.forEach(u => {
        if (filter === "pending" && u.total_booked === 0) return; 
        if (filter === "completed" && (u.total_booked > 0 || u.total_checked === 0)) return; 
        
        count++;
        
        // แยกบรรทัด ทำหมัน กับ วัคซีน ให้เห็นชัดเจน
        let serviceText = [];
        let totalN = u.n_booked + u.n_checked;
        let totalV = u.v_booked + u.v_checked;
        
        if(totalN > 0) serviceText.push(`<span style="color:#D4AF37;">ทำหมัน: ${totalN} ตัว</span>`);
        if(totalV > 0) serviceText.push(`<span style="color:#A0B0C0;">วัคซีน: ${totalV} ตัว</span>`);

        // แยกสถานะการเข้ารับบริการ
        let statusText = [];
        if(u.total_booked > 0) statusText.push(`<span style="color:#ff6b6b; font-weight:bold;">⏳ รอรับบริการ: ${u.total_booked}</span>`);
        if(u.total_checked > 0) statusText.push(`<span style="color:#50E3C2; font-weight:bold;">✅ รับแล้ว: ${u.total_checked}</span>`);

        tbody.insertAdjacentHTML("beforeend", `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="text-align:left; font-weight: 600;">${u.name}</td>
                <td><a href="tel:${u.phone}" class="neumorphic-btn outline-btn" style="padding: 4px 8px; font-size: 12px; color:#D4AF37; border-color:#D4AF37; text-decoration:none;">📞 ${u.phone}</a></td>
                <td style="font-size: 15px;">${u.address}</td>
                <td style="line-height: 1.6; font-size: 14px;">${serviceText.join("<br>")}</td>
                <td style="line-height: 1.6; font-size: 14px;">${statusText.join("<br>")}</td>
            </tr>
        `);
    });

    if (count === 0) {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center;'>ไม่พบข้อมูลที่ตรงกับเงื่อนไข</td></tr>";
    }
}
