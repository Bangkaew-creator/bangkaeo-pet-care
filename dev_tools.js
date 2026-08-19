import { db } from "./firebase-config.js";
import { collection, getDocs, doc, updateDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const logBox = document.getElementById("log-output");
const fileInput = document.getElementById("excel-file");
const btnStart = document.getElementById("btn-start-sync");
const btnClear = document.getElementById("btn-clear-log");

// ฟังก์ชันสำหรับพิมพ์ข้อความลงหน้าจอ
function log(msg, type = "normal") {
    let colorClass = "log-success";
    if (type === "error") colorClass = "log-error";
    if (type === "skip") colorClass = "log-skip";
    
    const time = new Date().toLocaleTimeString('th-TH');
    logBox.innerHTML += `<div class="${colorClass}">[${time}] ${msg}</div>`;
    logBox.scrollTop = logBox.scrollHeight;
}

btnClear.addEventListener("click", () => { logBox.innerHTML = "รอรับคำสั่ง..."; });

btnStart.addEventListener("click", () => {
    const file = fileInput.files[0];
    if (!file) {
        log("กรุณาเลือกไฟล์ Excel ก่อนครับ!", "error");
        return;
    }

    log("กำลังอ่านไฟล์ Excel...");
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

            log(`พบข้อมูลใน Excel จำนวน ${jsonData.length} รายการ`);
            await processData(jsonData);
        } catch (error) {
            log("เกิดข้อผิดพลาดในการอ่านไฟล์: " + error.message, "error");
            btnStart.disabled = false;
            btnStart.textContent = "🚀 เริ่มการซิงค์ข้อมูลลงฐานข้อมูล";
        }
    };
    reader.readAsArrayBuffer(file);
});

async function processData(excelData) {
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    log("เริ่มดึงข้อมูลผู้ใช้เก่าจาก Firebase เพื่อเปรียบเทียบ...");
    
    // ดึงเฉพาะคนที่เป็น "legacy" (คนที่ยังไม่เคยเข้าสู่ระบบมายืนยัน)
    const usersRef = collection(db, "users");
    const qLegacy = query(usersRef, where("household_role", "==", "legacy"));
    const snapLegacy = await getDocs(qLegacy);
    
    // สร้าง Map เพื่อให้ค้นหาข้อมูลบ้านได้เร็วขึ้น
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
        
        // รองรับทั้งหัวตารางภาษาไทยและภาษาอังกฤษ
        const hNo = row["บ้านเลขที่"] || row["house_no"];
        const vNo = row["หมู่ที่"] || row["village_no"];
        const oName = row["ชื่อเจ้าของ"] || row["owner_name"];

        if (!hNo || !vNo || !oName) {
            log(`แถวที่ ${i+2}: ข้อมูลไม่ครบถ้วน ข้าม...`, "error");
            errorCount++;
            continue;
        }

        const searchKey = `${hNo}-${vNo}`;
        
        // เช็คว่าบ้านเลขที่และหมู่ที่ตรงกับกลุ่ม Legacy (ที่ยังไม่ยืนยัน) หรือไม่
        if (legacyMap.has(searchKey)) {
            const userData = legacyMap.get(searchKey);
            
            try {
                // 1. อัปเดตชื่อใน Collection "users"
                await updateDoc(doc(db, "users", userData.id), {
                    owner_name: oName,
                    updated_at: serverTimestamp()
                });

                // 2. อัปเดตชื่อใน Collection "pets" ของบ้านหลังนี้
                const petsRef = collection(db, "pets");
                const qPets = query(petsRef, where("owner_uid", "==", userData.id));
                const snapPets = await getDocs(qPets);
                
                const petPromises = [];
                snapPets.forEach(pDoc => {
                    petPromises.push(updateDoc(doc(db, "pets", pDoc.id), {
                        owner_name: oName,
                        updated_at: serverTimestamp()
                    }));
                });
                await Promise.all(petPromises);

                log(`อัปเดตสำเร็จ: บ้าน ${hNo} ม.${vNo} -> เปลี่ยนชื่อเป็น "${oName}" (สัตว์เลี้ยง ${snapPets.size} ตัว)`);
                successCount++;

            } catch (err) {
                log(`อัปเดตล้มเหลว: บ้าน ${hNo} ม.${vNo} (${err.message})`, "error");
                errorCount++;
            }
        } else {
            // ไม่พบใน Legacy แปลว่า 1. ไม่มีข้อมูลแต่แรก หรือ 2. ประชาชนกดยืนยันเป็นชื่อตัวเองไปแล้ว
            log(`ข้าม: บ้าน ${hNo} ม.${vNo} (ประชาชนยืนยันแล้ว หรือไม่พบข้อมูล)`, "skip");
            skipCount++;
        }
    }

    log("==========================================");
    log(`สรุปผลการทำงาน:`);
    log(`✅ อัปเดตชื่อสำเร็จ: ${successCount} รายการ`);
    log(`⏭️ ข้าม (ยืนยันแล้ว/ไม่มีข้อมูล): ${skipCount} รายการ`);
    log(`❌ ขัดข้อง/ข้อมูลไม่ครบ: ${errorCount} รายการ`);

    btnStart.disabled = false;
    btnStart.textContent = "🚀 เริ่มการซิงค์ข้อมูลลงฐานข้อมูล";
    alert("กระบวนการอัปเดตเสร็จสมบูรณ์! ตรวจสอบ Log บนหน้าจอได้เลยครับ");
}
