// FITFLOW - 「記録する」タブ: トレーニング・有酸素・体重の3つの独立したフォーム。
//   パート1(#workout-form)     : トレーニング(筋トレ)
//   パート2(#cardio-form)      : 有酸素(走行距離)
//   パート3(#weight-quick-form): 体重
// それぞれ一つずつ入力・保存できる(以前の「有酸素を保存して完了」のような合体送信は廃止)。
//
// 筋トレの種目は「まとめて最後に一括保存」ではなく、1種目入力し終えるごとに
// その場で個別保存できる（ジムでのリアルタイム入力を想定）。編集中/記録中のワークアウトの
// idはstate.editingWorkoutIdが指す（履歴からの編集・新規リアルタイム記録の両方で共用）。
//
// 日付のデフォルトはgetFitnessDateString(27時ルール: AM3時までは前日扱い)を使う。
// 深夜のトレーニング後に記録しても「今日」に化けないようにするため。

function initFormControls() {
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

    // パート2: 有酸素
    if (DOM.cardioForm) {
        if (DOM.cardioDate) {
            DOM.cardioDate.value = getFitnessDateString();
            syncCardioFormWithExistingDataForDate(DOM.cardioDate.value);
            // 日付を選び直した時、その日にすでにある有酸素の記録をフォームに反映する
            // (未保存の入力があれば、破棄前に確認する = handleCardioDateChange)
            DOM.cardioDate.addEventListener('change', handleCardioDateChange);
        }
        if (DOM.logCardioDist) {
            DOM.logCardioDist.addEventListener('input', updateCardioHint);
        }
        DOM.cardioForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveCardioLog();
        });
    }

    // パート3: 体重
    if (DOM.weightQuickForm) {
        if (DOM.weightQuickDate) {
            DOM.weightQuickDate.value = getFitnessDateString();
            syncDailyLogFormWithExistingDataForDate(DOM.weightQuickDate.value);
        }
        DOM.weightQuickDate.addEventListener('change', handleDailyLogDateChange);
        DOM.weightQuickForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveDailyLog();
        });
    }
}

