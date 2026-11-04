/**
 * AI Engine for אָדָם (Adam) - Multi-Agent & Cloud Automation System
 * Handles direct browser API calls with real-time SSE streaming, Hetzner Cloud Backend tools, and Google Workspace integration.
 */

const AI_CONFIG_KEY = 'adam_ai_config';
const BACKEND_CONFIG_KEY = 'adam_backend_config';

const DEFAULT_AI_CONFIG = {
  provider: 'anthropic',
  apiKey: '',
  model: 'claude-3-5-sonnet-20240620',
  temperature: 0.4,
  customBaseUrl: ''
};

const DEFAULT_BACKEND_CONFIG = {
  serverUrl: 'http://195.201.91.47:8080',
  serverToken: 'adam_secret_2026_hetzner'
};

const ADAM_SUBAGENTS = {
  general: {
    id: 'general',
    name: 'אָדָם ראשי',
    badge: 'אָדָם • כללי',
    desc: 'עוזר אישי, ניהול משימות, דוחות וזיכרון רוחבי',
    icon: '👤'
  },
  developer: {
    id: 'developer',
    name: 'סוכן קוד ופיתוח',
    badge: '💻 מפתח',
    desc: 'כתיבת קוד, ארכיטקטורה, גיט, סקריפטים ופקודות שרת',
    icon: '💻'
  },
  browser: {
    id: 'browser',
    name: 'סוכן גלישה ואוטומציה',
    badge: '🌐 גלישה וענן',
    desc: 'גלישה בדפדפן ענן Playwright, חיפוש מידע ברשת וחילוץ תוכן',
    icon: '🌐'
  },
  research: {
    id: 'research',
    name: 'סוכן תקנים ומחקר',
    badge: '📐 תקנים ומחקר',
    desc: 'תקני בנייה ישראליים, ניתוח ליקויים ומאגר בדק בית צוריאל',
    icon: '📐'
  }
};

class AIEngine {
  constructor() {
    this.config = this.loadConfig();
    this.backendConfig = this.loadBackendConfig();
    this.activeSubagent = 'general';
    this.abortController = null;
  }

