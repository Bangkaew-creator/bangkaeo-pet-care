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

let currentStaffRole = null; 
let currentStaffMoo = null; // ตัวแปรเก็บว่าอาสาคนนี้อยู่หมู่ไหน
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
    document.getElementById("link-show-admin").addEventListener("click", (e) => { e.preventDefault(); document.getElementById("volunteer-login-box").style.display = "none"; document.getElementById("admin-login-box").style.display = "block"; });
    document.getElementById("link-show-vol").addEventListener("click", (e) => { e.preventDefault(); document.getElementById("admin-login-box").style.display = "none"; document.getElementById("volunteer-login-box").style.display = "block"; });
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
    document.getElementById("btn-logout").addEventListener("click", async () => { if(confirm("ต้องการออกจากระบบเจ้าหน้าที่ใช่หรือไม่?")) { await updateDoc(doc(db, "users", userProfileData.userId), { staff_role: null }); location.reload(); } });
}

function setupCheckinEvents() {
    const btnSearch = document.getElementById("btn-search-house");
    if(btnSearch) btnSearch.addEventListener("click", searchHouseForCheckin);

    const searchInput = document.getElementById("search-house-no");
    if(searchInput) {
        searchInput.addEventListener("keypress", function(event) {
            if (event.key === "Enter") {
                event.preventDefault();
                searchHouseForCheckin();
            }
        });
    }

    const btnProxyAdd = document.getElementById("btn-proxy-add-pet");
    if(btnProxyAdd) btnProxyAdd.addEventListener("click", () => { document.getElementById("proxy-add-form").style.display = "block"; });
    const btnCancelProxy = document.getElementById("btn-cancel-proxy");
    if(btnCancelProxy) btnCancelProxy.addEventListener("click", () => { document.getElementById("proxy-add-form").style.display = "none"; });
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
        populateMooDropdown(sysConfig.moo_count || 16, "search-village-no");
        checkStaffRole();
    } catch (e) { console.error(e); alert("เชื่อมต่อฐานข้อมูลล้มเหลว"); }
}

function populateMooDropdown(count, elementId) {
    const select = document.getElementById(elementId);
    if(!select) return;
    select.innerHTML = '<option value="" selected>เลือกหมู่</option>';
    for(let i=1; i<=count; i++) select.innerHTML += `<option value="${i}">หมู่ที่ ${i}</option>`;
}

