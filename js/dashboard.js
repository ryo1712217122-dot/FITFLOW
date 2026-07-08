// FITFLOW - ダッシュボードタブ（統計カード・カレンダー・体重/カロリーグラフ・メンテナンスカロリー設定）
// メンテナンスカロリー設定はv2再構成で「同期と設定」タブからここへ移設した
// （カロリーバランスグラフに直接効く入力なので、入力→表示の距離を縮めるため）。

// 指定日付に記録された筋トレセッション(複数あれば合算)の推定消費カロリー合計を返す。
// 有酸素と同様、「本日の総消費」「カロリーバランスグラフ」の両方に合算するために使う。
function getWorkoutCaloriesForDate(dateStr) {
    return state.workouts
        .filter(w => w.date === dateStr)
        .reduce((sum, w) => {
            const kcal = typeof w.estimatedCalories === 'number'
                ? w.estimatedCalories
                : estimateWorkoutCalories(w.exercises, WORKOUT_CALORIES_PER_SET);
            return sum + kcal;
        }, 0);
}

// 指定日付に記録された特別な飲食のカロリー合計を返す（同じ日に複数項目チェックしていれば合算）。
function getFoodCaloriesForDate(dateStr) {
    const record = state.foodLogs.find(f => f.date === dateStr);
    if (!record) return 0;
    return FOOD_ITEMS.reduce((sum, item) => {
        const cal = record[item.calKey];
        return sum + (typeof cal === 'number' && cal > 0 ? cal : 0);
    }, 0);
}

function updateDashboard() {
    // 1. Stats: Total workouts
    const total = state.workouts.length;
    if (DOM.totalWorkoutsNum) DOM.totalWorkoutsNum.textContent = total;

    // 2. Stats: Latest Weight
    if (state.weightLogs && state.weightLogs.length > 0) {
        const latest = state.weightLogs[state.weightLogs.length - 1]; // O(1) access since it's pre-sorted
        if (DOM.latestWeightNum) DOM.latestWeightNum.textContent = latest.weight.toFixed(1);
        if (DOM.latestWeightDate) DOM.latestWeightDate.textContent = formatDateJp(latest.date);
    } else {
        if (DOM.latestWeightNum) DOM.latestWeightNum.textContent = '0.0';
        if (DOM.latestWeightDate) DOM.latestWeightDate.textContent = '未登録';
    }

    // 3. Stats: Today's running
    const todayStr = getLocalDateString();
    let todayCalories = 0;
    let todayDistance = 0;

    if (state.cardioLogs) {
        state.cardioLogs.forEach(c => {
            if (c.date === todayStr) {
                todayCalories += c.calories || 0;
                todayDistance += c.distance || 0;
            }
        });
    }
    if (DOM.todayCalorieNum) DOM.todayCalorieNum.textContent = Math.round(todayCalories);
    if (DOM.todayCardioDist) DOM.todayCardioDist.textContent = `${todayDistance.toFixed(2)} km 走行`;

    // Calorie Balance tiles update
    // 「本日の消費」は運動分（有酸素＋筋トレの推定消費）だけでなく、
    // メンテナンス（生活代謝の基準線）を含めた総消費で表示する
    // (運動分だけをメンテナンスと比較すると、常に大幅な消費不足に見えてしまうため)
    const todayWorkoutCalories = getWorkoutCaloriesForDate(todayStr);
    const todayTotalExpenditure = state.maintenanceCalories + todayCalories + todayWorkoutCalories;
    if (DOM.todayBurnedKcal) {
        DOM.todayBurnedKcal.innerHTML = `${Math.round(todayTotalExpenditure)} <span class="unit">kcal</span>`;
    }
    if (DOM.currentMaintenanceKcal) {
        DOM.currentMaintenanceKcal.innerHTML = `${state.maintenanceCalories} <span class="unit">kcal</span>`;
    }
    if (DOM.todayFoodKcal) {
        const todayFoodCalories = getFoodCaloriesForDate(todayStr);
        DOM.todayFoodKcal.innerHTML = `${Math.round(todayFoodCalories)} <span class="unit">kcal</span>`;
    }

    // 4. Streaks
    const streak = calculateStreak(state.workouts);
    if (DOM.streakCount) DOM.streakCount.textContent = `${streak} 日`;

    // 4.5 週間ランニング目標の達成度
    updateWeeklyRunGoal(todayStr);

    // 5. Training Calendar & Charts
    renderCalendar();
    renderWeightChart();
    renderCalorieChart();
}

