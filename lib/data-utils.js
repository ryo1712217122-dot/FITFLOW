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
        if (!Array.isArray(w.exercises)) return false;

        for (const ex of w.exercises) {
            if (!ex || typeof ex !== 'object') return false;
            if (typeof ex.name !== 'string' || !ex.name) return false;
            if (!Array.isArray(ex.sets)) return false;
            for (const s of ex.sets) {
                if (!s || typeof s !== 'object') return false;
                // Support both float/int, check isNaN
                const weight = parseFloat(s.weight);
                const reps = parseInt(s.reps);
                if (isNaN(weight) || isNaN(reps)) return false;
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

// state.foodLogsのうち、指定した年月(yearMonth: "YYYY-MM")に該当する記録だけを対象に、
// カテゴリ(categoryKeys: [{key, calKey}, ...]。FOOD_ITEMSのサブセットを呼び出し側から渡す)ごとの
// 件数と合計kcalを集計する。FOOD_ITEMS自体はconfig.js側の定義なので、このファイルは
// キー情報を受け取るだけにして特定のカテゴリ一覧に依存しない。
function computeFoodCategoryBreakdown(foodLogs, categoryKeys, yearMonth) {
    const result = {};
    if (!Array.isArray(categoryKeys)) return result;
    categoryKeys.forEach(c => { result[c.key] = { count: 0, totalKcal: 0 }; });

    if (!Array.isArray(foodLogs) || !yearMonth) return result;

    foodLogs.forEach(log => {
        if (!log || !log.date || !log.date.startsWith(yearMonth)) return;
        categoryKeys.forEach(c => {
            if (!log[c.key]) return;
            result[c.key].count += 1;
            const cal = log[c.calKey];
            if (typeof cal === 'number' && cal > 0) result[c.key].totalKcal += cal;
        });
    });

    return result;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        normalizeDate,
        normalizeTime,
        validateWorkoutsSchema,
        filterValidWeightLogs,
        filterValidCardioLogs,
        sortedByDateDesc,
        getLatestWeightFromLogs,
        estimateWorkoutCalories,
        getWeekStartDate,
        sumCardioDistanceForWeek,
        computeMovingAverage,
        computeWeightChangeOverDays,
        computeExercisePRs,
        computeWeeklyTrainingVolume,
        computePlannedWeightForDate,
        computePlannedWeightSeries,
        computeFoodCategoryBreakdown
    };
}
