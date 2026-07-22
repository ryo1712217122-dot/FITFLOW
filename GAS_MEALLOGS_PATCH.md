# GASバックエンド MealLogs 永続化パッチ

> **⏳ 未適用**: アプリ側(js/sync.js)はこのパッチの有無どちらでも壊れないように実装済み
> (GETレスポンスに `mealLogs` が無い場合、ローカルの食事記録を上書きせず保持する)。
> 適用するとクラウド同期・複数端末間で食事記録も共有されるようになる。

## 目的

v1.16.0で追加した「食事の記録」フォーム(朝食/昼食/夕食/間食のkcal目安、1日1件)を、
既存の Workouts / WeightLogs / CardioLogs と同様にクラウド(スプレッドシート)へ
バックアップ・復元できるようにするためのパッチ。

現状、アプリは同期時に `mealLogs` をペイロードに含めて送っているが、
スプレッドシート「FITFLOW api」には対応するシートが無く、**mealLogs はシートに
保存されない**。バックエンドは未知のペイロードキーを無視するだけなので送信自体は
失敗しないが、`doGet` のレスポンスにも `mealLogs` が含まれないため、食事記録は
この端末のlocalStorageにしか残らない(＝この端末を消すと復元できない)。

**未適用の間は従来通り動き続ける**(壊れない。食事記録はローカル保存のみ)。

## 適用手順

スプレッドシート「FITFLOW api」→ 拡張機能 → Apps Script で
コンテナバインドのスクリプトエディタを開き、以下を行う
(gas-scripts リポジトリの `projects/fitflow-api/FITFLOW.js` が正本。
`clasp push` で反映してもよい)。

1. 下の2関数をそのまま追加する
2. `doPost` の backup 処理(5. PlanSettings の直後)に1行追加:
   `writeMealLogs_(ss, params.mealLogs);`
3. `doGet` が返す `result` オブジェクトに1行追加:
   `result.mealLogs = readMealLogs_(ss);`
   (`result.planSettings = readPlanSettings_(ss);` の直後が自然)

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

1. パッチ適用後、FITFLOWアプリで「食事の記録」を1件保存し、同期を走らせる
   (自動同期、または「同期と設定」タブの手動バックアップ)
2. スプレッドシートに `MealLogs` シートができ、入力した行が入っていることを確認
3. 別端末(またはlocalStorageをクリアした状態)でアプリを開き、クラウドから
   自動同期した際に食事記録が復元されることを確認
4. 既存の Workouts / WeightLogs / CardioLogs / PlanSettings の同期が壊れていないことを確認

## 備考

- js/sync.js 側は `Array.isArray(data.mealLogs)` で存在チェックしてから取り込む実装に
  なっており、このパッチの適用前後どちらでも安全(未適用時はローカルの食事記録を保持する)。
  これは過去に「特別な飲食」機能(foodLogs)がGAS未対応のまま`data.foodLogs || []`で
  受けてしまい、自動同期のたびにローカル記録が消えていた不具合の再発防止。
- スクリプトIDを教えてもらえれば `clasp push` での適用まで代行可能
  (gas-scripts リポジトリと同じ clasp 認証を使用。GAS_PLANSETTINGS_PATCH.md と同じ手順)。
