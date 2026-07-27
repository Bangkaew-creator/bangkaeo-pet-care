import { db } from "./firebase-config.js";
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, setDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 1. ตั้งค่าตัวแปรระบบ
// ==========================================
const LIFF_ID = "2010813512-UqwFMq5V"; 
let currentUser = null;
let sysConfig = null;
let secretsConfig = null;
let adminName = "เจ้าหน้าที่";
let adminRealName = "เจ้าหน้าที่"; 
let adminSignaturePad = null; 

window.proxyPetsBatch = []; 

let adminRole = localStorage.getItem("adminRole"); 
let adminMoo = localStorage.getItem("adminMoo");   

const defaultPlaceholder = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512' fill='%23A0B0C0'%3E%3Cpath d='M226.5 92.9c14.3 73-39.9 130-77.2 130-36.5 0-71.4-56.1-57.1-129.1C106.6 20.3 145.4-.1 184.8 0c36.7.1 27.2 19.8 41.7 92.9zm151.7-8.1c-14.3-73-53.1-93.5-89.8-93.5-39.4-.1-78.2 20.3-63.9 93.8 14.3 73 49.2 129.1 85.7 129.1 37.2.1 82.2-56.3 68-129.4zM448 176c-38.6 0-77.8 45.4-93.4 104.9-15.6 59.5-2.5 97.4 36.1 97.4 39.5 0 79-46.7 94.6-106.2C500.9 212.6 486.6 176 448 176zM157.4 280.9c-15.6-59.5-54.8-104.9-93.4-104.9-38.6 0-52.9 36.6-37.3 96.1 15.6 59.5 55.1 106.2 94.6 106.2 38.6.1 51.7-37.9 36.1-97.4zm168.1 48.7c-29.3-10.6-66.9-42.5-139.1-42.5-73.4 0-111 32.3-139.1 42.5-55.5 20.1-133.5 129-87.6 200.7C107.5 515.6 171.3 472 256 472c83.5 0 148.8 43.8 196.4 41.6 46.9-2.1 11.2-126-126.9-184z'/%3E%3C/svg%3E";

const legalConsentText = "ข้าพเจ้ายินยอมให้เจ้าหน้าที่ของปศุสัตว์จังหวัดสมุทรปราการทำการวางยาสลบเพื่อการผ่าตัดสัตว์ ซึ่งการวางยาสลบอาจมีผลข้างเคียงของยาเกิดขึ้น หากสัตว์ดังกล่าวได้รับอันตรายถึงชีวิตและเจ้าหน้าที่ได้ให้ความช่วยเหลืออย่างเต็มที่แล้ว ภายใต้จรรยาบรรณของการประกอบวิชาชีพสัตวแพทย์ ข้าพเจ้าจะรับผิดชอบดูแลแผลหลังการผ่าตัดตามคำแนะนำการดูแลสัตว์ภายหลังการผ่าตัดอย่างเคร่งครัด หากเกิดการผิดพลาดในการวางยาสลบ การผ่าตัด และไม่ว่าในกรณีใดๆ ข้าพเจ้าจะไม่เรียกร้องหรือฟ้องดำเนินคดีในทางอาญาและทางแพ่งกับเจ้าหน้าที่และส่วนราชการสังกัดของกรมปศุสัตว์แต่อย่างใด เจ้าหน้าที่ของปศุสัตว์จังหวัดสมุทรปราการ ได้อธิบายและข้าพเจ้าได้อ่านข้อความเข้าใจโดยตลอดแล้ว จึงลงลายมือไว้เป็นหลักฐาน (ออกให้โดยเทศบาลเมืองบางแก้วได้รับการวางยาสลบจากเจ้าหน้าที่ ปศุสัตว์จังหวัดสมุทรปราการ)";

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
// 2. เริ่มทำงาน & ตรวจสอบสิทธิ์
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
    setupNavigation();
    setupLoginLogic();
    
    const canvasSig = document.getElementById('admin-signature-pad');
    if(canvasSig && typeof SignaturePad !== 'undefined') {
        adminSignaturePad = new SignaturePad(canvasSig, { backgroundColor: 'rgb(224, 229, 236)' });
        document.getElementById("btn-clear-admin-sig")?.addEventListener("click", () => { adminSignaturePad.clear(); });
    }
    
    try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) {
            liff.login();
        } else {
            currentUser = await liff.getProfile();
            adminName = currentUser.displayName;
            adminRealName = adminName; 

            try {
                const uSnap = await getDoc(doc(db, "users", currentUser.userId));
                if(uSnap.exists() && uSnap.data().owner_name) {
                    adminRealName = uSnap.data().owner_name; 
                }
            } catch(e) { console.error("Error fetching real name:", e); }

            await loadSystemConfig();
            populateMooDropdowns();
            
            if (adminRole) {
                document.getElementById("loading").style.display = "none";
                document.getElementById("main-wrapper").style.display = "block";
                applyRolePermissions();
                switchView('view-checkin');
                setupSearchLogic();
                setupProxyBatchLogic();
                setupSettingsForm();
                setupReportAndPrint();
            } else {
                document.getElementById("loading").style.display = "none";
                document.getElementById("admin-login-modal").style.display = "flex";
            }
        }
    } catch (err) { document.getElementById("loading").innerHTML = `<div style="text-align:center; color:#ff6b6b;">❌ ขัดข้อง: ${err.message}</div>`; }
});

async function loadSystemConfig() {
    const snap = await getDoc(doc(db, "system_config", "main_config"));
    if(snap.exists()) {
        sysConfig = snap.data();
        document.getElementById("txt-header-agency").textContent = sysConfig.agency_name || "หน่วยงาน";
    }
    const secSnap = await getDoc(doc(db, "system_config", "secrets"));
    if(secSnap.exists()) secretsConfig = secSnap.data();
}

function populateMooDropdowns() {
    let count = sysConfig?.moo_count || 16;
    let html = '<option value="">ทุกหมู่</option>';
    let htmlReq = '<option value="" disabled selected>เลือก</option>';
    for(let i=1; i<=count; i++) { html += `<option value="${i}">หมู่ ${i}</option>`; htmlReq += `<option value="${i}">หมู่ ${i}</option>`; }
    document.getElementById("search-moo").innerHTML = html;
    document.getElementById("px-moo").innerHTML = htmlReq;
}

