// FITFLOW - 履歴リストタブ: 検索/フィルタ入力 + サブタブ(筋トレ/有酸素/体重)切り替え

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
    const tabMeals = document.getElementById('history-tab-meals');
    const tabCalorieBalance = document.getElementById('history-tab-calorie-balance');
    const panelWorkouts = document.getElementById('history-workouts-panel');
    const panelCardio = document.getElementById('history-cardio-panel');
    const panelWeight = document.getElementById('history-weight-panel');
    const panelMeals = document.getElementById('history-meals-panel');
    const panelCalorieBalance = document.getElementById('history-calorie-balance-panel');

    if (tabWorkouts && tabCardio && tabWeight && tabMeals && tabCalorieBalance &&
        panelWorkouts && panelCardio && panelWeight && panelMeals && panelCalorieBalance) {
        const allTabs = [tabWorkouts, tabCardio, tabWeight, tabMeals, tabCalorieBalance];
        const allPanels = [panelWorkouts, panelCardio, panelWeight, panelMeals, panelCalorieBalance];
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

        tabMeals.addEventListener('click', () => {
            switchSubTab(tabMeals, panelMeals);
            updateMealHistoryList();
        });

        tabCalorieBalance.addEventListener('click', () => {
            switchSubTab(tabCalorieBalance, panelCalorieBalance);
            updateCalorieBalanceHistoryList();
        });
    }
}
