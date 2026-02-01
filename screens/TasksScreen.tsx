
import React, { useState } from 'react';
import { ICONS, COLORS } from '../constants';
import { Task } from '../types';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

interface TasksScreenProps {
  plan: string;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  addAction: (type: string, input: any) => void;
  syncToCalendar: (title: string, date: string | null) => void;
}

const TasksScreen: React.FC<TasksScreenProps> = ({ plan, tasks, setTasks, addAction, syncToCalendar }) => {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [formTask, setFormTask] = useState({ title: '', due_at: '', recurring: 'none' });
  const [isLoading, setIsLoading] = useState(false);

  const toggleStatus = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    const { data, error } = await supabase
      .from('tasks')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', task.id)
      .select()
      .single();
    
    if (data) {
      setTasks(prev => prev.map(t => t.id === task.id ? data : t));
      addAction('toggle_task', { id: task.id });
    }
  };

  const handleSaveTask = async () => {
    if (!formTask.title.trim() || isLoading) return;
    setIsLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const taskDue = formTask.due_at ? new Date(formTask.due_at).toISOString() : new Date().toISOString();
    
    if (formTask.recurring !== 'none' && plan !== 'pro') {
      navigate('/paywall');
      return;
    }

    try {
      if (isEditing && selectedTask) {
        const { data, error } = await supabase
          .from('tasks')
          .update({ 
            title: formTask.title, 
            due_at: taskDue, 
            recurring_rule: formTask.recurring !== 'none' ? `FREQ=${formTask.recurring.toUpperCase()}` : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedTask.id)
          .select()
          .single();
          
        if (data) {
          setTasks(prev => prev.map(t => t.id === selectedTask.id ? data : t));
          addAction('manual_task_update', { id: selectedTask.id });
        }
      } else {
        const { data, error } = await supabase
          .from('tasks')
          .insert([{
            user_id: user.id,
            title: formTask.title,
            description: 'Action Item',
            due_at: taskDue,
            priority: 'medium',
            status: 'todo',
            recurring_rule: formTask.recurring !== 'none' ? `FREQ=${formTask.recurring.toUpperCase()}` : null
          }])
          .select()
          .single();
          
        if (data) {
          setTasks(prev => [data, ...prev]);
          addAction('manual_task_create', { title: formTask.title });
          syncToCalendar(formTask.title, taskDue);
        }
      }
      setIsCreating(false);
      setIsEditing(false);
      setSelectedTask(null);
      setFormTask({ title: '', due_at: '', recurring: 'none' });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (task: Task) => {
    setSelectedTask(task);
    setIsEditing(true);
    setFormTask({
      title: task.title,
      due_at: task.due_at ? task.due_at.slice(0, 16) : '',
      recurring: task.recurring_rule ? task.recurring_rule.split('=')[1].toLowerCase() : 'none'
    });
  };

  const deleteTask = async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (!error) {
      setTasks(prev => prev.filter(t => t.id !== id));
      addAction('manual_task_delete', { id });
      setIsEditing(false);
      setSelectedTask(null);
    }
  };

  return (
    <div className="p-6 relative min-h-full">
      <header className="flex justify-between items-end mb-10 pt-4">
        <div>
          <p className="font-black uppercase tracking-widest text-[10px] mb-2" style={{ color: COLORS.primary }}>Personal Ledger</p>
          <h1 className="text-4xl font-black text-slate-900 leading-none">Tasks</h1>
        </div>
        <button onClick={() => { setIsCreating(true); setIsEditing(false); setFormTask({ title: '', due_at: '', recurring: 'none' }); }} className="p-4 text-white rounded-[24px] shadow-xl active:scale-95 transition-all" style={{ backgroundColor: COLORS.primary }}><ICONS.Plus className="w-6 h-6" /></button>
      </header>

      <div className="space-y-4 pb-32">
        {tasks.map((task) => (
          <div 
            key={task.id} 
            onClick={() => startEditing(task)}
            className={`p-5 rounded-[28px] border flex items-center space-x-4 transition-all cursor-pointer ${task.status === 'done' ? 'bg-slate-50 opacity-60' : 'bg-white border-slate-100 shadow-sm'}`}
          >
            <div onClick={(e) => toggleStatus(task, e)} className={`w-7 h-7 rounded-full border-2 flex items-center justify-center cursor-pointer ${task.status === 'done' ? 'bg-teal-500 border-teal-500' : 'border-slate-200 hover:border-teal-300'}`}>{task.status === 'done' && <ICONS.Check className="w-4 h-4 text-white" strokeWidth={4} />}</div>
            <div className="flex-1 text-left truncate">
              <h4 className={`text-sm font-bold truncate ${task.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{task.title}</h4>
              <div className="flex items-center space-x-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">{task.due_at ? new Date(task.due_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : 'No Due Date'}</p>
                {task.recurring_rule && <span className="text-[8px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded font-black uppercase">Recurring</span>}
              </div>
            </div>
          </div>
        ))}
        {tasks.length === 0 && <div className="py-20 text-center opacity-40 italic">Start by adding your first task.</div>}
      </div>

      {(isCreating || isEditing) && (
        <div className="fixed inset-0 z-[120] bg-slate-900/70 backdrop-blur-md flex items-end p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md mx-auto rounded-[40px] p-8 pb-12 animate-in slide-in-from-bottom duration-300 shadow-2xl">
            <h2 className="text-2xl font-black mb-8 text-slate-800">{isEditing ? 'Edit Task' : 'New Task'}</h2>
            <div className="space-y-5">
              <input type="text" placeholder="Task Title" value={formTask.title} onChange={e => setFormTask({...formTask, title: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl py-5 px-6 text-sm outline-none font-bold" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-4">Due Date & Time</p>
                <input type="datetime-local" value={formTask.due_at} onChange={e => setFormTask({...formTask, due_at: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl py-5 px-6 text-sm outline-none font-bold" />
              </div>
              
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recurrence</p>
                  {plan !== 'pro' && <ICONS.Lock className="w-3 h-3 text-slate-300" />}
                </div>
                <select 
                  value={formTask.recurring} 
                  onChange={e => setFormTask({...formTask, recurring: e.target.value})}
                  className="w-full bg-transparent text-sm font-bold outline-none text-slate-700"
                >
                  <option value="none">One-time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div className="flex space-x-3 pt-4">
                {isEditing && (
                  <button onClick={() => deleteTask(selectedTask!.id)} className="flex-1 py-4 bg-red-50 text-red-500 rounded-2xl font-black uppercase text-[10px] tracking-widest">Delete</button>
                )}
                <button onClick={handleSaveTask} disabled={isLoading} className="flex-[2] py-5 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all flex justify-center items-center" style={{ backgroundColor: COLORS.primary }}>
                  {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (isEditing ? 'Save Changes' : 'Record Task')}
                </button>
              </div>
              <button onClick={() => { setIsCreating(false); setIsEditing(false); }} className="w-full py-2 text-slate-400 font-black uppercase text-[10px] tracking-widest mt-2">Close Panel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TasksScreen;
