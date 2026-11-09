# 引継ぎドキュメント — Costume Studio

最終更新: 2026-11-07
対象: このリポジトリを引き継ぐ開発者

---

## 1. このプロジェクトは何か

Scratch のペイントエディター（`@scratch/scratch-paint`）を単体の Web アプリとして包み、
コスチューム（SVG / ビットマップ）を編集・書き出しできるようにした非公式ツール。

- Scratch アカウント・サーバー不要。画像処理はすべてブラウザ内。
- Scratch Foundation とは無関係（`TRADEMARK` 参照）。
- ライセンスは **AGPL-3.0-only**（`scratch-paint` が AGPL のため）。

公開名は **Costume Studio**。Scratch のロゴや Scratch Cat などのキャラクター画像は同梱しない方針。

---

## 2. 現在の状態サマリ

### 動いているもの（検証済み）

- ベクター / ビットマップの描画・編集・保存（SVG、PNG 1×/2×）
- SVG / PNG / JPG / GIF / BMP の読み込み、ドラッグ＆ドロップ
- 日本語 / 英語 UI（ブラウザ言語 + エディタ右下の言語コントロール）
- ダークテーマ（エディタ内・アプリ外枠・モーダル・カラーピッカーまで）
- エディタ内蔵の追加ツール（三角・矢印・ペン・スタンプ・角丸四角形など）
- スナップ（ページ / オブジェクト / 選択ボックス、Ctrl で一時無効化）
- 復元ポイント（手動 + 自動バックアップ設定時の5分ごとの定期保存、最大 10 件）
- SVG コードパネル（CodeMirror 6、選択オブジェクトのコード表示・編集・反映）

### 要確認（最優先）

**SVG コードパネル開閉時のキャンバス再計測を実装済み。** `ResizeObserver` でキャンバスのサイズ変更を検出し、Paper.js の再計測後に表示範囲を更新する。ビルドは成功済みだが、パネル開閉時の描画位置についてブラウザでの目視 QC は未実施。§7.1 の手順で確認すること。

---

## 3. クイックスタート

必要: Node.js 20 以上（開発時は 22）。

```bash
npm install
npm start          # http://localhost:5173
npm run build      # dist/ に本番ビルド
npm run preview    # dist を 4173 で配信
```

`dist/` と `node_modules/` は現在コミット対象外（`.gitignore`）。
`dist/` は既に生成済みの状態で残っている場合があるが、再ビルドすれば上書きされる。

---

## 4. リポジトリ構成

```
.
├── docs/
│   ├── screenshot.png          # README 用（日本語 UI）
│   ├── screenshot-en.png       # README.en 用（英語 UI）
│   └── HANDOVER.md             # このファイル
├── public/
│   ├── index.html
│   └── favicon.svg
├── src/
│   ├── App.jsx                 # アプリ全体のシェル（ツールバー、状態、保存、バックアップ）
│   ├── index.jsx               # エントリ（Redux + IntlProvider + prewarm）
│   ├── store.js                # combineReducers(intl, scratchPaint)
│   ├── i18n.js                 # ロケール判定・メッセージ取得
│   ├── locales.js              # 日本語 / 英語の文言（全 UI 文言はここ）
│   ├── sample.js               # サンプルコスチューム（オリジナル SVG）
│   ├── components/
│   │   ├── BackupDialog.jsx    # 復元ポイント一覧
│   │   ├── ConfirmDialog.jsx   # 破棄確認
│   │   ├── FeaturesMenu.jsx    # 拡張機能設定（大型モーダル）
│   │   ├── HelpDialog.jsx      # ヘルプ / ショートカット
│   │   ├── Icons.jsx           # インライン SVG アイコン集
│   │   ├── Modal.jsx           # 汎用モーダル（body に portal）
│   │   ├── SaveMenu.jsx        # SVG / PNG 書き出しメニュー
│   │   └── SvgCodePanel.jsx    # CodeMirror 6 の SVG コード編集パネル
│   ├── lib/
│   │   ├── download.js         # Blob ダウンロード
│   │   ├── features.js         # 拡張機能の既定値・localStorage 読み書き
│   │   ├── files.js            # ファイル読み込み（SVG 正規化、HD ラスター）
│   │   ├── image.js            # SVG→PNG、ImageData→dataURL など
│   │   └── storage.js          # バックアップ（復元ポイント）の保存
│   ├── styles/
│   │   └── theme.global.css    # アプリ全体の CSS（ダークテーマ含む）
│   └── vendor/
│       └── scratch-paint/      # @scratch/scratch-paint 15.3.0 のフォーク（後述）
├── webpack.config.js
├── package.json
├── LICENSE / NOTICE / THIRD_PARTY_NOTICES.md / TRADEMARK
├── README.md / README.en.md
├── CONTRIBUTING.md / SECURITY.md
└── .github/workflows/deploy.yml
```

