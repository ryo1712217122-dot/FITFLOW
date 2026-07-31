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

// workoutsと違い、体重・有酸素・食事ログは1件の不正な行のために全体を取り込み拒否にはせず、
// その行だけ除外してコンソールに警告を出す（インポート全体を失いたくないため）。
//
// これらは「取り込みの境界」なので、有効行の数値フィールドはここでNumber()に正規化して返す
// (フィルタであると同時に正規化でもある)。クラウド(スプレッドシート)やJSONバックアップ由来の
// 値は "70.5" のような数値文字列で来ることがあり、素通しすると下流で
//   - 間食の加算が文字列連結になる ("300" + 50 = "30050")
//   - 表示側の toFixed() / Math.round() が期待どおり動かない
// といった不具合になる。クラウド経路は normalizeImportedData が先に数値化しているが、
// JSONインポート経路はそれを通らないため、ここを最終防衛線にする。
function filterValidWeightLogs(data) {
    if (!Array.isArray(data)) return [];
    const result = [];
    data.forEach(w => {
        const weight = w && isStrictNumeric(w.weight) ? Number(w.weight) : NaN;
        if (!w || typeof w.date !== 'string' || !w.date || !(weight > 0)) {
            console.warn('☁️ 不正な体重ログをスキップしました:', w);
            return;
        }
        result.push({ ...w, weight });
    });
    return result;
}

function filterValidCardioLogs(data) {
    if (!Array.isArray(data)) return [];
    const result = [];
    data.forEach(c => {
        const distance = c && isStrictNumeric(c.distance) ? Number(c.distance) : NaN;
        const calories = c && isStrictNumeric(c.calories) ? Number(c.calories) : NaN;
        if (!c || typeof c.date !== 'string' || !c.date || !(distance > 0) || !(calories >= 0)) {
            console.warn('☁️ 不正な有酸素ログをスキップしました:', c);
            return;
        }
        result.push({ ...c, distance, calories });
    });
    return result;
}

// 食事ログ(1件=1日、朝食/昼食/夕食/間食のkcal内訳)のうち不正な行だけを除外する。
// 4項目とも0以上の数値であることを要求する(未入力はフォーム側で0として保存する前提)。
const MEAL_CALORIE_FIELDS = ['breakfast', 'lunch', 'dinner', 'snacks'];

function filterValidMealLogs(data) {
    if (!Array.isArray(data)) return [];
    const result = [];
    data.forEach(m => {
        const ok = !!m && typeof m.date === 'string' && !!m.date &&
            MEAL_CALORIE_FIELDS.every(k => isStrictNumeric(m[k]) && Number(m[k]) >= 0);
        if (!ok) {
            console.warn('☁️ 不正な食事ログをスキップしました:', m);
            return;
        }
        const normalized = { ...m };
        MEAL_CALORIE_FIELDS.forEach(k => { normalized[k] = Number(m[k]); });
        result.push(normalized);
    });
    return result;
}

// 飲み会ログ({ date }のみ)の検証。日付文字列を持たない要素を捨て、同一日付は1件に寄せる
// (「1日1件」前提。クラウド往復やマージで重複が紛れ込んでも表示・集計が二重にならないように)。
function filterValidDrinkingLogs(data) {
    if (!Array.isArray(data)) return [];
    const seen = new Set();
    return data.filter(d => {
        const ok = !!d && typeof d.date === 'string' && !!d.date;
        if (!ok) {
            console.warn('☁️ 不正な飲み会ログをスキップしました:', d);
            return false;
        }
        if (seen.has(d.date)) return false;
        seen.add(d.date);
        return true;
    });
}

// 飲み会前後の体重変化を集計する。各飲み会日について、
//   直前の体重 = 飲み会当日以前・maxGapDays日以内で最も新しい体重ログ
//   直後の体重 = 飲み会翌日以降・maxGapDays日以内で最も早い体重ログ
// の差(直後 - 直前)を取り、平均を返す。前後どちらかの体重記録が無い飲み会は集計から除く。
// 注意: 前後の体重差をすべて飲み会に帰属させる簡易指標。飲み会がmaxGapDays以内に連続すると
// 同じ体重変化が複数の飲み会に重複計上されうるため、あくまで参考値として扱うこと。
// 戻り値: { count: 集計できた飲み会の回数, avgDelta: 平均変化kg(小数1桁) } / 集計不能ならnull
function computeDrinkingWeightImpact(weightLogs, drinkingLogs, maxGapDays = 3) {
    if (!Array.isArray(weightLogs) || !Array.isArray(drinkingLogs)) return null;

    const toTime = (dateStr) => {
        const t = new Date(dateStr + 'T00:00:00').getTime();
        return isNaN(t) ? null : t;
    };
    const DAY_MS = 24 * 60 * 60 * 1000;

    const logs = weightLogs
        .filter(w => w && typeof w.weight === 'number' && !isNaN(w.weight))
        .map(w => ({ time: toTime(w.date), weight: w.weight }))
        .filter(w => w.time !== null)
        .sort((a, b) => a.time - b.time);
    if (logs.length < 2) return null;

    const deltas = [];
    drinkingLogs.forEach(d => {
        if (!d || typeof d.date !== 'string') return;
        const t = toTime(d.date);
        if (t === null) return;

        let before = null;
        let after = null;
        logs.forEach(w => {
            const diffDays = (w.time - t) / DAY_MS;
            if (diffDays <= 0 && diffDays >= -maxGapDays) before = w; // 昇順走査なので最後に残るのが直前
            if (diffDays > 0 && diffDays <= maxGapDays && after === null) after = w;
        });
        if (before && after) deltas.push(after.weight - before.weight);
    });

    if (deltas.length === 0) return null;
    const avg = deltas.reduce((sum, v) => sum + v, 0) / deltas.length;
    return { count: deltas.length, avgDelta: Math.round(avg * 10) / 10 };
}

