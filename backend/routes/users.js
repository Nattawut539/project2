const express = require("express");
const router = express.Router();
const pool = require("../tools/db");
const multer = require("multer");
const { authRequired, requireStaff, withContext } = require("../tools/_utils");


// multer (ลบตัวซ้ำ)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
});

// รายการผู้ป่วยทั้งหมด — ดึงจาก user_details เป็นหลัก + ส่ง patient_code 3 หลัก
// router.get("/patients", authRequired, requireStaff, async (req, res) => {
//   console.log("HIT /patients", req.user);
//   try {
//     const rows = await withContext(req, async (client) => {
//       const ctx = await client.query(`
//         SELECT
//           current_setting('app.user_id', true) AS uid,
//           current_setting('app.role', true) AS role,
//           clinic.is_staff() AS is_staff
//       `);
//       console.log("PG CONTEXT =", ctx.rows[0]);

//       const result = await client.query(`
//         SELECT
//           u.user_id,
//           LPAD(u.user_id::text, 3, '0') AS patient_code,
//           d.national_id,
//           d.first_name,
//           d.last_name,
//           d.phone,
//           d.address,
//           d.birth_date AS dob,
//           d.profile_image,
//           u.created_at
//         FROM clinic.users u
//         LEFT JOIN clinic.user_details d
//           ON d.user_id = u.user_id
//         ORDER BY u.user_id ASC
//     `);

//       return result.rows;
//     });

