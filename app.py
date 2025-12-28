"""
Art Learning XP System - Flask API Server

A REST API backend for the Art Learning XP System.
Serves React SPA frontend and provides API endpoints.
"""

import os
import re
from flask import (
    Flask,
    request,
    send_from_directory,
    jsonify,
    current_app,
)
from flask_cors import CORS
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
from sqlalchemy import func, select
import requests
import pytz
import fitz

from models import db, UserStatus, Record, Book, ResourceLink, YouTubePlaylist, PlaylistViewHistory, VideoView, PlaylistMaterial
from xp_core import XPCalculator, Constants
from api_routes import api_bp

# --- Configuration Constants ---
UPLOAD_FOLDER = "static/uploads"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "pdf", "epub"}
DATABASE_FILE = "xp_system.db"
ASSETS_FOLDER = "static/assets"
AUTH_FILE = "auth.key"

# Pixiv API Configuration
PIXIV_CLIENT_ID = "MOBrBDS8blbauoSck0ZfDbtuzpyT"
PIXIV_CLIENT_SECRET = "lsACyCD94FhDUtGTXi3QzcFE2uU1hqtDaKeqrdwj"
PIXIV_AUTH_URL = "https://oauth.secure.pixiv.net/auth/token"
PIXIV_WEB_HOST = "https://www.pixiv.net"
PIXIV_ANNIVERSARY_API_URL = f"{PIXIV_WEB_HOST}/ajax/idea/anniversary"
PIXIV_TREND_APP_API_URL = "https://app-api.pixiv.net/v1/trending-tags/illust"

# User Agent Settings
OAUTH_PIXIV_USER_AGENT = "PixivAndroidApp/5.0.147 (Android/10)"
WEB_PIXIV_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"

# Cache Settings
CACHE_DURATION = timedelta(minutes=30)

# Timezone
jp = pytz.timezone("Asia/Tokyo")

# Flask Application Setup
app = Flask(__name__, static_folder='static')
CORS(app)
app.config["SECRET_KEY"] = "your_secret_key_here"
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DATABASE_FILE}"
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 256 * 1024 * 1024  # 256 MB max file size

db.init_app(app)

# Register API blueprint
app.register_blueprint(api_bp)

# --- Global Cache and Authentication State ---
_pixiv_cache = None
_cache_expiry = datetime.min
_access_token = None
_token_expires_at = datetime.min
_refresh_token = None


# --- Directory Initialization ---
def _init_directories():
    """Create necessary directories if they don't exist."""
    for folder in [UPLOAD_FOLDER, ASSETS_FOLDER, 'static/dist']:
        if not os.path.exists(folder):
            try:
                os.makedirs(folder)
                print(f"✅ Created directory: {folder}")
            except OSError as e:
                print(f"⚠️ Failed to create directory {folder}: {e}")


_init_directories()


def allowed_file(filename):
    """Check if file extension is allowed."""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# --- Database Initialization ---
with app.app_context():
    db.create_all()
    if not UserStatus.query.first():
        db.session.add(UserStatus(username="イラスト・クリエイター"))
        db.session.commit()


# --- Pixiv API Authentication ---
_token_expires_at = datetime.min
_refresh_token = None
_session_cookie = None


def _load_refresh_token():
    """auth.key ファイルからリフレッシュトークンを読み込みます。"""
    global _refresh_token
    if _refresh_token:
        return _refresh_token

    try:
        with open(AUTH_FILE, 'r') as f:
            token = f.read().strip()
            if not token:
                _refresh_token = None
                return None
            _refresh_token = token
            return token
    except FileNotFoundError:
        _refresh_token = None
        return None
    except Exception as e:
        _refresh_token = None
        return None


def _refresh_access_token():
    """リフレッシュトークンを使ってAppAPI用アクセストークンを取得・更新します。"""
    global _access_token, _token_expires_at
    refresh_token = _load_refresh_token()

    if not refresh_token:
        return False

    if _access_token and datetime.now() < _token_expires_at:
        return True

    headers = {'User-Agent': OAUTH_PIXIV_USER_AGENT}
    data = {
        'client_id': PIXIV_CLIENT_ID,
        'client_secret': PIXIV_CLIENT_SECRET,
        'grant_type': 'refresh_token',
        'refresh_token': refresh_token,
    }

    try:
        response = requests.post(PIXIV_AUTH_URL, data=data, headers=headers, timeout=10)
        response.raise_for_status()
        token_data = response.json()

        _access_token = token_data['access_token']
        expires_in = token_data.get('expires_in', 3600)
        _token_expires_at = datetime.now() + timedelta(seconds=expires_in - 120)

        print("✅ Pixivアクセストークンを更新しました。")
        return True

    except requests.exceptions.RequestException as e:
        print(f"❌ Pixivトークン更新エラー: {e}")
        _access_token = None
        return False


