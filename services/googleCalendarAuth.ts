declare global {
  interface Window {
    google?: any;
  }
}

const CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  import.meta.env.GOOGLE_CLIENT_ID;

const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

export const connectGoogleCalendar = async (): Promise<string> => {
  if (!window.google) throw new Error('Google Identity Services not loaded');
  if (!CLIENT_ID) throw new Error('Missing Google Client ID. Set VITE_GOOGLE_CLIENT_ID');

  return new Promise((resolve, reject) => {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (resp: any) => {
        if (!resp || resp.error) {
          reject(new Error(resp?.error || 'Google auth cancelled'));
          return;
        }

        // Save flag + token (quick approach for now)
        localStorage.setItem('google_calendar_connected', 'true');
        localStorage.setItem('google_access_token', resp.access_token);

        resolve(resp.access_token);
      },
    });

    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
};