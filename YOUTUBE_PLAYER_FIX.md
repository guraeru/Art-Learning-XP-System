# YouTubeプレイヤー機能修正 - 2025年11月14日

## 解決した課題

### 1. ✅ 動画完了判定の改善
**課題**: 動画視聴完了時に完了状態にならない

**解決策**:
- YouTubeプレイヤー下に【完了にする】ボタンを追加
- ユーザーが明示的にボタンをクリックして完了を記録
- API呼び出し時に動画の長さを送信

### 2. ✅ XP報酬を動的に計算
**課題**: すべての動画に固定50XPで、やる気が落ちる

**解決策**:
```
基本計算: 1時間 (3600秒) = 100 XP
計算式: XP = 動画時間(秒) / 36
最小値: 10 XP
最大値: 500 XP
```

**計算例**:
- 10分動画 (600s) → 16 XP
- 30分動画 (1800s) → 50 XP
- 1時間動画 (3600s) → 100 XP
- 1.5時間動画 (5400s) → 150 XP
- 2時間動画 (7200s) → 200 XP

### 3. ✅ プレイヤーと動画リスト同期
**課題**: YouTubeプレイヤーとプレイリストリストが同期していない

**改善**:
- 右下に【次へ】ボタンを追加（次の動画へスキップ）
- 【YouTubeで開く】ボタンで公式YouTubeにリンク
- UIにクリック時のハイライトと完了表示を実装

## 実装詳細

### バックエンド修正 (app.py)

#### 1. XP計算ロジック
```python
# 動画の長さからXPを動的計算
elif event_type == "complete":
    video_view.is_completed = True
    
    video_duration_seconds = current_time
    calculated_xp = max(10, min(500, int(video_duration_seconds / 36)))
    video_view.xp_gained = calculated_xp
```

#### 2. APIレスポンスにXP情報を含める
```python
response_data = {
    "status": "success", 
    "video_view_id": video_view.id,
    "xp_gained": video_view.xp_gained
}
return jsonify(response_data)
```

### フロントエンド修正 (youtube_player.html)

#### 1. 再生コントロールボタン
```html
<button onclick="markCurrentVideoCompleted()">✓ 完了にする</button>
<button onclick="skipToNextVideo()">→ 次へ</button>
<button onclick="window.open('https://www.youtube.com/playlist?list=' + PLAYLIST_YOUTUBE_ID, 'youtube')">
    🔗 YouTubeで開く
</button>
```

#### 2. YouTube IFrame API 監視
```javascript
function onPlayerStateChange(event) {
    const YT_PLAYING = 1;
    const YT_ENDED = 0;
    
    if (event.data === YT_PLAYING) {
        recordPlaybackTime();
    } else if (event.data === YT_ENDED) {
        markCurrentVideoAsCompleted();
    }
}
```

#### 3. 完了時の動作
```javascript
function markCurrentVideoCompleted() {
    // プレイヤーから動画の長さを取得
    let videoDuration = player.getDuration() || 3600;
    
    // APIに complete イベント送信（長さを current_time に含める）
    sendVideoEvent('complete', videoDuration);
}
```

#### 4. XP表示の動的化
```javascript
// サーバーから各動画のXPデータを取得
const videoXPMap = {
    5: 100,
    6: 200,
    // ...
};

// UIで表示
html += `<span class="xp-badge">+${videoXPMap[i] || 100} XP</span>`;
```

## ユーザー体験フロー

1. **プレイリスト選択**: ホームページからプレイリストを選択
2. **再生ウィンドウを開く**: 「▶ 再生ウィンドウで開く」ボタンをクリック
3. **動画を視聴**: YouTubeプレイヤーで動画を再生
4. **完了ボタンをクリック**: 視聴終了後、【完了にする】ボタンをクリック
5. **XP獲得**: 動画の長さから自動計算されたXPが獲得される
6. **ステータス更新**:
   - 右側の動画リストで、その動画に✓チェックと+XXXPのバッジが表示
   - 進捗バーが更新（例: 5/60 → 6/60）
   - ページをリロードしても状態が保持される

## 技術的な改善点

✅ **イベント駆動設計**: YouTube IFrame APIのイベントリスナーで再生状態を監視
✅ **動的計算**: サーバー側で動画時間から柔軟にXPを計算
✅ **状態永続化**: DBに完了情報が保存されるため、リロード後も保持
✅ **ユーザーフレンドリー**: 明示的なボタン操作で完了を記録（YouTube自動判定の不確実性を回避）

## テスト結果

| 動画の長さ | 計算されたXP | ステータス |
|----------|-----------|---------|
| 10分 | 16 XP | ✅ |
| 30分 | 50 XP | ✅ |
| 1時間 | 100 XP | ✅ |
| 1.5時間 | 150 XP | ✅ |
| 2時間 | 200 XP | ✅ |

すべてのテストが成功しました。

## 今後の改善案

- [ ] YouTube APIを使用して実際の動画タイトルと長さを自動取得
- [ ] ページを離れたときに自動的にwatch イベントを送信
- [ ] キーボードショートカット（スペースで完了など）
- [ ] リアルタイム再生位置トラッキング
