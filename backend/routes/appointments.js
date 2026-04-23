const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../tools/db"); // เชื่อมต่อฐานข้อมูล
const { default: next } = require("next");
const { Result } = require("pg");
const router = express.Router();
const authContext = require("../tools/authContext");


//ตรวจสอบว่าเป็น Admin บ่?
function verifyAdmin(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(403).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(403).json({ error: "Invalid token format" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err)
      return res.status(403).json({ error: "Token verification failed" });

    req.admin = decoded;
    next();
  });
}

//จองนัด (เลือก slot_id)
router.post("/", async (req, res) => {
  const { slot_id, service_type } = req.body;
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) return res.status(403).json({ error: "Token missing" });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(403).json({ error: "Token invalid" });
  }

  const user_id = decoded.user_id;

  if (!slot_id || !service_type) {
    return res
      .status(400)
      .json({ error: "กรุณากรอก slot_id และ service_type" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO clinic.appointments (user_id, slot_id, service_type, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [user_id, slot_id, service_type]
    );

    res.status(201).json({
      message: "จองนัดหมายสำเร็จ",
      appointment: result.rows[0],
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// User ดูนัดของตัวเอง
router.get("/user/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await pool.query(
      `SELECT a.appointment_id, a.status, a.service_type, a.created_at,
              s.service_date, s.avaliable_date, s.hour_of_day
       FROM clinic.appointments a
       JOIN clinic.appointment_slots s ON a.slot_id = s.slot_id
       WHERE a.user_id = $1
       ORDER BY s.service_date ASC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "โหลดนัดหมายล้มเหลว" });
  }
});


router.get("/approved-week", authContext, async (req, res) => {
  const { start, end } = req.query;

  const { rows } = await pool.query(`
    SELECT
      a.appointment_id,
      s.service_date,
      s.hour_of_day,
      a.status,
      u.user_id,
      d.first_name,
      d.last_name
    FROM clinic.appointments a
    JOIN clinic.appointment_slots s ON s.slot_id = a.slot_id
    JOIN clinic.users u ON u.user_id = a.user_id
    LEFT JOIN clinic.user_details d ON d.user_id = u.user_id
    WHERE a.status = 'approved'
      AND s.service_date BETWEEN $1 AND $2
    ORDER BY s.service_date, s.hour_of_day
  `, [start, end]);

  res.json(rows);
});


// Admin ดูนัดทุกคน
router.get("/", verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        a.appointment_id, a.status, a.service_type, a.created_at,
        u.user_id, ud.first_name, ud.last_name,
        s.service_date, s.avaliable_date, s.hour_of_day
       FROM clinic.appointments a
       JOIN clinic.users u ON u.user_id = a.user_id
       LEFT JOIN clinic.user_details ud ON ud.user_id = u.user_id
       JOIN clinic.appointment_slots s ON s.slot_id = a.slot_id
       ORDER BY s.service_date ASC`
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "โหลดข้อมูลทั้งหมดล้มเหลว" });
  }
});

// อัปเดตสถานะ (approve / cancel)
router.put("/:id", verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    await pool.query(
      `UPDATE clinic.appointments
       SET status = $1, action_taken = true
       WHERE appointment_id = $2`,
      [status, id]
    );

    res.json({ message: "อัปเดตสถานะสำเร็จ" });
  } catch (error) {
    res.status(500).json({ error: "อัปเดตไม่สำเร็จ" });
  }
});

// ลบนัด (Admin เท่านั้น)
router.delete("/:id", verifyAdmin, async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM clinic.appointments WHERE appointment_id = $1`,
      [req.params.id]
    );

    res.json({ message: "ลบนัดหมายแล้ว" });
  } catch (error) {
    res.status(500).json({ error: "ลบนัดไม่ได้" });
  }
});

module.exports = router;
