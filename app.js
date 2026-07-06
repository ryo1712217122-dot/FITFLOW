// FITFLOW - Workout Tracker JS Logic

// ==========================================
// CONFIGURATION & CONSTANTS
// ==========================================
const DEFAULT_MAINTENANCE_CALORIES = 2000;
const DEFAULT_WEIGHT_KG = 70.0;
const TARGET_MONTHLY_WORKOUTS = 12;
const MAX_RECENT_WEIGHT_LOGS = 10;
const CARDIO_DAYS_WINDOW = 7;
// タイトル・部位カテゴリーの入力欄はフォームから撤去したため、新規記録には固定のデフォルト値を使う
const DEFAULT_WORKOUT_CATEGORY = 'その他 (Other)';

// 特別な飲食チップの定義 (チェック有無 + 任意のkcal数値をこの並びで扱う)
const FOOD_ITEMS = [
    { key: 'milktea', chkId: 'food-milktea-chk', kcalId: 'food-milktea-kcal', calKey: 'milkteaCalories', label: '🍵 紅茶・お菓子' },
    { key: 'ramen', chkId: 'food-ramen-chk', kcalId: 'food-ramen-kcal', calKey: 'ramenCalories', label: '🍜 ラーメン' },
    { key: 'drinking', chkId: 'food-drinking-chk', kcalId: 'food-drinking-kcal', calKey: 'drinkingCalories', label: '🍺 飲み会' }
];

const DEFAULT_PLAN_SETTINGS = {
    intakeNormal: 1750,
    intakeMilkTea: 1966,
    intakeEvent: 2550,
    daysNormal: 3,
    daysMilkTea: 2,
    daysEvent: 2,
    baseBurn: 2450,
    runBurn: 338,
    runCount: 2,
    weightStart: 81.0,
    weight1Month: 79.0,
    weight3Month: 75.5,
    weightEquilibrium: 67.0,
    sleepTarget: 6.5,
    snackRule: '間食は「明治おいしいミルク紅茶 450ml」を週2回まで。他の日は完全無糖。夜22時以降の白米大盛り化を阻止し、普通盛りでストップすること。',
    workoutRule: 'ジム通いを週1回に圧縮し、余った時間を睡眠時間の補填（+1.5時間×2日）に回します。週1回全力（レッグプレス200kg等）で筋肉量は十分維持されます。'
};

// Global state
let state = {
    workouts: [],
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth(), // 0-indexed
    editingWorkoutId: null,
    weightLogs: [],
    cardioLogs: [],
    maintenanceCalories: DEFAULT_MAINTENANCE_CALORIES,
    sheetsUrl: '',
    planSettings: null,
    foodLogs: [],
    charts: {
        category: null,
        progression: null,
        weight: null,
        calorieComparison: null
    }
};

const THEME_PALETTES = {
    A: {
        name: 'フォレスト・セージ',
        dark: {
            '--bg-base': '#141f23',
            '--bg-surface': '#1e2d33',
            '--bg-surface-hover': '#273941',
            '--bg-sidebar': '#182429',
            '--color-primary': '#86ac41',
            '--color-secondary': '#7da3a1',
            '--border-focus': '#86ac41',
            '--text-primary': '#f0f4f3',
            '--text-secondary': '#a8c0be',
            '--text-muted': '#7da3a1',
            '--border-color': 'rgba(125, 163, 161, 0.15)',
            '--primary-gradient': 'linear-gradient(135deg, #86ac41 0%, #34675c 100%)',
            '--secondary-gradient': 'linear-gradient(135deg, #7da3a1 0%, #324851 100%)',
        },
        light: {
            '--bg-base': '#f4f8f6',
            '--bg-surface': '#ffffff',
            '--bg-surface-hover': '#e8f0eb',
            '--bg-sidebar': '#1e2d33',
            '--color-primary': '#34675c',
            '--color-secondary': '#7da3a1',
            '--border-focus': '#34675c',
            '--text-primary': '#1f2d33',
            '--text-secondary': '#4e656d',
            '--text-muted': '#7da3a1',
            '--border-color': 'rgba(50, 72, 81, 0.08)',
            '--primary-gradient': 'linear-gradient(135deg, #34675c 0%, #1e2d33 100%)',
            '--secondary-gradient': 'linear-gradient(135deg, #7da3a1 0%, #34675c 100%)',
        }
    },
    B: {
        name: 'ディープ・オーシャン',
        dark: {
            '--bg-base': '#0a1128',
            '--bg-surface': '#101f42',
            '--bg-surface-hover': '#1a2e5c',
            '--bg-sidebar': '#0c1530',
            '--color-primary': '#00a8ff',
            '--color-secondary': '#00dec7',
            '--border-focus': '#00a8ff',
            '--text-primary': '#ffffff',
            '--text-secondary': '#a0c4ff',
            '--text-muted': '#00dec7',
            '--border-color': 'rgba(0, 168, 255, 0.15)',
            '--primary-gradient': 'linear-gradient(135deg, #00a8ff 0%, #0097e6 100%)',
            '--secondary-gradient': 'linear-gradient(135deg, #00dec7 0%, #00a8ff 100%)',
        },
        light: {
            '--bg-base': '#f0f4f8',
            '--bg-surface': '#ffffff',
            '--bg-surface-hover': '#e1ecf7',
            '--bg-sidebar': '#101f42',
            '--color-primary': '#0066cc',
            '--color-secondary': '#0097e6',
            '--border-focus': '#0066cc',
            '--text-primary': '#0a1128',
            '--text-secondary': '#3a506b',
            '--text-muted': '#0097e6',
            '--border-color': 'rgba(0, 102, 204, 0.08)',
            '--primary-gradient': 'linear-gradient(135deg, #0066cc 0%, #0a1128 100%)',
            '--secondary-gradient': 'linear-gradient(135deg, #0097e6 0%, #0066cc 100%)',
        }
    },
    C: {
        name: 'クリムゾン・サンセット',
        dark: {
            '--bg-base': '#1c1212',
            '--bg-surface': '#2b1a1a',
            '--bg-surface-hover': '#3a2525',
            '--bg-sidebar': '#221515',
            '--color-primary': '#e05a47',
            '--color-secondary': '#d9a05b',
            '--border-focus': '#e05a47',
            '--text-primary': '#fcebeb',
            '--text-secondary': '#e9c46a',
            '--text-muted': '#d9a05b',
            '--border-color': 'rgba(224, 90, 71, 0.15)',
            '--primary-gradient': 'linear-gradient(135deg, #e05a47 0%, #b83b28 100%)',
            '--secondary-gradient': 'linear-gradient(135deg, #d9a05b 0%, #e05a47 100%)',
        },
        light: {
            '--bg-base': '#faf6f5',
            '--bg-surface': '#ffffff',
            '--bg-surface-hover': '#f7e1dd',
            '--bg-sidebar': '#2b1a1a',
            '--color-primary': '#b83b28',
            '--color-secondary': '#d9a05b',
            '--border-focus': '#b83b28',
            '--text-primary': '#2b1a1a',
            '--text-secondary': '#7c4d3a',
            '--text-muted': '#d9a05b',
            '--border-color': 'rgba(184, 59, 40, 0.08)',
            '--primary-gradient': 'linear-gradient(135deg, #b83b28 0%, #2b1a1a 100%)',
            '--secondary-gradient': 'linear-gradient(135deg, #d9a05b 0%, #b83b28 100%)',
        }
    },
    D: {
        name: 'ロイヤル・アメジスト',
        dark: {
            '--bg-base': '#13111c',
            '--bg-surface': '#201c2e',
            '--bg-surface-hover': '#2d2741',
            '--bg-sidebar': '#191624',
            '--color-primary': '#9b5de5',
            '--color-secondary': '#f15bb5',
            '--border-focus': '#9b5de5',
            '--text-primary': '#f6f0ff',
            '--text-secondary': '#d8b4fe',
            '--text-muted': '#f15bb5',
            '--border-color': 'rgba(155, 93, 229, 0.15)',
            '--primary-gradient': 'linear-gradient(135deg, #9b5de5 0%, #7209b7 100%)',
            '--secondary-gradient': 'linear-gradient(135deg, #f15bb5 0%, #9b5de5 100%)',
        },
        light: {
            '--bg-base': '#f8f6fa',
            '--bg-surface': '#ffffff',
            '--bg-surface-hover': '#f0e6f7',
            '--bg-sidebar': '#201c2e',
            '--color-primary': '#7209b7',
            '--color-secondary': '#9b5de5',
            '--border-focus': '#7209b7',
            '--text-primary': '#201c2e',
            '--text-secondary': '#5d3a77',
            '--text-muted': '#9b5de5',
            '--border-color': 'rgba(114, 9, 183, 0.08)',
            '--primary-gradient': 'linear-gradient(135deg, #7209b7 0%, #201c2e 100%)',
            '--secondary-gradient': 'linear-gradient(135deg, #9b5de5 0%, #7209b7 100%)',
        }
    }
};

// Sync Optimization Engine Flags (PayGuard inspired)
const DIRTY_KEY = 'fitflow_db_dirty';
let isSyncing = false;
let syncTimeoutId = null;
let pendingSync = false;

// DOM elements mapping
const DOM = {
    navItems: document.querySelectorAll('.nav-item'),
    tabContents: document.querySelectorAll('.tab-content'),
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    mobileThemeToggleBtn: document.getElementById('mobile-theme-toggle-btn'),
    greetingText: document.getElementById('greeting-text'),
    dateText: document.getElementById('date-text'),
    streakCount: document.getElementById('streak-count'),
    
    // Dashboard
    totalWorkoutsNum: document.getElementById('total-workouts-num'),
    latestWeightNum: document.getElementById('latest-weight-num'),
    latestWeightDate: document.getElementById('latest-weight-date'),
    todayCalorieNum: document.getElementById('today-calorie-num'),
    todayCardioDist: document.getElementById('today-cardio-dist'),
    calendarMonthYear: document.getElementById('calendar-month-year'),
    calendarDays: document.getElementById('calendar-days'),
    prevMonthBtn: document.getElementById('prev-month-btn'),
    nextMonthBtn: document.getElementById('next-month-btn'),
    noCategoryData: document.getElementById('no-category-data'),
    noWeightData: document.getElementById('no-weight-data'),
    noCalorieData: document.getElementById('no-calorie-data'),
    
    // Log Workout Form
    workoutForm: document.getElementById('workout-form'),
    workoutDate: document.getElementById('workout-date'),
    workoutTime: document.getElementById('workout-time'),
    workoutImpression: document.getElementById('workout-impression'),
    exerciseList: document.getElementById('exercise-list'),
    addExerciseBtn: document.getElementById('add-exercise-btn'),
    saveWorkoutBtn: document.getElementById('save-workout-btn'),

    // Quick log extra fields (cardio, part of the unified workout-form)
    logCardioDist: document.getElementById('log-cardio-dist'),
    cardioCalcHint: document.getElementById('cardio-calc-hint'),
    todayBurnedKcal: document.getElementById('today-burned-kcal'),
    currentMaintenanceKcal: document.getElementById('current-maintenance-kcal'),

    // Weight Quick Logger (体重単独記録フォーム)
    weightQuickForm: document.getElementById('weight-quick-form'),
    weightQuickDate: document.getElementById('weight-quick-date'),
    weightQuickVal: document.getElementById('weight-quick-val'),

    // History
    searchInput: document.getElementById('search-input'),
    filterCategory: document.getElementById('filter-category'),
    filterMood: document.getElementById('filter-mood'),
    progressionSelect: document.getElementById('progression-exercise-select'),
    noProgressionData: document.getElementById('no-progression-data'),
    historyCount: document.getElementById('history-count'),
    historyContainer: document.getElementById('history-container'),
    
    // Settings
    maintenanceInput: document.getElementById('maintenance-input'),
    saveMaintenanceBtn: document.getElementById('save-maintenance-btn'),
    sheetsUrlInput: document.getElementById('sheets-url-input'),
    saveSheetsUrlBtn: document.getElementById('save-sheets-url-btn'),
    sheetsBackupBtn: document.getElementById('sheets-backup-btn'),
    sheetsRestoreBtn: document.getElementById('sheets-restore-btn'),
    exportBtn: document.getElementById('export-btn'),
    importTriggerBtn: document.getElementById('import-trigger-btn'),
    importFileInput: document.getElementById('import-file-input'),
    clearAllBtn: document.getElementById('clear-all-btn'),
    
    // Toast & Modals
    toast: document.getElementById('toast'),
    confirmModal: document.getElementById('confirm-modal'),
    modalTitle: document.getElementById('modal-title'),
    modalMessage: document.getElementById('modal-message'),
    modalCancelBtn: document.getElementById('modal-cancel-btn'),
    modalConfirmBtn: document.getElementById('modal-confirm-btn')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initTheme();
    initNavigation();
    initDateTexts();
    initCalendarControls();
    initFormControls();
    initHistoryControls();
    initSettingsControls();
    
    // Load initial views
    updateDashboard();
    updateHistoryList();
    updateCardioHistoryList();
    updateFoodHistoryList();
    renderPlanTab();
    renderPlanSidebarWidget();

    // 起動時にサイレントにクラウドから同期
    autoSyncFromCloud();

    // オンライン復帰時に自動的に未同期データを送信
    window.addEventListener('online', () => {
        if (localStorage.getItem(DIRTY_KEY) === 'true') {
            triggerSync(true);
        }
    });
    
    // iOS Safari用ピンチズーム・ダブルタップ拡大制限
    document.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) {
            e.preventDefault();
        }
    }, { passive: false });
    
    document.addEventListener('gesturestart', (e) => {
        e.preventDefault();
    });

    // Initialize Lucide Icons
    if (window.lucide) {
        lucide.createIcons();
    }
});

