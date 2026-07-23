// FITFLOW - Pure data utilities
//
// DOM/localStorageに依存しない純粋関数だけを集めたファイル。
// ブラウザではクラシックスクリプトとして読み込まれ、他のapp.js内の関数と同じ
// グローバルスコープに定義される（index.htmlでapp.jsより先に読み込むこと）。
// Node (`node --test`) からは module.exports 経由でそのままrequireしてテストできる。

// スプレッドシート等からのISO日時/日付文字列をアプリ内で使う "YYYY-MM-DD" に正規化する。
// タイムゾーンはこの関数を実行する環境のローカルタイムゾーンを使う。
function normalizeDate(dateStr) {
    if (!dateStr) return '';
    const str = String(dateStr);
    if (str.includes('T') || str.includes('/') || str.includes('-')) {
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        }
        console.warn('normalizeDate: 日付の解析に失敗しました。元の文字列をそのまま使用します:', dateStr);
    }
    return str;
}

// スプレッドシート等からのISO日時文字列を "HH:MM" に正規化する。
function normalizeTime(timeStr) {
    if (!timeStr) return '';
    const str = String(timeStr);
    if (str.includes('T')) {
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            const h = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            return `${h}:${min}`;
        }
    }
    return str;
}

// 数値型、または「文字列全体が数値として解釈できる」値のみtrueを返す。
// parseFloat/parseIntは "60<img onerror=...>" のような部分数値文字列も通してしまい、
// その値がinnerHTMLへ描画されると格納型XSSになるため、Number()で全体判定する。
function isStrictNumeric(v) {
    if (typeof v === 'number') return isFinite(v);
    if (typeof v === 'string' && v.trim() !== '') return isFinite(Number(v));
    return false;
}

// ワークアウト配列の形が期待通りか検証する。1件でも不正なら全体を取り込み拒否するゲート
// (ワークアウトは筋トレの構造そのものなので、部分的な取り込みが難しいため全体拒否にしている)
function validateWorkoutsSchema(data) {
    if (!Array.isArray(data)) return false;
    for (const w of data) {
        if (!w || typeof w !== 'object') return false;
        if (typeof w.id !== 'string' || !w.id) return false;
        if (typeof w.date !== 'string' || !w.date) return false;
        if (typeof w.title !== 'string') return false;
        if (typeof w.category !== 'string') return false;
        if (typeof w.mood !== 'string') return false;
        if (typeof w.impression !== 'string') return false;
        // timeは旧データに存在しないことがあるため欠損は許容し、あるなら文字列に限る
        if (w.time !== undefined && w.time !== null && typeof w.time !== 'string') return false;
        if (!Array.isArray(w.exercises)) return false;

        for (const ex of w.exercises) {
            if (!ex || typeof ex !== 'object') return false;
            if (typeof ex.name !== 'string' || !ex.name) return false;
            if (!Array.isArray(ex.sets)) return false;
            for (const s of ex.sets) {
                if (!s || typeof s !== 'object') return false;
                if (!isStrictNumeric(s.weight) || !isStrictNumeric(s.reps)) return false;
            }
        }
    }
    return true;
}

// workoutsと違い、体重・有酸素ログは1件の不正な行のために全体を取り込み拒否にはせず、
// その行だけ除外してコンソールに警告を出す（インポート全体を失いたくないため）
function filterValidWeightLogs(data) {
    if (!Array.isArray(data)) return [];
    return data.filter(w => {
        const ok = !!w && typeof w.date === 'string' && !!w.date &&
            typeof w.weight === 'number' && !isNaN(w.weight) && w.weight > 0;
        if (!ok) console.warn('☁️ 不正な体重ログをスキップしました:', w);
        return ok;
    });
}

function filterValidCardioLogs(data) {
    if (!Array.isArray(data)) return [];
    return data.filter(c => {
        const ok = !!c && typeof c.date === 'string' && !!c.date &&
            typeof c.distance === 'number' && !isNaN(c.distance) && c.distance > 0 &&
            typeof c.calories === 'number' && !isNaN(c.calories) && c.calories >= 0;
        if (!ok) console.warn('☁️ 不正な有酸素ログをスキップしました:', c);
        return ok;
    });
}

