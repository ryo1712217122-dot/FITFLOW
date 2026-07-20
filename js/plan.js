// FITFLOW - 最適化計画タブ
// v2再構成でテンプレートのインラインstyleをすべてcss/pages/plan.cssのクラスに置き換えた。
// 表示内容・計算式・編集/再計算の挙動は変更していない。

function renderPlanTab(isEditing = false) {
    const container = document.getElementById('plan-container');
    if (!container) return;

    const s = state.planSettings || DEFAULT_PLAN_SETTINGS;

    // 週平均カロリーの式はlib/data-utils.jsのcomputePlanCalorieAveragesに一本化している
    const { avgIntake, avgExpenditure, deficit } = computePlanCalorieAverages(s);
    const weekRunDistance = sumCardioDistanceForWeek(state.cardioLogs, getWeekStartDate(getLocalDateString()));

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
                                <strong class="plan-tier-title">② 少し甘えた日</strong>
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
                            <div class="form-group">
                                <label class="text-2xs">週間ランニング目標距離 (km)</label>
                                <input type="number" step="0.1" id="edit-weekly-run-distance-target" value="${s.weeklyRunDistanceTarget}" class="width-full">
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
                        <p class="settings-desc">ロードマップ上の各目標体重 (kg) を設定します。計画開始日は保存・再計算では変わりません（変更したい場合のみここで編集）。</p>
                        <div class="plan-roadmap-edit-list">
                            <div class="form-group">
                                <label class="text-xs">計画開始日</label>
                                <input type="date" id="edit-weight-plan-start-date" value="${s.weightPlanStartDate || ''}" class="width-full">
                            </div>
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

        `;

        // Bind button actions
        document.getElementById('btn-cancel-plan-edit').addEventListener('click', () => {
            renderPlanTab(false);
        });
        document.getElementById('btn-save-plan-edit').addEventListener('click', () => {
            savePlanSettings();
        });
    } else {
        // 減量シミュレーション: 最新体重と直近の記録(筋トレ頻度・有酸素)から
        // メンテナンスカロリーを推定し、選択中のペースで目標摂取3区分と予測体重を出す
        const latestWeight = getLatestWeight();
        const todayStr = getLocalDateString();
        const profile = computeActivityProfile(latestWeight, state.workouts, state.cardioLogs, todayStr);
        const pace = getSimulationPace(s);
        // 通常日の下限にはBMRを渡す(下限に当たると実効アンダーカロリーが目標より小さくなる)
        const sim = computeIntakeTiersForPace(
            profile.tdee, pace, s.daysNormal, s.daysMilkTea, s.daysEvent,
            SIM_INTAKE_DELTA_SWEET, SIM_INTAKE_DELTA_EVENT, profile.bmr);
        const proj1M = projectWeightAfterDays(latestWeight, sim.effectiveDailyDeficit, 30);
        const proj3M = projectWeightAfterDays(latestWeight, sim.effectiveDailyDeficit, 90);
        const paceButtonsHtml = SIM_PACE_OPTIONS.map(p => `
            <button type="button" class="plan-sim-pace-btn${p === pace ? ' active' : ''}" data-pace="${p}">月${p}kg</button>
        `).join('');

        container.innerHTML = `
            <div class="card plan-hero">
                <div class="card-body plan-hero-body">
                    <div class="plan-hero-left">
                        <div class="plan-hero-icon">
                            <i data-lucide="target"></i>
                        </div>
                        <div>
                            <h2 class="plan-hero-title">最適化ライフスタイル計画</h2>
                            <p class="plan-hero-subtitle">実績データに基づく減量シミュレーションとロードマップ</p>
                        </div>
                    </div>
                    <button class="btn btn-primary btn-sm" id="btn-trigger-plan-edit" type="button">
                        <i data-lucide="edit"></i> 計画を編集
                    </button>
                </div>
            </div>

            <!-- 減量シミュレーション: 実績→メンテナンスカロリー→目標摂取3区分→予測体重 -->
            <div class="card margin-top-1-5">
                <div class="card-header">
                    <div class="header-title">
                        <i data-lucide="calculator"></i>
                        <h3>減量シミュレーション（現在の体重と記録から算出）</h3>
                    </div>
                </div>
                <div class="card-body">
                    <div class="plan-sim-facts">
                        <div class="plan-sim-fact">
                            <span class="plan-sim-fact-label">現在の体重</span>
                            <span class="plan-sim-fact-value">${latestWeight.toFixed(1)} kg</span>
                        </div>
                        <div class="plan-sim-fact">
                            <span class="plan-sim-fact-label">メンテナンスカロリー(推定)</span>
                            <span class="plan-sim-fact-value">${profile.tdee} kcal/日</span>
                            <span class="plan-sim-fact-sub">基礎${profile.bmr}×活動${profile.pal}（${profile.palDesc}・直近30日${profile.workoutsLast30Days}回）${profile.runCount > 0 ? ` + ラン週${profile.runCount}回` : ''}</span>
                        </div>
                    </div>

                    <div class="plan-sim-pace-row">
                        <span class="plan-sim-pace-label">減量ペース</span>
                        <div class="plan-sim-pace-buttons">${paceButtonsHtml}</div>
                        <span class="plan-sim-fact-sub">アンダーカロリー 約${sim.effectiveDailyDeficit} kcal/日</span>
                    </div>
                    ${sim.clamped ? `<p class="plan-sim-clamp-warning">⚠️ このペースでは通常日が基礎代謝(${profile.bmr}kcal)を下回るため、下限で調整しています。実際の減量ペースは選択より緩やかになります。</p>` : ''}

                    <h4 class="plan-section-heading">目標摂取カロリー（週平均 ${sim.effectiveAvgIntake} kcal/日）</h4>
                    <div class="plan-sub-items">
                        <div class="plan-tier-box compact tier-normal">
                            <div class="plan-tier-header">
                                <span>🌳 通常日（週${s.daysNormal}回）</span>
                                <span class="plan-tier-kcal">${sim.intakeNormal} kcal</span>
                            </div>
                        </div>
                        <div class="plan-tier-box compact tier-milktea">
                            <div class="plan-tier-header">
                                <span>🍰 少し甘えた日（週${s.daysMilkTea}回）</span>
                                <span class="plan-tier-kcal">${sim.intakeSweet} kcal</span>
                            </div>
                        </div>
                        <div class="plan-tier-box compact tier-event">
                            <div class="plan-tier-header">
                                <span>🍺 イベント日（週${s.daysEvent}回）</span>
                                <span class="plan-tier-kcal">${sim.intakeEvent} kcal</span>
                            </div>
                        </div>
                    </div>

                    <div class="plan-summary-box margin-top-1">
                        <div class="plan-summary-box-row">
                            <span>1ヶ月後の予測体重</span>
                            <span>${proj1M.toFixed(1)} kg（-${(latestWeight - proj1M).toFixed(1)}kg）</span>
                        </div>
                        <div class="plan-summary-box-row">
                            <span>3ヶ月後の予測体重</span>
                            <span>${proj3M.toFixed(1)} kg（-${(latestWeight - proj3M).toFixed(1)}kg）</span>
                        </div>
                    </div>

                    <button class="btn btn-primary btn-full margin-top-1" id="btn-adopt-simulation" type="button" title="目標摂取カロリー・消費予算・体重ロードマップを、このシミュレーション結果で更新します(計画開始日は固定のまま)">
                        <i data-lucide="check"></i> この結果を計画に反映する
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
                            </div>
                            <div class="plan-tier-box compact tier-milktea">
                                <div class="plan-tier-header">
                                    <span>② 少し甘えた日（週${s.daysMilkTea}回）</span>
                                    <span class="plan-tier-kcal">${s.intakeMilkTea} kcal</span>
                                </div>
                            </div>
                            <div class="plan-tier-box compact tier-event">
                                <div class="plan-tier-header">
                                    <span>③ イベント日（週${s.daysEvent}回）</span>
                                    <span class="plan-tier-kcal">${s.intakeEvent} kcal</span>
                                </div>
                            </div>
                        </div>

                        <h4 class="plan-section-heading secondary">消費カロリー予算（週平均 ${avgExpenditure} kcal/日）</h4>
                        <div class="plan-summary-box">
                            <div class="plan-summary-box-row">
                                <span>ベース消費（研究室・バイト含む）</span>
                                <span>${s.baseBurn} kcal/日</span>
                            </div>
                            <div class="plan-summary-box-row">
                                <span>有酸素ラン（週${s.runCount}回 4km走）</span>
                                <span>+${s.runBurn} kcal/回 (平均 +${Math.round(s.runBurn * s.runCount / 7)} kcal/日)</span>
                            </div>
                            <div class="plan-summary-box-row">
                                <span>週間ランニング目標</span>
                                <span>${weekRunDistance.toFixed(1)} / ${s.weeklyRunDistanceTarget} km（今週の実績）</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Roadmap Card -->
                <div class="card">
                    <div class="card-header">
                        <div class="header-title">
                            <i data-lucide="trending-down"></i>
                            <h3>体重減少目標ロードマップ</h3>
                        </div>
                    </div>
                    <div class="card-body">
                        <p class="settings-desc">目標アンダーカロリー（約${deficit} kcal/日）による体重変化シミュレーションです。</p>
                        <div class="roadmap-timeline">
                            <div class="roadmap-item">
                                <div class="roadmap-dot"></div>
                                <strong class="roadmap-label">開始時</strong>
                                <div class="roadmap-value">${s.weightStart} kg</div>
                                <p class="roadmap-note">開始日: ${s.weightPlanStartDate ? formatDateJp(s.weightPlanStartDate) : '未設定（計画を保存すると記録されます）'}</p>
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

        `;

        // Bind edit button action
        document.getElementById('btn-trigger-plan-edit').addEventListener('click', () => {
            renderPlanTab(true);
        });

        // シミュレーションの操作: ペース切り替えは選択を保存して再描画、
        // 「計画に反映」は計画設定(摂取3区分・消費予算・ロードマップ)へ書き込む
        container.querySelectorAll('.plan-sim-pace-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const s2 = state.planSettings || Object.assign({}, DEFAULT_PLAN_SETTINGS);
                s2.targetPaceKgMonth = parseFloat(btn.getAttribute('data-pace')) || 2;
                state.planSettings = s2;
                saveData();
                renderPlanTab(false);
            });
        });
        const adoptBtn = document.getElementById('btn-adopt-simulation');
        if (adoptBtn) {
            adoptBtn.addEventListener('click', () => {
                adoptSimulationPlan();
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
    s.weeklyRunDistanceTarget = parseFloat(document.getElementById('edit-weekly-run-distance-target').value) || 0;

    s.weightStart = parseFloat(document.getElementById('edit-weight-start').value) || 0.0;
    s.weight1Month = parseFloat(document.getElementById('edit-weight-1month').value) || 0.0;
    s.weight3Month = parseFloat(document.getElementById('edit-weight-3month').value) || 0.0;
    s.weightEquilibrium = parseFloat(document.getElementById('edit-weight-equilibrium').value) || 0.0;
    // 計画開始日は編集フォームの値をそのまま使う。空欄なら既存値を維持し、
    // 一度も設定されていない場合のみ今日を初期値にする(保存のたびに今日へ
    // リセットすると予測線の起点が実際の計画開始からズレてしまうため固定運用)
    s.weightPlanStartDate = document.getElementById('edit-weight-plan-start-date').value ||
        s.weightPlanStartDate || getLocalDateString();

    state.planSettings = s;
    // クラウド(PlanSettingsシート)にも反映する。ブリーフィング等の外部連携が
    // シートの計画を参照するため、ローカル保存だけで止めない
    saveDataAndSync();
    showToast('最適化計画の変更を保存しました');

    renderPlanTab(false);
    updateDashboard(); // 週間ランニング目標カードの目標値もその場で反映する
}

// planSettingsから選択中の減量ペース(kg/月)を取り出す。不正値・未設定はデフォルトの2に丸める
function getSimulationPace(planSettings) {
    const pace = parseFloat(planSettings && planSettings.targetPaceKgMonth);
    return SIM_PACE_OPTIONS.includes(pace) ? pace : 2;
}

// シミュレーション結果を計画へ反映する。旧「実績から再計算」2ボタン(消費予算・ロードマップ)を
// 統合した唯一の自動更新経路で、以下をまとめて書き込む:
//   - 目標摂取カロリー3区分(通常・少し甘えた日・イベント日)
//   - 消費カロリー予算(ベース消費・ラン消費。ラン実績が無い期間はラン設定を維持)
//   - 体重ロードマップ(開始日・開始時体重は固定。過ぎたマイルストーンは履歴として保持)
function adoptSimulationPlan() {
    if (!state.weightLogs || state.weightLogs.length === 0) {
        showToast('体重の記録がないため反映できません。まず「記録する」タブで体重を記録してください');
        return;
    }

    const s = state.planSettings || Object.assign({}, DEFAULT_PLAN_SETTINGS);
    const latestWeight = getLatestWeight();
    const todayStr = getLocalDateString();

    const profile = computeActivityProfile(latestWeight, state.workouts, state.cardioLogs, todayStr);
    const pace = getSimulationPace(s);
    // 表示側(renderPlanTab)と同じ条件で計算する(通常日の下限=BMR)
    const sim = computeIntakeTiersForPace(
        profile.tdee, pace, s.daysNormal, s.daysMilkTea, s.daysEvent,
        SIM_INTAKE_DELTA_SWEET, SIM_INTAKE_DELTA_EVENT, profile.bmr);

    s.intakeNormal = sim.intakeNormal;
    s.intakeMilkTea = sim.intakeSweet;
    s.intakeEvent = sim.intakeEvent;
    s.baseBurn = profile.baseBurn;
    if (profile.runCount > 0) {
        s.runBurn = profile.runBurn;
        s.runCount = profile.runCount;
    }

    // 開始日は固定運用。未設定の場合のみ今日を開始日・最新体重を開始時体重として初期化する
    let elapsedDays = 0;
    if (s.weightPlanStartDate) {
        elapsedDays = computeDaysSince(s.weightPlanStartDate, todayStr);
    } else {
        s.weightPlanStartDate = todayStr;
        s.weightStart = latestWeight;
    }
    const { weight1Month, weight3Month } =
        computeRoadmapMilestones(latestWeight, sim.effectiveDailyDeficit, elapsedDays, s.weight1Month, s.weight3Month);
    s.weight1Month = weight1Month;
    s.weight3Month = weight3Month;
    s.targetPaceKgMonth = pace;

    state.planSettings = s;
    saveDataAndSync();

    showToast(`シミュレーション結果を計画に反映しました（通常${sim.intakeNormal} / 甘え${sim.intakeSweet} / イベント${sim.intakeEvent} kcal、月${pace}kgペース）`);
    renderPlanTab(false);
    updateDashboard();
}
