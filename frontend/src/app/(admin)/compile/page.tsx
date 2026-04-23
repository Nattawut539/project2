'use client';

import Link from 'next/link';
import Cookies from 'js-cookie';
import { useEffect, useMemo, useState } from 'react';
import styles from './compile.module.css';
import { API_BASE } from '@/lib/api';
import Sidebar from '../components/Sidebar';

import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    ArcElement,
    BarElement,
    Tooltip,
    Legend
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    ArcElement,
    BarElement,
    Tooltip,
    Legend
);

/* ===================== Interfaces ===================== */
interface CategorySummary { category: string; total: number; }
interface WeeklyUsage { week_no: number; total: number; }
interface LikesSummary { likes: number; dislikes: number; }
interface DailyScore {
    day: string;
    avg_score: string;
    total: string;
    name: string;
    comment: string;
}
interface AgeGroup { label: string; percent: number; }

/* ===================== Utils ===================== */
const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
    'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
    'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const getAgeColor = (index: number) => {
    const colors = ['#0B0B45', '#2F6BA2', '#74B9F7', '#B2D4F3'];
    return colors[index % colors.length];
};

const safeNumber = (v: any, fallback = 0) => {
    const n = typeof v === 'string' ? Number(v) : v;
    return Number.isFinite(n) ? n : fallback;
};

/**
 * อ่าน response แบบปลอดภัย:
 * - เช็ค res.ok
 * - เช็ค content-type
 * - กันกรณี server ส่ง HTML กลับมา (เช่น 404 page)
 */
async function safeJson<T>(res: Response, errorLabel: string): Promise<T> {
    const contentType = res.headers.get('content-type') || '';

    if (!res.ok) {
        // พยายามอ่าน body เพื่อ debug แต่ไม่ทำให้พัง
        const text = await res.text().catch(() => '');
        throw new Error(`${errorLabel} (HTTP ${res.status}) ${text?.slice(0, 120) || ''}`);
    }

    if (!contentType.includes('application/json')) {
        const text = await res.text().catch(() => '');
        throw new Error(`${errorLabel}: response ไม่ใช่ JSON (${contentType}) ${text?.slice(0, 120) || ''}`);
    }

    return res.json() as Promise<T>;
}

function toArray<T>(v: any): T[] {
    return Array.isArray(v) ? v : [];
}

