const LIFF_ID = "2010813512-Wln3PzpL";
let pets = []; // ตะกร้าเก็บข้อมูลสัตว์เลี้ยง
let canvasInstances = []; // เก็บข้อมูลกระดานเซ็นชื่อแต่ละตัว

document.addEventListener("DOMContentLoaded", () => {
    initializeLiff();
    setupNavigation();
    setupRentalLogic();
    setupPetSystem();
});

// 1. LIFF Init
async function initializeLiff() {
    try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) liff.login();
        else {
            document.getElementById("loading").style.display = "none";
            document.getElementById("app-container").style.display = "block";
        }
    } catch (err) {
        console.error("LIFF Init Error", err);
    }
}

// 2. ระบบเปลี่ยนสเตป
function setupNavigation() {
    document.querySelectorAll('.btn-next').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const currentStep = e.target.closest('.step-content');
            const inputs = currentStep.querySelectorAll('input[required], select[required]');
            let isValid = true;
            inputs.forEach(input => { if (!input.value) isValid = false; });
            
            if (isValid) {
                const nextStepId = e.target.getAttribute('data-next');
                changeStep(nextStepId);
            } else {
                alert("กรุณากรอกข้อมูลในช่องที่จำเป็นให้ครบถ้วน");
            }
        });
    });

    document.querySelectorAll('.btn-back').forEach(btn => {
        btn.addEventListener('click', (e) => {
            changeStep(e.target.getAttribute('data-back'));
        });
    });
}

function changeStep(stepId) {
    document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
    document.getElementById(`step-${stepId}`).classList.add('active');
    
    // ถ้ากำลังจะไปหน้า 3 (ใบยินยอม) ให้สร้างฟอร์มยินยอมตามจำนวนสัตว์เลี้ยง
    if(stepId === "3") {
        renderConsentForms();
    }
}

// 3. จัดการเรื่องบ้านเช่า
function setupRentalLogic() {
    document.getElementById("is-rental").addEventListener("change", (e) => {
        const roomGroup = document.getElementById("room-no-group");
        const roomInput = document.getElementById("room-no");
        if (e.target.checked) { roomGroup.style.display = "block"; roomInput.required = true; } 
        else { roomGroup.style.display = "none"; roomInput.required = false; roomInput.value = ""; }
    });
}

// 4. ระบบเพิ่มสัตว์เลี้ยงเข้าตะกร้า (Array)
function setupPetSystem() {
    const btnAddPet = document.getElementById("btn-add-pet");
    const btnGoConsent = document.getElementById("btn-go-consent");

    btnAddPet.addEventListener("click", () => {
        const name = document.getElementById("pet-name").value;
        const type = document.getElementById("pet-type").value;
        const gender = document.getElementById("pet-gender").value;
        const service = document.getElementById("service-type").value;

        if(!name || !type || !gender || !service) {
            alert("กรุณากรอกข้อมูลสัตว์เลี้ยงให้ครบก่อนกดบันทึก");
            return;
        }

        // เพิ่มเข้า Array
        pets.push({ name, type, gender, service, signed: false });
        
        // เคลียร์ฟอร์ม
        document.getElementById("pet-name").value = "";
        document.getElementById("pet-type").value = "";
        document.getElementById("pet-gender").value = "";
        document.getElementById("service-type").value = "";

        updatePetListUI();
    });

    // ปุ่มไปหน้ายินยอม ผูกอีเวนต์เปลี่ยนหน้า
    btnGoConsent.addEventListener("click", () => changeStep("3"));
}

function updatePetListUI() {
    const container = document.getElementById("pet-list-container");
    const btnGoConsent = document.getElementById("btn-go-consent");
    container.innerHTML = "";

    pets.forEach((pet, index) => {
        const div = document.createElement("div");
        div.className = "pet-item";
        div.innerHTML = `
            <strong>${index + 1}. ${pet.name}</strong> (${pet.type} ${pet.gender})<br>
            <span style="color:#D4AF37;">บริการ: ${pet.service}</span>
            <button type="button" class="remove-btn" onclick="removePet(${index})">❌ ลบ</button>
        `;
        container.appendChild(div);
    });

    // เปิดให้ปุ่มถัดไปทำงานได้ถ้ามีสัตว์เลี้ยง > 0
    if(pets.length > 0) {
        btnGoConsent.style.opacity = "1";
        btnGoConsent.style.pointerEvents = "auto";
    } else {
        btnGoConsent.style.opacity = "0.5";
        btnGoConsent.style.pointerEvents = "none";
    }
}

// ฟังก์ชันลบสัตว์เลี้ยง (เป็น Global function เพื่อให้เรียกจาก HTML ได้)
window.removePet = function(index) {
    pets.splice(index, 1);
    updatePetListUI();
}

