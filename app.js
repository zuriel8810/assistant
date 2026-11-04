/**
 * Main Application Logic for אָדָם (Adam) Personal Assistant
 * Handles Dual Chat Modes, UI Interactions, Voice, Attachments, and Settings.
 */

// Storage keys
const MODE_KEY = 'assistant_active_mode'; // 'continuous' | 'topics'
const CONTINUOUS_CHAT_KEY = 'assistant_continuous_messages';
const THREADS_INDEX_KEY = 'assistant_threads_index';
const THREAD_MSG_PREFIX = 'assistant_thread_msgs_';
const ACTIVE_THREAD_ID_KEY = 'assistant_active_thread_id';

class AssistantApp {
  constructor() {
    this.mode = localStorage.getItem(MODE_KEY) || 'continuous';
    this.threads = this.loadThreads();
    this.activeThreadId = localStorage.getItem(ACTIVE_THREAD_ID_KEY) || (this.threads[0]?.id || null);
    this.continuousMessages = this.loadContinuousMessages();
    this.isStreaming = false;
    this.attachments = [];
    this.speechRecognizer = null;
    this.isRecording = false;

    this.cacheDOM();
    this.initMarkdown();
    this.bindEvents();
    this.initSpeech();
    this.applyMode(this.mode, false);
    this.updateMemoryBadges();
  }

  cacheDOM() {
    // Header
    this.btnSidebarToggle = document.getElementById('btnSidebarToggle');
    this.btnModeContinuous = document.getElementById('btnModeContinuous');
    this.btnModeTopics = document.getElementById('btnModeTopics');
    this.btnOpenMemory = document.getElementById('btnOpenMemory');
    this.btnNewChat = document.getElementById('btnNewChat');
    this.btnOpenSettings = document.getElementById('btnOpenSettings');
    this.memoryCountBadge = document.getElementById('memoryCountBadge');
    this.headerSubtitle = document.getElementById('headerSubtitle');

    // Sidebar
    this.threadsSidebar = document.getElementById('threadsSidebar');
    this.sidebarBackdrop = document.getElementById('sidebarBackdrop');
    this.btnSidebarNewChat = document.getElementById('btnSidebarNewChat');
    this.searchThreadsInput = document.getElementById('searchThreadsInput');
    this.threadsList = document.getElementById('threadsList');
    this.threadsCountInfo = document.getElementById('threadsCountInfo');

    // Chat
    this.messagesScrollArea = document.getElementById('messagesScrollArea');
    this.messagesList = document.getElementById('messagesList');
    this.welcomeCard = document.getElementById('welcomeCard');

    // Input area
    this.memoryPillInfo = document.querySelector('.memory-pill-info');
    this.btnMemoryPill = document.getElementById('btnMemoryPill');
    this.memoryCountText = document.getElementById('memoryCountText');
    this.attachmentsPreview = document.getElementById('attachmentsPreview');
    this.fileInput = document.getElementById('fileInput');
    this.btnAttach = document.getElementById('btnAttach');
    this.chatInput = document.getElementById('chatInput');
    this.btnMic = document.getElementById('btnMic');
    this.btnSend = document.getElementById('btnSend');
    this.iconSend = document.getElementById('iconSend');
    this.iconStop = document.getElementById('iconStop');

    // Memory Modal
    this.memoryModal = document.getElementById('memoryModal');
    this.btnCloseMemory = document.getElementById('btnCloseMemory');
    this.btnSaveMemoryModal = document.getElementById('btnSaveMemoryModal');
    this.memoriesListContainer = document.getElementById('memoriesListContainer');
    this.newMemCategory = document.getElementById('newMemCategory');
    this.newMemTitle = document.getElementById('newMemTitle');
    this.newMemContent = document.getElementById('newMemContent');
    this.btnAddMemory = document.getElementById('btnAddMemory');
    this.btnResetMemories = document.getElementById('btnResetMemories');
    this.systemPromptPreview = document.getElementById('systemPromptPreview');
    this.chkAutoExtract = document.getElementById('chkAutoExtract');

    // Settings Modal
    this.settingsModal = document.getElementById('settingsModal');
    this.btnCloseSettings = document.getElementById('btnCloseSettings');
    this.btnSaveSettings = document.getElementById('btnSaveSettings');
    this.settingProvider = document.getElementById('settingProvider');
    this.settingApiKey = document.getElementById('settingApiKey');
    this.btnToggleApiKeyVisibility = document.getElementById('btnToggleApiKeyVisibility');
    this.settingModel = document.getElementById('settingModel');
    this.settingTemperature = document.getElementById('settingTemperature');
    this.tempValueDisplay = document.getElementById('tempValueDisplay');
    this.btnExportData = document.getElementById('btnExportData');
    this.btnClearHistory = document.getElementById('btnClearHistory');
    
    // Subagents & Stage B integrations
    this.selectSubagent = document.getElementById('selectSubagent');
    this.settingBackendUrl = document.getElementById('settingBackendUrl');
    this.settingBackendToken = document.getElementById('settingBackendToken');
    this.btnTestBackend = document.getElementById('btnTestBackend');
    this.backendStatusBadge = document.getElementById('backendStatusBadge');
    this.settingGoogleClientId = document.getElementById('settingGoogleClientId');
    this.settingGoogleAccessToken = document.getElementById('settingGoogleAccessToken');
    this.btnGoogleLogin = document.getElementById('btnGoogleLogin');
    this.btnGoogleLogout = document.getElementById('btnGoogleLogout');
    this.googleStatusBadge = document.getElementById('googleStatusBadge');
  }

