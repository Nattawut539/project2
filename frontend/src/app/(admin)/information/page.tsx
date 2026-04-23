'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './information.module.css';
import Cookies from 'js-cookie';
import Link from 'next/link';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import { API_BASE } from '@/lib/api';
dayjs.locale('th');

function resolveImage(path?: string | null) {
    if (!path) return '/img/default-avatar.png';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    if (path.startsWith('/uploads')) return `${API_BASE}${path}`;
    return `/img/${path}`;
}

export interface Patient {
    user_id: number;
    patient_code?: string;

    national_id: string;
    title?: string;

    first_name: string;
    last_name: string;

    phone?: string;
    emergency_phone?: string;

    address?: string;
    dob?: string;

    nationality?: string;
    ethnicity?: string;

    gender?: string;
    blood_type?: string;

    email?: string;

    profile_image?: string | null;

    position?: string;

    congenital_disease?: string;
    drug_allergy?: string;
    food_allergy?: string;

    created_at: string | null;
}

export interface Profile {
    first_name: string;
    last_name: string;
    profile_image?: string | null;
}

export type PatientFull = Patient & {
    admit_date?: string | null;
};

export default function PatientProfilePage() {
    const searchParams = useSearchParams();
    const userId = searchParams.get('user_id');
    const router = useRouter();
    const token = useMemo(() => Cookies.get('adminToken') || '', []);

    const [basicUser, setBasicUser] = useState<any>(null);
    const [ageDetail, setAgeDetail] = useState('');
    const [loading, setLoading] = useState(true);
    const [showPopup, setShowPopup] = useState(false);
    const [popupMessage, setPopupMessage] = useState('');
    const [popupType, setPopupType] = useState<'success' | 'error'>('success');
    const [isBackLoading, setIsBackLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);

    //เก็บค่าต้นฉบับไว้ใช้เทียบ
    const [originalPatient, setOriginalPatient] = useState<Patient | null>(null);
    const [isDirty, setIsDirty] = useState(false);

    //ใช้เปิด/ปิด popup ยืนยันการลบ
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);

    const [patient, setPatient] = useState<Patient>({
        user_id: 0,
        national_id: "",
        first_name: "",
        last_name: "",
        profile_image: null,
        created_at: "",
    });

    const calculateThaiAge = (dobStr: string) => {
        const birthDate = dayjs(dobStr);
        const today = dayjs();
        const years = today.diff(birthDate, 'year');
        const months = today.diff(birthDate.add(years, 'year'), 'month');
        const days = today.diff(birthDate.add(years, 'year').add(months, 'month'), 'day');
        return `${years} ปี ${months} เดือน ${days} วัน`;
    };

    // ฟังก์ชันเช็คว่ามีการแก้ไขข้อมูลหรือยัง
    const isPatientDirty = (next: Patient, original: Patient | null) => {
        if (!original) return false;
        const keys: (keyof Patient)[] = [
            'dob',
            'address',
            'nationality',
            'ethnicity',
            'gender',
            'blood_type',
            'phone',
            'emergency_phone',
            'email',
            'position',
            'congenital_disease',
            'drug_allergy',
            'food_allergy',
        ];
        return keys.some((k) => (next[k] || '') !== (original[k] || ''));
    };

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        setPatient(prev => {
            const next = { ...prev, [name]: value } as Patient;
            setIsDirty(isPatientDirty(next, originalPatient));
            return next;
        });
    };

    function handlePickFile(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 3 * 1024 * 1024) {
            setPopupMessage('ไฟล์ขนาดใหญ่เกิน 3MB');
            setPopupType('error');
            setShowPopup(true);
            setTimeout(() => setShowPopup(false), 1800);
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = () => setPreview(String(reader.result));
        reader.readAsDataURL(file);
    }

    async function handleUploadImage() {
        const input = document.getElementById('profileFile') as HTMLInputElement | null;
        const file = input?.files?.[0];
        if (!file) {
            setPopupMessage('กรุณาเลือกไฟล์รูปก่อน');
            setPopupType('error');
            setShowPopup(true);
            setTimeout(() => setShowPopup(false), 1500);
            return;
        }

        const fd = new FormData();
        fd.append('file', file);

        try {
            setUploading(true);
            const res = await fetch(`${API_BASE}/patients/${patient.user_id}/profile`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}` },
                body: fd,
                credentials: 'include',
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'อัปโหลดไม่สำเร็จ');

            setPatient((prev: any) => ({ ...prev, profile_image: data.profile_image }));
            if (input) input.value = '';
            setPreview(null);

            setPopupMessage('บันทึกรูปสำเร็จ');
            setPopupType('success');
        } catch (e) {
            setPopupMessage('อัปโหลดรูปไม่สำเร็จ');
            setPopupType('error');
        } finally {
            setUploading(false);
            setShowPopup(true);
            setTimeout(() => setShowPopup(false), 1800);
        }
    }

    function formatThaiDate(date?: string | null) {
        if (!date) return "-";
        return new Date(date).toLocaleDateString("th-TH", {
            day: "numeric",
            month: "long",
            year: "numeric",
        });
    }

    const handleUpdate = async () => {
        //กันไม่ให้บันทึกถ้ายังไม่ได้แก้ไขอะไร
        if (!isDirty) {
            setPopupMessage('กรุณาแก้ไข หรือเพิ่มเติมข้อมูลก่อนบันทึก');
            setPopupType('error');
            setShowPopup(true);
            setTimeout(() => setShowPopup(false), 2000);
            return;
        }

        try {
            const body = {
                birth_date: patient.dob,
                address: patient.address,
                nationality: patient.nationality,
                ethnicity: patient.ethnicity,
                gender: patient.gender,
                blood_type: patient.blood_type,
                phone: patient.phone,
                emergency_phone: patient.emergency_phone,
                email: patient.email,
                position: patient.position,
                congenital_disease: patient.congenital_disease,
                drug_allergy: patient.drug_allergy,
                food_allergy: patient.food_allergy,
            };

            const res = await fetch(`${API_BASE}/patients/${patient.user_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                credentials: 'include',
                body: JSON.stringify(body),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'อัปเดตไม่สำเร็จ');

            // อัปเดตค่าต้นฉบับ + รีเซ็ตสถานะ dirty
            setOriginalPatient(patient);
            setIsDirty(false);

            setPopupMessage('อัปเดตข้อมูลสำเร็จ');
            setPopupType('success');
        } catch {
            setPopupMessage('อัปเดตข้อมูลไม่สำเร็จ');
            setPopupType('error');
        } finally {
            setShowPopup(true);
            setTimeout(() => setShowPopup(false), 2000);
        }
    };

    // เดิม: ย้าย logic ลบมาอยู่ฟังก์ชันแยก แล้วค่อยเรียกตอนกด "ตกลง"
    async function doDelete() {
        try {
            const res = await fetch(`${API_BASE}/patients/${patient.user_id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
                credentials: 'include',
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'ลบไม่สำเร็จ');

            setPopupMessage('ลบข้อมูลสำเร็จ');
            setPopupType('success');
            setShowPopup(true);
            setTimeout(() => router.push('/admins'), 1000);
        } catch {
            setPopupMessage('ลบข้อมูลไม่สำเร็จ');
            setPopupType('error');
            setShowPopup(true);
            setTimeout(() => setShowPopup(false), 2000);
        }
    }

    //กดปุ่ม "ลบผู้ป่วย" ให้เปิด popup ยืนยัน
    function handleDelete() {
        setShowConfirmDelete(true);
    }

    //กด "ตกลง" ใน popup แล้วค่อยไปลบจริง
    async function confirmDelete() {
        setShowConfirmDelete(false);
        await doDelete();
    }

    const handleBack = () => {
        setIsBackLoading(true);
        setTimeout(() => router.back(), 800);
    };

    useEffect(() => {
        async function load() {
            try {
                const r = await fetch(`${API_BASE}/patients/${userId}`, {
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    cache: 'no-store',
                    credentials: 'include',
                });
                if (!r.ok) throw new Error('ไม่พบข้อมูลผู้ป่วย');
                const p = await r.json();
                setPatient(p);

                //เก็บค่า original ตอนโหลดครั้งแรก
                setOriginalPatient(p);
                setIsDirty(false);
            } catch (e) {
                console.error('โหลดข้อมูลล้มเหลว:', e);
            } finally {
                setTimeout(() => setLoading(false), 300);
            }
        }
        if (userId) load();
    }, [userId, token]);

    useEffect(() => {
        const dob = patient?.dob;
        if (dob) setAgeDetail(calculateThaiAge(dob));
    }, [patient?.dob]);

    if (loading || isBackLoading) return <div className={styles.loaderWrapper} />;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.leftHeader}>
                    <Link href="/dashboard">
                        <img src="/img/profileclinic.png" alt="logo" className={styles.logoIcon} width={40} height={40} />
                    </Link>
                    <span className={styles.brand}>ข้อมูลผู้ป่วย</span>
                </div>
            </header>

            <div className={styles.wrapper}>
                <button className={styles.button} onClick={handleBack}>
                    <div className={styles.buttonBox}>
                        <span className={styles.buttonElem}>
                            <svg viewBox="0 0 24 24" className={styles.arrowIcon}>
                                <path fill="black" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                            </svg>
                        </span>
                        <span className={styles.buttonElem}>
                            <svg viewBox="0 0 24 24" className={styles.arrowIcon}>
                                <path fill="black" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                            </svg>
                        </span>
                    </div>
                </button>
            </div>

            {showPopup && (
                <div className={`${styles.popupMessage} ${popupType === 'success' ? styles.popupSuccess : styles.popupError}`}>
                    {popupMessage}
                </div>
            )}

            {/*  Popup ยืนยันการลบ ใช้ .popupOverlay / .popupBox จาก CSS เดิม */}
            {showConfirmDelete && (
                <div className={styles.popupOverlay}>
                    <div className={styles.popupBox}>
                        <div>คุณมั่นใจหรือไม่ว่าต้องการลบข้อมูลผู้ป่วยรายนี้?</div>
                        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
                            <button
                                className={`${styles.btn} ${styles.btnDanger}`}
                                onClick={confirmDelete}
                            >
                                ตกลง
                            </button>
                            <button
                                className={`${styles.btn} ${styles.btnSecondary}`}
                                onClick={() => setShowConfirmDelete(false)}
                            >
                                ไม่
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <section className={styles.contentArea}>
                {patient && (
                    <div className={styles.cardContainer}>
                        {/* การ์ดข้อมูลส่วนตัว */}
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>ข้อมูลส่วนตัว</div>
                            <div className={styles.topSection}>
                                <div className={styles.photoColumn}>
                                    <div className={styles.photoContainer}>
                                        <img
                                            src={preview || resolveImage(patient?.profile_image)}
                                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/img/default-avatar.png'; }}
                                            alt="profile"
                                            className={styles.profileImage}
                                        />

                                        <div
                                            className={styles.cameraIconWrapper}
                                            onClick={() => document.getElementById('profileFile')?.click()}
                                        >
                                            <svg viewBox="0 0 24 24">
                                                <path fill="white" d="M19 11H13V5h-2v6H5v2h6v6h2v-6h6z" />
                                            </svg>
                                        </div>
                                    </div>

                                    <div className={styles.photoControls}>
                                        <button
                                            className={`${styles.btn} ${styles.btnPrimary}`}
                                            onClick={handleUploadImage}
                                            disabled={!preview || uploading}
                                        >
                                            {uploading ? 'กำลังอัปโหลด…' : 'บันทึกรูป'}
                                        </button>
                                    </div>

                                    <input
                                        id="profileFile"
                                        type="file"
                                        accept="image/*"
                                        className={styles.hiddenfile}
                                        onChange={handlePickFile}
                                    />
                                </div>

                                <div className={styles.nameSection}>
                                    <div className={styles.name}><strong>{patient.first_name} {patient.last_name}</strong></div>
                                    <div className={styles.subInfo}>รหัสผู้ป่วย : {String(patient.user_id).padStart(3, '0')}</div>
                                </div>
                            </div>

                            <hr className={styles.divider} />
                            <div className={styles.infoGroup}>
                                <div className={styles.inlineGroup}>
                                    <span>วันเดือนปีเกิด :</span>
                                    <input
                                        type="date"
                                        name="dob"
                                        value={patient?.dob ? dayjs(patient.dob).format('YYYY-MM-DD') : ''}
                                        onChange={(e) => {
                                            const newDob = e.target.value;
                                            setPatient(prev => {
                                                const next = { ...prev, dob: newDob } as Patient;
                                                setIsDirty(isPatientDirty(next, originalPatient));
                                                return next;
                                            });
                                            setAgeDetail(newDob ? calculateThaiAge(newDob) : '');
                                        }}
                                        className={styles.inputname}
                                    />
                                    <span>อายุ :</span>
                                    <input name="age" value={ageDetail} readOnly className={styles.inputage} />
                                </div>

                                <div className={styles.inlineGroup}>
                                    <span>เพศ :</span>
                                    <select name="gender" value={patient.gender || ''} onChange={handleChange} className={styles.input} >
                                        <option value="" > --- เพศกำเนิด ---</option>
                                        <option value="เพศชาย" >ชาย</option>
                                        <option value="เพศหญิง" >หญิง</option>
                                        <option value="ไม่ระบุ" >ไม่ระบุ</option>
                                    </select>
                                    <span>กรุ๊ปเลือด :</span>
                                    <select name="blood_type" value={patient.blood_type || ''} onChange={handleChange} className={styles.inputbloodtype} >
                                        <option value="" > --- เลือกกรุ๊ปเลือด ---</option>
                                        <option value="A" >A</option>
                                        <option value="B" >B</option>
                                        <option value="O" >O</option>
                                        <option value="AB" >AB</option>
                                    </select>
                                </div>

                                <div className={styles.inlineGroup}>
                                    <span>สัญชาติ :</span>
                                    <input name="nationality" value={patient.nationality || ''} onChange={handleChange} className={styles.inputmessage} />
                                    <span>เชื้อชาติ :</span>
                                    <input name="ethnicity" value={patient.ethnicity || ''} onChange={handleChange} className={styles.inputmessage} />
                                    <span>อาชีพ :</span>
                                    <input name="position" value={patient.position || ''} onChange={handleChange} className={styles.inputmessage} />
                                </div>

                                <div className={styles.inlineGroup} style={{ display: 'flex' }}>
                                    <span>ที่อยู่ :</span>
                                    <textarea
                                        name="address"
                                        value={patient.address || ''}
                                        onChange={handleChange}
                                        maxLength={270}
                                        rows={2}
                                        className={`${styles.textareaAddress} ${styles.addressInput}`}
                                    />
                                </div>

                                <div className={styles.inlineGroup}>
                                    <span>เบอร์ติดต่อ :</span>
                                    <input name="phone" value={patient.phone || ''} onChange={handleChange} maxLength={10} inputMode="numeric" className={styles.inputphone} />
                                    <span>เบอร์ติดต่อ (ฉุกเฉิน) :</span>
                                    <input name="emergency_phone" value={patient.emergency_phone || ''} onChange={handleChange} maxLength={10} inputMode="numeric" className={styles.inputemergencyphone} />
                                </div>

                                <div className={styles.inlineGroup}>
                                    <span>อีเมล :</span>
                                    <input name="email" value={patient.email || ''} onChange={handleChange} maxLength={50} className={styles.inputemail} />
                                </div>
                            </div>

                            <div className={styles.footerData}>
                                วันที่เข้ารับการรักษา : {formatThaiDate(patient.created_at)}
                            </div>
                        </div>

                        {/* การ์ดข้อมูลการแพทย์ */}
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>ข้อมูลการแพทย์</div>

                            <div className={styles.infoGroup}>
                                <div className={styles.inlineGroup}>
                                    <span><b>โรคประจำตัว </b></span>
                                    <input
                                        name="congenital_disease"
                                        value={patient.congenital_disease || ''}
                                        onChange={handleChange}
                                        className={`${styles.inputdisease} ${styles.emergencyInput}`}
                                    />
                                </div>

                                <div className={styles.inlineGroup}>
                                    <span style={{ marginTop: '12px' }}><b>ประวัติแพ้ยา </b></span>
                                    <input
                                        name="drug_allergy"
                                        value={patient.drug_allergy || ''}
                                        onChange={handleChange}
                                        className={`${styles.inputdisease} ${styles.emergencyInput}`}
                                    />
                                </div>

                                <div className={styles.inlineGroup}>
                                    <span style={{ marginTop: '12px' }}><b>ประวัติแพ้อาหาร </b></span>
                                    <input
                                        name="food_allergy"
                                        value={patient.food_allergy || ''}
                                        onChange={handleChange}
                                        className={`${styles.inputdisease} ${styles.emergencyInput}`}
                                    />
                                </div>
                            </div>

                            <div className={styles.actionRow}>
                                <button
                                    className={`${styles.btn} ${styles.btnPrimary}`}
                                    onClick={handleUpdate}
                                    // disable ถ้ายังไม่มีการแก้ไข
                                    disabled={!isDirty}
                                >
                                    บันทึก
                                </button>

                                <button
                                    className={`${styles.btn} ${styles.btnDanger}`}
                                    onClick={handleDelete}
                                >
                                    ลบผู้ป่วย
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}
