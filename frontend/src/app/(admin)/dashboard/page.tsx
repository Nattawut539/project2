'use client'

import { PropagateLoader } from 'react-spinners';
import Link from 'next/link';
import Cookies from 'js-cookie';
import React, { useEffect, useState } from 'react';
import styles from './Dashboard.module.css';
import { EllipsisVertical, Home, User, FileText, Calendar, HelpCircle, LogOut, Book, Menu, Icon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import weekday from 'dayjs/plugin/weekday';
import isoWeek from 'dayjs/plugin/isoWeek';
import dayjs from 'dayjs';
import { API_BASE } from '@/lib/api';
import Sidebar from '../components/Sidebar';



dayjs.extend(weekday);
dayjs.extend(isoWeek);

export default function dashboard() {
    const [isHovered, setIsHovered] = useState(false);
    const [admin, setAdmin] = useState({ first_name: '', last_name: '', profile_image: '' });
    const [loading, setLoading] = useState(true);
    const [date, setDate] = useState(dayjs());
    const currentMonth = date;
    const startDate = currentMonth.startOf('month').startOf('week');
    const days = Array.from({ length: 35 }, (_, i) => startDate.add(i, 'day'));
    const goToPrevMonth = () => setDate(date.subtract(1, 'month'));
    const goToNextMonth = () => setDate(date.add(1, 'month'));
    const [profile, setProfile] = useState(null);


    useEffect(() => {
        const token = Cookies.get("adminToken");
        console.log("token:", token); // ✅ ตรวจสอบว่า token มีจริงไหม

        const fetchAll = async () => {
            try {
                if (token) {
                    fetch(`${API_BASE}/me/profile`, {
                        headers: { Authorization: `Bearer ${token}` }
                    })
                        .then(async res => {
                            if (!res.ok) {
                                const err = await res.json();
                                throw new Error(`HTTP ${res.status} - ${JSON.stringify(err)}`);
                            }
                            return res.json();
                        })
                        .then(data => setAdmin(data))
                        .catch(err => console.error("Failed to load admin info:", err));
                }
            } finally {
                setTimeout(() => setLoading(false), 2000);
            }
        };
        fetchAll();
    }, []);

    if (loading) {
        return (
            <div className={styles.loaderWrapper}>
                {/* <PropagateLoader color="#0077b6" /> */}
            </div>
        );
    }


    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.leftHeader}>
                    <img src="/img/profileclinic.png" alt="logo" className={styles.logoIcon} width={40} height={40} />
                    {/* <Imag src={logo} alt="logo" className={styles.logoIcon} width={40} height={40} /> */}
                    <span className={styles.brand}>คลินิกหมอปิยะพันธ์</span>
                </div>
            </header>

            <div className={styles.wrapper}>
                <Sidebar />
                <section className={styles.main}>
                    <div className={styles.leftPanel}>
                        <div className={styles.titleRow}>
                            <h2 className={styles.sectionTitle}>
                                ตารางนัด
                                <span className={styles.inlineToggle}>
                                    <button className={`${styles.toggleBtnSmall} ${styles.active}`}>All</button>
                                    <button className={styles.pending}>Pending</button>
                                </span>
                            </h2>
                        </div>

                        <div className={styles.appointmentList}>
                            {[
                                {
                                    title: 'ตรวจโรคทั่วไป',
                                    date: 'Thursday, 13 February',
                                    color: styles.purpleIcon
                                },
                                {
                                    title: 'คนไข้เข้ามาปรึกษา',
                                    date: 'Friday, 14 February',
                                    color: styles.greenIcon
                                },
                                {
                                    title: 'นัดติดตามอาการ',
                                    date: 'Saturday, 15 February',
                                    color: styles.redIcon
                                }
                            ].map(({ title, date, color }, idx) => (
                                <div key={idx} className={styles.cardRowLight}>
                                    <div className={`${styles.icon} ${color}`}></div>
                                    <div className={styles.textGroup}>
                                        <div className={styles.cardTitle}>{title}</div>
                                    </div>
                                    <div className={styles.dateAndIcon}>
                                        <div className={styles.cardDate}>{date}</div>
                                        <div className={styles.iconRight}><EllipsisVertical size={20} color="#aab0c5" /></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className={styles.rightPanel}>
                        <div className={styles.calendarContainer}>
                            <div className={styles.calendarHeader}>
                                <h2 className={styles.monthText}>{currentMonth.format('MMMM YYYY')}</h2>
                                <div className={styles.navGroup}>
                                    <button onClick={goToPrevMonth} className={styles.calendarNavBtn}>◀</button>
                                    <button onClick={goToNextMonth} className={styles.calendarNavBtn}>▶</button>
                                </div>
                            </div>
                            <div className={styles.grid}>
                                {days.map((day) => (
                                    <div key={day.toString()} className={styles.dayCell}>
                                        <div className={styles.dateNumber}>{day.date()}</div>
                                        <div className={styles.dayName}>{day.format('ddd')}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}