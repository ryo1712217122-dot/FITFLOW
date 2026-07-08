// FITFLOW - 「記録する」タブ:
//   フォームA(#workout-form)  : 有酸素 + 筋トレ（ジムに行った日に入力する部分）
//   フォームB(#weight-quick-form): 体重 + 特別な飲食（ジムに行かない日でも入力する部分）
//
// 筋トレの種目は「まとめて最後に一括保存」ではなく、1種目入力し終えるごとに
// その場で個別保存できる（ジムでのリアルタイム入力を想定）。編集中/記録中のワークアウトの
// idはstate.editingWorkoutIdが指す（履歴からの編集・新規リアルタイム記録の両方で共用）。

function initFormControls() {
    if (DOM.addExerciseBtn) {
        DOM.addExerciseBtn.addEventListener('click', () => {
            addExerciseBlock();
        });
    }

    if (DOM.workoutForm) {
        DOM.workoutForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveCardioAndFinishSession();
        });
    }

    if (DOM.logCardioDist) {
        DOM.logCardioDist.addEventListener('input', updateCardioHint);
    }

    // 日付を選び直した時、その日にすでにある有酸素の記録をフォームに反映する
    if (DOM.workoutDate) {
        DOM.workoutDate.addEventListener('change', () => {
            syncCardioFormWithExistingDataForDate(DOM.workoutDate.value);
        });
    }

    if (DOM.weightQuickForm) {
        if (DOM.weightQuickDate) {
            DOM.weightQuickDate.value = getLocalDateString();
            syncDailyLogFormWithExistingDataForDate(DOM.weightQuickDate.value);
        }
        DOM.weightQuickDate.addEventListener('change', () => {
            syncDailyLogFormWithExistingDataForDate(DOM.weightQuickDate.value);
        });
        DOM.weightQuickForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveDailyLog();
        });
    }

    const recordGymWorkoutChk = document.getElementById('record-gym-workout-chk');
    const gymWorkoutFieldsContainer = document.getElementById('gym-workout-fields-container');
    if (recordGymWorkoutChk && gymWorkoutFieldsContainer) {
        recordGymWorkoutChk.addEventListener('change', () => {
            gymWorkoutFieldsContainer.style.display = recordGymWorkoutChk.checked ? 'block' : 'none';
        });
    }

    // 特別な飲食チェックのON/OFFに合わせてkcal入力欄(と、その他項目のみ名前入力欄)を有効化・無効化する
    FOOD_ITEMS.forEach(item => {
        const chk = document.getElementById(item.chkId);
        const kcalInput = document.getElementById(item.kcalId);
        const nameInput = item.nameId ? document.getElementById(item.nameId) : null;
        if (chk && kcalInput) {
            chk.addEventListener('change', () => {
                kcalInput.disabled = !chk.checked;
                if (!chk.checked) kcalInput.value = '';
                if (nameInput) {
                    nameInput.disabled = !chk.checked;
                    if (!chk.checked) nameInput.value = '';
                }
            });
        }
    });
}

