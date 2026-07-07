// FITFLOW - 履歴リストタブ: 検索/フィルタ入力 + サブタブ(筋トレ/有酸素/体重/特別な飲食)切り替え

function initHistoryControls() {
    if (DOM.searchInput) DOM.searchInput.addEventListener('input', () => updateHistoryList());
    if (DOM.filterMood) DOM.filterMood.addEventListener('change', () => updateHistoryList());

    if (DOM.progressionSelect) {
        DOM.progressionSelect.addEventListener('change', () => {
            renderProgressionChart();
        });
    }

    // Sub tabs events
    const tabWorkouts = document.getElementById('history-tab-workouts');
    const tabCardio = document.getElementById('history-tab-cardio');
    const tabWeight = document.getElementById('history-tab-weight');
    const tabFood = document.getElementById('history-tab-food');
    const panelWorkouts = document.getElementById('history-workouts-panel');
    const panelCardio = document.getElementById('history-cardio-panel');
    const panelWeight = document.getElementById('history-weight-panel');
    const panelFood = document.getElementById('history-food-panel');

    if (tabWorkouts && tabCardio && tabWeight && tabFood && panelWorkouts && panelCardio && panelWeight && panelFood) {
        const allTabs = [tabWorkouts, tabCardio, tabWeight, tabFood];
        const allPanels = [panelWorkouts, panelCardio, panelWeight, panelFood];
        const switchSubTab = (activeTab, activePanel) => {
            allTabs.forEach(t => {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
            });
            allPanels.forEach(p => {
                p.classList.add('is-hidden');
            });

            activeTab.classList.add('active');
            activeTab.setAttribute('aria-selected', 'true');
            activePanel.classList.remove('is-hidden');
        };

        tabWorkouts.addEventListener('click', () => {
            switchSubTab(tabWorkouts, panelWorkouts);
            updateHistoryList();
        });

        tabCardio.addEventListener('click', () => {
            switchSubTab(tabCardio, panelCardio);
            updateCardioHistoryList();
        });

        tabWeight.addEventListener('click', () => {
            switchSubTab(tabWeight, panelWeight);
            updateWeightHistoryList();
        });

        tabFood.addEventListener('click', () => {
            switchSubTab(tabFood, panelFood);
            updateFoodHistoryList();
        });
    }
}
