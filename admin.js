import { db } from "./firebase-config.js";
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, setDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 1. ตั้งค่าตัวแปรระบบ
// ==========================================
const LIFF_ID = "2010813512-cqJiXCIj"; 
let currentUser = null;
let sysConfig = null;
let secretsConfig = null;
let adminName = "เจ้าหน้าที่";
let adminRealName = "เจ้าหน้าที่"; 
let adminSignaturePad = null; 

window.proxyPetsBatch = []; 
window.rawTableData = []; 
window.currentRawTab = "household"; 

let adminRole = localStorage.getItem("adminRole"); 
let adminMoo = localStorage.getItem("adminMoo");   

let currentAgencyLogoBase64 = ""; 
const defaultLogoIcon = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512' fill='%23A0B0C0'%3E%3Cpath d='M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z'/%3E%3C/svg%3E";
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
    setupEditModalLogic();
    
    // ตั้งค่ากระดานลายเซ็น แอดมิน (ตั้งค่า)
    const canvasSig = document.getElementById('admin-signature-pad');
    if(canvasSig && typeof SignaturePad !== 'undefined') {
        adminSignaturePad = new SignaturePad(canvasSig, { backgroundColor: 'rgb(224, 229, 236)' });
        document.getElementById("btn-clear-admin-sig")?.addEventListener("click", () => { adminSignaturePad.clear(); });
    }

    // ตั้งค่ากระดานลายเซ็น วัคซีนสำหรับประชาชน
    window.vacSignaturePad = null;
    const vacCanvas = document.getElementById('vac-signature-pad');
    if(vacCanvas && typeof SignaturePad !== 'undefined') {
        window.vacSignaturePad = new SignaturePad(vacCanvas, { backgroundColor: 'rgb(224, 229, 236)' });
        document.getElementById("btn-clear-vac-sig")?.addEventListener("click", () => { window.vacSignaturePad.clear(); });
    }

    document.getElementById("btn-confirm-stray-action")?.addEventListener("click", async () => {
        const docId = document.getElementById('stray-modal-docid').value;
        const dNeu = parseInt(document.getElementById('stray-act-dog-neu').value) || 0;
        const dVac = parseInt(document.getElementById('stray-act-dog-vac').value) || 0;
        const cNeu = parseInt(document.getElementById('stray-act-cat-neu').value) || 0;
        const cVac = parseInt(document.getElementById('stray-act-cat-vac').value) || 0;
        
        const btn = document.getElementById("btn-confirm-stray-action");
        btn.disabled = true; btn.textContent = "กำลังบันทึก...";
        
        try {
            await updateDoc(doc(db, "stray_reports", docId), { 
                status: 'completed',
                dog_neu_done: dNeu,
                dog_vac_done: dVac,
                cat_neu_done: cNeu,
                cat_vac_done: cVac,
                updated_at: serverTimestamp()
            });
            document.getElementById('stray-action-modal').style.display = 'none';
            window.loadStrayReports();
        } catch(e) {
            console.error(e);
            alert("บันทึกไม่สำเร็จ");
        } finally {
            btn.disabled = false; btn.textContent = "บันทึกผล";
        }
    });

    document.getElementById("btn-auto-cancel")?.addEventListener("click", async () => {
        const currentCamp = sysConfig?.campaign_id || "";
        const serviceDateStr = sysConfig?.nt_date || ""; 
        
        if (!currentCamp || !serviceDateStr) {
            return alert("กรุณาตั้งชื่อรอบโครงการ และ 'วันให้บริการ (เช่น 2026-08-05)' ในหน้าตั้งค่าก่อนครับ");
        }

        const serviceDate = new Date(serviceDateStr);
        const today = new Date();
        const diffDays = Math.floor((today - serviceDate) / (1000 * 60 * 60 * 24));

        if (diffDays <= 3) {
            return alert(`ยังไม่พ้นกำหนด 3 วันครับ (เพิ่งผ่านมา ${diffDays >= 0 ? diffDays : 0} วัน)`);
        }

        if(confirm(`พ้นกำหนดวันให้บริการมาแล้ว ${diffDays} วัน\n\nต้องการเคลียร์คิวที่ 'จองคิวแต่ไม่ได้มารับบริการ' ในรอบ "${currentCamp}" ให้กลับไปเป็นสถานะปกติหรือไม่?\n(ยอดจองและโควตาของคนเหล่านั้นจะถูกรีเซต)`)) {
            const btn = document.getElementById("btn-auto-cancel");
            btn.disabled = true; btn.textContent = "กำลังเคลียร์ข้อมูล...";
            try {
                let clearCount = 0;
                const qCamp = query(collection(db, "pets"), where("campaign_id", "==", currentCamp), where("status", "==", "booked"));
                const snapCamp = await getDocs(qCamp);
                
                for (const d of snapCamp.docs) {
                    await updateDoc(doc(db, "pets", d.id), { 
                        status: "registered", 
                        service_type: null, 
                        queue_no: null, 
                        consent_agreed: false, 
                        campaign_id: null 
                    });
                    clearCount++;
                }
                alert(`✅ เคลียร์คิวตกหล่นสำเร็จทั้งหมด ${clearCount} รายการ!`);
                location.reload();
            } catch(e) { 
                console.error(e);
                alert("เกิดข้อผิดพลาดในการเคลียร์คิว"); 
            } finally {
                btn.disabled = false; btn.textContent = "🗑️ เคลียร์คิวตกหล่น (เลยกำหนด)";
            }
        }
    });
    
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
                setupExcelExport(); 
            } else {
                document.getElementById("loading").style.display = "none";
                document.getElementById("admin-login-modal").style.display = "flex";
            }
        }
    } catch (err) { document.getElementById("loading").innerHTML = `<div style="text-align:center; color:var(--accent-danger);">❌ ขัดข้อง: ${err.message}</div>`; }
});

async function loadSystemConfig() {
    const snap = await getDoc(doc(db, "system_config", "main_config"));
    if(snap.exists()) {
        sysConfig = snap.data();
        document.getElementById("txt-header-agency").textContent = sysConfig.agency_name || "หน่วยงาน";
        
        document.body.classList.remove('theme-mourning', 'theme-gov', 'theme-rabies', 'theme-luxury');
        if (sysConfig.theme === "custom" && sysConfig.custom_colors) {
            const root = document.documentElement;
            root.style.setProperty('--bg-main', sysConfig.custom_colors.bg_main || '#141E30');
            root.style.setProperty('--bg-card', sysConfig.custom_colors.bg_card || '#1b2941');
            root.style.setProperty('--text-main', sysConfig.custom_colors.text_main || '#E0E5EC');
            root.style.setProperty('--text-muted', sysConfig.custom_colors.text_muted || '#A0B0C0');
            root.style.setProperty('--accent-primary', sysConfig.custom_colors.accent_primary || '#D4AF37');
            root.style.setProperty('--accent-success', sysConfig.custom_colors.accent_success || '#50E3C2');
        } else if (sysConfig.theme && sysConfig.theme !== "default") {
            document.body.classList.add("theme-" + sysConfig.theme);
        }
    }
    const secSnap = await getDoc(doc(db, "system_config", "secrets"));
    if(secSnap.exists()) secretsConfig = secSnap.data();
}

function populateMooDropdowns() {
    let count = sysConfig?.moo_count || 16;
    let html = '<option value="">ทุกหมู่</option>';
    let htmlReq = '<option value="" disabled selected>เลือก</option>';
    for(let i=1; i<=count; i++) { 
        html += `<option value="${i}">หมู่ ${i}</option>`; 
        htmlReq += `<option value="${i}">หมู่ ${i}</option>`; 
    }
    if(document.getElementById("search-moo")) document.getElementById("search-moo").innerHTML = html;
    if(document.getElementById("px-moo")) document.getElementById("px-moo").innerHTML = htmlReq;
    if(document.getElementById("raw-filter-moo")) document.getElementById("raw-filter-moo").innerHTML = html;
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
    document.getElementById("menu-stray-manage")?.addEventListener("click", () => { switchView('view-stray-manage'); window.loadStrayReports(); });
    document.getElementById("menu-logout").addEventListener("click", () => {
        if(confirm("ออกจากโหมดเจ้าหน้าที่?")) { localStorage.clear(); window.location.href = "https://liff.line.me/2010813512-828tVQ1b"; }
    });
}

