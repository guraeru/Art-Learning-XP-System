"""
Database Models for Art Learning XP System

Data models for user status, learning records, books, resource links, and YouTube playlists.
"""

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin

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


class PlaylistViewHistory(db.Model):
    """プレイリスト視聴履歴を保持するテーブル。"""
    
    __tablename__ = "playlist_view_history"

    id = db.Column(db.Integer, primary_key=True)
    playlist_id = db.Column(db.Integer, db.ForeignKey('youtube_playlist.id'), nullable=False)
    playlist = db.relationship('YouTubePlaylist', backref='view_histories')
    video_index = db.Column(db.Integer)  # プレイリスト内の動画インデックス（0-based）
    last_viewed = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<PlaylistViewHistory playlist_id={self.playlist_id}, video_index={self.video_index}>"


class VideoView(db.Model):
    """個別動画の視聴情報を保持するテーブル。"""
    
    __tablename__ = "video_view"

    id = db.Column(db.Integer, primary_key=True)
    playlist_id = db.Column(db.Integer, db.ForeignKey('youtube_playlist.id'), nullable=False)
    playlist = db.relationship('YouTubePlaylist', backref='video_views')
    video_index = db.Column(db.Integer)  # プレイリスト内のビデオインデックス
    video_title = db.Column(db.String(500))  # 動画タイトル（OEmbed APIから取得可能）
    watch_count = db.Column(db.Integer, default=0)  # 視聴回数
    watched_duration_seconds = db.Column(db.Integer, default=0)  # 視聴時間（秒）
    is_completed = db.Column(db.Boolean, default=False)  # 視聴完了フラグ
    first_viewed = db.Column(db.DateTime)  # 最初に視聴した日時
    last_viewed = db.Column(db.DateTime)  # 最後に視聴した日時
    xp_gained = db.Column(db.Integer, default=0)  # 獲得XP

    def __repr__(self):
        return f"<VideoView playlist_id={self.playlist_id}, video_index={self.video_index}>"


class PlaylistMaterial(db.Model):
    """プレイリスト講義資料を保持するテーブル。"""
    
    __tablename__ = "playlist_material"

    id = db.Column(db.Integer, primary_key=True)
    playlist_id = db.Column(db.Integer, db.ForeignKey('youtube_playlist.id'), nullable=False)
    playlist = db.relationship('YouTubePlaylist', backref='materials')
    stored_filename = db.Column(db.String(500), nullable=False)  # サーバー保存ファイル名
    original_filename = db.Column(db.String(500), nullable=False)  # 元のファイル名
    display_name = db.Column(db.String(500))  # 表示名
    file_size = db.Column(db.Integer)  # ファイルサイズ（バイト）
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<PlaylistMaterial {self.original_filename}>"


class User(UserMixin, db.Model):
    """Flask-Login用ユーザーモデル。"""

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        """パスワードをハッシュ化して設定します。"""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """入力されたパスワードが正しいか検証します。"""
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f"<User {self.username}>"