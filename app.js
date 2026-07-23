import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, getDoc, updateDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 1. ตั้งค่า Firebase และ LIFF
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

document.addEventListener("DOMContentLoaded", () => {
    initializeLiff();
    setupNavigation();
    setupRentalLogic();
    setupPetSystem();
    setupFinalSubmit();
    setupAdminLogin(); // จัดการรหัสลับ
    setupAdminSearch(); // จัดการระบบค้นหาหน้างาน
});

async function initializeLiff() {
    try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) {
            liff.login();
        } else {
            userProfileData = await liff.getProfile();
            checkUserRole(); // เช็คว่าเป็นประชาชน หรือ แอดมิน
        }
    } catch (err) {
        console.error("LIFF Init Error", err);
    }
}

// ==========================================
// 2. ระบบตรวจสอบสิทธิ์เข้าใช้งาน (Role-based)
// ==========================================
async function checkUserRole() {
    try {
        // เช็คว่า LINE UID นี้อยู่ในคอลเลกชัน admins หรือไม่
        const adminDoc = await getDoc(doc(db, "admins", userProfileData.userId));
        document.getElementById("loading").style.display = "none";

        if(adminDoc.exists()) {
            // เป็นเจ้าหน้าที่ -> โชว์หน้า Admin Container
            document.getElementById("admin-container").style.display = "block";
        } else {
            // เป็นประชาชน -> โชว์หน้าลงทะเบียน
            document.getElementById("app-container").style.display = "block";
            loadDashboardData();
        }
    } catch (error) {
        console.error("Role Check Error", error);
    }
}

// ==========================================
// 3. ระบบล็อกอินสำหรับเจ้าหน้าที่ (Secret Code)
// ==========================================
function setupAdminLogin() {
    const btnStaff = document.getElementById("btn-staff-login");
    const modal = document.getElementById("secret-modal");
    const inputCode = document.getElementById("secret-input");

    btnStaff.addEventListener("click", () => modal.style.display = "flex");
    document.getElementById("btn-close-secret").addEventListener("click", () => {
        modal.style.display = "none";
        inputCode.value = "";
    });

    document.getElementById("btn-verify-secret").addEventListener("click", async () => {
        const code = inputCode.value;
        if(!code) return alert("กรุณากรอกรหัส");

        try {
            // ดึงรหัสลับที่แอดมินตั้งไว้ในระบบ
            const configDoc = await getDoc(doc(db, "system_config", "main_config"));
            if(configDoc.exists() && configDoc.data().admin_secret_code === code) {
                // รหัสถูกต้อง -> บันทึก UID ลงใน admins collection
                await setDoc(doc(db, "admins", userProfileData.userId), { 
                    role: "staff", 
                    name: userProfileData.displayName,
                    added_at: serverTimestamp() 
                });
                alert("ยืนยันตัวตนเจ้าหน้าที่สำเร็จ!");
                location.reload(); // โหลดหน้าใหม่เพื่อให้เข้าโหมดแอดมิน
            } else {
                alert("รหัสลับไม่ถูกต้อง");
            }
        } catch (error) {
            console.error("Verify Error", error);
        }
    });
}

// ==========================================
// 4. ระบบจัดการหน้างาน (Admin Check-in)
// ==========================================
// ตัวแปรเก็บข้อมูลชั่วคราวเพื่อให้กดดูใบยินยอมได้
window.currentSearchPets = {}; 

