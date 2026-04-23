'use client'

import React, { useEffect, useRef, useState } from 'react'
import Cookies from 'js-cookie'
import Link from 'next/link';
import styles from './Help.module.css'
import { API_BASE } from '@/lib/api'
import Sidebar from '../components/Sidebar'
import Swal from 'sweetalert2';


/* ===================== Types ===================== */
interface HelpItem {
    help_id: number
    title: string
    description: string | null
    visibility: 'private' | 'shared'
    updated_at: string
}

interface UserProfile {
    first_name: string
    last_name: string
    profile_image: string | null
}

export default function HelpDashboard() {
    const token = Cookies.get('adminToken')
    const [admin, setAdmin] = useState<UserProfile>({
        first_name: '',
        last_name: '',
        profile_image: null,
    })

    const [helps, setHelps] = useState<HelpItem[]>([])
    const [expandedId, setExpandedId] = useState<number | null>(null)
    const [error, setError] = useState('');
    const [showPopup, setShowPopup] = useState(false)
    const [title, setTitle] = useState('')
    const [response, setResponse] = useState('')

    const [editingId, setEditingId] = useState<number | null>(null)
    const [editingTitle, setEditingTitle] = useState('')
    const [editingResponse, setEditingResponse] = useState('')

    const latestItemRef = useRef<HTMLDivElement | null>(null)

    const confirmAction = async (message: string) => {
        const result = await Swal.fire({
            title: 'ยืนยันการดำเนินการ',
            text: message,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'ยืนยัน',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#2ecc71',
            cancelButtonColor: '#e74c3c',
            reverseButtons: true,
            focusCancel: true,
        });

        return result.isConfirmed;
    };


    useEffect(() => {
        if (!token) return

        fetch(`${API_BASE}/users/me`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(res => res.json())
            .then(data => setAdmin(data))
            .catch(err => console.error('โหลดข้อมูลผู้ใช้ล้มเหลว:', err))
    }, [])
    const fetchHelps = async () => {
        const res = await fetch(`${API_BASE}/help/all`, {
            headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json()
        setHelps(json.data)
    }

    useEffect(() => {
        if (token) fetchHelps()
    }, [])
    const handleToggle = (id: number) => {
        setExpandedId(expandedId === id ? null : id)
    }

    const handleAdd = async () => {
        if (!title || !response) return;

        const ok = await confirmAction('คุณต้องการบันทึกหัวข้อช่วยเหลือนี้หรือไม่ ?');
        if (!ok) return;

        const res = await fetch(`${API_BASE}/help`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Cookies.get('adminToken')}`,
            },
            body: JSON.stringify({
                title,
                description: response,
                visibility: 'shared',
            }),
        });

        if (res.ok) {
            Swal.fire({
                icon: 'success',
                title: 'บันทึกสำเร็จ',
                timer: 1500,
                showConfirmButton: false,
            });

            fetchHelps();
            setTitle('');
            setResponse('');
            setShowPopup(false);
        }
    };


    const handleDelete = async (id: number) => {
        const ok = await confirmAction('คุณแน่ใจหรือไม่ว่าต้องการลบ FAQ นี้ ?');
        if (!ok) return;

        const res = await fetch(`${API_BASE}/help/${id}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${Cookies.get('adminToken')}`,
            },
        });

        if (res.ok) {
            Swal.fire({
                icon: 'success',
                title: 'ลบเรียบร้อย',
                timer: 1500,
                showConfirmButton: false,
            });

            fetchHelps();
        }
    };


    const handleEdit = (item: HelpItem) => {
        setEditingId(item.help_id)
        setEditingTitle(item.title)
        setEditingResponse(item.description || '')
    }

    const handleSaveEdit = async (id: number) => {
        const ok = await confirmAction('คุณต้องการบันทึกการแก้ไขนี้หรือไม่ ?');
        if (!ok) return;

        const res = await fetch(`${API_BASE}/help/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Cookies.get('adminToken')}`,
            },
            body: JSON.stringify({
                title: editingTitle,
                description: editingResponse,
            }),
        });

        if (res.ok) {
            Swal.fire({
                icon: 'success',
                title: 'แก้ไขเรียบร้อย',
                timer: 1500,
                showConfirmButton: false,
            });

            setEditingId(null);
            fetchHelps();
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.leftHeader}>
                    <Link href="/dashboard">
                        <img
                            src="/img/profileclinic.png"
                            alt="logo"
                            className={styles.logoIcon}
                            width={40} height={40}
                            style={{ cursor: 'pointer' }}
                        />
                    </Link>
                    <span className={styles.brand}>จัดการความช่วยเหลือ</span>
                </div>
            </header>


            <div className={styles.wrapper}>
                <Sidebar />
                <section className={styles.contentArea}>
                    <div className={styles.heading}>
                        <h1> หัวข้อการช่วยเหลือและแก้ไข้</h1>
                        {error && <p className={styles.error}>{error}</p>}

                        <button className={styles.addHelpBtn} onClick={() => setShowPopup(true)}>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                height="24"
                                width="24"
                            >
                                <path
                                    fill="white"
                                    d="M12 4v16m8-8H4"
                                    stroke="white"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                            <span className={styles.tooltip}>เพิ่มหัวข้อ</span>
                        </button>
                        <h2 className={styles.title}><span> FAQ </span>คำถามทั่วไป</h2>
                        <>
                            {/* Popup ฟอร์ม */}
                            {showPopup && (
                                <div className={styles.popupOverlay}>
                                    <div className={styles.popupContent}>
                                        <button
                                            className={styles.closeBtn}
                                            onClick={() => setShowPopup(false)}
                                        >
                                            ✕
                                        </button>
                                        <h2 className={styles.popupTitle}>เพิ่มหัวข้อช่วยเหลือ</h2>
                                        <input
                                            type="text"
                                            placeholder="กรุณากรอกหัวข้อ"
                                            className={styles.popupInput}
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                        />
                                        <textarea
                                            placeholder="ขั้นตอนหรือวิธีแก้ไข"
                                            className={styles.popupTextarea}
                                            rows={4}
                                            value={response}
                                            onChange={(e) => setResponse(e.target.value)}
                                        />
                                        <button className={styles.popupSubmit} onClick={handleAdd}>บันทึก</button>
                                    </div>
                                </div>
                            )}
                        </>

                        <div className={styles.list}>
                            {helps.map((item, index) => (
                                <div key={item.help_id} className={`${styles.card}`} ref={index === 0 ? latestItemRef : null} >
                                    <div className={styles.question} onClick={() => handleToggle(item.help_id)}>
                                        {expandedId === item.help_id ? '▾' : '▸'}&nbsp;
                                        {editingId === item.help_id ? (
                                            <input
                                                className={styles.editInput}
                                                value={editingTitle}
                                                onChange={(e) => setEditingTitle(e.target.value)}
                                            />
                                        ) : (
                                            <b>{item.title}</b>
                                        )}
                                    </div>

                                    {expandedId === item.help_id && (
                                        <div className={styles.answer}>
                                            {editingId === item.help_id ? (
                                                <>
                                                    <textarea
                                                        className={styles.editTextarea}
                                                        value={editingResponse}
                                                        onChange={(e) => setEditingResponse(e.target.value)}
                                                    />
                                                    <button
                                                        className={styles.saveBtn}
                                                        onClick={() => handleSaveEdit(item.help_id)}
                                                    >
                                                        บันทึกการแก้ไข
                                                    </button>
                                                </>
                                            ) : (
                                                <ul><li>{item.description}</li></ul>
                                            )}
                                        </div>
                                    )}

                                    <div className={styles.actions}>
                                        <button onClick={() => handleEdit(item)} className={styles.editBtn}>แก้ไข</button>
                                        <button onClick={() => handleDelete(item.help_id)} className={styles.deleteBtn}>ลบ</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section >
            </div >
        </div >
    );
}