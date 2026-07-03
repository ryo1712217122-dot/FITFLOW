// FITFLOW - Workout Tracker JS Logic

// Global state
let state = {
    workouts: [],
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth(), // 0-indexed
    editingWorkoutId: null,
    charts: {
        category: null,
        frequency: null,
        progression: null
    }
};

// DOM elements
const DOM = {
    navItems: document.querySelectorAll('.nav-item'),
    tabContents: document.querySelectorAll('.tab-content'),
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    greetingText: document.getElementById('greeting-text'),
    dateText: document.getElementById('date-text'),
    streakCount: document.getElementById('streak-count'),
    
    // Dashboard
    totalWorkoutsNum: document.getElementById('total-workouts-num'),
    monthWorkoutsNum: document.getElementById('month-workouts-num'),
    monthWorkoutsPct: document.getElementById('month-workouts-pct'),
    totalVolumeNum: document.getElementById('total-volume-num'),
    calendarMonthYear: document.getElementById('calendar-month-year'),
    calendarDays: document.getElementById('calendar-days'),
    prevMonthBtn: document.getElementById('prev-month-btn'),
    nextMonthBtn: document.getElementById('next-month-btn'),
    noCategoryData: document.getElementById('no-category-data'),
    noFrequencyData: document.getElementById('no-frequency-data'),
    
    // Log Workout Form
    workoutForm: document.getElementById('workout-form'),
    workoutDate: document.getElementById('workout-date'),
    workoutTitle: document.getElementById('workout-title'),
    workoutCategory: document.getElementById('workout-category'),
    workoutImpression: document.getElementById('workout-impression'),
    exerciseList: document.getElementById('exercise-list'),
    addExerciseBtn: document.getElementById('add-exercise-btn'),
    noExercisesHelper: document.getElementById('no-exercises-helper'),
    saveWorkoutBtn: document.getElementById('save-workout-btn'),
    
    // History
    searchInput: document.getElementById('search-input'),
    filterCategory: document.getElementById('filter-category'),
    filterMood: document.getElementById('filter-mood'),
    progressionSelect: document.getElementById('progression-exercise-select'),
    noProgressionData: document.getElementById('no-progression-data'),
    historyCount: document.getElementById('history-count'),
    historyContainer: document.getElementById('history-container'),
    
    // Settings
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
    lucide.createIcons();
});

// ==========================================
// DATA MANAGEMENT (LocalStorage)
// ==========================================

function loadData() {
    const data = localStorage.getItem('fitflow_workouts');
    if (data) {
        try {
            state.workouts = JSON.parse(data);
        } catch (e) {
            console.error('Error parsing workouts data', e);
            state.workouts = [];
        }
    } else {
        // Load default mock data for visualization if empty, so the user gets a feel of a premium app
        state.workouts = getMockWorkouts();
        saveData();
    }
}

function saveData() {
    localStorage.setItem('fitflow_workouts', JSON.stringify(state.workouts));
}