// ==========================================
// 3. ระบบจัดการ Role
// ==========================================
function setupLoginLogic() {
    document.getElementById("btn-verify-secret").addEventListener("click", () => {
        const secret = document.getElementById("secret-input").value.trim();
        if(!secret) return;
        if(!secretsConfig) return alert("ไม่พบการตั้งค่ารหัสในระบบ");
        
        if(secret === secretsConfig.admin_secret) {
            localStorage.setItem("adminRole", "admin"); localStorage.setItem("adminMoo", "all");
            location.reload(); return;
        }
        
        const vols = secretsConfig.volunteer_secrets || {};
        let foundMoo = null;
        for (const [moo, code] of Object.entries(vols)) { if (code === secret) { foundMoo = moo; break; } }
        
        if(foundMoo) {
            localStorage.setItem("adminRole", "volunteer"); localStorage.setItem("adminMoo", foundMoo);
            location.reload();
        } else { alert("❌ รหัสลับไม่ถูกต้อง"); }
    });
}

function applyRolePermissions() {
    if(adminRole === "volunteer") {
        document.body.classList.add("role-volunteer");
        document.getElementById("txt-role-display").textContent = `🛡️ อสม. หมู่ ${adminMoo}\n(${adminRealName})`;
        document.getElementById("search-moo").value = adminMoo; document.getElementById("search-moo").disabled = true;
        document.getElementById("px-moo").value = adminMoo; document.getElementById("px-moo").disabled = true;
    } else { 
        document.getElementById("txt-role-display").textContent = `👑 แอดมินส่วนกลาง\n(${adminRealName})`; 
    }
}

window.switchView = function(viewId) {
    document.querySelectorAll(".admin-view").forEach(el => el.style.display = "none");
    document.getElementById(viewId).style.display = "block";
    document.getElementById("admin-sidebar").style.right = "-250px";
    
    if(viewId === 'view-settings' && adminSignaturePad) {
        setTimeout(() => {
            try {
                const canvasSig = document.getElementById('admin-signature-pad');
                const ratio =  Math.max(window.devicePixelRatio || 1, 1);
                canvasSig.width = canvasSig.offsetWidth * ratio;
                canvasSig.height = canvasSig.offsetHeight * ratio;
                canvasSig.getContext("2d").scale(ratio, ratio);
                adminSignaturePad.clear();
                if(sysConfig && sysConfig.admin_sig_base64) {
                    adminSignaturePad.fromDataURL(sysConfig.admin_sig_base64);
                }
            } catch(e) { console.error("Canvas resize error:", e); }
        }, 300);
    }
}

function setupNavigation() {
    document.getElementById("menu-checkin").addEventListener("click", () => switchView('view-checkin'));
    document.getElementById("menu-proxy").addEventListener("click", () => switchView('view-proxy'));
    document.getElementById("menu-settings").addEventListener("click", () => { loadSettingsToForm(); switchView('view-settings'); });
    document.getElementById("menu-report").addEventListener("click", () => { window.generateReport(); switchView('view-report'); });
    document.getElementById("menu-raw-data").addEventListener("click", () => { window.switchRawTab('household'); switchView('view-raw-data'); });
    document.getElementById("menu-logout").addEventListener("click", () => {
        if(confirm("ออกจากโหมดเจ้าหน้าที่?")) { localStorage.clear(); window.location.href = "registry.html"; }
    });
}

// ==========================================
// 4. ระบบค้นหา & Check-in 
// ==========================================
function setupSearchLogic() {
    const input = document.getElementById("search-house");
    const btn = document.getElementById("btn-search");
    input.addEventListener("keypress", (e) => { if (e.key === "Enter") btn.click(); });

    btn.addEventListener("click", async () => {
        let rawInput = input.value.trim();
        let selectedMoo = document.getElementById("search-moo").value;
        if(!rawInput) return alert("ระบุบ้านเลขที่");

        let houseNo = rawInput, targetMoo = selectedMoo;
        if (rawInput.includes("-")) { const p = rawInput.split("-"); houseNo = p[0]; targetMoo = p[1]; }
        if (!targetMoo) return alert("ระบุหมู่ด้วย");

        if (adminRole === "volunteer" && targetMoo !== adminMoo) return alert(`⚠️ คุณค้นหาได้เฉพาะหมู่ ${adminMoo}`);

        const resContainer = document.getElementById("search-result-container");
        resContainer.innerHTML = "<p style='color:#D4AF37; text-align:center;'>กำลังค้นหา...</p>";

        try {
            let houseKey = `${houseNo}-${targetMoo}`;
            let userSnap = await getDocs(query(collection(db, "users"), where("house_village_search", ">=", houseKey), where("house_village_search", "<=", houseKey + '\uf8ff')));
            let householdOwner = null;
            if(!userSnap.empty) householdOwner = userSnap.docs[0].data();

            const petSnap = await getDocs(query(collection(db, "pets"), where("house_no", "==", houseNo), where("village_no", "==", targetMoo.toString())));

            resContainer.innerHTML = "";

            if(householdOwner || !petSnap.empty) {
                let ownerName = householdOwner ? householdOwner.owner_name : (petSnap.empty ? "ไม่ทราบชื่อ" : petSnap.docs[0].data().owner_name);
                let phone = householdOwner ? householdOwner.phone_number : (petSnap.empty ? "-" : petSnap.docs[0].data().phone_number);
                
                resContainer.innerHTML = `
                    <div style="background: rgba(80, 227, 194, 0.1); border: 1px solid #50E3C2; padding: 15px; border-radius: 12px; margin-bottom: 20px;">
                        <h3 style="color:#50E3C2; margin-bottom:5px;">🏠 ข้อมูลครัวเรือนที่ค้นพบ</h3>
                        <p style="color:#E0E5EC; font-size:14px; margin-bottom:2px;">บ้านเลขที่ <b>${houseNo} หมู่ ${targetMoo}</b></p>
                        <p style="color:#A0B0C0; font-size:13px;">เจ้าของ: ${ownerName} | โทร: ${phone}</p>
                        <button class="neumorphic-btn gold-btn" style="margin-top:10px; padding: 8px; font-size:12px;" onclick="window.quickAddPet('${houseNo}', '${targetMoo}', '${ownerName}', '${phone}')">+ เพิ่มสัตว์เลี้ยงในบ้านนี้ (Proxy)</button>
                    </div>
                `;
            } else {
                resContainer.innerHTML = `
                    <div style="background: rgba(255, 107, 107, 0.1); border: 1px solid #ff6b6b; padding: 15px; border-radius: 12px; text-align: center;">
                        <h3 style="color:#ff6b6b; margin-bottom:5px;">❌ ไม่พบข้อมูลครัวเรือน</h3>
                        <p style="color:#E0E5EC; font-size:13px; margin-bottom:15px;">ไม่มีข้อมูลบ้านเลขที่ ${houseNo} หมู่ ${targetMoo} ในระบบ</p>
                        <button class="neumorphic-btn gold-btn" onclick="window.createHouseholdProxy('${houseNo}', '${targetMoo}')">+ สร้างครัวเรือนใหม่ และเพิ่มสัตว์เลี้ยง</button>
                    </div>
                `;
                return;
            }

            window.currentSearchPets = {};
            let petCount = 0;
            petSnap.forEach(d => {
                const pet = d.data();
                if(pet.status === "cancelled" || pet.status === "deceased" || pet.status === "moved") return;
                window.currentSearchPets[d.id] = pet; petCount++;
                renderAdminCard(d.id, pet, resContainer);
            });
            if(petCount===0) resContainer.insertAdjacentHTML('beforeend', "<p style='color:#ff6b6b; text-align:center;'>ยังไม่มีข้อมูลสัตว์เลี้ยงที่แอคทีฟ</p>");

        } catch(e) { resContainer.innerHTML = `<p style='color:#ff6b6b;'>เกิดข้อผิดพลาด: ${e.message}</p>`; }
    });
}

