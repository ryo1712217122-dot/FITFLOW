// FITFLOW - DOM非依存ではないが、状態も持たない汎用ヘルパー関数群

// Helper to get local date string YYYY-MM-DD (Safe from timezone shifting offsets)
function getLocalDateString(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
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