// Helper to get local date string YYYY-MM-DD (Safe from timezone shifting offsets)
function getLocalDateString(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Escape free-text user input before inserting it via innerHTML
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// index.html の #popular-exercises datalist をよく使う種目リストの唯一の情報源として再利用する
function getPopularExerciseNames() {
    const datalist = document.getElementById('popular-exercises');
    if (!datalist) return [];
    return Array.from(datalist.options).map(opt => opt.value);
}

// ==========================================
// DATA MANAGEMENT (LocalStorage)
// ==========================================

function loadData() {
    // 1. Workouts
    const data = localStorage.getItem('fitflow_workouts');
    if (data) {
        try {
            state.workouts = JSON.parse(data);
        } catch (e) {
            console.error('Error parsing workouts data', e);
            state.workouts = [];
        }
    } else {
        state.workouts = [];
    }

    // Ensure legacy workouts missing a time property get a reasonable default
    state.workouts.forEach((w, idx) => {
        if (!w.time) {
            const times = ['10:00', '19:00', '18:30', '20:00', '08:00'];
            w.time = times[idx % times.length];
        }
    });

    // 2. Weight Logs
    const weightData = localStorage.getItem('fitflow_weight_logs');
    if (weightData) {
        try {
            state.weightLogs = JSON.parse(weightData);
        } catch (e) {
            console.error('Error parsing weight logs', e);
            state.weightLogs = [];
        }
    } else {
        state.weightLogs = [];
    }

    // Ensure weight logs are sorted chronologically
    state.weightLogs.sort((a, b) => new Date(a.date) - new Date(b.date));

    // 3. Cardio Logs
    const cardioData = localStorage.getItem('fitflow_cardio_logs');
    if (cardioData) {
        try {
            state.cardioLogs = JSON.parse(cardioData);
        } catch (e) {
            console.error('Error parsing cardio logs', e);
            state.cardioLogs = [];
        }
    } else {
        state.cardioLogs = [];
    }

    // Ensure cardio logs are sorted chronologically
    state.cardioLogs.sort((a, b) => new Date(a.date) - new Date(b.date));

    // 4. Maintenance Calories
    const maintData = localStorage.getItem('fitflow_maintenance');
    if (maintData) {
        state.maintenanceCalories = parseInt(maintData) || DEFAULT_MAINTENANCE_CALORIES;
    } else {
        state.maintenanceCalories = DEFAULT_MAINTENANCE_CALORIES;
    }

    // 5. Google Sheets Sync URL
    state.sheetsUrl = localStorage.getItem('fitflow_sheets_url') || 'https://script.google.com/macros/s/AKfycbzvGub8qkPOxTPDcoDbGfiT-U3tdky93ZRMr1SriYq8L4mfPENtZr5iAYyPSJ-xxaZ8/exec';
    
    // 6. Plan Settings
    const planData = localStorage.getItem('fitflow_plan_settings');
    if (planData) {
        try {
            state.planSettings = JSON.parse(planData);
        } catch (e) {
            console.error('Error parsing plan settings', e);
            state.planSettings = Object.assign({}, DEFAULT_PLAN_SETTINGS);
        }
    } else {
        state.planSettings = Object.assign({}, DEFAULT_PLAN_SETTINGS);
    }
    
    // 7. Food Logs
    const foodData = localStorage.getItem('fitflow_food_logs');
    if (foodData) {
        try {
            state.foodLogs = JSON.parse(foodData);
        } catch (e) {
            console.error('Error parsing food logs', e);
            state.foodLogs = [];
        }
    } else {
        state.foodLogs = [];
    }
    
    saveData();
}

function saveData() {
    localStorage.setItem('fitflow_workouts', JSON.stringify(state.workouts));
    localStorage.setItem('fitflow_weight_logs', JSON.stringify(state.weightLogs));
    localStorage.setItem('fitflow_cardio_logs', JSON.stringify(state.cardioLogs));
    localStorage.setItem('fitflow_maintenance', state.maintenanceCalories.toString());
    localStorage.setItem('fitflow_sheets_url', state.sheetsUrl);
    localStorage.setItem('fitflow_plan_settings', JSON.stringify(state.planSettings));
    localStorage.setItem('fitflow_food_logs', JSON.stringify(state.foodLogs));
}

function saveDataAndSync() {
    saveData();
    localStorage.setItem(DIRTY_KEY, 'true');
    scheduleSync(true);
}

// ==========================================
// NAVIGATION & THEME
// ==========================================

function initNavigation() {
    DOM.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.getAttribute('data-tab');
            
            // Update active state in nav
            DOM.navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            // Switch tabs
            DOM.tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === tabId) {
                    content.classList.add('active');
                }
            });

            // Specific tab entry actions
            if (tabId === 'analytics') {
                updateDashboard();
            } else if (tabId === 'history') {
                updateHistoryList();
                updateCardioHistoryList();
                updateFoodHistoryList();
            } else if (tabId === 'quick-log') {
                if (!state.editingWorkoutId) {
                    resetWorkoutForm();
                }
            }
            
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}

function initTheme() {
    const savedTheme = localStorage.getItem('fitflow_theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
    }
    
    // Load and apply the saved color palette theme (A, B, C, D)
    const activePalette = localStorage.getItem('fitflow_theme_id') || 'A';
    applyThemePalette(activePalette);
    
    const handleThemeToggle = () => {
        document.body.classList.toggle('light-theme');
        const theme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
        localStorage.setItem('fitflow_theme', theme);
        
        // Re-apply palette for the new dark/light state
        const currentPalette = localStorage.getItem('fitflow_theme_id') || 'A';
        applyThemePalette(currentPalette);
        
        // Re-render active charts to adjust text color for theme
        if (state.charts.category) renderCategoryChart();
        if (state.charts.progression) renderProgressionChart();
        if (state.charts.weight) renderWeightChart();
        if (state.charts.calorieComparison) renderCalorieChart();
    };
    
    if (DOM.themeToggleBtn) {
        DOM.themeToggleBtn.addEventListener('click', handleThemeToggle);
    }
    if (DOM.mobileThemeToggleBtn) {
        DOM.mobileThemeToggleBtn.addEventListener('click', handleThemeToggle);
    }
}

function applyThemePalette(themeId) {
    const isLight = document.body.classList.contains('light-theme');
    const palette = THEME_PALETTES[themeId] || THEME_PALETTES.A;
    const variables = isLight ? palette.light : palette.dark;
    
    for (const [prop, val] of Object.entries(variables)) {
        document.documentElement.style.setProperty(prop, val);
    }
    
    // Update active state class on settings theme selection buttons
    document.querySelectorAll('.theme-select-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById('theme-btn-' + themeId);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

function setThemePalette(themeId) {
    localStorage.setItem('fitflow_theme_id', themeId);
    applyThemePalette(themeId);
    
    // Re-render active charts to adjust colors dynamically
    if (state.charts.category) renderCategoryChart();
    if (state.charts.progression) renderProgressionChart();
    if (state.charts.weight) renderWeightChart();
    if (state.charts.calorieComparison) renderCalorieChart();
    
    showToast(`テーマを「${THEME_PALETTES[themeId].name}」に変更しました`);
}

function initDateTexts() {
    const today = new Date();
    const optDate = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    if (DOM.dateText) {
        DOM.dateText.textContent = today.toLocaleDateString('ja-JP', optDate);
    }
    
    // Dynamic greeting based on time of day
    const hours = today.getHours();
    let greeting = 'こんにちは！';
    if (hours < 5) greeting = '夜更かしトレーニングですか？💪';
    else if (hours < 11) greeting = 'おはようございます！今日も良い一日にしましょう☀️';
    else if (hours < 18) greeting = 'こんにちは！トレーニング日和ですね🔥';
    else greeting = 'こんばんは！今日もお疲れ様です🌙';
    
    if (DOM.greetingText) {
        DOM.greetingText.innerHTML = `${greeting} <span class="app-version-badge">v1.6.0</span>`;
    }
}

// ==========================================
// NOTIFICATIONS & MODALS
// ==========================================

function showToast(message) {
    if (!DOM.toast) return;
    DOM.toast.querySelector('.toast-message').textContent = message;
    DOM.toast.classList.remove('hidden');
    
    setTimeout(() => {
        DOM.toast.classList.add('hidden');
    }, 3000);
}

function showConfirmModal(title, message, onConfirm) {
    if (!DOM.confirmModal) return;
    DOM.modalTitle.textContent = title;
    DOM.modalMessage.textContent = message;
    DOM.confirmModal.classList.remove('hidden');
    
    const newConfirmBtn = DOM.modalConfirmBtn.cloneNode(true);
    const newCancelBtn = DOM.modalCancelBtn.cloneNode(true);
    DOM.modalConfirmBtn.parentNode.replaceChild(newConfirmBtn, DOM.modalConfirmBtn);
    DOM.modalCancelBtn.parentNode.replaceChild(newCancelBtn, DOM.modalCancelBtn);
    
    DOM.modalConfirmBtn = newConfirmBtn;
    DOM.modalCancelBtn = newCancelBtn;
    
    DOM.modalConfirmBtn.addEventListener('click', () => {
        DOM.confirmModal.classList.add('hidden');
        onConfirm();
    });
    
    DOM.modalCancelBtn.addEventListener('click', () => {
        DOM.confirmModal.classList.add('hidden');
    });
}

// ==========================================
// DASHBOARD VIEW
// ==========================================

function updateDashboard() {
    // 1. Stats: Total workouts
    const total = state.workouts.length;
    if (DOM.totalWorkoutsNum) DOM.totalWorkoutsNum.textContent = total;
    
    // 2. Stats: Latest Weight
    if (state.weightLogs && state.weightLogs.length > 0) {
        const latest = state.weightLogs[state.weightLogs.length - 1]; // O(1) access since it's pre-sorted
        if (DOM.latestWeightNum) DOM.latestWeightNum.textContent = latest.weight.toFixed(1);
        if (DOM.latestWeightDate) DOM.latestWeightDate.textContent = formatDateJp(latest.date);
    } else {
        if (DOM.latestWeightNum) DOM.latestWeightNum.textContent = '0.0';
        if (DOM.latestWeightDate) DOM.latestWeightDate.textContent = '未登録';
    }

    // 3. Stats: Today's running
    const todayStr = getLocalDateString();
    let todayCalories = 0;
    let todayDistance = 0;
    
    if (state.cardioLogs) {
        state.cardioLogs.forEach(c => {
            if (c.date === todayStr) {
                todayCalories += c.calories || 0;
                todayDistance += c.distance || 0;
            }
        });
    }
    if (DOM.todayCalorieNum) DOM.todayCalorieNum.textContent = Math.round(todayCalories);
    if (DOM.todayCardioDist) DOM.todayCardioDist.textContent = `${todayDistance.toFixed(2)} km 走行`;

    // Calorie Balance tiles update
    if (DOM.todayBurnedKcal) {
        DOM.todayBurnedKcal.innerHTML = `${Math.round(todayCalories)} <span class="unit">kcal</span>`;
    }
    if (DOM.currentMaintenanceKcal) {
        DOM.currentMaintenanceKcal.innerHTML = `${state.maintenanceCalories} <span class="unit">kcal</span>`;
    }

    // 4. Streaks
    const streak = calculateStreak(state.workouts);
    if (DOM.streakCount) DOM.streakCount.textContent = `${streak} 日`;
    
    // 5. Training Calendar & Charts
    renderCalendar();
    renderCategoryChart();
    renderWeightChart();
    renderCalorieChart();
}

function calculateStreak(workouts) {
    if (!workouts || workouts.length === 0) return 0;
    
    // Get unique date strings sorted descending
    const dates = workouts.map(w => w.date);
    const uniqueDates = [...new Set(dates)].sort((a, b) => new Date(b) - new Date(a));
    
    const todayStr = getLocalDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalDateString(yesterday);
    
    // Check if user has logged a workout today or yesterday
    if (uniqueDates[0] !== todayStr && uniqueDates[0] !== yesterdayStr) {
        return 0;
    }
    
    let streak = 1;
    let currentDate = new Date(uniqueDates[0] + 'T00:00:00');
    
    for (let i = 1; i < uniqueDates.length; i++) {
        const prevDate = new Date(uniqueDates[i] + 'T00:00:00');
        const diffTime = Math.abs(currentDate - prevDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            streak++;
            currentDate = prevDate;
        } else if (diffDays > 1) {
            break; // Streak broken
        }
    }
    
    return streak;
}

// Calendar Heatmap rendering
function initCalendarControls() {
    if (DOM.prevMonthBtn) {
        DOM.prevMonthBtn.addEventListener('click', () => {
            state.currentMonth--;
            if (state.currentMonth < 0) {
                state.currentMonth = 11;
                state.currentYear--;
            }
            renderCalendar();
        });
    }
    
    if (DOM.nextMonthBtn) {
        DOM.nextMonthBtn.addEventListener('click', () => {
            state.currentMonth++;
            if (state.currentMonth > 11) {
                state.currentMonth = 0;
                state.currentYear++;
            }
            renderCalendar();
        });
    }
}

function renderCalendar() {
    if (!DOM.calendarMonthYear || !DOM.calendarDays) return;
    const year = state.currentYear;
    const month = state.currentMonth;
    
    const monthsJapanese = [
        '1月', '2月', '3月', '4月', '5月', '6月', 
        '7月', '8月', '9月', '10月', '11月', '12月'
    ];
    DOM.calendarMonthYear.textContent = `${year}年 ${monthsJapanese[month]}`;
    
    DOM.calendarDays.innerHTML = '';
    
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    // Empty cells padding
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.classList.add('calendar-day', 'empty');
        DOM.calendarDays.appendChild(emptyCell);
    }
    
    const todayStr = getLocalDateString();
    
    // O(W) Group workouts by date beforehand for fast O(1) lookup in render loop
    const workoutsByDate = {};
    state.workouts.forEach(w => {
        if (!workoutsByDate[w.date]) {
            workoutsByDate[w.date] = [];
        }
        workoutsByDate[w.date].push(w);
    });
    
    // Group food logs by date
    const foodByDate = {};
    if (state.foodLogs) {
        state.foodLogs.forEach(f => {
            foodByDate[f.date] = f;
        });
    }
    
    // Render actual days
    for (let day = 1; day <= totalDays; day++) {
        const dayCell = document.createElement('div');
        dayCell.classList.add('calendar-day');
        dayCell.textContent = day;
        
        const currentMonthPadded = String(month + 1).padStart(2, '0');
        const currentDayPadded = String(day).padStart(2, '0');
        const dateStr = `${year}-${currentMonthPadded}-${currentDayPadded}`;
        
        if (dateStr === todayStr) {
            dayCell.classList.add('today');
        }
        
        const dayWorkouts = workoutsByDate[dateStr];
        if (dayWorkouts && dayWorkouts.length > 0) {
            dayCell.classList.add('workout-done');
            
            const dot = document.createElement('span');
            dot.classList.add('workout-dot-indicator');
            dayCell.appendChild(dot);
            
            const titles = dayWorkouts.map(w => w.title || '無題').join(', ');
            dayCell.setAttribute('title', `${titles} (${dayWorkouts.length}件)`);
            
            dayCell.addEventListener('click', () => {
                const historyNavItem = document.querySelector('[data-tab="history"]');
                if (DOM.searchInput) {
                    DOM.searchInput.value = dateStr;
                    updateHistoryList();
                }
                if (historyNavItem) historyNavItem.click();
            });
        }
        
        const dayFood = foodByDate[dateStr];
        if (dayFood) {
            const emojis = [];
            if (dayFood.milktea) emojis.push('🍵');
            if (dayFood.ramen) emojis.push('🍜');
            if (dayFood.drinking) emojis.push('🍺');
            if (emojis.length > 0) {
                const foodIndicator = document.createElement('span');
                foodIndicator.style.position = 'absolute';
                foodIndicator.style.top = '2px';
                foodIndicator.style.right = '2px';
                foodIndicator.style.fontSize = '0.65rem';
                foodIndicator.style.lineHeight = '1';
                foodIndicator.textContent = emojis.join('');
                dayCell.appendChild(foodIndicator);
                
                const itemsText = emojis.join(' ');
                const existingTitle = dayCell.getAttribute('title') || '';
                dayCell.setAttribute('title', (existingTitle ? existingTitle + ' | ' : '') + `飲食: ${itemsText}`);
            }
        }
        
        DOM.calendarDays.appendChild(dayCell);
    }
}

// Chart.js helper colors
function getChartThemeColors() {
    const isLight = document.body.classList.contains('light-theme');
    return {
        text: isLight ? '#475569' : '#a8c0be',
        grid: isLight ? 'rgba(50, 72, 81, 0.05)' : 'rgba(125, 163, 161, 0.1)',
        border: isLight ? 'rgba(50, 72, 81, 0.08)' : 'rgba(125, 163, 161, 0.15)',
        surface: isLight ? '#ffffff' : '#1e2d33'
    };
}

function hexToRgba(hex, alpha) {
    if (!hex) return `rgba(134, 172, 65, ${alpha})`;
    hex = hex.trim().replace('#', '');
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const r = parseInt(hex.substring(0, 2), 16) || 134;
    const g = parseInt(hex.substring(2, 4), 16) || 172;
    const b = parseInt(hex.substring(4, 6), 16) || 65;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Doughnut Chart - Categories distribution
function renderCategoryChart() {
    const theme = getChartThemeColors();
    
    // Count categories
    const categoriesCount = {};
    state.workouts.forEach(w => {
        if (w.category) {
            categoriesCount[w.category] = (categoriesCount[w.category] || 0) + 1;
        }
    });
    
    const labels = Object.keys(categoriesCount);
    const data = Object.values(categoriesCount);
    
    if (labels.length === 0) {
        if (DOM.noCategoryData) DOM.noCategoryData.style.display = 'block';
        if (state.charts.category) {
            try { state.charts.category.destroy(); } catch(e){}
            state.charts.category = null;
        }
        return;
    }
    
    if (DOM.noCategoryData) DOM.noCategoryData.style.display = 'none';
    
    const canvas = document.getElementById('categoryChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (state.charts.category) {
        try { state.charts.category.destroy(); } catch(e){}
    }
    
    const colorsMap = {
        '胸 (Chest)': '#e05a47',
        '背中 (Back)': '#7da3a1',
        '肩 (Shoulders)': '#d9a05b',
        '腕 (Arms)': '#34675c',
        '脚 (Legs)': '#86ac41',
        '腹筋 (Core)': '#5ca393',
        '有酸素 (Cardio)': '#a2bfa7',
        'その他 (Other)': '#577c8a'
    };
    
    const backgroundColors = labels.map(label => colorsMap[label] || '#94a3b8');
    
    state.charts.category = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors,
                borderWidth: 2,
                borderColor: theme.surface
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: theme.text,
                        font: { family: 'Inter', size: 11 },
                        padding: 15
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const val = context.raw;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = Math.round((val / total) * 100);
                            return ` ${context.label}: ${val}回 (${pct}%)`;
                        }
                    }
                }
            },
            cutout: '70%'
        }
    });
}

