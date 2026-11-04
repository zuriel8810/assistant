/**
 * Google Integration Module for אָדָם (Adam)
 * Supports Google Identity Services (GIS) OAuth 2.0 Token Client and manual token support.
 * Scopes: Gmail (readonly), Calendar (events), Drive (readonly).
 */

const GOOGLE_CONFIG_KEY = 'adam_google_config';

const DEFAULT_GOOGLE_CONFIG = {
  clientId: '',
  accessToken: '',
  tokenExpiry: 0,
  userEmail: ''
};

class GoogleIntegration {
  constructor() {
    this.config = this.loadConfig();
    this.tokenClient = null;
    this.gisLoaded = false;
    this.initGis();
  }

  loadConfig() {
    try {
      const data = localStorage.getItem(GOOGLE_CONFIG_KEY);
      return data ? { ...DEFAULT_GOOGLE_CONFIG, ...JSON.parse(data) } : { ...DEFAULT_GOOGLE_CONFIG };
    } catch (e) {
      console.error('Error loading Google config:', e);
      return { ...DEFAULT_GOOGLE_CONFIG };
    }
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    localStorage.setItem(GOOGLE_CONFIG_KEY, JSON.stringify(this.config));
  }

  isConnected() {
    if (!this.config.accessToken) return false;
    if (this.config.tokenExpiry && Date.now() > this.config.tokenExpiry) {
      return false;
    }
    return true;
  }

