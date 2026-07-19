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
    charts: {
        progression: null,
        weight: null,
        calorieComparison: null,
        volumeTrend: null
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

    // 旧データでtimeが無い場合も架空の時刻で埋めない(以前は配列位置に応じた適当な時刻を
    // 割り当てており、保存・同期でその架空の値が実データとして固定化されてしまっていた)。
    // 空文字のまま保持し、表示側は「時刻なし」として扱う(履歴カードはtimeが空なら非表示)。
    state.workouts.forEach(w => {
        if (!w.time) w.time = '';
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

    // 「特別な飲食」機能はv1.11.0で廃止した(クラウド同期側に保存されず、起動時の
    // 自動同期でローカル記録が消えてしまっていた)。残っている保存データも読み込まずに破棄する。
    localStorage.removeItem('fitflow_food_logs');

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
}

// 一回限りのデータ移行。loadData()の後・画面描画/クラウド同期の前にmain.jsから呼ぶ。
// 各移行はMIGRATION_FLAG_PREFIX付きのフラグで冪等化し、実際にデータを書き換えた時だけ
// dirtyを立てて(=saveDataAndSync)クラウドにも反映させる。
function runOneTimeMigrations() {
    // 2026-07: 実際にやっていた種目は「アームカール」だったが、一時期それを誤って
    // 「ダンベルフライ」の名前で記録していたため、種目名を一括で正しい「アームカール」に直す。
    //
    // 経緯(重要): 前回はこれと逆方向の移行(「アームカール」→「ダンベルフライ」、フラグ
    // 'fitflow_migration_2026_07_armcurl_to_dumbbell_fly')を入れていたが、前提の認識が
    // 逆だった(誤記録側がダンベルフライ)。逆方向の移行を残したままだと、フラグ未設定の
    // 新環境(新ブラウザ・localStorageクリア後)でクラウドから同期した正しい「アームカール」
    // 記録を誤って「ダンベルフライ」に改名してしまうため、旧移行コードは削除した。
    // 旧フラグ('..._armcurl_to_dumbbell_fly')は再利用せず、新しいフラグで冪等化する
    // (旧フラグのlocalStorage掃除は不要)。
    //
    // 注意: この移行は起動時のローカルデータのみが対象。フラグ設定後にクラウド同期や
    // JSONインポートで「ダンベルフライ」を含むデータが流入しても改名されない(単一ユーザー用途の前提)。
    const dumbbellFlyFlag = MIGRATION_FLAG_PREFIX + '2026_07_dumbbell_fly_to_armcurl';
    if (!localStorage.getItem(dumbbellFlyFlag)) {
        const renamed = renameExercisesInWorkouts(state.workouts, 'ダンベルフライ', 'アームカール');
        if (renamed > 0) {
            saveDataAndSync();
            console.log(`🛠️ 種目名の移行: 「ダンベルフライ」${renamed}件を「アームカール」に修正しました`);
        }
        localStorage.setItem(dumbbellFlyFlag, 'true');
    }

    // 2026-07: 最適化計画の開始日(weightPlanStartDate)は、かつて保存・再計算のたびに
    // その日の日付で上書きされるバグがあり、実際の計画開始とズレた値が残っている。
    // 「記録の始まり=最初の体重ログの日付」(クラウド同期済みならスプレッドシートの
    // WeightLogs先頭行と同じ)を開始日として一度だけ適用し直す。
    // 判定ロジックはlib/data-utils.jsのdecidePlanStartDateMigrationに委譲(テスト対象)。
    // markDone=falseは「体重ログがまだ無い環境」で、フラグを立てずに次回起動で再判定する。
    const planStartFlag = MIGRATION_FLAG_PREFIX + '2026_07_fix_plan_start_date';
    if (!localStorage.getItem(planStartFlag)) {
        const decision = decidePlanStartDateMigration(state.weightLogs, state.planSettings);
        if (decision.apply) {
            state.planSettings.weightPlanStartDate = decision.startDate;
            saveDataAndSync();
            console.log(`🛠️ 最適化計画の開始日を最初の体重記録日(${decision.startDate})に修正しました`);
        }
        if (decision.markDone) {
            localStorage.setItem(planStartFlag, 'true');
        }
    }
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