---

## 5. アーキテクチャ

### 5.1 `scratch-paint` の vendoring（重要）

`node_modules/@scratch/scratch-paint/src` を **`src/vendor/scratch-paint/` にコピーしてフォーク**している。
理由: TurboWarp / PenguinMOD 系のツールをエディタ内部に統合するため、上流のソースを直接改変する必要があった。

`webpack.config.js` でエイリアスを張っている:

```js
resolve: {
    alias: {
        '@scratch/scratch-paint$': path.resolve(__dirname, 'src/vendor/scratch-paint/index.js')
    }
}
```

そのため `import PaintEditor from '@scratch/scratch-paint'` は
**`src/vendor/scratch-paint` を指す**。`node_modules` 側は依存（`@scratch/paper` 等）の解決にのみ使う。

#### vendor 側で入れた主な変更

| ファイル | 変更内容 |
| --- | --- |
| `lib/modes.js` | `PEN` / `TRIANGLE` / `ARROW` / `SUSSY` を追加 |
| `reducers/scratch-paint-reducer.js` | `rectMode` / `roundedRectMode` / `penMode` / `triangleMode` / `sussyMode` / `theme` を登録 |
| `components/paint-editor/paint-editor.jsx` | 追加ツールのボタン、テーマ切替ボタン、`data-paint-theme` |
| `containers/paint-editor.jsx` | `setTheme` の配線、`theme` の受け渡し |
| `helper/tools/rect-tool.js`, `rounded-rect-tool.js` | 角丸半径対応（PenguinMOD から移植） |
| `containers/rect-mode.jsx`, `rounded-rect-mode.jsx` | 角丸サイズの Redux 連携 |
| `containers/color-picker.jsx`, `components/color-picker/*` | 16 進入力 + Opacity スライダー（TurboWarp `tw-paint` から移植） |
| `components/tw-color-readout/*` | 数値入力（本家と同じ 28×16 / 0.65rem） |
| `helper/selection-tools/move-tool.js` | paint-snap 相当のスナップ + ガイド描画 + Ctrl 無効化 |
| `helper/selection-tools/bounding-box-tool.js` | 未選択からドラッグ開始時の青枠追従バグ修正 |
| `containers/fixed-tools.jsx`, `components/fixed-tools/*` | 画像剪断（crop）ボタン |
| `hocs/keyboard-shortcuts-hoc.jsx` | 単一キーのツール切替、`preventDefault` 追加 |
| `hocs/copy-paste-hoc.jsx` | 「元の位置に貼り付け」設定 |
| `containers/paper-canvas.jsx` | **沙箱をやめて直接 `importSVG`**（§5.3）、テーマ反映、フォールバック |
| `helper/layer.js` | `updateTheme()` を TurboWarp から移植 |
| `helper/selectable-shapes.js` | `import paper` 追加（Sussy ツールのクラッシュ修正） |
| `components/mode-tools/mode-tools.jsx` | Sussy の図形選択 UI、`intlShape` 修正 |
| `css/colors.css`, `containers/paper-canvas.css`, `components/loupe/loupe.css` | `--paint-*` CSS 変数化 |

> `containers/mode-tools.jsx` のテキスト→パス変換（`convertText2Path`）は
> Scratch VM のフォントマネージャ依存のため **スタブ化**している。
> テキストを含むブーリアン演算はできない（マージ時にテキストはスキップされる）。

### 5.2 Redux / i18n

- `src/store.js`: `combineReducers({intl, scratchPaint})`。
- `PaintEditor` は `state.scratchPaint` を必要とする。
- 文言は `src/locales.js` のフラットな ID → 文字列。
  `t()` は `intl.formatMessage({id, defaultMessage})`。
- ロケールは `localStorage` の `costume-studio.locale`（`i18n.js`）。

### 5.3 SVG 読み込み（重要・過去に何度も壊れた箇所）

`src/vendor/scratch-paint/containers/paper-canvas.jsx` の `importSvg()` が担当。