// ==========================================
// 4. ระบบค้นหา & Check-in & Edit
// ==========================================
function setupSearchLogic() {
    const searchInput = document.getElementById("search-house");
    const searchBtn = document.getElementById("btn-search");

    searchBtn.addEventListener("click", async () => {
        let rawInput = searchInput.value.trim();
        let selectedMoo = document.getElementById("search-moo").value;
        if(!rawInput) return alert("ระบุบ้านเลขที่, ชื่อ หรือเบอร์โทร");

        const resContainer = document.getElementById("search-result-container");
        resContainer.innerHTML = "<p style='color:var(--accent-primary); text-align:center;'>กำลังค้นหา...</p>";

        let qConstraints = [];
        if (adminRole === "volunteer") {
            selectedMoo = adminMoo;
            document.getElementById("search-moo").value = adminMoo;
            qConstraints.push(where("village_no", "==", adminMoo)); 
        }

        try {
            let houseKey = null;
            if (rawInput.includes("-")) { 
                const p = rawInput.split("-"); 
                houseKey = `${p[0]}-${p[1]}`; 
            } else if (selectedMoo) {
                houseKey = `${rawInput}-${selectedMoo}`;
            }

            const petsRef = collection(db, "pets");
            const queries = [];
            
            if (houseKey) {
                queries.push(query(petsRef, ...qConstraints, where("house_village_search", ">=", houseKey), where("house_village_search", "<=", houseKey + '\uf8ff')));
            }
            queries.push(query(petsRef, ...qConstraints, where("phone_number", "==", rawInput)));
            queries.push(query(petsRef, ...qConstraints, where("owner_name", ">=", rawInput), where("owner_name", "<=", rawInput + '\uf8ff')));

            const snapshots = await Promise.all(queries.map(q => getDocs(q)));

            const mergedResults = new Map();
            snapshots.forEach(snap => {
                snap.forEach(d => {
                    if (!mergedResults.has(d.id)) mergedResults.set(d.id, d.data());
                });
            });

            resContainer.innerHTML = "";

            if(mergedResults.size === 0) {
                let proxyHouseParam = rawInput;
                if (rawInput.includes("-")) proxyHouseParam = rawInput.split("-")[0];
                let proxyMooParam = selectedMoo || "";

                resContainer.innerHTML = `
                    <div style="background: var(--bg-danger-light); border: 1px solid var(--accent-danger); padding: 15px; border-radius: 12px; text-align: center;">
                        <h3 style="color:var(--accent-danger); margin-bottom:5px;">❌ ไม่พบข้อมูลในระบบ</h3>
                        <p style="color:var(--text-main); font-size:13px; margin-bottom:15px;">ไม่มีข้อมูลที่ตรงกับ "${rawInput}" (หรือคุณไม่มีสิทธิ์ค้นหาข้ามหมู่บ้าน)</p>
                        <button class="neumorphic-btn outline-btn" style="color: var(--accent-primary); border-color: var(--accent-primary); padding: 10px;" onclick="window.createHouseholdProxy('${proxyHouseParam}', '${proxyMooParam}')">📝 เพิ่มข้อมูลเข้าสู่ระบบ / ลงทะเบียนแทนเลย</button>
                    </div>
                `;
                return;
            }

            window.currentSearchPets = {};
            mergedResults.forEach((pet, docId) => {
                if(pet.status === "cancelled" || pet.status === "deceased" || pet.status === "moved") return;
                window.currentSearchPets[docId] = pet;
                renderAdminCard(docId, pet, resContainer);
            });

        } catch(e) { console.error(e); resContainer.innerHTML = `<p style='color:var(--accent-danger);'>เกิดข้อผิดพลาด</p>`; }
    });

    searchInput.addEventListener("keypress", (e) => { if (e.key === "Enter") searchBtn.click(); });
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
    
    let roomText = pet.room_no ? `<span style="color:var(--accent-success); font-size:12px;">(ห้อง ${pet.room_no})</span>` : "";
    
    let isVac = (pet.vaccine_status === "เคยฉีด" || pet.vaccine_status === "ฉีดแล้ว");
    let vacStr = isVac ? `<span class="badge-green">เคยฉีดแล้ว</span>` : `<span class="badge-red">ไม่เคยฉีด</span>`;
    let neuterStr = pet.neuter_status === "ทำหมันแล้ว" ? `<span class="badge-green">ทำหมันแล้ว</span>` : `<span class="badge-red">ยังไม่ทำหมัน</span>`;

    let actionBtn = "";
    if (pet.status === "booked") {
        actionBtn = `<button class="btn-action-small btn-checkin" onclick="window.toggleCheckin('${docId}', '${pet.service_type}', true)">✔️ รับบริการ (โครงการ)</button>`;
    } else if (pet.status === "checked_in") {
        actionBtn = `<button class="btn-action-small btn-uncheckin" onclick="window.toggleCheckin('${docId}', '${pet.service_type}', false)">ยกเลิกติ๊กถูก</button>`;
    }
    
    actionBtn += `<button class="btn-action-small" style="color: var(--bg-main); background: var(--accent-success); border-color: var(--accent-success); margin-top: 5px;" onclick="window.openVaccineUpdateModal('${docId}')">💉 จ่าย/ฉีดวัคซีน</button>`;

    container.insertAdjacentHTML('beforeend', `
        <div class="${cardClass}">
            <div style="display: flex; gap: 12px; flex-grow: 1;">
                <img src="${pet.pet_photo_base64 || defaultPlaceholder}" class="pet-photo">
                <div class="pet-info">
                    <div class="pet-name">${pet.pet_name} ${roomText}</div>
                    <div style="color: var(--text-muted); font-size: 11px; margin-bottom: 2px;">👤 ${pet.owner_name} | 📞 ${pet.phone_number}</div>
                    <div style="color: var(--text-muted); margin-bottom: 5px;">${pet.pet_type} ${pet.pet_gender} | จอง: <span style="color:var(--accent-primary);">${pet.service_type || 'ไม่มี'}</span></div>
                    <div>${vacStr} | ${neuterStr}</div>
                </div>
            </div>
            <div class="action-buttons">
                ${actionBtn}
                <button class="btn-action-small btn-print" onclick="window.printConsentA4('${docId}')">🖨️ พิมพ์ใบยินยอม</button>
                <button class="btn-action-small btn-edit" style="color: var(--accent-primary); border-color: var(--border-light);" onclick="window.openEditDataModal('${docId}')">✏️ แก้ไขข้อมูล</button>
                <button class="btn-action-small btn-uncheckin" style="color: var(--accent-warning); border-color: rgba(245,166,35,0.4);" onclick="window.softDeleteAdmin('${docId}')">แจ้งตาย/ย้าย</button>
            </div>
        </div>
    `);
}