// Generate high quality mock data for demo
function getMockWorkouts() {
    const list = [];
    const today = new Date();
    
    // Helper to get formatted date string relative to today
    const daysAgo = (num) => {
        const d = new Date();
        d.setDate(today.getDate() - num);
        return d.toISOString().split('T')[0];
    };
    
    list.push({
        id: 'mock-1',
        date: daysAgo(0),
        title: '胸と三頭筋の日',
        category: '胸 (Chest)',
        mood: 'fire',
        impression: 'ベンチプレス80kgで10レップ成功！調子がとても良かったです。最後はダンベルフライでしっかり追い込めました。',
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
            },
            {
                name: 'スカルクラッシャー',
                sets: [
                    { weight: 30, reps: 12 },
                    { weight: 30, reps: 10 }
                ]
            }
        ]
    });
    
    list.push({
        id: 'mock-2',
        date: daysAgo(2),
        title: '背中と二頭筋の日',
        category: '背中 (Back)',
        mood: 'strong',
        impression: 'デッドリフトを久々に実施。腰のフォームを意識して、安全に120kgを引けました。ラットプルダウンは背中の広がりを意識。',
        exercises: [
            {
                name: 'デッドリフト',
                sets: [
                    { weight: 100, reps: 8 },
                    { weight: 120, reps: 6 },
                    { weight: 120, reps: 5 }
                ]
            },
            {
                name: 'ラットプルダウン',
                sets: [
                    { weight: 50, reps: 12 },
                    { weight: 57, reps: 10 },
                    { weight: 57, reps: 8 }
                ]
            },
            {
                name: 'インクラインダンベルカール',
                sets: [
                    { weight: 12, reps: 12 },
                    { weight: 12, reps: 12 }
                ]
            }
        ]
    });

    list.push({
        id: 'mock-3',
        date: daysAgo(4),
        title: '脚トレの日',
        category: '脚 (Legs)',
        mood: 'tired',
        impression: 'スクワットがきつすぎた。足がガクガクで、レッグプレスは少し重量を落として回数を多めに設定した。やりきった自分を褒めたい。',
        exercises: [
            {
                name: 'バックスクワット',
                sets: [
                    { weight: 80, reps: 8 },
                    { weight: 90, reps: 8 },
                    { weight: 90, reps: 6 }
                ]
            },
            {
                name: 'レッグプレス',
                sets: [
                    { weight: 120, reps: 15 },
                    { weight: 120, reps: 12 }
                ]
            }
        ]
    });

    list.push({
        id: 'mock-4',
        date: daysAgo(8),
        title: '肩と腹筋の日',
        category: '肩 (Shoulders)',
        mood: 'good',
        impression: 'ショルダープレスをメインに実施。サイドレイズはドロップセットで限界まで。腹筋もしっかり刺激できた。',
        exercises: [
            {
                name: 'ダンベルショルダープレス',
                sets: [
                    { weight: 18, reps: 10 },
                    { weight: 20, reps: 8 },
                    { weight: 20, reps: 8 }
                ]
            },
            {
                name: 'サイドレイズ',
                sets: [
                    { weight: 8, reps: 15 },
                    { weight: 8, reps: 15 },
                    { weight: 6, reps: 20 }
                ]
            },
            {
                name: 'ハンギングレッグレイズ',
                sets: [
                    { weight: 0, reps: 15 },
                    { weight: 0, reps: 12 }
                ]
            }
        ]
    });

    list.push({
        id: 'mock-5',
        date: daysAgo(10),
        title: 'ベンチプレス強化デー',
        category: '胸 (Chest)',
        mood: 'fire',
        impression: '今日は調子が良かった。ベンチプレス80kgで10回行けたので、次回は82.5kgに挑戦する！',
        exercises: [
            {
                name: 'ベンチプレス',
                sets: [
                    { weight: 60, reps: 10 },
                    { weight: 70, reps: 8 },
                    { weight: 80, reps: 8 }
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
                // If not editing, set date to today and build 1 empty exercise
                if (!state.editingWorkoutId) {
                    resetWorkoutForm();
                }
            }
            
            // Smooth scroll to top on tab change
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}

function initTheme() {
    // Check local storage or system preference
    const savedTheme = localStorage.getItem('fitflow_theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
    }
    
    DOM.themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        const theme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
        localStorage.setItem('fitflow_theme', theme);
        
        // Re-render charts to adjust text color for theme
        if (state.charts.category) renderCategoryChart();
        if (state.charts.frequency) renderFrequencyChart();
        if (state.charts.progression) renderProgressionChart();
    });
}

function initDateTexts() {
    const today = new Date();
    const optDate = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    DOM.dateText.textContent = today.toLocaleDateString('ja-JP', optDate);
    
    // Dynamic greeting based on time of day
    const hours = today.getHours();
    let greeting = 'こんにちは！';
    if (hours < 5) greeting = '夜更かしトレーニングですか？💪';
    else if (hours < 11) greeting = 'おはようございます！今日も良い一日にしましょう☀️';
    else if (hours < 18) greeting = 'こんにちは！トレーニング日和ですね🔥';
    else greeting = 'こんばんは！今日もお疲れ様です🌙';
    DOM.greetingText.textContent = greeting;
}

// ==========================================
// NOTIFICATIONS & MODALS
// ==========================================

function showToast(message) {
    DOM.toast.querySelector('.toast-message').textContent = message;
    DOM.toast.classList.remove('hidden');
    
    setTimeout(() => {
        DOM.toast.classList.add('hidden');
    }, 3000);
}

function showConfirmModal(title, message, onConfirm) {
    DOM.modalTitle.textContent = title;
    DOM.modalMessage.textContent = message;
    DOM.confirmModal.classList.remove('hidden');
    
    // Clear handlers
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
    // 1. Stats calculation
    const total = state.workouts.length;
    DOM.totalWorkoutsNum.textContent = total;
    
    // Streaks
    const streak = calculateStreak(state.workouts);
    DOM.streakCount.textContent = `${streak} 日`;
    
    // Current Month workouts
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    const monthWorkouts = state.workouts.filter(w => {
        const d = new Date(w.date);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    }).length;
    
    DOM.monthWorkoutsNum.textContent = monthWorkouts;
    // Goal: 10 workouts per month
    const target = 12;
    const pct = Math.min(Math.round((monthWorkouts / target) * 100), 100);
    DOM.monthWorkoutsPct.textContent = `今月の目標(${target}回)の ${pct}%`;
    
    // Total lifting volume
    let totalVolume = 0;
    state.workouts.forEach(w => {
        w.exercises.forEach(ex => {
            ex.sets.forEach(s => {
                const w = parseFloat(s.weight) || 0;
                const r = parseInt(s.reps) || 0;
                totalVolume += w * r;
            });
        });
    });
    
    DOM.totalVolumeNum.innerHTML = `${totalVolume.toLocaleString()} <span class="unit">kg</span>`;
    
    // 2. Calendar Heatmap
    renderCalendar();
    
    // 3. Charts
    renderCategoryChart();
    renderFrequencyChart();
}

function calculateStreak(workouts) {
    if (workouts.length === 0) return 0;
    
    // Get list of unique date strings, sorted descending
    const dates = workouts.map(w => w.date);
    const uniqueDates = [...new Set(dates)].sort((a, b) => new Date(b) - new Date(a));
    
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    // Check if user has a workout today or yesterday
    if (uniqueDates[0] !== todayStr && uniqueDates[0] !== yesterdayStr) {
        return 0;
    }
    
    let streak = 1;
    let currentDate = new Date(uniqueDates[0]);
    
    for (let i = 1; i < uniqueDates.length; i++) {
        const prevDate = new Date(uniqueDates[i]);
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
    DOM.prevMonthBtn.addEventListener('click', () => {
        state.currentMonth--;
        if (state.currentMonth < 0) {
            state.currentMonth = 11;
            state.currentYear--;
        }
        renderCalendar();
    });
    
    DOM.nextMonthBtn.addEventListener('click', () => {
        state.currentMonth++;
        if (state.currentMonth > 11) {
            state.currentMonth = 0;
            state.currentYear++;
        }
        renderCalendar();
    });
}

function renderCalendar() {
    const year = state.currentYear;
    const month = state.currentMonth;
    
    // Set Header
    const monthsJapanese = [
        '1月', '2月', '3月', '4月', '5月', '6月', 
        '7月', '8月', '9月', '10月', '11月', '12月'
    ];
    DOM.calendarMonthYear.textContent = `${year}年 ${monthsJapanese[month]}`;
    
    DOM.calendarDays.innerHTML = '';
    
    // First day of month
    const firstDay = new Date(year, month, 1).getDay();
    // Total days in month
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    // Empty cells for padding before the first day
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.classList.add('calendar-day', 'empty');
        DOM.calendarDays.appendChild(emptyCell);
    }
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Map workout dates for quick lookups
    const workoutDates = {};
    state.workouts.forEach(w => {
        workoutDates[w.date] = (workoutDates[w.date] || 0) + 1;
    });
    
    // Render actual days
    for (let day = 1; day <= totalDays; day++) {
        const dayCell = document.createElement('div');
        dayCell.classList.add('calendar-day');
        dayCell.textContent = day;
        
        // Format current day to ISO date string
        const currentMonthPadded = String(month + 1).padStart(2, '0');
        const currentDayPadded = String(day).padStart(2, '0');
        const dateStr = `${year}-${currentMonthPadded}-${currentDayPadded}`;
        
        // Match conditions
        if (dateStr === todayStr) {
            dayCell.classList.add('today');
        }
        
        if (workoutDates[dateStr]) {
            dayCell.classList.add('workout-done');
            
            // Add a little dot in case they want a visual indicator
            const dot = document.createElement('span');
            dot.classList.add('workout-dot-indicator');
            dayCell.appendChild(dot);
            
            // Show workout summary on hover
            const dayWorkouts = state.workouts.filter(w => w.date === dateStr);
            const titles = dayWorkouts.map(w => w.title).join(', ');
            dayCell.setAttribute('title', `${titles} (${dayWorkouts.length}件)`);
            
            // Click calendar day to go to history and search that date!
            dayCell.addEventListener('click', () => {
                DOM.searchInput.value = dateStr;
                // Navigate to History Tab
                const historyNavItem = document.querySelector('[data-tab="history"]');
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
        text: isLight ? '#475569' : '#94a3b8',
        grid: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)',
        border: isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)'
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
        DOM.noCategoryData.style.display = 'block';
        if (state.charts.category) {
            state.charts.category.destroy();
            state.charts.category = null;
        }
        return;
    }
    
    DOM.noCategoryData.style.display = 'none';
    
    const ctx = document.getElementById('categoryChart').getContext('2d');
    
    if (state.charts.category) {
        state.charts.category.destroy();
    }
    
    // Beautiful color mapping matching our workout category colors
    const colorsMap = {
        '胸 (Chest)': '#f87171',
        '背中 (Back)': '#60a5fa',
        '肩 (Shoulders)': '#fbbf24',
        '腕 (Arms)': '#a78bfa',
        '脚 (Legs)': '#34d399',
        '腹筋 (Core)': '#22d3ee',
        '有酸素 (Cardio)': '#ec4899',
        'その他 (Other)': '#94a3b8'
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
                borderColor: document.body.classList.contains('light-theme') ? '#ffffff' : '#121826'
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
                        font: {
                            family: 'Inter',
                            size: 11
                        },
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

// Bar Chart - Training Frequency (workouts per week for past 6 weeks)
function renderFrequencyChart() {
    const theme = getChartThemeColors();
    
    // Generate past 6 weeks dates ranges
    const weeksData = [];
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1) - (i * 7));
        startOfWeek.setHours(0, 0, 0, 0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        
        weeksData.push({
            start: startOfWeek,
            end: endOfWeek,
            label: `${startOfWeek.getMonth()+1}/${startOfWeek.getDate()}~`,
            count: 0
        });
    }
    
    // Distribute workouts count
    state.workouts.forEach(w => {
        const wDate = new Date(w.date);
        for (let week of weeksData) {
            if (wDate >= week.start && wDate <= week.end) {
                week.count++;
                break;
            }
        }
    });
    
    const labels = weeksData.map(w => w.label);
    const counts = weeksData.map(w => w.count);
    
    if (state.workouts.length === 0) {
        DOM.noFrequencyData.style.display = 'block';
        if (state.charts.frequency) {
            state.charts.frequency.destroy();
            state.charts.frequency = null;
        }
        return;
    }
    
    DOM.noFrequencyData.style.display = 'none';
    
    const ctx = document.getElementById('frequencyChart').getContext('2d');
    
    if (state.charts.frequency) {
        state.charts.frequency.destroy();
    }
    
    state.charts.frequency = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'ワークアウト回数',
                data: counts,
                backgroundColor: 'rgba(139, 92, 246, 0.75)',
                borderColor: '#8b5cf6',
                borderWidth: 1.5,
                borderRadius: 6,
                barPercentage: 0.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: theme.text
                    }
                },
                y: {
                    grid: {
                        color: theme.grid
                    },
                    ticks: {
                        color: theme.text,
                        stepSize: 1,
                        precision: 0
                    },
                    beginAtZero: true
                }
            }
        }
    });
}

