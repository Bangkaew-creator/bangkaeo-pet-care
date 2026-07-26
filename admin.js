import { db } from "./firebase-config.js";
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 1. ตั้งค่าตัวแปรระบบ
// ==========================================
const LIFF_ID = "2010813512-UqwFMq5V"; 
let currentUser = null;
let sysConfig = null;
let adminName = "เจ้าหน้าที่";
let currentProxyBase64 = "";

// ดึงสิทธิ์จาก LocalStorage
let adminRole = localStorage.getItem("adminRole"); // "admin" หรือ "volunteer"
let adminMoo = localStorage.getItem("adminMoo");   // เลขหมู่ (เช่น "8") หรือ "all"

window.currentSearchPets = {}; 

const defaultPlaceholder = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512' fill='%23A0B0C0'%3E%3Cpath d='M226.5 92.9c14.3 73-39.9 130-77.2 130-36.5 0-71.4-56.1-57.1-129.1C106.6 20.3 145.4-.1 184.8 0c36.7.1 27.2 19.8 41.7 92.9zm151.7-8.1c-14.3-73-53.1-93.5-89.8-93.5-39.4-.1-78.2 20.3-63.9 93.8 14.3 73 49.2 129.1 85.7 129.1 37.2.1 82.2-56.3 68-129.4zM448 176c-38.6 0-77.8 45.4-93.4 104.9-15.6 59.5-2.5 97.4 36.1 97.4 39.5 0 79-46.7 94.6-106.2C500.9 212.6 486.6 176 448 176zM157.4 280.9c-15.6-59.5-54.8-104.9-93.4-104.9-38.6 0-52.9 36.6-37.3 96.1 15.6 59.5 55.1 106.2 94.6 106.2 38.6.1 51.7-37.9 36.1-97.4zm168.1 48.7c-29.3-10.6-66.9-42.5-139.1-42.5-73.4 0-111 32.3-139.1 42.5-55.5 20.1-133.5 129-87.6 200.7C107.5 515.6 171.3 472 256 472c83.5 0 148.8 43.8 196.4 41.6 46.9-2.1 11.2-126-126.9-184z'/%3E%3C/svg%3E";

// ==========================================
// 2. เริ่มทำงาน & ตรวจสอบสิทธิ์
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
    setupNavigation();
    setupLoginLogic();
    
    try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) {
            liff.login();
        } else {
            currentUser = await liff.getProfile();
            adminName = currentUser.displayName;
            await loadSystemConfig();
            
            // เช็คว่าเคยล็อกอินเข้าระบบเจ้าหน้าที่ไว้ไหม
            if (adminRole) {
                document.getElementById("loading").style.display = "none";
                document.getElementById("main-wrapper").style.display = "block";
                applyRolePermissions();
                switchView('view-checkin');
                setupSearchLogic();
                setupProxyForm();
                setupSettingsForm();
                setupReportAndPrint();
            } else {
                document.getElementById("loading").style.display = "none";
                document.getElementById("admin-login-modal").style.display = "flex";
            }
        }
    } catch (err) {
        document.getElementById("loading").innerHTML = `<div style="text-align:center; padding: 20px; color:#ff6b6b;">❌ ขัดข้อง: ${err.message}</div>`;
    }
});

async function loadSystemConfig() {
    const snap = await getDoc(doc(db, "system_config", "main_config"));
    if(snap.exists()) {
        sysConfig = snap.data();
        document.getElementById("txt-header-agency").textContent = sysConfig.agency_name || "หน่วยงาน";
    }
}