// 1日分の食事ログ(朝食/昼食/夕食/間食)の合計摂取kcalを返す。エントリが無ければ0。
function sumMealCalories(mealLog) {
    if (!mealLog) return 0;
    return MEAL_CALORIE_FIELDS.reduce((sum, key) => sum + (Number(mealLog[key]) || 0), 0);
}

// 指定した食事項目(breakfast/lunch/dinner/snacks)だけを上書きした、その日の食事記録エントリを返す。
// 飲み会フォームから推定カロリーをmealLogsへ反映する時に使う。
//
// 飲み会のカロリーをdrinkingLogsではなくmealLogsへ入れているのは、
//   - 実測TDEE(computeMeasuredTdee)がmealLogsしか見ないため、drinkingLogsに持たせても
//     「飲み会の日だけ摂取が記録から抜けて実測TDEEが低めに出る」偏りが解消しない
//   - drinkingLogsはGAS側が未対応(GAS_DRINKINGLOGS_PATCH.md)でクラウドに保存されないが、
//     mealLogsは対応済みなので同期にも乗る
// という2つの理由による。drinkingLogsは{date}のみのまま変更しない
// (フィールドを増やすとbackup.jsのマージがdateしか再構築しないため落ちる)。
//
// 既存エントリがあれば他の項目は保持し、指定項目だけ差し替える(上書きなので、
// 同じ操作を繰り返しても二重加算にならない)。
function buildMealLogWithField(existingMeal, date, field, value) {
    const base = { date, breakfast: 0, lunch: 0, dinner: 0, snacks: 0 };
    const merged = existingMeal ? Object.assign({}, base, existingMeal, { date }) : base;
    merged[field] = value;
    // 既存エントリ由来の値に数値文字列が混ざっていても数値で揃える
    MEAL_CALORIE_FIELDS.forEach(k => { merged[k] = Number(merged[k]) || 0; });
    return merged;
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
    // null要素や日付欠落・不正日付があっても落ちないようにする。
    // 履歴一覧(有酸素・体重・食事)はすべてこれを通るため、壊れた1件で
    // 一覧全体が真っ白になるのは避けたい。日付として読めないものは最も古い扱い。
    const timeOf = (e) => {
        const t = e && e.date ? new Date(e.date).getTime() : NaN;
        return isNaN(t) ? -Infinity : t;
    };
    return entries.slice().sort((a, b) => {
        const ta = timeOf(a);
        const tb = timeOf(b);
        // -Infinity同士を引くとNaNになり比較関数が壊れるため、先に同値判定する
        return ta === tb ? 0 : tb - ta;
    });
}

