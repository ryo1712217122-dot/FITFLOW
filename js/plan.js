// FITFLOW - 最適化計画タブ
// v2再構成でテンプレートのインラインstyleをすべてcss/pages/plan.cssのクラスに置き換えた。
// 表示内容・計算式・編集/再計算の挙動は変更していない。

// 計画タブは「今の実績から計算した現状」を見る画面。表示するのは
//   現在の体重 / TDEE(推定・実測の切替) / 減量ペース / 目標摂取カロリー / ロードマップ
// の5つだけに絞っている。
//
// 一括の「計画を編集」画面は廃止した(v1.21.0)。ほとんどの値は実績から自動算出でき、
// 手で決める必要がある少数の設定だけを、その値が表示されている場所の隣に
// 個別の編集ボタンとして置いている(下のopenInlineEditor)。
//
// かつてあった「摂取・消費カロリー目標」カード(保存済みのplanSettingsを並べる表示)も
// 廃止した。シミュレーションカードと同じ数字を二重に見せているだけだったため。
// planSettingsの各キー自体はクラウド同期のペイロード互換と体重グラフの予測線のために残る。
function renderPlanTab() {
    const container = document.getElementById('plan-container');
    if (!container) return;

    const s = state.planSettings || DEFAULT_PLAN_SETTINGS;

    // 減量シミュレーション: 最新体重と直近の記録(筋トレ頻度・有酸素)から
    // メンテナンスカロリーを推定し、選択中のペースで目標摂取3区分と予測体重を出す
    const latestWeight = getLatestWeight();
    const todayStr = getLocalDateString();
    const profile = computeActivityProfile(latestWeight, state.workouts, state.cardioLogs, todayStr);
    const pace = getSimulationPace(s);
    const tdeeChoice = getEffectiveTdee(profile, s);
    // 通常日の下限にはBMRを渡す(下限に当たると実効アンダーカロリーが目標より小さくなる)
    const sim = computeIntakeTiersForPace(
        tdeeChoice.tdee, pace, s.daysNormal, s.daysMilkTea, s.daysEvent,
        SIM_INTAKE_DELTA_SWEET, SIM_INTAKE_DELTA_EVENT, profile.bmr);

    const paceButtonsHtml = SIM_PACE_OPTIONS.map(p => `
        <button type="button" class="plan-sim-pace-btn${p === pace ? ' active' : ''}" data-pace="${p}">月${p}kg</button>
    `).join('');

    // ロードマップは保存済みのマイルストーンではなく、選択中のペースからその場で計算する
    // (ペースを変えた瞬間に全段が追従し、画面の数字と予測が食い違わない)
    const roadmap = computeWeightRoadmap(latestWeight, sim.effectiveDailyDeficit);
    const roadmapHtml = roadmap.map(r => `
        <div class="roadmap-row${r.isMajor ? ' major' : ''}">
            <span class="roadmap-row-label">${r.label}</span>
            <span class="roadmap-row-weight">${r.weight.toFixed(1)} kg</span>
            <span class="roadmap-row-delta">${r.days === 0 ? '—' : `${r.delta > 0 ? '+' : ''}${r.delta.toFixed(1)} kg`}</span>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="card plan-hero compact">
            <div class="card-body plan-hero-body">
                <div class="plan-hero-left">
                    <i data-lucide="target" class="plan-hero-icon-inline"></i>
                    <h2 class="plan-hero-title">最適化ライフスタイル計画</h2>
                </div>
            </div>
        </div>

        <!-- 減量シミュレーション: 実績→TDEE→減量ペース→目標摂取3区分 -->
        <div class="card">
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
                        <span class="plan-sim-fact-label">TDEE(1日の総消費)</span>
                        <span class="plan-sim-fact-value">${tdeeChoice.tdee} kcal/日</span>
                        <div class="chart-period-toggle plan-tdee-toggle">
                            <button type="button" class="chart-period-btn plan-tdee-btn${tdeeChoice.source === 'estimated' ? ' active' : ''}" data-tdee-source="estimated">推定 ${profile.tdee}</button>
                            <button type="button" class="chart-period-btn plan-tdee-btn${tdeeChoice.source === 'measured' ? ' active' : ''}" data-tdee-source="measured"${tdeeChoice.measured ? '' : ' disabled'}>実測 ${tdeeChoice.measured ? tdeeChoice.measured.tdee : '—'}</button>
                        </div>
                        <span class="plan-sim-fact-sub">${tdeeSubtextHtml(tdeeChoice, profile)}</span>
                    </div>
                </div>

                <div class="plan-sim-pace-row">
                    <span class="plan-sim-pace-label">減量ペース</span>
                    <div class="plan-sim-pace-buttons">${paceButtonsHtml}</div>
                    <span class="plan-sim-fact-sub">アンダーカロリー 約${sim.effectiveDailyDeficit} kcal/日</span>
                </div>
                ${sim.clamped ? `<p class="plan-sim-clamp-warning">⚠️ このペースでは通常日が基礎代謝(${profile.bmr}kcal)を下回るため、下限で調整しています。実際の減量ペースは選択より緩やかになります。</p>` : ''}

                <h4 class="plan-section-heading">
                    目標摂取カロリー（週平均 ${sim.effectiveAvgIntake} kcal/日）
                    <button type="button" class="plan-inline-edit-btn" id="btn-edit-day-mix" title="週の日数配分を変更する">
                        <i data-lucide="pencil"></i> 日数配分
                    </button>
                </h4>
                <div class="plan-sub-items">
                    <div class="plan-tier-box compact tier-normal">
                        <div class="plan-tier-header">
                            <span>🌳 通常日（週${s.daysNormal}日）</span>
                            <span class="plan-tier-kcal">${sim.intakeNormal} kcal</span>
                        </div>
                    </div>
                    <div class="plan-tier-box compact tier-milktea">
                        <div class="plan-tier-header">
                            <span>🍰 少し甘えた日（週${s.daysMilkTea}日）</span>
                            <span class="plan-tier-kcal">${sim.intakeSweet} kcal</span>
                        </div>
                    </div>
                    <div class="plan-tier-box compact tier-event">
                        <div class="plan-tier-header">
                            <span>🍺 イベント日（週${s.daysEvent}日）</span>
                            <span class="plan-tier-kcal">${sim.intakeEvent} kcal</span>
                        </div>
                    </div>
                </div>
                <div id="plan-day-mix-editor" class="plan-inline-editor is-hidden"></div>

                <button class="btn btn-primary btn-full margin-top-1" id="btn-adopt-simulation" type="button" title="目標摂取カロリー・消費予算・体重ロードマップを、このシミュレーション結果で更新します(計画開始日は固定のまま)">
                    <i data-lucide="check"></i> この結果を計画に反映する
                </button>
            </div>
        </div>

        <!-- 体重ロードマップ: 選択中のペースで2週間ごと3ヶ月分 -->
        <div class="card margin-top-1-5">
            <div class="card-header">
                <div class="header-title">
                    <i data-lucide="trending-down"></i>
                    <h3>体重ロードマップ（2週間ごと・3ヶ月先まで）</h3>
                </div>
                <button type="button" class="plan-inline-edit-btn" id="btn-edit-plan-start" title="計画開始日を変更する">
                    <i data-lucide="pencil"></i> 開始日: ${s.weightPlanStartDate ? formatDateJp(s.weightPlanStartDate) : '未設定'}
                </button>
            </div>
            <div class="card-body">
                <div id="plan-start-editor" class="plan-inline-editor is-hidden"></div>
                <div class="roadmap-table">
                    <div class="roadmap-row head">
                        <span class="roadmap-row-label">時点</span>
                        <span class="roadmap-row-weight">予測体重</span>
                        <span class="roadmap-row-delta">現在比</span>
                    </div>
                    ${roadmapHtml}
                </div>
            </div>
        </div>
    `;

    // シミュレーションの操作: ペース切り替えは選択を保存して再描画、
    // 「計画に反映」は計画設定(摂取3区分・消費予算・ロードマップ)へ書き込む
    container.querySelectorAll('.plan-sim-pace-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const s2 = state.planSettings || Object.assign({}, DEFAULT_PLAN_SETTINGS);
            s2.targetPaceKgMonth = parseFloat(btn.getAttribute('data-pace')) || 2;
            state.planSettings = s2;
            // saveData()だけだとdirtyが立たず、クラウド同期ユーザーは次回起動時の
            // 自動プル(planSettings丸ごと置換)で選択が黙って巻き戻る。同期にも乗せる
            saveDataAndSync();
            renderPlanTab();
        });
    });
    const adoptBtn = document.getElementById('btn-adopt-simulation');
    if (adoptBtn) {
        adoptBtn.addEventListener('click', () => {
            adoptSimulationPlan();
        });
    }
    // TDEEの推定/実測切り替え(ペース切り替えと同じく、選択を保存して再描画)
    container.querySelectorAll('.plan-tdee-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => {
            const s2 = state.planSettings || Object.assign({}, DEFAULT_PLAN_SETTINGS);
            s2.tdeeSource = btn.getAttribute('data-tdee-source') === 'measured' ? 'measured' : 'estimated';
            state.planSettings = s2;
            // ペース切替と同じくdirtyを立てて同期に乗せる(起動時プルでの巻き戻り防止)
            saveDataAndSync();
            renderPlanTab();
        });
    });

    wirePlanInlineEditors(s);

    if (window.lucide) {
        lucide.createIcons();
    }
}

// 個別の編集欄がひとつでも開いているか。開いている間は外側からの再描画を抑止して、
// 入力中の値が消えないようにする(タブ切り替え時など。navigation.jsから参照)。
function isPlanInlineEditorOpen() {
    return Array.from(document.querySelectorAll('.plan-inline-editor'))
        .some(el => !el.classList.contains('is-hidden'));
}

// 個別の編集ボタン。一括編集画面の代わりに、その設定が効いている場所のすぐ隣で
// 開閉するインラインエディタとして実装する。
// fields: [{ key, label, type, step, min }]、onSave(values) は検証済みの値を受け取る。
function openInlineEditor(editorEl, fields, currentSettings, onSave) {
    if (!editorEl) return;

    editorEl.innerHTML = `
        <div class="plan-inline-editor-fields">
            ${fields.map(f => `
                <div class="form-group">
                    <label class="text-2xs" for="inline-edit-${f.key}">${f.label}</label>
                    <input type="${f.type || 'number'}" id="inline-edit-${f.key}"
                        ${f.step ? `step="${f.step}"` : ''}
                        value="${f.type === 'date' ? (currentSettings[f.key] || '') : (currentSettings[f.key] ?? '')}"
                        class="width-full">
                </div>
            `).join('')}
        </div>
        <div class="plan-inline-editor-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-role="cancel">キャンセル</button>
            <button type="button" class="btn btn-primary btn-sm" data-role="save">保存</button>
        </div>
    `;
    editorEl.classList.remove('is-hidden');

    const firstInput = editorEl.querySelector('input');
    if (firstInput) firstInput.focus();

    editorEl.querySelector('[data-role="cancel"]').addEventListener('click', () => {
        editorEl.classList.add('is-hidden');
        editorEl.innerHTML = '';
    });

    editorEl.querySelector('[data-role="save"]').addEventListener('click', () => {
        const values = {};
        for (const f of fields) {
            const input = editorEl.querySelector(`#inline-edit-${f.key}`);
            if (!input) continue;
            if (f.type === 'date') {
                values[f.key] = input.value;
                continue;
            }
            const raw = parseFloat(input.value);
            // 数値項目は空欄・不正値・下限割れをここで弾く(一括編集の頃は
            // parseInt(...)||0 で黙って0にしており、日数配分が全部0になると
            // 週平均の分母が7へフォールバックして意図しない目標値が出ていた)
            if (isNaN(raw) || (f.min !== undefined && raw < f.min)) {
                showToast(`「${f.label}」には${f.min !== undefined ? `${f.min}以上の` : ''}数値を入力してください`);
                return;
            }
            values[f.key] = f.step && String(f.step).includes('.') ? raw : Math.round(raw);
        }
        onSave(values);
    });

    if (window.lucide) lucide.createIcons();
}

// 計画設定へ書き込んで保存・再描画する共通処理
function savePlanSettingsPatch(patch, toastMessage) {
    const s = state.planSettings || Object.assign({}, DEFAULT_PLAN_SETTINGS);
    Object.assign(s, patch);
    state.planSettings = s;
    // クラウド(PlanSettingsシート)にも反映する。ブリーフィング等の外部連携が
    // シートの計画を参照するため、ローカル保存だけで止めない
    saveDataAndSync();
    showToast(toastMessage);
    renderPlanTab();
    updateDashboard();
}

function wirePlanInlineEditors(s) {
    const dayMixBtn = document.getElementById('btn-edit-day-mix');
    const dayMixEditor = document.getElementById('plan-day-mix-editor');
    if (dayMixBtn && dayMixEditor) {
        dayMixBtn.addEventListener('click', () => {
            if (!dayMixEditor.classList.contains('is-hidden')) {
                dayMixEditor.classList.add('is-hidden');
                dayMixEditor.innerHTML = '';
                return;
            }
            openInlineEditor(dayMixEditor, [
                { key: 'daysNormal', label: '通常日（週何日）', min: 0 },
                { key: 'daysMilkTea', label: '少し甘えた日（週何日）', min: 0 },
                { key: 'daysEvent', label: 'イベント日（週何日）', min: 0 }
            ], s, (values) => {
                const total = values.daysNormal + values.daysMilkTea + values.daysEvent;
                if (total <= 0) {
                    showToast('週の日数はどれか1つ以上を1日以上にしてください');
                    return;
                }
                if (total > 7) {
                    showToast(`週の日数の合計が${total}日になっています。7日以内にしてください`);
                    return;
                }
                savePlanSettingsPatch(values, `週の日数配分を保存しました（通常${values.daysNormal} / 甘え${values.daysMilkTea} / イベント${values.daysEvent}日）`);
            });
        });
    }

    const startBtn = document.getElementById('btn-edit-plan-start');
    const startEditor = document.getElementById('plan-start-editor');
    if (startBtn && startEditor) {
        startBtn.addEventListener('click', () => {
            if (!startEditor.classList.contains('is-hidden')) {
                startEditor.classList.add('is-hidden');
                startEditor.innerHTML = '';
                return;
            }
            openInlineEditor(startEditor, [
                { key: 'weightPlanStartDate', label: '計画開始日（体重グラフの予測線の起点）', type: 'date' }
            ], s, (values) => {
                if (!values.weightPlanStartDate) {
                    showToast('計画開始日を選択してください');
                    return;
                }
                savePlanSettingsPatch(values, `計画開始日を ${formatDateJp(values.weightPlanStartDate)} に変更しました`);
            });
        });
    }
}