function setupAdminSearch() {
    const searchInput = document.getElementById("admin-search-input");
    const searchBtn = document.getElementById("btn-admin-search");

    searchBtn.addEventListener("click", async () => {
        const keyword = searchInput.value.trim();
        if(!keyword) return alert("กรุณาพิมพ์ บ้านเลขที่-หมู่");

        const resultContainer = document.getElementById("admin-result-container");
        resultContainer.innerHTML = "<p style='text-align:center; color:#D4AF37;'>กำลังค้นหา...</p>";

        try {
            const q = query(collection(db, "pets"), where("house_village_search", "==", keyword));
            const querySnapshot = await getDocs(q);

            if(querySnapshot.empty) {
                resultContainer.innerHTML = "<p style='text-align:center; color:#ff6b6b;'>ไม่พบข้อมูลการลงทะเบียนของบ้านเลขที่นี้</p>";
                return;
            }

            resultContainer.innerHTML = "";
            window.currentSearchPets = {}; // ล้างข้อมูลเก่าก่อนแสดงของใหม่

            querySnapshot.forEach((docSnap) => {
                const pet = docSnap.data();
                const docId = docSnap.id;
                
                // เก็บข้อมูลสัตว์เลี้ยงตัวนี้ลงตัวแปร Global เพื่อให้ดึงรูปลายเซ็นได้
                window.currentSearchPets[docId] = pet;
                
                // เช็คสัญลักษณ์ใบยินยอม และใส่ onclick ให้กดได้
                const consentBadge = pet.consent_agreed 
                    ? `<span class="status-badge badge-green" style="cursor:pointer;" onclick="viewConsent('${docId}')">📄 เซ็นใบยินยอมแล้ว (กดดู)</span>` 
                    : `<span class="status-badge badge-red">📄 ยังไม่เซ็น</span>`;

                const isCheckedIn = pet.status === "checked_in";
                const checkText = isCheckedIn ? "ยกเลิกติ๊กถูก" : "✔ ติ๊กรับบริการ";
                const cardClass = isCheckedIn ? "admin-card checked" : "admin-card";
                const btnStyle = isCheckedIn ? "background: transparent; color: #ff6b6b; border: 1px solid #ff6b6b;" : "";

                const html = `
                    <div class="${cardClass}" id="card-${docId}">
                        <div style="flex: 1;">
                            <strong style="color: #D4AF37; font-size: 16px;">น้อง${pet.pet_name}</strong> 
                            <br><span style="color:#A0B0C0; font-size: 14px;">(${pet.pet_type} ${pet.pet_gender} - ${pet.service_type})</span>
                            <br>${consentBadge}
                        </div>
                        <div>
                            <button type="button" class="neumorphic-btn gold-btn" style="padding: 10px; font-size: 14px; ${btnStyle}" onclick="toggleCheckIn('${docId}', ${!isCheckedIn})">
                                ${checkText}
                            </button>
                        </div>
                    </div>
                `;
                resultContainer.insertAdjacentHTML('beforeend', html);
            });
        } catch (error) {
            console.error("Search Error", error);
            resultContainer.innerHTML = "<p>เกิดข้อผิดพลาดในการดึงข้อมูล</p>";
        }
    });

    searchInput.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            searchBtn.click();
        }
    });
}

// ฟังก์ชันเปิดดูใบยินยอมและลายเซ็น (Global function)
window.viewConsent = function(docId) {
    const pet = window.currentSearchPets[docId];
    if (pet && pet.signature_base64) {
        document.getElementById("consent-pet-name").textContent = `ข้อมูล: น้อง${pet.pet_name}`;
        document.getElementById("consent-signature-img").src = pet.signature_base64;
        document.getElementById("consent-modal").style.display = "flex";
    } else {
        alert("ไม่พบข้อมูลลายเซ็นของสัตว์เลี้ยงตัวนี้");
    }
}

window.toggleCheckIn = async function(docId, toCheckIn) {
    try {
        const newStatus = toCheckIn ? "checked_in" : "booked";
        await updateDoc(doc(db, "pets", docId), { status: newStatus });
        document.getElementById("btn-admin-search").click();
    } catch (error) {
        console.error("Check-in Error", error);
        alert("อัปเดตสถานะไม่สำเร็จ");
    }
}