function resetWorkoutForm() {
    state.editingWorkoutId = null;
    if (DOM.workoutForm) DOM.workoutForm.reset();

    const now = new Date();
    if (DOM.workoutDate) DOM.workoutDate.value = getLocalDateString(now);

    // 今日の日付にすでにある有酸素の記録があればフォームに反映し、
    // 無ければ空欄にする(既存記録の有無に関わらず一貫した状態にするため)
    syncCardioFormWithExistingDataForDate(DOM.workoutDate ? DOM.workoutDate.value : '');

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    if (DOM.workoutTime) DOM.workoutTime.value = `${hours}:${minutes}`;

    if (DOM.exerciseList) DOM.exerciseList.innerHTML = '';
    if (DOM.saveWorkoutBtn) DOM.saveWorkoutBtn.innerHTML = '<i data-lucide="check"></i> 有酸素を保存して完了';

    const titleHeader = document.getElementById('logger-form-title');
    if (titleHeader) titleHeader.textContent = '有酸素・筋トレの記録';

    addExerciseBlock();
    updateWorkoutCalorieHint();

    const recordGymWorkoutChk = document.getElementById('record-gym-workout-chk');
    const gymWorkoutFieldsContainer = document.getElementById('gym-workout-fields-container');
    if (recordGymWorkoutChk && gymWorkoutFieldsContainer) {
        gymWorkoutFieldsContainer.style.display = recordGymWorkoutChk.checked ? 'block' : 'none';
    }
    updateCardioHint();

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

    exerciseBlock.innerHTML = `
        <div class="exercise-item-header">
            <div class="exercise-name-input-wrapper">
                <select class="exercise-name-picker">
                    <option value="">よく使う種目から選択...</option>
                    ${popularExerciseOptionsHtml}
                </select>
                <input type="text" class="exercise-name" placeholder="種目名（一覧にない場合は自由入力）" required list="popular-exercises" value="${data ? escapeHtml(data.name) : ''}">
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
            <input type="number" step="any" class="set-weight" placeholder="0" min="0" required value="${weight}">
        </td>
        <td class="set-multiply">×</td>
        <td>
            <input type="number" class="set-reps" placeholder="0" min="0" required value="${reps}">
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

    // セッション中に変わりうる項目(日付・時刻・調子・メモ)は保存の度に最新のフォーム値で更新する
    workout.date = DOM.workoutDate.value;
    workout.time = DOM.workoutTime.value;
    const moodInput = DOM.workoutForm ? DOM.workoutForm.querySelector('input[name="workout-mood"]:checked') : null;
    if (moodInput) workout.mood = moodInput.value;
    if (DOM.workoutImpression) workout.impression = DOM.workoutImpression.value.trim();

    const existingIndexAttr = exerciseBlockEl.getAttribute('data-existing-index');
    const isExisting = existingIndexAttr !== null && existingIndexAttr !== '';

    if (isExisting) {
        workout.exercises[parseInt(existingIndexAttr)] = data;
    } else {
        workout.exercises.push(data);
        exerciseBlockEl.setAttribute('data-existing-index', String(workout.exercises.length - 1));
    }

    workout.estimatedCalories = estimateWorkoutCalories(workout.exercises, WORKOUT_CALORIES_PER_SET);

    saveDataAndSync();
    showToast(`「${data.name}」を${isExisting ? '更新' : '保存'}しました`);

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

// フォームで選択された日付にすでにある有酸素の記録を、フォームへ反映する。
// (これをせずに空欄のまま日付だけ変えて誤送信すると、その日の有酸素記録を意図せず消してしまうため)
function syncCardioFormWithExistingDataForDate(date) {
    if (!date) return;

    const existingCardio = state.cardioLogs.find(c => c.date === date);
    if (DOM.logCardioDist) {
        DOM.logCardioDist.value = existingCardio ? existingCardio.distance : '';
    }
    updateCardioHint();
}

// 有酸素を保存し、開いているワークアウトセッション(種目は既に個別保存済み)を締めくくる。
// 筋トレ種目自体はこの関数では扱わない(各種目ブロックの「保存」ボタンで個別に保存済みのため)。
function saveCardioAndFinishSession() {
    const date = DOM.workoutDate.value;

    let cardioSaved = false;
    if (DOM.logCardioDist) {
        const cardioText = DOM.logCardioDist.value.trim();
        if (cardioText !== '') {
            const dist = parseFloat(cardioText);
            if (isNaN(dist) || dist <= 0) {
                showToast('有効な走行距離を入力してください');
                return;
            }
            const calories = Math.round(dist * getLatestWeight());

            // 体重ログと同様、同じ日付の既存エントリがあれば上書きする
            const existingCardioIndex = state.cardioLogs.findIndex(c => c.date === date);
            if (existingCardioIndex !== -1) {
                state.cardioLogs[existingCardioIndex] = { date, distance: dist, calories };
            } else {
                state.cardioLogs.push({ date, distance: dist, calories });
            }
            state.cardioLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
            cardioSaved = true;
        }
    }

    const hasOpenWorkoutSession = !!state.editingWorkoutId;

    if (!cardioSaved && !hasOpenWorkoutSession) {
        showToast('有酸素を入力するか、種目を保存してください');
        return;
    }

    saveDataAndSync();

    const savedParts = [];
    if (cardioSaved) savedParts.push('有酸素');
    if (hasOpenWorkoutSession) savedParts.push('筋トレ');
    showToast(`${savedParts.join('・')}を記録しました！`);

    state.editingWorkoutId = null;
    resetWorkoutForm();

    updateDashboard();
    updateHistoryList();
    updateCardioHistoryList();

    const historyNavItem = document.querySelector('[data-tab="history"]');
    if (historyNavItem) {
        historyNavItem.click();
    }
}

// ==========================================
// WEIGHT & FOOD (ジムに行かなくても入力する部分)
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

// フォームBで選択された日付にすでにある体重・特別な飲食の記録を、フォームへ反映する。
// (これをせずに空欄のまま送信すると、特別な飲食は「未チェック=削除」と解釈され、
//  その日にすでに記録していた内容が消えてしまうため)
function syncDailyLogFormWithExistingDataForDate(date) {
    if (!date) return;

    const existingWeight = state.weightLogs.find(w => w.date === date);
    if (DOM.weightQuickVal) {
        DOM.weightQuickVal.value = existingWeight ? existingWeight.weight : '';
    }

    const existingFood = state.foodLogs.find(f => f.date === date);
    FOOD_ITEMS.forEach(item => {
        const chk = document.getElementById(item.chkId);
        const kcalInput = document.getElementById(item.kcalId);
        const nameInput = item.nameId ? document.getElementById(item.nameId) : null;
        const checked = existingFood ? !!existingFood[item.key] : false;
        if (chk) chk.checked = checked;
        if (kcalInput) {
            kcalInput.disabled = !checked;
            kcalInput.value = (checked && existingFood && existingFood[item.calKey]) ? existingFood[item.calKey] : '';
        }
        if (nameInput) {
            nameInput.disabled = !checked;
            nameInput.value = (checked && existingFood && item.nameKey && existingFood[item.nameKey]) ? existingFood[item.nameKey] : '';
        }
    });
}

// 体重・特別な飲食をまとめて記録する（ジムに行かない日でも入力する部分）。
// 体重・食事はどちらも任意で、少なくとも一方が入力されていれば保存する。
function saveDailyLog() {
    if (!DOM.weightQuickDate) return;
    const date = DOM.weightQuickDate.value;
    if (!date) {
        showToast('日付を入力してください');
        return;
    }

    let weightSaved = false;
    const weightText = DOM.weightQuickVal ? DOM.weightQuickVal.value.trim() : '';
    if (weightText !== '') {
        const weight = parseFloat(weightText);
        if (isNaN(weight) || weight <= 0) {
            showToast('有効な体重を入力してください');
            return;
        }
        const existingIndex = state.weightLogs.findIndex(w => w.date === date);
        if (existingIndex !== -1) {
            state.weightLogs[existingIndex].weight = weight;
        } else {
            state.weightLogs.push({ date, weight });
        }
        state.weightLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
        weightSaved = true;
    }

    let foodSaved = false;
    const hasSpecialFood = FOOD_ITEMS.some(item => {
        const chk = document.getElementById(item.chkId);
        return chk && chk.checked;
    });

    const foodIndex = state.foodLogs.findIndex(f => f.date === date);
    if (hasSpecialFood) {
        const foodRecord = { date };
        FOOD_ITEMS.forEach(item => {
            const chk = document.getElementById(item.chkId);
            const kcalInput = document.getElementById(item.kcalId);
            const checked = !!(chk && chk.checked);
            foodRecord[item.key] = checked;
            let calories = null;
            if (checked && kcalInput) {
                const val = parseFloat(kcalInput.value);
                calories = (!isNaN(val) && val > 0) ? val : null;
            }
            foodRecord[item.calKey] = calories;
            if (item.nameKey) {
                const nameInput = item.nameId ? document.getElementById(item.nameId) : null;
                foodRecord[item.nameKey] = (checked && nameInput) ? nameInput.value.trim() : '';
            }
        });
        if (foodIndex !== -1) {
            state.foodLogs[foodIndex] = foodRecord;
        } else {
            state.foodLogs.push(foodRecord);
        }
        state.foodLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
        foodSaved = true;
    } else if (foodIndex !== -1) {
        state.foodLogs.splice(foodIndex, 1);
        foodSaved = true;
    }

    if (!weightSaved && !foodSaved) {
        showToast('体重または特別な飲食のいずれかを入力してください');
        return;
    }

    saveDataAndSync();

    const savedParts = [];
    if (weightSaved) savedParts.push('体重');
    if (foodSaved && hasSpecialFood) savedParts.push('特別な飲食');
    if (savedParts.length > 0) {
        showToast(`${savedParts.join('・')}を記録しました！`);
    } else {
        // 体重は未入力・特別な飲食はチェックを全て外して削除しただけのケース
        showToast('特別な飲食の記録を削除しました');
    }

    if (DOM.weightQuickVal) DOM.weightQuickVal.value = '';
    FOOD_ITEMS.forEach(item => {
        const chk = document.getElementById(item.chkId);
        const kcalInput = document.getElementById(item.kcalId);
        const nameInput = item.nameId ? document.getElementById(item.nameId) : null;
        if (chk) chk.checked = false;
        if (kcalInput) { kcalInput.disabled = true; kcalInput.value = ''; }
        if (nameInput) { nameInput.disabled = true; nameInput.value = ''; }
    });

    updateCardioHint(); // 体重が変わると有酸素の消費目安も変わるため
    updateDashboard();
    updateWeightHistoryList();
    updateFoodHistoryList();
}
