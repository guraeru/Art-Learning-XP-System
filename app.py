"""
Art Learning XP System - Flask Application

A comprehensive learning management system for artists featuring:
- XP-based learning progress tracking
- Pixiv integration for inspiration and trending content
- Book and resource library management
- YouTube playlist integration
- Mobile-friendly responsive interface
"""

import os
import re
from flask import (
    Flask,
    render_template,
    request,
    redirect,
    url_for,
    flash,
    send_from_directory,
    jsonify,
    current_app,
)
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
from sqlalchemy import func, select
import requests
import pytz
import fitz

from models import db, UserStatus, Record, Book, ResourceLink, YouTubePlaylist, PlaylistViewHistory, VideoView
from xp_core import XPCalculator, Constants

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
app = Flask(__name__)
app.config["SECRET_KEY"] = "your_secret_key_here"
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DATABASE_FILE}"
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 256 * 1024 * 1024  # 256 MB max file size

db.init_app(app)

# --- Global Cache and Authentication State ---
_pixiv_cache = None
_cache_expiry = datetime.min
_access_token = None
_token_expires_at = datetime.min
_refresh_token = None


# --- Directory Initialization ---
def _init_directories():
    """Create necessary directories if they don't exist."""
    for folder in [UPLOAD_FOLDER, ASSETS_FOLDER]:
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
    """auth.key ファイルからリフレッシュトークンを読み込みます。（AppAPI用）"""
    global _refresh_token
    if _refresh_token: return _refresh_token
        
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
    
    if not refresh_token: return False
        
    if _access_token and datetime.now() < _token_expires_at: return True 

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
        
        print("✅ Pixivアクセストークンを更新しました。（AppAPI用）")
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Pixivトークン更新エラー: {e}")
        _access_token = None
        return False

def download_and_save_image(image_url, local_filename, fallback_placeholder):
    """AppAPIや検索結果の画像URLをダウンロードし、ローカルに保存します。"""
    local_path = os.path.join(app.root_path, ASSETS_FOLDER, local_filename)
    # Refererヘッダーがないと403になることが多いため必須
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
        print(f"❌ 画像ダウンロード失敗 ({local_filename}, URL: {image_url}): {e}")
        return fallback_placeholder


# --- お題取得ロジック (記念日 API) ---

def _fetch_anniversary_theme(date):
    """Pixiv 記念日お題 API から、特定の日付のお題タグを取得します。"""
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
        
        if data.get('error', True): return None
            
        return data['body']
        
    except requests.exceptions.RequestException as e:
        return None

def _fetch_tag_image_and_info(tag_name, filename):
    """
    タグ名でAppAPIのイラスト検索を行い、人気作品（R-18除外）のサムネイル画像URLを取得しダウンロードします。
    """
    global _access_token
    
    if not _refresh_access_token() or not _access_token:
        print("❌ タグ画像取得失敗: アクセストークンが利用できません。")
        return "assets/topic_placeholder.jpg" 

    # AppAPIのイラスト検索エンドポイント
    PIXIV_ILLUST_SEARCH_URL = "https://app-api.pixiv.net/v1/search/illust"

    headers = {
        'User-Agent': OAUTH_PIXIV_USER_AGENT,
        'Authorization': f'Bearer {_access_token}', 
        'Accept-Language': 'ja-JP',
    }
    # 人気度/関連性順 (sortパラメーターは省略) とR-18除外強化
    params = {
        'word': tag_name, 
        'search_target': 'exact_match_for_tags', 
        'limit': 10,  # 複数件取得してフィルター
        'restrict': '0',       # R-18作品を除外 (Webのフィルター)
        'filter': 'for_android' # 全年齢対象を強制 (Appのフィルター)
    } 

    try:
        json_response = requests.get(PIXIV_ILLUST_SEARCH_URL, headers=headers, params=params, timeout=10)
        json_response.raise_for_status()
        data = json_response.json()
        
        illusts = data.get('illusts', [])
        
        # R-18フィルタリング: 返ってきた作品を手動でチェック
        for illust in illusts:
            # x_restrict: 0=全年齢, 1=R-18, 2=R-18G
            # sanity_level: 0-4=全年齢, 5=R-18, 6=R-18G
            x_restrict = illust.get('x_restrict', 0)
            sanity_level = illust.get('sanity_level', 6)
            
            # 全年齢作品のみ使用（x_restrict == 0 かつ sanity_level <= 4）
            if x_restrict == 0 and sanity_level <= 4:
                image_url = illust.get('image_urls', {}).get('medium')
                if image_url:
                    image_path = download_and_save_image(image_url, filename, "assets/topic_placeholder.jpg")
                    print(f"✅ お題タグ '{tag_name}' の全年齢作品の画像をダウンロードしました。（R-18除外: x_restrict={x_restrict}, sanity_level={sanity_level}）")
                    return image_path
        
        # 全年齢作品が見つからなかった場合
        print(f"⚠️ タグ '{tag_name}' の全年齢作品が見つかりませんでした。")
        return "assets/topic_placeholder.jpg"

    except Exception as e:
        print(f"❌ AppAPI タグ画像検索エラー: {e}")
        return "assets/topic_placeholder.jpg"