  initGis() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      this.gisLoaded = true;
      if (this.config.clientId) {
        this._setupTokenClient();
      }
    } else {
      window.addEventListener('load', () => {
        if (window.google && window.google.accounts && window.google.accounts.oauth2) {
          this.gisLoaded = true;
          if (this.config.clientId) {
            this._setupTokenClient();
          }
        }
      });
    }
  }

  _setupTokenClient() {
    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) return;
    try {
      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: this.config.clientId.trim(),
        scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email',
        callback: (resp) => {
          if (resp.error) {
            console.error('Google Auth Error:', resp);
            alert('שגיאת התחברות ל-Google: ' + (resp.error_description || resp.error));
            return;
          }
          if (resp.access_token) {
            const expiresIn = resp.expires_in ? parseInt(resp.expires_in) * 1000 : 3600 * 1000;
            this.saveConfig({
              accessToken: resp.access_token,
              tokenExpiry: Date.now() + expiresIn
            });
            this.fetchUserProfile();
            window.dispatchEvent(new CustomEvent('adam-google-auth-changed', { detail: { connected: true } }));
          }
        }
      });
    } catch (e) {
      console.error('Failed to setup GIS token client:', e);
    }
  }

  login() {
    if (!this.config.clientId) {
      throw new Error('יש להגדיר תחילה Client ID בהגדרות Google.');
    }
    if (!this.tokenClient) {
      this._setupTokenClient();
    }
    if (this.tokenClient) {
      this.tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      throw new Error('ספריית Google Identity Services עדיין לא נטענה. אנא נסה שוב.');
    }
  }

  logout() {
    const token = this.config.accessToken;
    if (token && window.google && window.google.accounts && window.google.accounts.oauth2) {
      try {
        window.google.accounts.oauth2.revoke(token, () => {
          console.log('Google token revoked');
        });
      } catch (e) {}
    }
    this.saveConfig({
      accessToken: '',
      tokenExpiry: 0,
      userEmail: ''
    });
    window.dispatchEvent(new CustomEvent('adam-google-auth-changed', { detail: { connected: false } }));
  }

  async fetchUserProfile() {
    if (!this.isConnected()) return null;
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: 'Bearer ' + this.config.accessToken }
      });
      if (res.ok) {
        const info = await res.json();
        this.saveConfig({ userEmail: info.email || '' });
        return info;
      }
    } catch (e) {
      console.warn('Could not fetch user profile:', e);
    }
    return null;
  }

  async listRecentEmails({ maxResults = 5, query = '' } = {}) {
    if (!this.isConnected()) {
      throw new Error('Google אינו מחובר. יש להתחבר תחילה דרך הגדרות המערכת.');
    }
    const qParam = query ? ('&q=' + encodeURIComponent(query)) : '';
    const listUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=' + maxResults + qParam;
    
    const listRes = await fetch(listUrl, {
      headers: { Authorization: 'Bearer ' + this.config.accessToken }
    });
    if (!listRes.ok) {
      const err = await listRes.text();
      throw new Error('שגיאה בקריאת Gmail (' + listRes.status + '): ' + err);
    }
    const listData = await listRes.json();
    const messages = listData.messages || [];

    const detailedList = [];
    for (const m of messages.slice(0, maxResults)) {
      try {
        const msgRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/' + m.id + '?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date', {
          headers: { Authorization: 'Bearer ' + this.config.accessToken }
        });
        if (msgRes.ok) {
          const detail = await msgRes.json();
          const headers = (detail.payload && detail.payload.headers) || [];
          const subject = (headers.find(h => h.name.toLowerCase() === 'subject') || {}).value || '(ללא נושא)';
          const from = (headers.find(h => h.name.toLowerCase() === 'from') || {}).value || '';
          const date = (headers.find(h => h.name.toLowerCase() === 'date') || {}).value || '';
          detailedList.push({
            id: m.id,
            subject,
            from,
            date,
            snippet: detail.snippet || ''
          });
        }
      } catch (err) {
        console.warn('Error reading message detail:', err);
      }
    }
    return detailedList;
  }

  async listCalendarEvents({ timeMin, timeMax, maxResults = 10 } = {}) {
    if (!this.isConnected()) {
      throw new Error('Google אינו מחובר. יש להתחבר תחילה דרך הגדרות המערכת.');
    }
    const nowIso = timeMin || new Date().toISOString();
    let url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&timeMin=' + encodeURIComponent(nowIso) + '&maxResults=' + maxResults;
    if (timeMax) {
      url += '&timeMax=' + encodeURIComponent(timeMax);
    }

    const res = await fetch(url, {
      headers: { Authorization: 'Bearer ' + this.config.accessToken }
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error('שגיאה בקריאת Google Calendar (' + res.status + '): ' + err);
    }
    const data = await res.json();
    return (data.items || []).map(item => ({
      id: item.id,
      summary: item.summary || '(ללא כותרת)',
      description: item.description || '',
      start: item.start ? (item.start.dateTime || item.start.date) : '',
      end: item.end ? (item.end.dateTime || item.end.date) : '',
      location: item.location || '',
      htmlLink: item.htmlLink || ''
    }));
  }

  async createCalendarEvent({ summary, description, startDateTime, endDateTime, location } = {}) {
    if (!this.isConnected()) {
      throw new Error('Google אינו מחובר. יש להתחבר תחילה דרך הגדרות המערכת.');
    }
    const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
    const body = {
      summary: summary || 'פגישה חדשה',
      description: description || '',
      location: location || '',
      start: { dateTime: startDateTime || new Date().toISOString() },
      end: { dateTime: endDateTime || new Date(Date.now() + 3600000).toISOString() }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + this.config.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error('שגיאה ביצירת אירוע יומן (' + res.status + '): ' + err);
    }
    return await res.json();
  }

  async searchDriveFiles({ query = '', pageSize = 10 } = {}) {
    if (!this.isConnected()) {
      throw new Error('Google אינו מחובר. יש להתחבר תחילה דרך הגדרות המערכת.');
    }
    let qClause = "trashed = false";
    if (query) {
      const safeQ = query.replace(/'/g, "");
      qClause += " and (name contains '" + safeQ + "' or fullText contains '" + safeQ + "')";
    }
    const url = 'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(qClause) + '&pageSize=' + pageSize + '&fields=files(id,name,mimeType,modifiedTime,webViewLink,size)';

    const res = await fetch(url, {
      headers: { Authorization: 'Bearer ' + this.config.accessToken }
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error('שגיאה בחיפוש ב-Google Drive (' + res.status + '): ' + err);
    }
    const data = await res.json();
    return data.files || [];
  }
}

window.googleClient = new GoogleIntegration();
