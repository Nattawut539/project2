// routes/google.js
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
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  GOOGLE_SCOPES = "openid email profile",
  JWT_SECRET = "dev_secret_for_local",
} = process.env;

const rand = () => crypto.randomBytes(16).toString("hex");

// เริ่ม Google Login
router.get("/google/login", (req, res) => {
  if (
    !GOOGLE_CLIENT_ID ||
    /YOUR_GOOGLE_CLIENT_ID/i.test(String(GOOGLE_CLIENT_ID))
  ) {
    return res
      .status(500)
      .json({ error: "GOOGLE_CLIENT_ID is not set properly" });
  }
  if (!GOOGLE_REDIRECT_URI)
    return res.status(500).json({ error: "GOOGLE_REDIRECT_URI is not set" });

  const state = rand(),
    nonce = rand();
  res.cookie("gg_state", state, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 10 * 60 * 1000,
  });
  res.cookie("gg_nonce", nonce, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 10 * 60 * 1000,
  });

  const authURL = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authURL.searchParams.set("response_type", "code");
  authURL.searchParams.set("client_id", GOOGLE_CLIENT_ID); // ← ใช้ .env
  authURL.searchParams.set("redirect_uri", GOOGLE_REDIRECT_URI); // ← ใช้ .env
  authURL.searchParams.set("scope", GOOGLE_SCOPES);
  authURL.searchParams.set("state", state);
  authURL.searchParams.set("nonce", nonce);
  authURL.searchParams.set("access_type", "online");

  console.log("[GOOGLE] env =", {
    GOOGLE_CLIENT_ID,
    GOOGLE_REDIRECT_URI,
    GOOGLE_SCOPES,
  });
  console.log("[GOOGLE] redirect →", authURL.toString());

  return res.redirect(authURL.toString());
});

// Callback
router.get("/google/callback", async (req, res, next) => {
  const { code, state } = req.query;
  const stateCookie = req.cookies?.gg_state;

  try {
    if (!code || !state || state !== stateCookie) {
      const e = new Error("Invalid state");
      e.status = 400;
      throw e;
    }

    const tokenRes = await axios.post(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: GOOGLE_REDIRECT_URI,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    const { id_token } = tokenRes.data;

    const info = await axios.get("https://oauth2.googleapis.com/tokeninfo", {
      params: { id_token },
    });
    const googleUserId = info.data.sub;
    const email = info.data.email || null;
    const name = info.data.name || null;
    const picture = info.data.picture || null;

    const client = await pool.connect();
    let user_id, role;
    try {
      await client.query("BEGIN");
      const found = await client.query(
        "SELECT user_id, role FROM clinic.users WHERE google_id=$1",
        [googleUserId]
      );
      if (found.rowCount) {
        ({ user_id, role } = found.rows[0]);
        await client.query(
          "UPDATE clinic.users SET last_login_at=NOW() WHERE user_id=$1",
          [user_id]
        );
      } else {
        const ins = await client.query(
          "INSERT INTO clinic.users (google_id, role) VALUES ($1,$2) RETURNING user_id, role",
          [googleUserId, "user"]
        );
        ({ user_id, role } = ins.rows[0]);
        await client.query(
          "INSERT INTO clinic.user_details (user_id, first_name, profile_image, email) VALUES ($1,$2,$3,$4)",
          [user_id, name, picture, email]
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