**現在の実装: 沙箱 iframe を使わず、メインウィンドウで直接 `paper.project.importSVG()`。**

経緯:
1. 上流 15.3.0 は沙箱 iframe（`helper/paper-sandbox.js` + `helper/paper-import.js`、
   `@scratch/scratch-svg-renderer` の `Sandbox`）経由で import していた。
2. この環境では iframe 内のコード分割チャンクが読み込めず、
   `Sandbox: timed out after 30000ms` → 30 秒後にビットマップへフォールバック、
   という症状が出た（「猫が表示されず、数十秒後に低画質になる」）。
3. 対策として、沙箱を外し Scratch 本来（沙箱導入前）の直接 import に戻した。

前処理（ここを消すと SVG が壊れる）:

```js
// 1. svg: 名前空間を除去
// 2. ルートに xmlns が無ければ補完
// 3. sanitizeSvg.sanitizeSvgText()（DOMPurify）
// 4. data-paper-data の不正 JSON を除去（stripInvalidPaperData）
// 5. paper.project.importSVG(svg, {expandShapes: true, onLoad, onError})
//    埋め込みラスターは load/error を待ってから initializeSvg()
```

**セキュリティ上の注意**: 沙箱を外したので、悪意ある SVG を読み込むと
メインウィンドウで DOM 挿入が走る。`sanitizeSvgText` は通しているが、
公開サービスとして使うなら沙箱の復活、または別オリジンでの iframe 実行を検討すること。

**未使用の残骸**: `helper/paper-sandbox.js` / `helper/paper-import.js` は
`paper-canvas.jsx` からは参照されなくなったが、`index.js` が
`prewarmPaperSandbox` を export し、`src/index.jsx` が呼んでいる。
無駄なチャンク（Paper 本体 244KB + iframe）を読み込むので、
**次の掃除対象**（`index.jsx` の prewarm 呼び出しと export を消す）。

### 5.4 ラスター読み込み（HD 画像）

`src/lib/files.js` の `rasterToHdSvg()`。
TurboWarp アドオン `better-img-uploads` の「fit」モードを移植:

- 元解像度のまま canvas に描き直し → PNG data URL 化（EXIF 除去）
- 480×360 に fit した SVG ラッパーを作り、**ベクターコスチュームとして読み込む**

失敗時は従来のビットマップ経路（960×720 に正規化）へフォールバック。

SVG 正規化（`sanitizeSvg`）では以下を実施:

- `width="100%" height="100%"` のときは属性を削除（TurboWarp `fix-uploaded-svgs`）
- `viewBox` が無ければ width/height から生成（Scratch `loadSvgString`）
- `viewBox` があり width/height が無ければ viewBox から補完（Scratch `normalizeSvg`）
- `mm/cm/in/pt/pc` を px に換算
- HTML 実体参照（`&nbsp;` 等）を `&#160;` に正規化
- XML として壊れている SVG はラスタライズしてビットマップとして開く

### 5.5 テーマ

- Redux: `state.scratchPaint.theme`（`'default' | 'dark' | 'light'`）
- 永続化: `localStorage` の `costume-studio.theme`（`reducers/theme.js` が初期値で読む）
- エディタ内部: `data-paint-theme` 属性 + `--paint-*` CSS 変数（`theme.global.css`）
- アプリ外枠: `.app[data-theme="dark"]`
- **portal される要素**（カラーピッカー、`Modal`）は `.app` の外なので、
  `body:has(.app[data-theme="dark"])` にも変数を定義している。ここを忘れると白く残る。

### 5.6 設定・バックアップ・localStorage キー

| キー | 内容 |
| --- | --- |
| `costume-studio.theme` | `'dark'` / `'light'` |
| `costume-studio.locale` | `'ja'` / `'en'` |
| `costume-studio.features.v1` | スナップ等の設定（`{enabled: {...}}`） |
| `costume-studio.backups.v1` | 復元ポイント（最大 10 件、合計 4.5MB） |
| `costume-studio.autosave.v1` | **旧自動保存。起動時に削除される**（互換のためキー名だけ残存） |

バックアップは「自動保存」ではない。手動 + 自動バックアップ設定時の5分ごとの定期保存。
同じ内容（名前・画像・サイズ・回転中心）のバックアップがすでにある場合は作成しない。
リロードすると空のキャンバスから始まる（意図した仕様）。

カスタムフォントは IndexedDB の `costume-studio-custom-fonts`（object store `fonts`）に
Data URL で保存する（最大 20 件、1 件 15 MB）。ファイルフォントは `FontFace` で登録し、
システムフォントは `local(...)` とフォールバックの組み合わせで登録する。
読み込めないフォントは、ユーザーが選んだフォールバック（同梱フォント）を同じ family 名で
登録して表示を保つ。SVG 書き出し時のパス化と PNG 書き出し時のフォント埋め込みには
`fontkit` を第一候補、`opentype.js` を第二候補として輪郭を取得する
（`src/lib/custom-fonts.js`）。`fontkit` は初回のフォント追加時に遅延ロードされる。
システムフォントは輪郭データを持たないため、パス化時はスキップしてテキストのまま残す。

テキストへのフォント適用は `TextTool.setFont` が Redux 更新後に走るため、画像更新を
同じティックで行うと古いフォントのままになる。`font-dropdown.jsx` では画像更新を
`setTimeout(0)` で遅延させている。

---

## 6. 実装済み機能一覧

### アプリ側

- 新規 / 開く（ファイル選択・ドラッグ＆ドロップ）/ 保存（SVG・PNG 1×・2×）
  - ヘッダーは **ファイル** / **バックアップ** / 保存形式のドロップダウンに集約
  - 保存ボタンのドロップダウンに SVG / パス化SVG / PNG 1× / PNG 2×
  - ファイルメニューに「読み込み」（現在のコスチュームに追加）
- 復元ポイント（手動保存・一覧・プレビュー・復元・削除、重複スキップ）
- カスタムフォント（フォントファイルまたはシステムフォント名、フォールバック、IndexedDB 保存、テキストツールのフォント一覧から追加）
- テキストをパス化（選択ツールで選択中のテキストを Paper.js で1文字ずつ別パスへ変換、元に戻せる）
- 拡張機能設定モーダル（ぼかし背景、約 75% サイズ、スナップの階層 UI）
- ヘルプ（ショートカット・ライセンス・クレジット）
- SVG コードパネル（CodeMirror 6）
- 言語切替、テーマ切替（エディタ右下のコントロールに統合）

### エディタ内蔵ツール（TurboWarp / PenguinMOD 由来）

| 機能 | 実装場所 |
| --- | --- |
| 三角・矢印ツール | `vendor/.../containers/triangle-mode.jsx`, `arrow-mode.jsx` |
| ペンツール | `vendor/.../helper/tools/pen-tool.js` |
| スタンプ（Sussy）ツール | `vendor/.../helper/tools/sussy-tool.js` + `selectable-shapes.js` |
| 角丸四角形（角丸半径スライダー） | `vendor/.../helper/tools/rect-tool.js` |
| ブーリアン（合体/マスク/差/除外） | `vendor/.../containers/mode-tools.jsx` |
| 整列・反転・グループ化 | `vendor/.../components/mode-tools/mode-tools.jsx` |
| 線の端・結合（丸/角/面取り） | 同上 |
| 16 進カラーピッカー + Opacity | `vendor/.../containers/color-picker.jsx` |
| スナップ + ガイド | `vendor/.../helper/selection-tools/move-tool.js` |
| 画像剪断（crop） | `vendor/.../containers/fixed-tools.jsx` |
| ダークテーマ | `vendor/.../helper/layer.js`, `reducers/theme.js` |
| ツールのキーボードショートカット | `vendor/.../hocs/keyboard-shortcuts-hoc.jsx` |

### ショートカット

| キー | 動作 |
| --- | --- |
| `S` / `A` / `B` / `E` / `F` / `T` / `L` / `C` / `R` | 選択 / 変形 / ブラシ / 消しゴム / 塗り / テキスト / 線 / 円 / 四角 |
| `P` / `Y` / `V` / `M` | ペン / 三角 / 矢印 / スタンプ（本アプリ独自） |
| `Ctrl/Cmd + Z` / `Shift+Z` | 元に戻す / やり直す |
| `Ctrl/Cmd + S` / `Shift+S` / `O` | 保存 / SVG 保存 / 開く |
| `Ctrl/Cmd + ↑` / `↓` | 手前に出す / 奥に下げる |
| `Ctrl/Cmd + Shift + ↑` / `↓` | 最前面 / 最背面 |
| `Ctrl/Cmd + G` / `Ctrl/Cmd + Shift+G` | グループ化 / 解除 |
| `Shift+H` / `Shift+V` | 左右反転 / 上下反転 |
| `Tab` / `Shift+Tab` | 選択履歴を前 / 後に移動 |
| `?` | ヘルプ |

