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

        // Re-render active charts to adjust text color for theme
        if (state.charts.progression) renderProgressionChart();
        if (state.charts.weight) renderWeightChart();
        if (state.charts.calorieComparison) renderCalorieChart();
    };

    if (DOM.themeToggleBtn) {
        DOM.themeToggleBtn.addEventListener('click', handleThemeToggle);
    }
    if (DOM.mobileThemeToggleBtn) {
        DOM.mobileThemeToggleBtn.addEventListener('click', handleThemeToggle);
    }
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
    localStorage.setItem('fitflow_theme_id', themeId);
    applyThemePalette(themeId);

    // Re-render active charts to adjust colors dynamically
    if (state.charts.progression) renderProgressionChart();
    if (state.charts.weight) renderWeightChart();
    if (state.charts.calorieComparison) renderCalorieChart();

    showToast(`テーマを「${THEME_PALETTES[themeId].name}」に変更しました`);
}
