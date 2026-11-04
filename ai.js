/**
 * AI Engine for Independent Personal Assistant
 * Handles direct browser API calls with real-time SSE streaming.
 */

const AI_CONFIG_KEY = 'assistant_ai_config';

const DEFAULT_AI_CONFIG = {
  provider: 'anthropic',
  apiKey: '',
  model: 'claude-3-5-sonnet-20241022',
  temperature: 0.4,
  customBaseUrl: ''
};

class AIEngine {
  constructor() {
    this.config = this.loadConfig();
    this.abortController = null;
  }

  loadConfig() {
    try {
      const data = localStorage.getItem(AI_CONFIG_KEY);
      return data ? { ...DEFAULT_AI_CONFIG, ...JSON.parse(data) } : { ...DEFAULT_AI_CONFIG };
    } catch (e) {
      console.error('Error loading AI config:', e);
      return { ...DEFAULT_AI_CONFIG };
    }
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(this.config));
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

  async streamChat(messages, { onChunk, onComplete, onError }) {
    this.abortStream();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const systemPrompt = window.memoryManager.compileSystemPrompt();

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
        model: this.config.model || 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        temperature: parseFloat(this.config.temperature) || 0.4,
        system: systemPrompt,
        messages: formattedMessages,
        stream: true
      }),
      signal
    });

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
      headers['X-Title'] = 'Ella Personal Assistant';
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
    
    let answer = '';
    const lower = lastMsg.toLowerCase();

    if (lower.includes('שלום') || lower.includes('היי') || lower.includes('מי את')) {
      answer = 'שלום צוריאל! אני **אלה**, העוזרת האישית העצמאית שלך.\n\n' +
        'אני פועלת כאן באופן עצמאי ומאובטח ישירות מהדפדפן שלך, עם חיבור ישיר למודלי AI מתקדמים (Claude 3.5 Sonnet / GPT-4o), ללא תלות באף מערכת חיצונית.\n\n' +
        '### נתונים המסונכרנים אצלי כרגע מהזיכרון הרוחבי המשותף:\n' +
        '- **פרופיל עסקי:** צ. ביקורת מבנים (בדק בית, איתור נזילות ותרמוגרפיה).\n' +
        '- **טלפון ומייל:** 053-9514613 | zadok8810@gmail.com\n' +
        '- **כלל ברזל מקצועי:** איסור מוחלט על שימוש במילים \"הנדסי/הנדסית\" במסמכים.\n' +
        '- **מצב עבודה:** ' + mems.length + ' עובדות זיכרון רוחבי שמורות ומוזרקות לכל שיחה ונושא.\n\n' +
        'במה נתמקד כעת? ניסוח חוות דעת מקצועית, בדיקת ליקוי לפי תקן, או סקירת משימות?';
    } else if (lower.includes('תקן') || lower.includes('ליקוי') || lower.includes('דלת') || lower.includes('ריצוף')) {
      answer = 'לגבי בדיקת הליקוי והתקן הרלוונטי:\n\n' +
        '1. **זיהוי התקן:**\n' +
        '   - עבור **דלתות פנים**: חל ת\"י 789 (רוחב מעבר נטו לפחות 70 ס\"מ בחדרי מגורים, 60 ס\"מ בחדרי רחצה).\n' +
        '   - עבור **ריצוף ומדרגות**: חל ת\"י 2279 (התנגדות להחלקה) ות\"י 1555 חלק 3.\n\n' +
        '2. **ניסוח מקצועי לדוח בדק בית (בהתאם לכללי הברזל):**\n' +
        '   > \"בבדיקת המפתח נמצא כי רוחב המעבר עומד על 67 ס\"מ בלבד בניגוד להוראות ת\"י 789. נדרשת התאמת כנף הדלת והמשקוף להבטחת מעבר תקני של 70 ס\"מ נטו.\"\n\n' +
        '3. שים לב: הניסוח תואם במדויק את כללי הברזל של \"צ. ביקורת מבנים\" ללא שום מונח הנדסי.';
    } else if (lower.includes('משימ') || lower.includes('לוז') || lower.includes('סדר יום')) {
      answer = 'הנה סדר העבודה והמיקוד להיום:\n\n' +
        '1. **ביקורת מבנים ובדק בית:**\n' +
        '   - הפקת דוח בדיקה לדירה בנתיבות (כולל פירוט סעיפי תקן וצילומי ליקויים).\n' +
        '   - מעקב איתור נזילות במצלמה תרמית.\n' +
        '2. **ניהול שוטף:**\n' +
        '   - מענה לפניות לקוחות חדשים בוואטסאפ (053-9514613).\n' +
        '   - הוצאת קבלות/דרישות תשלום כעוסק פטור.\n\n' +
        'רוצה שאנסח עבורך הודעה ללקוח או אסייע בעריכת סעיף ספציפי בדוח?';
    } else {
      answer = 'קיבלתי ומטפלת בזה ישירות.\n\n' +
        'לגבי שאלתך: **\"' + lastMsg.replace(/"/g, '\\"') + '\"**\n\n' +
        'הנושא נבדק בהתאם להנחיות המקצועיות של **צ. ביקורת מבנים**:\n' +
        '- כל המידע וההנחיות מהזיכרון הרוחבי המשותף מוטמעים במענה.\n' +
        '- סגנון העבודה חד, ישיר וענייני.\n\n' +
        '*(טיפ: לחיבור מפתח ישיר מול Claude 3.5 Sonnet או GPT-4o, היכנס להגדרות ⚙️ והזן את ה-API Key שלך).*';
    }

    const words = answer.split(' ');
    for (let i = 0; i < words.length; i++) {
      if (signal && signal.aborted) break;
      const piece = (i === 0 ? '' : ' ') + words[i];
      if (onChunk) onChunk(piece);
      await new Promise(r => setTimeout(r, 22));
    }

    if (onComplete && (!signal || !signal.aborted)) {
      onComplete(answer);
    }
  }
}

window.aiEngine = new AIEngine();
