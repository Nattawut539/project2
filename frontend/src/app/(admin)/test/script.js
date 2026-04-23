const container = document.getElementById("container");
const signUpBtn = document.getElementById("signUp");
const signInBtn = document.getElementById("signIn");

signUpBtn.addEventListener("click", () => {
  container.classList.add("right-panel-active");
});

signInBtn.addEventListener("click", () => {
  container.classList.remove("right-panel-active");
});

document.getElementById("loginForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  if (username === "admin" && password === "password") {
    alert("Login successful!");
  } else {
    alert("Invalid username or password!");
  }
});

document.addEventListener("DOMContentLoaded", function () {
  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", function (e) {
      const password = registerForm.password.value;
      const confirm = registerForm.confirm_password.value;
      if (password !== confirm) {
        alert("รหัสผ่านไม่ตรงกัน");
        e.preventDefault();
      }
      // เพิ่ม validation อื่นๆ ได้ที่นี่
    });
  }
});

const translations = {
  th: {
    welcome: "ยินดีต้อนรับกลับ!",
    login: "เข้าสู่ระบบ",
    register: "สมัครสมาชิก",
    username: "ชื่อผู้ใช้",
    password: "รหัสผ่าน",
    forgot: "ลืมรหัสผ่าน?",
    or: "หรือเข้าสู่ระบบด้วย",
    prefix: "คำนำหน้า",
    firstname: "ชื่อจริง",
    lastname: "นามสกุล",
    email: "อีเมล",
    phone: "เบอร์โทรศัพท์",
    province: "เลือกจังหวัด",
    birthdate: "วันเกิด",
    idcard: "เลขบัตรประชาชน",
    confirm_password: "ยืนยันรหัสผ่าน",
  },
  en: {
    welcome: "Welcome back!",
    login: "Login",
    register: "Register",
    username: "Username",
    password: "Password",
    forgot: "Forgot password?",
    or: "or login with",
    prefix: "Prefix",
    firstname: "First Name",
    lastname: "Last Name",
    email: "Email",
    phone: "Phone",
    province: "Select Province",
    birthdate: "Birthdate",
    idcard: "ID Card Number",
    confirm_password: "Confirm Password",
  },
};

function setLanguage(lang) {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    el.textContent = translations[lang][key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    el.placeholder = translations[lang][key];
  });
}

// ตัวอย่างการเปลี่ยนภาษา
document.getElementById("lang-th").onclick = () => setLanguage("th");
document.getElementById("lang-en").onclick = () => setLanguage("en");
