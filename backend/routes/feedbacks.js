const express = require("express");
const router = express.Router();
const pool = require("../tools/db");
const { authRequired, requireStaff } = require("../tools/_utils");

//ฟังชันการวิเคราะห์ ปี/เดือน
function getDefaultYearMonth() {
    const now = new Date();
    return {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
    };
}
function parseYearMonth(query) {
    const def = getDefaultYearMonth();

    const yearRaw = query.year ?? def.year;
    const monthRaw = query.month ?? def.month;

    const year = Number(yearRaw);
    const month = Number(monthRaw);

    if (!Number.isInteger(year) || year < 2000 || year > 3000) {
        return { ok: false, message: "year ไม่ถูกต้อง" };
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
        return { ok: false, message: "month ไม่ถูกต้อง (1-12)" };
    }

    return { ok: true, year, month };
}

//User ส่ง feedback หลังรับการบริการ
router.post("/feedbacks", authRequired, async (req, res) => {
    const { score, liked, category, comment } = req.body;

    // validation เบื้องต้น
    if (score !== null && score !== undefined) {
        const s = Number(score);
        if (!Number.isInteger(s) || s < 1 || s > 5) {
        return res.status(400).json({ message: "score ต้องอยู่ในช่วง 1-5" });
        }
    }
    if (liked !== null && liked !== undefined && typeof liked !== "boolean") {
        return res.status(400).json({ message: "liked ต้องเป็น boolean" });
    }

    try {
        const { rows } = await pool.query(
        `
        INSERT INTO clinic.user_feedbacks
            (user_id, score, liked, category, comment)
        VALUES
            ($1,$2,$3,$4,$5)
        RETURNING *
        `,
        [
            req.user.user_id,
            score ?? null,
            liked ?? null,
            category ?? null,
            comment ?? null,
        ]
        );

        res.json(rows[0]);
    } catch (err) {
        console.error("POST /feedbacks error:", err);
        res.status(500).json({ message: "บันทึก feedback ไม่สำเร็จ" });
    }
});

//User ดู feedback ของตัวเองเท่านั้น
router.get("/feedbacks/me", authRequired, async (req, res) => {
    try {
        const { rows } = await pool.query(
        `
        SELECT *
        FROM clinic.user_feedbacks
        WHERE user_id = $1
        ORDER BY created_at DESC
        `,
        [req.user.user_id]
        );

        res.json(rows);
    } catch (err) {
        console.error("GET /feedbacks/me error:", err);
        res.status(500).json({ message: "โหลด feedback ไม่สำเร็จ" });
    }
});


//Admin ดู feedback ทั้งหมด
router.get("/feedbacks", requireStaff, async (_req, res) => {
    try {
        const { rows } = await pool.query(`
        SELECT
            f.*,
            u.email
        FROM clinic.user_feedbacks f
        LEFT JOIN clinic.users u ON f.user_id = u.user_id
        ORDER BY f.created_at DESC
        `);

        res.json(rows);
    } catch (err) {
        console.error("GET /feedbacks error:", err);
        res.status(500).json({ message: "โหลด feedback ไม่สำเร็จ" });
    }
});

//Admin สรุปรวมทั้งหมด วัน/เดือน/ปี
router.get("/feedbacks/summary", requireStaff, async (req, res) => {
    const ym = parseYearMonth(req.query);
    const hasFilter = req.query.year || req.query.month;

    try {
        let query = `
        SELECT
            COUNT(*)                                AS total,
            AVG(score)::numeric(4,2)                AS avg_score,
            COUNT(*) FILTER (WHERE liked=true)      AS likes,
            COUNT(*) FILTER (WHERE liked=false)     AS dislikes
        FROM clinic.user_feedbacks
        `;
        const params = [];

        if (hasFilter) {
        if (!ym.ok) return res.status(400).json({ message: ym.message });
        params.push(ym.year, ym.month);
        query += `
            WHERE EXTRACT(YEAR FROM created_at) = $1
            AND EXTRACT(MONTH FROM created_at) = $2
        `;
        }

        const { rows } = await pool.query(query, params);

        const row = rows[0] || null;
        if (!row || Number(row.total) === 0) {
        return res.json({
            total: 0,
            avg_score: null,
            likes: 0,
            dislikes: 0,
            empty: true,
        });
        }

        res.json({ ...row, empty: false });
    } catch (err) {
        console.error("GET /feedbacks/summary error:", err);
        res.status(500).json({ message: "โหลด summary ไม่สำเร็จ" });
    }
});

//Admin ดู ประเภทคนไข้ ตามเดือน/ปี
router.get("/feedbacks/summary/category", requireStaff, async (req, res) => {
    const ym = parseYearMonth(req.query);
    if (!ym.ok) return res.status(400).json({ message: ym.message });

    try {
        const { rows } = await pool.query(
        `
        SELECT
            COALESCE(category, 'ไม่ระบุ') AS category,
            COUNT(*)::int AS total
        FROM clinic.user_feedbacks
        WHERE EXTRACT(YEAR FROM created_at) = $1
            AND EXTRACT(MONTH FROM created_at) = $2
        GROUP BY COALESCE(category, 'ไม่ระบุ')
        ORDER BY total DESC, category ASC
        `,
        [ym.year, ym.month]
        );

        res.json({
        year: ym.year,
        month: ym.month,
        data: rows,
        empty: rows.length === 0,
        });
    } catch (err) {
        console.error("GET /feedbacks/summary/category error:", err);
        res.status(500).json({ message: "โหลดข้อมูล category ไม่สำเร็จ" });
    }
});

