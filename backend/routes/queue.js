const express = require("express");
const router = express.Router();
const pool = require("../tools/db");
const { requireAuth, requireStaff, withContext } = require("../tools/_utils");

// -----------------------------------------------------
// 📌 ฟังก์ชันหาลำดับคิวถัดไป (ต่อวัน, ช่วงเวลา, A/B prefix)
// -----------------------------------------------------
async function nextNo(client, serviceDate, avail, prefix) {
  const { rows } = await client.query(
    `SELECT COALESCE(MAX(numeric_no), 0) + 1 AS n
     FROM clinic.queue_tickets
     WHERE service_date = $1
       AND avaliable_date = $2
       AND prefix = $3`,
    [serviceDate, avail, prefix],
  );
  return rows[0].n;
}

// -----------------------------------------------------
// 📌 ฟอร์แมตรูปแบบคิว เช่น A001, B045
// -----------------------------------------------------
function formatQ(prefix, n) {
  return `${prefix}${String(n).padStart(3, "0")}`;
}

// -----------------------------------------------------
// 📌 ออกคิว Walk-in (prefix = 'B')
// -----------------------------------------------------
router.post("/issue-walkin", requireStaff, async (req, res, next) => {
  const {
    avaliable_date = "morning",
    service_date,
    user_id = null,
    service_type = null,
    source = "staff",
  } = req.body || {};

  if (!["morning", "afternoon"].includes(avaliable_date)) {
    return res.status(400).json({ message: "avaliable_date ไม่ถูกต้อง" });
  }

  try {
    await withContext(req, async (client) => {
      const d = service_date ? new Date(service_date) : new Date();
      const day = d.toISOString().slice(0, 10);

      const prefix = "B";
      const n = await nextNo(client, day, avaliable_date, prefix);
      const qnum = formatQ(prefix, n);

      const ins = await client.query(
        `INSERT INTO clinic.queue_tickets
          (queue_number, prefix, numeric_no, service_date, avaliable_date, source, user_id, service_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [qnum, prefix, n, day, avaliable_date, source, user_id, service_type],
      );

      res.json({ message: "issued", ticket: ins.rows[0] });
    });
  } catch (e) {
    next(e);
  }
});

// -----------------------------------------------------
// 📌 ออกคิวจากการนัดหมาย (prefix = 'A')
// -----------------------------------------------------
router.post("/issue-from-appointment", requireStaff, async (req, res, next) => {
  const { appointment_id } = req.body || {};

  if (!appointment_id)
    return res.status(400).json({ message: "ต้องระบุ appointment_id" });

  try {
    await withContext(req, async (client) => {
      const ap = await client.query(
        `SELECT a.appointment_id, a.user_id, s.service_date::date AS service_date,
                s.avaliable_date, a.service_type
         FROM clinic.appointments a
         JOIN clinic.appointment_slots s ON s.slot_id = a.slot_id
         WHERE a.appointment_id = $1`,
        [appointment_id],
      );

      if (!ap.rowCount)
        return res.status(404).json({ message: "ไม่พบการนัดหมาย" });

      const { service_date, avaliable_date, user_id, service_type } =
        ap.rows[0];

      const prefix = "A";
      const n = await nextNo(client, service_date, avaliable_date, prefix);
      const qnum = formatQ(prefix, n);

      const ins = await client.query(
        `INSERT INTO clinic.queue_tickets
          (queue_number, prefix, numeric_no, service_date, avaliable_date, source, appointment_id, user_id, service_type)
         VALUES ($1,$2,$3,$4,$5,'online',$6,$7,$8)
         RETURNING *`,
        [
          qnum,
          prefix,
          n,
          service_date,
          avaliable_date,
          appointment_id,
          user_id,
          service_type,
        ],
      );

      res.json({ message: "issued", ticket: ins.rows[0] });
    });
  } catch (e) {
    next(e);
  }
});

// -----------------------------------------------------
// 📌 ดูคิววันนี้ทั้งหมด (staff เท่านั้น)
// -----------------------------------------------------
router.get("/today", requireStaff, async (req, res, next) => {
  const { avaliable_date, status } = req.query;

  try {
    await withContext(req, async (client) => {
      const params = [new Date().toISOString().slice(0, 10)];
      let sql = `SELECT *
                 FROM clinic.queue_tickets
                 WHERE service_date = $1`;

      if (avaliable_date) {
        params.push(avaliable_date);
        sql += ` AND avaliable_date = $${params.length}`;
      }

      if (status) {
        params.push(status);
        sql += ` AND status = $${params.length}`;
      }

      sql += ` ORDER BY avaliable_date, prefix, numeric_no`;

      const { rows } = await client.query(sql, params);
      res.json(rows);
    });
  } catch (e) {
    next(e);
  }
});

// GET /queue/week?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get("/week", requireStaff, async (req, res, next) => {
  const { start, end } = req.query;

  try {
    await withContext(req, async (client) => {
      const { rows } = await client.query(
        `SELECT *
         FROM clinic.queue_tickets
         WHERE service_date BETWEEN $1 AND $2
           AND prefix = 'A'
         ORDER BY service_date, avaliable_date, numeric_no`,
        [start, end],
      );
      res.json(rows);
    });
  } catch (e) {
    next(e);
  }
});

// -----------------------------------------------------
// 📌 ฟังก์ชัน setStatus: เปลี่ยนสถานะคิว
// -----------------------------------------------------
async function setStatus(req, res, next, newStatus, stampField) {
  try {
    await withContext(req, async (client) => {
      const { queue_id } = req.params;
      const { window_id = null } = req.body || {};

      const up = await client.query(
        `UPDATE clinic.queue_tickets
          SET status = $1,
              ${stampField} = NOW(),
              window_id = COALESCE($3, window_id)
         WHERE queue_id = $2
         RETURNING *`,
        [newStatus, queue_id, window_id],
      );

      if (!up.rowCount) return res.status(404).json({ message: "ไม่พบคิว" });
      res.json(up.rows[0]);
    });
  } catch (e) {
    next(e);
  }
}

// -----------------------------------------------------
// 📌 เปลี่ยนสถานะคิว — call / serve / skip / cancel
// -----------------------------------------------------
router.post("/:queue_id/call", requireStaff, (req, res, next) =>
  setStatus(req, res, next, "called", "called_at"),
);

router.post("/:queue_id/serve", requireStaff, (req, res, next) =>
  setStatus(req, res, next, "served", "served_at"),
);

router.post("/:queue_id/skip", requireStaff, (req, res, next) =>
  setStatus(req, res, next, "skipped", "skipped_at"),
);

router.post("/:queue_id/cancel", requireStaff, (req, res, next) =>
  setStatus(req, res, next, "cancelled", "cancelled_at"),
);

module.exports = router;
