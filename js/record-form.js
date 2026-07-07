// FITFLOW - 「記録する」タブ: 一括記録フォーム(有酸素+特別な飲食+筋トレ) + 体重クイックフォーム

function initFormControls() {
    if (DOM.addExerciseBtn) {
        DOM.addExerciseBtn.addEventListener('click', () => {
            addExerciseBlock();
        });
    }

    if (DOM.workoutForm) {
        DOM.workoutForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveWorkout();
        });
    }

    if (DOM.logCardioDist) {
        DOM.logCardioDist.addEventListener('input', updateCardioHint);
    }

    // 日付を選び直した時、その日にすでにある有酸素・特別な飲食の記録をフォームに反映する
    if (DOM.workoutDate) {
        DOM.workoutDate.addEventListener('change', () => {
            syncFormWithExistingDataForDate(DOM.workoutDate.value);
        });
    }

    if (DOM.weightQuickForm) {
        if (DOM.weightQuickDate) DOM.weightQuickDate.value = getLocalDateString();
        DOM.weightQuickForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveWeightOnly();
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

    // 今日の日付にすでにある有酸素・特別な飲食の記録があればフォームに反映し、
    // 無ければ空欄にする(既存記録の有無に関わらず一貫した状態にするため)
    syncFormWithExistingDataForDate(DOM.workoutDate ? DOM.workoutDate.value : '');

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    if (DOM.workoutTime) DOM.workoutTime.value = `${hours}:${minutes}`;

    if (DOM.exerciseList) DOM.exerciseList.innerHTML = '';
    if (DOM.saveWorkoutBtn) DOM.saveWorkoutBtn.innerHTML = '<i data-lucide="check"></i> 記録を保存する';

    const titleHeader = document.getElementById('logger-form-title');
    if (titleHeader) titleHeader.textContent = '今日の活動を一括記録';

    addExerciseBlock();

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

function addExerciseBlock(data = null) {
    if (!DOM.exerciseList) return;

    const exerciseIndex = DOM.exerciseList.children.length;
    const exerciseBlock = document.createElement('div');
    exerciseBlock.classList.add('exercise-item');
    exerciseBlock.setAttribute('data-index', exerciseIndex);

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
                <input type="text" class="exercise-name" placeholder="種目名（一覧にない場合は自由入力）" required list="popular-exercises" value="${data ? data.name : ''}">
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
    `;

    const tbody = exerciseBlock.querySelector('.sets-tbody');
    const addSetBtn = exerciseBlock.querySelector('.add-set-row-btn');
    const removeExBtn = exerciseBlock.querySelector('.btn-remove-exercise');
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

    removeExBtn.addEventListener('click', () => {
        exerciseBlock.style.animation = 'slideIn 0.2s ease reverse';
        setTimeout(() => {
            exerciseBlock.remove();
            Array.from(DOM.exerciseList.children).forEach((child, idx) => {
                child.setAttribute('data-index', idx);
            });
        }, 200);
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

// フォームで選択された日付にすでにある有酸素・特別な飲食の記録を、フォームへ反映する。
// (これをせずにフォームを空のまま送信すると、特別な飲食は「未チェック=削除」と
//  解釈されて、その日にすでに記録していた内容が消えてしまっていた。日付を選んだ・
//  変えた時点で必ず既存データを見せることで、入力内容と既存記録を食い違わせないようにする)
function syncFormWithExistingDataForDate(date) {
    if (!date) return;

    const existingCardio = state.cardioLogs.find(c => c.date === date);
    if (DOM.logCardioDist) {
        DOM.logCardioDist.value = existingCardio ? existingCardio.distance : '';
    }
    updateCardioHint();

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

function saveWorkout() {
    const date = DOM.workoutDate.value;
    const time = DOM.workoutTime.value;

    // 1. Read optional cardio running distance
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
            // (無条件pushだと、同日の走行距離を訂正のため再入力するたびに重複行が増え、
            //  「今日の総消費カロリー」が水増しされてしまう)
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

    // 2. Read gym workout if checked
    let workoutSaved = false;
    const recordGymWorkoutChk = document.getElementById('record-gym-workout-chk');
    if (recordGymWorkoutChk && recordGymWorkoutChk.checked) {
        // タイトル・部位カテゴリーの入力欄は撤去済み。
        // 編集時は既存の値をそのまま維持し、新規作成時のみ固定のデフォルト値を使う
        const existingWorkout = state.editingWorkoutId
            ? state.workouts.find(w => w.id === state.editingWorkoutId)
            : null;
        const title = existingWorkout ? existingWorkout.title : '';
        const category = existingWorkout ? existingWorkout.category : DEFAULT_WORKOUT_CATEGORY;
        const mood = DOM.workoutForm.querySelector('input[name="workout-mood"]:checked').value;
        const impression = DOM.workoutImpression.value.trim();

        const exerciseItems = DOM.exerciseList ? DOM.exerciseList.querySelectorAll('.exercise-item') : [];
        const exercises = [];
        let hasValidationError = false;

        exerciseItems.forEach(item => {
            const name = item.querySelector('.exercise-name').value.trim();
            if (!name) return; // Skip empty exercise names

            const setRows = item.querySelectorAll('.set-row');
            const sets = [];

            setRows.forEach(row => {
                const wVal = row.querySelector('.set-weight').value;
                const rVal = row.querySelector('.set-reps').value;
                const weight = parseFloat(wVal);
                const reps = parseInt(rVal);

                if (isNaN(weight) || isNaN(reps) || weight < 0 || reps < 0) {
                    hasValidationError = true;
                    return;
                }
                sets.push({ weight, reps });
            });

            if (sets.length === 0) {
                hasValidationError = true;
                return;
            }
            exercises.push({ name, sets });
        });

        if (hasValidationError) {
            showToast('筋トレ種目の入力内容を確認してください（すべてのセットに正しい値を入力）');
            return;
        }

        // 「筋トレも同時に記録する」はフォームリセット時にHTMLのdefaultで毎回チェックが
        // 復活する(form.reset()の仕様)。種目を何も入力していない新規記録の場合にまで
        // 空のワークアウト(「無題のワークアウト」・種目0件)を作ってしまうと、有酸素や
        // 食事だけを記録したいだけの日にも履歴が増えてしまうため、新規作成時は
        // 実際に種目が1件以上入力された時だけ保存する(編集時は既存の挙動を維持する)
        if (state.editingWorkoutId || exercises.length > 0) {
            const workoutData = {
                id: state.editingWorkoutId || 'workout-' + Date.now(),
                date,
                time,
                title: title || '無題のワークアウト',
                category,
                mood,
                impression,
                exercises
            };

            if (state.editingWorkoutId) {
                const idx = state.workouts.findIndex(w => w.id === state.editingWorkoutId);
                if (idx !== -1) {
                    state.workouts[idx] = workoutData;
                }
            } else {
                state.workouts.unshift(workoutData);
            }
            workoutSaved = true;
        }
    }

    // 3. Read optional special foods (+ 任意のkcal数値)
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
    } else {
        if (foodIndex !== -1) {
            state.foodLogs.splice(foodIndex, 1);
            foodSaved = true;
        }
    }

    // 4. Validate that at least one type of data is recorded
    if (!cardioSaved && !workoutSaved && !foodSaved) {
        showToast('有酸素、特別な飲食、または筋トレのいずれかを入力・選択してください');
        return;
    }

    // Save, Sync & Update Views
    saveDataAndSync();

    // Show success message based on what was saved
    const savedParts = [];
    if (cardioSaved) savedParts.push('有酸素');
    if (foodSaved && hasSpecialFood) savedParts.push('特別な飲食');
    if (workoutSaved) savedParts.push(state.editingWorkoutId ? '筋トレ更新' : '筋トレ');
    showToast(`${savedParts.join('・')}を記録しました！`);

    // Reset state & form
    state.editingWorkoutId = null;
    resetWorkoutForm();

    // Refresh views
    updateDashboard();
    updateHistoryList();
    updateCardioHistoryList();
    updateWeightHistoryList();
    updateFoodHistoryList();

    // Move to history tab
    const historyNavItem = document.querySelector('[data-tab="history"]');
    if (historyNavItem) {
        historyNavItem.click();
    }
}

// ==========================================
// WEIGHT & CARDIO QUICK LOGGING
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

// 体重だけを単独で記録する（メインの活動記録フォームとは独立）
function saveWeightOnly() {
    if (!DOM.weightQuickDate || !DOM.weightQuickVal) return;

    const date = DOM.weightQuickDate.value;
    const weightText = DOM.weightQuickVal.value.trim();
    if (!date) {
        showToast('日付を入力してください');
        return;
    }
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

    saveDataAndSync();
    showToast('体重を記録しました！');

    DOM.weightQuickVal.value = '';
    updateCardioHint();
    updateDashboard();
    updateWeightHistoryList();
}