// ==========================================
// WORKOUT LOGGING FORM
// ==========================================

function initFormControls() {
    // Add exercise action
    DOM.addExerciseBtn.addEventListener('click', () => {
        addExerciseBlock();
    });
    
    // Save workout action
    DOM.workoutForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveWorkout();
    });
}

function resetWorkoutForm() {
    state.editingWorkoutId = null;
    DOM.workoutForm.reset();
    
    // Reset Form Date input to today's local date
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localToday = new Date(today.getTime() - (offset*60*1000));
    DOM.workoutDate.value = localToday.toISOString().split('T')[0];
    
    // Clear dynamic exercise items
    DOM.exerciseList.innerHTML = '';
    DOM.noExercisesHelper.style.display = 'flex';
    DOM.saveWorkoutBtn.innerHTML = '<i data-lucide="check"></i> 記録を保存する';
    
    // Change form card header text
    DOM.workoutForm.querySelector('.form-header-row h2').textContent = '新規ワークアウトの記録';
    
    // Pre-populate with one empty exercise for user convenience
    addExerciseBlock();
    
    lucide.createIcons();
}

function addExerciseBlock(data = null) {
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
                    <option value="レッグカール">
                    <option value="レッグエクステンション">
                    <option value="ショルダープレス">
                    <option value="サイドレイズ">
                    <option value="リアデルトフライ">
                    <option value="バーベルカール">
                    <option value="三頭筋プレスダウン">
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
                <tbody class="sets-tbody">
                    <!-- Set rows go here -->
                </tbody>
            </table>
            <button type="button" class="add-set-row-btn">
                <i data-lucide="plus"></i> セットを追加
            </button>
        </div>
    `;
    
    const tbody = exerciseBlock.querySelector('.sets-tbody');
    const addSetBtn = exerciseBlock.querySelector('.add-set-row-btn');
    const removeExBtn = exerciseBlock.querySelector('.btn-remove-exercise');
    
    // Add set event
    addSetBtn.addEventListener('click', () => {
        addSetRow(tbody);
    });
    
    // Remove exercise event
    removeExBtn.addEventListener('click', () => {
        exerciseBlock.style.animation = 'slideIn 0.2s ease reverse';
        setTimeout(() => {
            exerciseBlock.remove();
            // Re-index remaining exercises
            Array.from(DOM.exerciseList.children).forEach((child, idx) => {
                child.setAttribute('data-index', idx);
            });
            if (DOM.exerciseList.children.length === 0) {
                DOM.noExercisesHelper.style.display = 'flex';
            }
        }, 200);
    });
    
    // Append and add first set row
    DOM.exerciseList.appendChild(exerciseBlock);
    
    if (data && data.sets && data.sets.length > 0) {
        data.sets.forEach(s => addSetRow(tbody, s.weight, s.reps));
    } else {
        // Pre-populate with 1 empty set
        addSetRow(tbody);
    }
    
    // Initialize newly created icons
    lucide.createIcons();
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
    
    // Remove set row event
    row.querySelector('.btn-remove-set').addEventListener('click', () => {
        if (tbody.children.length > 1) {
            row.remove();
            // Update set indices
            Array.from(tbody.children).forEach((r, idx) => {
                r.querySelector('.set-num').textContent = idx + 1;
            });
        } else {
            showToast('最低1セットは必要です');
        }
    });
    
    tbody.appendChild(row);
    lucide.createIcons();
}

function saveWorkout() {
    const date = DOM.workoutDate.value;
    const title = DOM.workoutTitle.value.trim();
    const category = DOM.workoutCategory.value;
    const mood = DOM.workoutForm.querySelector('input[name="workout-mood"]:checked').value;
    const impression = DOM.workoutImpression.value.trim();
    
    // Gather exercises
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
    
    // Create / Update Workout object
    const workoutData = {
        id: state.editingWorkoutId || 'workout-' + Date.now(),
        date,
        title,
        category,
        mood,
        impression,
        exercises
    };
    
    if (state.editingWorkoutId) {
        // Edit existing
        const idx = state.workouts.findIndex(w => w.id === state.editingWorkoutId);
        if (idx !== -1) {
            state.workouts[idx] = workoutData;
            showToast('ワークアウト記録を更新しました！');
        }
    } else {
        // Create new
        state.workouts.unshift(workoutData); // Add to beginning of array
        showToast('ワークアウト記録を保存しました！');
    }
    
    saveData();
    state.editingWorkoutId = null;
    
    // Navigate back to history / dashboard
    const historyNavItem = document.querySelector('[data-tab="history"]');
    if (historyNavItem) {
        historyNavItem.click();
    }
}

// ==========================================
// HISTORY & SEARCH & FILTER & ANALYSIS
// ==========================================

function initHistoryControls() {
    DOM.searchInput.addEventListener('input', () => updateHistoryList());
    DOM.filterCategory.addEventListener('change', () => updateHistoryList());
    DOM.filterMood.addEventListener('change', () => updateHistoryList());
    
    DOM.progressionSelect.addEventListener('change', () => {
        renderProgressionChart();
    });
}

function updateHistoryList() {
    const searchQuery = DOM.searchInput.value.toLowerCase().trim();
    const catFilter = DOM.filterCategory.value;
    const moodFilter = DOM.filterMood.value;
    
    // Filter workouts
    const filtered = state.workouts.filter(w => {
        // Search filter matches title, impression, or exercise names
        const matchesSearch = searchQuery === '' || 
            w.title.toLowerCase().includes(searchQuery) ||
            w.impression.toLowerCase().includes(searchQuery) ||
            w.date.includes(searchQuery) ||
            w.exercises.some(ex => ex.name.toLowerCase().includes(searchQuery));
            
        // Category filter
        const matchesCategory = catFilter === 'all' || w.category === catFilter;
        
        // Mood filter
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
        lucide.createIcons();
        return;
    }
    
    // Sort filtered workouts descending by date
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Generate history list cards
    filtered.forEach(w => {
        const card = createHistoryCard(w);
        DOM.historyContainer.appendChild(card);
    });
    
    // Update exercises list in select dropdown for progression chart
    updateProgressionSelect();
    
    // Initialize icons in card list
    lucide.createIcons();
}

function createHistoryCard(workout) {
    const card = document.createElement('div');
    card.classList.add('card', 'workout-history-card');
    
    // Map category to CSS class
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
    
    // Mood emoji map
    const moodEmojiMap = {
        'fire': '🔥',
        'strong': '💪',
        'good': '😊',
        'tired': '🥱',
        'exhausted': '☠️'
    };
    const emoji = moodEmojiMap[workout.mood] || '😊';
    
    // Build exercises boxes
    let exercisesHtml = '';
    workout.exercises.forEach(ex => {
        let setsListHtml = '';
        ex.sets.forEach((s, idx) => {
            // Est 1RM
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
                <div class="history-sets-list">
                    ${setsListHtml}
                </div>
            </div>
        `;
    });
    
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
                    <span>${formattedDate}</span>
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
    
    // Wire up actions
    card.querySelector('.btn-edit-history').addEventListener('click', () => {
        editWorkout(workout.id);
    });
    
    card.querySelector('.btn-delete-history').addEventListener('click', () => {
        showConfirmModal('記録の削除', `「${workout.title} (${formattedDate})」の記録を削除しますか？この操作は戻せません。`, () => {
            deleteWorkout(workout.id);
        });
    });
    
    return card;
}

