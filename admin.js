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
let sysConfig = null;
let sysSecrets = null;

// ตัวแปรสำหรับระบบเช็คอิน
let currentStaffRole = null; 
let currentProxyHouse = { hNo: "", vNo: "", hKey: "" };
window.currentSearchPets = {}; 
window.petOriginalState = {}; 

document.addEventListener("DOMContentLoaded", () => {
    setupLoginUI();
    setupNavigation();
    setupCheckinEvents();
    initializeLiff();
});

function setupLoginUI() {
    document.getElementById("link-show-admin").addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("volunteer-login-box").style.display = "none";
        document.getElementById("admin-login-box").style.display = "block";
    });
    document.getElementById("link-show-vol").addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("admin-login-box").style.display = "none";
        document.getElementById("volunteer-login-box").style.display = "block";
    });
}

function setupNavigation() {
    const views = { "nav-checkin": "view-checkin", "nav-settings": "view-settings" };
    Object.keys(views).forEach(navId => {
        const btn = document.getElementById(navId);
        if(btn) {
            btn.addEventListener("click", () => {
                document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                document.querySelectorAll("#dashboard-container > div[id^='view-']").forEach(v => v.style.display = "none");
                document.getElementById(views[navId]).style.display = "block";
            });
        }
    });

    document.getElementById("btn-logout").addEventListener("click", async () => {
        if(confirm("ต้องการออกจากระบบเจ้าหน้าที่ใช่หรือไม่?")) {
            await updateDoc(doc(db, "users", userProfileData.userId), { staff_role: null });
            location.reload();
        }
    });
}

function setupCheckinEvents() {
    const btnSearch = document.getElementById("btn-search-house");
    if(btnSearch) btnSearch.addEventListener("click", searchHouseForCheckin);

    // เปิด/ปิด ฟอร์มลงทะเบียนแทน
    const btnProxyAdd = document.getElementById("btn-proxy-add-pet");
    if(btnProxyAdd) btnProxyAdd.addEventListener("click", () => {
        document.getElementById("proxy-add-form").style.display = "block";
    });
    const btnCancelProxy = document.getElementById("btn-cancel-proxy");
    if(btnCancelProxy) btnCancelProxy.addEventListener("click", () => {
        document.getElementById("proxy-add-form").style.display = "none";
    });

    // เซฟฟอร์มลงทะเบียนแทน
    const btnSaveProxy = document.getElementById("btn-save-proxy");
    if(btnSaveProxy) btnSaveProxy.addEventListener("click", saveProxyPet);
}

async function initializeLiff() {
    try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) liff.login({ redirectUri: window.location.href });
        else {
            userProfileData = await liff.getProfile();
            document.getElementById("user-profile-img").src = userProfileData.pictureUrl;
            document.getElementById("user-profile-img").style.display = "block";
            loadSystemConfig();
        }
    } catch (err) { console.error("LIFF Init Error", err); }
}

async function loadSystemConfig() {
    try {
        const confSnap = await getDoc(doc(db, "system_config", "main_config"));
        const secSnap = await getDoc(doc(db, "system_config", "secrets"));
        
        sysConfig = confSnap.exists() ? confSnap.data() : { moo_count: 16 };
        sysSecrets = secSnap.exists() ? secSnap.data() : { admin_secret: "admin1234", volunteer_secrets: {} };

        populateMooDropdown(sysConfig.moo_count || 16, "login-vol-moo");
        populateMooDropdown(sysConfig.moo_count || 16, "search-village-no"); // ใส่หมู่ให้หน้าค้นหาด้วย

        checkStaffRole();
    } catch (e) { console.error(e); alert("เชื่อมต่อฐานข้อมูลล้มเหลว"); }
}

function populateMooDropdown(count, elementId) {
    const select = document.getElementById(elementId);
    if(!select) return;
    select.innerHTML = '<option value="" disabled selected>เลือกหมู่บ้าน</option>';
    for(let i=1; i<=count; i++) select.innerHTML += `<option value="${i}">หมู่ที่ ${i}</option>`;
}

async function checkStaffRole() {
    try {
        const userSnap = await getDoc(doc(db, "users", userProfileData.userId));
        document.getElementById("loading").style.display = "none";
        
        let uData = userSnap.exists() ? userSnap.data() : null;

        if (uData && uData.staff_role) {
            showDashboard(uData.staff_role, uData.resp_moo, uData.line_displayName);
        } else {
            document.getElementById("login-container").style.display = "block";
            setupLoginLogic();
        }
    } catch (error) { console.error("Error", error); }
}

