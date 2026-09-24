// FITFLOW - ダーク/ライト切り替え + カラーパレット(A/B/C/D)

function initTheme() {
    const savedTheme = localStorage.getItem('fitflow_theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
    }

    // Load and apply the saved color palette theme (A, B, C, D)
    const activePalette = localStorage.getItem('fitflow_theme_id') || 'A';
    applyThemePalette(activePalette);

    const handleThemeToggle = () => {
        document.body.classList.toggle('light-theme');
        const theme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
        localStorage.setItem('fitflow_theme', theme);

        // Re-apply palette for the new dark/light state
        const currentPalette = localStorage.getItem('fitflow_theme_id') || 'A';
        applyThemePalette(currentPalette);

        rerenderChartsForTheme();
    };

    if (DOM.themeToggleBtn) {
        DOM.themeToggleBtn.addEventListener('click', handleThemeToggle);
    }
    if (DOM.mobileThemeToggleBtn) {
        DOM.mobileThemeToggleBtn.addEventListener('click', handleThemeToggle);
    }
}

// 描画済みのグラフをテーマの文字色・パレットに合わせて描き直す。
// ダーク/ライト切替とパレット変更の両方から呼ぶ。
// 以前は呼び出し側それぞれに3つのチャートを並べており、あとから追加した
// 総ボリューム推移グラフ(volumeTrend)だけ書き漏れて、テーマを変えても
// 軸ラベルが前のテーマの色のまま残っていた。
function rerenderChartsForTheme() {
    if (state.charts.progression) renderProgressionChart();
    if (state.charts.weight) renderWeightChart();
    if (state.charts.calorieComparison) renderCalorieChart();
    if (state.charts.volumeTrend) renderVolumeTrendChart();
}

function applyThemePalette(themeId) {
    const isLight = document.body.classList.contains('light-theme');
    const palette = THEME_PALETTES[themeId] || THEME_PALETTES.A;
    const variables = isLight ? palette.light : palette.dark;

    for (const [prop, val] of Object.entries(variables)) {
        document.documentElement.style.setProperty(prop, val);
    }

    // Update active state class on settings theme selection buttons
    document.querySelectorAll('.theme-select-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById('theme-btn-' + themeId);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

function setThemePalette(themeId) {
    // applyThemePaletteと同じく未知のIDはAにフォールバックする
    // (ここだけ素引きしていると THEME_PALETTES[themeId].name でTypeErrorになる)
    const palette = THEME_PALETTES[themeId] || THEME_PALETTES.A;

    localStorage.setItem('fitflow_theme_id', themeId);
    applyThemePalette(themeId);

    rerenderChartsForTheme();

    showToast(`テーマを「${palette.name}」に変更しました`);
}
