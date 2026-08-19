import { db } from "./firebase-config.js";
import { collection, getDocs, doc, updateDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const logBox = document.getElementById("log-output");
const fileInput = document.getElementById("excel-file");
const btnStart = document.getElementById("btn-start-sync");
const btnClear = document.getElementById("btn-clear-log");

// ฟังก์ชันพิมพ์ Log
function log(msg, type = "normal") {
    let colorClass = "log-success";
    if (type === "error") colorClass = "log-error";
    if (type === "skip") colorClass = "log-skip";
    
    const time = new Date().toLocaleTimeString('th-TH');
    logBox.innerHTML += `<div class="${colorClass}">[${time}] ${msg}</div>`;
    logBox.scrollTop = logBox.scrollHeight;
}

// ฟังก์ชันแปลงเลขไทยเป็นเลขอารบิก
function convertThaiNumerals(text) {
    if (!text) return "";
    const thaiNums = { '๐': '0', '๑': '1', '๒': '2', '๓': '3', '๔': '4', '๕': '5', '๖': '6', '๗': '7', '๘': '8', '๙': '9' };
    return text.toString().replace(/[๐-๙]/g, match => thaiNums[match]).trim();
}

btnClear.addEventListener("click", () => { logBox.innerHTML = "รอรับคำสั่ง..."; });

btnStart.addEventListener("click", () => {
    const file = fileInput.files[0];
    if (!file) {
        log("กรุณาเลือกไฟล์ Excel ก่อนครับ!", "error");
        return;
    }

    const selectedMode = document.querySelector('input[name="sync_mode"]:checked').value;

    log(`กำลังอ่านไฟล์ Excel สำหรับโหมด: ${selectedMode}...`);
    btnStart.disabled = true;
    btnStart.textContent = "⏳ กำลังประมวลผล ห้ามปิดหน้าต่าง...";

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet);

            log(`พบข้อมูลใน Excel จำนวน ${jsonData.length} บรรทัด`);
            
            if (selectedMode === "household") {
                await processHouseholdData(jsonData);
            } else if (selectedMode === "stray") {
                await processStrayData(jsonData);
            }

        } catch (error) {
            log("เกิดข้อผิดพลาดในการอ่านไฟล์: " + error.message, "error");
            btnStart.disabled = false;
            btnStart.textContent = "🚀 เริ่มการประมวลผลข้อมูล";
        }
    };
    reader.readAsArrayBuffer(file);
});

// =====================================
// โหมด 1: อัปเดตชื่อเจ้าของบ้าน (โค้ดเดิม)
// =====================================
async function processHouseholdData(excelData) {
    let successCount = 0, skipCount = 0, errorCount = 0;

    log("เริ่มดึงข้อมูลผู้ใช้เก่าจาก Firebase เพื่อเปรียบเทียบ...");
    const usersRef = collection(db, "users");
    const qLegacy = query(usersRef, where("household_role", "==", "legacy"));
    const snapLegacy = await getDocs(qLegacy);
    
    const legacyMap = new Map(); 
    snapLegacy.forEach(d => {
        const u = d.data();
        const searchKey = `${u.house_no}-${u.village_no}`;
        legacyMap.set(searchKey, { id: d.id, ...u });
    });

    log(`พบข้อมูลที่รอการยืนยันในฐานข้อมูลจำนวน ${legacyMap.size} บ้าน`);
    log("==========================================");

    for (let i = 0; i < excelData.length; i++) {
        const row = excelData[i];
        const hNo = row["บ้านเลขที่"] || row["house_no"];
        const vNo = convertThaiNumerals(row["หมู่ที่"] || row["village_no"]); // เผื่อพิมพ์เลขไทยมา
        const oName = row["ชื่อเจ้าของ"] || row["owner_name"];

        if (!hNo || !vNo || !oName) {
            log(`แถวที่ ${i+2}: ข้อมูลไม่ครบถ้วน ข้าม...`, "error"); errorCount++; continue;
        }

        const searchKey = `${hNo}-${vNo}`;
        
        if (legacyMap.has(searchKey)) {
            const userData = legacyMap.get(searchKey);
            try {
                await updateDoc(doc(db, "users", userData.id), { owner_name: oName, updated_at: serverTimestamp() });

                const qPets = query(collection(db, "pets"), where("owner_uid", "==", userData.id));
                const snapPets = await getDocs(qPets);
                
                const petPromises = [];
                snapPets.forEach(pDoc => { petPromises.push(updateDoc(doc(db, "pets", pDoc.id), { owner_name: oName, updated_at: serverTimestamp() })); });
                await Promise.all(petPromises);

                log(`อัปเดตสำเร็จ: บ้าน ${hNo} ม.${vNo} -> เปลี่ยนชื่อเป็น "${oName}"`);
                successCount++;
            } catch (err) {
                log(`อัปเดตล้มเหลว: บ้าน ${hNo} ม.${vNo} (${err.message})`, "error"); errorCount++;
            }
        } else {
            log(`ข้าม: บ้าน ${hNo} ม.${vNo} (ประชาชนยืนยันแล้ว หรือไม่พบข้อมูล)`, "skip"); skipCount++;
        }
    }

    log("==========================================");
    log(`สรุปผลโหมดบ้าน: ✅ สำเร็จ ${successCount} | ⏭️ ข้าม ${skipCount} | ❌ เออเร่อ ${errorCount}`);
    finishProcess();
}

