// FITFLOW - 定数・設定値
// 他のjs/*.jsファイルより先に読み込むこと。

const DEFAULT_MAINTENANCE_CALORIES = 2000;
const DEFAULT_WEIGHT_KG = 70.0;
const TARGET_MONTHLY_WORKOUTS = 12;
const MAX_RECENT_WEIGHT_LOGS = 10;
const CARDIO_DAYS_WINDOW = 7;
// 体重推移グラフの移動平均・週間変化量サマリーで使う日数
const WEIGHT_TREND_WINDOW_DAYS = 7;
// 総トレーニングボリューム週次推移グラフで表示する週数
const VOLUME_TREND_WEEKS = 8;
// タイトル・部位カテゴリーの入力欄はフォームから撤去したため、新規記録には固定のデフォルト値を使う
const DEFAULT_WORKOUT_CATEGORY = 'その他 (Other)';
// 筋トレの消費カロリー概算に使う「1セットあたりの目安kcal」。
// 休憩を含めた1セット平均2〜3分・resistance trainingの目安消費(約5〜8kcal/分)から逆算した簡易値。
// 有酸素の「距離×体重」と同様、種目や重量の違いを厳密には反映しない単純化モデル。
const WORKOUT_CALORIES_PER_SET = 15;

// 一回限りのデータ移行(migrations)の実行済みフラグに使うlocalStorageキーの接頭辞。
// 各移行は「接頭辞 + 移行名」のキーが立っていればスキップされる(冪等性の担保)。
const MIGRATION_FLAG_PREFIX = 'fitflow_migration_';

const DEFAULT_PLAN_SETTINGS = {
    intakeNormal: 1750,
    intakeMilkTea: 1966,
    intakeEvent: 2550,
    daysNormal: 3,
    daysMilkTea: 2,
    daysEvent: 2,
    baseBurn: 2450,
    runBurn: 338,
    runCount: 2,
    weeklyRunDistanceTarget: 15,
    weightStart: 81.0,
    weight1Month: 79.0,
    weight3Month: 75.5,
    weightEquilibrium: 67.0,
    // ロードマップ(weightStart等)がどの日付を起点とした予測なのか。
    // nullの場合は体重グラフの予測線を描画しない(いつからの計画か分からないため)。
    // 手動保存または「実績から再計算」のたびに、その時点の日付で更新される。
    weightPlanStartDate: null,
    sleepTarget: 6.5,
    snackRule: '間食は「明治おいしいミルク紅茶 450ml」を週2回まで。他の日は完全無糖。夜22時以降の白米大盛り化を阻止し、普通盛りでストップすること。',
    workoutRule: 'ジム通いを週1回に圧縮し、余った時間を睡眠時間の補填（+1.5時間×2日）に回します。週1回全力（レッグプレス200kg等）で筋肉量は十分維持されます。'
};