// ==========================================
// 5. ระบบของประชาชน (Dashboard & Form Flow)
// ==========================================
async function loadDashboardData() {
    try {
        const configDoc = await getDoc(doc(db, "system_config", "main_config"));
        let maxNeuter = 100, maxVaccine = 300; 
        if(configDoc.exists()) {
            const c = configDoc.data();
            maxNeuter = c.quota_neuter || 100; maxVaccine = c.quota_vaccine || 300;
            const serviceInfo = [];
            if(c.service_date) serviceInfo.push(`📅 วันที่: ${c.service_date}`);
            if(c.service_location) serviceInfo.push(`📍 สถานที่: ${c.service_location}`);
            if(serviceInfo.length > 0) document.getElementById("txt-service-info").innerHTML = serviceInfo.join("<br>");
            else document.getElementById("txt-service-info").style.display = "none";
        }

        const petsSnap = await getDocs(collection(db, "pets"));
        let curNeuter = 0, curVaccine = 0;
        let myPetsHtml = "";
        
        petsSnap.forEach(d => {
            const data = d.data();
            if(data.status !== "cancelled") {
                if(data.service_type === "ทำหมันและวัคซีน") curNeuter++;
                if(data.service_type === "วัคซีนอย่างเดียว") curVaccine++;
                
                // ตรวจสอบว่าเป็นสัตว์เลี้ยงของฉันหรือไม่
                if(data.owner_uid === userProfileData.userId) {
                    const badge = data.status === "checked_in" ? `<span style="color:#50E3C2; font-size:12px;">(✅ รับบริการแล้ว)</span>` : ``;
                    const cancelBtn = data.status === "booked" ? `<button class="btn-cancel-pet" onclick="cancelMyPet('${d.id}')">❌ ยกเลิกสิทธิ์คืนโควตา</button>` : ``;
                    
                    myPetsHtml += `
                        <div class="pet-item">
                            <strong>${data.pet_name}</strong> ${badge}
                            <br><span style="color:#A0B0C0; font-size: 13px;">${data.pet_type} ${data.pet_gender} - ${data.service_type}</span>
                            <br>${cancelBtn}
                        </div>
                    `;
                }
            }
        });

        document.getElementById("txt-neuter-quota").textContent = `${curNeuter} / ${maxNeuter} คิว`;
        document.getElementById("bar-neuter").style.width = `${Math.min((curNeuter/maxNeuter)*100, 100)}%`;
        document.getElementById("txt-vaccine-quota").textContent = `${curVaccine} / ${maxVaccine} คิว`;
        document.getElementById("bar-vaccine").style.width = `${Math.min((curVaccine/maxVaccine)*100, 100)}%`;

        // แสดงรายการสัตว์เลี้ยงของฉัน
        if(myPetsHtml !== "") {
            document.getElementById("my-registered-pets").style.display = "block";
            document.getElementById("my-pets-list").innerHTML = myPetsHtml;
        } else {
            document.getElementById("my-registered-pets").style.display = "none";
        }

    } catch (error) { console.error(error); }
}

// ฟังก์ชันยกเลิกสิทธิ์
window.cancelMyPet = async function(docId) {
    if(confirm("คุณต้องการยกเลิกคิวนี้เพื่อคืนสิทธิ์ให้ผู้อื่น ใช่หรือไม่?")) {
        try {
            await updateDoc(doc(db, "pets", docId), { status: "cancelled" });
            alert("ยกเลิกสิทธิ์เรียบร้อยแล้ว โควตาได้ถูกส่งคืนสู่ระบบครับ");
            loadDashboardData(); // รีเฟรชหน้าจอใหม่
        } catch (e) {
            alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
        }
    }
}
function setupNavigation() {
    document.querySelectorAll('.btn-next').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const currentStep = e.target.closest('.step-content');
            const inputs = currentStep.querySelectorAll('input[required], select[required]');
            let isValid = true;
            inputs.forEach(i => { if (!i.value) isValid = false; });
            if (isValid) changeStep(e.target.getAttribute('data-next'));
            else alert("กรุณากรอกข้อมูลให้ครบ");
        });
    });
    document.querySelectorAll('.btn-back').forEach(btn => {
        btn.addEventListener('click', (e) => changeStep(e.target.getAttribute('data-back')));
    });
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
    document.getElementById("btn-add-pet").addEventListener("click", () => {
        const name = document.getElementById("pet-name").value;
        const type = document.getElementById("pet-type").value;
        const gender = document.getElementById("pet-gender").value;
        const service = document.getElementById("service-type").value;

        if(!name || !type || !gender || !service) return alert("กรุณากรอกข้อมูลสัตว์เลี้ยงให้ครบ");
        
        if (service === "ทำหมันและวัคซีน") {
            if (pets.filter(p => p.service === "ทำหมันและวัคซีน").length >= 2) {
                return alert("โควตาทำหมันจำกัดสิทธิ์ 2 ตัว/ครอบครัว");
            }
        }
        pets.push({ name, type, gender, service, signed: false });
        document.getElementById("pet-name").value = "";
        document.getElementById("pet-type").value = "";
        document.getElementById("pet-gender").value = "";
        document.getElementById("service-type").value = "";
        updatePetListUI();
    });
    document.getElementById("btn-go-consent").addEventListener("click", () => changeStep("3"));
}

