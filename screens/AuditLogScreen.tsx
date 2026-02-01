import React, { useMemo } from 'react';
import { ICONS, COLORS } from '../constants';
import { AssistantAction } from '../types';

interface AuditLogScreenProps {
  actions: AssistantAction[];
}

const AuditLogScreen: React.FC<AuditLogScreenProps> = ({ actions }) => {
  // Same timezone fix approach used in ChatScreen
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

  const formatAuditTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
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
      return new Date(isoString).toLocaleString();
    }
  };

  const getBadgeStyle = (actionType: string) => {
    const t = (actionType || '').toLowerCase();

    if (t.includes('delete')) return 'bg-red-50 text-red-500';
    if (t.includes('update') || t.includes('edit')) return 'bg-indigo-50 text-indigo-500';
    if (t.includes('create') || t.includes('draft') || t.includes('schedule')) return 'bg-emerald-50 text-emerald-500';
    if (t.includes('toggle')) return 'bg-amber-50 text-amber-600';

    return 'bg-slate-50 text-slate-500';
  };

  const prettifyAction = (actionType: string) => {
    return (actionType || 'unknown_action').replace(/_/g, ' ').trim();
  };

  return (
    <div className="p-6">
      <header className="mb-8">
        <p className="font-bold uppercase tracking-widest text-[10px] mb-1" style={{ color: COLORS.primary }}>
          Assistant History
        </p>
        <h1 className="text-3xl font-black text-slate-800">Audit Trail</h1>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">
          Timezone: {userTimeZone}
        </p>
      </header>

      <div className="space-y-4">
        {actions.length > 0 ? (
          actions.map((action) => (
            <div
              key={action.id}
              className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center space-x-4 animate-in fade-in"
            >
              <div className={`p-3 rounded-2xl ${getBadgeStyle(action.action_type)}`}>
                <ICONS.Audit className="w-5 h-5" />
              </div>

              <div className="flex-1">
                <h4 className="font-bold text-slate-800 text-sm capitalize">
                  {prettifyAction(action.action_type)}
                </h4>

                <p className="text-[10px] text-slate-400 font-medium">
                  {formatAuditTime(action.created_at)}
                </p>

                <p className="text-[9px] text-slate-300 font-black uppercase tracking-widest mt-1">
                  Logged by Assistant
                </p>
              </div>

              <div className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg">
                Completed
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200">
            <p className="text-slate-400 text-sm font-medium italic">No actions recorded yet.</p>
          </div>
        )}
      </div>

      {actions.length > 0 && (
        <div className="mt-8 p-6 bg-slate-100 rounded-3xl border-2 border-dashed border-slate-200 text-center">
          <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">End of History</p>
        </div>
      )}
    </div>
  );
};

export default AuditLogScreen;