async function checkStaffRole() {
    try {
        const userSnap = await getDoc(doc(db, "users", userProfileData.userId));
        document.getElementById("loading").style.display = "none";
        let uData = userSnap.exists() ? userSnap.data() : null;
        if (uData && uData.staff_role) showDashboard(uData.staff_role, uData.resp_moo, uData.line_displayName);
        else { document.getElementById("login-container").style.display = "block"; setupLoginLogic(); }
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
    await setDoc(doc(db, "users", userProfileData.userId), { staff_role: role, resp_moo: moo, line_displayName: userProfileData.displayName, picture_url: userProfileData.pictureUrl, updated_at: serverTimestamp() }, { merge: true });
    location.reload(); 
}

function showDashboard(role, respMoo, displayName) {
    currentStaffRole = role; 
    currentStaffMoo = respMoo; 
    document.getElementById("login-container").style.display = "none";
    document.getElementById("dashboard-container").style.display = "block";
    document.getElementById("display-user-name").textContent = displayName;

    const searchMooDropdown = document.getElementById("search-village-no");

    if (role === "admin") {
        document.getElementById("display-role-title").textContent = "👑 ผู้ดูแลระบบ (Admin)";
        document.getElementById("nav-data").style.display = "block";
        document.getElementById("nav-settings").style.display = "block";
        if(searchMooDropdown) searchMooDropdown.disabled = false; // แอดมินเลือกได้ทุกหมู่
        populateSettingsForm();
    } else if (role === "volunteer") {
        document.getElementById("display-role-title").textContent = `🛡️ อาสาปศุสัตว์ (รับผิดชอบหมู่ ${respMoo})`;
        // บังคับล็อค Dropdown ค้นหาให้เป็นหมู่ของตัวเองเท่านั้น
        if(searchMooDropdown) {
            searchMooDropdown.value = respMoo;
            searchMooDropdown.disabled = true;
        }
    }
}

// ==========================================
// ระบบค้นหาบ้าน เช็คอิน และ ลงทะเบียนแทน (ป้องกันค้นหาข้ามหมู่)
// ==========================================
async function searchHouseForCheckin() {
    let rawInput = document.getElementById("search-house-no").value.trim();
    let vNo = document.getElementById("search-village-no").value;
    let hNo = rawInput;

    if(!rawInput) return alert("กรุณากรอกข้อมูลค้นหา");

    // Smart Search Logic (แยก บ้านเลขที่-หมู่)
    if(rawInput.includes("-")) {
        const parts = rawInput.split("-");
        hNo = parts[0].trim();
        vNo = parts[1].trim();
        if(currentStaffRole === "admin") {
            document.getElementById("search-village-no").value = vNo;
        }
    } else if (currentStaffRole === "volunteer" && !vNo) {
        vNo = currentStaffMoo; // ดึงค่าที่ล็อคไว้มาใช้
    }

    // ระบบป้องกัน: บล็อคอาสาฯ ค้นหาหรือพิมพ์ข้ามหมู่
    if (currentStaffRole === "volunteer" && vNo !== currentStaffMoo) {
        document.getElementById("search-village-no").value = currentStaffMoo;
        document.getElementById("search-house-no").value = hNo; // ลบ -หมู่ ที่พิมพ์ผิดออก
        return alert(`⚠️ สิทธิ์การเข้าถึงจำกัด:\nท่านสามารถจัดการข้อมูลได้เฉพาะ "หมู่ที่ ${currentStaffMoo}" ที่ท่านรับผิดชอบเท่านั้นครับ`);
    }

    if(!hNo || !vNo) return alert("รูปแบบไม่ถูกต้อง (เช่น 99/9 หรือ 99/9-8) หรือลืมเลือกหมู่");

    const btn = document.getElementById("btn-search-house");
    btn.disabled = true; btn.textContent = "กำลังค้นหา...";

    const hKey = `${hNo}-${vNo}`;
    currentProxyHouse = { hNo: hNo, vNo: vNo, hKey: hKey };

    document.getElementById("checkin-house-title").textContent = `บ้านเลขที่ ${hNo} หมู่ ${vNo}`;
    const listDiv = document.getElementById("checkin-pet-list");
    listDiv.innerHTML = "<p style='color: #D4AF37; text-align: center;'>กำลังดึงข้อมูล...</p>";
    document.getElementById("checkin-results-container").style.display = "block";
    document.getElementById("proxy-add-form").style.display = "none";

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

        if(count === 0) listDiv.innerHTML = `<div style="text-align: center; padding: 20px; background: rgba(0,0,0,0.2); border-radius: 8px;"><p style="color: #A0B0C0;">ไม่พบข้อมูลสัตว์เลี้ยงในบ้านนี้</p></div>`;
    } catch(e) { console.error(e); listDiv.innerHTML = "<p style='color: red;'>เกิดข้อผิดพลาด</p>";
    } finally { btn.disabled = false; btn.textContent = "🔍 ค้นหาข้อมูล"; }
}

