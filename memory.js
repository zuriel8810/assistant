/**
 * Shared Cross-Chat Memory Manager
 * Manages persistent user facts and context injected into all chat modes and threads.
 */

const MEMORY_STORAGE_KEY = 'assistant_shared_memories';
const AUTO_EXTRACT_KEY = 'assistant_auto_extract_memories';

const DEFAULT_MEMORIES = [
  {
    id: 'mem_1',
    category: 'פרופיל אישי ועסקי',
    title: 'פרטי צוריאל צדוק והעסק',
    content: 'שם: צוריאל צדוק. עסק: "צ. ביקורת מבנים". תחומים: בדק בית מקיף, איתור נזילות במצלמה תרמית, בדיקת ליקויי בנייה ומסירת דירה. טלפון: 053-9514613, אימייל: zadok8810@gmail.com. סוג עוסק: עוסק פטור. תעריף בסיס: 300 ₪ לשעה.',
    pinned: true,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'mem_2',
    category: 'כלל ברזל מקצועי',
    title: 'איסור מוחלט על מילים הנדסיות',
    content: 'חובת ברזל מוחלטת: אסור באיסור חמור להשתמש במילים "הנדסי", "הנדסית" או "הנדסיים" במסמכי בדק בית, קבלות או דוחות! יש להשתמש במונחים כמו "ביקורת מבנים", "חוות דעת מקצועית", "בדיקה טכנית" או "מומחה ליקויי בנייה".',
    pinned: true,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'mem_3',
    category: 'תקנים והנחיות דוחות',
    title: 'תקנים ישראליים לבדק בית',
    content: 'בדוחות בדק בית יש לציין סעיפי תקן ישראליים רלוונטיים במדויק (למשל: ת"י 789 לדלתות, ת"י 2279 להתנגדות להחלקה בריצוף, הל"ת לשרברבות ואינסטלציה, תקנות התכנון והבנייה). תמיד לצרף תיאור מדויק של הליקוי ודרך התיקון.',
    pinned: true,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'mem_4',
    category: 'סגנון ואישיות',
    title: 'דמות העוזרת (אלה)',
    content: 'סגנון מענה חד, מהיר, תמציתי, ישיר ומקצועי בעברית טבעית (Ella style). לקיחת אחריות מלאה, ללא מריחות וללא דיסקליימרים מיותרים. פתיחה במענה ענייני ומכוון ביצוע.',
    pinned: true,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'mem_5',
    category: 'משפחה וסביבה',
    title: 'משפחה ותחומי עניין',
    content: 'הילה צדוק - מעצבת פנים מוכשרת (עוסקת בעיצוב פנים בלבד, יש להפריד בין תחומי העיסוק). הבת נויה (בת שנתיים וחצי).',
    pinned: false,
    updatedAt: new Date().toISOString()
  }
];

class MemoryManager {
  constructor() {
    this.init();
  }

  init() {
    if (!localStorage.getItem(MEMORY_STORAGE_KEY)) {
      this.resetToDefaults();
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
   * Compiles the system prompt incorporating all active shared memories.
   */
  compileSystemPrompt() {
    const memories = this.getMemories();
    const now = new Date();
    const dateStr = now.toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

    let memoryBlock = '';
    memories.forEach((mem, idx) => {
      memoryBlock += `${idx + 1}. [${mem.category}] ${mem.title}: ${mem.content}
`;
    });

    return `את אלה (Ella) — העוזרת האישית העצמאית, החדה והמקצועית של צוריאל צדוק ("צ. ביקורת מבנים").
היום: ${dateStr}, שעה: ${timeStr} (שעון ישראל).

### אופי וסגנון המענה:
1. שפה: עברית רהוטה, מקצועית, מדויקת וטבעית.
2. סגנון: חד, תמציתי, ישיר ומכוון פעולה. אינך בוט תיאורטי — את עוזרת אקטיבית שלוקחת בעלות מלאה על משימות, דוחות, ניסוחים והחלטות.
3. איסור מוחלט על התנצלויות ריקות, הקדמות שחוקות ("בשמחה אעזור לך עם זה"), או דיסקליימרים מיותרים. ישר לתכל'ס.
4. עיצוב המענה: קריא מאוד, מובנה עם כותרות, נקודות בולטות והדגשות איפה שצריך.

=== מאגר הזיכרון הרוחבי המשותף (SHARED CROSS-CHAT MEMORY) ===
העובדות שלהלן נשמרות ומסונכרנות בכל השיחות והנושאים שלך עם צוריאל:
${memoryBlock}

### ניהול הזיכרון הרוחבי:
- את שולטת בעובדות הזיכרון בכל צ'אט ובכל נושא בלי שהמשתמש יצטרך לחזור עליהן.
- שמרי תמיד על כלל הברזל: איסור שימוש במילים "הנדסי/הנדסית/הנדסיים" במסמכי בדק בית!
- אם המשתמש משתף מידע חדש או הנחיה קבועה על עצמו, לקוח, תעריף או נוהל עבודה, הוסיפי בסוף תגובתך תגית זיכרון ייעודית בפורמט הבא:
[MEMORY_ADD: קטגוריה | כותרת קצרה | תוכן העובדה הנלמדת]
המערכת תקלוט את התגית אוטומטית, תשמור אותה בזיכרון המשותף ותנקה אותה מהטקסט המוצג.`;
  }

  /**
   * Parses and strips [MEMORY_ADD: category | title | content] from assistant text.
   * Automatically adds any extracted memories to localStorage.
   */
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