function updatePetListUI() {
    const c = document.getElementById("pet-list-container");
    const b = document.getElementById("btn-go-consent");
    c.innerHTML = "";
    pets.forEach((p, i) => {
        c.insertAdjacentHTML('beforeend', `<div class="pet-item"><strong>${i+1}. ${p.name}</strong> (${p.type} ${p.gender})<br><span style="color:#D4AF37;">บริการ: ${p.service}</span><button class="remove-btn" onclick="removePet(${i})">❌</button></div>`);
    });
    b.style.opacity = pets.length > 0 ? "1" : "0.5";
    b.style.pointerEvents = pets.length > 0 ? "auto" : "none";
}
window.removePet = function(index) { pets.splice(index, 1); updatePetListUI(); }

function renderConsentForms() {
    const c = document.getElementById("dynamic-consent-container");
    c.innerHTML = ""; canvasInstances = [];
    const legalText = "ข้าพเจ้ายินยอมให้สัตวแพทย์ดำเนินการผ่าตัดทำหมัน โดยรับทราบความเสี่ยงที่อาจเกิดภาวะแทรกซ้อนจากการวางยาสลบ หรือปัจจัยทางสุขภาพของสัตว์เลี้ยงที่มองไม่เห็นภายนอก ซึ่งสัตวแพทย์ผู้ปฏิบัติทำการผ่าตัดทำหมันได้ปฏิบัติถูกต้องตามหลักวิชาการ หากสัตว์ของข้าพเจ้าตาย หรือเกิดความผิดปกติใดๆ ในระหว่างการดำเนินการหลังการผ่าตัด การผ่าตัดทำหมัน และ/หรือ ฉีดวัคซีนป้องกันโรคพิษสุนัขบ้าให้แก่สัตว์เลี้ยง ข้าพเจ้าจะไม่ถือว่าเป็นความผิดของเจ้าหน้าที่และจะไม่เอาผิด หรือเรียกร้องค่าเสียหายใดๆกับเจ้าหน้าที่ ข้าพเจ้าขอลงลายมือชื่อไว้เป็นหลักฐาน";
    
    pets.forEach((p, i) => {
        c.insertAdjacentHTML('beforeend', `<div class="card neumorphic"><h3 class="section-title">ใบยินยอม ${i+1}: ${p.name}</h3><div class="terms-box neumorphic-inner"><p>${legalText}</p></div><div class="input-group checkbox-group"><input type="checkbox" id="accept-${i}" class="neumorphic-checkbox" onchange="toggleSignature(${i})"><label for="accept-${i}">ข้าพเจ้ายอมรับเงื่อนไข</label></div><div id="sig-section-${i}" class="disabled-section"><label>ลงลายมือชื่อเจ้าของ</label><canvas id="canvas-${i}" class="signature-pad"></canvas><button class="clear-btn" onclick="clearCanvas(${i})">ลบลายเซ็น</button></div></div>`);
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

function setupFinalSubmit() {
    document.getElementById("btn-submit").addEventListener("click", async () => {
        document.getElementById("btn-submit").disabled = true;
        try {
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
            alert("ลงทะเบียนสำเร็จ!"); liff.closeWindow();
        } catch (e) { alert("เกิดข้อผิดพลาด"); document.getElementById("btn-submit").disabled = false; }
    });
}

// ==========================================
// 6. ระบบรายงานสรุปผล (Report & Export)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // ผูก Event ให้ปุ่มเปิดหน้ารายงาน (ถ้ามีปุ่ม)
    const btnOpenReport = document.getElementById("btn-open-report");
    if(btnOpenReport) {
        btnOpenReport.addEventListener("click", () => {
            document.getElementById("admin-container").style.display = "none";
            document.getElementById("report-container").style.display = "block";
            generateReport(); // สั่งดึงข้อมูลมาคำนวณ
        });
    }

    // ผูก Event ให้ปุ่มกลับหน้าเช็คอิน
    const btnBackAdmin = document.getElementById("btn-back-to-admin");
    if(btnBackAdmin) {
        btnBackAdmin.addEventListener("click", () => {
            document.getElementById("report-container").style.display = "none";
            document.getElementById("admin-container").style.display = "block";
        });
    }

    // ผูก Event ให้ปุ่ม Print/PDF
    const btnPrint = document.getElementById("btn-print-report");
    if(btnPrint) {
        btnPrint.addEventListener("click", () => {
            window.print(); // ใช้ฟังก์ชันพิมพ์ของบราวเซอร์เพื่อออกเป็น PDF
        });
    }
});

async function generateReport() {
    try {
        const querySnapshot = await getDocs(collection(db, "pets"));
        
        // โครงสร้างสำหรับเก็บตัวเลขสถิติ
        const stats = {
            registered: {
                neuter:  { dog: { m: 0, f: 0 }, cat: { m: 0, f: 0 } },
                vaccine: { dog: { m: 0, f: 0 }, cat: { m: 0, f: 0 } }
            },
            checkedIn: {
                neuter:  { dog: { m: 0, f: 0 }, cat: { m: 0, f: 0 } },
                vaccine: { dog: { m: 0, f: 0 }, cat: { m: 0, f: 0 } }
            }
        };

        // นับข้อมูลทีละแถว
        querySnapshot.forEach((docSnap) => {
            const pet = docSnap.data();
            if (pet.status === "cancelled") return; // ข้ามข้อมูลที่ถูกยกเลิกสิทธิ์

            // แปลงค่าให้เข้ากับคีย์ของ Object
            const sType = pet.service_type === "ทำหมันและวัคซีน" ? "neuter" : "vaccine";
            const pType = pet.pet_type === "สุนัข" ? "dog" : "cat";
            const pGen = pet.pet_gender === "ตัวผู้" ? "m" : "f";

            // 1. นับยอดลงทะเบียนทั้งหมด (สถานะ booked และ checked_in ก็นับรวม)
            stats.registered[sType][pType][pGen]++;

            // 2. นับยอดมารับบริการจริง (เฉพาะสถานะ checked_in)
            if (pet.status === "checked_in") {
                stats.checkedIn[sType][pType][pGen]++;
            }
        });

        // นำข้อมูลไปสร้างเป็นแถวในตาราง HTML
        renderTable("table-registered", stats.registered);
        renderTable("table-checked-in", stats.checkedIn);

    } catch (error) {
        console.error("Report Generation Error", error);
        alert("ดึงข้อมูลรายงานไม่สำเร็จ");
    }
}

function renderTable(tableId, dataObject) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    
    // ฟังก์ชันช่วยคำนวณผลรวมรายบรรทัด
    const rowTotal = (obj) => obj.dog.m + obj.dog.f + obj.cat.m + obj.cat.f;
    
    // ดึงค่าสถิติ
    const n = dataObject.neuter;
    const v = dataObject.vaccine;
    
    // คำนวณผลรวมทั้งหมด
    const totalNeuter = rowTotal(n);
    const totalVaccine = rowTotal(v);
    const grandTotal = totalNeuter + totalVaccine;

    tbody.innerHTML = `
        <tr>
            <td style="text-align: left;">ทำหมัน + ฉีดวัคซีน</td>
            <td>${n.dog.m}</td><td>${n.dog.f}</td>
            <td>${n.cat.m}</td><td>${n.cat.f}</td>
            <td style="font-weight: bold;">${totalNeuter}</td>
        </tr>
        <tr>
            <td style="text-align: left;">ฉีดวัคซีนอย่างเดียว</td>
            <td>${v.dog.m}</td><td>${v.dog.f}</td>
            <td>${v.cat.m}</td><td>${v.cat.f}</td>
            <td style="font-weight: bold;">${totalVaccine}</td>
        </tr>
        <tr style="background: rgba(212, 175, 55, 0.1); font-weight: bold;">
            <td>รวมสุทธิ</td>
            <td>${n.dog.m + v.dog.m}</td>
            <td>${n.dog.f + v.dog.f}</td>
            <td>${n.cat.m + v.cat.m}</td>
            <td>${n.cat.f + v.cat.f}</td>
            <td style="color: #D4AF37; font-size: 16px;">${grandTotal}</td>
        </tr>
    `;
}
// ==========================================
// 8. ระบบเมนู Sidebar และ ตั้งค่าระบบ (Settings)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    
    const sidebar = document.getElementById("admin-sidebar");
    
    // เปิด/ปิด Sidebar
    const btnOpenSidebar = document.getElementById("btn-open-sidebar");
    if(btnOpenSidebar) btnOpenSidebar.addEventListener("click", () => sidebar.style.right = "0");
    document.getElementById("btn-close-sidebar").addEventListener("click", () => sidebar.style.right = "-250px");

    // ผูก Event ให้เมนูต่างๆ
    document.getElementById("menu-checkin").addEventListener("click", () => switchAdminView("admin-container"));
    document.getElementById("menu-report").addEventListener("click", () => {
        switchAdminView("report-container");
        generateReport(); // ดึงข้อมูลทำรายงานใหม่
    });
    document.getElementById("menu-settings").addEventListener("click", () => {
        switchAdminView("settings-container");
        loadAdminSettings(); // ดึงค่าปัจจุบันมาแสดงในช่องกรอก
    });

    // ปุ่มบันทึกการตั้งค่า
    document.getElementById("btn-save-settings").addEventListener("click", saveAdminSettings);
});