// ==========================================
// 4.1 ระบบแก้ไขข้อมูล (Inline Edit Modal)
// ==========================================
window.openEditDataModal = function(docId) {
    const pet = window.currentSearchPets[docId];
    if(!pet) return;
    
    document.getElementById('edit-modal-docid').value = docId;
    document.getElementById('edit-modal-owneruid').value = pet.owner_uid || '';
    document.getElementById('edit-modal-old-search-key').value = pet.house_village_search || '';
    
    document.getElementById('edit-owner-name').value = pet.owner_name || '';
    document.getElementById('edit-owner-phone').value = pet.phone_number || '';
    document.getElementById('edit-house-no').value = pet.house_no || '';
    
    let htmlMoo = '';
    let count = sysConfig?.moo_count || 16;
    for(let i=1; i<=count; i++) htmlMoo += `<option value="${i}">หมู่ ${i}</option>`;
    document.getElementById('edit-village-no').innerHTML = htmlMoo;
    document.getElementById('edit-village-no').value = pet.village_no || '';
    
    if (adminRole === "volunteer") {
        document.getElementById('edit-village-no').value = adminMoo;
        document.getElementById('edit-village-no').disabled = true;
    }

    document.getElementById('edit-pet-name').value = pet.pet_name || '';
    document.getElementById('edit-pet-type').value = pet.pet_type || 'สุนัข';
    document.getElementById('edit-pet-gender').value = pet.pet_gender || 'ตัวผู้';
    
    let mappedRear = pet.rearing_style === "เลี้ยงระบบปิด (ในบ้านตลอด)" ? "เลี้ยงในพื้นที่จำกัดตลอดเวลา" : (pet.rearing_style === "ปล่อยบางเวลา" ? "เลี้ยงในพื้นที่จำกัดบางเวลา" : (pet.rearing_style === "เลี้ยงระบบเปิด (ปล่อยอิสระ)" ? "เลี้ยงแบบปล่อยตลอดเวลา" : (pet.rearing_style || "เลี้ยงในพื้นที่จำกัดตลอดเวลา")));
    document.getElementById('edit-pet-rearing').value = mappedRear;
    
    document.getElementById('edit-pet-breed').value = pet.breed === 'ไม่ระบุ' ? '' : (pet.breed || '');
    document.getElementById('edit-pet-color').value = pet.color === 'ไม่ระบุ' ? '' : (pet.color || '');
    document.getElementById('edit-pet-age-y').value = pet.age_year || 0;
    document.getElementById('edit-pet-age-m').value = pet.age_month || 0;
    
    let isVac = (pet.vaccine_status === "ฉีดแล้ว" || pet.vaccine_status === "เคยฉีด");
    document.getElementById('edit-pet-vac').value = isVac ? "เคยฉีด" : "ไม่เคยฉีด";
    document.getElementById('edit-pet-neu').value = pet.neuter_status || 'ยังไม่ทำหมัน';

    document.getElementById('edit-data-modal').style.display = 'flex';
}

function setupEditModalLogic() {
    document.getElementById('btn-save-edit-data')?.addEventListener('click', async () => {
        const docId = document.getElementById('edit-modal-docid').value;
        const ownerUid = document.getElementById('edit-modal-owneruid').value;
        const oldSearchKey = document.getElementById('edit-modal-old-search-key').value;
        
        const oName = document.getElementById('edit-owner-name').value.trim();
        const oPhone = document.getElementById('edit-owner-phone').value.trim();
        const hNo = document.getElementById('edit-house-no').value.trim();
        const vNo = document.getElementById('edit-village-no').value;
        
        const pName = document.getElementById('edit-pet-name').value.trim();
        const pType = document.getElementById('edit-pet-type').value;
        const pGender = document.getElementById('edit-pet-gender').value;
        const pRearing = document.getElementById('edit-pet-rearing').value;
        const pBreed = document.getElementById('edit-pet-breed').value.trim() || 'ไม่ระบุ';
        const pColor = document.getElementById('edit-pet-color').value.trim() || 'ไม่ระบุ';
        const pAgeY = parseInt(document.getElementById('edit-pet-age-y').value) || 0;
        const pAgeM = parseInt(document.getElementById('edit-pet-age-m').value) || 0;
        const pVac = document.getElementById('edit-pet-vac').value;
        const pNeu = document.getElementById('edit-pet-neu').value;
        
        if(!oName || !hNo || !vNo || !pName) return alert("กรุณากรอกข้อมูลชื่อเจ้าของ, บ้านเลขที่, หมู่บ้าน และชื่อสัตว์เลี้ยง ให้ครบถ้วน");

        const btn = document.getElementById('btn-save-edit-data');
        btn.disabled = true; btn.textContent = 'กำลังบันทึก...';
        
        try {
            let newSearchKey = `${hNo}-${vNo}`;
            const pet = window.currentSearchPets[docId];
            if(pet.room_no) newSearchKey += `-${pet.room_no}`; 
            
            await updateDoc(doc(db, "pets", docId), {
                owner_name: oName, phone_number: oPhone, house_no: hNo, village_no: vNo, house_village_search: newSearchKey,
                pet_name: pName, pet_type: pType, pet_gender: pGender, rearing_style: pRearing,
                breed: pBreed, color: pColor, age_year: pAgeY, age_month: pAgeM,
                vaccine_status: pVac, neuter_status: pNeu, updated_at: serverTimestamp()
            });

            if (ownerUid && ownerUid.length > 5) {
                const uSnap = await getDoc(doc(db, "users", ownerUid));
                if(uSnap.exists()) {
                    await updateDoc(doc(db, "users", ownerUid), {
                        owner_name: oName, phone_number: oPhone, house_no: hNo, village_no: vNo, house_village_search: newSearchKey, updated_at: serverTimestamp()
                    });
                }
            }
            
            if (oldSearchKey !== newSearchKey || pet.owner_name !== oName || pet.phone_number !== oPhone) {
                const otherPetsQ = query(collection(db, "pets"), where("owner_uid", "==", ownerUid));
                const otherPetsSnap = await getDocs(otherPetsQ);
                const batchPromises = [];
                otherPetsSnap.forEach(d => {
                    if (d.id !== docId) { 
                        batchPromises.push(updateDoc(doc(db, "pets", d.id), {
                            owner_name: oName, phone_number: oPhone, house_no: hNo, village_no: vNo, house_village_search: newSearchKey, updated_at: serverTimestamp()
                        }));
                    }
                });
                await Promise.all(batchPromises);
            }

            alert("อัปเดตข้อมูลบ้านและสัตว์เลี้ยงสำเร็จ!");
            document.getElementById('edit-data-modal').style.display = 'none';
            document.getElementById('btn-search').click(); 
        } catch(e) {
            console.error(e); alert("บันทึกไม่สำเร็จ: " + e.message);
        } finally {
            btn.disabled = false; btn.textContent = '💾 บันทึก';
        }
    });
}

