// js/firebaseController.js
import { gameState } from '../../core/gameState.js'; // ★★★ この行が必須 ★★★
import { firebaseConfig } from './firebaseConfig.js';   // ← 追加

// ---------------------------------------------------------------------------
//  このモジュールが初回呼び出し時に:
//   1) firebase.initializeApp(firebaseConfig)  (未初期化なら)
//   2) Auth / Firestore インスタンスをキャッシュ
// ---------------------------------------------------------------------------
let auth  = null;
let db    = null;
let currentUser = null;

export function initializeFirebaseServices() {
      try {
        if (typeof firebase === 'undefined') {
          console.error('Firebase SDK が読み込まれていません');
          return false;
        }

        // ① app が無ければここで初期化
        if (!firebase.apps.length) {
          if (!firebaseConfig?.apiKey || firebaseConfig.apiKey === 'XXXXXXXXXXXXXXX') {
            alert('⚠ Firebase の API キーが未設定です。\nsrc/firebaseConfig.js を正しく記入してください。');
            return false;
          }
          firebase.initializeApp(firebaseConfig);
          console.log('Firebase.initializeApp() 実行済み');
        }
    
        // ② サービス取得
        auth = firebase.auth();
        db   = firebase.firestore();

        // Firestore のオフライン永続化を有効化（オフライン時もキャッシュを参照）
        db.enablePersistence({ synchronizeTabs: true })
          .catch(err => console.warn('Firestore persistence error:', err));

        console.log('Firebase Auth / Firestore を取得しました');
        return true;
      } catch (err) {
        console.error('Error initializing Firebase services:', err);
        alert('Firebase 初期化に失敗しました。ネット接続と API キーを確認してください。');
        return false;
      }
    }

export async function signInAnonymouslyIfNeeded() {
    if (!auth) {
        console.error("Auth service not initialized.");
        return null;
    }
    if (currentUser) {
        console.log("User already available (cached in controller):", currentUser.uid);
        return currentUser;
    }
    if (auth.currentUser) {
        currentUser = auth.currentUser;
        console.log("User already signed in (from auth.currentUser):", currentUser.uid);
        await loadPlayerData(); // 既存ユーザーのデータをロード試行
        return currentUser;
    }

    return new Promise((resolve, reject) => {
        console.log("Attempting anonymous sign-in...");
        auth.signInAnonymously()
            .then(async (userCredential) => {
                currentUser = userCredential.user;
                console.log("New anonymous user signed in:", currentUser.uid);
                await loadPlayerData(); // 新規ユーザーでもデータをロード試行 (なければ作成)
                resolve(currentUser);
            })
            .catch((error) => {
                console.error("Error signing in anonymously:", error);
                currentUser = null;
                reject(error);
            });
    });
}

export function getCurrentUser() {
    return currentUser;
}

export async function initializeNewPlayerData(uid, playerName = "ななしのごんべえ") {
    if (!db || !uid || !playerName || playerName.trim() === "") {
        console.error("initializeNewPlayerData: Firestore service, UID, or playerName is missing or invalid.");
        alert("プレイヤーデータの初期化に失敗しました (情報不足)。"); // ユーザーへのフィードバック
        return null;
    }
    console.log(`Initializing new player data in Firestore for UID: ${uid} with name: ${playerName}`);
    const playerProfileRef = db.collection('users').doc(uid).collection('profile').doc('playerStats');

    const initialStats = {
        name: playerName.trim(), // ★引数のplayerNameを使用
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        level: 1,
        currentExp: 0,
        maxHp: 100,
        attack: 10,
        nextLevelExp: 100, // GDDの初期値
        // healCountはgameStateで管理し、バトル開始時にリセットするのでここでは不要かも
    };

    try {
        await playerProfileRef.set(initialStats); // 新規作成なので .set()
        console.log("New player data initialized and set in Firestore:", initialStats);

        // Firestoreへの保存成功後、ローカルのgameStateも確実に更新
        if (gameState && gameState.playerStats) {
            gameState.playerName = initialStats.name; // 名前を更新
            gameState.playerStats.level = initialStats.level;
            gameState.playerStats.exp = initialStats.currentExp;
            gameState.playerStats.maxHp = initialStats.maxHp;
            gameState.playerStats.attack = initialStats.attack;
            gameState.playerStats.nextLevelExp = initialStats.nextLevelExp;
            gameState.playerStats.healCount = 3; // 初期値
            console.log("Local gameState updated after new player data initialization.");
        } else {
            console.warn("initializeNewPlayerData: gameState or gameState.playerStats not available to update locally.");
        }
        return initialStats; // 作成したデータを返す
    } catch (error) {
        console.error("Error initializing new player data in Firestore:", error);
        alert("プレイヤーデータの初期化中にエラーが発生しました。");
        return null;
    }
}