function calculateStreak(workouts) {
    if (!workouts || workouts.length === 0) return 0;

    // Get unique date strings sorted descending
    const dates = workouts.map(w => w.date);
    const uniqueDates = [...new Set(dates)].sort((a, b) => new Date(b) - new Date(a));

    const todayStr = getLocalDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalDateString(yesterday);

    // Check if user has logged a workout today or yesterday
    if (uniqueDates[0] !== todayStr && uniqueDates[0] !== yesterdayStr) {
        return 0;
    }

    let streak = 1;
    let currentDate = new Date(uniqueDates[0] + 'T00:00:00');

    for (let i = 1; i < uniqueDates.length; i++) {
        const prevDate = new Date(uniqueDates[i] + 'T00:00:00');
        const diffTime = Math.abs(currentDate - prevDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            streak++;
            currentDate = prevDate;
        } else if (diffDays > 1) {
            break; // Streak broken
        }
    }

    return streak;
}

// 週間ランニング目標（デフォルト15km、最適化計画タブで編集可能）に対する今週(日〜土)の達成度を表示する
function updateWeeklyRunGoal(todayStr) {
    if (!DOM.weeklyRunDistanceNum && !DOM.weeklyRunProgressFill) return;

    const target = (state.planSettings && state.planSettings.weeklyRunDistanceTarget > 0)
        ? state.planSettings.weeklyRunDistanceTarget
        : DEFAULT_PLAN_SETTINGS.weeklyRunDistanceTarget;
    const weekStart = getWeekStartDate(todayStr);
    const weekDistance = sumCardioDistanceForWeek(state.cardioLogs, weekStart);

    if (DOM.weeklyRunDistanceNum) DOM.weeklyRunDistanceNum.textContent = weekDistance.toFixed(1);
    if (DOM.weeklyRunDistanceTarget) DOM.weeklyRunDistanceTarget.textContent = target;

    if (DOM.weeklyRunProgressFill) {
        const pct = target > 0 ? Math.min(100, Math.round((weekDistance / target) * 100)) : 0;
        DOM.weeklyRunProgressFill.style.width = `${pct}%`;
        DOM.weeklyRunProgressFill.classList.toggle('progress-bar-fill-complete', pct >= 100);
    }
}

// Calendar Heatmap rendering
function initCalendarControls() {
    if (DOM.prevMonthBtn) {
        DOM.prevMonthBtn.addEventListener('click', () => {
            state.currentMonth--;
            if (state.currentMonth < 0) {
                state.currentMonth = 11;
                state.currentYear--;
            }
            renderCalendar();
        });
    }

    if (DOM.nextMonthBtn) {
        DOM.nextMonthBtn.addEventListener('click', () => {
            state.currentMonth++;
            if (state.currentMonth > 11) {
                state.currentMonth = 0;
                state.currentYear++;
            }
            renderCalendar();
        });
    }
}

