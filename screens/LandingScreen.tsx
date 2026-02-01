import React from "react";
import { COLORS } from "../constants";

const LandingScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center py-10">
      {/* Phone Frame */}
      <div className="w-full max-w-md bg-white border-x border-slate-200 shadow-2xl rounded-[32px] overflow-hidden">
        {/* Top bar */}
        <div className="px-6 pt-8 pb-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg"
                style={{ backgroundColor: COLORS.primary }}
              >
                <span className="text-white text-xl font-black italic">Q</span>
              </div>
              <div>
                <h1 className="text-base font-black text-slate-900 leading-none">Queso Assistant</h1>
                <p className="text-[11px] font-bold text-slate-400 mt-1">Your private virtual assistant</p>
              </div>
            </div>

            <a
              href="#/login"
              className="text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-900"
            >
              Sign in
            </a>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-8">
          <h2 className="text-2xl font-black text-slate-900 leading-tight">
            Draft faster. Stay organised. Keep your day on track.
          </h2>

          <p className="text-slate-600 mt-4 text-sm leading-relaxed">
            Queso Assistant helps you write message suggestions, save notes, and manage tasks in one place.
            Sign in to access your personal workspace.
          </p>

          {/* Primary actions */}
          <div className="mt-7 grid grid-cols-2 gap-3">
            <a
              href="#/login"
              className="py-4 rounded-2xl text-white font-black uppercase tracking-widest text-center shadow-xl active:scale-95 transition-all"
              style={{ backgroundColor: COLORS.primary }}
            >
              Get started
            </a>

            <a
              href="#/privacy"
              className="py-4 rounded-2xl bg-slate-100 text-slate-900 font-black uppercase tracking-widest text-center active:scale-95 transition-all"
            >
              Privacy
            </a>
          </div>

          {/* Feature cards */}
          <div className="mt-8 space-y-3">
            <div className="p-5 rounded-3xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">What you can do</p>
              <ul className="mt-3 text-sm text-slate-700 space-y-2">
                <li>• Draft message suggestions (full drafts can be Pro).</li>
                <li>• Save tasks, notes, and reminders.</li>
                <li>• Keep everything synced to your account.</li>
              </ul>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Made for focus</p>
              <p className="mt-3 text-sm text-slate-700 leading-relaxed">
                Simple, private, and built to feel like a pocket assistant — not another noisy app.
              </p>
            </div>
          </div>
        </div>

        {/* Footer (Google needs privacy link on homepage) */}
        <div className="px-6 py-6 border-t border-slate-100 bg-white">
          <div className="flex items-center justify-center gap-6">
            <a href="#/privacy" className="text-xs font-bold text-slate-600 hover:text-slate-900">
              Privacy Policy
            </a>
            <a href="#/login" className="text-xs font-bold text-slate-600 hover:text-slate-900">
              Sign in
            </a>
          </div>
          <p className="text-[10px] text-slate-400 mt-4 text-center">
            © {new Date().getFullYear()} Queso Assistant
          </p>
        </div>
      </div>
    </div>
  );
};

export default LandingScreen;