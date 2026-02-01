
import React from 'react';
import { ICONS } from '../constants';
import { AssistantAction } from '../types';

interface AuditLogScreenProps {
  actions: AssistantAction[];
}

const AuditLogScreen: React.FC<AuditLogScreenProps> = ({ actions }) => {
  return (
    <div className="p-6">
      <header className="mb-8">
        <p className="text-orange-500 font-bold uppercase tracking-widest text-[10px] mb-1">Assistant History</p>
        <h1 className="text-3xl font-black text-slate-800">Audit Trail</h1>
      </header>

      <div className="space-y-4">
        {actions.length > 0 ? actions.map((action) => (
          <div key={action.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center space-x-4 animate-in fade-in">
            <div className={`
              p-3 rounded-2xl
              ${action.action_type.includes('create') ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-50 text-slate-500'}
            `}>
              <ICONS.Audit className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-slate-800 text-sm capitalize">
                {action.action_type.replace(/_/g, ' ')}
              </h4>
              <p className="text-[10px] text-slate-400 font-medium">
                {new Date(action.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </div>
            <div className="text-[10px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-50 px-2 py-1 rounded-lg">
              Success
            </div>
          </div>
        )) : (
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
