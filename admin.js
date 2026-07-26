import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
let sysConfig = null; 
window.currentSearchPets = {};
window.allBookingsList = [];

const neuterConsentText = "ข้าพเจ้ายินยอมให้เจ้าหน้าที่ของปศุสัตว์จังหวัดสมุทรปราการทำการวางยาสลบเพื่อการผ่าตัดสัตว์ ซึ่งการวางยาสลบอาจมีผลข้างเคียงของยาเกิดขึ้น หากสัตว์ดังกล่าวได้รับอันตรายถึงชีวิตและเจ้าหน้าที่ได้ให้ความช่วยเหลืออย่างเต็มที่แล้ว ภายใต้จรรยาบรรณของการประกอบวิชาชีพสัตวแพทย์ ข้าพเจ้าจะรับผิดชอบดูแลแผลหลังการผ่าตัดตามคำแนะนำการดูแลสัตว์ภายหลังการผ่าตัดอย่างเคร่งครัด หากเกิดการผิดพลาดในการวางยาสลบ การผ่าตัด และไม่ว่าในกรณีใดๆ ข้าพเจ้าจะไม่เรียกร้องหรือฟ้องดำเนินคดีในทางอาญาและทางแพ่งกับเจ้าหน้าที่และส่วนราชการสังกัดของกรมปศุสัตว์แต่อย่างใด<br><br>เจ้าหน้าที่ของปศุสัตว์จังหวัดสมุทรปราการ ได้อธิบายและข้าพเจ้าได้อ่านข้อความเข้าใจโดยตลอดแล้ว จึงลงลายมือไว้เป็นหลักฐาน (ออกให้โดยเทศบาลเมืองบางแก้วได้รับการวางยาสลบจากเจ้าหน้าที่ ปศุสัตว์จังหวัดสมุทรปราการ)";
const vaccineConsentText = "ข้าพเจ้ายินยอมให้เจ้าหน้าที่ทำการฉีดวัคซีนป้องกันโรคพิษสุนัขบ้าให้แก่สัตว์เลี้ยงของข้าพเจ้า และข้าพเจ้าจะรับผิดชอบดูแลสัตว์เลี้ยงอย่างใกล้ชิดภายหลังการรับวัคซีนตามคำแนะนำของเจ้าหน้าที่ หากเกิดอาการแพ้วัคซีนหรือผลข้างเคียงใดๆ ข้าพเจ้าจะไม่เรียกร้องหรือฟ้องดำเนินคดีในทางอาญาและทางแพ่งกับเจ้าหน้าที่และเทศบาลเมืองบางแก้วแต่อย่างใด";

document.addEventListener("DOMContentLoaded", () => {
    initializeLiff();
    setupAdminLogin();
    setupAdminSidebar();
    setupAdminSearch();
    setupAdminSettings();
    setupPrintAllConsents();
});

async function initializeLiff() {
    try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) liff.login();
        else {
            userProfileData = await liff.getProfile();
            await loadSystemConfig();
            checkAdminRole();
        }
    } catch (err) { console.error("LIFF Init Error", err); }
}

async function loadSystemConfig() {
    try {
        const confSnap = await getDoc(doc(db, "system_config", "main_config"));
        if(confSnap.exists()) sysConfig = confSnap.data();
    } catch(e) { console.error("Error loading config:", e); }
}

async function checkAdminRole() {
    try {
        const adminDoc = await getDoc(doc(db, "admins", userProfileData.userId));
        document.getElementById("loading").style.display = "none";
        
        if (adminDoc.exists()) {
            document.getElementById("admin-container").style.display = "block";
        } else {
            // ไม่ใช่แอดมิน เด้งให้กรอกรหัสลับ
            document.getElementById("secret-modal").style.display = "flex";
        }
    } catch (error) { console.error("Role Check Error", error); }
}

