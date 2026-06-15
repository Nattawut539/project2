const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("../tools/db");
const router = express.Router();
const authContext = require("../tools/authContext");

// ตรวจสอบว่าเป็น Admin หรือ staff
function verifyAdmin(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(403).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(403).json({ error: "Invalid token format" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: "Token verification failed" });
    }

    req.admin = decoded;
    next();
  });
}

// จองนัด เลือก slot_id
// แก้ไขส่วนนี้:
// 1. กัน slot เดียวถูกจองซ้ำ
// 2. กัน user คนเดิมจองหลายเวลาในวันเดียวกัน
// 3. จองสำเร็จแล้วปิด slot เป็น closed
router.post("/", async (req, res) => {
  const { slot_id, service_type } = req.body;
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(403).json({ error: "Token missing" });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(403).json({ error: "Token invalid" });
  }

  const user_id = decoded.user_id || decoded.sub;

  if (!user_id) {
    return res.status(403).json({ error: "ไม่พบ user_id ใน token" });
  }

  if (!slot_id || !service_type || !String(service_type).trim()) {
    return res.status(400).json({
      error: "กรุณาเลือกช่วงเวลาและกรอกหัวข้อนัดหมาย",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1) ล็อก slot นี้ก่อน เพื่อกันกรณีผู้ใช้หลายคนกดจองพร้อมกัน
    const slotResult = await client.query(
      `
      SELECT
        slot_id,
        service_date,
        avaliable_date,
        hour_of_day,
        status
      FROM clinic.appointment_slots
      WHERE slot_id = $1
      FOR UPDATE
      `,
      [slot_id]
    );

    if (slotResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        error: "ไม่พบช่วงเวลานัดหมายนี้",
      });
    }

    const slot = slotResult.rows[0];

    // 2) ถ้า slot ไม่ใช่ open ห้ามจอง
    if (String(slot.status || "").trim().toLowerCase() !== "open") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "ช่วงเวลานี้ไม่สามารถจองได้แล้ว กรุณาเลือกเวลาอื่น",
      });
    }

    // 3) เช็กว่า slot นี้มีคนจองไปแล้วหรือยัง
    const slotBookedResult = await client.query(
      `
      SELECT appointment_id
      FROM clinic.appointments
      WHERE slot_id = $1
        AND status NOT IN ('cancelled', 'rejected')
      LIMIT 1
      `,
      [slot_id]
    );

    if (slotBookedResult.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "ช่วงเวลานี้ถูกจองแล้ว กรุณาเลือกเวลาอื่น",
      });
    }

    // 4) เช็กว่า user คนนี้มีนัดในวันเดียวกันแล้วหรือยัง
    const userSameDayResult = await client.query(
      `
      SELECT a.appointment_id
      FROM clinic.appointments a
      JOIN clinic.appointment_slots s ON s.slot_id = a.slot_id
      WHERE a.user_id = $1
        AND s.service_date = $2
        AND a.status NOT IN ('cancelled', 'rejected')
      LIMIT 1
      `,
      [user_id, slot.service_date]
    );

    if (userSameDayResult.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "คุณมีนัดในวันนี้แล้ว ไม่สามารถจองหลายเวลาในวันเดียวกันได้",
      });
    }

    // 5) บันทึกการจอง
    const result = await client.query(
      `
      INSERT INTO clinic.appointments (user_id, slot_id, service_type, status)
      VALUES ($1, $2, $3, 'pending')
      RETURNING *
      `,
      [user_id, slot_id, String(service_type).trim()]
    );

    // 6) ปิด slot นี้ เพื่อไม่ให้คนอื่นเห็นเป็นเวลาว่างอีก
    await client.query(
      `
      UPDATE clinic.appointment_slots
      SET status = 'closed'
      WHERE slot_id = $1
      `,
      [slot_id]
    );

    await client.query("COMMIT");

    res.status(201).json({
      message: "จองนัดหมายสำเร็จ",
      appointment: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("POST /appointments error:", error);

    res.status(400).json({
      error: error.message || "จองคิวไม่สำเร็จ",
    });
  } finally {
    client.release();
  }
});

// User ดูนัดของตัวเอง
router.get("/user/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT
        a.appointment_id,
        a.status,
        a.service_type,
        a.created_at,
        s.service_date,
        s.avaliable_date,
        s.hour_of_day
      FROM clinic.appointments a
      JOIN clinic.appointment_slots s ON a.slot_id = s.slot_id
      WHERE a.user_id = $1
      ORDER BY s.service_date ASC
      `,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("GET /appointments/user/:userId error:", error);
    res.status(500).json({ error: "โหลดนัดหมายล้มเหลว" });
  }
});

router.get("/approved-week", authContext, async (req, res) => {
  const { start, end } = req.query;

  if (!start || !end) {
    return res.status(400).json({ error: "ต้องระบุ start และ end" });
  }

  try {
    const { rows } = await pool.query(
      `
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
      `,
      [start, end]
    );

    res.json(rows);
  } catch (error) {
    console.error("GET /appointments/approved-week error:", error);
    res.status(500).json({ error: "โหลดรายการนัดหมายรายสัปดาห์ล้มเหลว" });
  }
});

// Admin ดูนัดทุกคน
router.get("/", verifyAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        a.appointment_id,
        a.status,
        a.service_type,
        a.created_at,
        u.user_id,
        ud.first_name,
        ud.last_name,
        s.service_date,
        s.avaliable_date,
        s.hour_of_day
      FROM clinic.appointments a
      JOIN clinic.users u ON u.user_id = a.user_id
      LEFT JOIN clinic.user_details ud ON ud.user_id = u.user_id
      JOIN clinic.appointment_slots s ON s.slot_id = a.slot_id
      ORDER BY s.service_date ASC
      `
    );

    res.json(result.rows);
  } catch (error) {
    console.error("GET /appointments error:", error);
    res.status(500).json({ error: "โหลดข้อมูลทั้งหมดล้มเหลว" });
  }
});

// อัปเดตสถานะ approve / cancel
router.put("/:id", verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: "ต้องระบุ status" });
  }

  try {
    await pool.query(
      `
      UPDATE clinic.appointments
      SET status = $1, action_taken = true
      WHERE appointment_id = $2
      `,
      [status, id]
    );

    res.json({ message: "อัปเดตสถานะสำเร็จ" });
  } catch (error) {
    console.error("PUT /appointments/:id error:", error);
    res.status(500).json({ error: "อัปเดตไม่สำเร็จ" });
  }
});

// ลบนัด Admin เท่านั้น
router.delete("/:id", verifyAdmin, async (req, res) => {
  try {
    await pool.query(
      `
      DELETE FROM clinic.appointments
      WHERE appointment_id = $1
      `,
      [req.params.id]
    );

    res.json({ message: "ลบนัดหมายแล้ว" });
  } catch (error) {
    console.error("DELETE /appointments/:id error:", error);
    res.status(500).json({ error: "ลบนัดไม่ได้" });
  }
});

module.exports = router;
