'use client';

import { useState } from 'react';
import styles from './forgotpassword.module.css';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return alert('กรุณากรอกอีเมล');
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/users/forgot-password/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.message || 'เกิดข้อผิดพลาด');
        return;
      }
      // ถ้าอีเมลอยู่ในระบบ → ไปหน้าใส่ OTP (พก email ไปด้วย)
      window.location.href = `/forgotpassword/verify?email=${encodeURIComponent(email)}`;
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <form onSubmit={handleRequest} className={styles.form}>
        <h1 className={styles.title}>ลืมรหัสผ่าน</h1>
        <input
          type="email"
          placeholder="อีเมลของคุณ"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={styles.input}
          required
        />
        <button type="submit" className={styles.button} disabled={loading}>
          {loading ? 'กำลังตรวจสอบ...' : 'ส่งลิงก์รีเซ็ตรหัสผ่าน'}
        </button>
        <Link href="/login" className={styles.backButton}>ย้อนกลับ</Link>
      </form>
    </div>
  );
}
