// FITFLOW - 日別サマリーモーダル
//
// カレンダーの日付をクリックすると、その日の筋トレ・有酸素・体重の
// 記録を横断的にまとめて表示する。「入力した情報と履歴の日別対応が分かりにくい」
// (履歴タブが種類別タブに分かれていて、ある1日に何を記録したか横断的に見れない)
// という要望に応え、日付を起点に全種類の記録を一望できるようにする。

let daySummaryCurrentDate = null;

function initDaySummaryModal() {
    const closeBtn = document.getElementById('day-summary-close-btn');
    const closeBtn2 = document.getElementById('day-summary-close-btn-2');
    if (closeBtn) closeBtn.addEventListener('click', closeDaySummaryModal);
    if (closeBtn2) closeBtn2.addEventListener('click', closeDaySummaryModal);

    // オーバーレイ部分(モーダル本体そのもの)をクリックしたら閉じる
    if (DOM.daySummaryModal) {
        DOM.daySummaryModal.addEventListener('click', (e) => {
            if (e.target === DOM.daySummaryModal) closeDaySummaryModal();
        });
    }

    if (DOM.daySummaryAddBtn) {
        DOM.daySummaryAddBtn.addEventListener('click', () => {
            const dateStr = daySummaryCurrentDate;
            closeDaySummaryModal();
            if (!dateStr) return;

            const formNavItem = document.querySelector('[data-tab="quick-log"]');
            if (formNavItem) formNavItem.click();

            // 両方のフォームの日付をこの日に合わせ、既存記録があればすぐ見える状態にする
            if (DOM.workoutDate) {
                DOM.workoutDate.value = dateStr;
                syncCardioFormWithExistingDataForDate(dateStr);
            }
            if (DOM.weightQuickDate) {
                DOM.weightQuickDate.value = dateStr;
                syncDailyLogFormWithExistingDataForDate(dateStr);
            }
        });
    }
}

function openDaySummaryModal(dateStr) {
    if (!DOM.daySummaryModal || !DOM.daySummaryBody) return;

    daySummaryCurrentDate = dateStr;
    if (DOM.daySummaryTitle) DOM.daySummaryTitle.textContent = formatDateJp(dateStr);

    renderDaySummaryBody(dateStr);

    DOM.daySummaryModal.classList.remove('hidden');
}

function closeDaySummaryModal() {
    if (DOM.daySummaryModal) DOM.daySummaryModal.classList.add('hidden');
}

function daySummarySectionHtml(title, contentHtml) {
    return `
        <div class="day-summary-section">
            <div class="day-summary-section-title">${title}</div>
            ${contentHtml}
        </div>
    `;
}

function renderDaySummaryBody(dateStr) {
    if (!DOM.daySummaryBody) return;

    const dayWorkouts = state.workouts.filter(w => w.date === dateStr);
    const dayCardio = state.cardioLogs.find(c => c.date === dateStr);
    const dayWeight = state.weightLogs.find(w => w.date === dateStr);

    const sections = [];

    if (dayWorkouts.length > 0) {
        const workoutsHtml = dayWorkouts.map(w => {
            const exerciseNames = (w.exercises || []).map(ex => escapeHtml(ex.name)).join('、');
            const exerciseCount = (w.exercises || []).length;
            return `
                <div class="day-summary-item">
                    <div class="day-summary-item-main">
                        <div class="day-summary-item-title">
                            ${w.time ? `${escapeHtml(w.time)} ・ ` : ''}${exerciseCount}種目${exerciseNames ? `：${exerciseNames}` : ''}
                        </div>
                        ${w.impression ? `<div class="day-summary-item-sub">${escapeHtml(w.impression)}</div>` : ''}
                        ${w.estimatedCalories ? `<div class="day-summary-item-sub">推定消費: ${w.estimatedCalories} kcal</div>` : ''}
                    </div>
                    <div class="day-summary-item-actions">
                        <button type="button" class="btn-icon text-primary btn-day-summary-edit-workout" data-id="${w.id}" title="編集する">
                            <i data-lucide="edit-3"></i>
                        </button>
                        <button type="button" class="btn-icon text-danger btn-day-summary-delete-workout" data-id="${w.id}" title="削除する">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        sections.push(daySummarySectionHtml('🏋️ 筋トレ', workoutsHtml));
    }

    if (dayCardio) {
        const cardioHtml = `
            <div class="day-summary-item">
                <div class="day-summary-item-main">
                    <div class="day-summary-item-title">${dayCardio.distance}km （${Math.round(dayCardio.calories)} kcal）</div>
                </div>
                <div class="day-summary-item-actions">
                    <button type="button" class="btn-icon text-danger btn-day-summary-delete-cardio" title="削除する">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </div>
        `;
        sections.push(daySummarySectionHtml('🏃 有酸素', cardioHtml));
    }

    if (dayWeight) {
        const weightHtml = `
            <div class="day-summary-item">
                <div class="day-summary-item-main">
                    <div class="day-summary-item-title">${dayWeight.weight.toFixed(1)} kg</div>
                </div>
                <div class="day-summary-item-actions">
                    <button type="button" class="btn-icon text-danger btn-day-summary-delete-weight" title="削除する">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </div>
        `;
        sections.push(daySummarySectionHtml('⚖️ 体重', weightHtml));
    }

    if (sections.length === 0) {
        DOM.daySummaryBody.innerHTML = `
            <div class="day-summary-empty">
                <i data-lucide="calendar-x"></i>
                <p>この日の記録はまだありません。</p>
            </div>
        `;
    } else {
        DOM.daySummaryBody.innerHTML = sections.join('');
    }

    wireDaySummaryActions(dateStr);

    if (window.lucide) lucide.createIcons();
}

// 削除操作は既存の履歴タブの削除関数(deleteWorkout等)をそのまま再利用し、ロジックを二重化しない。
// 削除後はモーダルを閉じずにこの中身だけ再描画し、続けて他の項目も確認・削除できるようにする。
function wireDaySummaryActions(dateStr) {
    DOM.daySummaryBody.querySelectorAll('.btn-day-summary-edit-workout').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            closeDaySummaryModal();
            editWorkout(id);
        });
    });

    DOM.daySummaryBody.querySelectorAll('.btn-day-summary-delete-workout').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            showConfirmModal('記録の削除', `「${formatDateJp(dateStr)}」の筋トレ記録を削除しますか？`, () => {
                deleteWorkout(id);
                renderDaySummaryBody(dateStr);
            });
        });
    });

    const deleteCardioBtn = DOM.daySummaryBody.querySelector('.btn-day-summary-delete-cardio');
    if (deleteCardioBtn) {
        deleteCardioBtn.addEventListener('click', () => {
            const entry = state.cardioLogs.find(c => c.date === dateStr);
            if (!entry) return;
            showConfirmModal('記録の削除', `「${formatDateJp(dateStr)}」の有酸素記録を削除しますか？`, () => {
                deleteCardioLog(entry);
                renderDaySummaryBody(dateStr);
            });
        });
    }

    const deleteWeightBtn = DOM.daySummaryBody.querySelector('.btn-day-summary-delete-weight');
    if (deleteWeightBtn) {
        deleteWeightBtn.addEventListener('click', () => {
            const entry = state.weightLogs.find(w => w.date === dateStr);
            if (!entry) return;
            showConfirmModal('記録の削除', `「${formatDateJp(dateStr)}」の体重記録を削除しますか？`, () => {
                deleteWeightLog(entry);
                renderDaySummaryBody(dateStr);
            });
        });
    }

}
