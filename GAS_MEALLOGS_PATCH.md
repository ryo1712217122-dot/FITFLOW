# GASバックエンド MealLogs 永続化パッチ

> **✅ 適用済み (2026-07-22)**: clasp経由で本番バックエンドに適用・再デプロイ済み
> (デプロイID同一のまま@4に更新。GETレスポンスに `mealLogs` キーが含まれることを確認済み)。
> バックエンドコードの正本は gas-scripts リポジトリの `projects/fitflow-api/FITFLOW.js` で管理する。
> 以下は適用内容の記録。

## 目的

v1.16.0で追加した「食事の記録」フォーム(朝食/昼食/夕食/間食のkcal目安、1日1件)を、
既存の Workouts / WeightLogs / CardioLogs と同様にクラウド(スプレッドシート)へ
バックアップ・復元できるようにするためのパッチ。

適用前は、アプリが同期時に `mealLogs` をペイロードに含めて送っていても、
スプレッドシート「FITFLOW api」に対応するシートが無く、**mealLogs はシートに
保存されなかった**。適用後は `doPost` のたびに `MealLogs` シートへ書き込まれ、
`doGet` のレスポンスにも `mealLogs` が含まれるようになる。

## 適用内容

`gas-scripts` リポジトリの `projects/fitflow-api/FITFLOW.js` に対して、以下を行った
(`clasp push` → 既存の本番WebデプロイをデプロイID同一のまま新バージョンへ再デプロイ)。

1. 下の2関数を追加(`writePlanSettings_`/`readPlanSettings_` の直後)
2. `doPost` の backup 処理(5. PlanSettings の直後)に1行追加:
   `writeMealLogs_(ss, params.mealLogs);`
3. `doGet` が返す `result` オブジェクトに1行追加:
   `result.mealLogs = readMealLogs_(ss);`
   (`result.planSettings = readPlanSettings_(ss);` の直後)

```javascript
// ==========================================
// MealLogs (食事記録: 朝食/昼食/夕食/間食)
// ==========================================

// アプリから同期されるmealLogsを「MealLogs」シートに書き込む。
// doPostのbackup処理内で writeMealLogs_(ss, params.mealLogs) を呼ぶこと。
function writeMealLogs_(ss, mealLogs) {
  if (!Array.isArray(mealLogs)) return;
  writeTable_(ss, 'MealLogs',
    ['Date', 'Breakfast', 'Lunch', 'Dinner', 'Snacks'],
    mealLogs.map(function(m) {
      return [m.date, m.breakfast || 0, m.lunch || 0, m.dinner || 0, m.snacks || 0];
    }));
}

// MealLogsシートからmealLogs配列を復元する(シート未作成なら空配列)。
// doGetのレスポンスに result.mealLogs = readMealLogs_(ss) として含めること。
function readMealLogs_(ss) {
  const sheet = ss.getSheetByName('MealLogs');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    rows.push({
      date: data[i][0],
      breakfast: parseFloat(data[i][1]) || 0,
      lunch: parseFloat(data[i][2]) || 0,
      dinner: parseFloat(data[i][3]) || 0,
      snacks: parseFloat(data[i][4]) || 0
    });
  }
  return rows;
}
```

`doPost` の payload 検証(`Array.isArray(params.workouts)` 等のチェック)は
`mealLogs` を必須にしていない(未対応の旧アプリ・過去のバックアップ再送でも
落ちないようにするため)。`writeMealLogs_` 側で `Array.isArray` を確認しているので
`params.mealLogs` が無くても安全にスキップされる。

## 動作確認

1. 適用直後、デプロイ済みWebアプリの `doGet` エンドポイントに実際にリクエストし、
   レスポンスJSONに `"mealLogs":[]` が含まれることを確認済み(2026-07-22。
   まだ`MealLogs`シートを作っていない状態なので空配列)。既存の
   workouts/weightLogs/cardioLogs/planSettings も従来通り返っており、
   他のデータへの影響が無いことも合わせて確認した
   (書き込み側は本番データを壊すリスクを避けるため、テストPOSTは送らず、
   既存の`writeTable_`を流用しているだけの実装であることのコードレビューで代替した)。
2. 今後、FITFLOWアプリで「食事の記録」を保存し同期が走ると、
   スプレッドシートに `MealLogs` シートが自動作成され、入力した行が入るはず
   (この時点ではまだ未確認。次回の実同期で確認する)。
3. 別端末(またはlocalStorageをクリアした状態)でアプリを開いた際、クラウドから
   自動同期で食事記録が復元されることも、同様に次回の実同期で確認する。

## 備考

- js/sync.js 側は `Array.isArray(data.mealLogs)` で存在チェックしてから取り込む実装に
  なっており、このパッチの適用前後どちらでも安全(未適用時はローカルの食事記録を保持する)。
  これは過去に「特別な飲食」機能(foodLogs)がGAS未対応のまま`data.foodLogs || []`で
  受けてしまい、自動同期のたびにローカル記録が消えていた不具合の再発防止。
