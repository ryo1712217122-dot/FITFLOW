// FITFLOW - Workout Tracker JS Logic

// ==========================================
// CONFIGURATION & CONSTANTS
// ==========================================
const DEFAULT_MAINTENANCE_CALORIES = 2000;
const DEFAULT_WEIGHT_KG = 70.0;
const TARGET_MONTHLY_WORKOUTS = 12;
const MAX_RECENT_WEIGHT_LOGS = 10;
const CARDIO_DAYS_WINDOW = 7;

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
    charts: {
        category: null,
        progression: null,
        weight: null,
        calorieComparison: null
    }
};

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
    workoutTitle: document.getElementById('workout-title'),
    workoutCategory: document.getElementById('workout-category'),
    workoutImpression: document.getElementById('workout-impression'),
    exerciseList: document.getElementById('exercise-list'),
    addExerciseBtn: document.getElementById('add-exercise-btn'),
    noExercisesHelper: document.getElementById('no-exercises-helper'),
    saveWorkoutBtn: document.getElementById('save-workout-btn'),
    
    // Dashboard mini forms
    weightForm: document.getElementById('weight-form'),
    logWeightVal: document.getElementById('log-weight-val'),
    cardioForm: document.getElementById('cardio-form'),
    logCardioDate: document.getElementById('log-cardio-date'),
    logCardioDist: document.getElementById('log-cardio-dist'),
    cardioCalcHint: document.getElementById('cardio-calc-hint'),
    todayBurnedKcal: document.getElementById('today-burned-kcal'),
    currentMaintenanceKcal: document.getElementById('current-maintenance-kcal'),

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
        state.workouts = getMockWorkouts();
    }
    
    // Ensure all mock workouts have a time property if they don't
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
        state.weightLogs = getMockWeightLogs();
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
        state.cardioLogs = getMockCardioLogs();
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
    state.sheetsUrl = localStorage.getItem('fitflow_sheets_url') || '';
    
    saveData();
}

function saveData() {
    localStorage.setItem('fitflow_workouts', JSON.stringify(state.workouts));
    localStorage.setItem('fitflow_weight_logs', JSON.stringify(state.weightLogs));
    localStorage.setItem('fitflow_cardio_logs', JSON.stringify(state.cardioLogs));
    localStorage.setItem('fitflow_maintenance', state.maintenanceCalories.toString());
    localStorage.setItem('fitflow_sheets_url', state.sheetsUrl);
}

function getMockWeightLogs() {
    const list = [];
    const today = new Date();
    const daysAgo = (num) => {
        const d = new Date();
        d.setDate(today.getDate() - num);
        return getLocalDateString(d);
    };
    
    list.push({ date: daysAgo(6), weight: 73.2 });
    list.push({ date: daysAgo(4), weight: 72.8 });
    list.push({ date: daysAgo(2), weight: 72.5 });
    list.push({ date: daysAgo(0), weight: 72.4 });
    return list;
}

function getMockCardioLogs() {
    const list = [];
    const today = new Date();
    const daysAgo = (num) => {
        const d = new Date();
        d.setDate(today.getDate() - num);
        return getLocalDateString(d);
    };
    
    list.push({ date: daysAgo(5), distance: 4.5, calories: 326 });
    list.push({ date: daysAgo(3), distance: 6.0, calories: 436 });
    list.push({ date: daysAgo(0), distance: 5.0, calories: 362 });
    return list;
}

