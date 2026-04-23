'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './Appointment.module.css';
import Cookies from 'js-cookie';
import Swal from 'sweetalert2';
import { API_BASE } from '@/lib/api';
import Sidebar from '../components/Sidebar';

/* ✅ โครงสร้างข้อมูลใหม่ (queue) */
interface Queue {
    queue_number: string;
    user_id: string;
    slot_date: string;
    slot_time: string;
    status: string;
    created_at: string;
}

export default function AppointmentPage() {
    const [appointments, setAppointments] = useState<Queue[]>([]);
    const [error, setError] = useState('');
    const [admin, setAdmin] = useState({
        first_name: '',
        last_name: '',
        profile_image: '',
    });

    /* ===============================
       โหลดข้อมูลคิว (แทน appointments)
    =============================== */
    const fetchQueue = async () => {
        try {
            const token = Cookies.get('adminToken');

            const res = await fetch(`${API_BASE}/queue`, {
                headers: { Authorization: `Bearer ${token}` },
                cache: 'no-store',
                credentials: 'include',
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text);
            }

            const data = await res.json();
            setAppointments(data);
        } catch (err) {
            console.error('โหลดคิวล้มเหลว:', err);
            setError('ไม่สามารถโหลดข้อมูลได้');
        }
    };

    /* ===============================
       โหลดข้อมูล admin (users/me)
    =============================== */
    useEffect(() => {
        const token = Cookies.get('adminToken');

        const fetchAll = async () => {
            try {
                if (token) {
                    const res = await fetch(`${API_BASE}/users/me`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });

                    if (!res.ok) {
                        const text = await res.text();
                        throw new Error(text);
                    }

                    setAdmin(await res.json());
                }

                await fetchQueue();
            } catch (err) {
                console.error('โหลดข้อมูลผิดพลาด:', err);
            }
        };

        fetchAll();
    }, []);

    /* ===============================
       อนุมัติคิว
    =============================== */
    const handleApprove = async (queue_number: string) => {
        const result = await Swal.fire({
            title: 'คุณแน่ใจหรือไม่?',
            text: 'คุณต้องการอนุมัติการจองคิวนี้หรือไม่',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'ยืนยัน',
            cancelButtonText: 'ไม่',
        });

        if (!result.isConfirmed) return;

        try {
            const token = Cookies.get('adminToken');

            const res = await fetch(`${API_BASE}/queue/${queue_number}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ status: 'approved' }),
            });

            if (!res.ok) throw new Error();

            Swal.fire({ icon: 'success', title: 'อนุมัติเรียบร้อย', timer: 1200 });
            setAppointments(prev =>
                prev.filter(q => q.queue_number !== queue_number)
            );
        } catch {
            Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด' });
        }
    };

    /* ===============================
       ไม่อนุมัติคิว
    =============================== */
    const handleReject = async (queue_number: string) => {
        const result = await Swal.fire({
            title: 'คุณแน่ใจหรือไม่',
            text: 'คุณต้องการไม่อนุมัติการจองคิวนี้หรือไม่',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'ยืนยัน',
            cancelButtonText: 'ไม่',
        });

        if (!result.isConfirmed) return;

        try {
            const token = Cookies.get('adminToken');

            const res = await fetch(`${API_BASE}/queue/${queue_number}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ status: 'cancelled' }),
            });

            if (!res.ok) throw new Error();

            Swal.fire({ icon: 'success', title: 'ยกเลิกแล้ว', timer: 1200 });
            setAppointments(prev =>
                prev.filter(q => q.queue_number !== queue_number)
            );
        } catch {
            Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด' });
        }
    };

    /* ===============================
       UI
    =============================== */
    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.leftHeader}>
                    <Link href="/dashboard">
                        <img
                            src="/img/profileclinic.png"
                            alt="logo"
                            className={styles.logoIcon}
                            width={40}
                            height={40}
                        />
                    </Link>
                    <span className={styles.brand}>จัดการการจองคิว</span>
                </div>
            </header>

            <div className={styles.wrapper}>
                <Sidebar />

                <section className={styles.contentArea}>

                    <div className={styles.allPatientsSection}>
                        <h2>รอการอนุมัติการจองคิว</h2>
                        {error && <p className={styles.error}>{error}</p>}
                        <table className={styles.appointmentTable}>
                            <thead>
                                <tr>
                                    <th>ดำเนินการ</th>
                                    <th>รหัสคนไข้</th>
                                    <th>วันที่นัด</th>
                                    <th>เวลา</th>
                                    <th>สถานะ</th>
                                    <th>วันที่สร้าง</th>
                                </tr>
                            </thead>
                            <tbody>
                                {appointments.length > 0 ? (
                                    appointments.map(item => (
                                        <tr key={item.queue_number}>
                                            <td>
                                                <button
                                                    className={styles.button}
                                                    onClick={() => handleApprove(item.queue_number)}
                                                >
                                                    อนุมัติ
                                                </button>
                                                <button
                                                    className={styles.buttondelete}
                                                    onClick={() => handleReject(item.queue_number)}
                                                >
                                                    ไม่อนุมัติ
                                                </button>
                                            </td>
                                            <td>{item.user_id}</td>
                                            <td>{item.slot_date}</td>
                                            <td>{item.slot_time}</td>
                                            <td>{item.status}</td>
                                            <td>{new Date(item.created_at).toLocaleString()}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} style={{ textAlign: 'center' }}>
                                            ไม่มีข้อมูล
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>
    );
}