// ==========================================
// WORKOUT LOGGING FORM
// ==========================================

function initFormControls() {
    if (DOM.addExerciseBtn) {
        DOM.addExerciseBtn.addEventListener('click', () => {
            addExerciseBlock();
        });
    }
    
    if (DOM.workoutForm) {
        DOM.workoutForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveWorkout();
        });
    }

    if (DOM.logCardioDist) {
        DOM.logCardioDist.addEventListener('input', updateCardioHint);
    }

    if (DOM.weightQuickForm) {
        if (DOM.weightQuickDate) DOM.weightQuickDate.value = getLocalDateString();
        DOM.weightQuickForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveWeightOnly();
        });
    }

    const recordGymWorkoutChk = document.getElementById('record-gym-workout-chk');
    const gymWorkoutFieldsContainer = document.getElementById('gym-workout-fields-container');
    if (recordGymWorkoutChk && gymWorkoutFieldsContainer) {
        recordGymWorkoutChk.addEventListener('change', () => {
            gymWorkoutFieldsContainer.style.display = recordGymWorkoutChk.checked ? 'block' : 'none';
        });
    }

    // 特別な飲食チェックのON/OFFに合わせてkcal入力欄を有効化・無効化する
    FOOD_ITEMS.forEach(item => {
        const chk = document.getElementById(item.chkId);
        const kcalInput = document.getElementById(item.kcalId);
        if (chk && kcalInput) {
            chk.addEventListener('change', () => {
                kcalInput.disabled = !chk.checked;
                if (!chk.checked) kcalInput.value = '';
            });
        }
    });
}

function resetWorkoutForm() {
    state.editingWorkoutId = null;
    if (DOM.workoutForm) DOM.workoutForm.reset();
    
    FOOD_ITEMS.forEach(item => {
        const chk = document.getElementById(item.chkId);
        const kcalInput = document.getElementById(item.kcalId);
        if (chk) chk.checked = false;
        if (kcalInput) {
            kcalInput.value = '';
            kcalInput.disabled = true;
        }
    });

    const now = new Date();
    if (DOM.workoutDate) DOM.workoutDate.value = getLocalDateString(now);

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    if (DOM.workoutTime) DOM.workoutTime.value = `${hours}:${minutes}`;

    if (DOM.exerciseList) DOM.exerciseList.innerHTML = '';
    if (DOM.saveWorkoutBtn) DOM.saveWorkoutBtn.innerHTML = '<i data-lucide="check"></i> 記録を保存する';
    
    const titleHeader = document.getElementById('logger-form-title');
    if (titleHeader) titleHeader.textContent = '今日の活動を一括記録';
    
    addExerciseBlock();
    
    const recordGymWorkoutChk = document.getElementById('record-gym-workout-chk');
    const gymWorkoutFieldsContainer = document.getElementById('gym-workout-fields-container');
    if (recordGymWorkoutChk && gymWorkoutFieldsContainer) {
        gymWorkoutFieldsContainer.style.display = recordGymWorkoutChk.checked ? 'block' : 'none';
    }
    updateCardioHint();
    
    if (window.lucide) {
        lucide.createIcons();
    }
}

function addExerciseBlock(data = null) {
    if (!DOM.exerciseList) return;

    const exerciseIndex = DOM.exerciseList.children.length;
    const exerciseBlock = document.createElement('div');
    exerciseBlock.classList.add('exercise-item');
    exerciseBlock.setAttribute('data-index', exerciseIndex);
    
    const popularExerciseOptionsHtml = getPopularExerciseNames()
        .map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
        .join('');

    exerciseBlock.innerHTML = `
        <div class="exercise-item-header">
            <div class="exercise-name-input-wrapper">
                <select class="exercise-name-picker">
                    <option value="">よく使う種目から選択...</option>
                    ${popularExerciseOptionsHtml}
                </select>
                <input type="text" class="exercise-name" placeholder="種目名（一覧にない場合は自由入力）" required list="popular-exercises" value="${data ? data.name : ''}">
            </div>
            <div class="exercise-sets-counter" style="display: flex; align-items: center; gap: 0.25rem;">
                <label style="font-size: 0.8rem; color: var(--text-secondary); margin: 0; white-space: nowrap;">セット数:</label>
                <input type="number" class="exercise-sets-input" min="1" max="20" value="${data && data.sets ? data.sets.length : 1}" style="width: 50px; padding: 0.35rem 0.25rem; font-size: 0.85rem; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-surface-hover); text-align: center; color: var(--text-primary);">
            </div>
            <button type="button" class="btn-icon btn-remove-exercise text-danger" title="種目を削除">
                <i data-lucide="trash-2"></i>
            </button>
        </div>
        <div class="sets-table-wrapper">
            <table class="sets-table">
                <thead>
                    <tr>
                        <th class="set-num">SET</th>
                        <th>重量 (kg)</th>
                        <th></th>
                        <th>レップ数</th>
                        <th class="set-action"></th>
                    </tr>
                </thead>
                <tbody class="sets-tbody"></tbody>
            </table>
            <button type="button" class="add-set-row-btn">
                <i data-lucide="plus"></i> セットを追加
            </button>
        </div>
    `;
    
    const tbody = exerciseBlock.querySelector('.sets-tbody');
    const addSetBtn = exerciseBlock.querySelector('.add-set-row-btn');
    const removeExBtn = exerciseBlock.querySelector('.btn-remove-exercise');
    const setsInput = exerciseBlock.querySelector('.exercise-sets-input');
    const namePicker = exerciseBlock.querySelector('.exercise-name-picker');
    const nameInput = exerciseBlock.querySelector('.exercise-name');

    if (namePicker && nameInput) {
        namePicker.addEventListener('change', () => {
            if (namePicker.value) {
                nameInput.value = namePicker.value;
            }
            namePicker.value = '';
        });
    }

    addSetBtn.addEventListener('click', () => {
        addSetRow(tbody);
        if (setsInput) setsInput.value = tbody.children.length;
    });
    
    if (setsInput) {
        setsInput.addEventListener('input', () => {
            let val = parseInt(setsInput.value);
            if (isNaN(val) || val < 1) return; // Wait for complete input
            const currentSetsCount = tbody.children.length;
            if (val > currentSetsCount) {
                for (let i = 0; i < val - currentSetsCount; i++) {
                    addSetRow(tbody);
                }
            } else if (val < currentSetsCount) {
                for (let i = 0; i < currentSetsCount - val; i++) {
                    if (tbody.lastElementChild) {
                        tbody.lastElementChild.remove();
                    }
                }
            }
        });
        
        setsInput.addEventListener('blur', () => {
            let val = parseInt(setsInput.value);
            if (isNaN(val) || val < 1) {
                setsInput.value = tbody.children.length;
            }
        });
    }
    
    removeExBtn.addEventListener('click', () => {
        exerciseBlock.style.animation = 'slideIn 0.2s ease reverse';
        setTimeout(() => {
            exerciseBlock.remove();
            Array.from(DOM.exerciseList.children).forEach((child, idx) => {
                child.setAttribute('data-index', idx);
            });
        }, 200);
    });
    
    DOM.exerciseList.appendChild(exerciseBlock);
    
    if (data && data.sets && data.sets.length > 0) {
        data.sets.forEach(s => addSetRow(tbody, s.weight, s.reps));
    } else {
        addSetRow(tbody);
    }
    
    if (window.lucide) {
        lucide.createIcons();
    }
}

function addSetRow(tbody, weight = '', reps = '') {
    const setIndex = tbody.children.length + 1;
    const row = document.createElement('tr');
    row.classList.add('set-row');
    row.innerHTML = `
        <td class="set-num">${setIndex}</td>
        <td>
            <input type="number" step="any" class="set-weight" placeholder="0" min="0" required value="${weight}">
        </td>
        <td class="set-multiply">×</td>
        <td>
            <input type="number" class="set-reps" placeholder="0" min="0" required value="${reps}">
        </td>
        <td class="set-action">
            <button type="button" class="btn-icon btn-remove-set text-danger" title="セットを削除">
                <i data-lucide="x"></i>
            </button>
        </td>
    `;
    
    row.querySelector('.btn-remove-set').addEventListener('click', () => {
        if (tbody.children.length > 1) {
            row.remove();
            Array.from(tbody.children).forEach((r, idx) => {
                r.querySelector('.set-num').textContent = idx + 1;
            });
            // Update sets count input in the parent exercise block
            const exBlock = tbody.closest('.exercise-item');
            if (exBlock) {
                const sInput = exBlock.querySelector('.exercise-sets-input');
                if (sInput) sInput.value = tbody.children.length;
            }
        } else {
            showToast('最低1セットは必要です');
        }
    });
    
    tbody.appendChild(row);
    if (window.lucide) {
        lucide.createIcons();
    }
}

function saveWorkout() {
    const date = DOM.workoutDate.value;
    const time = DOM.workoutTime.value;

    // 1. Read optional cardio running distance
    let cardioSaved = false;
    if (DOM.logCardioDist) {
        const cardioText = DOM.logCardioDist.value.trim();
        if (cardioText !== '') {
            const dist = parseFloat(cardioText);
            if (isNaN(dist) || dist <= 0) {
                showToast('有効な走行距離を入力してください');
                return;
            }
            const calories = Math.round(dist * getLatestWeight());

            state.cardioLogs.push({
                date: date,
                distance: dist,
                calories: calories
            });
            state.cardioLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
            cardioSaved = true;
        }
    }

    // 2. Read gym workout if checked
    let workoutSaved = false;
    const recordGymWorkoutChk = document.getElementById('record-gym-workout-chk');
    if (recordGymWorkoutChk && recordGymWorkoutChk.checked) {
        // タイトル・部位カテゴリーの入力欄は撤去済み。
        // 編集時は既存の値をそのまま維持し、新規作成時のみ固定のデフォルト値を使う
        const existingWorkout = state.editingWorkoutId
            ? state.workouts.find(w => w.id === state.editingWorkoutId)
            : null;
        const title = existingWorkout ? existingWorkout.title : '';
        const category = existingWorkout ? existingWorkout.category : DEFAULT_WORKOUT_CATEGORY;
        const mood = DOM.workoutForm.querySelector('input[name="workout-mood"]:checked').value;
        const impression = DOM.workoutImpression.value.trim();
        
        const exerciseItems = DOM.exerciseList ? DOM.exerciseList.querySelectorAll('.exercise-item') : [];
        const exercises = [];
        let hasValidationError = false;
        
        exerciseItems.forEach(item => {
            const name = item.querySelector('.exercise-name').value.trim();
            if (!name) return; // Skip empty exercise names
            
            const setRows = item.querySelectorAll('.set-row');
            const sets = [];
            
            setRows.forEach(row => {
                const wVal = row.querySelector('.set-weight').value;
                const rVal = row.querySelector('.set-reps').value;
                const weight = parseFloat(wVal);
                const reps = parseInt(rVal);
                
                if (isNaN(weight) || isNaN(reps) || weight < 0 || reps < 0) {
                    hasValidationError = true;
                    return;
                }
                sets.push({ weight, reps });
            });
            
            if (sets.length === 0) {
                hasValidationError = true;
                return;
            }
            exercises.push({ name, sets });
        });
        
        if (hasValidationError) {
            showToast('筋トレ種目の入力内容を確認してください（すべてのセットに正しい値を入力）');
            return;
        }
        
        const workoutData = {
            id: state.editingWorkoutId || 'workout-' + Date.now(),
            date,
            time,
            title: title || '無題のワークアウト',
            category,
            mood,
            impression,
            exercises
        };
        
        if (state.editingWorkoutId) {
            const idx = state.workouts.findIndex(w => w.id === state.editingWorkoutId);
            if (idx !== -1) {
                state.workouts[idx] = workoutData;
            }
        } else {
            state.workouts.unshift(workoutData);
        }
        workoutSaved = true;
    }
    
    // 3. Read optional special foods (+ 任意のkcal数値)
    let foodSaved = false;
    const hasSpecialFood = FOOD_ITEMS.some(item => {
        const chk = document.getElementById(item.chkId);
        return chk && chk.checked;
    });

    const foodIndex = state.foodLogs.findIndex(f => f.date === date);
    if (hasSpecialFood) {
        const foodRecord = { date };
        FOOD_ITEMS.forEach(item => {
            const chk = document.getElementById(item.chkId);
            const kcalInput = document.getElementById(item.kcalId);
            const checked = !!(chk && chk.checked);
            foodRecord[item.key] = checked;
            let calories = null;
            if (checked && kcalInput) {
                const val = parseFloat(kcalInput.value);
                calories = (!isNaN(val) && val > 0) ? val : null;
            }
            foodRecord[item.calKey] = calories;
        });
        if (foodIndex !== -1) {
            state.foodLogs[foodIndex] = foodRecord;
        } else {
            state.foodLogs.push(foodRecord);
        }
        state.foodLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
        foodSaved = true;
    } else {
        if (foodIndex !== -1) {
            state.foodLogs.splice(foodIndex, 1);
            foodSaved = true;
        }
    }
    
    // 4. Validate that at least one type of data is recorded
    if (!cardioSaved && !workoutSaved && !foodSaved) {
        showToast('有酸素、特別な飲食、または筋トレのいずれかを入力・選択してください');
        return;
    }

    // Save, Sync & Update Views
    saveDataAndSync();

    // Show success message based on what was saved
    const savedParts = [];
    if (cardioSaved) savedParts.push('有酸素');
    if (foodSaved && hasSpecialFood) savedParts.push('特別な飲食');
    if (workoutSaved) savedParts.push(state.editingWorkoutId ? '筋トレ更新' : '筋トレ');
    showToast(`${savedParts.join('・')}を記録しました！`);
    
    // Reset state & form
    state.editingWorkoutId = null;
    resetWorkoutForm();
    
    // Refresh views
    updateDashboard();
    updateHistoryList();
    updateCardioHistoryList();
    updateFoodHistoryList();
    
    // Move to history tab
    const historyNavItem = document.querySelector('[data-tab="history"]');
    if (historyNavItem) {
        historyNavItem.click();
    }
}