// 食事ログ(1件=1日、朝食/昼食/夕食/間食のkcal内訳)のうち不正な行だけを除外する。
// 4項目とも0以上の数値であることを要求する(未入力はフォーム側で0として保存する前提)。
function filterValidMealLogs(data) {
    if (!Array.isArray(data)) return [];
    return data.filter(m => {
        const ok = !!m && typeof m.date === 'string' && !!m.date &&
            isStrictNumeric(m.breakfast) && Number(m.breakfast) >= 0 &&
            isStrictNumeric(m.lunch) && Number(m.lunch) >= 0 &&
            isStrictNumeric(m.dinner) && Number(m.dinner) >= 0 &&
            isStrictNumeric(m.snacks) && Number(m.snacks) >= 0;
        if (!ok) console.warn('☁️ 不正な食事ログをスキップしました:', m);
        return ok;
    });
}

// 1日分の食事ログ(朝食/昼食/夕食/間食)の合計摂取kcalを返す。エントリが無ければ0。
function sumMealCalories(mealLog) {
    if (!mealLog) return 0;
    const fields = ['breakfast', 'lunch', 'dinner', 'snacks'];
    return fields.reduce((sum, key) => sum + (Number(mealLog[key]) || 0), 0);
}

// その日の摂取(intake)と消費(expenditure)から収支を求める。
// diff = expenditure - intake なので、正=カロリー不足(減量方向)、負=カロリー超過(増量方向)。
function computeCalorieDiff(intake, expenditure) {
    const i = Number(intake) || 0;
    const e = Number(expenditure) || 0;
    return Math.round(e - i);
}

// 日付を持つオブジェクトの配列を「新しい順」のコピーとして返す（元の配列は書き換えない）。
// 履歴一覧の表示用ソートは必ずこれを経由すること。state.weightLogs/state.cardioLogsを
// 直接sort()すると、他の箇所が前提とする「昇順・末尾=最新」が壊れる（実際に一度壊れたバグ）。
function sortedByDateDesc(entries) {
    if (!Array.isArray(entries)) return [];
    return entries.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
}

// 体重ログ配列(昇順ソート済み前提)から最新の体重を取り出す純粋関数版。
// 配列が空ならdefaultWeightを返す。
function getLatestWeightFromLogs(weightLogs, defaultWeight) {
    if (weightLogs && weightLogs.length > 0) {
        return weightLogs[weightLogs.length - 1].weight;
    }
    return defaultWeight;
}

// 筋トレセッションの推定消費カロリーを算出する。種目・重量ごとの厳密な計算はせず、
// 「合計セット数 × 1セットあたりの目安kcal」という単純化モデルを使う
// (有酸素のカロリー概算が「距離×体重」という単純な式であるのと同じ考え方に揃えている)。
// caloriesPerSetは呼び出し側(config.js)から渡す。Node環境ではconfig.jsを読み込まないため、
// このファイル自体はグローバル定数に依存しない純粋関数のまま保つ。
function estimateWorkoutCalories(exercises, caloriesPerSet) {
    if (!Array.isArray(exercises)) return 0;
    const totalSets = exercises.reduce((sum, ex) => {
        return sum + (ex && Array.isArray(ex.sets) ? ex.sets.length : 0);
    }, 0);
    return Math.round(totalSets * (caloriesPerSet || 0));
}

// 指定日(YYYY-MM-DD)を含む週の開始日(日曜)を"YYYY-MM-DD"で返す。
// カレンダー表示(日,月,火,水,木,金,土)の並びに合わせて日曜始まりにしている。
function getWeekStartDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() - d.getDay());
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// cardioLogsのうち、weekStartDate(YYYY-MM-DD、日曜)から7日間に含まれる走行距離の合計を返す。
// 週間ランニング目標の達成度表示に使う。
function sumCardioDistanceForWeek(cardioLogs, weekStartDate) {
    if (!Array.isArray(cardioLogs) || !weekStartDate) return 0;
    const start = new Date(weekStartDate + 'T00:00:00');
    if (isNaN(start.getTime())) return 0;
    const end = new Date(start);
    end.setDate(end.getDate() + 7); // 上限は含まない(排他的)

    return cardioLogs.reduce((sum, c) => {
        if (!c || !c.date) return sum;
        const d = new Date(c.date + 'T00:00:00');
        if (isNaN(d.getTime()) || d < start || d >= end) return sum;
        return sum + (typeof c.distance === 'number' ? c.distance : 0);
    }, 0);
}

