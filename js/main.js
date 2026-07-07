// FITFLOW - エントリポイント。全js/*.jsの読み込み完了後に初期化する。

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initTheme();
    initNavigation();
    initDateTexts();
    initCalendarControls();
    initFormControls();
    initHistoryControls();
    initDashboardControls();
    initSettingsControls();

    // Load initial views
    updateDashboard();
    updateHistoryList();
    updateCardioHistoryList();
    updateWeightHistoryList();
    updateFoodHistoryList();
    renderPlanTab();
    renderPlanSidebarWidget();

    // 起動時にサイレントにクラウドから同期
    autoSyncFromCloud();

    // オンライン復帰時に自動的に未同期データを送信
    window.addEventListener('online', () => {
        if (localStorage.getItem(DIRTY_KEY) === 'true') {
            triggerSync(true);
        }
    });

    // iOS Safari用ピンチズーム・ダブルタップ拡大制限
    document.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) {
            e.preventDefault();
        }
    }, { passive: false });

    document.addEventListener('gesturestart', (e) => {
        e.preventDefault();
    });

    // Initialize Lucide Icons
    if (window.lucide) {
        lucide.createIcons();
    }
});
