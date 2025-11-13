"""
Database Models for Art Learning XP System

Data models for user status, learning records, books, resource links, and YouTube playlists.
"""

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


class UserStatus(db.Model):
    """ユーザーの全体ステータス（累計XP）を保持するテーブル。1レコードのみ存在します。"""

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), default="新規ユーザー", nullable=False)
    total_xp = db.Column(db.Integer, default=0, nullable=False)


class Record(db.Model):
    """個別の学習記録を保持するテーブル。"""

    id = db.Column(db.Integer, primary_key=True)

    # 記録の基本情報
    type = db.Column(db.String(50), nullable=False)  # '時間学習' or '科目習得'
    subtype = db.Column(db.String(100), nullable=False)  # 活動タイプ or 技法タイプ
    description = db.Column(db.Text)
    xp_gained = db.Column(db.Integer, nullable=False)
    date = db.Column(db.DateTime, default=datetime.utcnow)  # 記録日時

    # 時間学習専用フィールド
    duration_minutes = db.Column(db.Integer, default=0)

    # 科目習得専用フィールド
    evaluation = db.Column(db.String(1), default=None)  # 'A', 'B', 'C', 'D', 'E'
    image_path = db.Column(db.String(255), default=None)  # アップロード画像パス

    def __repr__(self):
        return f"<Record {self.id}: {self.type} - {self.xp_gained} XP>"

    def get_year(self):
        """記録の年度を取得します。アーカイブ表示用。"""
        return self.date.strftime("%Y")


class Book(db.Model):
    """学習用書籍を保持するテーブル。"""

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    author = db.Column(db.String(100))
    description = db.Column(db.Text)
    cover_image_path = db.Column(db.String(255))  # 表紙画像ファイル名
    pdf_file_path = db.Column(db.String(255), unique=True, nullable=False)  # PDFファイル名
    added_date = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<Book {self.id}: {self.title}>"


class ResourceLink(db.Model):
    """学習用リソースリンクを保持するテーブル。"""

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    url = db.Column(db.String(500), nullable=False)
    description = db.Column(db.Text)
    added_date = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<ResourceLink {self.id}: {self.name}>"


class YouTubePlaylist(db.Model):
    """YouTube再生リストを保持するテーブル。"""
    
    __tablename__ = "youtube_playlist"

    id = db.Column(db.Integer, primary_key=True)
    playlist_id = db.Column(db.String(255), unique=True, nullable=False)  # YouTube Playlist ID
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    thumbnail_url = db.Column(db.String(500))  # Playlist thumbnail or embed iframe HTML
    added_date = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<YouTubePlaylist {self.id}: {self.title}>"