// ==========================================
// HISTORY & SEARCH & FILTER & ANALYSIS
// ==========================================

function initHistoryControls() {
    if (DOM.searchInput) DOM.searchInput.addEventListener('input', () => updateHistoryList());
    if (DOM.filterCategory) DOM.filterCategory.addEventListener('change', () => updateHistoryList());
    if (DOM.filterMood) DOM.filterMood.addEventListener('change', () => updateHistoryList());
    
    if (DOM.progressionSelect) {
        DOM.progressionSelect.addEventListener('change', () => {
            renderProgressionChart();
        });
    }

    // Sub tabs events
    const tabWorkouts = document.getElementById('history-tab-workouts');
    const tabCardio = document.getElementById('history-tab-cardio');
    const tabFood = document.getElementById('history-tab-food');
    const panelWorkouts = document.getElementById('history-workouts-panel');
    const panelCardio = document.getElementById('history-cardio-panel');
    const panelFood = document.getElementById('history-food-panel');

    if (tabWorkouts && tabCardio && tabFood && panelWorkouts && panelCardio && panelFood) {
        const switchSubTab = (activeTab, activePanel) => {
            [tabWorkouts, tabCardio, tabFood].forEach(t => {
                t.classList.remove('btn-primary');
                t.classList.add('btn-secondary');
            });
            [panelWorkouts, panelCardio, panelFood].forEach(p => {
                p.style.display = 'none';
            });
            
            activeTab.classList.remove('btn-secondary');
            activeTab.classList.add('btn-primary');
            activePanel.style.display = 'block';
        };

        tabWorkouts.addEventListener('click', () => {
            switchSubTab(tabWorkouts, panelWorkouts);
            updateHistoryList();
        });

        tabCardio.addEventListener('click', () => {
            switchSubTab(tabCardio, panelCardio);
            updateCardioHistoryList();
        });

        tabFood.addEventListener('click', () => {
            switchSubTab(tabFood, panelFood);
            updateFoodHistoryList();
        });
    }
}

function updateHistoryList() {
    if (!DOM.historyContainer || !DOM.historyCount) return;
    const searchQuery = DOM.searchInput.value.toLowerCase().trim();
    const catFilter = DOM.filterCategory.value;
    const moodFilter = DOM.filterMood.value;
    
    const filtered = state.workouts.filter(w => {
        const matchesSearch = searchQuery === '' || 
            (w.title && w.title.toLowerCase().includes(searchQuery)) ||
            (w.impression && w.impression.toLowerCase().includes(searchQuery)) ||
            (w.date && w.date.includes(searchQuery)) ||
            (w.exercises && w.exercises.some(ex => ex.name && ex.name.toLowerCase().includes(searchQuery)));
            
        const matchesCategory = catFilter === 'all' || w.category === catFilter;
        const matchesMood = moodFilter === 'all' || w.mood === moodFilter;
        
        return matchesSearch && matchesCategory && matchesMood;
    });
    
    DOM.historyCount.textContent = filtered.length;
    DOM.historyContainer.innerHTML = '';
    
    if (filtered.length === 0) {
        DOM.historyContainer.innerHTML = `
            <div class="card empty-state">
                <i data-lucide="search-code"></i>
                <p>該当するワークアウト履歴が見つかりません。</p>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }
    
    // Sort chronologically descending
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    filtered.forEach(w => {
        const card = createHistoryCard(w);
        DOM.historyContainer.appendChild(card);
    });
    
    updateProgressionSelect();
    if (window.lucide) {
        lucide.createIcons();
    }
}

function createHistoryCard(workout) {
    const card = document.createElement('div');
    card.classList.add('card', 'workout-history-card');
    
    const categoryClassMap = {
        '胸 (Chest)': 'chest',
        '背中 (Back)': 'back',
        '肩 (Shoulders)': 'shoulders',
        '腕 (Arms)': 'arms',
        '脚 (Legs)': 'legs',
        '腹筋 (Core)': 'core',
        '有酸素 (Cardio)': 'cardio',
        'その他 (Other)': 'other'
    };
    const cClass = categoryClassMap[workout.category] || 'other';
    card.classList.add(cClass);
    
    const moodEmojiMap = {
        'fire': '🔥',
        'strong': '💪',
        'good': '😊',
        'tired': '🥱',
        'exhausted': '☠️'
    };
    const emoji = moodEmojiMap[workout.mood] || '😊';
    
    let exercisesHtml = '';
    if (workout.exercises) {
        workout.exercises.forEach(ex => {
            let setsListHtml = '';
            ex.sets.forEach((s, idx) => {
                const est1RM = s.reps > 1 ? Math.round(s.weight * (1 + s.reps / 30)) : s.weight;
                setsListHtml += `
                    <div class="history-set-item">
                        <span>Set ${idx + 1}</span>
                        <span class="history-set-detail">${s.weight} kg × ${s.reps} 回 <span class="text-muted">(1RM ~${est1RM}kg)</span></span>
                    </div>
                `;
            });
            
            exercisesHtml += `
                <div class="history-exercise-box">
                    <div class="history-exercise-name">${escapeHtml(ex.name)}</div>
                    <div class="history-sets-list">${setsListHtml}</div>
                </div>
            `;
        });
    }
    
    const formattedDate = formatDateJp(workout.date);
    
    card.innerHTML = `
        <div class="history-card-header">
            <div class="history-title-area">
                <div class="history-title-row">
                    <span class="history-mood-badge" title="調子: ${workout.mood}">${emoji}</span>
                    <h4>${escapeHtml(workout.title)}</h4>
                    <span class="category-tag">${escapeHtml(workout.category)}</span>
                </div>
                <div class="history-date-row">
                    <i data-lucide="calendar"></i>
                    <span>${formattedDate} ${workout.time ? `&nbsp; ${workout.time}` : ''}</span>
                </div>
            </div>
            <div class="history-actions">
                <button class="btn-icon text-primary btn-edit-history" title="編集する">
                    <i data-lucide="edit-3"></i>
                </button>
                <button class="btn-icon text-danger btn-delete-history" title="削除する">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        </div>
        
        ${workout.impression ? `<div class="history-impression">${escapeHtml(workout.impression).replace(/\n/g, '<br>')}</div>` : ''}
        
        <div class="history-exercises-container">
            <div class="history-exercises-title">
                <i data-lucide="activity"></i>
                <span>実施内容</span>
            </div>
            <div class="history-exercises-grid">
                ${exercisesHtml}
            </div>
        </div>
    `;
    
    card.querySelector('.btn-edit-history').addEventListener('click', () => {
        editWorkout(workout.id);
    });
    
    card.querySelector('.btn-delete-history').addEventListener('click', () => {
        showConfirmModal('記録の削除', `「${workout.title} (${formattedDate})」の記録を削除しますか？`, () => {
            deleteWorkout(workout.id);
        });
    });
    
    return card;
}

function editWorkout(id) {
    const workout = state.workouts.find(w => w.id === id);
    if (!workout) return;
    
    state.editingWorkoutId = id;

    const formNavItem = document.querySelector('[data-tab="quick-log"]');
    if (formNavItem) formNavItem.click();

    const titleHeader = document.getElementById('logger-form-title');
    if (titleHeader) titleHeader.textContent = 'ワークアウト記録の編集';

    // このワークアウトと無関係な有酸素の入力欄はクリアしておく
    // (入力中だった値がそのままこの編集の保存に紛れ込むのを防ぐ)
    if (DOM.logCardioDist) DOM.logCardioDist.value = '';
    updateCardioHint();

    const recordGymWorkoutChk = document.getElementById('record-gym-workout-chk');
    const gymWorkoutFieldsContainer = document.getElementById('gym-workout-fields-container');
    if (recordGymWorkoutChk) recordGymWorkoutChk.checked = true;
    if (gymWorkoutFieldsContainer) gymWorkoutFieldsContainer.style.display = 'block';
    if (DOM.saveWorkoutBtn) {
        DOM.saveWorkoutBtn.innerHTML = '<i data-lucide="save"></i> 編集を保存する';
    }
    
    if (DOM.workoutDate) DOM.workoutDate.value = workout.date;
    if (DOM.workoutTime) DOM.workoutTime.value = workout.time || '12:00';
    
    // Populate special food checkboxes (+ kcal) for this date
    const foodRecord = state.foodLogs ? state.foodLogs.find(f => f.date === workout.date) : null;
    FOOD_ITEMS.forEach(item => {
        const chk = document.getElementById(item.chkId);
        const kcalInput = document.getElementById(item.kcalId);
        const checked = foodRecord ? !!foodRecord[item.key] : false;
        if (chk) chk.checked = checked;
        if (kcalInput) {
            kcalInput.disabled = !checked;
            kcalInput.value = (checked && foodRecord && foodRecord[item.calKey]) ? foodRecord[item.calKey] : '';
        }
    });
    
    if (DOM.workoutImpression) DOM.workoutImpression.value = workout.impression || '';
    
    const moodRadio = DOM.workoutForm ? DOM.workoutForm.querySelector(`input[name="workout-mood"][value="${workout.mood}"]`) : null;
    if (moodRadio) moodRadio.checked = true;
    
    if (DOM.exerciseList) {
        DOM.exerciseList.innerHTML = '';

        if (workout.exercises) {
            workout.exercises.forEach(ex => {
                addExerciseBlock(ex);
            });
        }
    }
    
    if (window.lucide) {
        lucide.createIcons();
    }
}

function deleteWorkout(id) {
    const idx = state.workouts.findIndex(w => w.id === id);
    if (idx !== -1) {
        state.workouts.splice(idx, 1);
        saveDataAndSync();
        showToast('ワークアウト記録を削除しました');
        updateDashboard(); // Sync total workouts and calendar count
        updateHistoryList();
    }
}

function formatDateJp(dateStr) {
    if (!dateStr) return '日付未設定';
    try {
        const date = new Date(dateStr + 'T00:00:00');
        if (isNaN(date.getTime())) return dateStr;
        const days = ['日', '月', '火', '水', '木', '金', '土'];
        return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 (${days[date.getDay()]})`;
    } catch (e) {
        return dateStr;
    }
}

function updateProgressionSelect() {
    if (!DOM.progressionSelect) return;
    const exerciseNamesSet = new Set();
    state.workouts.forEach(w => {
        if (w.exercises) {
            w.exercises.forEach(ex => {
                if (ex.name && ex.name.trim() !== '') {
                    exerciseNamesSet.add(ex.name.trim());
                }
            });
        }
    });
    
    const exerciseNames = [...exerciseNamesSet].sort();
    
    const oldVal = DOM.progressionSelect.value;
    DOM.progressionSelect.innerHTML = '';
    
    if (exerciseNames.length === 0) {
        DOM.progressionSelect.innerHTML = '<option value="">データなし</option>';
        renderProgressionChart();
        return;
    }
    
    exerciseNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        DOM.progressionSelect.appendChild(option);
    });
    
    if (exerciseNames.includes(oldVal)) {
        DOM.progressionSelect.value = oldVal;
    } else {
        DOM.progressionSelect.value = exerciseNames[0];
    }
    
    renderProgressionChart();
}

function renderProgressionChart() {
    const theme = getChartThemeColors();
    if (!DOM.progressionSelect || !DOM.noProgressionData) return;
    const exerciseName = DOM.progressionSelect.value;
    
    if (!exerciseName) {
        DOM.noProgressionData.style.display = 'block';
        DOM.noProgressionData.textContent = 'データがありません。';
        if (state.charts.progression) {
            try { state.charts.progression.destroy(); } catch(e){}
            state.charts.progression = null;
        }
        return;
    }
    
    const points = [];
    state.workouts.forEach(w => {
        if (!w.exercises) return;
        const matchedEx = w.exercises.find(ex => ex.name && ex.name.trim() === exerciseName);
        if (matchedEx) {
            let maxWeight = 0;
            let maxEst1RM = 0;
            
            matchedEx.sets.forEach(s => {
                const weight = parseFloat(s.weight) || 0;
                const reps = parseInt(s.reps) || 0;
                const est1RM = reps > 1 ? weight * (1 + reps / 30) : weight;
                
                if (weight > maxWeight) maxWeight = weight;
                if (est1RM > maxEst1RM) maxEst1RM = est1RM;
            });
            
            points.push({
                date: w.date,
                maxWeight: maxWeight,
                est1RM: Math.round(maxEst1RM * 10) / 10
            });
        }
    });
    
    points.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    if (points.length < 2) {
        DOM.noProgressionData.style.display = 'block';
        DOM.noProgressionData.textContent = `重量推移を表示するには、「${exerciseName}」を2回以上記録してください（現在: ${points.length}回）`;
        if (state.charts.progression) {
            try { state.charts.progression.destroy(); } catch(e){}
            state.charts.progression = null;
        }
        return;
    }
    
    DOM.noProgressionData.style.display = 'none';
    
    const canvas = document.getElementById('progressionChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (state.charts.progression) {
        try { state.charts.progression.destroy(); } catch(e){}
    }
    
    const dates = points.map(p => formatDateJp(p.date));
    const maxWeights = points.map(p => p.maxWeight);
    const est1RMs = points.map(p => p.est1RM);
    
    const colorPrimary = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#86ac41';
    const colorSecondary = getComputedStyle(document.documentElement).getPropertyValue('--color-secondary').trim() || '#7da3a1';
    
    state.charts.progression = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                {
                    label: '推定 1RM (MAX)',
                    data: est1RMs,
                    borderColor: colorPrimary,
                    backgroundColor: hexToRgba(colorPrimary, 0.1),
                    borderWidth: 2.5,
                    tension: 0.25,
                    fill: true,
                    pointBackgroundColor: colorPrimary,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: '最大重量',
                    data: maxWeights,
                    borderColor: colorSecondary,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [3, 3],
                    tension: 0.25,
                    fill: false,
                    pointBackgroundColor: colorSecondary,
                    pointRadius: 3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: theme.text, font: { size: 10 } }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: theme.text, font: { size: 9 } }
                },
                y: {
                    grid: { color: theme.grid },
                    ticks: { color: theme.text, font: { size: 9 } },
                    beginAtZero: false
                }
            }
        }
    });
}

