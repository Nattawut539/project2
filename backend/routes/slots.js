const express = require("express");
const router = express.Router();
const pool = require("../tools/db");
const jwt = require("jsonwebtoken");

//อ่าน JWT(ถอดรหัส) ของ users และคืนข้อมูล users
function getUserFromToken(req) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return null;
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return null;
  }
}

//ดึงปฏิทิน (slot) ทั้งหมดของวันเดียว
router.get("/day", async (req, res) => {
  const { date } = req.query;
  if (!date)
    return res.status(400).json({ error: "ต้องระบุ date= YYYY-MM-DD" });

  try {
    await pool.query("SELECT clinic.lock_timed_out_slots()");

    const result = await pool.query(
      `SELECT slot_id, service_date, avaliable_date, hour_of_day, status, start_ts,bookable_until
        FROM clinic.appointment_slots
        WHERE service_date = $1
        ORDER BY avaliable_date , hour_of_day`,
      [date]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GET /slots/day", err);
    res.status(500).json({ error: "ดึง slot รายวันไม่สำเร็จ" });
  }
});

//user เห็นปฎิทิน(slot)ทั้งหมดและนัดหมายของตนเองเท่านั้น
router.get("/user-calendar", async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "ต้องระบุ date" });

  const user = getUserFromToken(req);
  if (!user) return res.status(403).json({ error: "Missing or invalid token" });

  try {
    await pool.query("SELECT clinic.lock_timed_out_slots()");
    const result = await pool.query(
      `SELECT
        s.slot_id,
        s.service_date,
        s.avaliable_date,
        s.hour_of_day,
        s.status,
        a.appointment_id,
        a.user_id AS appt_user_id,
        CASE
          WHEN a.user_id = $2 THEN true
          ELSE false
        END AS is_mine
      FROM clinic.appointment_slots s
      LEFT JOIN clinic.appointments a ON a.slot_id = s.slot_id
      WHERE s.service_date =$1
      ORDER BY s.avaliable_date, s.hour_of_day`,
      [date, user.user_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GET /slots/user-calendar", err);
    res.status(500).json({ error: "โหลดปฏิทิน user ไม่สำเร็จ" });
  }
});

//ดึงปฏิทินทั้งสัปดาห์ให้ user เห็นทั้งหมด(จะได้รู้ว่าเต็มหรือไม่)
router.get("/week", async (req, res) => {
  try {
    await pool.query("SELECT clinic.lock_timed_out_slots()");
    const result = await pool.query("SELECT * FROM clinic.calendar_this_week");
    res.json(result.rows);
  } catch (err) {
    console.error("GET /slots/week", err);
    res.status(500).json({ error: "โหลดปฏิทินสัปดาห์ไม่สำเร็จ" });
  }
});

//ดึงปฏิทินรายเดือน
router.get("/month", async (req, res) => {
  const { year, month } = req.query;
  if (!year || !month) {
    return res.status(400).json({ error: "ต้องมี year & month" });
  }

  try {
    await pool.query("SELECT clinic.lock_timed_out_slots()");

    const result = await pool.query(
      `SELECT * FROM clinic.get_calendar_month($1,$2, 'Asia/Bangkok')`,
      [year, month]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET /slots/month", err);
    res.status(500).json({ error: "โหลดปฎิทินเดือนไม่สำเร็จ" });
  }
});

// STAFF เท่านั้น: generate slot ล่วงหน้า
router.post("/seed", async (req, res) => {
  const user = getUserFromToken(req);
  if (
    !user ||
    !["admin", "super_admin", "doctor", "assistant"].includes(user.role)
  ) {
    return res.status(403).json({ error: "ต้องเป็น staff เท่านั้น" });
  }

  const { start, end } = req.body;
  if (!start || !end)
    return res.status(400).json({ error: "ต้องระบุ start & end" });

  try {
    await pool.query(`SELECT clinic.seed_slots($1::date, $2::date)`, [
      start,
      end,
    ]);
    res.json({ message: "สร้าง slot สำเร็จ" });
  } catch (err) {
    console.error("POST /slots/seed", err);
    res.status(500).json({ error: "seed slot ล้มเหลว" });
  }
});

module.exports = router;
