// src/init/fsmSetup.js
import { FSM } from '../core/stateMachine.js';
import battleFactory       from '../states/battleStateFactory.js';
import gradeSelectState    from '../states/gradeSelectState.js';
import regionSelectState   from '../screens/regionSelectScreen.js';
import prefSelectState     from '../states/prefSelectState.js';
import stageSelectState    from '../screens/stageSelectScreen.js';
import titleState          from '../screens/titleScreen.js';
import menuScreenState     from '../screens/menuScreen.js';
import { loadAllGameData } from '../loaders/dataLoader.js';
import { subscribe }       from '../core/eventBus.js';
import settingsState       from '../screens/settingsScreen.js';
import reviewStage         from '../screens/reviewStage.js';
import kanjiDexScreen      from '../screens/Dex/kanjiDexScreen.js';
import monsterDexState     from '../screens/Dex/monsterDexScreen.js';
import resultWinState      from '../screens/resultWinScreen.js';
import gameOverState       from '../screens/gameOverScreen.js';
import resultScreenState   from '../screens/resultScreen.js';
import statusScreen        from '../screens/statusScreen.js';
import achievementsScreen  from '../screens/achievementsScreen.js';
import playerNameInputState from '../screens/playerNameInputScreen.js';
import stageLoadingState   from '../screens/stageLoadingScreen.js';
import courseSelectScreen from '../screens/courseSelectScreen.js';
import continentSelectScreen from '../screens/continentSelectScreen.js';
import worldStageSelectScreen from '../screens/worldStageSelectScreen.js';

export async function setupFSM() {
  const { stageData } = await loadAllGameData();

  // 各画面／ステートを登録
  const states = {
    title:            titleState,
    playerNameInput:  playerNameInputState,
    menu:             menuScreenState,
    status:           statusScreen,
    achievements:     achievementsScreen,
    gradeSelect:      gradeSelectState,
    regionSelect:     regionSelectState,
    prefSelect:       prefSelectState,
    stageSelect:      stageSelectState,
    settings:         settingsState,
    reviewStage:      reviewStage,
    kanjiDex:         kanjiDexScreen,
    monsterDex:       monsterDexState,
    resultWin:        resultWinState,
    result:           resultScreenState,
    gameOver:         gameOverState,
    stageLoading:     stageLoadingState,
    courseSelect: courseSelectScreen,
    continentSelect: continentSelectScreen,
    worldStageSelect: worldStageSelectScreen,
  };
  // ステージごとのバトルステートを一括登録
  stageData.forEach(s => {
    states[s.stageId] = battleFactory(s.stageId);
  });

  // FSM 初期化（開始画面はタイトル）
  const fsm = new FSM('title', states);

  // changeScreen イベントに応じて FSM を切り替えるラッパー
  function switchScreen(name, props) {
    console.log(`画面遷移: ${name}`, props); // デバッグログを追加
    fsm.change(name, props);
  }
  subscribe('changeScreen', switchScreen);

  // デバッグ用にグローバル公開
  window.switchScreen = switchScreen;

  return fsm;
}