// ==========================================
// DATA BACKUP & SETTINGS (JSON Export/Import)
// ==========================================

function initSettingsControls() {
    if (DOM.maintenanceInput) {
        DOM.maintenanceInput.value = state.maintenanceCalories;
    }

    if (DOM.saveMaintenanceBtn) {
        DOM.saveMaintenanceBtn.addEventListener('click', () => {
            const val = parseInt(DOM.maintenanceInput.value) || DEFAULT_MAINTENANCE_CALORIES;
            state.maintenanceCalories = val;
            saveDataAndSync();
            showToast('メンテナンスカロリーを保存しました！');
            updateDashboard();
        });
    }

    const autoCalcMaintBtn = document.getElementById('auto-calc-maintenance-btn');
    if (autoCalcMaintBtn) {
        autoCalcMaintBtn.addEventListener('click', () => {
            calculateFluidMaintenance();
        });
    }

    // Theme select buttons click events
    ['A', 'B', 'C', 'D'].forEach(themeId => {
        const btn = document.getElementById('theme-btn-' + themeId);
        if (btn) {
            btn.addEventListener('click', () => {
                setThemePalette(themeId);
            });
        }
    });

    if (DOM.sheetsUrlInput) {
        DOM.sheetsUrlInput.value = state.sheetsUrl;
    }

    if (DOM.saveSheetsUrlBtn) {
        DOM.saveSheetsUrlBtn.addEventListener('click', () => {
            state.sheetsUrl = DOM.sheetsUrlInput.value.trim();
            saveData();
            showToast('GASのウェブアプリURLを保存しました！');
        });
    }

    if (DOM.sheetsBackupBtn) {
        DOM.sheetsBackupBtn.addEventListener('click', () => {
            backupToSheets();
        });
    }

    if (DOM.sheetsRestoreBtn) {
        DOM.sheetsRestoreBtn.addEventListener('click', () => {
            restoreFromSheets();
        });
    }

    if (DOM.exportBtn) {
        DOM.exportBtn.addEventListener('click', () => {
            exportWorkouts();
        });
    }
    
    if (DOM.importTriggerBtn) {
        DOM.importTriggerBtn.addEventListener('click', () => {
            DOM.importFileInput.click();
        });
    }
    
    if (DOM.importFileInput) {
        DOM.importFileInput.addEventListener('change', (e) => {
            importWorkouts(e);
        });
    }
    
    if (DOM.clearAllBtn) {
        DOM.clearAllBtn.addEventListener('click', () => {
            showConfirmModal(
                'データの初期化',
                '本当にこの端末（ブラウザ）のすべてのデータを削除しますか？この操作は元に戻せません。なお、クラウド（スプレッドシート）側のバックアップはこの操作では変更されません。',
                () => {
                    clearAllWorkouts();
                }
            );
        });
    }
}

function calculateFluidMaintenance() {
    const latestWeight = getLatestWeight();
    
    // Count workouts in the last 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    const workoutsLast30Days = state.workouts.filter(w => {
        if (!w.date) return false;
        const wDate = new Date(w.date + 'T00:00:00');
        return wDate >= thirtyDaysAgo && wDate <= today;
    }).length;
    
    // 1. Basal Metabolic Rate (BMR) = 23 * Weight (kg)
    const bmr = 23 * latestWeight;
    
    // 2. Physical Activity Level (PAL) multiplier based on workout frequency in last 30 days
    let pal = 1.2; // Sedentary
    let freqDesc = 'ほとんど運動なし (週0回未満)';
    
    if (workoutsLast30Days >= 12) { // 3+ times a week
        pal = 1.725; // Very active
        freqDesc = '活発な運動 (週3回以上)';
    } else if (workoutsLast30Days >= 8) { // 2 times a week
        pal = 1.55; // Moderately active
        freqDesc = '適度な運動 (週2回程度)';
    } else if (workoutsLast30Days >= 4) { // 1 time a week
        pal = 1.375; // Lightly active
        freqDesc = '軽い運動 (週1回程度)';
    }
    
    const calculatedCalories = Math.round(bmr * pal);
    
    // Apply to input and state
    if (DOM.maintenanceInput) {
        DOM.maintenanceInput.value = calculatedCalories;
    }
    state.maintenanceCalories = calculatedCalories;
    saveDataAndSync();
    
    showToast(`メンテナンスカロリーを再計算しました：${calculatedCalories} kcal (${freqDesc}, 最新体重: ${latestWeight.toFixed(1)}kg)`);
    updateDashboard();
}

function exportWorkouts() {
    const backupData = {
        version: '1.5.1',
        workouts: state.workouts,
        weightLogs: state.weightLogs,
        cardioLogs: state.cardioLogs,
        maintenanceCalories: state.maintenanceCalories,
        foodLogs: state.foodLogs,
        planSettings: state.planSettings
    };
    
    const dataStr = JSON.stringify(backupData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const filename = `fitflow_backup_${getLocalDateString()}.json`;
    
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', filename);
    link.click();
    
    showToast('バックアップデータをエクスポートしました');
}

function importWorkouts(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsed = JSON.parse(e.target.result);
            let importedWorkouts = [];
            let importedWeights = [];
            let importedCardio = [];
            let importedMaint = DEFAULT_MAINTENANCE_CALORIES;
            let importedFood = [];
            let importedPlan = null;

            if (Array.isArray(parsed)) {
                // Legacy workouts backup format
                importedWorkouts = parsed;
            } else if (parsed && typeof parsed === 'object') {
                // Full state backup format
                importedWorkouts = parsed.workouts || [];
                importedWeights = parsed.weightLogs || [];
                importedCardio = parsed.cardioLogs || [];
                importedMaint = parsed.maintenanceCalories || DEFAULT_MAINTENANCE_CALORIES;
                importedFood = parsed.foodLogs || [];
                importedPlan = parsed.planSettings || null;
            } else {
                showToast('無効なファイル形式です。');
                return;
            }

            // Validate incoming workouts structure
            if (!validateWorkoutsSchema(importedWorkouts)) {
                showToast('インポートデータのフォーマットが不正です。');
                return;
            }

            showConfirmModal(
                'データの復元',
                `ファイルを読み込みました（ワークアウト: ${importedWorkouts.length}件, 体重ログ: ${importedWeights.length}件）。既存データにマージしますか？`,
                () => {
                    mergeImportedData(importedWorkouts, importedWeights, importedCardio, importedMaint, importedFood, importedPlan);
                }
            );
        } catch (err) {
            console.error('Failed to parse JSON file', err);
            showToast('JSONファイルの解析に失敗しました。');
        }
        DOM.importFileInput.value = '';
    };
    reader.readAsText(file);
}

// Rigorous JSON Schema Validation for Imported Data
function validateWorkoutsSchema(data) {
    if (!Array.isArray(data)) return false;
    for (const w of data) {
        if (!w || typeof w !== 'object') return false;
        if (typeof w.id !== 'string' || !w.id) return false;
        if (typeof w.date !== 'string' || !w.date) return false;
        if (typeof w.title !== 'string') return false;
        if (typeof w.category !== 'string') return false;
        if (typeof w.mood !== 'string') return false;
        if (typeof w.impression !== 'string') return false;
        if (!Array.isArray(w.exercises)) return false;
        
        for (const ex of w.exercises) {
            if (!ex || typeof ex !== 'object') return false;
            if (typeof ex.name !== 'string' || !ex.name) return false;
            if (!Array.isArray(ex.sets)) return false;
            for (const s of ex.sets) {
                if (!s || typeof s !== 'object') return false;
                // Support both float/int, check isNaN
                const weight = parseFloat(s.weight);
                const reps = parseInt(s.reps);
                if (isNaN(weight) || isNaN(reps)) return false;
            }
        }
    }
    return true;
}

function mergeImportedData(workouts, weights, cardio, maintenance, foodLogs = [], planSettings = null) {
    // 1. Merge workouts by ID
    const workoutsMap = {};
    state.workouts.forEach(w => workoutsMap[w.id] = w);
    workouts.forEach(w => {
        if (w.id && w.date && w.title && Array.isArray(w.exercises)) {
            workoutsMap[w.id] = w;
        }
    });
    state.workouts = Object.values(workoutsMap);
    state.workouts.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // 2. Merge weights by date
    const weightsMap = {};
    state.weightLogs.forEach(w => weightsMap[w.date] = w.weight);
    weights.forEach(w => {
        if (w.date && typeof w.weight === 'number') {
            weightsMap[w.date] = w.weight;
        }
    });
    state.weightLogs = Object.entries(weightsMap).map(([date, weight]) => ({ date, weight }));
    state.weightLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // 3. Merge cardio
    const cardioKeys = new Set(state.cardioLogs.map(c => `${c.date}_${c.distance}`));
    cardio.forEach(c => {
        if (c.date && typeof c.distance === 'number') {
            const key = `${c.date}_${c.distance}`;
            if (!cardioKeys.has(key)) {
                state.cardioLogs.push(c);
            }
        }
    });
    state.cardioLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // 4. Update maintenance
    if (typeof maintenance === 'number' && maintenance > 0) {
        state.maintenanceCalories = maintenance;
        if (DOM.maintenanceInput) DOM.maintenanceInput.value = maintenance;
    }

    // 5. Merge food logs by date
    const foodMap = {};
    state.foodLogs.forEach(f => foodMap[f.date] = f);
    (foodLogs || []).forEach(f => {
        if (f && f.date) {
            foodMap[f.date] = f;
        }
    });
    state.foodLogs = Object.values(foodMap);
    state.foodLogs.sort((a, b) => new Date(a.date) - new Date(b.date));

    // 6. Merge plan settings (incoming values take precedence when provided)
    if (planSettings && typeof planSettings === 'object') {
        state.planSettings = Object.assign({}, DEFAULT_PLAN_SETTINGS, state.planSettings, planSettings);
    }

    saveDataAndSync();
    showToast('バックアップデータをマージ・復元しました！');

    updateDashboard();
    updateHistoryList();
    updateCardioHistoryList();
    updateFoodHistoryList();
    renderPlanTab();
    renderPlanSidebarWidget();
}

function clearAllWorkouts() {
    state.workouts = [];
    state.weightLogs = [];
    state.cardioLogs = [];
    state.foodLogs = [];
    state.maintenanceCalories = DEFAULT_MAINTENANCE_CALORIES;
    state.planSettings = Object.assign({}, DEFAULT_PLAN_SETTINGS);

    // 意図的に saveDataAndSync() ではなく saveData() のみを呼ぶ。
    // ここでクラウドへ自動pushしてしまうと、誤操作による初期化がクラウド側の
    // バックアップまで即座に空にしてしまい、復元手段を失うため。
    // また DIRTY_KEY を明示的に false にしておくことで、次回起動時の自動同期が
    // (dirty=trueの場合の)空pushではなく、クラウドからの復元方向に働くようにする。
    saveData();
    localStorage.setItem(DIRTY_KEY, 'false');
    showToast('この端末のデータを初期化しました（クラウド側のバックアップは変更していません）。');

    updateDashboard();
    updateHistoryList();
    updateCardioHistoryList();
    updateFoodHistoryList();
    renderPlanTab();
    renderPlanSidebarWidget();
}

// ==========================================
// WEIGHT & CARDIO & CALORIE LOGGING LOGIC
// ==========================================

function getLatestWeight() {
    if (state.weightLogs && state.weightLogs.length > 0) {
        // Last element since it's sorted chronologically in load/save
        return state.weightLogs[state.weightLogs.length - 1].weight;
    }
    return DEFAULT_WEIGHT_KG;
}

function updateCardioHint() {
    if (!DOM.logCardioDist || !DOM.cardioCalcHint) return;
    const dist = parseFloat(DOM.logCardioDist.value) || 0;
    const latestWeight = getLatestWeight();
    const kcal = Math.round(dist * latestWeight);
    DOM.cardioCalcHint.textContent = `※消費目安: ${kcal} kcal (最新体重: ${latestWeight} kg)`;
}

// 体重だけを単独で記録する（メインの活動記録フォームとは独立）
function saveWeightOnly() {
    if (!DOM.weightQuickDate || !DOM.weightQuickVal) return;

    const date = DOM.weightQuickDate.value;
    const weightText = DOM.weightQuickVal.value.trim();
    if (!date) {
        showToast('日付を入力してください');
        return;
    }
    const weight = parseFloat(weightText);
    if (isNaN(weight) || weight <= 0) {
        showToast('有効な体重を入力してください');
        return;
    }

    const existingIndex = state.weightLogs.findIndex(w => w.date === date);
    if (existingIndex !== -1) {
        state.weightLogs[existingIndex].weight = weight;
    } else {
        state.weightLogs.push({ date, weight });
    }
    state.weightLogs.sort((a, b) => new Date(a.date) - new Date(b.date));

    saveDataAndSync();
    showToast('体重を記録しました！');

    DOM.weightQuickVal.value = '';
    updateCardioHint();
    updateDashboard();
}

function renderWeightChart() {
    const theme = getChartThemeColors();
    const canvas = document.getElementById('weightChart');
    if (!canvas || !DOM.noWeightData) return;
    
    const ctx = canvas.getContext('2d');
    
    if (state.weightLogs.length === 0) {
        DOM.noWeightData.style.display = 'block';
        if (state.charts.weight) {
            try { state.charts.weight.destroy(); } catch(e){}
            state.charts.weight = null;
        }
        return;
    }
    
    DOM.noWeightData.style.display = 'none';
    
    const recentLogs = state.weightLogs.slice(-MAX_RECENT_WEIGHT_LOGS);
    
    const labels = recentLogs.map(l => {
        const parts = l.date.split('-');
        return parts.length === 3 ? `${parseInt(parts[1])}/${parseInt(parts[2])}` : l.date;
    });
    const weights = recentLogs.map(l => l.weight);
    
    if (state.charts.weight) {
        try { state.charts.weight.destroy(); } catch(e){}
    }
    
    state.charts.weight = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '体重 (kg)',
                data: weights,
                borderColor: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#86ac41',
                backgroundColor: hexToRgba(getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#86ac41', 0.1),
                borderWidth: 2.5,
                tension: 0.3,
                fill: true,
                pointBackgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#86ac41',
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: theme.text, font: { size: 9 } }
                },
                y: {
                    grid: { color: theme.grid },
                    ticks: { color: theme.text, font: { size: 9 } },
                    beginAtZero: false
                }
            }
        }
    });
}