  loadConfig() {
    try {
      let data = localStorage.getItem(AI_CONFIG_KEY);
      if (!data) {
        // Automatically migrate from old assistant_ai_config so user doesn't lose their API key!
        data = localStorage.getItem('assistant_ai_config');
      }
      let cfg = data ? { ...DEFAULT_AI_CONFIG, ...JSON.parse(data) } : { ...DEFAULT_AI_CONFIG };
      if (cfg.model === 'claude-3-5-sonnet-20241022' || !cfg.model) {
        cfg.model = 'claude-3-5-sonnet-20240620';
      }
      localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(cfg));
      return cfg;
    } catch (e) {
      console.error('Error loading AI config:', e);
      return { ...DEFAULT_AI_CONFIG };
    }
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(this.config));
  }

  loadBackendConfig() {
    try {
      const data = localStorage.getItem(BACKEND_CONFIG_KEY);
      return data ? { ...DEFAULT_BACKEND_CONFIG, ...JSON.parse(data) } : { ...DEFAULT_BACKEND_CONFIG };
    } catch (e) {
      console.error('Error loading Backend config:', e);
      return { ...DEFAULT_BACKEND_CONFIG };
    }
  }

  saveBackendConfig(newConfig) {
    this.backendConfig = { ...this.backendConfig, ...newConfig };
    localStorage.setItem(BACKEND_CONFIG_KEY, JSON.stringify(this.backendConfig));
  }

  setSubagent(agentId) {
    if (ADAM_SUBAGENTS[agentId]) {
      this.activeSubagent = agentId;
      window.dispatchEvent(new CustomEvent('adam-subagent-changed', { detail: { agent: agentId } }));
      return true;
    }
    return false;
  }

  getSubagent() {
    return ADAM_SUBAGENTS[this.activeSubagent] || ADAM_SUBAGENTS.general;
  }

  isConfigured() {
    return !!(this.config.apiKey && this.config.apiKey.trim().length > 5);
  }

  abortStream() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  async callBackend(endpoint, body = {}) {
    const baseUrl = (this.backendConfig.serverUrl || 'http://195.201.91.47:8080').replace(/\/+$/, '');
    const token = this.backendConfig.serverToken || 'adam_secret_2026_hetzner';

    const url = baseUrl + (endpoint.startsWith('/') ? '' : '/') + endpoint;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error('שגיאת שרת ענן (' + res.status + '): ' + errText);
    }
    return await res.json();
  }

  async testBackendConnection() {
    const baseUrl = (this.backendConfig.serverUrl || 'http://195.201.91.47:8080').replace(/\/+$/, '');
    const url = baseUrl + '/health';
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) throw new Error('סטטוס שרת: ' + res.status);
    return await res.json();
  }

  async executeTool(toolName, args) {
    console.log('[Adam Tool Exec] ' + toolName, args);
    switch (toolName) {
      case 'web_search': {
        const query = args.query || args.q || '';
        const limit = args.limit || 5;
        return await this.callBackend('/api/search', { query, limit });
      }
      case 'web_browse': {
        const url = args.url || '';
        const mode = args.mode || 'text';
        return await this.callBackend('/api/browse', { url, mode, timeout: 25 });
      }
      case 'cloud_exec': {
        const command = args.command || args.cmd || '';
        const cwd = args.cwd || '/tmp';
        return await this.callBackend('/api/exec', { command, cwd, timeout: 30 });
      }
      case 'delegate_subagent': {
        const agentType = args.agent_type || 'general';
        const task = args.task || '';
        return await this.callBackend('/api/subagent', { agent_type: agentType, task, context: args.context });
      }
      case 'google_read_emails': {
        if (!window.googleClient || !window.googleClient.isConnected()) {
          return { error: 'חשבון Google אינו מחובר. יש להתחבר דרך הגדרות המערכת ⚙️' };
        }
        return await window.googleClient.listRecentEmails({ maxResults: args.max_results || 5, query: args.query || '' });
      }
      case 'google_list_events': {
        if (!window.googleClient || !window.googleClient.isConnected()) {
          return { error: 'חשבון Google אינו מחובר. יש להתחבר דרך הגדרות המערכת ⚙️' };
        }
        return await window.googleClient.listCalendarEvents({ timeMin: args.time_min, timeMax: args.time_max, maxResults: args.max_results || 10 });
      }
      case 'google_create_event': {
        if (!window.googleClient || !window.googleClient.isConnected()) {
          return { error: 'חשבון Google אינו מחובר. יש להתחבר דרך הגדרות המערכת ⚙️' };
        }
        return await window.googleClient.createCalendarEvent(args);
      }
      case 'google_search_drive': {
        if (!window.googleClient || !window.googleClient.isConnected()) {
          return { error: 'חשבון Google אינו מחובר. יש להתחבר דרך הגדרות המערכת ⚙️' };
        }
        return await window.googleClient.searchDriveFiles({ query: args.query || '', pageSize: args.page_size || 10 });
      }
      default:
        throw new Error('כלי לא מוכר: ' + toolName);
    }
  }

  async streamChat(messages, { onChunk, onComplete, onError }) {
    this.abortStream();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const systemPrompt = window.memoryManager.compileSystemPrompt(this.activeSubagent);

    const lastMsg = messages[messages.length - 1] ? (messages[messages.length - 1].content || '') : '';
    const shouldInterceptForTools = this._detectDirectToolIntent(lastMsg);

    if (shouldInterceptForTools) {
      try {
        return await this._handleDirectToolExecution(shouldInterceptForTools, messages, systemPrompt, { onChunk, onComplete, signal });
      } catch (toolErr) {
        console.warn('Direct tool interception error, falling back:', toolErr);
      }
    }

    if (!this.isConfigured() || this.config.provider === 'demo') {
      return this._streamDemoResponse(messages, systemPrompt, { onChunk, onComplete, onError, signal });
    }

    try {
      if (this.config.provider === 'anthropic') {
        await this._streamAnthropic(messages, systemPrompt, { onChunk, onComplete, signal });
      } else if (this.config.provider === 'openai' || this.config.provider === 'openrouter') {
        await this._streamOpenAI(messages, systemPrompt, { onChunk, onComplete, signal });
      } else {
        await this._streamDemoResponse(messages, systemPrompt, { onChunk, onComplete, onError, signal });
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Stream aborted by user');
      } else {
        console.error('AI Stream Error:', err);
        if (onError) onError(err);
      }
    } finally {
      this.abortController = null;
    }
  }

  _detectDirectToolIntent(text) {
    const t = text.trim();
    const lower = t.toLowerCase();
    
    if (lower.startsWith('חפש ברשת ') || lower.startsWith('חפש לי ') || lower.startsWith('חפש באינטרנט ') || lower.includes('בדוק לי באתר ') || lower.startsWith('גלוש ל')) {
      if (lower.startsWith('בדוק לי באתר ') || lower.startsWith('גלוש ל')) {
        const urlMatch = t.match(/https?:\/\/[^\s]+/);
        if (urlMatch) return { tool: 'web_browse', args: { url: urlMatch[0] } };
      }
      const q = t.replace(/^(חפש ברשת|חפש לי|חפש באינטרנט|חיפוש)\s*/, '').trim();
      return { tool: 'web_search', args: { query: q || t } };
    }

    if (lower.startsWith('הרץ פקודה ') || lower.startsWith('פקודת ענן ') || lower.startsWith('bash:')) {
      const cmd = t.replace(/^(הרץ פקודה|פקודת ענן|bash:)\s*/, '').trim();
      return { tool: 'cloud_exec', args: { command: cmd } };
    }

    if (lower.includes('קרא מיילים') || lower.includes('בדוק מיילים') || lower.includes('אימיילים אחרונים')) {
      return { tool: 'google_read_emails', args: { max_results: 5 } };
    }

    if (lower.includes('בדוק יומן') || lower.includes('לוח פגישות') || lower.includes('אירועים קרובים')) {
      return { tool: 'google_list_events', args: { max_results: 10 } };
    }

    if (lower.startsWith('חפש בדרייב ') || lower.startsWith('קבצים בדרייב ')) {
      const q = t.replace(/^(חפש בדרייב|קבצים בדרייב)\s*/, '').trim();
      return { tool: 'google_search_drive', args: { query: q } };
    }

    return null;
  }

  async _handleDirectToolExecution(intent, messages, systemPrompt, { onChunk, onComplete, signal }) {
    let intro = '';
    if (intent.tool === 'web_search') {
      intro = '🔍 **[סוכן גלישה]** מבצע חיפוש ברשת בשרת הענן Hetzner עבור: *"' + intent.args.query + '"*...\n\n';
    } else if (intent.tool === 'web_browse') {
      intro = '🌐 **[סוכן גלישה]** פותח עמוד בדפדפן ענן Playwright: *' + intent.args.url + '*...\n\n';
    } else if (intent.tool === 'cloud_exec') {
      intro = '⚡ **[סוכן קוד ופיתוח]** מריץ פקודה בשרת Hetzner: `' + intent.args.command + '`\n\n';
    } else if (intent.tool.startsWith('google_')) {
      intro = '📅 **[עוזר אישי]** מתחבר ל-Google Workspace לביצוע הפעולה...\n\n';
    }

    if (onChunk) onChunk(intro);
    let fullOutput = intro;

    let toolResult;
    try {
      toolResult = await this.executeTool(intent.tool, intent.args);
    } catch (err) {
      const errText = '⚠️ שגיאה בהרצת הכלי: ' + err.message + '\n\nודא ששרת האוטומציה ב-Hetzner פועל בכתובת המוגדרת (' + this.backendConfig.serverUrl + ').';
      fullOutput += errText;
      if (onChunk) onChunk(errText);
      if (onComplete) onComplete(fullOutput);
      return;
    }

    let formattedResult = '';
    if (intent.tool === 'web_search') {
      const results = toolResult.results || [];
      if (results.length === 0) {
        formattedResult = 'לא נמצאו תוצאות ישירות ברשת עבור שאילתה זו.';
      } else {
        formattedResult = 'נמצאו ' + results.length + ' תוצאות מובילות:\n\n';
        results.forEach((r, i) => {
          formattedResult += (i + 1) + '. **[' + r.title + '](' + r.link + ')**\n   ' + r.snippet + '\n\n';
        });
      }
    } else if (intent.tool === 'web_browse') {
      formattedResult = '### כותרת העמוד: ' + toolResult.title + '\nסטטוס: ' + toolResult.status_code + ' | אורך תוכן: ' + toolResult.content_length + ' תווים\n\n**תקציר התוכן מהעמוד:**\n\n' + toolResult.content.slice(0, 2500);
      if (toolResult.content.length > 2500) formattedResult += '\n\n*(התוכן נחתך לתצוגה)*';
    } else if (intent.tool === 'cloud_exec') {
      formattedResult = 'קוד יציאה: ' + toolResult.exit_code + ' (זמן: ' + toolResult.duration_ms + 'ms)\n\n' +
        (toolResult.stdout ? '**פלט:**\n```text\n' + toolResult.stdout + '\n```\n\n' : '') +
        (toolResult.stderr ? '**שגיאות/אזהרות:**\n```text\n' + toolResult.stderr + '\n```' : '');
    } else if (intent.tool === 'google_read_emails') {
      if (toolResult.error) {
        formattedResult = toolResult.error;
      } else if (toolResult.length === 0) {
        formattedResult = 'לא נמצאו הודעות דואר אלקטרוני אחרונות בתיבה.';
      } else {
        formattedResult = '### אימיילים אחרונים מ-Gmail:\n\n';
        toolResult.forEach((em, idx) => {
          formattedResult += (idx + 1) + '. **' + em.subject + '**\n   מאת: ' + em.from + ' | תאריך: ' + em.date + '\n   תקציר: ' + em.snippet + '\n\n';
        });
      }
    } else if (intent.tool === 'google_list_events') {
      if (toolResult.error) {
        formattedResult = toolResult.error;
      } else if (toolResult.length === 0) {
        formattedResult = 'אין אירועים קרובים ביומן Google.';
      } else {
        formattedResult = '### אירועים קרובים ב-Google Calendar:\n\n';
        toolResult.forEach((ev, idx) => {
          formattedResult += (idx + 1) + '. **' + ev.summary + '** (' + ev.start + ' עד ' + ev.end + ')\n   מיקום: ' + (ev.location || 'לא צוין') + '\n\n';
        });
      }
    } else if (intent.tool === 'google_search_drive') {
      if (toolResult.error) {
        formattedResult = toolResult.error;
      } else if (toolResult.length === 0) {
        formattedResult = 'לא נמצאו קבצים תואמים ב-Google Drive.';
      } else {
        formattedResult = '### קבצים שנמצאו ב-Google Drive:\n\n';
        toolResult.forEach((f, idx) => {
          formattedResult += (idx + 1) + '. **[' + f.name + '](' + f.webViewLink + ')** (' + f.mimeType + ')\n';
        });
      }
    } else {
      formattedResult = JSON.stringify(toolResult, null, 2);
    }

    fullOutput += formattedResult;
    if (onChunk) onChunk(formattedResult);
    if (onComplete) onComplete(fullOutput);
  }

  async _streamAnthropic(messages, systemPrompt, { onChunk, onComplete, signal }) {
    const url = (this.config.customBaseUrl || 'https://api.anthropic.com/v1/messages').trim();
    
    const formattedMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    }));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey.trim(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: (this.config.model && this.config.model !== 'claude-3-5-sonnet-20241022') ? this.config.model : 'claude-3-5-sonnet-20240620',
        max_tokens: 4096,
        temperature: parseFloat(this.config.temperature) || 0.4,
        system: systemPrompt,
        messages: formattedMessages,
        stream: true
      }),
      signal
    });

    // Check for model fallback if 404 not found
      if (response.status === 404 && !fallbackAttempted) {
        console.warn('Model not found, attempting fallback to claude-3-5-sonnet-20240620 or claude-3-haiku-20240307...');
        const fallbackModel = (payload.model.includes('sonnet') && !payload.model.includes('20240620')) 
          ? 'claude-3-5-sonnet-20240620' 
          : 'claude-3-haiku-20240307';
        if (payload.model !== fallbackModel) {
          payload.model = fallbackModel;
          return this.callAnthropic(payload, onChunk, true);
        }
      }
      if (!response.ok) {
      const errText = await response.text();
      throw new Error('שגיאת Anthropic (' + response.status + '): ' + errText);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let accumulatedText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const dataStr = trimmed.slice(6);
        if (dataStr === '[DONE]') continue;

        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.type === 'content_block_delta' && parsed.delta && parsed.delta.type === 'text_delta') {
            const chunk = parsed.delta.text;
            accumulatedText += chunk;
            if (onChunk) onChunk(chunk);
          }
        } catch (e) {}
      }
    }

    if (onComplete) onComplete(accumulatedText);
  }

  async _streamOpenAI(messages, systemPrompt, { onChunk, onComplete, signal }) {
    let url = this.config.customBaseUrl;
    if (!url) {
      url = this.config.provider === 'openrouter' 
        ? 'https://openrouter.ai/api/v1/chat/completions'
        : 'https://api.openai.com/v1/chat/completions';
    }

    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
    ];

    const headers = {
      'Authorization': 'Bearer ' + this.config.apiKey.trim(),
      'Content-Type': 'application/json'
    };

    if (this.config.provider === 'openrouter') {
      headers['HTTP-Referer'] = window.location.origin;
      headers['X-Title'] = 'Adam Personal Assistant';
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.config.model || (this.config.provider === 'openrouter' ? 'anthropic/claude-3.5-sonnet' : 'gpt-4o'),
        temperature: parseFloat(this.config.temperature) || 0.4,
        messages: formattedMessages,
        stream: true
      }),
      signal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error('שגיאת API (' + response.status + '): ' + errText);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let accumulatedText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const dataStr = trimmed.slice(6);
        if (dataStr === '[DONE]') continue;

        try {
          const parsed = JSON.parse(dataStr);
          const chunk = parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content ? parsed.choices[0].delta.content : '';
          if (chunk) {
            accumulatedText += chunk;
            if (onChunk) onChunk(chunk);
          }
        } catch (e) {}
      }
    }

    if (onComplete) onComplete(accumulatedText);
  }

  async _streamDemoResponse(messages, systemPrompt, { onChunk, onComplete, signal }) {
    const lastMsg = messages[messages.length - 1] ? (messages[messages.length - 1].content || '') : '';
    const mems = window.memoryManager.getMemories();
    const sub = this.getSubagent();
    
    let answer = '';
    const lower = lastMsg.toLowerCase();

    if (lower.includes('שלום') || lower.includes('היי') || lower.includes('מי אתה')) {
      answer = 'שלום צוריאל! אני **אָדָם**, העוזר האישי העצמאי שלך בניהול "צ. ביקורת מבנים".\n\n' +
        'אני מחובר למערך רב-סוכנים (Multi-Agent System) ולשרת הענן שלך ב-Hetzner (195.201.91.47), כולל סוכן גלישה עם Chrome Playwright, סוכן קוד ופקודות, סוכן תקנים, וחיבור Google Workspace.\n\n' +
        '### נתוני מפתח המסונכרנים בזיכרון הרוחבי המשותף:\n' +
        '- **פרופיל עסקי:** צ. ביקורת מבנים (בדק בית, איתור נזילות ותרמוגרפיה) | 053-9514613 | zadok8810@gmail.com.\n' +
        '- **כלל ברזל מוחלט:** איסור שימוש במילים "הנדסי/הנדסית/הנדסיים" במסמכים וקבלות.\n' +
        '- **מאגר בדק בית:** מאגר צוריאל המאוחד (1,554 ממצאים ב-48 קטגוריות).\n' +
        '- **קו קולי:** 0772254910 במערכת ימות המשיח.\n' +
        '- **סוכן פעיל כרגע:** ' + sub.name + ' (' + sub.desc + ').\n\n' +
        'במה נתמקד כעת? בדיקת תקן (למשל ת"י 2279 או 789), חיפוש ברשת ("חפש ברשת..."), הרצת פקודת ענן ("הרץ פקודה..."), או בדיקת מיילים ויומן?';
    } else if (lower.includes('תקן') || lower.includes('ליקוי') || lower.includes('דלת') || lower.includes('ריצוף')) {
      answer = 'לגבי בדיקת הליקוי והתקן הרלוונטי:\n\n' +
        '1. **זיהוי התקן:**\n' +
        '   - עבור **דלתות פנים**: חל ת"י 789 (רוחב מעבר נטו לפחות 70 ס"מ בחדרי מגורים, 60 ס"מ בחדרי רחצה).\n' +
        '   - עבור **ריצוף ומדרגות**: חל ת"י 2279 (התנגדות להחלקה) ות"י 1555 חלק 3.\n\n' +
        '2. **ניסוח מקצועי לדוח בדק בית (בהתאם לכללי הברזל):**\n' +
        '   > "בבדיקת המפתח נמצא כי רוחב המעבר עומד על 67 ס"מ בלבד בניגוד להוראות ת"י 789. נדרשת התאמת כנף הדלת והמשקוף להבטחת מעבר תקני של 70 ס"מ נטו."\n\n' +
        '3. שים לב: הניסוח תואם במדויק את כללי הברזל של "צ. ביקורת מבנים" ללא שום מונח הנדסי.';
    } else {
      answer = 'קיבלתי ומטפל בזה מיידית.\n\n' +
        'פנייתך: **"' + lastMsg.replace(/"/g, '\\"') + '"**\n\n' +
        'הנושא מעובד על ידי **' + sub.name + '** בהתאם להנחיות המקצועיות של **צ. ביקורת מבנים**:\n' +
        '- כל המידע וההנחיות מ-8 עובדות הזיכרון הרוחבי המשותף מוטמעים במענה.\n' +
        '- שרת הענן ב-Hetzner זמין לפעולות גלישה ואוטומציה.\n\n' +
        '*(טיפ: לחיבור מפתח API ישיר מול Claude 3.5 Sonnet או GPT-4o, היכנס להגדרות ⚙️).*';
    }

    const words = answer.split(' ');
    for (let i = 0; i < words.length; i++) {
      if (signal && signal.aborted) break;
      const piece = (i === 0 ? '' : ' ') + words[i];
      if (onChunk) onChunk(piece);
      await new Promise(r => setTimeout(r, 18));
    }

    if (onComplete && (!signal || !signal.aborted)) {
      onComplete(answer);
    }
  }
}

window.ADAM_SUBAGENTS = ADAM_SUBAGENTS;
window.aiEngine = new AIEngine();