function renderCheckinPetCard(docId, pet) {
    const listDiv = document.getElementById("checkin-pet-list");
    const currentYear = sysConfig ? (sysConfig.current_vaccine_year || 2569) : 2569;
    const isVaccinatedThisYear = pet.vaccine_status === "ฉีดแล้ว" && parseInt(pet.vaccine_year) === currentYear;
    const canUndo = window.petOriginalState[docId] !== undefined;

    let actionButton = "";
    if (currentStaffRole === "admin") {
        if (canUndo) actionButton = `<div style="display: flex; gap: 5px;"><button disabled style="flex: 1; background: rgba(80, 227, 194, 0.2); border: 1px solid #50E3C2; color: #50E3C2; padding: 8px; border-radius: 6px; font-size: 13px;">✅ อัปเดตแล้ว</button><button onclick="undoVaccine('${docId}')" style="background: rgba(255, 107, 107, 0.2); border: 1px solid #ff6b6b; color: #ff6b6b; padding: 8px 12px; border-radius: 6px; font-size: 13px; cursor: pointer;">↺ ยกเลิก</button></div>`;
        else if (isVaccinatedThisYear) actionButton = `<button disabled style="width: 100%; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #A0B0C0; padding: 8px; border-radius: 6px; font-size: 13px;">วัคซีนปี ${currentYear} เรียบร้อยแล้ว</button>`;
        else actionButton = `<button onclick="updateVaccine('${docId}')" style="width: 100%; background: rgba(212, 175, 55, 0.2); border: 1px solid #D4AF37; color: #D4AF37; padding: 8px; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: bold;">✔️ บันทึกรับวัคซีนปี ${currentYear}</button>`;
    } else {
        actionButton = `<div style="text-align:center; background: rgba(255,255,255,0.05); border: 1px dashed rgba(255,255,255,0.2); padding: 8px; border-radius: 6px; font-size: 12px; color: #A0B0C0;">🔒 สิทธิ์อัปเดตวัคซีนเฉพาะแอดมิน</div>`;
    }

    const cardHtml = `<div id="checkin-card-${docId}" style="background: rgba(0, 0, 0, 0.15); border-radius: 12px; padding: 15px; margin-bottom: 15px; border-left: 5px solid ${isVaccinatedThisYear ? '#50E3C2' : '#F5A623'};"><div style="display: flex; gap: 12px; margin-bottom: 15px;"><img src="${pet.pet_photo_base64 || 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 512 512\' fill=\'%23A0B0C0\'%3E%3Cpath d=\'M226.5 92.9c14.3 73-39.9 130-77.2 130-36.5 0-71.4-56.1-57.1-129.1C106.6 20.3 145.4-.1 184.8 0c36.7.1 27.2 19.8 41.7 92.9zm151.7-8.1c-14.3-73-53.1-93.5-89.8-93.5-39.4-.1-78.2 20.3-63.9 93.8 14.3 73 49.2 129.1 85.7 129.1 37.2.1 82.2-56.3 68-129.4zM448 176c-38.6 0-77.8 45.4-93.4 104.9-15.6 59.5-2.5 97.4 36.1 97.4 39.5 0 79-46.7 94.6-106.2C500.9 212.6 486.6 176 448 176zM157.4 280.9c-15.6-59.5-54.8-104.9-93.4-104.9-38.6 0-52.9 36.6-37.3 96.1 15.6 59.5 55.1 106.2 94.6 106.2 38.6.1 51.7-37.9 36.1-97.4zm168.1 48.7c-29.3-10.6-66.9-42.5-139.1-42.5-73.4 0-111 32.3-139.1 42.5-55.5 20.1-133.5 129-87.6 200.7C107.5 515.6 171.3 472 256 472c83.5 0 148.8 43.8 196.4 41.6 46.9-2.1 11.2-126-126.9-184z\'/%3E%3C/svg%3E'}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 2px solid ${isVaccinatedThisYear ? '#50E3C2' : '#F5A623'}; background: #1b2941;"><div style="flex-grow: 1; min-width: 0;"><div style="color: ${isVaccinatedThisYear ? '#50E3C2' : '#D4AF37'}; font-size: 16px; font-weight: bold; margin-bottom: 3px;">${pet.pet_name}</div><div style="font-size: 13px; color: #E0E5EC;">${pet.pet_type} ${pet.pet_gender} | อายุ ${pet.age_year || 0} ปี</div><div style="font-size: 12px; color: #A0B0C0; margin-top: 2px;">ล่าสุด: ${pet.vaccine_status} ${pet.vaccine_year ? '(ปี '+pet.vaccine_year+')' : ''}</div></div></div>${actionButton}</div>`;
    
    const existingCard = document.getElementById(`checkin-card-${docId}`);
    if (existingCard) existingCard.outerHTML = cardHtml; else listDiv.insertAdjacentHTML('beforeend', cardHtml);
}

