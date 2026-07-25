import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
const LIFF_ID = "2010813512-UqwFMq5V"; // ใช้ LIFF ตัวเดิม เพื่อเชื่อมโยงบัญชีไลน์เดียวกัน

let userProfileData = null;
let sysConfig = null;
let sysSecrets = null;

document.addEventListener("DOMContentLoaded", () => {
    setupLoginUI();
    setupNavigation();
    initializeLiff();
});

// สลับหน้าจอ Login
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

// นำทางเมนู
function setupNavigation() {
    const views = {
        "nav-checkin": "view-checkin",
        "nav-settings": "view-settings"
    };
    
    Object.keys(views).forEach(navId => {
        const btn = document.getElementById(navId);
        if(btn) {
            btn.addEventListener("click", () => {
                // เคลียร์ปุ่ม
                document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                // เคลียร์วิว
                document.querySelectorAll("#dashboard-container > div[id^='view-']").forEach(v => v.style.display = "none");
                document.getElementById(views[navId]).style.display = "block";
            });
        }
    });

    document.getElementById("btn-logout").addEventListener("click", async () => {
        if(confirm("ต้องการออกจากระบบเจ้าหน้าที่ใช่หรือไม่?")) {
            // ล้างสิทธิ์การเป็นเจ้าหน้าที่ออกจาก UID นี้
            await updateDoc(doc(db, "users", userProfileData.userId), { staff_role: null });
            location.reload();
        }
    });
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
        // ดึงการตั้งค่าทั้งหมดมาเก็บไว้ในตัวแปร
        const confSnap = await getDoc(doc(db, "system_config", "main_config"));
        const secSnap = await getDoc(doc(db, "system_config", "secrets"));
        
        sysConfig = confSnap.exists() ? confSnap.data() : { moo_count: 16 };
        sysSecrets = secSnap.exists() ? secSnap.data() : { admin_secret: "admin1234", volunteer_secrets: {} };

        // สร้างตัวเลือกหมู่ให้หน้า Login อาสาฯ
        populateMooDropdown(sysConfig.moo_count || 16);

        checkStaffRole();
    } catch (e) {
        console.error(e); alert("เชื่อมต่อฐานข้อมูลล้มเหลว");
    }
}

function populateMooDropdown(count) {
    const select = document.getElementById("login-vol-moo");
    select.innerHTML = '<option value="" disabled selected>เลือกหมู่บ้าน</option>';
    for(let i=1; i<=count; i++) {
        select.innerHTML += `<option value="${i}">หมู่ที่ ${i}</option>`;
    }
}

async function checkStaffRole() {
    try {
        const userSnap = await getDoc(doc(db, "users", userProfileData.userId));
        document.getElementById("loading").style.display = "none";
        
        let uData = userSnap.exists() ? userSnap.data() : null;

        if (uData && uData.staff_role) {
            // เคยล็อกอินแล้ว ให้เข้าสู่แดชบอร์ดเลย
            showDashboard(uData.staff_role, uData.resp_moo, uData.line_displayName);
        } else {
            // ยังไม่มีสิทธิ์ โชว์หน้าล็อกอิน
            document.getElementById("login-container").style.display = "block";
            setupLoginLogic();
        }
    } catch (error) { console.error("Error", error); }
}

function setupLoginLogic() {
    // ล็อกอิน อาสาปศุสัตว์
    document.getElementById("btn-login-vol").addEventListener("click", async () => {
        const moo = document.getElementById("login-vol-moo").value;
        const secret = document.getElementById("login-vol-secret").value;
        
        if(!moo || !secret) return alert("กรุณาเลือกหมู่และกรอกรหัสลับ");
        
        // เช็ครหัสลับรายหมู่
        const correctSecret = sysSecrets.volunteer_secrets[moo] || `vol${moo}`; // ถ้าแอดมินยังไม่ตั้ง ให้ใช้ vol+เลขหมู่
        
        if(secret === correctSecret) {
            await assignRole("volunteer", moo);
        } else {
            alert("รหัสลับอาสาปศุสัตว์ไม่ถูกต้อง!");
        }
    });

    // ล็อกอิน แอดมิน
    document.getElementById("btn-login-admin").addEventListener("click", async () => {
        const secret = document.getElementById("login-admin-secret").value;
        if(!secret) return alert("กรุณากรอกรหัสลับ");
        
        if(secret === sysSecrets.admin_secret) {
            await assignRole("admin", "ALL");
        } else {
            alert("รหัสลับแอดมินไม่ถูกต้อง!");
        }
    });
}