export async function savePlayerData(playerDataToSave) {
    if (!db || !currentUser || !currentUser.uid || !playerDataToSave) {
        console.warn("Cannot save player data: Firestore, User not signed in, or playerData is missing.");
        return;
    }
    const playerProfileRef = db.collection('users').doc(currentUser.uid).collection('profile').doc('playerStats');
    const dataForFirestore = { // 保存するフィールドを明示
        name: playerDataToSave.name,
        level: playerDataToSave.level,
        currentExp: playerDataToSave.exp, // gameState.playerStats.exp とキー名を合わせる
        maxHp: playerDataToSave.maxHp,
        attack: playerDataToSave.attack,
        nextLevelExp: playerDataToSave.nextLevelExp,
        // healCount はバトル開始時にリセットされるので、ここでは保存しないか、設計次第
        lastUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
        await playerProfileRef.set(dataForFirestore, { merge: true }); // merge: true で既存フィールドを保持
        console.log("Player data saved to Firestore:", dataForFirestore);
    } catch (error) {
        console.error("Error saving player data to Firestore:", error);
    }
}

export async function loadPlayerData() {
    if (!db || !currentUser || !currentUser.uid) {
        console.warn("Cannot load player data: Firestore or User not signed in.");
        // gameState の playerStats に GDD の初期値を設定
        Object.assign(gameState.playerStats, { level: 1, exp: 0, maxHp: 100, attack: 10, nextLevelExp: 100, healCount: 3 });
        gameState.playerName = "ゲスト";
        return;
    }
    const playerProfileRef = db.collection('users').doc(currentUser.uid).collection('profile').doc('playerStats');
    try {
        console.log(`Loading player data for UID: ${currentUser.uid}`);
        const docSnap = await playerProfileRef.get();
        if (docSnap.exists) {
            const playerDataFromDb = docSnap.data();
            console.log("Player data loaded from Firestore:", playerDataFromDb);
            // gameState.playerStats にデータを反映
            gameState.playerStats.level = playerDataFromDb.level || 1;
            gameState.playerStats.exp = playerDataFromDb.currentExp || 0;
            gameState.playerStats.maxHp = playerDataFromDb.maxHp || 100;
            gameState.playerStats.attack = playerDataFromDb.attack || 10;
            gameState.playerStats.nextLevelExp = playerDataFromDb.nextLevelExp || calculateNextLevelExp(gameState.playerStats.level); // ローカルで計算した方が良い場合も
            gameState.playerName = playerDataFromDb.name || "ななし";
            console.log("gameState updated from Firestore:", gameState.playerStats, gameState.playerName);
        } else {
            console.log("No player data found for this user. Initializing new data.");
            const initialData = await initializeNewPlayerData(currentUser.uid, gameState.playerName || "ななしのごんべえ");
            if (initialData) { // 初期化成功したらgameStateに反映
                gameState.playerStats.level = initialData.level;
                gameState.playerStats.exp = initialData.currentExp;
                gameState.playerStats.maxHp = initialData.maxHp;
                gameState.playerStats.attack = initialData.attack;
                gameState.playerStats.nextLevelExp = initialData.nextLevelExp;
                gameState.playerName = initialData.name;
            }
        }
    } catch (error) {
        console.error("Error loading player data from Firestore:", error);
        // エラー時はデフォルト値でフォールバック
        if (!gameState.playerStats.maxHp) { // 未初期化の場合の安全策
             Object.assign(gameState.playerStats, {level: 1, exp: 0, maxHp: 100, attack: 10, nextLevelExp: 100, healCount: 3});
             gameState.playerName = "ゲスト(エラー)";
        }
    }
}

export async function saveStageClearStatus(stageId) {
    if (!db || !currentUser || !currentUser.uid || !stageId) {
        console.warn("Cannot save stage clear status: Firestore, User not signed in, or stageId is missing.");
        return;
    }
    const stageProgressRef = db.collection('users').doc(currentUser.uid).collection('progress').doc(stageId);
    try {
        await stageProgressRef.set({
            cleared: true,
            clearedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }); // 存在すれば更新、なければ作成
        console.log(`Stage ${stageId} clear status saved to Firestore.`);
        // gameState.stageProgress も更新
        if (!gameState.stageProgress) gameState.stageProgress = {};
        gameState.stageProgress[stageId] = { cleared: true };
    } catch (error) {
        console.error(`Error saving stage ${stageId} clear status:`, error);
    }
}

export async function loadAllStageClearStatus() {
    if (!db || !currentUser || !currentUser.uid) {
        console.warn("Cannot load stage clear status: User not signed in.");
        gameState.stageProgress = {}; // 空のオブジェクトで初期化
        return null;
    }
    const progressCollectionRef = db.collection('users').doc(currentUser.uid).collection('progress');
    try {
        const querySnapshot = await progressCollectionRef.get();
        const allProgress = {};
        querySnapshot.forEach((doc) => {
            allProgress[doc.id] = doc.data();
        });
        console.log("All stage clear status loaded from Firestore:", allProgress);
        gameState.stageProgress = allProgress; // gameState に保存
        return allProgress;
    } catch (error) {
        console.error("Error loading all stage clear status:", error);
        gameState.stageProgress = {}; // エラー時も空で初期化
        return null;
    }
}

