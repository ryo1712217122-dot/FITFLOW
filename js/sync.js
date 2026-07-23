// FITFLOW - Googleスプレッドシート(GAS)とのクラウド同期
// ペイロード形式(workouts/weightLogs/cardioLogs/maintenanceCalories/foodLogs/planSettings)は
// 外部のGoogle Apps Script側と契約があるため変更しないこと。
// mealLogs(食事記録)は2026-07に追加したキーで、GAS側はまだ永続化していない
// (対応パッチ: GAS_MEALLOGS_PATCH.md、未適用)。未対応のGASは受け取っても無視するだけなので
// 送信自体は安全だが、doGetの応答にmealLogsが含まれないため、取り込み側は必ず
// Array.isArray()で「キーが存在した時だけ」上書きすること(存在しない=空配列と解釈すると、
// 自動同期のたびにローカルの食事記録が消える。foodLogs機能で実際に起きた不具合と同型)。

let isSyncing = false;
let syncTimeoutId = null;
let pendingSync = false;

// GASのコールドスタート等でレスポンスが極端に遅い/失敗するケースがあるため、
// タイムアウトと1回の自動リトライを共通化したfetchラッパー
function fetchSheetsWithRetry(url, options, { timeoutMs = 15000, retries = 1, retryDelayMs = 1500 } = {}) {
    const attempt = (remaining) => {
        return fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) })
            .catch(err => {
                if (remaining <= 0) throw err;
                return new Promise(resolve => setTimeout(resolve, retryDelayMs))
                    .then(() => attempt(remaining - 1));
            });
    };
    return attempt(retries);
}

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
        // 「特別な飲食」機能はv1.11.0で廃止したが、ペイロード形式はGAS側との契約のため
        // キー自体は空配列のまま残す(キーを消すとGAS側の実装によっては書き込みが失敗しうる)
        foodLogs: [],
        planSettings: state.planSettings,
        // mealLogs(食事記録: 朝食/昼食/夕食/間食)はGAS側がまだ永続化に対応していない
        // (対応パッチはGAS_MEALLOGS_PATCH.md参照、未適用)。未対応のGASでもペイロードの
        // 余分なキーはそのまま無視されるだけで送信自体は失敗しないため、先行して送っておく
        // (パッチ適用後、再デプロイなしで自動的に保存されるようになる)。
        mealLogs: state.mealLogs
    };

    fetchSheetsWithRetry(state.sheetsUrl, {
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

    fetchSheetsWithRetry(state.sheetsUrl, {
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
            const importedWeights = filterValidWeightLogs(data.weightLogs || []);
            const importedCardio = filterValidCardioLogs(data.cardioLogs || []);
            const importedMaint = data.maintenanceCalories || DEFAULT_MAINTENANCE_CALORIES;
            const importedPlan = data.planSettings || null;
            // GAS側がmealLogsをまだ永続化していない間は data.mealLogs が丸ごと欠落する
            // (未対応パッチ: GAS_MEALLOGS_PATCH.md)。他のフィールドと違いdata.mealLogs||[]で
            // 受けてしまうと、キー欠落=空配列と解釈され、この自動同期のたびにローカルの
            // 食事記録が空で上書きされて消えてしまう(過去のfoodLogs機能で実際に発生した不具合と同型)。
            // 配列として実際に返ってきた時だけ取り込み、それ以外はローカルの値を保持する。
            const importedMeals = Array.isArray(data.mealLogs) ? filterValidMealLogs(data.mealLogs) : null;

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
            if (importedPlan) state.planSettings = importedPlan;
            if (importedMeals !== null) state.mealLogs = importedMeals;

            // Sort
            state.weightLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
            state.cardioLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
            state.mealLogs.sort((a, b) => new Date(a.date) - new Date(b.date));

            // Save locally but keep clean state
            saveData();
            localStorage.setItem(DIRTY_KEY, 'false');

            // Update views
            updateDashboard();
            updateHistoryList();
            updateCardioHistoryList();
            updateWeightHistoryList();
            updateMealHistoryList();
            updateCalorieBalanceHistoryList();
            renderPlanTab();
            // 「記録する」タブのフォームも取り込んだ最新データに合わせ直す
            // (古い表示のまま送信すると、今取り込んだデータを消してしまうため)
            refreshRecordFormsAfterExternalDataChange();

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

    fetchSheetsWithRetry(state.sheetsUrl, {
        method: 'GET',
        mode: 'cors'
    })
    .then(res => res.json())
    .then(data => {
        if (data && !data.error) {
            data = normalizeImportedData(data);
            const importedWorkouts = data.workouts || [];
            const importedWeights = filterValidWeightLogs(data.weightLogs || []);
            const importedCardio = filterValidCardioLogs(data.cardioLogs || []);
            const importedMaint = data.maintenanceCalories || DEFAULT_MAINTENANCE_CALORIES;
            const importedPlan = data.planSettings || null;
            // GAS未対応の間はdata.mealLogsが丸ごと欠落する。手動マージなので副作用は
            // 起きにくいが、autoSyncFromCloudと挙動を揃え、欠落時は空配列でマージしない
            const importedMeals = Array.isArray(data.mealLogs) ? filterValidMealLogs(data.mealLogs) : [];

            if (!validateWorkoutsSchema(importedWorkouts)) {
                showToast('受信したデータ形式が不正です');
                return;
            }

            showConfirmModal(
                'クラウドからの復元',
                `スプレッドシートからデータを取得しました（ワークアウト: ${importedWorkouts.length}件, 体重ログ: ${importedWeights.length}件）。既存データにマージしますか？`,
                () => {
                    mergeImportedData(importedWorkouts, importedWeights, importedCardio, importedMaint, importedPlan, importedMeals);
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

    // Normalize meals
    if (Array.isArray(data.mealLogs)) {
        data.mealLogs = data.mealLogs.map(m => {
            if (m) {
                m.date = normalizeDate(m.date);
                m.breakfast = parseFloat(m.breakfast) || 0;
                m.lunch = parseFloat(m.lunch) || 0;
                m.dinner = parseFloat(m.dinner) || 0;
                m.snacks = parseFloat(m.snacks) || 0;
            }
            return m;
        });
    }

    // Normalize maintenance
    if (data.maintenanceCalories) {
        data.maintenanceCalories = parseInt(data.maintenanceCalories) || DEFAULT_MAINTENANCE_CALORIES;
    }

    return data;
}