function setupLoginLogic() {
    document.getElementById("btn-login-vol").addEventListener("click", async () => {
        const moo = document.getElementById("login-vol-moo").value;
        const secret = document.getElementById("login-vol-secret").value;
        if(!moo || !secret) return alert("กรุณาเลือกหมู่และกรอกรหัสลับ");
        
        const correctSecret = sysSecrets.volunteer_secrets[moo] || `vol${moo}`; 
        if(secret === correctSecret) await assignRole("volunteer", moo);
        else alert("รหัสลับอาสาปศุสัตว์ไม่ถูกต้อง!");
    });

    document.getElementById("btn-login-admin").addEventListener("click", async () => {
        const secret = document.getElementById("login-admin-secret").value;
        if(!secret) return alert("กรุณากรอกรหัสลับ");
        
        if(secret === sysSecrets.admin_secret) await assignRole("admin", "ALL");
        else alert("รหัสลับแอดมินไม่ถูกต้อง!");
    });
}

async function assignRole(role, moo) {
    document.getElementById("loading").style.display = "flex";
    document.getElementById("loading").textContent = "กำลังบันทึกสิทธิ์...";
    await setDoc(doc(db, "users", userProfileData.userId), {
        staff_role: role, resp_moo: moo, line_displayName: userProfileData.displayName, picture_url: userProfileData.pictureUrl, updated_at: serverTimestamp()
    }, { merge: true });
    location.reload(); 
}

function showDashboard(role, respMoo, displayName) {
    currentStaffRole = role; // กำหนดสิทธิ์ระดับ Global
    document.getElementById("login-container").style.display = "none";
    document.getElementById("dashboard-container").style.display = "block";
    document.getElementById("display-user-name").textContent = displayName;

    if (role === "admin") {
        document.getElementById("display-role-title").textContent = "👑 ผู้ดูแลระบบ (Admin)";
        document.getElementById("nav-data").style.display = "block";
        document.getElementById("nav-settings").style.display = "block";
        populateSettingsForm();
    } else if (role === "volunteer") {
        document.getElementById("display-role-title").textContent = `🛡️ อาสาปศุสัตว์ (รับผิดชอบหมู่ ${respMoo})`;
        // อาสาฯ เห็นแค่ปุ่มเช็คอิน และไม่มีสิทธิ์กดปุ่มวัคซีน (ระบบจะถูกบล็อกตอนสร้างการ์ด)
    }
}

// ==========================================
// ระบบค้นหาบ้าน เช็คอิน และ ลงทะเบียนแทน
// ==========================================
async function searchHouseForCheckin() {
    const hNo = document.getElementById("search-house-no").value.trim();
    const vNo = document.getElementById("search-village-no").value;
    if(!hNo || !vNo) return alert("กรุณากรอกบ้านเลขที่และเลือกหมู่");

    const btn = document.getElementById("btn-search-house");
    btn.disabled = true; btn.textContent = "กำลังค้นหา...";

    const hKey = `${hNo}-${vNo}`;
    currentProxyHouse = { hNo: hNo, vNo: vNo, hKey: hKey }; // จำเลขบ้านไว้เผื่อกดลงทะเบียนแทน

    document.getElementById("checkin-house-title").textContent = `บ้านเลขที่ ${hNo} หมู่ ${vNo}`;
    const listDiv = document.getElementById("checkin-pet-list");
    listDiv.innerHTML = "<p style='color: #D4AF37; text-align: center;'>กำลังดึงข้อมูล...</p>";
    document.getElementById("checkin-results-container").style.display = "block";
    document.getElementById("proxy-add-form").style.display = "none"; // ซ่อนฟอร์มไว้ก่อน

    try {
        const q = query(collection(db, "pets"), where("house_village_search", "==", hKey));
        const snap = await getDocs(q);
        
        listDiv.innerHTML = "";
        window.currentSearchPets = {};
        let count = 0;

        snap.forEach(d => {
            const pet = d.data();
            if(pet.status === "cancelled" || pet.status === "deceased" || pet.status === "moved") return;
            count++;
            window.currentSearchPets[d.id] = pet;
            renderCheckinPetCard(d.id, pet);
        });

        if(count === 0) {
            listDiv.innerHTML = `<div style="text-align: center; padding: 20px; background: rgba(0,0,0,0.2); border-radius: 8px;"><p style="color: #A0B0C0;">ไม่พบข้อมูลสัตว์เลี้ยงในบ้านนี้</p></div>`;
        }
    } catch(e) { console.error(e); listDiv.innerHTML = "<p style='color: red;'>เกิดข้อผิดพลาด</p>";
    } finally { btn.disabled = false; btn.textContent = "🔍 ค้นหาข้อมูล"; }
}

