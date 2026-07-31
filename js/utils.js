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

function formatDateJp(dateStr) {
    if (!dateStr) return '日付未設定';
    try {
        const date = new Date(dateStr + 'T00:00:00');
        if (isNaN(date.getTime())) return dateStr;
        const days = ['日', '月', '火', '水', '木', '金', '土'];
        return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 (${days[date.getDay()]})`;
    } catch (e) {
        return dateStr;
    }
}

// Chart.js helper colors
function getChartThemeColors() {
    const isLight = document.body.classList.contains('light-theme');
    return {
        text: isLight ? '#475569' : '#a8c0be',
        grid: isLight ? 'rgba(50, 72, 81, 0.05)' : 'rgba(125, 163, 161, 0.1)',
        border: isLight ? 'rgba(50, 72, 81, 0.08)' : 'rgba(125, 163, 161, 0.15)',
        surface: isLight ? '#ffffff' : '#1e2d33'
    };
}

function hexToRgba(hex, alpha) {
    if (!hex) return `rgba(134, 172, 65, ${alpha})`;
    hex = hex.trim().replace('#', '');
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const r = parseInt(hex.substring(0, 2), 16) || 134;
    const g = parseInt(hex.substring(2, 4), 16) || 172;
    const b = parseInt(hex.substring(4, 6), 16) || 65;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