window.quickAddPet = function(h, m, name, phone) {
    switchView('view-proxy');
    document.getElementById("px-house").value = h;
    document.getElementById("px-moo").value = m;
    document.getElementById("px-name").value = name;
    document.getElementById("px-phone").value = phone;
    document.getElementById("px-pet-name").focus();
}

window.createHouseholdProxy = function(h, m) {
    switchView('view-proxy');
    document.getElementById("px-house").value = h;
    document.getElementById("px-moo").value = m;
    document.getElementById("px-name").value = "";
    document.getElementById("px-phone").value = "";
    document.getElementById("px-name").focus();
}

function renderAdminCard(docId, pet, container) {
    const isCheckedIn = pet.status === "checked_in";
    const cardClass = isCheckedIn ? "admin-card checked" : "admin-card";
    
    let roomText = pet.room_no ? `<span style="color:#50E3C2; font-size:12px;">(ห้อง ${pet.room_no})</span>` : "";
    let vacStr = pet.vaccine_status === "ฉีดแล้ว" ? `<span class="badge-green">วัคซีนแล้ว</span>` : `<span class="badge-red">ยังไม่วัคซีน</span>`;
    let neuterStr = pet.neuter_status === "ทำหมันแล้ว" ? `<span class="badge-green">ทำหมันแล้ว</span>` : `<span class="badge-red">ยังไม่ทำหมัน</span>`;

    let actionBtn = "";
    if (pet.status === "booked") {
        actionBtn = `<button class="btn-action-small btn-checkin" onclick="window.toggleCheckin('${docId}', '${pet.service_type}', true)">✔️ รับบริการ</button>`;
    } else if (pet.status === "checked_in") {
        actionBtn = `<button class="btn-action-small btn-uncheckin" onclick="window.toggleCheckin('${docId}', '${pet.service_type}', false)">ยกเลิกติ๊กถูก</button>`;
    } else {
        actionBtn = `<button class="btn-action-small btn-checkin" style="background:transparent; color:#50E3C2; border: 1px dashed #50E3C2;" onclick="window.walkinVaccine('${docId}')">💉 Walk-in วัคซีน</button>`;
    }

    container.insertAdjacentHTML('beforeend', `
        <div class="${cardClass}">
            <div style="display: flex; gap: 12px; flex-grow: 1;">
                <img src="${pet.pet_photo_base64 || defaultPlaceholder}" class="pet-photo">
                <div class="pet-info">
                    <div class="pet-name">${pet.pet_name} ${roomText}</div>
                    <div style="color: #A0B0C0; margin-bottom: 5px;">${pet.pet_type} ${pet.pet_gender} | จอง: <span style="color:#D4AF37;">${pet.service_type || 'ไม่มี'}</span></div>
                    <div>${vacStr} | ${neuterStr}</div>
                </div>
            </div>
            <div class="action-buttons">
                ${actionBtn}
                <button class="btn-action-small btn-print" onclick="window.viewCertificateAdmin('${docId}')">📄 ใบรับรอง</button>
                <button class="btn-action-small btn-uncheckin" style="color: #F5A623; border-color: rgba(245,166,35,0.4);" onclick="window.softDeleteAdmin('${docId}')">แจ้งตาย/ย้าย</button>
            </div>
        </div>
    `);
}

window.toggleCheckin = async function(docId, serviceType, isCheckingIn) {
    try {
        let updates = { status: isCheckingIn ? "checked_in" : "booked", updated_at: serverTimestamp() };
        if (isCheckingIn) {
            if (serviceType === "ทำหมันและวัคซีน") { updates.neuter_status = "ทำหมันแล้ว"; updates.vaccine_status = "ฉีดแล้ว"; } 
            else if (serviceType === "วัคซีนอย่างเดียว") { updates.vaccine_status = "ฉีดแล้ว"; }
            if (sysConfig) {
                updates.vaccine_year = sysConfig.current_vaccine_year || new Date().getFullYear() + 543;
                updates.vaccine_brand = sysConfig.vaccine_brand || ""; updates.vaccine_lot = sysConfig.vaccine_lot || ""; updates.vaccine_exp = sysConfig.vaccine_exp || "";
            }
            const dateStr = new Date().toLocaleDateString('th-TH', { year:'numeric', month:'2-digit', day:'2-digit' });
            updates.vaccinated_by_admin = adminRealName; 
            updates.vaccine_date = dateStr;
        }
        await updateDoc(doc(db, "pets", docId), updates);
        document.getElementById("btn-search").click();
    } catch(e) { alert("เกิดข้อผิดพลาด: " + e.message); }
}