window.toggleCheckin = async function(docId, serviceType, isCheckingIn) {
    try {
        let updates = { status: isCheckingIn ? "checked_in" : "booked", updated_at: serverTimestamp() };
        if (isCheckingIn) {
            if (serviceType === "ทำหมันและวัคซีน" || serviceType === "ทำหมัน") { updates.neuter_status = "ทำหมันแล้ว"; updates.vaccine_status = "เคยฉีด"; } 
            
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

window.softDeleteAdmin = async function(docId) {
    const action = prompt(`กรุณาระบุสาเหตุ\nพิมพ์ "1" = เสียชีวิต\nพิมพ์ "2" = ย้ายที่อยู่`);
    if(action === "1" || action === "2") {
        try { await updateDoc(doc(db, "pets", docId), { status: action === "1" ? "deceased" : "moved", updated_at: serverTimestamp() }); document.getElementById("btn-search").click(); } 
        catch(e) { alert("เกิดข้อผิดพลาด"); }
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
            rearing_style: document.getElementById("px-rearing").value, 
            location: document.getElementById("px-location").value,
            service: document.getElementById("px-service").value,
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
                    house_village_search: searchKey, updated_at: serverTimestamp(),
                    household_role: "head", head_uid: ownerUid
                });
            }

            for(let p of window.proxyPetsBatch) {
                let petData = {
                    owner_uid: ownerUid, proxy_by: adminRealName, owner_name: owner, phone_number: phone, house_no: house, village_no: moo, room_no: room,
                    house_village_search: searchKey, pet_name: p.pet_name, pet_type: p.pet_type, pet_gender: p.pet_gender,
                    breed: p.breed, color: p.color, age_year: p.age_year, age_month: p.age_month, 
                    rearing_style: p.rearing_style, location: p.location,
                    campaign_id: sysConfig ? sysConfig.campaign_id : "",
                    pet_photo_base64: p.photo === defaultPlaceholder ? "" : p.photo, registered_timestamp: serverTimestamp(), updated_at: serverTimestamp()
                };

                if (p.service === "none") {
                    petData.status = "registered"; petData.neuter_status = "ยังไม่ทำหมัน"; petData.vaccine_status = "ไม่เคยฉีด";
                } else if (p.service === "ทำหมันและวัคซีน") {
                    petData.status = "booked"; petData.service_type = p.service; petData.neuter_status = "ยังไม่ทำหมัน"; petData.vaccine_status = "ไม่เคยฉีด"; petData.consent_agreed = false;
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
        list.insertAdjacentHTML('beforeend', `<div style="background: var(--bg-overlay-light); padding: 10px; border-radius: 8px; margin-bottom: 5px; display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size: 13px; color:var(--text-main);"><strong style="color:var(--accent-primary);">${i+1}. ${p.pet_name}</strong> (${p.pet_type} ${p.pet_gender})<br><span style="color:var(--text-muted); font-size:11px;">ทำ: ${p.service}</span></div>
            <button onclick="window.proxyPetsBatch.splice(${i},1); window.renderProxyBatchList()" style="background:none; border:none; color:var(--accent-danger); cursor:pointer; font-size:12px;">❌ ลบ</button>
        </div>`);
    });
    document.getElementById("btn-submit-proxy-batch").style.display = window.proxyPetsBatch.length > 0 ? "block" : "none";
}

// ==========================================
// 6. ระบบตารางข้อมูลดิบ (Raw Data Menu) 
// ==========================================
window.switchRawTab = async function(tabName) {
    const tbody = document.querySelector("#raw-table-content tbody");
    const thead = document.querySelector("#raw-table-content thead");

    if (tabName !== 'stray') {
        if(!confirm("⚠️ คำเตือน: การเปิดตารางข้อมูลดิบจะดึงข้อมูลสัตว์เลี้ยงทั้งหมดกว่า 5,000+ รายการ ซึ่งจะกินโควตาฐานข้อมูลจำนวนมาก!\n\nคุณแน่ใจหรือไม่ว่าต้องการโหลดข้อมูลตอนนี้? (แนะนำให้ทำเฉพาะตอนจะ Export Excel เท่านั้น)")) {
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            tbody.innerHTML = "<tr><td colspan='24' style='text-align:center; color: var(--accent-warning);'>ยกเลิกการโหลดข้อมูลเพื่อประหยัดโควตา</td></tr>";
            return;
        }
    }

    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    window.currentRawTab = tabName;
    
    if(tabName === 'household') {
        document.getElementById('filter-vac-group').style.display = 'none';
        document.getElementById('filter-neu-group').style.display = 'none';
    } else {
        document.getElementById('filter-vac-group').style.display = 'block';
        document.getElementById('filter-neu-group').style.display = 'block';
    }
    
    document.getElementById("raw-search").value = "";
    document.getElementById("raw-filter-moo").value = "";
    document.getElementById("raw-filter-type").value = "";
    document.getElementById("raw-filter-gender").value = "";
    document.getElementById("raw-filter-vac").value = "";
    document.getElementById("raw-filter-neu").value = "";

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
                    amphoe: sysConfig?.amphoe || "-", tambon: sysConfig?.tambon || "-", moo: u.village_no || "-", loc: "บ้านพักอาศัย",
                    house: u.house_no || "-", owner: u.owner_name || "-", card: "-", phone: u.phone_number || "-",
                    dm:0, dm_v:0, dm_n:0, pup_m:0, df:0, df_v:0, df_n:0, pup_f:0,
                    cm:0, cm_v:0, cm_n:0, kit_m:0, cf:0, cf_v:0, cf_n:0, kit_f:0
                };
            });

            petsSnap.forEach(d => {
                const p = d.data();
                if(p.status === "cancelled" || p.status === "deceased" || p.status === "moved") return;
                const key = p.house_village_search || `${p.house_no}-${p.village_no}`;
                
                let mappedLoc = p.location || "บ้านพักอาศัย";
                
                if(!hhStats[key]) {
                    hhStats[key] = {
                        amphoe: sysConfig?.amphoe || "-", tambon: sysConfig?.tambon || "-", moo: p.village_no || "-", loc: mappedLoc,
                        house: p.house_no || "-", owner: p.owner_name || "-", card: "-", phone: p.phone_number || "-",
                        dm:0, dm_v:0, dm_n:0, pup_m:0, df:0, df_v:0, df_n:0, pup_f:0, cm:0, cm_v:0, cm_n:0, kit_m:0, cf:0, cf_v:0, cf_n:0, kit_f:0
                    };
                }
                
                let s = hhStats[key];
                let isVac = (p.vaccine_status === "เคยฉีด" || p.vaccine_status === "ฉีดแล้ว") ? 1 : 0;
                let isNeu = (p.neuter_status === "ทำหมันแล้ว") ? 1 : 0;

                if (p.pet_type === "สุนัข" && p.pet_gender === "ตัวผู้") { s.dm++; s.dm_v += isVac; s.dm_n += isNeu; }
                else if (p.pet_type === "สุนัข" && p.pet_gender === "ตัวเมีย") { s.df++; s.df_v += isVac; s.df_n += isNeu; }
                else if (p.pet_type === "แมว" && p.pet_gender === "ตัวผู้") { s.cm++; s.cm_v += isVac; s.cm_n += isNeu; }
                else if (p.pet_type === "แมว" && p.pet_gender === "ตัวเมีย") { s.cf++; s.cf_v += isVac; s.cf_n += isNeu; }
            });

            window.rawTableData = Object.values(hhStats);
            window.renderRawTable();
            
        } else if (tabName === 'pets') {
            thead.innerHTML = "<tr><th>OwnerName</th><th>เลขบัตรประชาชน</th><th>Tel</th><th>HouseholdKey</th><th>หมู่</th><th>ตำบล</th><th>อำเภอ</th><th>ซอย</th><th>ถนน</th><th>PetType</th><th>PetName</th><th>Sex</th><th>VaccineStatus</th><th>VaccineYear</th><th>NeuteredStatus</th><th>AgeYear</th><th>AgeMonth</th><th>RearingStyle</th><th>Location</th></tr>";
            
            const snap = await getDocs(collection(db, "pets"));
            window.rawTableData = [];
            snap.forEach(d => {
                const p = d.data();
                if(p.status === "cancelled" || p.status === "deceased" || p.status === "moved") return;
                
                p._mapped_vac = (p.vaccine_status === "เคยฉีด" || p.vaccine_status === "ฉีดแล้ว") ? "เคยฉีด" : "ไม่เคยฉีด";
                p._mapped_rear = p.rearing_style === "เลี้ยงระบบปิด (ในบ้านตลอด)" ? "เลี้ยงในพื้นที่จำกัดตลอดเวลา" : (p.rearing_style === "ปล่อยบางเวลา" ? "เลี้ยงในพื้นที่จำกัดบางเวลา" : (p.rearing_style === "เลี้ยงระบบเปิด (ปล่อยอิสระ)" ? "เลี้ยงแบบปล่อยตลอดเวลา" : (p.rearing_style || "-")));
                p._mapped_loc = p.location || "บ้านพักอาศัย";
                
                window.rawTableData.push(p);
            });
            window.renderRawTable();
            
        } else if (tabName === 'stray') {
            thead.innerHTML = "<tr><th>อำเภอ</th><th>ตำบล</th><th>หมู่</th><th>สถานที่อาศัย</th><th>LocationDesc</th><th>FeederName</th><th>เลขบัตร</th><th>FeederPhone</th><th>จำนวนหมา</th><th>วัคซีน</th><th>ทำหมัน</th><th>จำนวนแมว</th><th>วัคซีน.1</th><th>ทำหมัน.1</th></tr>";
            
            const snap = await getDocs(collection(db, "stray_reports"));
            window.rawTableData = []; 
            snap.forEach(d => {
                const r = d.data();
                window.rawTableData.push({
                    amphoe: sysConfig?.amphoe || "-",
                    tambon: sysConfig?.tambon || "-",
                    moo: r.moo || "-",
                    loc: r.location_category || "สถานที่สาธารณะ/ที่จรจัด",
                    landmark: r.landmark || "-",
                    feeder_name: r.reporter_name || "-",
                    card: r.reporter_id_card || "-",
                    feeder_phone: r.reporter_phone || "-",
                    dog_count: r.dog_count || 0,
                    cat_count: r.cat_count || 0,
                    dog_vac_done: r.dog_vac_done || 0,
                    dog_neu_done: r.dog_neu_done || 0,
                    cat_vac_done: r.cat_vac_done || 0,
                    cat_neu_done: r.cat_neu_done || 0,
                    status: r.status
                });
            });
            
            let html = "";
            let count = 0;
            window.rawTableData.forEach(r => {
                count++;
                let dVac = r.dog_vac_done || 0;
                let dNeu = r.dog_neu_done || 0;
                let cVac = r.cat_vac_done || 0;
                let cNeu = r.cat_neu_done || 0;

                html += `<tr><td>${r.amphoe}</td><td>${r.tambon}</td><td>${r.moo}</td><td>${r.loc}</td><td>${r.landmark}</td><td>${r.feeder_name}</td><td>${r.card}</td><td>${r.feeder_phone}</td><td>${r.dog_count}</td><td>${dVac}</td><td>${dNeu}</td><td>${r.cat_count}</td><td>${cVac}</td><td>${cNeu}</td></tr>`;
            });
            if(count === 0) html = `<tr><td colspan="14" style="text-align:center;">ยังไม่มีข้อมูลเบาะแสสัตว์จรจัด</td></tr>`;
            tbody.innerHTML = html;
            return;
        }
    } catch(e) { tbody.innerHTML = `<tr><td colspan='24' style='color:var(--accent-danger);'>Error: ${e.message}</td></tr>`; }
}