function formatDateJp(dateStr) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[0]}年${parseInt(parts[1])}月${parseInt(parts[2])}日`;
    }
    return dateStr;
}

function editWorkout(id) {
    const workout = state.workouts.find(w => w.id === id);
    if (!workout) return;
    
    // Set edit target
    state.editingWorkoutId = id;
    
    // Navigate to form tab
    const formNavItem = document.querySelector('[data-tab="log-workout"]');
    if (formNavItem) formNavItem.click();
    
    // Update headers and submit button text
    DOM.workoutForm.querySelector('.form-header-row h2').textContent = 'ワークアウト記録の編集';
    DOM.saveWorkoutBtn.innerHTML = '<i data-lucide="save"></i> 編集を保存する';
    
    // Populate simple fields
    DOM.workoutDate.value = workout.date;
    DOM.workoutTitle.value = workout.title;
    DOM.workoutCategory.value = workout.category;
    DOM.workoutImpression.value = workout.impression;
    
    // Check correct mood radio
    const moodRadio = DOM.workoutForm.querySelector(`input[name="workout-mood"][value="${workout.mood}"]`);
    if (moodRadio) moodRadio.checked = true;
    
    // Popuate exercise builder list
    DOM.exerciseList.innerHTML = '';
    DOM.noExercisesHelper.style.display = 'none';
    
    workout.exercises.forEach(ex => {
        addExerciseBlock(ex);
    });
    
    lucide.createIcons();
}

function deleteWorkout(id) {
    const idx = state.workouts.findIndex(w => w.id === id);
    if (idx !== -1) {
        state.workouts.splice(idx, 1);
        saveData();
        showToast('ワークアウト記録を削除しました');
        updateHistoryList();
    }
}

// 1RM progression chart updates
function updateProgressionSelect() {
    // Extract unique exercise names
    const exerciseNamesSet = new Set();
    state.workouts.forEach(w => {
        w.exercises.forEach(ex => {
            if (ex.name.trim() !== '') {
                exerciseNamesSet.add(ex.name.trim());
            }
        });
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
    
    // Restore selection if still valid, otherwise default to first
    if (exerciseNames.includes(oldVal)) {
        DOM.progressionSelect.value = oldVal;
    } else {
        DOM.progressionSelect.value = exerciseNames[0];
    }
    
    renderProgressionChart();
}

function renderProgressionChart() {
    const theme = getChartThemeColors();
    const exerciseName = DOM.progressionSelect.value;
    
    if (!exerciseName) {
        DOM.noProgressionData.style.display = 'block';
        DOM.noProgressionData.textContent = 'データがありません。';
        if (state.charts.progression) {
            state.charts.progression.destroy();
            state.charts.progression = null;
        }
        return;
    }
    
    // Gather progression points
    const points = [];
    state.workouts.forEach(w => {
        const matchedEx = w.exercises.find(ex => ex.name.trim() === exerciseName);
        if (matchedEx) {
            // Find max weight and max est 1RM in this workout for this exercise
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
                est1RM: Math.round(maxEst1RM * 10) / 10 // round 1 decimal
            });
        }
    });
    
    // Sort points chronologically
    points.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    if (points.length < 2) {
        DOM.noProgressionData.style.display = 'block';
        DOM.noProgressionData.textContent = `重量推移を表示するには、「${exerciseName}」を2回以上記録してください（現在: ${points.length}回）`;
        if (state.charts.progression) {
            state.charts.progression.destroy();
            state.charts.progression = null;
        }
        return;
    }
    
    DOM.noProgressionData.style.display = 'none';
    
    const ctx = document.getElementById('progressionChart').getContext('2d');
    
    if (state.charts.progression) {
        state.charts.progression.destroy();
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
                    borderColor: '#ec4899',
                    backgroundColor: 'rgba(236, 72, 153, 0.1)',
                    borderWidth: 2,
                    tension: 0.25,
                    fill: true,
                    pointBackgroundColor: '#ec4899',
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: '最大重量 (Max Weight)',
                    data: maxWeights,
                    borderColor: '#3b82f6',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.2,
                    pointBackgroundColor: '#3b82f6',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: theme.text,
                        font: { family: 'Inter', size: 11 }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: theme.text, font: { size: 9 } }
                },
                y: {
                    grid: { color: theme.grid },
                    ticks: {
                        color: theme.text,
                        callback: function(value) {
                            return value + ' kg';
                        }
                    },
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
    DOM.exportBtn.addEventListener('click', () => {
        exportWorkouts();
    });
    
    DOM.importTriggerBtn.addEventListener('click', () => {
        DOM.importFileInput.click();
    });
    
    DOM.importFileInput.addEventListener('change', (e) => {
        importWorkouts(e);
    });
    
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

function exportWorkouts() {
    if (state.workouts.length === 0) {
        showToast('エクスポートするデータがありません。');
        return;
    }
    
    const dataStr = JSON.stringify(state.workouts, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `fitflow_workouts_backup_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    showToast('JSONデータをエクスポートしました');
}