// 5. ระบบสร้างใบยินยอมแยกตัว
function renderConsentForms() {
    const container = document.getElementById("dynamic-consent-container");
    container.innerHTML = "";
    canvasInstances = []; // ล้างข้อมูล canvas เก่า

    const legalText = "ข้าพเจ้ายินยอมให้สัตวแพทย์ดำเนินการผ่าตัดทำหมัน โดยรับทราบความเสี่ยงที่อาจเกิดภาวะแทรกซ้อนจากการวางยาสลบ หรือปัจจัยทางสุขภาพของสัตว์เลี้ยงที่มองไม่เห็นภายนอก ซึ่งสัตวแพทย์ผู้ปฏิบัติทำการผ่าตัดทำหมันได้ปฏิบัติถูกต้องตามหลักวิชาการ หากสัตว์ของข้าพเจ้าตาย หรือเกิดความผิดปกติใดๆ ในระหว่างการดำเนินการหลังการผ่าตัด การผ่าตัดทำหมัน และ/หรือ ฉีดวัคซีนป้องกันโรคพิษสุนัขบ้าให้แก่สัตว์เลี้ยง ข้าพเจ้าจะไม่ถือว่าเป็นความผิดของเจ้าหน้าที่และจะไม่เอาผิด หรือเรียกร้องค่าเสียหายใดๆกับเจ้าหน้าที่ ข้าพเจ้าขอลงลายมือชื่อไว้เป็นหลักฐาน";

    pets.forEach((pet, index) => {
        const cardId = `consent-card-${index}`;
        const canvasId = `canvas-${index}`;
        
        const html = `
        <div class="card neumorphic" id="${cardId}">
            <h3 class="section-title">ใบยินยอมตัวที่ ${index + 1}: น้อง${pet.name}</h3>
            <p style="font-size:14px; margin-bottom:10px; color:#81A1C1;">(${pet.type} ${pet.gender} - ${pet.service})</p>
            
            <div class="terms-box neumorphic-inner">
                <p>${legalText}</p>
            </div>

            <div class="input-group checkbox-group">
                <input type="checkbox" id="accept-${index}" class="neumorphic-checkbox" onchange="toggleSignature(${index})">
                <label for="accept-${index}">ข้าพเจ้ายอมรับเงื่อนไขและข้อตกลงข้างต้น</label>
            </div>

            <div id="sig-section-${index}" class="disabled-section">
                <label style="margin-top: 10px; color: #A0B0C0;">ลงลายมือชื่อเจ้าของ (เซ็นบนกรอบด้านล่าง)</label>
                <canvas id="${canvasId}" class="signature-pad"></canvas>
                <button type="button" class="clear-btn" onclick="clearCanvas(${index})">ลบลายเซ็น</button>
            </div>
        </div>`;
        
        container.insertAdjacentHTML('beforeend', html);
    });

    // หน่วงเวลาเล็กน้อยเพื่อให้ HTML Render เสร็จ แล้วค่อยผูก Event ให้ Canvas
    setTimeout(() => {
        pets.forEach((_, index) => initCanvas(index));
        checkAllSigned(); // ตรวจสอบปุ่ม Submit
    }, 300);
}

// ปลดล็อกกระดานเซ็นชื่อเมื่อติ๊กยอมรับ
window.toggleSignature = function(index) {
    const isChecked = document.getElementById(`accept-${index}`).checked;
    const sigSection = document.getElementById(`sig-section-${index}`);
    if(isChecked) {
        sigSection.classList.add("active");
    } else {
        sigSection.classList.remove("active");
    }
    checkAllSigned();
}

// สร้างระบบวาดเขียนใน Canvas
function initCanvas(index) {
    const canvas = document.getElementById(`canvas-${index}`);
    if(!canvas) return;

    // Set Actual Size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#141E30";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";

    let isDrawing = false;

    const startPos = (e) => { isDrawing = true; draw(e); };
    const stopPos = () => { isDrawing = false; ctx.beginPath(); checkAllSigned(); };
    const draw = (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
        const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    canvas.addEventListener("mousedown", startPos);
    canvas.addEventListener("mouseup", stopPos);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("touchstart", startPos, {passive: false});
    canvas.addEventListener("touchend", stopPos);
    canvas.addEventListener("touchmove", draw, {passive: false});

    // เก็บลง Array เพื่อง่ายต่อการตรวจสอบ
    canvasInstances[index] = { canvas, ctx };
}

window.clearCanvas = function(index) {
    const instance = canvasInstances[index];
    if(instance) {
        instance.ctx.clearRect(0, 0, instance.canvas.width, instance.canvas.height);
        checkAllSigned();
    }
}

// ตรวจสอบว่าเซ็นครบทุกตัวหรือยัง เพื่อปลดล็อกปุ่ม Submit
function checkAllSigned() {
    const btnSubmit = document.getElementById("btn-submit");
    let allValid = true;

    pets.forEach((_, index) => {
        const isChecked = document.getElementById(`accept-${index}`).checked;
        const instance = canvasInstances[index];
        let isSigned = false;

        // เช็กว่า Canvas ว่างเปล่าหรือไม่
        if(instance) {
            const blankCanvas = document.createElement('canvas');
            blankCanvas.width = instance.canvas.width;
            blankCanvas.height = instance.canvas.height;
            isSigned = (instance.canvas.toDataURL() !== blankCanvas.toDataURL());
        }

        if(!isChecked || !isSigned) allValid = false;
    });

    btnSubmit.disabled = !allValid;
}

// ปุ่ม Submit สุดท้าย
document.getElementById("btn-submit").addEventListener("click", () => {
    // เก็บรูปลายเซ็นเข้า Array
    pets.forEach((pet, index) => {
        pet.signatureBase64 = canvasInstances[index].canvas.toDataURL("image/png");
        pet.signed = true;
    });

    console.log("พร้อมส่งข้อมูล", { ownerName: document.getElementById("owner-name").value, pets });
    alert("ลงทะเบียนสำเร็จและเซ็นใบยินยอมครบทุกตัวแล้ว! (รอเชื่อม Firebase)");
});