window.renderRawTable = function() {
    const tbody = document.querySelector("#raw-table-content tbody");
    const searchText = document.getElementById("raw-search").value.toLowerCase();
    const fMoo = document.getElementById("raw-filter-moo").value;
    const fType = document.getElementById("raw-filter-type").value;
    const fGender = document.getElementById("raw-filter-gender").value;
    const fVac = document.getElementById("raw-filter-vac").value;
    const fNeu = document.getElementById("raw-filter-neu").value;

    let html = "";
    let count = 0;

    if (window.currentRawTab === 'household') {
        window.rawTableData.forEach(s => {
            if (fMoo && s.moo != fMoo) return;
            if (fType === "สุนัข" && !(s.dm>0 || s.df>0 || s.pup_m>0 || s.pup_f>0)) return;
            if (fType === "แมว" && !(s.cm>0 || s.cf>0 || s.kit_m>0 || s.kit_f>0)) return;
            if (fGender === "ตัวผู้" && !(s.dm>0 || s.cm>0 || s.pup_m>0 || s.kit_m>0)) return;
            if (fGender === "ตัวเมีย" && !(s.df>0 || s.cf>0 || s.pup_f>0 || s.kit_f>0)) return;
            
            const searchStr = `${s.house} ${s.moo} ${s.owner} ${s.phone}`.toLowerCase();
            if (searchText && !searchStr.includes(searchText)) return;

            count++;
            html += `<tr><td>${s.amphoe}</td><td>${s.tambon}</td><td>${s.moo}</td><td>${s.loc}</td><td>${s.house}</td><td>${s.owner}</td><td>${s.card}</td><td>${s.phone}</td><td>${s.dm}</td><td>${s.dm_v}</td><td>${s.dm_n}</td><td>${s.pup_m}</td><td>${s.df}</td><td>${s.df_v}</td><td>${s.df_n}</td><td>${s.pup_f}</td><td>${s.cm}</td><td>${s.cm_v}</td><td>${s.cm_n}</td><td>${s.kit_m}</td><td>${s.cf}</td><td>${s.cf_v}</td><td>${s.cf_n}</td><td>${s.kit_f}</td></tr>`;
        });
    } else if (window.currentRawTab === 'pets') {
        window.rawTableData.forEach(p => {
            if (fMoo && p.village_no != fMoo) return;
            if (fType && p.pet_type != fType) return;
            if (fGender && p.pet_gender != fGender) return;
            if (fVac && p._mapped_vac != fVac) return;
            if (fNeu && p.neuter_status != fNeu) return;
            
            const searchStr = `${p.house_no} ${p.village_no} ${p.owner_name} ${p.pet_name} ${p.phone_number}`.toLowerCase();
            if (searchText && !searchStr.includes(searchText)) return;

            count++;
            html += `<tr><td>${p.owner_name||'-'}</td><td>-</td><td>${p.phone_number||'-'}</td><td>${p.house_village_search||'-'}</td><td>${p.village_no||'-'}</td><td>${sysConfig?.tambon||'-'}</td><td>${sysConfig?.amphoe||'-'}</td><td>-</td><td>-</td><td>${p.pet_type||'-'}</td><td>${p.pet_name||'-'}</td><td>${p.pet_gender||'-'}</td><td>${p._mapped_vac}</td><td>${p.vaccine_year||'-'}</td><td>${p.neuter_status||'-'}</td><td>${p.age_year||0}</td><td>${p.age_month||0}</td><td>${p._mapped_rear}</td><td>${p._mapped_loc}</td></tr>`;
        });
    }

    if(count === 0) html = `<tr><td colspan="24" style="text-align:center;">ไม่พบข้อมูลที่ค้นหา</td></tr>`;
    tbody.innerHTML = html;
}

function setupExcelExport() {
    document.getElementById("btn-export-excel").addEventListener("click", () => {
        const table = document.getElementById("raw-table-content");
        const wb = XLSX.utils.table_to_book(table, {sheet: "Sheet1", raw: true});
        let tabTh = window.currentRawTab === 'household' ? 'รายงานบ้าน' : (window.currentRawTab === 'stray' ? 'รายงานจร' : 'รายงานตัว');
        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `Export_${tabTh}_${dateStr}.xlsx`;
        XLSX.writeFile(wb, fileName);
    });
}

// ==========================================
// 7. ตั้งค่าระบบ (Settings & Canvas Signature)
// ==========================================
document.getElementById("st-logo-upload")?.addEventListener("change", (e) => {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement("canvas");
            const MAX_WIDTH = 250; let width = img.width; let height = img.height;
            if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
            else { if (height > MAX_WIDTH) { width *= MAX_WIDTH / height; height = MAX_WIDTH; } }
            canvas.width = width; canvas.height = height;
            canvas.getContext("2d").drawImage(img, 0, 0, width, height);
            currentAgencyLogoBase64 = canvas.toDataURL("image/png");
            document.getElementById("st-logo-preview").src = currentAgencyLogoBase64;
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});
document.getElementById("btn-clear-logo")?.addEventListener("click", () => {
    currentAgencyLogoBase64 = ""; document.getElementById("st-logo-preview").src = defaultLogoIcon;
});

