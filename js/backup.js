// FITFLOW - 同期と設定タブ: テーマ選択の配線 + JSONエクスポート/インポート/マージ/初期化
// メンテナンスカロリー設定の配線はダッシュボードに移設したためjs/dashboard.jsのinitDashboardControls()にある。

function initSettingsControls() {
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
            saveSheetsUrl();
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
            importedWeights = filterValidWeightLogs(importedWeights);
            importedCardio = filterValidCardioLogs(importedCardio);

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

// バリデーション/正規化用の純粋関数（normalizeDate, normalizeTime, validateWorkoutsSchema,
// filterValidWeightLogs, filterValidCardioLogs, sortedByDateDesc, getLatestWeightFromLogs）は
// lib/data-utils.js に切り出し、index.htmlでこのファイルより先に読み込んでいる

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
    updateWeightHistoryList();
    updateFoodHistoryList();
    renderPlanTab();
    renderPlanSidebarWidget();
    // 「記録する」タブのフォームも取り込んだ最新データに合わせ直す
    // (古い表示のまま送信すると、今取り込んだデータを消してしまうため)
    refreshRecordFormsAfterExternalDataChange();
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
    updateWeightHistoryList();
    updateFoodHistoryList();
    renderPlanTab();
    renderPlanSidebarWidget();
    // 「記録する」タブのフォームに削除済みの値(特にチェック済みの食事項目)が
    // 残ったままにならないようにする
    refreshRecordFormsAfterExternalDataChange();
}
