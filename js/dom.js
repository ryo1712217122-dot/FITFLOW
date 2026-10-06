// FITFLOW - DOM要素参照キャッシュ
// index.htmlのbody末尾でこのスクリプトが読み込まれる時点で全要素が存在している前提。

const DOM = {
    navItems: document.querySelectorAll('.nav-item'),
    tabContents: document.querySelectorAll('.tab-content'),
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
    calendarDays: document.getElementById('calendar-days'),
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

    // 有酸素(v1.27.0でトレーニングの記録フォームに統合。日付はworkoutDateと共通)
    logCardioDist: document.getElementById('log-cardio-dist'),
    cardioCalcHint: document.getElementById('cardio-calc-hint'),
    workoutCalorieHint: document.getElementById('workout-calorie-hint'),
    todayBurnedKcal: document.getElementById('today-burned-kcal'),
    currentMaintenanceKcal: document.getElementById('current-maintenance-kcal'),
    currentMaintenanceDesc: document.getElementById('current-maintenance-desc'),
    todayIntakeKcal: document.getElementById('today-intake-kcal'),
    todayCalorieDiffKcal: document.getElementById('today-calorie-diff-kcal'),
    todayIntakeRemaining: document.getElementById('today-intake-remaining'),
    todayIntakeRemainingDesc: document.getElementById('today-intake-remaining-desc'),
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

    // 飲み会(v1.27.0で食事の記録の「夕食」の分岐に統合)
    mealDinnerDrinking: document.getElementById('meal-dinner-drinking'),
    mealDrinkingPanel: document.getElementById('meal-drinking-panel'),
    mealDrinkingEstimate: document.getElementById('meal-drinking-estimate'),
    mealDrinkingHint: document.getElementById('meal-drinking-hint'),
    mealDrinkingHintText: document.getElementById('meal-drinking-hint-text'),
    drinkingImpactSummary: document.getElementById('drinking-impact-summary'),


    // History
    searchInput: document.getElementById('search-input'),
    filterMood: document.getElementById('filter-mood'),
    progressionSelect: document.getElementById('progression-exercise-select'),
    noProgressionData: document.getElementById('no-progression-data'),
    noVolumeTrendData: document.getElementById('no-volume-trend-data'),
    historyCount: document.getElementById('history-count'),
    historyContainer: document.getElementById('history-container'),

    // Settings
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
    modalMessage: document.getElementById('modal-message'),
    modalCancelBtn: document.getElementById('modal-cancel-btn'),
    modalConfirmBtn: document.getElementById('modal-confirm-btn')
};
