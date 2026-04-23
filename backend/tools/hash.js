// backend/tools/hash.js
const bcrypt = require('bcrypt');

const hash = "$2a$06$WakkHaH.Zw4rcqyGjtTXKe0OertcZaG/zHgF2IlpeTrfZRgl4ewty";
const candidate = process.argv[2] || "รหัสที่ต้องการทดสอบ";

console.log("ทดสอบ candidate:", candidate);

bcrypt.compare(candidate, hash)
  .then(match => {
    console.log(match ? "รหัสถูกต้อง ✅" : "รหัสไม่ตรง ❌");
  })
  .catch(err => {
    console.error("เกิดข้อผิดพลาด:", err);
  });

