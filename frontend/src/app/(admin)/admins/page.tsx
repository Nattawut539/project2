'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Cookies from 'js-cookie';
import { Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import styles from './admin.module.css';
import { API_BASE } from '@/lib/api';
import Sidebar from '../components/Sidebar';

function resolveImage(src?: string | null) {
    if (!src) return '/img/default-avatar.png';
    if (src.startsWith('http') || src.startsWith('data:') || src.startsWith('/img/')) return src;
    if (src.startsWith('/uploads') || src.startsWith('uploads')) {
        const clean = src.replace(/^\//, '');
        return `${API_BASE}/${clean}`;
    }
    return src;
}

interface Patient {
    user_id: number;
    profile_image: string | null;
    patient_code?: string;
    national_id: string;
    first_name: string;
    last_name: string;
    phone?: string;
    address?: string;
    dob?: string;
    nationality?: string;
    position: string;
    ethnicity?: string;
    occupation?: string;
    email?: string;
    admit_date?: string;
    gender?: string;
    blood_type?: string;
    emergency_phone?: string;
    congenital_disease?: string;
    drug_allergy?: string;
    food_allergy?: string;
    created_at?: string;
}

type Profile = {
    first_name: string;
    last_name: string;
    profile_image?: string | null;
};

type PatientFull = Patient & {
    nationality?: string;
    ethnicity?: string;
    occupation?: string;
    email?: string;
    admit_date?: string;
    allergy?: string;
};

function calcThaiAge(dobStr: string) {
    const birth = new Date(dobStr);
    if (isNaN(+birth)) return '-';

    const today = new Date();
    let y = today.getFullYear() - birth.getFullYear();
    let m = today.getMonth() - birth.getMonth();
    let d = today.getDate() - birth.getDate();

    if (d < 0) {
        m--;
        d += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    }
    if (m < 0) {
        y--;
        m += 12;
    }

    return `${y} ปี ${m} เดือน ${d} วัน`;
}

export default function PatientListPage() {
    const [nationalId, setNationalId] = useState('');
    const [allPatients, setAllPatients] = useState<Patient[]>([]);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showPopup, setShowPopup] = useState(false);
    const [viewOpen, setViewOpen] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState<PatientFull | null>(null);
    const [viewLoading, setViewLoading] = useState(false);

    const router = useRouter();

    function getAuthHeaders(): Headers {
        const token = Cookies.get('adminToken') || Cookies.get('userToken') || '';
        const headers = new Headers();
        headers.append('Content-Type', 'application/json');
        if (token) headers.append('Authorization', `Bearer ${token}`);
        return headers;
    }

    function normalizePatient(p: any): PatientFull {
        return {
            ...p,
            nationality: p.nationality ?? p.nationalit ?? '',
            ethnicity: p.ethnicity ?? p.ethnicit ?? '',
            occupation: p.occupation ?? p.position ?? '',
            email: p.email ?? p.emergency_email ?? '',
            admit_date: p.admit_date ?? p.created_at ?? '',
            allergy: p.allergy ?? p.drug_allergy ?? '',
        };
    }

    async function fetchAllPatients() {
        const res = await fetch(`${API_BASE}/patients`, {
            headers: getAuthHeaders(),
            cache: 'no-store',
            credentials: 'include',
        });

        if (!res.ok) {
            const msg = await res.text().catch(() => '');
            throw new Error(msg || 'ไม่สามารถดึงข้อมูลผู้ป่วยได้');
        }

        const data = await res.json();
        setAllPatients(Array.isArray(data) ? data : []);
    }

    async function fetchPatientFull(userId: number): Promise<PatientFull | null> {
        try {
            const r1 = await fetch(`${API_BASE}/patients/${userId}`, {
                headers: getAuthHeaders(),
                credentials: 'include',
                cache: 'no-store',
            });
            if (r1.ok) return normalizePatient(await r1.json());
        } catch { }

        try {
            const r2 = await fetch(`${API_BASE}/information?user_id=${userId}`, {
                headers: getAuthHeaders(),
                credentials: 'include',
                cache: 'no-store',
            });
            if (r2.ok) return normalizePatient(await r2.json());
        } catch { }

        return null;
    }

    const openView = async (p: Patient) => {
        setViewOpen(true);
        setViewLoading(true);
        setSelectedPatient(normalizePatient(p));

        const full = await fetchPatientFull(p.user_id);
        if (full) setSelectedPatient(full);

        setViewLoading(false);
    };

    const closeView = () => {
        setViewOpen(false);
        setSelectedPatient(null);
    };

    async function handleSmartSearch() {
        try {
            const raw = nationalId.trim();
            if (!raw) throw new Error('empty');

            if (/^\d{1,3}$/.test(raw)) {
                const code = raw.padStart(3, '0');
                const res = await fetch(`${API_BASE}/patients/code/${encodeURIComponent(code)}`, {
                    headers: getAuthHeaders(),
                    cache: 'no-store',
                    credentials: 'include',
                });

                if (!res.ok) throw new Error('notfound');
                const data = await res.json();
                router.push(`/information?user_id=${data.user_id}`);
                return;
            }

            const res = await fetch(`${API_BASE}/patients/national/${encodeURIComponent(raw)}`, {
                headers: getAuthHeaders(),
                cache: 'no-store',
                credentials: 'include',
            });

            if (!res.ok) throw new Error('notfound');
            const data = await res.json();
            router.push(`/information?user_id=${data.user_id}`);
        } catch {
            setShowPopup(true);
            setTimeout(() => setShowPopup(false), 2000);
        }
    }

    useEffect(() => {
        (async () => {
            try {
                setError('');

                const res = await fetch(`${API_BASE}/me/profile`, {
                    headers: getAuthHeaders(),
                    credentials: 'include',
                    cache: 'no-store',
                });

                if (res.ok) {
                    const data = await res.json();
                    setProfile({
                        first_name: data?.first_name || '',
                        last_name: data?.last_name || '',
                        profile_image: data?.profile_image || null,
                    });
                } else {
                    setProfile(null);
                }

                await fetchAllPatients();
            } catch (err) {
                console.error('โหลดข้อมูลล้มเหลว:', err);
                setProfile(null);
                setAllPatients([]);
                setError('โหลดข้อมูลผู้ป่วยไม่สำเร็จ');
            }
        })();
    }, []);

    return (
        <div className={styles.container}>
            {viewOpen && selectedPatient && (
                <div className={styles.overlay} onClick={closeView}>
                    <div className={styles.popup} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.popupHeader}>
                            <h3 className={styles.popupTitle}>ข้อมูลผู้ป่วย (ไม่สามารถแก้ไขได้)</h3>
                            <button className={styles.closeBtn} onClick={closeView} aria-label="ปิด">
                                ×
                            </button>
                        </div>

                        <div className={styles.popupBody}>
                            {viewLoading ? (
                                <div className={styles.loadingBox}>กำลังโหลดข้อมูล...</div>
                            ) : (
                                <div className={styles.cardContainer}>
                                    <div className={styles.card}>
                                        <div className={styles.cardHeader}>ข้อมูลส่วนตัว</div>

                                        <div className={styles.topSection}>
                                            <div className={styles.photoColumn}>
                                                <img
                                                    src={resolveImage(selectedPatient.profile_image)}
                                                    onError={(e) => {
                                                        (e.currentTarget as HTMLImageElement).src = '/img/default-avatar.png';
                                                    }}
                                                    alt="profile"
                                                    className={styles.profileImage}
                                                />
                                            </div>

                                            <div className={styles.nameSection}>
                                                <div className={styles.name}>
                                                    <strong>
                                                        {selectedPatient.first_name} {selectedPatient.last_name}
                                                    </strong>
                                                </div>
                                                <div className={styles.subInfo}>
                                                    รหัสผู้ป่วย : {selectedPatient.patient_code ?? String(selectedPatient.user_id).padStart(3, '0')}
                                                </div>
                                            </div>
                                        </div>

                                        <hr className={styles.divider} />

                                        <div className={styles.infoGroup}>
                                            <div className={`${styles.inlineGroup} ${styles.twoCols}`}>
                                                <span>วันเดือนปีเกิด :</span>
                                                <span>
                                                    {selectedPatient.dob
                                                        ? new Date(selectedPatient.dob).toLocaleDateString('th-TH', {
                                                            day: 'numeric',
                                                            month: 'long',
                                                            year: 'numeric',
                                                        })
                                                        : '-'}
                                                </span>

                                                <span>อายุ :</span>
                                                <span>{selectedPatient.dob ? calcThaiAge(selectedPatient.dob) : '-'}</span>
                                            </div>

                                            <div className={styles.rowFull}>
                                                <span>ที่อยู่ :</span>
                                                <span className={styles.valuePre}>{selectedPatient.address || '-'}</span>
                                            </div>

                                            <div className={styles.inlineGroup}>
                                                <span>สัญชาติ :</span>
                                                <span>{selectedPatient.nationality || '-'}</span>
                                                <span>เชื้อชาติ :</span>
                                                <span>{selectedPatient.ethnicity || '-'}</span>
                                                <span></span>
                                                <span></span>
                                            </div>

                                            <div className={styles.inlineGroup}>
                                                <span>อาชีพ :</span>
                                                <span>{selectedPatient.position || '-'}</span>
                                                <span>เพศ :</span>
                                                <span>{selectedPatient.gender || '-'}</span>
                                                <span>กรุ๊ปเลือด :</span>
                                                <span>{selectedPatient.blood_type || '-'}</span>
                                            </div>

                                            <div className={`${styles.inlineGroup} ${styles.twoCols}`}>
                                                <span className={styles.label}>เบอร์ติดต่อ :</span>
                                                <span className={styles.value}>{selectedPatient.phone || '-'}</span>

                                                <span className={styles.label}>ฉุกเฉิน :</span>
                                                <span className={styles.value}>{selectedPatient.emergency_phone || '-'}</span>
                                            </div>

                                            <div className={styles.rowFull}>
                                                <span>อีเมล :</span>
                                                <span className={styles.valuePre}>{selectedPatient.email || '-'}</span>
                                            </div>
                                        </div>

                                        <div className={styles.footerData}>
                                            วันที่เข้ารับการรักษา :{' '}
                                            {selectedPatient.created_at
                                                ? new Date(selectedPatient.created_at).toLocaleDateString('th-TH', {
                                                    day: 'numeric',
                                                    month: 'long',
                                                    year: 'numeric',
                                                })
                                                : '-'}
                                        </div>
                                    </div>

                                    <div className={styles.card}>
                                        <div className={styles.cardHeader}>ข้อมูลการแพทย์</div>

                                        <div className={styles.infoGroup}>
                                            <div className={styles.rowFullWide}>
                                                <span>โรคประจำตัว :</span>
                                                <span className={styles.valuePre}>
                                                    {selectedPatient.congenital_disease || '-'}
                                                </span>
                                            </div>

                                            <div className={styles.rowFullWide}>
                                                <span>ประวัติแพ้ยา :</span>
                                                <span className={styles.valuePre}>{selectedPatient.drug_allergy || '-'}</span>
                                            </div>

                                            <div className={styles.rowFullWide}>
                                                <span>ประวัติแพ้อาหาร :</span>
                                                <span className={styles.valuePre}>{selectedPatient.food_allergy || '-'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showPopup && (
                <div className={styles.popupOverlay}>
                    <div className={styles.popupBoxerror}>
                        <span className={styles.popupIcon}>❌</span>
                        <p>ไม่พบข้อมูลผู้ป่วย</p>
                    </div>
                </div>
            )}

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

                    <div className={styles.headerText}>
                        <span className={styles.brand}>จัดการข้อมูลผู้ป่วย</span>
                    </div>
                </div>

                <div className={styles.rightHeader}>
                    <input
                        type="text"
                        value={nationalId}
                        onChange={(e) => setNationalId(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSmartSearch();
                        }}
                        placeholder="กรอกเลขบัตรประชาชน หรือ รหัสผู้ป่วย"
                        className={styles.searchInput}
                    />
                    <button onClick={handleSmartSearch} className={styles.searchButton}>
                        ค้นหา
                    </button>
                </div>
            </header>

            <div className={styles.wrapper}>
                <Sidebar />

                <section className={styles.contentArea}>
                    {error && <p className={styles.errorText}>{error}</p>}
                    {success && <p className={styles.successText}>{success}</p>}

                    <div className={styles.allPatientsSection}>
                        <h2>ข้อมูลผู้ป่วยทั้งหมด</h2>

                        {allPatients.length > 0 ? (
                            <div className={styles.tableScroll}>
                                <table className={styles.patientTable}>
                                    <thead>
                                        <tr>
                                            <th>รหัสผู้ป่วย</th>
                                            <th>เลขบัตรประชาชน</th>
                                            <th>ชื่อ-นามสกุล</th>
                                            <th>เบอร์โทร</th>
                                            <th>ที่อยู่</th>
                                            <th>วันเกิด</th>
                                            <th className={styles.colAction}>ดู</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {allPatients
                                            .sort((a, b) => a.user_id - b.user_id)
                                            .map((p) => (
                                                <tr key={p.user_id}>
                                                    <td>{p.patient_code ?? String(p.user_id).padStart(3, '0')}</td>
                                                    <td>{p.national_id || '-'}</td>
                                                    <td>
                                                        {p.first_name} {p.last_name}
                                                    </td>
                                                    <td>{p.phone || '-'}</td>
                                                    <td className={styles.addressCell}>{p.address || '-'}</td>
                                                    <td>
                                                        {p.dob
                                                            ? new Date(p.dob).toLocaleDateString('th-TH', {
                                                                day: 'numeric',
                                                                month: 'long',
                                                                year: 'numeric',
                                                            })
                                                            : '-'}
                                                    </td>
                                                    <td className={styles.actionCell}>
                                                        <button
                                                            className={styles.eyeBtn}
                                                            title="ดูรายละเอียด"
                                                            onClick={() => openView(p)}
                                                        >
                                                            <Eye size={18} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className={styles.emptyBox}>ยังไม่มีข้อมูลผู้ป่วย</div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}