// Generate structured mock data for demo
function getMockWorkouts() {
    const list = [];
    const today = new Date();
    const daysAgo = (num) => {
        const d = new Date();
        d.setDate(today.getDate() - num);
        return getLocalDateString(d);
    };
    
    list.push({
        id: 'mock-1',
        date: daysAgo(0),
        time: '19:30',
        title: '胸と三頭筋の日',
        category: '胸 (Chest)',
        mood: 'fire',
        impression: 'ベンチプレス80kgで10レップ成功！調子がとても良かったです。最後はダンベルフライで追い込めました。',
        exercises: [
            {
                name: 'ベンチプレス',
                sets: [
                    { weight: 60, reps: 10 },
                    { weight: 70, reps: 8 },
                    { weight: 80, reps: 10 }
                ]
            },
            {
                name: 'インクラインダンベルプレス',
                sets: [
                    { weight: 24, reps: 12 },
                    { weight: 24, reps: 10 }
                ]
            }
        ]
    });
    
    list.push({
        id: 'mock-2',
        date: daysAgo(2),
        time: '18:15',
        title: '背中と二頭筋の日',
        category: '背中 (Back)',
        mood: 'strong',
        impression: 'デッドリフトを安全に120kg引けました。ラットプルダウンは広背筋を意識。',
        exercises: [
            {
                name: 'デッドリフト',
                sets: [
                    { weight: 100, reps: 8 },
                    { weight: 120, reps: 6 }
                ]
            },
            {
                name: 'ラットプルダウン',
                sets: [
                    { weight: 50, reps: 12 },
                    { weight: 57, reps: 10 }
                ]
            }
        ]
    });

    list.push({
        id: 'mock-3',
        date: daysAgo(4),
        time: '20:00',
        title: '肩と脚の日',
        category: '肩 (Shoulders)',
        mood: 'good',
        impression: 'ショルダープレスをメインに実施。脚はスクワットで下半身を強化。',
        exercises: [
            {
                name: 'ショルダープレス',
                sets: [
                    { weight: 20, reps: 12 },
                    { weight: 22, reps: 10 }
                ]
            },
            {
                name: 'バーベルスクワット',
                sets: [
                    { weight: 80, reps: 10 },
                    { weight: 90, reps: 8 }
                ]
            }
        ]
    });

    return list;
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
            if (tabId === 'dashboard') {
                updateDashboard();
            } else if (tabId === 'history') {
                updateHistoryList();
            } else if (tabId === 'log-workout') {
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
    
    const handleThemeToggle = () => {
        document.body.classList.toggle('light-theme');
        const theme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
        localStorage.setItem('fitflow_theme', theme);
        
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
        DOM.greetingText.textContent = greeting;
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

    if (DOM.weightForm) {
        DOM.weightForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveWeight();
        });
    }

    if (DOM.logCardioDist) {
        DOM.logCardioDist.addEventListener('input', updateCardioHint);
    }

    if (DOM.cardioForm) {
        DOM.cardioForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveCardio();
        });
        
        if (DOM.logCardioDate) {
            DOM.logCardioDate.value = getLocalDateString();
        }
    }
}

function resetWorkoutForm() {
    state.editingWorkoutId = null;
    if (DOM.workoutForm) DOM.workoutForm.reset();
    
    const now = new Date();
    if (DOM.workoutDate) DOM.workoutDate.value = getLocalDateString(now);
    
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    if (DOM.workoutTime) DOM.workoutTime.value = `${hours}:${minutes}`;
    
    if (DOM.exerciseList) DOM.exerciseList.innerHTML = '';
    if (DOM.noExercisesHelper) DOM.noExercisesHelper.style.display = 'flex';
    if (DOM.saveWorkoutBtn) DOM.saveWorkoutBtn.innerHTML = '<i data-lucide="check"></i> 記録を保存する';
    
    const titleHeader = DOM.workoutForm ? DOM.workoutForm.querySelector('.form-header-row h2') : null;
    if (titleHeader) titleHeader.textContent = '新規ワークアウトの記録';
    
    addExerciseBlock();
    
    if (window.lucide) {
        lucide.createIcons();
    }
}

