# CLAUDE.md

このファイルは、Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

## プロジェクト概要

USDM Editor は、USDM（Universal Specification Describing Manner）形式で要求仕様を階層的に管理・編集するためのChrome拡張機能です。最大4レベルの階層構造で要求・理由・仕様を管理し、CSV入出力とPDF出力に対応しています。

## 技術スタック

- **Manifest V3** Chrome Extension
- **純粋なJavaScript** (フレームワーク不使用)
- **Chrome Storage API** (フォールバック: localStorage)
- クライアントサイド CSV パースとエクスポート
- ブラウザネイティブのprint APIによるPDF出力

## 開発・テスト

### 拡張機能のロード

```bash
# Chromeブラウザで以下を開く
chrome://extensions

# 「デベロッパーモード」をON
# 「パッケージ化されていない拡張機能を読み込む」でこのディレクトリを選択
```

### 開発中のリロード

コードを変更した後:
1. `chrome://extensions` を開く
2. 拡張機能カードの「更新」アイコンをクリック
3. 開いているUSDM Editorタブをリロード

## アーキテクチャ

### ファイル構成

- [manifest.json](manifest.json) - Chrome拡張機能のマニフェスト
- [background.js](background.js) - Service Worker (拡張機能アイコンクリック時に新規タブを開く)
- [usdm.html](usdm.html) - メインUI
- [app.js](app.js) - アプリケーションロジック (約1040行)
- [style.css](style.css) - スタイル定義

### データモデル

要求データは以下の構造を持つオブジェクトの配列として管理されます:

```javascript
{
  level1_id: "1",      // 必須
  level2_id: "1",      // オプション (L2以上)
  level3_id: "1",      // オプション (L3以上)
  level4_id: "1",      // オプション (L4のみ)
  description: "要求の説明",
  rationale: "理由",
  specification: "仕様"
}
```

### 主要な関数

#### データ管理
- `loadData()` - Chrome Storage/localStorageからデータを読み込み
- `saveData()` - データを永続化 (全操作後に自動実行)
- `requirements` - グローバルな要求配列
- `documentTitle` - ドキュメントタイトル

#### ツリー構築と描画
- `buildTree()` - フラットな配列から階層ツリー構造を構築
- `renderTree(preserveState)` - UIを再描画 (展開状態を保持可能)
- `renderNode(node)` - 再帰的にノードをHTMLに変換

#### ユーティリティ
- `getLevel(req)` - 要求のレベル(1-4)を計算
- `getFullId(req)` - "1-2-3" 形式のIDを生成
- `getParentId(req)` - 親要求のIDを取得
- `escapeHtml(text)` - XSS対策のエスケープ処理

#### CRUD操作
- `addRootRequirement()` - L1要求を追加
- `addChildRequirement(parentId)` - 子要求を追加
- `editRequirement(index)` - 要求を編集
- `deleteRequirement(index)` - 要求とその子要求を削除
- `levelUp(index)` - レベルを上げる (L2→L1など)
- `levelDown(index)` - レベルを下げる (L1→L2など)

#### データインポート/エクスポート
- `exportCSV()` - UTF-8 BOM付きCSVをダウンロード
- `importCSV(event)` - CSVファイルを読み込み、バリデーション実施
- `parseCSV(text)` - RFC 4180準拠のCSVパーサー
- `exportPDF()` - 印刷用ウィンドウを開いてPDF出力

### 重要な実装詳細

#### ID管理とバリデーション

- IDは文字列として管理 (数値ソート: `localeCompare(..., {numeric: true})`)
- `updateIdDisplay()` でリアルタイムに重複チェックと親存在チェック
- フォーム送信時に再度バリデーション実施
- 親要求が存在しない場合、保存を拒否

#### 展開/折りたたみ状態

- `getExpandedState()` - 現在の展開状態をSetで保存
- `restoreExpandedState(expanded)` - 再描画後に状態を復元
- デフォルトで全て折りたたまれた状態で起動

#### CSVフォーマット

- ヘッダー行: `"レベル1 ID","レベル2 ID","レベル3 ID","レベル4 ID","要求","理由","仕様"`
- `#` で始まる行はコメント行として無視
- インポート時のファイル名がドキュメントタイトルになる
- RFC 4180準拠 (引用符内のカンマ、改行、ダブルクォートエスケープに対応)

#### イベント処理

- イベント委譲パターン: `tree-container` 内の全ボタンクリックを一箇所で処理
- `data-action` 属性でアクション種別を識別
- モーダルはESCキーと背景クリックで閉じる

## よくある開発タスク

### 新しいフィールドを追加する場合

1. データモデルに新しいプロパティを追加
2. [usdm.html](usdm.html) のフォームにinput/textareaを追加
3. `handleFormSubmit()` で新しいフィールドを読み取り
4. `editRequirement()` でフォームに値を設定
5. `renderNode()` または `req-details` に表示ロジックを追加
6. CSVエクスポート/インポートを更新 (`exportCSV`, `importCSV`, `parseCSV`)
7. PDF出力を更新 (`generatePrintContent`)

### バリデーションルールを変更する場合

- フォーム入力時: `updateIdDisplay()` を修正
- CSV インポート時: `importCSV()` 内の `validateRequirement()` を修正
- フォーム送信時: `handleFormSubmit()` のバリデーションロジックを修正

### ストレージ形式を変更する場合

- マイグレーションロジックを `loadData()` に追加
- 後方互換性を保つこと (既存ユーザーのデータを壊さない)

## 注意事項

- Chrome Storage APIは非同期 (`async/await` 使用)
- `renderTree()` は重い処理のため、頻繁な呼び出しを避ける
- 子要求がある要求は削除・レベル変更時に確認が必要
- IDソート時は必ず `{numeric: true}` オプションを使用 ("10"が"2"より後になるように)
- XSS対策のため、全ユーザー入力は `escapeHtml()` でエスケープ