function setupAdminLogin() {
    document.getElementById("btn-close-secret").addEventListener("click", () => { 
        document.getElementById("secret-modal").style.display = "none"; 
        alert("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
        liff.closeWindow(); // ปิดหน้าต่างถ้าไม่ใช่แอดมิน
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

function setupAdminSidebar() {
    const sidebar = document.getElementById("admin-sidebar");
    
    window.switchAdminView = function(viewId) {
        document.querySelectorAll(".admin-view").forEach(el => el.style.display = "none");
        document.getElementById(viewId).style.display = "block";
        sidebar.style.right = "-250px";
    }

    document.getElementById("menu-checkin").addEventListener("click", () => window.switchAdminView("admin-container"));
    document.getElementById("menu-report").addEventListener("click", () => { window.switchAdminView("report-container"); generateReport(); });
    document.getElementById("menu-user-list").addEventListener("click", () => { window.switchAdminView("user-list-container"); loadUserList(); });
    document.getElementById("menu-settings").addEventListener("click", () => { window.switchAdminView("settings-container"); loadAdminSettings(); });
    
    document.getElementById("menu-logout").addEventListener("click", async () => {
        if(confirm("ต้องการออกจากระบบเจ้าหน้าที่ใช่หรือไม่?")) {
            await deleteDoc(doc(db, "admins", userProfileData.userId));
            location.reload();
        }
    });
}

// ==========================================
// 1. ระบบ Check-in (ค้นหา และ อัปเดตประวัติสมุด)
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
            if(snap.empty) { res.innerHTML = "<p style='text-align:center; color:#ff6b6b;'>ไม่พบข้อมูลบ้านเลขที่นี้</p>"; return; }

            res.innerHTML = ""; window.currentSearchPets = {};
            let foundBooking = false;

            snap.forEach((d) => {
                const pet = d.data(); const docId = d.id;
                // โชว์เฉพาะสัตว์ที่มีการจองคิว
                if(pet.status !== "booked" && pet.status !== "checked_in") return; 
                
                foundBooking = true;
                window.currentSearchPets[docId] = pet;
                
                const badge = pet.consent_agreed ? `<span class="status-badge badge-green" onclick="window.viewConsent('${docId}')">📄 ใบยินยอม (กดดู)</span>` : `<span class="status-badge badge-red">📄 ยังไม่เซ็น</span>`;
                const printBtn = pet.consent_agreed ? `<button type="button" class="neumorphic-btn outline-btn" style="padding: 6px; font-size: 11px; margin-top: 5px; width: 100%; border-color: #81A1C1; color: #81A1C1;" onclick="window.printSingleConsent('${docId}')">🖨️ พิมพ์ใบนี้</button>` : '';
                
                const isCheckedIn = pet.status === "checked_in";
                const cText = isCheckedIn ? "ยกเลิกติ๊กถูก" : "✔ ติ๊กรับบริการ";
                const cardClass = isCheckedIn ? "admin-card checked" : "admin-card";
                const bStyle = isCheckedIn ? "background: transparent; color: #ff6b6b; border: 1px solid #ff6b6b;" : "";

                res.insertAdjacentHTML('beforeend', `
                    <div class="${cardClass}" id="card-${docId}">
                        <div style="flex: 1;">
                            <strong style="color: #D4AF37; font-size: 16px;">น้อง${pet.pet_name}</strong> <span style="font-size:13px; color:#A0B0C0;">(คิว #${pet.queue_no || '-'})</span>
                            <br><span style="color:#A0B0C0; font-size: 13px;">(${pet.pet_type} ${pet.pet_gender} - <span style="color:#50E3C2;">${pet.service_type}</span>)</span>
                            <br>${badge}
                            ${printBtn}
                        </div>
                        <div>
                            <button type="button" class="neumorphic-btn gold-btn" style="padding: 10px; font-size: 13px; ${bStyle}" onclick="window.toggleCheckIn('${docId}', ${!isCheckedIn})">${cText}</button>
                        </div>
                    </div>
                `);
            });
            if(!foundBooking) res.innerHTML = "<p style='text-align:center; color:#ff6b6b;'>ไม่มีรายการจองคิวในบ้านนี้</p>";
        } catch (e) { console.error(e); res.innerHTML = "<p>เกิดข้อผิดพลาด</p>"; }
    });
    
    searchInput.addEventListener("keypress", (e) => { if (e.key === "Enter") { e.preventDefault(); searchBtn.click(); } });
}