function renderCheckinPetCard(docId, pet) {
    const listDiv = document.getElementById("checkin-pet-list");
    const currentYear = sysConfig ? (sysConfig.current_vaccine_year || 2569) : 2569;
    const isVaccinatedThisYear = pet.vaccine_status === "ฉีดแล้ว" && parseInt(pet.vaccine_year) === currentYear;
    const canUndo = window.petOriginalState[docId] !== undefined;

    let actionButton = "";
    
    // สำคัญ: แยกระดับสิทธิ์ตรงนี้
    if (currentStaffRole === "admin") {
        if (canUndo) {
            actionButton = `
                <div style="display: flex; gap: 5px;">
                    <button disabled style="flex: 1; background: rgba(80, 227, 194, 0.2); border: 1px solid #50E3C2; color: #50E3C2; padding: 8px; border-radius: 6px; font-size: 13px;">✅ อัปเดตแล้ว</button>
                    <button onclick="undoVaccine('${docId}')" style="background: rgba(255, 107, 107, 0.2); border: 1px solid #ff6b6b; color: #ff6b6b; padding: 8px 12px; border-radius: 6px; font-size: 13px; cursor: pointer;">↺ ยกเลิก</button>
                </div>`;
        } else if (isVaccinatedThisYear) {
            actionButton = `<button disabled style="width: 100%; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #A0B0C0; padding: 8px; border-radius: 6px; font-size: 13px;">วัคซีนปี ${currentYear} เรียบร้อยแล้ว</button>`;
        } else {
            actionButton = `<button onclick="updateVaccine('${docId}')" style="width: 100%; background: rgba(212, 175, 55, 0.2); border: 1px solid #D4AF37; color: #D4AF37; padding: 8px; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: bold;">✔️ บันทึกรับวัคซีนปี ${currentYear}</button>`;
        }
    } else {
        // อาสาปศุสัตว์ จะเห็นแค่ข้อความ ไม่สามารถกดอัปเดตวัคซีนได้
        actionButton = `<div style="text-align:center; background: rgba(255,255,255,0.05); border: 1px dashed rgba(255,255,255,0.2); padding: 8px; border-radius: 6px; font-size: 12px; color: #A0B0C0;">🔒 สิทธิ์อัปเดตวัคซีนเฉพาะแอดมิน</div>`;
    }

    const cardHtml = `
        <div id="checkin-card-${docId}" style="background: rgba(0, 0, 0, 0.15); border-radius: 12px; padding: 15px; margin-bottom: 15px; border-left: 5px solid ${isVaccinatedThisYear ? '#50E3C2' : '#F5A623'};">
            <div style="display: flex; gap: 12px; margin-bottom: 15px;">
                <img src="${pet.pet_photo_base64 || 'https://via.placeholder.com/60'}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 2px solid ${isVaccinatedThisYear ? '#50E3C2' : '#F5A623'};">
                <div style="flex-grow: 1; min-width: 0;">
                    <div style="color: ${isVaccinatedThisYear ? '#50E3C2' : '#D4AF37'}; font-size: 16px; font-weight: bold; margin-bottom: 3px;">${pet.pet_name}</div>
                    <div style="font-size: 13px; color: #E0E5EC;">${pet.pet_type} ${pet.pet_gender} | อายุ ${pet.age_year || 0} ปี</div>
                    <div style="font-size: 12px; color: #A0B0C0; margin-top: 2px;">ล่าสุด: ${pet.vaccine_status} ${pet.vaccine_year ? '(ปี '+pet.vaccine_year+')' : ''}</div>
                </div>
            </div>
            ${actionButton}
        </div>
    `;

    const existingCard = document.getElementById(`checkin-card-${docId}`);
    if (existingCard) existingCard.outerHTML = cardHtml;
    else listDiv.insertAdjacentHTML('beforeend', cardHtml);
}

