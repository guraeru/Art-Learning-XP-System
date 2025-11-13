# 自動再生機能の実装 - 2025年11月14日

## 実装内容

### 1. 動画終了時の自動検出と処理

**YouTube IFrame API を使用して動画終了を検出**:
```javascript
function onPlayerStateChange(event) {
    const YT_ENDED = 0;
    
    if (event.data === YT_ENDED) {
        console.log('[PLAYBACK] Video ended');
        handleVideoEnded();  // 自動処理
    }
}
```

### 2. 動画終了時の自動処理 (`handleVideoEnded()`)

動画が最後まで再生されたら、以下を自動実行：

1. **完了をマーク**
   - サーバーに "complete" イベントを送信
   - XP を自動計算・加算
   - リスト項目に ✓ チェックを表示
   - XPバッジを表示 (+100 XPなど)

2. **次の動画を自動再生**
   - 2秒後に自動で次の動画に切り替え
   - iframe の src を更新
   - Player インスタンスを再初期化

3. **最後の動画の場合**
   - アラート表示: 🎉 すべての動画が完了しました！

### 3. 完了ボタンの動作改善

「✓ 完了にする」ボタン:
- クリック → 完了をマーク
- XP 加算
- **1.5秒後、自動で次の動画を再生**
- 次の動画がない場合 → アラート表示

### 4. Player インスタンスの再初期化

`switchToVideo()` で iframe の src を変更した後、Player インスタンスを再初期化：

```javascript
setTimeout(() => {
    player = new YT.Player('youtube-player', {
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError
        }
    });
}, 500);
```

これにより、新しい動画でも IFrame API が正常に動作します。

## ユーザー体験フロー

### 例：最初から最後まで

```
1. ページ読み込み
   ↓
2. 【プレイリスト表示】
   - 動画 1 が自動再生開始

3. 【動画 1 が最後まで再生される】
   ↓
4. 【自動で完了処理】
   - ✓ 完了マーク
   - +100 XP 獲得
   - 進捗バー更新
   ↓
5. 【2秒後に自動で次の動画を再生】
   - 動画 2 が再生開始
   ↓
6. 【動画 2 が最後まで再生される】
   ↓
7. 【同じ流れで自動完了 & 次の動画へ】
   ...
   ↓
8. 【最後の動画（60番目）が完了】
   ↓
9. 【アラート表示】
   🎉 すべての動画が完了しました！
```

### 手動完了ボタンの使用

```
1. 【動画を途中で見たい場合】
   - 「✓ 完了にする」ボタンをクリック
   ↓
2. 【完了処理実行】
   - ✓ 完了マーク
   - +XX XP 獲得（再生時間に応じて）
   ↓
3. 【1.5秒後に自動で次の動画へ】
```

## 技術的なポイント

### 動画終了の検出

YouTube IFrame API の `onStateChange` イベント：
- `YT_PLAYING (1)`: 再生中
- `YT_PAUSED (2)`: 一時停止
- `YT_ENDED (0)`: **再生終了 ← ここで自動処理**

### XP の計算

```python
XP = duration_seconds / 36  (最小10、最大500)

例：
- 10分（600秒）→ 16 XP
- 1時間（3600秒）→ 100 XP
- 2時間（7200秒）→ 200 XP
```

### 非同期処理の制御

```javascript
// 完了イベント送信
await fetch('/api/video_view_event', {...})

// 完了後、次のアクション
setTimeout(() => {
    switchToVideo(nextIndex);
}, 2000);  // 2秒待機
```

## ファイル変更

**youtube_player.html**:
- ✅ `handleVideoEnded()` 関数新規追加
- ✅ `onPlayerStateChange()` 修正（YT_ENDED 時に自動処理）
- ✅ `switchToVideo()` 修正（Player 再初期化）
- ✅ `markCurrentVideoCompleted()` 修正（完了後に自動再生）

## テスト手順

1. ブラウザで `http://127.0.0.1:5000/youtube_player/1` を開く
2. プレイリストが読み込まれ、動画 1 が自動再生開始
3. 動画を最後まで再生するか、途中で「✓ 完了にする」をクリック
4. 以下を確認：
   - ✅ 右側のリストで動画 1 に ✓ マークが表示
   - ✅ XPバッジが表示（+100 XPなど）
   - ✅ 進捗バーが更新
   - ✅ 2秒後に自動で動画 2 が再生開始
5. 複数動画で同じ流れを確認

## 注意事項

- YouTube IFrame API は、動画の最後到達時に `YT_ENDED` イベントを発火
- 複数の `switchToVideo()` 呼び出しがある場合、前の iframe インスタンスがまだ存在する可能性があるため、500ms 後に再初期化
- ネットワーク遅延により、自動再生がやや遅れることがある