window.toggleCheckIn = async function(docId, toCheckIn) {
    const pet = window.currentSearchPets[docId];
    if(!pet) return;

    // เตรียม Data สำหรับอัปเดต (ถ้า Check-in ให้ Auto-update ประวัติสมุด)
    let updateData = { status: toCheckIn ? "checked_in" : "booked" };
    
    if (toCheckIn) {
        const currentYear = sysConfig ? (sysConfig.current_vaccine_year || 2569) : 2569;
        // อัปเดตวัคซีนเสมอ
        updateData.vaccine_status = "ฉีดแล้ว";
        updateData.vaccine_year = currentYear;
        updateData.vaccinated_by_admin = userProfileData.displayName || "เจ้าหน้าที่";
        
        // ถ้าเป็นคิวทำหมัน อัปเดตสถานะทำหมันด้วย
        if (pet.service_type === "ทำหมันและวัคซีน") {
            updateData.neuter_status = "ทำหมันแล้ว";
        }
    } else {
        // ถ้ายกเลิก Check-in ให้ลบประวัติกลับเป็นเหมือนเดิม
        updateData.vaccine_status = "ยังไม่เคยฉีด";
        updateData.vaccine_year = 0;
        updateData.vaccinated_by_admin = "";
        if (pet.service_type === "ทำหมันและวัคซีน") updateData.neuter_status = "ยังไม่ทำหมัน";
    }

    try { 
        await updateDoc(doc(db, "pets", docId), updateData); 
        document.getElementById("btn-admin-search").click(); // โหลดผลลัพธ์ใหม่
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

// ==========================================
// 2. ระบบพิมพ์ใบยินยอม (A4)
// ==========================================
window.printSingleConsent = function(docId) {
    const pet = window.currentSearchPets[docId];
    if(!pet || !pet.signature_base64) return alert("ไม่สามารถพิมพ์ได้ เนื่องจากยังไม่มีลายเซ็น");
    
    document.getElementById("p-queue-no").textContent = `คิวที่: ${pet.queue_no || "-"}`;
    document.getElementById("p-owner-name").textContent = pet.owner_name || "-";
    document.getElementById("p-owner-name-sig").textContent = pet.owner_name || "-";
    document.getElementById("p-phone").textContent = pet.phone_number || "-";
    document.getElementById("p-house").textContent = pet.house_no || "-";
    document.getElementById("p-village").textContent = pet.village_no || "-";
    document.getElementById("p-service-type").textContent = pet.service_type || "-";
    document.getElementById("p-pet-name").textContent = pet.pet_name;
    document.getElementById("p-pet-type").textContent = pet.pet_type;
    document.getElementById("p-pet-gender").textContent = pet.pet_gender;
    document.getElementById("p-signature").src = pet.signature_base64;

    // เปลี่ยนข้อความตามประเภทบริการ
    document.getElementById("p-consent-text").innerHTML = pet.service_type === "ทำหมันและวัคซีน" ? neuterConsentText : vaccineConsentText;

    document.body.classList.add('print-consent-mode');
    window.print();
    document.body.classList.remove('print-consent-mode');
}

function setupPrintAllConsents() {
    const btnPrintAll = document.getElementById("btn-print-all-consents");
    if(btnPrintAll) {
        btnPrintAll.addEventListener("click", async () => {
            btnPrintAll.textContent = "กำลังโหลดและจัดเรียงข้อมูล...";
            btnPrintAll.disabled = true;

            try {
                const snap = await getDocs(collection(db, "pets"));
                let validPets = [];
                snap.forEach(d => {
                    const pet = d.data();
                    if((pet.status === "booked" || pet.status === "checked_in") && pet.consent_agreed && pet.signature_base64) {
                        validPets.push(pet);
                    }
                });

                // เรียงลำดับตามเลขคิว
                validPets.sort((a, b) => (a.queue_no || 9999) - (b.queue_no || 9999));

                if(validPets.length === 0) {
                    alert("ยังไม่มีข้อมูลผู้ที่เซ็นใบยินยอมในระบบ");
                    btnPrintAll.textContent = "🖨️ พิมพ์ใบยินยอมแบบชุด (เรียงตามเลขคิว)";
                    btnPrintAll.disabled = false;
                    return;
                }

                const container = document.getElementById("print-all-consents-container");
                container.innerHTML = ""; 

                validPets.forEach((pet) => {
                    const textContent = pet.service_type === "ทำหมันและวัคซีน" ? neuterConsentText : vaccineConsentText;
                    
                    const html = `
                    <div class="consent-page">
                        <div class="queue-badge">คิวที่: ${pet.queue_no || "-"}</div>
                        <h2 style="text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 5px;">ใบยินยอมรับบริการ</h2>
                        <h3 style="text-align: center; font-size: 18px; margin-bottom: 30px; font-weight: normal;">โครงการทำหมันสุนัขและแมว เทศบาลเมืองบางแก้ว</h3>
                        
                        <div style="font-size: 16px; line-height: 2;">
                            <p><strong>ข้าพเจ้า (ชื่อเจ้าของ):</strong> <span>${pet.owner_name || "-"}</span></p>
                            <p><strong>เบอร์โทรศัพท์:</strong> <span>${pet.phone_number || "-"}</span></p>
                            <p><strong>ที่อยู่ปัจจุบัน:</strong> บ้านเลขที่ <span>${pet.house_no || "-"}</span> หมู่ที่ <span>${pet.village_no || "-"}</span> ตำบลบางแก้ว อำเภอบางพลี จังหวัดสมุทรปราการ</p>
                            
                            <p style="margin-top: 15px;"><strong>มีความประสงค์ขอรับบริการ (<span style="text-decoration: underline;">${pet.service_type || "-"}</span>) ให้แก่สัตว์เลี้ยงดังนี้:</strong></p>
                            <p><strong>ชื่อสัตว์เลี้ยง:</strong> <span>${pet.pet_name}</span> &nbsp;&nbsp;&nbsp; <strong>ประเภท:</strong> <span>${pet.pet_type}</span> &nbsp;&nbsp;&nbsp; <strong>เพศ:</strong> <span>${pet.pet_gender}</span></p>

                            <p style="margin-top: 30px; text-indent: 40px; text-align: justify;">${textContent}</p>
                        </div>

                        <div style="margin-top: 50px; text-align: center;">
                            <img src="${pet.signature_base64}" style="max-height: 100px; display: block; margin: 0 auto; border-bottom: 1px dotted #000;">
                            <p style="margin-top: 10px;">(ลงชื่อ) .............................................................. ผู้รับบริการ/ผู้ยินยอม</p>
                            <p style="margin-top: 5px;">(<span>${pet.owner_name || "-"}</span>)</p>
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
                btnPrintAll.textContent = "🖨️ พิมพ์ใบยินยอมแบบชุด (เรียงตามเลขคิว)";
                btnPrintAll.disabled = false;
            }
        });
    }
}

// ==========================================
// 3. รายงานสรุปโครงการ (PDF)
// ==========================================
async function generateReport() {
    try {
        const snap = await getDocs(collection(db, "pets"));
        const stats = {
            r: { n: { d: { m:0, f:0 }, c: { m:0, f:0 } }, v: { d: { m:0, f:0 }, c: { m:0, f:0 } } },
            c: { n: { d: { m:0, f:0 }, c: { m:0, f:0 } }, v: { d: { m:0, f:0 }, c: { m:0, f:0 } } }
        };

        snap.forEach((d) => {
            const p = d.data();
            if (p.status !== "booked" && p.status !== "checked_in") return; // ข้ามตัวที่ไม่ได้จองหรือยกเลิก
            
            const s = p.service_type === "ทำหมันและวัคซีน" ? "n" : "v";
            const t = p.pet_type === "สุนัข" ? "d" : "c";
            const g = p.pet_gender === "ตัวผู้" ? "m" : "f";

            stats.r[s][t][g]++; // นับยอดจอง (Registered)
            if (p.status === "checked_in") stats.c[s][t][g]++; // นับยอดที่มาจริง (Checked-in)
        });

        renderReportTable("table-registered", stats.r);
        renderReportTable("table-checked-in", stats.c);
    } catch (e) { alert("ดึงข้อมูลรายงานไม่สำเร็จ"); }
}

function renderReportTable(tableId, data) {
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
// 4. รายชื่อผู้ลงทะเบียน (ติดตามคิว)
// ==========================================
async function loadUserList() {
    const tbody = document.querySelector("#table-user-list tbody");
    tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; color:#D4AF37;'>กำลังโหลดข้อมูล...</td></tr>";
    
    try {
        const snap = await getDocs(collection(db, "pets"));
        window.allBookingsList = [];

        snap.forEach(d => {
            const p = d.data();
            if(p.status === "booked" || p.status === "checked_in") {
                window.allBookingsList.push(p);
            }
        });

        // เรียงตามเลขคิว
        window.allBookingsList.sort((a,b) => (a.queue_no || 9999) - (b.queue_no || 9999));
        window.renderUserTable();
        
    } catch(e) {
        console.error(e); tbody.innerHTML = "<tr><td colspan='6'>เกิดข้อผิดพลาด</td></tr>";
    }
}

window.renderUserTable = function() {
    const filter = document.getElementById("filter-user-status").value;
    const tbody = document.querySelector("#table-user-list tbody");
    tbody.innerHTML = "";
    
    let count = 0;
    window.allBookingsList.forEach(p => {
        if (filter === "pending" && p.status === "checked_in") return;
        if (filter === "completed" && p.status === "booked") return;
        
        count++;
        let statusIcon = p.status === "checked_in" ? "<span style='color:#50E3C2'>✅ มาแล้ว</span>" : "<span style='color:#ff6b6b'>⏳ รอคิว</span>";
        let serviceColor = p.service_type === "ทำหมันและวัคซีน" ? "#D4AF37" : "#81A1C1";
        
        tbody.insertAdjacentHTML("beforeend", `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="font-weight:bold; color:#50E3C2; font-size: 16px;">${p.queue_no || '-'}</td>
                <td>${p.house_no} ม.${p.village_no}</td>
                <td style="font-weight: bold;">${p.owner_name || '-'}</td>
                <td><a href="tel:${p.phone_number}" style="color:#FFF;">${p.phone_number || '-'}</a></td>
                <td>${p.pet_name} <br><span style="font-size:11px; color:#A0B0C0;">(${p.pet_type})</span></td>
                <td style="font-size:12px; line-height: 1.6;">${statusIcon}<br><span style="color:${serviceColor}">${p.service_type}</span></td>
            </tr>
        `);
    });

    if(count === 0) tbody.innerHTML = "<tr><td colspan='6' style='text-align:center;'>ไม่มีข้อมูลที่ตรงกับเงื่อนไข</td></tr>";
}

// ==========================================
// 5. ตั้งค่าโครงการ (Settings)
// ==========================================
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
                current_vaccine_year: 2569 // เปลี่ยนปีออโต้ตามที่ตั้งค่า
            }, { merge: true });
            
            alert("บันทึกการตั้งค่าแล้ว"); 
            window.switchAdminView('admin-container'); 
        } catch (e) { alert("เกิดข้อผิดพลาด"); } 
        finally { btn.disabled = false; btn.textContent = "💾 บันทึกการตั้งค่า"; }
    });
}
