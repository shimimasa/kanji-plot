// src/kanjiDexScreen.js
// 漢字図鑑画面：コレクションされた漢字をスクロール表示

import { publish } from '../../core/eventBus.js';
import { loadDex } from '../../models/kanjiDex.js';
import { getKanjiById, kanjiData } from '../../loaders/dataLoader.js';
import { drawButton, isMouseOverRect } from '../../ui/uiRenderer.js';

const BTN = {
  back: { x: 20, y: 20, w: 100, h: 30, label: 'ステージ選択へ' },
  prevPage: { x: 580, y: 500, w: 100, h: 40, label: '前のページ' },
  nextPage: { x: 690, y: 500, w: 100, h: 40, label: '次のページ' },
  closeModal: { x: 550, y: 80, w: 80, h: 30, label: '閉じる' },  // モーダル用閉じるボタン
  
  // ソートボタンを拡張
  sortByGrade: { x: 150, y: 20, w: 70, h: 30, label: '学年順' },
  sortByStrokes: { x: 230, y: 20, w: 70, h: 30, label: '画数順' },
  sortByMastery: { x: 310, y: 20, w: 70, h: 30, label: '習熟度順' },
  toggleFilter: { x: 390, y: 20, w: 120, h: 30, label: '収集済のみ' }
};

