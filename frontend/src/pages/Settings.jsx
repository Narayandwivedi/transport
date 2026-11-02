import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Monitor, Moon, Save, Sun } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { getStoredTheme, setStoredTheme } from '../utils/theme';
import FormSection from '../components/FormSection';
import Segmented from '../components/Segmented';
import { Field, MoneyInput, Page, PageHeader } from '../components/ui';

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(getStoredTheme());
  const [form, setForm] = useState(() => ({
    name: user?.name || '',
    companyName: user?.companyName || '',
    mobile: user?.mobile || '',
    email: user?.email || '',
    address: user?.address || '',
    gstin: user?.gstin || '',
    quotationTerms: user?.quotationTerms || '',
    documentReminderDays: user?.documentReminderDays ?? 15,
    currentPassword: '',
    newPassword: '',
  }));
  const [saving, setSaving] = useState(false);
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const changeTheme = (value) => {
    setTheme(value);
    setStoredTheme(value);
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await apiClient.put('/auth/me', form);
      setUser(response.user);
      setForm((prev) => ({ ...prev, currentPassword: '', newPassword: '' }));
      toast.success('Settings saved');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <Page>
      <PageHeader title="Settings" subtitle="Company details for quotations, alerts and appearance">
        <button type="button" className="btn-secondary" onClick={signOut}><LogOut size={16} /> Sign Out</button>
      </PageHeader>

      <form onSubmit={save} className="grid max-w-5xl gap-3 lg:grid-cols-2">
        <FormSection number={1} title="Company" tone="blue" hint="Printed on the top of every quotation">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Your Name" htmlFor="set-name"><input id="set-name" className="input" value={form.name} onChange={(event) => set('name', event.target.value)} required /></Field>
            <Field label="Company Name" htmlFor="set-company"><input id="set-company" className="input" value={form.companyName} onChange={(event) => set('companyName', event.target.value)} /></Field>
            <Field label="Mobile" htmlFor="set-mobile"><input id="set-mobile" className="input" value={form.mobile} onChange={(event) => set('mobile', event.target.value)} /></Field>
            <Field label="Email" htmlFor="set-email"><input id="set-email" type="email" className="input" value={form.email} onChange={(event) => set('email', event.target.value)} /></Field>
            <Field label="GSTIN" htmlFor="set-gstin" className="col-span-2"><input id="set-gstin" className="input uppercase" value={form.gstin} onChange={(event) => set('gstin', event.target.value)} /></Field>
          </div>
          <Field label="Address" htmlFor="set-address"><textarea id="set-address" className="input min-h-[70px]" value={form.address} onChange={(event) => set('address', event.target.value)} /></Field>
        </FormSection>

        <div className="space-y-3">
          <FormSection number={2} title="Alerts" tone="amber">
            <Field label="Warn about a document this many days before it expires">
              <MoneyInput prefix="" suffix="days" value={form.documentReminderDays} onChange={(value) => set('documentReminderDays', value)} />
            </Field>
          </FormSection>

          <FormSection number={3} title="Appearance" tone="slate" hint="Kept on this device">
            <Segmented
              value={theme}
              onChange={changeTheme}
              options={[{ key: 'light', label: 'Light', icon: Sun }, { key: 'soft', label: 'Soft', icon: Monitor }, { key: 'dark', label: 'Dark', icon: Moon }]}
            />
          </FormSection>

          <FormSection number={4} title="Change Password" tone="indigo">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Current" htmlFor="set-cur"><input id="set-cur" type="password" className="input" value={form.currentPassword} onChange={(event) => set('currentPassword', event.target.value)} autoComplete="current-password" /></Field>
              <Field label="New" htmlFor="set-new"><input id="set-new" type="password" className="input" value={form.newPassword} onChange={(event) => set('newPassword', event.target.value)} minLength={6} autoComplete="new-password" /></Field>
            </div>
          </FormSection>
        </div>

        <FormSection number={5} title="Default Quotation Terms" tone="emerald">
          <textarea className="input min-h-[130px]" value={form.quotationTerms} onChange={(event) => set('quotationTerms', event.target.value)} />
        </FormSection>

        <div className="flex items-end justify-end lg:col-span-2">
          <button type="submit" className="btn-primary px-8" disabled={saving}><Save size={16} /> Save Settings</button>
        </div>
      </form>
    </Page>
  );
}