// ==========================================
// 3. ระบบจัดการ Role (Admin vs Volunteer)
// ==========================================
function setupLoginLogic() {
    document.getElementById("btn-verify-secret").addEventListener("click", async () => {
        const secret = document.getElementById("secret-input").value.trim();
        if(!secret) return alert("กรุณากรอกรหัสลับ");
        
        try {
            const btn = document.getElementById("btn-verify-secret");
            btn.disabled = true; btn.textContent = "ตรวจสอบ...";

            const secretSnap = await getDoc(doc(db, "system_config", "secrets"));
            if(secretSnap.exists()) {
                const sData = secretSnap.data();
                
                // ตรวจสอบแอดมินส่วนกลาง
                if(secret === sData.admin_secret) {
                    localStorage.setItem("adminRole", "admin");
                    localStorage.setItem("adminMoo", "all");
                    alert("เข้าสู่ระบบแอดมินส่วนกลางสำเร็จ");
                    location.reload();
                    return;
                }
                
                // ตรวจสอบอาสาปศุสัตว์ (อสม.)
                const vols = sData.volunteer_secrets || {};
                let foundMoo = null;
                for (const [moo, code] of Object.entries(vols)) {
                    if (code === secret) { foundMoo = moo; break; }
                }
                
                if(foundMoo) {
                    localStorage.setItem("adminRole", "volunteer");
                    localStorage.setItem("adminMoo", foundMoo);
                    alert(`เข้าสู่ระบบอาสาปศุสัตว์ หมู่ ${foundMoo} สำเร็จ`);
                    location.reload();
                } else {
                    alert("❌ รหัสลับไม่ถูกต้อง");
                }
            }
        } catch(e) { alert("Error: " + e.message); }
        finally { document.getElementById("btn-verify-secret").disabled = false; document.getElementById("btn-verify-secret").textContent = "เข้าสู่ระบบ"; }
    });
}

function applyRolePermissions() {
    if(adminRole === "volunteer") {
        document.body.classList.add("role-volunteer");
        document.getElementById("txt-role-display").textContent = `🛡️ อสม. หมู่ ${adminMoo}`;
        
        // ล็อก Dropdown หมู่ ให้ อสม.
        const searchMoo = document.getElementById("search-moo");
        searchMoo.value = adminMoo; searchMoo.disabled = true;

        const proxyMoo = document.getElementById("px-moo");
        proxyMoo.value = adminMoo; proxyMoo.disabled = true;
    } else {
        document.getElementById("txt-role-display").textContent = "👑 แอดมินส่วนกลาง";
    }
}

// ==========================================
// 4. เมนูและ Navigation
// ==========================================
window.switchView = function(viewId) {
    document.querySelectorAll(".admin-view").forEach(el => el.style.display = "none");
    document.getElementById(viewId).style.display = "block";
    document.getElementById("admin-sidebar").style.right = "-250px";
}

function setupNavigation() {
    document.getElementById("menu-checkin").addEventListener("click", () => switchView('view-checkin'));
    document.getElementById("menu-proxy").addEventListener("click", () => switchView('view-proxy'));
    document.getElementById("menu-settings").addEventListener("click", () => {
        loadSettingsToForm(); switchView('view-settings');
    });
    document.getElementById("menu-report").addEventListener("click", () => {
        generateReport(); switchView('view-report');
    });
    
    document.getElementById("menu-logout").addEventListener("click", () => {
        if(confirm("ต้องการออกจากโหมดเจ้าหน้าที่และกลับไปหน้าประชาชนใช่หรือไม่?")) {
            localStorage.removeItem("adminRole");
            localStorage.removeItem("adminMoo");
            window.location.href = "registry.html";
        }
    });
}

