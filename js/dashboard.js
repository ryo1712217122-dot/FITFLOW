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
    const todayStr = getTodayStr();
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

    // 本日の摂取（食事記録の合計）と収支（消費−摂取）
    const todayMeal = state.mealLogs.find(m => m.date === todayStr);
    const todayIntake = sumMealCalories(todayMeal);
    const todayDiff = computeCalorieDiff(todayIntake, todayTotalExpenditure);
    if (DOM.todayIntakeKcal) {
        DOM.todayIntakeKcal.innerHTML = `${todayIntake} <span class="unit">kcal</span>`;
    }
    if (DOM.todayCalorieDiffKcal) {
        const sign = todayDiff > 0 ? '+' : '';
        DOM.todayCalorieDiffKcal.innerHTML = `${sign}${todayDiff} <span class="unit">kcal</span>`;
        // 収支が負(摂取超過)の時だけ危険色にする。摂取が未記録(todayIntake===0)の日は
        // 収支=総消費と一致し常に正になるため、誤って危険表示にはならない
        DOM.todayCalorieDiffKcal.classList.toggle('tile-value-danger', todayDiff < 0);
    }
    if (DOM.currentMaintenanceKcal) {
        DOM.currentMaintenanceKcal.innerHTML = `${state.maintenanceCalories} <span class="unit">kcal</span>`;
    }

    updateTodayIntakeBudget(todayStr, todayMeal);

    // 4. Streaks
    const streak = calculateStreak(state.workouts);
    if (DOM.streakCount) DOM.streakCount.textContent = `${streak} 日`;

    // 4.5 週間ランニング目標の達成度
    updateWeeklyRunGoal(todayStr);

    // 4.6 週のまとめ(今週と先週)
    renderWeeklySummary(todayStr);

    // 5. Training Calendar & Charts
    renderCalendar();
    renderWeightChart();
    renderCalorieChart();
}

