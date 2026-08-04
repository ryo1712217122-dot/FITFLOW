// FITFLOW - 履歴リストタブ: 有酸素/体重の履歴（一覧・編集/削除）

function updateCardioHistoryList() {
    const container = document.getElementById('cardio-history-container');
    const countSpan = document.getElementById('cardio-history-count');
    if (!container || !countSpan) return;

    // 表示用の並び替えは state.cardioLogs 自体を書き換えず、コピー配列に対して行う
    // (直接ソートすると getLatestWeight() のような「末尾 = 最新」前提のロジックが壊れるため)
    const sortedLogs = sortedByDateDesc(state.cardioLogs);
    // 月ごとの見出し(件数・合計距離)で区切って表示する。1件ずつの羅列だと
    // 「今月どれだけ走ったか」が分からないため
    const monthGroups = groupCardioLogsByMonth(state.cardioLogs);

    countSpan.textContent = sortedLogs.length;
    container.innerHTML = '';

    if (sortedLogs.length === 0) {
        container.innerHTML = `
            <div class="card empty-state">
                <i data-lucide="flame"></i>
                <p>有酸素ランニングの履歴はありません。</p>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    monthGroups.forEach(group => {
        const header = document.createElement('div');
        header.classList.add('history-month-header');
        header.innerHTML = `
            <span class="history-month-label">${escapeHtml(group.label)}</span>
            <span class="history-month-summary">${group.count}回 ・ ${group.totalDistance.toFixed(2)} km ・ ${group.totalCalories} kcal</span>
        `;
        container.appendChild(header);

        group.logs.forEach((c) => {
            container.appendChild(createCardioHistoryCard(c));
        });
    });

    if (window.lucide) {
        lucide.createIcons();
    }
}

function createCardioHistoryCard(c) {
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
                    <span class="category-tag category-tag-cardio">有酸素</span>
                </div>
                <div class="history-date-row">
                    <i data-lucide="calendar"></i>
                    <span>${formattedDate}</span>
                </div>
            </div>
            <div class="history-actions">
                <button class="btn-icon text-danger btn-delete-cardio" title="削除する">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        </div>

        <div class="cardio-history-value-row">
            <div>
                <span class="history-metric-label">走行距離</span>
                <span class="history-metric-value-lg">${c.distance.toFixed(2)} <span class="history-metric-unit">km</span></span>
            </div>
            <div>
                <span class="history-metric-label">消費エネルギー</span>
                <span class="history-metric-value-lg">${Math.round(c.calories)} <span class="history-metric-unit">kcal</span></span>
            </div>
        </div>
    `;

    card.querySelector('.btn-delete-cardio').addEventListener('click', () => {
        showConfirmModal(
            '記録の削除',
            `このランニング記録（${formattedDate} - ${c.distance}km）を削除しますか？`,
            () => {
                deleteCardioLog(c);
            }
        );
    });

    return card;
}

function deleteCardioLog(entry) {
    const index = state.cardioLogs.indexOf(entry);
    if (index >= 0) {
        state.cardioLogs.splice(index, 1);
        saveDataAndSync();
        showToast('有酸素記録を削除しました');
        updateDashboard();
        updateCardioHistoryList();
    }
}

// 体重履歴一覧（誤って記録した値の確認・修正・削除ができる管理画面）
function updateWeightHistoryList() {
    const container = document.getElementById('weight-history-container');
    const countSpan = document.getElementById('weight-history-count');
    if (!container || !countSpan) return;

    // 表示用の並び替えは state.weightLogs 自体を書き換えず、コピー配列に対して行う
    // (直接ソートすると getLatestWeight() の「末尾 = 最新」前提が壊れ、ダッシュボードの最新体重がおかしくなる)
    const sortedLogs = sortedByDateDesc(state.weightLogs);

    countSpan.textContent = sortedLogs.length;
    container.innerHTML = '';

    if (sortedLogs.length === 0) {
        container.innerHTML = `
            <div class="card empty-state">
                <i data-lucide="scale"></i>
                <p>体重の記録はありません。</p>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    const drinkingSet = new Set(state.drinkingLogs.map(d => d.date));

    sortedLogs.forEach((w) => {
        const card = document.createElement('div');
        card.classList.add('card', 'history-card', 'weight-history-card');

        const formattedDate = formatDateJp(w.date);
        const isDrinkingDay = drinkingSet.has(w.date);

        card.innerHTML = `
            <div class="history-card-header">
                <div class="history-title-area">
                    <div class="history-title-row">
                        <span class="history-mood-badge">⚖️</span>
                        <h4>体重記録</h4>
                        ${isDrinkingDay ? '<span class="history-mood-badge" title="この日は飲み会でした">🍻</span>' : ''}
                    </div>
                    <div class="history-date-row">
                        <i data-lucide="calendar"></i>
                        <span>${formattedDate}</span>
                    </div>
                </div>
                <div class="history-actions">
                    <button class="btn-icon btn-edit-weight" title="修正する">
                        <i data-lucide="pencil"></i>
                    </button>
                    <button class="btn-icon text-danger btn-delete-weight" title="削除する">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </div>

            <div class="weight-history-value-row">
                <span class="history-metric-label">体重</span>
                <span class="weight-value-display history-metric-value-lg">${w.weight.toFixed(1)} <span class="history-metric-unit">kg</span></span>
            </div>
        `;

        card.querySelector('.btn-edit-weight').addEventListener('click', () => {
            const valueRow = card.querySelector('.weight-history-value-row');
            valueRow.innerHTML = `
                <span class="history-metric-label">体重を修正</span>
                <div class="weight-edit-row">
                    <input type="number" step="0.1" class="weight-edit-input" value="${w.weight}">
                    <button type="button" class="btn btn-primary btn-sm btn-save-weight-edit">保存</button>
                </div>
            `;
            const input = valueRow.querySelector('.weight-edit-input');
            input.focus();
            valueRow.querySelector('.btn-save-weight-edit').addEventListener('click', () => {
                const newWeight = parseFloat(input.value);
                if (isNaN(newWeight) || newWeight <= 0) {
                    showToast('有効な体重を入力してください');
                    return;
                }
                editWeightLog(w, newWeight);
            });
        });

        card.querySelector('.btn-delete-weight').addEventListener('click', () => {
            showConfirmModal(
                '記録の削除',
                `この体重記録（${formattedDate} - ${w.weight}kg）を削除しますか？`,
                () => {
                    deleteWeightLog(w);
                }
            );
        });

        container.appendChild(card);
    });

    if (window.lucide) {
        lucide.createIcons();
    }
}

function editWeightLog(entry, newWeight) {
    const index = state.weightLogs.indexOf(entry);
    if (index >= 0) {
        state.weightLogs[index].weight = newWeight;
        saveDataAndSync();
        showToast('体重記録を修正しました');
        updateDashboard();
        updateWeightHistoryList();
    }
}

function deleteWeightLog(entry) {
    const index = state.weightLogs.indexOf(entry);
    if (index >= 0) {
        state.weightLogs.splice(index, 1);
        saveDataAndSync();
        showToast('体重記録を削除しました');
        updateDashboard();
        updateWeightHistoryList();
    }
}

// 食事履歴一覧（「記録する」タブでは日付ごとの上書き/加算しかできないため、
// 誤って記録した値をあとから直接修正・削除できる管理画面として用意する）
function updateMealHistoryList() {
    const container = document.getElementById('meal-history-container');
    const countSpan = document.getElementById('meal-history-count');
    if (!container || !countSpan) return;

    const sortedLogs = sortedByDateDesc(state.mealLogs);

    countSpan.textContent = sortedLogs.length;
    container.innerHTML = '';

    if (sortedLogs.length === 0) {
        container.innerHTML = `
            <div class="card empty-state">
                <i data-lucide="utensils"></i>
                <p>食事の記録はありません。</p>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    sortedLogs.forEach((m) => {
        const card = document.createElement('div');
        card.classList.add('card', 'history-card', 'meal-history-card');

        const formattedDate = formatDateJp(m.date);
        const total = sumMealCalories(m);

        card.innerHTML = `
            <div class="history-card-header">
                <div class="history-title-area">
                    <div class="history-title-row">
                        <span class="history-mood-badge">🍽</span>
                        <h4>食事記録</h4>
                    </div>
                    <div class="history-date-row">
                        <i data-lucide="calendar"></i>
                        <span>${formattedDate}</span>
                    </div>
                </div>
                <div class="history-actions">
                    <button class="btn-icon btn-edit-meal" title="修正する">
                        <i data-lucide="pencil"></i>
                    </button>
                    <button class="btn-icon text-danger btn-delete-meal" title="削除する">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </div>

            <div class="meal-history-value-row">
                <div class="history-metric-row">
                    <div>
                        <span class="history-metric-label">朝食</span>
                        <span class="history-metric-value">${Math.round(m.breakfast)} kcal</span>
                    </div>
                    <div>
                        <span class="history-metric-label">昼食</span>
                        <span class="history-metric-value">${Math.round(m.lunch)} kcal</span>
                    </div>
                    <div>
                        <span class="history-metric-label">夕食</span>
                        <span class="history-metric-value">${Math.round(m.dinner)} kcal</span>
                    </div>
                    <div>
                        <span class="history-metric-label">間食</span>
                        <span class="history-metric-value">${Math.round(m.snacks)} kcal</span>
                    </div>
                    <div>
                        <span class="history-metric-label">合計</span>
                        <span class="history-metric-total">${Math.round(total)} kcal</span>
                    </div>
                </div>
            </div>
        `;

        card.querySelector('.btn-edit-meal').addEventListener('click', () => {
            const valueRow = card.querySelector('.meal-history-value-row');
            valueRow.innerHTML = `
                <div class="meal-history-edit-grid">
                    <div class="form-group">
                        <label>朝食</label>
                        <input type="number" min="0" step="1" class="meal-edit-breakfast" value="${m.breakfast}">
                    </div>
                    <div class="form-group">
                        <label>昼食</label>
                        <input type="number" min="0" step="1" class="meal-edit-lunch" value="${m.lunch}">
                    </div>
                    <div class="form-group">
                        <label>夕食</label>
                        <input type="number" min="0" step="1" class="meal-edit-dinner" value="${m.dinner}">
                    </div>
                    <div class="form-group">
                        <label>間食</label>
                        <input type="number" min="0" step="1" class="meal-edit-snacks" value="${m.snacks}">
                    </div>
                </div>
                <button type="button" class="btn btn-primary btn-sm margin-top-0-5 btn-save-meal-edit">保存</button>
            `;
            valueRow.querySelector('.meal-edit-breakfast').focus();
            valueRow.querySelector('.btn-save-meal-edit').addEventListener('click', () => {
                const readOne = (selector) => {
                    const v = parseFloat(valueRow.querySelector(selector).value);
                    return isNaN(v) || v < 0 ? 0 : Math.round(v);
                };
                const newValues = {
                    breakfast: readOne('.meal-edit-breakfast'),
                    lunch: readOne('.meal-edit-lunch'),
                    dinner: readOne('.meal-edit-dinner'),
                    snacks: readOne('.meal-edit-snacks')
                };
                editMealLog(m, newValues);
            });
        });

        card.querySelector('.btn-delete-meal').addEventListener('click', () => {
            showConfirmModal(
                '記録の削除',
                `この食事記録（${formattedDate}）を削除しますか？`,
                () => {
                    deleteMealLog(m);
                }
            );
        });

        container.appendChild(card);
    });

    if (window.lucide) {
        lucide.createIcons();
    }
}

// 履歴タブからの修正は「記録する」タブのフォームと違い、4項目とも指定した値で直接上書きする
// (間食の加算式はあくまで日々の記録用の便宜であり、あとからの修正では
//  「今表示されている数字を正しい値に直す」という直感的な挙動の方が適切なため)
function editMealLog(entry, newValues) {
    const index = state.mealLogs.indexOf(entry);
    if (index >= 0) {
        state.mealLogs[index] = { date: entry.date, ...newValues };
        saveDataAndSync();
        showToast('食事記録を修正しました');
        updateDashboard();
        updateMealHistoryList();
    }
}

// カロリー収支履歴一覧: 食事・有酸素・筋トレの記録から日ごとの摂取/消費/収支をまとめて表示する。
// 元データ(食事/有酸素/筋トレ)を横断して算出する派生ビューのため、ここに編集・削除は無い
// (直したい場合は元データの各タブで修正すれば、次に開いた時にこの一覧へ反映される)。
function updateCalorieBalanceHistoryList() {
    const container = document.getElementById('calorie-balance-history-container');
    const countSpan = document.getElementById('calorie-balance-history-count');
    if (!container || !countSpan) return;

    const balances = computeDailyCalorieBalances(
        state.mealLogs, state.cardioLogs, state.workouts, state.maintenanceCalories, WORKOUT_CALORIES_PER_SET
    ).slice().reverse(); // 新しい日付順

    countSpan.textContent = balances.length;
    container.innerHTML = '';

    if (balances.length === 0) {
        container.innerHTML = `
            <div class="card empty-state">
                <i data-lucide="activity"></i>
                <p>食事・有酸素・筋トレの記録がまだありません。</p>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    balances.forEach((b) => {
        const card = document.createElement('div');
        card.classList.add('card', 'history-card', 'calorie-balance-history-card');

        const formattedDate = formatDateJp(b.date);
        const diffClass = b.diff < 0 ? 'value-negative' : 'value-positive';
        const diffSign = b.diff > 0 ? '+' : '';

        card.innerHTML = `
            <div class="history-card-header">
                <div class="history-title-area">
                    <div class="history-title-row">
                        <span class="history-mood-badge">⚖️</span>
                        <h4>カロリー収支</h4>
                    </div>
                    <div class="history-date-row">
                        <i data-lucide="calendar"></i>
                        <span>${formattedDate}</span>
                    </div>
                </div>
            </div>

            <div class="calorie-balance-value-row">
                <div>
                    <span class="history-metric-label">摂取</span>
                    <span class="history-metric-value">${Math.round(b.intake)} kcal</span>
                </div>
                <div>
                    <span class="history-metric-label">消費</span>
                    <span class="history-metric-value">${Math.round(b.expenditure)} kcal</span>
                </div>
                <div>
                    <span class="history-metric-label">収支(消費-摂取)</span>
                    <span class="history-metric-value-bold ${diffClass}">${diffSign}${Math.round(b.diff)} kcal</span>
                </div>
            </div>
        `;

        container.appendChild(card);
    });

    if (window.lucide) {
        lucide.createIcons();
    }
}

// ==========================================
// 睡眠履歴
// ==========================================

// 睡眠の記録一覧。体重・食事の履歴と同じく、カード内でのインライン編集にする。
function updateSleepHistoryList() {
    const container = DOM.sleepHistoryContainer;
    const countSpan = DOM.sleepHistoryCount;
    if (!container || !countSpan) return;

    const sortedLogs = sortedByDateDesc(state.sleepLogs);
    countSpan.textContent = sortedLogs.length;
    container.innerHTML = '';

    if (sortedLogs.length === 0) {
        container.innerHTML = `
            <div class="card empty-state">
                <i data-lucide="moon"></i>
                <p>睡眠の記録はありません。</p>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    const target = getSleepTargetHours();
    // 飲み会の翌朝は睡眠が乱れやすいので、体重履歴と同じく🍻を添えて文脈が分かるようにする
    const drinkingSet = new Set(state.drinkingLogs.map(d => d.date));

    sortedLogs.forEach(s => {
        const hours = computeSleepDuration(s.bedTime, s.wakeTime);
        if (hours === null) return;
        const formattedDate = formatDateJp(s.date);
        // 「起床日」基準なので、飲み会当日の夜の睡眠は翌日の記録に現れる
        const afterDrinking = drinkingSet.has(addDaysToDateString(s.date, -1));

        const card = document.createElement('div');
        card.classList.add('card', 'history-card', 'sleep-history-card');
        card.innerHTML = `
            <div class="history-card-header">
                <div class="history-title-area">
                    <div class="history-title-row">
                        <span class="history-mood-badge">😴</span>
                        <h4>睡眠記録</h4>
                        ${afterDrinking ? '<span class="history-mood-badge" title="前夜は飲み会でした">🍻</span>' : ''}
                    </div>
                    <div class="history-date-row">
                        <i data-lucide="calendar"></i>
                        <span>${formattedDate}に起床</span>
                    </div>
                </div>
                <div class="history-actions">
                    <button class="btn-icon btn-edit-sleep" title="修正する">
                        <i data-lucide="pencil"></i>
                    </button>
                    <button class="btn-icon text-danger btn-delete-sleep" title="削除する">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </div>

            <div class="sleep-history-value-row">
                <span class="history-metric-label">睡眠時間</span>
                <span class="history-metric-value-lg${hours < target ? ' sleep-short' : ''}">${formatSleepHours(hours)}</span>
            </div>
            <div class="sleep-history-times">
                <span><i data-lucide="bed"></i> 就寝 ${escapeHtml(s.bedTime)}</span>
                <span><i data-lucide="sunrise"></i> 起床 ${escapeHtml(s.wakeTime)}</span>
            </div>
        `;

        card.querySelector('.btn-edit-sleep').addEventListener('click', () => {
            const valueRow = card.querySelector('.sleep-history-value-row');
            valueRow.innerHTML = `
                <div class="sleep-history-edit-grid">
                    <div class="form-group">
                        <label>就寝</label>
                        <input type="time" class="sleep-edit-bed" value="${escapeHtml(s.bedTime)}">
                    </div>
                    <div class="form-group">
                        <label>起床</label>
                        <input type="time" class="sleep-edit-wake" value="${escapeHtml(s.wakeTime)}">
                    </div>
                </div>
                <button type="button" class="btn btn-primary btn-sm btn-save-sleep-edit margin-top-0-5">保存</button>
            `;
            const bedInput = valueRow.querySelector('.sleep-edit-bed');
            bedInput.focus();
            valueRow.querySelector('.btn-save-sleep-edit').addEventListener('click', () => {
                const newBed = bedInput.value;
                const newWake = valueRow.querySelector('.sleep-edit-wake').value;
                const newHours = computeSleepDuration(newBed, newWake);
                if (newHours === null) {
                    showToast(newBed && newWake && newBed === newWake
                        ? '就寝と起床が同じ時刻になっています'
                        : '就寝時刻と起床時刻を入力してください');
                    return;
                }
                if (newHours > 16) {
                    showToast(`睡眠時間が${formatSleepHours(newHours)}になっています。就寝と起床が逆になっていませんか？`);
                    return;
                }
                editSleepLog(s, newBed, newWake);
            });
        });

        card.querySelector('.btn-delete-sleep').addEventListener('click', () => {
            showConfirmModal(
                '記録の削除',
                `この睡眠記録（${formattedDate} - ${formatSleepHours(hours)}）を削除しますか？`,
                () => {
                    deleteSleepLog(s);
                }
            );
        });

        container.appendChild(card);
    });

    if (window.lucide) {
        lucide.createIcons();
    }
}

function editSleepLog(entry, bedTime, wakeTime) {
    const index = state.sleepLogs.indexOf(entry);
    if (index >= 0) {
        state.sleepLogs[index] = { date: entry.date, bedTime, wakeTime };
        saveDataAndSync();
        updateSleepHistoryList();
        updateDashboard();
        // 同じ日付を記録フォームが開いていれば表示を合わせる
        // (古い値のまま送信すると、いま直した内容を上書きしてしまうため)
        if (DOM.sleepDate && DOM.sleepDate.value === entry.date) {
            syncSleepFormWithExistingDataForDate(entry.date);
        }
        showToast('睡眠記録を更新しました');
    }
}

function deleteSleepLog(entry) {
    const index = state.sleepLogs.indexOf(entry);
    if (index >= 0) {
        state.sleepLogs.splice(index, 1);
        saveDataAndSync();
        updateSleepHistoryList();
        updateDashboard();
        // 削除した日をフォームが開いていれば、入力欄も空に戻す
        if (DOM.sleepDate && DOM.sleepDate.value === entry.date) {
            syncSleepFormWithExistingDataForDate(entry.date);
        }
        showToast('睡眠記録を削除しました');
    }
}
