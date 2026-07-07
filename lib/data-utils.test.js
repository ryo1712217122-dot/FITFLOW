const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
    normalizeDate,
    normalizeTime,
    validateWorkoutsSchema,
    filterValidWeightLogs,
    filterValidCardioLogs,
    sortedByDateDesc,
    getLatestWeightFromLogs
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
