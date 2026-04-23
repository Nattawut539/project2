'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Book, Calendar, FileText, HelpCircle, LogOut, BriefcaseMedical } from 'lucide-react';
import styles from './Sidebar.module.css';
import { API_BASE } from '@/lib/api';
import Cookies from 'js-cookie';

function resolveImage(src?: string | null) {
    if (!src) return '/img/default-avatar.png';
    if (src.startsWith('http') || src.startsWith('data:') || src.startsWith('/img/')) return src;
    if (src.startsWith('/uploads') || src.startsWith('uploads')) {
        const clean = src.replace(/^\//, '');
        return `${API_BASE}/${clean}`;
    }
    return src;
}

type Profile = {
    first_name: string;
    last_name: string;
    profile_image?: string | null;
};

export default function AdminsPage() {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [isHovered, setIsHovered] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/me/profile`, {
                    headers: getAuthHeaders(),
                    cache: 'no-store',
                    credentials: 'include',
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
            } catch (err) {
                console.error('โหลดโปรไฟล์ล้มเหลว', err);
                setProfile(null);
            }
        })();
    }, []);


    const menuItems = [
        { icon: <Home />, label: ' รายชื่อผู้ป่วย ', href: '/admins' },
        { icon: <Book />, label: ' รายการจองคิว ', href: '/appointment' },
        { icon: <Calendar />, label: ' รายการนัดหมาย ', href: '/patientDetails' },
        { icon: <BriefcaseMedical />, label: 'เวชระเบียน ', href: '/medicalrecords' },
        { icon: <FileText />, label: ' คะแนนการบริการ ', href: '/compile' },
        { icon: <HelpCircle />, label: ' ช่วยเหลือ ', href: '/help' },
        { icon: <LogOut />, label: ' ออกจากระบบ ', href: '/logout' },
    ];

    const mainMenuItems = menuItems.slice(0, -1);
    const logoutMenu = menuItems[menuItems.length - 1];
    const activeIndex = mainMenuItems.findIndex(m => pathname?.startsWith(m.href));

    function getAuthHeaders(): Headers {
        const token = Cookies.get('adminToken') || Cookies.get('userToken') || '';
        const h = new Headers();
        h.append('Content-Type', 'application/json');
        if (token) h.append('Authorization', `Bearer ${token}`);
        return h;
    }


    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={styles.sidebar}
            style={{ width: isHovered ? '230px' : '60px' }}
        >
            <div className={styles.sidebarHeader}>
                <div className={styles.avatarIcon}>
                    <img
                        src={resolveImage(profile?.profile_image)}
                        alt={`${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim()}
                        className={styles.avatarImg}
                    />
                </div>

                {isHovered && (profile?.first_name || profile?.last_name) && (
                    <h1 className={styles.appointmentBtn}>
                        {`${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim()}
                    </h1>
                )}
            </div>

            <nav className={styles.menu}>
                {/* เมนูด้านบนทั้งหมด */}
                <div className={styles.menuTop}>
                    {mainMenuItems.map((item, index) => (
                        <Link
                            key={index}
                            href={item.href}
                            className={`${styles.menuItem} ${pathname?.startsWith(item.href) ? styles.active : ''}`}
                        >
                            <span className={styles.menuIcon}>{item.icon}</span>
                            {isHovered && <span>{item.label}</span>}
                        </Link>
                    ))}

                    {activeIndex >= 0 && (
                        <div
                            className={styles.highligth}
                            style={{ '--top': `${activeIndex * 58}px` } as React.CSSProperties}
                        />
                    )}
                </div>

                {/* เมนูออกจากระบบด้านล่างสุด */}
                <div className={styles.menuBottom}>
                    <Link
                        href={logoutMenu.href}
                        className={`${styles.menuItem} ${pathname === logoutMenu.href ? styles.active : ''}`}
                    >
                        <span className={styles.menuIcon}>{logoutMenu.icon}</span>
                        {isHovered && <span>{logoutMenu.label}</span>}
                    </Link>
                </div>
            </nav>
        </div>
    );
}

