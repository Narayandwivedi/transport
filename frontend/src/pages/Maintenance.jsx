import { useState } from 'react';
import { AlarmClock, CheckCircle2, Plus, Siren, Wrench } from 'lucide-react';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';
import useFetch from '../utils/useFetch';
import { useAlerts } from '../context/AlertsContext';
import StatCard from '../components/StatCard';
import Segmented from '../components/Segmented';
import MaintenanceTable from '../components/MaintenanceTable';
import { DonePopup, ScheduleForm } from '../components/MaintenancePopups';
import { EmptyState, ErrorBox, Loading, Page, PageHeader, PanelHeader } from '../components/ui';

export default function Maintenance() {
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState(null);
  const [done, setDone] = useState(null);
  const { reload: reloadAlerts } = useAlerts();
  const { data: tasks, loading, error, reload } = useFetch('/maintenance', {}, []);

  const all = tasks || [];
  const order = { overdue: 0, due_soon: 1, ok: 2 };
  const list = all.filter((task) => !status || task.status === status).sort((a, b) => order[a.status] - order[b.status]);
  const count = (key) => all.filter((task) => task.status === key).length;

  const refresh = () => {
    reload();
    reloadAlerts();
  };

  const handleDelete = async (task) => {
    if (!window.confirm(`Delete "${task.title}" schedule?`)) return;
    try {
      await apiClient.delete(`/maintenance/${task._id}`);
      toast.success('Deleted');
      refresh();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Page>
      <PageHeader title="Maintenance" subtitle="Service alerts by km run (from meter readings) or by days passed">
        <button type="button" className="btn-primary" onClick={() => setEditing({})}><Plus size={18} /> Add Schedule</button>
      </PageHeader>
      <ErrorBox message={error} />

      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
        <StatCard compact icon={Wrench} tone="indigo" label="Schedules" value={all.length} />
        <StatCard compact icon={Siren} tone="rose" label="Overdue" value={count('overdue')} />
        <StatCard compact icon={AlarmClock} tone="amber" label="Due Soon" value={count('due_soon')} />
        <StatCard compact icon={CheckCircle2} tone="emerald" label="OK" value={count('ok')} />
      </section>

      <section className="panel">
        <PanelHeader title="Service Schedules" count={list.length} onRefresh={refresh} loading={loading}>
          <Segmented value={status} onChange={setStatus} options={[{ key: '', label: 'All' }, { key: 'overdue', label: 'Overdue' }, { key: 'due_soon', label: 'Due Soon' }, { key: 'ok', label: 'OK' }]} />
        </PanelHeader>
        {loading && !all.length ? <Loading /> : list.length === 0 ? (
          <EmptyState title="No service schedules" hint="Add oil change, service, greasing… for each vehicle. Keep meter readings up to date." />
        ) : (
          <MaintenanceTable tasks={list} onDone={setDone} onEdit={setEditing} onDelete={handleDelete} />
        )}
      </section>

      {editing && <ScheduleForm task={editing._id ? editing : null} onClose={() => setEditing(null)} onSaved={refresh} />}
      {done && <DonePopup task={done} onClose={() => setDone(null)} onSaved={refresh} />}
    </Page>
  );
}
