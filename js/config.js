// FITFLOW - 定数・設定値
// 他のjs/*.jsファイルより先に読み込むこと。

const DEFAULT_MAINTENANCE_CALORIES = 2000;
const DEFAULT_WEIGHT_KG = 70.0;
const CARDIO_DAYS_WINDOW = 7;
// 体重推移グラフの移動平均・週間変化量サマリーで使う日数
const WEIGHT_TREND_WINDOW_DAYS = 7;
// 総トレーニングボリューム週次推移グラフで表示する週数
const VOLUME_TREND_WEEKS = 8;
// 睡眠のサマリー(平均睡眠時間・就寝時刻のばらつき)を出す期間
const SLEEP_TREND_WINDOW_DAYS = 7;
// タイトル・部位カテゴリーの入力欄はフォームから撤去したため、新規記録には固定のデフォルト値を使う
const DEFAULT_WORKOUT_CATEGORY = 'その他 (Other)';
// 筋トレの消費カロリー概算に使う「1セットあたりの目安kcal」。
// 休憩を含めた1セット平均2〜3分・resistance trainingの目安消費(約5〜8kcal/分)から逆算した簡易値。
// 有酸素の「距離×体重」と同様、種目や重量の違いを厳密には反映しない単純化モデル。
const WORKOUT_CALORIES_PER_SET = 15;

// 基礎代謝の推定に使う「体重1kgあたりの基礎代謝(kcal/kg/日)」。
// 日本人の基礎代謝基準値(男性18-29歳=23.7、30-49歳=22.5)の中央付近を取った簡易値。
const BMR_KCAL_PER_KG = 23;

// 生活活動レベル(PAL)。**運動(筋トレ・有酸素)を含まない**日常生活の活動量で、
// 運動分はcardioLogs/workoutsの実績から別途加算する(lib/data-utils.jsのcomputeActivityProfile)。
// v1.21.0以前はこれを筋トレ頻度から自動決定しており、運動消費の二重計上になっていた。
//
// 歩数の目安は「歩行の正味コスト ≒ 0.5 kcal/kg/km・歩幅70cm」から換算している。
// 体重80kgなら1日1万歩(約7km)は約280kcal/日で、ほとんど歩かない生活との差は約180kcal、
// PAL換算でおよそ +0.10〜0.15 に相当する。
const LIFESTYLE_ACTIVITY_LEVELS = [
    { value: 1.35, label: 'ほとんど外出しない', hint: '〜3,000歩' },
    { value: 1.45, label: '座位中心・移動少なめ', hint: '3,000〜7,000歩' },
    { value: 1.55, label: '通学・通勤でよく歩く', hint: '7,000〜12,000歩' },
    { value: 1.70, label: '立ち仕事・非常によく歩く', hint: '12,000歩〜' }
];

// 選択中の生活活動レベルの表示名を返す。一致する選択肢が無ければ最も近いものの名前を使う。
function getLifestyleLevelLabel(pal) {
    const v = Number(pal);
    const exact = LIFESTYLE_ACTIVITY_LEVELS.find(l => l.value === v);
    if (exact) return exact.label;
    return LIFESTYLE_ACTIVITY_LEVELS.reduce((best, l) =>
        Math.abs(l.value - v) < Math.abs(best.value - v) ? l : best,
        LIFESTYLE_ACTIVITY_LEVELS[0]).label;
}

// 「記録する」タブで進行中の筋トレセッションのID。
// トレーニングは1種目ずつ保存していくため、途中でアプリを閉じることが普通にある。
// メモリ上のstate.editingWorkoutIdだけだとリロードで開いているセッションを見失い、
// 続きを記録するには履歴から編集し直す必要があった(そうしないと同じ日のセッションが
// 2件に割れる)。ここに保存して、開き直しても同じセッションへ追記できるようにする。
const OPEN_WORKOUT_KEY = 'fitflow_open_workout_id';

// 一回限りのデータ移行(migrations)の実行済みフラグに使うlocalStorageキーの接頭辞。
// 各移行は「接頭辞 + 移行名」のキーが立っていればスキップされる(冪等性の担保)。
const MIGRATION_FLAG_PREFIX = 'fitflow_migration_';