const kanjiDexScreen = {
  canvas: null,
  ctx:    null,
  dexSet: null,     // 収集済み漢字IDのSet<string>
  allList: [],      // 全漢字IDの配列
  scroll: 0,        // 表示開始インデックス
  selectedKanjiId: null,  // 選択された漢字IDを保持するプロパティを追加
  _clickHandler: null,
  _keyHandler:   null,
  
  // 新しいプロパティを追加
  sortMode: 'default',    // 'default', 'grade', 'strokes'
  showCollectedOnly: false, // フィルタリング状態
  filteredList: [],       // フィルタリング後のリスト
  
  // DOM要素の参照
  container: null,
  cardGrid: null,
  cardsPerPage: 20, // 1ページあたりのカード数

  /** enter：画面表示時の初期化 */
  enter(arg) {
    // 最新の収集状況を反映
    this.dexSet = loadDex();
    
    // canvas 引数が HTMLCanvasElement ならそれを使い、そうでなければ DOM から取得
    this.canvas = (arg && typeof arg.getContext === 'function')
      ? arg
      : document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');
    
    // localStorageから収集済みデータを取得し、全漢字IDリストを生成
    this.allList = kanjiData.map(k => k.id);
    this.scroll  = 0;
    this.selectedKanjiId = null;
    
    // 初期化処理
    this.sortMode = 'default';
    this.showCollectedOnly = false;
    this.updateFilteredList();
    
    // DOMヘッダーを作成
    this.createDOMHeader();
    
    // DOMコンテンツ（カードグリッド）を作成
    this.createDOMContent();
    
    // カードを描画
    this.renderKanjiCards();
    
    // キーボードイベントの登録
    this._keyHandler = e => {
      // モーダルが開いている場合はEscキーで閉じる
      if (this.selectedKanjiId && e.key === 'Escape') {
        this.selectedKanjiId = null;
        this.closeModal();
        return;
      }
      
      // ページ移動
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        this.prevPage();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        this.nextPage();
      }
    };
    window.addEventListener('keydown', this._keyHandler);
  },

  /** DOMヘッダーを作成 */
  createDOMHeader() {
    // 既存のコンテナがあれば削除
    if (this.container) {
      this.container.remove();
    }

    // メインコンテナを作成
    this.container = document.createElement('div');
    this.container.id = 'kanjiDexContainer';
    this.container.className = 'kanji-dex-container';

    // 収集率統計エリア
    const statsDiv = document.createElement('div');
    statsDiv.className = 'kanji-collection-stats';
    
    const statsText = document.createElement('div');
    statsText.className = 'kanji-stats-text';
    const collectionRate = Math.round((this.dexSet.size / this.allList.length) * 100);
    statsText.textContent = `漢字収集率: ${this.dexSet.size}/${this.allList.length} (${collectionRate}%)`;
    
    const progressBar = document.createElement('div');
    progressBar.className = 'kanji-progress-bar';
    const progressFill = document.createElement('div');
    progressFill.className = 'kanji-progress-fill';
    progressFill.style.width = `${collectionRate}%`;
    progressBar.appendChild(progressFill);
    
    statsDiv.appendChild(statsText);
    statsDiv.appendChild(progressBar);

    // ナビゲーションエリア
    const navDiv = document.createElement('div');
    navDiv.className = 'kanji-dex-navigation';

    // 左側のコントロール
    const leftControls = document.createElement('div');
    leftControls.className = 'nav-controls-left';
    
    const backButton = document.createElement('button');
    backButton.textContent = '📚 ステージ選択へ';
    backButton.addEventListener('click', () => {
      publish('playSE', 'decide');
      publish('changeScreen', 'stageSelect');
    });
    leftControls.appendChild(backButton);

    // 中央のコントロール（ソート）
    const centerControls = document.createElement('div');
    centerControls.className = 'nav-controls-center';
    
    const sortByGradeBtn = document.createElement('button');
    sortByGradeBtn.textContent = '📊 学年順';
    sortByGradeBtn.className = this.sortMode === 'grade' ? 'sort-active' : '';
    sortByGradeBtn.addEventListener('click', () => {
      this.sortList('grade');
      this.updateNavigationButtons();
      this.renderKanjiCards();
      publish('playSE', 'decide');
    });
    
    const sortByStrokesBtn = document.createElement('button');
    sortByStrokesBtn.textContent = '✏️ 画数順';
    sortByStrokesBtn.className = this.sortMode === 'strokes' ? 'sort-active' : '';
    sortByStrokesBtn.addEventListener('click', () => {
      this.sortList('strokes');
      this.updateNavigationButtons();
      this.renderKanjiCards();
      publish('playSE', 'decide');
    });
    
    const sortByMasteryBtn = document.createElement('button');
    sortByMasteryBtn.textContent = '⭐ 習熟度順';
    sortByMasteryBtn.className = this.sortMode === 'mastery' ? 'sort-active' : '';
    sortByMasteryBtn.addEventListener('click', () => {
      this.sortList('mastery');
      this.updateNavigationButtons();
      this.renderKanjiCards();
      publish('playSE', 'decide');
    });
    
    centerControls.appendChild(sortByGradeBtn);
    centerControls.appendChild(sortByStrokesBtn);
    centerControls.appendChild(sortByMasteryBtn);

    // 右側のコントロール（フィルター＋ページネーション）
    const rightControls = document.createElement('div');
    rightControls.className = 'nav-controls-right';
    
    // フィルタートグル
    const filterToggle = document.createElement('label');
    filterToggle.className = 'kanji-toggle-switch';
    
    const filterInput = document.createElement('input');
    filterInput.type = 'checkbox';
    filterInput.checked = this.showCollectedOnly;
    filterInput.addEventListener('change', () => {
      this.toggleFilter();
      this.updateNavigationButtons();
      this.renderKanjiCards();
      publish('playSE', 'decide');
    });
    
    const filterSlider = document.createElement('span');
    filterSlider.className = 'slider';
    
    const filterLabel = document.createElement('span');
    filterLabel.className = 'toggle-label';
    filterLabel.textContent = '収集済のみ';
    
    filterToggle.appendChild(filterInput);
    filterToggle.appendChild(filterSlider);
    filterToggle.appendChild(filterLabel);
    
    // ページネーション
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '⬅️ 前のページ';
    prevBtn.addEventListener('click', () => {
      this.prevPage();
    });
    
    const pageInfo = document.createElement('span');
    pageInfo.className = 'page-info';
    
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '次のページ ➡️';
    nextBtn.addEventListener('click', () => {
      this.nextPage();
    });
    
    rightControls.appendChild(filterToggle);
    rightControls.appendChild(prevBtn);
    rightControls.appendChild(pageInfo);
    rightControls.appendChild(nextBtn);

    navDiv.appendChild(leftControls);
    navDiv.appendChild(centerControls);
    navDiv.appendChild(rightControls);

    // コンテナに追加
    this.container.appendChild(statsDiv);
    this.container.appendChild(navDiv);

    // DOMに追加
    document.body.appendChild(this.container);
    
    // ナビゲーションボタンの状態を更新
    this.updateNavigationButtons();
  },

  /** DOMコンテンツ（カードグリッド）を作成 */
  createDOMContent() {
    // カードグリッドコンテナを作成
    this.cardGrid = document.createElement('div');
    this.cardGrid.id = 'kanjiCardGrid';
    this.cardGrid.className = 'kanji-card-grid';
    
    // コンテナに追加
    this.container.appendChild(this.cardGrid);
  },

  /** 漢字カードを描画 */
  renderKanjiCards() {
    // 既存のカードをクリア
    if (this.cardGrid) {
      this.cardGrid.innerHTML = '';
    }
    
    // 現在のページの漢字を取得
    const startIdx = this.scroll;
    const endIdx = Math.min(startIdx + this.cardsPerPage, this.filteredList.length);
    
    // 各漢字のカードを生成
    for (let i = startIdx; i < endIdx; i++) {
      const kanjiId = this.filteredList[i];
      const kanjiData = getKanjiById(kanjiId);
      const card = this._createKanjiCard(kanjiData);
      this.cardGrid.appendChild(card);
    }
  },

  /** 漢字カードを生成 */
  _createKanjiCard(kanjiData) {
    const collected = this.dexSet.has(kanjiData.id);
    
    // カード要素を作成
    const card = document.createElement('div');
    card.className = 'kanji-card';
    if (!collected) {
      card.classList.add('locked');
    }
    
    // 漢字を表示
    const kanjiEl = document.createElement('h2');
    kanjiEl.className = 'kanji-character';
    kanjiEl.textContent = collected ? kanjiData.kanji : '？';
    card.appendChild(kanjiEl);
    
    // 情報コンテナ
    const infoContainer = document.createElement('div');
    infoContainer.className = 'kanji-info';
    
    // 学年
    const gradeEl = document.createElement('p');
    gradeEl.className = 'kanji-grade';
    const grade = kanjiData.grade || '?';
    gradeEl.textContent = `${grade}年生`;
    infoContainer.appendChild(gradeEl);
    
    if (collected) {
      // 読み方（収集済みのみ）
      const readingEl = document.createElement('p');
      readingEl.className = 'kanji-reading';
      
      const readings = [];
      if (kanjiData.onyomi) readings.push(`音: ${kanjiData.onyomi}`);
      if (kanjiData.kunyomi) readings.push(`訓: ${kanjiData.kunyomi}`);
      
      readingEl.textContent = readings.join(' ');
      infoContainer.appendChild(readingEl);
      
      // 画数
      const strokesEl = document.createElement('p');
      strokesEl.className = 'kanji-strokes';
      strokesEl.textContent = `${kanjiData.strokes}画`;
      infoContainer.appendChild(strokesEl);
      
      // 習熟度
      const masteryEl = document.createElement('div');
      masteryEl.className = 'kanji-mastery';
      
      const correctCount = kanjiData.correctCount || 0;
      const incorrectCount = kanjiData.incorrectCount || 0;
      const totalAttempts = correctCount + incorrectCount;
      
      if (totalAttempts > 0) {
        const accuracy = correctCount / totalAttempts;
        const accuracyPercent = Math.round(accuracy * 100);
        
        // 星の数を決定
        let starCount = 1;
        if (accuracy >= 0.9) starCount = 3;
        else if (accuracy >= 0.7) starCount = 2;
        
        // 星アイコンを追加
        for (let i = 0; i < starCount; i++) {
          const star = document.createElement('span');
          star.className = 'mastery-star';
          star.textContent = '⭐';
          masteryEl.appendChild(star);
        }
        
        // 正答率
        const accuracyEl = document.createElement('span');
        accuracyEl.className = 'mastery-accuracy';
        accuracyEl.textContent = `${accuracyPercent}%`;
        masteryEl.appendChild(accuracyEl);
      } else {
        masteryEl.textContent = '未挑戦';
      }
      
      infoContainer.appendChild(masteryEl);
    } else {
      // 未収集の場合
      const lockedEl = document.createElement('p');
      lockedEl.className = 'kanji-locked-message';
      lockedEl.textContent = '未収集';
      infoContainer.appendChild(lockedEl);
    }
    
    card.appendChild(infoContainer);
    
    // クリックイベント
    if (collected) {
      card.addEventListener('click', () => {
        this.selectedKanjiId = kanjiData.id;
        this.showModal(kanjiData.id);
        publish('playSE', 'decide');
      });
    }
    
    return card;
  },

  /** モーダルを表示 */
  showModal(kanjiId) {
    const kanjiData = getKanjiById(kanjiId);
    if (!kanjiData) return;
    
    // モーダルコンテナを作成
    const modalContainer = document.createElement('div');
    modalContainer.className = 'kanji-modal';
    modalContainer.id = 'kanjiModal';
    
    // モーダルコンテンツ
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    // 閉じるボタン
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => {
      this.closeModal();
    });
    modalContent.appendChild(closeBtn);
    
    // 漢字を大きく表示
    const kanjiEl = document.createElement('h1');
    kanjiEl.className = 'modal-kanji';
    kanjiEl.textContent = kanjiData.kanji;
    modalContent.appendChild(kanjiEl);
    
    // 漢字情報
    const infoSection = document.createElement('div');
    infoSection.className = 'kanji-detail-info';
    
    // 基本情報
    const basicInfo = document.createElement('div');
    basicInfo.className = 'kanji-basic-info';
    
    if (kanjiData.onyomi) {
      const onyomiEl = document.createElement('p');
      onyomiEl.innerHTML = `<strong>音読み:</strong> ${kanjiData.onyomi}`;
      basicInfo.appendChild(onyomiEl);
    }
    
    if (kanjiData.kunyomi) {
      const kunyomiEl = document.createElement('p');
      kunyomiEl.innerHTML = `<strong>訓読み:</strong> ${kanjiData.kunyomi}`;
      basicInfo.appendChild(kunyomiEl);
    }
    
    if (kanjiData.meaning) {
      const meaningEl = document.createElement('p');
      meaningEl.innerHTML = `<strong>意味:</strong> ${kanjiData.meaning}`;
      basicInfo.appendChild(meaningEl);
    }
    
    const gradeStrokesEl = document.createElement('p');
    gradeStrokesEl.innerHTML = `<strong>学年:</strong> ${kanjiData.grade || '?'}年 <strong>画数:</strong> ${kanjiData.strokes}画`;
    basicInfo.appendChild(gradeStrokesEl);
    
    infoSection.appendChild(basicInfo);
    
    // 学習記録セクション
    const statsSection = document.createElement('div');
    statsSection.className = 'kanji-stats-section';
    
    const statsTitle = document.createElement('h3');
    statsTitle.textContent = '学習記録';
    statsSection.appendChild(statsTitle);
    
    const correctCount = kanjiData.correctCount || 0;
    const incorrectCount = kanjiData.incorrectCount || 0;
    const total = correctCount + incorrectCount;
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    
    // 習熟度レベル
    let masteryLevel = '初心者';
    let masteryColor = '#8B4513';
    if (accuracy >= 90) {
      masteryLevel = 'マスター';
      masteryColor = '#DAA520';
    } else if (accuracy >= 70) {
      masteryLevel = '上級者';
      masteryColor = '#CD853F';
    } else if (accuracy >= 50) {
      masteryLevel = '中級者';
      masteryColor = '#D2B48C';
    }
    
    const masteryEl = document.createElement('p');
    masteryEl.className = 'mastery-level';
    masteryEl.innerHTML = `<strong>習熟度:</strong> <span style="color:${masteryColor}">${masteryLevel}</span>`;
    statsSection.appendChild(masteryEl);
    
    if (total > 0) {
      // 統計情報
      const statsEl = document.createElement('div');
      statsEl.className = 'stats-details';
      
      const attemptsEl = document.createElement('p');
      attemptsEl.innerHTML = `<strong>挑戦回数:</strong> ${total}回`;
      statsEl.appendChild(attemptsEl);
      
      const accuracyEl = document.createElement('p');
      accuracyEl.innerHTML = `<strong>正答率:</strong> ${accuracy}%`;
      statsEl.appendChild(accuracyEl);
      
      // グラフ
      const graphContainer = document.createElement('div');
      graphContainer.className = 'accuracy-graph-container';
      
      const graphEl = document.createElement('div');
      graphEl.className = 'accuracy-graph';
      
      const correctBar = document.createElement('div');
      correctBar.className = 'correct-bar';
      correctBar.style.width = `${accuracy}%`;
      correctBar.textContent = `正解: ${correctCount}`;
      graphEl.appendChild(correctBar);
      
      const incorrectBar = document.createElement('div');
      incorrectBar.className = 'incorrect-bar';
      incorrectBar.style.width = `${100 - accuracy}%`;
      incorrectBar.textContent = `不正解: ${incorrectCount}`;
      graphEl.appendChild(incorrectBar);
      
      graphContainer.appendChild(graphEl);
      statsEl.appendChild(graphContainer);
      
      statsSection.appendChild(statsEl);
    } else {
      const noStatsEl = document.createElement('p');
      noStatsEl.textContent = 'まだ挑戦記録がありません';
      statsSection.appendChild(noStatsEl);
    }
    
    infoSection.appendChild(statsSection);
    modalContent.appendChild(infoSection);
    
    modalContainer.appendChild(modalContent);
    document.body.appendChild(modalContainer);
    
    // モーダル外クリックで閉じる
    modalContainer.addEventListener('click', (e) => {
      if (e.target === modalContainer) {
        this.closeModal();
      }
    });
  },

  /** モーダルを閉じる */
  closeModal() {
    const modal = document.getElementById('kanjiModal');
    if (modal) {
      modal.remove();
    }
    this.selectedKanjiId = null;
    publish('playSE', 'cancel');
  },

  /** 前のページに移動 */
  prevPage() {
    if (this.scroll <= 0) return;
    
    this.scroll = Math.max(0, this.scroll - this.cardsPerPage);
    this.updateNavigationButtons();
    this.renderKanjiCards();
    publish('playSE', 'decide');
  },

  /** 次のページに移動 */
  nextPage() {
    const maxScroll = Math.max(0, this.filteredList.length - this.cardsPerPage);
    if (this.scroll >= maxScroll) return;
    
    this.scroll = Math.min(maxScroll, this.scroll + this.cardsPerPage);
    this.updateNavigationButtons();
    this.renderKanjiCards();
    publish('playSE', 'decide');
  },

  /** ナビゲーションボタンの状態を更新 */
  updateNavigationButtons() {
    if (!this.container) return;
    
    // ページ情報を更新
    const pageInfo = this.container.querySelector('.page-info');
    if (pageInfo) {
      const currentPage = Math.floor(this.scroll / this.cardsPerPage) + 1;
      const totalPages = Math.ceil(this.filteredList.length / this.cardsPerPage);
      pageInfo.textContent = `${currentPage} / ${totalPages}`;
    }
    
    // ページングボタンの有効/無効を更新
    const prevBtn = this.container.querySelector('.nav-controls-right button:first-of-type');
    const nextBtn = this.container.querySelector('.nav-controls-right button:last-of-type');
    
    if (prevBtn) {
      prevBtn.disabled = this.scroll <= 0;
    }
    
    if (nextBtn) {
      const maxScroll = Math.max(0, this.filteredList.length - this.cardsPerPage);
      nextBtn.disabled = this.scroll >= maxScroll;
    }
    
    // ソートボタンのアクティブ状態を更新
    const sortButtons = this.container.querySelectorAll('.nav-controls-center button');
    sortButtons.forEach(btn => btn.classList.remove('sort-active'));
    
    if (this.sortMode === 'grade') {
      sortButtons[0]?.classList.add('sort-active');
    } else if (this.sortMode === 'strokes') {
      sortButtons[1]?.classList.add('sort-active');
    } else if (this.sortMode === 'mastery') {
      sortButtons[2]?.classList.add('sort-active');
    }
    
    // 収集率統計を更新
    const statsText = this.container.querySelector('.kanji-stats-text');
    const progressFill = this.container.querySelector('.kanji-progress-fill');
    
    if (statsText && progressFill) {
      const collectionRate = Math.round((this.dexSet.size / this.allList.length) * 100);
      if (this.showCollectedOnly) {
        statsText.textContent = `表示中: ${this.filteredList.length} / 収集済: ${this.dexSet.size} (${collectionRate}%)`;
      } else {
        statsText.textContent = `漢字収集率: ${this.dexSet.size}/${this.allList.length} (${collectionRate}%)`;
      }
      progressFill.style.width = `${collectionRate}%`;
    }
  },

  /** update：毎フレーム描画 */
  update(dt) {
    const { ctx, canvas } = this;
    
    // 背景（書斎風）を描画
    ctx.fillStyle = '#2c1810';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 古文書風の背景テクスチャ
    ctx.fillStyle = 'rgba(139, 69, 19, 0.1)';
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        if ((i + j) % 2 === 0) {
          ctx.fillRect(i * 80, j * 60, 40, 30);
        }
      }
    }
  },

  /** exit：画面離脱時のクリーンアップ */
  exit() {
    // DOM要素を削除
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    
    // モーダルを閉じる
    this.closeModal();
    
    // イベント解除
    if (this._keyHandler) {
      window.removeEventListener('keydown', this._keyHandler);
    }
    this.canvas = this.ctx = null;
    this.selectedKanjiId = null;
  },

  /** ソート機能を実装 */
  sortList(mode) {
    this.sortMode = mode;
    
    switch (mode) {
      case 'grade':
        this.allList.sort((a, b) => {
          const kanjiA = getKanjiById(a);
          const kanjiB = getKanjiById(b);
          const gradeA = kanjiA.grade || 999;
          const gradeB = kanjiB.grade || 999;
          return gradeA - gradeB;
        });
        break;
        
      case 'strokes':
        this.allList.sort((a, b) => {
          const kanjiA = getKanjiById(a);
          const kanjiB = getKanjiById(b);
          const strokesA = kanjiA.strokes || 999;
          const strokesB = kanjiB.strokes || 999;
          return strokesA - strokesB;
        });
        break;
        
      case 'mastery':
        this.allList.sort((a, b) => {
          const kanjiA = getKanjiById(a);
          const kanjiB = getKanjiById(b);
          
          const correctA = kanjiA.correctCount || 0;
          const incorrectA = kanjiA.incorrectCount || 0;
          const totalA = correctA + incorrectA;
          const accuracyA = totalA > 0 ? correctA / totalA : 0;
          
          const correctB = kanjiB.correctCount || 0;
          const incorrectB = kanjiB.incorrectCount || 0;
          const totalB = correctB + incorrectB;
          const accuracyB = totalB > 0 ? correctB / totalB : 0;
          
          return accuracyB - accuracyA;
        });
        break;
        
      default:
        this.allList = kanjiData.map(k => k.id);
        break;
    }
    
    this.scroll = 0;
    this.updateFilteredList();
  },

  /** フィルタリング機能を実装 */
  updateFilteredList() {
    if (this.showCollectedOnly) {
      this.filteredList = this.allList.filter(id => this.dexSet.has(id));
    } else {
      this.filteredList = [...this.allList];
    }
  },

  /** フィルタリング状態を切り替え */
  toggleFilter() {
    this.showCollectedOnly = !this.showCollectedOnly;
    this.scroll = 0;
    this.updateFilteredList();
  }
};

export default kanjiDexScreen;

// FSM 一貫化のため描画エントリポイントを alias
kanjiDexScreen.render = function() {
  this.update(0);
};

