# プレイリストと動画URLの同期実装 - 2025年11月14日（修正版）

## 実装完了

### 目的
プレイリストの**リストアイテムをクリック → 同じウィンドウ内の iframe で動画を切り替える**

### ユーザー体験フロー（最新版）

1. **ページ読み込み**
   - iframe にプレイリストが表示
   - 右側に60個の動画リストが表示

2. **動画選択（新しい動作）**
   - ユーザーが右側のリストアイテムをクリック
   - **iframe 内の再生位置が自動的に切り替わる**
   - 選択された動画が左側の iframe で再生開始

3. **進捗管理**
   - 【完了にする】ボタン: 動画視聴完了をマーク (XP獲得)
   - 【次へ】ボタン: 次の動画に自動切り替え
   - 左側: 選択された動画が iframe で再生

4. **状態保持**
   - 右側リストにチェックマーク✓が表示される (完了済み)
   - XP値がバッジで表示される (+100 XPなど)
   - 現在再生中の動画が強調表示される
   - ページリロード後も状態が保持される

### 実装内容

#### youtube_player.html の修正

**1. iframe の初期化**:
```html
<!-- 動的に src を設定 -->
<iframe id="youtube-player" 
        src="" 
        frameborder="0" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen>
</iframe>
```

**2. switchToVideo() 関数 - 動画切り替え処理**:
```javascript
function switchToVideo(videoIndex) {
    console.log(`[ACTION] Switching to video ${videoIndex}`);
    currentVideoIndex = videoIndex;
    updateCurrentVideoUI();
    
    // iframe の src を更新して、特定のインデックスから再生
    const iframe = document.getElementById('youtube-player');
    if (iframe) {
        const startIndex = videoIndex + 1; // YouTube は 1-indexed
        const newSrc = `https://www.youtube.com/embed/videoseries?list=${PLAYLIST_YOUTUBE_ID}&index=${startIndex}`;
        iframe.src = newSrc;
        
        console.log(`[PLAYER] Switching to video ${videoIndex} (index=${startIndex})`);
    }
    
    sendVideoEvent('start');
}
```

**3. DOMContentLoaded - ページロード時の初期化**:
```javascript
document.addEventListener('DOMContentLoaded', () => {
    console.log('[INIT] Initializing player...');
    
    // iframe を初期化（currentVideoIndex の動画から開始）
    const iframe = document.getElementById('youtube-player');
    const startIndex = currentVideoIndex + 1; // YouTube は 1-indexed
    iframe.src = `https://www.youtube.com/embed/videoseries?list=${PLAYLIST_YOUTUBE_ID}&index=${startIndex}`;
    console.log(`[INIT] iframe src set to index ${startIndex}`);
    
    console.log('[INIT] Loading playlist videos...');
    loadPlaylistVideos();
    
    // ... 続きは同じ
});
```

### 技術的な実装方法

**YouTube embed API の `index` パラメータを活用**:

```
https://www.youtube.com/embed/videoseries?list=PLAYLIST_ID&index=VIDEO_POSITION

- videoseries: プレイリスト内の複数動画を再生
- list: プレイリストID
- index: 再生開始位置（1-indexed）
```

**例**:
- `index=1`: プレイリストの最初の動画から再生
- `index=5`: プレイリストの5番目の動画から再生
- `index=60`: プレイリストの最後の動画から再生

### ファイル変更サマリー

**youtube_player.html**:
- ✅ iframe の初期 `src=""` → DOMContentLoaded で動的に設定
- ✅ `switchToVideo()` 関数修正 → iframe.src を `index` パラメータで更新
- ✅ DOMContentLoaded で初期化時に iframe.src を設定

### UI/UX の流れ

```
[プレイリスト表示]
    ↓
[ユーザーが動画 #5 をクリック]
    ↓
switchToVideo(4) が呼ばれる （0-indexed）
    ↓
iframe.src = "https://www.youtube.com/embed/videoseries?list=PLn...&index=5"
    ↓
[iframe 内の再生位置が #5 に移動]
    ↓
[#5 の動画が自動再生開始]
    ↓
[ユーザーが動画を視聴]
    ↓
【完了にする】 ボタンをクリック
    ↓
[XP獲得、状態保存、リスト項目が ✓ 完了 に更新]
```

### 利点

- ✅ 別ウィンドウを開かない（ウィンドウ管理がシンプル）
- ✅ iframe 内で直接動画が切り替わる
- ✅ YouTube の 公式 embed API を活用（安定性が高い）
- ✅ APIキー不要
- ✅ サーバー側の処理が不要（クライアント側のみ）

### テスト手順

1. ブラウザで `http://127.0.0.1:5000/youtube_player/1` を開く
2. 右側のリストアイテムをクリック
3. ✅ iframe 内の再生位置が切り替わることを確認
4. 【完了にする】ボタンをクリック
5. ✅ XP が獲得され、リスト項目に ✓ マークが表示されることを確認
6. ページをリロード
7. ✅ 完了状態が保持されていることを確認
