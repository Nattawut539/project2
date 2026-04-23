const express = require("express");
const router = express.Router();
const { requireStaff, withContext } = require("../tools/_utils");
const pool = require("../tools/db");


// บันทึกค่าชั่ง (Weight / Height / BMI)
router.post("/", requireStaff, async (req, res, next) => {
  const { queue_number, weight = null, height = null } = req.body || {};

  if (!queue_number)
    return res.status(400).json({ message: "จำเป็นต้องมีหมายเลขคิว" });

  try {
    await withContext(req, async (client) => {
      // ตรวจว่าคิวมีจริงไหม
      const q = await client.query(
        `SELECT 1 FROM clinic.queue_tickets WHERE queue_number = $1`,
        [queue_number]
      );
      if (!q.rowCount) return res.status(400).json({ message: "ไม่พบคิว" });

      // คำนวณ BMI
      let bmi = null;
      const w = parseFloat(weight);
      const h = parseFloat(height);

      if (w > 0 && h > 0) {
        bmi = +(w / ((h / 100) * (h / 100))).toFixed(2);
      }

      // INSERT into clinic.measurements
      const ins = await client.query(
        `INSERT INTO clinic.measurements (queue_number, weight, height, bmi)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [queue_number, w || null, h || null, bmi]
      );

      res.json(ins.rows[0]);
    });
  } catch (e) {
    next(e);
  }
});


// ดูประวัติค่าสัดส่วนจากคิวนี้
router.get("/:queue_number", requireStaff, async (req, res, next) => {
  try {
    await withContext(req, async (client) => {
      const { rows } = await client.query(
        `SELECT * 
         FROM clinic.measurements
         WHERE queue_number = $1
         ORDER BY created_at DESC`,
        [req.params.queue_number]
      );

      res.json(rows);
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