//     res.json(rows);
//   } catch (e) {
//     console.error("GET /patients error:", e);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// ✅ รายชื่อผู้ป่วยทั้งหมด
router.get("/patients", authRequired, requireStaff, async (req, res) => {
  try {
    console.log("=== HIT /api/patients ===");
    console.log("req.user =", req.user);

    await withContext(req, async (client) => {
      const dbg1 = await client.query(`
        SELECT current_database() AS db, current_user AS db_user, current_schema() AS schema
      `);
      console.log("DB INFO =", dbg1.rows[0]);

      const dbg2 = await client.query(`
        SELECT COUNT(*) AS total_users
        FROM clinic.users
        WHERE role = 'user'
      `);
      console.log("COUNT USERS =", dbg2.rows[0]);

      const { rows } = await client.query(`
        SELECT
          u.user_id,
          LPAD(u.user_id::text, 3, '0') AS patient_code,
          d.national_id,
          d.first_name,
          d.last_name,
          d.phone,
          d.address,
          d.birth_date AS dob,
          d.profile_image,
          u.created_at
        FROM clinic.users u
        LEFT JOIN clinic.user_details d ON d.user_id = u.user_id
        WHERE u.role = 'user'
        ORDER BY u.user_id ASC
      `);

      console.log("PATIENT ROWS LENGTH =", rows.length);
      console.log("FIRST ROW =", rows[0] || null);

      return res.json(rows);
    });
  } catch (e) {
    console.error("GET /patients error:", e);
    res.status(500).json({ message: "Server error", detail: String(e?.message || e) });
  }
});
router.get("/patients-debug", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT COUNT(*) AS total_users
      FROM clinic.users
      WHERE role = 'user'
    `);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ message: String(e?.message || e) });
  }
});





// รายละเอียดรายคน — ส่ง patient_code ด้วย และกรองเฉพาะ user
router.get("/patients/:user_id", requireStaff, async (req, res) => {
  const id = parseInt(req.params.user_id, 10);

  try {
    await withContext(req, async (client) => {
      const { rows } = await client.query(
        `
        SELECT
          u.user_id,
          LPAD(u.user_id::text, 3, '0') AS patient_code,

          d.national_id,
          COALESCE(d.title, '') AS title,
          d.first_name,
          d.last_name,
          d.phone,
          d.address,
          d.birth_date AS dob,
          d.profile_image,

          COALESCE(d.nationality, '') AS nationality,
          COALESCE(d.ethnicity, '') AS ethnicity,

          COALESCE(d.position, '') AS position,    -- อาชีพ (ใช้ position)
          d.gender,
          COALESCE(d.blood_type, '') AS blood_type,
          COALESCE(d.emergency_phone, '') AS emergency_phone,
          COALESCE(d.email, '') AS email,

          COALESCE(d.congenital_disease, '') AS congenital_disease,
          COALESCE(d.drug_allergy, '') AS drug_allergy,
          COALESCE(d.food_allergy, '') AS food_allergy,

          u.created_at
        FROM users u
        JOIN user_details d ON d.user_id = u.user_id
        WHERE u.user_id = $1
          AND u.role = 'user'
        `,
        [id]
      );

      if (!rows.length)
        return res.status(404).json({ message: "ไม่พบข้อมูลผู้ป่วย" });

      res.status(200).json(rows[0]);
    });
  } catch (e) {
    console.error("GET /patients/:id error:", e);
    res.status(500).json({
      message: "Server error",
      detail: String(e?.message || e),
    });
  }
});

// ค้นหาด้วยเลขบัตรประชาชน
router.get("/patients/national/:nid", requireStaff, async (req, res) => {
  const nid = String(req.params.nid || "").trim();
  if (!nid) return res.status(400).json({ message: "invalid national_id" });

  try {
    await withContext(req, async (client) => {
      const { rows } = await client.query(
        `
        SELECT
          u.user_id,
          LPAD(u.user_id::text, 3, '0') AS patient_code  -- ✅ เผื่อใช้บนหน้า
        FROM users u
        JOIN user_details d ON d.user_id = u.user_id
        WHERE d.national_id = $1
          AND u.role = 'user'
        `,
        [nid]
      );
      if (!rows.length)
        return res.status(404).json({ message: "ไม่พบผู้ป่วย" });
      res.status(200).json(rows[0]); // { user_id, patient_code }
    });
  } catch (e) {
    console.error("GET /patients/national/:nid error:", e);
    res
      .status(500)
      .json({ message: "Server error", detail: String(e?.message || e) });
  }
});

// ✅ ค้นหาด้วย patient_code (เช่น 001) → ส่ง user_id กลับเพื่อนำไป /information
router.get("/patients/code/:code", requireStaff, async (req, res) => {
  // รับทั้ง 1, 01, 001 → จะแปลงเป็น 3 หลักให้ก่อนค้นหา
  const raw = String(req.params.code || "").trim();
  if (!raw) return res.status(400).json({ message: "invalid patient_code" });

  // ทำให้เป็น 3 หลักเสมอ (001, 023, 120 ...)
  const code = raw.padStart(3, "0");

  try {
    await withContext(req, async (client) => {
      const { rows } = await client.query(
        `
        SELECT
          u.user_id,
          LPAD(u.user_id::text, 3, '0') AS patient_code
        FROM users u
        WHERE u.role = 'user'
          AND LPAD(u.user_id::text, 3, '0') = $1
        `,
        [code]
      );
      if (!rows.length)
        return res.status(404).json({ message: "ไม่พบผู้ป่วย" });
      res.status(200).json(rows[0]); // { user_id, patient_code }
    });
  } catch (e) {
    console.error("GET /patients/code/:code error:", e);
    res
      .status(500)
      .json({ message: "Server error", detail: String(e?.message || e) });
  }
});

// อัปเดตข้อมูลผู้ป่วย (user_details)
router.put("/patients/:user_id", requireStaff, async (req, res) => {
  const id = parseInt(req.params.user_id, 10);
  const allow = [
    "national_id",
    "first_name",
    "last_name",
    "phone",
    "address",
    "birth_date",
    "gender",
    "blood_type",
    "ethnicity",
    "nationality",
    "emergency_phone",
    "email",
    "congenital_disease",
    "drug_allergy",
    "food_allergy",
    "position",
    "license_no",
  ];

  const payload = {};
  for (const k of allow)
    if (req.body[k] !== undefined) payload[k] = req.body[k];
  if (!Object.keys(payload).length)
    return res.status(400).json({ message: "no update fields" });

  try {
    await withContext(req, async (client) => {
      const sets = [];
      const vals = [];
      let i = 1;

      for (const [k, v] of Object.entries(payload)) {
        sets.push(`${k} = $${i++}`);
        vals.push(v);
      }
      vals.push(id);

      const sql = `
        UPDATE user_details
           SET ${sets.join(", ")},
               updated_at = NOW()
         WHERE user_id = $${i}
         RETURNING *`;
      const { rows } = await client.query(sql, vals);
      if (!rows.length) return res.status(404).json({ message: "not found" });
      res.json({ message: "updated", detail: rows[0] });
    });
  } catch (e) {
    console.error("PUT /patients/:id error:", e);
    res
      .status(500)
      .json({ message: "Server error", detail: String(e?.message || e) });
  }
});

router.put(
  "/patients/:user_id/profile",
  requireStaff,
  upload.single("file"), // ชื่อ field ต้องเป็น "file"
  async (req, res) => {
    const id = Number(req.params.user_id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: "invalid user_id" });
    }

    const imageUrl = (req.body?.imageUrl || "").trim();

    if (!req.file && !imageUrl) {
      return res.status(400).json({ message: "no file" });
    }

    // ถ้ามีไฟล์ แปลงเป็น base64 data URL; ถ้ามี imageUrl ให้ใช้ URL แทน
    const finalImage = req.file
      ? `data:${
          req.file.mimetype || "image/jpeg"
        };base64,${req.file.buffer.toString("base64")}`
      : imageUrl;

    try {
      await withContext(req, async (client) => {
        const { rows } = await client.query(
          `UPDATE user_details
             SET profile_image = $1, updated_at = NOW()
           WHERE user_id = $2
           RETURNING profile_image`,
          [finalImage, id]
        );
        if (!rows.length) return res.status(404).json({ message: "not found" });
        res.json({ message: "updated", profile_image: rows[0].profile_image });
      });
    } catch (e) {
      console.error("PUT /patients/:id/profile error:", e);
      res
        .status(500)
        .json({ message: "Server error", detail: String(e?.message || e) });
    }
  }
);

/**
 * ลบผู้ป่วย (ลบ users → user_details cascade)
 */
router.delete("/patients/:user_id", requireStaff, async (req, res) => {
  const id = parseInt(req.params.user_id, 10);
  try {
    await withContext(req, async (client) => {
      const { rowCount } = await client.query(
        `DELETE FROM users WHERE user_id = $1`,
        [id]
      );
      if (!rowCount) return res.status(404).json({ message: "not found" });
      res.json({ message: "deleted" });
    });
  } catch (e) {
    console.error("DELETE /patients/:id error:", e);
    res
      .status(500)
      .json({ message: "Server error", detail: String(e?.message || e) });
  }
});


router.get("/me/profile", authRequired, async (req, res) => {
  try {
    let userId = req.user?.user_id;
    if (!userId)
      return res.status(401).json({ message: "Unauthorized: no user_id" });

    // ดึงจาก user_details (ล่าสุดสุด)
    const prof = await pool.query(
      `
      SELECT ud.first_name, ud.last_name, ud.profile_image
      FROM clinic.user_details ud
      WHERE ud.user_id = $1
      ORDER BY ud.detail_id DESC
      LIMIT 1
      `,
      [userId]
    );

    if (prof.rows.length) {
      const r = prof.rows[0];
      return res.json({
        first_name: r.first_name || "",
        last_name: r.last_name || "",
        profile_image: r.profile_image || null,
      });
    }

    // ✅ fallback จาก users ถ้า user_details ยังไม่มี (ห้ามอ้าง u.first_name/u.last_name เพราะไม่มีใน schema)
    const fb = await pool.query(
      `
      SELECT
        COALESCE(NULLIF(TRIM(u.username), ''), split_part(COALESCE(u.email,''),'@',1), '') AS first_name,
        '' AS last_name,
        NULL::text AS profile_image
      FROM clinic.users u
      WHERE u.user_id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (!fb.rows.length)
      return res.status(404).json({ message: "ไม่พบโปรไฟล์" });

    const r = fb.rows[0];
    res.json({
      first_name: r.first_name || "",
      last_name: r.last_name || "",
      profile_image: null,
    });
  } catch (err) {
    console.error("GET /users/me/profile error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;