function importWorkouts(event) {
    const fileReader = new FileReader();
    const file = event.target.files[0];
    
    if (!file) return;
    
    fileReader.onload = function(e) {
        try {
            const parsedData = JSON.parse(e.target.result);
            
            // Basic structural validation
            if (Array.isArray(parsedData)) {
                // Confirm merging or replacing
                showConfirmModal(
                    'データのインポート',
                    `ファイルを読み込みました（${parsedData.length}件のワークアウト）。既存のデータとマージして保存しますか？（同IDのデータは上書きされます）`,
                    () => {
                        mergeImportedData(parsedData);
                    }
                );
            } else {
                showToast('無効なファイル形式です。ワークアウト配列である必要があります。');
            }
        } catch (err) {
            console.error('Failed to parse JSON file', err);
            showToast('JSONファイルの解析に失敗しました。');
        }
        
        // Reset input value so same file can be selected again
        DOM.importFileInput.value = '';
    };
    
    fileReader.readAsText(file);
}

function mergeImportedData(importedList) {
    const workoutsMap = {};
    
    // Index current workouts
    state.workouts.forEach(w => {
        workoutsMap[w.id] = w;
    });
    
    // Overwrite/Add imported workouts
    importedList.forEach(w => {
        if (w.id && w.date && w.title && Array.isArray(w.exercises)) {
            workoutsMap[w.id] = w;
        }
    });
    
    // Map map back to list
    state.workouts = Object.values(workoutsMap);
    
    // Sort descending by date
    state.workouts.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    saveData();
    showToast('データをインポートしました！');
    
    // Refresh dashboard and history views
    updateDashboard();
    updateHistoryList();
}

function clearAllWorkouts() {
    state.workouts = [];
    saveData();
    showToast('すべてのデータを削除しました。');
    
    // Reset view
    updateDashboard();
    updateHistoryList();
}