window.walkinVaccine = async function(docId) {
    if(confirm("อัปเดตประวัติว่ามารับวัคซีนหน้างาน (Walk-in) ใช่หรือไม่?")) {
        try {
            const dateStr = new Date().toLocaleDateString('th-TH', { year:'numeric', month:'2-digit', day:'2-digit' });
            let updates = { 
                status: "checked_in", service_type: "วัคซีนอย่างเดียว (Walk-in)", vaccine_status: "ฉีดแล้ว", updated_at: serverTimestamp(),
                vaccinated_by_admin: adminRealName, 
                vaccine_date: dateStr
            };
            if (sysConfig) {
                updates.vaccine_year = sysConfig.current_vaccine_year || new Date().getFullYear() + 543;
                updates.vaccine_brand = sysConfig.vaccine_brand || ""; updates.vaccine_lot = sysConfig.vaccine_lot || ""; updates.vaccine_exp = sysConfig.vaccine_exp || "";
            }
            await updateDoc(doc(db, "pets", docId), updates);
            document.getElementById("btn-search").click();
        } catch(e) { alert("เกิดข้อผิดพลาด"); }
    }
}

window.softDeleteAdmin = async function(docId) {
    const action = prompt(`กรุณาระบุสาเหตุ\nพิมพ์ "1" = เสียชีวิต\nพิมพ์ "2" = ย้ายที่อยู่`);
    if(action === "1" || action === "2") {
        try { await updateDoc(doc(db, "pets", docId), { status: action === "1" ? "deceased" : "moved", updated_at: serverTimestamp() }); document.getElementById("btn-search").click(); } 
        catch(e) { alert("เกิดข้อผิดพลาด"); }
    }
}

window.viewCertificateAdmin = function(docId) {
    try {
        const pet = window.currentSearchPets[docId];
        if(!pet) return;
        document.getElementById("cert-img").src = pet.pet_photo_base64 || defaultPlaceholder;
        document.getElementById("cert-pet-name").textContent = pet.pet_name;
        document.getElementById("cert-pet-detail").textContent = `${pet.pet_type} | ${pet.pet_gender} | อายุ ${pet.age_year || 0} ปี`;
        document.getElementById("cert-owner").textContent = pet.owner_name || "-";
        
        let certAddress = `${pet.house_no || '-'} ม.${pet.village_no || '-'}`;
        if(pet.room_no) certAddress += ` (ห้อง ${pet.room_no})`;
        document.getElementById("cert-address").textContent = certAddress;
        
        if (pet.vaccine_status === "ฉีดแล้ว") {
            document.getElementById("cert-vac-status").innerHTML = `ฉีดแล้ว (ปี ${pet.vaccine_year}) <br><span style="font-size:11px; color:#E0E5EC;">วันที่ฉีด: ${pet.vaccine_date || '-'}</span>`;
            document.getElementById("cert-vac-status").style.color = "#50E3C2";
            document.getElementById("cert-vac-detail").innerHTML = `ยี่ห้อ: ${pet.vaccine_brand || '-'} (Lot: ${pet.vaccine_lot || '-'})<br>EXP: ${pet.vaccine_exp || '-'}`;
        } else {
            document.getElementById("cert-vac-status").textContent = "ยังไม่เคยฉีดวัคซีน"; document.getElementById("cert-vac-status").style.color = "#ff6b6b";
            document.getElementById("cert-vac-detail").textContent = "-";
        }
        
        const sigElement = document.getElementById("cert-admin-sig");
        const nameElement = document.getElementById("cert-admin-name");

        if (pet.vaccine_status === "ฉีดแล้ว") {
            if (pet.vaccinated_by_admin) {
                nameElement.textContent = pet.vaccinated_by_admin;
                if (sysConfig && sysConfig.admin_sig_base64) {
                    sigElement.src = sysConfig.admin_sig_base64;
                    sigElement.style.display = "block";
                } else {
                    sigElement.style.display = "none";
                }
            } else {
                nameElement.textContent = "ประวัติเดิม (ระบุโดยเจ้าของ)";
                nameElement.style.color = "#A0B0C0";
                sigElement.style.display = "none";
            }
        } else {
            nameElement.textContent = "-";
            sigElement.style.display = "none";
        }

        document.getElementById("pet-cert-card").classList.remove("flipped");
        document.getElementById("cert-modal").style.display = "flex";
    } catch(e) {
        console.error("View Cert Error:", e);
        alert("ไม่สามารถเปิดใบรับรองได้เนื่องจากข้อมูลไม่สมบูรณ์");
    }
}