def download_and_save_image(image_url, local_filename, fallback_placeholder):
    """画像URLをダウンロードし、ローカルに保存します。"""
    local_path = os.path.join(app.root_path, ASSETS_FOLDER, local_filename)
    headers = {
        'Referer': PIXIV_WEB_HOST,
        'User-Agent': WEB_PIXIV_USER_AGENT
    }

    try:
        response = requests.get(image_url, headers=headers, stream=True, timeout=10)
        response.raise_for_status()

        with open(local_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        return f"assets/{local_filename}"

    except Exception as e:
        print(f"❌ 画像ダウンロード失敗 ({local_filename}): {e}")
        return fallback_placeholder


def _fetch_anniversary_theme(date):
    """Pixiv 記念日お題 API からお題タグを取得します。"""
    date_formatted = datetime.strftime(date, "%Y-%m-%d")

    headers = {
        'User-Agent': WEB_PIXIV_USER_AGENT,
        'Referer': PIXIV_WEB_HOST + '/',
        'Accept-Language': 'ja-JP',
    }

    try:
        response = requests.get(f'{PIXIV_ANNIVERSARY_API_URL}/{date_formatted}', headers=headers, timeout=5)
        response.raise_for_status()
        data = response.json()

        if data.get('error', True):
            return None

        return data['body']

    except requests.exceptions.RequestException as e:
        return None


def _fetch_tag_image_and_info(tag_name, filename):
    """タグ名でAppAPIのイラスト検索を行い、サムネイル画像を取得します。"""
    global _access_token

    if not _refresh_access_token() or not _access_token:
        return "assets/topic_placeholder.jpg"

    PIXIV_ILLUST_SEARCH_URL = "https://app-api.pixiv.net/v1/search/illust"

    headers = {
        'User-Agent': OAUTH_PIXIV_USER_AGENT,
        'Authorization': f'Bearer {_access_token}',
        'Accept-Language': 'ja-JP',
    }
    params = {
        'word': tag_name,
        'search_target': 'exact_match_for_tags',
        'limit': 20,
        'restrict': '0',
        'filter': 'for_android'
    }

    try:
        json_response = requests.get(PIXIV_ILLUST_SEARCH_URL, headers=headers, params=params, timeout=10)
        json_response.raise_for_status()
        data = json_response.json()

        illusts = data.get('illusts', [])

        for illust in illusts:
            x_restrict = illust.get('x_restrict', 1)
            sanity_level = illust.get('sanity_level', 6)

            tags = illust.get('tags', [])
            has_r18_tag = False
            for tag in tags:
                tag_name_lower = tag.get('name', '').lower()
                if 'r-18' in tag_name_lower or 'r18' in tag_name_lower or '18禁' in tag_name_lower:
                    has_r18_tag = True
                    break

            if x_restrict == 0 and sanity_level <= 4 and not has_r18_tag:
                image_url = illust.get('image_urls', {}).get('medium')
                if image_url:
                    image_path = download_and_save_image(image_url, filename, "assets/topic_placeholder.jpg")
                    return image_path

        return "assets/topic_placeholder.jpg"

    except Exception as e:
        print(f"❌ AppAPI タグ画像検索エラー: {e}")
        return "assets/topic_placeholder.jpg"


def _fetch_trending_tag():
    """AppAPIからトレンドタグを取得します。"""
    global _access_token

    if not _refresh_access_token() or not _access_token:
        return {
            "title": "注目のタグ: (認証失敗)",
            "image": "assets/contest_placeholder.jpg",
            "url": PIXIV_WEB_HOST + '/tags'
        }

    headers = {
        'User-Agent': OAUTH_PIXIV_USER_AGENT,
        'Authorization': f'Bearer {_access_token}',
        'Accept-Language': 'ja-JP',
    }
    params = {'filter': 'for_spotlight'}

    try:
        json_response = requests.get(PIXIV_TREND_APP_API_URL, headers=headers, params=params, timeout=10)
        json_response.raise_for_status()
        data = json_response.json()

        trending_data = data.get('trend_tags', [])

        if trending_data:
            for tag_info in trending_data[:10]:
                tag_name = tag_info.get('tag', '不明なタグ')
                translated_name = tag_info.get('translated_name', '')

                tag_lower = tag_name.lower()
                trans_lower = translated_name.lower() if translated_name else ''
                r18_keywords = ['r-18', 'r18', '18禁', 'nsfw', '巨乳', 'セクシー', 'えっち', '水着', '下着']

                is_r18_tag = False
                for keyword in r18_keywords:
                    if keyword in tag_lower or keyword in trans_lower:
                        is_r18_tag = True
                        break

                if is_r18_tag:
                    continue

                title = f"注目のタグ: #{tag_name}"
                if translated_name and translated_name != tag_name:
                    title += f" ({translated_name})"

                url = PIXIV_WEB_HOST + f"/tags/{tag_name}/artworks"
                image_path = _fetch_tag_image_and_info(tag_name, "pixiv_trend_img.jpg")

                if image_path == "assets/topic_placeholder.jpg":
                    continue

                return {
                    "title": title,
                    "image": image_path,
                    "url": url
                }

            return {
                "title": "注目のタグ: (全年齢作品なし)",
                "image": "assets/contest_placeholder.jpg",
                "url": PIXIV_WEB_HOST + '/tags'
            }

        raise Exception("AppAPI returned empty trending tags.")

    except Exception as e:
        print(f"❌ Pixiv AppAPI トレンド取得エラー: {e}")
        return {
            "title": "注目のタグ: (AppAPIエラー)",
            "image": "assets/contest_placeholder.jpg",
            "url": PIXIV_WEB_HOST + '/tags'
        }


def get_latest_pixiv_info():
    """記念日お題 API + AppAPI トレンドタグから情報を取得します。"""
    global _pixiv_cache, _cache_expiry

    if _pixiv_cache is not None and datetime.now() < _cache_expiry:
        return _pixiv_cache

    topics = []

    now = datetime.now(jp)
    theme_data = _fetch_anniversary_theme(now)

    if theme_data and theme_data.get('idea_anniversary_tag'):
        tag_name = theme_data['idea_anniversary_tag']
        description = theme_data.get('idea_anniversary_description', '')

        image_path = _fetch_tag_image_and_info(tag_name, "pixiv_topic_img.jpg")

        topic_title = f"今日のモチーフ: #{tag_name}"
        if description:
            topic_title += f" ({description.split('。')[0]}...)"

        topic_url = PIXIV_WEB_HOST + f"/tags/{tag_name}/artworks"

        topics.append({
            "title": topic_title,
            "image": image_path,
            "url": topic_url
        })
    else:
        topics.append({
            "title": "今日のモチーフ: (お題が見つかりません)",
            "image": "assets/topic_placeholder.jpg",
            "url": PIXIV_WEB_HOST + '/tags'
        })

    trending_tag_info = _fetch_trending_tag()
    topics.append(trending_tag_info)

    _pixiv_cache = topics
    _cache_expiry = datetime.now() + CACHE_DURATION

    return topics


# --- Helper Functions ---

def delete_uploaded_file(file_path: str):
    """アップロードフォルダ内のファイルを安全に削除します。"""
    if not file_path:
        return

    try:
        filename = os.path.basename(file_path.replace('\\', '/'))
        upload_folder = app.config['UPLOAD_FOLDER']
        full_path = os.path.join(upload_folder, filename)

        if os.path.exists(full_path):
            os.remove(full_path)
            print(f"✅ ファイル削除成功: {full_path}")
        else:
            print(f"⚠️ ファイルが見つかりません: {full_path}")

    except Exception as e:
        print(f"❌ ファイル削除エラー: {e}")


def save_material_file(file, playlist_id):
    """講義資料ファイルを保存します。"""
    if not file or not file.filename:
        return None

    original_filename = secure_filename(file.filename)
    stored_filename = f"material_{playlist_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}_{original_filename}"
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], stored_filename)
    file.save(filepath)

    return {
        'stored_filename': stored_filename,
        'original_filename': original_filename,
        'file_size': os.path.getsize(filepath)
    }


