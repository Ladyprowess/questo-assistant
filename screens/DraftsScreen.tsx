
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ICONS, COLORS } from '../constants';
import { Draft } from '../types';

interface DraftsScreenProps {
  plan: string;
  drafts: Draft[];
  triggerNotification: (t: string, b: string) => void;
  addAction: (t: string, i: any) => void;
}

const DraftsScreen: React.FC<DraftsScreenProps> = ({ plan, drafts, triggerNotification, addAction }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const draft = drafts.find(d => d.id === id);

  if (!draft) return <div className="p-8 text-center">Draft not found.</div>;

  const isPro = plan === 'pro';

  const handleCopy = () => {
    navigator.clipboard.writeText(draft.body);
    triggerNotification("Copied", "Draft copied to clipboard.");
    addAction('copy_draft', { id: draft.id });
  };

  const handleOpenGmail = () => {
    if (!isPro) return;
    const subject = encodeURIComponent(draft.subject || 'Queso Assistant Draft');
    const body = encodeURIComponent(draft.body);
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(draft.recipient || '')}&su=${subject}&body=${body}`;
    window.open(gmailUrl, '_blank');
    addAction('open_gmail', { id: draft.id });
  };

  return (
    <div className="p-6 bg-white min-h-full">
      <header className="flex items-center space-x-4 mb-10 pt-4">
        <button onClick={() => navigate(-1)} className="p-2 bg-slate-100 rounded-xl">
          <ICONS.Plus className="w-4 h-4 rotate-45 text-slate-500" />
        </button>
        <h1 className="text-2xl font-black text-slate-800">Review Draft</h1>
      </header>

      <div className="bg-slate-50 rounded-[32px] p-8 border border-slate-100 shadow-sm mb-10">
        <div className="mb-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-1">To: {draft.recipient || 'No recipient specified'}</p>
          <h2 className="text-xl font-bold text-slate-800">{draft.subject || 'New Message'}</h2>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 min-h-[200px] text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
          {draft.body}
        </div>
      </div>

      <div className="space-y-4">
        {isPro ? (
          <button 
            onClick={handleOpenGmail}
            className="w-full py-5 bg-teal-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center space-x-3 active:scale-95 transition-all"
          >
            <ICONS.Check className="w-5 h-5" />
            <span>Open in Gmail Inbox</span>
          </button>
        ) : (
          <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100 mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <ICONS.Lock className="w-4 h-4 text-indigo-400" />
              <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Free Plan Snippet</p>
            </div>
            <p className="text-[10px] text-slate-500 font-medium leading-relaxed uppercase">
              Free users get short snippets. Upgrade to Pro for detailed drafts and one-click Gmail integration.
            </p>
            <button onClick={() => navigate('/paywall')} className="mt-3 text-[10px] font-black text-indigo-600 underline uppercase tracking-widest">Upgrade to Pro</button>
          </div>
        )}

        <button 
          onClick={handleCopy}
          className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all"
        >
          Copy to Clipboard
        </button>
      </div>
    </div>
  );
};

export default DraftsScreen;
