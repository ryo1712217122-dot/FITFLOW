# GASバックエンド SleepLogs 永続化パッチ

> **⚠️ 未適用**: バックエンドコードの正本（gas-scripts リポジトリの
> `projects/fitflow-api/FITFLOW.js`）には反映済みだが、**`clasp push` と本番Webアプリの
> 再デプロイはまだ行っていない**。適用するまで SleepLogs シートは作られず、
> 睡眠の記録はローカル（LocalStorage）とJSONバックアップにのみ保存される。

## 目的

v1.22.0で追加した「睡眠の記録」フォーム（就寝時刻・起床時刻を起床日に紐づけて記録、1日1件）を、
既存の Workouts / WeightLogs / CardioLogs / MealLogs / DrinkingLogs と同様に
クラウド（スプレッドシート）へバックアップ・復元できるようにするためのパッチ。

適用の意味は**バックアップだけではない**。15時の Slack ブリーフィング
（routine `morning-fitness-briefing`）はスプレッドシートを読んでコメントを組み立てるため、
**このパッチを当てるまでブリーフィングは睡眠に触れられない**（プロンプト側は
「無いシートには触れず、あるデータだけで書く」方針にしてあるので、未適用でも
エラーにはならず、睡眠の話題が出ないだけ）。

適用前は、アプリが同期時に `sleepLogs` をペイロードに含めて送っていても、
対応するシートが無いため保存されない（送信キー自体はGAS側で無視されるだけなので送信は安全）。
適用後は `doPost` のたびに `SleepLogs` シートへ書き込まれ、`doGet` のレスポンスにも
`sleepLogs` が含まれるようになる。

アプリ側（js/sync.js）は mealLogs / drinkingLogs と同じく `Array.isArray(data.sleepLogs)` で
「キーが実在した時だけ」取り込む実装なので、**パッチ適用前後のどちらでも安全**
（未適用の間、自動同期でローカルの睡眠記録が消えることはない。適用後は
再デプロイさえ済めばアプリ側の変更なしで保存・復元されるようになる）。

## 適用内容

`gas-scripts` リポジトリの `projects/fitflow-api/FITFLOW.js` に対して、以下3か所。
**コードは反映済み**なので、残っているのは push と再デプロイのみ。

### 1. `doPost` の backup 処理に書き込みを追加

```js
        // 7. DrinkingLogs (飲み会の記録)
        writeDrinkingLogs_(ss, params.drinkingLogs);

        // 8. SleepLogs (睡眠の記録: 就寝・起床の時刻。Dateは起床日)
        writeSleepLogs_(ss, params.sleepLogs);
```

### 2. `doGet` のレスポンスに読み出しを追加

```js
    // 8. SleepLogs (シート未作成なら空配列。取り込み条件はmealLogs/drinkingLogsと同じ)
    result.sleepLogs = readSleepLogs_(ss);
```

### 3. 読み書きヘルパーをファイル末尾に追加

```js
function writeSleepLogs_(ss, sleepLogs) {
  if (!Array.isArray(sleepLogs)) return;
  writeTable_(ss, 'SleepLogs',
    ['Date', 'BedTime', 'WakeTime'],
    sleepLogs.map(s => [s.date, s.bedTime, s.wakeTime]));
}

function readSleepLogs_(ss) {
  const sheet = ss.getSheetByName('SleepLogs');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    rows.push({ date: data[i][0], bedTime: data[i][1], wakeTime: data[i][2] });
  }
  return rows;
}
```

## データ形式

| 列 | 内容 | 例 |
|---|---|---|
| Date | **起床日**（前夜23:30に寝て翌朝6:15に起きた睡眠は、起きた日の記録） | `2026-08-03` |
| BedTime | 就寝時刻 `HH:MM` | `23:30` |
| WakeTime | 起床時刻 `HH:MM` | `06:15` |

睡眠時間は保存しない（就寝と起床から一意に決まる冗長な値で、二重に持つと食い違うため）。
読む側は「起床 − 就寝、負またはゼロなら +24時間」で計算する。

### 時刻の往復について（注意点）

`"23:30"` をシートに素で書くと、Googleスプレッドシートはこれを**時刻値**
（1899-12-30を基準にしたDate）として解釈する。`getValues()` はDateを返し、
`JSON.stringify` で `"1899-12-30T14:30:00.000Z"` のようなISO文字列になる。

アプリ側は `normalizeImportedData` が `normalizeTime()` を通してこれを `"23:30"` に戻す。
これは Workouts シートの Time 列がすでに通っている経路と同じなので、実績のある扱い方。
ただし**スプレッドシートのタイムゾーンとブラウザのタイムゾーンが一致している前提**
（どちらもJST）である点は注意。ズレると時刻が数時間ずれて復元される。

## 適用手順

```bash
cd workspace/gas-scripts/projects/fitflow-api
clasp push
```

その後、**本番Webアプリを同一デプロイIDのまま新しいバージョンへ更新**する
（デプロイIDが変わるとアプリ側の同期URLが無効になる）。DrinkingLogsパッチ適用時（@5）と同じ手順。

## 適用後の確認

1. 本番 `doGet` に実リクエストし、レスポンスに `"sleepLogs":[]`（まだシート未作成なので空配列）が
   含まれること、既存の workouts / weightLogs / cardioLogs / mealLogs / drinkingLogs /
   planSettings / maintenanceCalories が従来どおり返ることを確認する
2. アプリで睡眠を1件記録して同期し、スプレッドシートに `SleepLogs` シートが作られ、
   Date / BedTime / WakeTime の3列が入ることを確認する
3. アプリ側で「クラウドから復元」を実行し、**就寝・起床の時刻が入力どおりに戻ること**を確認する
   （上記「時刻の往復について」の懸念が実環境で問題ないことの確認。ここがズレると
   `filterValidSleepLogs` が弾いて睡眠記録が消えるため、必ず見ること）
