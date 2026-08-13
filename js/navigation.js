// FITFLOW - タブナビゲーション + ヘッダーの挨拶/日付表示

function initNavigation() {
    DOM.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.getAttribute('data-tab');

            // Update active state in nav
            DOM.navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // Switch tabs
            DOM.tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === tabId) {
                    content.classList.add('active');
                }
            });

            // Specific tab entry actions
            if (tabId === 'analytics') {
                updateDashboard();
            } else if (tabId === 'history') {
                updateHistoryList();
                updateCardioHistoryList();
                updateWeightHistoryList();
                updateMealHistoryList();
                updateSleepHistoryList();
                updateCalorieBalanceHistoryList();
            } else if (tabId === 'quick-log') {
                // 進行中のセッションがあればフォームへ復元し、無ければ新規フォームにする
                syncWorkoutFormWithOpenSession();
            } else if (tabId === 'plan') {
                // 減量シミュレーション(TDEE・目標摂取カロリー・予測体重)は最新体重と
                // 直近の記録から毎回算出しているため、開くたびに再計算する。
                // これをしないと、体重を記録し直してもリロードするまで古い数字のままになる
                // (ダッシュボードだけ更新され、計画タブが取り残される不具合があった)。
                // ただし個別の編集欄(日数配分・計画開始日)を開いている最中は、
                // 入力中の値を捨てないよう再描画しない。
                if (!isPlanInlineEditorOpen()) {
                    renderPlanTab();
                }
            }

            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}

function initDateTexts() {
    const today = new Date();
    const optDate = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    if (DOM.dateText) {
        DOM.dateText.textContent = today.toLocaleDateString('ja-JP', optDate);
    }

    // Dynamic greeting based on time of day
    const hours = today.getHours();
    let greeting = 'こんにちは！';
    if (hours < 5) greeting = '夜更かしトレーニングですか？💪';
    else if (hours < 11) greeting = 'おはようございます！今日も良い一日にしましょう☀️';
    else if (hours < 18) greeting = 'こんにちは！トレーニング日和ですね🔥';
    else greeting = 'こんばんは！今日もお疲れ様です🌙';

    if (DOM.greetingText) {
        // バージョンはここにハードコードせず、サイドバーの表記(index.htmlの.app-version)を
        // 単一ソースとして読む(v1.19.0リリース時、ここの直書きだけ旧版のまま残った実害があった)
        const versionEl = document.querySelector('.app-version');
        const versionBadge = versionEl ? ` <span class="app-version-badge">${versionEl.textContent}</span>` : '';
        DOM.greetingText.innerHTML = `${greeting}${versionBadge}`;
    }
}
