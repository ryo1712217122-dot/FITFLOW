// FITFLOW - 履歴リストタブ: 検索/フィルタ入力 + サブタブ(筋トレ/有酸素/体重/食事/カロリー収支)切り替え
//           + ダッシュボード・日別サマリーから履歴の特定の日へ移動する(openHistoryAt)

function initHistoryControls() {
    if (DOM.searchInput) DOM.searchInput.addEventListener('input', () => updateHistoryList());
    if (DOM.filterMood) DOM.filterMood.addEventListener('change', () => updateHistoryList());

    if (DOM.progressionSelect) {
        DOM.progressionSelect.addEventListener('change', () => {
            renderProgressionChart();
        });
    }

    Object.keys(HISTORY_SUB_TABS).forEach(kind => {
        const tab = document.getElementById(HISTORY_SUB_TABS[kind].tab);
        if (tab) tab.addEventListener('click', () => switchHistorySubTab(kind));
    });

    // ダッシュボードなどの「〜の履歴を見る」リンク。data-history-jump に履歴の種類を書く
    // (data-history-date があれば、その日のカードまでスクロールして目立たせる)
    document.addEventListener('click', (e) => {
        const link = e.target.closest('[data-history-jump]');
        if (!link) return;
        e.preventDefault();
        openHistoryAt(link.getAttribute('data-history-jump'), link.getAttribute('data-history-date') || null);
    });

    // 履歴カードの日付を押すと、その日の記録をまとめた日別サマリーを開く
    // (ダッシュボードのカレンダーと同じ入口。履歴→その日の全体像へ戻れるようにする)
    const historySection = document.getElementById('history');
    if (historySection) {
        historySection.addEventListener('click', (e) => {
            const btn = e.target.closest('.history-date-link');
            if (!btn) return;
            openDaySummaryModal(btn.getAttribute('data-date'));
        });
    }
}

// 履歴タブのサブタブ(種類)と、その一覧を描く関数・カードの入れ物の対応
const HISTORY_SUB_TABS = {
    workouts: { tab: 'history-tab-workouts', panel: 'history-workouts-panel', container: 'history-container', render: () => updateHistoryList() },
    cardio: { tab: 'history-tab-cardio', panel: 'history-cardio-panel', container: 'cardio-history-container', render: () => updateCardioHistoryList() },
    weight: { tab: 'history-tab-weight', panel: 'history-weight-panel', container: 'weight-history-container', render: () => updateWeightHistoryList() },
    meals: { tab: 'history-tab-meals', panel: 'history-meals-panel', container: 'meal-history-container', render: () => updateMealHistoryList() },
    'calorie-balance': { tab: 'history-tab-calorie-balance', panel: 'history-calorie-balance-panel', container: 'calorie-balance-history-container', render: () => updateCalorieBalanceHistoryList() }
};

function switchHistorySubTab(kind) {
    const target = HISTORY_SUB_TABS[kind] ? kind : 'workouts';
    Object.keys(HISTORY_SUB_TABS).forEach(k => {
        const tab = document.getElementById(HISTORY_SUB_TABS[k].tab);
        const panel = document.getElementById(HISTORY_SUB_TABS[k].panel);
        const active = k === target;
        if (tab) {
            tab.classList.toggle('active', active);
            tab.setAttribute('aria-selected', active ? 'true' : 'false');
        }
        if (panel) panel.classList.toggle('is-hidden', !active);
    });
    HISTORY_SUB_TABS[target].render();
}

// ダッシュボード・日別サマリーから履歴へ移動する。dateStr があれば、その日のカードまで
// スクロールして数秒だけ枠を強調する(どのカードに飛んだのか見失わないように)。
function openHistoryAt(kind, dateStr = null) {
    if (typeof closeDaySummaryModal === 'function') closeDaySummaryModal();
    // 筋トレ履歴は検索・調子の絞り込みが残っていると目的の日が隠れることがあるので外す
    if (kind === 'workouts' && dateStr) {
        if (DOM.searchInput) DOM.searchInput.value = '';
        if (DOM.filterMood) DOM.filterMood.value = 'all';
    }
    switchTab('history', { scroll: !dateStr });
    switchHistorySubTab(kind);
    if (!dateStr) return;

    const info = HISTORY_SUB_TABS[kind] || HISTORY_SUB_TABS.workouts;
    const container = document.getElementById(info.container);
    const card = container ? container.querySelector(`[data-date="${CSS.escape(dateStr)}"]`) : null;
    if (!card) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        showToast(`${formatDateJp(dateStr)}の記録はこの一覧にありません`);
        return;
    }
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    card.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    card.classList.add('is-highlighted');
    setTimeout(() => card.classList.remove('is-highlighted'), 2400);
}
