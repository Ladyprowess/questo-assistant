import React from "react";
import { COLORS } from "../constants";

const PrivacyScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center py-10">
      {/* Phone Frame */}
      <div
  className="
    w-full max-w-md
    bg-white
    border-x border-slate-200
    shadow-2xl
    rounded-[32px]
    overflow-y-auto
    overscroll-contain
  "
  style={{
    height: '92vh',
    WebkitOverflowScrolling: 'touch',
  }}
>
        {/* Header */}
        <div className="px-6 pt-8 pb-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <a
              href="/"
              className="text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-900"
            >
              ← Back
            </a>

            <a
              href="/login"
              className="text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-900"
            >
              Sign in
            </a>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ backgroundColor: COLORS.primary }}
            >
              <span className="text-white text-xl font-black italic">Q</span>
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 leading-none">Privacy Policy</h1>
              <p className="text-[11px] font-bold text-slate-400 mt-1">Queso Assistant</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-8 space-y-7">
          <p className="text-sm text-slate-700 leading-relaxed">
            This Privacy Policy explains how Queso Assistant collects, uses, and protects your information.
          </p>

          <section className="p-5 rounded-3xl bg-slate-50 border border-slate-100">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Information we collect
            </h2>
            <ul className="mt-3 text-sm text-slate-700 space-y-2">
              <li>• Account details (such as email and name) when you sign in.</li>
              <li>• Content you save in the app (tasks, notes, drafts) if you choose to store them.</li>
              <li>• Basic usage data for reliability and performance.</li>
            </ul>
          </section>

          <section className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              How we use information
            </h2>
            <ul className="mt-3 text-sm text-slate-700 space-y-2">
              <li>• To provide and maintain the app.</li>
              <li>• To secure your account and prevent abuse.</li>
              <li>• To improve features and user experience.</li>
            </ul>
          </section>

          <section className="p-5 rounded-3xl bg-slate-50 border border-slate-100">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Third-party services
            </h2>
            <p className="mt-3 text-sm text-slate-700 leading-relaxed">
              If you sign in with Google, Google processes sign-in information as part of authentication.
              If calendar sync is enabled for Pro users, permissions are only used to create or update events you approve.
            </p>
          </section>

          <div className="pt-2">
            <a
              href="/"
              className="w-full block text-center py-4 rounded-2xl text-white font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all"
              style={{ backgroundColor: COLORS.primary }}
            >
              Back to Home
            </a>
          </div>

          <p className="text-[10px] text-slate-400 leading-relaxed text-center">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyScreen;