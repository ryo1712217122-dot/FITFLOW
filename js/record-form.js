// FITFLOW - 「記録する」タブ。v1.27.0 で3ページに分けた(切り替えは switchRecordPage)。
//   食事(#meal-form)            : 朝食/昼食/夕食/間食の摂取kcal目安。夕食の分岐として「飲み会だった」
//                                 (drinkingLogs。体重グラフに🍻を重ねる)もここで記録する
//   トレーニング(#workout-form) : 筋トレの種目＋有酸素(走行距離)。有酸素は「トレーニングを記録完了」で一緒に保存
//   体重(#weight-quick-form)    : 1日の最後(風呂上がり)に測る想定なので最後のページ
// いちばん触るのは食事なので、起動後に開くと食事のページが出る。
//
// 筋トレの種目は「まとめて最後に一括保存」ではなく、1種目入力し終えるごとに
// その場で個別保存できる（ジムでのリアルタイム入力を想定）。編集中/記録中のワークアウトの
// idはstate.editingWorkoutIdが指す（履歴からの編集・新規リアルタイム記録の両方で共用）。
//
// 日付のデフォルトはgetFitnessDateString(27時ルール: AM3時までは前日扱い)を使う。
// 深夜のトレーニング後に記録しても「今日」に化けないようにするため。
//
// 進行中のセッションはlocalStorage(OPEN_WORKOUT_KEY)にも残るので、途中でアプリを
// 閉じても開き直せば同じセッションに追記できる。セッションが終わるのは
// 「トレーニングを記録完了」を押した時だけ。

// フォームが今どのワークアウトを組み立てているか。state.editingWorkoutIdと食い違う場合
// (リロード直後はフォームが空)だけ組み立て直す。一致している間は触らないことで、
// タブを行き来しても入力途中の種目が消えないようにする。
let formBoundWorkoutId = null;

// フォームの用途。'new'=新規、'resume'=進行中セッションの続き、'edit'=履歴からの過去記録の編集。
// 「記録中です」の案内は 'edit' では出さない(過去の記録を直しているだけなので誤解を招く)。
let workoutFormMode = 'new';

// 「記録する」タブを開いた時と起動時に呼ぶ。進行中のセッションがあればそれをフォームへ
// 復元し、無ければ通常どおり新規フォームにする。
// force=true なら、既に同じセッションを開いていてもフォームを組み立て直す
// (クラウド同期やインポートで裏のデータが入れ替わった直後に使う)。
function syncWorkoutFormWithOpenSession({ force = false } = {}) {
    if (state.editingWorkoutId) {
        if (!force && formBoundWorkoutId === state.editingWorkoutId) return; // 既に開いている。入力中の値を保つ
        const workout = state.workouts.find(w => w.id === state.editingWorkoutId);
        if (workout) {
            populateWorkoutForm(workout, 'resume');
            return;
        }
        // 参照先が消えている(履歴で削除された等)。開いたままにせず新規に戻す
        setOpenWorkoutId(null);
    }
    // 新規フォームに未保存の入力があれば作り直さない。以前はタブを開くたびにリセットしており、
    // まだ保存していない種目や有酸素の距離を入れたまま別タブを見に行くと消えていた。
    // 入力が無ければ作り直す(日付・時刻を今に戻す。日別サマリーで過去の日を開いたまま
    // 離れた場合や、翌日にアプリを復帰させた場合に、古い日付のまま記録されないように)
    if (!force && workoutFormInitialized && formBoundWorkoutId === null && hasUnsavedNewWorkoutInput()) return;
    resetWorkoutForm();
}

// 新規トレーニングのフォームに、まだ保存していない入力があるか
function hasUnsavedNewWorkoutInput() {
    if (DOM.workoutImpression && DOM.workoutImpression.value.trim() !== '') return true;
    if (DOM.logCardioDist) {
        const v = DOM.logCardioDist.value.trim();
        if (v !== '' && v !== lastSyncedCardioValue) return true;
    }
    if (!DOM.exerciseList) return false;
    return Array.from(DOM.exerciseList.querySelectorAll('.exercise-name, .set-weight, .set-reps'))
        .some(input => input.value.trim() !== '');
}

// 新規フォームを一度でも組み立てたか(上の「作り直さない」判定に使う)
let workoutFormInitialized = false;

// ==========================================
// 記録ページの切り替え(食事 / トレーニング / 体重)
// ==========================================

const RECORD_PAGES = ['meal', 'training', 'weight'];

function switchRecordPage(page) {
    const target = RECORD_PAGES.includes(page) ? page : 'meal';
    RECORD_PAGES.forEach(p => {
        const tab = document.getElementById(`record-tab-${p}`);
        const panel = document.getElementById(`record-page-${p}`);
        const active = p === target;
        if (tab) {
            tab.classList.toggle('active', active);
            tab.setAttribute('aria-selected', active ? 'true' : 'false');
        }
        if (panel) panel.classList.toggle('is-hidden', !active);
    });
}

function initRecordPages() {
    document.querySelectorAll('.record-page-btn').forEach(btn => {
        btn.addEventListener('click', () => switchRecordPage(btn.getAttribute('data-record-page')));
    });
    updateRecordTrainingBadge();
}

// 「トレーニング」のページ見出しに、記録中(または編集中)のセッションがあることを出す。
// 食事のページを開いている間も、トレーニングが締めくくられていないことに気づけるように
function updateRecordTrainingBadge() {
    const badge = document.getElementById('record-training-badge');
    if (!badge) return;
    const open = !!state.editingWorkoutId;
    badge.classList.toggle('is-hidden', !open);
    badge.textContent = workoutFormMode === 'edit' ? '編集中' : '記録中';
}

// ワークアウトの内容をフォームへ流し込む。履歴からの編集(mode='edit')と、
// 進行中セッションの再開(mode='resume')で共用する。違いは見出し・ボタン・案内文だけ。
function populateWorkoutForm(workout, mode) {
    const isResume = mode === 'resume';

    const titleHeader = document.getElementById('logger-form-title');
    if (titleHeader) {
        titleHeader.textContent = isResume ? '🏋️ トレーニングの記録（記録中）' : '🏋️ トレーニング記録の編集';
    }
    if (DOM.saveWorkoutBtn) {
        DOM.saveWorkoutBtn.innerHTML = isResume
            ? '<i data-lucide="check"></i> トレーニングを記録完了'
            : '<i data-lucide="save"></i> 編集を完了する';
    }

    if (DOM.workoutDate) DOM.workoutDate.value = workout.date;
    if (DOM.workoutTime) DOM.workoutTime.value = workout.time || '12:00';
    if (DOM.workoutImpression) DOM.workoutImpression.value = workout.impression || '';

    // moodはクラウド/インポート経由で任意の文字列が入りうる。セレクタへ素で埋めると
    // 引用符やブラケットを含む値でquerySelectorがSyntaxErrorを投げ、
    // フォームの復元そのものが途中で止まる。値の比較で探す
    const moodRadios = DOM.workoutForm
        ? DOM.workoutForm.querySelectorAll('input[name="workout-mood"]')
        : [];
    Array.from(moodRadios).forEach(radio => {
        if (radio.value === workout.mood) radio.checked = true;
    });

    if (DOM.exerciseList) {
        DOM.exerciseList.innerHTML = '';
        (workout.exercises || []).forEach((ex, idx) => addExerciseBlock(ex, idx));
        // 既存種目に加えて、その場で次の種目もすぐ追加できるよう空ブロックを1つ用意する
        addExerciseBlock();
    }

    formBoundWorkoutId = workout.id;
    workoutFormMode = isResume ? 'resume' : 'edit';
    if (isResume) {
        showWorkoutResumeHint(workout);
    } else {
        hideWorkoutResumeHint();
    }

    updateWorkoutCalorieHint();
    syncCardioFieldForDate(workout.date);
    updateRecordTrainingBadge();
    if (window.lucide) lucide.createIcons();
}

// 「このセッションは保存済みで、まだ続けられる」ことを画面に出す。
// これが無いと、開き直した時に前回の種目が並んでいる理由が分からない。
function showWorkoutResumeHint(workout) {
    const hint = document.getElementById('workout-resume-hint');
    if (!hint || workoutFormMode === 'edit') return;
    const count = (workout.exercises || []).length;
    hint.textContent = `記録中のトレーニングです（${count}種目 保存済み）。種目を追加していけます。終わったら「トレーニングを記録完了」を押してください。`;
    hint.classList.remove('is-hidden');
}

function hideWorkoutResumeHint() {
    const hint = document.getElementById('workout-resume-hint');
    if (hint) {
        hint.classList.add('is-hidden');
        hint.textContent = '';
    }
}

function initFormControls() {
    initRecordPages();

    if (DOM.addExerciseBtn) {
        DOM.addExerciseBtn.addEventListener('click', () => {
            addExerciseBlock();
        });
    }

    if (DOM.workoutForm) {
        DOM.workoutForm.addEventListener('submit', (e) => {
            e.preventDefault();
            finishTrainingSession();
        });
    }

    // 「前回の記録」はフォームの日付以前から探すので、日付を変えたら出し直す
    // 有酸素の欄もトレーニングと同じ日付で、その日の既存の記録を出し直す
    if (DOM.workoutDate && DOM.exerciseList) {
        DOM.workoutDate.addEventListener('change', () => {
            DOM.exerciseList.querySelectorAll('.exercise-item').forEach(updateExerciseLastHint);
            syncCardioFieldForDate(DOM.workoutDate.value, { keepTyped: true });
        });
    }

    // 調子・メモは種目の保存に付随して保存されるが、種目を保存し直さずに
    // これらだけを変更した場合(既存記録の編集など)も、その場で反映されるようにする
    if (DOM.workoutImpression) {
        DOM.workoutImpression.addEventListener('blur', () => {
            persistOpenWorkoutMetaIfAny();
        });
    }
    if (DOM.workoutForm) {
        DOM.workoutForm.querySelectorAll('input[name="workout-mood"]').forEach(radio => {
            radio.addEventListener('change', () => {
                persistOpenWorkoutMetaIfAny();
            });
        });
    }

    // 有酸素(トレーニングのページ内。保存は「トレーニングを記録完了」で一緒に行う)
    if (DOM.logCardioDist) {
        DOM.logCardioDist.addEventListener('input', updateCardioHint);
        // 距離の欄はトレーニングのフォームの中にあるので、Enterで暗黙の送信が起きると
        // 記録中のセッションごと締めくくってしまう。保存は記録完了ボタンを押した時だけにする
        DOM.logCardioDist.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') e.preventDefault();
        });
    }

    // 体重
    if (DOM.weightQuickForm) {
        if (DOM.weightQuickDate) {
            DOM.weightQuickDate.value = getFitnessDateString();
            syncDailyLogFormWithExistingDataForDate(DOM.weightQuickDate.value);
            DOM.weightQuickDate.addEventListener('change', handleDailyLogDateChange);
        }
        DOM.weightQuickForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveDailyLog();
        });
    }

    // 食事
    if (DOM.mealForm) {
        if (DOM.mealDate) {
            DOM.mealDate.value = getFitnessDateString();
            syncMealFormWithExistingDataForDate(DOM.mealDate.value);
            DOM.mealDate.addEventListener('change', handleMealDateChange);
        }
        [DOM.mealBreakfast, DOM.mealLunch, DOM.mealDinner, DOM.mealSnacks].forEach(input => {
            if (input) input.addEventListener('input', updateMealTotalHint);
        });
        initMealModeToggles();
        DOM.mealForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveMealLog();
        });
    }

    // 飲み会(夕食の分岐)
    if (DOM.mealDinnerDrinking) {
        DOM.mealDinnerDrinking.addEventListener('change', updateMealDrinkingUi);
    }
    if (DOM.mealDrinkingEstimate && DOM.mealDinner) {
        // 目安は夕食欄へ値を書き込むだけの入力補助(数値欄で微調整できる)
        DOM.mealDrinkingEstimate.addEventListener('change', () => {
            if (!DOM.mealDrinkingEstimate.value) return;
            setMealFieldMode('dinner', 'manual');
            DOM.mealDinner.value = DOM.mealDrinkingEstimate.value;
            updateMealTotalHint();
        });
    }

}

function resetWorkoutForm() {
    setOpenWorkoutId(null);
    formBoundWorkoutId = null;
    workoutFormMode = 'new';
    if (DOM.workoutForm) DOM.workoutForm.reset();
    hideWorkoutResumeHint();

    const now = new Date();
    // 27時ルール: AM3時までは前日の日付をデフォルトにする(深夜トレ後の記録を想定)
    if (DOM.workoutDate) DOM.workoutDate.value = getFitnessDateString(now);

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    if (DOM.workoutTime) DOM.workoutTime.value = `${hours}:${minutes}`;

    if (DOM.exerciseList) DOM.exerciseList.innerHTML = '';
    if (DOM.saveWorkoutBtn) DOM.saveWorkoutBtn.innerHTML = '<i data-lucide="check"></i> トレーニングを記録完了';

    const titleHeader = document.getElementById('logger-form-title');
    if (titleHeader) titleHeader.textContent = '🏋️ トレーニングの記録';

    addExerciseBlock();
    updateWorkoutCalorieHint();
    if (DOM.logCardioDist) DOM.logCardioDist.value = '';
    syncCardioFieldForDate(DOM.workoutDate ? DOM.workoutDate.value : '');
    workoutFormInitialized = true;
    updateRecordTrainingBadge();

    if (window.lucide) {
        lucide.createIcons();
    }
}

// existingIndex: 履歴編集などで既存の種目を復元する場合、workout.exercises内でのインデックス。
// nullなら「まだ保存されていない新規入力中の種目」を意味する(data-existing-index属性を持たない)。
function addExerciseBlock(data = null, existingIndex = null) {
    if (!DOM.exerciseList) return;

    const exerciseBlock = document.createElement('div');
    exerciseBlock.classList.add('exercise-item');
    if (existingIndex !== null && existingIndex !== undefined) {
        exerciseBlock.setAttribute('data-existing-index', String(existingIndex));
    }

    const popularExerciseOptionsHtml = getPopularExerciseNames()
        .map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
        .join('');

    // 同じ重量・レップの繰り返しは1行にまとめて復元する(30kg×10を3セットなら1行×3)。
    // 保存形式は従来どおりフラットなセット配列なので、ここで畳むだけ。
    const formRows = data && data.sets ? collapseSetsForForm(data.sets) : [];

    // 種目名・重量・レップ数の入力にはrequired属性を付けない。
    // 種目保存後には空の入力ブロックが自動で追加されるため、requiredにすると
    // その空ブロックがフォーム全体の送信(有酸素を保存して完了)をHTMLバリデーションで
    // ブロックしてしまう(空ブロックを手で削除しないと完了できない)。
    // 種目単体の保存時のバリデーションはreadExerciseBlockData()がJS側で行う。
    exerciseBlock.innerHTML = `
        <div class="exercise-item-header">
            <div class="exercise-name-input-wrapper">
                <select class="exercise-name-picker">
                    <option value="">よく使う種目から選択...</option>
                    ${popularExerciseOptionsHtml}
                </select>
                <input type="text" class="exercise-name" placeholder="種目名（一覧にない場合は自由入力）" list="popular-exercises" value="${data ? escapeHtml(data.name) : ''}">
            </div>
            <div class="exercise-sets-counter">
                <span class="exercise-sets-total">合計 <strong class="exercise-sets-total-num">0</strong> セット</span>
            </div>
            <button type="button" class="btn-icon btn-remove-exercise text-danger" title="種目を削除">
                <i data-lucide="trash-2"></i>
            </button>
        </div>
        <div class="exercise-last-hint is-hidden" aria-live="polite"></div>
        <div class="sets-table-wrapper">
            <table class="sets-table">
                <thead>
                    <tr>
                        <th class="set-num">SET</th>
                        <th class="col-weight">重量 (kg)</th>
                        <th class="col-weight"></th>
                        <th>レップ数</th>
                        <th></th>
                        <th>セット</th>
                        <th class="set-action"></th>
                    </tr>
                </thead>
                <tbody class="sets-tbody"></tbody>
            </table>
            <div class="sets-table-actions">
                <button type="button" class="add-set-row-btn">
                    <i data-lucide="plus"></i> 内容の違うセットを追加
                </button>
                <button type="button" class="toggle-weight-btn is-hidden">重量を入力する</button>
            </div>
        </div>
        <button type="button" class="btn btn-primary btn-full margin-top-1 btn-save-exercise">
            <i data-lucide="check"></i> この種目を保存
        </button>
    `;

    const tbody = exerciseBlock.querySelector('.sets-tbody');
    const addSetBtn = exerciseBlock.querySelector('.add-set-row-btn');
    const removeExBtn = exerciseBlock.querySelector('.btn-remove-exercise');
    const saveExBtn = exerciseBlock.querySelector('.btn-save-exercise');
    const namePicker = exerciseBlock.querySelector('.exercise-name-picker');
    const nameInput = exerciseBlock.querySelector('.exercise-name');
    const toggleWeightBtn = exerciseBlock.querySelector('.toggle-weight-btn');

    // 既存データに0以外の重量が入っているなら、種目名が自重判定でも重量欄を出す
    // (加重ディップス等を後から編集した時に、入っている重量が見えなくなるのを防ぐ)
    if (formRows.some(r => Number(r.weight) > 0)) {
        exerciseBlock.setAttribute('data-weight-mode', 'forced');
    }

    if (namePicker && nameInput) {
        namePicker.addEventListener('change', () => {
            if (namePicker.value) {
                nameInput.value = namePicker.value;
            }
            namePicker.value = '';
            applyExerciseWeightMode(exerciseBlock);
            updateExerciseLastHint(exerciseBlock);
        });
    }
    if (nameInput) {
        nameInput.addEventListener('input', () => {
            applyExerciseWeightMode(exerciseBlock);
            updateExerciseLastHint(exerciseBlock);
        });
    }
    if (toggleWeightBtn) {
        toggleWeightBtn.addEventListener('click', () => {
            const forced = exerciseBlock.getAttribute('data-weight-mode') === 'forced';
            exerciseBlock.setAttribute('data-weight-mode', forced ? 'auto' : 'forced');
            applyExerciseWeightMode(exerciseBlock);
        });
    }

    addSetBtn.addEventListener('click', () => {
        addSetRow(tbody);
    });

    saveExBtn.addEventListener('click', () => {
        saveExerciseBlock(exerciseBlock);
    });

    removeExBtn.addEventListener('click', () => {
        removeExerciseBlock(exerciseBlock);
    });

    DOM.exerciseList.appendChild(exerciseBlock);

    if (formRows.length > 0) {
        formRows.forEach(r => addSetRow(tbody, r.weight, r.reps, r.count));
    } else {
        addSetRow(tbody);
    }

    applyExerciseWeightMode(exerciseBlock);
    updateExerciseLastHint(exerciseBlock);

    if (window.lucide) {
        lucide.createIcons();
    }
}

// 種目名から「前回の記録」と「次の目安」を出す(v1.26.0)。ジムで種目を選んだその場で、
// 前回どれだけ挙げたかと今日どこを狙うかが分かるようにする。
// 前回 = 記録中(編集中)のワークアウト以外で、フォームの日付以前の直近セッション。
// 過去の記録を履歴から編集している時は、その日より前の記録が「前回」になる。
function updateExerciseLastHint(exerciseBlockEl) {
    if (!exerciseBlockEl) return;
    const hint = exerciseBlockEl.querySelector('.exercise-last-hint');
    const nameInput = exerciseBlockEl.querySelector('.exercise-name');
    if (!hint || !nameInput) return;

    const name = nameInput.value.trim();
    if (!name) {
        hint.classList.add('is-hidden');
        hint.textContent = '';
        return;
    }

    const refDate = (DOM.workoutDate && DOM.workoutDate.value) || getTodayStr();
    const last = findLastExerciseSession(state.workouts, name, {
        excludeWorkoutId: state.editingWorkoutId,
        onOrBeforeDate: refDate
    });

    hint.textContent = '';
    if (!last) {
        // 表記ゆれ(「ベンチプレス」と「ベンチ」等)で前回が見つからないこともあるので、
        // 黙って消さずに「無い」ことを出す
        const none = document.createElement('span');
        none.className = 'exercise-last-hint-none';
        none.textContent = 'この種目の過去の記録はありません';
        hint.appendChild(none);
        hint.classList.remove('is-hidden');
        return;
    }

    // textContent で組み立てる(種目名はユーザー入力なので innerHTML に入れない)
    const row = (label, text, sub) => {
        const line = document.createElement('div');
        line.className = 'exercise-last-hint-row';
        const l = document.createElement('span');
        l.className = 'exercise-last-hint-label';
        l.textContent = label;
        const v = document.createElement('span');
        v.className = 'exercise-last-hint-value';
        v.textContent = text;
        line.append(l, v);
        if (sub) {
            const s2 = document.createElement('span');
            s2.className = 'exercise-last-hint-sub';
            s2.textContent = sub;
            line.appendChild(s2);
        }
        return line;
    };

    const parts = last.date.split('-');
    const dateLabel = parts.length === 3 ? `${Number(parts[1])}/${Number(parts[2])}` : last.date;
    hint.appendChild(row(`前回 ${dateLabel}`, formatSetsSummary(last.sets)));

    const next = suggestNextExerciseTarget(last.sets);
    if (next) {
        const text = next.weight > 0 ? `${next.weight}kg × ${next.reps}回` : `各セット ${next.reps}回`;
        hint.appendChild(row('次の目安', text, `（${next.reason}）`));
    }
    hint.classList.remove('is-hidden');
}

// 自重種目なら重量の列を隠す。手動で「重量を入力する」を押した種目(data-weight-mode="forced")は
// 種目名に関わらず常に表示する。
function applyExerciseWeightMode(exerciseBlockEl) {
    if (!exerciseBlockEl) return;
    const nameInput = exerciseBlockEl.querySelector('.exercise-name');
    const forced = exerciseBlockEl.getAttribute('data-weight-mode') === 'forced';
    const auto = isBodyweightExercise(nameInput ? nameInput.value : '');
    const hideWeight = auto && !forced;

    exerciseBlockEl.classList.toggle('is-bodyweight', hideWeight);

    const toggleBtn = exerciseBlockEl.querySelector('.toggle-weight-btn');
    if (toggleBtn) {
        // 自重と判定された種目でだけ、手動で重量欄を出し入れできるようにする
        toggleBtn.classList.toggle('is-hidden', !auto);
        toggleBtn.textContent = hideWeight ? '重量を入力する' : '重量なし（自重）に戻す';
    }
}

// 1行 = 「重量 × レップ数 × セット数」。同じ内容を3セットやった場合に3行入力するのは
// 手間なので、セット数の掛け算欄で1行にまとめられるようにしている。
// 保存時(readExerciseBlockData)にセット数ぶんへ展開するため、保存形式は従来と同じ。
function addSetRow(tbody, weight = '', reps = '', count = 1) {
    const row = document.createElement('tr');
    row.classList.add('set-row');
    row.innerHTML = `
        <td class="set-num"></td>
        <td class="col-weight">
            <input type="number" step="any" class="set-weight" placeholder="0" min="0" value="${weight}">
        </td>
        <td class="set-multiply col-weight">×</td>
        <td>
            <input type="number" class="set-reps" placeholder="0" min="0" value="${reps}">
        </td>
        <td class="set-multiply">×</td>
        <td>
            <input type="number" class="set-count" min="1" max="20" value="${count}" title="同じ内容を何セット行ったか">
        </td>
        <td class="set-action">
            <button type="button" class="btn-icon btn-remove-set text-danger" title="この行を削除">
                <i data-lucide="x"></i>
            </button>
        </td>
    `;

    const countInput = row.querySelector('.set-count');
    countInput.addEventListener('input', () => renumberSetRows(tbody));
    countInput.addEventListener('blur', () => {
        const v = parseInt(countInput.value);
        if (isNaN(v) || v < 1) countInput.value = 1;
        renumberSetRows(tbody);
    });

    row.querySelector('.btn-remove-set').addEventListener('click', () => {
        if (tbody.children.length > 1) {
            row.remove();
            renumberSetRows(tbody);
        } else {
            showToast('最低1行は必要です');
        }
    });

    tbody.appendChild(row);
    renumberSetRows(tbody);
    if (window.lucide) {
        lucide.createIcons();
    }
}

// SET列の番号を振り直す。セット数の掛け算があるので、1行が複数セットに対応する場合は
// "3-5" のような範囲表示にして、通しのセット番号が分かるようにする。
function renumberSetRows(tbody) {
    if (!tbody) return;
    let n = 1;
    Array.from(tbody.children).forEach(row => {
        const countInput = row.querySelector('.set-count');
        const raw = countInput ? parseInt(countInput.value) : 1;
        const count = isNaN(raw) || raw < 1 ? 1 : raw;
        const numCell = row.querySelector('.set-num');
        if (numCell) {
            numCell.textContent = count > 1 ? `${n}-${n + count - 1}` : String(n);
        }
        n += count;
    });
    const exBlock = tbody.closest('.exercise-item');
    const totalEl = exBlock ? exBlock.querySelector('.exercise-sets-total-num') : null;
    if (totalEl) totalEl.textContent = String(n - 1);
}

// 種目ブロック(DOM)から入力値を読み取る。不正な入力があればnullを返す。
function readExerciseBlockData(exerciseBlockEl) {
    const name = exerciseBlockEl.querySelector('.exercise-name').value.trim();
    if (!name) {
        showToast('種目名を入力してください');
        return null;
    }

    // 自重種目は重量欄を隠しているので、入力値に関わらず0kgとして保存する
    const isBodyweight = exerciseBlockEl.classList.contains('is-bodyweight');

    const setRows = exerciseBlockEl.querySelectorAll('.set-row');
    const sets = [];
    let hasValidationError = false;

    setRows.forEach(row => {
        const weight = isBodyweight ? 0 : parseFloat(row.querySelector('.set-weight').value);
        const reps = parseInt(row.querySelector('.set-reps').value);
        const rawCount = parseInt(row.querySelector('.set-count').value);
        const count = isNaN(rawCount) || rawCount < 1 ? 1 : rawCount;
        if (isNaN(weight) || isNaN(reps) || weight < 0 || reps < 0) {
            hasValidationError = true;
            return;
        }
        // 「重量×レップ×セット数」の1行を、保存形式(セット1件ずつの配列)へ展開する
        for (let i = 0; i < count; i++) {
            sets.push({ weight, reps });
        }
    });

    if (hasValidationError || sets.length === 0) {
        showToast(isBodyweight
            ? 'セットの入力内容を確認してください（レップ数を正しく入力）'
            : 'セットの入力内容を確認してください（重量・レップ数を正しく入力）');
        return null;
    }

    return { name, sets };
}

// 現在フォームで開いているワークアウトを返す。無ければ新規作成する。
// (state.editingWorkoutIdが指すワークアウトが見つからない場合＝履歴側で削除された等も、
//  ここで新規作成にフォールバックすることで種目保存が無反応になるのを防ぐ)
function getOrCreateOpenWorkout() {
    let workout = state.editingWorkoutId
        ? state.workouts.find(w => w.id === state.editingWorkoutId)
        : null;

    if (!workout) {
        workout = {
            id: 'workout-' + Date.now(),
            date: DOM.workoutDate.value,
            time: DOM.workoutTime.value,
            title: '',
            category: DEFAULT_WORKOUT_CATEGORY,
            mood: 'fire',
            impression: '',
            exercises: [],
            estimatedCalories: 0
        };
        state.workouts.unshift(workout);
        // 種目を1つでも保存した時点で「進行中のセッション」になる。以後アプリを閉じても
        // 開き直せば同じセッションへ追記される(履歴から編集し直す必要がない)。
        // 案内文は種目を追加し終えたあと(saveExerciseBlockの末尾)で出す。
        // ここで出すと、まだexercisesが空なので「0種目 保存済み」になってしまう。
        setOpenWorkoutId(workout.id);
        formBoundWorkoutId = workout.id;
        workoutFormMode = 'resume';
    }

    return workout;
}

// 日付・時刻・調子・メモ(セッションのメタ情報)を、渡されたワークアウトへ最新のフォーム値で反映する。
function applyOpenWorkoutMetaFromForm(workout) {
    workout.date = DOM.workoutDate.value;
    workout.time = DOM.workoutTime.value;
    const moodInput = DOM.workoutForm ? DOM.workoutForm.querySelector('input[name="workout-mood"]:checked') : null;
    if (moodInput) workout.mood = moodInput.value;
    if (DOM.workoutImpression) workout.impression = DOM.workoutImpression.value.trim();
}

// 調子・メモは種目とは独立して変更されうるため、既に開いている(=既存)ワークアウトが
// あれば、種目を保存し直さなくてもその場で変更を反映する。
// (新規記録でまだ種目を1件も保存していない段階では、メモだけでワークアウトを
//  作らないという既存の仕様を維持するため、開いているワークアウトが無ければ何もしない)
function persistOpenWorkoutMetaIfAny() {
    if (!state.editingWorkoutId) return;
    const workout = state.workouts.find(w => w.id === state.editingWorkoutId);
    if (!workout) return;

    applyOpenWorkoutMetaFromForm(workout);
    saveDataAndSync();
}

// 種目1件をその場で保存する。ジムでリアルタイムに使うことを想定し、
// 種目をまとめて最後に一括保存するのではなく、1種目終えるごとに個別保存できるようにしている。
function saveExerciseBlock(exerciseBlockEl) {
    const data = readExerciseBlockData(exerciseBlockEl);
    if (!data) return;

    if (!DOM.workoutDate.value || !DOM.workoutTime.value) {
        showToast('日付と時刻を入力してください');
        return;
    }

    const workout = getOrCreateOpenWorkout();
    applyOpenWorkoutMetaFromForm(workout);

    const existingIndexAttr = exerciseBlockEl.getAttribute('data-existing-index');
    const isExisting = existingIndexAttr !== null && existingIndexAttr !== '';

    let exerciseIndex;
    if (isExisting) {
        exerciseIndex = parseInt(existingIndexAttr);
        workout.exercises[exerciseIndex] = data;
    } else {
        workout.exercises.push(data);
        exerciseIndex = workout.exercises.length - 1;
        exerciseBlockEl.setAttribute('data-existing-index', String(exerciseIndex));
    }

    workout.estimatedCalories = estimateWorkoutCalories(workout.exercises, WORKOUT_CALORIES_PER_SET);

    saveDataAndSync();

    // 同じ種目名の過去の記録(全ワークアウト横断)と比べて、今回が自己ベスト更新かどうかを判定する
    const prs = computeExercisePRs(state.workouts);
    const isPR = prs.has(`${workout.id}::${exerciseIndex}`);
    const prSuffix = isPR ? ' 🏆自己ベスト更新！' : '';
    showToast(`「${data.name}」を${isExisting ? '更新' : '保存'}しました${prSuffix}`);

    if (!isExisting) {
        // 保存済みの種目は片付けて、次の種目をすぐ入力できる空ブロックを用意する
        exerciseBlockEl.remove();
        addExerciseBlock();
        if (window.lucide) lucide.createIcons();
    }

    updateWorkoutCalorieHint();
    // 保存後の実際の種目数で案内を出し直す(初回保存時はここで初めて表示される)
    showWorkoutResumeHint(workout);
    updateDashboard();
    updateHistoryList();
}

function removeExerciseBlock(exerciseBlockEl) {
    const existingIndexAttr = exerciseBlockEl.getAttribute('data-existing-index');
    const isExisting = existingIndexAttr !== null && existingIndexAttr !== '' && !!state.editingWorkoutId;

    const removeBlockFromDom = () => {
        exerciseBlockEl.style.animation = 'slideIn 0.2s ease reverse';
        setTimeout(() => {
            exerciseBlockEl.remove();
            reindexExistingExerciseBlocks();
        }, 200);
    };

    if (isExisting) {
        const exerciseName = exerciseBlockEl.querySelector('.exercise-name').value || 'この種目';
        showConfirmModal('種目の削除', `「${exerciseName}」を削除しますか？（保存済みの記録から削除されます）`, () => {
            const workout = state.workouts.find(w => w.id === state.editingWorkoutId);
            if (workout) {
                workout.exercises.splice(parseInt(existingIndexAttr), 1);
                workout.estimatedCalories = estimateWorkoutCalories(workout.exercises, WORKOUT_CALORIES_PER_SET);
                saveDataAndSync();
                showToast('種目を削除しました');
                updateWorkoutCalorieHint();
                updateDashboard();
                updateHistoryList();
            }
            removeBlockFromDom();
        });
    } else {
        removeBlockFromDom();
    }
}

// data-existing-index は「開いているワークアウトのexercises配列でのインデックス」を表す。
// ブロック削除後は後続の保存済みブロックの番号がずれるため、DOM順(=配列順という前提)で振り直す
function reindexExistingExerciseBlocks() {
    if (!DOM.exerciseList) return;
    let idx = 0;
    Array.from(DOM.exerciseList.children).forEach(child => {
        if (child.hasAttribute('data-existing-index')) {
            child.setAttribute('data-existing-index', String(idx));
            idx++;
        }
    });
}

function updateWorkoutCalorieHint() {
    if (!DOM.workoutCalorieHint) return;
    const workout = state.editingWorkoutId ? state.workouts.find(w => w.id === state.editingWorkoutId) : null;
    const kcal = workout ? estimateWorkoutCalories(workout.exercises, WORKOUT_CALORIES_PER_SET) : 0;
    DOM.workoutCalorieHint.textContent = `※このセッションの筋トレ消費目安: ${kcal} kcal`;
}

// 有酸素欄に最後に反映した日付と、その時に表示した既存の距離(空文字=記録なし)。
// 日付を変えた時に「ユーザーが打ち込んだ値か、既存記録を表示しているだけか」を見分けるために使う。
let lastSyncedCardioDate = null;
let lastSyncedCardioValue = '';

// トレーニングの日付にすでにある有酸素の記録を、有酸素欄へ反映する。
// keepTyped=true(日付の変更時)は、ユーザーが打ち込んだ値を残して既存記録の案内だけ出し直す
// (距離を入れてから日付を直す、という順番でも入力が消えないように)。
function syncCardioFieldForDate(date, { keepTyped = false } = {}) {
    const existingCardio = date ? state.cardioLogs.find(c => c.date === date) : null;
    const existingVal = existingCardio ? String(existingCardio.distance) : '';
    if (DOM.logCardioDist) {
        const current = DOM.logCardioDist.value.trim();
        const typed = current !== '' && current !== lastSyncedCardioValue;
        if (!(keepTyped && typed)) DOM.logCardioDist.value = existingVal;
    }
    updateCardioHint();

    // 自動で反映したことが分かるよう、理由を明示するヒントを出す
    // (何も言わずにフォームが埋まっていると、ユーザーが「なぜ？」と混乱するため)
    if (DOM.cardioExistingHint && DOM.cardioExistingHintText) {
        if (existingCardio) {
            DOM.cardioExistingHintText.textContent =
                `この日はすでに有酸素 ${existingCardio.distance}km を記録済みです（距離を変えて「トレーニングを記録完了」を押すと上書きされます）`;
            DOM.cardioExistingHint.classList.remove('is-hidden');
        } else {
            DOM.cardioExistingHint.classList.add('is-hidden');
        }
    }

    lastSyncedCardioDate = date || null;
    lastSyncedCardioValue = existingVal;
}

// 有酸素欄を読む。{ state: 'empty' | 'invalid' | 'value', distance }
function readCardioField() {
    const text = DOM.logCardioDist ? DOM.logCardioDist.value.trim() : '';
    if (text === '') return { state: 'empty', distance: null };
    const dist = parseFloat(text);
    if (isNaN(dist) || dist <= 0) return { state: 'invalid', distance: null };
    return { state: 'value', distance: dist };
}

// 有酸素を保存する(同じ日付の既存エントリがあれば上書き)。保存したかどうかを返す。
// 同期・再描画は呼び出し側(finishTrainingSession)でまとめて行う。
function saveCardioForDate(date, dist) {
    const calories = Math.round(dist * getLatestWeight());
    const existingCardioIndex = state.cardioLogs.findIndex(c => c.date === date);
    const updated = existingCardioIndex !== -1;
    if (updated) {
        state.cardioLogs[existingCardioIndex] = { date, distance: dist, calories };
    } else {
        state.cardioLogs.push({ date, distance: dist, calories });
    }
    state.cardioLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
    return { updated };
}

// 「トレーニングを記録完了」。開いている筋トレのセッション(種目は個別保存済み)を締めくくり、
// 有酸素の距離が入っていれば同じ日付で一緒に保存する(v1.27.0)。
// 走っただけの日は種目を入れずに距離だけで完了できる。
function finishTrainingSession() {
    const date = DOM.workoutDate ? DOM.workoutDate.value : '';
    const cardio = readCardioField();
    if (cardio.state === 'invalid') {
        showToast('有酸素の走行距離は0より大きい数値で入力してください（走らなかった日は空欄のまま）');
        return;
    }
    const hasSession = !!state.editingWorkoutId;
    if (!hasSession && cardio.state !== 'value') {
        showToast('先に種目を1つ以上保存するか（種目ごとの「この種目を保存」ボタン）、有酸素の距離を入力してください');
        return;
    }
    if (cardio.state === 'value' && !date) {
        showToast('日付を入力してください');
        return;
    }

    // 有酸素は距離が既存の記録と違う時だけ書き込む(開き直しただけの記録完了で上書きしない)
    let cardioNote = '';
    let cardioSaved = false;
    if (cardio.state === 'value') {
        const existing = state.cardioLogs.find(c => c.date === date);
        if (!existing || existing.distance !== cardio.distance) {
            const { updated } = saveCardioForDate(date, cardio.distance);
            cardioSaved = true;
            cardioNote = `有酸素 ${cardio.distance}km${updated ? '（更新）' : ''}`;
        }
    }

    if (!hasSession) {
        saveDataAndSync();
        showToast(cardioSaved ? `${cardioNote}を記録しました！` : 'この日の有酸素はすでにこの距離で記録済みです');
        syncCardioFieldForDate(date);
        updateDashboard();
        updateCardioHistoryList();
        return;
    }

    // blurのタイミングに関わらず、完了時点の調子・メモを取りこぼさないよう念のため反映する
    const workout = state.workouts.find(w => w.id === state.editingWorkoutId);
    if (workout) applyOpenWorkoutMetaFromForm(workout);
    const finishedDate = workout ? workout.date : date;

    saveDataAndSync();
    showToast(`トレーニングを記録しました！${cardioNote ? `（${cardioNote}も保存）` : ''}`);

    resetWorkoutForm();

    updateDashboard();
    updateHistoryList();
    updateCardioHistoryList();

    // 締めくくったセッションを履歴で目立たせて見せる
    openHistoryAt('workouts', finishedDate);
}

// クラウド同期のダウンロード・JSONインポートのマージ・全データ初期化など、
// state.*(workouts/weightLogs/cardioLogs/mealLogs)が外部要因でまとめて置き換わった直後に呼ぶ。
// 「記録する」タブのフォームを表示したまま(古い値のまま)にしておくと、次にどちらかの
// フォームを送信した時に、今取り込んだばかりのデータを古い値で上書きしてしまう
// (実際に発生した不具合)。トレーニングは進行中のセッションが裏で入れ替わっている可能性が
// あるため安全に組み立て直し、他のフォームは選択中の日付で最新のstateに合わせ直す。
function refreshRecordFormsAfterExternalDataChange() {
    // 進行中のセッションは、取り込み後のデータにも同じidが残っていれば引き継ぐ。
    // ただしフォームは必ず新しいstateから組み立て直す(force)。表示が古いまま残ると、
    // 次の送信で取り込んだばかりのデータを古い値で上書きしてしまうため。
    // 起動時の自動同期もここを通るので、単純にresetすると開いているセッションが
    // 毎回失われてしまう(セッションの永続化が意味を成さなくなる)。
    // 有酸素欄も populate / reset の中で選択中の日付に合わせ直される。
    syncWorkoutFormWithOpenSession({ force: true });

    if (DOM.weightQuickDate && DOM.weightQuickDate.value) {
        syncDailyLogFormWithExistingDataForDate(DOM.weightQuickDate.value);
    }
    if (DOM.mealDate && DOM.mealDate.value) {
        syncMealFormWithExistingDataForDate(DOM.mealDate.value);
    }
}

// ==========================================
// DRINKING (飲み会: 食事の記録の「夕食」の分岐)
// ==========================================

function isDrinkingDate(date) {
    return !!date && state.drinkingLogs.some(d => d.date === date);
}

// 「飲み会だった」のチェックに合わせて、目安の選択欄と案内を出し分ける。
// 記録済みの日にチェックを外すと、保存で飲み会の記録だけを取り消すことをここで予告する
// (黙って取り消すと、チェックを触っただけで記録が消えたように見えるため)。
function updateMealDrinkingUi() {
    const checked = !!(DOM.mealDinnerDrinking && DOM.mealDinnerDrinking.checked);
    const exists = isDrinkingDate(DOM.mealDate ? DOM.mealDate.value : '');
    if (DOM.mealDrinkingPanel) DOM.mealDrinkingPanel.classList.toggle('is-hidden', !checked);
    if (DOM.mealDrinkingHint && DOM.mealDrinkingHintText) {
        let text = '';
        if (exists && checked) text = 'この日は飲み会として記録済みです。';
        if (exists && !checked) text = '「食事を記録」を押すと、この日の飲み会の記録を取り消します（夕食のカロリーはそのまま残ります）。';
        DOM.mealDrinkingHintText.textContent = text;
        DOM.mealDrinkingHint.classList.toggle('is-hidden', text === '');
    }
}

// ==========================================
// MEAL (食事: 朝食/昼食/夕食/間食の摂取kcal目安)
// ==========================================

// 食事キー(breakfast/lunch/dinner/snacks)から対応するnumber input/目安selectのDOM要素を返す。
function getMealFieldEls(mealKey) {
    const map = {
        breakfast: { input: DOM.mealBreakfast, select: DOM.mealBreakfastEstimate },
        lunch: { input: DOM.mealLunch, select: DOM.mealLunchEstimate },
        dinner: { input: DOM.mealDinner, select: DOM.mealDinnerEstimate },
        snacks: { input: DOM.mealSnacks, select: DOM.mealSnacksEstimate }
    };
    return map[mealKey] || {};
}

// 各食事欄の「手動入力」/「目安から選択」切り替え(chart-period-toggleのUIを流用)。
// 外食・間食などカロリーがわかるものは手動入力、家で作ってもらった食事など正確な量が
// わからないものは目安(少なめ/普通/多め)から選べるようにする。
// 保存される実データは常にnumber inputの値(=readMealFormValues/saveMealLogは変更不要。
// estimate selectはinputへ値を書き込むだけの入力補助であり、別の値として保持しない)。
function initMealModeToggles() {
    document.querySelectorAll('.meal-mode-toggle').forEach(toggle => {
        const mealKey = toggle.getAttribute('data-meal');
        const els = getMealFieldEls(mealKey);
        if (!els.input || !els.select) return;

        toggle.querySelectorAll('.meal-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.getAttribute('data-mode');
                toggle.querySelectorAll('.meal-mode-btn').forEach(b => b.classList.toggle('active', b === btn));
                if (mode === 'estimate') {
                    els.input.classList.add('is-hidden');
                    els.select.classList.remove('is-hidden');
                } else {
                    els.select.classList.add('is-hidden');
                    els.input.classList.remove('is-hidden');
                    els.input.focus();
                }
            });
        });

        els.select.addEventListener('change', () => {
            els.input.value = els.select.value;
            updateMealTotalHint();
        });
    });
}

// 1つの食事欄の表示モードを切り替える(飲み会の目安を選んだ時に夕食欄を手動入力へ戻すのに使う)
function setMealFieldMode(mealKey, mode) {
    const toggle = document.querySelector(`.meal-mode-toggle[data-meal="${mealKey}"]`);
    const els = getMealFieldEls(mealKey);
    if (!toggle || !els.input || !els.select) return;
    toggle.querySelectorAll('.meal-mode-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-mode') === mode);
    });
    els.select.classList.toggle('is-hidden', mode !== 'estimate');
    els.input.classList.toggle('is-hidden', mode === 'estimate');
}

// 各食事欄の表示モードを「手動入力」に戻す(number inputを表示、目安selectを隠して選択を解除する)。
// どのモードで入力したかは保存しないため、既存データの反映時には毎回これで初期状態に揃える
// (前回このフォームで選んでいたモード・選択値を、別の日付に持ち越さないため)。
function resetMealFieldModesToManual() {
    document.querySelectorAll('.meal-mode-toggle').forEach(toggle => {
        const mealKey = toggle.getAttribute('data-meal');
        const els = getMealFieldEls(mealKey);
        if (!els.input || !els.select) return;
        toggle.querySelectorAll('.meal-mode-btn').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-mode') === 'manual');
        });
        els.select.value = '';
        els.select.classList.add('is-hidden');
        els.input.classList.remove('is-hidden');
    });
}

// フォームで選択中の日付にすでにある食事記録を返す(無ければnull)。
function getExistingMealForCurrentDate() {
    if (!DOM.mealDate || !DOM.mealDate.value) return null;
    return state.mealLogs.find(m => m.date === DOM.mealDate.value) || null;
}

// 保存後の見込み値(朝食/昼食/夕食は「入力があればその値、空欄なら既存値のまま」、
// 間食は「既存の合計＋今回の入力分」)をまとめて返す。ヒント表示・保存処理の両方で使う。
function computeProjectedMealValues(formValues, existingMeal) {
    // 既存値はNumber()で受ける。取り込み境界(filterValidMealLogs)で数値へ正規化済みだが、
    // 間食の加算が文字列連結("300"+50="30050")になる事故は影響が大きいため、
    // 計算側でも念のため数値化しておく
    const readExisting = (key) => existingMeal ? (Number(existingMeal[key]) || 0) : 0;
    const resolveOverwrite = (formVal, key) => formVal !== null ? formVal : readExisting(key);
    const existingSnacksTotal = readExisting('snacks');
    const snacksIncrement = formValues.snacks !== null ? formValues.snacks : 0;
    return {
        breakfast: resolveOverwrite(formValues.breakfast, 'breakfast'),
        lunch: resolveOverwrite(formValues.lunch, 'lunch'),
        dinner: resolveOverwrite(formValues.dinner, 'dinner'),
        snacks: existingSnacksTotal + snacksIncrement,
        existingSnacksTotal,
        snacksIncrement
    };
}

function updateMealTotalHint() {
    if (!DOM.mealTotalHint) return;
    const values = readMealFormValues();
    const existingMeal = getExistingMealForCurrentDate();
    const projected = computeProjectedMealValues(values, existingMeal);
    const sum = projected.breakfast + projected.lunch + projected.dinner + projected.snacks;
    const snackNote = projected.snacksIncrement > 0
        ? `（間食は既存${projected.existingSnacksTotal}kcal + 今回${projected.snacksIncrement}kcal）`
        : '';
    DOM.mealTotalHint.textContent = `※保存後の合計摂取目安: ${sum} kcal${snackNote}`;
}

// フォームの4つの入力欄を数値として読み取る。空欄はnull(=未入力・変更しない)を返し、
// 0や実際の数値と区別する(空欄をここで0に丸めてしまうと、朝食欄などを空欄のまま
// 保存した時に既存の値が0で上書きされてしまう問題があったため)。
function readMealFormValues() {
    const readOne = (input) => {
        if (!input || input.value.trim() === '') return null;
        const v = parseFloat(input.value);
        return isNaN(v) || v < 0 ? null : Math.round(v);
    };
    return {
        breakfast: readOne(DOM.mealBreakfast),
        lunch: readOne(DOM.mealLunch),
        dinner: readOne(DOM.mealDinner),
        snacks: readOne(DOM.mealSnacks)
    };
}

// 直近でフォームに反映した日付。日付変更時の「未保存の入力を破棄してよいか」判定の基準にする。
let lastSyncedMealDate = null;

// フォームで選択された日付にすでにある食事の記録を、フォームへ反映する。
// (cardio/weightと同じく、空欄のまま日付だけ変えて誤送信するとその日の記録を消してしまうため)
function syncMealFormWithExistingDataForDate(date) {
    if (!date) return;

    resetMealFieldModesToManual();

    const existingMeal = state.mealLogs.find(m => m.date === date);
    if (DOM.mealBreakfast) DOM.mealBreakfast.value = existingMeal ? existingMeal.breakfast : '';
    if (DOM.mealLunch) DOM.mealLunch.value = existingMeal ? existingMeal.lunch : '';
    if (DOM.mealDinner) DOM.mealDinner.value = existingMeal ? existingMeal.dinner : '';
    // 間食欄だけは「今回追加する分」を入力する欄のため、既存の合計値をここに出さない
    // (出してしまうと、そのまま保存し直した時に既存分と二重に加算されてしまう)
    if (DOM.mealSnacks) DOM.mealSnacks.value = '';
    // 飲み会(夕食の分岐)はその日の記録の有無をそのままチェックに出す
    if (DOM.mealDinnerDrinking) DOM.mealDinnerDrinking.checked = isDrinkingDate(date);
    if (DOM.mealDrinkingEstimate) DOM.mealDrinkingEstimate.value = '';
    updateMealDrinkingUi();
    updateMealTotalHint();

    if (DOM.mealExistingHint && DOM.mealExistingHintText) {
        if (existingMeal) {
            const total = sumMealCalories(existingMeal);
            DOM.mealExistingHintText.textContent =
                `この日はすでに食事の記録（合計 ${total} kcal、うち間食 ${existingMeal.snacks || 0} kcal）があります。朝食・昼食・夕食は入力した項目だけ上書きされます（空欄のままなら変更されません）。間食は入力した分がここに追加されます。`;
            DOM.mealExistingHint.classList.remove('is-hidden');
        } else {
            DOM.mealExistingHint.classList.add('is-hidden');
        }
    }

    lastSyncedMealDate = date;
}

// 日付選択(change)時のハンドラ。入力中の未保存の値が破棄されそうな場合は先に確認する。
// 朝食/昼食/夕食は「空欄(null)なら未変更」「保存済みの値と同じならこちらも未変更」を
// どちらも安全とみなす。間食欄は同期直後は常に空欄(=今回まだ何も追加していない状態)が
// 正しいため、空欄または0(=入力したが加算なし)だけを安全とみなす。
function handleMealDateChange() {
    const newDate = DOM.mealDate.value;
    const current = readMealFormValues();
    const savedForOldDate = lastSyncedMealDate ? state.mealLogs.find(m => m.date === lastSyncedMealDate) : null;

    const fieldUnchanged = (val, key) => val === null || val === (savedForOldDate ? (savedForOldDate[key] || 0) : 0);
    const matchesSaved =
        fieldUnchanged(current.breakfast, 'breakfast') &&
        fieldUnchanged(current.lunch, 'lunch') &&
        fieldUnchanged(current.dinner, 'dinner') &&
        (current.snacks === null || current.snacks === 0) &&
        !isMealDrinkingChanged(lastSyncedMealDate);

    if (!matchesSaved && !confirm('入力中の食事の記録が保存されていません。日付を変更すると入力内容が失われます。続けますか？')) {
        if (lastSyncedMealDate) DOM.mealDate.value = lastSyncedMealDate;
        return;
    }
    syncMealFormWithExistingDataForDate(newDate);
}

// 「飲み会だった」のチェックが、その日の記録の有無と食い違っているか(=保存で変わるか)
function isMealDrinkingChanged(date) {
    if (!DOM.mealDinnerDrinking || !date) return false;
    return DOM.mealDinnerDrinking.checked !== isDrinkingDate(date);
}