window.updateVaccine = async function(docId) {
    if(!confirm("ยืนยันการบันทึกข้อมูลการฉีดวัคซีน?")) return;
    const pet = window.currentSearchPets[docId];
    window.petOriginalState[docId] = { vaccine_status: pet.vaccine_status || "", vaccine_year: pet.vaccine_year || 0, vaccine_brand: pet.vaccine_brand || "", vaccine_lot: pet.vaccine_lot || "", vaccine_exp: pet.vaccine_exp || "", vaccinated_by_admin: pet.vaccinated_by_admin || "" };

    const currentYear = sysConfig ? (sysConfig.current_vaccine_year || 2569) : 2569;
    const adminName = document.getElementById("display-user-name").textContent;

    const newData = { vaccine_status: "ฉีดแล้ว", vaccine_year: currentYear, vaccine_brand: sysConfig.vaccine_brand || "วัคซีนเทศบาล", vaccine_lot: sysConfig.vaccine_lot || "-", vaccine_exp: sysConfig.vaccine_exp || "-", vaccinated_by_admin: adminName, updated_at: serverTimestamp() };

    try {
        await updateDoc(doc(db, "pets", docId), newData);
        window.currentSearchPets[docId] = { ...pet, ...newData };
        renderCheckinPetCard(docId, window.currentSearchPets[docId]);
    } catch(e) { console.error(e); alert("บันทึกผิดพลาด"); }
}

window.undoVaccine = async function(docId) {
    const originalData = window.petOriginalState[docId];
    if(!originalData) return;
    try {
        originalData.updated_at = serverTimestamp();
        await updateDoc(doc(db, "pets", docId), originalData);
        window.currentSearchPets[docId] = { ...window.currentSearchPets[docId], ...originalData };
        delete window.petOriginalState[docId];
        renderCheckinPetCard(docId, window.currentSearchPets[docId]);
    } catch(e) { console.error(e); alert("ยกเลิกผิดพลาด"); }
}

// 5. บันทึกการลงทะเบียนแทน
async function saveProxyPet() {
    const pName = document.getElementById("px-name").value;
    const pType = document.getElementById("px-type").value;
    const pGender = document.getElementById("px-gender").value;
    const pAge = document.getElementById("px-age-year").value;
    const pNeuter = document.getElementById("px-neuter-status").value;

    if(!pName) return alert("กรุณากรอกชื่อสัตว์เลี้ยง");

    const btn = document.getElementById("btn-save-proxy");
    btn.disabled = true; btn.textContent = "กำลังบันทึก...";

    try {
        let ownerName = "ลงทะเบียนโดยเจ้าหน้าที่";
        let phone = "-";
        
        // พยายามดึงชื่อเจ้าของบ้านมาผูก
        const houseQuery = query(collection(db, "users"), where("house_village_search", "==", currentProxyHouse.hKey), where("is_head", "==", true));
        const houseSnap = await getDocs(houseQuery);
        if(!houseSnap.empty) {
            const u = houseSnap.docs[0].data();
            ownerName = u.owner_name;
            phone = u.phone_number;
        }

        const staffName = document.getElementById("display-user-name").textContent;

        await addDoc(collection(db, "pets"), {
            owner_name: ownerName, phone_number: phone, house_no: currentProxyHouse.hNo, village_no: currentProxyHouse.vNo, house_village_search: currentProxyHouse.hKey,
            pet_name: pName, pet_type: pType, pet_gender: pGender, breed: "ไม่ระบุ", color: "ไม่ระบุ", age_year: parseInt(pAge), age_month: 0, rearing_style: "ไม่ระบุ",
            vaccine_status: "ยังไม่เคยฉีด", vaccine_year: 0, neuter_status: pNeuter, status: "registered", registered_by_staff: staffName, registered_timestamp: serverTimestamp(), updated_at: serverTimestamp()
        });

        alert("ลงทะเบียนสัตว์เลี้ยงสำเร็จ!");
        document.getElementById("px-name").value = "";
        document.getElementById("px-age-year").value = "0";
        document.getElementById("proxy-add-form").style.display = "none";
        
        searchHouseForCheckin(); // โหลดรายการบ้านนี้ใหม่เพื่อโชว์สัตว์ที่เพิ่งเพิ่ม

    } catch (e) { console.error(e); alert("เกิดข้อผิดพลาด"); } 
    finally { btn.disabled = false; btn.textContent = "💾 บันทึก"; }
}

