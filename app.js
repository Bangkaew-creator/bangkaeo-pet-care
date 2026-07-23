// ใส่ LIFF ID ที่ได้มา
const LIFF_ID = "2010813512-Wln3PzpL";

document.addEventListener("DOMContentLoaded", () => {
    initializeLiff();
    setupEventListeners();
});

// 1. เริ่มต้นระบบ LIFF
async function initializeLiff() {
    try {
        await liff.init({ liffId: LIFF_ID });
        
        if (!liff.isLoggedIn()) {
            liff.login(); // บังคับล็อกอินถ้ายังไม่ได้ล็อก
        } else {
            getLineProfile();
        }
    } catch (err) {
        console.error("LIFF Initialization failed", err);
        alert("เกิดข้อผิดพลาดในการเชื่อมต่อระบบ LINE");
    }
}

// 2. ดึงข้อมูลโปรไฟล์ LINE
async function getLineProfile() {
    try {
        const profile = await liff.getProfile();
        document.getElementById("profile-img").src = profile.pictureUrl || "https://via.placeholder.com/50";
        document.getElementById("profile-name").textContent = profile.displayName;
        
        // เมื่อโหลดเสร็จ ซ่อนหน้า Loading และแสดง Form
        document.getElementById("loading").style.display = "none";
        document.getElementById("app-container").style.display = "block";
        
        // TODO: (ในอนาคต) นำ profile.userId ไปเช็กใน Firebase ว่าเคยลงทะเบียนแล้วหรือยัง
        
    } catch (err) {
        console.error("Error getting profile", err);
    }
}

// 3. จัดการ Event หน้าจอ
function setupEventListeners() {
    const isRentalCheckbox = document.getElementById("is-rental");
    const roomNoGroup = document.getElementById("room-no-group");
    const roomNoInput = document.getElementById("room-no");

    // ซ่อน/แสดง ช่องกรอกเลขห้องเช่า
    isRentalCheckbox.addEventListener("change", (e) => {
        if (e.target.checked) {
            roomNoGroup.style.display = "block";
            roomNoInput.required = true;
        } else {
            roomNoGroup.style.display = "none";
            roomNoInput.required = false;
            roomNoInput.value = ""; // เคลียร์ค่าทิ้ง
        }
    });

    // ปุ่มถัดไป (ตรวจสอบฟอร์มก่อน)
    document.getElementById("btn-next").addEventListener("click", () => {
        const form = document.getElementById("registration-form");
        if (form.checkValidity()) {
            // ฟอร์มกรอกครบถ้วน
            alert("ข้อมูลเจ้าของเรียบร้อย เตรียมไปสเตปข้อมูลสัตว์เลี้ยง");
            // TODO: สลับหน้าจอไปยังส่วนเพิ่มข้อมูลสัตว์เลี้ยง
        } else {
            form.reportValidity(); // แจ้งเตือนให้กรอกช่องที่ขาด
        }
    });
}