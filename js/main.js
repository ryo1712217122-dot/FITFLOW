// FITFLOW - エントリポイント。全js/*.jsの読み込み完了後に初期化する。

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    // 一回限りのデータ移行は、画面描画・クラウド同期より先に済ませる
    // (移行前の古いデータで描画・アップロードしてしまわないように)
    runOneTimeMigrations();
    // グラフを描く前に、書体と最小文字サイズ(DADS)を Chart.js の既定に入れておく
    applyChartDefaults();
    initNavigation();
    initDateTexts();
    initCalendarControls();
    initFormControls();
    initHistoryControls();
    initDashboardControls();
    initSettingsControls();
    initDaySummaryModal();

    // 進行中の筋トレセッションがあれば、起動直後にフォームへ復元しておく
    // (記録タブの「記録中」の目印もここで出る。初期表示はダッシュボード)
    syncWorkoutFormWithOpenSession();

    // Load initial views
    updateDashboard();
    updateHistoryList();
    updateCardioHistoryList();
    updateWeightHistoryList();
    updateMealHistoryList();
    updateCalorieBalanceHistoryList();
    renderPlanTab();

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

    // オフラインでも開けるよう Service Worker を登録する(v1.26.0。方針は sw.js)。
    // file:// で直接開いた場合など、使えない環境では何もしない(従来どおり動く)
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').catch(err => {
                console.warn('Service Worker を登録できませんでした(オフラインでは開けません)', err);
            });
        });
    }
});