// 日付昇順の体重ログから、各時点までの直近windowSize件の移動平均を算出する。
// 日々の変動ノイズに埋もれがちな体重推移のトレンドを見やすくするために使う。
// 先頭付近(まだwindowSize件溜まっていない)は、その時点までの件数で平均する。
function computeMovingAverage(weightLogs, windowSize) {
    if (!Array.isArray(weightLogs)) return [];
    return weightLogs.map((entry, idx) => {
        const start = Math.max(0, idx - windowSize + 1);
        const windowSlice = weightLogs.slice(start, idx + 1);
        const avg = windowSlice.reduce((sum, e) => sum + e.weight, 0) / windowSlice.length;
        return { date: entry.date, average: Math.round(avg * 10) / 10 };
    });
}

// 日付昇順の体重ログから「直近days日間での体重変化量」を返す(最新 - 約days日前の値)。
// ちょうどdays日前のログが無い場合は、最新以外のログの中で最も日付がdays日前に近いものを使う
// (前後どちらの方向でも、目標日に一番近いログを選ぶ)。
// 比較対象が無い(ログが1件以下)場合はnullを返す。
function computeWeightChangeOverDays(weightLogs, days) {
    if (!Array.isArray(weightLogs) || weightLogs.length < 2) return null;

    const latest = weightLogs[weightLogs.length - 1];
    const latestDate = new Date(latest.date + 'T00:00:00');
    if (isNaN(latestDate.getTime())) return null;
    const targetTime = latestDate.getTime() - days * 24 * 60 * 60 * 1000;

    let comparisonEntry = null;
    let smallestDiff = Infinity;
    for (let i = 0; i < weightLogs.length - 1; i++) {
        const d = new Date(weightLogs[i].date + 'T00:00:00');
        if (isNaN(d.getTime())) continue;
        const diff = Math.abs(d.getTime() - targetTime);
        if (diff < smallestDiff) {
            smallestDiff = diff;
            comparisonEntry = weightLogs[i];
        }
    }
    if (!comparisonEntry) return null;

    return Math.round((latest.weight - comparisonEntry.weight) * 10) / 10;
}

// 全ワークアウトを日付昇順で走査し、種目名ごとに「その時点までの自己ベスト(最大重量)を
// 更新した記録」を集める。戻り値はワークアウトIDと種目インデックスを組み合わせたキーのSet
// ("workoutId::exerciseIndex")。同じ種目名を複数のワークアウトで記録している場合のみ意味を持つ。
function computeExercisePRs(workouts) {
    if (!Array.isArray(workouts)) return new Set();

    const sorted = workouts.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    const bestByExercise = {};
    const prs = new Set();

    sorted.forEach(w => {
        if (!w || !Array.isArray(w.exercises)) return;
        w.exercises.forEach((ex, idx) => {
            if (!ex || !ex.name || !Array.isArray(ex.sets) || ex.sets.length === 0) return;
            const maxWeight = ex.sets.reduce((max, s) => {
                const weight = typeof s.weight === 'number' ? s.weight : 0;
                return weight > max ? weight : max;
            }, 0);
            const prevBest = bestByExercise[ex.name] || 0;
            if (maxWeight > prevBest) {
                bestByExercise[ex.name] = maxWeight;
                prs.add(`${w.id}::${idx}`);
            }
        });
    });

    return prs;
}

// 全ワークアウトを日付昇順で走査し、種目名ごとに「現時点での自己ベスト」を1件ずつ返す
// (computeExercisePRsと同じ「最大重量」の定義を使うが、こちらは履歴上の更新ポイントではなく
// 最終結果だけを種目名でまとめた一覧を返す)。同じ最大重量が複数セットにある場合はレップ数が
// 多い方を採用する(同じ重量ならより多く挙げられた方を自己ベストとみなす)。
// 戻り値は種目名の昇順で並べた {name, weight, reps, date} の配列。
function computeExerciseBests(workouts) {
    if (!Array.isArray(workouts)) return [];

    const sorted = workouts.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    const bestByExercise = {};

    sorted.forEach(w => {
        if (!w || !Array.isArray(w.exercises)) return;
        w.exercises.forEach(ex => {
            if (!ex || !ex.name || !Array.isArray(ex.sets) || ex.sets.length === 0) return;
            ex.sets.forEach(s => {
                const weight = typeof s.weight === 'number' ? s.weight : 0;
                const reps = typeof s.reps === 'number' ? s.reps : 0;
                const prev = bestByExercise[ex.name];
                if (!prev || weight > prev.weight || (weight === prev.weight && reps > prev.reps)) {
                    bestByExercise[ex.name] = { weight, reps, date: w.date };
                }
            });
        });
    });

    return Object.keys(bestByExercise).sort().map(name => ({ name, ...bestByExercise[name] }));
}