// =====================================
// โหมด 2: ซ่อมแซมหมู่สัตว์จรจัด (โค้ดใหม่)
// =====================================
async function processStrayData(excelData) {
    let successCount = 0, skipCount = 0, errorCount = 0;

    log("เริ่มดึงข้อมูลสัตว์จรจัดทั้งหมดจาก Firebase เพื่อเปรียบเทียบ...");
    const snapStray = await getDocs(collection(db, "stray_reports"));
    
    const strayList = [];
    snapStray.forEach(d => strayList.push({ id: d.id, ...d.data() }));

    log(`พบข้อมูลเบาะแสสัตว์จรจัดในระบบทั้งหมด ${strayList.length} รายการ`);
    log("==========================================");

    for (let i = 0; i < excelData.length; i++) {
        const row = excelData[i];
        const locDesc = row["LocationDesc"];
        const feederName = row["FeederName"];
        const rawMoo = row["หมู่"];

        if (!locDesc || !rawMoo) {
            log(`แถวที่ ${i+2}: ข้อมูลสถานที่ (LocationDesc) หรือ หมู่ ไม่ครบ ข้าม...`, "error");
            errorCount++; continue;
        }

        // 1. แปลงเลขไทยเป็นอารบิก (เช่น '๑๔' -> '14')
        const cleanMoo = convertThaiNumerals(rawMoo);

        // 2. ค้นหาในข้อมูล Firebase ที่ดึงมา (เทียบจาก LocationDesc และ FeederName)
        const matchedDoc = strayList.find(s => 
            (s.landmark && s.landmark.trim() === locDesc.trim()) &&
            (!feederName || (s.reporter_name && s.reporter_name.trim() === feederName.trim()))
        );

        if (matchedDoc) {
            try {
                // อัปเดตฟิลด์ moo ใน Firebase
                await updateDoc(doc(db, "stray_reports", matchedDoc.id), {
                    moo: cleanMoo,
                    updated_at: serverTimestamp()
                });
                log(`✅ ซ่อมแซมสำเร็จ: สถานที่ "${locDesc}" -> แก้ไขหมู่เป็น "${cleanMoo}"`);
                successCount++;
            } catch (err) {
                log(`❌ อัปเดตล้มเหลว: สถานที่ "${locDesc}" (${err.message})`, "error");
                errorCount++;
            }
        } else {
            log(`⏭️ ข้าม: ไม่พบจุดแจ้ง "${locDesc}" ในระบบ Firebase`, "skip");
            skipCount++;
        }
    }

    log("==========================================");
    log(`สรุปผลซ่อมแซมสัตว์จร: ✅ สำเร็จ ${successCount} | ⏭️ ข้าม/ไม่พบ ${skipCount} | ❌ เออเร่อ ${errorCount}`);
    finishProcess();
}

function finishProcess() {
    btnStart.disabled = false;
    btnStart.textContent = "🚀 เริ่มการประมวลผลข้อมูล";
    alert("กระบวนการประมวลผลเสร็จสมบูรณ์! ตรวจสอบ Log บนหน้าจอได้เลยครับ");
}