// 食事を保存する。朝食/昼食/夕食は「入力した項目だけ上書き、空欄は
// 既存値のまま維持」、間食は「時間帯ごとに複数回記録することが多いため、既存の間食合計に
// 今回の入力分を加算」する(「ある時間帯にひとつ登録して、次に登録する時には現在の登録に
// 足し算される」仕様)。
// 夕食の「飲み会だった」のチェックが記録と食い違っていれば、飲み会の記録も付け外しする。
// 食事欄が全部空欄でも、飲み会のチェックだけを変えた場合は保存できる。
function saveMealLog() {
    if (!DOM.mealDate) return;
    const date = DOM.mealDate.value;
    if (!date) {
        showToast('日付を入力してください');
        return;
    }

    const values = readMealFormValues();
    const hasAnyInput = values.breakfast !== null || values.lunch !== null || values.dinner !== null || values.snacks !== null;
    const drinkingChanged = isMealDrinkingChanged(date);
    if (!hasAnyInput && !drinkingChanged) {
        showToast('少なくとも1つの項目を入力してください');
        return;
    }

    const messages = [];
    let mealUpdated = false;
    if (hasAnyInput) {
        const existingIndex = state.mealLogs.findIndex(m => m.date === date);
        mealUpdated = existingIndex !== -1;
        const existingMeal = mealUpdated ? state.mealLogs[existingIndex] : null;
        const projected = computeProjectedMealValues(values, existingMeal);
        const record = { date, breakfast: projected.breakfast, lunch: projected.lunch, dinner: projected.dinner, snacks: projected.snacks };
        if (mealUpdated) {
            state.mealLogs[existingIndex] = record;
        } else {
            state.mealLogs.push(record);
        }
        state.mealLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
        const snackSuffix = projected.snacksIncrement > 0 ? `（間食 +${projected.snacksIncrement}kcal）` : '';
        messages.push(`${mealUpdated ? '食事(更新)' : '食事'}を記録しました${snackSuffix}`);
    }

    if (drinkingChanged) {
        if (DOM.mealDinnerDrinking.checked) {
            state.drinkingLogs.push({ date });
            state.drinkingLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
            messages.push('🍻 飲み会として記録しました');
        } else {
            // 取り消し時も食事記録(夕食のカロリー)には手を付けない。消すと、あとから
            // 調整した値まで巻き添えで失われるため(迷ったら残す側に倒す)
            state.drinkingLogs = state.drinkingLogs.filter(d => d.date !== date);
            messages.push('飲み会の記録を取り消しました');
        }
    }

    saveDataAndSync();
    showToast(messages.join('。') + '！');

    // 保存直後のフォームには「たった今保存した内容」が表示され続けるようにする
    syncMealFormWithExistingDataForDate(date);

    updateDashboard();
    updateMealHistoryList();
    if (drinkingChanged) updateWeightHistoryList();
    if (hasAnyInput) updateCalorieBalanceHistoryList();
}

// 日別サマリーモーダルからの削除で使う(cardio/weightのdelete*Logと同じ形)。
function deleteMealLog(entry) {
    const index = state.mealLogs.indexOf(entry);
    if (index >= 0) {
        state.mealLogs.splice(index, 1);
        saveDataAndSync();
        showToast('食事記録を削除しました');
        updateDashboard();
        updateMealHistoryList();
        if (DOM.mealDate && DOM.mealDate.value === entry.date) {
            syncMealFormWithExistingDataForDate(entry.date);
        }
    }
}

// ==========================================
// WEIGHT (ジムに行かなくても入力する部分)
// ==========================================

function getLatestWeight() {
    // 昇順ソート済みのstate.weightLogsから最新値を取り出す部分はlib/data-utils.jsの
    // 純粋関数に委譲（ロジック自体はそちらでテストする）
    return getLatestWeightFromLogs(state.weightLogs, DEFAULT_WEIGHT_KG);
}

function updateCardioHint() {
    if (!DOM.logCardioDist || !DOM.cardioCalcHint) return;
    const dist = parseFloat(DOM.logCardioDist.value) || 0;
    const latestWeight = getLatestWeight();
    const kcal = Math.round(dist * latestWeight);
    DOM.cardioCalcHint.textContent = `※消費目安: ${kcal} kcal (最新体重: ${latestWeight} kg)`;
}

// 直近で体重フォームに反映した日付。日付変更時の「未保存の入力を破棄してよいか」判定の基準にする。
let lastSyncedDailyLogDate = null;

// 体重フォームで選択された日付にすでにある体重の記録を、フォームへ反映する。
// (これをせずに空欄のまま日付だけ変えて誤送信すると、既存記録の見落としに気づけないため)
function syncDailyLogFormWithExistingDataForDate(date) {
    if (!date) return;

    const existingWeight = state.weightLogs.find(w => w.date === date);
    if (DOM.weightQuickVal) {
        DOM.weightQuickVal.value = existingWeight ? existingWeight.weight : '';
    }

    // 自動で反映したことが分かるよう、理由を明示するヒントを出す
    if (DOM.dailyLogExistingHint && DOM.dailyLogExistingHintText) {
        if (existingWeight) {
            DOM.dailyLogExistingHintText.textContent =
                `この日はすでに体重 ${existingWeight.weight}kg を記録済みです（内容を変更すると上書きされます）`;
            DOM.dailyLogExistingHint.classList.remove('is-hidden');
        } else {
            DOM.dailyLogExistingHint.classList.add('is-hidden');
        }
    }

    lastSyncedDailyLogDate = date;
}

// 日付選択(change)時のハンドラ。入力中の未保存の値が破棄されそうな場合は先に確認する。
function handleDailyLogDateChange() {
    const newDate = DOM.weightQuickDate.value;

    const savedWeight = lastSyncedDailyLogDate ? state.weightLogs.find(w => w.date === lastSyncedDailyLogDate) : null;
    const currentWeightVal = DOM.weightQuickVal ? DOM.weightQuickVal.value.trim() : '';
    const savedWeightVal = savedWeight ? String(savedWeight.weight) : '';
    const isDirty = currentWeightVal !== '' && currentWeightVal !== savedWeightVal;

    if (isDirty && !confirm('入力中の体重が保存されていません。日付を変更すると入力内容が失われます。続けますか？')) {
        if (lastSyncedDailyLogDate) DOM.weightQuickDate.value = lastSyncedDailyLogDate;
        return;
    }
    syncDailyLogFormWithExistingDataForDate(newDate);
}

// 体重を記録する（ジムに行かない日でも入力する部分）。
function saveDailyLog() {
    if (!DOM.weightQuickDate) return;
    const date = DOM.weightQuickDate.value;
    if (!date) {
        showToast('日付を入力してください');
        return;
    }

    const weightText = DOM.weightQuickVal ? DOM.weightQuickVal.value.trim() : '';
    if (weightText === '') {
        showToast('体重を入力してください');
        return;
    }
    const weight = parseFloat(weightText);
    if (isNaN(weight) || weight <= 0) {
        showToast('有効な体重を入力してください');
        return;
    }
    const existingIndex = state.weightLogs.findIndex(w => w.date === date);
    const weightUpdated = existingIndex !== -1;
    if (weightUpdated) {
        state.weightLogs[existingIndex].weight = weight;
    } else {
        state.weightLogs.push({ date, weight });
    }
    state.weightLogs.sort((a, b) => new Date(a.date) - new Date(b.date));

    saveDataAndSync();

    // 既存日付への上書きだと誤操作に気づきやすいよう、新規/更新を区別した文言にする
    showToast(`${weightUpdated ? '体重(更新)' : '体重'}を記録しました！`);

    // 単純に空欄へ戻すのではなく、今保存した内容で再同期する
    // (同じ日付を選んだままなら、保存直後のフォームには「たった今保存した内容」が
    //  正しく表示され続けるべきで、ヒントも最新の状態に更新される)
    syncDailyLogFormWithExistingDataForDate(date);

    updateCardioHint(); // 体重が変わると有酸素の消費目安も変わるため
    updateDashboard();
    updateWeightHistoryList();
}
