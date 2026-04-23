// routes/line.js
const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const pool = require("../../tools/db");

const router = express.Router();

const ROLE_HOME = {
  super_admin: "/adminse",
  admin: "/admins",
  doctor: "/admins",
  user: "/admins", // หน้าโฮมผู้ใช้ทั่วไป
};

const {
  LINE_CHANNEL_ID,
  LINE_CHANNEL_SECRET,
  LINE_REDIRECT_URI,
  LINE_SCOPES = "openid profile",
  JWT_SECRET = "dev_secret_for_local",
} = process.env;

const rand = () => crypto.randomBytes(16).toString("hex");

// เริ่ม LINE Login
router.get("/line/login", (req, res) => {
  if (
    !LINE_CHANNEL_ID ||
    /YOUR_LINE_CHANNEL_ID/i.test(String(LINE_CHANNEL_ID))
  ) {
    return res
      .status(500)
      .json({ error: "LINE_CHANNEL_ID is not set properly" });
  }
  if (!LINE_REDIRECT_URI)
    return res.status(500).json({ error: "LINE_REDIRECT_URI is not set" });

  const state = rand(),
    nonce = rand();
  res.cookie("line_state", state, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 10 * 60 * 1000,
  });
  res.cookie("line_nonce", nonce, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 10 * 60 * 1000,
  });

  const authURL = new URL("https://access.line.me/oauth2/v2.1/authorize");
  authURL.searchParams.set("response_type", "code");
  authURL.searchParams.set("client_id", String(LINE_CHANNEL_ID)); // ← ใช้ .env
  authURL.searchParams.set("redirect_uri", LINE_REDIRECT_URI); // ← ใช้ .env
  authURL.searchParams.set("state", state);
  authURL.searchParams.set("scope", LINE_SCOPES);
  authURL.searchParams.set("nonce", nonce);

  console.log("[LINE] env =", {
    LINE_CHANNEL_ID,
    LINE_REDIRECT_URI,
    LINE_SCOPES,
  });
  console.log("[LINE] redirect →", authURL.toString());

  return res.redirect(authURL.toString());
});

// Callback
router.get("/line/callback", async (req, res, next) => {
  const { code, state } = req.query;
  const stateCookie = req.cookies?.line_state;
  const nonceCookie = req.cookies?.line_nonce;

  try {
    if (!code || !state || state !== stateCookie) {
      const e = new Error("Invalid state");
      e.status = 400;
      throw e;
    }

    const tokenRes = await axios.post(
      "https://api.line.me/oauth2/v2.1/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: LINE_REDIRECT_URI,
        client_id: LINE_CHANNEL_ID,
        client_secret: LINE_CHANNEL_SECRET,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    const { access_token } = tokenRes.data;

    await axios.post(
      "https://api.line.me/oauth2/v2.1/verify",
      new URLSearchParams({
        id_token: tokenRes.data.id_token,
        client_id: LINE_CHANNEL_ID,
        nonce: nonceCookie || "",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const prof = await axios.get("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const lineUserId = prof.data.userId;
    const displayName = prof.data.displayName || null;
    const pictureUrl = prof.data.pictureUrl || null;

    const client = await pool.connect();
    let user_id, role;
    try {
      await client.query("BEGIN");
      const found = await client.query(
        "SELECT user_id, role FROM clinic.users WHERE line_id=$1",
        [lineUserId]
      );
      if (found.rowCount) {
        ({ user_id, role } = found.rows[0]);
        await client.query(
          "UPDATE clinic.users SET last_login_at=NOW() WHERE user_id=$1",
          [user_id]
        );
      } else {
        const ins = await client.query(
          "INSERT INTO clinic.users (line_id, role) VALUES ($1, $2) RETURNING user_id, role",
          [lineUserId, "user"]
        );
        ({ user_id, role } = ins.rows[0]);
        await client.query(
          "INSERT INTO clinic.user_details (user_id, first_name, profile_image) VALUES ($1,$2,$3)",
          [user_id, displayName, pictureUrl]
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    // หลังเซ็ต cookie userToken แล้ว
    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
    const dest = new URL(ROLE_HOME[role] || "/", FRONTEND_URL).toString();
    return res.redirect(dest);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
