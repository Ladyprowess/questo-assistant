import React, { useMemo, useState } from "react";
import { ICONS, COLORS } from "../constants";
import { useNavigate } from "react-router-dom";

// ✅ CHANGE THIS IMPORT PATH to where you placed the Google Calendar sync helpers
// It should point to the file you dropped earlier (the Gemini tools file).
import { pushAllToGoogleCalendar } from "../services/gemini"; // <-- adjust if your file name differs

type PaywallProps = { profile: any; setProfile: any };

const PaywallScreen: React.FC<PaywallProps> = ({ profile, setProfile }) => {
  const isNigerian = profile.country === "Nigeria";
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const navigate = useNavigate();

  // ✅ Sync UI states
  const [syncingToGoogle, setSyncingToGoogle] = useState(false);
  const [syncError, setSyncError] = useState<string>("");

  // Pricing Constants
  const MONTHLY_NGN = 35000;
  const EXCHANGE_RATE = 1500; // 1 USD = 1500 NGN (simulated)

  const price = useMemo(() => {
    const currency = isNigerian ? "₦" : "$";
    const baseMonthly = isNigerian ? MONTHLY_NGN : MONTHLY_NGN / EXCHANGE_RATE;

    if (billingCycle === "monthly") {
      return {
        amount: baseMonthly.toLocaleString(undefined, {
          maximumFractionDigits: isNigerian ? 0 : 2,
        }),
        currency,
        label: "/mo",
      };
    } else {
      const yearly = baseMonthly * 12 * 0.95; // 5% discount
      return {
        amount: yearly.toLocaleString(undefined, {
          maximumFractionDigits: isNigerian ? 0 : 2,
        }),
        currency,
        label: "/yr",
      };
    }
  }, [billingCycle, isNigerian]);

  /**
   * ✅ Reads already-existing data created in FREE mode
   * Adjust keys here ONLY if your app uses different localStorage keys.
   */
  const loadLocalDataForSync = () => {
    // These are common keys used in assistant apps.
    // If your app uses different keys, tell me the keys you see in DevTools > Application > Local Storage.
    const tasks =
      safeJsonParse(localStorage.getItem("tasks"), []) ||
      safeJsonParse(localStorage.getItem("user_tasks"), []) ||
      safeJsonParse(localStorage.getItem("queso_tasks"), []) ||
      [];

    const notes =
      safeJsonParse(localStorage.getItem("notes"), []) ||
      safeJsonParse(localStorage.getItem("user_notes"), []) ||
      safeJsonParse(localStorage.getItem("queso_notes"), []) ||
      [];

    const events =
      safeJsonParse(localStorage.getItem("events"), []) ||
      safeJsonParse(localStorage.getItem("calendar_events"), []) ||
      safeJsonParse(localStorage.getItem("queso_events"), []) ||
      [];

    // We only sync notes that have a scheduled time (because unscheduled notes don’t belong in a calendar)
    const scheduledNotes = Array.isArray(notes)
      ? notes.filter((n: any) => !!n?.scheduled_at)
      : [];

    return {
      tasks: Array.isArray(tasks) ? tasks : [],
      notes: scheduledNotes,
      events: Array.isArray(events) ? events : [],
    };
  };

  const handleSubscribe = async () => {
    const platform = isNigerian ? "Paystack" : "PayPal";

    const confirmMsg =
      profile.plan === "pro"
        ? `Redirecting to ${platform} to update your payment method...`
        : `Redirecting to ${platform} for secure checkout...`;

    alert(confirmMsg);

    // Keep your simulation, but after “success” we now sync to Google Calendar (PRO only)
    setTimeout(async () => {
      try {
        setSyncError("");
        setSyncingToGoogle(true);

        // ✅ Mark user as PRO first
        const nextProfile = { ...profile, plan: "pro" };
        setProfile(nextProfile);

        // ✅ Now push ALL existing items to Google Calendar
        // This will prompt the user to connect Google if they haven't.
        const payload = loadLocalDataForSync();

        const result = await pushAllToGoogleCalendar(payload);

        setSyncingToGoogle(false);

        alert(
          `Success! Your Queso Pro ${billingCycle} plan is now active.\n\nGoogle Calendar Sync complete:\n• Calendar: ${result.calendarId}\n• Synced: ${result.synced} item(s)`
        );

        navigate("/settings");
      } catch (e: any) {
        setSyncingToGoogle(false);

        const msg =
          e?.message ||
          "We couldn’t sync to Google Calendar. Please try again from Settings > Google Calendar Sync.";

        setSyncError(msg);

        // Still activate Pro, but tell them sync failed
        setProfile({ ...profile, plan: "pro" });
        alert(
          `Success! Your Queso Pro ${billingCycle} plan is now active.\n\nBut Google Calendar sync failed:\n${msg}`
        );

        navigate("/settings");
      }
    }, 1200);
  };

  return (
    <div className="p-8 bg-slate-900 min-h-full text-white pb-32">
      <button
        onClick={() => navigate(-1)}
        className="mb-8 p-2 bg-white/10 rounded-xl transition-transform active:scale-90"
      >
        <ICONS.Plus className="w-5 h-5 rotate-45" />
      </button>

      <header className="mb-12">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-2xl"
          style={{ backgroundColor: COLORS.primary }}
        >
          <span className="text-white text-4xl font-black italic">Q</span>
        </div>
        <h1 className="text-4xl font-black mb-4 tracking-tight">Queso Pro</h1>
        <p className="text-slate-400 text-lg leading-snug">
          {profile.plan === "pro"
            ? "Manage your premium subscription."
            : "Unlock the full power of your personal assistant."}
        </p>

        {/* ✅ Pro sync note */}
        <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
            Pro Bonus
          </p>
          <p className="text-sm text-slate-200 leading-snug">
            When you upgrade, we’ll sync your existing scheduled Tasks, Notes, and Events to Google
            Calendar — so Google can send you reminders even outside the app.
          </p>
        </div>
      </header>

      {/* Billing Toggle */}
      <div className="bg-white/5 p-1.5 rounded-2xl flex mb-10 border border-white/10">
        <button
          onClick={() => setBillingCycle("monthly")}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${
            billingCycle === "monthly"
              ? "bg-white text-slate-900 shadow-lg"
              : "text-slate-400"
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setBillingCycle("yearly")}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all relative ${
            billingCycle === "yearly" ? "bg-white text-slate-900 shadow-lg" : "text-slate-400"
          }`}
        >
          Yearly
          <span className="absolute -top-3 -right-2 bg-teal-500 text-white text-[8px] px-2 py-1 rounded-full animate-bounce">
            SAVE 5%
          </span>
        </button>
      </div>

      <div className="space-y-6 mb-12">
        <FeatureItem label="Unlimited AI Assistant Messages" />
        <FeatureItem label="Daily Plan Summaries" />
        <FeatureItem label="Recurring Reminders" />
        <FeatureItem label="Message & Email Drafting" />
        <FeatureItem label="Priority Voice Processing" />
        <FeatureItem label="Google Calendar Sync (Tasks, Notes, Events)" />
      </div>

      <div className="bg-white/5 p-8 rounded-[40px] border border-white/10 mb-8 backdrop-blur-sm">
        <div className="flex justify-between items-start mb-8">
          <div>
            <p className="text-teal-400 font-black uppercase text-[10px] tracking-widest mb-2">
              Pricing Details
            </p>
            <h2 className="text-5xl font-black tracking-tighter">
              <span className="text-2xl align-top mr-1">{price.currency}</span>
              {price.amount}
              <span className="text-base font-medium text-slate-500 ml-1">{price.label}</span>
            </h2>
          </div>
          <span className="bg-teal-500/20 text-teal-400 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest">
            {billingCycle}
          </span>
        </div>

        <div className="mt-4 p-4 rounded-2xl bg-white/5 border border-white/5">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-2">
            Available for your region:
          </p>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <ICONS.Check className="w-4 h-4 text-teal-400" />
            </div>
            <span className="text-sm font-bold text-slate-200">
              {isNigerian ? "Paystack (Cards, Bank, Transfer)" : "PayPal (Cards, Global Credit)"}
            </span>
          </div>
        </div>

        {/* ✅ Sync status */}
        {syncingToGoogle ? (
          <div className="mt-5 p-4 rounded-2xl bg-teal-500/10 border border-teal-500/20">
            <p className="text-teal-300 text-sm font-bold">
              Syncing your existing items to Google Calendar…
            </p>
            <p className="text-slate-300 text-xs mt-1">
              You may see a Google permission popup. Please allow access to continue.
            </p>
          </div>
        ) : null}

        {syncError ? (
          <div className="mt-5 p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
            <p className="text-red-300 text-sm font-bold">Google Calendar Sync failed</p>
            <p className="text-slate-300 text-xs mt-1">{syncError}</p>
          </div>
        ) : null}
      </div>

      <button
        onClick={handleSubscribe}
        disabled={syncingToGoogle}
        className={`w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl transition-all active:scale-95 hover:brightness-110 ${
          syncingToGoogle ? "opacity-60 cursor-not-allowed" : ""
        }`}
        style={{ backgroundColor: COLORS.primary }}
      >
        {profile.plan === "pro" ? "Update Subscription" : syncingToGoogle ? "Syncing…" : "Subscribe Now"}
      </button>

      <p className="text-center text-slate-500 text-[10px] mt-8 uppercase font-black tracking-widest opacity-50">
        Cancel anytime • Instant activation • Secure encryption
      </p>
    </div>
  );
};

const FeatureItem: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center space-x-3">
    <div className="w-5 h-5 bg-teal-500/20 flex items-center justify-center rounded-full">
      <ICONS.Check className="w-3 h-3 text-teal-500" strokeWidth={4} />
    </div>
    <span className="text-sm font-medium text-slate-300">{label}</span>
  </div>
);

// tiny helper
function safeJsonParse(raw: string | null, fallback: any) {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export default PaywallScreen;