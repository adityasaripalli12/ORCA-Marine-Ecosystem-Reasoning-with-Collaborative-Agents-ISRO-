import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { UserRole, ROLE_CONFIG } from '../types';
import {
  Waves, Eye, EyeOff, ShieldCheck, Lock, Mail,
  ArrowRight, KeyRound, CheckSquare, Square,
  CheckCircle2, XCircle, AlertTriangle, Loader2,
  Shield, Zap, X, Fingerprint
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ──────────────────────────────────────────────────────
   Password-strength rule helpers
────────────────────────────────────────────────────── */
interface PwdRules {
  minLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

function evaluatePassword(pw: string): PwdRules {
  return {
    minLength: pw.length >= 8,
    hasUpper: /[A-Z]/.test(pw),
    hasLower: /[a-z]/.test(pw),
    hasNumber: /[0-9]/.test(pw),
    hasSpecial: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw),
  };
}

function isPasswordValid(rules: PwdRules) {
  return Object.values(rules).every(Boolean);
}

function isEmailValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ──────────────────────────────────────────────────────
   Sub-components
────────────────────────────────────────────────────── */
const RuleItem: React.FC<{ passed: boolean; label: string }> = ({ passed, label }) => (
  <div className={`flex items-center gap-2 text-[11px] transition-colors duration-200 ${passed ? 'text-emerald-400' : 'text-rose-400'}`}>
    {passed
      ? <CheckCircle2 className="w-3 h-3 shrink-0" />
      : <XCircle className="w-3 h-3 shrink-0" />}
    <span>{label}</span>
  </div>
);

const WaveRow: React.FC<{ delay?: number; opacity?: number }> = ({ delay = 0, opacity = 0.15 }) => (
  <motion.div
    animate={{ x: [0, -60, 0] }}
    transition={{ duration: 12 + delay, repeat: Infinity, ease: 'linear' }}
    style={{ opacity }}
    className="absolute w-[200%] h-full"
  >
    <svg viewBox="0 0 1440 120" className="w-full h-full" preserveAspectRatio="none">
      <path
        d="M0,60 C180,100 360,20 540,60 C720,100 900,20 1080,60 C1260,100 1440,20 1440,60 L1440,120 L0,120 Z"
        fill="currentColor"
        className="text-cyan-400"
      />
    </svg>
  </motion.div>
);

const Orb: React.FC<{ style: React.CSSProperties }> = ({ style }) => (
  <motion.div
    animate={{ y: [-12, 12, -12], opacity: [0.5, 1, 0.5] }}
    transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
    style={style}
    className="absolute rounded-full pointer-events-none"
  />
);

const Modal: React.FC<{ children: React.ReactNode; onClose: () => void }> = ({ children, onClose }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md"
    onClick={onClose}
  >
    <motion.div
      initial={{ scale: 0.88, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.9, opacity: 0, y: 10 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      onClick={(e) => e.stopPropagation()}
      className="w-full max-w-sm"
    >
      {children}
    </motion.div>
  </motion.div>
);

/* ──────────────────────────────────────────────────────
   Main LoginPage Component
────────────────────────────────────────────────────── */
export const LoginPage: React.FC = () => {
  const {
    login,
  } = useAuth();
  const { addToast } = useToast();

  /* ── Form State ── */
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole | ''>('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [pwdFocused, setPwdFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);

  /* ── Demo Typing State ── */
  const [activeDemo, setActiveDemo] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);

  /* ── Modal State ── */
  type ModalKind = 'error' | 'success' | 'forgot' | null;
  const [modal, setModal] = useState<ModalKind>(null);
  const [modalMsg, setModalMsg] = useState('');

  /* ── Field-level Errors ── */
  const [emailError, setEmailError] = useState('');
  const [pwdError, setPwdError] = useState('');

  const pwdRules = evaluatePassword(password);

  /* ── Caps-Lock Detection ── */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    setCapsLock(e.getModifierState?.('CapsLock') ?? false);
  }, []);
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  /* ── Typing Animation Helper ── */
  const typeValue = async (setter: (v: string) => void, target: string, speed = 40) => {
    setter('');
    for (let i = 0; i <= target.length; i++) {
      setter(target.slice(0, i));
      await new Promise((r) => setTimeout(r, speed));
    }
  };

  const typeCredentials = async (acc: { email: string; pass: string; r: UserRole; key: string }) => {
    if (isTyping) return;
    setActiveDemo(acc.key);
    setIsTyping(true);
    setEmailError('');
    setPwdError('');
    await typeValue(setEmail, acc.email, 35);
    await typeValue(setPassword, acc.pass, 45);
    setRole(acc.r);
    setIsTyping(false);
  };

  /* ── Submit Username / Password Handler ── */
  const isFormReady = email.trim() !== '' && password !== '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setPwdError('');

    if (!email.trim()) {
      setEmailError('Email is required.');
      return;
    }
    if (!isEmailValid(email)) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setPwdError('Password is required.');
      return;
    }

    setIsLoading(true);
    try {
      await login(email.trim(), password, role || undefined);
      setIsLoading(false);
      addToast('login_success', 'Authenticated Successfully', `Welcome back, ${email.trim()}`);
      setModal('success');
      setTimeout(() => {
        window.location.hash = '#/dashboard';
      }, 800);
    } catch (err: any) {
      setIsLoading(false);
      setShake(true);
      setTimeout(() => setShake(false), 600);
      setModal('error');
      setModalMsg(err.message || 'Invalid email or password');
    }
  };

  const handleForgotPassword = () => {
    setModal('forgot');
  };

  return (
    <div className="min-h-screen flex overflow-hidden bg-[#030918] selection:bg-cyan-500 selection:text-white">

      {/* ═══════════════════════════════════════════════
          LEFT PANEL — Animated ocean illustration
      ═══════════════════════════════════════════════ */}
      <div className="hidden lg:flex flex-col justify-between w-[52%] relative overflow-hidden bg-gradient-to-br from-[#030c1e] via-[#041830] to-[#061e40]">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] rounded-full bg-cyan-600/10 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-blue-700/10 blur-[140px]" />
        </div>

        <Orb style={{ top: '15%', left: '12%', width: 14, height: 14, background: 'rgba(56,189,248,0.55)', boxShadow: '0 0 24px 6px rgba(56,189,248,0.3)' }} />
        <Orb style={{ top: '40%', left: '70%', width: 10, height: 10, background: 'rgba(6,182,212,0.5)', boxShadow: '0 0 18px 4px rgba(6,182,212,0.25)' }} />
        <Orb style={{ top: '65%', left: '30%', width: 8, height: 8, background: 'rgba(34,211,238,0.6)', boxShadow: '0 0 16px 4px rgba(34,211,238,0.2)' }} />
        <Orb style={{ top: '80%', left: '75%', width: 12, height: 12, background: 'rgba(56,189,248,0.45)', boxShadow: '0 0 20px 5px rgba(56,189,248,0.2)' }} />

        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(#38bdf8 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />

        <div className="absolute bottom-0 left-0 right-0 h-64 overflow-hidden">
          <div className="relative w-full h-full">
            <WaveRow delay={0} opacity={0.18} />
            <WaveRow delay={3} opacity={0.12} />
            <WaveRow delay={6} opacity={0.08} />
          </div>
        </div>

        <div className="relative z-10 flex flex-col justify-center flex-1 px-16 py-20 space-y-10">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-4"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-700 flex items-center justify-center shadow-2xl shadow-cyan-500/30">
              <Waves className="w-7 h-7 text-white" />
            </div>
            <div>
              <span className="text-2xl font-extrabold text-white tracking-tight">
                ORCA <span className="text-cyan-400">Marine EcoSystem</span>
              </span>
              <div className="text-[10px] uppercase tracking-widest text-cyan-400/70 font-bold mt-0.5">
                ENTERPRISE V2.4 • OCEAN PLATFORM
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="space-y-5"
          >
            <h1 className="text-5xl font-black text-white leading-[1.08] tracking-tight">
              AI Powered<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-400">
                Ocean Data
              </span><br />
              Discovery
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
              Query millions of ARGO ocean profiles with natural language. Pre-upload SHA-256 duplicate validation and role-based access control.
            </p>
            <p className="text-xs font-bold tracking-widest text-cyan-400/80 uppercase">
              Secure • Verified • Zero-Trust
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="flex flex-col gap-3"
          >
            {[
              { icon: Shield, label: 'Role-Based Authorization', sub: 'Server-side access control for Admin, Govt & Researchers' },
              { icon: Lock, label: 'Secure Password Authentication', sub: 'Argon2 & Bcrypt encrypted credential verification' },
              { icon: Zap, label: 'SHA-256 Pre-Upload Security', sub: 'Exact & near-duplicate dataset prevention' },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-200">{label}</div>
                  <div className="text-[10px] text-slate-500">{sub}</div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="relative z-10 px-16 pb-10 flex items-center gap-4 flex-wrap"
        >
          {['SHA-256 Checksum', 'Role-Based RBAC', 'SOC 2', 'ISO 27001'].map((b) => (
            <span key={b} className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.07]">
              {b}
            </span>
          ))}
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════════════
          RIGHT PANEL — Clean Login Card
      ═══════════════════════════════════════════════ */}
      <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-cyan-600/8 blur-[120px]" />
          <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-blue-700/8 blur-[120px]" />
        </div>

        <motion.div
          animate={shake ? { x: [-10, 10, -8, 8, -4, 4, 0] } : {}}
          transition={{ duration: 0.55 }}
          className="relative z-10 w-full max-w-[440px]"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="rounded-3xl border border-white/[0.1] bg-white/[0.04] backdrop-blur-2xl shadow-[0_32px_80px_-12px_rgba(0,0,0,0.8)] p-8 space-y-6"
          >
            {/* Header */}
            <div className="text-center space-y-4">
              <div className="relative mx-auto w-fit">
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-700 flex items-center justify-center shadow-2xl shadow-cyan-500/40"
                >
                  <Waves className="w-8 h-8 text-white" />
                </motion.div>
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500" />
                </span>
              </div>

              <div>
                <h2 className="text-2xl font-extrabold text-white tracking-tight">
                  Welcome Back
                </h2>
                <p className="text-xs text-slate-400 mt-1">Please sign in to continue</p>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[11px] font-bold text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                Secure Login
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Email Address
                </label>
                <div className="relative group">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
                    placeholder="Enter your email address"
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs bg-white/[0.05] border ${emailError ? 'border-rose-500/60 focus:ring-rose-500/30' : 'border-white/[0.08] focus:border-cyan-500/50'} text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 transition-all`}
                  />
                </div>
                <AnimatePresence>
                  {emailError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="text-[11px] text-rose-400 flex items-center gap-1.5"
                    >
                      <XCircle className="w-3 h-3" /> {emailError}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors font-semibold"
                  >
                    Forgot Password?
                  </button>
                </div>

                <div className="relative group">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setPwdError(''); }}
                    onFocus={() => setPwdFocused(true)}
                    onBlur={() => setPwdFocused(false)}
                    placeholder="Enter your password"
                    className={`w-full pl-10 pr-10 py-2.5 rounded-xl text-xs bg-white/[0.05] border ${pwdError ? 'border-rose-500/60' : 'border-white/[0.08] focus:border-cyan-500/50'} text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 transition-all`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {capsLock && (
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" /> ⚠ Caps Lock is ON
                  </div>
                )}

                {pwdError && (
                  <p className="text-[11px] text-rose-400 flex items-center gap-1.5">
                    <XCircle className="w-3 h-3" /> {pwdError}
                  </p>
                )}

                <AnimatePresence>
                  {(pwdFocused || (password.length > 0 && !isPasswordValid(pwdRules))) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 p-3 rounded-xl bg-slate-900/60 border border-white/[0.07] grid grid-cols-2 gap-1.5">
                        <RuleItem passed={pwdRules.minLength} label="Min 8 characters" />
                        <RuleItem passed={pwdRules.hasUpper} label="Uppercase letter" />
                        <RuleItem passed={pwdRules.hasLower} label="Lowercase letter" />
                        <RuleItem passed={pwdRules.hasNumber} label="One number" />
                        <RuleItem passed={pwdRules.hasSpecial} label="Special character" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Access Role Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Access Role
                </label>
                <select
                  id="login-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className={`w-full px-3 py-2.5 rounded-xl text-xs bg-white/[0.05] border border-white/[0.08] focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/25 focus:outline-none transition-all appearance-none ${
                    role === '' ? 'text-slate-500' : 'text-slate-100'
                  }`}
                >
                  <option value="" disabled className="bg-slate-900 text-slate-500">Select Access Role</option>
                  {(Object.entries(ROLE_CONFIG) as [UserRole, typeof ROLE_CONFIG[UserRole]][]).map(([key, cfg]) => (
                    <option key={key} value={key} className="bg-slate-900 text-slate-100">
                      {cfg.emoji} {cfg.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Remember Me */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setRememberMe(!rememberMe)}
                  className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {rememberMe
                    ? <CheckSquare className="w-4 h-4 text-cyan-400" />
                    : <Square className="w-4 h-4 text-slate-600" />}
                  Remember me (30 days)
                </button>
                <span className="text-[10px] text-slate-600 font-mono">Rate-limit: 20 req/min</span>
              </div>

              {/* Submit Button */}
              <motion.button
                type="submit"
                disabled={isLoading || !isFormReady}
                whileHover={{ scale: (isLoading || !isFormReady) ? 1 : 1.015 }}
                whileTap={{ scale: (isLoading || !isFormReady) ? 1 : 0.985 }}
                className="relative w-full py-3 rounded-xl font-bold text-sm text-white overflow-hidden transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-xl shadow-cyan-500/20 cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 50%, #06b6d4 100%)' }}
              >
                <span className="relative flex items-center justify-center gap-2">
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Authenticating…
                    </>
                  ) : (
                    <>
                      Sign In to ORCA Marine EcoSystem
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </span>
              </motion.button>
            </form>

            {/* Quick Demo Access Section */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/[0.07]" />
                <div className="text-center">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-400">
                    ⚡ Quick Demo Access
                  </p>
                </div>
                <div className="flex-1 h-px bg-white/[0.07]" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {([
                  {
                    key: 'admin',
                    emoji: '🛡',
                    title: 'System Administrator',
                    email: 'admin@gmail.com',
                    pass: 'Admin@123',
                    r: 'Admin' as UserRole,
                    label: 'Login as Admin',
                    accent: 'from-rose-500/20 to-rose-600/10 border-rose-500/30 hover:border-rose-400/60',
                    accentActive: 'from-rose-500/35 to-rose-600/25 border-rose-400/70 shadow-rose-500/20',
                    btnColor: 'from-rose-600 to-rose-500',
                  },
                  {
                    key: 'govt',
                    emoji: '🏛',
                    title: 'Government Agency',
                    email: 'govp@gmail.com',
                    pass: 'Gov@123',
                    r: 'Government' as UserRole,
                    label: 'Login as Govt',
                    accent: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 hover:border-emerald-400/60',
                    accentActive: 'from-emerald-500/35 to-emerald-600/25 border-emerald-400/70 shadow-emerald-500/20',
                    btnColor: 'from-emerald-600 to-emerald-500',
                  },
                  {
                    key: 'researcher',
                    emoji: '🔬',
                    title: 'Research Scientist',
                    email: 'research@gmail.com',
                    pass: 'Research@123',
                    r: 'Researcher' as UserRole,
                    label: 'Login as Researcher',
                    accent: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 hover:border-blue-400/60',
                    accentActive: 'from-blue-500/35 to-blue-600/25 border-blue-400/70 shadow-blue-500/20',
                    btnColor: 'from-blue-600 to-blue-500',
                  },
                  {
                    key: 'student',
                    emoji: '🎓',
                    title: 'Student Access',
                    email: 'student@gmail.com',
                    pass: 'Student@123',
                    r: 'Student' as UserRole,
                    label: 'Login as Student',
                    accent: 'from-purple-500/20 to-purple-600/10 border-purple-500/30 hover:border-purple-400/60',
                    accentActive: 'from-purple-500/35 to-purple-600/25 border-purple-400/70 shadow-purple-500/20',
                    btnColor: 'from-purple-600 to-purple-500',
                  },
                  {
                    key: 'shipping',
                    emoji: '🚢',
                    title: 'Shipping Maritime',
                    email: 'shipping@gmail.com',
                    pass: 'Shipping@123',
                    r: 'Shipping' as UserRole,
                    label: 'Login as Shipping',
                    accent: 'from-amber-500/20 to-amber-600/10 border-amber-500/30 hover:border-amber-400/60',
                    accentActive: 'from-amber-500/35 to-amber-600/25 border-amber-400/70 shadow-amber-500/20',
                    btnColor: 'from-amber-600 to-amber-500',
                  },
                  {
                    key: 'coastguard',
                    emoji: '🛡️',
                    title: 'Coastal Guard',
                    email: 'coastguard@gmail.com',
                    pass: 'CoastGuard@123',
                    r: 'Coastal Guard' as UserRole,
                    label: 'Login as Coastal Guard',
                    accent: 'from-orange-500/20 to-orange-600/10 border-orange-500/30 hover:border-orange-400/60',
                    accentActive: 'from-orange-500/35 to-orange-600/25 border-orange-400/70 shadow-orange-500/20',
                    btnColor: 'from-orange-600 to-orange-500',
                  },
                ] as const).map((acc) => {
                  const isActive = activeDemo === acc.key;
                  return (
                    <motion.button
                      key={acc.key}
                      type="button"
                      disabled={isTyping}
                      onClick={() => typeCredentials(acc)}
                      whileHover={{ scale: isTyping ? 1 : 1.025, y: isTyping ? 0 : -1 }}
                      whileTap={{ scale: isTyping ? 1 : 0.97 }}
                      className={`relative rounded-2xl p-3 text-left border bg-gradient-to-br transition-all duration-300 overflow-hidden shadow-lg cursor-pointer ${
                        isActive ? `${acc.accentActive} shadow-lg` : `${acc.accent} shadow-sm`
                      } disabled:opacity-60 disabled:cursor-wait`}
                    >
                      <div className="relative z-10 space-y-1.5">
                        <div className="flex items-start justify-between gap-1">
                          <span className="text-xl leading-none">{acc.emoji}</span>
                          {isActive && isTyping && (
                            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-white">
                              Typing…
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] font-extrabold text-white leading-tight">{acc.title}</p>
                          <p className="text-[9px] text-slate-500 font-mono mt-0.5 truncate">{acc.email}</p>
                        </div>
                        <div className={`w-full py-1 rounded-lg text-[8px] font-bold text-white text-center bg-gradient-to-r ${acc.btnColor}`}>
                          {acc.label}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-white/[0.07] text-center space-y-4">
              <div className="space-y-1">
                <p className="text-[11px] text-slate-500">Don't have an account?</p>
                <a
                  href="#/register"
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  Create ORCA Marine EcoSystem Account <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
              <div className="pt-3 border-t border-white/[0.04]">
                <a
                  href="#/admin-login"
                  className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <KeyRound className="w-3 h-3" /> Access Admin Portal
                </a>
              </div>
            </div>

          </motion.div>

          <p className="mt-5 text-center text-[11px] text-slate-600">
            © 2026 ORCA Marine EcoSystem — ARGO Ocean Data Platform v2.4.0
          </p>
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════════════
          MODAL OVERLAYS
      ═══════════════════════════════════════════════ */}
      <AnimatePresence>
        {modal === 'error' && (
          <Modal onClose={() => setModal(null)}>
            <div className="rounded-2xl bg-[#0d1628] border border-rose-500/30 shadow-2xl p-6 space-y-5 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center">
                <XCircle className="w-7 h-7 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Login Failed</h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{modalMsg}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setModal(null)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.09] transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setModal(null);
                    if (email && password) {
                      handleSubmit({ preventDefault: () => {} } as any);
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-rose-500 hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Retry
                </button>
              </div>
            </div>
          </Modal>
        )}

        {modal === 'success' && (
          <Modal onClose={() => {}}>
            <div className="rounded-2xl bg-[#0d1628] border border-emerald-500/30 shadow-2xl p-6 space-y-5 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Login Successful</h3>
                <p className="text-xs text-slate-400 mt-1.5">
                  Redirecting to dashboard…
                </p>
              </div>
              <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 0.8, ease: 'linear' }}
                  className="h-full bg-emerald-500 rounded-full"
                />
              </div>
            </div>
          </Modal>
        )}

        {modal === 'forgot' && (
          <Modal onClose={() => setModal(null)}>
            <div className="rounded-2xl bg-[#0d1628] border border-cyan-500/30 shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-cyan-400" /> Reset Password
                </h3>
                <button onClick={() => setModal(null)} className="text-slate-500 hover:text-white transition-colors cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Enter your registered email address and we'll send a secure password reset link.
              </p>
              <input
                type="email"
                defaultValue={email}
                placeholder="name@argo-ocean.org"
                className="w-full px-3 py-2.5 rounded-xl text-xs bg-white/[0.05] border border-white/[0.08] focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 text-slate-100 placeholder-slate-500"
              />
              <button
                onClick={() => {
                  setModal(null);
                  addToast('info', 'Password Reset Requested', 'If an account exists with this email, password reset instructions have been dispatched.');
                }}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-sky-600 to-cyan-500 hover:opacity-90 transition-opacity cursor-pointer"
              >
                Send Reset Link
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
};