`Ctrl+Z` 等はブラウザ側に奪われないよう `preventDefault` 済み。
コードパネル編集中はツールショートカットが発火しないようガード済み。

---

## 7. 既知の問題と次の作業

### 7.1 【修正済み・QC待ち】SVG コードパネルでエディタが縮む / マウス座標がずれる

#### 症状

- 「SVGコード」を開くとエディタが横に狭くなる。
- キャンバス上のマウス位置と実際に描画される位置がずれ、操作が難しい。

#### 現在の実装

`src/styles/theme.global.css` の `.editor-zoom` は `min-width: 0` で縮小可能にし、
SVG コードパネルとの flex レイアウトでキャンバス領域が実際に変わるようにした。

`src/vendor/scratch-paint/containers/paper-canvas.jsx` では `ResizeObserver` と
Paper.js の resize 通知を `requestAnimationFrame` でまとめ、キャンバスの実寸に合わせて
`recalibrateSize()` を実行する。その後、新しい view bounds で workspace の範囲を再計算し、
Redux の view bounds を更新する。アンマウント時には observer / pending frame を破棄する。

修正後に `npm run build` は成功した。ブラウザでのポインター位置・開閉反復の目視 QC はまだ。

#### 検証手順（必須）

`C:\Users\Kasam\AppData\Local\Temp\opencode\css-qc\test-mouse2.js` を参考に:

1. パネルを開く。
2. キャンバスの既知の座標（例: 幅の 20% / 40%）をドラッグ。
3. スクリーンショットで、描かれた図形がマウスの軌跡と一致するか目視確認。
4. パネル開閉を繰り返してもずれないこと。
5. ウィンドウ幅 1000px でも確認（`test-mouse-narrow.js`）。

### 7.2 その他の負債・注意点

| 項目 | 内容 |
| --- | --- |
| 沙箱の残骸 | `prewarmPaperSandbox()` が未使用なのに呼ばれている。削除可（§5.3） |
| セキュリティ | SVG をメインウィンドウで import している。公開前提なら要再検討 |
| テキストのブーリアン | `convertText2Path` がスタブ。テキストはマージ対象外 |
| スクリーンショット | `docs/screenshot*.png` は古い UI の可能性。UI 変更後に撮り直す |
| GitHub URL | `package.json` / `App.jsx` の `YOUR_NAME` を実値に置換する |
| git | まだ `git init` していない。**push はしない**方針（ユーザー指示） |

---

## 8. 検証方法（Playwright QC）