document.getElementById("st-theme-selector")?.addEventListener("change", (e) => {
    const customBox = document.getElementById("custom-color-settings");
    if(customBox) {
        customBox.style.display = e.target.value === "custom" ? "block" : "none";
    }
});

function loadSettingsToForm() {
    if(sysConfig) {
        if(document.getElementById("st-theme-selector")) {
            document.getElementById("st-theme-selector").value = sysConfig.theme || "default";
            
            if (sysConfig.theme === "custom") {
                document.getElementById("custom-color-settings").style.display = "block";
                if(sysConfig.custom_colors) {
                    document.getElementById("c-bg-main").value = sysConfig.custom_colors.bg_main || "#141E30";
                    document.getElementById("c-bg-card").value = sysConfig.custom_colors.bg_card || "#1b2941";
                    document.getElementById("c-text-main").value = sysConfig.custom_colors.text_main || "#E0E5EC";
                    document.getElementById("c-text-muted").value = sysConfig.custom_colors.text_muted || "#A0B0C0";
                    document.getElementById("c-accent-primary").value = sysConfig.custom_colors.accent_primary || "#D4AF37";
                    document.getElementById("c-accent-success").value = sysConfig.custom_colors.accent_success || "#50E3C2";
                }
            } else {
                document.getElementById("custom-color-settings").style.display = "none";
            }
        }

        document.getElementById("st-moo-count").value = sysConfig.moo_count || 16;
        document.getElementById("st-agency").value = sysConfig.agency_name || "";
        
        currentAgencyLogoBase64 = sysConfig.agency_logo_base64 || "";
        if(document.getElementById("st-logo-preview")) {
            document.getElementById("st-logo-preview").src = currentAgencyLogoBase64 || defaultLogoIcon;
        }

        if(document.getElementById("st-campaign-id")) {
            document.getElementById("st-campaign-id").value = sysConfig.campaign_id || "";
        }

        document.getElementById("st-tambon").value = sysConfig.tambon || ""; document.getElementById("st-amphoe").value = sysConfig.amphoe || ""; document.getElementById("st-province").value = sysConfig.province || ""; document.getElementById("st-phone").value = sysConfig.phone || "";
        document.getElementById("st-max-neuter").value = sysConfig.max_neuter_per_house || 2;
        document.getElementById("st-start").value = sysConfig.nt_start_reg || ""; document.getElementById("st-end").value = sysConfig.nt_end_reg || ""; document.getElementById("st-nt-date").value = sysConfig.nt_date || ""; document.getElementById("st-nt-loc").value = sysConfig.nt_location || "";
        document.getElementById("st-q-neuter").value = sysConfig.quota_neuter || 100;
        
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
        html += `<div style="display:flex; flex-direction:column;"><label style="font-size:12px; color:var(--accent-secondary);">หมู่ ${i}</label><input type="text" id="st-vol-${i}" class="neumorphic-input" style="padding: 5px; font-size:13px;" value="${val}"></div>`;
    }
    document.getElementById("st-volunteer-secrets-container").innerHTML = html;
}
document.getElementById("st-moo-count").addEventListener("change", renderVolunteerSecretInputs);

