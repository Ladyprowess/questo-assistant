
import React, { useState } from 'react';
import { ICONS, COLORS } from '../constants';
import { Note } from '../types';
import { supabase } from '../services/supabase';

const NotesScreen: React.FC<{ plan: string; notes: Note[]; setNotes: any; addAction: (t: string, i: any) => void; syncToCalendar: (title: string, date: string | null) => void }> = ({ plan, notes, setNotes, addAction, syncToCalendar }) => {
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formNote, setFormNote] = useState({ title: '', content: '', scheduled_at: '' });
  const [isLoading, setIsLoading] = useState(false);

  const handleSaveNote = async () => {
    if (!formNote.title.trim() || !formNote.content.trim() || isLoading) return;
    setIsLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const noteTime = formNote.scheduled_at ? new Date(formNote.scheduled_at).toISOString() : new Date().toISOString();
    
    try {
      if (isEditing && selectedNote) {
        const { data, error } = await supabase
          .from('notes')
          .update({ 
            title: formNote.title, 
            content: formNote.content, 
            scheduled_at: noteTime,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedNote.id)
          .select()
          .single();
          
        if (data) {
          setNotes(prev => prev.map(n => n.id === selectedNote.id ? data : n));
          addAction('manual_note_update', { id: selectedNote.id });
        }
      } else {
        const { data, error } = await supabase
          .from('notes')
          .insert([{
            user_id: user.id,
            title: formNote.title,
            content: formNote.content,
            scheduled_at: noteTime
          }])
          .select()
          .single();
          
        if (data) {
          setNotes(prev => [data, ...prev]);
          addAction('manual_note_create', { title: formNote.title });
          syncToCalendar(`Note: ${formNote.title}`, noteTime);
        }
      }
      
      setFormNote({ title: '', content: '', scheduled_at: '' });
      setIsCreating(false);
      setIsEditing(false);
      setSelectedNote(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteNote = async (id: string) => {
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (!error) {
      setNotes(prev => prev.filter(n => n.id !== id));
      addAction('manual_note_delete', { id });
      setSelectedNote(null);
    }
  };

  return (
    <div className="p-6 relative min-h-full">
      <header className="flex justify-between items-end mb-8">
        <div>
          <p className="font-black uppercase tracking-widest text-[10px] mb-2" style={{ color: COLORS.primary }}>Cloud Intelligence</p>
          <h1 className="text-3xl font-black text-slate-800">Notes</h1>
        </div>
        <button 
          onClick={() => { setIsCreating(true); setIsEditing(false); setFormNote({ title: '', content: '', scheduled_at: '' }); }}
          className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg active:scale-95 transition-transform"
        >
          <ICONS.Plus className="w-6 h-6" />
        </button>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {notes.length > 0 ? notes.map((note) => (
          <div 
            key={note.id} 
            onClick={() => setSelectedNote(note)}
            className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative group cursor-pointer"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <h3 className="font-bold text-slate-800 text-lg">{note.title}</h3>
                {note.scheduled_at && (
                  <p className="text-[9px] font-black uppercase text-teal-600 tracking-widest mt-0.5">
                    Ref Time: {new Date(note.scheduled_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                  </p>
                )}
              </div>
            </div>
            <p className="text-slate-500 text-sm mb-4 line-clamp-3 leading-relaxed whitespace-pre-wrap">{note.content}</p>
            <div className="flex items-center justify-between pt-4 border-t border-slate-50">
              <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">
                Synced: {new Date(note.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        )) : (
          <div className="text-center py-20 bg-slate-100 rounded-[40px] border-2 border-dashed border-slate-200">
             <p className="text-slate-400 text-sm font-medium italic">Your notes will appear here.</p>
          </div>
        )}
      </div>

      {selectedNote && !isEditing && (
        <div className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-md flex items-end animate-in fade-in duration-300 p-4">
          <div className="bg-white w-full max-w-md mx-auto rounded-[40px] p-8 pb-12 animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1 block">Scheduled: {new Date(selectedNote.scheduled_at || selectedNote.created_at).toLocaleString()}</span>
                <h2 className="text-2xl font-black text-slate-800 leading-tight">{selectedNote.title}</h2>
              </div>
              <button onClick={() => setSelectedNote(null)} className="p-2 bg-slate-100 rounded-xl">
                <ICONS.Plus className="w-4 h-4 rotate-45 text-slate-500" />
              </button>
            </div>
            <p className="text-slate-600 text-base leading-relaxed whitespace-pre-wrap mb-8">
              {selectedNote.content}
            </p>
            <div className="flex space-x-3">
              <button 
                onClick={() => {
                  setIsEditing(true);
                  setFormNote({ 
                    title: selectedNote.title, 
                    content: selectedNote.content, 
                    scheduled_at: selectedNote.scheduled_at?.split('.')[0] || '' 
                  });
                }}
                className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all"
              >
                Edit Note
              </button>
              <button 
                onClick={() => deleteNote(selectedNote.id)}
                className="flex-1 py-4 bg-red-50 text-red-500 rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {(isCreating || isEditing) && (
        <div className="fixed inset-0 z-[120] bg-slate-900/50 backdrop-blur-md flex items-end animate-in fade-in duration-300 p-4">
          <div className="bg-white w-full max-w-md mx-auto rounded-[40px] p-8 pb-12 animate-in slide-in-from-bottom duration-300 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-slate-800">{isEditing ? 'Edit Note' : 'Record Note'}</h2>
              <button onClick={() => { setIsCreating(false); setIsEditing(false); }} className="p-2 bg-slate-100 rounded-xl">
                <ICONS.Plus className="w-4 h-4 rotate-45 text-slate-500" />
              </button>
            </div>
            <div className="space-y-4">
              <input type="text" placeholder="Title" value={formNote.title} onChange={e => setFormNote({...formNote, title: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm focus:ring-4 focus:ring-teal-100 transition-all outline-none font-bold" />
              <input type="datetime-local" value={formNote.scheduled_at} onChange={e => setFormNote({...formNote, scheduled_at: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm focus:ring-4 focus:ring-teal-100 transition-all outline-none font-bold" />
              <textarea placeholder="Write everything down..." rows={5} value={formNote.content} onChange={e => setFormNote({...formNote, content: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm focus:ring-4 focus:ring-teal-100 transition-all outline-none resize-none" />
              <button onClick={handleSaveNote} disabled={isLoading} className="w-full py-4 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all flex justify-center items-center" style={{ backgroundColor: COLORS.primary }}>
                {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (isEditing ? 'Update & Sync' : 'Save & Sync')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotesScreen;