function renderCalendar() {
    if (!DOM.calendarMonthYear || !DOM.calendarDays) return;
    const year = state.currentYear;
    const month = state.currentMonth;

    const monthsJapanese = [
        '1月', '2月', '3月', '4月', '5月', '6月',
        '7月', '8月', '9月', '10月', '11月', '12月'
    ];
    DOM.calendarMonthYear.textContent = `${year}年 ${monthsJapanese[month]}`;

    DOM.calendarDays.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    // Empty cells padding
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.classList.add('calendar-day', 'empty');
        DOM.calendarDays.appendChild(emptyCell);
    }

    const todayStr = getLocalDateString();

    // O(W) Group workouts by date beforehand for fast O(1) lookup in render loop
    const workoutsByDate = {};
    state.workouts.forEach(w => {
        if (!workoutsByDate[w.date]) {
            workoutsByDate[w.date] = [];
        }
        workoutsByDate[w.date].push(w);
    });

    // Group food logs by date
    const foodByDate = {};
    if (state.foodLogs) {
        state.foodLogs.forEach(f => {
            foodByDate[f.date] = f;
        });
    }

    // Render actual days
    for (let day = 1; day <= totalDays; day++) {
        const dayCell = document.createElement('div');
        dayCell.classList.add('calendar-day');
        dayCell.textContent = day;

        const currentMonthPadded = String(month + 1).padStart(2, '0');
        const currentDayPadded = String(day).padStart(2, '0');
        const dateStr = `${year}-${currentMonthPadded}-${currentDayPadded}`;

        if (dateStr === todayStr) {
            dayCell.classList.add('today');
        }

        const dayWorkouts = workoutsByDate[dateStr];
        if (dayWorkouts && dayWorkouts.length > 0) {
            dayCell.classList.add('workout-done');

            const dot = document.createElement('span');
            dot.classList.add('workout-dot-indicator');
            dayCell.appendChild(dot);

            dayCell.setAttribute('title', `トレーニング記録 ${dayWorkouts.length}件`);

            dayCell.addEventListener('click', () => {
                const historyNavItem = document.querySelector('[data-tab="history"]');
                if (DOM.searchInput) {
                    DOM.searchInput.value = dateStr;
                    updateHistoryList();
                }
                if (historyNavItem) historyNavItem.click();
            });
        }

        const dayFood = foodByDate[dateStr];
        if (dayFood) {
            const emojis = [];
            if (dayFood.milktea) emojis.push('🍵');
            if (dayFood.ramen) emojis.push('🍜');
            if (dayFood.drinking) emojis.push('🍺');
            if (emojis.length > 0) {
                const foodIndicator = document.createElement('span');
                foodIndicator.style.position = 'absolute';
                foodIndicator.style.top = '2px';
                foodIndicator.style.right = '2px';
                foodIndicator.style.fontSize = '0.65rem';
                foodIndicator.style.lineHeight = '1';
                foodIndicator.textContent = emojis.join('');
                dayCell.appendChild(foodIndicator);

                const itemsText = emojis.join(' ');
                const existingTitle = dayCell.getAttribute('title') || '';
                dayCell.setAttribute('title', (existingTitle ? existingTitle + ' | ' : '') + `飲食: ${itemsText}`);
            }
        }

        DOM.calendarDays.appendChild(dayCell);
    }
}

// ==========================================
// メンテナンスカロリー設定（ダッシュボードのカロリーバランスカードに同居）
// ==========================================

function initDashboardControls() {
    if (DOM.maintenanceInput) {
        DOM.maintenanceInput.value = state.maintenanceCalories;
    }

    if (DOM.saveMaintenanceBtn) {
        DOM.saveMaintenanceBtn.addEventListener('click', () => {
            const val = parseInt(DOM.maintenanceInput.value) || DEFAULT_MAINTENANCE_CALORIES;
            state.maintenanceCalories = val;
            saveDataAndSync();
            showToast('メンテナンスカロリーを保存しました！');
            updateDashboard();
        });
    }

    const autoCalcMaintBtn = document.getElementById('auto-calc-maintenance-btn');
    if (autoCalcMaintBtn) {
        autoCalcMaintBtn.addEventListener('click', () => {
            calculateFluidMaintenance();
        });
    }
}

function calculateFluidMaintenance() {
    const latestWeight = getLatestWeight();

    // Count workouts in the last 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const workoutsLast30Days = state.workouts.filter(w => {
        if (!w.date) return false;
        const wDate = new Date(w.date + 'T00:00:00');
        return wDate >= thirtyDaysAgo && wDate <= today;
    }).length;

    // 1. Basal Metabolic Rate (BMR) = 23 * Weight (kg)
    const bmr = 23 * latestWeight;

    // 2. Physical Activity Level (PAL) multiplier based on workout frequency in last 30 days
    let pal = 1.2; // Sedentary
    let freqDesc = 'ほとんど運動なし (週0回未満)';

    if (workoutsLast30Days >= 12) { // 3+ times a week
        pal = 1.725; // Very active
        freqDesc = '活発な運動 (週3回以上)';
    } else if (workoutsLast30Days >= 8) { // 2 times a week
        pal = 1.55; // Moderately active
        freqDesc = '適度な運動 (週2回程度)';
    } else if (workoutsLast30Days >= 4) { // 1 time a week
        pal = 1.375; // Lightly active
        freqDesc = '軽い運動 (週1回程度)';
    }

    const calculatedCalories = Math.round(bmr * pal);

    // Apply to input and state
    if (DOM.maintenanceInput) {
        DOM.maintenanceInput.value = calculatedCalories;
    }
    state.maintenanceCalories = calculatedCalories;
    saveDataAndSync();

    showToast(`メンテナンスカロリーを再計算しました：${calculatedCalories} kcal (${freqDesc}, 最新体重: ${latestWeight.toFixed(1)}kg)`);
    updateDashboard();
}