async function assignRole(role, moo) {
    document.getElementById("loading").style.display = "flex";
    document.getElementById("loading").textContent = "กำลังบันทึกสิทธิ์...";
    
    // บันทึกสิทธิ์ลงไปในโปรไฟล์ User เพื่อให้ครั้งหน้าเข้ามาได้เลย
    await setDoc(doc(db, "users", userProfileData.userId), {
        staff_role: role,
        resp_moo: moo,
        line_displayName: userProfileData.displayName,
        picture_url: userProfileData.pictureUrl,
        updated_at: serverTimestamp()
    }, { merge: true });
    
    location.reload(); // รีเฟรชเพื่อโหลดเข้าแดชบอร์ด
}

function showDashboard(role, respMoo, displayName) {
    document.getElementById("login-container").style.display = "none";
    document.getElementById("dashboard-container").style.display = "block";
    document.getElementById("display-user-name").textContent = displayName;

    if (role === "admin") {
        document.getElementById("display-role-title").textContent = "👑 ผู้ดูแลระบบ (Admin)";
        // แอดมินเห็นทุกเมนู
        document.getElementById("nav-data").style.display = "block";
        document.getElementById("nav-settings").style.display = "block";
        
        // โหลดข้อมูลใส่ฟอร์มตั้งค่า
        populateSettingsForm();
    } else if (role === "volunteer") {
        document.getElementById("display-role-title").textContent = `🛡️ อาสาปศุสัตว์ (รับผิดชอบหมู่ ${respMoo})`;
        // อาสาฯ เห็นแค่ปุ่มเช็คอิน (ซึ่งเป็นปุ่มแรกอยู่แล้ว)
    }
}

// ==========================================
// ส่วนจัดการการตั้งค่าระบบ (แอดมินเท่านั้น)
// ==========================================
function populateSettingsForm() {
    if(!sysConfig) return;
    
    // 1. ข้อมูลหน่วยงาน
    document.getElementById("cfg-agency-name").value = sysConfig.agency_name || "";
    document.getElementById("cfg-tambon").value = sysConfig.tambon || "";
    document.getElementById("cfg-amphoe").value = sysConfig.amphoe || "";
    document.getElementById("cfg-province").value = sysConfig.province || "";
    document.getElementById("cfg-phone").value = sysConfig.phone || "";
    
    // 2. โครงสร้าง
    const mooCountInput = document.getElementById("cfg-moo-count");
    mooCountInput.value = sysConfig.moo_count || 16;
    
    // 3. วัคซีน
    document.getElementById("cfg-vac-year").value = sysConfig.current_vaccine_year || 2569;
    document.getElementById("cfg-vac-brand").value = sysConfig.vaccine_brand || "";
    document.getElementById("cfg-vac-lot").value = sysConfig.vaccine_lot || "";
    document.getElementById("cfg-vac-exp").value = sysConfig.vaccine_exp || "";

    // 4. ผู้ลงนาม
    document.getElementById("cfg-rep-name").value = sysConfig.rep_name || "";
    document.getElementById("cfg-rep-pos").value = sysConfig.rep_pos || "";
    document.getElementById("cfg-rev-name").value = sysConfig.rev_name || "";
    document.getElementById("cfg-rev-pos").value = sysConfig.rev_pos || "";
    document.getElementById("cfg-app-name").value = sysConfig.app_name || "";
    document.getElementById("cfg-app-pos").value = sysConfig.app_pos || "";

    // 5. รหัสผ่าน
    document.getElementById("cfg-sec-admin").value = sysSecrets.admin_secret || "";
    generateVolunteerSecretInputs(mooCountInput.value);

    // เมื่อเปลี่ยนจำนวนหมู่ ให้สร้างช่องใส่รหัสใหม่
    mooCountInput.addEventListener("change", (e) => {
        generateVolunteerSecretInputs(e.target.value);
    });

    // ปุ่มบันทึก
    document.getElementById("btn-save-settings").addEventListener("click", saveSettings);
}

