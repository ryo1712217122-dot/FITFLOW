// FITFLOW - 履歴リストタブ: 有酸素/体重/特別な飲食の履歴（一覧・編集/削除）

function updateCardioHistoryList() {
    const container = document.getElementById('cardio-history-container');
    const countSpan = document.getElementById('cardio-history-count');
    if (!container || !countSpan) return;

    // 表示用の並び替えは state.cardioLogs 自体を書き換えず、コピー配列に対して行う
    // (直接ソートすると getLatestWeight() のような「末尾 = 最新」前提のロジックが壊れるため)
    const sortedLogs = sortedByDateDesc(state.cardioLogs);

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

    sortedLogs.forEach((c) => {
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
                        <span class="category-tag" style="background-color: #86ac41; color: #fff;">有酸素</span>
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

            <div style="margin-top: 1rem; display: flex; gap: 2rem;">
                <div>
                    <span class="text-muted" style="font-size: 0.85rem; display: block;">走行距離</span>
                    <span style="font-weight: 700; font-size: 1.2rem; color: var(--color-primary);">${c.distance.toFixed(2)} <span style="font-size: 0.85rem; font-weight: normal;">km</span></span>
                </div>
                <div>
                    <span class="text-muted" style="font-size: 0.85rem; display: block;">消費エネルギー</span>
                    <span style="font-weight: 700; font-size: 1.2rem; color: #86ac41;">${Math.round(c.calories)} <span style="font-size: 0.85rem; font-weight: normal;">kcal</span></span>
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

        container.appendChild(card);
    });

    if (window.lucide) {
        lucide.createIcons();
    }
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

    sortedLogs.forEach((w) => {
        const card = document.createElement('div');
        card.classList.add('card', 'history-card', 'weight-history-card');

        const formattedDate = formatDateJp(w.date);

        card.innerHTML = `
            <div class="history-card-header">
                <div class="history-title-area">
                    <div class="history-title-row">
                        <span class="history-mood-badge">⚖️</span>
                        <h4>体重記録</h4>
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

            <div class="weight-history-value-row" style="margin-top: 1rem;">
                <span class="text-muted" style="font-size: 0.85rem; display: block;">体重</span>
                <span class="weight-value-display" style="font-weight: 700; font-size: 1.2rem; color: var(--color-primary);">${w.weight.toFixed(1)} <span style="font-size: 0.85rem; font-weight: normal;">kg</span></span>
            </div>
        `;

        card.querySelector('.btn-edit-weight').addEventListener('click', () => {
            const valueRow = card.querySelector('.weight-history-value-row');
            valueRow.innerHTML = `
                <span class="text-muted" style="font-size: 0.85rem; display: block;">体重を修正</span>
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem;">
                    <input type="number" step="0.1" class="weight-edit-input" value="${w.weight}" style="max-width: 120px;">
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

function updateFoodHistoryList() {
    const container = document.getElementById('food-history-container');
    const countEl = document.getElementById('food-history-count');
    if (!container) return;

    container.innerHTML = '';
    const logs = state.foodLogs || [];

    if (countEl) countEl.textContent = logs.length;

    if (logs.length === 0) {
        container.innerHTML = '<div class="no-data-msg">特別な飲食の記録はありません</div>';
        return;
    }

    const sortedLogs = [...logs].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedLogs.forEach((log) => {
        const origIndex = state.foodLogs.findIndex(f => f.date === log.date);

        const card = document.createElement('div');
        card.className = 'card history-card';
        card.style.animation = 'slideIn 0.25s ease';

        const badgeStyles = {
            milktea: { bg: 'rgba(134,172,65,0.1)', color: 'var(--color-primary)' },
            ramen: { bg: 'rgba(224,90,71,0.1)', color: 'var(--color-danger)' },
            drinking: { bg: 'rgba(217,160,91,0.1)', color: 'var(--color-warning)' },
            sweets: { bg: 'rgba(224,120,180,0.1)', color: '#e078b4' },
            fastfood: { bg: 'rgba(230,150,50,0.1)', color: '#e69632' },
            teishoku: { bg: 'rgba(80,140,160,0.1)', color: '#508ca0' },
            custom: { bg: 'rgba(150,150,150,0.12)', color: 'var(--text-secondary)' }
        };
        const itemsList = [];
        let totalKcal = 0;
        FOOD_ITEMS.forEach(item => {
            if (!log[item.key]) return;
            const cal = log[item.calKey];
            if (typeof cal === 'number' && cal > 0) totalKcal += cal;
            const style = badgeStyles[item.key] || badgeStyles.milktea;
            const kcalText = (typeof cal === 'number' && cal > 0) ? ` (${Math.round(cal)} kcal)` : '';
            // customはユーザーが入力した名前があればそれを表示し、無ければ「その他」のまま
            const label = (item.isCustom && log[item.nameKey]) ? `✏️ ${log[item.nameKey]}` : item.label;
            itemsList.push(`<span class="badge" style="background: ${style.bg}; color: ${style.color}; border: 1px solid ${style.color}; padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.75rem;">${escapeHtml(label)}${kcalText}</span>`);
        });

        const dateObj = new Date(log.date);
        const dayOfWeekStr = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()];

        card.innerHTML = `
            <div class="card-header flex-header" style="padding: 1rem 1.25rem; border-bottom: none;">
                <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-weight: 700; font-size: 1rem;">特別な飲食</span>
                        <span style="font-size: 0.75rem; color: var(--text-muted);">${log.date} (${dayOfWeekStr})</span>
                        ${totalKcal > 0 ? `<span style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary);">合計 ${Math.round(totalKcal)} kcal</span>` : ''}
                    </div>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem;">
                        ${itemsList.join('')}
                    </div>
                </div>
                <button type="button" class="btn-icon text-danger btn-delete-food" title="削除" style="width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(224,90,71,0.05); cursor: pointer; border: none;">
                    <i data-lucide="trash-2" style="width: 1rem; height: 1rem;"></i>
                </button>
            </div>
        `;

        card.querySelector('.btn-delete-food').addEventListener('click', () => {
            showConfirmModal(
                '特別な飲食記録の削除',
                `${log.date} の特別な飲食の記録を削除してもよろしいですか？`,
                () => {
                    deleteFoodLog(origIndex);
                }
            );
        });

        container.appendChild(card);
    });

    if (window.lucide) {
        lucide.createIcons();
    }
}

function deleteFoodLog(index) {
    if (index >= 0 && index < state.foodLogs.length) {
        state.foodLogs.splice(index, 1);
        saveDataAndSync();
        showToast('特別な飲食の記録を削除しました');
        updateDashboard();
        updateFoodHistoryList();
    }
}
