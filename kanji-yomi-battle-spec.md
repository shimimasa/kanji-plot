# 漢字読みバトル 仕様書

## 目次
1. [はじめに（目的／背景／ターゲット）](#はじめに目的背景ターゲット)  
2. [全体構成図（画面マップ、State遷移図）](#全体構成図画面マップstatet遷移図)  
3. [詳細機能仕様](#詳細機能仕様)  
   - [バトルシステムの流れ](#バトルシステムの流れ)  
   - [ステージ選択・進行ロジック](#ステージ選択進行ロジック)  
   - [属性・レベルアップ計算式](#属性レベルアップ計算式)  
   - [漢字出題ロジック（正解判定、タイムリミットなど）](#漢字出題ロジック正解判定タイムリミットなど)  
   - [漢字図鑑・モンスター図鑑の動作説明](#漢字図鑑モンスター図鑑の動作説明)  
   - [設定画面の切り替え機能（色覚配慮や文字サイズなど）](#設定画面の切り替え機能色覚配慮や文字サイズなど)  
4. [データ構造](#データ構造)  
   - [各JSON/YAMLのスキーマ定義](#各jsonyamlのスキーマ定義)  
   - [Firebase/DB設計（コレクション・ドキュメント構造）](#firebasedb設計コレクションドキュメント構造)  
5. [UI/UX要件](#uiux要件)  
   - [各画面レイアウトの説明](#各画面レイアウトの説明)  
   - [ペルソナ別に配慮すべきポイント](#ペルソナ別に配慮すべきポイント)  
6. [技術要件・環境設定](#技術要件環境設定)  
   - [フレームワーク・ライブラリ一覧](#フレームワークライブラリ一覧)  
   - [ビルド／デプロイ手順](#ビルドデプロイ手順)  
   - [PWA化手順（Workbox, manifest.jsonなど）](#pwa化手順workbox-manifestjsonなど)  
7. [開発フェーズとリリース計画](#開発フェーズとリリース計画)  
   - [現在までに完了しているフェーズ](#現在までに完了しているフェーズ)  
   - [次に実装予定の機能一覧（優先度順）](#次に実装予定の機能一覧優先度順)  
   - [中長期の拡張機能ロードマップ](#中長期の拡張機能ロードマップ)  
8. [付録](#付録)  
   - [使用素材一覧](#使用素材一覧)  
   - [用語集（漢字属性の定義、Game用語など）](#用語集漢字属性の定義game用語など)  

---

## 1. はじめに（目的／背景／ターゲット）

### 1.1 目的
- 小学生が漢字の読み（音読み・訓読み）をゲーム感覚で楽しく学習し、定着させることを目的とする。
- バトル要素を取り入れることで、学習意欲を継続的に維持し、復習機能を通じて知識の定着を促す。

### 1.2 背景
- 現代の小学生はデジタルコンテンツに慣れており、従来のドリル式だけでは学習モチベーションを維持しづらい。
- 地方ごとの名産品をモチーフにしたモンスターを登場させることで、地域学習との掛け合わせや興味喚起を図る。
- スペースドリピティションの仕組みを将来的に導入し、学習効率を向上させることを念頭に置いた設計。

### 1.3 ターゲット
- 小学校低学年〜中学年で、漢字読みの習得に苦手意識を持つ児童。
- ADHD傾向がある子どもでも直感的に操作できる UI を重視。
- 学習塾のサブ教材として、指導者（先生）がクラス単位で利用できる想定。

### 1.4 プラットフォーム・動作環境
- **Webブラウザ対応**（PC／タブレット）  
  - Canvas API を用いた自前描画。  
  - HTML5 の `<input>` 要素をオーバーレイで利用。  
- **PWA化対応予定**（オフラインキャッシュ、ホーム画面アイコン追加）  
- **必要環境**  
  - Google Chrome, Firefox, Safari など主要ブラウザ最新バージョン  
  - インターネット接続：Firebase 同期時のみ必須。オフラインモード時はキャッシュから読み込み。  
- **オフラインデータ同期とエラーハンドリング**  
  - オフライン時に進行したデータ（ステージクリア状況、獲得経験値、図鑑更新、プレイヤーステータス等）は `localStorage` と Firestore Persistence にキャッシュされる。  
  - オンライン復帰後、`DataSync.syncAll()` がローカル変更とサーバー上のデータをマージ:  
    - **マージ方針**: 最終更新タイムスタンプを比較し、より新しいデータを優先して採用。  
    - **衝突時**: タイムスタンプ優先で自動解決し、重大な不整合が疑われる場合はユーザーに確認ダイアログを表示。  
  - **通信エラー時**:  
    - 読み書き失敗時に画面上部にエラーメッセージを表示し、「再試行」ボタンを提供。  
    - 同期失敗が継続する場合はバナーで警告し、オフラインモードでの継続利用を許可。  

---

## 2. 全体構成図（画面マップ、State遷移図）

### 2.1 画面マップ
以下の画面がアプリケーション全体を構成する。  
┌──────────────────────────────────────────────────────┐
│ タイトル画面 (titleScreen)                          │
│   ├─ (初回起動またはプレイヤーデータ未登録時)      │
│   │    プレイヤー名入力画面 (playerNameInputScreen) │
│   └─ (プレイヤーデータ登録済み／入力完了時)        │
│        → メインメニュー画面 (menuScreen)           │
└──────────────────────────────────────────────────────┘
      │                     │
      │「冒険を始める」      │「設定」
      ▼                     ▼
メインメニュー画面           設定画面 (settingsScreen)
(menuScreen)                 
      │
      │「冒険を始める」
      ▼
ステージ選択画面 (stageSelectScreen)  

### 2.2 State 遷移図
アプリケーション起動時に `core/fsm.js` + `core/stateMachine.js` で以下のステートマシンが構築される。  

[Loading]
│ (アセット・データ読み込み完了)
▼
[Title]
│ (初回起動またはプレイヤーデータ未登録時) → [PlayerNameInput]
│ (それ以外) → [Menu]
│ 「冒険を始める」／「設定」ボタン
▼
[PlayerNameInput]
│ 「決定」 → [Menu]
▼
[Menu]
│ 「冒険を始める」 → [StageSelect]
│ 「設定」 → [Settings]
▼
[StageSelect]
│ 都道府県選択
▼
[Battle]
│ ステージ勝利 → 「リザルト」へ
│ ステージ敗北 → 「ゲームオーバー」へ
▼
[ResultWin] ← バトル勝利
│「次のステージへ」 or 「ステージ選択へ戻る」
▼
[StageSelect]

[ResultLose] ← バトル敗北
│「リトライ」 or 「タイトルへ」
▼
[StageSelect] or [Title]

[KanjiDex] ← ステージ選択画面の「漢字図鑑」
│「戻る」
▼
[StageSelect]

[MonsterDex] ← ステージ選択画面の「モンスターデックス」
│「戻る」
▼
[StageSelect]

[ReviewStage] ← ステージ選択画面の「復習モード」
│「終了」
▼
[StageSelect]

[Settings] ← どの画面からも「設定」へ遷移可能
│「戻る」
▼
[Menu] or [StageSelect]

---

## 3. 詳細機能仕様

### 3.1 バトルシステムの流れ

1. **ステージ選択**  
   - プレイヤーが都道府県アイコンをクリックすると、対応する `stageId` を引数に `battleStateFactory.js` で `BattleState` を生成し、`battleScreen.js` に遷移。  
   - 生成時に以下のデータを読み込む：  
     - `kanjiPoolIdList` から該当する漢字リスト（`kanji_gX_proto.json`）を取得  
     - `enemyIdList` から該当する敵情報（`enemies_proto.json`）を取得  

2. **バトル開始**  
   - 敵がランダムまたは順番に出現。敵ごとに `hp`, `attack`, `weakness`, `exp`, `image` を設定。  
   - プレイヤーの初期ステータスは `gameState.playerStats` より取得（`level`, `maxHp`, `attack`, `exp`, `nextLevelExp`）。  

3. **問題提示**  
   - `currentKanji`（ランダムまたはキュー順に選択された漢字）を画面中央の「漢字ボックス」に描画。  
   - ボックス上部に「弱点属性」（音読み or 訓読み）を黄色文字で表示。  
   - ボックス上部に「弱点属性」（`currentKanji.weakness` の値に応じて「音読み」または「訓読み」）を黄色文字で表示。  
   - プレイヤーは画面下部の HTML `<input id="kanjiInput">` に読みを入力し、Enter または「こうげき」ボタンを押す。  

4. **正誤判定**  
   - 入力文字列を `currentKanji.onyomi` と `currentKanji.kunyomi` と比較する。  
     - **正解**：  
       - ダメージ計算（属性システム未実装の場合は固定ダメージ、実装後は弱点の場合 1.5 倍ダメージ）  
       - 敵HP を減算。効果音: `audioManager.playSE('correct')` ＋ `audioManager.playSE('attack')`  
       - HP が 0 なら敵撃破 → EXP 加算 → 次の敵 or ステージクリア判定  
     - **誤答**：  
       - プレイヤーにダメージ（固定ダメージ、実装後は敵の属性弱点対応ダメージ）  
       - 効果音: `audioManager.playSE('wrong')` ＋ `audioManager.playSE('damage')`  
       - HP が 0 なら **ゲームオーバー画面** へ遷移。  

5. **敵ターン**  
   - 敵が生き残っている場合は一定時間経過後に自動で攻撃アニメーション → プレイヤーにダメージ。  
   - 効果音: `audioManager.playSE('attack')` ＋ `audioManager.playSE('damage')`  
   - プレイヤーHP が 0 なら **ゲームオーバー画面** へ遷移。  

6. **ステージクリア判定**  
   - すべての敵を倒したらステージクリア  
   - `savePlayerData(gameState.playerStats)` → Firestore 保存  
   - `saveStageClearStatus(currentStageId)` → Firestore 保存 + `gameState.stageProgress` 更新  
   - **勝利リザルト画面** (`resultWinScreen.js`) に遷移。経験値ゲージのアニメーション表示 → 「次のステージへ」または「ステージ選択へ戻る」。  
   - 次ステージは `stages_proto.json` の `unlockCondition` を参照し、前段階ステージがクリア済みかチェック。  

7. **ゲームオーバー**  
   - プレイヤーHP が 0 になったら **ゲームオーバー画面** (`gameOverScreen.js`) に遷移。  
   - 「リトライ」→ `StageSelect` へ戻る  
   - 「タイトルへ」→ `Title` へ戻る  

---

### 3.2 ステージ選択・進行ロジック

1. **学年タブ切り替え**  
   - 画面上部に「1年～6年＋総復習」のタブを横並び表示。  
   - タブの幅＝`canvas.width / 7`、高さ＝50px、テキスト 24px UD フォント。  
   - タブ右上に「クリア率」を赤背景の小ラベルで表示（フォント 12px）。  
   - タブをクリックすると、その学年に対応するステージ一覧を表示。  

2. **地方選択**  
   - 選択中の学年に紐づく `stages_proto.json` の中から地方名（例：「北海道」「関東」「近畿」など）ごとにグルーピングし、マップアイコンまたはリストとして画面に描画。  
   - アイコン下部に地方名テキスト（20px UD）。選択中の地方アイコンは枠線を強調。  

3. **都道府県選択**  
   - 選択された地方の `stage` 配列を参照し、都道府県アイコン（マーカー画像 32×32px）を `stage.pos` の座標で Canvas 上に描画。  
   - クリア済みステージはサムネイルカラー、未クリアはグレースケール化（CSS クラス `.locked` 適用）。  
   - 都道府県アイコンをクリックすると、`changeScreen('battle', [canvas, victoryCallback])` を呼んでバトル開始。  

4. **下部メニュー**  
   - 「もどる」「復習する」「漢字図鑑」「モンスターデックス」の各ボタンを横一列に配置。  
     - ボタンサイズ＝150×40px、フォント 16px UD、背景色 `--clr-main`（青系）。  
     - ボタン間隔＝20px、左マージン＝50px、Y 座標＝520px。  
   - 各ボタンの機能：  
     - 「もどる」→ `StageSelect` 画面で学年選択に戻る  
     - 「復習する」→ `ReviewStage` 画面に遷移（復習モード）  
     - 「漢字図鑑」→ `KanjiDexScreen` 画面  
     - 「モンスターデックス」→ `MonsterDexScreen` 画面  

---

### 3.3 属性・レベルアップ計算式

#### 3.3.1 属性システム（音読み／訓読み弱点）
- `weakness` フィールド (string): 漢字・敵ともに、"onyomi" または "kunyomi" のいずれかが必ず設定される。
- JSON例（`kanji_g1_proto.json`）:
  ```jsonc
  {
    "id": "gX-YYY",
    "kanji": "一",
    "onyomi": "イチ イツ",
    "kunyomi": "ひと",
    "weakness": "onyomi",         // 弱点属性 ("onyomi" または "kunyomi")
    ...
  }
  ```
- ダメージ計算:
  - **初期実装 (属性システム未実装)**  
    - プレイヤー正解ダメージ = 固定ダメージ (例: baseDamage)  
    - プレイヤー誤答時被ダメージ = 固定ダメージ (例: enemy.attack)  
  - **属性システム導入後**  
    - プレイヤー攻撃ダメージ = baseDamage × (answerType === currentKanji.weakness ? 1.5 : 1)  
    - 敵攻撃ダメージ = enemy.attack × (playerAttackAttribute === enemy.weakness ? 1.5 : 1)  
- 将来的拡張:  
  - 敵にも `attackAttribute` フィールドを追加し、プレイヤーの弱点属性と一致した場合に被ダメージ倍率を適用。  
  - `correctCount`/`incorrectCount`/`accuracy` を学習統計に利用。  

3.3.2 経験値・レベルアップ計算式
現在実装済み：

敵を倒すと enemy.exp を gameState.playerStats.currentExp に加算。

playerExp ≥ nextLevelExp でレベルアップ判定。

js
コピーする
編集する
playerLevel += 1;
playerExp = playerExp - nextLevelExp;
nextLevelExp = Math.floor(nextLevelExp * 1.5);
maxHp += 10;        // 例: レベルアップごとに最大HPを+10
attack += 2;        // 例: レベルアップごとに攻撃力を+2
healCount = 3;      // 回復可能回数をリセット
レベルアップ時に savePlayerData(gameState.playerStats) を呼び、Firestore に保存。

リザルト画面で「レベルアップ」演出を表示し、ゲージバーがリセットされるアニメーションを実装。

拡張予定：

ステージ難易度に応じた経験値補正（ボス戦なら ×1.5）。

レベルアップ時に「スキルポイント」を付与し、プレイヤーが任意に振り分け可能な仕組みを追加。

経験値テーブルを静的配列に置き換え、レベルごとの必要経験値を明確化する。

3.4 漢字出題ロジック（正解判定、タイムリミットなど）
漢字プール生成

stages_proto.json の kanjiPoolIdList を参照し、各 kanji_gX_proto.json の該当オブジェクトを配列として読み込む。

例:

jsonc
コピーする
編集する
{
  "stageId": "kanto_area1",
  "kanjiPoolIdList": ["g3-001", "g3-002", …],
  …
}
問題抽出

ランダムまたはキュー（スペースドリピティション用）順に currentKanji を選択。

問題ごとにソートや重み付けを行う場合、correctCount / incorrectCount / accuracy を考慮し、優先的に精度の低い漢字を出題する拡張予定。

タイムリミット

現状プロトタイプではタイムリミット機能は未実装。

拡張案：

各問題に「制限時間 10 秒」を設定し、残り時間がゼロになると自動で誤答扱い。

進捗バーを画面に表示し、時間経過に合わせてバーが減少する。

正解判定

入力文字列 (inputValue) をトリムした上で currentKanji.onyomi.split(' ') あるいは currentKanji.kunyomi.split(' ') のいずれかに含まれていれば正解と判定。

判定結果に応じてダメージ演出（属性倍率適用）と効果音再生を行う。

フィードバック表示

正解時: 漢字ボックス枠を緑色フラッシュ、audioManager.playSE('correct')

誤答時: 漢字ボックス枠を赤色フラッシュ、audioManager.playSE('wrong')

正誤結果を「メッセージログ欄」に最新のログとして追加し、マウスホイールで履歴を閲覧可能。

3.5 漢字図鑑・モンスター図鑑の動作説明
3.5.1 漢字図鑑（kanjiDexScreen.js）
レイアウト

背景色: #1e3c72

タイトル: 漢字図鑑（24px UD、白、中央 x=400,y=70）

収集状況カウンタ: 右上に 10/80 など（18px UD、白、x=780,y=40）

戻るボタン: x=20,y=20,w=100,h=30, テキスト14px UD

漢字リスト表示

1行の高さ: 40px (lineH = 40)

1ページあたり最大 10 行表示

各行:

漢字（32px serif、色: 白/グレー）、x = 50

読み（14px UD、色: 白/グレー）、x = 100

画数（14px UD、色: 白/グレー）、x = 200

意味（14px UD、色: 白/グレー）、x = 300

未収集の漢字は「？？？」を 32px serif、色: グレーで表示。

キーボード上下キーで this.scroll を ±1 行ずつ変更し、表示範囲を制御。

収集条件
- 漢字図鑑で「収集済み」として表示されるのは、バトルで一度でも正解回答した漢字。
- ステージで一度でも問題として提示された漢字。

3.5.2 モンスターデックス（monsterDexScreen.js）
レイアウト

Canvas は非表示にし、HTML <div id="monsterContainer"> をグリッド表示。

.monster-card クラス: 幅 150px、テキストセンター揃え、画像は幅 100% 自動高さ。

グリッド: 5列固定 (grid-template-columns: repeat(5, 150px))、隙間 10px、中央寄せ。

戻るボタン: .back-button (grid-column: 1 / -1; padding:8px 12px; 背景色 #555; 文字色 #fff;)

遅延読み込み

IntersectionObserver でビューポートに img が入ったら data-src="thumb/{id}.webp" を src 属性にセット。

カード表示

<img src="assets/images/monsters/thumb/{monster.id}.webp">

モンスター名: <p class="monster-name">（14px UD、白）

未収集時: .locked { filter: grayscale(1) brightness(0.3); } を適用し、名前を「？？？」に置き換える。

クリック動作

カードクリック → <img src="assets/images/monsters/full/{id}.webp"> をモーダル表示。

収集条件
- モンスターデックスで「収集済み」として表示されるのは、バトルで一度でも撃破したモンスター。
- バトルで一度でも遭遇したモンスター。

3.6 設定画面の切り替え機能（色覚配慮や文字サイズなど）
3.6.1 設定画面レイアウト（settingsScreen.js）
背景: 黒一色

タイトル: 設定（40px UD、白、中央 x=400,y=100）

BGM 音量スライダー

ラベル: BGM音量（24px UD、白、x=400,y=150）

<input type="range" id="bgmSlider"> を Canvas 上に配置: x=300,y=160,w=200; 値域 0.00～1.00, ステップ 0.01

SE 音量スライダー

ラベル: SE音量（24px UD、白、x=400,y=190）

<input type="range" id="seSlider">: x=300,y=200,w=200; 同上

チェックボックス

色弱モード: <input type="checkbox" id="cbColorBlind"> 色弱フレンドリーモード

配置: x=520,y=160; テキスト 20px UD, 白

トグル時: document.body.classList.toggle('cb-mode') → --clr-main / --clr-accent を変更

文字サイズ+20%: <input type="checkbox" id="cbBigFont" checked> 文字サイズ+20%

配置: x=520,y=200; テキスト 20px UD, 白

トグル時: document.body.classList.toggle('big-font') → --fs-base を 19.2px に変更

データリセットボタン

x=275, y=250, w=250, h=50, テキスト18px UD, 背景 #c0392b
押下時:
  window.confirm('本当にデータをリセットしますか？\nローカルストレージおよびFirestore上のユーザーデータが完全に初期化されます。この操作は取り消せません。') →
    localStorage.clear()                         // ブラウザのローカルストレージを全削除
    Firestore の users/{uid}/profile/playerStats、progress/*、state ドキュメントを削除 →
    DataSync.syncAll()                           // Firestore から初期状態データを取得し、ローカルストレージおよびゲーム State に反映。存在しない場合はデフォルトデータを作成・保存
    publish('changeScreen','title')              // タイトル画面へ遷移

戻るボタン

x=275,y=400,w=250,h=50, テキスト18px UD, 背景 #1e90ff → 「メインメニューへもどる」

3.6.2 カスタムプロパティと CSS (style.css)
css
コピーする
編集する
:root {
  --clr-main: #1e90ff;
  --clr-accent: #ff6347;
  --fs-base: 16px;
}
body.cb-mode {
  /* 色弱モード */
  --clr-main: #005bbb;
  --clr-accent: #b15b00;
}
body.big-font {
  /* 文字サイズ +20% */
  --fs-base: 19.2px;
}
html, body {
  font-size: var(--fs-base);
}
.btn {
  background: var(--clr-main);
  color: white;
  border-radius: 5px;
}
.btn-accent {
  background: var(--clr-accent);
  color: white;
  border-radius: 5px;
}
.game-input {
  position: absolute;
  padding: 10px;
  font-size: 24px;
  text-align: center;
  border: 2px solid #ccc;
  border-radius: 5px;
  width: 300px;
  z-index: 10;
}
標準モード: 主色 #1e90ff, アクセント色 #ff6347, フォント16px

色弱モード: 主色 #005bbb, アクセント色 #b15b00, フォント16px

大文字モード: フォント19.2px

4. データ構造
4.1 各JSON/YAMLのスキーマ定義
4.1.1 学年別漢字データ（kanji_gX_proto.json）
jsonc
コピーする
編集する
[
  {
    "id": "gX-YYY",               
    "stageId": "region_areaN",    
    "kanji": "漢字文字列",         
    "grade": X,                   
    "strokes": N,                 
    "onyomi": "オンヨミ表記",       // 音読み (スペース区切りで複数読みをカタカナ表記; 判定時はひらがなに変換)
    "kunyomi": "クンヨミ表記",      // 訓読み (スペース区切りで複数読みをひらがな表記; 送りがななし, 空文字可)
    "weakness": "onyomi",          
    "meaning": "意味説明",         
    ...
  },
  …
]
id: 一意識別子。例: "g1-001"

stageId: どのステージで出題されるか。例: "hokkaido_area1"

onyomi: 音読みの読み方。スペース区切りで複数読みをカタカナ表記で格納。判定時はひらがなに正規化して比較。

kunyomi: 訓読みの読み方。スペース区切りで複数読みをひらがな表記（送りがななし）で格納。空文字可。

weakness: 弱点属性判定に使用。文字列型で "onyomi" または "kunyomi" のいずれかを必ず格納。

correctCount/incorrectCount/accuracy: スペースドリピティションや学習統計に利用。

4.1.2 敵キャラクター定義（enemies_proto.json）
jsonc
コピーする
編集する
[
  {
    "id": "prefectureID-E###",     
    "name": "夕張メロン",            
    "prefecture": "北海道",          
    "hp": 100,                     
    "attack": 10,                  
    "weakness": "onyomi",          // 弱点属性 ("onyomi" または "kunyomi")
    "exp": 20,                     
    "image": "assets/images/enemy/1_夕張メロン.png"
  },
  …
]
id: ステージID + モンスター番号の組み合わせ。

hp/attack/exp: バトルロジックに使用するパラメータ。

weakness: 弱点属性判定に使用。文字列型で "onyomi" または "kunyomi" のいずれかを必ず格納。

4.1.3 ステージ定義（stages_proto.json）
jsonc
コピーする
編集する
[
  {
    "stageId": "hokkaido_area1",       // 一意ステージID
    "grade": 1,                        // 学年 (1〜6)
    "region": "北海道",                // 地方名
    "prefecture": "北海道",           // 都道府県名（原則、都道府県名のみを格納。市区町村レベルの名称が必要な場合は別途 `cityName` などのフィールドを追加推奨）
    "kanjiPoolIdList": ["g1-001", …],  // 出題する漢字ID配列
    "enemyIdList": ["hokkaido-E01", …],// 出現する敵ID配列
    "recommendedLevel": 1,             // 推奨レベル
    "unlockCondition": {
      "prevStageId": null,             // 直前ステージID (null = 最初)
      "clearCount": 0                  // 直前ステージクリア回数
    }
  },
  {
    "stageId": "kanto_area1",
    "grade": 3,
    "region": "関東",
    "prefecture": "東京",
    "kanjiPoolIdList": ["g3-001", …],
    "enemyIdList": ["kanto_area1-E001", …],
    "recommendedLevel": 3,
    "unlockCondition": {
      "prevStageId": "kanto_area0",
      "clearCount": 1
    }
  },
  …
]
stageId: 一意の文字列

kanjiPoolIdList: 該当ステージで出題する漢字ID

enemyIdList: 該当ステージで出現する敵ID

unlockCondition: 直前ステージがクリアされたときにアンロック

prefecture: 都道府県名（例: "北海道"。市区町村単位で管理する場合は `cityName` や `areaName` フィールドを別途追加することを推奨）

4.1.4 BGM／SE データ構造
ファイル配置:

bash
コピーする
編集する
/assets/audio/
├─ bgm_title.mp3
├─ bgm_battle.mp3
├─ bgm_victory.mp3
├─ boss.mp3
├─ partial.mp3
├─ se_appear.mp3
├─ se_attack.mp3
├─ se_correct.mp3
├─ se_damage.mp3
├─ se_decide.mp3
├─ se_defeat.mp3
├─ se_heal.mp3
├─ se_miss.mp3
└─ se_wrong.mp3
audio/audio.js

js
コピーする
編集する
export class AudioPlayer {
  constructor(url, loop = false) {
    this.audio = new Audio(url);
    this.audio.loop = loop;
    this.audio.preload = "auto";
  }
  play() {
    if (!this.audio.paused) return;
    this.audio.currentTime = 0;
    this.audio.play();
  }
  stop() {
    if (this.audio.paused) return;
    this.audio.pause();
    this.audio.currentTime = 0;
  }
  setVolume(volume) {
    this.audio.volume = Math.min(Math.max(volume, 0), 1);
  }
}
audio/audioManager.js

js
コピーする
編集する
import { AudioPlayer } from "../audio/audio.js";

export class AudioManager {
  constructor() {
    this.bgm = {
      title: new AudioPlayer("assets/audio/bgm_title.mp3", true),
      battle: new AudioPlayer("assets/audio/bgm_battle.mp3", true),
      victory: new AudioPlayer("assets/audio/bgm_victory.mp3", true),
      boss: new AudioPlayer("assets/audio/boss.mp3", true),
      partial: new AudioPlayer("assets/audio/partial.mp3", false)
    };
    this.se = {
      appear: new AudioPlayer("assets/audio/se_appear.mp3", false),
      attack: new AudioPlayer("assets/audio/se_attack.mp3", false),
      correct: new AudioPlayer("assets/audio/se_correct.mp3", false),
      damage: new AudioPlayer("assets/audio/se_damage.mp3", false),
      decide: new AudioPlayer("assets/audio/se_decide.mp3", false),
      defeat: new AudioPlayer("assets/audio/se_defeat.mp3", false),
      heal: new AudioPlayer("assets/audio/se_heal.mp3", false),
      miss: new AudioPlayer("assets/audio/se_miss.mp3", false),
      wrong: new AudioPlayer("assets/audio/se_wrong.mp3", false)
    };
    this.masterVolume = 1.0;
    this.bgmVolume = 0.6;
    this.seVolume = 1.0;
  }

  playBGM(key) {
    for (const bgmKey in this.bgm) {
      this.bgm[bgmKey].stop();
    }
    if (this.bgm[key]) {
      this.bgm[key].setVolume(this.masterVolume * this.bgmVolume);
      this.bgm[key].play();
    }
  }

  playSE(key) {
    if (this.se[key]) {
      this.se[key].setVolume(this.masterVolume * this.seVolume);
      this.se[key].play();
    }
  }

  setMasterVolume(value) {
    this.masterVolume = Math.min(Math.max(value, 0), 1);
    Object.values(this.bgm).forEach(player => player.setVolume(this.masterVolume * this.bgmVolume));
    Object.values(this.se).forEach(player => player.setVolume(this.masterVolume * this.seVolume));
  }

  setBGMVolume(value) {
    this.bgmVolume = Math.min(Math.max(value, 0), 1);
    Object.values(this.bgm).forEach(player => player.setVolume(this.masterVolume * this.bgmVolume));
  }

  setSEVolume(value) {
    this.seVolume = Math.min(Math.max(value, 0), 1);
    Object.values(this.se).forEach(player => player.setVolume(this.masterVolume * this.seVolume));
  }
}
4.2 Firebase/DB設計（コレクション・ドキュメント構造）
4.2.1 Firestore コレクション構造
yaml
コピーする
編集する
users (コレクション)
└─ <UID> (ドキュメント)
   ├ name: string
   ├ level: number
   ├ currentExp: number
   ├ maxHp: number
   ├ attack: number
   ├ nextLevelExp: number
   ├ lastUpdatedAt: timestamp
   ├ createdAt: timestamp
   ├ progress (サブコレクション)
   │   └─ <stageId> (ドキュメント)
   │       ├ cleared: boolean
   │       └ clearedAt: timestamp
   └ state (ドキュメント) ← dataSync 用
       ├ kanjiDex: array
       ├ monsterDex: array
       └ reviewQueue: object

- **メリット**
  - `users/<UID>` ドキュメント1つでプレイヤーステータスを取得できるため、読み取り回数とレイテンシを削減。
  - データ構造がシンプルになり、管理や権限設定が容易。

4.2.2 セキュリティルール例
gfile
コピーする
編集する
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/profile/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /users/{userId}/progress/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /users/{userId}/state {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
匿名認証ユーザーでも request.auth.uid が一致すればアクセス可能。

他ユーザーのデータは参照・書き込み不可。

5. UI/UX要件
5.1 各画面レイアウトの説明
5.1.1 Canvas 共通設定
想定解像度: 800×600 px（固定）

フォントファミリー: 'UDデジタル教科書体', sans-serif

共通色:

--clr-main: #1e90ff (青系)

--clr-accent: #ff6347 (オレンジ系)

--fs-base: 16px

5.1.2 タイトル画面 (titleScreen.js)
背景: 黒一色

ロゴ: assets/images/logo.png を中央 x=400,y=200、幅 300px で描画

「冒険を始める」ボタン

x=250,y=350,w=300,h=60

フォント: 24px UD、色: 白、背景: #2ecc71 (緑)

ホバー: 明るめの緑に変化

「設定」ボタン

x=300,y=450,w=200,h=50

フォント: 20px UD、色: 白、背景: #3498db (青)

ホバー: 明るめの青に変化

フッター: 12px UD、「© 2025 漢字読みバトル」 を中央 x=400,y=580 に表示

5.1.3 プレイヤー名入力画面 (playerNameInputScreen.js)
背景: 黒一色

見出しテキスト

js
コピーする
編集する
ctx.fillStyle = 'white';
ctx.font = '30px "UDデジタル教科書体"';
ctx.textAlign = 'center';
ctx.fillText('なまえを にゅうりょく してください', 400, 150);
ctx.font = '24px "UDデジタル教科書体"';
ctx.fillText('(10もじまで)', 400, 200);
HTML <input id="playerNameInputField">

CSS:

css
コピーする
編集する
.game-input {
  position: absolute;
  padding: 10px;
  font-size: 24px;
  text-align: center;
  border: 2px solid #ccc;
  border-radius: 5px;
  width: 300px;
  z-index: 10;
}
表示位置: x=400-150=250, y=300, サイズ: w=300,h≈40, 中央揃え

「決定」ボタン

x=400-100=300, y=400, w=200, h=50

フォント: 16px UD、色: 白、背景: --clr-main

ホバー: 明るい青に変化

5.1.4 メインメニュー画面 (menuScreen.js)
背景: 黒一色

タイトル

js
コピーする
編集する
ctx.fillStyle = 'white';
ctx.font = '40px "UDデジタル教科書体"';
ctx.textAlign = 'center';
ctx.fillText('メインメニュー', 400, 100);
プレイヤー名表示

js
コピーする
編集する
if (gameState.playerName) {
  ctx.font = '20px "UDデジタル教科書体"';
  ctx.fillText(`ようこそ、${gameState.playerName} さん`, 400, 150);
}
ボタン

「冒険を始める」

x=400-150=250, y=250, w=300, h=60

フォント: 24px UD、色: 白、背景: #2ecc71

「設定」

x=400-100=300, y=330, w=200, h=50

フォント: 20px UD、色: 白、背景: #3498db

著作表記

12px UD、色: 灰、中央、x=400, y=580

5.1.5 ローディング画面 (loadingScreen.js)
背景: 透過 → プログレスバーのみ表示

プログレスバー

幅: 600px, 高さ: 30px

位置: x=(800–600)/2=100, y=(600–30)/2=285

背景バー: #555, 進捗バー: #4caf50, 枠線: #fff

パーセント表示

フォント: 16px sans-serif、色: #fff

位置: x=400, y=プログレスバー下＋8px= (285 + 30 + 8) = 323

5.1.6 ステージ選択画面 (stageSelectScreen.js)
背景: 黒一色

学年タブ

配置: y=0〜50, 各タブ幅=800/7≈114px, 高さ=50px

テキスト: 24px UD, 中央揃え, 色: #fff

クリア率ラベル: 12px UD, 背景: 赤, 色: #fff, タブ右上にオーバーレイ

ホバー: 少し明るい --clr-main に変化

地方アイコン／都道府県マーカー

アイコンサイズ: 都道府県マーカー 32×32px

都道府県ごとの座標: stage.pos に従う

クリア済み: カラー表示, 未クリア: グレースケール (filter: grayscale(1) brightness(0.3))

下部メニュー

「もどる」「復習する」「漢字図鑑」「モンスターデックス」

各ボタン: w=150,h=40, テキスト16px UD, 色: #fff, 背景: --clr-main

配置: y=520, x=10→170→330→490 (ボタン間隔＝20px)

5.1.7 バトル画面 (battleScreen.js)
背景

現状: グラデーション背景

js
コピーする
編集する
const grad = ctx.createLinearGradient(0, 0, 0, 600);
grad.addColorStop(0, '#1e3c72');
grad.addColorStop(1, '#2a5298');
ctx.fillStyle = grad;
ctx.fillRect(0, 0, 800, 600);
将来: ステージごとの背景画像（assets/images/bg_{stageId}.png, 解像度 800×600）を描画

上部ボタン

「タイトルへ」: x=20, y=20, w=100, h=30, フォント16px UD, 色: #fff, 背景: #2980b9

「ステージ選択」: x=140, y=20, w=120, h=30, フォント16px UD, 色: #fff, 背景: #2980b9

敵キャラクター表示

位置・サイズ:

js
コピーする
編集する
const ex = 480, ey = 80, ew = 240, eh = 120;
ctx.drawImage(enemyImage, ex, ey, ew, eh);
名前・レベル:

js
コピーする
編集する
ctx.font = '26px "UDデジタル教科書体"';
ctx.fillStyle = 'white';
ctx.fillText(`${enemy.name} Lv.${enemy.level || 1}`, ex + ew/2, ey - 15);
HPバー:

幅=120px, 高さ=8px, 位置: bx=ex + (ew−120)/2, by=ey−5

背景: #333, 塗り: #e74c3c, 枠線: #fff

HPテキスト: 14px UD, 色: #fff, position: bx + 128, by + 12

問題漢字表示

漢字ボックス:

js
コピーする
編集する
const kanjiX = 400, kanjiY = 200;
const kanjiBoxW = 180, kanjiBoxH = 160;
ctx.strokeStyle = 'white';
ctx.lineWidth = 2;
ctx.strokeRect(kanjiX - 90, kanjiY - 80, 180, 160);
弱点ラベル: 20px UD, 色: #ff0, 位置: x=400, y=200−80−20=100

漢字テキスト:

js
コピーする
編集する
ctx.font = '100px serif';
ctx.fillStyle = 'white';
ctx.textAlign = 'center';
ctx.fillText(currentKanji.text, kanjiX, kanjiY);
ヒント（意味）: 20px UD, 色: #ff0, 位置: x=400, y=200 + 80 + 10 = 290 (表示条件: showHint === true)

前回解答表示エリア

位置: x=20, y=70, w=140, h=140

背景: rgba(0,0,0,0.6), 枠線: #fff

タイトル: 14px UD, 色: #fff, x=28, y=90 ('1つまえの漢字')

漢字テキスト: 32px serif, 色: #fff, x=30, y=125

読み・画数: 12px UD, 色: #fff, x=30, y=155 以降

プレイヤー情報表示

領域: x=50, y=350～430

プレイヤー名: 16px UD, 色: #fff, x=50, y=358

HPバー:

幅=200px, 高さ=16px, x=50, y=382

背景: #333, 塗り: #1abc9c, 枠線: #fff

アニメーション: PLAYER_HP_ANIM_SPEED = 2 で徐々に減少

HP/レベル/EXP テキスト: 14px UD, 色: #fff, x=50, y=414 (HP: 80/100 Lv:3 EXP:45)

アクションボタン

すべて同サイズ: w=110, h=50, フォント16px UD, 色: #fff, 背景: #2980b9

こうげき: x=250, y=380, アイコン: assets/images/icon_attack.png (34×34, 左パディング8px)

かいふく: x=370, y=380, アイコン: assets/images/icon_heal.png

ヒント: x=490, y=380, アイコン: assets/images/icon_hint.png

入力欄（漢字入力ボックス）

HTML <input id="kanjiInput" class="game-input"> を Canvas 上 x=400−150=250, y=350, w=300, h≈40, font-size=24px でオーバーレイ

入力後、Enter 押下または「こうげき」ボタンで処理。

メッセージログ欄

位置: x=50, y=440, w=700, h=100

背景: rgba(0,0,0,0.5), 枠線: #fff

テキスト: 14px UD, 色: #fff, 左寄せ、行間=30px, 最大 4 行表示

マウスホイールでスクロール (this.logOffset で制御)

5.1.8 リザルト画面（勝利／敗北）
5.1.8.1 勝利リザルト画面 (resultWinScreen.js)
背景: 黒一色

タイトル: ステージクリア！（48px UD, 色: #ff0, x=400, y=150）

サブテキスト: おめでとうございます！（24px UD, 色: #fff, x=400, y=200）

間違えた漢字一覧:

テキスト 20px UD, 色: #fff, 左揃え x=50, y=300 から行間 30px で表示

「次のステージへ」ボタン:

x=300, y=400, w=200, h=50, フォント16px UD, 色: #fff, 背景: --clr-main

5.1.8.2 ゲームオーバー画面 (gameOverScreen.js)
背景: 黒一色

タイトル: ゲームオーバー（48px UD, 色: #f00, x=400, y=150）

サブテキスト: ざんねん！またチャレンジしてね（24px UD, 色: #fff, x=400, y=200）

ボタン

リトライ: x=250, y=380, w=150, h=50, フォント18px UD, 色: #fff, 背景: --clr-main

タイトルへ: x=430, y=380, w=150, h=50, フォント18px UD, 色: #fff, 背景: --clr-main

5.2 ペルソナ別に配慮すべきポイント
低学年児童向け

ボタンや入力欄は大きめ（最低タップ領域 40×40px 以上）に設定。

色彩はコントラストを高くし、文字は大きめ（16px 以上）で表示。

アニメーションや効果音を用いて、視覚・聴覚でフィードバックを明確にする。

ADHD傾向のある子ども向け

無駄な画面遷移や長い待ち時間を避け、テンポよくコンテンツを進行。

必要最小限のテキスト表示と、視覚的にわかりやすいアイコンを多用。

正解／誤答の判定は瞬時にフィードバックし、エフェクトで注意を引く。

学習塾の先生向け

管理画面（別途仕様）でクラス単位の成績や進捗を確認できるよう拡張予定。

図鑑や復習機能を使った宿題出題機能を将来的に実装予定。

Firebase のリアルタイム同期によって複数端末で進捗を共有。

アクセシビリティ
- 色弱モード（body.cb-mode）で主色・アクセント色を変更し、色覚多様性に対応。
- 文字サイズ＋20%（body.big-font）で、視力に不安のあるユーザーに対応。
- キーボード操作のみで進行できる設計  
  - Tab / Shift+Tab：フォーカスを順次移動（画面上のボタン、入力フィールド、図鑑やリストの項目など）  
  - Enter / Space：フォーカス中の要素をアクティブ化（ボタンの押下、選択項目の決定）  
  - 矢印キー (↑↓←→)：リストやメニュー内の項目移動・選択に使用（漢字図鑑・モンスターデックスのスクロール、ステージ選択マップのナビゲーションなど）  
  - フォーカスインジケータ：フォーカス中の要素は枠線を太線にしたり背景色を反転させるなど、視覚的に目立つ表示を行う  
  - Canvas UI と `<input>` 間のフォーカス連携：Canvas上のボタンやリスト要素にも `tabindex` と適切な ARIA ロール（例：button、listbox）を設定し、HTML `<input>` 要素へのスムーズなフォーカス移動を実現  

6. 技術要件・環境設定
6.1 フレームワーク・ライブラリ一覧
JavaScript/TypeScript:
  - 本プロトタイプは JavaScript（ES6）で実装。  
  - Canvas API を用いた描画。  
  - HTML `<input>` 要素をオーバーレイで利用し、キーボード入力を受け付け。  
ビルドツール:
  - Vite（推奨）または Webpack でプロジェクトをビルド  
  - `npm install` → `npm run dev` → 開発サーバー起動  
  - `npm run build` → 本番用ビルド生成（dist/ に展開）  
Firebase:
- Firebase Authentication（匿名認証）  
- Cloud Firestore（データ永続化／同期）  
- Firestore Persistence（オフラインキャッシュ）  
  - オフライン時はすべての読み書きをローカルキャッシュに蓄積し、オンライン復帰時に `DataSync.syncAll()` でサーバーと自動同期。  
  - 同期ロジック: タイムスタンプ比較によるマージを行い、衝突時は最新更新を優先。必要に応じてユーザーへ再試行オプションを提示。  
その他ライブラリ:
  - lodash （ユーティリティ関数）  
  - date-fns （日付操作、復習キュー用）  
  - IntersectionObserver （モンスターデックスの遅延読み込み）  
  - Workbox （PWA 化用、後述）  

6.2 ビルド／デプロイ手順
ローカル開発環境構築

bash
コピーする
編集する
git clone <リポジトリURL>
cd kanji-yomi-battle
npm install
開発サーバー起動

bash
コピーする
編集する
npm run dev
http://localhost:3000 で動作確認。

Firebase の firebaseConfig.js を正しく設定しておくこと。

本番ビルド

bash
コピーする
編集する
npm run build
出力先: dist/ フォルダに静的ファイル（index.html, assets/, css/ など）が生成される。

dist/ フォルダを任意の静的ホスティングサービス（Firebase Hosting, Netlify, Vercel など）に配置。

Firebase Hosting へのデプロイ例

bash
コピーする
編集する
npm install -g firebase-tools
firebase login
firebase init hosting
# publicディレクトリに `dist/` を指定
firebase deploy --only hosting
firebase.json に以下を追加・設定：

json
コピーする
編集する
{
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
デプロイ完了後、提供された URL で公開アプリにアクセス可能。

6.3 PWA化手順（Workbox, manifest.json など）
Manifest ファイル作成 (manifest.json)

json
コピーする
編集する
{
  "name": "漢字読みバトル",
  "short_name": "漢字バトル",
  "start_url": ".",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#1e90ff",
  "icons": [
    {
      "src": "assets/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "assets/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
index.html に以下を追加：

html
コピーする
編集する
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#1e90ff" />
Service Worker 導入（Workbox）

workbox をインストール: npm install workbox-cli --save-dev

workbox-config.js 設定例：

js
コピーする
編集する
module.exports = {
  globDirectory: "dist/",
  globPatterns: ["**/*.{js,css,html,png,webp,mp3}"],
  swDest: "dist/sw.js",
  runtimeCaching: [
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|webp)$/,
      handler: "CacheFirst",
      options: {
        cacheName: "images-cache",
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 30 * 24 * 60 * 60 // 30 日
        }
      }
    },
    {
      urlPattern: /\.(?:mp3)$/,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "audio-cache",
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 7 * 24 * 60 * 60 // 7 日
        }
      }
    },
    {
      urlPattern: /https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "google-fonts-cache"
      }
    }
  ]
};
ビルド後に Workbox で Service Worker を生成：

bash
コピーする
編集する
npx workbox generateSW workbox-config.js
index.html に以下を追加して SW を登録：

html
コピーする
編集する
<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('SW registered:', reg))
        .catch(err => console.error('SW registration failed:', err));
    });
  }
</script>
これにより、静的アセットがキャッシュされ、オフライン時にも動作可能となる。

7. 開発フェーズとリリース計画
7.1 現在までに完了しているフェーズ
必須コア機能の実装完了

State マシンによるバトル遷移（core/fsm.js, core/stateMachine.js, fsmsetup.js）

漢字表示 → 解答判定（battleScreen.js）

経験値計算（battleScreen.js + gameState ロジック）

ステージ選択画面基本機能（stageSelectScreen.js）

漢字図鑑画面基本機能（kanjiDexScreen.js）

モンスターデックス画面基本機能（monsterDexScreen.js）

設定画面（色弱モード、文字サイズ+20%、音量スライダー、データリセット）

Firebase 認証 & Firestore 同期（firebaseController.js, dataSync.js）

UI/UX 基本レイアウト完成

タイトル画面、メインメニュー、ローディング画面、バトル画面、リザルト画面、ゲームオーバー画面

各画面ごとの座標・フォント・色・ボタンレイアウトをコーディング済み

7.2 次に実装予定の機能一覧（優先度順）
属性システム（音読み／訓読み弱点）

ダメージ計算に弱点倍率を組み込み、属性を意識した戦略要素を追加。

経験値・レベルアップ機能の拡充

レベルアップ時のスキルポイント付与、ステータス振り分け画面実装、経験値テーブル導入。

漢字図鑑機能の強化

漢字詳細モーダル（例文・イラスト・覚え方）、フィルタ／検索機能（学年・画数・正答率）。

7.3 中長期の拡張機能ロードマップ
ボス戦ギミック（優先度1）

各エリアの最終ステージに強力なボスモンスターを配置。

フェーズ制バトル：複数ターンにわたる特殊技、属性弱点を連続で正解しないと大ダメージを与えられない。

ボス専用BGM切り替え（audioManager.playBGM('boss')）、画面オーバーレイ演出、HPバー拡張など。

PWA化（優先度2）

Workbox を用いた Service Worker 生成、静的アセットキャッシュ設定。

manifest.json によるホーム画面アイコン追加、全画面表示対応。

プッシュ通知による復習リマインダー（オプション）を検討。

スペースドリピティション（復習キュー）（優先度3）

models/reviewQueue.js に SM-2 アルゴリズム実装。

正答率が低い漢字を自動で「復習用プール」に追加し、定期的に復習ステージに出題。

通知機能連携（PWA の Notification API）やカレンダーUIを実装し、次回復習日時を表示。

8. 付録
8.1 使用素材一覧
8.1.1 画像素材
UIボタン

assets/images/button_normal.png

assets/images/button_click.png

assets/images/button_not_act.png

assets/images/button_select.png

アイコン

assets/images/icon_attack.png

assets/images/icon_heal.png

assets/images/icon_hint.png

assets/images/icon_setting.png

assets/images/icon_exp.png

ロゴ

assets/images/logo.png

assets/images/logo2.png

都道府県マーカー

assets/images/marker_pref.png

assets/images/marker_cleared.png

assets/images/marker_locked.png

敵モンスター画像 (PNG)

assets/images/enemy/1_夕張メロン.png

assets/images/enemy/2_ジンギスカン.png

…

assets/images/enemy/10_ししゃも.png

モンスター図鑑用 (WebP)

/assets/images/monsters/full/HKD-E01.webp … HKD-E10.webp

/assets/images/monsters/thumb/HKD-E01.webp … HKD-E10.webp

背景画像（未実装）

assets/images/bg_hokkaido.png（予定, 解像度 800×600）

assets/images/bg_kanto.png（予定, 解像度 800×600）

…

8.1.2 音声素材 (MP3)
BGM

assets/audio/bgm_title.mp3

assets/audio/bgm_battle.mp3

assets/audio/bgm_victory.mp3

assets/audio/boss.mp3

assets/audio/partial.mp3

SE

assets/audio/se_appear.mp3

assets/audio/se_attack.mp3

assets/audio/se_correct.mp3

assets/audio/se_damage.mp3

assets/audio/se_decide.mp3

assets/audio/se_defeat.mp3

assets/audio/se_heal.mp3

assets/audio/se_miss.mp3

assets/audio/se_wrong.mp3

8.1.3 データファイル
JSON

data/kanji_g1_proto.json … kanji_g6_proto.json

data/enemies_proto.json

data/stages_proto.json

CSV

assets/images/都道府県　モンスター.csv

assets/images/都道府県　モンスター2.csv

8.2 用語集（漢字属性の定義、Game用語など）
用語	説明
漢字属性 (weakness)	漢字ごとに「onyomi」または「kunyomi」の弱点属性を設定。弱点属性で正解するとダメージ倍率 1.5 倍。
音読み (onyomi)	漢字の中国漢字読み。例: 「一」は「イチ」または「イツ」。
訓読み (kunyomi)	漢字の日本固有読み。例: 「一」は「ひと」。
正答率 (accuracy)	correctCount ÷ (correctCount + incorrectCount) で算出する漢字ごとの学習統計。
レベル (level)	プレイヤーの育成段階。経験値が一定量に達するとレベルアップし、maxHpやattackが増加。
経験値 (exp)	敵を倒したときに獲得できるポイント。レベルアップ判定に使用。
次レベ必要経験値 (nextLevelExp)	次のレベルに到達するために必要な経験値量。レベルアップごとに Math.floor(prev * 1.5) で増加。
ステートマシン (FSM)	アプリケーション全体の画面遷移やバトルフェーズを管理する仕組み。core/fsm.js + stateMachine.js で実装。
PWA (Progressive Web App)	オフラインキャッシュやホーム画面アイコンを持ち、ネイティブアプリのように使える Web アプリ。
Workbox	Google 提供の Service Worker ツールキット。静的アセットキャッシュなど PWA 化に使用。
スペースドリピティション	学習内容を「忘却曲線」に基づいて復習タイミングを最適化するアルゴリズム（SM-2 など）。
ボス戦ギミック	ステージの最終ステージに登場する強力な敵。複数ターン制バトルや特殊攻撃を仕掛ける。
Firestore Persistence	Firestore のオフライン永続化機能。通信が途切れてもローカルキャッシュからデータを参照できる。