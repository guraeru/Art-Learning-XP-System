# Art-Learning-XP-System

**ゲーミフィケーション型 アート学習トラッキングシステム**

イラスト・アート学習をゲームのように楽しく続けられる、経験値（XP）ベースの学習記録システムです。

---

## 🎨 概要

Art-Learning-XP-Systemは、イラストやアートの学習を継続的にサポートするWebアプリケーションです。学習時間や作品制作を記録し、経験値（XP）を獲得してランクアップしていくゲーム要素を取り入れることで、モチベーションを維持しながら学習を続けることができます。

### 主な特徴

- **📊 XPベースの進捗管理**: 学習時間や作品制作で経験値を獲得
- **🏆 ランクシステム**: スケッチャーからグランド・クリエイターまで、51段階のランク
- **🎯 Pixiv連携**: 今日のお題や注目のタグを自動取得
- **📚 リソース管理**: 学習用の書籍やWebリンクを一元管理
- **🖼️ 作品ポートフォリオ**: 制作した作品を記録・管理
- **📈 学習統計**: 月別・年別の学習時間をグラフで可視化

---

## 🚀 機能詳細

### 1. 学習記録システム

#### 時間学習
以下の活動タイプで学習時間を記録できます：
- **フリースケッチ** (20 XP/分)
- **基礎技法** (40 XP/分)
- **単体技法** (30 XP/分)
- **応用技法** (50 XP/分)

#### 作品制作・投稿
作品を制作した際に、以下の評価でXPを獲得：
- **単体技法**: 3,000 XP (基本)
- **基礎技法**: 5,000 XP (基本)
- **応用技法**: 8,000 XP (基本)
- **自由投稿**: 1,500 XP (基本)

評価（A〜E）により、基本XPに倍率が適用されます：
- **A**: 5倍
- **B**: 4倍
- **C**: 3倍
- **D**: 2倍
- **E**: 1倍

### 2. ランクシステム

累計XPに応じて51段階のランクがあり、各ランク帯に称号が付与されます：

| ランク | 称号 | 必要XP |
|--------|------|--------|
| 1-5 | Sketcher（スケッチャー） | 0〜 |
| 6-10 | Line Artist（ラインアーティスト） | 110,000〜 |
| 11-15 | Colorist（カラリスト） | 1,200,000〜 |
| 16-20 | Illustrator（イラストレーター） | 1,800,000〜 |
| 21-25 | Creative Designer（クリエイティブデザイナー） | 2,300,000〜 |
| 26-29 | Master Illustrator（マスターイラストレーター） | 2,650,000〜 |
| 30 | The Grand Creator（ザ・グランド・クリエータ） | 2,650,000〜 |
| 31-35 | Diamond Art Virtuoso（アート・ヴィルトゥオーソ） | 4,500,000〜 |
| 36-40 | Visual Alchemist（ビジュアル・アルケミスト） | 7,500,000〜 |
| 41-45 | Legendary Creator（伝説のクリエイター） | 11,000,000〜 |
| 46-51 | Eternal Art Master（永遠のアートマスター） | 13,920,000〜 |

### 3. Pixiv連携機能

- **今日のお題**: Pixiv記念日APIから毎日のお題を取得
- **注目のタグ**: トレンドのイラストタグを表示
- **人気作品サムネイル**: 各お題の人気作品画像を自動取得（R-18除外）
- **キャッシュ機能**: API呼び出しを最適化（30分間のキャッシュ）

### 4. リソース管理

#### 書籍管理
- PDF/ePubファイルのアップロード
- PDFから自動的に表紙を生成
- 書籍の検索・閲覧機能

#### 外部リンク管理
- 学習に役立つWebサイトのリンク集
- カテゴリー別の整理

### 5. 統計・分析

- 月別学習時間グラフ
- 年別学習時間グラフ
- 累計学習時間の表示
- 学習履歴のアーカイブ

---

## 📋 必要要件

### システム要件
- Python 3.8以上
- pip（Pythonパッケージマネージャー）

### 依存ライブラリ
```
Flask
Flask-SQLAlchemy
requests
pytz
PyMuPDF (fitz)
Werkzeug
```

---

## 🔧 インストール方法

### 1. リポジトリのクローン

```bash
git clone https://github.com/guraeru/Art-Learning-XP-System.git
cd Art-Learning-XP-System
```

### 2. 仮想環境の作成（推奨）

```bash
python -m venv venv

# Windowsの場合
venv\Scripts\activate

# macOS/Linuxの場合
source venv/bin/activate
```

### 3. 依存ライブラリのインストール

```bash
pip install Flask Flask-SQLAlchemy requests pytz PyMuPDF Werkzeug
```

### 4. 初回起動

```bash
python app.py
```

アプリケーションは `http://localhost:5000` で起動します。

---

## ⚙️ 設定

### Pixiv API連携（オプション）

Pixiv APIの機能を利用する場合は、認証トークンを取得する必要があります。

1. `Pixiv-OAuth-Flow/pixiv_auth.py` を使用して認証トークンを取得
2. 取得したリフレッシュトークンを `auth.key` ファイルに保存

**注意**: Pixiv API連携が設定されていない場合でも、基本的な学習記録機能は利用可能です。

### データベース

- SQLiteデータベースが自動的に作成されます（`xp_system.db`）
- 初回起動時にテーブルとデフォルトユーザーが自動生成されます

---

## 📖 使い方

### トップページ（ホーム）
- 現在のランクとXPを表示
- 学習時間の記録
- 作品の投稿
- Pixivのお題と注目タグの確認

### マイページ
- ユーザー情報の確認
- 投稿した作品の一覧
- 科目習得記録の管理