// ==========================================
// 5. ระบบลงทะเบียนแทน (Batch Proxy)
// ==========================================
function setupProxyBatchLogic() {
    let currentProxyBase64 = "";

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

    document.getElementById("btn-add-proxy-pet").addEventListener("click", () => {
        const pName = document.getElementById("px-pet-name").value.trim();
        if(!pName) return alert("กรุณาใส่ชื่อสัตว์เลี้ยง");
        
        window.proxyPetsBatch.push({
            pet_name: pName, pet_type: document.getElementById("px-type").value, pet_gender: document.getElementById("px-gender").value,
            breed: document.getElementById("px-breed").value.trim() || "ไม่ระบุ", color: document.getElementById("px-color").value.trim() || "ไม่ระบุ",
            age_year: parseInt(document.getElementById("px-age-y").value) || 0, age_month: parseInt(document.getElementById("px-age-m").value) || 0,
            rearing_style: document.getElementById("px-rearing").value, service: document.getElementById("px-service").value,
            photo: currentProxyBase64 || defaultPlaceholder
        });
        
        document.getElementById("px-pet-name").value = ""; document.getElementById("px-breed").value = ""; document.getElementById("px-color").value = "";
        document.getElementById("px-img-preview").src = defaultPlaceholder;
        currentProxyBase64 = "";
        window.renderProxyBatchList();
    });

    document.getElementById("btn-submit-proxy-batch").addEventListener("click", async () => {
        const owner = document.getElementById("px-name").value.trim();
        const phone = document.getElementById("px-phone").value.trim();
        const house = document.getElementById("px-house").value.trim();
        const moo = document.getElementById("px-moo").value;
        const room = document.getElementById("px-room").value.trim();

        if(!owner || !house || !moo) return alert("กรุณากรอกชื่อเจ้าของ บ้านเลขที่ และหมู่");
        if(window.proxyPetsBatch.length === 0) return alert("กรุณาเพิ่มสัตว์เลี้ยงลงตะกร้าอย่างน้อย 1 ตัว");

        const btn = document.getElementById("btn-submit-proxy-batch");
        btn.disabled = true; btn.textContent = "กำลังบันทึก...";

        try {
            let searchKey = room ? `${house}-${moo}-${room}` : `${house}-${moo}`;
            
            const userQ = query(collection(db, "users"), where("house_village_search", "==", searchKey));
            const userSnap = await getDocs(userQ);
            let ownerUid = "proxy_" + new Date().getTime();
            if(!userSnap.empty) { ownerUid = userSnap.docs[0].id; } 
            else {
                await setDoc(doc(db, "users", ownerUid), {
                    owner_name: owner, phone_number: phone, house_no: house, village_no: moo, room_no: room, is_rental: !!room,
                    house_village_search: searchKey, updated_at: serverTimestamp()
                });
            }

            for(let p of window.proxyPetsBatch) {
                let petData = {
                    owner_uid: ownerUid, proxy_by: adminRealName, owner_name: owner, phone_number: phone, house_no: house, village_no: moo, room_no: room,
                    house_village_search: searchKey, pet_name: p.pet_name, pet_type: p.pet_type, pet_gender: p.pet_gender,
                    breed: p.breed, color: p.color, age_year: p.age_year, age_month: p.age_month, rearing_style: p.rearing_style,
                    pet_photo_base64: p.photo === defaultPlaceholder ? "" : p.photo, registered_timestamp: serverTimestamp(), updated_at: serverTimestamp()
                };

                if (p.service === "none") {
                    petData.status = "registered"; petData.neuter_status = "ยังไม่ทำหมัน"; petData.vaccine_status = "ยังไม่เคยฉีด";
                } else if (p.service === "ทำหมันและวัคซีน" || p.service === "วัคซีนอย่างเดียว") {
                    petData.status = "booked"; petData.service_type = p.service; petData.neuter_status = "ยังไม่ทำหมัน"; petData.vaccine_status = "ยังไม่เคยฉีด"; petData.consent_agreed = false;
                } else if (p.service === "checked_in_vaccine") {
                    const dateStr = new Date().toLocaleDateString('th-TH', { year:'numeric', month:'2-digit', day:'2-digit' });
                    petData.status = "checked_in"; petData.service_type = "วัคซีนอย่างเดียว (Walk-in)"; petData.neuter_status = "ยังไม่ทำหมัน"; petData.vaccine_status = "ฉีดแล้ว";
                    petData.vaccine_year = sysConfig ? sysConfig.current_vaccine_year : new Date().getFullYear()+543;
                    petData.vaccine_brand = sysConfig ? sysConfig.vaccine_brand : "";
                    petData.vaccine_lot = sysConfig ? sysConfig.vaccine_lot : "";
                    petData.vaccine_exp = sysConfig ? sysConfig.vaccine_exp : "";
                    petData.vaccine_date = dateStr; petData.vaccinated_by_admin = adminRealName;
                }
                await addDoc(collection(db, "pets"), petData);
            }
            alert(`🎉 บันทึกบ้าน ${house} ม.${moo} และสัตว์เลี้ยง ${window.proxyPetsBatch.length} ตัว สำเร็จ!`);
            window.proxyPetsBatch = []; window.renderProxyBatchList();
        } catch(e) { alert("Error: " + e.message); }
        finally { btn.disabled = false; btn.textContent = "💾 บันทึกข้อมูลครัวเรือน + สัตว์เลี้ยงทั้งหมด"; }
    });
}

window.renderProxyBatchList = function() {
    const list = document.getElementById("proxy-pet-list");
    list.innerHTML = "";
    window.proxyPetsBatch.forEach((p, i) => {
        list.insertAdjacentHTML('beforeend', `<div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; margin-bottom: 5px; display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size: 13px; color:#E0E5EC;"><strong style="color:#D4AF37;">${i+1}. ${p.pet_name}</strong> (${p.pet_type} ${p.pet_gender})<br><span style="color:#A0B0C0; font-size:11px;">ทำ: ${p.service}</span></div>
            <button onclick="window.proxyPetsBatch.splice(${i},1); window.renderProxyBatchList()" style="background:none; border:none; color:#ff6b6b; cursor:pointer; font-size:12px;">❌ ลบ</button>
        </div>`);
    });
    document.getElementById("btn-submit-proxy-batch").style.display = window.proxyPetsBatch.length > 0 ? "block" : "none";
}

