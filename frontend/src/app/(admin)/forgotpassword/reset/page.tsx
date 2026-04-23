'use client';

import { useEffect, useState } from 'react';
import styles from '../forgotpassword.module.css';
import { useSearchParams, useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

export default function ResetPage() {
    const params = useSearchParams();
    const router = useRouter();
    const email = params.get('email') || '';
    const [pwd, setPwd] = useState('');
    const [pwd2, setPwd2] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // ต้องมี token ที่ได้จากขั้น verify
        const token = sessionStorage.getItem('pwdResetToken');
        if (!token || !email) {
            alert('การเข้าถึงไม่ถูกต้อง กรุณาทำรายการใหม่');
            router.replace('/forgotpassword');
        }
    }, [email, router]);

    async function handleReset(e: React.FormEvent) {
        e.preventDefault();
        if (pwd.length < 6) return alert('รหัสผ่านอย่างน้อย 6 ตัวอักษร');
        if (pwd !== pwd2) return alert('รหัสผ่านยืนยันไม่ตรงกัน');

        const token = sessionStorage.getItem('pwdResetToken');
        if (!token) return alert('หมดสิทธิ์รีเซ็ต กรุณาขอ OTP ใหม่');

        setLoading(true);
        try {
            const res = await fetch(`${API}/api/users/forgot-password/reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, new_password: pwd }),
            });
            const data = await res.json();
            if (!res.ok) return alert(data?.message || 'รีเซ็ตไม่สำเร็จ');

            sessionStorage.removeItem('pwdResetToken');
            alert('รีเซ็ตรหัสผ่านสำเร็จ');
            router.replace('/login');
        } catch (err: any) {
            alert(err.message || 'เกิดข้อผิดพลาด');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className={styles.container}>
            <form onSubmit={handleReset} className={styles.form}>
                <h1 className={styles.title}>ตั้งรหัสผ่านใหม่</h1>
                <p className={styles.message}>อีเมล: <b>{email}</b></p>
                <input
                    type="password"
                    placeholder="รหัสผ่านใหม่"
                    value={pwd}
                    onChange={(e) => setPwd(e.target.value)}
                    className={styles.input}
                    required
                />
                <input
                    type="password"
                    placeholder="ยืนยันรหัสผ่านใหม่"
                    value={pwd2}
                    onChange={(e) => setPwd2(e.target.value)}
                    className={styles.input}
                    required
                />
                <button type="submit" className={styles.button} disabled={loading}>
                    {loading ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่าน'}
                </button>
            </form>
        </div>
    );
}
