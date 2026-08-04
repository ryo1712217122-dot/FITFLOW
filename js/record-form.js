// FITFLOW - 「記録する」タブ: トレーニング・有酸素・体重・食事・飲み会・睡眠の6つの独立したフォーム。
//   パート1(#workout-form)     : トレーニング(筋トレ)
//   パート2(#cardio-form)      : 有酸素(走行距離)
//   パート3(#weight-quick-form): 体重
//   パート4(#meal-form)        : 食事(朝食/昼食/夕食/間食の摂取kcal目安)
//   パート5(#drinking-form)    : 飲み会(日付のみ。体重変化の文脈として体重グラフに重ねる)
//   パート6(#sleep-form)       : 睡眠(就寝・起床の時刻。日付は「起床日」)
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
            DOM.weightQuickDate.addEventListener('change', handleDailyLogDateChange);
        }
        DOM.weightQuickForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveDailyLog();
        });
    }

    // パート4: 食事
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

    // パート5: 飲み会
    if (DOM.drinkingForm) {
        if (DOM.drinkingDate) {
            DOM.drinkingDate.value = getFitnessDateString();
            syncDrinkingFormWithExistingDataForDate(DOM.drinkingDate.value);
            // 日付を変えると推定カロリーの入力もクリアされるが、飲み会フォームは
            // 目安を選び直すだけで復元できる軽い入力なので、確認なしで同期する
            DOM.drinkingDate.addEventListener('change', () => {
                syncDrinkingFormWithExistingDataForDate(DOM.drinkingDate.value);
            });
        }
        // 目安セレクトは数値欄へ値を書き込むだけの入力補助(食事フォームの目安selectと同じ考え方)。
        // 選んだあと数値欄で微調整できるよう、食事フォームのように入力欄を隠す切り替えはしない。
        if (DOM.drinkingCaloriesEstimate && DOM.drinkingCalories) {
            DOM.drinkingCaloriesEstimate.addEventListener('change', () => {
                if (DOM.drinkingCaloriesEstimate.value) {
                    DOM.drinkingCalories.value = DOM.drinkingCaloriesEstimate.value;
                }
            });
        }
        DOM.drinkingForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveDrinkingLog();
        });
    }

    // パート6: 睡眠
    if (DOM.sleepForm) {
        if (DOM.sleepDate) {
            // 睡眠は「起床日」に紐づけるので、27時ルールで求めた日付をそのまま使える
            // (深夜2時に記録しても、その時点で寝ているはずはなく、直したいのは前日の記録)
            DOM.sleepDate.value = getFitnessDateString();
            syncSleepFormWithExistingDataForDate(DOM.sleepDate.value);
            DOM.sleepDate.addEventListener('change', () => {
                syncSleepFormWithExistingDataForDate(DOM.sleepDate.value);
            });
        }
        // 時刻を触るたびに睡眠時間を出しておく(保存前に入力ミスへ気づけるように)
        [DOM.sleepBedTime, DOM.sleepWakeTime].forEach(el => {
            if (el) el.addEventListener('input', updateSleepDurationPreview);
        });
        DOM.sleepForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveSleepLog();
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
// state.*(workouts/weightLogs/cardioLogs/mealLogs)が外部要因でまとめて置き換わった直後に呼ぶ。
// 「記録する」タブのフォームを表示したまま(古い値のまま)にしておくと、次にどちらかの
// フォームを送信した時に、今取り込んだばかりのデータを古い値で上書きしてしまう
// (実際に発生した不具合)。フォームAは進行中のセッションが裏で入れ替わっている可能性が
// あるため安全にリセットし、他のフォームは選択中の日付で最新のstateに合わせ直す。
function refreshRecordFormsAfterExternalDataChange() {
    resetWorkoutForm();

    if (DOM.cardioDate && DOM.cardioDate.value) {
        syncCardioFormWithExistingDataForDate(DOM.cardioDate.value);
    }
    if (DOM.weightQuickDate && DOM.weightQuickDate.value) {
        syncDailyLogFormWithExistingDataForDate(DOM.weightQuickDate.value);
    }
    if (DOM.mealDate && DOM.mealDate.value) {
        syncMealFormWithExistingDataForDate(DOM.mealDate.value);
    }
    if (DOM.drinkingDate && DOM.drinkingDate.value) {
        syncDrinkingFormWithExistingDataForDate(DOM.drinkingDate.value);
    }
}

// ==========================================
// DRINKING (飲み会: 日付のみの記録)
// ==========================================

// 飲み会フォームの推定摂取カロリー欄を読み取る。
// 「空欄(=食事記録を作らない)」と「不正な入力」を呼び出し側が区別できるよう、
// { ok, value } で返す。不正値を黙ってnull扱いにすると、ユーザーは入力したつもりなのに
// 食事記録が作られず、原因も分からないままになるため。
function readDrinkingCalories() {
    if (!DOM.drinkingCalories) return { ok: true, value: null };
    const text = DOM.drinkingCalories.value.trim();
    if (text === '') return { ok: true, value: null };
    const v = parseFloat(text);
    if (isNaN(v) || v < 0) return { ok: false, value: null };
    return { ok: true, value: Math.round(v) };
}

// 選択中の日付がすでに飲み会として記録済みかに応じて、ヒントと送信ボタンの文言を切り替える。
// 送信は「未記録なら記録、記録済みなら取り消し」のトグル動作(入力欄が日付しかないため、
// 体重フォームのような上書き保存の概念がなく、削除だけ別UIにするより一箇所で完結させる)。
//
// 推定カロリー欄は「記録する時にだけ使う」ため、記録済みの日では隠す
// (ボタンが「取り消す」になっている状態で入力欄が残っていると、その値がどう扱われるのか
//  分からなくなるため)。記録後にカロリーだけ直したい場合は食事フォーム・食事履歴で編集する。
function syncDrinkingFormWithExistingDataForDate(date) {
    const exists = !!date && state.drinkingLogs.some(d => d.date === date);

    if (DOM.drinkingExistingHint && DOM.drinkingExistingHintText) {
        if (exists) {
            DOM.drinkingExistingHintText.textContent = 'この日はすでに飲み会として記録済みです（ボタンで記録を取り消せます）';
            DOM.drinkingExistingHint.classList.remove('is-hidden');
        } else {
            DOM.drinkingExistingHint.classList.add('is-hidden');
        }
    }

    // 日付を変えたら前の日付向けの入力を持ち越さない
    if (DOM.drinkingCalories) DOM.drinkingCalories.value = '';
    if (DOM.drinkingCaloriesEstimate) DOM.drinkingCaloriesEstimate.value = '';
    if (DOM.drinkingCalorieGroup) DOM.drinkingCalorieGroup.classList.toggle('is-hidden', exists);

    // その日にすでに食事記録があるなら、上書き対象がある旨を明示する
    if (DOM.drinkingMealHint && DOM.drinkingMealHintText) {
        const existingMeal = date ? state.mealLogs.find(m => m.date === date) : null;
        if (existingMeal && !exists) {
            DOM.drinkingMealHintText.textContent =
                `この日はすでに食事の記録（合計 ${sumMealCalories(existingMeal)} kcal、うち夕食 ${Number(existingMeal.dinner) || 0} kcal）があります。入力すると夕食が上書きされます（朝食・昼食・間食はそのまま）。`;
            DOM.drinkingMealHint.classList.remove('is-hidden');
        } else {
            DOM.drinkingMealHint.classList.add('is-hidden');
        }
    }

    if (DOM.drinkingSubmitBtn) {
        DOM.drinkingSubmitBtn.innerHTML = exists
            ? '<i data-lucide="x"></i> この日の飲み会記録を取り消す'
            : '<i data-lucide="check"></i> 飲み会を記録';
        if (window.lucide) lucide.createIcons();
    }
}

function saveDrinkingLog() {
    if (!DOM.drinkingDate) return;
    const date = DOM.drinkingDate.value;
    if (!date) {
        showToast('日付を入力してください');
        return;
    }

    const existingIndex = state.drinkingLogs.findIndex(d => d.date === date);
    let mealChanged = false;

    // 記録する時だけカロリーを検証する(取り消し時は入力欄自体を隠しているため対象外)。
    // 何も書き換える前に弾くことで、失敗時に中途半端な状態が残らないようにする。
    const calories = existingIndex === -1 ? readDrinkingCalories() : { ok: true, value: null };
    if (!calories.ok) {
        showToast('推定摂取カロリーは0以上の数値で入力してください（空欄なら食事記録は作りません）');
        return;
    }

    if (existingIndex !== -1) {
        // 取り消し時は食事記録に手を付けない。ここで消すと、あとから食事フォームや
        // 食事履歴で調整した値まで巻き添えで失われるため(このアプリはデータ消失に
        // 繰り返し悩まされてきたので、迷ったら残す側に倒す)。
        state.drinkingLogs.splice(existingIndex, 1);
        const stillHasMeal = state.mealLogs.some(m => m.date === date);
        showToast(stillHasMeal
            ? '飲み会の記録を取り消しました（その日の食事記録は残しています）'
            : '飲み会の記録を取り消しました');
    } else {
        state.drinkingLogs.push({ date });
        state.drinkingLogs.sort((a, b) => new Date(a.date) - new Date(b.date));

        // 推定カロリーが入っていれば、その日の食事記録の「夕食」として保存する。
        // 実測TDEE(computeMeasuredTdee)はmealLogsしか見ないため、ここに入れて初めて
        // 「飲み会の日だけ摂取が抜ける」偏りが解消される。
        const kcal = calories.value;
        if (kcal !== null) {
            const idx = state.mealLogs.findIndex(m => m.date === date);
            const record = buildMealLogWithField(idx !== -1 ? state.mealLogs[idx] : null, date, 'dinner', kcal);
            if (idx !== -1) {
                state.mealLogs[idx] = record;
            } else {
                state.mealLogs.push(record);
                state.mealLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
            }
            mealChanged = true;
            showToast(`🍻 飲み会を記録しました！摂取 ${kcal} kcal を夕食として保存しました`);
        } else {
            showToast('🍻 飲み会を記録しました！翌日の体重変化に注目です');
        }
    }

    saveDataAndSync();
    syncDrinkingFormWithExistingDataForDate(date);
    updateDashboard();
    updateWeightHistoryList();
    if (mealChanged) {
        // 食事フォームが同じ日付を開いていれば、今書き込んだ値に合わせ直す
        // (古い表示のまま送信すると、いま保存した夕食を上書きしてしまうため)
        if (DOM.mealDate && DOM.mealDate.value === date) {
            syncMealFormWithExistingDataForDate(date);
        }
        updateMealHistoryList();
        updateCalorieBalanceHistoryList();
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
        (current.snacks === null || current.snacks === 0);

    if (!matchesSaved && !confirm('入力中の食事の記録が保存されていません。日付を変更すると入力内容が失われます。続けますか？')) {
        if (lastSyncedMealDate) DOM.mealDate.value = lastSyncedMealDate;
        return;
    }
    syncMealFormWithExistingDataForDate(newDate);
}

// パート4: 食事を単独で保存する。朝食/昼食/夕食は「入力した項目だけ上書き、空欄は
// 既存値のまま維持」、間食は「時間帯ごとに複数回記録することが多いため、既存の間食合計に
// 今回の入力分を加算」する(「ある時間帯にひとつ登録して、次に登録する時には現在の登録に
// 足し算される」仕様)。全欄が空欄の場合のみ「入力してください」で弾く。
function saveMealLog() {
    if (!DOM.mealDate) return;
    const date = DOM.mealDate.value;
    if (!date) {
        showToast('日付を入力してください');
        return;
    }

    const values = readMealFormValues();
    const hasAnyInput = values.breakfast !== null || values.lunch !== null || values.dinner !== null || values.snacks !== null;
    if (!hasAnyInput) {
        showToast('少なくとも1つの項目を入力してください');
        return;
    }

    const existingIndex = state.mealLogs.findIndex(m => m.date === date);
    const mealUpdated = existingIndex !== -1;
    const existingMeal = mealUpdated ? state.mealLogs[existingIndex] : null;
    const projected = computeProjectedMealValues(values, existingMeal);
    const record = { date, breakfast: projected.breakfast, lunch: projected.lunch, dinner: projected.dinner, snacks: projected.snacks };
    if (mealUpdated) {
        state.mealLogs[existingIndex] = record;
    } else {
        state.mealLogs.push(record);
    }
    state.mealLogs.sort((a, b) => new Date(a.date) - new Date(b.date));

    saveDataAndSync();

    const snackSuffix = projected.snacksIncrement > 0 ? `（間食 +${projected.snacksIncrement}kcal）` : '';
    showToast(`${mealUpdated ? '食事(更新)' : '食事'}を記録しました！${snackSuffix}`);

    // 保存直後のフォームには「たった今保存した内容」が表示され続けるようにする
    syncMealFormWithExistingDataForDate(date);

    updateDashboard();
    updateMealHistoryList();
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

// ==========================================
// 睡眠の記録
// ==========================================

// 入力中の就寝・起床から睡眠時間をその場に表示する。
// 保存してから「6時間のつもりが18時間になっていた」と気づくのを防ぐための即時フィードバック。
function updateSleepDurationPreview() {
    if (!DOM.sleepDurationPreview) return;
    const hours = computeSleepDuration(
        DOM.sleepBedTime ? DOM.sleepBedTime.value : '',
        DOM.sleepWakeTime ? DOM.sleepWakeTime.value : ''
    );
    if (hours === null) {
        DOM.sleepDurationPreview.textContent = '';
        DOM.sleepDurationPreview.classList.remove('is-short');
        return;
    }
    const target = getSleepTargetHours();
    DOM.sleepDurationPreview.textContent = `→ ${formatSleepHours(hours)}${hours < target ? `（目標${target}時間に${formatSleepHours(target - hours)}届きません）` : ''}`;
    DOM.sleepDurationPreview.classList.toggle('is-short', hours < target);
}

// 睡眠時間(小数)を「6時間45分」の形にする。6.75という小数表記より寝起きに読みやすい。
function formatSleepHours(hours) {
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0) return `${m}分`;
    return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}

// 目標睡眠時間。planSettings.sleepTarget は防衛ラインUIの廃止後もキーだけ残っていた項目で、
// 睡眠の記録を入れたことで再び意味を持つようになった。
function getSleepTargetHours() {
    const s = state.planSettings || DEFAULT_PLAN_SETTINGS;
    const v = parseFloat(s.sleepTarget);
    return v > 0 ? v : DEFAULT_PLAN_SETTINGS.sleepTarget;
}

// 指定日にすでに睡眠の記録があれば、その値をフォームへ復元して注意書きを出す。
// 他のフォームと同じく、既存日付への上書きを事故ではなく意図的な操作にするため。
function syncSleepFormWithExistingDataForDate(date) {
    const existing = state.sleepLogs.find(s => s.date === date);
    if (DOM.sleepExistingHint && DOM.sleepExistingHintText) {
        if (existing) {
            const hours = computeSleepDuration(existing.bedTime, existing.wakeTime);
            DOM.sleepExistingHintText.textContent =
                `この日はすでに記録があります（${existing.bedTime}〜${existing.wakeTime}／${formatSleepHours(hours)}）。保存すると上書きされます。`;
            DOM.sleepExistingHint.classList.remove('is-hidden');
        } else {
            DOM.sleepExistingHint.classList.add('is-hidden');
        }
    }
    if (DOM.sleepBedTime) DOM.sleepBedTime.value = existing ? existing.bedTime : '';
    if (DOM.sleepWakeTime) DOM.sleepWakeTime.value = existing ? existing.wakeTime : '';
    updateSleepDurationPreview();
}

function saveSleepLog() {
    if (!DOM.sleepDate) return;
    const date = DOM.sleepDate.value;
    if (!date) {
        showToast('日付を入力してください');
        return;
    }

    const bedTime = DOM.sleepBedTime ? DOM.sleepBedTime.value : '';
    const wakeTime = DOM.sleepWakeTime ? DOM.sleepWakeTime.value : '';
    const hours = computeSleepDuration(bedTime, wakeTime);
    // 何も書き換える前に検証する(失敗時に中途半端な状態を残さない)
    if (hours === null) {
        showToast(bedTime && wakeTime && bedTime === wakeTime
            ? '就寝と起床が同じ時刻になっています'
            : '就寝時刻と起床時刻を入力してください');
        return;
    }
    // 就寝から起床までが極端に長い場合は、時刻の取り違え(AM/PM)を疑う。
    // 弾かずに警告だけにすると気づかず保存されるので、ここでは保存を止める
    if (hours > 16) {
        showToast(`睡眠時間が${formatSleepHours(hours)}になっています。就寝と起床が逆になっていませんか？`);
        return;
    }

    const existingIndex = state.sleepLogs.findIndex(s => s.date === date);
    const updated = existingIndex !== -1;
    const record = { date, bedTime, wakeTime };
    if (updated) {
        state.sleepLogs[existingIndex] = record;
    } else {
        state.sleepLogs.push(record);
        state.sleepLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    saveDataAndSync();
    syncSleepFormWithExistingDataForDate(date);
    updateDashboard();
    updateSleepHistoryList();

    const target = getSleepTargetHours();
    showToast(`😴 ${updated ? '睡眠を更新しました' : '睡眠を記録しました'}：${formatSleepHours(hours)}`
        + (hours < target ? `（目標${target}時間に届いていません）` : ''));
}