// ==========================================
// 6. ระบบตารางข้อมูลดิบ (Raw Data Menu)
// ==========================================
window.switchRawTab = async function(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    const tbody = document.querySelector("#raw-table-content tbody");
    const thead = document.querySelector("#raw-table-content thead");
    tbody.innerHTML = "<tr><td colspan='24' style='text-align:center;'>กำลังประมวลผลข้อมูล...</td></tr>";

    try {
        if(tabName === 'household') {
            thead.innerHTML = "<tr><th>อำเภอ</th><th>แขวง</th><th>หมู่ที่</th><th>สถานที่อาศัย</th><th>บ้านเลขที่</th><th>ผู้ให้ข้อมูล</th><th>หมายเลขบัตร</th><th>เบอร์โทรศัพท์</th><th>สุุนัข-ผู้ ยอดจริง</th><th>สุนัข-ผู้-วัคซีน ยอดจริง</th><th>สุนัข-ผู้-ทำหมัน ยอดจริง</th><th>ลูกผู้</th><th>สุุนัข-เมีย ยอดจริง</th><th>สุนัข-เมีย-วัคซีน ยอดจริง</th><th>สุนัข-เมีย-ทำหมัน ยอดจริง</th><th>ลูกเมีย</th><th>แมว-ผู้ ยอดจริง</th><th>แมว-ผู้-วัคซีน ยอดจริง</th><th>แมว-ผู้-ทำหมัน ยอดจริง</th><th>ลูกแมวผู้</th><th>แมว-เมีย ยอดจริง</th><th>แมว-เมีย-วัคซีน ยอดจริง</th><th>แมว-เมีย-ทำหมัน ยอดจริง</th><th>ลูกแมวเมีย</th></tr>";
            
            const usersSnap = await getDocs(collection(db, "users"));
            const petsSnap = await getDocs(collection(db, "pets"));
            
            let hhStats = {};
            usersSnap.forEach(d => {
                const u = d.data();
                const key = u.house_village_search || `${u.house_no}-${u.village_no}`;
                hhStats[key] = {
                    amphoe: sysConfig?.amphoe || "-", tambon: sysConfig?.tambon || "-", moo: u.village_no || "-", loc: "บริเวณบ้าน",
                    house: u.house_no || "-", owner: u.owner_name || "-", card: "-", phone: u.phone_number || "-",
                    dm:0, dm_v:0, dm_n:0, pup_m:0, df:0, df_v:0, df_n:0, pup_f:0,
                    cm:0, cm_v:0, cm_n:0, kit_m:0, cf:0, cf_v:0, cf_n:0, kit_f:0
                };
            });

            petsSnap.forEach(d => {
                const p = d.data();
                if(p.status === "cancelled" || p.status === "deceased" || p.status === "moved") return;
                const key = p.house_village_search || `${p.house_no}-${p.village_no}`;
                if(!hhStats[key]) {
                    hhStats[key] = {
                        amphoe: sysConfig?.amphoe || "-", tambon: sysConfig?.tambon || "-", moo: p.village_no || "-", loc: "บริเวณบ้าน",
                        house: p.house_no || "-", owner: p.owner_name || "-", card: "-", phone: p.phone_number || "-",
                        dm:0, dm_v:0, dm_n:0, pup_m:0, df:0, df_v:0, df_n:0, pup_f:0, cm:0, cm_v:0, cm_n:0, kit_m:0, cf:0, cf_v:0, cf_n:0, kit_f:0
                    };
                }
                
                let s = hhStats[key];
                let isVac = p.vaccine_status === "ฉีดแล้ว" ? 1 : 0;
                let isNeu = p.neuter_status === "ทำหมันแล้ว" ? 1 : 0;

                if (p.pet_type === "สุนัข" && p.pet_gender === "ตัวผู้") { s.dm++; s.dm_v += isVac; s.dm_n += isNeu; }
                else if (p.pet_type === "สุนัข" && p.pet_gender === "ตัวเมีย") { s.df++; s.df_v += isVac; s.df_n += isNeu; }
                else if (p.pet_type === "แมว" && p.pet_gender === "ตัวผู้") { s.cm++; s.cm_v += isVac; s.cm_n += isNeu; }
                else if (p.pet_type === "แมว" && p.pet_gender === "ตัวเมีย") { s.cf++; s.cf_v += isVac; s.cf_n += isNeu; }
            });

            let html = "";
            for(let k in hhStats) {
                let s = hhStats[k];
                html += `<tr><td>${s.amphoe}</td><td>${s.tambon}</td><td>${s.moo}</td><td>${s.loc}</td><td>${s.house}</td><td>${s.owner}</td><td>${s.card}</td><td>${s.phone}</td><td>${s.dm}</td><td>${s.dm_v}</td><td>${s.dm_n}</td><td>${s.pup_m}</td><td>${s.df}</td><td>${s.df_v}</td><td>${s.df_n}</td><td>${s.pup_f}</td><td>${s.cm}</td><td>${s.cm_v}</td><td>${s.cm_n}</td><td>${s.kit_m}</td><td>${s.cf}</td><td>${s.cf_v}</td><td>${s.cf_n}</td><td>${s.kit_f}</td></tr>`;
            }
            tbody.innerHTML = html || "<tr><td colspan='24'>ไม่มีข้อมูล</td></tr>";
            
        } else if (tabName === 'pets') {
            thead.innerHTML = "<tr><th>OwnerName</th><th>เลขบัตรประชาชน</th><th>Tel</th><th>HouseholdKey</th><th>หมู่</th><th>ตำบล</th><th>อำเภอ</th><th>ซอย</th><th>ถนน</th><th>PetType</th><th>PetName</th><th>Sex</th><th>VaccineStatus</th><th>VaccineYear</th><th>NeuteredStatus</th><th>AgeYear</th><th>AgeMonth</th><th>RearingStyle</th><th>Location</th></tr>";
            
            const snap = await getDocs(collection(db, "pets"));
            let html = "";
            snap.forEach(d => {
                const p = d.data();
                if(p.status === "cancelled" || p.status === "deceased" || p.status === "moved") return;
                html += `<tr><td>${p.owner_name||'-'}</td><td>-</td><td>${p.phone_number||'-'}</td><td>${p.house_village_search||'-'}</td><td>${p.village_no||'-'}</td><td>${sysConfig?.tambon||'-'}</td><td>${sysConfig?.amphoe||'-'}</td><td>-</td><td>-</td><td>${p.pet_type||'-'}</td><td>${p.pet_name||'-'}</td><td>${p.pet_gender||'-'}</td><td>${p.vaccine_status||'-'}</td><td>${p.vaccine_year||'-'}</td><td>${p.neuter_status||'-'}</td><td>${p.age_year||0}</td><td>${p.age_month||0}</td><td>${p.rearing_style||'-'}</td><td>-</td></tr>`;
            });
            tbody.innerHTML = html || "<tr><td colspan='19'>ไม่มีข้อมูล</td></tr>";
            
        } else if (tabName === 'stray') {
            thead.innerHTML = "<tr><th>อำเภอ</th><th>ตำบล</th><th>หมู่</th><th>สถานที่อาศัย</th><th>LocationDesc</th><th>FeederName</th><th>เลขบัตร</th><th>FeederPhone</th><th>จำนวนหมา</th><th>วัคซีน</th><th>ทำหมัน</th><th>จำนวนแมว</th><th>วัคซีน.1</th><th>ทำหมัน.1</th></tr>";
            tbody.innerHTML = "<tr><td colspan='14' style='text-align:center; color:#A0B0C0;'>ระบบข้อมูลสัตว์จรจัด จะเปิดให้ใช้งานในเฟสที่ 3 ครับ</td></tr>";
        }
    } catch(e) { tbody.innerHTML = `<tr><td colspan='24' style='color:#ff6b6b;'>Error: ${e.message}</td></tr>`; }
}

