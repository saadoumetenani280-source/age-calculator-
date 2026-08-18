/**
 * AuraAge — Modern Age & Life Insights Engine
 * Built with vanilla JS, Luxon & File System Access API
 */

// =========================================================
// 0. IndexedDB Helper for File System Directory Handles
// =========================================================
const AuraStorageDB = {
  dbName: 'AuraAgeStorageDB',
  version: 1,
  storeName: 'directory_handles',

  async open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async setDirectoryHandle(key, handle) {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const req = store.put(handle, key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('IndexedDB set error:', e);
      return false;
    }
  },

  async getDirectoryHandle(key) {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('IndexedDB get error:', e);
      return null;
    }
  },

  async removeDirectoryHandle(key) {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const req = store.delete(key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('IndexedDB remove error:', e);
      return false;
    }
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Lucide icons
  if (window.lucide) {
    lucide.createIcons();
  }

  // DOM Elements
  const htmlElement = document.documentElement;
  const themeToggle = document.getElementById('themeToggle');
  const ageForm = document.getElementById('ageForm');
  const birthdayInput = document.getElementById('birthday');
  const clearInputBtn = document.getElementById('clearInputBtn');
  const targetDateInput = document.getElementById('targetDate');
  const toggleTargetDateBtn = document.getElementById('toggleTargetDate');
  const targetDateContainer = document.getElementById('targetDateContainer');
  const profileNameInput = document.getElementById('profileName');
  const resetBtn = document.getElementById('resetBtn');
  const saveProfileBtn = document.getElementById('saveProfileBtn');
  const saveToFolderBtn = document.getElementById('saveToFolderBtn');
  const selectFolderBtn = document.getElementById('selectFolderBtn');
  const folderSettingsBtn = document.getElementById('folderSettingsBtn');
  const savedProfilesBtn = document.getElementById('savedProfilesBtn');
  const savedCountBadge = document.getElementById('savedCountBadge');
  const savedChipsBar = document.getElementById('savedChipsBar');
  const savedChipsList = document.getElementById('savedChipsList');
  const resultsSection = document.getElementById('resultsSection');
  const copySummaryBtn = document.getElementById('copySummaryBtn');
  const exportReportBtn = document.getElementById('exportReportBtn');
  const celebrateBtn = document.getElementById('celebrateBtn');
  const profilesModal = document.getElementById('profilesModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const modalProfilesList = document.getElementById('modalProfilesList');
  const toastContainer = document.getElementById('toastContainer');

  // Modal Folder Elements
  const modalChangeFolderBtn = document.getElementById('modalChangeFolderBtn');
  const modalSyncToFolderBtn = document.getElementById('modalSyncToFolderBtn');
  const modalImportFromFolderBtn = document.getElementById('modalImportFromFolderBtn');
  const modalDisconnectFolderBtn = document.getElementById('modalDisconnectFolderBtn');

  // State
  let liveTickerInterval = null;
  let activeBirthDateTime = null;
  let activeTargetDateTime = null;
  let isCustomTargetActive = false;
  let currentFolderHandle = null;
  const FOLDER_KEY = 'user_active_save_folder';

  // =========================================================
  // 1. Theme Management (Dark / Light)
  // =========================================================
  const savedTheme = localStorage.getItem('aura_theme') || 
    (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  
  setTheme(savedTheme);

  themeToggle.addEventListener('click', () => {
    const currentTheme = htmlElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  });

  function setTheme(theme) {
    htmlElement.setAttribute('data-theme', theme);
    localStorage.setItem('aura_theme', theme);
  }

  // =========================================================
  // 2. Flatpickr Date Picker Initialization
  // =========================================================
  const fpBirthday = flatpickr(birthdayInput, {
    dateFormat: "Y-m-d",
    maxDate: "today",
    altInput: true,
    altFormat: "F j, Y",
    disableMobile: false,
    onChange: function(selectedDates, dateStr) {
      if (dateStr) {
        clearInputBtn.style.display = 'flex';
      } else {
        clearInputBtn.style.display = 'none';
      }
    }
  });

  const fpTarget = flatpickr(targetDateInput, {
    dateFormat: "Y-m-d",
    altInput: true,
    altFormat: "F j, Y",
    disableMobile: false
  });

  clearInputBtn.addEventListener('click', () => {
    fpBirthday.clear();
    clearInputBtn.style.display = 'none';
  });

  // Toggle Custom Target Date
  toggleTargetDateBtn.addEventListener('click', () => {
    isCustomTargetActive = !isCustomTargetActive;
    if (isCustomTargetActive) {
      targetDateContainer.classList.remove('hidden');
      toggleTargetDateBtn.querySelector('span').textContent = 'Hide specific calculation date';
    } else {
      targetDateContainer.classList.add('hidden');
      fpTarget.clear();
      toggleTargetDateBtn.querySelector('span').textContent = 'Calculate age at specific date';
    }
  });

  // Preset Buttons (e.g. 18, 21, 30, 50 years ago)
  document.querySelectorAll('.preset-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const yearsAgo = parseInt(chip.dataset.yearsAgo, 10);
      const calculatedDate = luxon.DateTime.now().minus({ years: yearsAgo }).toISODate();
      fpBirthday.setDate(calculatedDate, true);
      showToast(`Selected ${yearsAgo} years ago (${calculatedDate})`);
    });
  });

  // =========================================================
  // 3. Tabs Navigation
  // =========================================================
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(btn.dataset.tab);
      if (targetPane) {
        targetPane.classList.add('active');
      }
      if (window.lucide) lucide.createIcons();
    });
  });

  // =========================================================
  // 4. Form Submission & Age Calculation
  // =========================================================
  ageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    calculateAgeFromForm();
  });

  function calculateAgeFromForm() {
    const bdayVal = birthdayInput.value;
    if (!bdayVal) {
      showToast('Please select your date of birth', 'error');
      birthdayInput.focus();
      return;
    }

    const birthDate = luxon.DateTime.fromISO(bdayVal);
    if (!birthDate.isValid) {
      showToast('Invalid birth date format', 'error');
      return;
    }

    let targetDate = luxon.DateTime.now();
    if (isCustomTargetActive && targetDateInput.value) {
      const parsedTarget = luxon.DateTime.fromISO(targetDateInput.value);
      if (parsedTarget.isValid) {
        targetDate = parsedTarget;
      }
    }

    if (birthDate > targetDate) {
      showToast('Birth date cannot be in the future relative to the target date!', 'error');
      return;
    }

    activeBirthDateTime = birthDate;
    activeTargetDateTime = targetDate;

    // Get optional profile name
    const personName = profileNameInput.value.trim() || 'Your';
    document.getElementById('personNameDisplay').textContent = personName === 'Your' ? 'Your Age' : `${personName}'s Age`;

    renderFullResults(birthDate, targetDate);

    // Launch celebratory confetti if first calculate or birthday today
    triggerConfetti();

    // Scroll smoothly to results
    resultsSection.classList.remove('hidden');
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Refresh icons
    if (window.lucide) lucide.createIcons();
  }

  // =========================================================
  // 5. Render Full Results & Insights
  // =========================================================
  function renderFullResults(birthDate, targetDate) {
    if (liveTickerInterval) {
      clearInterval(liveTickerInterval);
    }

    // 1. Primary Age Breakdown (Years, Months, Days)
    const diff = targetDate.diff(birthDate, ['years', 'months', 'days']);
    const years = Math.floor(diff.years);
    const months = Math.floor(diff.months);
    const days = Math.floor(diff.days);

    animateNumber('yearsValue', years);
    animateNumber('monthsValue', months);
    animateNumber('daysValue', days);

    // 2. Birthday Today Check
    const isBirthdayToday = (birthDate.month === targetDate.month && birthDate.day === targetDate.day);
    const birthdayBanner = document.getElementById('birthdayBanner');
    if (isBirthdayToday) {
      birthdayBanner.classList.remove('hidden');
      triggerConfetti(true);
    } else {
      birthdayBanner.classList.add('hidden');
    }

    // 3. Next Birthday Countdown
    renderNextBirthday(birthDate, targetDate);

    // 4. Life in Numbers (Tab 1)
    renderLifeStats(birthDate, targetDate);

    // 5. Astrology & Facts (Tab 2)
    renderAstrology(birthDate);

    // 6. Milestones (Tab 3)
    renderMilestones(birthDate, targetDate);

    // 7. Planetary Age (Tab 4)
    renderPlanetaryAges(birthDate, targetDate);

    // 8. Start Live Ticker
    startLiveTicker(birthDate);
  }

  // =========================================================
  // 6. Live Real-Time Ticker
  // =========================================================
  function startLiveTicker(birthDate) {
    function tick() {
      const now = luxon.DateTime.now();
      const totalSecs = Math.floor(now.diff(birthDate, 'seconds').seconds);
      const liveSecondsEl = document.getElementById('liveSecondsCount');
      if (liveSecondsEl) {
        liveSecondsEl.textContent = totalSecs.toLocaleString();
      }

      // Update next birthday countdown seconds if not using custom target date
      if (!isCustomTargetActive) {
        updateNextBirthdayLive(birthDate, now);
      }
    }

    tick();
    liveTickerInterval = setInterval(tick, 1000);
  }

  // =========================================================
  // 7. Next Birthday & Solar Progress Calculation
  // =========================================================
  function getNextBirthdayDate(birthDate, referenceDate) {
    let nextBday = luxon.DateTime.fromObject({
      year: referenceDate.year,
      month: birthDate.month,
      day: birthDate.day
    });

    // Handle Feb 29 for non-leap years
    if (!nextBday.isValid && birthDate.month === 2 && birthDate.day === 29) {
      nextBday = luxon.DateTime.fromObject({
        year: referenceDate.year,
        month: 2,
        day: 28
      });
    }

    if (nextBday < referenceDate.startOf('day')) {
      nextBday = nextBday.plus({ years: 1 });
      if (!nextBday.isValid && birthDate.month === 2 && birthDate.day === 29) {
        nextBday = luxon.DateTime.fromObject({
          year: referenceDate.year + 1,
          month: 2,
          day: 28
        });
      }
    }

    return nextBday;
  }

  function renderNextBirthday(birthDate, referenceDate) {
    const nextBday = getNextBirthdayDate(birthDate, referenceDate);
    document.getElementById('nextBirthdayDate').textContent = `Next birthday on ${nextBday.toFormat('EEEE, MMMM d, yyyy')}`;
    updateNextBirthdayLive(birthDate, referenceDate);
  }

  function updateNextBirthdayLive(birthDate, referenceDate) {
    const nextBday = getNextBirthdayDate(birthDate, referenceDate);
    
    // Difference until next birthday
    let diffSecs = nextBday.diff(referenceDate, 'seconds').seconds;
    if (diffSecs < 0) diffSecs = 0;

    const daysLeft = Math.floor(diffSecs / 86400);
    const hoursLeft = Math.floor((diffSecs % 86400) / 3600);
    const minsLeft = Math.floor((diffSecs % 3600) / 60);
    const secsLeft = Math.floor(diffSecs % 60);

    const cdDays = document.getElementById('cdDays');
    const cdHours = document.getElementById('cdHours');
    const cdMinutes = document.getElementById('cdMinutes');
    const cdSeconds = document.getElementById('cdSeconds');

    if (cdDays) cdDays.textContent = daysLeft;
    if (cdHours) cdHours.textContent = hoursLeft.toString().padStart(2, '0');
    if (cdMinutes) cdMinutes.textContent = minsLeft.toString().padStart(2, '0');
    if (cdSeconds) cdSeconds.textContent = secsLeft.toString().padStart(2, '0');

    // Solar Year Progress
    const lastBday = nextBday.minus({ years: 1 });
    const totalYearSpan = nextBday.diff(lastBday, 'seconds').seconds;
    const elapsedSinceLastBday = referenceDate.diff(lastBday, 'seconds').seconds;
    let percent = Math.min(100, Math.max(0, (elapsedSinceLastBday / totalYearSpan) * 100));
    percent = Math.round(percent * 10) / 10;

    const solarProgressBar = document.getElementById('solarProgressBar');
    const solarProgressPercent = document.getElementById('solarProgressPercent');
    if (solarProgressBar) solarProgressBar.style.width = `${percent}%`;
    if (solarProgressPercent) solarProgressPercent.textContent = `${percent}%`;
  }

  // =========================================================
  // 8. Life in Numbers (Stats)
  // =========================================================
  function renderLifeStats(birthDate, targetDate) {
    const totalMonths = Math.floor(targetDate.diff(birthDate, 'months').months);
    const totalWeeks = Math.floor(targetDate.diff(birthDate, 'weeks').weeks);
    const totalDays = Math.floor(targetDate.diff(birthDate, 'days').days);
    const totalHours = Math.floor(targetDate.diff(birthDate, 'hours').hours);
    const totalMins = Math.floor(targetDate.diff(birthDate, 'minutes').minutes);

    const approxHeartbeats = Math.floor(totalMins * 80);
    const approxBreaths = Math.floor(totalMins * 16);
    const approxSleepDays = Math.floor(totalDays * (8 / 24));
    const approxMeals = Math.floor(totalDays * 3);

    document.getElementById('totalMonths').textContent = totalMonths.toLocaleString();
    document.getElementById('totalWeeks').textContent = totalWeeks.toLocaleString();
    document.getElementById('totalDays').textContent = totalDays.toLocaleString();
    document.getElementById('totalHours').textContent = totalHours.toLocaleString();
    document.getElementById('totalHeartbeats').textContent = approxHeartbeats.toLocaleString();
    document.getElementById('totalBreaths').textContent = approxBreaths.toLocaleString();
    document.getElementById('totalSleepDays').textContent = approxSleepDays.toLocaleString();
    document.getElementById('totalMeals').textContent = approxMeals.toLocaleString();
  }

  // =========================================================
  // 9. Astrology, Chinese Zodiac, Day Born & Symbols
  // =========================================================
  const ZODIAC_DATA = [
    { name: 'Capricorn', symbol: '♑', element: 'Earth', start: [1, 1], end: [1, 19], range: 'Dec 22 - Jan 19', traits: 'Disciplined, patient, practical, ambitious' },
    { name: 'Aquarius', symbol: '♒', element: 'Air', start: [1, 20], end: [2, 18], range: 'Jan 20 - Feb 18', traits: 'Innovative, original, independent, humanitarian' },
    { name: 'Pisces', symbol: '♓', element: 'Water', start: [2, 19], end: [3, 20], range: 'Feb 19 - Mar 20', traits: 'Empathetic, artistic, intuitive, wise' },
    { name: 'Aries', symbol: '♈', element: 'Fire', start: [3, 21], end: [4, 19], range: 'Mar 21 - Apr 19', traits: 'Eager, dynamic, quick, competitive' },
    { name: 'Taurus', symbol: '♉', element: 'Earth', start: [4, 20], end: [5, 20], range: 'Apr 20 - May 20', traits: 'Strong, dependable, sensual, creative' },
    { name: 'Gemini', symbol: '♊', element: 'Air', start: [5, 21], end: [6, 20], range: 'May 21 - Jun 20', traits: 'Expressive, curious, adaptable, witty' },
    { name: 'Cancer', symbol: '♋', element: 'Water', start: [6, 21], end: [7, 22], range: 'Jun 21 - Jul 22', traits: 'Intuitive, sentimental, compassionate, protective' },
    { name: 'Leo', symbol: '♌', element: 'Fire', start: [7, 23], end: [8, 22], range: 'Jul 23 - Aug 22', traits: 'Dramatic, outgoing, fiery, self-assured' },
    { name: 'Virgo', symbol: '♍', element: 'Earth', start: [8, 23], end: [9, 22], range: 'Aug 23 - Sep 22', traits: 'Practical, loyal, gentle, analytical' },
    { name: 'Libra', symbol: '♎', element: 'Air', start: [9, 23], end: [10, 22], range: 'Sep 23 - Oct 22', traits: 'Social, fair-minded, diplomatic, gracious' },
    { name: 'Scorpio', symbol: '♏', element: 'Water', start: [10, 23], end: [11, 21], range: 'Oct 23 - Nov 21', traits: 'Passionate, stubborn, resourceful, brave' },
    { name: 'Sagittarius', symbol: '♐', element: 'Fire', start: [11, 22], end: [12, 21], range: 'Nov 22 - Dec 21', traits: 'Extroverted, optimistic, funny, generous' },
    { name: 'Capricorn', symbol: '♑', element: 'Earth', start: [12, 22], end: [12, 31], range: 'Dec 22 - Jan 19', traits: 'Disciplined, patient, practical, ambitious' }
  ];

  const CHINESE_ANIMALS = [
    { name: 'Rat', emoji: '🐀', traits: 'Quick-witted, resourceful, versatile' },
    { name: 'Ox', emoji: '🐂', traits: 'Diligent, dependable, strong, determined' },
    { name: 'Tiger', emoji: '🐅', traits: 'Brave, confident, competitive, charismatic' },
    { name: 'Rabbit', emoji: '🐇', traits: 'Quiet, elegant, kind, responsible' },
    { name: 'Dragon', emoji: '🐉', traits: 'Confident, intelligent, enthusiastic' },
    { name: 'Snake', emoji: '🐍', traits: 'Enigmatic, intelligent, wise' },
    { name: 'Horse', emoji: '🐎', traits: 'Animated, active, energetic' },
    { name: 'Goat', emoji: '🐐', traits: 'Calm, gentle, sympathetic' },
    { name: 'Monkey', emoji: '🐒', traits: 'Sharp, smart, curious' },
    { name: 'Rooster', emoji: '🐓', traits: 'Observant, hardworking, courageous' },
    { name: 'Dog', emoji: '🐕', traits: 'Lovely, honest, prudent' },
    { name: 'Pig', emoji: '🐖', traits: 'Compassionate, generous, diligent' }
  ];

  const CHINESE_ELEMENTS = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'];

  const MONTH_SYMBOLS = [
    { stone: 'Garnet', flower: 'Carnation & Snowdrop' },
    { stone: 'Amethyst', flower: 'Violet & Primrose' },
    { stone: 'Aquamarine', flower: 'Daffodil & Jonquil' },
    { stone: 'Diamond', flower: 'Daisy & Sweet Pea' },
    { stone: 'Emerald', flower: 'Lily of the Valley & Hawthorn' },
    { stone: 'Pearl & Alexandrite', flower: 'Rose & Honeysuckle' },
    { stone: 'Ruby', flower: 'Larkspur & Water Lily' },
    { stone: 'Peridot', flower: 'Gladiolus & Poppy' },
    { stone: 'Sapphire', flower: 'Aster & Morning Glory' },
    { stone: 'Opal & Tourmaline', flower: 'Marigold & Cosmos' },
    { stone: 'Topaz & Citrine', flower: 'Chrysanthemum' },
    { stone: 'Turquoise & Zircon', flower: 'Narcissus & Holly' }
  ];

  const DAY_POEMS = {
    'Monday': '"Monday\'s child is fair of face"',
    'Tuesday': '"Tuesday\'s child is full of grace"',
    'Wednesday': '"Wednesday\'s child is full of woe"',
    'Thursday': '"Thursday\'s child has far to go"',
    'Friday': '"Friday\'s child is loving and giving"',
    'Saturday': '"Saturday\'s child works hard for a living"',
    'Sunday': '"Sunday\'s child is bonny and blithe, good and gay"'
  };

  function renderAstrology(birthDate) {
    const month = birthDate.month;
    const day = birthDate.day;
    const year = birthDate.year;

    // 1. Western Zodiac
    let sign = ZODIAC_DATA.find(z => {
      const [sm, sd] = z.start;
      const [em, ed] = z.end;
      if (month === sm && day >= sd) return true;
      if (month === em && day <= ed) return true;
      return false;
    }) || ZODIAC_DATA[0];

    document.getElementById('zodiacSignName').textContent = sign.name;
    document.getElementById('zodiacIconEmoji').textContent = sign.symbol;
    document.getElementById('zodiacElementBadge').textContent = sign.element;
    document.getElementById('zodiacDateRange').textContent = sign.range;
    document.getElementById('zodiacTraits').textContent = sign.traits;

    // 2. Chinese Zodiac
    const animalIndex = (year - 4) % 12;
    const animal = CHINESE_ANIMALS[(animalIndex + 12) % 12];
    const elemIndex = Math.floor(((year - 4) % 10) / 2);
    const element = CHINESE_ELEMENTS[(elemIndex + 5) % 5];

    document.getElementById('chineseZodiacEmoji').textContent = animal.emoji;
    document.getElementById('chineseZodiacName').textContent = `Year of the ${animal.name}`;
    document.getElementById('chineseZodiacElement').textContent = `${element} ${animal.name}`;
    document.getElementById('chineseZodiacTraits').textContent = animal.traits;

    // 3. Day of Week
    const dayOfWeek = birthDate.toFormat('EEEE');
    document.getElementById('birthDayOfWeek').textContent = dayOfWeek;
    document.getElementById('dayOfWeekPoem').textContent = DAY_POEMS[dayOfWeek] || `Born on a magnificent ${dayOfWeek}`;

    // 4. Birthstone & Flower
    const symbolData = MONTH_SYMBOLS[month - 1];
    document.getElementById('birthstoneName').textContent = symbolData.stone;
    document.getElementById('birthFlowerName').textContent = `Flower: ${symbolData.flower}`;
  }

  // =========================================================
  // 10. Milestones Tracker
  // =========================================================
  function renderMilestones(birthDate, referenceDate) {
    const timeline = document.getElementById('milestonesTimeline');
    timeline.innerHTML = '';

    const milestoneDefs = [
      { type: 'days', count: 1000, title: '1,000 Days of Life' },
      { type: 'years', count: 10, title: '1st Decade (Age 10)' },
      { type: 'days', count: 5000, title: '5,000 Days Milestone' },
      { type: 'years', count: 18, title: 'Legal Adulthood (Age 18)' },
      { type: 'years', count: 21, title: 'Key of Freedom (Age 21)' },
      { type: 'days', count: 10000, title: '10,000 Days on Earth' },
      { type: 'years', count: 30, title: '30 Trips Around the Sun' },
      { type: 'days', count: 15000, title: '15,000 Days Milestone' },
      { type: 'years', count: 50, title: 'Golden Jubilee (Age 50)' },
      { type: 'days', count: 20000, title: '20,000 Days Celebrated' },
      { type: 'years', count: 75, title: 'Diamond Jubilee (Age 75)' },
      { type: 'days', count: 30000, title: '30,000 Days Journey' },
      { type: 'years', count: 100, title: 'Centenarian (Age 100)' }
    ];

    milestoneDefs.forEach(m => {
      let mDate;
      if (m.type === 'days') {
        mDate = birthDate.plus({ days: m.count });
      } else {
        mDate = birthDate.plus({ years: m.count });
      }

      const isPassed = mDate <= referenceDate;
      const daysDiff = Math.abs(Math.round(mDate.diff(referenceDate, 'days').days));

      const item = document.createElement('div');
      item.className = `timeline-item ${isPassed ? 'passed' : 'upcoming'}`;

      let statusBadge = isPassed 
        ? `<span class="timeline-status status-passed">Passed (${daysDiff.toLocaleString()} days ago)</span>`
        : `<span class="timeline-status status-upcoming">In ${daysDiff.toLocaleString()} days</span>`;

      item.innerHTML = `
        <div class="timeline-info">
          <h5 class="timeline-title">${m.title}</h5>
          <p class="timeline-desc">${mDate.toFormat('MMMM d, yyyy')}</p>
        </div>
        ${statusBadge}
      `;

      timeline.appendChild(item);
    });
  }

  // =========================================================
  // 11. Planetary Ages
  // =========================================================
  const PLANETS = [
    { name: 'Mercury', emoji: '☿️', orbitDays: 87.97, desc: '88 Earth days per year' },
    { name: 'Venus', emoji: '♀️', orbitDays: 224.7, desc: '225 Earth days per year' },
    { name: 'Mars', emoji: '♂️', orbitDays: 686.98, desc: '1.88 Earth years per orbit' },
    { name: 'Jupiter', emoji: '♃', orbitDays: 4332.59, desc: '11.86 Earth years per orbit' },
    { name: 'Saturn', emoji: '♄', orbitDays: 10759.22, desc: '29.46 Earth years per orbit' },
    { name: 'Uranus', emoji: '♅', orbitDays: 30685.4, desc: '84 Earth years per orbit' },
    { name: 'Neptune', emoji: '♆', orbitDays: 60189.0, desc: '164.8 Earth years per orbit' }
  ];

  function renderPlanetaryAges(birthDate, referenceDate) {
    const grid = document.getElementById('planetsGrid');
    grid.innerHTML = '';

    const totalDaysLived = referenceDate.diff(birthDate, 'days').days;

    PLANETS.forEach(planet => {
      const planetAge = (totalDaysLived / planet.orbitDays).toFixed(2);
      const card = document.createElement('div');
      card.className = 'planet-card';
      card.innerHTML = `
        <div class="planet-emoji">${planet.emoji}</div>
        <h5 class="planet-name">${planet.name}</h5>
        <p class="planet-orbital">${planet.desc}</p>
        <div class="planet-age-val">${planetAge}</div>
        <span class="planet-age-unit">Planetary Years</span>
      `;
      grid.appendChild(card);
    });
  }

  // =========================================================
  // 12. Saved Profiles Management (localStorage + Folder)
  // =========================================================
  function getSavedProfiles() {
    try {
      return JSON.parse(localStorage.getItem('aura_profiles') || '[]');
    } catch {
      return [];
    }
  }

  function saveProfilesList(profiles) {
    localStorage.setItem('aura_profiles', JSON.stringify(profiles));
    updateSavedUI();
  }

  function updateSavedUI() {
    const profiles = getSavedProfiles();

    // Update Badge
    if (profiles.length > 0) {
      savedCountBadge.textContent = profiles.length;
      savedCountBadge.style.display = 'inline-block';
      savedChipsBar.classList.remove('hidden');
    } else {
      savedCountBadge.style.display = 'none';
      savedChipsBar.classList.add('hidden');
    }

    // Update Chips Bar
    savedChipsList.innerHTML = '';
    profiles.forEach((p, idx) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'profile-chip';
      chip.innerHTML = `<span>${escapeHtml(p.name)}</span>`;
      chip.addEventListener('click', () => loadProfile(p));
      savedChipsList.appendChild(chip);
    });

    // Update Modal List
    modalProfilesList.innerHTML = '';
    if (profiles.length === 0) {
      modalProfilesList.innerHTML = '<p class="empty-state">No saved birthdays yet. Calculate and click "Save" or "Save to Folder" to keep birthdays handy!</p>';
    } else {
      profiles.forEach((p, idx) => {
        const item = document.createElement('div');
        item.className = 'profile-list-item';
        item.innerHTML = `
          <div class="profile-item-info">
            <h5>${escapeHtml(p.name)}</h5>
            <span>${p.birthday}</span>
          </div>
          <div class="profile-item-actions">
            <button class="btn-sm btn-glass load-p-btn" data-idx="${idx}" title="Load this birthday">
              <i data-lucide="play"></i> Use
            </button>
            <button class="btn-sm btn-glass save-p-to-folder-btn" data-idx="${idx}" title="Save profile file to folder">
              <i data-lucide="folder-down"></i>
            </button>
            <button class="btn-sm btn-glass delete-p-btn" data-idx="${idx}" title="Delete profile">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        `;
        modalProfilesList.appendChild(item);
      });

      modalProfilesList.querySelectorAll('.load-p-btn').forEach(b => {
        b.addEventListener('click', () => {
          const idx = parseInt(b.dataset.idx, 10);
          loadProfile(profiles[idx]);
          profilesModal.classList.add('hidden');
        });
      });

      modalProfilesList.querySelectorAll('.save-p-to-folder-btn').forEach(b => {
        b.addEventListener('click', async () => {
          const idx = parseInt(b.dataset.idx, 10);
          const p = profiles[idx];
          const bDate = luxon.DateTime.fromISO(p.birthday);
          const tDate = luxon.DateTime.now();
          const profileData = generateUserFullProfileData(bDate, tDate, p.name);
          await saveUserDataToFolder(profileData);
        });
      });

      modalProfilesList.querySelectorAll('.delete-p-btn').forEach(b => {
        b.addEventListener('click', () => {
          const idx = parseInt(b.dataset.idx, 10);
          const name = profiles[idx].name;
          profiles.splice(idx, 1);
          saveProfilesList(profiles);
          showToast(`Removed "${name}"`);
        });
      });
    }

    if (window.lucide) lucide.createIcons();
  }

  function loadProfile(profile) {
    fpBirthday.setDate(profile.birthday, true);
    profileNameInput.value = profile.name;
    calculateAgeFromForm();
    showToast(`Loaded birthday for ${profile.name}`);
  }

  saveProfileBtn.addEventListener('click', () => {
    const bday = birthdayInput.value;
    if (!bday) {
      showToast('Please select a birthday before saving', 'error');
      return;
    }

    const name = profileNameInput.value.trim() || `Profile (${bday})`;
    const profiles = getSavedProfiles();

    // Check if already exists
    const existingIdx = profiles.findIndex(p => p.birthday === bday && p.name === name);
    if (existingIdx !== -1) {
      showToast(`Profile "${name}" is already saved!`);
      return;
    }

    profiles.push({ name, birthday: bday });
    saveProfilesList(profiles);
    showToast(`Saved "${name}" to browser memory!`);
  });

  savedProfilesBtn.addEventListener('click', () => {
    updateSavedUI();
    profilesModal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  });

  folderSettingsBtn.addEventListener('click', () => {
    updateSavedUI();
    profilesModal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  });

  closeModalBtn.addEventListener('click', () => {
    profilesModal.classList.add('hidden');
  });

  profilesModal.addEventListener('click', (e) => {
    if (e.target === profilesModal) {
      profilesModal.classList.add('hidden');
    }
  });

  // =========================================================
  // 13. File System Access API & Folder Integration
  // =========================================================

  async function verifyPermission(fileHandle, readWrite = true) {
    if (!fileHandle) return false;
    const options = {};
    if (readWrite) {
      options.mode = 'readwrite';
    }
    try {
      if ((await fileHandle.queryPermission(options)) === 'granted') {
        return true;
      }
      if ((await fileHandle.requestPermission(options)) === 'granted') {
        return true;
      }
    } catch (err) {
      console.warn('Permission query/request error:', err);
    }
    return false;
  }

  async function initFolderSystem() {
    if (!window.showDirectoryPicker) {
      updateFolderUI(null, false, 'Standard File Download mode (Browser Direct Access not supported)');
      return;
    }

    try {
      const handle = await AuraStorageDB.getDirectoryHandle(FOLDER_KEY);
      if (handle) {
        currentFolderHandle = handle;
        updateFolderUI(handle, true);
      } else {
        updateFolderUI(null, false);
      }
    } catch (err) {
      console.warn('Error reading stored directory handle:', err);
      updateFolderUI(null, false);
    }
  }

  async function requestFolderSelection() {
    if (!window.showDirectoryPicker) {
      showToast('Directory picker is not supported in this browser. Direct file download will be used.', 'info');
      return null;
    }

    try {
      const dirHandle = await window.showDirectoryPicker({
        id: 'aura_age_data_folder',
        mode: 'readwrite',
        startIn: 'desktop'
      });

      const hasPermission = await verifyPermission(dirHandle, true);
      if (!hasPermission) {
        showToast('Folder permission was not granted.', 'error');
        return null;
      }

      currentFolderHandle = dirHandle;
      await AuraStorageDB.setDirectoryHandle(FOLDER_KEY, dirHandle);
      updateFolderUI(dirHandle, true);
      showToast(`Connected to folder "${dirHandle.name}"!`);
      return dirHandle;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Folder picker error:', err);
        showToast('Failed to select folder: ' + err.message, 'error');
      }
      return null;
    }
  }

  async function disconnectFolder() {
    currentFolderHandle = null;
    await AuraStorageDB.removeDirectoryHandle(FOLDER_KEY);
    updateFolderUI(null, false);
    showToast('Disconnected save folder.');
  }

  function updateFolderUI(handle, isConnected, customStatus = '') {
    const folderNameDisplay = document.getElementById('folderNameDisplay');
    const folderIconActive = document.getElementById('folderIconActive');
    const folderIconInactive = document.getElementById('folderIconInactive');
    const folderSyncBar = document.getElementById('folderSyncBar');
    const selectFolderBtnText = document.getElementById('selectFolderBtnText');
    const folderStatusDot = document.getElementById('folderStatusDot');

    const modalFolderBadge = document.getElementById('modalFolderBadge');
    const modalFolderPath = document.getElementById('modalFolderPath');
    const modalFolderBtnLabel = document.getElementById('modalFolderBtnLabel');
    const modalDisconnectFolderBtn = document.getElementById('modalDisconnectFolderBtn');

    if (isConnected && handle) {
      const name = handle.name || 'Selected Folder';
      if (folderNameDisplay) folderNameDisplay.textContent = `📁 ${name}`;
      if (folderIconActive) folderIconActive.style.display = 'inline-block';
      if (folderIconInactive) folderIconInactive.style.display = 'none';
      if (folderSyncBar) folderSyncBar.classList.add('connected');
      if (selectFolderBtnText) selectFolderBtnText.textContent = 'Change Folder';
      if (folderStatusDot) folderStatusDot.classList.add('active');

      if (modalFolderBadge) {
        modalFolderBadge.textContent = 'Connected';
        modalFolderBadge.className = 'folder-badge connected';
      }
      if (modalFolderPath) modalFolderPath.textContent = `📁 /${name}/`;
      if (modalFolderBtnLabel) modalFolderBtnLabel.textContent = 'Change Folder';
      if (modalDisconnectFolderBtn) modalDisconnectFolderBtn.style.display = 'inline-flex';
    } else {
      if (folderNameDisplay) folderNameDisplay.textContent = customStatus || 'No folder selected';
      if (folderIconActive) folderIconActive.style.display = 'none';
      if (folderIconInactive) folderIconInactive.style.display = 'inline-block';
      if (folderSyncBar) folderSyncBar.classList.remove('connected');
      if (selectFolderBtnText) selectFolderBtnText.textContent = 'Choose Folder';
      if (folderStatusDot) folderStatusDot.classList.remove('active');

      if (modalFolderBadge) {
        modalFolderBadge.textContent = 'Not Connected';
        modalFolderBadge.className = 'folder-badge disconnected';
      }
      if (modalFolderPath) modalFolderPath.textContent = 'No folder connected (Click "Select Save Folder")';
      if (modalFolderBtnLabel) modalFolderBtnLabel.textContent = 'Select Save Folder';
      if (modalDisconnectFolderBtn) modalDisconnectFolderBtn.style.display = 'none';
    }

    if (window.lucide) lucide.createIcons();
  }

  // Folder Button Listeners
  selectFolderBtn.addEventListener('click', requestFolderSelection);
  modalChangeFolderBtn.addEventListener('click', requestFolderSelection);
  modalDisconnectFolderBtn.addEventListener('click', disconnectFolder);

  // Generate complete structured data object for user
  function generateUserFullProfileData(birthDate, targetDate, name) {
    const diff = targetDate.diff(birthDate, ['years', 'months', 'days']);
    const years = Math.floor(diff.years);
    const months = Math.floor(diff.months);
    const days = Math.floor(diff.days);

    const totalDays = Math.floor(targetDate.diff(birthDate, 'days').days);
    const totalWeeks = Math.floor(totalDays / 7);
    const totalMonths = (years * 12) + months;
    const totalHours = totalDays * 24;
    const totalMinutes = totalHours * 60;
    const totalSeconds = totalDays * 86400;

    const approxHeartbeats = Math.floor(totalMinutes * 80);
    const approxBreaths = Math.floor(totalMinutes * 16);
    const approxSleepDays = Math.floor(totalDays * (8 / 24));
    const approxMeals = Math.floor(totalDays * 3);

    // Western Zodiac
    const m = birthDate.month;
    const d = birthDate.day;
    const y = birthDate.year;
    const sign = ZODIAC_DATA.find(z => {
      const [sm, sd] = z.start;
      const [em, ed] = z.end;
      if (m === sm && d >= sd) return true;
      if (m === em && d <= ed) return true;
      return false;
    }) || ZODIAC_DATA[0];

    // Chinese Zodiac
    const animalIndex = (y - 4) % 12;
    const animal = CHINESE_ANIMALS[(animalIndex + 12) % 12];
    const elemIndex = Math.floor(((y - 4) % 10) / 2);
    const element = CHINESE_ELEMENTS[(elemIndex + 5) % 5];

    // Symbols
    const symbolData = MONTH_SYMBOLS[m - 1];

    // Planetary ages
    const planetaryAges = PLANETS.map(p => ({
      planet: p.name,
      orbitalPeriodDays: p.orbitDays,
      ageOnPlanet: parseFloat((totalDays / p.orbitDays).toFixed(2))
    }));

    return {
      application: "AuraAge — Precision Age & Life Insights",
      version: "2.0",
      savedAt: luxon.DateTime.now().toISO(),
      savedAtFormatted: luxon.DateTime.now().toFormat('FFFF'),
      user: {
        name: name || "User Profile",
        birthDate: birthDate.toISODate(),
        birthDateFormatted: birthDate.toFormat('MMMM d, yyyy'),
        birthDayOfWeek: birthDate.toFormat('EEEE'),
        calculationTargetDate: targetDate.toISODate(),
        calculationTargetDateFormatted: targetDate.toFormat('MMMM d, yyyy')
      },
      exactAge: {
        years,
        months,
        days,
        formatted: `${years} Years, ${months} Months, ${days} Days`
      },
      livingMetrics: {
        totalDaysLived: totalDays,
        totalWeeksLived: totalWeeks,
        totalMonthsLived: totalMonths,
        totalHoursLived: totalHours,
        totalMinutesLived: totalMinutes,
        totalSecondsLived: totalSeconds,
        approxHeartbeats: approxHeartbeats,
        approxBreaths: approxBreaths,
        approxSleepDays: approxSleepDays,
        approxMeals: approxMeals
      },
      astrologyAndSymbols: {
        westernZodiac: {
          sign: sign.name,
          symbol: sign.symbol,
          element: sign.element,
          dateRange: sign.range,
          traits: sign.traits
        },
        chineseZodiac: {
          animal: animal.name,
          emoji: animal.emoji,
          element: element,
          fullName: `${element} ${animal.name}`,
          traits: animal.traits
        },
        birthDayOfWeek: birthDate.toFormat('EEEE'),
        dayPoem: DAY_POEMS[birthDate.toFormat('EEEE')] || '',
        birthstone: symbolData.stone,
        flower: symbolData.flower
      },
      planetaryAges: planetaryAges
    };
  }

  function generateReadableTextReport(profileData) {
    const u = profileData.user;
    const a = profileData.exactAge;
    const m = profileData.livingMetrics;
    const astro = profileData.astrologyAndSymbols;

    let report = `================================================================================
                    AURAAGE — LIFE INSIGHTS & AGE REPORT
================================================================================
Generated on: ${profileData.savedAtFormatted}

1. USER PROFILE:
--------------------------------------------------------------------------------
• Name / Label:              ${u.name}
• Date of Birth:             ${u.birthDateFormatted} (${u.birthDayOfWeek})
• Age Calculated As Of:      ${u.calculationTargetDateFormatted}

2. EXACT AGE:
--------------------------------------------------------------------------------
• Primary Age:               ${a.years} Years, ${a.months} Months, ${a.days} Days
• Total Solar Orbit Time:    ${(m.totalDaysLived / 365.25).toFixed(4)} Earth Solar Years

3. LIFE METRICS EXPERIENCED:
--------------------------------------------------------------------------------
• Total Days Lived:          ${m.totalDaysLived.toLocaleString()} days
• Total Weeks Lived:         ${m.totalWeeksLived.toLocaleString()} weeks
• Total Months Lived:        ${m.totalMonthsLived.toLocaleString()} months
• Total Hours Lived:         ${m.totalHoursLived.toLocaleString()} hours
• Total Minutes Lived:       ${m.totalMinutesLived.toLocaleString()} minutes
• Total Seconds Lived:       ${m.totalSecondsLived.toLocaleString()} seconds
• Approx. Heartbeats:        ${m.approxHeartbeats.toLocaleString()} beats (~80 bpm)
• Approx. Breaths Taken:     ${m.approxBreaths.toLocaleString()} breaths (~16/min)
• Days Spent Sleeping:       ${m.approxSleepDays.toLocaleString()} days (~8 hrs/day)
• Estimated Meals Eaten:     ${m.approxMeals.toLocaleString()} meals (~3/day)

4. ASTROLOGY & SYMBOLIC INSIGHTS:
--------------------------------------------------------------------------------
• Western Zodiac:            ${astro.westernZodiac.symbol} ${astro.westernZodiac.sign} (${astro.westernZodiac.element})
  - Date Range:              ${astro.westernZodiac.dateRange}
  - Traits:                  ${astro.westernZodiac.traits}
• Chinese Zodiac:            ${astro.chineseZodiac.emoji} Year of the ${astro.chineseZodiac.fullName}
  - Traits:                  ${astro.chineseZodiac.traits}
• Birth Day of Week:         ${astro.birthDayOfWeek} (${astro.dayPoem})
• Birthstone & Flower:       Stone: ${astro.birthstone} | Flower: ${astro.flower}

5. COSMIC / PLANETARY AGES:
--------------------------------------------------------------------------------
`;

    profileData.planetaryAges.forEach(p => {
      report += `• ${p.planet.padEnd(12)}: ${p.ageOnPlanet.toString().padEnd(8)} Planetary Years (Orbit: ${p.orbitalPeriodDays} Earth days)\n`;
    });

    report += `
================================================================================
                  Crafted with AuraAge — Keep shining!
================================================================================`;

    return report;
  }

  async function writeDataToFolder(dirHandle, filename, content) {
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  function triggerBrowserDownload(filename, content, mimeType = 'application/json') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function sanitizeFilename(name) {
    return name.replace(/[^a-z0-9_\-]/gi, '_').toLowerCase();
  }

  // Save User Data Directly into the Connected Folder
  async function saveUserDataToFolder(profileData) {
    const safeName = sanitizeFilename(profileData.user.name);
    const bDate = profileData.user.birthDate;
    const jsonFilename = `profile_${safeName}_${bDate}.json`;
    const txtFilename = `report_${safeName}_${bDate}.txt`;

    const jsonContent = JSON.stringify(profileData, null, 2);
    const txtContent = generateReadableTextReport(profileData);

    // Save to local profile cache as well
    const profiles = getSavedProfiles();
    const existingIdx = profiles.findIndex(p => p.birthday === bDate && p.name === profileData.user.name);
    if (existingIdx === -1) {
      profiles.push({ name: profileData.user.name, birthday: bDate });
      saveProfilesList(profiles);
    }

    // Check if directory picker is available
    if (!window.showDirectoryPicker) {
      triggerBrowserDownload(jsonFilename, jsonContent, 'application/json');
      showToast(`Saved "${jsonFilename}" to your Downloads folder!`);
      return;
    }

    // Check directory handle
    let dirHandle = currentFolderHandle;
    if (!dirHandle) {
      dirHandle = await requestFolderSelection();
      if (!dirHandle) {
        // Fallback to direct download
        triggerBrowserDownload(jsonFilename, jsonContent, 'application/json');
        showToast(`Saved "${jsonFilename}" via direct download.`);
        return;
      }
    } else {
      const hasPerm = await verifyPermission(dirHandle, true);
      if (!hasPerm) {
        dirHandle = await requestFolderSelection();
        if (!dirHandle) {
          triggerBrowserDownload(jsonFilename, jsonContent, 'application/json');
          showToast(`Saved "${jsonFilename}" via direct download.`);
          return;
        }
      }
    }

    try {
      // 1. Write structured JSON file
      await writeDataToFolder(dirHandle, jsonFilename, jsonContent);

      // 2. Write readable TXT report
      await writeDataToFolder(dirHandle, txtFilename, txtContent);

      // 3. Update master profiles list in folder
      const allProfiles = getSavedProfiles();
      await writeDataToFolder(dirHandle, 'aura_saved_profiles.json', JSON.stringify(allProfiles, null, 2));

      triggerConfetti();
      showToast(`Saved "${jsonFilename}" & report to folder "${dirHandle.name}"!`);
    } catch (err) {
      console.error('Error writing file to folder:', err);
      // Fallback
      triggerBrowserDownload(jsonFilename, jsonContent, 'application/json');
      showToast(`Saved "${jsonFilename}" via direct download (Folder write error).`, 'error');
    }
  }

  // Save to Folder Button Handler (Main Form)
  saveToFolderBtn.addEventListener('click', async () => {
    const bdayVal = birthdayInput.value;
    if (!bdayVal) {
      showToast('Please select your date of birth first', 'error');
      birthdayInput.focus();
      return;
    }

    const birthDate = luxon.DateTime.fromISO(bdayVal);
    if (!birthDate.isValid) {
      showToast('Invalid date of birth format', 'error');
      return;
    }

    let targetDate = luxon.DateTime.now();
    if (isCustomTargetActive && targetDateInput.value) {
      const parsed = luxon.DateTime.fromISO(targetDateInput.value);
      if (parsed.isValid) targetDate = parsed;
    }

    if (birthDate > targetDate) {
      showToast('Birth date cannot be in the future!', 'error');
      return;
    }

    const name = profileNameInput.value.trim() || `Profile (${bdayVal})`;
    const profileData = generateUserFullProfileData(birthDate, targetDate, name);

    await saveUserDataToFolder(profileData);
  });

  // Save Report Button Handler (Hero Results)
  exportReportBtn.addEventListener('click', async () => {
    if (!activeBirthDateTime) {
      showToast('Please calculate your age first', 'error');
      return;
    }

    const targetDate = activeTargetDateTime || luxon.DateTime.now();
    const name = profileNameInput.value.trim() || 'Your Profile';
    const profileData = generateUserFullProfileData(activeBirthDateTime, targetDate, name);

    await saveUserDataToFolder(profileData);
  });

  // Export All Profiles to Folder (Modal)
  modalSyncToFolderBtn.addEventListener('click', async () => {
    const profiles = getSavedProfiles();
    if (profiles.length === 0) {
      showToast('No saved profiles to export yet', 'info');
      return;
    }

    let dirHandle = currentFolderHandle;
    if (!dirHandle) {
      dirHandle = await requestFolderSelection();
      if (!dirHandle) return;
    }

    const hasPerm = await verifyPermission(dirHandle, true);
    if (!hasPerm) {
      dirHandle = await requestFolderSelection();
      if (!dirHandle) return;
    }

    try {
      for (const p of profiles) {
        const bDate = luxon.DateTime.fromISO(p.birthday);
        const tDate = luxon.DateTime.now();
        const pData = generateUserFullProfileData(bDate, tDate, p.name);
        const safeName = sanitizeFilename(p.name);
        await writeDataToFolder(dirHandle, `profile_${safeName}_${p.birthday}.json`, JSON.stringify(pData, null, 2));
      }

      await writeDataToFolder(dirHandle, 'aura_all_profiles_backup.json', JSON.stringify(profiles, null, 2));
      triggerConfetti();
      showToast(`Exported ${profiles.length} profiles to folder "${dirHandle.name}"!`);
    } catch (err) {
      console.error('Batch export error:', err);
      showToast('Export failed: ' + err.message, 'error');
    }
  });

  // Import Profiles from Folder (Modal)
  modalImportFromFolderBtn.addEventListener('click', async () => {
    let dirHandle = currentFolderHandle;
    if (!dirHandle) {
      dirHandle = await requestFolderSelection();
      if (!dirHandle) return;
    }

    const hasPerm = await verifyPermission(dirHandle, true);
    if (!hasPerm) {
      dirHandle = await requestFolderSelection();
      if (!dirHandle) return;
    }

    try {
      let importedCount = 0;
      const profiles = getSavedProfiles();

      // Read files from folder handle
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.json')) {
          try {
            const file = await entry.getFile();
            const text = await file.text();
            const json = JSON.parse(text);

            // Check if backup array format
            if (Array.isArray(json)) {
              json.forEach(item => {
                if (item.name && item.birthday) {
                  const exists = profiles.some(p => p.name === item.name && p.birthday === item.birthday);
                  if (!exists) {
                    profiles.push({ name: item.name, birthday: item.birthday });
                    importedCount++;
                  }
                }
              });
            } else if (json.user && json.user.birthDate) {
              // AuraAge profile structure
              const name = json.user.name || entry.name.replace('.json', '');
              const bday = json.user.birthDate;
              const exists = profiles.some(p => p.name === name && p.birthday === bday);
              if (!exists) {
                profiles.push({ name, birthday: bday });
                importedCount++;
              }
            } else if (json.name && json.birthday) {
              const exists = profiles.some(p => p.name === json.name && p.birthday === json.birthday);
              if (!exists) {
                profiles.push({ name: json.name, birthday: json.birthday });
                importedCount++;
              }
            }
          } catch (e) {
            // Ignore non-profile json
          }
        }
      }

      if (importedCount > 0) {
        saveProfilesList(profiles);
        showToast(`Imported ${importedCount} profile(s) from "${dirHandle.name}"!`);
      } else {
        showToast(`No new profiles found in folder "${dirHandle.name}".`);
      }
    } catch (err) {
      console.error('Import error:', err);
      showToast('Import failed: ' + err.message, 'error');
    }
  });

  // =========================================================
  // 14. Reset Handler
  // =========================================================
  resetBtn.addEventListener('click', () => {
    fpBirthday.clear();
    clearInputBtn.style.display = 'none';
    profileNameInput.value = '';
    if (isCustomTargetActive) {
      fpTarget.clear();
    }
    resultsSection.classList.add('hidden');
    if (liveTickerInterval) {
      clearInterval(liveTickerInterval);
    }
    showToast('Reset form');
  });

  // =========================================================
  // 15. Copy Summary & Confetti
  // =========================================================
  copySummaryBtn.addEventListener('click', () => {
    if (!activeBirthDateTime) return;

    const years = document.getElementById('yearsValue').textContent;
    const months = document.getElementById('monthsValue').textContent;
    const days = document.getElementById('daysValue').textContent;
    const person = document.getElementById('personNameDisplay').textContent;
    const totalDays = document.getElementById('totalDays').textContent;
    const zodiac = document.getElementById('zodiacSignName').textContent;

    const summaryText = `✨ ${person} ✨\n` +
      `📅 Born on: ${activeBirthDateTime.toFormat('MMMM d, yyyy')}\n` +
      `⏳ Exact Age: ${years} Years, ${months} Months, and ${days} Days\n` +
      `🌟 Total Days Lived: ${totalDays} days\n` +
      `♈ Zodiac Sign: ${zodiac}\n` +
      `Calculated with AuraAge 🚀`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(summaryText)
        .then(() => showToast('Summary copied to clipboard!'))
        .catch(() => showToast('Failed to copy summary', 'error'));
    } else {
      showToast('Clipboard access not available', 'error');
    }
  });

  celebrateBtn.addEventListener('click', () => {
    triggerConfetti(true);
  });

  function triggerConfetti(massive = false) {
    if (typeof confetti === 'function') {
      if (massive) {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 }
        });
        setTimeout(() => {
          confetti({
            particleCount: 60,
            angle: 60,
            spread: 55,
            origin: { x: 0 }
          });
          confetti({
            particleCount: 60,
            angle: 120,
            spread: 55,
            origin: { x: 1 }
          });
        }, 250);
      } else {
        confetti({
          particleCount: 60,
          spread: 60,
          origin: { y: 0.65 }
        });
      }
    }
  }

  // =========================================================
  // 16. Helper Utilities
  // =========================================================
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    const icon = type === 'error' ? 'alert-circle' : 'check-circle';
    toast.innerHTML = `<i data-lucide="${icon}"></i><span>${escapeHtml(message)}</span>`;
    toastContainer.appendChild(toast);

    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
      toast.remove();
    }, 3200);
  }

  function animateNumber(elementId, targetValue, duration = 800) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const start = 0;
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(start + (targetValue - start) * easedProgress);

      el.textContent = current;

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = targetValue;
      }
    }

    requestAnimationFrame(update);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Initialize UI & folder system
  updateSavedUI();
  await initFolderSystem();
});