function renderWeightChart() {
    const theme = getChartThemeColors();
    const canvas = document.getElementById('weightChart');
    if (!canvas || !DOM.noWeightData) return;

    const ctx = canvas.getContext('2d');

    if (state.weightLogs.length === 0) {
        DOM.noWeightData.style.display = 'block';
        if (state.charts.weight) {
            try { state.charts.weight.destroy(); } catch(e){}
            state.charts.weight = null;
        }
        return;
    }

    DOM.noWeightData.style.display = 'none';

    const recentLogs = state.weightLogs.slice(-MAX_RECENT_WEIGHT_LOGS);

    const labels = recentLogs.map(l => {
        const parts = l.date.split('-');
        return parts.length === 3 ? `${parseInt(parts[1])}/${parseInt(parts[2])}` : l.date;
    });
    const weights = recentLogs.map(l => l.weight);

    if (state.charts.weight) {
        try { state.charts.weight.destroy(); } catch(e){}
    }

    state.charts.weight = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '体重 (kg)',
                data: weights,
                borderColor: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#86ac41',
                backgroundColor: hexToRgba(getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#86ac41', 0.1),
                borderWidth: 2.5,
                tension: 0.3,
                fill: true,
                pointBackgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#86ac41',
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: theme.text, font: { size: 9 } }
                },
                y: {
                    grid: { color: theme.grid },
                    ticks: { color: theme.text, font: { size: 9 } },
                    beginAtZero: false
                }
            }
        }
    });
}

function renderCalorieChart() {
    const theme = getChartThemeColors();
    const canvas = document.getElementById('calorieComparisonChart');
    if (!canvas || !DOM.noCalorieData) return;

    // このチャートはメンテナンス消費（常に0より大きい）を基準線として必ず描画できるため、
    // 他のチャートと違って「データなし」状態は存在しない
    DOM.noCalorieData.style.display = 'none';

    const ctx = canvas.getContext('2d');

    const labels = [];
    const datesYmd = [];
    const today = new Date();

    // Generate dates window
    for (let i = CARDIO_DAYS_WINDOW - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const ymd = getLocalDateString(d);
        datesYmd.push(ymd);

        const parts = ymd.split('-');
        labels.push(`${parseInt(parts[1])}/${parseInt(parts[2])}`);
    }

    // 運動による消費は「有酸素の実測距離ベースの消費」＋「筋トレの推定消費（セット数ベース）」を合算する
    const activeCalories = datesYmd.map(ymd => {
        let sum = 0;
        state.cardioLogs.forEach(c => {
            if (c.date === ymd) {
                sum += c.calories || 0;
            }
        });
        sum += getWorkoutCaloriesForDate(ymd);
        return sum;
    });

    const maintenanceLimit = datesYmd.map(() => state.maintenanceCalories);

    // 棒グラフは「メンテナンス（生活代謝の基準線）＋ 運動による追加消費」の合計消費とする。
    // 運動消費だけをメンテナンスと直接比較すると、メンテナンス自体が既に1日の基礎的な消費を
    // 表しているため、常に「大幅な消費不足」に見えてしまい誤解を招く。
    const totalExpenditure = datesYmd.map((ymd, i) => maintenanceLimit[i] + activeCalories[i]);

    // 特別な飲食で追加摂取したカロリーも並べて表示し、消費と摂取を見比べられるようにする
    const foodCalories = datesYmd.map(ymd => getFoodCaloriesForDate(ymd));

    if (state.charts.calorieComparison) {
        try { state.charts.calorieComparison.destroy(); } catch(e){}
    }

    state.charts.calorieComparison = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '総消費（メンテナンス＋運動）',
                    data: totalExpenditure,
                    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#86ac41',
                    borderRadius: 4,
                    barThickness: 16
                },
                {
                    label: 'メンテナンス基準',
                    data: maintenanceLimit,
                    type: 'line',
                    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--color-secondary').trim() || '#7da3a1',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 0
                },
                {
                    label: '特別な飲食の摂取',
                    data: foodCalories,
                    type: 'line',
                    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--color-danger').trim() || '#e05a47',
                    backgroundColor: hexToRgba(getComputedStyle(document.documentElement).getPropertyValue('--color-danger').trim() || '#e05a47', 0.1),
                    borderWidth: 2,
                    borderDash: [2, 2],
                    fill: false,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: theme.text, font: { size: 10 } }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: theme.text, font: { size: 9 } }
                },
                y: {
                    grid: { color: theme.grid },
                    ticks: { color: theme.text, font: { size: 9 } },
                    beginAtZero: true
                }
            }
        }
    });
}
