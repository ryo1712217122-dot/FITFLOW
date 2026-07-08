// FITFLOW - DOM要素参照キャッシュ
// index.htmlのbody末尾でこのスクリプトが読み込まれる時点で全要素が存在している前提。

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
    weeklyRunDistanceNum: document.getElementById('weekly-run-distance-num'),
    weeklyRunDistanceTarget: document.getElementById('weekly-run-distance-target'),
    weeklyRunProgressFill: document.getElementById('weekly-run-progress-fill'),
    calendarMonthYear: document.getElementById('calendar-month-year'),
    calendarDays: document.getElementById('calendar-days'),
    prevMonthBtn: document.getElementById('prev-month-btn'),
    nextMonthBtn: document.getElementById('next-month-btn'),
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
    workoutCalorieHint: document.getElementById('workout-calorie-hint'),
    todayBurnedKcal: document.getElementById('today-burned-kcal'),
    currentMaintenanceKcal: document.getElementById('current-maintenance-kcal'),
    todayFoodKcal: document.getElementById('today-food-kcal'),

    // Weight Quick Logger (体重単独記録フォーム)
    weightQuickForm: document.getElementById('weight-quick-form'),
    weightQuickDate: document.getElementById('weight-quick-date'),
    weightQuickVal: document.getElementById('weight-quick-val'),

    // History
    searchInput: document.getElementById('search-input'),
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
