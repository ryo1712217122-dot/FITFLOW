// FITFLOW - 最適化計画タブ + ダッシュボードに置く計画サマリーウィジェット
// v2再構成でテンプレートのインラインstyleをすべてcss/pages/plan.cssのクラスに置き換えた。
// 表示内容・計算式・編集/再計算の挙動は変更していない。

function renderPlanTab(isEditing = false) {
    const container = document.getElementById('plan-container');
    if (!container) return;

    const s = state.planSettings || DEFAULT_PLAN_SETTINGS;

    // Calculations
    const totalDays = (parseInt(s.daysNormal) || 0) + (parseInt(s.daysMilkTea) || 0) + (parseInt(s.daysEvent) || 0);
    const daysDenominator = totalDays > 0 ? totalDays : 7;
    const avgIntake = Math.round(
        ((parseInt(s.intakeNormal) || 0) * (parseInt(s.daysNormal) || 0) +
         (parseInt(s.intakeMilkTea) || 0) * (parseInt(s.daysMilkTea) || 0) +
         (parseInt(s.intakeEvent) || 0) * (parseInt(s.daysEvent) || 0)) / daysDenominator
    );
    const avgExpenditure = Math.round(
        (parseFloat(s.baseBurn) || 0) + ((parseFloat(s.runBurn) || 0) * (parseFloat(s.runCount) || 0)) / 7
    );
    const deficit = avgExpenditure - avgIntake;

    if (isEditing) {
        container.innerHTML = `
            <div class="card plan-hero">
                <div class="card-body plan-hero-body">
                    <div class="plan-hero-left">
                        <div class="plan-hero-icon">
                            <i data-lucide="target"></i>
                        </div>
                        <div>
                            <h2 class="plan-hero-title">最適化計画の編集</h2>
                            <p class="plan-hero-subtitle">計画パラメーターをカスタマイズします。</p>
                        </div>
                    </div>
                    <div class="plan-hero-actions">
                        <button class="btn btn-secondary btn-sm" id="btn-cancel-plan-edit" type="button">キャンセル</button>
                        <button class="btn btn-primary btn-sm" id="btn-save-plan-edit" type="button">設定を保存</button>
                    </div>
                </div>
            </div>

            <div class="settings-grid">
                <!-- Calorie Target Edit Card -->
                <div class="card">
                    <div class="card-header">
                        <div class="header-title">
                            <i data-lucide="flame"></i>
                            <h3>摂取・消費カロリー目標の設定</h3>
                        </div>
                    </div>
                    <div class="card-body">
                        <h4 class="plan-section-heading">摂取カロリー目標設定</h4>
                        <div class="plan-tier-list">
                            <div class="plan-tier-box tier-normal">
                                <strong class="plan-tier-title">① 通常日</strong>
                                <div class="plan-tier-fields">
                                    <div class="form-group">
                                        <label class="text-2xs">目標カロリー (kcal)</label>
                                        <input type="number" id="edit-intake-normal" value="${s.intakeNormal}" class="width-full">
                                    </div>
                                    <div class="form-group">
                                        <label class="text-2xs">週の日数</label>
                                        <input type="number" id="edit-days-normal" value="${s.daysNormal}" class="width-full">
                                    </div>
                                </div>
                            </div>

                            <div class="plan-tier-box tier-milktea">
                                <strong class="plan-tier-title">② ミルク紅茶日</strong>
                                <div class="plan-tier-fields">
                                    <div class="form-group">
                                        <label class="text-2xs">目標カロリー (kcal)</label>
                                        <input type="number" id="edit-intake-milktea" value="${s.intakeMilkTea}" class="width-full">
                                    </div>
                                    <div class="form-group">
                                        <label class="text-2xs">週の日数</label>
                                        <input type="number" id="edit-days-milktea" value="${s.daysMilkTea}" class="width-full">
                                    </div>
                                </div>
                            </div>

                            <div class="plan-tier-box tier-event">
                                <strong class="plan-tier-title">③ イベント日（ラーメン/飲み会）</strong>
                                <div class="plan-tier-fields">
                                    <div class="form-group">
                                        <label class="text-2xs">目標カロリー (kcal)</label>
                                        <input type="number" id="edit-intake-event" value="${s.intakeEvent}" class="width-full">
                                    </div>
                                    <div class="form-group">
                                        <label class="text-2xs">週の日数</label>
                                        <input type="number" id="edit-days-event" value="${s.daysEvent}" class="width-full">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <h4 class="plan-section-heading secondary">消費カロリー目標設定</h4>
                        <div class="plan-burn-box">
                            <div class="form-group">
                                <label class="text-2xs">ベース消費 (kcal/日 - 研究室・バイト含む)</label>
                                <input type="number" id="edit-base-burn" value="${s.baseBurn}" class="width-full">
                            </div>
                            <div class="plan-tier-fields">
                                <div class="form-group">
                                    <label class="text-2xs">ラン1回の消費 (kcal)</label>
                                    <input type="number" id="edit-run-burn" value="${s.runBurn}" class="width-full">
                                </div>
                                <div class="form-group">
                                    <label class="text-2xs">週のラン回数</label>
                                    <input type="number" id="edit-run-count" value="${s.runCount}" class="width-full">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Roadmap Edit Card -->
                <div class="card">
                    <div class="card-header">
                        <div class="header-title">
                            <i data-lucide="trending-down"></i>
                            <h3>体重減少ロードマップの設定</h3>
                        </div>
                    </div>
                    <div class="card-body">
                        <p class="settings-desc">ロードマップ上の各目標体重 (kg) を設定します。</p>
                        <div class="plan-roadmap-edit-list">
                            <div class="form-group">
                                <label class="text-xs">開始時体重 (kg)</label>
                                <input type="number" step="0.1" id="edit-weight-start" value="${s.weightStart}" class="width-full">
                            </div>
                            <div class="form-group">
                                <label class="text-xs">1ヶ月目目標 (kg)</label>
                                <input type="number" step="0.1" id="edit-weight-1month" value="${s.weight1Month}" class="width-full">
                            </div>
                            <div class="form-group">
                                <label class="text-xs">3ヶ月目目標 (kg)</label>
                                <input type="number" step="0.1" id="edit-weight-3month" value="${s.weight3Month}" class="width-full">
                            </div>
                            <div class="form-group">
                                <label class="text-xs">最終均衡点目標 (kg)</label>
                                <input type="number" step="0.1" id="edit-weight-equilibrium" value="${s.weightEquilibrium}" class="width-full">
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Guidelines Edit Card -->
            <div class="card margin-top-1-5">
                <div class="card-header">
                    <div class="header-title">
                        <i data-lucide="shield-alert"></i>
                        <h3>防衛ラインと習慣ルールの設定</h3>
                    </div>
                </div>
                <div class="card-body plan-guidelines-edit-body">
                    <div class="form-group">
                        <label class="plan-field-label-strong">睡眠目標時間 (時間)</label>
                        <input type="number" step="0.1" id="edit-sleep-target" value="${s.sleepTarget}" class="width-full">
                    </div>
                    <div class="form-group">
                        <label class="plan-field-label-strong">間食ルール（防衛ライン②）</label>
                        <textarea id="edit-snack-rule" rows="2" class="width-full plan-textarea">${escapeHtml(s.snackRule)}</textarea>
                    </div>
                    <div class="form-group">
                        <label class="plan-field-label-strong">運動・筋トレ方針（防衛ライン③）</label>
                        <textarea id="edit-workout-rule" rows="2" class="width-full plan-textarea">${escapeHtml(s.workoutRule)}</textarea>
                    </div>
                </div>
            </div>
        `;

        // Bind button actions
        document.getElementById('btn-cancel-plan-edit').addEventListener('click', () => {
            renderPlanTab(false);
        });
        document.getElementById('btn-save-plan-edit').addEventListener('click', () => {
            savePlanSettings();
        });
    } else {
        container.innerHTML = `
            <div class="card plan-hero">
                <div class="card-body plan-hero-body">
                    <div class="plan-hero-left">
                        <div class="plan-hero-icon">
                            <i data-lucide="target"></i>
                        </div>
                        <div>
                            <h2 class="plan-hero-title">最適化ライフスタイル計画</h2>
                            <p class="plan-hero-subtitle">熱力学モデルと生活スケジュールに基づいた確実な減量ロードマップ</p>
                        </div>
                    </div>
                    <button class="btn btn-primary btn-sm" id="btn-trigger-plan-edit" type="button">
                        <i data-lucide="edit"></i> 計画を編集
                    </button>
                </div>
            </div>

            <div class="settings-grid">
                <!-- Calorie Target Card -->
                <div class="card">
                    <div class="card-header">
                        <div class="header-title">
                            <i data-lucide="flame"></i>
                            <h3>摂取・消費カロリー目標</h3>
                        </div>
                    </div>
                    <div class="card-body">
                        <h4 class="plan-section-heading">摂取カロリー予算（週平均 ${avgIntake} kcal/日）</h4>
                        <div class="plan-sub-items">
                            <div class="plan-tier-box compact tier-normal">
                                <div class="plan-tier-header">
                                    <span>① 通常日（週${s.daysNormal}回）</span>
                                    <span class="plan-tier-kcal">${s.intakeNormal} kcal</span>
                                </div>
                                <div class="plan-tier-breakdown">
                                    <div>朝: 500 kcal</div>
                                    <div>昼: 450 kcal</div>
                                    <div>間食: 0 kcal</div>
                                    <div>夕: 800 kcal</div>
                                </div>
                            </div>
                            <div class="plan-tier-box compact tier-milktea">
                                <div class="plan-tier-header">
                                    <span>② ミルク紅茶日（週${s.daysMilkTea}回）</span>
                                    <span class="plan-tier-kcal">${s.intakeMilkTea} kcal</span>
                                </div>
                                <div class="plan-tier-breakdown">
                                    <div>朝: 500 kcal</div>
                                    <div>昼: 450 kcal</div>
                                    <div>間食: 216 kcal</div>
                                    <div>夕: 800 kcal</div>
                                </div>
                            </div>
                            <div class="plan-tier-box compact tier-event">
                                <div class="plan-tier-header">
                                    <span>③ イベント日（週${s.daysEvent}回）</span>
                                    <span class="plan-tier-kcal">${s.intakeEvent} kcal</span>
                                </div>
                                <div class="plan-tier-breakdown">
                                    <div>朝: 500 kcal</div>
                                    <div>昼: 280 kcal</div>
                                    <div>間食: 0 kcal</div>
                                    <div>夕: 1,770 kcal</div>
                                </div>
                            </div>
                        </div>

                        <div class="plan-section-header-row">
                            <h4 class="plan-section-heading secondary">消費カロリー予算（週平均 ${avgExpenditure} kcal/日）</h4>
                            <button class="btn btn-secondary btn-sm" id="btn-recalc-plan-burn" type="button" title="直近の筋トレ・有酸素の実績からベース消費とラン消費を再計算します">
                                <i data-lucide="refresh-cw"></i> 実績から再計算
                            </button>
                        </div>
                        <div class="plan-summary-box">
                            <div class="plan-summary-box-row">
                                <span>ベース消費（研究室・バイト含む）</span>
                                <span>${s.baseBurn} kcal/日</span>
                            </div>
                            <div class="plan-summary-box-row">
                                <span>有酸素ラン（週${s.runCount}回 4km走）</span>
                                <span>+${s.runBurn} kcal/回 (平均 +${Math.round(s.runBurn * s.runCount / 7)} kcal/日)</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Roadmap Card -->
                <div class="card">
                    <div class="card-header flex-header">
                        <div class="header-title">
                            <i data-lucide="trending-down"></i>
                            <h3>体重減少目標ロードマップ</h3>
                        </div>
                        <button class="btn btn-secondary btn-sm" id="btn-recalc-plan-roadmap" type="button" title="最新の体重と消費カロリー予算から、開始時・1ヶ月目・3ヶ月目の目標を再計算します">
                            <i data-lucide="refresh-cw"></i> 実績から再計算
                        </button>
                    </div>
                    <div class="card-body">
                        <p class="settings-desc">目標アンダーカロリー（約${deficit} kcal/日）による体重変化シミュレーションです。</p>
                        <div class="roadmap-timeline">
                            <div class="roadmap-item">
                                <div class="roadmap-dot"></div>
                                <strong class="roadmap-label">開始時</strong>
                                <div class="roadmap-value">${s.weightStart} kg</div>
                            </div>
                            <div class="roadmap-item primary">
                                <div class="roadmap-dot"></div>
                                <strong class="roadmap-label">1ヶ月目目標</strong>
                                <div class="roadmap-value">${s.weight1Month} kg <span class="roadmap-delta">(-${(s.weightStart - s.weight1Month).toFixed(1)}kg)</span></div>
                                <p class="roadmap-note">食生活の最適化移行期。水分と糖質が抜ける初期減少フェーズ。</p>
                            </div>
                            <div class="roadmap-item primary">
                                <div class="roadmap-dot"></div>
                                <strong class="roadmap-label">3ヶ月目目標</strong>
                                <div class="roadmap-value">${s.weight3Month} kg <span class="roadmap-delta">(-${(s.weightStart - s.weight3Month).toFixed(1)}kg)</span></div>
                                <p class="roadmap-note">総減量幅 ${(s.weightStart - s.weight3Month).toFixed(1)}kg。膝への衝撃が劇的に減り、体が軽くなることを実感できます。</p>
                            </div>
                            <div class="roadmap-item secondary">
                                <div class="roadmap-dot"></div>
                                <strong class="roadmap-label">最終均衡点（長期継続時の収束値）</strong>
                                <div class="roadmap-value">${s.weightEquilibrium} kg <span class="roadmap-delta">(-${(s.weightStart - s.weightEquilibrium).toFixed(1)}kg)</span></div>
                                <p class="roadmap-note">運動・食事の入力と出力が動的平衡状態に達する標準健康体型。</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Guidelines Card -->
            <div class="card margin-top-1-5">
                <div class="card-header">
                    <div class="header-title">
                        <i data-lucide="shield-alert"></i>
                        <h3>習慣遵守の防衛ライン（致命的コントロールポイント）</h3>
                    </div>
                </div>
                <div class="card-body">
                    <div class="plan-guidelines-grid">
                        <div class="plan-guideline-box warning">
                            <div class="plan-guideline-header">
                                <i data-lucide="moon"></i>
                                <strong>① 睡眠時間は最低 ${s.sleepTarget} 時間を死守</strong>
                            </div>
                            <p class="plan-guideline-body">寝不足のままトレーニングすると、筋肉が分解され脂肪が蓄積しやすくなります。睡眠を最優先してください。</p>
                        </div>

                        <div class="plan-guideline-box danger">
                            <div class="plan-guideline-header">
                                <i data-lucide="ban"></i>
                                <strong>② 間食コントロールと大盛り阻止</strong>
                            </div>
                            <p class="plan-guideline-body">${escapeHtml(s.snackRule)}</p>
                        </div>

                        <div class="plan-guideline-box primary">
                            <div class="plan-guideline-header">
                                <i data-lucide="dumbbell"></i>
                                <strong>③ 運動・筋トレ方針</strong>
                            </div>
                            <p class="plan-guideline-body">${escapeHtml(s.workoutRule)}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Bind edit button action
        document.getElementById('btn-trigger-plan-edit').addEventListener('click', () => {
            renderPlanTab(true);
        });

        // Bind recalculate-from-actuals buttons
        const recalcBurnBtn = document.getElementById('btn-recalc-plan-burn');
        if (recalcBurnBtn) {
            recalcBurnBtn.addEventListener('click', () => {
                recalculatePlanExpenditure();
            });
        }
        const recalcRoadmapBtn = document.getElementById('btn-recalc-plan-roadmap');
        if (recalcRoadmapBtn) {
            recalcRoadmapBtn.addEventListener('click', () => {
                recalculatePlanRoadmap();
            });
        }
    }

    if (window.lucide) {
        lucide.createIcons();
    }
}

function savePlanSettings() {
    const s = state.planSettings || {};

    s.intakeNormal = parseInt(document.getElementById('edit-intake-normal').value) || 0;
    s.daysNormal = parseInt(document.getElementById('edit-days-normal').value) || 0;
    s.intakeMilkTea = parseInt(document.getElementById('edit-intake-milktea').value) || 0;
    s.daysMilkTea = parseInt(document.getElementById('edit-days-milktea').value) || 0;
    s.intakeEvent = parseInt(document.getElementById('edit-intake-event').value) || 0;
    s.daysEvent = parseInt(document.getElementById('edit-days-event').value) || 0;

    s.baseBurn = parseInt(document.getElementById('edit-base-burn').value) || 0;
    s.runBurn = parseInt(document.getElementById('edit-run-burn').value) || 0;
    s.runCount = parseInt(document.getElementById('edit-run-count').value) || 0;

    s.weightStart = parseFloat(document.getElementById('edit-weight-start').value) || 0.0;
    s.weight1Month = parseFloat(document.getElementById('edit-weight-1month').value) || 0.0;
    s.weight3Month = parseFloat(document.getElementById('edit-weight-3month').value) || 0.0;
    s.weightEquilibrium = parseFloat(document.getElementById('edit-weight-equilibrium').value) || 0.0;

    s.sleepTarget = parseFloat(document.getElementById('edit-sleep-target').value) || 0.0;
    s.snackRule = document.getElementById('edit-snack-rule').value.trim();
    s.workoutRule = document.getElementById('edit-workout-rule').value.trim();

    state.planSettings = s;
    saveData();
    showToast('最適化計画の変更を保存しました');

    renderPlanTab(false);
    renderPlanSidebarWidget();
}

// 実績（体重・筋トレ頻度・有酸素ログ）から消費カロリー予算（ベース消費・ラン消費・週回数）を再計算する
function recalculatePlanExpenditure() {
    const s = state.planSettings || Object.assign({}, DEFAULT_PLAN_SETTINGS);
    const latestWeight = getLatestWeight();

    // 1. ベース消費: メンテナンスカロリー自動計算と同じBMR×活動係数モデル
    //    (直近30日の筋トレ頻度からPALを決定。ランの消費分はここでは含めず、runBurn/runCount側で別途加算する)
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const workoutsLast30Days = state.workouts.filter(w => {
        if (!w.date) return false;
        const wDate = new Date(w.date + 'T00:00:00');
        return wDate >= thirtyDaysAgo && wDate <= today;
    }).length;

    const bmr = 23 * latestWeight;
    let pal = 1.2;
    if (workoutsLast30Days >= 12) pal = 1.725;
    else if (workoutsLast30Days >= 8) pal = 1.55;
    else if (workoutsLast30Days >= 4) pal = 1.375;
    const baseBurn = Math.round(bmr * pal);

    // 2. ラン消費: 直近28日間の有酸素ログから、1回あたり平均消費kcalと週あたり平均回数を算出
    const windowDays = 28;
    const windowStart = new Date();
    windowStart.setDate(today.getDate() - windowDays);
    const recentCardio = state.cardioLogs.filter(c => {
        if (!c.date) return false;
        const cDate = new Date(c.date + 'T00:00:00');
        return cDate >= windowStart && cDate <= today;
    });

    let runBurn = s.runBurn;
    let runCount = s.runCount;
    if (recentCardio.length > 0) {
        const totalCalories = recentCardio.reduce((sum, c) => sum + (c.calories || 0), 0);
        runBurn = Math.round(totalCalories / recentCardio.length);
        runCount = Math.round((recentCardio.length / windowDays) * 7 * 10) / 10;
    }

    s.baseBurn = baseBurn;
    s.runBurn = runBurn;
    s.runCount = runCount;
    state.planSettings = s;
    saveData();

    if (recentCardio.length > 0) {
        showToast(`消費カロリー予算を実績から再計算しました（ベース消費: ${baseBurn}kcal, ラン: ${runBurn}kcal×週${runCount}回）`);
    } else {
        showToast(`ベース消費を実績から再計算しました（${baseBurn}kcal）。直近28日の有酸素記録がないためラン消費は変更していません`);
    }

    renderPlanTab(false);
    renderPlanSidebarWidget();
}

// 実績（最新体重・現在の消費/摂取カロリー予算）から体重ロードマップ（開始時・1ヶ月目・3ヶ月目）を再計算する
// 最終均衡点は長期的な収束目安のため自動計算の対象外とし、手動設定のまま維持する
function recalculatePlanRoadmap() {
    if (!state.weightLogs || state.weightLogs.length === 0) {
        showToast('体重の記録がないため再計算できません。まず「記録する」タブで体重を記録してください');
        return;
    }

    const s = state.planSettings || Object.assign({}, DEFAULT_PLAN_SETTINGS);
    const latestWeight = getLatestWeight();

    // renderPlanTab と同じ式で、現在の計画設定に基づく週平均の摂取・消費カロリーを算出
    const totalDays = (parseInt(s.daysNormal) || 0) + (parseInt(s.daysMilkTea) || 0) + (parseInt(s.daysEvent) || 0);
    const daysDenominator = totalDays > 0 ? totalDays : 7;
    const avgIntake = Math.round(
        ((parseInt(s.intakeNormal) || 0) * (parseInt(s.daysNormal) || 0) +
         (parseInt(s.intakeMilkTea) || 0) * (parseInt(s.daysMilkTea) || 0) +
         (parseInt(s.intakeEvent) || 0) * (parseInt(s.daysEvent) || 0)) / daysDenominator
    );
    const avgExpenditure = Math.round(
        (parseFloat(s.baseBurn) || 0) + ((parseFloat(s.runBurn) || 0) * (parseFloat(s.runCount) || 0)) / 7
    );
    const deficit = avgExpenditure - avgIntake;

    const KCAL_PER_KG = 7700;
    let weight1Month = latestWeight;
    let weight3Month = latestWeight;
    if (deficit > 0) {
        weight1Month = Math.round((latestWeight - (deficit * 30) / KCAL_PER_KG) * 10) / 10;
        weight3Month = Math.round((latestWeight - (deficit * 90) / KCAL_PER_KG) * 10) / 10;
    }

    s.weightStart = latestWeight;
    s.weight1Month = weight1Month;
    s.weight3Month = weight3Month;
    state.planSettings = s;
    saveData();

    if (deficit > 0) {
        showToast(`体重ロードマップを実績から再計算しました（開始時: ${latestWeight.toFixed(1)}kg → 1ヶ月目 ${weight1Month}kg / 3ヶ月目 ${weight3Month}kg）`);
    } else {
        showToast(`開始時体重を${latestWeight.toFixed(1)}kgに更新しました。現在の計画はカロリー収支が赤字でないため、1ヶ月目・3ヶ月目の目標は変更していません`);
    }

    renderPlanTab(false);
    renderPlanSidebarWidget();
}

// ダッシュボードに設置する計画サマリーウィジェット（元は記録するタブのサイドにあった）
function renderPlanSidebarWidget() {
    const container = document.getElementById('plan-sidebar-widget-container');
    if (!container) return;

    const s = state.planSettings || DEFAULT_PLAN_SETTINGS;

    // Calculations
    const totalDays = (parseInt(s.daysNormal) || 0) + (parseInt(s.daysMilkTea) || 0) + (parseInt(s.daysEvent) || 0);
    const daysDenominator = totalDays > 0 ? totalDays : 7;
    const avgIntake = Math.round(
        ((parseInt(s.intakeNormal) || 0) * (parseInt(s.daysNormal) || 0) +
         (parseInt(s.intakeMilkTea) || 0) * (parseInt(s.daysMilkTea) || 0) +
         (parseInt(s.intakeEvent) || 0) * (parseInt(s.daysEvent) || 0)) / daysDenominator
    );

    container.innerHTML = `
        <div class="card plan-summary-widget">
            <div class="card-header plan-summary-widget-header">
                <div class="header-title plan-summary-widget-title-row">
                    <i data-lucide="target"></i>
                    <h3 class="plan-summary-widget-title">🎯 最適化計画要約</h3>
                </div>
            </div>
            <div class="card-body plan-summary-widget-body">
                <div class="plan-summary-section">
                    <strong class="plan-summary-section-title">摂取カロリー（平均 ${avgIntake} kcal/日）</strong>
                    <div class="plan-summary-list">
                        <div class="plan-summary-row">
                            <span>🌳 通常日 (週${s.daysNormal})</span>
                            <span class="plan-summary-value">${s.intakeNormal} kcal</span>
                        </div>
                        <div class="plan-summary-row">
                            <span>🍵 紅茶日 (週${s.daysMilkTea})</span>
                            <span class="plan-summary-value">${s.intakeMilkTea} kcal</span>
                        </div>
                        <div class="plan-summary-row">
                            <span>🍺 イベント日 (週${s.daysEvent})</span>
                            <span class="plan-summary-value">${s.intakeEvent} kcal</span>
                        </div>
                    </div>
                </div>

                <div class="plan-summary-section">
                    <strong class="plan-summary-section-title">運動・睡眠予算</strong>
                    <div class="plan-summary-list">
                        <div class="plan-summary-row">
                            <span>🏃 有酸素ラン (週${s.runCount}回)</span>
                            <span class="plan-summary-value">4km / 回 (+${s.runBurn} kcal)</span>
                        </div>
                        <div class="plan-summary-row">
                            <span>🛌 睡眠時間 (目標)</span>
                            <span class="plan-summary-value warning">最低 ${s.sleepTarget} 時間</span>
                        </div>
                    </div>
                </div>

                <div class="plan-summary-section">
                    <strong class="plan-summary-section-title">体重減少目標</strong>
                    <div class="plan-summary-list">
                        <div class="plan-summary-row">
                            <span>1ヶ月目目標</span>
                            <span class="plan-summary-value">${s.weight1Month} kg</span>
                        </div>
                        <div class="plan-summary-row">
                            <span>3ヶ月目目標</span>
                            <span class="plan-summary-value primary">${s.weight3Month} kg</span>
                        </div>
                        <div class="plan-summary-row">
                            <span>最終均衡点</span>
                            <span class="plan-summary-value secondary">${s.weightEquilibrium} kg</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    if (window.lucide) {
        lucide.createIcons();
    }
}