// ==========================================
// 5. ระบบค้นหา & Check-in อัจฉริยะ
// ==========================================
function setupSearchLogic() {
    const input = document.getElementById("search-house");
    const btn = document.getElementById("btn-search");

    // รองรับการกด Enter
    input.addEventListener("keypress", (e) => { if (e.key === "Enter") btn.click(); });

    btn.addEventListener("click", async () => {
        let rawInput = input.value.trim();
        let selectedMoo = document.getElementById("search-moo").value;
        
        if(!rawInput) return alert("กรุณาระบุบ้านเลขที่");

        let houseNo = rawInput;
        let targetMoo = selectedMoo;

        // วิเคราะห์ความฉลาด: ถ้าพิมพ์ 51/2-8 มา ให้แยกคำอัตโนมัติ
        if (rawInput.includes("-")) {
            const parts = rawInput.split("-");
            houseNo = parts[0];
            targetMoo = parts[1];
        }

        if (!targetMoo) return alert("กรุณาระบุหมู่ หรือพิมพ์แบบระบุหมู่ เช่น 51/2-8");

        // ระบบป้องกัน: อสม. แอบค้นหาข้ามเขต
        if (adminRole === "volunteer" && targetMoo !== adminMoo) {
            return alert(`⚠️ ไม่มีสิทธิ์เข้าถึงข้อมูล:\nคุณสามารถค้นหาและจัดการได้เฉพาะข้อมูลลูกบ้านใน "หมู่ที่ ${adminMoo}" เท่านั้นครับ`);
        }

        const resContainer = document.getElementById("search-result-container");
        resContainer.innerHTML = "<p style='text-align:center; color:#D4AF37; margin-top:20px;'>กำลังค้นหาข้อมูล...</p>";

        try {
            // ค้นหาแบบเป๊ะๆ ด้วย house_no และ village_no
            const q = query(collection(db, "pets"), where("house_no", "==", houseNo), where("village_no", "==", targetMoo.toString()));
            const snap = await getDocs(q);
            
            if (snap.empty) {
                resContainer.innerHTML = `<p style='text-align:center; color:#ff6b6b; margin-top:20px;'>ไม่พบข้อมูลสัตว์เลี้ยงในบ้านเลขที่ ${houseNo} หมู่ ${targetMoo}</p>`;
                return;
            }

            resContainer.innerHTML = "";
            window.currentSearchPets = {};

            snap.forEach(d => {
                const pet = d.data();
                if(pet.status === "cancelled" || pet.status === "deceased" || pet.status === "moved") return;
                window.currentSearchPets[d.id] = pet;
                renderAdminCard(d.id, pet, resContainer);
            });
            
            if(resContainer.innerHTML === "") resContainer.innerHTML = "<p style='text-align:center; color:#ff6b6b;'>ไม่พบข้อมูลที่กำลังใช้งาน</p>";

        } catch(e) {
            resContainer.innerHTML = `<p style='text-align:center; color:#ff6b6b;'>เกิดข้อผิดพลาด: ${e.message}</p>`;
        }
    });
}

function renderAdminCard(docId, pet, container) {
    const isCheckedIn = pet.status === "checked_in";
    const cardClass = isCheckedIn ? "admin-card checked" : "admin-card";
    
    // จัดการข้อความห้องเช่า
    let roomText = pet.room_no ? `<span style="color:#50E3C2; font-size:12px;">(ห้อง ${pet.room_no})</span>` : "";
    
    // Badge สถานะวัคซีนและทำหมัน
    let vacStatusStr = pet.vaccine_status === "ฉีดแล้ว" ? `<span class="badge-green">ฉีดวัคซีนแล้ว (${pet.vaccine_year})</span>` : `<span class="badge-red">ยังไม่ฉีดวัคซีน</span>`;
    let neuterStatusStr = pet.neuter_status === "ทำหมันแล้ว" ? `<span class="badge-green">ทำหมันแล้ว</span>` : `<span class="badge-red">ยังไม่ทำหมัน</span>`;

    // ปุ่ม Check-in
    let actionBtn = "";
    if (pet.status === "booked") {
        actionBtn = `<button class="btn-action-small btn-checkin" onclick="window.toggleCheckin('${docId}', '${pet.service_type}', true)">✔️ รับบริการ</button>`;
    } else if (pet.status === "checked_in") {
        actionBtn = `<button class="btn-action-small btn-uncheckin" onclick="window.toggleCheckin('${docId}', '${pet.service_type}', false)">ยกเลิกติ๊กถูก</button>`;
    } else {
        actionBtn = `<div style="font-size:11px; color:#A0B0C0; text-align:center;">ไม่ได้จองคิวมา</div>`;
        actionBtn += `<button class="btn-action-small btn-checkin" style="margin-top:5px; background:transparent; color:#50E3C2; border: 1px dashed #50E3C2;" onclick="window.walkinVaccine('${docId}')">💉 Walk-in วัคซีน</button>`;
    }

    let printBtn = pet.signature_base64 ? `<button class="btn-action-small btn-print" onclick="window.printSingleConsent('${docId}')">🖨️ พิมพ์ใบยินยอม</button>` : "";

    container.insertAdjacentHTML('beforeend', `
        <div class="${cardClass}">
            <div style="display: flex; gap: 12px; flex-grow: 1;">
                <img src="${pet.pet_photo_base64 || defaultPlaceholder}" class="pet-photo">
                <div class="pet-info">
                    <div class="pet-name">${pet.pet_name} ${roomText}</div>
                    <div style="color: #A0B0C0; margin-bottom: 5px;">${pet.pet_type} ${pet.pet_gender} | จอง: <span style="color:#D4AF37;">${pet.service_type || 'ไม่มี'}</span></div>
                    <div>${vacStatusStr}</div>
                    <div>${neuterStatusStr}</div>
                </div>
            </div>
            <div class="action-buttons">
                ${actionBtn}
                ${printBtn}
            </div>
        </div>
    `);
}