window.updateVaccine = async function(docId) {
    if(!confirm("ยืนยันการบันทึกข้อมูลการฉีดวัคซีน?")) return;
    const pet = window.currentSearchPets[docId];
    window.petOriginalState[docId] = { vaccine_status: pet.vaccine_status || "", vaccine_year: pet.vaccine_year || 0, vaccine_brand: pet.vaccine_brand || "", vaccine_lot: pet.vaccine_lot || "", vaccine_exp: pet.vaccine_exp || "", vaccinated_by_admin: pet.vaccinated_by_admin || "" };
    const currentYear = sysConfig ? (sysConfig.current_vaccine_year || 2569) : 2569;
    const adminName = document.getElementById("display-user-name").textContent;
    const newData = { vaccine_status: "ฉีดแล้ว", vaccine_year: currentYear, vaccine_brand: sysConfig.vaccine_brand || "วัคซีนเทศบาล", vaccine_lot: sysConfig.vaccine_lot || "-", vaccine_exp: sysConfig.vaccine_exp || "-", vaccinated_by_admin: adminName, updated_at: serverTimestamp() };
    try { await updateDoc(doc(db, "pets", docId), newData); window.currentSearchPets[docId] = { ...pet, ...newData }; renderCheckinPetCard(docId, window.currentSearchPets[docId]); } catch(e) { console.error(e); alert("บันทึกผิดพลาด"); }
}

window.undoVaccine = async function(docId) {
    const originalData = window.petOriginalState[docId];
    if(!originalData) return;
    try { originalData.updated_at = serverTimestamp(); await updateDoc(doc(db, "pets", docId), originalData); window.currentSearchPets[docId] = { ...window.currentSearchPets[docId], ...originalData }; delete window.petOriginalState[docId]; renderCheckinPetCard(docId, window.currentSearchPets[docId]); } catch(e) { console.error(e); alert("ยกเลิกผิดพลาด"); }
}