// 摂取(mealLogs)・消費(メンテナンス＋有酸素＋筋トレ)の記録がある日ごとに、収支をまとめた
// 一覧を返す。食事・有酸素・筋トレのいずれかの記録がある日を対象にする(体重だけの記録日は
// カロリー収支という観点では意味を持たないため対象外)。expenditureの式はダッシュボードの
// 「本日の総消費」と同じ(メンテナンス＋その日の有酸素実測消費＋その日の筋トレ推定消費)。
// 戻り値は日付昇順の {date, intake, expenditure, diff} 配列。
function computeDailyCalorieBalances(mealLogs, cardioLogs, workouts, maintenanceCalories, caloriesPerSet) {
    const meals = Array.isArray(mealLogs) ? mealLogs : [];
    const cardios = Array.isArray(cardioLogs) ? cardioLogs : [];
    const sessions = Array.isArray(workouts) ? workouts : [];

    const dates = new Set();
    meals.forEach(m => m && m.date && dates.add(m.date));
    cardios.forEach(c => c && c.date && dates.add(c.date));
    sessions.forEach(w => w && w.date && dates.add(w.date));

    return Array.from(dates).sort().map(date => {
        const meal = meals.find(m => m.date === date);
        const intake = sumMealCalories(meal);

        const cardioKcal = cardios
            .filter(c => c.date === date)
            .reduce((sum, c) => sum + (c.calories || 0), 0);

        const workoutKcal = sessions
            .filter(w => w.date === date)
            .reduce((sum, w) => {
                const kcal = typeof w.estimatedCalories === 'number'
                    ? w.estimatedCalories
                    : estimateWorkoutCalories(w.exercises, caloriesPerSet);
                return sum + kcal;
            }, 0);

        const expenditure = (maintenanceCalories || 0) + cardioKcal + workoutKcal;
        const diff = computeCalorieDiff(intake, expenditure);

        return { date, intake, expenditure, diff };
    });
}

// 全ワークアウトの総負荷量(Σ 重量×レップ数、種目・セット問わず全て合算)を週(日曜始まり)単位で
// 集計する。todayStrを含む週を最新として、weeksCount週分(データが無い週は0)を古い順で返す。
// セッション全体の練習量が伸びているかを見るための指標(種目別の重量推移とは別に見る)。
function computeWeeklyTrainingVolume(workouts, weeksCount, todayStr) {
    if (!Array.isArray(workouts) || !todayStr) return [];

    const volumeByWeekStart = {};
    workouts.forEach(w => {
        if (!w || !w.date || !Array.isArray(w.exercises)) return;
        const weekStart = getWeekStartDate(w.date);
        if (!weekStart) return;
        const sessionVolume = w.exercises.reduce((sum, ex) => {
            if (!ex || !Array.isArray(ex.sets)) return sum;
            return sum + ex.sets.reduce((s, set) => {
                const weight = typeof set.weight === 'number' ? set.weight : 0;
                const reps = typeof set.reps === 'number' ? set.reps : 0;
                return s + weight * reps;
            }, 0);
        }, 0);
        volumeByWeekStart[weekStart] = (volumeByWeekStart[weekStart] || 0) + sessionVolume;
    });

    const todayWeekStart = getWeekStartDate(todayStr);
    if (!todayWeekStart) return [];

    const result = [];
    const cursor = new Date(todayWeekStart + 'T00:00:00');
    for (let i = 0; i < weeksCount; i++) {
        const y = cursor.getFullYear();
        const m = String(cursor.getMonth() + 1).padStart(2, '0');
        const d = String(cursor.getDate()).padStart(2, '0');
        const key = `${y}-${m}-${d}`;
        result.unshift({ weekStart: key, volume: Math.round(volumeByWeekStart[key] || 0) });
        cursor.setDate(cursor.getDate() - 7);
    }
    return result;
}