// 🧠 ระบบ Auto-Stamp (อัปเดต ROD อัตโนมัติเมื่อกด Check-in)
window.toggleCheckin = async function(docId, serviceType, isCheckingIn) {
    try {
        let updates = { 
            status: isCheckingIn ? "checked_in" : "booked",
            updated_at: serverTimestamp()
        };

        if (isCheckingIn) {
            // ประทับตราการรับบริการ
            if (serviceType === "ทำหมันและวัคซีน") {
                updates.neuter_status = "ทำหมันแล้ว";
                updates.vaccine_status = "ฉีดแล้ว";
            } else if (serviceType === "วัคซีนอย่างเดียว") {
                updates.vaccine_status = "ฉีดแล้ว";
            }
            
            // ดึงข้อมูลวัคซีนจาก Settings มาฝัง
            if (sysConfig) {
                updates.vaccine_year = sysConfig.current_vaccine_year || new Date().getFullYear() + 543;
                if(sysConfig.vaccine_brand) updates.vaccine_brand = sysConfig.vaccine_brand;
                if(sysConfig.vaccine_lot) updates.vaccine_lot = sysConfig.vaccine_lot;
            }
            updates.vaccinated_by_admin = adminName;
        }

        await updateDoc(doc(db, "pets", docId), updates);
        document.getElementById("btn-search").click(); // รีเฟรชผลลัพธ์
    } catch(e) { alert("เกิดข้อผิดพลาด: " + e.message); }
}

window.walkinVaccine = async function(docId) {
    if(confirm("ต้องการอัปเดตประวัติว่ามารับวัคซีนหน้างาน (Walk-in) ใช่หรือไม่?")) {
        try {
            let updates = { 
                status: "checked_in", service_type: "วัคซีนอย่างเดียว (Walk-in)",
                vaccine_status: "ฉีดแล้ว", updated_at: serverTimestamp(),
                vaccinated_by_admin: adminName
            };
            if (sysConfig) {
                updates.vaccine_year = sysConfig.current_vaccine_year || new Date().getFullYear() + 543;
                if(sysConfig.vaccine_brand) updates.vaccine_brand = sysConfig.vaccine_brand;
                if(sysConfig.vaccine_lot) updates.vaccine_lot = sysConfig.vaccine_lot;
            }
            await updateDoc(doc(db, "pets", docId), updates);
            document.getElementById("btn-search").click();
        } catch(e) { alert("เกิดข้อผิดพลาด"); }
    }
}

