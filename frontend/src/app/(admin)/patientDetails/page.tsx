'use client';

import Link from 'next/link';
import Cookies from 'js-cookie';
import { useEffect, useState } from 'react';
import styles from './patientDetails.module.css';
import { usePathname } from 'next/navigation';
import Swal from 'sweetalert2';
import { API_BASE } from '@/lib/api';
import Sidebar from '../components/Sidebar';

/* ✅ โครงสร้างใหม่ (queue) */
interface Queue {
    queue_number: string;
    user_id: number;
    first_name: string;
    last_name: string;
    slot_date: string;
    slot_time: string;
    created_at: string;
    service_type : string;
    status: 'approved' | 'cancelled';
}

export default function PatientDetailsPage() {
    const [appointments, setAppointments] = useState<Queue[]>([]);
    const [error, setError] = useState('');
    const pathname = usePathname();

    const [admin, setAdmin] = useState({
        first_name: '',
        last_name: '',
        profile_image: '',
    });

    const [selectedAppointment, setSelectedAppointment] =
        useState<Queue | null>(null);

    /* ===============================
       ดึงคิว (approved / cancelled)
    =============================== */
    const fetchAppointments = async () => {
        const token = Cookies.get('adminToken');

        try {
            const res = await fetch(`${API_BASE}/queue`, {
                headers: { Authorization: `Bearer ${token}` },
                cache: 'no-store',
                credentials: 'include',
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text);
            }

            const data: Queue[] = await res.json();

            // ✅ กรองเฉพาะ approved / cancelled
            setAppointments(
                data.filter(
                    q => q.status === 'approved' || q.status === 'cancelled'
                )
            );
        } catch (err: any) {
            setError(err.message || 'เกิดข้อผิดพลาด');
        }
    };

    /* ===============================
       admin info (users/me)
    =============================== */
    useEffect(() => {
        const token = Cookies.get('adminToken');

        if (token) {
            fetch(`${API_BASE}/users/me`, {
                headers: { Authorization: `Bearer ${token}` },
            })
                .then(async res => {
                    if (!res.ok) {
                        const text = await res.text();
                        throw new Error(text);
                    }
                    return res.json();
                })
                .then(data => setAdmin(data))
                .catch(err => console.error('Failed to load admin info:', err));
        }

        fetchAppointments();
    }, [pathname]);

    /* ===============================
       modal
    =============================== */
    const handleMoreDetails = (appointment: Queue) => {
        setSelectedAppointment(appointment);
    };

    const closeModal = () => {
        setSelectedAppointment(null);
    };

    /* ===============================
       delete queue
    =============================== */
    const handleDelete = async (queue_number: string) => {
        const result = await Swal.fire({
            title: 'คุณแน่ใจหรือไม่?',
            text: 'คุณต้องการลบข้อมูลนี้จริงหรือไม่',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'ยืนยัน',
            cancelButtonText: 'ยกเลิก',
        });

        if (!result.isConfirmed) return;

        try {
            const token = Cookies.get('adminToken');
            const res = await fetch(`${API_BASE}/queue/${queue_number}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) throw new Error('ลบไม่สำเร็จ');

            Swal.fire({
                icon: 'success',
                title: 'ลบสำเร็จ',
                timer: 1200,
                showConfirmButton: false,
            });

            fetchAppointments();
        } catch {
            Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด' });
        }
    };

    /* ===============================
       table renderer (เหมือนเดิม)
    =============================== */
    const renderTable = (status: 'approved' | 'cancelled', title: string) => (
        <div className={styles.tableSection}>
            <h2 className={styles.heading}>{title}</h2>

            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>รหัสคนไข้</th>
                        <th>ชื่อ – นามสกุล</th>
                        <th>ข้อมูลเพิ่มเติม</th>
                        <th>ลบข้อมูล</th>
                    </tr>
                </thead>
                <tbody>
                    {appointments
                        .filter(a => a.status === status)
                        .map(item => (
                            <tr key={item.queue_number}>
                                <td>{item.user_id}</td>
                                <td>
                                    {item.first_name} {item.last_name}
                                </td>
                                <td>
                                    <button
                                        className={styles.addButton}
                                        onClick={() => handleMoreDetails(item)}
                                    >
                                        เพิ่มเติม
                                    </button>
                                </td>
                                <td>
                                    <button
                                        className={styles.deleteButton}
                                        onClick={() => handleDelete(item.queue_number)}
                                    >
                                        ลบ
                                    </button>
                                </td>
                            </tr>
                        ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className={styles.container}>
            {/* ===== Header (ไม่แตะ) ===== */}
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
                    <span className={styles.brand}>จัดการนัดหมาย</span>
                </div>
            </header>

            <div className={styles.wrapper}>
                <Sidebar />

                <section className={styles.contentArea}>
                    <div className={styles.allPatientsSection}>
                        <h1>รายการนัดหมายที่อนุมัติ / ไม่อนุมัติ</h1>

                        {error && <p className={styles.error}>{error}</p>}

                        {/* ❌ ไม่ใช้ container ซ้ำ */}
                        <div className={styles.row}>
                            {renderTable('approved', 'นัดหมายที่อนุมัติแล้ว')}
                            {renderTable('cancelled', 'นัดหมายที่ไม่อนุมัติ')}
                        </div>
                    </div>
                </section>
            </div>

            {/* ===== Modal ===== */}
            {selectedAppointment && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <h2 className={styles.modalTitle}>รายละเอียดการนัดหมาย</h2>

                        <table className={styles.detailTable}>
                            <tbody>
                                <tr>
                                    <th>รหัสคนไข้</th>
                                    <td>{selectedAppointment.user_id}</td>
                                </tr>
                                <tr>
                                    <th>ชื่อ–นามสกุล</th>
                                    <td>
                                        {selectedAppointment.first_name}{' '}
                                        {selectedAppointment.last_name}
                                    </td>
                                </tr>
                                <tr>
                                    <th>วันที่นัด</th>
                                    <td>
                                        {new Date(
                                            selectedAppointment.slot_date
                                        ).toLocaleString()}
                                    </td>
                                </tr>
                                <tr>
                                    <th>หัวข้อ</th>
                                    <td>{selectedAppointment.service_type}</td>
                                </tr>
                                <tr>
                                    <th>วันที่สร้าง</th>
                                    <td>
                                        {new Date(
                                            selectedAppointment.created_at
                                        ).toLocaleDateString()}
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        <button onClick={closeModal} className={styles.closeButton}>
                            ปิด
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}