def _fetch_trending_tag():
    """
    AppAPIからトレンドタグ（注目のタグ）を取得し、人気作品の画像を検索します。
    """
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
    # トレンドタグのリストを取得するためのAPIコール。
    params = {'filter': 'for_spotlight'} 
    
    try:
        json_response = requests.get(PIXIV_TREND_APP_API_URL, headers=headers, params=params, timeout=10)
        json_response.raise_for_status()
        data = json_response.json()

        trending_data = data.get('trend_tags', [])
        
        if trending_data:
            # トレンドタグの1番目を採用
            tag_info = trending_data[0]
            tag_name = tag_info.get('tag', '不明なタグ')
            translated_name = tag_info.get('translated_name')
            
            title = f"注目のタグ: #{tag_name}"
            if translated_name and translated_name != tag_name:
                 title += f" ({translated_name})"
            
            url = PIXIV_WEB_HOST + f"/tags/{tag_name}/artworks"
            
            # _fetch_tag_image_and_info (人気順・R-18除外フィルター適用済み)を呼び出し、画像を取得
            image_path = _fetch_tag_image_and_info(tag_name, "pixiv_trend_img.jpg")
            
            print(f"✅ トレンドタグ '{tag_name}' の画像を再検索・ダウンロードしました。（人気順・R-18除外強化）")
                
            return {
                "title": title, 
                "image": image_path, 
                "url": url
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
    """
    【記念日お題 API + AppAPI トレンドタグ】から情報を取得し、キャッシュします。
    """
    global _pixiv_cache, _cache_expiry
    
    # 🌟 キャッシュの有効期限チェック 🌟
    if _pixiv_cache is not None and datetime.now() < _cache_expiry:
        print("✅ Pixiv情報をキャッシュから読み込みました。")
        return _pixiv_cache
    
    topics = []
    
    # --- 1. 今日のお題を取得 (記念日 API) ---
    now = datetime.now(jp)
    theme_data = _fetch_anniversary_theme(now)

    if theme_data and theme_data.get('idea_anniversary_tag'):
        tag_name = theme_data['idea_anniversary_tag']
        description = theme_data.get('idea_anniversary_description', '')
        
        # 人気順・R-18除外フィルター適用済みの画像検索関数を呼び出し
        image_path = _fetch_tag_image_and_info(tag_name, "pixiv_topic_img.jpg")
        
        topic_title = f"今日のモチーフ: #{tag_name}"
        if description:
            # descriptionの冒頭を付記
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
        
    # --- 2. 注目のタグを取得 (AppAPI トレンド) ---
    trending_tag_info = _fetch_trending_tag()
    topics.append(trending_tag_info)
    
    # 🌟 キャッシュを更新 🌟
    _pixiv_cache = topics
    _cache_expiry = datetime.now() + CACHE_DURATION
    print(f"✅ Pixiv情報を取得し、キャッシュを更新しました。有効期限: {_cache_expiry.strftime('%H:%M:%S')}")
            
    return topics


# --- ヘルパー関数 ---

def get_current_status():
    """現在のユーザー情報とXPステータスを辞書で返します。"""
    user_status = UserStatus.query.first()
    if not user_status:
        rank_info = XPCalculator.get_rank_info(0)
        rank_info['username'] = "新規ユーザー"
        rank_info['total_time_hours'] = 0
        rank_info['total_time_minutes'] = 0
        return rank_info
        
    rank_info = XPCalculator.get_rank_info(user_status.total_xp)
    rank_info['username'] = user_status.username

    total_time_minutes = db.session.scalar(
        db.select(db.func.sum(Record.duration_minutes))
        .where(Record.type == '時間学習')
    ) or 0
    rank_info['total_time_minutes'] = total_time_minutes
    rank_info['total_time_hours'] = total_time_minutes // 60
    
    return rank_info

# 💡 外部リンク取得
def get_recent_links(limit=5):
    """最新の外部リンクをN件取得します。（index.html用）"""
    links_result = db.session.execute(
        db.select(ResourceLink).order_by(ResourceLink.added_date.desc()).limit(limit)
    ).scalars().all()
    return links_result
    
# 💡 新規ヘルパー関数: PDFから表紙を生成
# --- ルーティング ---
def generate_cover_from_pdf(pdf_filepath, book_id):
    """
    PDFファイルの1ページ目をJPG画像として抽出し、保存パスを返します。
    PyMuPDF (fitz) を使用して実装されています。
    """
    # 💡 関数内で必要なライブラリをインポート
    try:
        # 1. 出力ファイルパスの準備
        # --- 変更: .png から .jpg に変更（ファイル名の拡張子） ---
        cover_filename = f"cover_{book_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.jpg"
        
        # current_app.config を使用して安全に UPLOAD_FOLDER のパスを構築
        upload_folder = current_app.config['UPLOAD_FOLDER']
        cover_filepath = os.path.join(upload_folder, cover_filename)
        
        # 2. PyMuPDFでPDFを開き、最初のページを読み込む
        doc = fitz.open(pdf_filepath)
        page = doc.load_page(0)  # 最初のページ (インデックス 0)
        
        # 3. ページをPixmapにレンダリング（高解像度 300 DPIで設定）
        zoom = 300 / 72.0  # DPIをZoomファクタに変換
        mat = fitz.Matrix(zoom, zoom)
        # alpha=False は不要ですが、残しておいても問題ありません
        pix = page.get_pixmap(matrix=mat, alpha=False) 
        
        # 4. PixmapをJPGファイルとして保存
        # --- 変更: saveの第2引数でフォーマットを明示し、jpeg_qualityで画質を指定（重要！） ---
        # jpeg_qualityは1（最低画質）から100（最高画質）で指定します。85は良いバランスです。
        pix.save(cover_filepath, 'jpeg', jpeg_quality=85) # ★この行が動作保証された正しい書き方★
        
        doc.close()
            
        print(f"✅ PyMuPDFで表紙を自動生成しました: {cover_filename}")
        
        # DBに保存するパスを返す（'static/uploads/...' 形式）
        # os.path.join(upload_folder, cover_filename)の代わりに、
        # 相対パスを返すため、元のコードの仕様に合わせて修正します。
        return f"{os.path.basename(upload_folder)}/{cover_filename}"
        
    except FileNotFoundError:
        print(f"❌ PDF表紙自動生成エラー（ID: {book_id}）: ファイルが見つかりません。パス: {pdf_filepath}")
        return None
    except Exception as e:
        # 他のエラー（PDF破損、ライブラリ使用方法の間違いなど）
        print(f"❌ PDF表紙自動生成エラー（ID: {book_id}）: {e}")
        return None

@app.route('/', methods=['GET', 'POST'])
def index():
    status = get_current_status()
    # 💡 index.htmlに外部リンクのリストを渡す
    recent_links = get_recent_links(limit=5)
    
    # YouTube再生リストを取得
    youtube_playlists_result = db.session.execute(db.select(YouTubePlaylist).order_by(YouTubePlaylist.added_date.desc()))
    youtube_playlists = youtube_playlists_result.scalars().all()
    
    context = {
        'status': status,
        'xp_rates': Constants.XP_RATES_PER_MINUTE,
        'acq_types': Constants.ACQUISITION_BASE_XP,
        'evaluations': Constants.EVALUATION_MAP,
        'total_time_hours': status['total_time_hours'],
        'total_time_minutes': status['total_time_minutes'] % 60,
        'recent_links': recent_links, # 💡 追加
        'youtube_playlists': youtube_playlists,  # 💡 YouTube再生リスト追加
    }

    return render_template('index.html', **context)

@app.route('/log/time', methods=['POST'])
def log_time():
    try:
        activity_type = request.form.get('activity_type')
        duration_minutes = int(request.form.get('duration'))
        description = request.form.get('description')
        
        if duration_minutes <= 0:
            raise ValueError("時間は正の整数である必要があります。")

        gained_xp = XPCalculator.calculate_time_xp(activity_type, duration_minutes)

        if gained_xp > 0:
            new_record = Record(
                type='時間学習', 
                subtype=activity_type, 
                duration_minutes=duration_minutes, 
                description=description, 
                xp_gained=gained_xp,
                date=datetime.now()
            )
            db.session.add(new_record)
            
            user_status = UserStatus.query.first()
            user_status.total_xp += gained_xp
            db.session.commit()
            
            flash(f"{activity_type} の記録に成功しました! +{gained_xp:,} XPを獲得しました。", 'success')
        else:
            flash("記録に失敗しました。活動タイプを確認してください。", 'warning')
            
    except Exception as e:
        db.session.rollback()
        flash(f"エラーが発生しました: {e}", 'error')
        
    return redirect(url_for('index'))

@app.route('/log/acquisition', methods=['POST'])
def log_acquisition():
    try:
        technique_type = request.form.get('technique_type')
        evaluation = request.form.get('evaluation').upper()
        description = request.form.get('description')
        image_file = request.files.get('image_proof')
        
        image_path = None
        if image_file and allowed_file(image_file.filename):
            filename = secure_filename(f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{image_file.filename}")
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            image_file.save(filepath)
            image_path = os.path.join(UPLOAD_FOLDER, filename).replace('\\', '/')
        elif image_file and image_file.filename != '':
            flash("許可されていないファイル形式です。", 'error')
            return redirect(url_for('mypage'))
        
        gained_xp = XPCalculator.calculate_acquisition_xp(technique_type, evaluation)

        if gained_xp > 0:
            new_record = Record(
                type='科目習得', 
                subtype=technique_type, 
                evaluation=evaluation,
                description=description, 
                xp_gained=gained_xp,
                image_path=image_path,
                date=datetime.now()
            )
            db.session.add(new_record)
            
            user_status = UserStatus.query.first()
            user_status.total_xp += gained_xp
            db.session.commit()
            
            flash(f"作品「{technique_type}」 (評価: {evaluation}) の記録に成功しました! +{gained_xp:,} XPを獲得。", 'success')
        else:
            flash("記録に失敗しました。XPが0以下となりました。作品タイトル/技法または評価を確認してください。", 'warning')
            
    except Exception as e:
        db.session.rollback()
        flash(f"エラーが発生しました: {e}", 'error')
        
    return redirect(request.referrer)

# 💡 新規ルーティング: 作品投稿 (index.htmlのフォームに対応)
@app.route('/log/post', methods=['POST'])
def log_post():
    try:
        description = request.form.get('description')
        image_file = request.files.get('post_work')
        
        image_path = None
        if image_file and allowed_file(image_file.filename):
            filename = secure_filename(f"{datetime.now().strftime('%Y%m%d%H%M%S')}_post_{image_file.filename}")
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            image_file.save(filepath)
            image_path = os.path.join(UPLOAD_FOLDER, filename).replace('\\', '/')
        elif image_file and image_file.filename != '':
            flash("許可されていないファイル形式です。", 'error')
            return redirect(url_for('index'))
        
        # 💡 作品投稿のXPを計算 (評価は不要なため、最高評価'A'を仮設定)
        gained_xp = XPCalculator.calculate_acquisition_xp('自由投稿', 'A') 

        if gained_xp > 0:
            new_record = Record(
                type='作品投稿', 
                subtype='自由投稿作品', 
                description=description, 
                xp_gained=gained_xp,
                image_path=image_path,
                date=datetime.now()
            )
            db.session.add(new_record)
            
            user_status = UserStatus.query.first()
            user_status.total_xp += gained_xp
            db.session.commit()
            
            flash(f"作品の投稿に成功しました! +{gained_xp:,} XPを獲得。", 'success')
        else:
            flash("記録に失敗しました。XPが0以下となりました。", 'warning')
            
    except Exception as e:
        db.session.rollback()
        flash(f"エラーが発生しました: {e}", 'error')
        
    return redirect(url_for('index'))

@app.route('/archive')
def archive():
    all_records = Record.query.order_by(Record.date.desc()).all()
    
    archive_data = {}
    for record in all_records:
        year = record.get_year()
        if year not in archive_data:
            archive_data[year] = []
        archive_data[year].append(record)
        
    sorted_years = sorted(archive_data.keys(), reverse=True)
    
    context = {
        'archive_data': archive_data,
        'sorted_years': sorted_years,
        'status': get_current_status()
    }
    return render_template('archive.html', **context)


@app.route('/mypage')
def mypage():
    """マイページ：ユーザー情報、作品一覧、お題情報（Pixiv記念日お題API + AppAPIで最新化）を表示します。"""
    # データベースからの情報取得（高速）
    status = get_current_status()
    
    # 💡 科目習得と作品投稿の両方を表示対象とする
    user_works = db.session.execute(
        db.select(Record).filter(Record.type.in_(['科目習得', '作品投稿'])).order_by(Record.date.desc())
    ).scalars().all()
    
    # Pixiv情報取得 (キャッシュが効いていれば高速化)
    pixiv_topics = get_latest_pixiv_info() 

    context = {
        'status': status,
        'user_works': user_works,
        'pixiv_topics': pixiv_topics,
        'evaluations': Constants.EVALUATION_MAP, 
    }
    return render_template('mypage.html', **context)


# 💡 新規ルーティング: 書籍リソースページ
@app.route('/resources')
def resources():
    """本棚ページ: 登録された書籍を一覧表示します。"""
    books_result = db.session.execute(db.select(Book).order_by(Book.added_date.desc()))
    books = books_result.scalars().all()
    
    context = {
        'status': get_current_status(),
        'books': books
    }
    return render_template('resources.html', **context) 

# 💡 新規ルーティング: 管理コンソール
@app.route('/admin')
def admin():
    """管理コンソール: 書籍と外部リンク、YouTube再生リストのCRUD操作を提供します。"""
    
    books_result = db.session.execute(db.select(Book).order_by(Book.id.asc()))
    books = books_result.scalars().all()
    
    links_result = db.session.execute(db.select(ResourceLink).order_by(ResourceLink.id.asc()))
    links = links_result.scalars().all()
    
    youtube_playlists_result = db.session.execute(db.select(YouTubePlaylist).order_by(YouTubePlaylist.id.asc()))
    youtube_playlists = youtube_playlists_result.scalars().all()
    
    context = {
        'status': get_current_status(),
        'books': books,
        'links': links,
        'youtube_playlists': youtube_playlists,
    }
    return render_template('admin.html', **context)

# 💡 新規ルーティング: 書籍のCRUD (登録/更新)
@app.route('/admin/book/process', methods=['POST'])
def book_process():
    book_id = request.form.get('id')
    title = request.form.get('title')
    author = request.form.get('author')
    description = request.form.get('description')
    
    pdf_file = request.files.get('pdf_file')
    cover_image = request.files.get('cover_image')
    
    # 状態変数の初期化
    pdf_path_to_save = None             # DBに保存するURLパス
    cover_path_to_save = None           # DBに保存するURLパス
    pdf_full_path_for_generation = None # 表紙生成のために必要なサーバーのフルパス
    is_new_book = not book_id
    
    # 今回アップロードされたカバー画像のフルパスを保持するための変数 (エラー時の削除に利用)
    cover_full_path_for_error = None

    try:
        # 1. PDFファイルの処理
        if pdf_file and pdf_file.filename and allowed_file(pdf_file.filename):
            pdf_filename = secure_filename(f"{datetime.now().strftime('%Y%m%d%H%M%S')}_book_{pdf_file.filename}")
            
            # 💡 表紙自動生成に使用するため、サーバーのフルパスに保存
            pdf_full_path_for_generation = os.path.join(app.config['UPLOAD_FOLDER'], pdf_filename)
            pdf_file.save(pdf_full_path_for_generation)
            
            # DBに保存するURLパスを設定
            pdf_path_to_save = os.path.join(UPLOAD_FOLDER, pdf_filename).replace('\\', '/')
            
        elif is_new_book:
            flash('書籍の新規登録にはPDFまたはePubファイルが必要です。', 'error')
            return redirect(url_for('admin'))
            
        # 2. カバー画像の処理
        if cover_image and allowed_file(cover_image.filename):
            cover_filename = secure_filename(f"{datetime.now().strftime('%Y%m%d%H%M%S')}_cover_{cover_image.filename}")
            cover_filepath = os.path.join(app.config['UPLOAD_FOLDER'], cover_filename)
            cover_image.save(cover_filepath)
            cover_path_to_save = os.path.join(UPLOAD_FOLDER, cover_filename).replace('\\', '/')
            cover_full_path_for_error = cover_filepath # エラー時削除用にフルパスを保持

        
        # 3. データベースの処理 (新規 or 更新)
        if book_id:
            # --- 更新処理 ---
            book = db.session.get(Book, int(book_id))
            if not book:
                flash('書籍が見つかりません。', 'error')
                return redirect(url_for('admin'))
            
            # PDFが更新された場合、古いファイルを削除し、パスを更新
            if pdf_path_to_save:
                old_pdf_path = book.pdf_file_path # 既存のパスを保持
                book.pdf_file_path = pdf_path_to_save
                
                # 古いファイルを削除（新しいパスとは異なる場合のみ）
                if old_pdf_path and old_pdf_path != pdf_path_to_save:
                    delete_uploaded_file(old_pdf_path)
                
            # カバー画像が更新された場合、古いファイルを削除し、パスを更新
            if cover_path_to_save:
                old_cover_path = book.cover_image_path # 既存のパスを保持
                book.cover_image_path = cover_path_to_save
                
                # 古いファイルを削除（新しいパスとは異なる場合のみ）
                if old_cover_path and old_cover_path != cover_path_to_save:
                    # 💡 自動生成された表紙を削除する際もこの関数を使用できます
                    delete_uploaded_file(old_cover_path)
                
            # テキスト情報の更新
            book.title = title
            book.author = author
            book.description = description

        else:
            # --- 新規登録処理 ---
            if not pdf_path_to_save:
                flash('ファイルがアップロードされていません。', 'error')
                return redirect(url_for('admin'))

            book = Book(
                title=title, 
                author=author, 
                description=description, 
                pdf_file_path=pdf_path_to_save,
                cover_image_path=cover_path_to_save
            )
            db.session.add(book)
            db.session.flush() 

        
        # 4. 💡 表紙画像の自動生成ロジック (統合)
        # 手動でカバーがアップロードされておらず、かつ書籍がPDFである場合
        if not book.cover_image_path and book.pdf_file_path.lower().endswith('.pdf'):
            
            pdf_to_use_for_generation = None
            
            if pdf_full_path_for_generation:
                # a) 今回アップロード/更新されたPDFを使用
                pdf_to_use_for_generation = pdf_full_path_for_generation
            else:
                # b) 既存のPDFファイルを使用 (更新時、PDFファイル自体は変更しなかった場合)
                pdf_to_use_for_generation = os.path.join(app.root_path, book.pdf_file_path.replace('/', os.path.sep).replace('\\', os.path.sep))
            
            # 自動生成を試行
            if pdf_to_use_for_generation and os.path.exists(pdf_to_use_for_generation):
                new_cover_path = generate_cover_from_pdf(pdf_to_use_for_generation, book.id)
                if new_cover_path:
                    # 💡 自動生成された表紙パスでDBのbookオブジェクトを更新
                    book.cover_image_path = new_cover_path
                    
        # 5. 最終コミットとリダイレクト
        db.session.commit()
        
        flash(f"書籍「{title}」を{'新規登録' if is_new_book else '更新'}しました。", 'success')
        
    except Exception as e:
        db.session.rollback()
        
        # エラー発生時のファイル削除 (今回アップロード/生成されたがコミットされなかったファイルのみ)
        # PDFファイル
        if pdf_full_path_for_generation and os.path.exists(pdf_full_path_for_generation):
            try: os.remove(pdf_full_path_for_generation)
            except: pass
        
        # 手動アップロードされたカバー画像
        if cover_full_path_for_error and os.path.exists(cover_full_path_for_error):
             try: os.remove(cover_full_path_for_error)
             except: pass

        # 自動生成されたカバー画像（エラーが生成後に発生した場合）
        # 新規登録で、自動生成された後、flush/commit前にエラーが出た場合に備える
        if 'book' in locals() and book.cover_image_path and not book_id:
            delete_uploaded_file(book.cover_image_path)
            
        flash(f"書籍処理エラー: {e}", 'error')
        
    return redirect(url_for('admin', _anchor='tab-book-management'))

def delete_uploaded_file(file_path: str):
    """
    アップロードフォルダ内のファイルを安全に削除します。
    ファイルパスからファイル名のみを抽出し、ディレクトリトラバーサル攻撃を防ぎます。
    """
    if not file_path:
        return
        
    try:
        # DBに保存されているパスからファイル名のみを安全に抽出
        # Windows環境でのバックスラッシュも考慮し、スラッシュに統一してからファイル名を取得
        filename = os.path.basename(file_path.replace('\\', '/')) 
        
        # UPLOAD_FOLDER (app.config['UPLOAD_FOLDER']) とファイル名から安全なフルパスを構成
        upload_folder = app.config['UPLOAD_FOLDER']
        full_path = os.path.join(upload_folder, filename)
        
        # ファイルが存在することを確認してから削除
        if os.path.exists(full_path):
            os.remove(full_path)
            print(f"✅ ファイル削除成功: {full_path}")
        else:
            print(f"⚠️ ファイルが見つかりません/既に削除済み: {full_path}")
            
    except Exception as e:
        print(f"❌ ファイル削除中にエラーが発生しました: {e}")

# 💡 新規ルーティング: 書籍のCRUD (削除)
@app.route('/admin/book/delete/<int:id>', methods=['POST'])
def delete_book(id):
    try:
        book = db.session.get(Book, id)
        if book:
            # 💡 ファイル削除ロジック（実際にはos.removeが必要だが、ここではDBのみ削除）
            # -> 修正: ヘルパー関数を使用して関連ファイルを物理削除
            delete_uploaded_file(book.pdf_file_path)
            delete_uploaded_file(book.cover_image_path)
            
            db.session.delete(book)
            db.session.commit()
            flash(f"書籍「{book.title}」を削除しました。", 'success')
        else:
            flash("削除対象の書籍が見つかりません。", 'error')
    except Exception as e:
        db.session.rollback()
        flash(f"削除エラー: {e}", 'error')
    
    return redirect(url_for('admin', _anchor='tab-book-management'))

# 💡 新規ルーティング: 外部リンクのCRUD (登録/更新)
@app.route('/admin/link/process', methods=['POST'])
def link_process():
    link_id = request.form.get('id')
    name = request.form.get('name')
    url = request.form.get('url')
    description = request.form.get('description')
    
    try:
        if link_id:
            # 更新処理
            link = db.session.get(ResourceLink, int(link_id))
            if not link:
                flash('リンクが見つかりません。', 'error')
                return redirect(url_for('admin'))
            
            link.name = name
            link.url = url
            link.description = description
            
            db.session.commit()
            flash(f"外部リンク「{name}」を更新しました。", 'success')
            
        else:
            # 新規登録処理
            new_link = ResourceLink(
                name=name, 
                url=url, 
                description=description
            )
            db.session.add(new_link)
            db.session.commit()
            flash(f"外部リンク「{name}」を新規登録しました。", 'success')
            
    except Exception as e:
        db.session.rollback()
        flash(f"リンク処理エラー: {e}", 'error')
        
    return redirect(url_for('admin', _anchor='tab-link-management'))

# 💡 新規ルーティング: 外部リンクのCRUD (削除)
@app.route('/admin/link/delete/<int:id>', methods=['POST'])
def delete_link(id):
    try:
        link = db.session.get(ResourceLink, id)
        if link:
            db.session.delete(link)
            db.session.commit()
            flash(f"外部リンク「{link.name}」を削除しました。", 'success')
        else:
            flash("削除対象のリンクが見つかりません。", 'error')
    except Exception as e:
        db.session.rollback()
        flash(f"削除エラー: {e}", 'error')
    
    return redirect(url_for('admin', _anchor='tab-link-management'))

# 💡 新規ルーティング: ユーザー名更新
@app.route('/admin/user/update_username', methods=['POST'])
def update_username():
    new_username = request.form.get('new_username')
    try:
        user_status = UserStatus.query.first()
        if user_status:
            user_status.username = new_username
            db.session.commit()
            flash(f"ユーザー名を「{new_username}」に更新しました。", 'success')
        else:
            flash("ユーザーデータが見つかりません。", 'error')
    except Exception as e:
        db.session.rollback()
        flash(f"ユーザー名更新エラー: {e}", 'error')
    
    return redirect(url_for('admin', _anchor='tab-user-management'))

# 💡 新規ルーティング: 全データリセット
@app.route('/admin/user/reset_data', methods=['POST'])
def reset_data():
    try:
        # 1. 削除対象ファイルのパスを取得
        # 全てのBookレコードを取得し、ファイルパスをリスト化
        all_books = Book.query.all()
        
        # 2. ファイルシステム上のファイルを削除
        for book in all_books:
            # PDFファイルがあれば削除
            if book.pdf_file_path:
                delete_uploaded_file(book.pdf_file_path)
            # カバー画像ファイルがあれば削除
            if book.cover_image_path:
                delete_uploaded_file(book.cover_image_path)
        
        # 3. UserStatusのリセット
        user_status = UserStatus.query.first()
        if user_status:
            user_status.total_xp = 0
            user_status.username = "新規ユーザー"
            
        # 4. Record, Book, ResourceLinkの全削除 (DBレコードの削除)
        # ファイル削除後にDBレコードを削除することが重要です。
        db.session.query(Record).delete()
        db.session.query(Book).delete()
        db.session.query(ResourceLink).delete()
        
        db.session.commit()
        flash("✅ すべての学習データ、リソース情報、関連ファイルをリセットしました。", 'success')
    except Exception as e:
        db.session.rollback()
        flash(f"データリセットエラー: {e}", 'error')

    # admin.html のタブをユーザー管理に戻る
    return redirect(url_for('admin', _anchor='tab-user-management'))


@app.route('/api/time_analysis/<period>')
def api_time_analysis(period):
    """
    指定された期間 ('month' または 'year') ごとに学習時間を集計し、JSONで返します。
    """
    
    time_records = Record.query.filter_by(type='時間学習').order_by(Record.date.asc()).all()
    aggregated_data = {}

    if period == 'month':
        for record in time_records:
            key = record.date.strftime('%Y-%m')
            aggregated_data[key] = aggregated_data.get(key, 0) + record.duration_minutes
        
        labels = sorted(aggregated_data.keys())
        data = [round(aggregated_data[key] / 60, 2) for key in labels] 
        
        return jsonify({
            "labels": labels,
            "data": data,
            "title": "月別総学習時間 (時間)",
        })
        
    elif period == 'year':
        for record in time_records:
            key = record.date.strftime('%Y')
            aggregated_data[key] = aggregated_data.get(key, 0) + record.duration_minutes

        labels = sorted(aggregated_data.keys())
        data = [round(aggregated_data[key] / 60, 2) for key in labels] 

        return jsonify({
            "labels": labels,
            "data": data,
            "title": "年別総学習時間 (時間)",
        })
    
    else:
        return jsonify({"error": "Invalid period"}), 400


@app.route('/uploads/<filename>')
def uploaded_file(filename):
    """アップロードされた作品画像や書籍ファイルを公開します。"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# --- YouTube Playlist Management ---


def extract_playlist_id(url_or_id):
    """
    Extract YouTube playlist ID from URL or ID string.

    Args:
        url_or_id: YouTube URL or playlist ID (e.g., PLxxxxxx)

    Returns:
        Extracted playlist ID or None if invalid
    """
    if not url_or_id:
        return None

    # Extract from URL
    if "youtube.com" in url_or_id or "youtu.be" in url_or_id:
        match = re.search(r"[?&]list=([a-zA-Z0-9_-]+)", url_or_id)
        if match:
            return match.group(1)

    # Validate ID format
    if re.match(r"^[a-zA-Z0-9_-]+$", url_or_id):
        return url_or_id

    return None


def fetch_youtube_playlist_info(playlist_id):
    """
    Fetch YouTube playlist information using OEmbed API.
    
    Returns playlist metadata including title and thumbnail embed code.
    This works for all playlists including limited distribution.
    
    Args:
        playlist_id: YouTube playlist ID (e.g., PLxxxxxx)
    
    Returns:
        Dict with 'title', 'author', 'thumbnail_url' (embed iframe HTML) or None
    """
    if not playlist_id:
        return None
    
    try:
        # Use YouTube OEmbed API - works for all playlists
        oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/playlist?list={playlist_id}&format=json"
        response = requests.get(oembed_url, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            
            # Extract title and author
            title = data.get('title', f'Playlist ({playlist_id[:8]}...)')
            author = data.get('author_name', 'YouTube')
            
            # For playlist embeds, we'll use the HTML embed code as thumbnail
            # This displays the playlist embed preview
            html_code = data.get('html', '')
            
            print(f"[SUCCESS] Playlist info fetched: title={title}, author={author}")
            
            return {
                'title': title,
                'author': author,
                'thumbnail_html': html_code,  # Embed iframe HTML
                'playlist_id': playlist_id,
            }
        else:
            print(f"[WARN] OEmbed failed with status {response.status_code}")
            return None
    except Exception as e:
        print(f"[ERROR] Failed to fetch playlist info: {e}")
        return None


def get_youtube_playlist_video_ids(playlist_id):
    """
    Extract all video IDs from a YouTube playlist using yt-dlp.
    
    Args:
        playlist_id: YouTube playlist ID
    
    Returns:
        List of video IDs or empty list if unable to determine
    """
    if not playlist_id:
        return []
    
    try:
        import yt_dlp
        
        # yt-dlp を使用してプレイリスト情報を抽出
        playlist_url = f"https://www.youtube.com/playlist?list={playlist_id}"
        
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': 'in_playlist',  # プレイリスト内の動画をリスト形式で取得
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            print(f"[DEBUG] Extracting playlist: {playlist_url}")
            info = ydl.extract_info(playlist_url, download=False)
            
            video_ids = []
            if 'entries' in info:
                for entry in info['entries']:
                    if entry and 'id' in entry:
                        video_ids.append(entry['id'])
                        print(f"[DEBUG] Found video: {entry['id']}")
            
            print(f"[SUCCESS] Extracted {len(video_ids)} video IDs from playlist")
            return video_ids
    
    except ImportError:
        print(f"[ERROR] yt-dlp not installed. Install with: pip install yt-dlp")
        return []
    
    except Exception as e:
        print(f"[ERROR] Failed to get video IDs: {e}")
        return []


def get_youtube_playlist_videos_info_ytdlp(playlist_id):
    """
    yt-dlpを使用してプレイリスト内の動画情報（ID、タイトルなど）を取得します。
    YouTube Data APIを使用しないため、公開動画のみアクセス可能です。
    
    Args:
        playlist_id: YouTube playlist ID
    
    Returns:
        dict: {video_id: {'title': 'xxx', 'duration': 123, ...}}
    """
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
            print(f"[DEBUG] Extracting playlist info with yt-dlp: {playlist_url}")
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
                            'privacy_status': 'public',  # yt-dlpでは判定不可
                            'embeddable': True,  # yt-dlpでは判定不可
                        }
                        print(f"[DEBUG] Found video: {video_id} - {video_info_map[video_id]['title']}")
            
            print(f"[SUCCESS] Extracted {len(video_info_map)} video info via yt-dlp")
            return video_info_map
    
    except ImportError:
        print(f"[ERROR] yt-dlp not installed")
        return {}
    
    except Exception as e:
        print(f"[ERROR] Failed to extract playlist info via yt-dlp: {e}")
        import traceback
        traceback.print_exc()
        return {}


def get_youtube_playlist_video_count(playlist_id):
    """
    Get the actual number of videos in a YouTube playlist.
    
    Fetches the playlist page and extracts the video count from the
    ytInitialData JSON embedded in the page.
    
    Args:
        playlist_id: YouTube playlist ID
    
    Returns:
        Video count (int) or None if unable to determine
    """
    if not playlist_id:
        return None
    
    try:
        import json
        
        # Fetch the playlist page
        url = f"https://www.youtube.com/playlist?list={playlist_id}"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code != 200:
            print(f"[WARN] Failed to fetch playlist page: {response.status_code}")
            return None
        
        html = response.text
        
        # Extract ytInitialData JSON
        init_data_pattern = r'var ytInitialData = ({.*?});'
        match = re.search(init_data_pattern, html, re.DOTALL)
        
        if match:
            try:
                data = json.loads(match.group(1))
                
                # Navigate to sidebar stats
                sidebar = data.get('sidebar', {}).get('playlistSidebarRenderer', {}).get('items', [])
                
                for item in sidebar:
                    if 'playlistSidebarPrimaryInfoRenderer' in item:
                        stats = item['playlistSidebarPrimaryInfoRenderer'].get('stats', [])
                        
                        # First stat typically contains the video count
                        if stats and len(stats) > 0:
                            runs = stats[0].get('runs', [])
                            for run in runs:
                                text = run.get('text', '')
                                # Try to extract a number
                                num_match = re.search(r'(\d+)', text)
                                if num_match:
                                    count = int(num_match.group(1))
                                    print(f"[SUCCESS] Video count: {count}")
                                    return count
                
                print(f"[WARN] Could not extract video count from JSON structure")
                return None
            
            except json.JSONDecodeError as e:
                print(f"[ERROR] JSON decode failed: {e}")
                return None
        else:
            print(f"[WARN] ytInitialData not found in HTML")
            return None
    
    except Exception as e:
        print(f"[ERROR] Failed to get video count: {e}")
        return None
    
    except requests.exceptions.Timeout:
        print(f"[WARN] Timeout fetching playlist {playlist_id}")
    except Exception as e:
        print(f"[ERROR] Error fetching playlist info ({playlist_id}): {e}")
    
    return None
    """
    Fetch YouTube video thumbnail from video ID.

    Strategy:
    1. Use standard YouTube thumbnail CDN URLs
    2. Try multiple quality levels
    3. Return URL or None if unable to fetch

    Args:
        video_id: YouTube video ID (format: dQw4w9WgXcQ)

    Returns:
        Thumbnail URL string or None if invalid video_id
    """
    if not video_id:
        return None

    try:
        # YouTube thumbnail CDN URLs (highest quality first)
        thumbnail_urls = [
            f"https://i.ytimg.com/vi/{video_id}/maxresdefault.jpg",
            f"https://i.ytimg.com/vi/{video_id}/sddefault.jpg",
            f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
            f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg",
            f"https://i.ytimg.com/vi/{video_id}/default.jpg",
        ]

        for thumbnail_url in thumbnail_urls:
            try:
                response = requests.head(thumbnail_url, timeout=3, allow_redirects=True)
                if response.status_code == 200:
                    print(f"[SUCCESS] Thumbnail found: {thumbnail_url}")
                    return thumbnail_url
            except requests.exceptions.RequestException:
                continue

        print(f"[WARN] Thumbnail not found for video: {video_id}")

    except Exception as e:
        print(f"[ERROR] Thumbnail fetch error ({video_id}): {e}")

    return None


@app.route("/youtube_playlist_process", methods=["POST"])
def youtube_playlist_process():
    """Register or update YouTube playlist using OEmbed API."""
    try:
        playlist_id_or_url = request.form.get('playlist_id_or_url', '').strip()
        title = request.form.get('title', '').strip()
        description = request.form.get('description', '').strip()
        
        if not playlist_id_or_url:
            flash("❌ プレイリストURL/IDを入力してください。", 'error')
            return redirect(url_for('admin', _anchor='tab-youtube-management'))
        
        # プレイリストIDを抽出
        playlist_id = extract_playlist_id(playlist_id_or_url)
        if not playlist_id:
            flash("❌ 有効なYouTubeプレイリストURL/IDではありません。", "error")
            return redirect(url_for("admin", _anchor="tab-youtube-management"))
        
        # OEmbed API でプレイリスト情報を取得
        print(f"[INFO] Fetching playlist info for: {playlist_id}")
        playlist_info = fetch_youtube_playlist_info(playlist_id)
        
        if not playlist_info:
            flash("❌ プレイリスト情報を取得できませんでした。プレイリストIDが正しいか確認してください。", "error")
            return redirect(url_for("admin", _anchor="tab-youtube-management"))
        
        # プレイリスト情報の取得
        oembed_title = playlist_info.get('title', f'Playlist ({playlist_id[:8]}...)')
        thumbnail_html = playlist_info.get('thumbnail_html', '')
        
        # ユーザーが入力したタイトルが優先、なければOEmbedから取得
        final_title = title if title else oembed_title
        
        # 既存プレイリストの確認
        existing = YouTubePlaylist.query.filter_by(playlist_id=playlist_id).first()
        
        if existing:
            # 更新
            existing.title = final_title
            existing.description = description or existing.description
            if thumbnail_html:
                existing.thumbnail_url = thumbnail_html
            db.session.commit()
            print(f"[INFO] Playlist updated: {playlist_id}")
            flash("✅ プレイリストを更新しました。", "success")
        else:
            # 新規登録
            print(f"[INFO] Creating new playlist: {playlist_id}")
            new_playlist = YouTubePlaylist(
                playlist_id=playlist_id,
                title=final_title,
                description=description,
                thumbnail_url=thumbnail_html,
            )
            db.session.add(new_playlist)
            db.session.commit()
            print(f"[INFO] Playlist created: id={new_playlist.id}")
            flash("✅ プレイリストを登録しました。", "success")
        
        return redirect(url_for("admin", _anchor="tab-youtube-management"))
    
    except Exception as e:
        db.session.rollback()
        flash(f"❌ エラー: {e}", "error")
        print(f"[ERROR] {e}")
        return redirect(url_for("admin", _anchor="tab-youtube-management"))


@app.route("/youtube_player/<int:playlist_id>")
def youtube_player(playlist_id):
    """YouTube プレイリスト再生ページ"""
    playlist = YouTubePlaylist.query.get(playlist_id)
    if not playlist:
        flash("❌ プレイリストが見つかりません。", "error")
        return redirect(url_for("index"))
    
    # 視聴履歴を取得または作成
    view_history = PlaylistViewHistory.query.filter_by(playlist_id=playlist_id).first()
    if not view_history:
        view_history = PlaylistViewHistory(playlist_id=playlist_id)
        db.session.add(view_history)
        db.session.commit()
    
    # プレイリストから動画IDを抽出
    video_ids = get_youtube_playlist_video_ids(playlist.playlist_id)
    actual_video_count = len(video_ids)
    print(f"[INFO] Playlist {playlist.playlist_id}: extracted {actual_video_count} video IDs")
    
    # 動画情報を取得（yt-dlpを使用してタイトルなどを取得）
    video_info_map = {}
    if video_ids:
        print(f"[INFO] Fetching video info for playlist via yt-dlp")
        video_info_map = get_youtube_playlist_videos_info_ytdlp(playlist.playlist_id)
        print(f"[INFO] Retrieved info for {len(video_info_map)} videos via yt-dlp")
    
    # 視聴情報を取得
    video_views = VideoView.query.filter_by(playlist_id=playlist_id).order_by(VideoView.video_index).all()
    completed_count = sum(1 for v in video_views if v.is_completed)
    
    return render_template(
        "youtube_player.html",
        playlist=playlist,
        video_views=video_views,
        video_ids=video_ids,  # 動画IDリストをテンプレートに渡す
        video_info_map=video_info_map,  # 動画情報マップをテンプレートに渡す
        completed_count=completed_count,
        total_count=len(video_views),
        actual_video_count=actual_video_count or 10,  # Fallback to 10 if unable to fetch
        current_index=view_history.video_index or 0
    )



@app.route("/api/playlist_videos/<int:playlist_id>", methods=["GET"])
def api_playlist_videos(playlist_id):
    """プレイリストの動画IDリストをJSON形式で返す"""
    playlist = YouTubePlaylist.query.get(playlist_id)
    if not playlist:
        return jsonify({"status": "error", "message": "Playlist not found"}), 404
    
    # プレイリストからビデオIDを取得
    video_ids = get_youtube_playlist_video_ids(playlist.playlist_id)
    
    return jsonify({
        "status": "success",
        "playlist_id": playlist_id,
        "youtube_playlist_id": playlist.playlist_id,
        "video_count": len(video_ids),
        "video_ids": video_ids
    })


@app.route("/api/video_view_event", methods=["POST"])
def video_view_event():
    """動画再生イベント API（進捗トラッキング用）"""
    data = request.json
    playlist_id = data.get("playlist_id")
    video_index = data.get("video_index")
    event_type = data.get("event_type")  # 'start', 'watch', 'complete'
    current_time = data.get("current_time", 0)
    
    try:
        # VideoView レコードを取得または作成
        video_view = VideoView.query.filter_by(
            playlist_id=playlist_id, 
            video_index=video_index
        ).first()
        
        if not video_view:
            video_view = VideoView(
                playlist_id=playlist_id,
                video_index=video_index,
                first_viewed=datetime.utcnow()
            )
            db.session.add(video_view)
        
        if event_type == "start":
            video_view.watch_count = (video_view.watch_count or 0) + 1
            if not video_view.first_viewed:
                video_view.first_viewed = datetime.utcnow()
        
        elif event_type == "watch":
            # current_time は現在の再生位置（秒）
            # 最後に記録した再生位置より進んでいる場合のみ更新
            current_watched = video_view.watched_duration_seconds or 0
            if int(current_time) > current_watched:
                # 新しい最大再生位置を記録
                video_view.watched_duration_seconds = int(current_time)
        
        elif event_type == "complete":
            video_view.is_completed = True
            
            # 動画の長さからXPを計算
            # current_time に再生時間（秒）が渡されている想定
            video_duration_seconds = current_time
            
            # 基本計算: 1時間 (3600秒) = 100 XP
            # 最小10XP、最大500XPの上限
            calculated_xp = max(10, min(500, int(video_duration_seconds / 36)))  # 3600秒/100 = 36
            
            video_view.xp_gained = calculated_xp
            print(f"[XP CALC] Video {video_index} duration: {video_duration_seconds}s -> XP: {calculated_xp}")
            
            # PlaylistViewHistory を更新
            view_history = PlaylistViewHistory.query.filter_by(playlist_id=playlist_id).first()
            if view_history:
                view_history.video_index = video_index
                view_history.last_viewed = datetime.utcnow()
        
        video_view.last_viewed = datetime.utcnow()
        db.session.commit()
        
        # レスポンスに XP 情報を含める
        response_data = {
            "status": "success", 
            "video_view_id": video_view.id,
            "xp_gained": video_view.xp_gained
        }
        
        return jsonify(response_data)
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/reset_youtube_playlist_progress/<int:id>", methods=["POST"])
def reset_youtube_playlist_progress(id):
    """Reset progress for all videos in a YouTube playlist."""
    try:
        playlist = YouTubePlaylist.query.get(id)
        if not playlist:
            flash("❌ プレイリストが見つかりません。", "error")
            return redirect(url_for("admin", _anchor="tab-youtube-management"))
        
        # Delete all VideoView records for this playlist
        deleted_count = VideoView.query.filter_by(playlist_id=id).delete()
        db.session.commit()
        
        flash(f"✅ {deleted_count}件の進捗をリセットしました。", "success")
        print(f"[INFO] Reset {deleted_count} video views for playlist: {playlist.playlist_id}")
    except Exception as e:
        db.session.rollback()
        flash(f"❌ リセットエラー: {e}", "error")
        print(f"[ERROR] Reset progress error: {e}")

    return redirect(url_for("admin", _anchor="tab-youtube-management"))


@app.route("/delete_youtube_playlist/<int:id>", methods=["POST"])
def delete_youtube_playlist(id):
    """Delete YouTube playlist."""
    try:
        playlist = YouTubePlaylist.query.get(id)
        if playlist:
            db.session.delete(playlist)
            db.session.commit()
            flash("✅ プレイリストを削除しました。", "success")
        else:
            flash("❌ プレイリストが見つかりません。", "error")
    except Exception as e:
        db.session.rollback()
        flash(f"❌ 削除エラー: {e}", "error")

    return redirect(url_for("admin", _anchor="tab-youtube-management"))


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000) # (例: ポート5000番を使用)