// planSettingsから選択中の減量ペース(kg/月)を取り出す。不正値・未設定はデフォルトの2に丸める
function getSimulationPace(planSettings) {
    const pace = parseFloat(planSettings && planSettings.targetPaceKgMonth);
    return SIM_PACE_OPTIONS.includes(pace) ? pace : 2;
}

// シミュレーションで使うTDEEを決める。planSettings.tdeeSourceが'measured'なら
// 実測TDEE(食事記録と体重推移からの逆算)を使い、データ不足でnullの場合は
// 推定式(computeActivityProfile)に自動フォールバックする。
// renderPlanTab(表示)とadoptSimulationPlan(計画反映)の両方がこれを通ることで、
// 画面に見えている数字と計画に書き込まれる数字が必ず一致する。
function getEffectiveTdee(profile, planSettings) {
    const measured = computeMeasuredTdee(state.weightLogs, state.mealLogs, getLocalDateString());
    const wantMeasured = !!(planSettings && planSettings.tdeeSource === 'measured');
    if (wantMeasured && measured) {
        return { tdee: measured.tdee, source: 'measured', measured, fellBack: false };
    }
    return { tdee: profile.tdee, source: 'estimated', measured, fellBack: wantMeasured && !measured };
}

// TDEE表示の補足文。推定は内訳、実測は算出根拠(期間・記録数・平均摂取・体重ペース)を示す
function tdeeSubtextHtml(tdeeChoice, profile) {
    if (tdeeChoice.source === 'measured') {
        const m = tdeeChoice.measured;
        const weeklyKg = Math.round(m.slopeKgPerDay * 7 * 100) / 100;
        const sign = weeklyKg > 0 ? '+' : '';
        return `直近${m.windowDays}日の実測: 平均摂取${m.avgIntake}kcal(${m.mealDays}日分)、体重${sign}${weeklyKg}kg/週(${m.weightPoints}点)から逆算`;
    }
    const base = `基礎${profile.bmr}×活動${profile.pal}（${profile.palDesc}・直近30日${profile.workoutsLast30Days}回）${profile.runCount > 0 ? ` + ラン週${profile.runCount}回` : ''}`;
    if (tdeeChoice.fellBack) {
        return `${base}<br>⚠️ 実測TDEEはデータ不足のため使えません（直近28日に食事記録10日分・体重8点/14日以上が必要）。推定値で計算中`;
    }
    if (!tdeeChoice.measured) {
        return `${base}<br>※食事と体重の記録が貯まると、実測TDEE(あなた個人の実測値)に切り替えられます`;
    }
    return base;
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
    // 表示側(renderPlanTab)と同じ条件で計算する(TDEEの推定/実測選択・通常日の下限=BMR)
    const tdeeChoice = getEffectiveTdee(profile, s);
    const sim = computeIntakeTiersForPace(
        tdeeChoice.tdee, pace, s.daysNormal, s.daysMilkTea, s.daysEvent,
        SIM_INTAKE_DELTA_SWEET, SIM_INTAKE_DELTA_EVENT, profile.bmr);

    s.intakeNormal = sim.intakeNormal;
    s.intakeMilkTea = sim.intakeSweet;
    s.intakeEvent = sim.intakeEvent;
    // 消費カロリー予算(baseBurn/runBurn)は常に推定式ベース。実測TDEEは「摂取と体重変化の
    // 差し引き」しか分からず、基礎消費と運動消費への内訳分解ができないため。
    // 実測TDEE選択時は摂取目標=実測基準・消費予算=推定式基準の混在になる(意図した仕様)
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

    showToast(`シミュレーション結果を計画に反映しました（通常${sim.intakeNormal} / 甘え${sim.intakeSweet} / イベント${sim.intakeEvent} kcal、月${pace}kgペース、${tdeeChoice.source === 'measured' ? '実測' : '推定'}TDEE${tdeeChoice.tdee}基準）`);
    renderPlanTab();
    updateDashboard();
}