function renderCalorieChart() {
    const theme = getChartThemeColors();
    const canvas = document.getElementById('calorieComparisonChart');
    if (!canvas || !DOM.noCalorieData) return;
    
    const ctx = canvas.getContext('2d');
    
    const labels = [];
    const datesYmd = [];
    const today = new Date();
    
    // Generate dates window
    for (let i = CARDIO_DAYS_WINDOW - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const ymd = getLocalDateString(d);
        datesYmd.push(ymd);
        
        const parts = ymd.split('-');
        labels.push(`${parseInt(parts[1])}/${parseInt(parts[2])}`);
    }
    
    const activeCalories = datesYmd.map(ymd => {
        let sum = 0;
        state.cardioLogs.forEach(c => {
            if (c.date === ymd) {
                sum += c.calories || 0;
            }
        });
        return sum;
    });
    
    const maintenanceLimit = datesYmd.map(() => state.maintenanceCalories);
    
    if (state.charts.calorieComparison) {
        try { state.charts.calorieComparison.destroy(); } catch(e){}
    }
    
    state.charts.calorieComparison = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '消費カロリー (ラン)',
                    data: activeCalories,
                    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#86ac41',
                    borderRadius: 4,
                    barThickness: 16
                },
                {
                    label: 'メンテナンス',
                    data: maintenanceLimit,
                    type: 'line',
                    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--color-secondary').trim() || '#7da3a1',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: theme.text, font: { size: 10 } }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: theme.text, font: { size: 9 } }
                },
                y: {
                    grid: { color: theme.grid },
                    ticks: { color: theme.text, font: { size: 9 } },
                    beginAtZero: true
                }
            }
        }
    });
}

// ==========================================
// GOOGLE SHEETS CLOUD SYNC FUNCTIONS
// ==========================================

function backupToSheets() {
    triggerSync(false);
}

function scheduleSync(isSilent = false) {
    if (syncTimeoutId) clearTimeout(syncTimeoutId);
    syncTimeoutId = setTimeout(() => {
        triggerSync(isSilent);
    }, 500);
}

function triggerSync(isSilent = false) {
    if (!state.sheetsUrl || !state.sheetsUrl.trim()) return;
    
    if (isSyncing) {
        pendingSync = true;
        return;
    }
    
    isSyncing = true;
    if (!isSilent) showToast('☁️ クラウドへ同期中...');
    
    const payload = {
        action: 'backup',
        workouts: state.workouts,
        weightLogs: state.weightLogs,
        cardioLogs: state.cardioLogs,
        maintenanceCalories: state.maintenanceCalories,
        foodLogs: state.foodLogs,
        planSettings: state.planSettings
    };
    
    fetch(state.sheetsUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
            'Content-Type': 'text/plain'
        },
        body: JSON.stringify(payload)
    })
    .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
    })
    .then(data => {
        isSyncing = false;
        if (data && data.success) {
            if (!pendingSync) {
                localStorage.setItem(DIRTY_KEY, 'false');
            }
            if (!isSilent) showToast('スプレッドシートへの同期が成功しました！');
        } else {
            if (!isSilent) showToast('同期エラー: ' + (data.error || '不明なエラー'));
        }
        
        if (pendingSync) {
            pendingSync = false;
            scheduleSync(true);
        }
    })
    .catch(err => {
        isSyncing = false;
        console.error("Sync Connection Failed:", err);
        if (!isSilent) showToast('同期に失敗しました。接続設定を確認してください');
        pendingSync = false;
    });
}

function autoSyncFromCloud() {
    if (!state.sheetsUrl || !state.sheetsUrl.trim()) return;
    
    if (localStorage.getItem(DIRTY_KEY) === 'true') {
        console.log("☁️ Local database is dirty. Uploading local changes instead of downloading.");
        triggerSync(true);
        return;
    }
    
    fetch(state.sheetsUrl, {
        method: 'GET',
        mode: 'cors'
    })
    .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
    })
    .then(data => {
        if (data && !data.error) {
            data = normalizeImportedData(data);
            const importedWorkouts = data.workouts || [];
            const importedWeights = data.weightLogs || [];
            const importedCardio = data.cardioLogs || [];
            const importedMaint = data.maintenanceCalories || DEFAULT_MAINTENANCE_CALORIES;
            const importedFood = data.foodLogs || [];
            const importedPlan = data.planSettings || null;

            if (!validateWorkoutsSchema(importedWorkouts)) {
                console.warn("☁️ Cloud workouts failed schema validation.");
                return;
            }

            // 安全策: クラウド側の件数がローカルより明らかに少ない場合、
            // スプレッドシートの誤操作・破損の可能性があるため自動上書きせず、
            // 「クラウドから復元」の確認ダイアログ経由での手動判断に委ねる
            const localTotal = state.workouts.length + state.weightLogs.length + state.cardioLogs.length;
            const remoteTotal = importedWorkouts.length + importedWeights.length + importedCardio.length;
            if (localTotal > 0 && remoteTotal < localTotal) {
                console.warn(`☁️ クラウドの件数(${remoteTotal})がローカル(${localTotal})より少ないため自動同期をスキップしました。`);
                showToast('⚠️ クラウド側のデータ件数が減少しているため自動同期をスキップしました');
                return;
            }

            state.workouts = importedWorkouts;
            state.weightLogs = importedWeights;
            state.cardioLogs = importedCardio;
            state.maintenanceCalories = importedMaint;
            state.foodLogs = importedFood;
            if (importedPlan) state.planSettings = importedPlan;

            // Sort
            state.weightLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
            state.cardioLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
            state.foodLogs.sort((a, b) => new Date(a.date) - new Date(b.date));

            // Save locally but keep clean state
            saveData();
            localStorage.setItem(DIRTY_KEY, 'false');

            // Update views
            updateDashboard();
            updateHistoryList();
            updateCardioHistoryList();
            updateFoodHistoryList();
            renderPlanTab();
            renderPlanSidebarWidget();

            showToast('☁️ クラウドデータを同期しました');
        }
    })
    .catch(err => {
        console.error("Auto Sync Error:", err);
    });
}

function restoreFromSheets() {
    if (!state.sheetsUrl) {
        showToast('先にGASウェブアプリURLを設定・保存してください');
        return;
    }

    showToast('クラウドからデータ取得中...');

    fetch(state.sheetsUrl, {
        method: 'GET',
        mode: 'cors'
    })
    .then(res => res.json())
    .then(data => {
        if (data && !data.error) {
            data = normalizeImportedData(data);
            const importedWorkouts = data.workouts || [];
            const importedWeights = data.weightLogs || [];
            const importedCardio = data.cardioLogs || [];
            const importedMaint = data.maintenanceCalories || DEFAULT_MAINTENANCE_CALORIES;
            const importedFood = data.foodLogs || [];
            const importedPlan = data.planSettings || null;

            if (!validateWorkoutsSchema(importedWorkouts)) {
                showToast('受信したデータ形式が不正です');
                return;
            }

            showConfirmModal(
                'クラウドからの復元',
                `スプレッドシートからデータを取得しました（ワークアウト: ${importedWorkouts.length}件, 体重ログ: ${importedWeights.length}件）。既存データにマージしますか？`,
                () => {
                    mergeImportedData(importedWorkouts, importedWeights, importedCardio, importedMaint, importedFood, importedPlan);
                    localStorage.setItem(DIRTY_KEY, 'false'); // Mark clean on manual merge override
                }
            );
        } else {
            showToast('復元エラー: ' + (data.error || 'データが空です'));
        }
    })
    .catch(err => {
        console.error('Sheets restore error', err);
        showToast('復元に失敗しました。接続設定を確認してください');
    });
}

// Normalize spreadsheet ISO Dates/Times to fit app format (e.g. YYYY-MM-DD, HH:MM) without offset shifting
function normalizeImportedData(data) {
    if (!data) return data;
    
    // Normalize workouts
    if (Array.isArray(data.workouts)) {
        data.workouts = data.workouts.map(w => {
            if (w) {
                w.id = String(w.id || '');
                w.title = String(w.title || '');
                w.category = String(w.category || '');
                w.mood = String(w.mood || '');
                w.impression = String(w.impression || '');
                w.date = normalizeDate(w.date);
                w.time = normalizeTime(w.time);
                
                if (!Array.isArray(w.exercises)) {
                    w.exercises = [];
                }
            }
            return w;
        });
    }
    
    // Normalize weights
    if (Array.isArray(data.weightLogs)) {
        data.weightLogs = data.weightLogs.map(wl => {
            if (wl) {
                wl.date = normalizeDate(wl.date);
                wl.weight = parseFloat(wl.weight) || 0;
            }
            return wl;
        });
    }
    
    // Normalize cardios
    if (Array.isArray(data.cardioLogs)) {
        data.cardioLogs = data.cardioLogs.map(c => {
            if (c) {
                c.date = normalizeDate(c.date);
                c.distance = parseFloat(c.distance) || 0;
                c.calories = parseFloat(c.calories) || 0;
            }
            return c;
        });
    }
    
    // Normalize maintenance
    if (data.maintenanceCalories) {
        data.maintenanceCalories = parseInt(data.maintenanceCalories) || DEFAULT_MAINTENANCE_CALORIES;
    }
    
    return data;
}

function normalizeDate(dateStr) {
    if (!dateStr) return '';
    const str = String(dateStr);
    if (str.includes('T') || str.includes('/') || str.includes('-')) {
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        }
    }
    return str;
}

function normalizeTime(timeStr) {
    if (!timeStr) return '';
    const str = String(timeStr);
    if (str.includes('T')) {
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            const h = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            return `${h}:${min}`;
        }
    }
    return str;
}