//Admin ดู like/dislike ตามเดือน/ปี
router.get("/feedbacks/summary/like-dislike", requireStaff, async (req, res) => {
    const ym = parseYearMonth(req.query);
    if (!ym.ok) return res.status(400).json({ message: ym.message });

    try {
        const { rows } = await pool.query(
        `
        SELECT
            COUNT(*) FILTER (WHERE liked=true)  ::int AS likes,
            COUNT(*) FILTER (WHERE liked=false) ::int AS dislikes,
            COUNT(*)::int AS total
        FROM clinic.user_feedbacks
        WHERE EXTRACT(YEAR FROM created_at) = $1
            AND EXTRACT(MONTH FROM created_at) = $2
        `,
        [ym.year, ym.month]
        );

        const row = rows[0] || { likes: 0, dislikes: 0, total: 0 };
        res.json({
        year: ym.year,
        month: ym.month,
        likes: row.likes ?? 0,
        dislikes: row.dislikes ?? 0,
        total: row.total ?? 0,
        empty: (row.total ?? 0) === 0,
        });
    } catch (err) {
        console.error("GET /feedbacks/summary/like-dislike error:", err);
        res.status(500).json({ message: "โหลด like/dislike ไม่สำเร็จ" });
    }
});

// Admin ดู คะแนนความพึงพอใจ ตามเดือน/ปี
router.get("/feedbacks/summary/score", requireStaff, async (req, res) => {
    const ym = parseYearMonth(req.query);
    if (!ym.ok) return res.status(400).json({ message: ym.message });

    try {
        const { rows } = await pool.query(
        `
        SELECT
            AVG(score)::numeric(4,2) AS avg_score,
            COUNT(*)::int AS total
        FROM clinic.user_feedbacks
        WHERE EXTRACT(YEAR FROM created_at) = $1
            AND EXTRACT(MONTH FROM created_at) = $2
        `,
        [ym.year, ym.month]
        );

        const row = rows[0] || { avg_score: null, total: 0 };

        res.json({
        year: ym.year,
        month: ym.month,
        avg_score: row.avg_score,
        total: row.total ?? 0,
        empty: (row.total ?? 0) === 0,
        });
    } catch (err) {
        console.error("GET /feedbacks/summary/score error:", err);
        res.status(500).json({ message: "โหลด score ไม่สำเร็จ" });
    }
});

//Admin ดูแนวโน้มการใช้บริการ รายวัน
router.get("/feedbacks/summary/daily", requireStaff, async (req, res) => {
    const ym = parseYearMonth(req.query);
    if (!ym.ok) return res.status(400).json({ message: ym.message });

    try {
        const { rows } = await pool.query(
        `
        SELECT
            DATE(created_at) AS day,
            COUNT(*)::int AS total,
            AVG(score)::numeric(4,2) AS avg_score
        FROM clinic.user_feedbacks
        WHERE EXTRACT(YEAR FROM created_at) = $1
            AND EXTRACT(MONTH FROM created_at) = $2
        GROUP BY day
        ORDER BY day ASC
        `,
        [ym.year, ym.month]
        );

        res.json({
        year: ym.year,
        month: ym.month,
        data: rows,
        empty: rows.length === 0,
        });
    } catch (err) {
        console.error("GET /feedbacks/summary/daily error:", err);
        res.status(500).json({ message: "โหลด daily trend ไม่สำเร็จ" });
    }
});


//Admin ดูข้อมูลต่างๆ Summary รายวัน เดือน ปี
router.get("/feedbacks/summary/period/:period", requireStaff, async (req, res) => {
    const { period } = req.params;

    let groupExpr;
    if (period === "daily") groupExpr = "DATE(created_at)";
    else if (period === "monthly") groupExpr = "DATE_TRUNC('month', created_at)";
    else if (period === "yearly") groupExpr = "DATE_TRUNC('year', created_at)";
    else return res.status(400).json({ message: "period ไม่ถูกต้อง" });

    // daily สามารถ filter เดือน/ปีได้ เพื่อปุ่ม < >
    const hasFilter = period === "daily" && (req.query.year || req.query.month);
    const ym = hasFilter ? parseYearMonth(req.query) : null;
    if (hasFilter && !ym.ok) return res.status(400).json({ message: ym.message });

    try {
        const params = [];
        let where = "";

        if (hasFilter) {
        params.push(ym.year, ym.month);
        where = `
            WHERE EXTRACT(YEAR FROM created_at) = $1
            AND EXTRACT(MONTH FROM created_at) = $2
        `;
        }

        const { rows } = await pool.query(
        `
        SELECT
            ${groupExpr} AS period,
            COUNT(*)::int AS total,
            AVG(score)::numeric(4,2) AS avg_score,
            COUNT(*) FILTER (WHERE liked=true)::int  AS likes,
            COUNT(*) FILTER (WHERE liked=false)::int AS dislikes
        FROM clinic.user_feedbacks
        ${where}
        GROUP BY period
        ORDER BY period ASC
        `,
        params
        );

        res.json({
        period,
        ...(hasFilter ? { year: ym.year, month: ym.month } : {}),
        data: rows,
        empty: rows.length === 0,
        });
    } catch (err) {
        console.error("GET /feedbacks/summary/period/:period error:", err);
        res.status(500).json({ message: "โหลด summary ตาม period ไม่สำเร็จ" });
    }
});


module.exports =router;