# --- YouTube Helper Functions ---

def extract_playlist_id(url_or_id):
    """Extract YouTube playlist ID from URL or ID string."""
    if not url_or_id:
        return None

    if "youtube.com" in url_or_id or "youtu.be" in url_or_id:
        match = re.search(r"[?&]list=([a-zA-Z0-9_-]+)", url_or_id)
        if match:
            return match.group(1)

    if re.match(r"^[a-zA-Z0-9_-]+$", url_or_id):
        return url_or_id

    return None


def fetch_youtube_playlist_info(playlist_id):
    """Fetch YouTube playlist information using OEmbed API."""
    if not playlist_id:
        return None

    try:
        oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/playlist?list={playlist_id}&format=json"
        response = requests.get(oembed_url, timeout=5)

        if response.status_code == 200:
            data = response.json()
            title = data.get('title', f'Playlist ({playlist_id[:8]}...)')
            author = data.get('author_name', 'YouTube')
            html_code = data.get('html', '')

            return {
                'title': title,
                'author': author,
                'thumbnail_html': html_code,
                'playlist_id': playlist_id,
            }
        else:
            return None
    except Exception as e:
        print(f"[ERROR] Failed to fetch playlist info: {e}")
        return None


def get_youtube_playlist_video_ids(playlist_id):
    """Extract all video IDs from a YouTube playlist using yt-dlp."""
    if not playlist_id:
        return []

    try:
        import yt_dlp

        playlist_url = f"https://www.youtube.com/playlist?list={playlist_id}"

        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': 'in_playlist',
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(playlist_url, download=False)

            video_ids = []
            if 'entries' in info:
                for entry in info['entries']:
                    if entry and 'id' in entry:
                        video_ids.append(entry['id'])

            return video_ids

    except ImportError:
        print(f"[ERROR] yt-dlp not installed")
        return []

    except Exception as e:
        print(f"[ERROR] Failed to get video IDs: {e}")
        return []


