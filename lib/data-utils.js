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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        normalizeDate,
        normalizeTime,
        validateWorkoutsSchema,
        filterValidWeightLogs,
        filterValidCardioLogs,
        sortedByDateDesc,
        getLatestWeightFromLogs
    };
}