// ฟังก์ชันสลับหน้าต่างในโหมดแอดมิน
window.switchAdminView = function(viewId) {
    // ปิดทุกหน้า
    document.querySelectorAll(".admin-view").forEach(el => el.style.display = "none");
    // เปิดหน้าที่ต้องการ
    document.getElementById(viewId).style.display = "block";
    // ปิด Sidebar อัตโนมัติ
    document.getElementById("admin-sidebar").style.right = "-250px";
}

// โหลดการตั้งค่ามาแสดงในช่องกรอก
async function loadAdminSettings() {
    try {
        const configDoc = await getDoc(doc(db, "system_config", "main_config"));
        if(configDoc.exists()) {
            const c = configDoc.data();
            document.getElementById("setting-date").value = c.service_date || "";
            document.getElementById("setting-location").value = c.service_location || "";
            document.getElementById("setting-quota-neuter").value = c.quota_neuter || 100;
            document.getElementById("setting-quota-vaccine").value = c.quota_vaccine || 300;
        }
    } catch (error) {
        console.error("Load settings error", error);
    }
}

// บันทึกการตั้งค่าลง Firebase
async function saveAdminSettings() {
    const btn = document.getElementById("btn-save-settings");
    btn.disabled = true; btn.textContent = "กำลังบันทึก...";

    try {
        const sDate = document.getElementById("setting-date").value;
        const sLoc = document.getElementById("setting-location").value;
        const qNeuter = parseInt(document.getElementById("setting-quota-neuter").value) || 0;
        const qVaccine = parseInt(document.getElementById("setting-quota-vaccine").value) || 0;

        // อัปเดตข้อมูล (merge: true เพื่อไม่ให้รหัสลับที่เคยตั้งไว้หายไป)
        await setDoc(doc(db, "system_config", "main_config"), {
            service_date: sDate,
            service_location: sLoc,
            quota_neuter: qNeuter,
            quota_vaccine: qVaccine
        }, { merge: true });

        alert("บันทึกการตั้งค่าเรียบร้อยแล้ว");
        switchAdminView("admin-container"); // กลับไปหน้าหลัก
    } catch (error) {
        console.error("Save settings error", error);
        alert("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
        btn.disabled = false; btn.textContent = "💾 บันทึกการตั้งค่า";
    }
}