async function saveProxyPet() {
    const pName = document.getElementById("px-name").value.trim();
    const pType = document.getElementById("px-type").value;
    const pGender = document.getElementById("px-gender").value;
    const pBreed = document.getElementById("px-breed").value.trim();
    const pColor = document.getElementById("px-color").value.trim();
    const pAgeYear = document.getElementById("px-age-year").value;
    const pAgeMonth = document.getElementById("px-age-month").value;
    const pRearing = document.getElementById("px-rearing").value;
    const pVacStatus = document.getElementById("px-vac-status").value;
    const pNeuter = document.getElementById("px-neuter-status").value;

    if(!pName) return alert("กรุณากรอกชื่อสัตว์เลี้ยง");

    const btn = document.getElementById("btn-save-proxy");
    btn.disabled = true; btn.textContent = "กำลังบันทึก...";

    try {
        let ownerName = "ลงทะเบียนโดยเจ้าหน้าที่"; let phone = "-";
        const houseQuery = query(collection(db, "users"), where("house_village_search", "==", currentProxyHouse.hKey), where("is_head", "==", true));
        const houseSnap = await getDocs(houseQuery);
        if(!houseSnap.empty) { const u = houseSnap.docs[0].data(); ownerName = u.owner_name; phone = u.phone_number; }

        const staffName = document.getElementById("display-user-name").textContent;

        await addDoc(collection(db, "pets"), {
            owner_name: ownerName, phone_number: phone, house_no: currentProxyHouse.hNo, village_no: currentProxyHouse.vNo, house_village_search: currentProxyHouse.hKey,
            pet_name: pName, pet_type: pType, pet_gender: pGender, breed: pBreed || "ไม่ระบุ", color: pColor || "ไม่ระบุ", age_year: parseInt(pAgeYear) || 0, age_month: parseInt(pAgeMonth) || 0, rearing_style: pRearing,
            vaccine_status: pVacStatus, vaccine_year: pVacStatus === "ฉีดแล้ว" ? (sysConfig ? sysConfig.current_vaccine_year : 2569) : 0, neuter_status: pNeuter, status: "registered", registered_by_staff: staffName, registered_timestamp: serverTimestamp(), updated_at: serverTimestamp()
        });

        alert("ลงทะเบียนสัตว์เลี้ยงสำเร็จ!");
        
        document.querySelectorAll("#proxy-add-form input[type='text'], #proxy-add-form input[type='number']").forEach(i => i.value = "");
        document.getElementById("px-age-year").value = "0"; document.getElementById("px-age-month").value = "0";
        document.getElementById("proxy-add-form").style.display = "none";
        
        searchHouseForCheckin(); 
    } catch (e) { console.error(e); alert("เกิดข้อผิดพลาดในการบันทึก"); } finally { btn.disabled = false; btn.textContent = "💾 บันทึก"; }
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
    
    document.getElementById("cfg-nt-start-reg").value = sysConfig.nt_start_reg || "";
    document.getElementById("cfg-nt-end-reg").value = sysConfig.nt_end_reg || "";
    document.getElementById("cfg-nt-date").value = sysConfig.nt_date || "";
    document.getElementById("cfg-nt-location").value = sysConfig.nt_location || "";

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
            agency_name: document.getElementById("cfg-agency-name").value, tambon: document.getElementById("cfg-tambon").value, amphoe: document.getElementById("cfg-amphoe").value, province: document.getElementById("cfg-province").value, phone: document.getElementById("cfg-phone").value, moo_count: mooCount, 
            current_vaccine_year: parseInt(document.getElementById("cfg-vac-year").value), vaccine_brand: document.getElementById("cfg-vac-brand").value, vaccine_lot: document.getElementById("cfg-vac-lot").value, vaccine_exp: document.getElementById("cfg-vac-exp").value, 
            nt_start_reg: document.getElementById("cfg-nt-start-reg").value, nt_end_reg: document.getElementById("cfg-nt-end-reg").value, nt_date: document.getElementById("cfg-nt-date").value, nt_location: document.getElementById("cfg-nt-location").value,
            rep_name: document.getElementById("cfg-rep-name").value, rep_pos: document.getElementById("cfg-rep-pos").value, rev_name: document.getElementById("cfg-rev-name").value, rev_pos: document.getElementById("cfg-rev-pos").value, app_name: document.getElementById("cfg-app-name").value, app_pos: document.getElementById("cfg-app-pos").value, updated_at: serverTimestamp()
        }, { merge: true });

        const volSecrets = {};
        for(let i=1; i<=mooCount; i++) { const input = document.getElementById(`cfg-sec-vol-${i}`); if(input) volSecrets[i] = input.value; }
        await setDoc(doc(db, "system_config", "secrets"), { admin_secret: document.getElementById("cfg-sec-admin").value, volunteer_secrets: volSecrets, updated_at: serverTimestamp() }, { merge: true });
        
        alert("บันทึกการตั้งค่าระบบเรียบร้อยแล้ว!");
        location.reload(); 
    } catch (e) { console.error(e); alert("เกิดข้อผิดพลาดในการบันทึก"); } 
    finally { btn.disabled = false; btn.textContent = "💾 บันทึกการตั้งค่าทั้งหมด"; }
}
