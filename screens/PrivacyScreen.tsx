import React from "react";

export default function PrivacyScreen() {
  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-black text-slate-900">Privacy Policy</h1>
        <p className="text-slate-600 text-sm mt-4 leading-relaxed">
          Queso Assistant collects only what is needed to run the app (account login and your saved content like tasks,
          notes, events, and drafts). We do not sell personal data. Data is stored securely using Supabase.
        </p>

        <p className="text-slate-600 text-sm mt-4 leading-relaxed">
          If you want your data removed, contact the developer via the email on the homepage.
        </p>
      </div>
    </div>
  );
}