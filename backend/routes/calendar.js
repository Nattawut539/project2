// routes/calendar.js
const express = require("express");
const router = express.Router();
const pool = require("../tools/db");

router.get("/month", async (req, res) => {
  const { year, month } = req.query;

  if (!year || !month)
    return res.status(400).json({ error: "ต้องมี year & month" });

  try {
    const result = await pool.query(
      `SELECT * 
       FROM clinic.get_calendar_month($1, $2, 'Asia/Bangkok')`,
      [year, month]
    );

    res.json(result.rows);

  } catch (err) {
    res.status(500).json({ error: "โหลดปฏิทินรายเดือนไม่สำเร็จ" });
  }
});


module.exports = router;