// ==========================================
// 7. ตั้งค่าระบบ (Settings & Canvas Signature)
// ==========================================
function loadSettingsToForm() {
    if(sysConfig) {
        document.getElementById("st-moo-count").value = sysConfig.moo_count || 16;
        document.getElementById("st-agency").value = sysConfig.agency_name || "";
        document.getElementById("st-tambon").value = sysConfig.tambon || ""; document.getElementById("st-amphoe").value = sysConfig.amphoe || ""; document.getElementById("st-province").value = sysConfig.province || ""; document.getElementById("st-phone").value = sysConfig.phone || "";
        document.getElementById("st-max-neuter").value = sysConfig.max_neuter_per_house || 2;
        document.getElementById("st-start").value = sysConfig.nt_start_reg || ""; document.getElementById("st-end").value = sysConfig.nt_end_reg || ""; document.getElementById("st-nt-date").value = sysConfig.nt_date || ""; document.getElementById("st-nt-loc").value = sysConfig.nt_location || "";
        document.getElementById("st-q-neuter").value = sysConfig.quota_neuter || 100; document.getElementById("st-q-vac").value = sysConfig.quota_vaccine || 300;
        document.getElementById("st-vac-year").value = sysConfig.current_vaccine_year || 2569; document.getElementById("st-vac-brand").value = sysConfig.vaccine_brand || ""; document.getElementById("st-vac-lot").value = sysConfig.vaccine_lot || ""; document.getElementById("st-vac-exp").value = sysConfig.vaccine_exp || "";
        
        document.getElementById("st-rep-name").value = sysConfig.rep_name || ""; document.getElementById("st-rep-pos").value = sysConfig.rep_pos || ""; document.getElementById("st-rev-name").value = sysConfig.rev_name || ""; document.getElementById("st-rev-pos").value = sysConfig.rev_pos || ""; document.getElementById("st-app-name").value = sysConfig.app_name || ""; document.getElementById("st-app-pos").value = sysConfig.app_pos || "";
    }
    if(secretsConfig) {
        document.getElementById("st-admin-secret").value = secretsConfig.admin_secret || "";
        renderVolunteerSecretInputs();
    }
}

function renderVolunteerSecretInputs() {
    let count = parseInt(document.getElementById("st-moo-count").value) || 16;
    let vols = secretsConfig?.volunteer_secrets || {};
    let html = "";
    for(let i=1; i<=count; i++) {
        let val = vols[i] || "";
        html += `<div style="display:flex; flex-direction:column;"><label style="font-size:12px; color:#81A1C1;">หมู่ ${i}</label><input type="text" id="st-vol-${i}" class="neumorphic-input" style="padding: 5px; font-size:13px;" value="${val}"></div>`;
    }
    document.getElementById("st-volunteer-secrets-container").innerHTML = html;
}
document.getElementById("st-moo-count").addEventListener("change", renderVolunteerSecretInputs);

function setupSettingsForm() {
    document.getElementById("btn-save-settings").addEventListener("click", async () => {
        const btn = document.getElementById("btn-save-settings"); btn.disabled = true; btn.textContent = "กำลังบันทึก...";
        try {
            const updates = {
                moo_count: parseInt(document.getElementById("st-moo-count").value) || 16, max_neuter_per_house: parseInt(document.getElementById("st-max-neuter").value) || 2,
                agency_name: document.getElementById("st-agency").value, tambon: document.getElementById("st-tambon").value, amphoe: document.getElementById("st-amphoe").value, province: document.getElementById("st-province").value, phone: document.getElementById("st-phone").value,
                nt_start_reg: document.getElementById("st-start").value, nt_end_reg: document.getElementById("st-end").value, nt_date: document.getElementById("st-nt-date").value, nt_location: document.getElementById("st-nt-loc").value,
                quota_neuter: parseInt(document.getElementById("st-q-neuter").value) || 100, quota_vaccine: parseInt(document.getElementById("st-q-vac").value) || 300,
                current_vaccine_year: parseInt(document.getElementById("st-vac-year").value) || 2569, vaccine_brand: document.getElementById("st-vac-brand").value, vaccine_lot: document.getElementById("st-vac-lot").value, vaccine_exp: document.getElementById("st-vac-exp").value,
                rep_name: document.getElementById("st-rep-name").value, rep_pos: document.getElementById("st-rep-pos").value, rev_name: document.getElementById("st-rev-name").value, rev_pos: document.getElementById("st-rev-pos").value, app_name: document.getElementById("st-app-name").value, app_pos: document.getElementById("st-app-pos").value
            };
            
            if(adminSignaturePad && !adminSignaturePad.isEmpty()) {
                updates.admin_sig_base64 = adminSignaturePad.toDataURL("image/png");
            }

            await updateDoc(doc(db, "system_config", "main_config"), updates);
            
            let volSecrets = {};
            let mCount = updates.moo_count;
            for(let i=1; i<=mCount; i++) { volSecrets[i] = document.getElementById(`st-vol-${i}`).value; }
            await setDoc(doc(db, "system_config", "secrets"), { admin_secret: document.getElementById("st-admin-secret").value, volunteer_secrets: volSecrets });
            
            alert("บันทึกสำเร็จ กรุณารีเฟรชหน้าเว็บเพื่อให้การตั้งค่าใหม่มีผลครับ"); location.reload();
        } catch(e) { alert("Error: " + e.message); } finally { btn.disabled = false; btn.textContent = "💾 บันทึกการตั้งค่า"; }
    });
}

