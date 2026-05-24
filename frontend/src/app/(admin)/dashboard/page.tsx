'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Cookies from 'js-cookie';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import Swal from 'sweetalert2';
import styles from './Dashboard.module.css';
import { API_BASE } from '@/lib/api';
import Sidebar from '../components/Sidebar';

dayjs.locale('th');

type QueueTicket = {
    queue_id: number;
    queue_number: string;
    prefix: string;
    numeric_no: number;
    service_date: string;
    avaliable_date: 'morning' | 'afternoon';
    source: string;
    appointment_id: number | null;
    user_id: number | null;
    service_type: string | null;
    status: string;
};

type PatientDetail = {
    user_id: number;
    patient_code?: string;
    first_name?: string;
    last_name?: string;
    dob?: string;
    birth_date?: string;
    gender?: string;
    blood_type?: string;
    phone?: string;
    congenital_disease?: string;
    drug_allergy?: string;
    food_allergy?: string;
};

type Measurement = {
    measurement_id: number;
    queue_number: string;
    weight: number | null;
    height: number | null;
    bmi: number | null;
    created_at: string;
};

type ApprovedAppointment = {
    appointment_id: number;
    service_date: string;
    hour_of_day: number;
    status: string;
    user_id: number;
    first_name?: string;
    last_name?: string;
};

type CalendarSlot = {
    service_date: string;
    avaliable_date: 'morning' | 'afternoon';
    hour_of_day: number;
    status: 'open' | 'locked' | 'closed';
    is_empty?: boolean;
    is_bookable?: boolean;
};

const API = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;

function getToken() {
    return (
        Cookies.get('adminToken') ||
        Cookies.get('staffToken') ||
        Cookies.get('token') ||
        ''
    );
}

function authHeaders() {
    const token = getToken();

    return {
        Authorization: `Bearer ${token}`,
    };
}

function jsonHeaders() {
    const token = getToken();

    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
    };
}

function thaiToday() {
    const now = dayjs();
    return `${now.format('DD / MM')} / ${now.year() + 543}`;
}

function getQueueTime(queue?: QueueTicket | null) {
    if (!queue) return '-';

    if (queue.avaliable_date === 'morning') {
        return '07:00 น. - 11:00 น.';
    }

    if (queue.avaliable_date === 'afternoon') {
        return '16:00 น. - 20:00 น.';
    }

    return '-';
}

function formatBirthDate(date?: string) {
    if (!date) return 'XX / XX / XXXX';

    const d = dayjs(date);
    if (!d.isValid()) return 'XX / XX / XXXX';

    return d.format('DD / MM / YYYY');
}

function formatMeasurement(value?: number | null, unit?: string) {
    if (value === null || value === undefined) return 'ยังไม่มีข้อมูล';
    return unit ? `${value} ${unit}` : String(value);
}