この環境では Playwright（`playwright-core`）+ Chromium で目視 QC を行っていた。
スクリプトはリポジトリ外の
`C:\Users\Kasam\AppData\Local\Temp\opencode\css-qc\` にある（引き継ぎ後は再作成が必要）。

参考スクリプト:

| ファイル | 用途 |
| --- | --- |
| `smoke.js` | 起動・キャンバス存在・console エラー確認 |
| `test-mouse2.js` / `test-mouse-narrow.js` | コードパネル開閉時の描画位置検証 |
| `test-panel-layout.js` | パネルとエディタの寸法・スクロール検証 |
| `shots-dark.js` / `probe-label.js` | ダークテーマ・カラーピッカーの目視確認 |
| `test-backup.js` | バックアップの保存・復元 |

実行例:

```powershell
cd $env:TEMP\opencode\css-qc
$env:CHROME_PATH="$env:USERPROFILE\AppData\Local\ms-playwright\chromium-1223\chrome-win64\chrome.exe"
node smoke.js
```

`npm run build` の後に `python -m http.server 4173` などで `dist/` を配信して検証する。

---

## 9. 本家ソースの参照場所

引き継ぎ時点で、比較用の本家ソースが下記に展開されていた（一時ディレクトリ、消える可能性あり）。

| パス | 内容 |
| --- | --- |
| `%TEMP%\opencode\tw-paint` | TurboWarp の `scratch-paint` フォーク（16 進ピッカー、Opacity、テーマ） |
| `%TEMP%\opencode\pm-paint` | PenguinMOD の `scratch-paint` フォーク（角丸四角形、Sussy、ペン、ブーリアン） |
| `%TEMP%\opencode\tw-addons` | Scratch Addons リポジトリ（`paint-snap`, `better-img-uploads`, `editor-dark-mode`, `fix-uploaded-svgs` など） |
| `%TEMP%\opencode\tw-gui` | TurboWarp GUI |
| `node_modules\@scratch\scratch-svg-renderer\src\load-svg-string.js` | Scratch の SVG 正規化（今も参照可能） |

移植元として特に重要なファイル:

- `tw-paint/src/lib/tw-color-utils.js`
- `tw-paint/src/containers/color-picker.jsx`
- `tw-paint/src/components/color-picker/color-picker.jsx`
- `tw-paint/src/components/tw-color-readout/*`
- `tw-paint/src/reducers/theme.js`, `src/helper/layer.js`（`updateTheme`）
- `tw-paint/src/hocs/keyboard-shortcuts-hoc.jsx`
- `tw-addons/addons/paint-snap/*`（`genSnapPoints.js`, `updateSelectTool.js`, `state.js`）
- `tw-addons/addons/better-img-uploads/userscript.js`
- `tw-addons/addons/editor-dark-mode/addon.json`（プリセット `tw-dark`）
- `tw-addons/addons/fix-uploaded-svgs/userscript.js`
- `pm-paint/src/helper/tools/{rect-tool,rounded-rect-tool,sussy-tool,pen-tool}.js`
- `pm-paint/src/components/mode-tools/mode-tools.jsx`

---

## 10. GitHub 公開前チェックリスト

- [ ] `package.json` の `homepage` / `repository` / `bugs` の `YOUR_NAME` を置換
- [ ] `src/App.jsx` の `SOURCE_URL` / `LICENSE_URL` の `YOUR_NAME` を置換
- [ ] `docs/screenshot*.png` を最新 UI で撮り直す（ライト / ダーク両方あると良い）
- [ ] `.github/workflows/deploy.yml` の Pages 設定を確認
- [ ] `LICENSE` / `NOTICE` / `THIRD_PARTY_NOTICES.md` / `TRADEMARK` の内容を再確認
- [ ] `prewarmPaperSandbox()` の残骸を削除（§5.3）
- [ ] SVG コードパネルのリサイズ問題を修正（§7.1）
- [ ] `git init` はユーザー指示があるまで行わない / **push しない**

---

## 11. 落とし穴メモ

1. **`grep` は PowerShell に無い。** `Select-String` か `rg` を使う。
   （過去に存在しない `grep` を繰り返し実行してループした）
2. **`dist/` は自動で更新されない。** 変更後は必ず `npm run build`。
   検証時に古い `dist/` を見て「直っていない」と誤認しやすい。
3. **portal される UI（Popover / Modal）は `.app` の外。**
   テーマ変数は `body:has(.app[data-theme="dark"])` にも必要。
4. **`state.scratchPaint.format` は `'VECTOR'` / `'BITMAP'`**（`'vector'` ではない）。
   `state.scratchPaint.mode` も `Modes.*` のキー文字列。
5. **`onUpdateImage` の引数**: `(isVector, image, rotationCenterX, rotationCenterY)`。
   ベクターは SVG 文字列、ビットマップは `ImageData`。
6. **`imageId` を変えるとエディタが再初期化される**（ズームも再フィット）。
   外部から絵を差し替える時はこの仕組みを使う。
7. **`zoomLevelId`** は `costume-studio-${imageId}`。同じ ID の間はズーム位置が保持される。
8. **`scratch-paint` の CSS は CSS Modules**（`*.global.css` 以外）。
   グローバルに効かせたい時は `theme.global.css` 側に書く。
9. **`:global()` を通常の CSS ファイルに書かない。** webpack の CSS Modules 設定外だと
   セレクタごと無効になり、ルール全体が消える（過去にカラーピッカーのダーク化が効かなかった原因）。
10. **`npm install` 後は依存が増えている可能性がある。** `package.json` の
    `@codemirror/*` は SVG コードパネル用。

---

## 12. 連絡・引き継ぎ時の推奨手順

1. `npm install && npm run build` が通ることを確認。
2. `npm run preview` で起動し、`smoke.js` 相当の確認（キャンバスが出る、console エラーなし）。
3. SVG の読み込みは、権利上配布可能なテスト素材で回帰確認する。
4. SVG コードパネルを開いて §7.1 の症状を再現 → 修正 → 目視 QC。
5. ダークテーマで「カラーピッカー / モーダル / ステータスバー / 入力欄」を目視確認。
6. バックアップの保存 → リロード → 復元を確認。