// ==========================================
// 8. ระบบรายงาน & พิมพ์ใบยินยอม (A4 จัดการหน้ากระดาษอัตโนมัติ)
// ==========================================
window.printConsentA4 = async function(docId) {
    const pet = window.currentSearchPets[docId];
    if(!pet || !pet.signature_base64) return alert("ไม่สามารถพิมพ์ได้ เนื่องจากยังไม่มีลายเซ็น");
    try {
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

        const printName = pet.owner_name || "-";
        const printPhone = pet.phone_number || "-";
        const printHouse = pet.house_no || "-";
        const printVillage = pet.village_no || "-";

        document.getElementById("p-queue-no").textContent = `คิวที่: ${queueNo}`;
        document.getElementById("p-owner-name").textContent = printName;
        document.getElementById("p-owner-name-sig").textContent = printName;
        document.getElementById("p-phone").textContent = printPhone;
        document.getElementById("p-house").textContent = printHouse;
        document.getElementById("p-village").textContent = printVillage;
        document.getElementById("p-pet-name").textContent = pet.pet_name;
        document.getElementById("p-pet-type").textContent = pet.pet_type;
        document.getElementById("p-pet-gender").textContent = pet.pet_gender;
        document.getElementById("p-signature").src = pet.signature_base64;

        // บังคับกระดาษเป็นแนวตั้ง
        const pageStyle = document.createElement('style');
        pageStyle.innerHTML = '@page { size: portrait; }';
        document.head.appendChild(pageStyle);

        document.body.classList.add('print-consent-mode');
        window.print();
        document.body.classList.remove('print-consent-mode');
        
        document.head.removeChild(pageStyle);
    } catch (e) { console.error(e); alert("เกิดข้อผิดพลาดในการดึงข้อมูล"); }
}

function setupReportAndPrint() {
    document.getElementById("btn-print-report").addEventListener("click", () => { 
        // บังคับกระดาษเป็นแนวนอน
        const pageStyle = document.createElement('style');
        pageStyle.innerHTML = '@page { size: landscape; }';
        document.head.appendChild(pageStyle);

        document.body.classList.add('print-report-mode'); 
        window.print(); 
        document.body.classList.remove('print-report-mode'); 
        
        document.head.removeChild(pageStyle);
    });

    window.generateReport = async function() {
        if(sysConfig) {
            let agencyText = sysConfig.agency_name || "";
            if(sysConfig.tambon) agencyText += ` ต.${sysConfig.tambon}`;
            if(sysConfig.amphoe) agencyText += ` อ.${sysConfig.amphoe}`;
            if(sysConfig.province) agencyText += ` จ.${sysConfig.province}`;
            if(sysConfig.phone) agencyText += ` โทร. ${sysConfig.phone}`;
            
            document.getElementById("pdf-agency-name").textContent = agencyText;
            
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
                if (p.status === "cancelled" || p.status === "deceased" || p.status === "moved") return;
                if (!p.service_type || p.service_type === "none" || p.status === "registered") return;

                const s = (p.service_type === "ทำหมันและวัคซีน") ? "n" : "v";
                const t = (p.pet_type === "สุนัข") ? "d" : "c";
                const g = (p.pet_gender === "ตัวผู้") ? "m" : "f";

                stats.r[s][t][g]++;
                if (p.status === "checked_in") stats.c[s][t][g]++;
            });

            renderTable("table-registered", stats.r);
            renderTable("table-checked-in", stats.c);
        } catch (e) { alert("ดึงข้อมูลรายงานไม่สำเร็จ: " + e.message); }
    }

    document.getElementById("btn-print-all-consents").addEventListener("click", async () => {
        const btn = document.getElementById("btn-print-all-consents"); btn.textContent = "กำลังประมวลผล..."; btn.disabled = true;
        try {
            const snap = await getDocs(collection(db, "pets")); let validPets = [];
            snap.forEach(d => { const p = d.data(); if(p.status !== "cancelled" && p.signature_base64 && p.consent_agreed) validPets.push({ id: d.id, ...p }); });
            validPets.sort((a, b) => (a.signed_timestamp?.toMillis() || 0) - (b.signed_timestamp?.toMillis() || 0));
            if(validPets.length === 0) return alert("ไม่มีข้อมูลการเซ็นใบยินยอมในระบบ");

            const container = document.getElementById("print-all-consents-container"); container.innerHTML = "";
            const agency = sysConfig ? sysConfig.agency_name : "เทศบาล...";
            
            validPets.forEach((pet, index) => {
                container.insertAdjacentHTML('beforeend', `
                    <div class="consent-page">
                        <div class="queue-badge">คิวที่: ${index + 1}</div>
                        <h2 style="text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 5px;">ใบยินยอมผ่าตัดทำหมัน</h2>
                        <h3 style="text-align: center; font-size: 18px; margin-bottom: 30px;">กับ${agency} ร่วมกับปศุสัตว์จังหวัดสมุทรปราการ</h3>
                        <div style="font-size: 16px; line-height: 2;">
                            <p><strong>ข้าพเจ้า (ชื่อเจ้าของ):</strong> ${pet.owner_name}</p>
                            <p><strong>เบอร์โทรศัพท์:</strong> ${pet.phone_number || "-"}</p>
                            <p><strong>ที่อยู่ปัจจุบัน:</strong> บ้านเลขที่ ${pet.house_no} หมู่ที่ ${pet.village_no} ตำบลบางแก้ว อำเภอบางพลี จังหวัดสมุทรปราการ</p>
                            <p style="margin-top: 15px;"><strong>มีความประสงค์ขอรับบริการทำหมัน/ฉีดวัคซีน ให้แก่สัตว์เลี้ยงดังนี้:</strong></p>
                            <p>ชื่อสัตว์เลี้ยง: ${pet.pet_name} &nbsp;&nbsp; ประเภท: ${pet.pet_type} &nbsp;&nbsp; เพศ: ${pet.pet_gender}</p>
                            <p style="margin-top: 30px; text-indent: 40px; text-align: justify;">${legalConsentText}</p>
                        </div>
                        <div style="margin-top: 50px; text-align: center;">
                            <img src="${pet.signature_base64}" style="max-height: 100px; display: block; margin: 0 auto; border-bottom: 1px dotted #000;">
                            <p style="margin-top: 10px;">(ลงชื่อ) .............................................................. ผู้ยินยอม</p>
                            <p style="margin-top: 5px;">(${pet.owner_name})</p>
                        </div>
                    </div>
                `);
            });
            
            // บังคับกระดาษเป็นแนวตั้ง
            const pageStyle = document.createElement('style');
            pageStyle.innerHTML = '@page { size: portrait; }';
            document.head.appendChild(pageStyle);

            document.body.classList.add('print-all-consents-mode'); 
            window.print(); 
            document.body.classList.remove('print-all-consents-mode');
            
            document.head.removeChild(pageStyle);
        } catch(e) { alert("เกิดข้อผิดพลาด"); } finally { btn.textContent = "🖨️ พิมพ์ใบยินยอมทั้งหมด (Batch Print)"; btn.disabled = false; }
    });
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
