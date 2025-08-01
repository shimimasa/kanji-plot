// src/states/battleStateFactory.js
import { getEnemiesByStageId, getKanjiByStageId } from '../loaders/dataLoader.js';
import battleScreenState from '../screens/battleScreen.js';
import { publish } from '../core/eventBus.js';
import { gameState, battleState, resetStageProgress } from '../core/gameState.js';

export default function createBattleState(stageId){
  let enemies, kanjiPool;

  return {
    enter(props) {
      console.log(`🎮 battleStateFactory.enter() - ステージ: ${stageId}`, { props });
      
      // ステージ毎のデータをセット
      enemies    = getEnemiesByStageId(stageId);
      kanjiPool  = getKanjiByStageId(stageId);
      gameState.currentStageId = stageId;
      resetStageProgress(stageId);
      
      // キャンバス要素を取得 (propsまたはDOM)
      let canvas = props;
      if (!canvas || typeof canvas !== 'object' || !canvas.getContext) {
        console.log('引数からキャンバスを取得できません。DOMから取得します。');
        canvas = document.getElementById('gameCanvas');
      }
      
      if (!canvas) {
        console.error('gameCanvas要素が見つかりません');
        alert('ゲーム画面が見つかりません。ステージ選択に戻ります。');
        publish('changeScreen', 'stageSelect');
        return;
      }
      
      console.log('🖼️ キャンバス要素を取得しました:', canvas);
      
      battleScreenState.enter(canvas, () => {
        // ステージクリア後の処理
        // クリアしたらローカル保存
        localStorage.setItem(`clear_${stageId}`, '1');
        // 新しい勝利画面に遷移（データ付き）
        const resultData = {
          stageId: gameState.currentStageId,
          correct: gameState.correctKanjiList,
          wrong:   gameState.wrongKanjiList,
          time:    battleState.timeRemaining, // チャレンジモードの場合
          playerHp: gameState.playerStats.hp
        };
        publish('changeScreen', 'resultWin', resultData);
      });
    },
    update(dt) {
      battleScreenState.update(dt);
    },
    exit() {
      battleScreenState.exit();
    }
  };
}