// 最適化計画のロードマップ(開始時・1ヶ月目・3ヶ月目の目標体重)から、任意の日付における
// 「予測体重」を線形補間で求める。起点日より前はnull。3ヶ月目以降は3ヶ月目の値で横ばいとする
// (それ以降の予測はロードマップが持たないため、単純に維持する)。
// 起点日+30日/+90日という区間割りは computeRoadmapMilestones の再計算式
// (js/plan.js の adoptSimulationPlan から使用)と対応している
// (片方を変える場合はもう片方も合わせること)。
function computePlannedWeightForDate(dateStr, planStartDate, weightStart, weight1Month, weight3Month) {
    if (!dateStr || !planStartDate) return null;
    const start = new Date(planStartDate + 'T00:00:00');
    const target = new Date(dateStr + 'T00:00:00');
    if (isNaN(start.getTime()) || isNaN(target.getTime())) return null;

    const daysSinceStart = (target - start) / (1000 * 60 * 60 * 24);
    if (daysSinceStart < 0) return null;

    if (daysSinceStart <= 30) {
        return Math.round((weightStart + (weight1Month - weightStart) * (daysSinceStart / 30)) * 10) / 10;
    }
    if (daysSinceStart <= 90) {
        return Math.round((weight1Month + (weight3Month - weight1Month) * ((daysSinceStart - 30) / 60)) * 10) / 10;
    }
    return Math.round(weight3Month * 10) / 10;
}

// 日付配列(体重グラフのx軸ラベルと揃える)ごとに予測体重を並べたシリーズを返す。
function computePlannedWeightSeries(dateStrs, planStartDate, weightStart, weight1Month, weight3Month) {
    if (!Array.isArray(dateStrs)) return [];
    return dateStrs.map(d => computePlannedWeightForDate(d, planStartDate, weightStart, weight1Month, weight3Month));
}

// 最適化計画の設定から、週平均の摂取・消費カロリーとその差(アンダーカロリー)を求める。
// 計画タブ表示・サイドバーウィジェット・ロードマップ再計算の3箇所で使う唯一の式
// (以前は3箇所に同じ式が重複していて、片方だけ直すと表示と再計算が食い違う恐れがあった)。
// 値はクラウド同期由来で文字列のこともあるため、parseInt/parseFloatで受ける。
function computePlanCalorieAverages(planSettings) {
    const s = planSettings || {};
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
    return { avgIntake, avgExpenditure, deficit: avgExpenditure - avgIntake };
}

// 開始日(YYYY-MM-DD)からtodayStr(YYYY-MM-DD)までの経過日数(0以上の整数)を返す。
// 不正な日付・未来の開始日は0として扱う。
function computeDaysSince(startDateStr, todayStr) {
    if (!startDateStr || !todayStr) return 0;
    const start = new Date(startDateStr + 'T00:00:00');
    const today = new Date(todayStr + 'T00:00:00');
    if (isNaN(start.getTime()) || isNaN(today.getTime())) return 0;
    return Math.max(0, Math.round((today - start) / (1000 * 60 * 60 * 24)));
}

// 「実績から再計算」時のマイルストーン算出。開始日起点の各マイルストーン日
// (開始+30日/開始+90日)時点の到達見込みを、今日の実測体重とアンダーカロリーから予測する。
// 既に過ぎたマイルストーンは履歴として保持し書き換えない(現在体重で上書きすると、
// 予測線 computePlannedWeightForDate の過去区間が「今日の実測」を通る形に歪み、
// 再計算直後なのにペース遅れ表示になるため)。
function computeRoadmapMilestones(latestWeight, deficit, elapsedDays, prevWeight1Month, prevWeight3Month) {
    const KCAL_PER_KG = 7700;
    let weight1Month = elapsedDays < 30 ? latestWeight : prevWeight1Month;
    let weight3Month = elapsedDays < 90 ? latestWeight : prevWeight3Month;
    if (deficit > 0) {
        if (elapsedDays < 30) {
            weight1Month = Math.round((latestWeight - (deficit * (30 - elapsedDays)) / KCAL_PER_KG) * 10) / 10;
        }
        if (elapsedDays < 90) {
            weight3Month = Math.round((latestWeight - (deficit * (90 - elapsedDays)) / KCAL_PER_KG) * 10) / 10;
        }
    }
    return { weight1Month, weight3Month };
}