function generateVolunteerSecretInputs(count) {
    const container = document.getElementById("volunteer-secrets-container");
    container.innerHTML = "";
    const vols = sysSecrets.volunteer_secrets || {};

    for(let i=1; i<=count; i++) {
        // ถ้ารหัสไม่มี ให้ใช้ค่าตั้งต้นเป็น vol + เลขหมู่
        const defaultSec = vols[i] || `vol${i}`; 
        container.innerHTML += `
            <div style="background: rgba(0,0,0,0.1); padding: 5px 10px; border-radius: 6px;">
                <label style="font-size: 11px; margin-bottom: 2px; display:block;">รหัสหมู่ ${i}</label>
                <input type="text" id="cfg-sec-vol-${i}" class="neumorphic-input" value="${defaultSec}" style="padding: 5px; font-size: 13px;">
            </div>
        `;
    }
}

async function saveSettings() {
    const btn = document.getElementById("btn-save-settings");
    btn.disabled = true; btn.textContent = "กำลังบันทึก...";

    try {
        const mooCount = parseInt(document.getElementById("cfg-moo-count").value);
        
        // บันทึก config หลัก
        await setDoc(doc(db, "system_config", "main_config"), {
            agency_name: document.getElementById("cfg-agency-name").value,
            tambon: document.getElementById("cfg-tambon").value,
            amphoe: document.getElementById("cfg-amphoe").value,
            province: document.getElementById("cfg-province").value,
            phone: document.getElementById("cfg-phone").value,
            moo_count: mooCount,
            current_vaccine_year: parseInt(document.getElementById("cfg-vac-year").value),
            vaccine_brand: document.getElementById("cfg-vac-brand").value,
            vaccine_lot: document.getElementById("cfg-vac-lot").value,
            vaccine_exp: document.getElementById("cfg-vac-exp").value,
            rep_name: document.getElementById("cfg-rep-name").value,
            rep_pos: document.getElementById("cfg-rep-pos").value,
            rev_name: document.getElementById("cfg-rev-name").value,
            rev_pos: document.getElementById("cfg-rev-pos").value,
            app_name: document.getElementById("cfg-app-name").value,
            app_pos: document.getElementById("cfg-app-pos").value,
            updated_at: serverTimestamp()
        }, { merge: true });

        // รวบรวมรหัสลับอาสาฯ รายหมู่
        const volSecrets = {};
        for(let i=1; i<=mooCount; i++) {
            const input = document.getElementById(`cfg-sec-vol-${i}`);
            if(input) volSecrets[i] = input.value;
        }

        // บันทึกความลับ
        await setDoc(doc(db, "system_config", "secrets"), {
            admin_secret: document.getElementById("cfg-sec-admin").value,
            volunteer_secrets: volSecrets,
            updated_at: serverTimestamp()
        }, { merge: true });

        alert("บันทึกการตั้งค่าระบบเรียบร้อยแล้ว!");
        location.reload(); // โหลดข้อมูลใหม่ให้ระบบดึงค่าอัปเดตไปใช้

    } catch (e) {
        console.error(e); alert("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
        btn.disabled = false; btn.textContent = "💾 บันทึกการตั้งค่าทั้งหมด";
    }
}