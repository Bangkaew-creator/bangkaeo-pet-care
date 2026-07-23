const LIFF_ID = "2010813512-Wln3PzpL";
let signaturePad, ctx;
let isDrawing = false;
let userProfileData = null;

document.addEventListener("DOMContentLoaded", () => {
    initializeLiff();
    setupNavigation();
    setupRentalLogic();
    setupConsentAndSignature();
});

// 1. LIFF Init
async function initializeLiff() {
    try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) {
            liff.login();
        } else {
            userProfileData = await liff.getProfile();
            document.getElementById("loading").style.display = "none";
            document.getElementById("app-container").style.display = "block";
        }
    } catch (err) {
        console.error("LIFF Init Error", err);
    }
}

// 2. ระบบเปลี่ยนสเตป (หน้า 1 > 2 > 3)
function setupNavigation() {
    document.querySelectorAll('.btn-next').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const currentStep = e.target.closest('.step-content');
            
            // เช็ก Validation เบื้องต้นของช่องที่ required ในสเตปนั้นๆ
            const inputs = currentStep.querySelectorAll('input[required], select[required]');
            let isValid = true;
            inputs.forEach(input => { if (!input.value) isValid = false; });
            
            if (isValid) {
                const nextStepId = e.target.getAttribute('data-next');
                document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
                document.getElementById(`step-${nextStepId}`).classList.add('active');
            } else {
                alert("กรุณากรอกข้อมูลให้ครบถ้วน");
            }
        });
    });

    document.querySelectorAll('.btn-back').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const backStepId = e.target.getAttribute('data-back');
            document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
            document.getElementById(`step-${backStepId}`).classList.add('active');
        });
    });
}

// 3. จัดการเรื่องบ้านเช่า
function setupRentalLogic() {
    document.getElementById("is-rental").addEventListener("change", (e) => {
        const roomGroup = document.getElementById("room-no-group");
        const roomInput = document.getElementById("room-no");
        if (e.target.checked) {
            roomGroup.style.display = "block";
            roomInput.required = true;
        } else {
            roomGroup.style.display = "none";
            roomInput.required = false;
            roomInput.value = "";
        }
    });
}

// 4. จัดการระบบใบยินยอมและลายเซ็น Canvas
function setupConsentAndSignature() {
    const acceptCheckbox = document.getElementById("accept-risk");
    const sigSection = document.getElementById("signature-section");
    const btnSubmit = document.getElementById("btn-submit");

    // ปลดล็อกพื้นที่เซ็นชื่อเมื่อติ๊กยอมรับ
    acceptCheckbox.addEventListener("change", (e) => {
        if (e.target.checked) {
            sigSection.classList.add("active");
            btnSubmit.disabled = false;
            initCanvas(); // สร้างกระดานเซ็นชื่อ
        } else {
            sigSection.classList.remove("active");
            btnSubmit.disabled = true;
        }
    });

    // ลบลายเซ็น
    document.getElementById("btn-clear-sig").addEventListener("click", () => {
        if(ctx) ctx.clearRect(0, 0, signaturePad.width, signaturePad.height);
    });

    // ปุ่ม Submit สุดท้าย
    btnSubmit.addEventListener("click", () => {
        // ดึงภาพลายเซ็นออกมาเป็น Base64
        const signatureBase64 = signaturePad.toDataURL("image/png");
        
        // เช็กว่าเซ็นหรือยัง (เช็กว่า Canvas ว่างเปล่าไหม)
        const blankCanvas = document.createElement('canvas');
        blankCanvas.width = signaturePad.width;
        blankCanvas.height = signaturePad.height;
        if (signaturePad.toDataURL() === blankCanvas.toDataURL()) {
            alert("กรุณาเซ็นลายมือชื่อรับรอง");
            return;
        }

        // TODO: นำข้อมูลทั้งหมดและ signatureBase64 ยิงเข้า Firebase Firestore (จะทำในสเตปถัดไป)
        console.log("บันทึกข้อมูลเรียบร้อย", signatureBase64);
        alert("ลงทะเบียนสำเร็จ! (รันโค้ดต่อเพื่อส่งเข้า Firebase)");
        // ปิดหน้าจอ LIFF
        // liff.closeWindow(); 
    });
}

// ฟังก์ชันสร้างกระดานวาดลายเซ็น (รองรับเมาส์และนิ้วสัมผัส)
function initCanvas() {
    signaturePad = document.getElementById("signature-pad");
    if(signaturePad.width !== signaturePad.offsetWidth) {
        // กำหนดขนาด Canvas ให้เป๊ะกับหน้าจอ
        signaturePad.width = signaturePad.offsetWidth;
        signaturePad.height = signaturePad.offsetHeight;
        ctx = signaturePad.getContext("2d");
        ctx.strokeStyle = "#141E30"; // สีหมึกลายเซ็น (สีกรมท่า)
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
    }

    const startPos = (e) => {
        isDrawing = true;
        draw(e);
    };
    const stopPos = () => {
        isDrawing = false;
        ctx.beginPath();
    };
    const draw = (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const rect = signaturePad.getBoundingClientRect();
        // รองรับทั้งเมาส์และนิ้วสัมผัส
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;

        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    signaturePad.addEventListener("mousedown", startPos);
    signaturePad.addEventListener("mouseup", stopPos);
    signaturePad.addEventListener("mousemove", draw);

    signaturePad.addEventListener("touchstart", startPos, {passive: false});
    signaturePad.addEventListener("touchend", stopPos);
    signaturePad.addEventListener("touchmove", draw, {passive: false});
}
