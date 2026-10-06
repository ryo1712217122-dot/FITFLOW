// FITFLOW - 定数・設定値
// 他のjs/*.jsファイルより先に読み込むこと。

const DEFAULT_MAINTENANCE_CALORIES = 2000;
const DEFAULT_WEIGHT_KG = 70.0;
const CARDIO_DAYS_WINDOW = 7;
// 体重推移グラフの移動平均・週間変化量サマリーで使う日数
const WEIGHT_TREND_WINDOW_DAYS = 7;
// トレーニングカレンダー(連続ヒートマップ)で表示する週数。右端が今週。
// 26週=約半年。月ごとのページ送りを廃止した代わりに、ここで見える範囲を決める
const CALENDAR_HEATMAP_WEEKS = 26;
// 総トレーニングボリューム週次推移グラフで表示する週数
const VOLUME_TREND_WEEKS = 8;
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

// 自重種目(重量の概念が無い種目)の判定。腹筋ローラーやプランクで毎回0kgを入力するのは
// 手間なだけでなく、空欄のままだと保存時のバリデーションに引っかかっていた。
// 種目名にこのキーワードを含む場合、重量欄を隠して重量0として保存する。
//
// ただし加重ディップスのように同じ名前でも重りを足す場合があるので、
// 「マシン/ケーブル/ダンベル/加重」等の語が入っていれば自重扱いにしない。
// それでも外したい場合は種目ブロックの「重量を入力する」から手動で戻せる。
const BODYWEIGHT_EXERCISE_KEYWORDS = [
    '腹筋ローラー', 'アブローラー', 'アブローラ', 'ローラー',
    'プランク', 'クランチ', 'シットアップ', '腕立て', 'プッシュアップ',
    'ディップス', 'レッグレイズ', 'ヒップリフト', 'バックエクステンション',
    'バーピー', 'マウンテンクライマー', '空気椅子', 'ウォールシット', '自重'
];

// 上のキーワードを含んでいても自重扱いにしない語(重りを足す器具・バリエーション)
const WEIGHTED_EXERCISE_MARKERS = [
    'マシン', 'ケーブル', 'ダンベル', 'バーベル', 'スミス',
    '加重', 'ウェイト', 'ウエイト', 'プレート'
];

function isBodyweightExercise(name) {
    const n = String(name || '').trim();
    if (!n) return false;
    if (WEIGHTED_EXERCISE_MARKERS.some(k => n.includes(k))) return false;
    return BODYWEIGHT_EXERCISE_KEYWORDS.some(k => n.includes(k));
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
    // 目標体重(kg)。null は未設定。今のペースで「いつ届くか」を計画タブと週のまとめに出す(v1.26.0)
    targetWeight: null,
    // 体格(v1.27.0)。揃っていれば基礎代謝を Ganpule の式で出す(lib/data-utils.js の computeBmr)。
    // bodySex は 1=男性 / 2=女性(式の係数の都合で数値)。null は未設定で、体重×23 に戻る
    bodySex: null,
    bodyHeightCm: null,
    bodyAge: null,
    // 減量の減速係数(kcal/kg/日)。表示には使わないが、計画を反映した時にシートへ書き出して、
    // 外部のブリーフィングがアプリと同じ係数で計画体重を出せるようにする
    kcalPerKgPerDay: null,
    // シミュレーションのTDEEをどちらから取るか: 'estimated'(推定式) / 'measured'(実測=食事記録と
    // 体重推移からの逆算)。'measured'選択中でもデータ不足時は推定式にフォールバックする
    tdeeSource: 'estimated',
    // sleepTarget以下の3つは防衛ラインUIの廃止後もクラウド同期ペイロードの互換のためキーだけ残す
    sleepTarget: 6.5,
    snackRule: '間食は「明治おいしいミルク紅茶 450ml」を週2回まで。他の日は完全無糖。夜22時以降の白米大盛り化を阻止し、普通盛りでストップすること。',
    workoutRule: 'ジム通いを週1回に圧縮し、余った時間を睡眠時間の補填（+1.5時間×2日）に回します。週1回全力（レッグプレス200kg等）で筋肉量は十分維持されます。'
};

// Sync Optimization Engine Flags (PayGuard inspired)
const DIRTY_KEY = 'fitflow_db_dirty';