// 週のまとめ(v1.26.0)。今週(日曜〜今日)と先週を1枚の表で比べる。
// 回数・ボリューム・距離は今週がまだ途中なので「差」を出さない(週の前半は必ずマイナスに
// 見えてしまうため)。差を出すのは平均で比べられる体重と摂取だけ。
// 差は独立した列にせず、今週の値の下に「先週比」として添える。4列にするとスマホ幅で
// 差の列が横スクロールの先に隠れ、いちばん見たい体重の増減が見えなくなったため。
function renderWeeklySummary(todayStr) {
    const body = document.getElementById('weekly-summary-body');
    const rangeEl = document.getElementById('weekly-summary-range');
    if (!body) return;

    const sum = computeWeeklySummary({
        weightLogs: state.weightLogs, workouts: state.workouts,
        cardioLogs: state.cardioLogs, mealLogs: state.mealLogs
    }, todayStr);
    if (!sum) { body.innerHTML = ''; return; }

    const md = (d) => { const p = d.split('-'); return `${Number(p[1])}/${Number(p[2])}`; };
    if (rangeEl) {
        rangeEl.textContent = `今週 ${md(sum.thisWeek.from)}〜${md(sum.thisWeek.to)} ／ 先週 ${md(sum.lastWeek.from)}〜${md(sum.lastWeek.to)}`;
    }

    const num = (n) => Number(n).toLocaleString('ja-JP');
    const none = '<span class="weekly-summary-none">記録なし</span>';
    const signed = (v, digits = 0) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(digits);

    const weightCell = (w) => w.weightAvg === null ? none
        : `${w.weightAvg.toFixed(1)} kg<span class="weekly-summary-sub">${w.weightCount}回測定</span>`;
    const intakeCell = (w) => w.intakeAvg === null ? none
        : `${num(w.intakeAvg)} kcal<span class="weekly-summary-sub">${w.mealDays}日分</span>`;

    // 体重の差は「減った=成功色 / 増えた=警告色」。符号も付けるので色だけの表示ではない
    let weightDiff = '';
    if (sum.weightChange !== null) {
        const cls = sum.weightChange < 0 ? 'is-down' : sum.weightChange > 0 ? 'is-up' : '';
        weightDiff = `<span class="weekly-summary-diff ${cls}">先週比 ${signed(sum.weightChange, 1)}&nbsp;kg</span>`;
    }
    let intakeDiff = '';
    if (sum.thisWeek.intakeAvg !== null && sum.lastWeek.intakeAvg !== null) {
        intakeDiff = `<span class="weekly-summary-diff">先週比 ${signed(sum.thisWeek.intakeAvg - sum.lastWeek.intakeAvg)}&nbsp;kcal</span>`;
    }

    const rows = [
        ['体重（週平均）', weightCell(sum.thisWeek) + weightDiff, weightCell(sum.lastWeek)],
        ['筋トレ', `${sum.thisWeek.sessions}回`, `${sum.lastWeek.sessions}回`],
        ['総ボリューム', `${num(sum.thisWeek.volume)} kg`, `${num(sum.lastWeek.volume)} kg`],
        ['走行距離', `${sum.thisWeek.runKm.toFixed(1)} km`, `${sum.lastWeek.runKm.toFixed(1)} km`],
        ['平均摂取', intakeCell(sum.thisWeek) + intakeDiff, intakeCell(sum.lastWeek)]
    ];

    const projection = typeof getTargetWeightProjection === 'function' ? getTargetWeightProjection() : null;
    const targetHtml = projection
        ? `<p class="weekly-summary-target">🎯 目標 ${projection.target.toFixed(1)}kg：${escapeHtml(describeTargetWeightProjection(projection))}</p>`
        : '';

    body.innerHTML = `
        <div class="weekly-summary-table-wrap">
            <table class="weekly-summary-table">
                <thead>
                    <tr>
                        <th scope="col">項目</th>
                        <th scope="col">今週</th>
                        <th scope="col">先週</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(r => `<tr><th scope="row">${r[0]}</th><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}
                </tbody>
            </table>
        </div>
        <p class="weekly-summary-note">今週は日曜〜今日の途中経過なので、先週と比べているのは平均で比べられる体重と摂取だけです。摂取は食事を記録した日の平均で、今日（食べかけ）は含みません。</p>
        ${targetHtml}
    `;
}

// 今日あと何kcal食べられるか(v1.26.0)。目標は計画タブのシミュレーションと同じ値
// (getPlanProjectionBasis の目標摂取3区分)を使い、画面によって目標が食い違わないようにする。
// どの区分の日かはアプリからは分からないため、飲み会を記録した日だけイベント日、
// それ以外は通常日を基準にし、他の区分で見た場合の残りも添える。
function updateTodayIntakeBudget(todayStr, todayMeal) {
    if (!DOM.todayIntakeRemaining) return;
    const fmt = (n) => Math.abs(Math.round(n)).toLocaleString('ja-JP');
    let budget = null;
    try {
        const sim = getPlanProjectionBasis().sim;
        const isDrinkingDay = state.drinkingLogs.some(d => d.date === todayStr);
        budget = computeTodayIntakeBudget(sim, todayMeal, isDrinkingDay);
    } catch (e) {
        console.error('今日の残りカロリーを計算できませんでした', e);
    }

    if (!budget) {
        DOM.todayIntakeRemaining.innerHTML = `— <span class="unit">kcal</span>`;
        DOM.todayIntakeRemaining.classList.remove('tile-value-danger');
        if (DOM.todayIntakeRemainingDesc) DOM.todayIntakeRemainingDesc.textContent = '計画タブで減量ペースを選ぶと表示されます';
        return;
    }

    const over = budget.remaining < 0;
    // 超過は色だけでなく「超過」の文言と符号でも示す
    DOM.todayIntakeRemaining.innerHTML = over
        ? `${fmt(budget.remaining)} <span class="unit">kcal 超過</span>`
        : `${fmt(budget.remaining)} <span class="unit">kcal</span>`;
    DOM.todayIntakeRemaining.classList.toggle('tile-value-danger', over);

    if (DOM.todayIntakeRemainingDesc) {
        const others = budget.others
            .map(o => `${o.label}なら${o.remaining < 0 ? `${fmt(o.remaining)}超過` : `あと${fmt(o.remaining)}`}`)
            .join('・');
        DOM.todayIntakeRemainingDesc.textContent =
            `${budget.label}の目標 ${fmt(budget.target)} − 記録 ${fmt(budget.eaten)} kcal` +
            (others ? `（${others}）` : '');
    }
}

function calculateStreak(workouts) {
    if (!workouts || workouts.length === 0) return 0;

    // Get unique date strings sorted descending
    const dates = workouts.map(w => w.date);
    const uniqueDates = [...new Set(dates)].sort((a, b) => new Date(b) - new Date(a));

    const todayStr = getTodayStr();
    // 「昨日」もフィットネス上の今日を基準に取る(実時刻の昨日ではない)
    const yesterdayStr = addDaysToDateString(todayStr, -1);

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
//
// 月ごとのページ送り(前月/次月ボタン)は廃止した。月をまたぐたびに表示が切り替わり、
// 月末→月初と続いている連続記録が2ページに割れて「続いているのか途切れたのか」が
// 読み取れなかったため。代わりに直近CALENDAR_HEATMAP_WEEKS週を1枚に並べる
// 連続ヒートマップ(縦=曜日、横=週。右端が今週)にしている。
function initCalendarControls() {
    // ページ送りが無くなったため、初期描画で右端(今週)まで横スクロールを寄せるだけ。
    // renderCalendar()の中で毎回行う(描画のたびに幅が変わりうるため)。
}

function renderCalendar() {
    if (!DOM.calendarDays) return;

    const todayStr = getTodayStr();
    const today = new Date(todayStr + 'T00:00:00');
    if (isNaN(today.getTime())) return;
    const DAY_MS = 24 * 60 * 60 * 1000;

    // 右端の列は「今週」。週の始まりは日曜なので、今日の週の土曜まで描いて
    // 未来の日は色も操作も無効なプレースホルダーにする(列の高さを揃えるため)。
    const lastCellDate = new Date(today.getTime() + (6 - today.getDay()) * DAY_MS);
    const totalCells = CALENDAR_HEATMAP_WEEKS * 7;
    const firstCellDate = new Date(lastCellDate.getTime() - (totalCells - 1) * DAY_MS);

    const toDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // O(W) Group workouts by date beforehand for fast O(1) lookup in render loop
    const workoutsByDate = {};
    state.workouts.forEach(w => {
        if (!workoutsByDate[w.date]) {
            workoutsByDate[w.date] = [];
        }
        workoutsByDate[w.date].push(w);
    });

    // Group cardio/weight logs by date (それぞれ日付ごとに高々1件)
    const cardioByDate = {};
    state.cardioLogs.forEach(c => { cardioByDate[c.date] = c; });
    const weightByDate = {};
    state.weightLogs.forEach(w => { weightByDate[w.date] = w; });

    DOM.calendarDays.innerHTML = '';
    DOM.calendarDays.style.setProperty('--calendar-weeks', String(CALENDAR_HEATMAP_WEEKS));

    // 月ラベル。各週の列の上に、その週で新しい月が始まる場合だけ月名を置く。
    // 1列ぶんの幅しか無いので、ラベルは列の左端を基準にはみ出して表示する(CSS側でoverflow:visible)。
    const monthsEl = document.getElementById('calendar-months');
    if (monthsEl) {
        monthsEl.innerHTML = '';
        monthsEl.style.setProperty('--calendar-weeks', String(CALENDAR_HEATMAP_WEEKS));
    }

    for (let week = 0; week < CALENDAR_HEATMAP_WEEKS; week++) {
        if (!monthsEl) break;
        const label = document.createElement('span');
        label.classList.add('calendar-month-label');
        // その週(日〜土)に「1日」が含まれていれば月の始まり
        for (let d = 0; d < 7; d++) {
            const date = new Date(firstCellDate.getTime() + (week * 7 + d) * DAY_MS);
            if (date.getDate() === 1) {
                label.textContent = `${date.getMonth() + 1}月`;
                break;
            }
        }
        monthsEl.appendChild(label);
    }

    // セルは列(週)ごとに上から日〜土。CSSのgrid-auto-flow:columnで縦に流れる
    for (let i = 0; i < totalCells; i++) {
        const week = Math.floor(i / 7);
        const weekday = i % 7;
        const date = new Date(firstCellDate.getTime() + (week * 7 + weekday) * DAY_MS);
        const dateStr = toDateStr(date);

        const dayCell = document.createElement('div');
        dayCell.classList.add('calendar-day');

        if (date.getTime() > today.getTime()) {
            // 未来日。列の形を保つためだけのプレースホルダー
            dayCell.classList.add('empty');
            DOM.calendarDays.appendChild(dayCell);
            continue;
        }

        if (dateStr === todayStr) {
            dayCell.classList.add('today');
        }

        // 日付をクリックすると、その日の全記録(筋トレ・有酸素・体重)を
        // 横断的にまとめた日別サマリーモーダルを開く。記録の有無に関わらず全日をクリック可能にする
        // (記録が無い日でも「この日に記録を追加」からすぐ入力できるようにするため)
        dayCell.addEventListener('click', () => {
            openDaySummaryModal(dateStr);
        });

        // セルが小さく日付の数字は入らないので、日付はツールチップの先頭に置く
        const titleParts = [`${date.getMonth() + 1}/${date.getDate()}`];

        // このカレンダーは「運動した日が一目で分かること」が目的なので、塗り分けるのは
        //   トレーニングした日(走った日を含む) = 濃 / 走っただけの日 = 中
        // の2段階だけにする。体重を測っただけの日は運動していないため塗らない
        // (ほぼ毎日測るので薄い色が全面に広がり、運動した日とのコントラストが落ちていた)。
        // 体重の記録有無はツールチップ(title)には残す。
        const dayWorkouts = workoutsByDate[dateStr];
        const hasWorkout = dayWorkouts && dayWorkouts.length > 0;
        const hasCardio = !!cardioByDate[dateStr];
        const hasWeight = !!weightByDate[dateStr];

        if (hasWorkout) {
            dayCell.classList.add('cal-intensity-strong');
            titleParts.push(`トレーニング記録 ${dayWorkouts.length}件`);
        } else if (hasCardio) {
            dayCell.classList.add('cal-intensity-medium');
        }
        if (hasCardio) titleParts.push('有酸素の記録あり');
        if (hasWeight) titleParts.push('体重の記録あり');
        if (titleParts.length === 1) titleParts.push('記録なし');

        dayCell.setAttribute('title', titleParts.join(' | '));

        DOM.calendarDays.appendChild(dayCell);
    }

    const rangeLabel = document.getElementById('calendar-range-label');
    if (rangeLabel) {
        rangeLabel.textContent = `${firstCellDate.getMonth() + 1}/${firstCellDate.getDate()} 〜 ${today.getMonth() + 1}/${today.getDate()}`;
    }

    // 直近が見えている状態で始めたいので、横スクロールは右端に寄せる
    const scroll = document.getElementById('calendar-scroll');
    if (scroll) scroll.scrollLeft = scroll.scrollWidth;
}

// ==========================================
// メンテナンスカロリー設定（ダッシュボードのカロリーバランスカードに同居）
// ==========================================

function initDashboardControls() {
    // 体重推移グラフの表示期間切替(1週間/1ヶ月)
    document.querySelectorAll('.chart-period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const days = parseInt(btn.getAttribute('data-days'));
            if (!days || days === weightChartPeriodDays) return;
            weightChartPeriodDays = days;
            document.querySelectorAll('.chart-period-btn').forEach(b => {
                b.classList.toggle('active', b === btn);
            });
            renderWeightChart();
        });
    });

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

    // 週間ランニング目標距離の編集。計画タブの一括編集画面を廃止したため、
    // この値が表示されているこのカードで直接編集できるようにしている
    // (エディタの実装はjs/plan.jsのopenInlineEditorを共用)。
    const runTargetBtn = document.getElementById('btn-edit-run-target');
    const runTargetEditor = document.getElementById('run-target-editor');
    if (runTargetBtn && runTargetEditor) {
        runTargetBtn.addEventListener('click', () => {
            if (!runTargetEditor.classList.contains('is-hidden')) {
                runTargetEditor.classList.add('is-hidden');
                runTargetEditor.innerHTML = '';
                return;
            }
            const s = state.planSettings || DEFAULT_PLAN_SETTINGS;
            openInlineEditor(runTargetEditor, [
                { key: 'weeklyRunDistanceTarget', label: '週間ランニング目標距離 (km)', step: '0.1', min: 0.1 }
            ], s, (values) => {
                const settings = state.planSettings || Object.assign({}, DEFAULT_PLAN_SETTINGS);
                settings.weeklyRunDistanceTarget = values.weeklyRunDistanceTarget;
                state.planSettings = settings;
                saveDataAndSync();
                runTargetEditor.classList.add('is-hidden');
                runTargetEditor.innerHTML = '';
                showToast(`週間ランニング目標を ${values.weeklyRunDistanceTarget} km に変更しました`);
                updateDashboard();
                renderPlanTab();
            });
        });
    }
}

// メンテナンスカロリー(生活代謝の基準線)を実績から再計算する。
// 算出式はlib/data-utils.jsのcomputeActivityProfileに一本化している
// (以前はここにBMR 23×体重・PAL閾値(直近30日で12/8/4回)を別実装で持っており、
//  計画タブのTDEE推定と同じ意味の値が2箇所で微妙に食い違う状態だった)。
//
// 採用するのはprofile.tdeeではなくprofile.baseBurn。
// state.maintenanceCaloriesは「運動分を含まない基準線」であり、
// ダッシュボードでは maintenance + 有酸素 + 筋トレ で総消費を組み立てるため、
// ここに運動分を含むtdeeを入れると二重計上になる。
// v1.21.0でPALが筋トレ頻度に連動しなくなったので、baseBurnは本当に運動を含まない
// 値になった(それ以前はPAL経由で筋トレ分が暗黙に入っており、なお二重計上だった)。
function calculateFluidMaintenance() {
    const latestWeight = getLatestWeight();
    const profile = getActivityProfile(latestWeight);
    const calculatedCalories = profile.baseBurn;

    // Apply to input and state
    if (DOM.maintenanceInput) {
        DOM.maintenanceInput.value = calculatedCalories;
    }
    state.maintenanceCalories = calculatedCalories;
    saveDataAndSync();

    showToast(`メンテナンスカロリーを再計算しました：${calculatedCalories} kcal (基礎${profile.bmr}×活動${profile.pal}「${getLifestyleLevelLabel(profile.pal)}」, 最新体重: ${latestWeight.toFixed(1)}kg)`);
    updateDashboard();
}

// 体重推移グラフの表示期間(日数)。ヘッダーの「1週間/1ヶ月」トグルで切り替える(デフォルト1ヶ月)
let weightChartPeriodDays = 30;

function renderWeightChart() {
    const theme = getChartThemeColors();
    const canvas = document.getElementById('weightChart');
    if (!canvas || !DOM.noWeightData) return;

    const ctx = canvas.getContext('2d');

    // 表示期間: 今日からweightChartPeriodDays日分の日付ウィンドウで絞り込む
    // (「最近N件」ではなく日数で切ることで、記録の抜けがあっても期間の意味が変わらない)
    const windowStart = new Date(getTodayStr() + 'T00:00:00');
    windowStart.setDate(windowStart.getDate() - (weightChartPeriodDays - 1));
    const startIndex = state.weightLogs.findIndex(l => {
        const d = new Date(l.date + 'T00:00:00');
        return !isNaN(d.getTime()) && d >= windowStart;
    });

    if (state.weightLogs.length === 0 || startIndex === -1) {
        DOM.noWeightData.style.display = 'block';
        if (state.charts.weight) {
            try { state.charts.weight.destroy(); } catch(e){}
            state.charts.weight = null;
        }
        if (DOM.weightChangeSummary) DOM.weightChangeSummary.textContent = '';
        if (DOM.drinkingImpactSummary) DOM.drinkingImpactSummary.textContent = '';
        return;
    }

    DOM.noWeightData.style.display = 'none';

    // 移動平均は表示ウィンドウより前の実績も踏まえて計算してから、表示期間分だけ切り出す
    // (期間内だけを渡すと、グラフ左端付近の平均が「本当は分かるはずの過去データ」を
    //  使えずに不正確になるため)
    const movingAverages = computeMovingAverage(state.weightLogs, WEIGHT_TREND_WINDOW_DAYS);
    const recentLogs = state.weightLogs.slice(startIndex);
    const recentAverages = movingAverages.slice(startIndex);

    const labels = recentLogs.map(l => {
        const parts = l.date.split('-');
        return parts.length === 3 ? `${parseInt(parts[1])}/${parseInt(parts[2])}` : l.date;
    });
    const weights = recentLogs.map(l => l.weight);
    const averages = recentAverages.map(a => a.average);

    // 日々の変動ノイズに埋もれがちな傾向を、要約テキストとしても添える
    if (DOM.weightChangeSummary) {
        // 2点の生の差ではなく移動平均どうしの差を取る(測定ノイズを約1/√7に落とす)
        const change = computeWeightTrendChange(state.weightLogs, WEIGHT_TREND_WINDOW_DAYS, WEIGHT_TREND_WINDOW_DAYS);
        if (change === null) {
            DOM.weightChangeSummary.textContent = '';
        } else {
            const sign = change > 0 ? '+' : '';
            const trendClass = change < 0 ? 'weight-change-down' : (change > 0 ? 'weight-change-up' : '');
            DOM.weightChangeSummary.className = `weight-change-summary ${trendClass}`;
            DOM.weightChangeSummary.textContent = `直近${WEIGHT_TREND_WINDOW_DAYS}日間の傾向 ${sign}${change}kg`;
        }
    }

    // 飲み会翌日の平均体重変化(表示ウィンドウに関わらず全記録から集計)
    if (DOM.drinkingImpactSummary) {
        const impact = computeDrinkingWeightImpact(state.weightLogs, state.drinkingLogs);
        if (impact === null) {
            DOM.drinkingImpactSummary.textContent = '';
        } else {
            const impactSign = impact.avgDelta > 0 ? '+' : '';
            DOM.drinkingImpactSummary.textContent = `🍻 飲み会翌日は平均 ${impactSign}${impact.avgDelta.toFixed(1)}kg (${impact.count}回)`;
        }
    }

    const colorPrimary = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#0017c1';
    const colorSecondary = getComputedStyle(document.documentElement).getPropertyValue('--color-secondary').trim() || '#4d4d4d';
    const colorWarning = getComputedStyle(document.documentElement).getPropertyValue('--color-warning').trim() || '#ac3e00';

    if (state.charts.weight) {
        try { state.charts.weight.destroy(); } catch(e){}
    }

    // 飲み会だった日は点の色・大きさを変えて目立たせる(飲み会前後の体重変化を追いやすくする)
    const drinkingSet = new Set(state.drinkingLogs.map(d => d.date));
    const pointColors = recentLogs.map(l => drinkingSet.has(l.date) ? colorWarning : colorPrimary);
    const pointRadii = recentLogs.map(l => drinkingSet.has(l.date) ? 6 : 4);

    const datasets = [
        {
            label: '体重 (kg)',
            data: weights,
            borderColor: colorPrimary,
            backgroundColor: hexToRgba(colorPrimary, 0.1),
            borderWidth: 2.5,
            // 体重は日々の実測点そのものを見たいので、点と点を直線で結ぶ(スムージングなし)。
            // tension>0だと存在しない中間の体重を曲線が作ってしまい、増減の転換点も鈍る。
            tension: 0,
            fill: true,
            pointBackgroundColor: pointColors,
            pointRadius: pointRadii
        },
        {
            label: `${WEIGHT_TREND_WINDOW_DAYS}日移動平均`,
            data: averages,
            borderColor: colorSecondary,
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [4, 4],
            tension: 0,
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 3
        }
    ];

    // 計画上の予測体重を実測と同じ日付軸に重ねて表示し、計画が当たっているか一目で分かるようにする。
    // v1.21.0から、計画タブのロードマップ表とまったく同じ関数・同じ前提(選択中のペースと
    // 開始日近くの実測体重)で引く。以前はここだけが保存済みマイルストーンの折れ線を使っており、
    // ペースを変えてもグラフの予測線は「計画に反映」を押すまで動かず、表と食い違っていた。
    const plan = state.planSettings;
    if (plan && plan.weightPlanStartDate) {
        const planBasis = getPlanProjectionBasis();
        const plannedSeries = computePlannedWeightSeries(
            recentLogs.map(l => l.date),
            plan.weightPlanStartDate,
            planBasis.startWeight,
            planBasis.dailyDeficit,
            planBasis.kcalPerKgPerDay
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
                    labels: { color: theme.text }
                },
                tooltip: {
                    callbacks: {
                        // 飲み会だった日はツールチップにも明示する(点の色だけだと意味が伝わらないため)
                        afterTitle: (items) => {
                            const log = items.length > 0 ? recentLogs[items[0].dataIndex] : null;
                            return log && drinkingSet.has(log.date) ? '🍻 飲み会' : '';
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    // 斜めの文字は読みにくいので横書きのまま、重なる分は間引く
                    ticks: { color: theme.text, maxRotation: 0, autoSkip: true }
                },
                y: {
                    grid: { color: theme.grid },
                    ticks: { color: theme.text },
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
    const todayStr = getTodayStr();

    // Generate dates window（フィットネス上の今日を終端にする）
    for (let i = CARDIO_DAYS_WINDOW - 1; i >= 0; i--) {
        const ymd = addDaysToDateString(todayStr, -i);
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

    // 摂取カロリー(食事記録)。未記録の日は0(=線が0に落ちる)のままにする
    // (「記録していない=食べていない」ではないが、そう見せてしまうより、
    //  記録した日だけ正しく比較できる方を優先する。将来的には未記録日を欠測扱いにしたい)
    const intakeCalories = datesYmd.map(ymd => {
        const meal = state.mealLogs.find(m => m.date === ymd);
        return sumMealCalories(meal);
    });

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
                    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#0017c1',
                    borderRadius: 4,
                    barThickness: 16
                },
                {
                    label: 'メンテナンス基準',
                    data: maintenanceLimit,
                    type: 'line',
                    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--color-secondary').trim() || '#4d4d4d',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 0
                },
                {
                    label: '摂取カロリー（食事記録）',
                    data: intakeCalories,
                    type: 'line',
                    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--color-warning').trim() || '#ac3e00',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    fill: false,
                    pointRadius: 3,
                    pointHoverRadius: 4,
                    tension: 0.2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: theme.text }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: theme.text }
                },
                y: {
                    grid: { color: theme.grid },
                    ticks: { color: theme.text },
                    beginAtZero: true
                }
            }
        }
    });
}