def get_youtube_playlist_videos_info_ytdlp(playlist_id):
    """Extract video information from a YouTube playlist using yt-dlp."""
    if not playlist_id:
        return {}

    try:
        import yt_dlp

        playlist_url = f"https://www.youtube.com/playlist?list={playlist_id}"

        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': 'in_playlist',
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(playlist_url, download=False)

            video_info_map = {}
            if 'entries' in info:
                for entry in info['entries']:
                    if entry and 'id' in entry:
                        video_id = entry['id']
                        video_info_map[video_id] = {
                            'title': entry.get('title', f'Video {video_id}'),
                            'duration': entry.get('duration', 0),
                            'thumbnail_url': entry.get('thumbnails', [{}])[-1].get('url', '') if entry.get('thumbnails') else '',
                            'channel': entry.get('channel', 'YouTube'),
                        }

            return video_info_map

    except ImportError:
        return {}

    except Exception as e:
        print(f"[ERROR] Failed to extract playlist info: {e}")
        return {}


# --- Static File Routes ---

@app.route('/static/<path:filename>')
def serve_static(filename):
    """Serve static files."""
    return send_from_directory('static', filename)


@app.route('/uploads/<filename>')
def uploaded_file(filename):
    """Serve uploaded files."""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


@app.route('/playlist_materials/<int:material_id>/download')
def download_playlist_material(material_id):
    """Download a playlist material file."""
    material = PlaylistMaterial.query.get(material_id)
    if not material:
        return jsonify({'error': '講義資料が見つかりません。'}), 404
    
    return send_from_directory(
        app.config['UPLOAD_FOLDER'],
        material.stored_filename,
        as_attachment=True,
        download_name=material.original_filename
    )


# --- SPA Routes ---

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_spa(path):
    """Serve the React SPA."""
    # API routes are handled by the blueprint - don't interfere
    # Just let Flask's 404 handler deal with unmatched API routes
    if path.startswith('api/'):
        # This should never be reached if the API blueprint is working
        # but just in case, abort with 404
        from flask import abort
        abort(404)

    # Check if it's a static file request
    if path and os.path.exists(os.path.join(app.static_folder, 'dist', path)):
        return send_from_directory(os.path.join(app.static_folder, 'dist'), path)

    # Serve index.html for SPA routing
    dist_path = os.path.join(app.static_folder, 'dist', 'index.html')
    if os.path.exists(dist_path):
        return send_from_directory(os.path.join(app.static_folder, 'dist'), 'index.html')

    # Fallback: return a message to build the frontend
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Art Learning XP System</title>
        <style>
            body { font-family: system-ui, sans-serif; max-width: 600px; margin: 100px auto; padding: 20px; text-align: center; }
            h1 { color: #0ea5e9; }
            code { background: #f0f0f0; padding: 4px 8px; border-radius: 4px; }
            .steps { text-align: left; background: #f9fafb; padding: 20px; border-radius: 12px; margin-top: 20px; }
            .steps li { margin: 10px 0; }
        </style>
    </head>
    <body>
        <h1>🎨 Art Learning XP System</h1>
        <p>フロントエンドがビルドされていません。以下のコマンドを実行してください：</p>
        <div class="steps">
            <ol>
                <li><code>cd frontend</code></li>
                <li><code>npm install</code></li>
                <li><code>npm run build</code></li>
            </ol>
        </div>
        <p style="margin-top: 20px;">または、開発モードで実行する場合：</p>
        <div class="steps">
            <ol>
                <li>ターミナル1: <code>python app.py</code> (APIサーバー)</li>
                <li>ターミナル2: <code>cd frontend && npm run dev</code> (フロントエンド)</li>
            </ol>
        </div>
    </body>
    </html>
    """, 200


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
