import { useState } from 'react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import FormPopup from './FormPopup';
import FormSection from './FormSection';
import { Field } from './ui';

/** Add a material I supply on trips. onSaved gets the saved material, so Add Trip can pick it straight away. */
export default function MaterialPopup({ onClose, onSaved }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const saved = await apiClient.post('/materials', { name });
      toast.success('Material added');
      onSaved?.(saved);
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormPopup title="Add Material" subtitle="A material you supply on trips" maxWidth="max-w-md" onClose={onClose} onSubmit={handleSubmit} submitDisabled={saving}>
      <FormSection number={1} title="Material" tone="emerald">
        <Field label="Material Name" required htmlFor="material-name">
          <input id="material-name" className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Sand, Gitti, Cement" required autoFocus />
        </Field>
      </FormSection>
    </FormPopup>
  );
}