// ==========================================
// ส่วนจัดการการตั้งค่าระบบ (แอดมินเท่านั้น)
// ==========================================
function populateSettingsForm() {
    if(!sysConfig) return;
    document.getElementById("cfg-agency-name").value = sysConfig.agency_name || "";
    document.getElementById("cfg-tambon").value = sysConfig.tambon || "";
    document.getElementById("cfg-amphoe").value = sysConfig.amphoe || "";
    document.getElementById("cfg-province").value = sysConfig.province || "";
    document.getElementById("cfg-phone").value = sysConfig.phone || "";
    const mooCountInput = document.getElementById("cfg-moo-count");
    mooCountInput.value = sysConfig.moo_count || 16;
    document.getElementById("cfg-vac-year").value = sysConfig.current_vaccine_year || 2569;
    document.getElementById("cfg-vac-brand").value = sysConfig.vaccine_brand || "";
    document.getElementById("cfg-vac-lot").value = sysConfig.vaccine_lot || "";
    document.getElementById("cfg-vac-exp").value = sysConfig.vaccine_exp || "";
    document.getElementById("cfg-rep-name").value = sysConfig.rep_name || "";
    document.getElementById("cfg-rep-pos").value = sysConfig.rep_pos || "";
    document.getElementById("cfg-rev-name").value = sysConfig.rev_name || "";
    document.getElementById("cfg-rev-pos").value = sysConfig.rev_pos || "";
    document.getElementById("cfg-app-name").value = sysConfig.app_name || "";
    document.getElementById("cfg-app-pos").value = sysConfig.app_pos || "";
    document.getElementById("cfg-sec-admin").value = sysSecrets.admin_secret || "";
    generateVolunteerSecretInputs(mooCountInput.value);
    mooCountInput.addEventListener("change", (e) => generateVolunteerSecretInputs(e.target.value));
    document.getElementById("btn-save-settings").addEventListener("click", saveSettings);
}

function generateVolunteerSecretInputs(count) {
    const container = document.getElementById("volunteer-secrets-container");
    container.innerHTML = "";
    const vols = sysSecrets.volunteer_secrets || {};
    for(let i=1; i<=count; i++) {
        const defaultSec = vols[i] || `vol${i}`; 
        container.innerHTML += `<div style="background: rgba(0,0,0,0.1); padding: 5px 10px; border-radius: 6px;"><label style="font-size: 11px; margin-bottom: 2px; display:block;">รหัสหมู่ ${i}</label><input type="text" id="cfg-sec-vol-${i}" class="neumorphic-input" value="${defaultSec}" style="padding: 5px; font-size: 13px;"></div>`;
    }
}

async function saveSettings() {
    const btn = document.getElementById("btn-save-settings");
    btn.disabled = true; btn.textContent = "กำลังบันทึก...";
    try {
        const mooCount = parseInt(document.getElementById("cfg-moo-count").value);
        await setDoc(doc(db, "system_config", "main_config"), {
            agency_name: document.getElementById("cfg-agency-name").value, tambon: document.getElementById("cfg-tambon").value, amphoe: document.getElementById("cfg-amphoe").value, province: document.getElementById("cfg-province").value, phone: document.getElementById("cfg-phone").value, moo_count: mooCount, current_vaccine_year: parseInt(document.getElementById("cfg-vac-year").value), vaccine_brand: document.getElementById("cfg-vac-brand").value, vaccine_lot: document.getElementById("cfg-vac-lot").value, vaccine_exp: document.getElementById("cfg-vac-exp").value, rep_name: document.getElementById("cfg-rep-name").value, rep_pos: document.getElementById("cfg-rep-pos").value, rev_name: document.getElementById("cfg-rev-name").value, rev_pos: document.getElementById("cfg-rev-pos").value, app_name: document.getElementById("cfg-app-name").value, app_pos: document.getElementById("cfg-app-pos").value, updated_at: serverTimestamp()
        }, { merge: true });

        const volSecrets = {};
        for(let i=1; i<=mooCount; i++) {
            const input = document.getElementById(`cfg-sec-vol-${i}`);
            if(input) volSecrets[i] = input.value;
        }
        await setDoc(doc(db, "system_config", "secrets"), { admin_secret: document.getElementById("cfg-sec-admin").value, volunteer_secrets: volSecrets, updated_at: serverTimestamp() }, { merge: true });
        alert("บันทึกการตั้งค่าระบบเรียบร้อยแล้ว!");
        location.reload(); 
    } catch (e) { console.error(e); alert("เกิดข้อผิดพลาดในการบันทึก"); } 
    finally { btn.disabled = false; btn.textContent = "💾 บันทึกการตั้งค่าทั้งหมด"; }
}
