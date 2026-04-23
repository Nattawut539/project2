// backend/routes/medical.js
const express = require("express");
const router = express.Router();

const { authRequired, requireStaff, withContext } = require("../tools/_utils");

// ผู้ใช้ดูเวชระเบียนของตัวเอง
router.get("/medical/my", authRequired, async (req, res, next) => {
  try {
    await withContext(req, async (client) => {
      const { rows } = await client.query(`
        SELECT record_id, user_id, visit_date, symptoms, diagnosis, treatment,
               medications, notes, doctor_id, follow_up_date, visibility,
               created_at, updated_at
        FROM clinic.medical_records
        WHERE user_id = clinic.app_user_id()
        ORDER BY visit_date DESC
      `);
      res.json(rows);
    });
  } catch (e) {
    next(e);
  }
});

// บุคลากรดูเวชระเบียนของผู้ใช้งานรายหนึ่ง
router.get(
  "/medical/by-user/:user_id",
  requireStaff,
  async (req, res, next) => {
    try {
      await withContext(req, async (client) => {
        const { rows } = await client.query(
          `SELECT * FROM clinic.medical_records
         WHERE user_id = $1
         ORDER BY visit_date DESC`,
          [req.params.user_id]
        );
        res.json(rows);
      });
    } catch (e) {
      next(e);
    }
  }
);

// สร้างเวชระเบียน (เฉพาะ staff)
router.post("/medical", requireStaff, async (req, res, next) => {
  const {
    user_id,
    visit_date = null,
    symptoms = null,
    diagnosis = null,
    treatment = null,
    medications = [],
    notes = null,
    doctor_id = null,
    follow_up_date = null,
    visibility = "private",
  } = req.body || {};

  if (!user_id)
    return res.status(400).json({ message: "จำเป็นต้องมี user_id" });

  try {
    await withContext(req, async (client) => {
      const ins = await client.query(
        `INSERT INTO clinic.medical_records
         (user_id, visit_date, symptoms, diagnosis, treatment, medications,
          notes, doctor_id, follow_up_date, visibility)
         VALUES ($1, COALESCE($2, NOW()), $3, $4, $5, $6::jsonb, $7, $8, $9, $10::clinic.record_visibility)
         RETURNING *`,
        [
          user_id,
          visit_date,
          symptoms,
          diagnosis,
          treatment,
          JSON.stringify(medications),
          notes,
          doctor_id,
          follow_up_date,
          visibility,
        ]
      );
      res.json(ins.rows[0]);
    });
  } catch (e) {
    next(e);
  }
});

// แก้ไขเวชระเบียนบางส่วน (เฉพาะ staff)
router.patch("/medical/:record_id", requireStaff, async (req, res, next) => {
  const fields = [
    "symptoms",
    "diagnosis",
    "treatment",
    "medications",
    "notes",
    "follow_up_date",
    "visibility",
  ];

  const sets = [];
  const params = [];
  let i = 1;

  for (const f of fields) {
    if (Object.prototype.hasOwnProperty.call(req.body, f)) {
      if (f === "medications") {
        sets.push(`${f} = $${i}::jsonb`);
        params.push(JSON.stringify(req.body[f]));
      } else if (f === "visibility") {
        sets.push(`${f} = $${i}::clinic.record_visibility`);
        params.push(req.body[f]);
      } else {
        sets.push(`${f} = $${i}`);
        params.push(req.body[f]);
      }
      i++;
    }
  }

  if (!sets.length)
    return res.status(400).json({ message: "ไม่มีฟิลด์ที่จะอัปเดต" });

  params.push(req.params.record_id);

  try {
    await withContext(req, async (client) => {
      const up = await client.query(
        `UPDATE clinic.medical_records
         SET ${sets.join(", ")}
         WHERE record_id = $${params.length}
         RETURNING *`,
        params
      );
      if (!up.rowCount) return res.status(404).json({ message: "ไม่พบบันทึก" });
      res.json(up.rows[0]);
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
