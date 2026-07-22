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
    weightChangeSummary: document.getElementById('weight-change-summary'),
    noCalorieData: document.getElementById('no-calorie-data'),

    // Log Workout Form
    workoutForm: document.getElementById('workout-form'),
    workoutDate: document.getElementById('workout-date'),
    workoutTime: document.getElementById('workout-time'),
    workoutImpression: document.getElementById('workout-impression'),
    exerciseList: document.getElementById('exercise-list'),
    addExerciseBtn: document.getElementById('add-exercise-btn'),
    saveWorkoutBtn: document.getElementById('save-workout-btn'),

    // Cardio Logger (有酸素単独記録フォーム)
    cardioForm: document.getElementById('cardio-form'),
    cardioDate: document.getElementById('cardio-date'),
    logCardioDist: document.getElementById('log-cardio-dist'),
    cardioCalcHint: document.getElementById('cardio-calc-hint'),
    workoutCalorieHint: document.getElementById('workout-calorie-hint'),
    todayBurnedKcal: document.getElementById('today-burned-kcal'),
    currentMaintenanceKcal: document.getElementById('current-maintenance-kcal'),
    todayIntakeKcal: document.getElementById('today-intake-kcal'),
    todayCalorieDiffKcal: document.getElementById('today-calorie-diff-kcal'),
    cardioExistingHint: document.getElementById('cardio-existing-hint'),
    cardioExistingHintText: document.getElementById('cardio-existing-hint-text'),

    // Weight Quick Logger (体重単独記録フォーム)
    weightQuickForm: document.getElementById('weight-quick-form'),
    weightQuickDate: document.getElementById('weight-quick-date'),
    weightQuickVal: document.getElementById('weight-quick-val'),
    dailyLogExistingHint: document.getElementById('daily-log-existing-hint'),
    dailyLogExistingHintText: document.getElementById('daily-log-existing-hint-text'),

    // Meal Logger (食事単独記録フォーム: 朝食/昼食/夕食/間食)
    mealForm: document.getElementById('meal-form'),
    mealDate: document.getElementById('meal-date'),
    mealBreakfast: document.getElementById('meal-breakfast'),
    mealLunch: document.getElementById('meal-lunch'),
    mealDinner: document.getElementById('meal-dinner'),
    mealSnacks: document.getElementById('meal-snacks'),
    mealBreakfastEstimate: document.getElementById('meal-breakfast-estimate'),
    mealLunchEstimate: document.getElementById('meal-lunch-estimate'),
    mealDinnerEstimate: document.getElementById('meal-dinner-estimate'),
    mealSnacksEstimate: document.getElementById('meal-snacks-estimate'),
    mealTotalHint: document.getElementById('meal-total-hint'),
    mealExistingHint: document.getElementById('meal-existing-hint'),
    mealExistingHintText: document.getElementById('meal-existing-hint-text'),

    // History
    searchInput: document.getElementById('search-input'),
    filterMood: document.getElementById('filter-mood'),
    progressionSelect: document.getElementById('progression-exercise-select'),
    noProgressionData: document.getElementById('no-progression-data'),
    noVolumeTrendData: document.getElementById('no-volume-trend-data'),
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
    daySummaryModal: document.getElementById('day-summary-modal'),
    daySummaryTitle: document.getElementById('day-summary-title'),
    daySummaryBody: document.getElementById('day-summary-body'),
    daySummaryAddBtn: document.getElementById('day-summary-add-btn'),
    modalMessage: document.getElementById('modal-message'),
    modalCancelBtn: document.getElementById('modal-cancel-btn'),
    modalConfirmBtn: document.getElementById('modal-confirm-btn')
};
