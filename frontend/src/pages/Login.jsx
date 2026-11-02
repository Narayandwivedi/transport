import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Building2, Eye, EyeOff, Loader2, Lock, LogIn, Mail, ShieldCheck, Smartphone, User } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

const INPUT = 'w-full rounded-lg border border-slate-300 bg-white py-3 pl-11 pr-4 text-[15px] font-medium text-slate-800 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-primary-600 focus:ring-4 focus:ring-primary-600/10 disabled:opacity-60';
const BUTTON = 'flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary-700 px-4 py-3.5 text-[15px] font-bold text-white shadow-md shadow-primary-700/20 transition hover:bg-primary-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60';
const LINK = 'cursor-pointer text-sm font-semibold text-primary-700 hover:text-primary-900 hover:underline';

const HEADINGS = {
  login: ['Login to TransportBook', 'Welcome back 👋 Sign in to manage your vehicles and trips.'],
  register: ['Create your free account', 'Start managing your transport business with TransportBook.'],
};

function IconInput({ icon: Icon, className = '', ...props }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
        <Icon size={20} />
      </span>
      <input className={`${INPUT} ${className}`} {...props} />
    </div>
  );
}

function PasswordInput({ show, onToggle, ...props }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
        <Lock size={20} />
      </span>
      <input type={show ? 'text' : 'password'} className={`${INPUT} pr-11`} {...props} />
      <button
        type="button"
        onClick={onToggle}
        className="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-3.5 text-slate-400 transition-colors hover:text-slate-600"
        title={show ? 'Hide password' : 'Show password'}
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <Eye size={20} /> : <EyeOff size={20} />}
      </button>
    </div>
  );
}

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ login: '', password: '', name: '', companyName: '', mobile: '', email: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const update = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setShowPassword(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const result = mode === 'login'
      ? await login(form.login, form.password)
      : await register({ name: form.name, companyName: form.companyName, mobile: form.mobile, email: form.email, password: form.password });
    setBusy(false);
    if (!result.success) {
      setError(result.message);
      return;
    }
    toast.success(mode === 'login' ? 'Welcome back' : 'Account created');
    navigate('/', { replace: true });
  };

  const [title, subtitle] = HEADINGS[mode];

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-100 p-4 sm:p-6">
      <div className="grid w-full max-w-[1000px] overflow-hidden rounded-2xl bg-white shadow-2xl shadow-slate-300/60 lg:grid-cols-2">
        {/* Left brand panel */}
        <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#1f2a3c] via-[#27374f] to-[#314866] p-12 text-white lg:flex lg:flex-col lg:justify-center">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/[0.06]" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-white/[0.05]" />
          <div className="pointer-events-none absolute bottom-16 right-12 h-24 w-24 rounded-full bg-sky-400/15" />
          <div className="relative">
            <p className="text-[2.5rem] font-bold leading-[1.15]">Your Fleet,<br />Simplified.</p>
            <p className="mt-5 max-w-sm text-lg leading-relaxed text-slate-300">
              Manage vehicles, trips, expenses and documents from one simple dashboard.
            </p>
            <div className="mt-10 flex items-center gap-3 border-t border-white/30 pt-6">
              <ShieldCheck size={24} />
              <span className="font-medium">Safe &amp; Secure</span>
            </div>
          </div>
        </div>

        {/* Right form panel */}
        <div className="flex flex-col justify-center px-6 py-10 sm:px-12 sm:py-12">
          <div className="mb-10 flex justify-center">
            <Logo subtitle="Transport Management" />
          </div>

          <div className="mb-6">
            <h1 className="text-[1.75rem] font-bold text-slate-900 sm:text-[2rem]">{title}</h1>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3.5">
              <AlertCircle size={20} className="shrink-0 text-red-600" />
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {mode === 'login' ? (
              <div className="space-y-4">
                <IconInput icon={Smartphone} value={form.login} onChange={update('login')} placeholder="Mobile Number or Email" autoComplete="username" required autoFocus disabled={busy} />
                <PasswordInput show={showPassword} onToggle={() => setShowPassword((v) => !v)} value={form.password} onChange={update('password')} placeholder="Password" autoComplete="current-password" required disabled={busy} />
              </div>
            ) : (
              <div className="space-y-4">
                <IconInput icon={User} value={form.name} onChange={update('name')} placeholder="Full Name" required autoFocus disabled={busy} />
                <IconInput icon={Building2} value={form.companyName} onChange={update('companyName')} placeholder="Company / Transport Name (optional)" disabled={busy} />
                <IconInput icon={Smartphone} value={form.mobile} onChange={update('mobile')} placeholder="Mobile Number" inputMode="tel" disabled={busy} />
                <IconInput icon={Mail} type="email" value={form.email} onChange={update('email')} placeholder="Email Address" disabled={busy} />
                <PasswordInput show={showPassword} onToggle={() => setShowPassword((v) => !v)} value={form.password} onChange={update('password')} placeholder="Password (min. 6 characters)" autoComplete="new-password" required minLength={6} disabled={busy} />
              </div>
            )}

            <button type="submit" disabled={busy} className={`${BUTTON} mt-6`}>
              {busy ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>{mode === 'login' ? 'Logging in...' : 'Creating...'}</span>
                </>
              ) : mode === 'login' ? (
                <>
                  <LogIn size={20} />
                  <span>Login</span>
                </>
              ) : (
                <span>Create Account</span>
              )}
            </button>
          </form>

          <p className="mt-10 text-center text-sm text-slate-500">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button type="button" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')} className={LINK}>
              {mode === 'login' ? 'Register Now' : 'Login'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
