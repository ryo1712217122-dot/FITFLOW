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

    // Group food/cardio/weight logs by date (それぞれ日付ごとに高々1件)
    const foodByDate = {};
    if (state.foodLogs) {
        state.foodLogs.forEach(f => {
            foodByDate[f.date] = f;
        });
    }
    const cardioByDate = {};
    state.cardioLogs.forEach(c => { cardioByDate[c.date] = c; });
    const weightByDate = {};
    state.weightLogs.forEach(w => { weightByDate[w.date] = w; });

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

        // 日付をクリックすると、その日の全記録(筋トレ・有酸素・体重・特別な飲食)を
        // 横断的にまとめた日別サマリーモーダルを開く。記録の有無に関わらず全日をクリック可能にする
        // (記録が無い日でも「この日に記録を追加」からすぐ入力できるようにするため)
        dayCell.addEventListener('click', () => {
            openDaySummaryModal(dateStr);
        });

        const titleParts = [];

        const dayWorkouts = workoutsByDate[dateStr];
        if (dayWorkouts && dayWorkouts.length > 0) {
            dayCell.classList.add('workout-done');

            const dot = document.createElement('span');
            dot.classList.add('workout-dot-indicator');
            dayCell.appendChild(dot);

            titleParts.push(`トレーニング記録 ${dayWorkouts.length}件`);
        }

        const emojis = [];
        const dayFood = foodByDate[dateStr];
        if (dayFood) {
            const hasAnyFood = FOOD_ITEMS.some(item => dayFood[item.key]);
            if (hasAnyFood) {
                emojis.push('🍽️');
                titleParts.push('特別な飲食の記録あり');
            }
        }
        if (cardioByDate[dateStr]) {
            emojis.push('🏃');
            titleParts.push('有酸素の記録あり');
        }
        if (weightByDate[dateStr]) {
            emojis.push('⚖️');
            titleParts.push('体重の記録あり');
        }

        if (emojis.length > 0) {
            const indicator = document.createElement('span');
            indicator.classList.add('calendar-day-indicator');
            indicator.textContent = emojis.join('');
            dayCell.appendChild(indicator);
        }

        if (titleParts.length > 0) {
            dayCell.setAttribute('title', titleParts.join(' | '));
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
        if (DOM.weightChangeSummary) DOM.weightChangeSummary.textContent = '';
        return;
    }

    DOM.noWeightData.style.display = 'none';

    // 移動平均は表示ウィンドウより前の実績も踏まえて計算してから、表示件数分だけ切り出す
    // (直近10件だけを渡すと、グラフ左端付近の平均が「本当は分かるはずの過去データ」を
    //  使えずに不正確になるため)
    const movingAverages = computeMovingAverage(state.weightLogs, WEIGHT_TREND_WINDOW_DAYS);
    const recentLogs = state.weightLogs.slice(-MAX_RECENT_WEIGHT_LOGS);
    const recentAverages = movingAverages.slice(-MAX_RECENT_WEIGHT_LOGS);

    const labels = recentLogs.map(l => {
        const parts = l.date.split('-');
        return parts.length === 3 ? `${parseInt(parts[1])}/${parseInt(parts[2])}` : l.date;
    });
    const weights = recentLogs.map(l => l.weight);
    const averages = recentAverages.map(a => a.average);

    // 日々の変動ノイズに埋もれがちな傾向を、要約テキストとしても添える
    if (DOM.weightChangeSummary) {
        const change = computeWeightChangeOverDays(state.weightLogs, WEIGHT_TREND_WINDOW_DAYS);
        if (change === null) {
            DOM.weightChangeSummary.textContent = '';
        } else {
            const sign = change > 0 ? '+' : '';
            const trendClass = change < 0 ? 'weight-change-down' : (change > 0 ? 'weight-change-up' : '');
            DOM.weightChangeSummary.className = `weight-change-summary ${trendClass}`;
            DOM.weightChangeSummary.textContent = `直近${WEIGHT_TREND_WINDOW_DAYS}日間で ${sign}${change}kg`;
        }
    }

    const colorPrimary = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#86ac41';
    const colorSecondary = getComputedStyle(document.documentElement).getPropertyValue('--color-secondary').trim() || '#7da3a1';
    const colorWarning = getComputedStyle(document.documentElement).getPropertyValue('--color-warning').trim() || '#d9a05b';

    if (state.charts.weight) {
        try { state.charts.weight.destroy(); } catch(e){}
    }

    const datasets = [
        {
            label: '体重 (kg)',
            data: weights,
            borderColor: colorPrimary,
            backgroundColor: hexToRgba(colorPrimary, 0.1),
            borderWidth: 2.5,
            tension: 0.3,
            fill: true,
            pointBackgroundColor: colorPrimary,
            pointRadius: 4
        },
        {
            label: `${WEIGHT_TREND_WINDOW_DAYS}日移動平均`,
            data: averages,
            borderColor: colorSecondary,
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [4, 4],
            tension: 0.3,
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 3
        }
    ];

    // 最適化計画のロードマップ(開始時・1ヶ月目・3ヶ月目)が設定されていれば、
    // 予測体重を実測と同じ日付軸に重ねて表示し、計画が当たっているか一目で確認できるようにする
    const plan = state.planSettings;
    if (plan && plan.weightPlanStartDate) {
        const plannedSeries = computePlannedWeightSeries(
            recentLogs.map(l => l.date),
            plan.weightPlanStartDate,
            plan.weightStart,
            plan.weight1Month,
            plan.weight3Month
        );
        if (plannedSeries.some(v => v !== null)) {
            datasets.push({
                label: '予測 (計画)',
                data: plannedSeries,
                borderColor: colorWarning,
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: [2, 3],
                tension: 0,
                fill: false,
                pointRadius: 0,
                pointHoverRadius: 3,
                spanGaps: true
            });
        }
    }

    state.charts.weight = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
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
