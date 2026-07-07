// FITFLOW - 履歴リストタブ: 筋トレ履歴（検索/フィルタ・カード表示・編集/削除・重量推移グラフ）

function updateHistoryList() {
    if (!DOM.historyContainer || !DOM.historyCount) return;
    const searchQuery = DOM.searchInput.value.toLowerCase().trim();
    const moodFilter = DOM.filterMood.value;

    const filtered = state.workouts.filter(w => {
        const matchesSearch = searchQuery === '' ||
            (w.impression && w.impression.toLowerCase().includes(searchQuery)) ||
            (w.date && w.date.includes(searchQuery)) ||
            (w.exercises && w.exercises.some(ex => ex.name && ex.name.toLowerCase().includes(searchQuery)));

        const matchesMood = moodFilter === 'all' || w.mood === moodFilter;

        return matchesSearch && matchesMood;
    });

    DOM.historyCount.textContent = filtered.length;
    DOM.historyContainer.innerHTML = '';

    if (filtered.length === 0) {
        DOM.historyContainer.innerHTML = `
            <div class="card empty-state">
                <i data-lucide="search-code"></i>
                <p>該当するワークアウト履歴が見つかりません。</p>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    // Sort chronologically descending
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    filtered.forEach(w => {
        const card = createHistoryCard(w);
        DOM.historyContainer.appendChild(card);
    });

    updateProgressionSelect();
    if (window.lucide) {
        lucide.createIcons();
    }
}

function createHistoryCard(workout) {
    const card = document.createElement('div');
    card.classList.add('card', 'workout-history-card');

    const categoryClassMap = {
        '胸 (Chest)': 'chest',
        '背中 (Back)': 'back',
        '肩 (Shoulders)': 'shoulders',
        '腕 (Arms)': 'arms',
        '脚 (Legs)': 'legs',
        '腹筋 (Core)': 'core',
        '有酸素 (Cardio)': 'cardio',
        'その他 (Other)': 'other'
    };
    const cClass = categoryClassMap[workout.category] || 'other';
    card.classList.add(cClass);

    const moodEmojiMap = {
        'fire': '🔥',
        'strong': '💪',
        'good': '😊',
        'tired': '🥱',
        'exhausted': '☠️'
    };
    const emoji = moodEmojiMap[workout.mood] || '😊';

    let exercisesHtml = '';
    if (workout.exercises) {
        workout.exercises.forEach(ex => {
            let setsListHtml = '';
            ex.sets.forEach((s, idx) => {
                const est1RM = s.reps > 1 ? Math.round(s.weight * (1 + s.reps / 30)) : s.weight;
                setsListHtml += `
                    <div class="history-set-item">
                        <span>Set ${idx + 1}</span>
                        <span class="history-set-detail">${s.weight} kg × ${s.reps} 回 <span class="text-muted">(1RM ~${est1RM}kg)</span></span>
                    </div>
                `;
            });

            exercisesHtml += `
                <div class="history-exercise-box">
                    <div class="history-exercise-name">${escapeHtml(ex.name)}</div>
                    <div class="history-sets-list">${setsListHtml}</div>
                </div>
            `;
        });
    }

    const formattedDate = formatDateJp(workout.date);

    card.innerHTML = `
        <div class="history-card-header">
            <div class="history-title-area">
                <div class="history-title-row">
                    <span class="history-mood-badge" title="調子: ${workout.mood}">${emoji}</span>
                </div>
                <div class="history-date-row">
                    <i data-lucide="calendar"></i>
                    <span>${formattedDate} ${workout.time ? `&nbsp; ${workout.time}` : ''}</span>
                </div>
            </div>
            <div class="history-actions">
                <button class="btn-icon text-primary btn-edit-history" title="編集する">
                    <i data-lucide="edit-3"></i>
                </button>
                <button class="btn-icon text-danger btn-delete-history" title="削除する">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        </div>

        ${workout.impression ? `<div class="history-impression">${escapeHtml(workout.impression).replace(/\n/g, '<br>')}</div>` : ''}

        <div class="history-exercises-container">
            <div class="history-exercises-title">
                <i data-lucide="activity"></i>
                <span>実施内容</span>
            </div>
            <div class="history-exercises-grid">
                ${exercisesHtml}
            </div>
        </div>
    `;

    card.querySelector('.btn-edit-history').addEventListener('click', () => {
        editWorkout(workout.id);
    });

    card.querySelector('.btn-delete-history').addEventListener('click', () => {
        showConfirmModal('記録の削除', `「${formattedDate}」の記録を削除しますか？`, () => {
            deleteWorkout(workout.id);
        });
    });

    return card;
}

function editWorkout(id) {
    const workout = state.workouts.find(w => w.id === id);
    if (!workout) return;

    state.editingWorkoutId = id;

    const formNavItem = document.querySelector('[data-tab="quick-log"]');
    if (formNavItem) formNavItem.click();

    const titleHeader = document.getElementById('logger-form-title');
    if (titleHeader) titleHeader.textContent = 'ワークアウト記録の編集';

    const recordGymWorkoutChk = document.getElementById('record-gym-workout-chk');
    const gymWorkoutFieldsContainer = document.getElementById('gym-workout-fields-container');
    if (recordGymWorkoutChk) recordGymWorkoutChk.checked = true;
    if (gymWorkoutFieldsContainer) gymWorkoutFieldsContainer.style.display = 'block';
    if (DOM.saveWorkoutBtn) {
        DOM.saveWorkoutBtn.innerHTML = '<i data-lucide="save"></i> 編集を保存する';
    }

    if (DOM.workoutDate) DOM.workoutDate.value = workout.date;
    if (DOM.workoutTime) DOM.workoutTime.value = workout.time || '12:00';

    // このワークアウトの日付にすでにある有酸素・特別な飲食の記録をフォームに反映する
    // (以前は無関係だと決めつけて有酸素欄を空にしていたが、それだと本当にその日に
    //  記録済みの有酸素があっても見えず、気づかないまま再送信して食い違いが起きていた)
    syncFormWithExistingDataForDate(workout.date);

    if (DOM.workoutImpression) DOM.workoutImpression.value = workout.impression || '';

    const moodRadio = DOM.workoutForm ? DOM.workoutForm.querySelector(`input[name="workout-mood"][value="${workout.mood}"]`) : null;
    if (moodRadio) moodRadio.checked = true;

    if (DOM.exerciseList) {
        DOM.exerciseList.innerHTML = '';

        if (workout.exercises) {
            workout.exercises.forEach(ex => {
                addExerciseBlock(ex);
            });
        }
    }

    if (window.lucide) {
        lucide.createIcons();
    }
}

function deleteWorkout(id) {
    const idx = state.workouts.findIndex(w => w.id === id);
    if (idx !== -1) {
        state.workouts.splice(idx, 1);
        saveDataAndSync();
        showToast('ワークアウト記録を削除しました');
        updateDashboard(); // Sync total workouts and calendar count
        updateHistoryList();
    }
}

function updateProgressionSelect() {
    if (!DOM.progressionSelect) return;
    const exerciseNamesSet = new Set();
    state.workouts.forEach(w => {
        if (w.exercises) {
            w.exercises.forEach(ex => {
                if (ex.name && ex.name.trim() !== '') {
                    exerciseNamesSet.add(ex.name.trim());
                }
            });
        }
    });

    const exerciseNames = [...exerciseNamesSet].sort();

    const oldVal = DOM.progressionSelect.value;
    DOM.progressionSelect.innerHTML = '';

    if (exerciseNames.length === 0) {
        DOM.progressionSelect.innerHTML = '<option value="">データなし</option>';
        renderProgressionChart();
        return;
    }

    exerciseNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        DOM.progressionSelect.appendChild(option);
    });

    if (exerciseNames.includes(oldVal)) {
        DOM.progressionSelect.value = oldVal;
    } else {
        DOM.progressionSelect.value = exerciseNames[0];
    }

    renderProgressionChart();
}

function renderProgressionChart() {
    const theme = getChartThemeColors();
    if (!DOM.progressionSelect || !DOM.noProgressionData) return;
    const exerciseName = DOM.progressionSelect.value;

    if (!exerciseName) {
        DOM.noProgressionData.style.display = 'block';
        DOM.noProgressionData.textContent = 'データがありません。';
        if (state.charts.progression) {
            try { state.charts.progression.destroy(); } catch(e){}
            state.charts.progression = null;
        }
        return;
    }

    const points = [];
    state.workouts.forEach(w => {
        if (!w.exercises) return;
        const matchedEx = w.exercises.find(ex => ex.name && ex.name.trim() === exerciseName);
        if (matchedEx) {
            let maxWeight = 0;
            let maxEst1RM = 0;

            matchedEx.sets.forEach(s => {
                const weight = parseFloat(s.weight) || 0;
                const reps = parseInt(s.reps) || 0;
                const est1RM = reps > 1 ? weight * (1 + reps / 30) : weight;

                if (weight > maxWeight) maxWeight = weight;
                if (est1RM > maxEst1RM) maxEst1RM = est1RM;
            });

            points.push({
                date: w.date,
                maxWeight: maxWeight,
                est1RM: Math.round(maxEst1RM * 10) / 10
            });
        }
    });

    points.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (points.length < 2) {
        DOM.noProgressionData.style.display = 'block';
        DOM.noProgressionData.textContent = `重量推移を表示するには、「${exerciseName}」を2回以上記録してください（現在: ${points.length}回）`;
        if (state.charts.progression) {
            try { state.charts.progression.destroy(); } catch(e){}
            state.charts.progression = null;
        }
        return;
    }

    DOM.noProgressionData.style.display = 'none';

    const canvas = document.getElementById('progressionChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (state.charts.progression) {
        try { state.charts.progression.destroy(); } catch(e){}
    }

    const dates = points.map(p => formatDateJp(p.date));
    const maxWeights = points.map(p => p.maxWeight);
    const est1RMs = points.map(p => p.est1RM);

    const colorPrimary = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#86ac41';
    const colorSecondary = getComputedStyle(document.documentElement).getPropertyValue('--color-secondary').trim() || '#7da3a1';

    state.charts.progression = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                {
                    label: '推定 1RM (MAX)',
                    data: est1RMs,
                    borderColor: colorPrimary,
                    backgroundColor: hexToRgba(colorPrimary, 0.1),
                    borderWidth: 2.5,
                    tension: 0.25,
                    fill: true,
                    pointBackgroundColor: colorPrimary,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: '最大重量',
                    data: maxWeights,
                    borderColor: colorSecondary,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [3, 3],
                    tension: 0.25,
                    fill: false,
                    pointBackgroundColor: colorSecondary,
                    pointRadius: 3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
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