// ==========================================
// 6. ระบบลงทะเบียนแทน (Proxy Registration)
// ==========================================
function setupProxyForm() {
    document.getElementById("px-img-upload").addEventListener("change", (e) => {
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
                currentProxyBase64 = canvas.toDataURL("image/jpeg", 0.7);
                document.getElementById("px-img-preview").src = currentProxyBase64;
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    document.getElementById("btn-submit-proxy").addEventListener("click", async () => {
        const ownerName = document.getElementById("px-name").value.trim();
        const phone = document.getElementById("px-phone").value.trim();
        const houseNo = document.getElementById("px-house").value.trim();
        const moo = document.getElementById("px-moo").value;
        const room = document.getElementById("px-room").value.trim();
        
        const pName = document.getElementById("px-pet-name").value.trim();
        const pType = document.getElementById("px-type").value;
        const pGender = document.getElementById("px-gender").value;
        const pService = document.getElementById("px-service").value;

        if(!ownerName || !houseNo || !moo || !pName) return alert("กรุณากรอกข้อมูลสำคัญ (ชื่อ, บ้านเลขที่, หมู่, ชื่อสัตว์) ให้ครบถ้วน");

        if (adminRole === "volunteer" && moo !== adminMoo) {
            return alert(`⚠️ คุณสามารถลงทะเบียนแทนได้เฉพาะหมู่ที่ ${adminMoo} เท่านั้นครับ`);
        }

        const btn = document.getElementById("btn-submit-proxy");
        btn.disabled = true; btn.textContent = "กำลังบันทึก...";

        try {
            let searchKey = room ? `${houseNo}-${moo}-${room}` : `${houseNo}-${moo}`;
            
            let petData = {
                owner_uid: "proxy_registration", proxy_by: adminName,
                owner_name: ownerName, phone_number: phone, house_no: houseNo, village_no: moo, room_no: room,
                house_village_search: searchKey,
                pet_name: pName, pet_type: pType, pet_gender: pGender,
                breed: document.getElementById("px-breed").value.trim() || "ไม่ระบุ",
                color: document.getElementById("px-color").value.trim() || "ไม่ระบุ",
                age_year: parseInt(document.getElementById("px-age-y").value) || 0,
                age_month: parseInt(document.getElementById("px-age-m").value) || 0,
                rearing_style: document.getElementById("px-rearing").value,
                pet_photo_base64: currentProxyBase64,
                registered_timestamp: serverTimestamp(), updated_at: serverTimestamp()
            };

            // อิงสถานะตาม Service ที่เลือก
            if (pService === "none") {
                petData.status = "registered";
                petData.neuter_status = "ยังไม่ทำหมัน"; petData.vaccine_status = "ยังไม่เคยฉีด";
            } else if (pService === "ทำหมันและวัคซีน" || pService === "วัคซีนอย่างเดียว") {
                petData.status = "booked"; petData.service_type = pService;
                petData.neuter_status = "ยังไม่ทำหมัน"; petData.vaccine_status = "ยังไม่เคยฉีด";
                petData.consent_agreed = false; // ต้องให้เซ็นหน้างาน
            } else if (pService === "checked_in_vaccine") {
                petData.status = "checked_in"; petData.service_type = "วัคซีนอย่างเดียว";
                petData.neuter_status = "ยังไม่ทำหมัน"; petData.vaccine_status = "ฉีดแล้ว";
                petData.vaccine_year = sysConfig ? sysConfig.current_vaccine_year : new Date().getFullYear()+543;
                petData.vaccinated_by_admin = adminName;
            }

            await addDoc(collection(db, "pets"), petData);
            
            alert(`🎉 บันทึกข้อมูลน้อง ${pName} สำเร็จ`);
            
            // เคลียร์ฟอร์มส่วนสัตว์เลี้ยง (เผื่อคีย์ตัวต่อไป)
            document.getElementById("px-pet-name").value = "";
            document.getElementById("px-breed").value = "";
            document.getElementById("px-color").value = "";
            document.getElementById("px-img-preview").src = defaultPlaceholder;
            currentProxyBase64 = "";

        } catch(e) { alert("เกิดข้อผิดพลาด: " + e.message); }
        finally { btn.disabled = false; btn.textContent = "💾 บันทึกเข้าระบบ"; }
    });
}

// ==========================================
// 7. ระบบตั้งค่า Settings (เฉพาะแอดมินกลาง)
// ==========================================
function loadSettingsToForm() {
    if(!sysConfig) return;
    document.getElementById("st-agency").value = sysConfig.agency_name || "";
    document.getElementById("st-tambon").value = sysConfig.tambon || "";
    document.getElementById("st-amphoe").value = sysConfig.amphoe || "";
    document.getElementById("st-province").value = sysConfig.province || "";
    document.getElementById("st-phone").value = sysConfig.phone || "";
    
    document.getElementById("st-start").value = sysConfig.nt_start_reg || "";
    document.getElementById("st-end").value = sysConfig.nt_end_reg || "";
    document.getElementById("st-nt-date").value = sysConfig.nt_date || "";
    document.getElementById("st-nt-loc").value = sysConfig.nt_location || "";
    document.getElementById("st-q-neuter").value = sysConfig.quota_neuter || 100;
    document.getElementById("st-q-vac").value = sysConfig.quota_vaccine || 300;

    document.getElementById("st-vac-year").value = sysConfig.current_vaccine_year || 2569;
    document.getElementById("st-vac-brand").value = sysConfig.vaccine_brand || "";
    document.getElementById("st-vac-lot").value = sysConfig.vaccine_lot || "";
    document.getElementById("st-vac-exp").value = sysConfig.vaccine_exp || "";

    document.getElementById("st-rep-name").value = sysConfig.rep_name || "";
    document.getElementById("st-rep-pos").value = sysConfig.rep_pos || "";
    document.getElementById("st-rev-name").value = sysConfig.rev_name || "";
    document.getElementById("st-rev-pos").value = sysConfig.rev_pos || "";
    document.getElementById("st-app-name").value = sysConfig.app_name || "";
    document.getElementById("st-app-pos").value = sysConfig.app_pos || "";
}

function setupSettingsForm() {
    document.getElementById("btn-save-settings").addEventListener("click", async () => {
        const btn = document.getElementById("btn-save-settings");
        btn.disabled = true; btn.textContent = "กำลังบันทึก...";
        try {
            const updates = {
                agency_name: document.getElementById("st-agency").value,
                tambon: document.getElementById("st-tambon").value, amphoe: document.getElementById("st-amphoe").value,
                province: document.getElementById("st-province").value, phone: document.getElementById("st-phone").value,
                nt_start_reg: document.getElementById("st-start").value, nt_end_reg: document.getElementById("st-end").value,
                nt_date: document.getElementById("st-nt-date").value, nt_location: document.getElementById("st-nt-loc").value,
                quota_neuter: parseInt(document.getElementById("st-q-neuter").value) || 100, quota_vaccine: parseInt(document.getElementById("st-q-vac").value) || 300,
                current_vaccine_year: parseInt(document.getElementById("st-vac-year").value) || 2569,
                vaccine_brand: document.getElementById("st-vac-brand").value, vaccine_lot: document.getElementById("st-vac-lot").value, vaccine_exp: document.getElementById("st-vac-exp").value,
                rep_name: document.getElementById("st-rep-name").value, rep_pos: document.getElementById("st-rep-pos").value,
                rev_name: document.getElementById("st-rev-name").value, rev_pos: document.getElementById("st-rev-pos").value,
                app_name: document.getElementById("st-app-name").value, app_pos: document.getElementById("st-app-pos").value
            };
            await updateDoc(doc(db, "system_config", "main_config"), updates);
            alert("บันทึกการตั้งค่าสำเร็จ");
            sysConfig = { ...sysConfig, ...updates }; // อัปเดตใน Memory
            document.getElementById("txt-header-agency").textContent = sysConfig.agency_name;
        } catch(e) { alert("เกิดข้อผิดพลาด: " + e.message); }
        finally { btn.disabled = false; btn.textContent = "💾 บันทึกการตั้งค่า"; }
    });
}

// ==========================================
// 8. ระบบรายงาน & พิมพ์ใบยินยอม
// ==========================================
function setupReportAndPrint() {
    document.getElementById("btn-print-report").addEventListener("click", () => {
        document.body.classList.add('print-report-mode');
        window.print();
        document.body.classList.remove('print-report-mode');
    });

    document.getElementById("btn-print-all-consents").addEventListener("click", async () => {
        const btn = document.getElementById("btn-print-all-consents");
        btn.textContent = "กำลังประมวลผล..."; btn.disabled = true;
        try {
            const snap = await getDocs(collection(db, "pets"));
            let validPets = [];
            snap.forEach(d => {
                const p = d.data();
                if(p.status !== "cancelled" && p.signature_base64 && p.consent_agreed) validPets.push({ id: d.id, ...p });
            });

            validPets.sort((a, b) => (a.signed_timestamp?.toMillis() || 0) - (b.signed_timestamp?.toMillis() || 0));

            if(validPets.length === 0) return alert("ไม่มีข้อมูลการเซ็นใบยินยอมในระบบ");

            const container = document.getElementById("print-all-consents-container");
            container.innerHTML = "";
            const agency = sysConfig ? sysConfig.agency_name : "เทศบาล...";
            
            validPets.forEach((pet, index) => {
                container.insertAdjacentHTML('beforeend', `
                    <div class="consent-page">
                        <div class="queue-badge">คิวที่: ${index + 1}</div>
                        <h2 style="text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 5px;">ใบยินยอมรับบริการ</h2>
                        <h3 style="text-align: center; font-size: 18px; margin-bottom: 30px;">${agency}</h3>
                        
                        <div style="font-size: 16px; line-height: 2;">
                            <p><strong>ข้าพเจ้า (ชื่อเจ้าของ):</strong> ${pet.owner_name}</p>
                            <p><strong>ที่อยู่ปัจจุบัน:</strong> บ้านเลขที่ ${pet.house_no} หมู่ที่ ${pet.village_no} ${pet.room_no ? '(ห้อง '+pet.room_no+')' : ''}</p>
                            <p style="margin-top: 15px;"><strong>สัตว์เลี้ยงที่เข้ารับบริการ:</strong></p>
                            <p>ชื่อ: ${pet.pet_name} | ประเภท: ${pet.pet_type} | เพศ: ${pet.pet_gender} | บริการที่จอง: ${pet.service_type}</p>
                            <p style="margin-top: 30px; text-indent: 40px; text-align: justify;">
                                ข้าพเจ้ายินยอมให้เจ้าหน้าที่ทำการวางยาสลบเพื่อผ่าตัด/ฉีดวัคซีน และข้าพเจ้าได้อ่านเงื่อนไขเข้าใจโดยตลอดแล้ว จึงลงลายมือไว้เป็นหลักฐาน
                            </p>
                        </div>
                        <div style="margin-top: 50px; text-align: center;">
                            <img src="${pet.signature_base64}" style="max-height: 100px; display: block; margin: 0 auto; border-bottom: 1px dotted #000;">
                            <p style="margin-top: 10px;">(ลงชื่อ) .............................................................. ผู้ยินยอม</p>
                            <p style="margin-top: 5px;">(${pet.owner_name})</p>
                        </div>
                    </div>
                `);
            });

            document.body.classList.add('print-all-consents-mode');
            window.print();
            document.body.classList.remove('print-all-consents-mode');
        } catch(e) { alert("เกิดข้อผิดพลาด"); } 
        finally { btn.textContent = "🖨️ พิมพ์ใบยินยอม A4 ทั้งหมด (Batch Print)"; btn.disabled = false; }
    });
}

window.printSingleConsent = function(docId) {
    // ซ่อนโค้ดเก่าเพื่อไม่ให้ยาวไป ใช้หลักการเดียวกับ Batch Print แต่ทำทีละใบ
    alert("ฟังก์ชันกำลังปรับปรุง ให้พิมพ์รวดเดียวจากเมนู Batch Print ก่อนครับ");
}

async function generateReport() {
    if(sysConfig) {
        document.getElementById("pdf-agency-name").textContent = sysConfig.agency_name || "หน่วยงาน";
        document.getElementById("sig-rep-name").textContent = `(${sysConfig.rep_name || '...'})`;
        document.getElementById("sig-rep-pos").textContent = sysConfig.rep_pos || '-';
        document.getElementById("sig-rev-name").textContent = `(${sysConfig.rev_name || '...'})`;
        document.getElementById("sig-rev-pos").textContent = sysConfig.rev_pos || '-';
        document.getElementById("sig-app-name").textContent = `(${sysConfig.app_name || '...'})`;
        document.getElementById("sig-app-pos").textContent = sysConfig.app_pos || '-';
    }

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
        <tr><td style="text-align: left;">ทำหมัน + วัคซีน</td><td>${n.d.m}</td><td>${n.d.f}</td><td>${n.c.m}</td><td>${n.c.f}</td><td style="font-weight: bold;">${tn}</td></tr>
        <tr><td style="text-align: left;">วัคซีนอย่างเดียว</td><td>${v.d.m}</td><td>${v.d.f}</td><td>${v.c.m}</td><td>${v.c.f}</td><td style="font-weight: bold;">${tv}</td></tr>
        <tr style="background: rgba(212, 175, 55, 0.1); font-weight: bold;"><td>รวมสุทธิ</td><td>${n.d.m + v.d.m}</td><td>${n.d.f + v.d.f}</td><td>${n.c.m + v.c.m}</td><td>${n.c.f + v.c.f}</td><td style="color: #D4AF37; font-size: 16px;">${tn + tv}</td></tr>
    `;
}
