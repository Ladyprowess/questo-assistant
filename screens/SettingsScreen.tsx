
import React, { useState } from 'react';
import { ICONS, COLORS } from '../constants';
import { useNavigate } from 'react-router-dom';
import { COUNTRY_TIMEZONES } from '../App';
import { connectGoogleCalendar } from '../services/googleCalendarAuth';

const SettingsScreen: React.FC<{ profile: any; setProfile: any; onSignOut: () => void; addAction: (t: string, i: any) => void }> = ({ profile, setProfile, onSignOut, addAction }) => {
  const navigate = useNavigate();
  const [showSecurityCenter, setShowSecurityCenter] = useState(false);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const handleConnectGoogleCalendar = async () => {
    try {
      await connectGoogleCalendar();
      addAction('google_calendar_connected', { connected: true });
      alert('Google Calendar connected successfully.');
    } catch (e: any) {
      alert(e?.message || 'Google Calendar connection failed.');
    }
  };

  const handleToggle2FA = () => {
    setIs2FAEnabled(!is2FAEnabled);
    addAction('toggle_2fa_protection', { enabled: !is2FAEnabled });
    alert(is2FAEnabled ? "Two-Factor Authentication disabled." : "Two-Factor Authentication enabled.");
  };

  const updateCountry = (country: string) => {
    const timezone = COUNTRY_TIMEZONES[country] || profile.timezone;
    setProfile({ ...profile, country, timezone });
    addAction('manual_profile_update', { country, timezone });
    setShowCountryModal(false);
  };

  return (
    <div className="p-6 relative min-h-full">
      <header className="mb-12 text-center pt-8">
        <div className="relative inline-block mb-6 group cursor-pointer">
          <div className="w-28 h-28 bg-slate-100 rounded-[40px] flex items-center justify-center border-4 border-white shadow-2xl overflow-hidden rotate-3 transition-transform group-hover:rotate-0">
            <img 
              src={profile.avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${profile.email}`} 
              alt="Avatar" 
              className="w-full h-full object-cover"
            />
          </div>
          <button className="absolute -bottom-2 -right-2 p-2 rounded-xl text-white shadow-lg active:scale-90 transition-transform" style={{ backgroundColor: COLORS.primary }}>
            <ICONS.Plus className="w-5 h-5" />
          </button>
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-1">{profile.full_name}</h2>
        <p className="text-slate-400 text-xs font-bold mb-4">{profile.email}</p>
        <div className="flex justify-center">
          <span className={`text-[9px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full ${profile.plan === 'pro' ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'}`}>
            {profile.plan === 'pro' ? 'Queso Pro Member' : 'Standard Free'}
          </span>
        </div>
      </header>

      <div className="space-y-8 pb-32">
        <section>
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-4">Profile Synchronization</h4>
          <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
            <SettingRow 
              icon={<ICONS.Audit className="w-5 h-5" />} 
              label="Country" 
              value={profile.country} 
              onClick={() => setShowCountryModal(true)}
            />
            <SettingRow icon={<ICONS.Today className="w-5 h-5" />} label="Timezone" value={profile.timezone} />
            <SettingRow
  icon={<ICONS.Today className="w-5 h-5" />}
  label="Connect Google Calendar"
  value={localStorage.getItem('google_calendar_connected') === 'true' ? 'Connected' : 'Not Connected'}
  onClick={handleConnectGoogleCalendar}
/>
            <SettingRow icon={<ICONS.Check className="w-5 h-5" />} label="Assistant Ledger" onClick={() => navigate('/app/audit')} />
            <SettingRow icon={<ICONS.Lock className="w-5 h-5" />} label="Privacy Settings" onClick={() => setShowSecurityCenter(true)} isLast />
          </div>
        </section>

        <section>
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-4">Billing</h4>
          <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
            <SettingRow 
              icon={<ICONS.Plus className="w-5 h-5" />} 
              label="Upgrade Subscription" 
              onClick={() => navigate('/app/paywall')} 
              isLast
            />
          </div>
        </section>

        <button 
          onClick={onSignOut}
          className="w-full py-5 text-red-500 font-black text-xs uppercase tracking-widest bg-red-50 rounded-2xl mt-4 border border-red-100 active:scale-95 transition-all shadow-sm"
        >
          Sign Out
        </button>
      </div>

      {showCountryModal && (
        <div className="fixed inset-0 z-[160] bg-slate-900/60 backdrop-blur-md flex items-end p-4">
          <div className="bg-white w-full max-w-md mx-auto rounded-[40px] p-8 pb-12 animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-black text-slate-900">Select Region</h2>
              <button onClick={() => setShowCountryModal(false)} className="p-2 bg-slate-100 rounded-xl"><ICONS.Plus className="w-4 h-4 rotate-45 text-slate-500" /></button>
            </div>
            <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-2 custom-scrollbar">
              {Object.keys(COUNTRY_TIMEZONES).map(country => (
                <button 
                  key={country}
                  onClick={() => updateCountry(country)}
                  className={`w-full p-4.5 rounded-2xl text-left text-sm font-bold transition-all ${profile.country === country ? 'bg-teal-50 text-teal-700' : 'hover:bg-slate-50'}`}
                >
                  {country}
                </button>
              ))}
            </div>
            <p className="mt-8 text-[9px] text-slate-400 uppercase font-black text-center tracking-widest leading-relaxed">
              Changing your country will automatically synchronize your local timezone data.
            </p>
          </div>
        </div>
      )}

      {showSecurityCenter && (
        <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-md flex items-end p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md mx-auto rounded-[40px] p-8 pb-12 animate-in slide-in-from-bottom duration-300 shadow-2xl overflow-y-auto max-h-[85vh]">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-slate-900">Security Center</h2>
              <button onClick={() => setShowSecurityCenter(false)} className="p-2 bg-slate-100 rounded-xl"><ICONS.Plus className="w-4 h-4 rotate-45 text-slate-500" /></button>
            </div>
            
            <div className="space-y-4">
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <button onClick={() => setIsChangingPassword(!isChangingPassword)} className="w-full text-left">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-slate-800">Password Encryption</h4>
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-1">Last rotated: 30 days ago</p>
                    </div>
                    <ICONS.Lock className={`w-5 h-5 transition-transform ${isChangingPassword ? 'rotate-180 text-teal-600' : 'text-slate-300'}`} />
                  </div>
                </button>
                {isChangingPassword && (
                  <div className="mt-6 space-y-3 animate-in slide-in-from-top duration-300">
                    <input type="password" placeholder="Current Password" className="w-full p-4 bg-white rounded-xl text-xs border border-slate-200 outline-none" />
                    <input type="password" placeholder="New Strong Password" className="w-full p-4 bg-white rounded-xl text-xs border border-slate-200 outline-none" />
                    <button onClick={() => { setIsChangingPassword(false); addAction('password_rotation', {}); alert("System updated."); }} className="w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Apply Change</button>
                  </div>
                )}
              </div>

              <button onClick={handleToggle2FA} className="w-full p-6 bg-slate-50 rounded-3xl text-left border border-slate-100 active:bg-slate-100 transition-all">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-slate-800">Account Authorization</h4>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-1">Multi-factor security</p>
                  </div>
                  <div className={`w-12 h-6 rounded-full relative transition-colors ${is2FAEnabled ? 'bg-teal-500' : 'bg-slate-200'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${is2FAEnabled ? 'left-7' : 'left-1'}`}></div>
                  </div>
                </div>
              </button>
            </div>
            <button onClick={() => setShowSecurityCenter(false)} className="w-full mt-8 py-4 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-sm">Close Security Panel</button>
          </div>
        </div>
      )}
    </div>
  );
};

const SettingRow: React.FC<{ icon: React.ReactNode; label: string; value?: string; isLast?: boolean; onClick?: () => void }> = ({ icon, label, value, isLast, onClick }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors ${!isLast ? 'border-b border-slate-50' : ''}`}
  >
    <div className="flex items-center space-x-4">
      <div className="text-slate-300">{icon}</div>
      <span className="text-sm font-bold text-slate-700">{label}</span>
    </div>
    <div className="flex items-center space-x-3">
      {value && <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{value}</span>}
      <svg className="w-4 h-4 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  </button>
);

export default SettingsScreen;
