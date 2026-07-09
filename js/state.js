// FITFLOW - グローバル状態とlocalStorage永続化
// config.jsの後に読み込むこと。

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
        progression: null,
        weight: null,
        calorieComparison: null,
        volumeTrend: null,
        foodBreakdown: null
    }
};

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
    // 注意: 個人のGAS URLをここにデフォルト値として書かないこと。
    // このリポジトリはPublicであり、ソースにURLを埋め込むと誰でも読み書きできてしまう。
    // ユーザーは「データ・設定」タブから自分のURLを都度入力・保存する。
    state.sheetsUrl = localStorage.getItem('fitflow_sheets_url') || '';

    // 6. Plan Settings
    // 保存済みの設定はDEFAULT_PLAN_SETTINGSとマージする。
    // (これをせず保存済みオブジェクトをそのまま使うと、アプリのアップデートで
    //  新しい設定項目を追加した際、以前から使っているユーザーの設定にはその項目が
    //  存在せずundefinedのままになってしまう)
    const planData = localStorage.getItem('fitflow_plan_settings');
    if (planData) {
        try {
            state.planSettings = Object.assign({}, DEFAULT_PLAN_SETTINGS, JSON.parse(planData));
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
    // 注意: fitflow_sheets_url はここでは書き込まない(saveSheetsUrl()に分離している)。
    // saveData()はワークアウト記録などほぼ全ての保存操作のたびに呼ばれるため、
    // もしstate.sheetsUrlが何らかの理由で一時的に空(未ロード)のままここに来ると、
    // 無関係な保存操作のついでに正しいURLを空文字で上書き・消失させてしまっていた
    // (実際に発生した不具合)。URLの保存は、ユーザーが明示的に保存ボタンを押した
    // 時にだけ行われるべきもの。
    localStorage.setItem('fitflow_plan_settings', JSON.stringify(state.planSettings));
    localStorage.setItem('fitflow_food_logs', JSON.stringify(state.foodLogs));
}

// GAS ウェブアプリURLの保存は、ユーザーが「接続情報を保存」ボタンを押した時だけ行う
// (saveData()から分離している理由は上記コメント参照)。
function saveSheetsUrl() {
    localStorage.setItem('fitflow_sheets_url', state.sheetsUrl);
}

function saveDataAndSync() {
    saveData();
    localStorage.setItem(DIRTY_KEY, 'true');
    scheduleSync(true);
}