function addExerciseBlock(data = null) {
    if (!DOM.exerciseList || !DOM.noExercisesHelper) return;
    DOM.noExercisesHelper.style.display = 'none';
    
    const exerciseIndex = DOM.exerciseList.children.length;
    const exerciseBlock = document.createElement('div');
    exerciseBlock.classList.add('exercise-item');
    exerciseBlock.setAttribute('data-index', exerciseIndex);
    
    exerciseBlock.innerHTML = `
        <div class="exercise-item-header">
            <div class="exercise-name-input-wrapper">
                <input type="text" class="exercise-name" placeholder="種目名 (例: ベンチプレス)" required list="popular-exercises" value="${data ? data.name : ''}">
                <datalist id="popular-exercises">
                    <option value="ベンチプレス">
                    <option value="ダンベルフライ">
                    <option value="インクラインダンベルプレス">
                    <option value="ラットプルダウン">
                    <option value="懸垂 (チンニング)">
                    <option value="デッドリフト">
                    <option value="スクワット">
                    <option value="レッグプレス">
                    <option value="ショルダープレス">
                    <option value="サイドレイズ">
                    <option value="クランチ">
                    <option value="プランク">
                </datalist>
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
    
    addSetBtn.addEventListener('click', () => {
        addSetRow(tbody);
    });
    
    removeExBtn.addEventListener('click', () => {
        exerciseBlock.style.animation = 'slideIn 0.2s ease reverse';
        setTimeout(() => {
            exerciseBlock.remove();
            Array.from(DOM.exerciseList.children).forEach((child, idx) => {
                child.setAttribute('data-index', idx);
            });
            if (DOM.exerciseList.children.length === 0) {
                DOM.noExercisesHelper.style.display = 'flex';
            }
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
    const title = DOM.workoutTitle.value.trim();
    const category = DOM.workoutCategory.value;
    const mood = DOM.workoutForm.querySelector('input[name="workout-mood"]:checked').value;
    const impression = DOM.workoutImpression.value.trim();
    
    const exerciseItems = DOM.exerciseList.querySelectorAll('.exercise-item');
    if (exerciseItems.length === 0) {
        showToast('種目を1つ以上追加してください');
        return;
    }
    
    const exercises = [];
    let hasValidationError = false;
    
    exerciseItems.forEach(item => {
        const name = item.querySelector('.exercise-name').value.trim();
        if (!name) {
            hasValidationError = true;
            return;
        }
        
        const setRows = item.querySelectorAll('.set-row');
        const sets = [];
        
        setRows.forEach(row => {
            const weightVal = row.querySelector('.set-weight').value;
            const repsVal = row.querySelector('.set-reps').value;
            const weight = parseFloat(weightVal);
            const reps = parseInt(repsVal);
            
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
        showToast('入力内容を確認してください（すべての項目に値を入力）');
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
            showToast('ワークアウト記録を更新しました！');
        }
    } else {
        state.workouts.unshift(workoutData);
        showToast('ワークアウト記録を保存しました！');
    }
    
    saveData();
    state.editingWorkoutId = null;
    
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
                    <div class="history-exercise-name">${ex.name}</div>
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
                    <h4>${workout.title}</h4>
                    <span class="category-tag">${workout.category}</span>
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
        
        ${workout.impression ? `<div class="history-impression">${workout.impression.replace(/\n/g, '<br>')}</div>` : ''}
        
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
    
    const formNavItem = document.querySelector('[data-tab="log-workout"]');
    if (formNavItem) formNavItem.click();
    
    if (DOM.workoutForm) {
        DOM.workoutForm.querySelector('.form-header-row h2').textContent = 'ワークアウト記録の編集';
    }
    if (DOM.saveWorkoutBtn) {
        DOM.saveWorkoutBtn.innerHTML = '<i data-lucide="save"></i> 編集を保存する';
    }
    
    if (DOM.workoutDate) DOM.workoutDate.value = workout.date;
    if (DOM.workoutTime) DOM.workoutTime.value = workout.time || '12:00';
    if (DOM.workoutTitle) DOM.workoutTitle.value = workout.title || '';
    if (DOM.workoutCategory) DOM.workoutCategory.value = workout.category;
    if (DOM.workoutImpression) DOM.workoutImpression.value = workout.impression || '';
    
    const moodRadio = DOM.workoutForm ? DOM.workoutForm.querySelector(`input[name="workout-mood"][value="${workout.mood}"]`) : null;
    if (moodRadio) moodRadio.checked = true;
    
    if (DOM.exerciseList) {
        DOM.exerciseList.innerHTML = '';
        DOM.noExercisesHelper.style.display = 'none';
        
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
        saveData();
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
    
    state.charts.progression = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                {
                    label: '推定 1RM (MAX)',
                    data: est1RMs,
                    borderColor: '#86ac41',
                    backgroundColor: 'rgba(134, 172, 65, 0.1)',
                    borderWidth: 2.5,
                    tension: 0.25,
                    fill: true,
                    pointBackgroundColor: '#86ac41',
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: '最大重量',
                    data: maxWeights,
                    borderColor: '#7da3a1',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [3, 3],
                    tension: 0.25,
                    fill: false,
                    pointBackgroundColor: '#7da3a1',
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
            saveData();
            showToast('メンテナンスカロリーを保存しました！');
            updateDashboard();
        });
    }

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
                '本当にすべてのワークアウトデータを削除しますか？この操作を実行すると、元に戻すことはできません。',
                () => {
                    clearAllWorkouts();
                }
            );
        });
    }
}

function exportWorkouts() {
    const backupData = {
        version: '1.2.0',
        workouts: state.workouts,
        weightLogs: state.weightLogs,
        cardioLogs: state.cardioLogs,
        maintenanceCalories: state.maintenanceCalories
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
            
            if (Array.isArray(parsed)) {
                // Legacy workouts backup format
                importedWorkouts = parsed;
            } else if (parsed && typeof parsed === 'object') {
                // Full state backup format
                importedWorkouts = parsed.workouts || [];
                importedWeights = parsed.weightLogs || [];
                importedCardio = parsed.cardioLogs || [];
                importedMaint = parsed.maintenanceCalories || DEFAULT_MAINTENANCE_CALORIES;
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
                    mergeImportedData(importedWorkouts, importedWeights, importedCardio, importedMaint);
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

function mergeImportedData(workouts, weights, cardio, maintenance) {
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
    
    saveData();
    showToast('バックアップデータをマージ・復元しました！');
    
    updateDashboard();
    updateHistoryList();
}

function clearAllWorkouts() {
    state.workouts = [];
    state.weightLogs = [];
    state.cardioLogs = [];
    state.maintenanceCalories = DEFAULT_MAINTENANCE_CALORIES;
    saveData();
    showToast('すべてのデータを初期化しました。');
    
    updateDashboard();
    updateHistoryList();
}

// ==========================================
// WEIGHT & CARDIO & CALORIE LOGGING LOGIC
// ==========================================

function saveWeight() {
    if (!DOM.logWeightVal) return;
    const weight = parseFloat(DOM.logWeightVal.value);
    if (isNaN(weight) || weight <= 0) {
        showToast('有効な体重を入力してください');
        return;
    }
    
    const date = getLocalDateString();
    
    const existingIndex = state.weightLogs.findIndex(w => w.date === date);
    if (existingIndex !== -1) {
        state.weightLogs[existingIndex].weight = weight;
    } else {
        state.weightLogs.push({ date, weight });
    }
    
    state.weightLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    saveData();
    DOM.logWeightVal.value = '';
    showToast('体重を記録しました！');
    updateDashboard();
}

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

function saveCardio() {
    if (!DOM.logCardioDist || !DOM.logCardioDate) return;
    const dist = parseFloat(DOM.logCardioDist.value);
    const dateStr = DOM.logCardioDate.value;
    
    if (isNaN(dist) || dist <= 0) {
        showToast('有効な走行距離を入力してください');
        return;
    }
    if (!dateStr) {
        showToast('日付を入力してください');
        return;
    }
    
    const latestWeight = getLatestWeight();
    const calories = Math.round(dist * latestWeight);
    
    state.cardioLogs.push({
        date: dateStr,
        distance: dist,
        calories: calories
    });
    
    state.cardioLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    saveData();
    
    DOM.logCardioDist.value = '';
    DOM.logCardioDate.value = getLocalDateString();
    updateCardioHint();
    
    showToast('ランニング距離を記録しました！');
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
                borderColor: '#86ac41',
                backgroundColor: 'rgba(134, 172, 65, 0.1)',
                borderWidth: 2.5,
                tension: 0.3,
                fill: true,
                pointBackgroundColor: '#86ac41',
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
                    backgroundColor: '#86ac41',
                    borderRadius: 4,
                    barThickness: 16
                },
                {
                    label: 'メンテナンス',
                    data: maintenanceLimit,
                    type: 'line',
                    borderColor: '#7da3a1',
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
    if (!state.sheetsUrl) {
        showToast('先にGASウェブアプリURLを設定・保存してください');
        return;
    }

    showToast('クラウドに同期中...');

    const payload = {
        action: 'backup',
        workouts: state.workouts,
        weightLogs: state.weightLogs,
        cardioLogs: state.cardioLogs,
        maintenanceCalories: state.maintenanceCalories
    };

    fetch(state.sheetsUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
            'Content-Type': 'text/plain'
        },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        if (data && data.success) {
            showToast('スプレッドシートへの同期が成功しました！');
        } else {
            showToast('同期エラー: ' + (data.error || '不明なエラー'));
        }
    })
    .catch(err => {
        console.error('Sheets backup error', err);
        showToast('同期に失敗しました。接続設定を確認してください');
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
            const importedWorkouts = data.workouts || [];
            const importedWeights = data.weightLogs || [];
            const importedCardio = data.cardioLogs || [];
            const importedMaint = data.maintenanceCalories || DEFAULT_MAINTENANCE_CALORIES;

            if (!validateWorkoutsSchema(importedWorkouts)) {
                showToast('受信したデータ形式が不正です');
                return;
            }

            showConfirmModal(
                'クラウドからの復元',
                `スプレッドシートからデータを取得しました（ワークアウト: ${importedWorkouts.length}件, 体重ログ: ${importedWeights.length}件）。既存データにマージしますか？`,
                () => {
                    mergeImportedData(importedWorkouts, importedWeights, importedCardio, importedMaint);
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