  initMarkdown() {
    if (window.marked) {
      window.marked.setOptions({
        breaks: true,
        gfm: true
      });
    }
  }

  renderMarkdown(text) {
    if (window.marked) {
      return window.marked.parse(text);
    }
    // Fallback basic formatter
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  bindEvents() {
    // Mode switcher
    this.btnModeContinuous.addEventListener('click', () => this.switchMode('continuous'));
    this.btnModeTopics.addEventListener('click', () => this.switchMode('topics'));

    // Sidebar
    this.btnSidebarToggle.addEventListener('click', () => this.toggleMobileSidebar());
    this.sidebarBackdrop.addEventListener('click', () => this.closeMobileSidebar());
    this.btnSidebarNewChat.addEventListener('click', () => this.handleNewChat());
    this.btnNewChat.addEventListener('click', () => this.handleNewChat());
    this.searchThreadsInput.addEventListener('input', (e) => this.renderThreadsList(e.target.value));

    // Input events
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    this.chatInput.addEventListener('input', () => {
      this.chatInput.style.height = 'auto';
      this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 160) + 'px';
    });

    this.btnSend.addEventListener('click', () => {
      if (this.isStreaming) {
        this.stopStreaming();
      } else {
        this.handleSend();
      }
    });

    // File attachments
    this.btnAttach.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', (e) => this.handleFileSelection(e));

    // Mic
    this.btnMic.addEventListener('click', () => this.toggleVoiceRecording());

    // Memory Modal
    this.btnOpenMemory.addEventListener('click', () => this.openMemoryModal());
    this.btnMemoryPill.addEventListener('click', () => this.openMemoryModal());
    this.btnCloseMemory.addEventListener('click', () => this.closeMemoryModal());
    this.btnSaveMemoryModal.addEventListener('click', () => this.closeMemoryModal());
    this.btnAddMemory.addEventListener('click', () => this.handleAddMemory());
    this.btnResetMemories.addEventListener('click', () => this.handleResetMemories());

    // Settings Modal
    this.btnOpenSettings.addEventListener('click', () => this.openSettingsModal());
    this.btnCloseSettings.addEventListener('click', () => this.closeSettingsModal());
    this.btnSaveSettings.addEventListener('click', () => this.saveSettings());
    this.settingTemperature.addEventListener('input', (e) => {
      this.tempValueDisplay.textContent = e.target.value;
    });
    this.btnToggleApiKeyVisibility.addEventListener('click', () => {
      const type = this.settingApiKey.type === 'password' ? 'text' : 'password';
      this.settingApiKey.type = type;
      this.btnToggleApiKeyVisibility.textContent = type === 'password' ? '👁️' : '🙈';
    });
    this.settingProvider.addEventListener('change', () => this.handleProviderChange());
    this.btnExportData.addEventListener('click', () => this.exportAllData());
    this.btnClearHistory.addEventListener('click', () => this.clearChatHistory());

    // Quick Prompts
    document.querySelectorAll('.quick-prompt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const prompt = btn.getAttribute('data-prompt');
        this.chatInput.value = prompt;
        this.handleSend();
      });
    });
  }

  /* ================= Mode Management ================= */

  switchMode(newMode) {
    if (this.mode === newMode) return;
    this.mode = newMode;
    localStorage.setItem(MODE_KEY, newMode);
    this.applyMode(newMode, true);
  }

  applyMode(mode, scrollToBottom = true) {
    if (mode === 'continuous') {
      this.btnModeContinuous.classList.add('active');
      this.btnModeTopics.classList.remove('active');
      this.threadsSidebar.classList.add('hidden');
      this.btnSidebarToggle.style.display = 'none';
      this.headerSubtitle.textContent = 'מצב רציף (ציר שיחה יחיד)';
      this.renderMessages(this.continuousMessages);
    } else {
      this.btnModeTopics.classList.add('active');
      this.btnModeContinuous.classList.remove('active');
      this.threadsSidebar.classList.remove('hidden');
      this.btnSidebarToggle.style.display = 'flex';
      this.headerSubtitle.textContent = 'מצב נושאים (שיחות מופרדות)';
      
      // Ensure at least one thread exists
      if (this.threads.length === 0) {
        this.createNewThread('שיחה ראשונה');
      } else if (!this.activeThreadId || !this.threads.find(t => t.id === this.activeThreadId)) {
        this.activeThreadId = this.threads[0].id;
        localStorage.setItem(ACTIVE_THREAD_ID_KEY, this.activeThreadId);
      }
      this.renderThreadsList();
      const currentMsgs = this.loadThreadMessages(this.activeThreadId);
      this.renderMessages(currentMsgs);
    }

    if (scrollToBottom) {
      this.scrollToBottom();
    }
  }

  toggleMobileSidebar() {
    this.threadsSidebar.classList.toggle('closed-mobile');
    const isOpen = !this.threadsSidebar.classList.contains('closed-mobile');
    this.sidebarBackdrop.style.display = isOpen ? 'block' : 'none';
  }

  closeMobileSidebar() {
    this.threadsSidebar.classList.add('closed-mobile');
    this.sidebarBackdrop.style.display = 'none';
  }

  /* ================= Threads Management ================= */

  loadThreads() {
    try {
      const data = localStorage.getItem(THREADS_INDEX_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  saveThreads(threads) {
    this.threads = threads;
    localStorage.setItem(THREADS_INDEX_KEY, JSON.stringify(threads));
  }

  loadThreadMessages(threadId) {
    if (!threadId) return [];
    try {
      const data = localStorage.getItem(THREAD_MSG_PREFIX + threadId);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  saveThreadMessages(threadId, messages) {
    localStorage.setItem(THREAD_MSG_PREFIX + threadId, JSON.stringify(messages));
    // Update thread meta
    const thread = this.threads.find(t => t.id === threadId);
    if (thread) {
      thread.messageCount = messages.length;
      thread.updatedAt = new Date().toISOString();
      this.saveThreads(this.threads);
      this.renderThreadsList();
    }
  }

  createNewThread(title = 'שיחה חדשה') {
    const newThread = {
      id: 'thread_' + Date.now(),
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: 0
    };
    this.threads.unshift(newThread);
    this.saveThreads(this.threads);
    this.activeThreadId = newThread.id;
    localStorage.setItem(ACTIVE_THREAD_ID_KEY, newThread.id);
    this.saveThreadMessages(newThread.id, []);
    this.renderThreadsList();
    this.renderMessages([]);
    this.closeMobileSidebar();
    return newThread;
  }

  switchThread(threadId) {
    if (this.activeThreadId === threadId) return;
    this.activeThreadId = threadId;
    localStorage.setItem(ACTIVE_THREAD_ID_KEY, threadId);
    this.renderThreadsList();
    const msgs = this.loadThreadMessages(threadId);
    this.renderMessages(msgs);
    this.closeMobileSidebar();
  }

  deleteThread(threadId, e) {
    if (e) e.stopPropagation();
    if (!confirm('האם למחוק נושא שיחה זה?')) return;
    
    this.threads = this.threads.filter(t => t.id !== threadId);
    localStorage.removeItem(THREAD_MSG_PREFIX + threadId);
    this.saveThreads(this.threads);

    if (this.activeThreadId === threadId) {
      this.activeThreadId = this.threads[0]?.id || null;
      localStorage.setItem(ACTIVE_THREAD_ID_KEY, this.activeThreadId || '');
    }

    if (this.threads.length === 0) {
      this.createNewThread('שיחה חדשה');
    } else {
      this.renderThreadsList();
      this.renderMessages(this.loadThreadMessages(this.activeThreadId));
    }
  }

  renderThreadsList(searchTerm = '') {
    this.threadsList.innerHTML = '';
    const filtered = this.threads.filter(t => 
      !searchTerm || t.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    this.threadsCountInfo.textContent = this.threads.length + ' שיחות';

    if (filtered.length === 0) {
      this.threadsList.innerHTML = '<div style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:1.5rem 0;">אין שיחות להצגה</div>';
      return;
    }

    filtered.forEach(thread => {
      const item = document.createElement('div');
      item.className = 'thread-item' + (thread.id === this.activeThreadId ? ' active' : '');
      
      const titleEl = document.createElement('span');
      titleEl.className = 'thread-title';
      titleEl.textContent = thread.title;

      const actions = document.createElement('div');
      actions.className = 'thread-actions';
      actions.innerHTML = '<button class="thread-del-btn" title="מחק שיחה">✕</button>';
      actions.querySelector('.thread-del-btn').addEventListener('click', (e) => this.deleteThread(thread.id, e));

      item.appendChild(titleEl);
      item.appendChild(actions);
      item.addEventListener('click', () => this.switchThread(thread.id));

      this.threadsList.appendChild(item);
    });
  }

  handleNewChat() {
    if (this.mode === 'topics') {
      this.createNewThread('שיחה חדשה');
      this.chatInput.focus();
    } else {
      if (confirm('במצב רציף, האם ברצונך לפתוח פרק שיחה חדש? ההודעות הקודמות יישארו בזיכרון.')) {
        const dividerMsg = {
          role: 'assistant',
          content: '--- **התחלת קטע שיחה חדש** ---',
          timestamp: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
        };
        this.continuousMessages.push(dividerMsg);
        this.saveContinuousMessages(this.continuousMessages);
        this.renderMessages(this.continuousMessages);
      }
    }
  }

  /* ================= Continuous Chat Storage ================= */

  loadContinuousMessages() {
    try {
      const data = localStorage.getItem(CONTINUOUS_CHAT_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  saveContinuousMessages(messages) {
    this.continuousMessages = messages;
    localStorage.setItem(CONTINUOUS_CHAT_KEY, JSON.stringify(messages));
  }

  /* ================= Message Rendering ================= */

  renderMessages(messages) {
    this.messagesList.innerHTML = '';
    
    if (!messages || messages.length === 0) {
      this.welcomeCard.style.display = 'block';
      return;
    }
    this.welcomeCard.style.display = 'none';

    messages.forEach((msg, idx) => {
      this.appendMessageBubble(msg, idx);
    });

    this.scrollToBottom();
  }

  appendMessageBubble(msg, idx = null) {
    this.welcomeCard.style.display = 'none';

    const row = document.createElement('div');
    row.className = 'message-row ' + (msg.role === 'user' ? 'user' : 'assistant');

    // Avatar
    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    if (msg.role === 'user') {
      avatar.textContent = 'צ';
    } else {
      avatar.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2"><path d="M12 2a8 8 0 0 0-8 8c0 5 8 12 8 12s8-7 8-12a8 8 0 0 0-8-8z"></path><circle cx="12" cy="10" r="3"></circle></svg>';
    }
    row.appendChild(avatar);

    // Content wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'msg-content-wrapper';

    // Bubble
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    
    // Attachments preview if user attached files
    if (msg.attachments && msg.attachments.length > 0) {
      const attBox = document.createElement('div');
      attBox.style.cssText = 'display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px;';
      msg.attachments.forEach(att => {
        const chip = document.createElement('span');
        chip.style.cssText = 'background:rgba(0,0,0,0.3); padding:2px 8px; border-radius:4px; font-size:0.75rem; color:#93c5fd;';
        chip.textContent = '📎 ' + att.name;
        attBox.appendChild(chip);
      });
      bubble.appendChild(attBox);
    }

    const textEl = document.createElement('div');
    textEl.className = 'msg-text';
    textEl.innerHTML = this.renderMarkdown(msg.content);
    bubble.appendChild(textEl);

    wrapper.appendChild(bubble);

    // Footer with time & actions
    const footer = document.createElement('div');
    footer.className = 'msg-footer';
    
    const timeSpan = document.createElement('span');
    timeSpan.textContent = msg.timestamp || new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    footer.appendChild(timeSpan);

    if (msg.role === 'assistant') {
      // Copy button
      const copyBtn = document.createElement('button');
      copyBtn.className = 'msg-action-btn';
      copyBtn.innerHTML = '📋 העתק';
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(msg.content);
        copyBtn.innerHTML = '✓ הועתק';
        setTimeout(() => copyBtn.innerHTML = '📋 העתק', 2000);
      });
      footer.appendChild(copyBtn);

      // Speak TTS button
      const speakBtn = document.createElement('button');
      speakBtn.className = 'msg-action-btn';
      speakBtn.innerHTML = '🔊 הקרא';
      speakBtn.addEventListener('click', () => this.speakText(msg.content));
      footer.appendChild(speakBtn);
    }

    wrapper.appendChild(footer);
    row.appendChild(wrapper);

    this.messagesList.appendChild(row);
    return { row, bubble, textEl };
  }

  scrollToBottom() {
    setTimeout(() => {
      this.messagesScrollArea.scrollTop = this.messagesScrollArea.scrollHeight;
    }, 10);
  }

  /* ================= Sending & Streaming ================= */

  async handleSend() {
    const text = this.chatInput.value.trim();
    if (!text && this.attachments.length === 0) return;
    if (this.isStreaming) return;

    const timeStr = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

    // Prepare message
    const userMsg = {
      role: 'user',
      content: text,
      attachments: [...this.attachments],
      timestamp: timeStr
    };

    // Clear input
    this.chatInput.value = '';
    this.chatInput.style.height = 'auto';
    this.attachments = [];
    this.renderAttachmentsPreview();

    // Get current message history
    let history = [];
    const assistantPlaceholder = {
      role: 'assistant',
      content: '',
      timestamp: timeStr
    };

    if (this.mode === 'continuous') {
      this.continuousMessages.push(userMsg);
      history = [...this.continuousMessages];
      this.continuousMessages.push(assistantPlaceholder);
      this.saveContinuousMessages(this.continuousMessages);
    } else {
      const threadMsgs = this.loadThreadMessages(this.activeThreadId);
      threadMsgs.push(userMsg);
      history = [...threadMsgs];
      threadMsgs.push(assistantPlaceholder);
      this.saveThreadMessages(this.activeThreadId, threadMsgs);

      // Auto-name thread from first user message if title is default
      const currentThread = this.threads.find(t => t.id === this.activeThreadId);
      if (currentThread && (currentThread.title === 'שיחה חדשה' || currentThread.title === 'שיחה ראשונה')) {
        const words = text.split(' ').slice(0, 5).join(' ');
        currentThread.title = words || 'שיחה';
        this.saveThreads(this.threads);
        this.renderThreadsList();
      }
    }

    // Append user bubble to UI
    this.appendMessageBubble(userMsg);
    this.scrollToBottom();

    // Prepare assistant streaming placeholder bubble
    const assistantBubbleObj = this.appendMessageBubble({
      role: 'assistant',
      content: '',
      timestamp: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    });

    assistantBubbleObj.textEl.classList.add('streaming-cursor');
    this.setStreamingState(true);

    let accumulatedText = '';

    await window.aiEngine.streamChat(history, {
      onChunk: (chunk) => {
        accumulatedText += chunk;
        assistantBubbleObj.textEl.innerHTML = this.renderMarkdown(accumulatedText);
        this.scrollToBottom();
      },
      onComplete: (fullText) => {
        this.setStreamingState(false);
        assistantBubbleObj.textEl.classList.remove('streaming-cursor');

        // Check for and process any auto-extracted memories
        const { cleanText, extracted } = window.memoryManager.processExtractedMemories(fullText);
        assistantBubbleObj.textEl.innerHTML = this.renderMarkdown(cleanText);

        const finalMsg = {
          role: 'assistant',
          content: cleanText,
          timestamp: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
        };

        if (this.mode === 'continuous') {
          this.continuousMessages[this.continuousMessages.length - 1] = finalMsg;
          this.saveContinuousMessages(this.continuousMessages);
        } else {
          const threadMsgs = this.loadThreadMessages(this.activeThreadId);
          threadMsgs[threadMsgs.length - 1] = finalMsg;
          this.saveThreadMessages(this.activeThreadId, threadMsgs);
        }

        if (extracted && extracted.length > 0) {
          this.updateMemoryBadges();
          this.showToast('🧠 נוספה עובדה חדשה לזיכרון הרוחבי המשותף!');
        }

        this.scrollToBottom();
      },
      onError: (err) => {
        this.setStreamingState(false);
        assistantBubbleObj.textEl.classList.remove('streaming-cursor');
        assistantBubbleObj.textEl.innerHTML = '<span style="color:var(--danger);">' + err.message + '</span>';
        this.scrollToBottom();
      }
    });
  }

  setStreamingState(isStreaming) {
    this.isStreaming = isStreaming;
    if (isStreaming) {
      this.iconSend.style.display = 'none';
      this.iconStop.style.display = 'block';
      this.btnSend.classList.add('stop-btn');
    } else {
      this.iconSend.style.display = 'block';
      this.iconStop.style.display = 'none';
      this.btnSend.classList.remove('stop-btn');
    }
  }

  stopStreaming() {
    window.aiEngine.abortStream();
    this.setStreamingState(false);
  }

  /* ================= Voice Input & TTS ================= */

  initSpeech() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.speechRecognizer = new SpeechRecognition();
      this.speechRecognizer.lang = 'he-IL';
      this.speechRecognizer.continuous = false;
      this.speechRecognizer.interimResults = true;

      this.speechRecognizer.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        this.chatInput.value = transcript;
        this.chatInput.style.height = 'auto';
        this.chatInput.style.height = this.chatInput.scrollHeight + 'px';
      };

      this.speechRecognizer.onerror = (e) => {
        console.error('Speech recognition error:', e);
        this.stopVoiceRecording();
      };

      this.speechRecognizer.onend = () => {
        this.stopVoiceRecording();
      };
    }
  }

  toggleVoiceRecording() {
    if (!this.speechRecognizer) {
      alert('דפדפן זה אינו תומך בזיהוי קולי (Web Speech API). מומלץ להשתמש ב-Google Chrome.');
      return;
    }

    if (this.isRecording) {
      this.stopVoiceRecording();
    } else {
      this.startVoiceRecording();
    }
  }

  startVoiceRecording() {
    try {
      this.speechRecognizer.start();
      this.isRecording = true;
      this.btnMic.classList.add('recording');
      this.btnMic.title = 'מקליט... לחץ לעצירה';
    } catch (e) {
      console.error(e);
    }
  }

  stopVoiceRecording() {
    try {
      if (this.speechRecognizer && this.isRecording) {
        this.speechRecognizer.stop();
      }
    } catch (e) {}
    this.isRecording = false;
    this.btnMic.classList.remove('recording');
    this.btnMic.title = 'הקלטה קולית בעברית';
  }

  speakText(text) {
    if (!('speechSynthesis' in window)) {
      alert('דפדפן זה אינו תומך בהקראת טקסט (Speech Synthesis).');
      return;
    }
    window.speechSynthesis.cancel();
    // Clean markdown before speaking
    const clean = text.replace(/[*#`\[\]\>\-]/g, ' ').slice(0, 500);
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = 'he-IL';
    utter.rate = 1.0;
    window.speechSynthesis.speak(utter);
  }

  /* ================= File Attachments ================= */

  handleFileSelection(e) {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      if (file.type.startsWith('image/')) {
        reader.onload = (evt) => {
          this.attachments.push({
            name: file.name,
            type: 'image',
            data: evt.target.result
          });
          this.renderAttachmentsPreview();
        };
        reader.readAsDataURL(file);
      } else {
        reader.onload = (evt) => {
          this.attachments.push({
            name: file.name,
            type: 'text',
            data: evt.target.result
          });
          this.renderAttachmentsPreview();
        };
        reader.readAsText(file);
      }
    });
    this.fileInput.value = '';
  }

  renderAttachmentsPreview() {
    this.attachmentsPreview.innerHTML = '';
    if (this.attachments.length === 0) {
      this.attachmentsPreview.style.display = 'none';
      return;
    }

    this.attachmentsPreview.style.display = 'flex';
    this.attachments.forEach((att, idx) => {
      const chip = document.createElement('div');
      chip.className = 'attachment-chip';
      chip.innerHTML = `
        <span>${att.type === 'image' ? '🖼️' : '📄'} ${att.name}</span>
        <span class="attachment-remove" title="הסר">✕</span>
      `;
      chip.querySelector('.attachment-remove').addEventListener('click', () => {
        this.attachments.splice(idx, 1);
        this.renderAttachmentsPreview();
      });
      this.attachmentsPreview.appendChild(chip);
    });
  }

  /* ================= Shared Memory Modal ================= */

  updateMemoryBadges() {
    const mems = window.memoryManager.getMemories();
    const count = mems.length;
    this.memoryCountBadge.textContent = count;
    this.memoryCountText.textContent = count;
  }

  openMemoryModal() {
    this.renderMemoriesList();
    this.systemPromptPreview.textContent = window.memoryManager.compileSystemPrompt();
    this.chkAutoExtract.checked = window.memoryManager.isAutoExtractEnabled();
    this.memoryModal.classList.add('open');
  }

  closeMemoryModal() {
    window.memoryManager.setAutoExtractEnabled(this.chkAutoExtract.checked);
    this.memoryModal.classList.remove('open');
    this.updateMemoryBadges();
  }

  renderMemoriesList() {
    const mems = window.memoryManager.getMemories();
    this.memoriesListContainer.innerHTML = '';

    mems.forEach(mem => {
      const card = document.createElement('div');
      card.className = 'memory-card';
      card.innerHTML = `
        <div class="memory-card-header">
          <span class="memory-cat-badge">${mem.category}</span>
          <div style="display:flex; align-items:center; gap:8px;">
            <strong style="font-size:0.86rem; color:#fff;">${mem.title}</strong>
            <button class="msg-action-btn" title="מחק עובדה" style="color:var(--danger);">✕</button>
          </div>
        </div>
        <div class="memory-content">${mem.content}</div>
      `;

      card.querySelector('button').addEventListener('click', () => {
        window.memoryManager.deleteMemory(mem.id);
        this.renderMemoriesList();
        this.systemPromptPreview.textContent = window.memoryManager.compileSystemPrompt();
        this.updateMemoryBadges();
      });

      this.memoriesListContainer.appendChild(card);
    });
  }

  handleAddMemory() {
    const cat = this.newMemCategory.value.trim() || 'כללי';
    const title = this.newMemTitle.value.trim();
    const content = this.newMemContent.value.trim();

    if (!content) {
      alert('נא להזין תוכן לעובדה');
      return;
    }

    window.memoryManager.addMemory(cat, title, content, false);
    this.newMemCategory.value = '';
    this.newMemTitle.value = '';
    this.newMemContent.value = '';

    this.renderMemoriesList();
    this.systemPromptPreview.textContent = window.memoryManager.compileSystemPrompt();
    this.updateMemoryBadges();
  }

  handleResetMemories() {
    if (confirm('האם לאפס את כל הזיכרונות להגדרות ברירת המחדל של צוריאל?')) {
      window.memoryManager.resetToDefaults();
      this.renderMemoriesList();
      this.systemPromptPreview.textContent = window.memoryManager.compileSystemPrompt();
      this.updateMemoryBadges();
    }
  }

  /* ================= Settings Modal ================= */

  openSettingsModal() {
    const cfg = window.aiEngine.config;
    this.settingProvider.value = cfg.provider || 'anthropic';
    this.settingApiKey.value = cfg.apiKey || '';
    this.settingModel.value = cfg.model || 'claude-3-5-sonnet-20240620';
    this.settingTemperature.value = cfg.temperature || 0.4;
    this.tempValueDisplay.textContent = cfg.temperature || 0.4;
    this.handleProviderChange();
    // Load Backend & Google config
    if (this.settingBackendUrl) {
      this.settingBackendUrl.value = window.aiEngine.backendConfig.serverUrl || 'http://195.201.91.47:8080';
    }
    if (this.settingBackendToken) {
      this.settingBackendToken.value = window.aiEngine.backendConfig.serverToken || 'adam_secret_2026_hetzner';
    }
    if (this.settingGoogleClientId) {
      this.settingGoogleClientId.value = window.googleClient.config.clientId || '';
    }
    if (this.settingGoogleAccessToken) {
      this.settingGoogleAccessToken.value = window.googleClient.config.accessToken || '';
    }
    this.updateGoogleStatusUI();
    this.checkBackendStatusSilent();

    this.settingsModal.classList.add('open');
  }

  closeSettingsModal() {
    this.settingsModal.classList.remove('open');
  }

  handleProviderChange() {
    const p = this.settingProvider.value;
    const keyGroup = document.getElementById('apiKeyGroup');
    if (p === 'demo') {
      keyGroup.style.display = 'none';
      this.settingModel.value = 'מצב סימולציה עצמאי';
    } else {
      keyGroup.style.display = 'block';
      if (p === 'anthropic' && (!this.settingModel.value || this.settingModel.value.includes('gpt'))) {
        this.settingModel.value = 'claude-3-5-sonnet-20240620';
      } else if (p === 'openai' && (!this.settingModel.value || this.settingModel.value.includes('claude'))) {
        this.settingModel.value = 'gpt-4o';
      } else if (p === 'openrouter') {
        this.settingModel.value = 'anthropic/claude-3.5-sonnet';
      }
    }
  }

  saveSettings() {
    window.aiEngine.saveConfig({
      provider: this.settingProvider.value,
      apiKey: this.settingApiKey.value.trim(),
      model: this.settingModel.value.trim(),
      temperature: parseFloat(this.settingTemperature.value) || 0.4
    });
    // Save Backend and Google configs
    if (this.settingBackendUrl && this.settingBackendToken) {
      window.aiEngine.saveBackendConfig({
        serverUrl: this.settingBackendUrl.value.trim(),
        serverToken: this.settingBackendToken.value.trim()
      });
    }
    if (this.settingGoogleClientId) {
      const gTok = this.settingGoogleAccessToken ? this.settingGoogleAccessToken.value.trim() : '';
      window.googleClient.saveConfig({
        clientId: this.settingGoogleClientId.value.trim(),
        accessToken: gTok || window.googleClient.config.accessToken
      });
    }

    this.closeSettingsModal();
    this.showToast('✓ ההגדרות נשמרו בהצלחה');
  }

  exportAllData() {
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      sharedMemories: window.memoryManager.getMemories(),
      continuousChat: this.continuousMessages,
      threads: this.threads,
      allThreadMessages: {}
    };

    this.threads.forEach(t => {
      backup.allThreadMessages[t.id] = this.loadThreadMessages(t.id);
    });

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'adam_assistant_backup_' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  clearChatHistory() {
    if (confirm('האם למחוק את כל היסטוריית השיחות (הצ\'אט הרציף וכל הנושאים)? הזיכרון הרוחבי המשותף יישמר.')) {
      this.continuousMessages = [];
      this.saveContinuousMessages([]);
      this.threads.forEach(t => localStorage.removeItem(THREAD_MSG_PREFIX + t.id));
      this.threads = [];
      this.saveThreads([]);
      this.createNewThread('שיחה ראשונה');
      this.renderMessages([]);
      // Save Backend and Google configs
    if (this.settingBackendUrl && this.settingBackendToken) {
      window.aiEngine.saveBackendConfig({
        serverUrl: this.settingBackendUrl.value.trim(),
        serverToken: this.settingBackendToken.value.trim()
      });
    }
    if (this.settingGoogleClientId) {
      const gTok = this.settingGoogleAccessToken ? this.settingGoogleAccessToken.value.trim() : '';
      window.googleClient.saveConfig({
        clientId: this.settingGoogleClientId.value.trim(),
        accessToken: gTok || window.googleClient.config.accessToken
      });
    }

    this.closeSettingsModal();
      this.showToast('היסטוריית הצ\'אט אופסה.');
    }
  }

  showToast(msg) {
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:#0f172a; border:1px solid #38bdf8; color:#fff; padding:10px 18px; border-radius:9999px; font-size:0.86rem; z-index:999; box-shadow:0 4px 12px rgba(0,0,0,0.5); animation:fadeIn 0.2s;';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  window.app = new AssistantApp();
});