function setupSettingsForm() {
    document.getElementById("btn-save-settings").addEventListener("click", async () => {
        const btn = document.getElementById("btn-save-settings"); btn.disabled = true; btn.textContent = "กำลังบันทึก...";
        try {
            const themeSelected = document.getElementById("st-theme-selector") ? document.getElementById("st-theme-selector").value : "default";
            const updates = {
                theme: themeSelected,
                campaign_id: document.getElementById("st-campaign-id") ? document.getElementById("st-campaign-id").value.trim() : "",
                moo_count: parseInt(document.getElementById("st-moo-count").value) || 16, max_neuter_per_house: parseInt(document.getElementById("st-max-neuter").value) || 2,
                agency_name: document.getElementById("st-agency").value, tambon: document.getElementById("st-tambon").value, amphoe: document.getElementById("st-amphoe").value, province: document.getElementById("st-province").value, phone: document.getElementById("st-phone").value,
                nt_start_reg: document.getElementById("st-start").value, nt_end_reg: document.getElementById("st-end").value, nt_date: document.getElementById("st-nt-date").value, nt_location: document.getElementById("st-nt-loc").value,
                quota_neuter: parseInt(document.getElementById("st-q-neuter").value) || 100,
                current_vaccine_year: parseInt(document.getElementById("st-vac-year").value) || 2569, vaccine_brand: document.getElementById("st-vac-brand").value, vaccine_lot: document.getElementById("st-vac-lot").value, vaccine_exp: document.getElementById("st-vac-exp").value,
                rep_name: document.getElementById("st-rep-name").value, rep_pos: document.getElementById("st-rep-pos").value, rev_name: document.getElementById("st-rev-name").value, rev_pos: document.getElementById("st-rev-pos").value, app_name: document.getElementById("st-app-name").value, app_pos: document.getElementById("st-app-pos").value,
                agency_logo_base64: currentAgencyLogoBase64
            };
            
            if (themeSelected === "custom") {
                updates.custom_colors = {
                    bg_main: document.getElementById("c-bg-main").value,
                    bg_card: document.getElementById("c-bg-card").value,
                    text_main: document.getElementById("c-text-main").value,
                    text_muted: document.getElementById("c-text-muted").value,
                    accent_primary: document.getElementById("c-accent-primary").value,
                    accent_success: document.getElementById("c-accent-success").value
                };
            }

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
// 8. ระบบรายงาน & พิมพ์ใบยินยอม 
// ==========================================
window.printConsentA4 = async function(docId) {
    const pet = window.currentSearchPets[docId];
    if(!pet || !pet.signature_base64) return alert("ไม่สามารถพิมพ์ได้ เนื่องจากยังไม่มีลายเซ็น");
    try {
        const userSnap = await getDoc(doc(db, "users", pet.owner_uid));
        const user = userSnap.exists() ? userSnap.data() : {};

        const printName = pet.owner_name || user.owner_name || "-";
        const printPhone = pet.phone_number || user.phone_number || "-";
        const printHouse = pet.house_no || user.house_no || "-";
        const printVillage = pet.village_no || user.village_no || "-";

        document.body.classList.add('print-consent-mode');
        
        // เราสามารถใช้ element เดิมถ้ามี หรือสร้างหน้าพิมพ์แบบ BatchPrint
        // เพื่อความชัวร์ ใช้ระบบ Print แบบ Batch 1 ตัว
        const container = document.getElementById("print-all-consents-container"); 
        container.innerHTML = "";
        const agency = sysConfig ? sysConfig.agency_name : "เทศบาล...";
        
        container.insertAdjacentHTML('beforeend', `
            <div class="consent-page" style="display:block;">
                <div class="queue-badge">คิวที่: ${pet.queue_no || 'N/A'}</div>
                <h2 style="text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 5px;">ใบยินยอมผ่าตัดทำหมัน</h2>
                <h3 style="text-align: center; font-size: 18px; margin-bottom: 30px;">กับ${agency} ร่วมกับปศุสัตว์จังหวัดสมุทรปราการ</h3>
                <div style="font-size: 16px; line-height: 2;">
                    <p><strong>ข้าพเจ้า (ชื่อเจ้าของ):</strong> ${printName}</p>
                    <p><strong>เบอร์โทรศัพท์:</strong> ${printPhone}</p>
                    <p><strong>ที่อยู่ปัจจุบัน:</strong> บ้านเลขที่ ${printHouse} หมู่ที่ ${printVillage} ตำบลบางแก้ว อำเภอบางพลี จังหวัดสมุทรปราการ</p>
                    <p style="margin-top: 15px;"><strong>มีความประสงค์ขอรับบริการทำหมัน/ฉีดวัคซีน ให้แก่สัตว์เลี้ยงดังนี้:</strong></p>
                    <p>ชื่อสัตว์เลี้ยง: ${pet.pet_name} &nbsp;&nbsp; ประเภท: ${pet.pet_type} &nbsp;&nbsp; เพศ: ${pet.pet_gender}</p>
                    <p style="margin-top: 30px; text-indent: 40px; text-align: justify;">${legalConsentText}</p>
                </div>
                <div style="margin-top: 50px; text-align: center;">
                    <img src="${pet.signature_base64}" style="max-height: 100px; display: block; margin: 0 auto; border-bottom: 1px dotted #000;">
                    <p style="margin-top: 10px;">(ลงชื่อ) .............................................................. ผู้ยินยอม</p>
                    <p style="margin-top: 5px;">(${printName})</p>
                </div>
            </div>
        `);
        
        const pageStyle = document.createElement('style');
        pageStyle.innerHTML = '@page { size: portrait; }';
        document.head.appendChild(pageStyle);

        document.body.classList.add('print-all-consents-mode'); 
        window.print(); 
        document.body.classList.remove('print-all-consents-mode');
        document.body.classList.remove('print-consent-mode');
        
        document.head.removeChild(pageStyle);
    } catch (e) { console.error(e); alert("เกิดข้อผิดพลาดในการดึงข้อมูล"); }
}

const execBatchPrint = async (printType) => {
    const btnAll = document.getElementById("btn-print-all-booked");
    const btnCheck = document.getElementById("btn-print-checked-in");
    btnAll.disabled = true; btnCheck.disabled = true;
    
    const currentCamp = sysConfig?.campaign_id || "";
    if(!currentCamp) {
        alert("กรุณาตั้งชื่อ 'รอบโครงการ (Campaign ID)' ในหน้าตั้งค่าก่อนพิมพ์ครับ");
        btnAll.disabled = false; btnCheck.disabled = false;
        return;
    }

    try {
        const qCamp = query(collection(db, "pets"), where("campaign_id", "==", currentCamp));
        const snap = await getDocs(qCamp); 
        let validPets = [];
        
        snap.forEach(d => { 
            const p = d.data(); 
            if(p.status === "cancelled" || p.status === "deceased" || p.status === "moved" || !p.signature_base64 || !p.consent_agreed) return;
            
            if (printType === 'checked_in' && p.status !== 'checked_in') return;
            if (printType === 'all' && (p.status !== 'booked' && p.status !== 'checked_in')) return;

            validPets.push({ id: d.id, ...p }); 
        });

        validPets.sort((a, b) => (a.queue_no || 0) - (b.queue_no || 0));
        
        if(validPets.length === 0) {
            alert(`ไม่พบข้อมูลในรอบ "${currentCamp}" ตามเงื่อนไขที่เลือกครับ`);
            return;
        }

        const container = document.getElementById("print-all-consents-container"); 
        container.innerHTML = "";
        const agency = sysConfig ? sysConfig.agency_name : "เทศบาล...";
        
        validPets.forEach((pet) => {
            container.insertAdjacentHTML('beforeend', `
                <div class="consent-page">
                    <div class="queue-badge">คิวที่: ${pet.queue_no || 'N/A'}</div>
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
        
        const pageStyle = document.createElement('style');
        pageStyle.innerHTML = '@page { size: portrait; }';
        document.head.appendChild(pageStyle);

        document.getElementById('print-options-modal').style.display = 'none';
        document.body.classList.add('print-all-consents-mode'); 
        window.print(); 
        document.body.classList.remove('print-all-consents-mode');
        
        document.head.removeChild(pageStyle);
    } catch(e) { alert("เกิดข้อผิดพลาดในการโหลดข้อมูลพิมพ์"); } 
    finally { btnAll.disabled = false; btnCheck.disabled = false; }
};

document.getElementById("btn-print-all-booked")?.addEventListener("click", () => execBatchPrint('all'));
document.getElementById("btn-print-checked-in")?.addEventListener("click", () => execBatchPrint('checked_in'));

function setupReportAndPrint() {
    document.getElementById("btn-print-report").addEventListener("click", () => { 
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
            const currentCamp = sysConfig?.campaign_id || "";
            let snap;
            
            if (currentCamp) {
                const qCamp = query(collection(db, "pets"), where("campaign_id", "==", currentCamp));
                snap = await getDocs(qCamp);
            } else {
                snap = await getDocs(collection(db, "pets"));
            }
            
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
}

function renderTable(tableId, data) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    const tot = (o) => o.d.m + o.d.f + o.c.m + o.c.f;
    const n = data.n, v = data.v;
    const tn = tot(n), tv = tot(v);

    tbody.innerHTML = `
        <tr><td style="text-align: left;">ทำหมัน + วัคซีน</td><td>${n.d.m}</td><td>${n.d.f}</td><td>${n.c.m}</td><td>${n.c.f}</td><td style="font-weight: bold;">${tn}</td></tr>
        <tr><td style="text-align: left;">วัคซีนอย่างเดียว</td><td>${v.d.m}</td><td>${v.d.f}</td><td>${v.c.m}</td><td>${v.c.f}</td><td style="font-weight: bold;">${tv}</td></tr>
        <tr style="background: var(--bg-overlay-light); font-weight: bold;"><td>รวมสุทธิ</td><td>${n.d.m + v.d.m}</td><td>${n.d.f + v.d.f}</td><td>${n.c.m + v.c.m}</td><td>${n.c.f + v.c.f}</td><td style="color: var(--accent-primary); font-size: 16px;">${tn + tv}</td></tr>
    `;
}

// ==========================================
// [เฟส 3] ระบบจัดการสัตว์จรจัด (Admin Stray Management)
// ==========================================
window.loadStrayReports = async function() {
    const container = document.getElementById("stray-reports-container");
    const filter = document.getElementById("stray-filter-status").value; 
    container.innerHTML = "<p style='color:var(--accent-primary); text-align:center;'>กำลังดึงข้อมูลเบาะแส...</p>";

    try {
        let qConstraints = [];
        if (filter !== "all") {
            qConstraints.push(where("status", "==", filter));
        }
        
        const q = query(collection(db, "stray_reports"), ...qConstraints);
        const snap = await getDocs(q);
        
        let reports = [];
        snap.forEach(d => { reports.push({ id: d.id, ...d.data() }); });
        
        reports.sort((a,b) => (b.reported_at?.toMillis() || 0) - (a.reported_at?.toMillis() || 0));

        container.innerHTML = "";
        let count = 0;
        let pendingCount = 0;

        reports.forEach(r => {
            if (r.status === "pending") pendingCount++;
            count++;

            const isPending = r.status === "pending";
            const cardStyle = isPending ? "border-left: 5px solid var(--accent-danger);" : "border-left: 5px solid var(--accent-success); background: var(--bg-overlay-light);";
            const badge = isPending ? `<span style="background: var(--bg-danger-light); color: var(--accent-danger); padding: 2px 6px; border-radius: 4px; font-size: 11px;">🔴 รอดำเนินการ</span>` : `<span style="background: var(--bg-success-light); color: var(--accent-success); padding: 2px 6px; border-radius: 4px; font-size: 11px;">✅ ดำเนินการแล้ว</span>`;
            
            let photoHtml = r.photo_base64 && r.photo_base64 !== "" 
                ? `<img src="${r.photo_base64}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px; border: 1px solid var(--accent-secondary); flex-shrink:0;">` 
                : `<div style="width: 100px; height: 100px; background: var(--bg-overlay); border-radius: 8px; display:flex; align-items:center; justify-content:center; color:var(--text-placeholder); font-size:10px; text-align:center;">ไม่มีรูปภาพ</div>`;

            let actionBtn = isPending 
                ? `<button class="btn-action-small" style="background: var(--accent-success); color: var(--bg-main); border-color: var(--accent-success); font-weight:bold;" onclick="window.openStrayActionModal('${r.id}', ${r.dog_count}, ${r.cat_count})">✔️ มาร์คว่าจัดการแล้ว</button>`
                : `<button class="btn-action-small" style="background: transparent; color: var(--text-muted); border-color: var(--border-light);" onclick="window.updateStrayStatus('${r.id}', 'pending')">↩️ ย้อนกลับสถานะ</button>`;

            container.insertAdjacentHTML('beforeend', `
                <div class="card neumorphic" style="padding: 15px; margin-bottom: 15px; ${cardStyle}">
                    <div style="display: flex; gap: 15px;">
                        ${photoHtml}
                        <div style="flex-grow: 1; font-size: 13px; line-height: 1.6; color: var(--text-main);">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                <b style="color: var(--accent-primary); font-size: 15px;">แจ้งพบที่: หมู่ ${r.moo}</b>
                                ${badge}
                            </div>
                            <div style="color: var(--text-muted);">📍 ${r.landmark}</div>
                            <div style="margin-top: 5px;">🐕 สุนัขแจ้ง: <b style="color:var(--text-bright);">${r.dog_count}</b> | 🐈 แมวแจ้ง: <b style="color:var(--text-bright);">${r.cat_count}</b></div>
                            ${!isPending ? `<div style="margin-top: 5px; color: var(--accent-success);">✅ ผลงานทำจริง: (หมาหมัน ${r.dog_neu_done}, หมาวัคซีน ${r.dog_vac_done}) (แมวหมัน ${r.cat_neu_done}, แมววัคซีน ${r.cat_vac_done})</div>` : ''}
                            <div style="margin-top: 5px; font-size: 12px; color: var(--accent-secondary);">👤 ผู้แจ้ง: ${r.reporter_name} <a href="tel:${r.reporter_phone}" style="color: var(--accent-primary);">(📞 ${r.reporter_phone})</a></div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 15px;">
                        <button class="btn-action-small" style="color: var(--accent-secondary); border-color: rgba(129,161,193,0.4);" onclick="window.openGoogleMaps(${r.lat}, ${r.lng})">🗺️ นำทาง Google Maps</button>
                        ${actionBtn}
                    </div>
                </div>
            `);
        });

        if (count === 0) container.innerHTML = `<p style="text-align:center; color:var(--text-muted);">ไม่พบข้อมูลเบาะแสในหมวดหมู่นี้</p>`;

        const badgeEl = document.getElementById("stray-badge");
        if (badgeEl) {
            if (filter === "completed") {
                badgeEl.style.display = "none";
            } else if (pendingCount > 0) { 
                badgeEl.textContent = pendingCount; badgeEl.style.display = "inline-block"; 
            } else { 
                badgeEl.style.display = "none"; 
            }
        }

    } catch (e) {
        console.error(e);
        container.innerHTML = `<p style="color:var(--accent-danger); text-align:center;">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>`;
    }
}

window.openGoogleMaps = function(lat, lng) {
    if(!lat || !lng) return alert("ไม่มีข้อมูลพิกัด GPS ที่ชัดเจน");
    window.open(`https://maps.google.com/?q=${lat},${lng}`, '_blank');
}

window.openStrayActionModal = function(docId, repDog, repCat) {
    document.getElementById('stray-modal-docid').value = docId;
    document.getElementById('stray-modal-rep-dog').textContent = repDog;
    document.getElementById('stray-modal-rep-cat').textContent = repCat;
    
    document.getElementById('stray-act-dog-neu').value = repDog;
    document.getElementById('stray-act-dog-vac').value = repDog;
    document.getElementById('stray-act-cat-neu').value = repCat;
    document.getElementById('stray-act-cat-vac').value = repCat;

    document.getElementById('stray-action-modal').style.display = 'flex';
}

window.updateStrayStatus = async function(docId, newStatus) {
    if (newStatus === 'pending') {
        if(confirm('ย้อนกลับสถานะเป็น "รอดำเนินการ"?\n(สถิติผลงานที่กรอกไว้สำหรับเคสนี้จะถูกล้างค่าเป็น 0)')) {
            try {
                await updateDoc(doc(db, "stray_reports", docId), { 
                    status: newStatus,
                    dog_neu_done: 0, dog_vac_done: 0, cat_neu_done: 0, cat_vac_done: 0 
                });
                window.loadStrayReports();
            } catch(e) { alert("อัปเดตสถานะไม่สำเร็จ"); }
        }
    }
}

// ==========================================
// ระบบอัปเดตวัคซีน + ลายเซ็นยินยอม (Walk-in / นอกรอบ)
// ==========================================
window.openVaccineUpdateModal = function(docId) {
    const pet = window.currentSearchPets[docId];
    if(!pet) return;
    
    document.getElementById("vac-modal-docid").value = docId;
    document.getElementById("vac-modal-pet-name").textContent = pet.pet_name;
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById("vac-modal-date").value = today;
    
    document.getElementById("vac-modal-brand-txt").textContent = sysConfig?.vaccine_brand || "ยังไม่ได้ตั้งค่ายี่ห้อ";
    document.getElementById("vac-modal-lot-txt").textContent = sysConfig?.vaccine_lot || "-";
    document.getElementById("vac-modal-exp-txt").textContent = sysConfig?.vaccine_exp || "-";
    
    document.getElementById("vac-modal-injector").value = "admin";
    
    document.getElementById("vaccine-update-modal").style.display = "flex";

    setTimeout(() => {
        if(window.vacSignaturePad) {
            const canvas = document.getElementById('vac-signature-pad');
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
            canvas.getContext("2d").scale(ratio, ratio);
            window.vacSignaturePad.clear();
        }
    }, 200);
}

document.getElementById("btn-save-vaccine-update")?.addEventListener("click", async () => {
    if (window.vacSignaturePad && window.vacSignaturePad.isEmpty()) {
        return alert("กรุณาให้ประชาชนเซ็นชื่อรับรองด้วยครับ");
    }

    const docId = document.getElementById("vac-modal-docid").value;
    const dateVal = document.getElementById("vac-modal-date").value;
    const injector = document.getElementById("vac-modal-injector").value;
    const signatureData = window.vacSignaturePad.toDataURL("image/png");
    
    if(!dateVal) return alert("กรุณาระบุวันที่รับบริการ");
    
    const btn = document.getElementById("btn-save-vaccine-update");
    btn.disabled = true; btn.textContent = "กำลังบันทึก...";
    
    try {
        const dateObj = new Date(dateVal);
        const yearTH = dateObj.getFullYear() + 543;
        const formattedDate = dateObj.toLocaleDateString('th-TH', { year:'numeric', month:'2-digit', day:'2-digit' });
        
        let injectorName = adminRealName; 
        if (injector === "owner") { injectorName = "เจ้าของรับวัคซีนไปฉีดเอง"; }
        
        await updateDoc(doc(db, "pets", docId), {
            vaccine_status: "เคยฉีด",
            vaccine_year: yearTH,
            vaccine_date: formattedDate,
            vaccine_brand: sysConfig?.vaccine_brand || "",
            vaccine_lot: sysConfig?.vaccine_lot || "",
            vaccine_exp: sysConfig?.vaccine_exp || "",
            vaccinated_by_admin: injectorName,
            vaccine_consent_signature: signatureData,
            vaccine_consent_timestamp: serverTimestamp(),
            updated_at: serverTimestamp()
        });
        
        alert("🎉 บันทึกการยินยอมและอัปเดตประวัติวัคซีนเรียบร้อยแล้ว!");
        document.getElementById("vaccine-update-modal").style.display = "none";
        document.getElementById("btn-search").click(); 
        
    } catch(e) {
        console.error(e);
        alert("เกิดข้อผิดพลาด: " + e.message);
    } finally {
        btn.disabled = false; btn.textContent = "💾 บันทึกและยอมรับ";
    }
});
