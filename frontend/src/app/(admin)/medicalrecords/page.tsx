// 'use client'

// import { useState } from "react"
// import Sidebar from '../components/Sidebar'
// import styles from './Medicalrecords.module.css'
// import Link from 'next/link';
// import { error } from "console";

// export default function App() {
//     const [string, setString] = useState(0);

//     return (
//         <div className={styles.container}>
//             <header className={styles.header}>
//                 <div className={styles.leftHeader}>
//                     <Link href="/dashboard">
//                         <img src="/img/profileclinic.png" alt="logo" className={styles.logoIcon} width={40} height={40} />
//                     </Link>
//                     <span className={styles.brand}>รายชื่อผู้เข้ารับการบริการ</span>
//                 </div>

//                 <div className={styles.rightHeader}>
//                     <input
//                         type="text"
//                         // value={nationalId}
//                         // onChange={(e) => setNationalId(e.target.value)}
//                         // onKeyDown={(e) => {if (e.key === 'Enter') handleSmartSearch(); }}
//                         placeholder="กรอกเลขบัตรประชาชน หรือ รหัสผู้ใช้บริการ"
//                         className={styles.searchInput}
//                     />
//                     <button>ค้นหา</button>
//                 </div>
//             </header>

//             <div className={styles.wrapper}>
//                 <Sidebar />
//                 <section className={styles.contentArea}>
//                     {/* {} การแสดงข้อผิดพลาดและทำงานถูกต้อง */}

//                     <div className={styles.allPatientsSection}>
//                         <h2>รายชื่อผู้เข้ารับการบริการสัปดาร์ปัจจุบัน</h2>

//                         <div className={styles.tableScroll}>
//                             <table className={styles.patientTable}>
//                                 <thead>
//                                     <tr>
//                                         <th>รหัสผู้ป่วย</th>
//                                         <th>เลขบัตรประชาชน</th>
//                                         <th>ชื่อ - นามสกุล</th>
//                                         <th>ว / ด / ป ที่ทำการจอง</th>
//                                         <th>ช่วงเวลา</th>
//                                         <th>ลำดับคิว</th>
//                                         <th className={styles.conlAction}>เริ่มการวินิจฉัย</th>
//                                     </tr>
//                                 </thead>
//                             </table>
//                         </div>
//                     </div>
//                 </section>
//             </div>
//         </div>
//     );
// }



'use client';

import { useEffect, useMemo, useState } from "react";
import Sidebar from '../components/Sidebar';
import styles from './Medicalrecords.module.css';
import Link from 'next/link';
import Cookies from "js-cookie";

/**
 * ✅ เงื่อนไขหน้า:
 * - เข้าได้เฉพาะ role: doctor, superadmin
 * - แสดงเฉพาะ "สัปดาห์ปัจจุบัน" ที่ถูก admin อนุมัติแล้ว (approved)
 * - วันปัจจุบันเปิดตารางไว้, วันอื่นพับไว้ (คลิกเพื่อขยาย)
 * - ปุ่ม "เริ่มการวินิจฉัย" เป็นไอคอนสมุด (ลิงก์ไปหน้าอื่นไว้ก่อน)
 */

/** ปรับตาม backend คุณถ้าชื่อ role ต่างจากนี้ */

function decodeJwtPayload(token: string): any | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        // base64url -> base64
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);

        const json = decodeURIComponent(
            atob(padded)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );

        return JSON.parse(json);
    } catch {
        return null;
    }
}

function getRoleFromToken(): string {
    const token = Cookies.get('adminToken') || Cookies.get('staffToken') || Cookies.get('userToken') || '';
    if (!token) return '';

    const payload = decodeJwtPayload(token);
    const role = String(payload?.role || payload?.user_role || payload?.userRole || '').toLowerCase();
    return role;
}
const ALLOWED_ROLES = new Set(["doctor", "superadmin", "super_admin"]);

type VisitRow = {
    appointment_id: string | number;
    user_id?: string | number;

    patient_code?: string;     // รหัสผู้ป่วย
    national_id?: string;      // เลขบัตรประชาชน
    full_name?: string;        // ชื่อ-นามสกุล

    visit_date: string;        // YYYY-MM-DD (วันนัด/วันเข้ารับบริการ)
    time_label?: string;       // เช่น "08:30 น."
    queue_no?: string;         // เช่น "A001"

    /** ต้องเป็น approved เท่านั้น */
    status?: string;           // approved
};

/** แปลง date -> key YYYY-MM-DD */
function toDateKey(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
}

/** Monday-start week */
function getWeekRangeMonday(today = new Date()) {
    const d = new Date(today);
    d.setHours(0, 0, 0, 0);

    // JS: Sun=0 ... Sat=6
    const day = d.getDay();
    const diffToMonday = (day === 0 ? -6 : 1 - day);

    const start = new Date(d);
    start.setDate(d.getDate() + diffToMonday);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    return { start, end };
}

function formatThaiDayTitle(dateKey: string) {
    // แสดงแบบ “วันที่ 10 (ปัจจุบัน)” คล้ายรูป
    // ไม่พึ่งไลบรารีเพิ่ม ใช้ Intl
    const d = new Date(dateKey + "T00:00:00");
    const day = d.getDate();

    // สั้นๆตามรูป: "วันที่ 10"
    return `วันที่ ${day}`;
}



export default function MedicalRecordsListPage() {
    const [meRole, setMeRole] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(true);
    const [rows, setRows] = useState<VisitRow[]>([]);
    const [errorMsg, setErrorMsg] = useState<string>("");

    const [searchText, setSearchText] = useState<string>("");

    // วันไหนเปิดตารางอยู่บ้าง (accordion)
    const todayKey = useMemo(() => toDateKey(new Date()), []);
    const [openDays, setOpenDays] = useState<Record<string, boolean>>({ [todayKey]: true });

    // ===== 1) ตรวจ role (doctor/superadmin เท่านั้น) =====
    useEffect(() => {
        const run = async () => {
            try {
                setLoading(true);
                setErrorMsg("");

                // token อาจเป็น staffToken หรือ adminToken ตามระบบคุณ
                const token =
                    Cookies.get("adminToken") ||
                    Cookies.get("staffToken") ||
                    Cookies.get("token");

                if (!token) {
                    setErrorMsg("กรุณาเข้าสู่ระบบก่อน");
                    setLoading(false);
                    return;
                }

                // ✅ แก้ตรงนี้: ไม่เรียก /api/auth/me แล้ว (เพราะไม่มี endpoint)
                // อ่าน role จาก JWT payload แทน
                const decodeRoleFromJwt = (jwt: string) => {
                    try {
                        const parts = jwt.split(".");
                        if (parts.length !== 3) return "";

                        // base64url -> base64
                        const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
                        const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);

                        const payload = JSON.parse(atob(padded));

                        // รองรับหลายชื่อ field เผื่อ token ของคุณใช้คนละชื่อ
                        return String(
                            payload?.role ||
                            payload?.user_role ||
                            payload?.userRole ||
                            payload?.app_role ||
                            ""
                        ).toLowerCase();
                    } catch {
                        return "";
                    }
                };

                const role = decodeRoleFromJwt(token);

                if (!role) {
                    setErrorMsg("ไม่สามารถตรวจสอบสิทธิ์ผู้ใช้งานได้");
                    setLoading(false);
                    return;
                }

                setMeRole(role);

                if (!ALLOWED_ROLES.has(role)) {
                    setErrorMsg("หน้านี้เข้าดูได้เฉพาะแพทย์ และผู้ดูแลระบบสูงสุดเท่านั้น");
                    setLoading(false);
                    return;
                }

                // ===== 2) ดึงข้อมูลเฉพาะสัปดาห์ปัจจุบัน (approved เท่านั้น) =====
                const { start, end } = getWeekRangeMonday(new Date());
                const startKey = toDateKey(start);
                const endKey = toDateKey(end);

                const listRes = await fetch(
                    `http://localhost:5000/api/today`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                        cache: "no-store",
                    }
                );


                if (!listRes.ok) {
                    setErrorMsg("ดึงรายการผู้เข้ารับบริการไม่สำเร็จ");
                    setLoading(false);
                    return;
                }

                const listData = await listRes.json();

                /**
                 * เงื่อนไข:
                 * - prefix = 'A' (มาจากการนัดหมาย)
                 * - status !== 'cancelled'
                 */
                const filtered: VisitRow[] = listData.filter((q: any) => {
                    return q.prefix === "A" && q.status !== "cancelled";
                });

                setRows(filtered);


                // เปิดวันปัจจุบันอัตโนมัติ
                setOpenDays((prev) => ({ ...prev, [todayKey]: true }));

                setLoading(false);
            } catch (e) {
                setErrorMsg("เกิดข้อผิดพลาดในการโหลดข้อมูล");
                setLoading(false);
            }
        };

        run();
    }, [todayKey]);


    // ===== 3) จัดกลุ่มตามวัน (เฉพาะวันที่มีการจอง/อนุมัติแล้วเท่านั้น) =====
    const groupedByDay = useMemo(() => {
        const map = new Map<string, VisitRow[]>();

        for (const r of rows) {
            const key = r.visit_date;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(r);
        }

        // sort date asc
        const entries = Array.from(map.entries()).sort(([a], [b]) => (a > b ? 1 : -1));

        // sort time inside each day (ถ้า time_label เป็น HH:mm จะเรียงได้ดี)
        for (const [, arr] of entries) {
            arr.sort((x, y) => String(x.time_label || "").localeCompare(String(y.time_label || "")));
        }

        return entries; // [ [dateKey, rows[]], ... ]
    }, [rows]);

    // ===== 4) search filter (เลขบัตร หรือ รหัสผู้ป่วย) =====
    const filteredGrouped = useMemo(() => {
        const q = searchText.trim();
        if (!q) return groupedByDay;

        const qq = q.toLowerCase();

        return groupedByDay
            .map(([dayKey, arr]) => {
                const a = arr.filter((r) => {
                    const nid = String(r.national_id || "").toLowerCase();
                    const pcode = String(r.patient_code || "").toLowerCase();
                    return nid.includes(qq) || pcode.includes(qq);
                });
                return [dayKey, a] as [string, VisitRow[]];
            })
            .filter(([, arr]) => arr.length > 0);
    }, [groupedByDay, searchText]);

    const toggleDay = (dayKey: string) => {
        setOpenDays((prev) => ({ ...prev, [dayKey]: !prev[dayKey] }));
    };

    const isToday = (dayKey: string) => dayKey === todayKey;

    return (
        <div className={styles.container}>
            {/* ===== Header ===== */}
            <header className={styles.header}>
                <div className={styles.leftHeader}>
                    <Link href="/dashboard">
                        <img
                            src="/img/profileclinic.png"
                            alt="logo"
                            className={styles.logoIcon}
                            width={40}
                            height={40}
                            style={{ cursor: "pointer" }}
                        />
                    </Link>
                    <span className={styles.brand}>รายชื่อการเข้ารับการรักษา</span>
                </div>

                <div className={styles.rightHeader}>
                    <input
                        type="text"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        placeholder="กรอกเลขบัตรประชาชน หรือ รหัสผู้ป่วย"
                        className={styles.searchInput}
                    />
                    <button
                        className={styles.searchBtn}
                        onClick={() => {/* กดค้นหาไว้เฉยๆ เพราะ filter ทำงาน realtime แล้ว */ }}
                    >
                        ค้นหา
                    </button>
                </div>
            </header>

            <div className={styles.wrapper}>
                <Sidebar />

                <section className={styles.contentArea}>
                    <div className={styles.allPatientsSection}>
                        <h2>รายชื่อผู้เข้ารับบริการสัปดาห์ปัจจุบัน</h2>

                        {/* ===== state: loading / empty ===== */}
                        {loading && <div className={styles.hintText}>กำลังโหลดข้อมูล...</div>}

                        {!loading && !errorMsg && filteredGrouped.length === 0 && (
                            <div className={styles.emptyBox}>
                                ไม่มีรายการที่ถูกอนุมัติในสัปดาห์นี้
                            </div>
                        )}

                        {/* ===== accordion per day ===== */}
                        {!loading && !errorMsg && filteredGrouped.map(([dayKey, dayRows]) => {
                            const open = !!openDays[dayKey];
                            return (
                                <div key={dayKey} className={styles.daySection}>
                                    <button
                                        type="button"
                                        className={`${styles.dayHeader} ${open ? styles.dayHeaderOpen : ""}`}
                                        onClick={() => toggleDay(dayKey)}
                                    >
                                        <div className={styles.dayTitle}>
                                            {formatThaiDayTitle(dayKey)} {isToday(dayKey) ? <span className={styles.todayBadge}>(ปัจจุบัน)</span> : null}
                                        </div>

                                        <div className={styles.dayMeta}>
                                            <span className={styles.countChip}>{dayRows.length} รายการ</span>
                                            <span className={`${styles.chev} ${open ? styles.chevUp : ""}`}>▾</span>
                                        </div>
                                    </button>

                                    {open && (
                                        <div className={styles.dayBody}>
                                            <div className={styles.tableScroll}>
                                                <table className={styles.patientTable}>
                                                    <thead>
                                                        <tr>
                                                            <th>ลำดับ</th>
                                                            <th>รหัสผู้ป่วย</th>
                                                            <th>เลขบัตรประชาชน</th>
                                                            <th>ชื่อ - นามสกุล</th>
                                                            <th>ว / ด / ป</th>
                                                            <th>เวลา</th>
                                                            <th>ลำดับคิว</th>
                                                            <th className={styles.conlAction}>เริ่มการวินิจฉัย</th>
                                                        </tr>
                                                    </thead>

                                                    <tbody>
                                                        {dayRows.map((r, idx) => (
                                                            <tr key={String(r.appointment_id ?? `${dayKey}-${idx}`)}>
                                                                <td>{idx + 1}</td>
                                                                <td>{r.patient_code || "-"}</td>
                                                                <td>{r.national_id || "-"}</td>
                                                                <td>{r.full_name || "-"}</td>
                                                                <td>{r.visit_date}</td>
                                                                <td>{r.time_label || "-"}</td>
                                                                <td>{r.queue_no || "-"}</td>
                                                                <td>
                                                                    {/* ✅ ไอคอนสมุด + ลิงก์ (ไว้ทำทีหลัง) */}
                                                                    <Link
                                                                        href={`/medical/diagnose?appointment_id=${encodeURIComponent(String(r.appointment_id))}`}
                                                                        className={styles.bookIconBtn}
                                                                        title="เริ่มการวินิจฉัย"
                                                                    >
                                                                        📒
                                                                    </Link>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            </div>

            {/* ===== Popup error (ใช้คลาสเดิมใน CSS ที่มีอยู่แล้ว) ===== */}
            {!loading && errorMsg && (
                <div className={styles.popupOverlay}>
                    <div className={styles.popupBoxerror}>
                        <span className={styles.popupIcon}>⚠️</span>
                        {errorMsg}
                    </div>
                </div>
            )}
        </div>
    );
}
