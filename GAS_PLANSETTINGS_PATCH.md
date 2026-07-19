# GASバックエンド PlanSettings 永続化パッチ

## 目的

毎朝のブリーフィング(routine `morning-fitness-briefing`)を、アプリの「最適化計画」
(開始日・体重ロードマップ・カロリー予算)と連携させるためのパッチ。

現状、アプリは同期時に `planSettings` をペイロードに含めて送っているが、
スプレッドシート「FITFLOW api」には Workouts / WeightLogs / CardioLogs / Config の
4シートしかなく、**planSettings はシートに保存されていない**(2026-07-19 に Drive 経由で確認)。
ブリーフィング routine は Drive コネクタでシートを読むため、planSettings がシートに
無い限り計画と連携できない。

このパッチを適用すると `PlanSettings` シート(Key/Value形式)が作られ、routine 側は
既に「PlanSettings シートがあればそちらを優先」するプロンプトに更新済みなので、
適用した瞬間から自動でアプリの計画がブリーフィングに反映される。
**未適用の間は従来のハードコード目標(基準日2026-07-14)で動き続ける**(壊れない)。

## 適用手順

スプレッドシート「FITFLOW api」→ 拡張機能 → Apps Script で
コンテナバインドのスクリプトエディタを開き、以下を行う。

1. 下の2関数をそのまま追加する
2. `doPost` の backup 処理(各シートへ書き込んでいる箇所)に1行追加:
   `writePlanSettings_(ss, data.planSettings);`
   (`ss` は対象スプレッドシート、`data` はパースしたリクエストJSON。変数名は実装に合わせる)
3. `doGet` が返すJSONに `planSettings: readPlanSettings_(ss)` を追加する
   (既に planSettings を返す実装がある場合はこの手順は不要)

```javascript
// FITFLOWアプリから同期される planSettings を「PlanSettings」シートにKey/Value形式で保存する。
// doPost の backup 処理内で writePlanSettings_(ss, data.planSettings) を呼ぶこと。
// 値はスカラー(数値・文字列・null)前提。将来 planSettings に配列/オブジェクト型の
// フィールドを追加する場合は JSON.stringify する等、この関数の対応が必要。
function writePlanSettings_(ss, planSettings) {
  if (!planSettings || typeof planSettings !== 'object') return;
  var sheet = ss.getSheetByName('PlanSettings') || ss.insertSheet('PlanSettings');
  var rows = [['Key', 'Value']];
  Object.keys(planSettings).forEach(function(key) {
    var v = planSettings[key];
    rows.push([key, v === null || v === undefined ? '' : v]);
  });
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
}

// PlanSettings シートから planSettings オブジェクトを復元する(シートが無ければ null)。
// doGet のレスポンスJSONに planSettings: readPlanSettings_(ss) として含めること。
function readPlanSettings_(ss) {
  var sheet = ss.getSheetByName('PlanSettings');
  if (!sheet || sheet.getLastRow() < 2) return null;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  var obj = {};
  values.forEach(function(row) {
    var key = String(row[0] || '');
    if (!key) return;
    var v = row[1];
    if (v instanceof Date) {
      // 日付文字列(weightPlanStartDate等)はSheetsがDate型に変換するため、
      // アプリ側の形式(YYYY-MM-DD)へ戻して返す
      v = Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy-MM-dd');
    } else if (v === '') {
      v = null;
    }
    obj[key] = v;
  });
  return obj;
}
```

## 動作確認

1. パッチ適用後、FITFLOWアプリで「最適化計画」を開いて保存(または任意の記録を追加)し、同期を走らせる
2. スプレッドシートに `PlanSettings` シートができ、`weightPlanStartDate` などの行が入っていることを確認
3. アプリをリロードし、クラウド同期後も計画(開始日含む)が壊れていないことを確認
4. 翌日のブリーフィングが「PlanSettings シートの計画」ベースの目標ペースラインで届くことを確認

## 備考

- スクリプトIDを教えてもらえれば `clasp clone` でこのパッチの適用・pushまで
  Claude Code 側で代行可能(gas-scripts リポジトリと同じ clasp 認証を使用)
- アプリ側 `js/sync.js` の GET 取り込みは `data.planSettings || null` を許容するため、
  このパッチの有無どちらでも壊れない