// 「フィットネス上の今日」(YYYY-MM-DD)を返す。深夜にトレーニングして日付が変わってから
// 記録することが多いため、AM3時(=27時)までは前日の日付として扱う。
// 記録フォームのデフォルト日付にはgetLocalDateStringではなくこちらを使うこと。
function getFitnessDateString(now = new Date()) {
    const shifted = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const y = shifted.getFullYear();
    const m = String(shifted.getMonth() + 1).padStart(2, '0');
    const d = String(shifted.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// 実績(体重・直近30日の筋トレ頻度・直近28日の有酸素ログ)から活動プロフィールを算出する。
// メンテナンスカロリー(TDEE)＝ BMR(23×体重) × PAL(筋トレ頻度から決定) ＋ 有酸素の1日平均消費。
// baseBurn/runBurn/runCountはplanSettingsの消費予算と同じ意味で返す
// (avgExpenditure = baseBurn + runBurn×runCount/7 がTDEEと一致するように分解している)。
function computeActivityProfile(latestWeight, workouts, cardioLogs, todayStr) {
    const today = new Date(todayStr + 'T00:00:00');

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const workoutsLast30Days = (Array.isArray(workouts) ? workouts : []).filter(w => {
        if (!w || !w.date) return false;
        const d = new Date(w.date + 'T00:00:00');
        return d >= thirtyDaysAgo && d <= today;
    }).length;

    const bmr = Math.round(23 * latestWeight);
    let pal = 1.2;
    let palDesc = 'ほとんど運動なし';
    if (workoutsLast30Days >= 12) { pal = 1.725; palDesc = '活発 (週3回以上)'; }
    else if (workoutsLast30Days >= 8) { pal = 1.55; palDesc = '適度 (週2回程度)'; }
    else if (workoutsLast30Days >= 4) { pal = 1.375; palDesc = '軽め (週1回程度)'; }
    const baseBurn = Math.round(bmr * pal);

    const windowDays = 28;
    const windowStart = new Date(today);
    windowStart.setDate(today.getDate() - windowDays);
    const recentCardio = (Array.isArray(cardioLogs) ? cardioLogs : []).filter(c => {
        if (!c || !c.date) return false;
        const d = new Date(c.date + 'T00:00:00');
        return d >= windowStart && d <= today;
    });

    let runBurn = 0;
    let runCount = 0;
    if (recentCardio.length > 0) {
        const totalCalories = recentCardio.reduce((sum, c) => sum + (c.calories || 0), 0);
        runBurn = Math.round(totalCalories / recentCardio.length);
        runCount = Math.round((recentCardio.length / windowDays) * 7 * 10) / 10;
    }

    const tdee = Math.round(baseBurn + (runBurn * runCount) / 7);

    return { workoutsLast30Days, bmr, pal, palDesc, baseBurn, runBurn, runCount, tdee };
}

// 減量ペース(kg/月)から、目標摂取カロリーを「通常日・少し甘えた日・イベント日」の3区分で算出する。
// 甘えた日・イベント日は通常日への上乗せ幅(delta)を固定し、週平均がちょうど
// targetAvgIntake になるように通常日のカロリーを逆算する。
// 戻り値のdailyDeficitは1日あたりの目標アンダーカロリー(pace×7700÷30)。
//
// minIntakeNormal(>0で有効、通常はBMRを渡す): 速いペース×低TDEEの組合せで通常日が
// 基礎代謝を下回るような非現実的な値になる場合の安全下限。下限に当たった場合は
// clamped=true になり、実効アンダーカロリー(effectiveDailyDeficit)は目標より小さくなる
// (=減量は選択ペースより緩やか)。予測・ロードマップには effectiveDailyDeficit を使うこと。
function computeIntakeTiersForPace(tdee, paceKgPerMonth, daysNormal, daysSweet, daysEvent, deltaSweet, deltaEvent, minIntakeNormal = 0) {
    const KCAL_PER_KG = 7700;
    const dailyDeficit = Math.round((paceKgPerMonth * KCAL_PER_KG) / 30);
    const targetAvgIntake = tdee - dailyDeficit;

    const dN = parseInt(daysNormal) || 0;
    const dS = parseInt(daysSweet) || 0;
    const dE = parseInt(daysEvent) || 0;
    const totalDays = dN + dS + dE;
    const denom = totalDays > 0 ? totalDays : 7;

    // targetAvgIntake×denom = normal×dN + (normal+deltaSweet)×dS + (normal+deltaEvent)×dE を解く
    let intakeNormal = Math.round((targetAvgIntake * denom - deltaSweet * dS - deltaEvent * dE) / denom / 10) * 10;

    let clamped = false;
    if (minIntakeNormal > 0 && intakeNormal < minIntakeNormal) {
        intakeNormal = Math.round(minIntakeNormal / 10) * 10;
        clamped = true;
    }

    const intakeSweet = intakeNormal + deltaSweet;
    const intakeEvent = intakeNormal + deltaEvent;
    const effectiveAvgIntake = Math.round((intakeNormal * dN + intakeSweet * dS + intakeEvent * dE) / denom);
    const effectiveDailyDeficit = tdee - effectiveAvgIntake;

    return { dailyDeficit, targetAvgIntake, intakeNormal, intakeSweet, intakeEvent, clamped, effectiveAvgIntake, effectiveDailyDeficit };
}

// 1日あたりのアンダーカロリーがdailyDeficitで続いた場合の、days日後の予測体重。
function projectWeightAfterDays(latestWeight, dailyDeficit, days) {
    const KCAL_PER_KG = 7700;
    return Math.round((latestWeight - (dailyDeficit * days) / KCAL_PER_KG) * 10) / 10;
}

// 開始日修正マイグレーション(state.jsのrunOneTimeMigrations)の判定部。
// 「最初の体重ログの日付」を正しい計画開始日とみなす。
// 戻り値: { apply: 書き換えるか, startDate: 適用する開始日, markDone: 移行フラグを立ててよいか }
// 体重ログがまだ無い環境(クラウド同期前)では markDone=false を返し、次回起動で再判定させる。
function decidePlanStartDateMigration(weightLogs, planSettings) {
    if (!Array.isArray(weightLogs) || weightLogs.length === 0 || !planSettings) {
        return { apply: false, startDate: null, markDone: false };
    }
    const firstDate = weightLogs[0] && weightLogs[0].date;
    if (!firstDate) {
        return { apply: false, startDate: null, markDone: false };
    }
    if (planSettings.weightPlanStartDate === firstDate) {
        return { apply: false, startDate: firstDate, markDone: true };
    }
    return { apply: true, startDate: firstDate, markDone: true };
}

// 全ワークアウトを走査し、種目名がfromNameに一致するものをtoNameへ改名する(workoutsを直接書き換える)。
// 誤った名前で記録し続けていた種目を一括修正するデータ移行に使う。改名した種目の件数を返す。
function renameExercisesInWorkouts(workouts, fromName, toName) {
    if (!Array.isArray(workouts) || !fromName || !toName) return 0;
    let renamed = 0;
    workouts.forEach(w => {
        if (!w || !Array.isArray(w.exercises)) return;
        w.exercises.forEach(ex => {
            if (ex && ex.name === fromName) {
                ex.name = toName;
                renamed++;
            }
        });
    });
    return renamed;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        normalizeDate,
        normalizeTime,
        validateWorkoutsSchema,
        filterValidWeightLogs,
        filterValidCardioLogs,
        filterValidMealLogs,
        sumMealCalories,
        computeCalorieDiff,
        sortedByDateDesc,
        getLatestWeightFromLogs,
        estimateWorkoutCalories,
        getWeekStartDate,
        sumCardioDistanceForWeek,
        computeMovingAverage,
        computeWeightChangeOverDays,
        computeExercisePRs,
        computeExerciseBests,
        computeDailyCalorieBalances,
        computeWeeklyTrainingVolume,
        computePlannedWeightForDate,
        computePlannedWeightSeries,
        computePlanCalorieAverages,
        computeDaysSince,
        computeRoadmapMilestones,
        decidePlanStartDateMigration,
        getFitnessDateString,
        computeActivityProfile,
        computeIntakeTiersForPace,
        projectWeightAfterDays,
        isStrictNumeric,
        renameExercisesInWorkouts
    };
}