function updateCardioHistoryList() {
    const container = document.getElementById('cardio-history-container');
    const countSpan = document.getElementById('cardio-history-count');
    if (!container || !countSpan) return;
    
    // Sort cardio logs by date descending
    state.cardioLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    countSpan.textContent = state.cardioLogs.length;
    container.innerHTML = '';
    
    if (state.cardioLogs.length === 0) {
        container.innerHTML = `
            <div class="card empty-state">
                <i data-lucide="flame"></i>
                <p>有酸素ランニングの履歴はありません。</p>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }
    
    state.cardioLogs.forEach((c, idx) => {
        const card = document.createElement('div');
        card.classList.add('card');
        card.classList.add('history-card');
        card.classList.add('cardio');
        
        const formattedDate = formatDateJp(c.date);
        
        card.innerHTML = `
            <div class="history-card-header">
                <div class="history-title-area">
                    <div class="history-title-row">
                        <span class="history-mood-badge">🏃</span>
                        <h4>ランニング記録</h4>
                        <span class="category-tag" style="background-color: #86ac41; color: #fff;">有酸素</span>
                    </div>
                    <div class="history-date-row">
                        <i data-lucide="calendar"></i>
                        <span>${formattedDate}</span>
                    </div>
                </div>
                <div class="history-actions">
                    <button class="btn-icon text-danger btn-delete-cardio" data-index="${idx}" title="削除する">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </div>
            
            <div style="margin-top: 1rem; display: flex; gap: 2rem;">
                <div>
                    <span class="text-muted" style="font-size: 0.85rem; display: block;">走行距離</span>
                    <span style="font-weight: 700; font-size: 1.2rem; color: var(--color-primary);">${c.distance.toFixed(2)} <span style="font-size: 0.85rem; font-weight: normal;">km</span></span>
                </div>
                <div>
                    <span class="text-muted" style="font-size: 0.85rem; display: block;">消費エネルギー</span>
                    <span style="font-weight: 700; font-size: 1.2rem; color: #86ac41;">${Math.round(c.calories)} <span style="font-size: 0.85rem; font-weight: normal;">kcal</span></span>
                </div>
            </div>
        `;
        
        card.querySelector('.btn-delete-cardio').addEventListener('click', () => {
            showConfirmModal(
                '記録の削除',
                `このランニング記録（${formattedDate} - ${c.distance}km）を削除しますか？`,
                () => {
                    deleteCardioLog(idx);
                }
            );
        });
        
        container.appendChild(card);
    });
    
    if (window.lucide) {
        lucide.createIcons();
    }
}

function deleteCardioLog(index) {
    if (index >= 0 && index < state.cardioLogs.length) {
        state.cardioLogs.splice(index, 1);
        saveDataAndSync();
        showToast('有酸素記録を削除しました');
        updateDashboard();
        updateCardioHistoryList();
    }
}

function renderPlanTab(isEditing = false) {
    const container = document.getElementById('plan-container');
    if (!container) return;
    
    const s = state.planSettings || DEFAULT_PLAN_SETTINGS;
    
    // Calculations
    const totalDays = (parseInt(s.daysNormal) || 0) + (parseInt(s.daysMilkTea) || 0) + (parseInt(s.daysEvent) || 0);
    const daysDenominator = totalDays > 0 ? totalDays : 7;
    const avgIntake = Math.round(
        ((parseInt(s.intakeNormal) || 0) * (parseInt(s.daysNormal) || 0) +
         (parseInt(s.intakeMilkTea) || 0) * (parseInt(s.daysMilkTea) || 0) +
         (parseInt(s.intakeEvent) || 0) * (parseInt(s.daysEvent) || 0)) / daysDenominator
    );
    const avgExpenditure = Math.round(
        (parseFloat(s.baseBurn) || 0) + ((parseFloat(s.runBurn) || 0) * (parseFloat(s.runCount) || 0)) / 7
    );
    const deficit = avgExpenditure - avgIntake;
    
    if (isEditing) {
        container.innerHTML = `
            <div class="card header-card" style="background: var(--primary-gradient); color: #fff; margin-bottom: 1.5rem;">
                <div class="card-body" style="padding: 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1.5rem;">
                    <div style="display: flex; align-items: center; gap: 1.5rem;">
                        <div style="background: rgba(255,255,255,0.2); padding: 0.75rem; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                            <i data-lucide="target" style="width: 2.25rem; height: 2.25rem;"></i>
                        </div>
                        <div>
                            <h2 style="margin: 0; font-size: 1.5rem; font-weight: 800; color: #fff;">最適化計画の編集</h2>
                            <p style="margin: 0.25rem 0 0; opacity: 0.9; font-size: 0.85rem;">計画パラメーターをカスタマイズします。</p>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-secondary btn-sm" id="btn-cancel-plan-edit" type="button">キャンセル</button>
                        <button class="btn btn-primary btn-sm" id="btn-save-plan-edit" type="button">設定を保存</button>
                    </div>
                </div>
            </div>

            <div class="settings-grid">
                <!-- Calorie Target Edit Card -->
                <div class="card">
                    <div class="card-header">
                        <div class="header-title">
                            <i data-lucide="flame"></i>
                            <h3>摂取・消費カロリー目標の設定</h3>
                        </div>
                    </div>
                    <div class="card-body">
                        <h4 style="margin-bottom: 0.75rem; color: var(--color-primary); font-size: 0.95rem; font-weight: 700;">摂取カロリー目標設定</h4>
                        <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem;">
                            <div style="background: var(--bg-surface-hover); padding: 1rem; border-radius: 10px; border-left: 4px solid var(--text-muted);">
                                <strong style="font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">① 通常日</strong>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                                    <div class="form-group">
                                        <label style="font-size: 0.75rem;">目標カロリー (kcal)</label>
                                        <input type="number" id="edit-intake-normal" value="${s.intakeNormal}" class="width-full">
                                    </div>
                                    <div class="form-group">
                                        <label style="font-size: 0.75rem;">週の日数</label>
                                        <input type="number" id="edit-days-normal" value="${s.daysNormal}" class="width-full">
                                    </div>
                                </div>
                            </div>

                            <div style="background: var(--bg-surface-hover); padding: 1rem; border-radius: 10px; border-left: 4px solid var(--color-secondary);">
                                <strong style="font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">② ミルク紅茶日</strong>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                                    <div class="form-group">
                                        <label style="font-size: 0.75rem;">目標カロリー (kcal)</label>
                                        <input type="number" id="edit-intake-milktea" value="${s.intakeMilkTea}" class="width-full">
                                    </div>
                                    <div class="form-group">
                                        <label style="font-size: 0.75rem;">週の日数</label>
                                        <input type="number" id="edit-days-milktea" value="${s.daysMilkTea}" class="width-full">
                                    </div>
                                </div>
                            </div>

                            <div style="background: var(--bg-surface-hover); padding: 1rem; border-radius: 10px; border-left: 4px solid var(--color-primary);">
                                <strong style="font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">③ イベント日（ラーメン/飲み会）</strong>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                                    <div class="form-group">
                                        <label style="font-size: 0.75rem;">目標カロリー (kcal)</label>
                                        <input type="number" id="edit-intake-event" value="${s.intakeEvent}" class="width-full">
                                    </div>
                                    <div class="form-group">
                                        <label style="font-size: 0.75rem;">週の日数</label>
                                        <input type="number" id="edit-days-event" value="${s.daysEvent}" class="width-full">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <h4 style="margin-bottom: 0.75rem; color: var(--color-secondary); font-size: 0.95rem; font-weight: 700;">消費カロリー目標設定</h4>
                        <div style="background: var(--bg-surface-hover); padding: 1rem; border-radius: 10px; display: flex; flex-direction: column; gap: 0.75rem;">
                            <div class="form-group">
                                <label style="font-size: 0.75rem;">ベース消費 (kcal/日 - 研究室・バイト含む)</label>
                                <input type="number" id="edit-base-burn" value="${s.baseBurn}" class="width-full">
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                                <div class="form-group">
                                    <label style="font-size: 0.75rem;">ラン1回の消費 (kcal)</label>
                                    <input type="number" id="edit-run-burn" value="${s.runBurn}" class="width-full">
                                </div>
                                <div class="form-group">
                                    <label style="font-size: 0.75rem;">週のラン回数</label>
                                    <input type="number" id="edit-run-count" value="${s.runCount}" class="width-full">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Roadmap Edit Card -->
                <div class="card">
                    <div class="card-header">
                        <div class="header-title">
                            <i data-lucide="trending-down"></i>
                            <h3>体重減少ロードマップの設定</h3>
                        </div>
                    </div>
                    <div class="card-body">
                        <p class="settings-desc">ロードマップ上の各目標体重 (kg) を設定します。</p>
                        <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem;">
                            <div class="form-group">
                                <label style="font-size: 0.8rem;">開始時体重 (kg)</label>
                                <input type="number" step="0.1" id="edit-weight-start" value="${s.weightStart}" class="width-full">
                            </div>
                            <div class="form-group">
                                <label style="font-size: 0.8rem;">1ヶ月目目標 (kg)</label>
                                <input type="number" step="0.1" id="edit-weight-1month" value="${s.weight1Month}" class="width-full">
                            </div>
                            <div class="form-group">
                                <label style="font-size: 0.8rem;">3ヶ月目目標 (kg)</label>
                                <input type="number" step="0.1" id="edit-weight-3month" value="${s.weight3Month}" class="width-full">
                            </div>
                            <div class="form-group">
                                <label style="font-size: 0.8rem;">最終均衡点目標 (kg)</label>
                                <input type="number" step="0.1" id="edit-weight-equilibrium" value="${s.weightEquilibrium}" class="width-full">
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Guidelines Edit Card -->
            <div class="card" style="margin-top: 1.5rem;">
                <div class="card-header">
                    <div class="header-title">
                        <i data-lucide="shield-alert"></i>
                        <h3>防衛ラインと習慣ルールの設定</h3>
                    </div>
                </div>
                <div class="card-body" style="display: flex; flex-direction: column; gap: 1rem;">
                    <div class="form-group">
                        <label style="font-weight: 700;">睡眠目標時間 (時間)</label>
                        <input type="number" step="0.1" id="edit-sleep-target" value="${s.sleepTarget}" class="width-full">
                    </div>
                    <div class="form-group">
                        <label style="font-weight: 700;">間食ルール（防衛ライン②）</label>
                        <textarea id="edit-snack-rule" rows="2" class="width-full" style="resize: vertical;">${escapeHtml(s.snackRule)}</textarea>
                    </div>
                    <div class="form-group">
                        <label style="font-weight: 700;">運動・筋トレ方針（防衛ライン③）</label>
                        <textarea id="edit-workout-rule" rows="2" class="width-full" style="resize: vertical;">${escapeHtml(s.workoutRule)}</textarea>
                    </div>
                </div>
            </div>
        `;
        
        // Bind button actions
        document.getElementById('btn-cancel-plan-edit').addEventListener('click', () => {
            renderPlanTab(false);
        });
        document.getElementById('btn-save-plan-edit').addEventListener('click', () => {
            savePlanSettings();
        });
    } else {
        container.innerHTML = `
            <div class="card header-card" style="background: var(--primary-gradient); color: #fff; margin-bottom: 1.5rem;">
                <div class="card-body" style="padding: 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1.5rem;">
                    <div style="display: flex; align-items: center; gap: 1.5rem;">
                        <div style="background: rgba(255,255,255,0.2); padding: 0.75rem; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                            <i data-lucide="target" style="width: 2.25rem; height: 2.25rem;"></i>
                        </div>
                        <div>
                            <h2 style="margin: 0; font-size: 1.5rem; font-weight: 800; color: #fff;">最適化ライフスタイル計画</h2>
                            <p style="margin: 0.25rem 0 0; opacity: 0.9; font-size: 0.85rem;">熱力学モデルと生活スケジュールに基づいた確実な減量ロードマップ</p>
                        </div>
                    </div>
                    <button class="btn btn-primary btn-sm" id="btn-trigger-plan-edit" type="button">
                        <i data-lucide="edit"></i> 計画を編集
                    </button>
                </div>
            </div>

            <div class="settings-grid">
                <!-- Calorie Target Card -->
                <div class="card">
                    <div class="card-header">
                        <div class="header-title">
                            <i data-lucide="flame"></i>
                            <h3>摂取・消費カロリー目標</h3>
                        </div>
                    </div>
                    <div class="card-body">
                        <h4 style="margin-bottom: 0.75rem; color: var(--color-primary); font-size: 0.95rem; font-weight: 700;">摂取カロリー予算（週平均 ${avgIntake} kcal/日）</h4>
                        <div class="plan-sub-items" style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem;">
                            <div style="background: var(--bg-surface-hover); padding: 0.75rem 1rem; border-radius: 10px; border-left: 4px solid var(--text-muted);">
                                <div style="display: flex; justify-content: space-between; font-weight: 700; margin-bottom: 0.25rem; font-size: 0.9rem;">
                                    <span>① 通常日（週${s.daysNormal}回）</span>
                                    <span style="color: var(--color-primary);">${s.intakeNormal} kcal</span>
                                </div>
                                <div style="font-size: 0.8rem; color: var(--text-secondary); display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem;">
                                    <div>朝: 500 kcal</div>
                                    <div>昼: 450 kcal</div>
                                    <div>間食: 0 kcal</div>
                                    <div>夕: 800 kcal</div>
                                </div>
                            </div>
                            <div style="background: var(--bg-surface-hover); padding: 0.75rem 1rem; border-radius: 10px; border-left: 4px solid var(--color-secondary);">
                                <div style="display: flex; justify-content: space-between; font-weight: 700; margin-bottom: 0.25rem; font-size: 0.9rem;">
                                    <span>② ミルク紅茶日（週${s.daysMilkTea}回）</span>
                                    <span style="color: var(--color-primary);">${s.intakeMilkTea} kcal</span>
                                </div>
                                <div style="font-size: 0.8rem; color: var(--text-secondary); display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem;">
                                    <div>朝: 500 kcal</div>
                                    <div>昼: 450 kcal</div>
                                    <div>間食: 216 kcal</div>
                                    <div>夕: 800 kcal</div>
                                </div>
                            </div>
                            <div style="background: var(--bg-surface-hover); padding: 0.75rem 1rem; border-radius: 10px; border-left: 4px solid var(--color-primary);">
                                <div style="display: flex; justify-content: space-between; font-weight: 700; margin-bottom: 0.25rem; font-size: 0.9rem;">
                                    <span>③ イベント日（週${s.daysEvent}回）</span>
                                    <span style="color: var(--color-primary);">${s.intakeEvent} kcal</span>
                                </div>
                                <div style="font-size: 0.8rem; color: var(--text-secondary); display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem;">
                                    <div>朝: 500 kcal</div>
                                    <div>昼: 280 kcal</div>
                                    <div>間食: 0 kcal</div>
                                    <div>夕: 1,770 kcal</div>
                                </div>
                            </div>
                        </div>

                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; gap: 0.75rem; flex-wrap: wrap;">
                            <h4 style="margin: 0; color: var(--color-secondary); font-size: 0.95rem; font-weight: 700;">消費カロリー予算（週平均 ${avgExpenditure} kcal/日）</h4>
                            <button class="btn btn-secondary btn-sm" id="btn-recalc-plan-burn" type="button" title="直近の筋トレ・有酸素の実績からベース消費とラン消費を再計算します">
                                <i data-lucide="refresh-cw"></i> 実績から再計算
                            </button>
                        </div>
                        <div style="background: var(--bg-surface-hover); padding: 0.75rem 1rem; border-radius: 10px; font-size: 0.85rem;">
                            <div style="display: flex; justify-content: space-between; font-weight: 700; margin-bottom: 0.25rem;">
                                <span>ベース消費（研究室・バイト含む）</span>
                                <span>${s.baseBurn} kcal/日</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-weight: 700;">
                                <span>有酸素ラン（週${s.runCount}回 4km走）</span>
                                <span>+${s.runBurn} kcal/回 (平均 +${Math.round(s.runBurn * s.runCount / 7)} kcal/日)</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Roadmap Card -->
                <div class="card">
                    <div class="card-header flex-header">
                        <div class="header-title">
                            <i data-lucide="trending-down"></i>
                            <h3>体重減少目標ロードマップ</h3>
                        </div>
                        <button class="btn btn-secondary btn-sm" id="btn-recalc-plan-roadmap" type="button" title="最新の体重と消費カロリー予算から、開始時・1ヶ月目・3ヶ月目の目標を再計算します">
                            <i data-lucide="refresh-cw"></i> 実績から再計算
                        </button>
                    </div>
                    <div class="card-body">
                        <p class="settings-desc">目標アンダーカロリー（約${deficit} kcal/日）による体重変化シミュレーションです。</p>
                        <div class="roadmap-timeline" style="display: flex; flex-direction: column; gap: 1.25rem; margin-top: 1rem; padding-left: 0.5rem;">
                            <div style="position: relative; padding-left: 1.5rem; border-left: 2px solid var(--border-color);">
                                <div style="position: absolute; left: -6px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: var(--text-muted);"></div>
                                <strong style="font-size: 0.9rem;">開始時</strong>
                                <div style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary); margin-top: 0.15rem;">${s.weightStart} kg</div>
                            </div>
                            <div style="position: relative; padding-left: 1.5rem; border-left: 2px solid var(--color-primary);">
                                <div style="position: absolute; left: -6px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: var(--color-primary);"></div>
                                <strong style="font-size: 0.9rem;">1ヶ月目目標</strong>
                                <div style="font-size: 1.15rem; font-weight: 800; color: var(--color-primary); margin-top: 0.15rem;">${s.weight1Month} kg <span style="font-size: 0.8rem; font-weight: normal; color: var(--text-secondary);">(-${(s.weightStart - s.weight1Month).toFixed(1)}kg)</span></div>
                                <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0.15rem 0 0;">食生活の最適化移行期。水分と糖質が抜ける初期減少フェーズ。</p>
                            </div>
                            <div style="position: relative; padding-left: 1.5rem; border-left: 2px solid var(--color-primary);">
                                <div style="position: absolute; left: -6px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: var(--color-primary);"></div>
                                <strong style="font-size: 0.9rem;">3ヶ月目目標</strong>
                                <div style="font-size: 1.15rem; font-weight: 800; color: var(--color-primary); margin-top: 0.15rem;">${s.weight3Month} kg <span style="font-size: 0.8rem; font-weight: normal; color: var(--text-secondary);">(-${(s.weightStart - s.weight3Month).toFixed(1)}kg)</span></div>
                                <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0.15rem 0 0;">総減量幅 ${(s.weightStart - s.weight3Month).toFixed(1)}kg。膝への衝撃が劇的に減り、体が軽くなることを実感できます。</p>
                            </div>
                            <div style="position: relative; padding-left: 1.5rem; border-left: 2px solid var(--color-secondary);">
                                <div style="position: absolute; left: -6px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: var(--color-secondary);"></div>
                                <strong style="font-size: 0.9rem;">最終均衡点（長期継続時の収束値）</strong>
                                <div style="font-size: 1.15rem; font-weight: 800; color: var(--color-secondary); margin-top: 0.15rem;">${s.weightEquilibrium} kg <span style="font-size: 0.8rem; font-weight: normal; color: var(--text-secondary);">(-${(s.weightStart - s.weightEquilibrium).toFixed(1)}kg)</span></div>
                                <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0.15rem 0 0;">運動・食事の入力と出力が動的平衡状態に達する標準健康体型。</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Guidelines Card -->
            <div class="card" style="margin-top: 1.5rem;">
                <div class="card-header">
                    <div class="header-title">
                        <i data-lucide="shield-alert"></i>
                        <h3>習慣遵守の防衛ライン（致命的コントロールポイント）</h3>
                    </div>
                </div>
                <div class="card-body" style="padding: 1.25rem;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem;">
                        <div style="background: rgba(217, 160, 91, 0.05); border: 1px solid rgba(217, 160, 91, 0.15); padding: 1rem 1.25rem; border-radius: 12px;">
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                <i data-lucide="moon" style="color: var(--color-warning); width: 1.15rem; height: 1.15rem;"></i>
                                <strong style="color: var(--color-warning); font-size: 0.9rem;">① 睡眠時間は最低 ${s.sleepTarget} 時間を死守</strong>
                            </div>
                            <p style="font-size: 0.8rem; line-height: 1.5; color: var(--text-secondary); margin: 0;">寝不足のままトレーニングすると、筋肉が分解され脂肪が蓄積しやすくなります。睡眠を最優先してください。</p>
                        </div>

                        <div style="background: rgba(224, 90, 71, 0.05); border: 1px solid rgba(224, 90, 71, 0.15); padding: 1rem 1.25rem; border-radius: 12px;">
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                <i data-lucide="ban" style="color: var(--color-danger); width: 1.15rem; height: 1.15rem;"></i>
                                <strong style="color: var(--color-danger); font-size: 0.9rem;">② 間食コントロールと大盛り阻止</strong>
                            </div>
                            <p style="font-size: 0.8rem; line-height: 1.5; color: var(--text-secondary); margin: 0;">${escapeHtml(s.snackRule)}</p>
                        </div>

                        <div style="background: rgba(134, 172, 65, 0.05); border: 1px solid rgba(134, 172, 65, 0.15); padding: 1rem 1.25rem; border-radius: 12px;">
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                <i data-lucide="dumbbell" style="color: var(--color-primary); width: 1.15rem; height: 1.15rem;"></i>
                                <strong style="color: var(--color-primary); font-size: 0.9rem;">③ 運動・筋トレ方針</strong>
                            </div>
                            <p style="font-size: 0.8rem; line-height: 1.5; color: var(--text-secondary); margin: 0;">${escapeHtml(s.workoutRule)}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Bind edit button action
        document.getElementById('btn-trigger-plan-edit').addEventListener('click', () => {
            renderPlanTab(true);
        });

        // Bind recalculate-from-actuals buttons
        const recalcBurnBtn = document.getElementById('btn-recalc-plan-burn');
        if (recalcBurnBtn) {
            recalcBurnBtn.addEventListener('click', () => {
                recalculatePlanExpenditure();
            });
        }
        const recalcRoadmapBtn = document.getElementById('btn-recalc-plan-roadmap');
        if (recalcRoadmapBtn) {
            recalcRoadmapBtn.addEventListener('click', () => {
                recalculatePlanRoadmap();
            });
        }
    }
    
    if (window.lucide) {
        lucide.createIcons();
    }
}

