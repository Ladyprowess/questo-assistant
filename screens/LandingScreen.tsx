import React from "react";
import { Link } from "react-router-dom";
import { COLORS } from "../constants";

export default function LandingScreen() {
  return (
    <div className="min-h-screen bg-white p-8 flex items-center justify-center">
      <div className="max-w-md w-full text-center">
        <div
          className="w-20 h-20 rounded-[28px] mx-auto flex items-center justify-center mb-6 shadow-2xl"
          style={{ backgroundColor: COLORS.primary }}
        >
          <span className="text-white text-4xl font-black italic">Q</span>
        </div>

        <h1 className="text-3xl font-black text-slate-900">Queso Assistant</h1>
        <p className="text-slate-600 mt-3 text-sm leading-relaxed">
          Queso Assistant helps you stay organised with tasks, schedules, notes, and drafts — in one simple place.
        </p>

        <div className="mt-8 space-y-3">
          <Link
            to="/chat"
            className="block w-full py-4 rounded-2xl font-black uppercase tracking-widest text-white"
            style={{ backgroundColor: COLORS.primary }}
          >
            Open App
          </Link>

          <a
            href="/#/privacy"
            className="block text-[11px] font-black uppercase tracking-widest text-slate-400"
          >
            Privacy Policy
          </a>
        </div>
      </div>
    </div>
  );
}