export default function DashboardPage() {
    const [loading, setLoading] = useState(true);

    const [queues, setQueues] = useState<QueueTicket[]>([]);
    const [selectedQueue, setSelectedQueue] = useState<QueueTicket | null>(null);
    const [patient, setPatient] = useState<PatientDetail | null>(null);
    const [latestMeasurement, setLatestMeasurement] = useState<Measurement | null>(null);

    const [appointments, setAppointments] = useState<ApprovedAppointment[]>([]);
    const [calendarSlots, setCalendarSlots] = useState<CalendarSlot[]>([]);
    const [calendarMonth, setCalendarMonth] = useState(dayjs());

    const [symptoms, setSymptoms] = useState('');

    const morningQueues = useMemo(() => {
        return queues.filter((q) => q.avaliable_date === 'morning');
    }, [queues]);

    const afternoonQueues = useMemo(() => {
        return queues.filter((q) => q.avaliable_date === 'afternoon');
    }, [queues]);

    const calendarDays = useMemo(() => {
        const start = calendarMonth.startOf('month').startOf('week');
        return Array.from({ length: 35 }, (_, index) => start.add(index, 'day'));
    }, [calendarMonth]);

    const slotStatusByDate = useMemo(() => {
        const map = new Map<string, 'full' | 'available' | 'closed' | 'normal'>();

        calendarSlots.forEach((slot) => {
            const key = dayjs(slot.service_date).format('YYYY-MM-DD');
            const old = map.get(key);

            if (slot.status === 'closed' || slot.status === 'locked') {
                if (!old) map.set(key, 'closed');
                return;
            }

            if (slot.is_bookable || slot.status === 'open') {
                map.set(key, 'available');
            }
        });

        appointments.forEach((item) => {
            const key = dayjs(item.service_date).format('YYYY-MM-DD');
            if (!map.has(key)) map.set(key, 'full');
        });

        return map;
    }, [calendarSlots, appointments]);

    const fetchQueuesToday = async () => {
        try {
            const res = await fetch(`${API}/today`, {
                headers: authHeaders(),
            });

            if (!res.ok) {
                throw new Error('โหลดคิววันนี้ไม่สำเร็จ');
            }

            const data: QueueTicket[] = await res.json();
            setQueues(data);

            if (data.length > 0) {
                setSelectedQueue((prev) => prev || data[0]);
            } else {
                setSelectedQueue(null);
            }
        } catch (error) {
            console.error('fetchQueuesToday:', error);

            Swal.fire({
                icon: 'error',
                title: 'โหลดคิววันนี้ไม่สำเร็จ',
                text: 'ตรวจสอบ route /api/today และ token ของ admin',
            });
        }
    };

    const fetchPatientDetail = async (userId?: number | null) => {
        if (!userId) {
            setPatient(null);
            return;
        }

        try {
            const res = await fetch(`${API}/patients/${userId}`, {
                headers: authHeaders(),
            });

            if (!res.ok) {
                throw new Error('โหลดข้อมูลผู้ป่วยไม่สำเร็จ');
            }

            const data: PatientDetail = await res.json();
            setPatient(data);
        } catch (error) {
            console.error('fetchPatientDetail:', error);
            setPatient(null);
        }
    };

    const fetchLatestMeasurement = async (queueNumber?: string | null) => {
        if (!queueNumber) {
            setLatestMeasurement(null);
            return;
        }

        try {
            const res = await fetch(`${API}/${queueNumber}`, {
                headers: authHeaders(),
            });

            if (!res.ok) {
                throw new Error('โหลดค่าน้ำหนัก/ส่วนสูงไม่สำเร็จ');
            }

            const data: Measurement[] = await res.json();

            if (data.length > 0) {
                setLatestMeasurement(data[0]);
            } else {
                setLatestMeasurement(null);
            }
        } catch (error) {
            console.error('fetchLatestMeasurement:', error);
            setLatestMeasurement(null);
        }
    };

    const fetchApprovedAppointments = async () => {
        const start = calendarMonth.startOf('month').format('YYYY-MM-DD');
        const end = calendarMonth.endOf('month').format('YYYY-MM-DD');

        try {
            const res = await fetch(
                `${API}/appointments/approved-week?start=${start}&end=${end}`,
                {
                    headers: authHeaders(),
                }
            );

            if (!res.ok) {
                throw new Error('โหลดตารางการจองไม่สำเร็จ');
            }

            const data: ApprovedAppointment[] = await res.json();
            setAppointments(data);
        } catch (error) {
            console.error('fetchApprovedAppointments:', error);
            setAppointments([]);
        }
    };

    const fetchCalendarMonth = async () => {
        try {
            const year = calendarMonth.year();
            const month = calendarMonth.month() + 1;

            const res = await fetch(`${API}/calendar/month?year=${year}&month=${month}`);

            if (!res.ok) {
                throw new Error('โหลดปฏิทินรายเดือนไม่สำเร็จ');
            }

            const data: CalendarSlot[] = await res.json();
            setCalendarSlots(data);
        } catch (error) {
            console.error('fetchCalendarMonth:', error);
            setCalendarSlots([]);
        }
    };

    const callQueue = async () => {
        if (!selectedQueue) return;

        try {
            const res = await fetch(`${API}/${selectedQueue.queue_id}/call`, {
                method: 'POST',
                headers: jsonHeaders(),
                body: JSON.stringify({}),
            });

            if (!res.ok) {
                throw new Error('เรียกคิวไม่สำเร็จ');
            }

            Swal.fire({
                icon: 'success',
                title: `เรียกคิว ${selectedQueue.queue_number}`,
                timer: 1200,
                showConfirmButton: false,
            });

            await fetchQueuesToday();
        } catch (error: any) {
            Swal.fire({
                icon: 'error',
                title: 'เรียกคิวไม่สำเร็จ',
                text: error.message || 'เกิดข้อผิดพลาด',
            });
        }
    };

    const saveMedical = async () => {
        if (!selectedQueue) {
            Swal.fire({
                icon: 'warning',
                title: 'กรุณาเลือกคิวก่อน',
            });
            return;
        }

        if (!patient?.user_id) {
            Swal.fire({
                icon: 'warning',
                title: 'ไม่พบข้อมูลผู้ป่วย',
                text: 'คิวนี้อาจเป็น walk-in ที่ยังไม่ได้ผูกกับผู้ป่วย',
            });
            return;
        }

        try {
            const res = await fetch(`${API}/medical`, {
                method: 'POST',
                headers: jsonHeaders(),
                body: JSON.stringify({
                    user_id: patient.user_id,
                    symptoms: symptoms || null,
                    diagnosis: null,
                    treatment: null,
                    medications: [],
                    notes: `บันทึกจากหน้า Dashboard หมายเลขคิว ${selectedQueue.queue_number}
น้ำหนัก: ${latestMeasurement?.weight ?? '-'} กก.
ส่วนสูง: ${latestMeasurement?.height ?? '-'} ซม.
BMI: ${latestMeasurement?.bmi ?? '-'}`,
                    visibility: 'private',
                }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error(err?.message || 'บันทึกอาการไม่สำเร็จ');
            }

            Swal.fire({
                icon: 'success',
                title: 'บันทึกข้อมูลสำเร็จ',
                timer: 1300,
                showConfirmButton: false,
            });

            setSymptoms('');
        } catch (error: any) {
            Swal.fire({
                icon: 'error',
                title: 'บันทึกไม่สำเร็จ',
                text: error.message || 'เกิดข้อผิดพลาด',
            });
        }
    };

    useEffect(() => {
        const init = async () => {
            setLoading(true);

            await Promise.all([
                fetchQueuesToday(),
                fetchApprovedAppointments(),
                fetchCalendarMonth(),
            ]);

            setLoading(false);
        };

        init();
    }, []);

    useEffect(() => {
        fetchApprovedAppointments();
        fetchCalendarMonth();
    }, [calendarMonth]);

    useEffect(() => {
        if (selectedQueue) {
            fetchPatientDetail(selectedQueue.user_id);
            fetchLatestMeasurement(selectedQueue.queue_number);
            setSymptoms('');
        } else {
            setPatient(null);
            setLatestMeasurement(null);
            setSymptoms('');
        }
    }, [selectedQueue]);

    // if (loading) {
    //     return <div className={styles.loaderWrapper}></div>;
    // }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.leftHeader}>
                    <img
                        src="/img/profileclinic.png"
                        alt="logo"
                        className={styles.logoIcon}
                        width={60}
                        height={60}
                    />
                    <span className={styles.brand}>คลินิกหมอปิยะพันธ์</span>
                </div>
            </header>

            <div className={styles.wrapper}>
                <Sidebar />

                <section className={styles.main}>
                    <div className={styles.dashboardLayout}>
                        <div className={styles.leftDashboard}>
                            <div className={styles.allPatientsSection}>
                               <h2> คิววันนี้ ({thaiToday()})</h2>
                            </div>

                            <div className={styles.queueGroup}>
                                <h3>ช่วงเช้า</h3>

                                <div className={styles.queueGrid}>
                                    {morningQueues.length > 0 ? (
                                        morningQueues.map((queue) => (
                                            <button
                                                key={queue.queue_id}
                                                className={`${styles.queueCard} ${selectedQueue?.queue_id === queue.queue_id
                                                        ? styles.queueCardActive
                                                        : ''
                                                    }`}
                                                onClick={() => setSelectedQueue(queue)}
                                            >
                                                <span>{queue.queue_number}</span>
                                                <small>{getQueueTime(queue)}</small>
                                            </button>
                                        ))
                                    ) : (
                                        <p className={styles.emptyText}>ไม่มีคิวในช่วงเช้า</p>
                                    )}
                                </div>
                            </div>

                            <div className={styles.queueGroup}>
                                <h3>ช่วงบ่าย</h3>

                                <div className={styles.queueGrid}>
                                    {afternoonQueues.length > 0 ? (
                                        afternoonQueues.map((queue) => (
                                            <button
                                                key={queue.queue_id}
                                                className={`${styles.queueCard} ${selectedQueue?.queue_id === queue.queue_id
                                                        ? styles.queueCardActive
                                                        : ''
                                                    }`}
                                                onClick={() => setSelectedQueue(queue)}
                                            >
                                                <span>{queue.queue_number}</span>
                                                <small>{getQueueTime(queue)}</small>
                                            </button>
                                        ))
                                    ) : (
                                        <p className={styles.emptyText}>ไม่มีคิวในช่วงบ่าย</p>
                                    )}
                                </div>
                            </div>

                            <div className={styles.blackLine}></div>

                            <div className={styles.patientCard}>
                                <h2>หมายเลขคิวลำดับที่</h2>

                                <div className={styles.bigQueue}>
                                    {selectedQueue?.queue_number || '-'}
                                </div>

                                <p className={styles.timeText}>
                                    {getQueueTime(selectedQueue)}
                                </p>

                                <div className={styles.whiteLine}></div>

                                <div className={styles.patientGrid}>
                                    <p>
                                        ชื่อ : <span>{patient?.first_name || 'XXXXXXX'}</span>
                                    </p>

                                    <p>
                                        นามสกุล : <span>{patient?.last_name || 'XXXXXXX'}</span>
                                    </p>

                                    <p>
                                        วันเดือนปีเกิด{' '}
                                        <span>{formatBirthDate(patient?.dob || patient?.birth_date)}</span>
                                    </p>

                                    <p>
                                        เพศ : <span>{patient?.gender || 'XX'}</span>
                                    </p>

                                    <p>
                                        กรุ๊ปเลือด : <span>{patient?.blood_type || '______'}</span>
                                    </p>

                                    <p>
                                        เบอร์ติดต่อ : <span>{patient?.phone || 'XXXXXXX'}</span>
                                    </p>

                                    <p>
                                        น้ำหนัก :{' '}
                                        <span>{formatMeasurement(latestMeasurement?.weight, 'กก.')}</span>
                                    </p>

                                    <p>
                                        ส่วนสูง :{' '}
                                        <span>{formatMeasurement(latestMeasurement?.height, 'ซม.')}</span>
                                    </p>

                                    <p>
                                        BMI : <span>{formatMeasurement(latestMeasurement?.bmi)}</span>
                                    </p>
                                </div>

                                <label className={styles.symptomLabel}>
                                    อาการข้างต้น :
                                </label>

                                <textarea
                                    className={styles.symptomBox}
                                    value={symptoms}
                                    onChange={(e) => setSymptoms(e.target.value)}
                                    placeholder="Text"
                                />

                                <div className={styles.buttonRow}>
                                    <button
                                        type="button"
                                        className={styles.orangeBtn}
                                        onClick={callQueue}
                                        disabled={!selectedQueue}
                                    >
                                        เรียก
                                    </button>

                                    <button
                                        type="button"
                                        className={styles.greenBtn}
                                        onClick={saveMedical}
                                        disabled={!selectedQueue}
                                    >
                                        บันทึก
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className={styles.rightDashboard}>
                            <div className={styles.allPatientsSection}>
                                <h2>ตารางการจอง</h2>
                            </div>

                            <div className={styles.calendarBox}>
                                <div className={styles.calendarTop}>
                                    <h2>
                                        {calendarMonth.format('MMMM')} {calendarMonth.year() + 543}
                                    </h2>

                                    <div className={styles.calendarButtons}>
                                        <button
                                            type="button"
                                            onClick={() => setCalendarMonth(calendarMonth.subtract(1, 'month'))}
                                        >
                                            ◀
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setCalendarMonth(calendarMonth.add(1, 'month'))}
                                        >
                                            ▶
                                        </button>
                                    </div>
                                </div>

                                <div className={styles.calendarGrid}>
                                    {calendarDays.map((day) => {
                                        const key = day.format('YYYY-MM-DD');
                                        const status = slotStatusByDate.get(key) || 'normal';
                                        const isThisMonth = day.month() === calendarMonth.month();

                                        return (
                                            <div
                                                key={key}
                                                className={`${styles.dayCell} ${!isThisMonth ? styles.dayMuted : ''
                                                    }`}
                                            >
                                                <span
                                                    className={`${styles.dayNumber} ${status === 'available' ? styles.dayAvailable : ''
                                                        } ${status === 'closed' ? styles.dayClosed : ''} ${status === 'full' ? styles.dayFull : ''
                                                        } ${day.isSame(dayjs(), 'day') ? styles.dayToday : ''
                                                        }`}
                                                >
                                                    {day.date()}
                                                </span>

                                                <small>{day.format('dd')}</small>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className={styles.appointmentMiniList}>
                                    {appointments.length > 0 ? (
                                        appointments.slice(0, 5).map((item) => (
                                            <div
                                                key={item.appointment_id}
                                                className={styles.appointmentMiniItem}
                                            >
                                                <span>{dayjs(item.service_date).format('DD/MM')}</span>
                                                <p>
                                                    {String(item.hour_of_day).padStart(2, '0')}:00 น. —{' '}
                                                    {item.first_name || '-'} {item.last_name || ''}
                                                </p>
                                            </div>
                                        ))
                                    ) : (
                                        <p className={styles.noAppointment}>
                                            ยังไม่มีรายการจองในเดือนนี้
                                        </p>
                                    )}
                                </div>
                            </div>

                            <button
                                type="button"
                                className={styles.holidayBtn}
                                onClick={() => {
                                    Swal.fire({
                                        icon: 'info',
                                        title: 'แก้ไขวันหยุด',
                                        text: 'ส่วนนี้สามารถเชื่อมไปหน้าจัดการวันหยุดได้ภายหลัง',
                                    });
                                }}
                            >
                                แก้ไขวันหยุด
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}