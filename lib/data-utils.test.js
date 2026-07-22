const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
    normalizeDate,
    normalizeTime,
    validateWorkoutsSchema,
    filterValidWeightLogs,
    filterValidCardioLogs,
    filterValidMealLogs,
    sumMealCalories,
    computeCalorieDiff,
    sortedByDateDesc,
    getLatestWeightFromLogs,
    estimateWorkoutCalories,
    getWeekStartDate,
    sumCardioDistanceForWeek,
    computeMovingAverage,
    computeWeightChangeOverDays,
    computeExercisePRs,
    computeWeeklyTrainingVolume,
    computePlannedWeightForDate,
    computePlannedWeightSeries,
    computePlanCalorieAverages,
    computeDaysSince,
    computeRoadmapMilestones,
    decidePlanStartDateMigration,
    getFitnessDateString,
    computeActivityProfile,
    computeIntakeTiersForPace,
    projectWeightAfterDays,
    isStrictNumeric,
    renameExercisesInWorkouts
} = require('./data-utils.js');

// normalizeDate/normalizeTimeはローカルタイムゾーンでY/M/Dを取り出すため、
// テストも「同じDateオブジェクトから同じ方法で計算した期待値」と比較する
// (実行環境のTZに依存させないため、JSTなどを決め打ちしない)
function expectedYmd(isoUtcString) {
    const d = new Date(isoUtcString);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function expectedHm(isoUtcString) {
    const d = new Date(isoUtcString);
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${min}`;
}

describe('normalizeDate', () => {
    test('空文字/null/undefinedは空文字を返す', () => {
        assert.equal(normalizeDate(''), '');
        assert.equal(normalizeDate(null), '');
        assert.equal(normalizeDate(undefined), '');
    });

    test('区切り文字を含まない文字列はそのまま返す', () => {
        assert.equal(normalizeDate('hello'), 'hello');
    });

    test('すでにYYYY-MM-DD形式ならそのまま返す', () => {
        assert.equal(normalizeDate('2026-07-07'), '2026-07-07');
    });

    test('ISO UTC日時文字列をローカルタイムゾーンのYYYY-MM-DDへ変換する', () => {
        const iso = '2026-07-06T15:00:00.000Z';
        assert.equal(normalizeDate(iso), expectedYmd(iso));
    });

    test('区切り文字はあるが解析不能な文字列は元の文字列をそのまま返す', () => {
        assert.equal(normalizeDate('not-a-real-date'), 'not-a-real-date');
    });
});

describe('normalizeTime', () => {
    test('空文字/null/undefinedは空文字を返す', () => {
        assert.equal(normalizeTime(''), '');
        assert.equal(normalizeTime(null), '');
    });

    test('Tを含まない文字列はそのまま返す', () => {
        assert.equal(normalizeTime('19:30'), '19:30');
    });

    test('ISO日時文字列をローカルタイムゾーンのHH:MMへ変換する', () => {
        const iso = '1899-12-30T14:30:00.000Z';
        assert.equal(normalizeTime(iso), expectedHm(iso));
    });
});

describe('validateWorkoutsSchema', () => {
    const validWorkout = {
        id: 'workout-1',
        date: '2026-07-06',
        title: 'ジムでのトレーニング',
        category: 'その他 (Other)',
        mood: 'fire',
        impression: '',
        exercises: [
            { name: 'ベンチプレス', sets: [{ weight: 60, reps: 10 }] }
        ]
    };

    test('正しい形のワークアウト配列はtrue', () => {
        assert.equal(validateWorkoutsSchema([validWorkout]), true);
    });

    test('配列でなければfalse', () => {
        assert.equal(validateWorkoutsSchema({}), false);
        assert.equal(validateWorkoutsSchema(null), false);
    });

    test('必須フィールドが欠けているとfalse', () => {
        const { id, ...missingId } = validWorkout;
        assert.equal(validateWorkoutsSchema([missingId]), false);
    });

    test('種目名が空文字だとfalse', () => {
        const bad = { ...validWorkout, exercises: [{ name: '', sets: [{ weight: 60, reps: 10 }] }] };
        assert.equal(validateWorkoutsSchema([bad]), false);
    });

    test('セットの重量が数値でないとfalse', () => {
        const bad = { ...validWorkout, exercises: [{ name: 'ベンチプレス', sets: [{ weight: 'abc', reps: 10 }] }] };
        assert.equal(validateWorkoutsSchema([bad]), false);
    });
});

describe('filterValidWeightLogs', () => {
    test('配列でなければ空配列を返す', () => {
        assert.deepEqual(filterValidWeightLogs(null), []);
    });

    test('不正な行だけを取り除き、有効な行は残す', () => {
        const input = [
            { date: '2026-07-01', weight: 70.5 },
            { date: '2026-07-02', weight: 0 },        // 0kg以下は不正
            { date: '', weight: 70 },                  // 日付なしは不正
            { date: '2026-07-03', weight: 'abc' },      // 数値でないので不正
            { date: '2026-07-04', weight: 71.2 }
        ];
        const result = filterValidWeightLogs(input);
        assert.deepEqual(result, [
            { date: '2026-07-01', weight: 70.5 },
            { date: '2026-07-04', weight: 71.2 }
        ]);
    });
});

describe('filterValidCardioLogs', () => {
    test('距離0以下・カロリー未満・日付欠落の行を取り除く', () => {
        const input = [
            { date: '2026-07-01', distance: 4, calories: 300 },
            { date: '2026-07-02', distance: 0, calories: 0 },     // 距離0は不正
            { date: '2026-07-03', distance: 5, calories: -10 },   // カロリー負は不正
            { date: '', distance: 5, calories: 300 }              // 日付なしは不正
        ];
        const result = filterValidCardioLogs(input);
        assert.deepEqual(result, [
            { date: '2026-07-01', distance: 4, calories: 300 }
        ]);
    });
});

describe('filterValidMealLogs', () => {
    test('4項目のいずれかが欠落・負値・日付欠落の行を取り除く', () => {
        const input = [
            { date: '2026-07-01', breakfast: 400, lunch: 600, dinner: 700, snacks: 100 },
            { date: '2026-07-02', breakfast: -1, lunch: 600, dinner: 700, snacks: 100 }, // 負は不正
            { date: '2026-07-03', breakfast: 400, lunch: 600, dinner: 700 },             // snacks欠落は不正
            { date: '', breakfast: 400, lunch: 600, dinner: 700, snacks: 100 }           // 日付なしは不正
        ];
        const result = filterValidMealLogs(input);
        assert.deepEqual(result, [
            { date: '2026-07-01', breakfast: 400, lunch: 600, dinner: 700, snacks: 100 }
        ]);
    });

    test('配列でない入力は空配列を返す', () => {
        assert.deepEqual(filterValidMealLogs(null), []);
    });
});

describe('sumMealCalories', () => {
    test('朝食/昼食/夕食/間食の合計を返す', () => {
        assert.equal(sumMealCalories({ date: '2026-07-01', breakfast: 400, lunch: 600, dinner: 700, snacks: 150 }), 1850);
    });

    test('エントリが無ければ0を返す', () => {
        assert.equal(sumMealCalories(null), 0);
    });

    test('欠損フィールドは0として扱う', () => {
        assert.equal(sumMealCalories({ date: '2026-07-01', breakfast: 400 }), 400);
    });
});

describe('computeCalorieDiff', () => {
    test('消費が摂取を上回る場合は正(カロリー不足=減量方向)', () => {
        assert.equal(computeCalorieDiff(1800, 2200), 400);
    });

    test('摂取が消費を上回る場合は負(カロリー超過=増量方向)', () => {
        assert.equal(computeCalorieDiff(2500, 2200), -300);
    });
});

describe('sortedByDateDesc', () => {
    test('新しい日付順のコピーを返し、元の配列は変更しない', () => {
        const original = [
            { date: '2026-07-01', weight: 70 },
            { date: '2026-07-03', weight: 71 },
            { date: '2026-07-02', weight: 72 }
        ];
        const originalCopy = original.map(x => ({ ...x }));
        const result = sortedByDateDesc(original);

        assert.deepEqual(result.map(r => r.date), ['2026-07-03', '2026-07-02', '2026-07-01']);
        // 元の配列の並び順が変わっていないことを確認（インプレース破壊のリグレッション防止）
        assert.deepEqual(original, originalCopy);
    });

    test('配列でない入力は空配列を返す', () => {
        assert.deepEqual(sortedByDateDesc(null), []);
    });
});

describe('getLatestWeightFromLogs', () => {
    test('空配列の場合はデフォルト値を返す', () => {
        assert.equal(getLatestWeightFromLogs([], 70), 70);
    });

    test('昇順ソート済み配列の末尾（最新）を返す', () => {
        const logs = [
            { date: '2026-07-01', weight: 73.2 },
            { date: '2026-07-02', weight: 72.8 }
        ];
        assert.equal(getLatestWeightFromLogs(logs, 70), 72.8);
    });
});

describe('estimateWorkoutCalories', () => {
    test('配列でなければ0を返す', () => {
        assert.equal(estimateWorkoutCalories(null, 15), 0);
    });

    test('種目が空配列なら0を返す', () => {
        assert.equal(estimateWorkoutCalories([], 15), 0);
    });

    test('合計セット数 × 1セットあたりkcal を返す', () => {
        const exercises = [
            { name: 'ベンチプレス', sets: [{ weight: 60, reps: 10 }, { weight: 60, reps: 8 }] },
            { name: 'スクワット', sets: [{ weight: 80, reps: 10 }] }
        ];
        // 合計3セット × 15kcal = 45kcal
        assert.equal(estimateWorkoutCalories(exercises, 15), 45);
    });

    test('setsが配列でない種目は0セットとして扱う', () => {
        const exercises = [{ name: '不正データ', sets: null }, { name: 'OK', sets: [{ weight: 1, reps: 1 }] }];
        assert.equal(estimateWorkoutCalories(exercises, 10), 10);
    });
});

// 2023-01-01は日曜日(既知の基準日)。この週は 2023-01-01(日)〜2023-01-07(土)。
describe('getWeekStartDate', () => {
    test('週の途中の日付から日曜始まりの週開始日を返す', () => {
        assert.equal(getWeekStartDate('2023-01-04'), '2023-01-01'); // 水曜
        assert.equal(getWeekStartDate('2023-01-07'), '2023-01-01'); // 土曜(週末)
    });

    test('日曜日自身を渡すとその日をそのまま返す', () => {
        assert.equal(getWeekStartDate('2023-01-08'), '2023-01-08');
    });

    test('不正な日付は空文字を返す', () => {
        assert.equal(getWeekStartDate(''), '');
        assert.equal(getWeekStartDate('not-a-date'), '');
    });
});

describe('sumCardioDistanceForWeek', () => {
    const cardioLogs = [
        { date: '2022-12-31', distance: 100 }, // 前の週(土曜) - 含めない
        { date: '2023-01-01', distance: 5 },   // 週の開始(日曜)
        { date: '2023-01-04', distance: 3 },   // 週の途中
        { date: '2023-01-07', distance: 2 },   // 週の最終日(土曜)
        { date: '2023-01-08', distance: 100 }  // 次の週(日曜) - 含めない
    ];

    test('週開始日から7日間の走行距離を合算する', () => {
        assert.equal(sumCardioDistanceForWeek(cardioLogs, '2023-01-01'), 10);
    });

    test('配列でない・週開始日が無い場合は0を返す', () => {
        assert.equal(sumCardioDistanceForWeek(null, '2023-01-01'), 0);
        assert.equal(sumCardioDistanceForWeek(cardioLogs, ''), 0);
    });
});

describe('computeMovingAverage', () => {
    test('windowSize件溜まるまでは、その時点までの件数で平均する', () => {
        const logs = [
            { date: '2023-01-01', weight: 70 },
            { date: '2023-01-02', weight: 72 },
            { date: '2023-01-03', weight: 74 }
        ];
        const result = computeMovingAverage(logs, 7);
        assert.deepEqual(result, [
            { date: '2023-01-01', average: 70 },
            { date: '2023-01-02', average: 71 },
            { date: '2023-01-03', average: 72 }
        ]);
    });

    test('windowSize件を超えると直近windowSize件だけの平均になる', () => {
        const logs = [
            { date: '2023-01-01', weight: 100 }, // このwindowには含まれない
            { date: '2023-01-02', weight: 10 },
            { date: '2023-01-03', weight: 20 },
            { date: '2023-01-04', weight: 30 }
        ];
        const result = computeMovingAverage(logs, 3);
        assert.equal(result[3].average, 20); // (10+20+30)/3
    });

    test('配列でない入力は空配列を返す', () => {
        assert.deepEqual(computeMovingAverage(null, 7), []);
    });
});

describe('computeWeightChangeOverDays', () => {
    test('ちょうどdays日前のログがあればそれとの差分を返す', () => {
        const logs = [
            { date: '2023-01-01', weight: 71.0 },
            { date: '2023-01-08', weight: 70.2 }
        ];
        assert.equal(computeWeightChangeOverDays(logs, 7), -0.8);
    });

    test('ちょうどdays日前のログが無ければ、目標日に最も近いログを使う', () => {
        const logs = [
            { date: '2023-01-02', weight: 71.0 }, // 目標日(01-03)との差: 1日 → こちらが選ばれる
            { date: '2023-01-06', weight: 70.5 }, // 目標日との差: 3日
            { date: '2023-01-10', weight: 70.2 }  // 最新。7日前 = 01-03
        ];
        assert.equal(computeWeightChangeOverDays(logs, 7), -0.8); // 70.2 - 71.0
    });

    test('全ログがdays日以内に収まる場合は最も古いログと比較する', () => {
        const logs = [
            { date: '2023-01-06', weight: 71.0 },
            { date: '2023-01-08', weight: 70.5 }
        ];
        assert.equal(computeWeightChangeOverDays(logs, 30), -0.5);
    });

    test('ログが1件以下ならnullを返す', () => {
        assert.equal(computeWeightChangeOverDays([], 7), null);
        assert.equal(computeWeightChangeOverDays([{ date: '2023-01-01', weight: 70 }], 7), null);
    });
});

describe('computeExercisePRs', () => {
    function workout(id, date, exercises) {
        return { id, date, exercises };
    }
    function ex(name, ...weights) {
        return { name, sets: weights.map(w => ({ weight: w, reps: 10 })) };
    }

    test('種目名ごとに、それ以前の自己ベストを更新した記録だけをPRとする', () => {
        const workouts = [
            workout('w1', '2023-01-01', [ex('ベンチプレス', 60, 50)]),   // 初回 → PR (60kg)
            workout('w2', '2023-01-03', [ex('ベンチプレス', 55)]),        // 60kg未満 → PRではない
            workout('w3', '2023-01-05', [ex('ベンチプレス', 65)])         // 60kg超え → PR
        ];
        const prs = computeExercisePRs(workouts);
        assert.equal(prs.has('w1::0'), true);
        assert.equal(prs.has('w2::0'), false);
        assert.equal(prs.has('w3::0'), true);
    });

    test('日付の前後関係が配列の並び順と逆でも、日付基準で正しく判定する', () => {
        // 配列としてはw2が先だが、日付はw1の方が古い
        const workouts = [
            workout('w2', '2023-01-05', [ex('スクワット', 100)]),
            workout('w1', '2023-01-01', [ex('スクワット', 80)])
        ];
        const prs = computeExercisePRs(workouts);
        assert.equal(prs.has('w1::0'), true);  // 最初の記録(日付基準)
        assert.equal(prs.has('w2::0'), true);  // 80kgを超えているのでPR
    });

    test('同一セッション内の複数種目もそれぞれ独立に判定する', () => {
        const workouts = [
            workout('w1', '2023-01-01', [ex('ベンチプレス', 60), ex('スクワット', 80)])
        ];
        const prs = computeExercisePRs(workouts);
        assert.equal(prs.has('w1::0'), true);
        assert.equal(prs.has('w1::1'), true);
    });

    test('配列でない入力は空のSetを返す', () => {
        assert.equal(computeExercisePRs(null).size, 0);
    });
});

// 2023-01-01と2023-01-08はどちらも日曜日(既知の基準日)。
describe('computeWeeklyTrainingVolume', () => {
    const workouts = [
        { date: '2023-01-04', exercises: [{ sets: [{ weight: 10, reps: 5 }] }] },                    // 週1: 50
        { date: '2023-01-08', exercises: [{ sets: [{ weight: 20, reps: 3 }, { weight: 20, reps: 2 }] }] } // 週2: 100
    ];

    test('週(日曜始まり)ごとに総負荷量(重量×レップ数の合計)を集計する', () => {
        const result = computeWeeklyTrainingVolume(workouts, 2, '2023-01-08');
        assert.deepEqual(result, [
            { weekStart: '2023-01-01', volume: 50 },
            { weekStart: '2023-01-08', volume: 100 }
        ]);
    });

    test('記録の無い週は0として埋める', () => {
        const result = computeWeeklyTrainingVolume(workouts, 3, '2023-01-08');
        assert.deepEqual(result, [
            { weekStart: '2022-12-25', volume: 0 },
            { weekStart: '2023-01-01', volume: 50 },
            { weekStart: '2023-01-08', volume: 100 }
        ]);
    });

    test('同じ週内の複数セッションは合算される', () => {
        const sameWeek = [
            { date: '2023-01-02', exercises: [{ sets: [{ weight: 10, reps: 10 }] }] }, // 100
            { date: '2023-01-04', exercises: [{ sets: [{ weight: 5, reps: 10 }] }] }   // 50
        ];
        const result = computeWeeklyTrainingVolume(sameWeek, 1, '2023-01-04');
        assert.equal(result[0].volume, 150);
    });

    test('配列でない・todayStrが無い場合は空配列を返す', () => {
        assert.deepEqual(computeWeeklyTrainingVolume(null, 4, '2023-01-08'), []);
        assert.deepEqual(computeWeeklyTrainingVolume(workouts, 4, ''), []);
    });
});

describe('computePlannedWeightForDate', () => {
    // 起点(01-01)=80kg, 1ヶ月目(01-31相当=30日後)=76kg, 3ヶ月目(90日後)=70kg
    const start = '2023-01-01';
    const w0 = 80, w1 = 76, w3 = 70;

    test('起点日はweightStartそのもの', () => {
        assert.equal(computePlannedWeightForDate('2023-01-01', start, w0, w1, w3), 80);
    });

    test('起点〜1ヶ月目の間は線形補間する', () => {
        // 15日後(中間地点) → (80+76)/2 = 78
        assert.equal(computePlannedWeightForDate('2023-01-16', start, w0, w1, w3), 78);
    });

    test('1ヶ月目〜3ヶ月目の間も線形補間する', () => {
        // 60日後(30〜90日の中間) → (76+70)/2 = 73
        assert.equal(computePlannedWeightForDate('2023-03-02', start, w0, w1, w3), 73);
    });

    test('3ヶ月目以降はweight3Monthで横ばい', () => {
        assert.equal(computePlannedWeightForDate('2024-01-01', start, w0, w1, w3), 70);
    });

    test('起点日より前はnull', () => {
        assert.equal(computePlannedWeightForDate('2022-12-01', start, w0, w1, w3), null);
    });

    test('日付や起点日が無ければnull', () => {
        assert.equal(computePlannedWeightForDate('', start, w0, w1, w3), null);
        assert.equal(computePlannedWeightForDate('2023-01-01', null, w0, w1, w3), null);
    });
});

describe('computePlannedWeightSeries', () => {
    test('日付配列それぞれについて予測体重を並べる', () => {
        const result = computePlannedWeightSeries(
            ['2022-12-01', '2023-01-01', '2023-01-31'],
            '2023-01-01', 80, 76, 70
        );
        assert.deepEqual(result, [null, 80, 76]);
    });

    test('配列でない入力は空配列を返す', () => {
        assert.deepEqual(computePlannedWeightSeries(null, '2023-01-01', 80, 76, 70), []);
    });
});

// サンプルデータの改名方向は実際の一回限り移行(「ダンベルフライ」→「アームカール」、
// state.jsのrunOneTimeMigrations参照)に合わせている。関数自体はfrom/toを問わない汎用関数。
describe('renameExercisesInWorkouts', () => {
    function workouts() {
        return [
            {
                id: 'w1', date: '2026-07-10',
                exercises: [
                    { name: 'ダンベルフライ', sets: [{ weight: 14, reps: 5 }] },
                    { name: 'レッグプレス', sets: [{ weight: 200, reps: 10 }] }
                ]
            },
            {
                id: 'w2', date: '2026-07-12',
                exercises: [{ name: 'ダンベルフライ', sets: [{ weight: 14, reps: 5 }] }]
            }
        ];
    }

    test('一致する種目名だけを改名し、改名した件数を返す', () => {
        const data = workouts();
        const count = renameExercisesInWorkouts(data, 'ダンベルフライ', 'アームカール');
        assert.equal(count, 2);
        assert.equal(data[0].exercises[0].name, 'アームカール');
        assert.equal(data[0].exercises[1].name, 'レッグプレス'); // 他の種目は変更しない
        assert.equal(data[1].exercises[0].name, 'アームカール');
    });

    test('一致する種目が無ければ何も変更せず0を返す(再実行しても冪等)', () => {
        const data = workouts();
        renameExercisesInWorkouts(data, 'ダンベルフライ', 'アームカール');
        const secondRun = renameExercisesInWorkouts(data, 'ダンベルフライ', 'アームカール');
        assert.equal(secondRun, 0);
    });

    test('セット内容(重量・レップ数)には手を付けない', () => {
        const data = workouts();
        renameExercisesInWorkouts(data, 'ダンベルフライ', 'アームカール');
        assert.deepEqual(data[0].exercises[0].sets, [{ weight: 14, reps: 5 }]);
    });

    test('配列でない入力・空の名前は0を返す', () => {
        assert.equal(renameExercisesInWorkouts(null, 'A', 'B'), 0);
        assert.equal(renameExercisesInWorkouts([], '', 'B'), 0);
        assert.equal(renameExercisesInWorkouts([], 'A', ''), 0);
    });

    test('exercisesが配列でない不正なワークアウトはスキップする', () => {
        const data = [{ id: 'w1', date: '2026-07-10', exercises: null }];
        assert.equal(renameExercisesInWorkouts(data, 'A', 'B'), 0);
    });
});

describe('isStrictNumeric / validateWorkoutsSchemaの数値検証', () => {
    test('数値型と純粋な数値文字列はtrue', () => {
        assert.equal(isStrictNumeric(60), true);
        assert.equal(isStrictNumeric(60.5), true);
        assert.equal(isStrictNumeric('60'), true);
        assert.equal(isStrictNumeric('60.5'), true);
    });

    test('部分数値文字列(XSSペイロード)・空文字・非数値はfalse', () => {
        assert.equal(isStrictNumeric('60<img src=x onerror=alert(1)>'), false);
        assert.equal(isStrictNumeric(''), false);
        assert.equal(isStrictNumeric('  '), false);
        assert.equal(isStrictNumeric(null), false);
        assert.equal(isStrictNumeric(undefined), false);
        assert.equal(isStrictNumeric(true), false);
        assert.equal(isStrictNumeric(NaN), false);
        assert.equal(isStrictNumeric(Infinity), false);
    });

    const validWorkout = () => ({
        id: 'w1', date: '2026-07-16', title: '', category: 'その他 (Other)',
        mood: 'good', impression: '', time: '23:20',
        exercises: [{ name: 'ベンチプレス', sets: [{ weight: 60, reps: 10 }] }]
    });

    test('重量が部分数値文字列(格納型XSSの経路)だと全体を拒否する', () => {
        const w = validWorkout();
        w.exercises[0].sets[0].weight = '60<img src=x onerror=alert(1)>';
        assert.equal(validateWorkoutsSchema([w]), false);
    });

    test('timeは欠損を許容するが、文字列以外は拒否する', () => {
        const w1 = validWorkout();
        delete w1.time;
        assert.equal(validateWorkoutsSchema([w1]), true);

        const w2 = validWorkout();
        w2.time = 123;
        assert.equal(validateWorkoutsSchema([w2]), false);
    });
});

describe('computePlanCalorieAverages', () => {
    const plan = {
        intakeNormal: 1750, daysNormal: 3,
        intakeMilkTea: 1966, daysMilkTea: 2,
        intakeEvent: 2550, daysEvent: 2,
        baseBurn: 2450, runBurn: 338, runCount: 2
    };

    test('週平均の摂取・消費・アンダーカロリーを算出する', () => {
        const r = computePlanCalorieAverages(plan);
        assert.equal(r.avgIntake, 2040);      // (1750*3+1966*2+2550*2)/7
        assert.equal(r.avgExpenditure, 2547); // 2450 + 338*2/7
        assert.equal(r.deficit, 507);
    });

    test('クラウド同期由来の文字列値も数値として扱う', () => {
        const stringPlan = Object.fromEntries(Object.entries(plan).map(([k, v]) => [k, String(v)]));
        assert.deepEqual(computePlanCalorieAverages(stringPlan), computePlanCalorieAverages(plan));
    });

    test('日数が全て0でも0除算にならない(分母7でフォールバック)', () => {
        const r = computePlanCalorieAverages({ ...plan, daysNormal: 0, daysMilkTea: 0, daysEvent: 0 });
        assert.equal(Number.isFinite(r.avgIntake), true);
        assert.equal(r.avgIntake, 0);
    });

    test('null入力でも例外にならない', () => {
        const r = computePlanCalorieAverages(null);
        assert.deepEqual(r, { avgIntake: 0, avgExpenditure: 0, deficit: 0 });
    });
});

describe('computeDaysSince', () => {
    test('経過日数を整数で返す', () => {
        assert.equal(computeDaysSince('2026-07-14', '2026-07-19'), 5);
        assert.equal(computeDaysSince('2026-07-19', '2026-07-19'), 0);
    });

    test('未来の開始日・不正な日付は0', () => {
        assert.equal(computeDaysSince('2026-08-01', '2026-07-19'), 0);
        assert.equal(computeDaysSince('invalid', '2026-07-19'), 0);
        assert.equal(computeDaysSince('', '2026-07-19'), 0);
    });
});

describe('computeRoadmapMilestones', () => {
    test('経過5日: 残り日数分のアンダーカロリーで両マイルストーンを予測する', () => {
        const r = computeRoadmapMilestones(80.2, 507, 5, 79.0, 75.5);
        assert.equal(r.weight1Month, 78.6); // 80.2 - 507*25/7700
        assert.equal(r.weight3Month, 74.6); // 80.2 - 507*85/7700
    });

    test('経過48日: 過ぎた1ヶ月目は履歴として保持し、3ヶ月目のみ再予測する', () => {
        const r = computeRoadmapMilestones(78.0, 507, 48, 78.5, 75.5);
        assert.equal(r.weight1Month, 78.5);
        assert.equal(r.weight3Month, 75.2); // 78.0 - 507*42/7700
    });

    test('経過100日: 両方とも過ぎていれば何も書き換えない', () => {
        const r = computeRoadmapMilestones(76.0, 507, 100, 78.5, 75.5);
        assert.deepEqual(r, { weight1Month: 78.5, weight3Month: 75.5 });
    });

    test('カロリー収支が赤字でない場合、未来のマイルストーンは現状体重で横ばい', () => {
        const r = computeRoadmapMilestones(80.2, -100, 5, 79.0, 75.5);
        assert.deepEqual(r, { weight1Month: 80.2, weight3Month: 80.2 });
    });
});

describe('decidePlanStartDateMigration', () => {
    const logs = [{ date: '2026-07-05', weight: 81.2 }, { date: '2026-07-18', weight: 80.2 }];

    test('開始日がズレていれば最初の体重記録日への修正を指示する', () => {
        const d = decidePlanStartDateMigration(logs, { weightPlanStartDate: '2026-07-16' });
        assert.deepEqual(d, { apply: true, startDate: '2026-07-05', markDone: true });
    });

    test('既に一致していれば書き換えずフラグだけ立てる', () => {
        const d = decidePlanStartDateMigration(logs, { weightPlanStartDate: '2026-07-05' });
        assert.deepEqual(d, { apply: false, startDate: '2026-07-05', markDone: true });
    });

    test('体重ログが無い環境では見送り(フラグも立てず次回起動で再判定)', () => {
        const d = decidePlanStartDateMigration([], { weightPlanStartDate: '2026-07-16' });
        assert.deepEqual(d, { apply: false, startDate: null, markDone: false });
    });

    test('planSettingsが無ければ見送り', () => {
        const d = decidePlanStartDateMigration(logs, null);
        assert.deepEqual(d, { apply: false, startDate: null, markDone: false });
    });
});

describe('getFitnessDateString (27時ルール)', () => {
    test('AM3時までは前日の日付を返す', () => {
        assert.equal(getFitnessDateString(new Date('2026-07-20T00:30:00')), '2026-07-19');
        assert.equal(getFitnessDateString(new Date('2026-07-20T02:59:59')), '2026-07-19');
    });

    test('AM3時以降は当日の日付を返す', () => {
        assert.equal(getFitnessDateString(new Date('2026-07-20T03:00:00')), '2026-07-20');
        assert.equal(getFitnessDateString(new Date('2026-07-20T23:00:00')), '2026-07-20');
    });

    test('月初の深夜は前月末日になる', () => {
        assert.equal(getFitnessDateString(new Date('2026-08-01T01:00:00')), '2026-07-31');
    });
});

describe('computeActivityProfile', () => {
    const today = '2026-07-20';
    const workoutsAt = dates => dates.map((d, i) => ({ id: 'w' + i, date: d, exercises: [] }));

    test('筋トレ頻度からPALを決め、TDEE=BMR×PAL+有酸素平均を返す', () => {
        // 直近30日に12件 → PAL 1.725
        const dates = Array.from({ length: 12 }, (_, i) => `2026-07-${String(19 - i).padStart(2, '0')}`);
        const cardio = [
            { date: '2026-07-19', distance: 4, calories: 320 },
            { date: '2026-07-12', distance: 4, calories: 340 }
        ];
        const p = computeActivityProfile(80.0, workoutsAt(dates), cardio, today);
        assert.equal(p.workoutsLast30Days, 12);
        assert.equal(p.pal, 1.725);
        assert.equal(p.bmr, 1840);            // 23×80
        assert.equal(p.baseBurn, 3174);       // 1840×1.725
        assert.equal(p.runBurn, 330);         // (320+340)/2
        assert.equal(p.runCount, 0.5);        // 2件/28日×7
        assert.equal(p.tdee, 3174 + Math.round(330 * 0.5 / 7));
    });

    test('記録が無ければPAL1.2・有酸素0でTDEE=BMR×1.2', () => {
        const p = computeActivityProfile(70.0, [], [], today);
        assert.equal(p.pal, 1.2);
        assert.equal(p.runBurn, 0);
        assert.equal(p.runCount, 0);
        assert.equal(p.tdee, p.baseBurn);
    });

    test('30日より古い筋トレ・28日より古い有酸素は数えない', () => {
        const p = computeActivityProfile(70.0,
            workoutsAt(['2026-05-01', '2026-06-01']),
            [{ date: '2026-06-01', distance: 4, calories: 300 }],
            today);
        assert.equal(p.workoutsLast30Days, 0);
        assert.equal(p.runBurn, 0);
    });
});

describe('computeIntakeTiersForPace', () => {
    test('週平均が目標摂取に一致するよう通常日を逆算し、上乗せ幅で3区分を作る', () => {
        // TDEE 2550, 月2kg → deficit 513, 目標平均 2037
        const r = computeIntakeTiersForPace(2550, 2, 3, 2, 2, 200, 800);
        assert.equal(r.dailyDeficit, 513);
        assert.equal(r.targetAvgIntake, 2037);
        // normal = (2037*7 - 200*2 - 800*2)/7 = 1751.28 → 10刻み丸めで1750
        assert.equal(r.intakeNormal, 1750);
        assert.equal(r.intakeSweet, 1950);
        assert.equal(r.intakeEvent, 2550);
        // 丸め誤差を除き週平均が目標に近いこと(±10kcal)
        const avg = (r.intakeNormal * 3 + r.intakeSweet * 2 + r.intakeEvent * 2) / 7;
        assert.ok(Math.abs(avg - r.targetAvgIntake) <= 10);
    });

    test('日数が全て0でも0除算にならない', () => {
        const r = computeIntakeTiersForPace(2500, 1, 0, 0, 0, 200, 800);
        assert.ok(Number.isFinite(r.intakeNormal));
    });

    test('下限未指定なら実効アンダーカロリーは目標とほぼ一致(丸め誤差のみ)', () => {
        const r = computeIntakeTiersForPace(2550, 2, 3, 2, 2, 200, 800);
        assert.equal(r.clamped, false);
        assert.ok(Math.abs(r.effectiveDailyDeficit - r.dailyDeficit) <= 10);
    });

    test('速いペース×低TDEEでは通常日を下限(BMR)で止め、clampedと実効値を返す', () => {
        // TDEE 2000, 月3kg → 目標平均1230、通常日は940まで下がるところをBMR1400で下限調整
        const r = computeIntakeTiersForPace(2000, 3, 3, 2, 2, 200, 800, 1400);
        assert.equal(r.clamped, true);
        assert.equal(r.intakeNormal, 1400);
        assert.equal(r.intakeSweet, 1600);
        assert.equal(r.intakeEvent, 2200);
        // 実効平均 = (1400*3+1600*2+2200*2)/7 = 1686 → 実効アンダーカロリー314(目標770より小さい)
        assert.equal(r.effectiveAvgIntake, 1686);
        assert.equal(r.effectiveDailyDeficit, 314);
        assert.ok(r.effectiveDailyDeficit < r.dailyDeficit);
    });
});

describe('projectWeightAfterDays', () => {
    test('アンダーカロリー×日数÷7700だけ減った体重を返す', () => {
        assert.equal(projectWeightAfterDays(80.0, 513, 30), 78.0); // 80 - 513*30/7700 = 78.0
        assert.equal(projectWeightAfterDays(80.0, 513, 90), 74.0);
        assert.equal(projectWeightAfterDays(80.0, 0, 30), 80.0);
    });
});
