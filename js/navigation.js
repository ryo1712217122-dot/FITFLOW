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
            } else if (tabId === 'quick-log') {
                if (!state.editingWorkoutId) {
                    resetWorkoutForm();
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
        DOM.greetingText.innerHTML = `${greeting} <span class="app-version-badge">v1.13.0</span>`;
    }
}
