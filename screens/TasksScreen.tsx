import React, { useMemo, useState } from 'react';
import { ICONS, COLORS } from '../constants';
import { Task } from '../types';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

// ✅ CHANGE THIS IMPORT PATH if your file name/location differs
import { pushAllToGoogleCalendar } from '../services/gemini';

interface TasksScreenProps {
  plan: string;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  addAction: (type: string, input: any) => void;

  // kept optional so your current app won’t break if it still passes it
  syncToCalendar?: (title: string, date: string | null) => void;
}

const TasksScreen: React.FC<TasksScreenProps> = ({
  plan,
  tasks,
  setTasks,
  addAction,
  syncToCalendar, // legacy
}) => {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [formTask, setFormTask] = useState({ title: '', due_at: '', recurring: 'none' });
  const [isLoading, setIsLoading] = useState(false);

  // Simple UI feedback (success/error)
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const isPro = useMemo(() => (plan || '').toLowerCase() === 'pro', [plan]);

  /**
   * TIMEZONE: Use user timezone for parsing+display.
   */
  const userTimeZone = useMemo(() => {
    const fromStorage =
      localStorage.getItem('timezone') ||
      localStorage.getItem('user_timezone') ||
      localStorage.getItem('selectedTimezone') ||
      localStorage.getItem('selected_time_zone') ||
      localStorage.getItem('timeZone');

    const tz = fromStorage?.trim();
    if (tz) return tz;

    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }, []);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToast(null), 3500);
  };

  /**
   * Convert datetime-local (YYYY-MM-DDTHH:mm) representing a time in userTimeZone
   * into a UTC ISO string for storage.
   */
  const datetimeLocalToUtcIso = (datetimeLocal: string, tz: string) => {
    if (!datetimeLocal) return new Date().toISOString();

    const [datePart, timePart] = datetimeLocal.split('T');
    if (!datePart || !timePart) return new Date().toISOString();

    const [y, m, d] = datePart.split('-').map(Number);
    const [hh, mm] = timePart.split(':').map(Number);

    if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) return new Date().toISOString();

    let guess = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));

    const getPartsInTz = (date: Date) => {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(date);

      const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
      return {
        year: get('year'),
        month: get('month'),
        day: get('day'),
        hour: get('hour'),
        minute: get('minute'),
      };
    };

    const desired = { year: y, month: m, day: d, hour: hh, minute: mm };

    for (let i = 0; i < 2; i++) {
      const got = getPartsInTz(guess);
      const desiredMinutes = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute) / 60000;
      const gotMinutes = Date.UTC(got.year, got.month - 1, got.day, got.hour, got.minute) / 60000;
      const diffMinutes = desiredMinutes - gotMinutes;
      if (diffMinutes === 0) break;
      guess = new Date(guess.getTime() + diffMinutes * 60000);
    }

    return guess.toISOString();
  };

  /**
   * Format a stored UTC ISO date in the user's timezone for display.
   */
  const formatDateShortInTz = (iso?: string | null) => {
    if (!iso) return 'No Due Date';
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return 'No Due Date';

      return new Intl.DateTimeFormat('en-GB', {
        timeZone: userTimeZone,
        day: '2-digit',
        month: 'short',
      }).format(d);
    } catch {
      return 'No Due Date';
    }
  };

  /**
   * Convert stored UTC ISO -> datetime-local string in userTimeZone ("YYYY-MM-DDTHH:mm")
   */
  const utcIsoToDatetimeLocalInTz = (iso?: string | null) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';

      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: userTimeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(d);

      const get = (t: string) => parts.find(p => p.type === t)?.value || '';
      const YYYY = get('year');
      const MM = get('month');
      const DD = get('day');
      const HH = get('hour');
      const MIN = get('minute');

      return `${YYYY}-${MM}-${DD}T${HH}:${MIN}`;
    } catch {
      return '';
    }
  };

  /**
   * ✅ Convert task recurrence to Google Calendar RRULE
   * Your DB stores recurring_rule like "FREQ=DAILY" etc.
   */
  const toRRule = (recurring: string) => {
    if (!recurring || recurring === 'none') return '';
    const freq = recurring.toUpperCase();

    if (freq === 'DAILY') return 'RRULE:FREQ=DAILY';
    if (freq === 'WEEKLY') return 'RRULE:FREQ=WEEKLY';
    if (freq === 'MONTHLY') return 'RRULE:FREQ=MONTHLY';

    return '';
  };

  /**
   * ✅ Pro: sync a single task to Google Calendar
   * Uses pushAllToGoogleCalendar({ tasks:[...] }) so we don’t need another helper.
   */
  const syncSingleTaskToGoogle = async (task: Task) => {
    if (!isPro) return;

    const recurringValue =
      task.recurring_rule?.includes('=') ? task.recurring_rule.split('=')[1] : '';

    const rrule = recurringValue ? toRRule(recurringValue.toLowerCase()) : '';

    try {
      await pushAllToGoogleCalendar({
        tasks: [
          {
            id: task.id,
            uuid: (task as any).uuid,
            title: task.title,
            description: task.description || 'Action Item',
            due_at: task.due_at || new Date().toISOString(),
            priority: (task as any).priority || 'medium',
            recurrence: rrule || undefined,
          } as any,
        ],
      });

      showToast('success', 'Saved. Task synced to Google Calendar.');
    } catch (e: any) {
      // legacy fallback (won’t truly sync)
      try {
        if (syncToCalendar) syncToCalendar(task.title, task.due_at || null);
      } catch {}

      showToast(
        'info',
        e?.message
          ? `Saved. Google sync failed: ${e.message}`
          : 'Saved. Could not sync to Google Calendar right now.'
      );
    }
  };

  const toggleStatus = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      const newStatus = task.status === 'done' ? 'todo' : 'done';

      const { data, error } = await supabase
        .from('tasks')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', task.id)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setTasks(prev => prev.map(t => (t.id === task.id ? data : t)));
        addAction('toggle_task', { id: task.id });
        showToast('success', newStatus === 'done' ? 'Nice. Task marked as done.' : 'Okay. Task moved back to To-Do.');
      }
    } catch (err: any) {
      console.error(err);
      showToast('error', err?.message ? `Could not update task: ${err.message}` : 'Could not update task. Please try again.');
    }
  };

  const handleSaveTask = async () => {
    if (!formTask.title.trim() || isLoading) {
      if (!formTask.title.trim()) showToast('info', 'Please enter a task title.');
      return;
    }

    // Pro gating for recurrence
    if (formTask.recurring !== 'none' && !isPro) {
      showToast('info', 'Recurring tasks are a Pro feature. Upgrade to Pro to use recurrence.');
      navigate('/paywall');
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      if (!user) {
        showToast('error', 'You are not signed in. Please sign in and try again.');
        return;
      }

      const taskDueUtcIso = formTask.due_at
        ? datetimeLocalToUtcIso(formTask.due_at, userTimeZone)
        : new Date().toISOString();

      const recurringRuleDb =
        formTask.recurring !== 'none' ? `FREQ=${formTask.recurring.toUpperCase()}` : null;

      if (isEditing && selectedTask) {
        const { data, error } = await supabase
          .from('tasks')
          .update({
            title: formTask.title,
            due_at: taskDueUtcIso,
            recurring_rule: recurringRuleDb,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedTask.id)
          .select()
          .single();

        if (error) throw error;

        if (data) {
          setTasks(prev => prev.map(t => (t.id === selectedTask.id ? data : t)));
          addAction('manual_task_update', { id: selectedTask.id });
          showToast('success', 'Updated. Your task has been saved.');

          if (isPro) {
            await syncSingleTaskToGoogle(data);
          } else {
            showToast('info', 'Saved. Upgrade to Pro to sync tasks to Google Calendar and get reminders.');
          }
        }
      } else {
        const { data, error } = await supabase
          .from('tasks')
          .insert([{
            user_id: user.id,
            title: formTask.title,
            description: 'Action Item',
            due_at: taskDueUtcIso,
            priority: 'medium',
            status: 'todo',
            recurring_rule: recurringRuleDb,
          }])
          .select()
          .single();

        if (error) throw error;

        if (data) {
          setTasks(prev => [data, ...prev]);
          addAction('manual_task_create', { title: formTask.title });
          showToast('success', 'Saved. Your task has been added to Tasks.');

          if (isPro) {
            await syncSingleTaskToGoogle(data);
          } else {
            showToast('info', 'Saved. Upgrade to Pro to sync tasks to Google Calendar and get reminders.');
          }
        }
      }

      setIsCreating(false);
      setIsEditing(false);
      setSelectedTask(null);
      setFormTask({ title: '', due_at: '', recurring: 'none' });
    } catch (err: any) {
      console.error(err);
      showToast('error', err?.message ? `Could not save task: ${err.message}` : 'Could not save task. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (task: Task) => {
    setSelectedTask(task);
    setIsEditing(true);

    setFormTask({
      title: task.title,
      due_at: utcIsoToDatetimeLocalInTz(task.due_at || ''),
      recurring: task.recurring_rule ? task.recurring_rule.split('=')[1].toLowerCase() : 'none',
    });
  };

  const deleteTask = async (id: string) => {
    if (!id) return;

    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;

      setTasks(prev => prev.filter(t => t.id !== id));
      addAction('manual_task_delete', { id });
      setIsEditing(false);
      setSelectedTask(null);

      showToast('success', 'Deleted. Your task has been removed.');
    } catch (err: any) {
      console.error(err);
      showToast('error', err?.message ? `Could not delete task: ${err.message}` : 'Could not delete task. Please try again.');
    }
  };

  return (
    <div className="p-6 relative min-h-full">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-0 right-0 z-[200] flex justify-center px-4">
          <div
            className={`max-w-md w-full rounded-2xl px-4 py-3 shadow-xl border text-sm font-semibold ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                : toast.type === 'info'
                ? 'bg-slate-50 text-slate-700 border-slate-100'
                : 'bg-red-50 text-red-700 border-red-100'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      <header className="flex justify-between items-end mb-10 pt-4">
        <div>
          <p className="font-black uppercase tracking-widest text-[10px] mb-2" style={{ color: COLORS.primary }}>
            Personal Ledger
          </p>
          <h1 className="text-4xl font-black text-slate-900 leading-none">Tasks</h1>
        </div>

        <button
          onClick={() => {
            setIsCreating(true);
            setIsEditing(false);
            setFormTask({ title: '', due_at: '', recurring: 'none' });
          }}
          className="p-4 text-white rounded-[24px] shadow-xl active:scale-95 transition-all"
          style={{ backgroundColor: COLORS.primary }}
        >
          <ICONS.Plus className="w-6 h-6" />
        </button>
      </header>

      <div className="space-y-4 pb-32">
        {tasks.map((task) => (
          <div
            key={task.id}
            onClick={() => startEditing(task)}
            className={`p-5 rounded-[28px] border flex items-center space-x-4 transition-all cursor-pointer ${
              task.status === 'done'
                ? 'bg-slate-50 opacity-60'
                : 'bg-white border-slate-100 shadow-sm'
            }`}
          >
            <div
              onClick={(e) => toggleStatus(task, e)}
              className={`w-7 h-7 rounded-full border-2 flex items-center justify-center cursor-pointer ${
                task.status === 'done'
                  ? 'bg-teal-500 border-teal-500'
                  : 'border-slate-200 hover:border-teal-300'
              }`}
            >
              {task.status === 'done' && <ICONS.Check className="w-4 h-4 text-white" strokeWidth={4} />}
            </div>

            <div className="flex-1 text-left truncate">
              <h4 className={`text-sm font-bold truncate ${task.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                {task.title}
              </h4>

              <div className="flex items-center space-x-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">
                  {formatDateShortInTz(task.due_at)}
                </p>
                {task.recurring_rule && (
                  <span className="text-[8px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded font-black uppercase">
                    Recurring
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {tasks.length === 0 && (
          <div className="py-20 text-center opacity-40 italic">Start by adding your first task.</div>
        )}
      </div>

      {(isCreating || isEditing) && (
        <div className="fixed inset-0 z-[120] bg-slate-900/70 backdrop-blur-md flex items-end p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md mx-auto rounded-[40px] p-8 pb-12 animate-in slide-in-from-bottom duration-300 shadow-2xl">
            <h2 className="text-2xl font-black mb-8 text-slate-800">
              {isEditing ? 'Edit Task' : 'New Task'}
            </h2>

            <div className="space-y-5">
              <input
                type="text"
                placeholder="Task Title"
                value={formTask.title}
                onChange={e => setFormTask({ ...formTask, title: e.target.value })}
                className="w-full bg-slate-50 border-none rounded-2xl py-5 px-6 text-sm outline-none font-bold"
              />

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-4">
                  Due Date & Time
                </p>
                <input
                  type="datetime-local"
                  value={formTask.due_at}
                  onChange={e => setFormTask({ ...formTask, due_at: e.target.value })}
                  className="w-full bg-slate-50 border-none rounded-2xl py-5 px-6 text-sm outline-none font-bold"
                />
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Recurrence
                  </p>
                  {!isPro && <ICONS.Lock className="w-3 h-3 text-slate-300" />}
                </div>

                <select
                  value={formTask.recurring}
                  onChange={e => setFormTask({ ...formTask, recurring: e.target.value })}
                  className="w-full bg-transparent text-sm font-bold outline-none text-slate-700"
                >
                  <option value="none">One-time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>

                {!isPro && (
                  <p className="text-[11px] text-slate-400 font-semibold mt-2">
                    Recurring tasks are available on Pro.
                  </p>
                )}
              </div>

              <div className="flex space-x-3 pt-4">
                {isEditing && selectedTask && (
                  <button
                    onClick={() => deleteTask(selectedTask.id)}
                    className="flex-1 py-4 bg-red-50 text-red-500 rounded-2xl font-black uppercase text-[10px] tracking-widest"
                  >
                    Delete
                  </button>
                )}

                <button
                  onClick={handleSaveTask}
                  disabled={isLoading}
                  className="flex-[2] py-5 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all flex justify-center items-center"
                  style={{ backgroundColor: COLORS.primary }}
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    isEditing ? 'Save Changes' : 'Save Task'
                  )}
                </button>
              </div>

              <button
                onClick={() => { setIsCreating(false); setIsEditing(false); }}
                className="w-full py-2 text-slate-400 font-black uppercase text-[10px] tracking-widest mt-2"
              >
                Close Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TasksScreen;