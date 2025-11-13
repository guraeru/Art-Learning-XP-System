# YouTube プレイリスト自動抽出機能

## 概要
YouTube プレイリスト登録時に、最初のビデオ ID を自動的に抽出してサムネイルを表示する機能を実装しました。

## 実装内容

### 1. プレイリスト登録フロー
- **プレイリスト URL/ID** を入力
- **ビデオ ID** を入力（任意 - 空白で自動抽出を試行）
- **タイトル・説明** を入力（任意）

### 2. 自動抽出ロジック
複数の戦略を試行（優先順）：

#### Strategy 1: Embed Player
```
https://www.youtube.com/embed/videoseries?list={PLAYLIST_ID}
```
- 最初に試行する方法
- 高速だが、限定公開プレイリストでは動作しない

#### Strategy 2: Playlist Page
```
https://www.youtube.com/playlist?list={PLAYLIST_ID}
```
- HTMLを解析して ytInitialData JSON から抽出
- User-Agent ヘッダーを含めて送信
- 通常は機能するが、限定公開の場合は403エラー

#### Strategy 3: Regex Fallback
- watch?v= リンクからの正規表現抽出
- 前の戦略の補助手段

### 3. 抽出結果
- **成功** → サムネイル URL を自動取得
- **失敗** → flash メッセージで報告、ビデオ ID の手動入力を促す

## 限定公開プレイリストの対応

### 問題点
YouTube は限定公開・非公開のコンテンツに対して、認証なしのアクセスを制限しています。
- プレイリストのHTML取得 → 403 Forbidden
- メタデータ抽出 → アクセス不可

### 対応方法
ユーザーが以下の 2 つの方法から選択可能：

#### 方法 1: 手動でビデオ ID を入力
1. プレイリストを開く
2. 最初のビデオをクリック
3. URL から `v=XXXXXXXXXXX` を抽出
4. admin ページの「最初のビデオID」に入力

**例：**
```
URL: https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLxxxxxxxx
ビデオID: dQw4w9WgXcQ
```

#### 方法 2: YouTube API を使用（将来実装）
- Google Cloud Console で API キーを取得
- `youtube.playlists().list()` でプレイリスト情報を取得
- 認証が必要だが、限定公開プレイリストもアクセス可能

## テスト済み項目

### ✅ 実装完了
- [x] プレイリスト登録フロー
- [x] ビデオ ID 自動抽出（複数戦略）
- [x] サムネイル自動取得（5段階品質選択）
- [x] 管理画面でのプレイリスト CRUD
- [x] ホーム画面での表示（16:9 アスペクト比）
- [x] エラーハンドリング

### ⚠️ 制限事項
- 限定公開プレイリストからの自動抽出は不可
- YouTube API キーなしでは認証が必要なコンテンツはアクセス不可

## 実装コード

### `fetch_first_video_id_from_playlist(playlist_id)`
```python
def fetch_first_video_id_from_playlist(playlist_id):
    """プレイリストから最初のビデオ ID を取得"""
    # 複数の戦略を試行
    # 詳細は app.py の該当関数を参照
```

### `fetch_youtube_playlist_thumbnail(video_id)`
```python
def fetch_youtube_playlist_thumbnail(video_id):
    """ビデオ ID からサムネイル URL を取得"""
    # YouTube CDN の複数品質から最高品質を選択
    # 5段階の品質フォールバック実装
```

### `youtube_playlist_process()`
```python
@app.route("/youtube_playlist_process", methods=["POST"])
def youtube_playlist_process():
    """プレイリスト登録・更新エンドポイント"""
    # ビデオ ID が指定されない場合は自動抽出
```

## デフォルトの動作フロー

1. **プレイリスト URL を入力**
   - `https://youtube.com/playlist?list=PLnHIIgbQQU00mHvqPVtNYN8rJTopaYfJ9`

2. **ビデオ ID を空白のまま送信**
   - 自動抽出ロジックが起動

3. **自動抽出結果**
   - 成功 → サムネイル取得、プレイリスト登録
   - 失敗 → エラーメッセージ表示、手動入力を促す

## UI/UX の改善

### Admin ページ
- ビデオ ID フィールド: 「任意」とマーク
- ヘルプテキスト: 「空白の場合は自動取得されます」
- 失敗時: フラッシュメッセージで原因を表示

### ホーム ページ
- 16:9 アスペクト比のカード表示
- レスポンシブデザイン対応
- 遅延読み込み（lazy loading）

## デバッグ・トラブルシューティング

### ログ出力の確認
サーバーのコンソール出力で確認可能：
```
[INFO] Fetching first video from playlist: PLnHIIgbQQU00mHvqPVtNYN8rJTopaYfJ9
[INFO] Trying embed player for playlist PLnHIIgbQQU00mHvqPVtNYN8rJTopaYfJ9
[WARN] Could not extract first video from playlist: PLnHIIgbQQU00mHvqPVtNYN8rJTopaYfJ9
```

### よくある問題
| 問題 | 原因 | 対応 |
|------|------|------|
| サムネイルが表示されない | ビデオ ID が無効 | ビデオ URL から正しい ID を確認 |
| 自動抽出が失敗する | 限定公開プレイリスト | 手動でビデオ ID を入力 |
| タイムアウトが発生 | ネットワーク遅延 | リトライするか ID を手動入力 |

## 今後の改善案

1. **YouTube API 統合**
   - 認証を追加して限定公開プレイリストをサポート

2. **キャッシング**
   - 抽出結果をキャッシュして高速化

3. **バッチ抽出**
   - 複数プレイリストの一括登録

4. **プレビュー機能**
   - 登録前にサムネイルをプレビュー

## ファイル変更履歴

### Modified Files
- `models.py` - YouTubePlaylist モデルに `video_id` カラム追加
- `app.py` - 自動抽出関数の実装
- `templates/admin.html` - UI 更新
- `templates/index.html` - ホーム画面更新

### Created Files
- `YOUTUBE_AUTO_EXTRACTION.md` - このドキュメント

---

**最終更新**: 2025年11月13日
**ステータス**: ✅ 実装完了・テスト中