function savePlanSettings() {
    const s = state.planSettings || {};
    
    s.intakeNormal = parseInt(document.getElementById('edit-intake-normal').value) || 0;
    s.daysNormal = parseInt(document.getElementById('edit-days-normal').value) || 0;
    s.intakeMilkTea = parseInt(document.getElementById('edit-intake-milktea').value) || 0;
    s.daysMilkTea = parseInt(document.getElementById('edit-days-milktea').value) || 0;
    s.intakeEvent = parseInt(document.getElementById('edit-intake-event').value) || 0;
    s.daysEvent = parseInt(document.getElementById('edit-days-event').value) || 0;
    
    s.baseBurn = parseInt(document.getElementById('edit-base-burn').value) || 0;
    s.runBurn = parseInt(document.getElementById('edit-run-burn').value) || 0;
    s.runCount = parseInt(document.getElementById('edit-run-count').value) || 0;
    
    s.weightStart = parseFloat(document.getElementById('edit-weight-start').value) || 0.0;
    s.weight1Month = parseFloat(document.getElementById('edit-weight-1month').value) || 0.0;
    s.weight3Month = parseFloat(document.getElementById('edit-weight-3month').value) || 0.0;
    s.weightEquilibrium = parseFloat(document.getElementById('edit-weight-equilibrium').value) || 0.0;
    
    s.sleepTarget = parseFloat(document.getElementById('edit-sleep-target').value) || 0.0;
    s.snackRule = document.getElementById('edit-snack-rule').value.trim();
    s.workoutRule = document.getElementById('edit-workout-rule').value.trim();
    
    state.planSettings = s;
    saveData();
    showToast('最適化計画の変更を保存しました');

    renderPlanTab(false);
    renderPlanSidebarWidget();
}

// 実績（体重・筋トレ頻度・有酸素ログ）から消費カロリー予算（ベース消費・ラン消費・週回数）を再計算する
function recalculatePlanExpenditure() {
    const s = state.planSettings || Object.assign({}, DEFAULT_PLAN_SETTINGS);
    const latestWeight = getLatestWeight();

    // 1. ベース消費: メンテナンスカロリー自動計算と同じBMR×活動係数モデル
    //    (直近30日の筋トレ頻度からPALを決定。ランの消費分はここでは含めず、runBurn/runCount側で別途加算する)
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const workoutsLast30Days = state.workouts.filter(w => {
        if (!w.date) return false;
        const wDate = new Date(w.date + 'T00:00:00');
        return wDate >= thirtyDaysAgo && wDate <= today;
    }).length;

    const bmr = 23 * latestWeight;
    let pal = 1.2;
    if (workoutsLast30Days >= 12) pal = 1.725;
    else if (workoutsLast30Days >= 8) pal = 1.55;
    else if (workoutsLast30Days >= 4) pal = 1.375;
    const baseBurn = Math.round(bmr * pal);

    // 2. ラン消費: 直近28日間の有酸素ログから、1回あたり平均消費kcalと週あたり平均回数を算出
    const windowDays = 28;
    const windowStart = new Date();
    windowStart.setDate(today.getDate() - windowDays);
    const recentCardio = state.cardioLogs.filter(c => {
        if (!c.date) return false;
        const cDate = new Date(c.date + 'T00:00:00');
        return cDate >= windowStart && cDate <= today;
    });

    let runBurn = s.runBurn;
    let runCount = s.runCount;
    if (recentCardio.length > 0) {
        const totalCalories = recentCardio.reduce((sum, c) => sum + (c.calories || 0), 0);
        runBurn = Math.round(totalCalories / recentCardio.length);
        runCount = Math.round((recentCardio.length / windowDays) * 7 * 10) / 10;
    }

    s.baseBurn = baseBurn;
    s.runBurn = runBurn;
    s.runCount = runCount;
    state.planSettings = s;
    saveData();

    if (recentCardio.length > 0) {
        showToast(`消費カロリー予算を実績から再計算しました（ベース消費: ${baseBurn}kcal, ラン: ${runBurn}kcal×週${runCount}回）`);
    } else {
        showToast(`ベース消費を実績から再計算しました（${baseBurn}kcal）。直近28日の有酸素記録がないためラン消費は変更していません`);
    }

    renderPlanTab(false);
    renderPlanSidebarWidget();
}

// 実績（最新体重・現在の消費/摂取カロリー予算）から体重ロードマップ（開始時・1ヶ月目・3ヶ月目）を再計算する
// 最終均衡点は長期的な収束目安のため自動計算の対象外とし、手動設定のまま維持する
function recalculatePlanRoadmap() {
    if (!state.weightLogs || state.weightLogs.length === 0) {
        showToast('体重の記録がないため再計算できません。まず「記録する」タブで体重を記録してください');
        return;
    }

    const s = state.planSettings || Object.assign({}, DEFAULT_PLAN_SETTINGS);
    const latestWeight = getLatestWeight();

    // renderPlanTab と同じ式で、現在の計画設定に基づく週平均の摂取・消費カロリーを算出
    const totalDays = (parseInt(s.daysNormal) || 0) + (parseInt(s.daysMilkTea) || 0) + (parseInt(s.daysEvent) || 0);
    const daysDenominator = totalDays > 0 ? totalDays : 7;
    const avgIntake = Math.round(
        ((parseInt(s.intakeNormal) || 0) * (parseInt(s.daysNormal) || 0) +
         (parseInt(s.intakeMilkTea) || 0) * (parseInt(s.daysMilkTea) || 0) +
         (parseInt(s.intakeEvent) || 0) * (parseInt(s.daysEvent) || 0)) / daysDenominator
    );
    const avgExpenditure = Math.round(
        (parseFloat(s.baseBurn) || 0) + ((parseFloat(s.runBurn) || 0) * (parseFloat(s.runCount) || 0)) / 7
    );
    const deficit = avgExpenditure - avgIntake;

    const KCAL_PER_KG = 7700;
    let weight1Month = latestWeight;
    let weight3Month = latestWeight;
    if (deficit > 0) {
        weight1Month = Math.round((latestWeight - (deficit * 30) / KCAL_PER_KG) * 10) / 10;
        weight3Month = Math.round((latestWeight - (deficit * 90) / KCAL_PER_KG) * 10) / 10;
    }

    s.weightStart = latestWeight;
    s.weight1Month = weight1Month;
    s.weight3Month = weight3Month;
    state.planSettings = s;
    saveData();

    if (deficit > 0) {
        showToast(`体重ロードマップを実績から再計算しました（開始時: ${latestWeight.toFixed(1)}kg → 1ヶ月目 ${weight1Month}kg / 3ヶ月目 ${weight3Month}kg）`);
    } else {
        showToast(`開始時体重を${latestWeight.toFixed(1)}kgに更新しました。現在の計画はカロリー収支が赤字でないため、1ヶ月目・3ヶ月目の目標は変更していません`);
    }

    renderPlanTab(false);
    renderPlanSidebarWidget();
}

function renderPlanSidebarWidget() {
    const container = document.getElementById('plan-sidebar-widget-container');
    if (!container) return;
    
    const s = state.planSettings || DEFAULT_PLAN_SETTINGS;
    
    // Calculations
    const totalDays = (parseInt(s.daysNormal) || 0) + (parseInt(s.daysMilkTea) || 0) + (parseInt(s.daysEvent) || 0);
    const daysDenominator = totalDays > 0 ? totalDays : 7;
    const avgIntake = Math.round(
        ((parseInt(s.intakeNormal) || 0) * (parseInt(s.daysNormal) || 0) +
         (parseInt(s.intakeMilkTea) || 0) * (parseInt(s.daysMilkTea) || 0) +
         (parseInt(s.intakeEvent) || 0) * (parseInt(s.daysEvent) || 0)) / daysDenominator
    );
    
    container.innerHTML = `
        <div class="card" style="border: 1px solid var(--color-primary); background: rgba(134,172,65,0.03);">
            <div class="card-header" style="border-bottom: 1px solid var(--border-color); padding: 1rem 1.25rem;">
                <div class="header-title" style="display: flex; align-items: center; gap: 0.5rem;">
                    <i data-lucide="target" style="color: var(--color-primary); width: 1.25rem; height: 1.25rem;"></i>
                    <h3 style="font-size: 1rem; font-weight: 700; margin: 0; color: var(--color-primary);">🎯 最適化計画要約</h3>
                </div>
            </div>
            <div class="card-body" style="padding: 1.25rem; font-size: 0.85rem; display: flex; flex-direction: column; gap: 1rem;">
                <div>
                    <strong style="display: block; margin-bottom: 0.25rem; color: var(--text-primary);">摂取カロリー（平均 ${avgIntake} kcal/日）</strong>
                    <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                        <div style="display: flex; justify-content: space-between;">
                            <span>🌳 通常日 (週${s.daysNormal})</span>
                            <span style="font-weight: 700;">${s.intakeNormal} kcal</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>🍵 紅茶日 (週${s.daysMilkTea})</span>
                            <span style="font-weight: 700;">${s.intakeMilkTea} kcal</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>🍺 イベント日 (週${s.daysEvent})</span>
                            <span style="font-weight: 700;">${s.intakeEvent} kcal</span>
                        </div>
                    </div>
                </div>

                <div style="border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
                    <strong style="display: block; margin-bottom: 0.25rem; color: var(--text-primary);">運動・睡眠予算</strong>
                    <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                        <div style="display: flex; justify-content: space-between;">
                            <span>🏃 有酸素ラン (週${s.runCount}回)</span>
                            <span style="font-weight: 700;">4km / 回 (+${s.runBurn} kcal)</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>🛌 睡眠時間 (目標)</span>
                            <span style="font-weight: 700; color: var(--color-warning);">最低 ${s.sleepTarget} 時間</span>
                        </div>
                    </div>
                </div>

                <div style="border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
                    <strong style="display: block; margin-bottom: 0.25rem; color: var(--text-primary);">体重減少目標</strong>
                    <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                        <div style="display: flex; justify-content: space-between;">
                            <span>1ヶ月目目標</span>
                            <span style="font-weight: 700;">${s.weight1Month} kg</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>3ヶ月目目標</span>
                            <span style="font-weight: 700; color: var(--color-primary);">${s.weight3Month} kg</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>最終均衡点</span>
                            <span style="font-weight: 700; color: var(--color-secondary);">${s.weightEquilibrium} kg</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    if (window.lucide) {
        lucide.createIcons();
    }
}

function updateFoodHistoryList() {
    const container = document.getElementById('food-history-container');
    const countEl = document.getElementById('food-history-count');
    if (!container) return;
    
    container.innerHTML = '';
    const logs = state.foodLogs || [];
    
    if (countEl) countEl.textContent = logs.length;
    
    if (logs.length === 0) {
        container.innerHTML = '<div class="no-data-msg">特別な飲食の記録はありません</div>';
        return;
    }
    
    const sortedLogs = [...logs].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    sortedLogs.forEach((log) => {
        const origIndex = state.foodLogs.findIndex(f => f.date === log.date);
        
        const card = document.createElement('div');
        card.className = 'card history-card';
        card.style.animation = 'slideIn 0.25s ease';
        
        const badgeStyles = {
            milktea: { bg: 'rgba(134,172,65,0.1)', color: 'var(--color-primary)' },
            ramen: { bg: 'rgba(224,90,71,0.1)', color: 'var(--color-danger)' },
            drinking: { bg: 'rgba(217,160,91,0.1)', color: 'var(--color-warning)' }
        };
        const itemsList = [];
        let totalKcal = 0;
        FOOD_ITEMS.forEach(item => {
            if (!log[item.key]) return;
            const cal = log[item.calKey];
            if (typeof cal === 'number' && cal > 0) totalKcal += cal;
            const style = badgeStyles[item.key] || badgeStyles.milktea;
            const kcalText = (typeof cal === 'number' && cal > 0) ? ` (${Math.round(cal)} kcal)` : '';
            itemsList.push(`<span class="badge" style="background: ${style.bg}; color: ${style.color}; border: 1px solid ${style.color}; padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.75rem;">${escapeHtml(item.label)}${kcalText}</span>`);
        });

        const dateObj = new Date(log.date);
        const dayOfWeekStr = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()];

        card.innerHTML = `
            <div class="card-header flex-header" style="padding: 1rem 1.25rem; border-bottom: none;">
                <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-weight: 700; font-size: 1rem;">特別な飲食</span>
                        <span style="font-size: 0.75rem; color: var(--text-muted);">${log.date} (${dayOfWeekStr})</span>
                        ${totalKcal > 0 ? `<span style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary);">合計 ${Math.round(totalKcal)} kcal</span>` : ''}
                    </div>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem;">
                        ${itemsList.join('')}
                    </div>
                </div>
                <button type="button" class="btn-icon text-danger btn-delete-food" title="削除" style="width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(224,90,71,0.05); cursor: pointer; border: none;">
                    <i data-lucide="trash-2" style="width: 1rem; height: 1rem;"></i>
                </button>
            </div>
        `;
        
        card.querySelector('.btn-delete-food').addEventListener('click', () => {
            showConfirmModal(
                '特別な飲食記録の削除',
                `${log.date} の特別な飲食の記録を削除してもよろしいですか？`,
                () => {
                    deleteFoodLog(origIndex);
                }
            );
        });
        
        container.appendChild(card);
    });
    
    if (window.lucide) {
        lucide.createIcons();
    }
}

function deleteFoodLog(index) {
    if (index >= 0 && index < state.foodLogs.length) {
        state.foodLogs.splice(index, 1);
        saveDataAndSync();
        showToast('特別な飲食の記録を削除しました');
        updateDashboard();
        updateFoodHistoryList();
    }
}
