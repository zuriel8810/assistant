/**
 * Shared Cross-Chat Memory Manager for אָדָם (Adam)
 * Manages persistent user facts and context injected into all chat modes and threads.
 */

const MEMORY_STORAGE_KEY = 'adam_shared_memories';
const AUTO_EXTRACT_KEY = 'adam_auto_extract_memories';

const DEFAULT_MEMORIES = [
  {
    id: 'mem_1',
    category: 'פרופיל אישי ועסקי',
    title: 'פרטי צוריאל צדוק והעסק',
    content: 'שם: צוריאל צדוק. עסק: "צ. ביקורת מבנים". תחומים: בדק בית מקיף, איתור נזילות במצלמה תרמית, בדיקת ליקויי בנייה ומסירת דירה. טלפון: 053-9514613, אימייל: zadok8810@gmail.com. סוג עוסק: עוסק פטור. תעריף שעתי: 300 ₪.',
    pinned: true,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'mem_2',
    category: 'כלל ברזל מקצועי',
    title: 'איסור מוחלט על מילים הנדסיות',
    content: 'חובת ברזל מוחלטת: אסור באיסור חמור להשתמש במילים "הנדסי", "הנדסית" או "הנדסיים" במסמכי בדק בית, קבלות או דוחות! יש להשתמש אך ורק במונחים כמו "ביקורת מבנים", "חוות דעת מקצועית", "בדיקה טכנית" או "מומחה ליקויי בנייה".',
    pinned: true,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'mem_3',
    category: 'מאגר בדק בית (ריפורטו)',
    title: 'מאגר בדק בית צוריאל המאוחד',
    content: 'מאגר בדק בית מאוחד "מאגר בדק בית צוריאל" הכולל 1,554 ממצאים ב-48 קטגוריות. כל 3 המאגרים הישנים הכפולים נמחקו לחלוטין ב-4 בנובמבר 2026. יש להסתמך רק על המאגר המאוחד.',
    pinned: true,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'mem_4',
    category: 'משפחה ותחומי עיסוק',
    title: 'הילה צדוק - עיצוב פנים ולימודים',
    content: 'הילה צדוק עוסקת בעיצוב פנים בלבד (הפרדה מלאה מבדק בית). לומדת קורס רוויט (Revit בימי שלישי 19:00-22:00), לימודים באוניברסיטה הפתוחה (ימי א ו-ג לסירוגין) ואנגלית.',
    pinned: true,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'mem_5',
    category: 'משפחה',
    title: 'הבת נויה',
    content: 'הבת נויה (בת שנתיים וחצי).',
    pinned: false,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'mem_6',
    category: 'תשתיות ומערכות',
    title: 'קו קולי אָדָם בשרת Hetzner',
    content: 'קו קולי של אָדָם בטלפון 0772254910 דרך מערכת ימות המשיח. השרת מאוחסן ב-Hetzner (195.201.91.47) עם שירות yemot.service ומנוע אוטומציה assistant-browser.service.',
    pinned: true,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'mem_7',
    category: 'משפטי וגבייה',
    title: 'תביעה נגד משרד עו"ד משה מצליח',
    content: 'תביעה משפטית פעילה מול משרד עו"ד משה מצליח (מול חגית יתח) לגביית יתרת תשלום על סך 4,000 ₪.',
    pinned: false,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'mem_8',
    category: 'הקשר טכנולוגי שוטף',
    title: 'חילוץ והתקנת רוויט 2027 להילה',
    content: 'טיפול בחילוץ קבצי התקנה של Revit 2027 עבור הילה מתוך קבצי RAR מפוצלים בחלקים של 1.9GB.',
    pinned: false,
    updatedAt: new Date().toISOString()
  }
];

class MemoryManager {
  constructor() {
    this.init();
  }

  init() {
    // If existing storage was from old key, upgrade or set defaults
    const oldKey = localStorage.getItem('assistant_shared_memories');
    if (!localStorage.getItem(MEMORY_STORAGE_KEY)) {
      if (oldKey) {
        try {
          const oldData = JSON.parse(oldKey);
          // merge old and defaults
          this.saveMemories(DEFAULT_MEMORIES);
        } catch(e) {
          this.resetToDefaults();
        }
      } else {
        this.resetToDefaults();
      }
    }
  }

  getMemories() {
    try {
      const data = localStorage.getItem(MEMORY_STORAGE_KEY);
      return data ? JSON.parse(data) : DEFAULT_MEMORIES;
    } catch (e) {
      console.error('Error loading memories:', e);
      return DEFAULT_MEMORIES;
    }
  }