// 減量シミュレーションの設定値。
// 「少し甘えた日」「イベント日」は通常日に対する上乗せ幅(kcal)を固定し、
// 週平均が目標摂取カロリーに一致するように通常日を逆算する(lib/data-utils.jsの
// computeIntakeTiersForPace)。ペースの選択肢はkg/月。
const SIM_INTAKE_DELTA_SWEET = 200;
const SIM_INTAKE_DELTA_EVENT = 800;
const SIM_PACE_OPTIONS = [0.5, 1, 2, 3];

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
    // 運動を除いた生活活動レベル(LIFESTYLE_ACTIVITY_LEVELSのvalue)。
    // 既存ユーザーもloadData()のマージでこの既定値が入る。
    lifestyleActivityLevel: 1.55,
    // ロードマップ(weightStart等)がどの日付を起点とした予測なのか。
    // nullの場合は体重グラフの予測線を描画しない(いつからの計画か分からないため)。
    // 未設定の場合のみ初回保存時の日付が入り、以降は編集フォームの「計画開始日」で
    // 明示的に変更しない限り固定される(保存・再計算のたびに今日へ動いてしまうと、
    // 予測線の起点と実際の計画開始がズレるため)。
    weightPlanStartDate: null,
    // シミュレーションで選択中の減量ペース(kg/月)。SIM_PACE_OPTIONSのいずれか
    targetPaceKgMonth: 2,
    // シミュレーションのTDEEをどちらから取るか: 'estimated'(推定式) / 'measured'(実測=食事記録と
    // 体重推移からの逆算)。'measured'選択中でもデータ不足時は推定式にフォールバックする
    tdeeSource: 'estimated',
    // sleepTarget以下の3つは防衛ラインUIの廃止後もクラウド同期ペイロードの互換のためキーだけ残す
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
            // --bg-surface(カード面)は白を維持しつつ、--bg-base(ページ背景)は
            // 各パレットの色相がはっきり分かるティントに濃くしている(パレット切替を体感できるように)。
            '--bg-base': '#e3ede6',
            '--bg-surface': '#ffffff',
            '--bg-surface-hover': '#d3e3d9',
            '--bg-sidebar': '#1e2d33',
            '--color-primary': '#34675c',
            '--color-secondary': '#7da3a1',
            '--border-focus': '#34675c',
            '--text-primary': '#1f2d33',
            '--text-secondary': '#4e656d',
            // --text-mutedはパレット色を薄く濃くした背景でも3:1以上を保つよう、従来より暗くしている。
            '--text-muted': '#5a807d',
            // カード輪郭にパレット色(primary相当)を出すため、alphaを0.08→0.22に引き上げ。
            '--border-color': 'rgba(52, 103, 92, 0.22)',
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
            '--bg-base': '#dce8f4',
            '--bg-surface': '#ffffff',
            '--bg-surface-hover': '#c9ddf0',
            '--bg-sidebar': '#101f42',
            '--color-primary': '#0066cc',
            '--color-secondary': '#0097e6',
            '--border-focus': '#0066cc',
            '--text-primary': '#0a1128',
            '--text-secondary': '#3a506b',
            '--text-muted': '#2f7fb5',
            '--border-color': 'rgba(0, 102, 204, 0.22)',
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
            '--bg-base': '#f6e3db',
            '--bg-surface': '#ffffff',
            '--bg-surface-hover': '#f2d3c7',
            '--bg-sidebar': '#2b1a1a',
            '--color-primary': '#b83b28',
            '--color-secondary': '#d9a05b',
            '--border-focus': '#b83b28',
            '--text-primary': '#2b1a1a',
            '--text-secondary': '#7c4d3a',
            '--text-muted': '#a9762f',
            '--border-color': 'rgba(184, 59, 40, 0.22)',
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
            '--bg-base': '#ece0f3',
            '--bg-surface': '#ffffff',
            '--bg-surface-hover': '#e0cded',
            '--bg-sidebar': '#201c2e',
            '--color-primary': '#7209b7',
            '--color-secondary': '#9b5de5',
            '--border-focus': '#7209b7',
            '--text-primary': '#201c2e',
            '--text-secondary': '#5d3a77',
            '--text-muted': '#8248c0',
            '--border-color': 'rgba(114, 9, 183, 0.22)',
            '--primary-gradient': 'linear-gradient(135deg, #7209b7 0%, #201c2e 100%)',
            '--secondary-gradient': 'linear-gradient(135deg, #9b5de5 0%, #7209b7 100%)',
        }
    }
};

// Sync Optimization Engine Flags (PayGuard inspired)
const DIRTY_KEY = 'fitflow_db_dirty';
