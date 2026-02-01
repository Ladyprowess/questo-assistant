import React, { useMemo, useState } from 'react';
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

  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const isPro = useMemo(() => (plan || '').toLowerCase() === 'pro', [plan]);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToast(null), 3500);
  };

  /**
   * TIMEZONE: Use user timezone for display consistency.
   * (Only used if the Draft object contains created_at / updated_at)
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

  const formatInTz = (iso?: string | null) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return null;

      return new Intl.DateTimeFormat('en-GB', {
        timeZone: userTimeZone,
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(d);
    } catch {
      return null;
    }
  };

  if (!draft) return <div className="p-8 text-center">Draft not found.</div>;

  // Free users should only access a snippet (not full draft).
  const freeSnippet = useMemo(() => {
    const text = (draft.body || '').trim();
    if (!text) return '';
    // Keep it short, but useful. You can change this length later.
    const max = 240;
    return text.length > max ? `${text.slice(0, max).trim()}…` : text;
  }, [draft.body]);

  const visibleBody = isPro ? draft.body : freeSnippet;

  const handleCopy = async () => {
    try {
      const textToCopy = isPro ? draft.body : freeSnippet;

      if (!textToCopy?.trim()) {
        showToast('info', 'Nothing to copy yet.');
        triggerNotification('Nothing copied', 'This draft is empty.');
        return;
      }

      await navigator.clipboard.writeText(textToCopy);

      if (isPro) {
        showToast('success', 'Copied. Your draft is now in your clipboard.');
        triggerNotification('Copied', 'Draft copied to clipboard.');
      } else {
        showToast('info', 'Copied. Free plan copies a short snippet. Upgrade to Pro for full drafts.');
        triggerNotification('Copied', 'Snippet copied. Upgrade to Pro for full drafts.');
      }

      addAction('copy_draft', { id: draft.id, mode: isPro ? 'full' : 'snippet' });
    } catch (err) {
      console.error(err);
      showToast('error', 'Could not copy. Please try again.');
      triggerNotification('Copy failed', 'Your browser blocked clipboard access.');
    }
  };

  const handleOpenGmail = () => {
    if (!isPro) {
      showToast('info', 'Upgrade to Pro to open drafts in Gmail.');
      navigate('/paywall');
      return;
    }

    try {
      const subject = encodeURIComponent(draft.subject || 'Queso Assistant Draft');
      const body = encodeURIComponent(draft.body || '');
      const to = encodeURIComponent(draft.recipient || '');
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`;

      const win = window.open(gmailUrl, '_blank');
      if (!win) {
        showToast('error', 'Your browser blocked the pop-up. Please allow pop-ups and try again.');
        triggerNotification('Blocked', 'Pop-up blocked. Allow pop-ups to open Gmail.');
        return;
      }

      showToast('success', 'Opened. Gmail compose is ready for you.');
      addAction('open_gmail', { id: draft.id });
    } catch (err) {
      console.error(err);
      showToast('error', 'Could not open Gmail. Please try again.');
      triggerNotification('Error', 'Could not open Gmail.');
    }
  };

  // Optional timestamps (won’t crash if fields don’t exist)
  const createdAt = formatInTz((draft as any).created_at);
  const updatedAt = formatInTz((draft as any).updated_at);

  return (
    <div className="p-6 bg-white min-h-full">
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

      <header className="flex items-center space-x-4 mb-10 pt-4">
        <button onClick={() => navigate(-1)} className="p-2 bg-slate-100 rounded-xl">
          <ICONS.Plus className="w-4 h-4 rotate-45 text-slate-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-black text-slate-800">Review Draft</h1>
          {(createdAt || updatedAt) && (
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
              {createdAt ? `Created: ${createdAt}` : ''}
              {createdAt && updatedAt ? ' • ' : ''}
              {updatedAt ? `Updated: ${updatedAt}` : ''}
            </p>
          )}
        </div>
      </header>

      <div className="bg-slate-50 rounded-[32px] p-8 border border-slate-100 shadow-sm mb-10">
        <div className="mb-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-1">
            To: {draft.recipient || 'No recipient specified'}
          </p>
          <h2 className="text-xl font-bold text-slate-800">{draft.subject || 'New Message'}</h2>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 min-h-[200px] text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
          {visibleBody}
        </div>
      </div>

      <div className="space-y-4">
        {isPro ? (
          <button
            onClick={handleOpenGmail}
            className="w-full py-5 bg-teal-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center space-x-3 active:scale-95 transition-all"
          >
            <ICONS.Check className="w-5 h-5" />
            <span>Open in Gmail</span>
          </button>
        ) : (
          <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100 mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <ICONS.Lock className="w-4 h-4 text-indigo-400" />
              <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Free Plan Snippet</p>
            </div>
            <p className="text-[10px] text-slate-500 font-medium leading-relaxed uppercase">
              Free users get short snippets. Upgrade to Pro for full drafts and one-click Gmail integration.
            </p>
            <button
              onClick={() => navigate('/paywall')}
              className="mt-3 text-[10px] font-black text-indigo-600 underline uppercase tracking-widest"
            >
              Upgrade to Pro
            </button>
          </div>
        )}

        <button
          onClick={handleCopy}
          className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all"
        >
          {isPro ? 'Copy Full Draft' : 'Copy Snippet'}
        </button>

        {!isPro && (
          <p className="text-xs text-slate-400 font-semibold text-center">
            Upgrade to Pro to unlock full drafts and Gmail integration.
          </p>
        )}
      </div>
    </div>
  );
};

export default DraftsScreen;
