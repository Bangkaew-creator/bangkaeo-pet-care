// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ข้อมูลการเชื่อมต่อ Firebase (อ้างอิงจากระบบเดิม)
const firebaseConfig = {
    apiKey: "AIzaSyCNsfEd11Yv2kNCO_T3s07WJ1eAXUyhssE",
    authDomain: "bangkaew-pet-db.firebaseapp.com",
    projectId: "bangkaew-pet-db",
    storageBucket: "bangkaew-pet-db.firebasestorage.app",
    messagingSenderId: "79581962937",
    appId: "1:79581962937:web:aed2a3297cf269afcc7168"
};

// เริ่มต้นระบบ Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Export ตัวแปร db เพื่อให้ไฟล์อื่น (เช่น registry.js) ดึงไปใช้งานได้
export { db };