function resetWorkoutForm() {
    state.editingWorkoutId = null;
    if (DOM.workoutForm) DOM.workoutForm.reset();

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
                <label>セット数:</label>
                <input type="number" class="exercise-sets-input" min="1" max="20" value="${data && data.sets ? data.sets.length : 1}">
            </div>
            <button type="button" class="btn-icon btn-remove-exercise text-danger" title="種目を削除">
                <i data-lucide="trash-2"></i>
            </button>
        </div>
        <div class="sets-table-wrapper">
            <table class="sets-table">
                <thead>
                    <tr>
                        <th class="set-num">SET</th>
                        <th>重量 (kg)</th>
                        <th></th>
                        <th>レップ数</th>
                        <th class="set-action"></th>
                    </tr>
                </thead>
                <tbody class="sets-tbody"></tbody>
            </table>
            <button type="button" class="add-set-row-btn">
                <i data-lucide="plus"></i> セットを追加
            </button>
        </div>
        <button type="button" class="btn btn-primary btn-full margin-top-1 btn-save-exercise">
            <i data-lucide="check"></i> この種目を保存
        </button>
    `;

    const tbody = exerciseBlock.querySelector('.sets-tbody');
    const addSetBtn = exerciseBlock.querySelector('.add-set-row-btn');
    const removeExBtn = exerciseBlock.querySelector('.btn-remove-exercise');
    const saveExBtn = exerciseBlock.querySelector('.btn-save-exercise');
    const setsInput = exerciseBlock.querySelector('.exercise-sets-input');
    const namePicker = exerciseBlock.querySelector('.exercise-name-picker');
    const nameInput = exerciseBlock.querySelector('.exercise-name');

    if (namePicker && nameInput) {
        namePicker.addEventListener('change', () => {
            if (namePicker.value) {
                nameInput.value = namePicker.value;
            }
            namePicker.value = '';
        });
    }

    addSetBtn.addEventListener('click', () => {
        addSetRow(tbody);
        if (setsInput) setsInput.value = tbody.children.length;
    });

    if (setsInput) {
        setsInput.addEventListener('input', () => {
            let val = parseInt(setsInput.value);
            if (isNaN(val) || val < 1) return; // Wait for complete input
            const currentSetsCount = tbody.children.length;
            if (val > currentSetsCount) {
                for (let i = 0; i < val - currentSetsCount; i++) {
                    addSetRow(tbody);
                }
            } else if (val < currentSetsCount) {
                for (let i = 0; i < currentSetsCount - val; i++) {
                    if (tbody.lastElementChild) {
                        tbody.lastElementChild.remove();
                    }
                }
            }
        });

        setsInput.addEventListener('blur', () => {
            let val = parseInt(setsInput.value);
            if (isNaN(val) || val < 1) {
                setsInput.value = tbody.children.length;
            }
        });
    }

    saveExBtn.addEventListener('click', () => {
        saveExerciseBlock(exerciseBlock);
    });

    removeExBtn.addEventListener('click', () => {
        removeExerciseBlock(exerciseBlock);
    });

    DOM.exerciseList.appendChild(exerciseBlock);

    if (data && data.sets && data.sets.length > 0) {
        data.sets.forEach(s => addSetRow(tbody, s.weight, s.reps));
    } else {
        addSetRow(tbody);
    }

    if (window.lucide) {
        lucide.createIcons();
    }
}

function addSetRow(tbody, weight = '', reps = '') {
    const setIndex = tbody.children.length + 1;
    const row = document.createElement('tr');
    row.classList.add('set-row');
    row.innerHTML = `
        <td class="set-num">${setIndex}</td>
        <td>
            <input type="number" step="any" class="set-weight" placeholder="0" min="0" value="${weight}">
        </td>
        <td class="set-multiply">×</td>
        <td>
            <input type="number" class="set-reps" placeholder="0" min="0" value="${reps}">
        </td>
        <td class="set-action">
            <button type="button" class="btn-icon btn-remove-set text-danger" title="セットを削除">
                <i data-lucide="x"></i>
            </button>
        </td>
    `;

    row.querySelector('.btn-remove-set').addEventListener('click', () => {
        if (tbody.children.length > 1) {
            row.remove();
            Array.from(tbody.children).forEach((r, idx) => {
                r.querySelector('.set-num').textContent = idx + 1;
            });
            // Update sets count input in the parent exercise block
            const exBlock = tbody.closest('.exercise-item');
            if (exBlock) {
                const sInput = exBlock.querySelector('.exercise-sets-input');
                if (sInput) sInput.value = tbody.children.length;
            }
        } else {
            showToast('最低1セットは必要です');
        }
    });

    tbody.appendChild(row);
    if (window.lucide) {
        lucide.createIcons();
    }
}

// 種目ブロック(DOM)から入力値を読み取る。不正な入力があればnullを返す。
function readExerciseBlockData(exerciseBlockEl) {
    const name = exerciseBlockEl.querySelector('.exercise-name').value.trim();
    if (!name) {
        showToast('種目名を入力してください');
        return null;
    }

    const setRows = exerciseBlockEl.querySelectorAll('.set-row');
    const sets = [];
    let hasValidationError = false;

    setRows.forEach(row => {
        const weight = parseFloat(row.querySelector('.set-weight').value);
        const reps = parseInt(row.querySelector('.set-reps').value);
        if (isNaN(weight) || isNaN(reps) || weight < 0 || reps < 0) {
            hasValidationError = true;
            return;
        }
        sets.push({ weight, reps });
    });

    if (hasValidationError || sets.length === 0) {
        showToast('セットの入力内容を確認してください（重量・レップ数を正しく入力）');
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
        state.editingWorkoutId = workout.id;
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

// 直近でフォームAに反映した日付。日付変更時の「未保存の入力を破棄してよいか」判定の基準にする。
let lastSyncedCardioDate = null;

// フォームで選択された日付にすでにある有酸素の記録を、フォームへ反映する。
// (これをせずに空欄のまま日付だけ変えて誤送信すると、その日の有酸素記録を意図せず消してしまうため)
function syncCardioFormWithExistingDataForDate(date) {
    if (!date) return;

    const existingCardio = state.cardioLogs.find(c => c.date === date);
    if (DOM.logCardioDist) {
        DOM.logCardioDist.value = existingCardio ? existingCardio.distance : '';
    }
    updateCardioHint();

    // 自動で反映したことが分かるよう、理由を明示するヒントを出す
    // (何も言わずにフォームが埋まっていると、ユーザーが「なぜ？」と混乱するため)
    if (DOM.cardioExistingHint && DOM.cardioExistingHintText) {
        if (existingCardio) {
            DOM.cardioExistingHintText.textContent =
                `この日はすでに有酸素 ${existingCardio.distance}km を記録済みです（内容を変更すると上書きされます）`;
            DOM.cardioExistingHint.classList.remove('is-hidden');
        } else {
            DOM.cardioExistingHint.classList.add('is-hidden');
        }
    }

    lastSyncedCardioDate = date;
}

// 日付選択(change)時のハンドラ。入力中の未保存の値が破棄されそうな場合は先に確認する。
function handleCardioDateChange() {
    const newDate = DOM.cardioDate.value;
    const currentVal = DOM.logCardioDist ? DOM.logCardioDist.value.trim() : '';
    const savedForOldDate = lastSyncedCardioDate ? state.cardioLogs.find(c => c.date === lastSyncedCardioDate) : null;
    const savedVal = savedForOldDate ? String(savedForOldDate.distance) : '';
    const isDirty = currentVal !== '' && currentVal !== savedVal;

    if (isDirty && !confirm('入力中の有酸素の記録が保存されていません。日付を変更すると入力内容が失われます。続けますか？')) {
        if (lastSyncedCardioDate) DOM.cardioDate.value = lastSyncedCardioDate;
        return;
    }
    syncCardioFormWithExistingDataForDate(newDate);
}

// パート2: 有酸素を単独で保存する(同じ日付の既存エントリがあれば上書き)。
function saveCardioLog() {
    if (!DOM.cardioDate) return;
    const date = DOM.cardioDate.value;
    if (!date) {
        showToast('日付を入力してください');
        return;
    }

    const cardioText = DOM.logCardioDist ? DOM.logCardioDist.value.trim() : '';
    if (cardioText === '') {
        showToast('走行距離を入力してください');
        return;
    }
    const dist = parseFloat(cardioText);
    if (isNaN(dist) || dist <= 0) {
        showToast('有効な走行距離を入力してください');
        return;
    }
    const calories = Math.round(dist * getLatestWeight());

    // 体重ログと同様、同じ日付の既存エントリがあれば上書きする
    const existingCardioIndex = state.cardioLogs.findIndex(c => c.date === date);
    const cardioUpdated = existingCardioIndex !== -1;
    if (cardioUpdated) {
        state.cardioLogs[existingCardioIndex] = { date, distance: dist, calories };
    } else {
        state.cardioLogs.push({ date, distance: dist, calories });
    }
    state.cardioLogs.sort((a, b) => new Date(a.date) - new Date(b.date));

    saveDataAndSync();

    // 既存日付への上書きだと誤操作に気づきやすいよう、新規/更新を区別した文言にする
    showToast(`${cardioUpdated ? '有酸素(更新)' : '有酸素'}を記録しました！`);

    // 保存直後のフォームには「たった今保存した内容」が表示され続けるようにする
    syncCardioFormWithExistingDataForDate(date);

    updateDashboard();
    updateCardioHistoryList();
}

// パート1: 開いているトレーニングセッション(種目は既に個別保存済み)を締めくくる。
// 種目自体はこの関数では扱わない(各種目ブロックの「保存」ボタンで個別に保存済みのため)。
function finishTrainingSession() {
    if (!state.editingWorkoutId) {
        showToast('先に種目を1つ以上保存してください（種目ごとの「この種目を保存」ボタン）');
        return;
    }

    // blurのタイミングに関わらず、完了時点の調子・メモを取りこぼさないよう念のため反映する
    const workout = state.workouts.find(w => w.id === state.editingWorkoutId);
    if (workout) applyOpenWorkoutMetaFromForm(workout);

    saveDataAndSync();
    showToast('トレーニングを記録しました！');

    state.editingWorkoutId = null;
    resetWorkoutForm();

    updateDashboard();
    updateHistoryList();

    const historyNavItem = document.querySelector('[data-tab="history"]');
    if (historyNavItem) {
        historyNavItem.click();
    }
}

// クラウド同期のダウンロード・JSONインポートのマージ・全データ初期化など、
// state.*(workouts/weightLogs/cardioLogs)が外部要因でまとめて置き換わった直後に呼ぶ。
// 「記録する」タブのフォームを表示したまま(古い値のまま)にしておくと、次にどちらかの
// フォームを送信した時に、今取り込んだばかりのデータを古い値で上書きしてしまう
// (実際に発生した不具合)。フォームAは進行中のセッションが裏で入れ替わっている可能性が
// あるため安全にリセットし、フォームBは選択中の日付で最新のstateに合わせ直す。
function refreshRecordFormsAfterExternalDataChange() {
    resetWorkoutForm();

    if (DOM.cardioDate && DOM.cardioDate.value) {
        syncCardioFormWithExistingDataForDate(DOM.cardioDate.value);
    }
    if (DOM.weightQuickDate && DOM.weightQuickDate.value) {
        syncDailyLogFormWithExistingDataForDate(DOM.weightQuickDate.value);
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

// 直近でフォームBに反映した日付。日付変更時の「未保存の入力を破棄してよいか」判定の基準にする。
let lastSyncedDailyLogDate = null;

// フォームBで選択された日付にすでにある体重の記録を、フォームへ反映する。
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