  saveMemories(memories) {
    localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memories));
  }

  addMemory(category, title, content, pinned = false) {
    const memories = this.getMemories();
    const newMem = {
      id: 'mem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      category: category || 'כללי',
      title: title || content.slice(0, 30),
      content: content.trim(),
      pinned: !!pinned,
      updatedAt: new Date().toISOString()
    };
    memories.unshift(newMem);
    this.saveMemories(memories);
    return newMem;
  }

  updateMemory(id, fields) {
    const memories = this.getMemories();
    const idx = memories.findIndex(m => m.id === id);
    if (idx !== -1) {
      memories[idx] = {
        ...memories[idx],
        ...fields,
        updatedAt: new Date().toISOString()
      };
      this.saveMemories(memories);
      return memories[idx];
    }
    return null;
  }

  deleteMemory(id) {
    let memories = this.getMemories();
    memories = memories.filter(m => m.id !== id);
    this.saveMemories(memories);
    return true;
  }

  resetToDefaults() {
    localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(DEFAULT_MEMORIES));
    return DEFAULT_MEMORIES;
  }

  isAutoExtractEnabled() {
    const val = localStorage.getItem(AUTO_EXTRACT_KEY);
    return val === null ? true : val === 'true';
  }

  setAutoExtractEnabled(enabled) {
    localStorage.setItem(AUTO_EXTRACT_KEY, String(enabled));
  }

  /**
   * Compiles the system prompt incorporating all active shared memories and persona.
   */
  compileSystemPrompt(activeSubagent = 'general') {
    const memories = this.getMemories();
    const now = new Date();
    const dateStr = now.toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

    let memoryBlock = '';
    memories.forEach((mem, idx) => {
      memoryBlock += `${idx + 1}. [${mem.category}] ${mem.title}: ${mem.content}\n`;
    });

    const subagentPersonas = {
      developer: 'אתה כעת במצב "סוכן קוד ופיתוח (Developer Agent)": מומחה ארכיטקטורה, פייתון, נוד, גיט, סקריפטים ופתרון תקלות עמוקות.',
      browser: 'אתה כעת במצב "סוכן גלישה ואוטומציה (Browser Agent)": מתמחה בחיפוש מידע ברשת, גישה לעמודי אינטרנט באמצעות דפדפן ענן וניתוח תוכן בזמן אמת.',
      research: 'אתה כעת במצב "סוכן תקנים ומחקר (Research Agent)": מומחה תקני בנייה ישראליים (ת"י 789, 2279, הל"ת, תקנות התכנון והבנייה) ומאגר בדק בית צוריאל.',
      general: 'אתה כעת במצב "עוזר אישי ראשי (General Assistant)": ניהול כולל, משימות, מיילים, יומן, שירות לקוחות ותכלול המערכת.'
    };

    const currentSubagentPersona = subagentPersonas[activeSubagent] || subagentPersonas.general;

    return `אתה אָדָם (Adam) — העוזר האישי העצמאי, החד והמקצועי של צוריאל צדוק ("צ. ביקורת מבנים").
היום: ${dateStr}, שעה: ${timeStr} (שעון ישראל).
${currentSubagentPersona}

### אופי וסגנון המענה:
1. שפה: עברית רהוטה, מקצועית, מדויקת וטבעית.
2. סגנון: חד, תמציתי, ישיר ומכוון פעולה. אינך בוט תיאורטי — אתה שותף פעיל שלוקח בעלות מלאה על משימות, דוחות, קוד, חיפושים ופניות.
3. איסור מוחלט על התנצלויות ריקות, פתיחות גנריות כמו "בשמחה אעזור לך עם זה", או דיסקליימרים מיותרים. ישר לתכל'ס.
4. עיצוב המענה: קריא מאוד, מובנה עם כותרות, נקודות בולטות, טבלאות והדגשות.

=== מאגר הזיכרון הרוחבי המשותף (SHARED CROSS-CHAT MEMORY) ===
העובדות שלהלן נשמרות ומסונכרנות בכל השיחות והנושאים שלך עם צוריאל:
${memoryBlock}

### כלל ברזל מקצועי:
איסור מוחלט על שימוש במילים "הנדסי/הנדסית/הנדסיים" במסמכי בדק בית וקבלות! יש להשתמש ב"ביקורת מבנים", "מומחה ליקויי בנייה", "בדיקה טכנית" וכדומה.

### ניהול הזיכרון הרוחבי:
- אם המשתמש מוסר מידע חדש או הנחיה קבועה על עצמו, לקוח, תעריף או נוהל עבודה, הוסף בסוף תגובתך תגית זיכרון ייעודית בפורמט הבא:
[MEMORY_ADD: קטגוריה | כותרת קצרה | תוכן העובדה הנלמדת]
המערכת תקלוט את התגית אוטומטית, תשמור אותה בזיכרון המשותף ותנקה אותה מהטקסט המוצג.`;
  }

  processExtractedMemories(text) {
    if (!this.isAutoExtractEnabled() || !text) return { cleanText: text, extracted: [] };

    const regex = /\[MEMORY_ADD:\s*([^|\]]+)\s*\|\s*([^|\]]+)\s*\|\s*([^\]]+)\]/g;
    const extracted = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      const category = match[1].trim();
      const title = match[2].trim();
      const content = match[3].trim();
      
      const saved = this.addMemory(category, title, content, false);
      extracted.push(saved);
    }

    const cleanText = text.replace(regex, '').trim();
    return { cleanText, extracted };
  }
}

// Global instance
window.memoryManager = new MemoryManager();

