# app.py - 今日のお題 (記念日API) + 注目のタグ (AppAPI) + 人気作品からの画像検索 (R-18除外強化) + 【🌟キャッシュ機能追加🌟】
import os
from flask import Flask, render_template, request, redirect, url_for, flash, send_from_directory, jsonify
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
from sqlalchemy import func, select 
import requests 
import pytz 
import fitz
from flask import current_app

# ユーザー提供のファイルからインポート
# 💡 models.pyからBookとResourceLinkをインポート
from models import db, UserStatus, Record, Book, ResourceLink
from xp_core import XPCalculator, Constants

# --- 設定 ---
UPLOAD_FOLDER = 'static/uploads'
# 💡 PDF/ePubを許可に追加
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf', 'epub'} 
DATABASE_FILE = 'xp_system.db'
ASSETS_FOLDER = 'static/assets' 

# Pixiv認証情報ファイル名 (AppAPI用)
AUTH_FILE = 'auth.key' 

# Pixiv APIエンドポイントと認証情報
PIXIV_CLIENT_ID = "MOBrBDS8blbauoSck0ZfDbtuzpyT"
PIXIV_CLIENT_SECRET = "lsACyCD94FhDUtGTXi3QzcFE2uU1hqtDaKeqrdwj"
PIXIV_AUTH_URL = "https://oauth.secure.pixiv.net/auth/token" 
PIXIV_WEB_HOST = "https://www.pixiv.net"

# 【Pixiv 記念日お題 API エンドポイント】
PIXIV_ANNIVERSARY_API_URL = f"{PIXIV_WEB_HOST}/ajax/idea/anniversary"
# 【AppAPI トレンドタグエンドポイント】(注目のタグ用)
PIXIV_TREND_APP_API_URL = "https://app-api.pixiv.net/v1/trending-tags/illust"


# User-Agentの定義
OAUTH_PIXIV_USER_AGENT = 'PixivAndroidApp/5.0.147 (Android/10)' 
WEB_PIXIV_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' 

jp = pytz.timezone("Asia/Tokyo")


app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secret_key_here' 
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{DATABASE_FILE}'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
# 💡 ファイルサイズ制限を256MBに引き上げ
app.config['MAX_CONTENT_LENGTH'] = 256 * 1024 * 1024 

db.init_app(app)

# --- 🌟 Pixiv情報キャッシュ変数の定義 🌟 ---
_pixiv_cache = None
# キャッシュの有効期限 (初期値は過去)
_cache_expiry = datetime.min 
# キャッシュの有効時間（例：30分）
CACHE_DURATION = timedelta(minutes=30) 
# ---------------------------------------------

# フォルダ確認とプレースホルダー作成 (省略)
for folder in [UPLOAD_FOLDER, ASSETS_FOLDER]:
    if not os.path.exists(folder):
        try:
            # os.makedirsは、途中のディレクトリ（staticなど）も作成します
            os.makedirs(folder)
            print(f"✅ 必要なフォルダ '{folder}' を作成しました。")
        except OSError as e:
            print(f"⚠️ フォルダ '{folder}' の作成に失敗しました: {e}")
            # エラー発生時はアプリケーションの実行環境を確認してください


def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- 初期設定 ---
with app.app_context():
    db.create_all()
    if not UserStatus.query.first():
        db.session.add(UserStatus(username="イラスト・クリエイター"))
        db.session.commit()

# --- Pixiv認証とWebセッション取得のためのグローバル変数/関数 ---
_access_token = None
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
        'limit': 1,
        'restrict': '0',       # R-18作品を除外 (Webのフィルター)
        'filter': 'for_android' # 全年齢対象を強制 (Appのフィルター)
    } 

    try:
        json_response = requests.get(PIXIV_ILLUST_SEARCH_URL, headers=headers, params=params, timeout=10)
        json_response.raise_for_status()
        data = json_response.json()
        
        illusts = data.get('illusts', [])
        if illusts:
            # 最初のイラスト（人気作品）の画像URL (mediumサイズ) を取得
            image_url = illusts[0].get('image_urls', {}).get('medium')
            if image_url:
                image_path = download_and_save_image(image_url, filename, "assets/topic_placeholder.jpg")
                print(f"✅ お題タグ '{tag_name}' の人気作品の画像をダウンロードしました。（R-18除外強化）")
                return image_path
                
        return "assets/topic_placeholder.jpg" # 画像が見つからなかった場合

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
def generate_cover_from_pdf(pdf_filepath, book_id):
    """
    PDFファイルの1ページ目をPNG画像として抽出し、保存パスを返します。
    PyMuPDF (fitz) を使用して実装されています。
    """
    # 💡 関数内で必要なライブラリをインポート
    # fitzがグローバルにインポートされていない場合でも動作するための対応
    try:
        # 1. 出力ファイルパスの準備
        cover_filename = f"cover_{book_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.png"
        
        # current_app.config を使用して安全に UPLOAD_FOLDER のパスを構築
        upload_folder = current_app.config['UPLOAD_FOLDER']
        cover_filepath = os.path.join(upload_folder, cover_filename)
        
        # 2. PyMuPDFでPDFを開き、最初のページを読み込む
        doc = fitz.open(pdf_filepath)
        page = doc.load_page(0)  # 最初のページ (インデックス 0)
        
        # 3. ページをPixmapにレンダリング（高解像度 300 DPIで設定）
        zoom = 300 / 72.0 
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        
        # 4. PixmapをPNGファイルとして保存
        # Pixmap.save() はファイルパスのみを引数に取ります。
        # これが「unexpected keyword argument 'format'」エラーを修正する正しい方法です。
        pix.save(cover_filepath) 
        
        doc.close()
            
        print(f"✅ PyMuPDFで表紙を自動生成しました: {cover_filename}")
        
        # DBに保存するパスを返す
        return os.path.join(upload_folder, cover_filename).replace('\\', '/')
        
    except FileNotFoundError:
        print(f"❌ PDF表紙自動生成エラー（ID: {book_id}）: ファイルが見つかりません。パス: {pdf_filepath}")
        return None
    except Exception as e:
        # 他のエラー（PDF破損、ライブラリ使用方法の間違いなど）
        print(f"❌ PDF表紙自動生成エラー（ID: {book_id}）: {e}")
        return None

# --- ルーティング ---

@app.route('/', methods=['GET', 'POST'])
def index():
    status = get_current_status()
    # 💡 index.htmlに外部リンクのリストを渡す
    recent_links = get_recent_links(limit=5)
    
    context = {
        'status': status,
        'xp_rates': Constants.XP_RATES_PER_MINUTE,
        'acq_types': Constants.ACQUISITION_BASE_XP,
        'evaluations': Constants.EVALUATION_MAP,
        'total_time_hours': status['total_time_hours'],
        'total_time_minutes': status['total_time_minutes'] % 60,
        'recent_links': recent_links, # 💡 追加
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
    """管理コンソール: 書籍と外部リンクのCRUD操作を提供します。"""
    
    books_result = db.session.execute(db.select(Book).order_by(Book.id.asc()))
    books = books_result.scalars().all()
    
    links_result = db.session.execute(db.select(ResourceLink).order_by(ResourceLink.id.asc()))
    links = links_result.scalars().all()
    
    context = {
        'status': get_current_status(),
        'books': books,
        'links': links,
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


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000) # (例: ポート5000番を使用)