/* ===================== Component ===================== */
export default function PatientDashboard() {
    const today = useMemo(() => new Date(), []);

    /* ---------- Auth ---------- */
    const token = Cookies.get('adminToken');
    const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

    /* ---------- State ---------- */
    const [admin, setAdmin] = useState({ first_name: '', last_name: '', profile_image: '' });

    const [categoryData, setCategoryData] = useState<CategorySummary[]>([]);
    const [weeklyUsage, setWeeklyUsage] = useState<WeeklyUsage[]>([]);
    const [likesDislikes, setLikesDislikes] = useState<LikesSummary>({ likes: 0, dislikes: 0 });
    const [dailyScores, setDailyScores] = useState<DailyScore[]>([]);
    const [ageData, setAgeData] = useState<AgeGroup[]>([]);

    const [categoryViewMonth, setCategoryViewMonth] = useState(today.getMonth());
    const [weeklyViewMonth, setWeeklyViewMonth] = useState(today.getMonth());
    const [likesViewMonth, setLikesViewMonth] = useState(today.getMonth());
    const [scoreViewMonth, setScoreViewMonth] = useState(today.getMonth());
    const [currentYear, setCurrentYear] = useState(today.getFullYear());

    const [selectedFeedback, setSelectedFeedback] = useState<DailyScore | null>(null);

    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string>('');

    /* ===================== Month Controls ===================== */
    const prevMonth = (set: any) => set((m: number) => (m - 1 + 12) % 12);
    const nextMonth = (set: any) => set((m: number) => (m + 1) % 12);

    /* ===================== Fetch Admin ===================== */
    useEffect(() => {
        if (!token) return;

        const run = async () => {
            try {
                setErrorMsg('');
                const res = await fetch(`${API_BASE}/users/me`, { headers, cache: 'no-store' });
                const data = await safeJson<any>(res, 'โหลดข้อมูลแอดมินล้มเหลว');
                setAdmin(data);
            } catch (err: any) {
                console.error(err);
                // ไม่ให้ล้มทั้งหน้า แค่เก็บ error
                setErrorMsg(err?.message || 'โหลดข้อมูลแอดมินล้มเหลว');
            }
        };

        run();
    }, [token, headers]);

    /* ===================== Fetch Dashboard ===================== */
    useEffect(() => {
        if (!token) return;

        const loadAll = async () => {
            try {
                const [
                    catRes,
                    dailyRes,
                    likeRes,
                    scoreRes
                ] = await Promise.all([
                    fetch(`${API_BASE}/feedbacks/summary/category?year=${currentYear}&month=${categoryViewMonth + 1}`, { headers }),
                    fetch(`${API_BASE}/feedbacks/summary/daily?year=${currentYear}&month=${weeklyViewMonth + 1}`, { headers }),
                    fetch(`${API_BASE}/feedbacks/summary/like-dislike?year=${currentYear}&month=${likesViewMonth + 1}`, { headers }),
                    fetch(`${API_BASE}/feedbacks/summary/score?year=${currentYear}&month=${scoreViewMonth + 1}`, { headers })
                ]);

                const catJson = await catRes.json();
                const dailyJson = await dailyRes.json();
                const likeJson = await likeRes.json();
                const scoreJson = await scoreRes.json();

                setCategoryData(catJson.data ?? []);
                setWeeklyUsage(dailyJson.data ?? []);
                setLikesDislikes(likeJson);
                setDailyScores(scoreJson.empty ? [] : [scoreJson]);

            } catch (err) {
                console.error("โหลด dashboard ล้มเหลว", err);
            }
        };

        loadAll();
    }, [
        categoryViewMonth,
        weeklyViewMonth,
        likesViewMonth,
        scoreViewMonth,
        currentYear
    ]);


    /* ===================== Charts ===================== */
    const categoryChartData = useMemo(() => ({
        labels: categoryData.map(i => i.category),
        datasets: [{
            label: 'จำนวน',
            data: categoryData.map(i => safeNumber(i.total)),
            backgroundColor: '#7BAAF7',
            borderRadius: 10,
            barThickness: 40
        }]
    }), [categoryData]);

    const weeklyLineData = useMemo(() => ({
        labels: weeklyUsage.map(w => `สัปดาห์ ${w.week_no}`),
        datasets: [{
            label: 'ผู้ใช้',
            data: weeklyUsage.map(w => safeNumber(w.total)),
            borderColor: '#2f86a5',
            fill: false
        }]
    }), [weeklyUsage]);

    const likeDonutData = useMemo(() => ({
        labels: ['Like', 'Dislike'],
        datasets: [{
            data: [safeNumber(likesDislikes.likes), safeNumber(likesDislikes.dislikes)],
            backgroundColor: ['#64b5f6', '#1a237e']
        }]
    }), [likesDislikes]);

    /* ===================== UI ===================== */
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
                            style={{ cursor: 'pointer' }}
                        />
                    </Link>
                    <span className={styles.brand}>ค่าเฉลี่ยการให้คะแนนของผู้ใช้งาน</span>
                </div>
            </header>

            <div className={styles.wrapper}>
                <Sidebar />
                <section className={styles.dashboard}>
                    {/* แจ้งสถานะโหลด/error แบบไม่พัง UI */}
                    {loading && (
                        <div style={{ padding: 16 }}>กำลังโหลดข้อมูล...</div>
                    )}
                    {!loading && errorMsg && (
                        <div style={{ padding: 16, color: 'crimson' }}>
                            {errorMsg}
                        </div>
                    )}

                    {/* ======== ตัวอย่าง: ใช้ month controls ที่คุณมี ======== */}
                    <div className={styles.mainGrid}>
                        <div className={styles.graphsLeft}>
                            {/* ประเภทคนไข้ */}
                            <div className={styles.chartCard}>
                                <div className={styles.chartHeader}>
                                    <h4>ประเภทคนไข้</h4>
                                    <div className={styles.navMonth}>
                                        <button onClick={() => prevMonth(setCategoryViewMonth)}>&lt;</button>
                                        <span>{thaiMonths[categoryViewMonth]}</span>
                                        <button onClick={() => nextMonth(setCategoryViewMonth)}>&gt;</button>
                                    </div>
                                </div>

                                <Bar data={categoryChartData} />
                            </div>

                            {/* แนวโน้มการใช้บริการ */}
                            <div className={styles.chartCard}>
                                <div className={styles.chartHeader}>
                                    <h4>แนวโน้มการใช้บริการ</h4>
                                    <div className={styles.navMonth}>
                                        <button onClick={() => prevMonth(setWeeklyViewMonth)}>&lt;</button>
                                        <span>{thaiMonths[weeklyViewMonth]}</span>
                                        <button onClick={() => nextMonth(setWeeklyViewMonth)}>&gt;</button>
                                    </div>
                                </div>

                                <Line data={weeklyLineData} />
                            </div>

                            {/* ข้อมูลประชากร */}
                            <div className={styles.chartCard}>
                                <div className={styles.chartHeader}>
                                    <h4>ข้อมูลประชากรของลูกค้า</h4>
                                </div>

                                <div className={styles.ageList}>
                                    {ageData.map((group, index) => (
                                        <div className={styles.ageRow} key={`${group.label}-${index}`}>
                                            <div className={styles.colorBox} style={{ backgroundColor: getAgeColor(index) }} />
                                            <span>{group.label}</span>
                                            <strong>{safeNumber(group.percent).toFixed(0)}%</strong>
                                        </div>
                                    ))}
                                    {ageData.length === 0 && <div>ไม่มีข้อมูลในเดือนนี้</div>}
                                </div>
                            </div>
                        </div>

                        <div className={styles.graphRight}>
                            {/* Like / Dislike */}
                            <div className={styles.chartCard}>
                                <div className={styles.chartHeader}>
                                    <h4>กดชอบ / ไม่ชอบ</h4>
                                    <div className={styles.navMonth}>
                                        <button onClick={() => prevMonth(setLikesViewMonth)}>&lt;</button>
                                        <span>{thaiMonths[likesViewMonth]}</span>
                                        <button onClick={() => nextMonth(setLikesViewMonth)}>&gt;</button>
                                    </div>
                                </div>

                                <div className={styles.doughnutWrapper}>
                                    <div className={styles.doughnutChart}>
                                        <Doughnut data={likeDonutData} options={{ cutout: '70%', plugins: { legend: { display: false } } }} />
                                    </div>

                                    <div className={styles.doughnutLabels}>
                                        <div className={styles.doughnutLabelRow}>
                                            <span className={styles.legendBox} style={{ background: '#64b5f6' }} />
                                            <span>Like</span>
                                        </div>
                                        <div className={styles.doughnutLabelRow}>
                                            <span className={styles.legendBox} style={{ background: '#1a237e' }} />
                                            <span>Dislike</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* คะแนนความพึงพอใจ (การ์ด + popup) */}
                            <div className={styles.chartCard}>
                                <div className={styles.chartHeader}>
                                    <h4 className={styles.chartTitle}>คะแนนความพึงพอใจ</h4>
                                    <div className={styles.navMonth}>
                                        <button onClick={() => prevMonth(setScoreViewMonth)}>&lt;</button>
                                        <span>{thaiMonths[scoreViewMonth]}</span>
                                        <button onClick={() => nextMonth(setScoreViewMonth)}>&gt;</button>
                                    </div>
                                </div>

                                {dailyScores.length > 0 ? (
                                    dailyScores.map((item, idx) => (
                                        <div key={idx} className={styles.card}>
                                            <div className={styles.name}>{item.name}</div>

                                            <div className={styles.stars}>
                                                {Array.from({ length: 5 }).map((_, i) => (
                                                    <span
                                                        key={i}
                                                        className={
                                                            safeNumber(item.avg_score) >= i + 1
                                                                ? styles.filled
                                                                : safeNumber(item.avg_score) >= i + 0.5
                                                                    ? styles.half
                                                                    : styles.empty
                                                        }
                                                    >
                                                        ★
                                                    </span>
                                                ))}
                                            </div>

                                            <button
                                                className={styles.detailButton}
                                                onClick={() => setSelectedFeedback(item)}
                                            >
                                                เพิ่มเติม
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div>ไม่มีข้อมูลในเดือนนี้</div>
                                )}

                                {selectedFeedback && (
                                    <div className={styles.blurOverlay}>
                                        <div className={styles.popupCard}>
                                            <h2 className={styles.popupTitle}>
                                                คะแนนความพึงพอใจของลูกค้าโดยเฉลี่ยตามแบบสำรวจหรือความคิดเห็น
                                            </h2>
                                            <button
                                                className={styles.closeButton}
                                                onClick={() => setSelectedFeedback(null)}
                                            >
                                                ✕
                                            </button>
                                            <p>{selectedFeedback.comment}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                </section>
            </div>
        </div>
    );
}