const THEME_PALETTES = {
    A: {
        name: 'フォレスト・セージ',
        dark: {
            '--bg-base': '#141f23',
            '--bg-surface': '#1e2d33',
            '--bg-surface-hover': '#273941',
            '--bg-sidebar': '#182429',
            '--color-primary': '#86ac41',
            '--color-secondary': '#7da3a1',
            '--border-focus': '#86ac41',
            '--text-primary': '#f0f4f3',
            '--text-secondary': '#a8c0be',
            '--text-muted': '#7da3a1',
            '--border-color': 'rgba(125, 163, 161, 0.15)',
            '--primary-gradient': 'linear-gradient(135deg, #86ac41 0%, #34675c 100%)',
            '--secondary-gradient': 'linear-gradient(135deg, #7da3a1 0%, #324851 100%)',
        },
        light: {
            '--bg-base': '#f4f8f6',
            '--bg-surface': '#ffffff',
            '--bg-surface-hover': '#e8f0eb',
            '--bg-sidebar': '#1e2d33',
            '--color-primary': '#34675c',
            '--color-secondary': '#7da3a1',
            '--border-focus': '#34675c',
            '--text-primary': '#1f2d33',
            '--text-secondary': '#4e656d',
            '--text-muted': '#7da3a1',
            '--border-color': 'rgba(50, 72, 81, 0.08)',
            '--primary-gradient': 'linear-gradient(135deg, #34675c 0%, #1e2d33 100%)',
            '--secondary-gradient': 'linear-gradient(135deg, #7da3a1 0%, #34675c 100%)',
        }
    },
    B: {
        name: 'ディープ・オーシャン',
        dark: {
            '--bg-base': '#0a1128',
            '--bg-surface': '#101f42',
            '--bg-surface-hover': '#1a2e5c',
            '--bg-sidebar': '#0c1530',
            '--color-primary': '#00a8ff',
            '--color-secondary': '#00dec7',
            '--border-focus': '#00a8ff',
            '--text-primary': '#ffffff',
            '--text-secondary': '#a0c4ff',
            '--text-muted': '#00dec7',
            '--border-color': 'rgba(0, 168, 255, 0.15)',
            '--primary-gradient': 'linear-gradient(135deg, #00a8ff 0%, #0097e6 100%)',
            '--secondary-gradient': 'linear-gradient(135deg, #00dec7 0%, #00a8ff 100%)',
        },
        light: {
            '--bg-base': '#f0f4f8',
            '--bg-surface': '#ffffff',
            '--bg-surface-hover': '#e1ecf7',
            '--bg-sidebar': '#101f42',
            '--color-primary': '#0066cc',
            '--color-secondary': '#0097e6',
            '--border-focus': '#0066cc',
            '--text-primary': '#0a1128',
            '--text-secondary': '#3a506b',
            '--text-muted': '#0097e6',
            '--border-color': 'rgba(0, 102, 204, 0.08)',
            '--primary-gradient': 'linear-gradient(135deg, #0066cc 0%, #0a1128 100%)',
            '--secondary-gradient': 'linear-gradient(135deg, #0097e6 0%, #0066cc 100%)',
        }
    },
    C: {
        name: 'クリムゾン・サンセット',
        dark: {
            '--bg-base': '#1c1212',
            '--bg-surface': '#2b1a1a',
            '--bg-surface-hover': '#3a2525',
            '--bg-sidebar': '#221515',
            '--color-primary': '#e05a47',
            '--color-secondary': '#d9a05b',
            '--border-focus': '#e05a47',
            '--text-primary': '#fcebeb',
            '--text-secondary': '#e9c46a',
            '--text-muted': '#d9a05b',
            '--border-color': 'rgba(224, 90, 71, 0.15)',
            '--primary-gradient': 'linear-gradient(135deg, #e05a47 0%, #b83b28 100%)',
            '--secondary-gradient': 'linear-gradient(135deg, #d9a05b 0%, #e05a47 100%)',
        },
        light: {
            '--bg-base': '#faf6f5',
            '--bg-surface': '#ffffff',
            '--bg-surface-hover': '#f7e1dd',
            '--bg-sidebar': '#2b1a1a',
            '--color-primary': '#b83b28',
            '--color-secondary': '#d9a05b',
            '--border-focus': '#b83b28',
            '--text-primary': '#2b1a1a',
            '--text-secondary': '#7c4d3a',
            '--text-muted': '#d9a05b',
            '--border-color': 'rgba(184, 59, 40, 0.08)',
            '--primary-gradient': 'linear-gradient(135deg, #b83b28 0%, #2b1a1a 100%)',
            '--secondary-gradient': 'linear-gradient(135deg, #d9a05b 0%, #b83b28 100%)',
        }
    },
    D: {
        name: 'ロイヤル・アメジスト',
        dark: {
            '--bg-base': '#13111c',
            '--bg-surface': '#201c2e',
            '--bg-surface-hover': '#2d2741',
            '--bg-sidebar': '#191624',
            '--color-primary': '#9b5de5',
            '--color-secondary': '#f15bb5',
            '--border-focus': '#9b5de5',
            '--text-primary': '#f6f0ff',
            '--text-secondary': '#d8b4fe',
            '--text-muted': '#f15bb5',
            '--border-color': 'rgba(155, 93, 229, 0.15)',
            '--primary-gradient': 'linear-gradient(135deg, #9b5de5 0%, #7209b7 100%)',
            '--secondary-gradient': 'linear-gradient(135deg, #f15bb5 0%, #9b5de5 100%)',
        },
        light: {
            '--bg-base': '#f8f6fa',
            '--bg-surface': '#ffffff',
            '--bg-surface-hover': '#f0e6f7',
            '--bg-sidebar': '#201c2e',
            '--color-primary': '#7209b7',
            '--color-secondary': '#9b5de5',
            '--border-focus': '#7209b7',
            '--text-primary': '#201c2e',
            '--text-secondary': '#5d3a77',
            '--text-muted': '#9b5de5',
            '--border-color': 'rgba(114, 9, 183, 0.08)',
            '--primary-gradient': 'linear-gradient(135deg, #7209b7 0%, #201c2e 100%)',
            '--secondary-gradient': 'linear-gradient(135deg, #9b5de5 0%, #7209b7 100%)',
        }
    }
};

// Sync Optimization Engine Flags (PayGuard inspired)
const DIRTY_KEY = 'fitflow_db_dirty';
