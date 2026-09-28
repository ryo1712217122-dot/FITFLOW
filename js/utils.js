// FITFLOW - DOM非依存ではないが、状態も持たない汎用ヘルパー関数群

// Helper to get local date string YYYY-MM-DD (Safe from timezone shifting offsets)
function getLocalDateString(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// 「フィットネス上の今日」を返す(AM3時までは前日扱い)。アプリ内で今日を指す箇所は
// 記録フォームのデフォルト日付も表示・集計もすべてこれに揃える。
// 以前はフォームだけがgetFitnessDateStringで、ダッシュボードや計画タブはgetLocalDateStringを
// 使っていたため、深夜1時に開くとフォームは前日・ダッシュボードは当日を指してズレていた。
function getTodayStr() {
    return getFitnessDateString();
}

// 実績から活動プロフィール(BMR・PAL・ベース消費・運動消費・TDEE)を求める共通入口。
// 生活活動レベルと1セットあたりkcalという設定値の受け渡しを1か所にまとめ、
// ダッシュボードと計画タブが必ず同じ前提で計算するようにする。
function getActivityProfile(latestWeight, todayStr) {
    const s = state.planSettings || DEFAULT_PLAN_SETTINGS;
    return computeActivityProfile(
        latestWeight, state.workouts, state.cardioLogs, todayStr || getTodayStr(),
        {
            lifestylePal: s.lifestyleActivityLevel || DEFAULT_PLAN_SETTINGS.lifestyleActivityLevel,
            caloriesPerSet: WORKOUT_CALORIES_PER_SET,
            bmrPerKg: BMR_KCAL_PER_KG
        }
    );
}

// Escape free-text user input before inserting it via innerHTML
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// index.html の #popular-exercises datalist をよく使う種目リストの唯一の情報源として再利用する
function getPopularExerciseNames() {
    const datalist = document.getElementById('popular-exercises');
    if (!datalist) return [];
    return Array.from(datalist.options).map(opt => opt.value);
}

// 日付文字列を「2026年9月3日 (水)」形式にする。
//
// パースできない値はそのまま返すが、その戻り値は履歴カード・計画タブなど
// innerHTML に差し込まれる場所で使われる。dateStr はクラウド(スプレッドシート)や
// JSONインポート由来で任意の文字列になりうるため、素通しさせるとHTMLを注入できる。
// 正常にパースできた場合の戻り値は組み立て済みの数字なので、
// エスケープが要るのはこのフォールバック経路だけ。
function formatDateJp(dateStr) {
    if (!dateStr) return '日付未設定';
    try {
        const date = new Date(dateStr + 'T00:00:00');
        if (isNaN(date.getTime())) return escapeHtml(dateStr);
        const days = ['日', '月', '火', '水', '木', '金', '土'];
        return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 (${days[date.getDay()]})`;
    } catch (e) {
        return escapeHtml(dateStr);
    }
}

// Chart.js の軸・目盛り・凡例の色。v1.25.0でDADSのライト配色に一本化したので固定値。
// 文字は補足色(gray-700)、目盛り線は区切り線より薄い gray-100(装飾なのでコントラスト基準の対象外)。
function getChartThemeColors() {
    return {
        text: '#4d4d4d',   // gray-700
        grid: '#e6e6e6',   // gray-100
        border: '#cccccc', // gray-200
        surface: '#ffffff'
    };
}

// グラフの文字はDADSの書体・最小サイズ(14px)に揃える。個々のグラフで font を
// 指定し直すと既定値が効かないので、各グラフ側はサイズを書かずにこの既定に任せる。
function applyChartDefaults() {
    if (!window.Chart) return;
    Chart.defaults.font.family = "'Noto Sans JP', -apple-system, BlinkMacSystemFont, sans-serif";
    Chart.defaults.font.size = 14;
    Chart.defaults.color = getChartThemeColors().text;
}

function hexToRgba(hex, alpha) {
    const FALLBACK = [0, 23, 193]; // DADSのキーカラー blue-900 (#0017c1)
    if (!hex) return `rgba(${FALLBACK.join(', ')}, ${alpha})`;
    hex = hex.trim().replace('#', '');
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    // 各チャンネルの既定値へのフォールバックは「パースできなかった時」だけに限る。
    // `parseInt(...) || 既定値` だと 00 が falsy として既定値に化けるため、
    // #00a8ff(ディープオーシャンのプライマリ)のRが0ではなく134になっていた。
    const channel = (start, fallback) => {
        const v = parseInt(hex.substring(start, start + 2), 16);
        return Number.isNaN(v) ? fallback : v;
    };
    const r = channel(0, FALLBACK[0]);
    const g = channel(2, FALLBACK[1]);
    const b = channel(4, FALLBACK[2]);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
