'use client';

import { useEffect, useState } from 'react';
import styles from '../forgotpassword.module.css';
import { useSearchParams, useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

export default function VerifyOtpPage() {
    const router = useRouter();
    const params = useSearchParams();
    const email = params.get('email') || '';
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!email) {
            alert('ไม่พบอีเมล กรุณาทำรายการใหม่');
            router.replace('/forgotpassword');
        }
    }, [email, router]);

    async function handleVerify(e: React.FormEvent) {
        e.preventDefault();
        if (!/^\d{6}$/.test(otp)) return alert('กรุณากรอก OTP 6 หลัก');

        setLoading(true);
        try {
            const res = await fetch(`${API}/api/users/forgot-password/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp }),
            });
            const data = await res.json();
            if (!res.ok) {
                alert(data?.message || 'OTP ไม่ถูกต้อง');
                return;
            }
            // เก็บ token ชั่วคราวใน sessionStorage (อย่าใส่ใน URL)
            sessionStorage.setItem('pwdResetToken', data.token);
            router.push(`/forgotpassword/reset?email=${encodeURIComponent(email)}`);
        } catch (err: any) {
            alert(err.message || 'เกิดข้อผิดพลาด');
        } finally {
            setLoading(false);
        }
    }

    async function resend() {
        // ขอ OTP ใหม่
        try {
            const res = await fetch(`${API}/api/users/forgot-password/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            if (!res.ok) return alert(data?.message || 'ส่ง OTP ไม่สำเร็จ');
            alert('ส่ง OTP ใหม่แล้ว');
        } catch (e: any) {
            alert(e.message || 'เกิดข้อผิดพลาด');
        }
    }

    return (
        <div className={styles.container}>
            <form onSubmit={handleVerify} className={styles.form}>
                <h1 className={styles.title}>ยืนยัน OTP</h1>
                <p className={styles.message}>เราได้ส่งรหัส OTP ไปที่ <b>{email}</b></p>
                <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="รหัส OTP 6 หลัก"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className={styles.input}
                    required
                />
                <button type="submit" className={styles.button} disabled={loading}>
                    {loading ? 'กำลังตรวจสอบ...' : 'ยืนยัน'}
                </button>
                <button type="button" className={styles.secondaryButton} onClick={resend}>
                    ส่ง OTP ใหม่
                </button>
            </form>
        </div>
    );
}