// 有酸素ログを月ごとにまとめる。履歴一覧を「2026年7月（12回・52.3km）」のような
// 見出しで区切り、その月にどれだけ走ったかを一目で分かるようにするために使う。
// 月は新しい順、月内のログも新しい順。日付が不正な行は無視する。
function groupCardioLogsByMonth(cardioLogs) {
    if (!Array.isArray(cardioLogs)) return [];

    const byMonth = new Map();
    sortedByDateDesc(cardioLogs).forEach(c => {
        if (!c || typeof c.date !== 'string') return;
        const monthKey = c.date.slice(0, 7);
        if (!/^\d{4}-\d{2}$/.test(monthKey)) return;

        if (!byMonth.has(monthKey)) {
            const [y, m] = monthKey.split('-');
            byMonth.set(monthKey, {
                monthKey,
                label: `${Number(y)}年${Number(m)}月`,
                count: 0,
                totalDistance: 0,
                totalCalories: 0,
                logs: []
            });
        }
        const group = byMonth.get(monthKey);
        group.logs.push(c);
        group.count += 1;
        group.totalDistance += Number(c.distance) || 0;
        group.totalCalories += Number(c.calories) || 0;
    });

    return Array.from(byMonth.values())
        .sort((a, b) => (a.monthKey < b.monthKey ? 1 : a.monthKey > b.monthKey ? -1 : 0))
        .map(g => Object.assign({}, g, {
            // 距離は小数2桁(1件ずつの表示と桁を揃える)、カロリーは整数
            totalDistance: Math.round(g.totalDistance * 100) / 100,
            totalCalories: Math.round(g.totalCalories)
        }));
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

// 日付昇順の体重ログから「直近days日間での体重変化量」を返す。
//
// 以前は「最新の1点」と「days日前に最も近い1点」の差を取っていたが、体重の日々の
// 測定ノイズは標準偏差で0.4kg程度あり、2点の差ではノイズが約0.57kgまで膨らむ。
// 週0.5kgという実際の変化と同じオーダーで、表示される数字の半分近くがノイズだった。
// いまは両端とも windowSize 日の移動平均を取ることでノイズを約1/√windowSize に落とす
// (days=7・windowSize=7なら2つの平均窓は重ならないので、差の意味も保たれる)。
//
// 比較対象が無い(ログが1件以下)場合はnullを返す。
function computeWeightTrendChange(weightLogs, days, windowSize = 7) {
    if (!Array.isArray(weightLogs) || weightLogs.length < 2) return null;

    const averages = computeMovingAverage(weightLogs, windowSize);
    const latest = weightLogs[weightLogs.length - 1];
    const latestDate = new Date(latest.date + 'T00:00:00');
    if (isNaN(latestDate.getTime())) return null;
    const targetTime = latestDate.getTime() - days * 24 * 60 * 60 * 1000;

    let comparisonIndex = -1;
    let smallestDiff = Infinity;
    for (let i = 0; i < weightLogs.length - 1; i++) {
        const d = new Date(weightLogs[i].date + 'T00:00:00');
        if (isNaN(d.getTime())) continue;
        const diff = Math.abs(d.getTime() - targetTime);
        if (diff < smallestDiff) {
            smallestDiff = diff;
            comparisonIndex = i;
        }
    }
    if (comparisonIndex === -1) return null;

    const latestAvg = averages[averages.length - 1].average;
    const pastAvg = averages[comparisonIndex].average;
    return Math.round((latestAvg - pastAvg) * 10) / 10;
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

    // 日付ごとに1パスで集計してから組み立てる。以前は対象日ごとに3配列をfind/filterで
    // 走査していたため、記録が増えるほど O(日数 × 記録数) で重くなっていた
    // (数年分の毎日の記録で体感できる差になる)。
    const dates = new Set();
    const mealByDate = new Map();
    const cardioKcalByDate = new Map();
    const workoutKcalByDate = new Map();

    meals.forEach(m => {
        if (!m || !m.date) return;
        dates.add(m.date);
        // 「1日1件」前提。重複がある場合は先頭を採用する(旧実装のfind()と同じ)
        if (!mealByDate.has(m.date)) mealByDate.set(m.date, m);
    });
    cardios.forEach(c => {
        if (!c || !c.date) return;
        dates.add(c.date);
        cardioKcalByDate.set(c.date, (cardioKcalByDate.get(c.date) || 0) + (c.calories || 0));
    });
    sessions.forEach(w => {
        if (!w || !w.date) return;
        dates.add(w.date);
        const kcal = typeof w.estimatedCalories === 'number'
            ? w.estimatedCalories
            : estimateWorkoutCalories(w.exercises, caloriesPerSet);
        workoutKcalByDate.set(w.date, (workoutKcalByDate.get(w.date) || 0) + kcal);
    });

    return Array.from(dates).sort().map(date => {
        const intake = sumMealCalories(mealByDate.get(date));
        const cardioKcal = cardioKcalByDate.get(date) || 0;
        const workoutKcal = workoutKcalByDate.get(date) || 0;

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

// 計画上の予測体重を求める唯一の関数。体重グラフの予測線とロードマップ表の両方がこれを通る。
//
// v1.21.0以前は、この関数が保存済みマイルストーン(weightStart/weight1Month/weight3Month)を
// 線形補間する一方、ロードマップ表は選択中のペースから毎回引き直しており、
// 「計画上の体重」の定義が画面ごとに2つ存在していた。ペースを変えるとロードマップだけが動き、
// グラフの予測線は「計画に反映」を押すまで古い値のまま食い違う状態だった。
// いまはどちらも projectWeightAfterDays に集約している。
//
// 起点日より前はnull(計画が始まっていない期間に予測線を引かない)。
function computePlannedWeightForDate(dateStr, planStartDate, startWeight, dailyDeficit, kcalPerKgPerDay = 0) {
    if (!dateStr || !planStartDate) return null;
    const start = new Date(planStartDate + 'T00:00:00');
    const target = new Date(dateStr + 'T00:00:00');
    if (isNaN(start.getTime()) || isNaN(target.getTime())) return null;
    if (!isFinite(Number(startWeight)) || Number(startWeight) <= 0) return null;

    const daysSinceStart = (target - start) / (1000 * 60 * 60 * 24);
    if (daysSinceStart < 0) return null;

    return projectWeightAfterDays(startWeight, dailyDeficit, daysSinceStart, kcalPerKgPerDay);
}

// 日付配列(体重グラフのx軸ラベルと揃える)ごとに予測体重を並べたシリーズを返す。
function computePlannedWeightSeries(dateStrs, planStartDate, startWeight, dailyDeficit, kcalPerKgPerDay = 0) {
    if (!Array.isArray(dateStrs)) return [];
    return dateStrs.map(d => computePlannedWeightForDate(d, planStartDate, startWeight, dailyDeficit, kcalPerKgPerDay));
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
function computeRoadmapMilestones(latestWeight, deficit, elapsedDays, prevWeight1Month, prevWeight3Month, kcalPerKgPerDay = 0) {
    let weight1Month = elapsedDays < 30 ? latestWeight : prevWeight1Month;
    let weight3Month = elapsedDays < 90 ? latestWeight : prevWeight3Month;
    if (deficit > 0) {
        if (elapsedDays < 30) {
            weight1Month = projectWeightAfterDays(latestWeight, deficit, 30 - elapsedDays, kcalPerKgPerDay);
        }
        if (elapsedDays < 90) {
            weight3Month = projectWeightAfterDays(latestWeight, deficit, 90 - elapsedDays, kcalPerKgPerDay);
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

// 実績(体重・直近30日の筋トレ・直近28日の有酸素)から活動プロフィールを算出する。
//
//   TDEE ＝ BMR(bmrPerKg×体重) × 生活活動レベルPAL ＋ 有酸素の1日平均 ＋ 筋トレの1日平均
//
// v1.21.0で「PALを筋トレ頻度から決める」方式をやめた。旧方式はPALと筋トレ消費の
// 二重計上になっていた: PALが1.2→1.725に上がる差は体重80kgで約966kcal/日あり、
// 月12回で割ると1回あたり約2400kcalの暗黙加算になる。そこへダッシュボードは
// さらに15kcal/セット(1回約300kcal)を足していたため、総消費が構造的に過大だった。
// (加えてHarris-Benedictの原典では1.725は「週6〜7回」であり、週3回に割り当てるのは
//  そもそも1段の上振れ。しかもジムの回数は日常の活動量の代理変数として弱く、
//  毎日1万歩歩く人でも筋トレしなければ1.2になってしまっていた)
//
// 新方式のPALは「運動を除いた生活活動の水準」で、ユーザーが一度だけ選ぶ設定値
// (planSettings.lifestyleActivityLevel)。運動は有酸素も筋トレも実績から明示的に加算する。
// これでダッシュボードの「メンテナンス＋有酸素＋筋トレ」と計画タブのTDEEが同じ定義になり、
// 二重計上も消える(baseBurnは運動を一切含まない基準線)。
//
// kcalPerKgPerDay は「体重が1kg減るとTDEEが何kcal/日下がるか」。BMR分(bmrPerKg×PAL)に
// 有酸素分(消費が距離×体重なので、1日あたり走行km)を足したもの。減量が進むほど赤字が縮む
// 効果を予測に織り込むために使う(projectWeightAfterDays / computeEquilibriumWeight)。
function computeActivityProfile(latestWeight, workouts, cardioLogs, todayStr, {
    lifestylePal = 1.55, caloriesPerSet = 0, bmrPerKg = 23,
    workoutWindowDays = 30, cardioWindowDays = 28
} = {}) {
    const today = new Date(todayStr + 'T00:00:00');
    const DAY_MS = 24 * 60 * 60 * 1000;
    // 「直近N日」は今日を含めてN日。以前は today - N 〜 today で N+1 日分を集めながら
    // N で割っており、頻度が3〜4%過大に出ていた(computeMeasuredTdeeの窓とも不一致だった)。
    const windowStartOf = (n) => new Date(today.getTime() - (n - 1) * DAY_MS);
    const inWindow = (dateStr, start) => {
        const d = new Date(dateStr + 'T00:00:00');
        return !isNaN(d.getTime()) && d >= start && d <= today;
    };

    const bmr = Math.round(bmrPerKg * latestWeight);
    const pal = Number(lifestylePal) > 0 ? Number(lifestylePal) : 1.55;
    const baseBurn = Math.round(bmr * pal);

    // 筋トレ: 直近workoutWindowDays日の推定消費を日割りする
    const workoutStart = windowStartOf(workoutWindowDays);
    const recentWorkouts = (Array.isArray(workouts) ? workouts : [])
        .filter(w => w && w.date && inWindow(w.date, workoutStart));
    const workoutsLast30Days = recentWorkouts.length;
    const workoutTotalKcal = recentWorkouts.reduce((sum, w) => {
        const kcal = typeof w.estimatedCalories === 'number'
            ? w.estimatedCalories
            : estimateWorkoutCalories(w.exercises, caloriesPerSet);
        return sum + kcal;
    }, 0);
    const workoutBurn = workoutsLast30Days > 0 ? Math.round(workoutTotalKcal / workoutsLast30Days) : 0;
    const workoutDailyAvg = Math.round(workoutTotalKcal / workoutWindowDays);

    // 有酸素: 直近cardioWindowDays日の実測消費と走行距離を日割りする
    const cardioStart = windowStartOf(cardioWindowDays);
    const recentCardio = (Array.isArray(cardioLogs) ? cardioLogs : [])
        .filter(c => c && c.date && inWindow(c.date, cardioStart));

    let runBurn = 0;
    let runCount = 0;
    let cardioDailyAvg = 0;
    let cardioKmPerDay = 0;
    if (recentCardio.length > 0) {
        const totalCalories = recentCardio.reduce((sum, c) => sum + (c.calories || 0), 0);
        const totalDistance = recentCardio.reduce((sum, c) => sum + (c.distance || 0), 0);
        // runBurn/runCountはplanSettingsの消費予算(とクラウドのPlanSettingsシート)の
        // 項目に対応するため、意味を変えずに残す
        runBurn = Math.round(totalCalories / recentCardio.length);
        runCount = Math.round((recentCardio.length / cardioWindowDays) * 7 * 10) / 10;
        cardioDailyAvg = Math.round(totalCalories / cardioWindowDays);
        cardioKmPerDay = totalDistance / cardioWindowDays;
    }

    const tdee = baseBurn + cardioDailyAvg + workoutDailyAvg;
    const kcalPerKgPerDay = bmrPerKg * pal + cardioKmPerDay;

    return {
        workoutsLast30Days, workoutBurn, workoutDailyAvg,
        bmr, pal, baseBurn,
        runBurn, runCount, cardioDailyAvg, cardioKmPerDay,
        tdee, kcalPerKgPerDay
    };
}

// 実測TDEE(アダプティブTDEE)。推定式(computeActivityProfile)ではなく、実際の食事記録と
// 体重推移から「実測TDEE = 期間平均摂取kcal + 7700 × 体重減少ペース(kg/日)」で逆算する。
// - 体重は日々の水分等のノイズが大きいため、窓内の全測定点の最小二乗回帰で傾きを求める
// - 平均摂取は「食事記録がある日」だけで平均する(未記録日を0kcalと解釈しない。
//   記録がある日がその人の食生活の代表値である、という仮定に立つ)
// - 体重が増えている期間は負の減少ペースとしてそのまま計算する(式は増量方向にも有効)
// データ不足、または結果が生理的にあり得ない値(既定1000〜6000kcal外)の場合はnullを返し、
// 呼び出し側は推定式にフォールバックする。
//
// 有効化の条件は「体重8点・14日以上」という件数固定ではなく、回帰の傾きの標準誤差が
// TDEE換算で maxTdeeStdError 以下に収まったか、という精度基準にしている(v1.21.0)。
// 件数固定だと、閾値ちょうど(8点/14日)で有効化された実測TDEEの95%区間は±500kcalを超え、
// 推定式との差より誤差の方が大きい状態で「実測 2450」と整数1つで表示してしまっていた。
//   SE(slope) = σ/√Sxx、TDEE換算 = 7700×SE
//   毎日測定・28日(σ≈0.4kg)  → ±72kcal/日(1σ)
//   8点・14日                 → ±270kcal/日(1σ)、95%区間で±530kcal
// 精度基準にすれば、毎日測る人は早く使えるようになり、まばらな人は正しく待たされる。
//
// 平均摂取の側も、件数(minMealDays)だけでなく窓内の記録率(minMealCoverage)を課す。
// 28日中10日しか記録が無い状態は標本として偏りやすい(記録し忘れるのは決まって
// 食べ過ぎた日、という非対称性がある)ため。
function computeMeasuredTdee(weightLogs, mealLogs, todayStr, {
    windowDays = 28, minWeightPoints = 5, minSpanDays = 7, minMealDays = 10,
    minMealCoverage = 0.5, maxTdeeStdError = 150,
    minPlausibleTdee = 1000, maxPlausibleTdee = 6000
} = {}) {
    if (!Array.isArray(weightLogs) || !Array.isArray(mealLogs) || !todayStr) return null;

    const KCAL_PER_KG = 7700;
    const DAY_MS = 24 * 60 * 60 * 1000;
    const today = new Date(todayStr + 'T00:00:00');
    if (isNaN(today.getTime())) return null;
    const windowStart = new Date(today.getTime() - (windowDays - 1) * DAY_MS);

    // 窓内の体重測定点を「窓開始日からの経過日数(x), 体重(y)」に変換する
    const points = [];
    weightLogs.forEach(w => {
        if (!w || typeof w.weight !== 'number' || isNaN(w.weight) || w.weight <= 0) return;
        const d = new Date(w.date + 'T00:00:00');
        if (isNaN(d.getTime()) || d < windowStart || d > today) return;
        points.push({ x: Math.round((d - windowStart) / DAY_MS), y: w.weight });
    });
    // 3点未満では残差分散(自由度n−2)が定義できず、標準誤差による判定ができない
    if (points.length < Math.max(3, minWeightPoints)) return null;

    const xs = points.map(p => p.x);
    const spanDays = Math.max(...xs) - Math.min(...xs);
    if (spanDays < minSpanDays) return null;

    // 最小二乗回帰の傾き(kg/日)
    const n = points.length;
    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = points.reduce((a, p) => a + p.y, 0) / n;
    let sxx = 0;
    let sxy = 0;
    let syy = 0;
    points.forEach(p => {
        sxx += (p.x - meanX) * (p.x - meanX);
        sxy += (p.x - meanX) * (p.y - meanY);
        syy += (p.y - meanY) * (p.y - meanY);
    });
    if (sxx === 0) return null;
    const slopeKgPerDay = sxy / sxx;

    // 傾きの標準誤差。残差分散 σ² = (Syy − slope×Sxy)/(n−2)、SE(slope) = σ/√Sxx。
    // 浮動小数の丸めで残差平方和がわずかに負になることがあるので0で下限を切る。
    const residualSS = Math.max(0, syy - slopeKgPerDay * sxy);
    const sigma = Math.sqrt(residualSS / (n - 2));
    const slopeStdError = sigma / Math.sqrt(sxx);
    const tdeeStdError = Math.round(KCAL_PER_KG * slopeStdError);
    if (tdeeStdError > maxTdeeStdError) return null;

    // 窓内の食事記録(合計0kcalの行は未入力扱い)から平均摂取を出す。
    // 同一日付の重複行は先頭のみ採用する(アプリは「1日1件」前提で、消費側も
    // find()で先頭しか見ない。重複を数えるとmealDaysの閾値判定と平均が歪む)。
    // 注意: 食事を記録しない日は平均摂取から抜けるが体重増は回帰に乗るため、
    // その分だけ実測TDEEは低め(減量計画としては保守的な方向)に出る。
    // 記録が抜けやすい飲み会の日は、飲み会フォームの「推定摂取カロリー」から
    // その日のmealLogsへ書き込めるようにして、この偏りを減らしている。
    const intakes = [];
    const seenMealDates = new Set();
    mealLogs.forEach(m => {
        if (!m || !m.date || seenMealDates.has(m.date)) return;
        const d = new Date(m.date + 'T00:00:00');
        if (isNaN(d.getTime()) || d < windowStart || d > today) return;
        seenMealDates.add(m.date);
        const total = sumMealCalories(m);
        if (total > 0) intakes.push(total);
    });
    if (intakes.length < minMealDays) return null;
    const mealCoverage = intakes.length / windowDays;
    if (mealCoverage < minMealCoverage) return null;
    const avgIntake = Math.round(intakes.reduce((a, b) => a + b, 0) / intakes.length);

    const tdee = Math.round(avgIntake + KCAL_PER_KG * (-slopeKgPerDay));
    if (tdee < minPlausibleTdee || tdee > maxPlausibleTdee) return null;

    return {
        tdee,
        avgIntake,
        slopeKgPerDay: Math.round(slopeKgPerDay * 1000) / 1000,
        // 95%区間。摂取記録のばらつきは含まず、体重の傾きの不確かさだけを表す
        tdeeStdError,
        tdeeLow: Math.round(tdee - 1.96 * tdeeStdError),
        tdeeHigh: Math.round(tdee + 1.96 * tdeeStdError),
        mealDays: intakes.length,
        mealCoverage: Math.round(mealCoverage * 100) / 100,
        weightPoints: n,
        spanDays,
        windowDays
    };
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

// 指定日(YYYY-MM-DD)に最も近い体重記録を返す。maxGapDaysを超えて離れていればnull。
// ロードマップの各節目に「その頃の実績体重」を対応づけるために使う
// (毎日測るとは限らないので、節目の日付ちょうどの記録が無いことは普通にある)。
function findWeightNearDate(weightLogs, dateStr, maxGapDays = 7) {
    if (!Array.isArray(weightLogs) || !dateStr) return null;
    const target = new Date(dateStr + 'T00:00:00').getTime();
    if (isNaN(target)) return null;
    const DAY_MS = 24 * 60 * 60 * 1000;

    let best = null;
    let bestGap = Infinity;
    weightLogs.forEach(w => {
        if (!w || typeof w.weight !== 'number' || isNaN(w.weight) || w.weight <= 0) return;
        const t = new Date(w.date + 'T00:00:00').getTime();
        if (isNaN(t)) return;
        const gap = Math.abs(t - target) / DAY_MS;
        if (gap <= maxGapDays && gap < bestGap) {
            bestGap = gap;
            best = w;
        }
    });
    return best;
}

// 日付文字列に日数を足した "YYYY-MM-DD" を返す。
function addDaysToDateString(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// 体重ロードマップ。「計画開始日」を起点に、stepDays刻みで計画上の予測体重を並べ、
// その時点の実績体重と差分、そして今日がどこにいるかを返す。
//
// 今日を起点に前へ伸ばすだけだと「計画全体の中で今どこにいるのか」が分からないため、
// 起点は必ず計画開始日にする。開始時体重は保存値(planSettings.weightStart)ではなく
// 実際の体重記録から取る想定(呼び出し側でfindWeightNearDateを使って渡す)。保存値は
// 開始日マイグレーションの際に更新されておらず、古い既定値のまま残っていることがある。
//
// 計画期間(totalDays)を過ぎている場合は、今日が表の外に出てしまわないよう
// 今日を含むところまで刻みを延長する。
// 戻り値: [{ days, date, label, planned, actual, diff, isNow, isMajor }]
function computePlanRoadmap(planStartDate, startWeight, dailyDeficit, weightLogs, todayStr, {
    stepDays = 14, totalDays = 90, actualMaxGapDays = 7, kcalPerKgPerDay = 0
} = {}) {
    const start = Number(startWeight);
    if (!planStartDate || !isFinite(start) || start <= 0) return [];
    if (isNaN(new Date(planStartDate + 'T00:00:00').getTime())) return [];

    const elapsed = computeDaysSince(planStartDate, todayStr);

    const offsets = [];
    for (let days = 0; days <= totalDays; days += stepDays) offsets.push(days);
    // 刻みで割り切れず終端が欠ける場合(例: 14日刻みで90日)、最終日を必ず含める
    if (offsets[offsets.length - 1] !== totalDays) offsets.push(totalDays);
    // 計画期間を過ぎていても現在位置が表に出るよう、今日を超えるまで刻みを足す
    while (offsets[offsets.length - 1] < elapsed) {
        offsets.push(offsets[offsets.length - 1] + stepDays);
    }
    // 今日がちょうど刻みに乗っていなければ、専用の行として差し込む
    if (!offsets.includes(elapsed)) {
        offsets.push(elapsed);
        offsets.sort((a, b) => a - b);
    }

    const labelFor = (days) => {
        if (days === elapsed) return '現在';
        if (days === 0) return '開始';
        if (days % 30 === 0) return `${days / 30}ヶ月`;
        if (days % 7 === 0) return `${days / 7}週`;
        return `${days}日`;
    };

    return offsets.map(days => {
        const date = addDaysToDateString(planStartDate, days);
        const planned = projectWeightAfterDays(start, dailyDeficit, days, kcalPerKgPerDay);
        // 未来の節目には実績が存在しないので、今日までの範囲だけ対応づける
        const log = days <= elapsed ? findWeightNearDate(weightLogs, date, actualMaxGapDays) : null;
        const actual = log ? log.weight : null;
        return {
            days,
            date,
            label: labelFor(days),
            planned,
            actual,
            // 差分は「実績 - 計画」。正なら計画より重い(遅れ)、負なら計画より軽い(先行)
            diff: actual === null ? null : Math.round((actual - planned) * 10) / 10,
            isNow: days === elapsed,
            // 開始・1ヶ月単位の節目・計画終端は強調表示する
            isMajor: days === 0 || days === totalDays || days % 30 === 0
        };
    });
}

// 摂取を今のまま続けた場合の、days日後の予測体重。
//
// 単純な線形外挿(体重 − 赤字×日数÷7700)は長期で楽観的に外れる。体重が減るとBMRも
// 有酸素消費(距離×体重)も下がるため、摂取が同じでも赤字は日々縮み、減量は減速して
// 「平衡体重」へ漸近するからである。
//
//   TDEE(W) = k·W + C          k = kcalPerKgPerDay (体重1kg減あたりのTDEE低下)
//   赤字(W)  = D₀ − k·(W₀ − W)
//   dW/dt   = −赤字/7700       ⇒  W(t) = W_eq + (W₀ − W_eq)·exp(−k·t/7700)
//   W_eq    = W₀ − D₀/k        (平衡体重)
//
// 体重80kg・PAL1.55・週15kmなら k ≈ 37.8 kcal/kg/日、時定数 7700/k ≈ 204日。
// 月2kgペース(赤字513kcal/日)を90日続けた場合、線形では−6.0kgだが実際は−4.9kgで、
// 3ヶ月で1.1kg(18%)の差になる。ロードマップの「計画より遅れている」判定に直結するため、
// ここを線形のままにしておくと、計画どおり進んでいるのに遅れて見える。
//
// kcalPerKgPerDay を省略(または0以下)した場合は従来どおりの線形外挿にフォールバックする。
function projectWeightAfterDays(latestWeight, dailyDeficit, days, kcalPerKgPerDay = 0) {
    const KCAL_PER_KG = 7700;
    const start = Number(latestWeight);
    const deficit = Number(dailyDeficit) || 0;
    const k = Number(kcalPerKgPerDay) || 0;
    if (!isFinite(start)) return NaN;

    if (k <= 0) {
        return Math.round((start - (deficit * days) / KCAL_PER_KG) * 10) / 10;
    }
    const equilibrium = start - deficit / k;
    const projected = equilibrium + (start - equilibrium) * Math.exp(-(k * days) / KCAL_PER_KG);
    return Math.round(projected * 10) / 10;
}

// 今の摂取を続けた場合に最終的に落ち着く体重(平衡体重)。
// 「3ヶ月後に何kg」よりも行動と結びつく指標で、DEFAULT_PLAN_SETTINGS.weightEquilibriumに
// 固定値(67.0kg)だけ残っていて誰も計算していなかったものを、実績から出し直すもの。
// 赤字が0以下(維持・増量方向)や k が求まらない場合はnullを返す。
function computeEquilibriumWeight(currentWeight, dailyDeficit, kcalPerKgPerDay) {
    const start = Number(currentWeight);
    const deficit = Number(dailyDeficit);
    const k = Number(kcalPerKgPerDay);
    if (!isFinite(start) || !isFinite(deficit) || !isFinite(k) || k <= 0) return null;
    if (deficit <= 0) return null;
    return Math.round((start - deficit / k) * 10) / 10;
}

// 現体重と平衡体重の差が半分まで縮むのにかかる日数(半減期)。
// 平衡体重は指数関数的な漸近なので「いつ到達するか」は答えが無く、代わりに提示する目安。
function computeHalfLifeDays(kcalPerKgPerDay) {
    const k = Number(kcalPerKgPerDay);
    if (!isFinite(k) || k <= 0) return null;
    return Math.round((7700 * Math.LN2) / k);
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

// 開始時体重修正マイグレーションの判定部(state.jsのrunOneTimeMigrationsから使う)。
// 2026-07の開始日修正マイグレーションはweightPlanStartDateだけを直し、weightStartは
// 手つかずだったため、開始時体重が既定値(81.0kg)のまま残っている環境がある。
// 開始日に最も近い実際の体重記録をweightStartとして採用し直す。
// 戻り値: { apply, weightStart, markDone }
// 体重ログがまだ無い/開始日が未設定の環境では markDone=false で次回起動に再判定させる。
function decidePlanStartWeightMigration(weightLogs, planSettings, maxGapDays = 7) {
    if (!Array.isArray(weightLogs) || weightLogs.length === 0 || !planSettings) {
        return { apply: false, weightStart: null, markDone: false };
    }
    const startDate = planSettings.weightPlanStartDate;
    if (!startDate) {
        return { apply: false, weightStart: null, markDone: false };
    }
    const log = findWeightNearDate(weightLogs, startDate, maxGapDays);
    if (!log) {
        // 開始日の近くに記録が無い。あとから記録が増える見込みも薄いので打ち切る
        return { apply: false, weightStart: null, markDone: true };
    }
    if (planSettings.weightStart === log.weight) {
        return { apply: false, weightStart: log.weight, markDone: true };
    }
    return { apply: true, weightStart: log.weight, markDone: true };
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
        filterValidDrinkingLogs,
        computeDrinkingWeightImpact,
        sumMealCalories,
        buildMealLogWithField,
        computeCalorieDiff,
        sortedByDateDesc,
        groupCardioLogsByMonth,
        getLatestWeightFromLogs,
        estimateWorkoutCalories,
        getWeekStartDate,
        sumCardioDistanceForWeek,
        computeMovingAverage,
        computeWeightTrendChange,
        computeExercisePRs,
        computeExerciseBests,
        computeDailyCalorieBalances,
        computeWeeklyTrainingVolume,
        computePlannedWeightForDate,
        computePlannedWeightSeries,
        computeDaysSince,
        computeRoadmapMilestones,
        computePlanRoadmap,
        findWeightNearDate,
        addDaysToDateString,
        decidePlanStartDateMigration,
        decidePlanStartWeightMigration,
        getFitnessDateString,
        computeActivityProfile,
        computeMeasuredTdee,
        computeIntakeTiersForPace,
        projectWeightAfterDays,
        computeEquilibriumWeight,
        computeHalfLifeDays,
        isStrictNumeric,
        renameExercisesInWorkouts
    };
}