### リソースページ
- 登録した書籍の閲覧
- PDFファイルの表示

### アーカイブ
- 過去の学習記録を年別に表示
- 学習時間グラフの確認

### 管理コンソール
- ユーザー名の変更
- 書籍の登録・編集・削除
- 外部リンクの管理
- データの完全リセット

---

## 📁 プロジェクト構成

```
Art-Learning-XP-System/
├── app.py                  # メインアプリケーション
├── models.py               # データベースモデル
├── xp_core.py             # XP計算ロジック
├── templates/             # HTMLテンプレート
│   ├── base.html
│   ├── index.html
│   ├── mypage.html
│   ├── archive.html
│   ├── resources.html
│   ├── admin.html
│   └── edit_link.html
├── static/
│   ├── uploads/           # アップロードファイル保存先
│   └── assets/            # Pixiv画像キャッシュ
├── Pixiv-OAuth-Flow/      # Pixiv認証ツール
└── README.md
```

---

## 🔐 セキュリティに関する注意

- `app.config['SECRET_KEY']` は本番環境では必ず変更してください
- Pixivの認証トークン（`auth.key`）は公開リポジトリにコミットしないでください
- ファイルアップロード機能を使用する場合は、適切なセキュリティ対策を実施してください

---

## 🐛 トラブルシューティング

### ポート5000が既に使用されている場合

`app.py` の最終行でポート番号を変更できます：

```python
app.run(debug=True, host='0.0.0.0', port=8080)  # ポートを8080に変更
```

### PyMuPDFのインストールエラー

PyMuPDFは一部の環境でインストールに失敗することがあります。その場合は以下を試してください：

```bash
pip install --upgrade pip
pip install PyMuPDF
```

### Pixiv画像が表示されない

- `auth.key` ファイルが存在し、有効なリフレッシュトークンが含まれているか確認
- インターネット接続を確認
- Pixiv APIのレート制限に達していないか確認

---

## 🤝 コントリビューション

プルリクエストを歓迎します！バグ報告や機能提案は、GitHubのIssuesからお願いします。

---

## 📄 ライセンス

このプロジェクトは [LICENSE](LICENSE) ファイルに記載されているライセンスの下で公開されています。

---

## 🙏 謝辞

- Pixiv API: お題と注目タグの取得に使用
- Flask: Webフレームワーク
- PyMuPDF: PDF処理機能

---

## 📧 連絡先

問題や質問がある場合は、GitHubのIssuesでお知らせください。

---

# English Version

## 🎨 Overview

Art-Learning-XP-System is a gamified learning tracker for artists and illustrators. Track your practice time, upload artwork, earn experience points (XP), and level up through 51 ranks while staying motivated on your artistic journey.

## ✨ Key Features

- **XP-based Progress Tracking**: Earn XP from practice time and artwork creation
- **51-Rank System**: Progress from Sketcher to Eternal Art Master
- **Pixiv Integration**: Daily art themes and trending tags
- **Resource Management**: Organize learning materials (books, links)
- **Portfolio System**: Track and showcase your artwork
- **Analytics**: Visualize learning progress with monthly/yearly charts

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/guraeru/Art-Learning-XP-System.git
cd Art-Learning-XP-System

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install Flask Flask-SQLAlchemy requests pytz PyMuPDF Werkzeug

# Run the application
python app.py
```

Visit `http://localhost:5000` in your browser.

## 📚 Core Concepts

### XP Earning Methods

**Time-based Learning:**
- Free Sketching: 20 XP/min
- Basic Techniques: 40 XP/min
- Individual Techniques: 30 XP/min
- Advanced Techniques: 50 XP/min

**Artwork Creation:**
- Individual Technique: 3,000 XP (base)
- Basic Technique: 5,000 XP (base)
- Advanced Technique: 8,000 XP (base)
- Free Post: 1,500 XP (base)

Base XP is multiplied by evaluation grade (A=5x, B=4x, C=3x, D=2x, E=1x)

### Ranking System

Progress through 51 ranks with titles:
- Ranks 1-5: **Sketcher**
- Ranks 6-10: **Line Artist**
- Ranks 11-15: **Colorist**
- Ranks 16-20: **Illustrator**
- Ranks 21-25: **Creative Designer**
- Ranks 26-29: **Master Illustrator**
- Rank 30: **The Grand Creator**
- Ranks 31-35: **Diamond Art Virtuoso**
- Ranks 36-40: **Visual Alchemist**
- Ranks 41-45: **Legendary Creator**
- Ranks 46-51: **Eternal Art Master**

## 📖 Usage

- **Home**: Log practice time, post artwork, view daily themes
- **My Page**: View your stats, artwork portfolio, and achievements
- **Resources**: Access your learning materials library
- **Archive**: Review past records and analytics
- **Admin**: Manage account, books, links, and system settings

## ⚙️ Optional: Pixiv Integration

To enable Pixiv features (daily themes, trending tags):

1. Use `Pixiv-OAuth-Flow/pixiv_auth.py` to obtain authentication token
2. Save refresh token to `auth.key` file

The system works without Pixiv integration for basic tracking features.

## 🔒 Security Notes

- Change `SECRET_KEY` in production environments
- Never commit `auth.key` to public repositories
- Implement proper security measures for file uploads

## 🐛 Troubleshooting

**Port 5000 already in use:** Change port in `app.py` (last line)

**PyMuPDF installation fails:** Upgrade pip and retry
```bash
pip install --upgrade pip
pip install PyMuPDF
```

## 📄 License

See [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Pull requests are welcome! For bug reports and feature requests, please use GitHub Issues.

---

**Happy Drawing! 🎨✨**