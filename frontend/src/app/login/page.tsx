'use client';

import { useState, useEffect } from 'react';
import styles from './login.module.css';
import ReCAPTCHA from 'react-google-recaptcha';
import { FcGoogle } from 'react-icons/fc';
import { FaLine, FaEye, FaEyeSlash } from 'react-icons/fa';
import Swal from 'sweetalert2';
import Link from 'next/link';
import Cookies from 'js-cookie';
import { useRouter } from 'next/navigation';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000';
const RECAPTCHA_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? '';

export default function LoginPage() {
    const [hasMounted, setHasMounted] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // provinces
    const [province, setProvince] = useState<string>('');        // จังหวัดที่เลือก
    const [provincesList, setProvincesList] = useState<string[]>([]); // รายชื่อจังหวัดทั้งหมด

    // login
    const [loginUsername, setLoginUsername] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // recaptcha
    const [captchaToken, setCaptchaToken] = useState<string | null>(null);

    // loading
    const [loadingLogin, setLoadingLogin] = useState(false);
    const [loadingReg, setLoadingReg] = useState(false);

    const router = useRouter();

    useEffect(() => { setHasMounted(true); }, []);
    useEffect(() => {
        const onResize = () => {
            setIsMobile(window.innerWidth <= 768);
            setIsSignUp(false);
        };
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        fetch(`${BACKEND}/api/provinces`)
            .then(r => r.json())
            .then((rows: any[]) => setProvincesList(rows.map(it => it.name_th)))
            .catch(() => setProvincesList([]));
    }, [BACKEND]);

    if (!hasMounted) return null;

    // ===== OAuth =====
    const handleGoogleLogin = () => {
        window.location.href = `${BACKEND}/api/google/login`;
    };
    const handleLineLogin = () => {
        window.location.href = `${BACKEND}/api/line/login`;
    };

    // ===== Register =====
    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const fd = new FormData(form);

        const password = String(fd.get('password') || '');
        const confirmPassword = String(fd.get('confirm_password') || '');
        const email = String(fd.get('emergency_email') || ''); // ฟอร์มเดิมใช้ชื่อ emergency_email

        if (RECAPTCHA_KEY && !captchaToken) {
            Swal.fire({ icon: 'warning', title: 'กรุณายืนยันตัวตน', text: 'โปรดยืนยันว่าไม่ใช่บอท (reCAPTCHA)' });
            return;
        }
        if (password !== confirmPassword) {
            Swal.fire({ icon: 'error', title: 'รหัสผ่านไม่ตรงกัน' });
            return;
        }
        if (!/^(?=.*[A-Za-z])(?=.*\d).{6,}$/.test(password)) {
            Swal.fire({ icon: 'error', title: 'รหัสผ่านไม่ถูกต้อง', text: 'อย่างน้อย 6 ตัว และต้องมีตัวอักษร/ตัวเลข' });
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            Swal.fire({ icon: 'error', title: 'อีเมลไม่ถูกต้อง' });
            return;
        }

        // map ฟิลด์ให้ตรง backend/db
        const payload = {
            title: fd.get('title') || '',
            first_name: fd.get('first_name') || '',
            last_name: fd.get('last_name') || '',
            national_id: fd.get('national_id') || '',
            phone: fd.get('phone') || '',
            address: fd.get('address') || '',
            province_name: province,
            birth_date: fd.get('birthdate') || '', // ฟอร์มเดิมชื่อ birthdate -> ส่งเป็น birth_date
            email, // emergency_email -> email (ให้ตรง backend)
            password,
            username: fd.get('username') || '', // ถ้าไม่ส่ง หลังบ้านจะ gen จากอีเมล
            ...(RECAPTCHA_KEY ? { captcha: captchaToken } : {})
        };
        form.reset();
        setProvince('');         // ✅ เคลียร์ค่าจังหวัดที่เลือก
        setCaptchaToken(null);


        setLoadingReg(true);
        try {
            const res = await fetch(`${BACKEND}/api/users/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result?.message || result?.error || 'สมัครสมาชิกไม่สำเร็จ');

            Swal.fire({ icon: 'success', title: 'สมัครสมาชิกสำเร็จ', text: 'โปรดเข้าสู่ระบบด้วยบัญชีของคุณ' });
            setIsSignUp(false);
            form.reset();
            setProvince('');
            setCaptchaToken(null);
        } catch (err: any) {
            Swal.fire({ icon: 'error', title: 'สมัครสมาชิกไม่สำเร็จ', text: err.message || 'เกิดข้อผิดพลาด' });
        } finally {
            setLoadingReg(false);
        }
    };

    // ===== Login =====
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!loginUsername || !loginPassword) {
            Swal.fire({ icon: 'warning', title: 'กรอกข้อมูลให้ครบ', text: 'กรุณากรอกอีเมล/ชื่อผู้ใช้ และรหัสผ่าน' });
            return;
        }

        const body: any = { password: loginPassword };
        if (loginUsername.includes('@')) body.email = loginUsername;
        else body.username = loginUsername;

        setLoadingLogin(true);
        try {
            const res = await fetch(`${BACKEND}/api/users/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body)
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result?.error || result?.message || 'เข้าสู่ระบบไม่สำเร็จ');

            // { token, user:{ user_id, username, email, role } }
            const remember = (document.getElementById('rememberMe') as HTMLInputElement | null)?.checked;
            Cookies.set('adminToken', result.token, {
                sameSite: 'lax',
                expires: remember ? 7 : 1
            });

            localStorage.setItem('user', JSON.stringify(result.user));

            Swal.fire({ icon: 'success', title: 'เข้าสู่ระบบสำเร็จ', timer: 1200, showConfirmButton: false });

            // ส่งไปหน้า home ตาม role
            const role = result.user?.role;
            const roleHome: Record<string, string> = {
                super_admin: '/dashboard',
                admin: '/admins',
                doctor: '/doctor',
                user: '/appointment'
            };
            setTimeout(() => router.push(roleHome[role] || '/'), 1300);
        } catch (err: any) {
            Swal.fire({ icon: 'error', title: 'เข้าสู่ระบบไม่สำเร็จ', text: err.message || 'เกิดข้อผิดพลาด' });
        } finally {
            setLoadingLogin(false);
        }
    };

    // ===== UI =====
    const verifyOTPForm = null; // (ปิดไว้ก่อน เพราะ backend ยังไม่มี /verify-otp)

    const loginForm = (
        <form className={styles.formStyle} onSubmit={handleLogin}>
            <h1 className={styles.formTitle}>เข้าสู่ระบบ</h1>

            <input
                type="text"
                name="emergency_email"
                placeholder="อีเมล หรือ ชื่อผู้ใช้"
                required
                className={styles.formInput}
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
            />

            <div className={styles.passwordInputWrapper}>
                <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="รหัสผ่าน"
                    required
                    className={styles.formInput}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin(e)}
                />
                <span className={styles.togglePasswordIcon} onClick={() => setShowPassword(prev => !prev)}>
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                </span>
            </div>

            <div className={styles.rememberMeContainer}>
                <input type="checkbox" id="rememberMe" className={styles.rememberMeCheckbox} />
                <label htmlFor="rememberMe" className={styles.rememberMeLabel}>จำรหัสผ่าน</label>
            </div>

            <Link href="/forgotpassword" className={styles.forgotPasswordLink}>ลืมรหัสผ่าน?</Link>

            <div className={styles.socialLoginButtons}>
                <button type="button" onClick={handleGoogleLogin} className={styles.iconCircleButton}>
                    <FcGoogle size={40} />
                </button>
                <button type="button" onClick={handleLineLogin} className={styles.iconCircleButton}>
                    <FaLine size={40} color="#06C755" />
                </button>
            </div>

            <button type="submit" className={styles.formButton} disabled={loadingLogin}>
                {loadingLogin ? 'กำลังเข้าสู่ระบบ…' : 'Login'}
            </button>
        </form>
    );

    const registerForm = (
        <form id="registerForm" className={styles.formStyle} onSubmit={handleRegister}>
            <h1 className={styles.formTitle}>สมัครสมาชิก</h1>

            <select name="title" required className={styles.formInput}>
                <option value="">เลือกคำนำหน้า</option>
                <option value="นาย">นาย</option>
                <option value="นางสาว">นางสาว</option>
                <option value="นาง">นาง</option>
                <option value="เด็กชาย">เด็กชาย</option>
                <option value="เด็กหญิง">เด็กหญิง</option>
            </select>

            <input name="first_name" placeholder="ชื่อจริง" required className={styles.formInput} />
            <input name="last_name" placeholder="นามสกุล" required className={styles.formInput} />
            <input type="text" name="national_id" placeholder="เลขบัตรประชาชน" pattern="\d{13}" maxLength={13} required className={styles.formInput} />
            <input type="tel" name="phone" placeholder="เบอร์โทรศัพท์" required className={styles.formInput} />
            <textarea name="address" placeholder="ที่อยู่" rows={3} required className={styles.formInput} />

            <select
                name="province"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                required
                className={styles.formInput}
            >
                <option value="">เลือกจังหวัด</option>
                {provincesList.map((name) => (
                    <option key={name} value={name}>{name}</option>
                ))}
            </select>

            <input type="date" name="birthdate" required className={styles.formInput} />

            {/* อีเมล: ฟอร์มเดิมใช้ emergency_email แต่ backend ต้องการ email -> map แล้วตอนส่ง */}
            <input type="email" name="emergency_email" placeholder="อีเมล" required className={styles.formInput} />

            <div className={styles.passwordInputWrapper}>
                <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="รหัสผ่าน (อย่างน้อย 6 ตัว)"
                    required
                    className={styles.formInput}
                />
                <span className={styles.togglePasswordIcon} onClick={() => setShowPassword(prev => !prev)}>
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                </span>
            </div>

            <input type={showPassword ? 'text' : 'password'} name="confirm_password" placeholder="ยืนยันรหัสผ่าน" required className={styles.formInput} />

            {RECAPTCHA_KEY ? (
                <ReCAPTCHA sitekey={RECAPTCHA_KEY} onChange={(token) => setCaptchaToken(token)} />
            ) : (
                <small style={{ color: '#666' }}>
                    *ยังไม่ได้ตั้งค่า reCAPTCHA (กำหนด <code>NEXT_PUBLIC_RECAPTCHA_SITE_KEY</code> ใน <code>.env.local</code> เพื่อเปิดใช้งาน)
                </small>
            )}

            <div className={styles.socialLoginButtons} style={{ marginTop: 8 }}>
                <button type="button" onClick={handleGoogleLogin} className={styles.iconCircleButton}>
                    <FcGoogle size={34} />
                </button>
                <button type="button" onClick={handleLineLogin} className={styles.iconCircleButton}>
                    <FaLine size={34} color="#06C755" />
                </button>
            </div>

            <button type="submit" className={`${styles.formButton} ${styles.btnOval}`} disabled={loadingReg}>
                {loadingReg ? 'กำลังสมัคร…' : 'สมัครสมาชิก'}
            </button>
        </form>
    );

    return (
        <div className={`${styles.container} ${isSignUp && !isMobile ? styles.containerRightPanelActive : ''}`}>
            {isMobile ? (
                <div className={styles.mobileWrapper}>
                    <div className={styles.toggleButtons}>
                        <button
                            onClick={() => setIsSignUp(false)}
                            className={styles.formButton}
                            style={{ marginRight: '10px', backgroundColor: isSignUp ? '#aaa' : '#000066' }}
                        >
                            เข้าสู่ระบบ
                        </button>
                        <button
                            onClick={() => setIsSignUp(true)}
                            className={styles.formButton}
                            style={{ backgroundColor: isSignUp ? '#000066' : '#aaa' }}
                        >
                            สมัครสมาชิก
                        </button>
                    </div>
                    <div className={styles.formContainer}>
                        {isSignUp ? registerForm : loginForm}
                    </div>
                </div>
            ) : (
                <>
                    <div className={`${styles.formContainer} ${styles.signUpContainer}`}>
                        {registerForm}
                    </div>
                    <div className={`${styles.formContainer} ${styles.signInContainer}`}>
                        {loginForm}
                    </div>
                    <div className={styles.overlayContainer}>
                        <div className={styles.overlay}>
                            <div className={`${styles.overlayPanel} ${styles.overlayLeft}`}>
                                <p className={styles.formTitle}>หากมีบัญชีอยู่แล้ว<br />กรุณาเข้าสู่ระบบ</p>
                                <button className={`${styles.formButton} ${styles.ghostButton}`} onClick={() => setIsSignUp(false)}>
                                    Login
                                </button>
                            </div>
                            <div className={`${styles.overlayPanel} ${styles.overlayRight}`}>
                                <h1 className={styles.formTitle}>สมัครสมาชิก</h1>
                                <button className={`${styles.formButton} ${styles.ghostButton}`} onClick={() => setIsSignUp(true)}>
                                    Register
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
