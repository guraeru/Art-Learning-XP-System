"""
REST API Endpoints for React SPA Frontend
This file contains additional API endpoints for the React frontend
"""

from flask import Blueprint, jsonify, request, current_app
from datetime import datetime
from models import db, UserStatus, Record, Book, ResourceLink, YouTubePlaylist, VideoView, PlaylistViewHistory, PlaylistMaterial
from xp_core import XPCalculator, Constants
from werkzeug.utils import secure_filename
import os
import fitz  # PyMuPDF for PDF rendering

api_bp = Blueprint('api', __name__, url_prefix='/api')

# UPLOAD_FOLDER should be defined in app.py
UPLOAD_FOLDER = "static/uploads"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "pdf", "epub"}
ALLOWED_MATERIAL_EXTENSIONS = {"pdf", "pptx", "ppt", "doc", "docx", "zip", "txt", "md"}


def allowed_file(filename):
    """Check if file extension is allowed."""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def allowed_material_file(filename):
    """Check if material file extension is allowed."""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_MATERIAL_EXTENSIONS


def extract_pdf_first_page(pdf_filepath):
    """Extract the first page of PDF as an image.
    
    Args:
        pdf_filepath: Full path to the PDF file
    
    Returns:
        Tuple of (image_filename, image_path) or (None, None) if extraction fails
    """
    try:
        # Open PDF
        pdf_doc = fitz.open(pdf_filepath)
        if pdf_doc.page_count < 1:
            return None, None
        
        # Get first page and render as image (300 dpi)
        first_page = pdf_doc[0]
        pix = first_page.get_pixmap(matrix=fitz.Matrix(1, 1))
        
        # Generate filename
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        image_filename = secure_filename(f"{timestamp}_pdf_cover.png")
        
        # Save image
        image_filepath = os.path.join(UPLOAD_FOLDER, image_filename)
        pix.save(image_filepath)
        
        pdf_doc.close()
        return image_filename, image_filepath
    except Exception as e:
        print(f"Error extracting PDF first page: {str(e)}")
        return None, None


def normalize_file_path(file_path):
    """Normalize file path by extracting filename only.
    
    Handles both old format (static/uploads/filename) and new format (filename).
    Returns just the filename for use with /uploads/ endpoint.
    """
    if not file_path:
        return None
    
    # Remove 'static/uploads/' or 'uploads/' prefix if present
    if 'uploads/' in file_path:
        return file_path.split('uploads/')[-1]
    
    return file_path


# --- Status API ---
@api_bp.route('/status', methods=['GET'])
def get_status():
    """Get current user status and XP info"""
    user_status = UserStatus.query.first()
    if not user_status:
        rank_info = XPCalculator.get_rank_info(0)
        rank_info['username'] = "新規ユーザー"
        rank_info['total_time_hours'] = 0
        rank_info['total_time_minutes'] = 0
        return jsonify(rank_info)
    
    rank_info = XPCalculator.get_rank_info(user_status.total_xp)
    rank_info['username'] = user_status.username
    
    total_time_minutes = db.session.scalar(
        db.select(db.func.sum(Record.duration_minutes))
        .where(Record.type == '時間学習')
    ) or 0
    rank_info['total_time_minutes'] = total_time_minutes
    rank_info['total_time_hours'] = total_time_minutes // 60
    
    return jsonify(rank_info)


@api_bp.route('/constants', methods=['GET'])
def get_constants():
    """Get XP calculation constants"""
    return jsonify({
        'xp_rates': Constants.XP_RATES_PER_MINUTE,
        'acq_types': Constants.ACQUISITION_BASE_XP,
        'evaluations': Constants.EVALUATION_MAP
    })


# --- Records API ---
@api_bp.route('/records', methods=['GET'])
def get_records():
    """Get all records with optional filtering"""
    record_type = request.args.get('type')
    year = request.args.get('year')
    limit = request.args.get('limit', type=int)
    
    query = Record.query.order_by(Record.date.desc())
    
    if record_type:
        query = query.filter(Record.type == record_type)
    
    if year:
        query = query.filter(db.extract('year', Record.date) == int(year))
    
    if limit:
        query = query.limit(limit)
    
    records = query.all()
    
    return jsonify([{
        'id': r.id,
        'type': r.type,
        'subtype': r.subtype,
        'description': r.description,
        'xp_gained': r.xp_gained,
        'date': r.date.isoformat() if r.date else None,
        'duration_minutes': r.duration_minutes,
        'evaluation': r.evaluation,
        'image_path': r.image_path,
        'year': r.get_year()
    } for r in records])


@api_bp.route('/records/<int:id>', methods=['GET'])
def get_record(id):
    """Get a single record"""
    record = db.session.get(Record, id)
    if not record:
        return jsonify({'error': 'Record not found'}), 404
    
    return jsonify({
        'id': record.id,
        'type': record.type,
        'subtype': record.subtype,
        'description': record.description,
        'xp_gained': record.xp_gained,
        'date': record.date.isoformat() if record.date else None,
        'duration_minutes': record.duration_minutes,
        'evaluation': record.evaluation,
        'image_path': record.image_path,
        'year': record.get_year()
    })


@api_bp.route('/records/time', methods=['POST'])
def log_time():
    """Log time learning record"""
    try:
        data = request.json or {}
        activity_type = data.get('activity_type')
        duration_minutes = int(data.get('duration', 0))
        description = data.get('description', '')
        
        if duration_minutes <= 0:
            return jsonify({'error': '時間は正の整数である必要があります。'}), 400
        
        gained_xp = XPCalculator.calculate_time_xp(activity_type, duration_minutes)
        
        if gained_xp <= 0:
            return jsonify({'error': '無効な活動タイプです。'}), 400
        
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
        
        return jsonify({
            'success': True,
            'message': f'{activity_type} の記録に成功しました! +{gained_xp:,} XPを獲得しました。',
            'xp_gained': gained_xp,
            'record_id': new_record.id
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@api_bp.route('/records/acquisition', methods=['POST'])
def log_acquisition():
    """Log acquisition (artwork) record"""
    try:
        technique_type = request.form.get('technique_type')
        evaluation = request.form.get('evaluation', '').upper()
        description = request.form.get('description', '')
        image_file = request.files.get('image_proof')
        
        image_path = None
        if image_file and allowed_file(image_file.filename):
            filename = secure_filename(f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{image_file.filename}")
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            image_file.save(filepath)
            image_path = os.path.join(UPLOAD_FOLDER, filename).replace('\\', '/')
        elif image_file and image_file.filename:
            return jsonify({'error': '許可されていないファイル形式です。'}), 400
        
        gained_xp = XPCalculator.calculate_acquisition_xp(technique_type, evaluation)
        
        if gained_xp <= 0:
            return jsonify({'error': 'XPが0以下となりました。技法または評価を確認してください。'}), 400
        
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
        
        return jsonify({
            'success': True,
            'message': f'作品「{technique_type}」 (評価: {evaluation}) の記録に成功しました! +{gained_xp:,} XPを獲得。',
            'xp_gained': gained_xp,
            'record_id': new_record.id
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@api_bp.route('/records/post', methods=['POST'])
def log_post():
    """Log work post record"""
    try:
        description = request.form.get('description', '')
        image_file = request.files.get('post_work')
        
        image_path = None
        if image_file and allowed_file(image_file.filename):
            filename = secure_filename(f"{datetime.now().strftime('%Y%m%d%H%M%S')}_post_{image_file.filename}")
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            image_file.save(filepath)
            image_path = os.path.join(UPLOAD_FOLDER, filename).replace('\\', '/')
        elif image_file and image_file.filename:
            return jsonify({'error': '許可されていないファイル形式です。'}), 400
        
        gained_xp = XPCalculator.calculate_acquisition_xp('自由投稿', 'A')
        
        if gained_xp <= 0:
            return jsonify({'error': 'XPが0以下となりました。'}), 400
        
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
        
        return jsonify({
            'success': True,
            'message': f'作品の投稿に成功しました! +{gained_xp:,} XPを獲得。',
            'xp_gained': gained_xp,
            'record_id': new_record.id
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@api_bp.route('/records/<int:id>', methods=['DELETE'])
def delete_record(id):
    """Delete a record"""
    try:
        record = db.session.get(Record, id)
        if not record:
            return jsonify({'error': 'Record not found'}), 404
        
        # Subtract XP from user
        user_status = UserStatus.query.first()
        if user_status:
            user_status.total_xp = max(0, user_status.total_xp - record.xp_gained)
        
        db.session.delete(record)
        db.session.commit()
        
        return jsonify({'success': True, 'message': '記録を削除しました。'})
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# --- Books API ---
@api_bp.route('/books', methods=['GET'])
def get_books():
    """Get all books with pagination and search support.
    
    Query Parameters:
    - page: Page number (default: 1)
    - limit: Results per page (default: 100, max: 100)
    - search: Search query for title/author (optional)
    """
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 100, type=int)
    search = request.args.get('search', '', type=str).strip()
    
    # Limit max results per page
    if limit > 100:
        limit = 100
    if limit < 1:
        limit = 100
    if page < 1:
        page = 1
    
    # Build query
    query = Book.query.order_by(Book.added_date.desc())
    
    # Apply search filter if provided
    if search:
        query = query.filter(
            (Book.title.ilike(f'%{search}%')) | 
            (Book.author.ilike(f'%{search}%'))
        )
    
    # Get total count for pagination info
    total = query.count()
    
    # Apply pagination
    offset = (page - 1) * limit
    books = query.offset(offset).limit(limit).all()
    
    # Calculate pagination info
    total_pages = (total + limit - 1) // limit  # Ceiling division
    
    return jsonify({
        'data': [{
            'id': b.id,
            'title': b.title,
            'author': b.author,
            'description': b.description,
            'pdf_file_path': normalize_file_path(b.pdf_file_path),
            'cover_image_path': normalize_file_path(b.cover_image_path),
            'added_date': b.added_date.isoformat() if b.added_date else None
        } for b in books],
        'pagination': {
            'page': page,
            'limit': limit,
            'total': total,
            'total_pages': total_pages,
            'has_next': page < total_pages,
            'has_prev': page > 1
        }
    })


@api_bp.route('/books/<int:id>', methods=['GET', 'PUT', 'DELETE'])
def get_book(id):
    """Get a single book by ID"""
    if request.method == 'GET':
        try:
            book = db.session.get(Book, id)
            if not book:
                return jsonify({'error': 'Book not found'}), 404
            
            return jsonify({
                'id': book.id,
                'title': book.title,
                'author': book.author,
                'description': book.description,
                'pdf_file_path': normalize_file_path(book.pdf_file_path),
                'cover_image_path': normalize_file_path(book.cover_image_path),
                'added_date': book.added_date.isoformat() if book.added_date else None
            })
        
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    elif request.method == 'DELETE':
        try:
            book = db.session.get(Book, id)
            if not book:
                return jsonify({'error': 'Book not found'}), 404
            
            db.session.delete(book)
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': f'書籍「{book.title}」を削除しました。'
            })
        
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500
    
    elif request.method == 'PUT':
        from flask import current_app
        try:
            book = db.session.get(Book, id)
            if not book:
                return jsonify({'error': 'Book not found'}), 404
            
            book.title = request.form.get('title', book.title)
            book.author = request.form.get('author', book.author)
            book.description = request.form.get('description', book.description)
            
            # Update PDF if provided
            pdf_file = request.files.get('pdf_file')
            if pdf_file and pdf_file.filename and allowed_file(pdf_file.filename):
                pdf_filename = secure_filename(f"{datetime.now().strftime('%Y%m%d%H%M%S')}_book_{pdf_file.filename}")
                pdf_filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], pdf_filename)
                pdf_file.save(pdf_filepath)
                book.pdf_file_path = pdf_filename  # Store only filename
                # Auto-extract cover from new PDF if no cover image is provided
                cover_image = request.files.get('cover_image')
                if not cover_image or not cover_image.filename:
                    extracted_filename, _ = extract_pdf_first_page(pdf_filepath)
                    if extracted_filename:
                        book.cover_image_path = extracted_filename
            
            # Update cover if provided
            cover_image = request.files.get('cover_image')
            if cover_image and cover_image.filename and allowed_file(cover_image.filename):
                cover_filename = secure_filename(f"{datetime.now().strftime('%Y%m%d%H%M%S')}_cover_{cover_image.filename}")
                cover_filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], cover_filename)
                cover_image.save(cover_filepath)
                book.cover_image_path = cover_filename  # Store only filename
            
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': f'書籍「{book.title}」を更新しました。'
            })
        
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500


@api_bp.route('/books', methods=['POST'])
def create_book():
    """Create a new book"""
    from flask import current_app
    try:
        title = request.form.get('title')
        author = request.form.get('author', '')
        description = request.form.get('description', '')
        pdf_file = request.files.get('pdf_file')
        cover_image = request.files.get('cover_image')
        
        if not pdf_file or not pdf_file.filename:
            return jsonify({'error': 'PDFファイルは必須です。'}), 400
        
        if not allowed_file(pdf_file.filename):
            return jsonify({'error': '許可されていないファイル形式です。'}), 400
        
        # Save PDF
        pdf_filename = secure_filename(f"{datetime.now().strftime('%Y%m%d%H%M%S')}_book_{pdf_file.filename}")
        pdf_filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], pdf_filename)
        pdf_file.save(pdf_filepath)
        pdf_path = pdf_filename  # Store only filename
        
        # Save cover image or extract from PDF
        cover_path = None
        if cover_image and cover_image.filename and allowed_file(cover_image.filename):
            # Use provided cover image
            cover_filename = secure_filename(f"{datetime.now().strftime('%Y%m%d%H%M%S')}_cover_{cover_image.filename}")
            cover_filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], cover_filename)
            cover_image.save(cover_filepath)
            cover_path = cover_filename  # Store only filename
        else:
            # Extract first page from PDF as cover
            extracted_filename, _ = extract_pdf_first_page(pdf_filepath)
            if extracted_filename:
                cover_path = extracted_filename
        
        book = Book(
            title=title,
            author=author,
            description=description,
            pdf_file_path=pdf_path,
            cover_image_path=cover_path
        )
        db.session.add(book)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'書籍「{title}」を登録しました。',
            'book_id': book.id
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@api_bp.route('/books/<int:id>/pages', methods=['GET'])
def get_book_pages(id):
    """Get book PDF page information - Returns the total number of pages"""
    try:
        book = db.session.get(Book, id)
        if not book:
            return jsonify({'error': 'Book not found'}), 404
        
        if not book.pdf_file_path:
            return jsonify({'error': 'Book has no PDF'}), 400
        
        # Normalize file path (handles both old and new formats)
        pdf_filename = normalize_file_path(book.pdf_file_path)
        pdf_path = os.path.join(current_app.config['UPLOAD_FOLDER'], pdf_filename)
        
        if not os.path.exists(pdf_path):
            return jsonify({'error': f'PDF file not found: {pdf_path}'}), 404
        
        try:
            doc = fitz.open(pdf_path)
            page_count = len(doc)
            doc.close()
            
            return jsonify({
                'book_id': id,
                'title': book.title,
                'total_pages': page_count
            })
        except Exception as e:
            return jsonify({'error': f'Failed to read PDF: {str(e)}'}), 500
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/books/<int:id>/page/<int:page_num>', methods=['GET'])
def get_book_page(id, page_num):
    """Get a specific page from a PDF as an image.
    
    Query Parameters:
    - zoom: Zoom level (default: 2, range: 1-4)
    """
    try:
        book = db.session.get(Book, id)
        if not book:
            return jsonify({'error': 'Book not found'}), 404
        
        if not book.pdf_file_path:
            return jsonify({'error': 'Book has no PDF'}), 400
        
        # Normalize file path (handles both old and new formats)
        pdf_filename = normalize_file_path(book.pdf_file_path)
        pdf_path = os.path.join(current_app.config['UPLOAD_FOLDER'], pdf_filename)
        
        if not os.path.exists(pdf_path):
            return jsonify({'error': f'PDF file not found: {pdf_path}'}), 404
        
        zoom = request.args.get('zoom', 2, type=int)
        if zoom < 1 or zoom > 4:
            zoom = 2
        
        try:
            doc = fitz.open(pdf_path)
            
            if page_num < 0 or page_num >= len(doc):
                return jsonify({'error': 'Page not found'}), 404
            
            page = doc[page_num]
            # Render page to image with zoom
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat)
            
            # Convert to PNG bytes
            png_data = pix.tobytes(output='png')
            doc.close()
            
            from flask import Response
            return Response(png_data, mimetype='image/png')
        
        except Exception as e:
            return jsonify({'error': f'Failed to render page: {str(e)}'}), 500
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/books/<int:id>/pages/batch', methods=['GET'])
def get_book_pages_batch(id):
    """Get multiple pages from a PDF at once (for optimization).
    
    Query Parameters:
    - start: Starting page number (0-indexed, default: 0)
    - count: Number of pages to fetch (default: 5, max: 20)
    - zoom: Zoom level (default: 1, range: 1-4)
    
    Returns base64-encoded PNG images for efficient transmission.
    """
    try:
        book = db.session.get(Book, id)
        if not book:
            return jsonify({'error': 'Book not found'}), 404
        
        if not book.pdf_file_path:
            return jsonify({'error': 'Book has no PDF'}), 400
        
        # Normalize file path
        pdf_filename = normalize_file_path(book.pdf_file_path)
        pdf_path = os.path.join(current_app.config['UPLOAD_FOLDER'], pdf_filename)
        
        if not os.path.exists(pdf_path):
            return jsonify({'error': f'PDF file not found: {pdf_path}'}), 404
        
        start_page = request.args.get('start', 0, type=int)
        count = min(request.args.get('count', 5, type=int), 20)  # Max 20 pages per request
        zoom = request.args.get('zoom', 2, type=int)
        
        if zoom < 1 or zoom > 4:
            zoom = 2
        
        try:
            import base64
            doc = fitz.open(pdf_path)
            total = len(doc)
            
            if start_page >= total:
                return jsonify({'error': 'Start page is out of range'}), 400
            
            pages_data = []
            for i in range(start_page, min(start_page + count, total)):
                page = doc[i]
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat)
                png_bytes = pix.tobytes(output='png')
                
                # Convert to base64 for JSON transmission
                b64_png = base64.b64encode(png_bytes).decode('utf-8')
                pages_data.append({
                    'page_num': i,
                    'data': f'data:image/png;base64,{b64_png}'
                })
            
            doc.close()
            
            return jsonify({
                'book_id': id,
                'start_page': start_page,
                'pages': pages_data,
                'total_pages': total
            })
        
        except Exception as e:
            return jsonify({'error': f'Failed to render pages: {str(e)}'}), 500
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# --- Links API ---
@api_bp.route('/links', methods=['GET'])
def get_links():
    """Get all resource links"""
    limit = request.args.get('limit', type=int)
    
    query = ResourceLink.query.order_by(ResourceLink.added_date.desc())
    
    if limit:
        query = query.limit(limit)
    
    links = query.all()
    
    return jsonify([{
        'id': l.id,
        'name': l.name,
        'url': l.url,
        'description': l.description,
        'added_date': l.added_date.isoformat() if l.added_date else None
    } for l in links])


@api_bp.route('/links', methods=['POST'])
def create_link():
    """Create a new link"""
    try:
        data = request.json or {}
        
        link = ResourceLink(
            name=data.get('name'),
            url=data.get('url'),
            description=data.get('description', '')
        )
        db.session.add(link)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'リンク「{link.name}」を登録しました。',
            'link_id': link.id
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@api_bp.route('/links/<int:id>', methods=['PUT'])
def update_link(id):
    """Update a link"""
    try:
        link = db.session.get(ResourceLink, id)
        if not link:
            return jsonify({'error': 'Link not found'}), 404
        
        data = request.json or {}
        link.name = data.get('name', link.name)
        link.url = data.get('url', link.url)
        link.description = data.get('description', link.description)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'リンク「{link.name}」を更新しました。'
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@api_bp.route('/links/<int:id>', methods=['DELETE'])
def delete_link(id):
    """Delete a link"""
    try:
        link = db.session.get(ResourceLink, id)
        if not link:
            return jsonify({'error': 'Link not found'}), 404
        
        db.session.delete(link)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'リンク「{link.name}」を削除しました。'
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# --- YouTube Playlists API ---
@api_bp.route('/playlists', methods=['GET'])
def get_playlists():
    """Get all YouTube playlists - optimized with caching"""
    from datetime import datetime, timedelta
    
    playlists = YouTubePlaylist.query.order_by(YouTubePlaylist.added_date.desc()).all()
    
    result = []
    playlists_to_update = []  # キャッシュ更新が必要なプレイリスト
    
    for p in playlists:
        # 完了した動画数を取得（DBのみ、高速）
        video_views = VideoView.query.filter_by(playlist_id=p.id).all()
        completed_videos = sum(1 for v in video_views if v.is_completed)
        
        # キャッシュされた動画数を使用
        total_videos = p.cached_video_count or 0
        thumbnail_url = p.thumbnail_url
        
        # キャッシュが古いか存在しない場合は更新リストに追加
        cache_age = timedelta(hours=24)  # 24時間でキャッシュ更新
        needs_update = (
            not p.cache_updated_at or 
            (datetime.utcnow() - p.cache_updated_at) > cache_age or
            total_videos == 0 or
            not thumbnail_url or 
            thumbnail_url.startswith('<')
        )
        
        if needs_update:
            playlists_to_update.append(p)
        
        result.append({
            'id': p.id,
            'playlist_id': p.playlist_id,
            'title': p.title,
            'description': p.description,
            'thumbnail_url': thumbnail_url if thumbnail_url and not thumbnail_url.startswith('<') else None,
            'added_date': p.added_date.isoformat() if p.added_date else None,
            'total_videos': total_videos,
            'completed_videos': completed_videos,
            'progress_rate': round((completed_videos / total_videos * 100) if total_videos > 0 else 0, 1)
        })
    
    # キャッシュ更新が必要なプレイリストがあれば、バックグラウンドで更新
    if playlists_to_update:
        from app import get_youtube_playlist_video_ids
        import threading
        
        def update_cache():
            from app import app
            with app.app_context():
                for p in playlists_to_update:
                    try:
                        video_ids = get_youtube_playlist_video_ids(p.playlist_id)
                        if video_ids:
                            p.cached_video_count = len(video_ids)
                            if not p.thumbnail_url or p.thumbnail_url.startswith('<'):
                                p.thumbnail_url = f'https://i.ytimg.com/vi/{video_ids[0]}/hqdefault.jpg'
                            p.cache_updated_at = datetime.utcnow()
                            db.session.commit()
                    except Exception as e:
                        print(f"[WARNING] Failed to update cache for playlist {p.id}: {e}")
        
        thread = threading.Thread(target=update_cache)
        thread.daemon = True
        thread.start()
    
    return jsonify(result)


@api_bp.route('/playlists/<int:id>', methods=['GET'])
def get_playlist(id):
    """Get playlist detail with videos and materials"""
    from app import get_youtube_playlist_video_ids, get_youtube_playlist_videos_info_ytdlp
    
    playlist = db.session.get(YouTubePlaylist, id)
    if not playlist:
        return jsonify({'error': 'Playlist not found'}), 404
    
    # Get materials (fast, required for admin)
    materials = PlaylistMaterial.query.filter_by(playlist_id=id).all()
    
    # Check if we need video details (from query param for optimization)
    include_videos = request.args.get('include_videos', 'false').lower() == 'true'
    
    videos = []
    total_completed = 0
    progress_rate = 0
    
    if include_videos:
        # Get video IDs and info (slower operation)
        video_ids = get_youtube_playlist_video_ids(playlist.playlist_id)
        video_info_map = get_youtube_playlist_videos_info_ytdlp(playlist.playlist_id)
        
        # Get video views
        video_views = {v.video_index: v for v in VideoView.query.filter_by(playlist_id=id).all()}
        
        for idx, video_id in enumerate(video_ids):
            info = video_info_map.get(video_id, {})
            view = video_views.get(idx)
            
            videos.append({
                'id': video_id,
                'title': info.get('title', f'Video {video_id}'),
                'thumbnail': info.get('thumbnail_url', f'https://i.ytimg.com/vi/{video_id}/hqdefault.jpg'),
                'channel': info.get('channel', 'YouTube'),
                'duration': info.get('duration', 0),
                'completed': view.is_completed if view else False,
                'views': view.watch_count if view else 0,
                'total_watch_time': view.watched_duration_seconds if view else 0
            })
        
        total_completed = sum(1 for v in videos if v['completed'])
        progress_rate = round((total_completed / len(videos) * 100) if videos else 0, 1)
    
    return jsonify({
        'id': playlist.id,
        'playlist_id': playlist.playlist_id,
        'title': playlist.title,
        'description': playlist.description,
        'videos': videos,
        'materials': [{
            'id': m.id,
            'display_name': m.display_name or m.original_filename,
            'original_filename': m.original_filename,
            'file_size': m.file_size or 0,
            'uploaded_at': m.uploaded_at.isoformat() if m.uploaded_at else None,
            'download_url': f'/playlist_materials/{m.id}/download'
        } for m in materials],
        'total_completed': total_completed,
        'progress_rate': progress_rate
    })


@api_bp.route('/playlists/<int:id>/reset', methods=['POST'])
def reset_playlist_progress(id):
    """Reset playlist progress"""
    try:
        deleted = VideoView.query.filter_by(playlist_id=id).delete()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'{deleted}件の進捗をリセットしました。'
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@api_bp.route('/playlists/<int:id>', methods=['DELETE'])
def delete_playlist(id):
    """Delete a playlist"""
    try:
        playlist = db.session.get(YouTubePlaylist, id)
        if not playlist:
            return jsonify({'error': 'Playlist not found'}), 404
        
        VideoView.query.filter_by(playlist_id=id).delete()
        PlaylistViewHistory.query.filter_by(playlist_id=id).delete()
        PlaylistMaterial.query.filter_by(playlist_id=id).delete()
        
        db.session.delete(playlist)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'プレイリストを削除しました。'
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@api_bp.route('/playlists/<playlist_id>/video/<video_id>/view', methods=['POST'])
def record_video_view(playlist_id, video_id):
    """Record video view progress"""
    try:
        data = request.json or {}
        watch_time = data.get('watch_time', 0)
        
        playlist = YouTubePlaylist.query.filter_by(playlist_id=playlist_id).first()
        if not playlist:
            return jsonify({'error': 'Playlist not found'}), 404
        
        # Find video index
        from app import get_youtube_playlist_video_ids
        video_ids = get_youtube_playlist_video_ids(playlist_id)
        try:
            video_index = video_ids.index(video_id)
        except ValueError:
            video_index = 0
        
        video_view = VideoView.query.filter_by(
            playlist_id=playlist.id,
            video_index=video_index
        ).first()
        
        if not video_view:
            video_view = VideoView(
                playlist_id=playlist.id,
                video_index=video_index,
                first_viewed=datetime.utcnow()
            )
            db.session.add(video_view)
        
        video_view.watched_duration_seconds = max(video_view.watched_duration_seconds or 0, watch_time)
        video_view.last_viewed = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({'success': True})
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@api_bp.route('/playlists/<playlist_id>/video/<video_id>/complete', methods=['POST'])
def mark_video_complete(playlist_id, video_id):
    """Mark video as completed"""
    try:
        playlist = YouTubePlaylist.query.filter_by(playlist_id=playlist_id).first()
        if not playlist:
            return jsonify({'error': 'Playlist not found'}), 404
        
        from app import get_youtube_playlist_video_ids
        video_ids = get_youtube_playlist_video_ids(playlist_id)
        try:
            video_index = video_ids.index(video_id)
        except ValueError:
            video_index = 0
        
        video_view = VideoView.query.filter_by(
            playlist_id=playlist.id,
            video_index=video_index
        ).first()
        
        if not video_view:
            video_view = VideoView(
                playlist_id=playlist.id,
                video_index=video_index,
                first_viewed=datetime.utcnow()
            )
            db.session.add(video_view)
        
        video_view.is_completed = True
        video_view.last_viewed = datetime.utcnow()
        
        # Calculate XP
        watch_time = video_view.watched_duration_seconds or 0
        xp = max(10, min(500, int(watch_time / 36)))
        video_view.xp_gained = xp
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'xp_gained': xp
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# --- Pixiv Topics API ---
@api_bp.route('/pixiv/topics', methods=['GET'])
def get_pixiv_topics():
    """Get Pixiv topics"""
    from app import get_latest_pixiv_info
    topics = get_latest_pixiv_info()
    return jsonify(topics)


# --- User Management API ---
@api_bp.route('/user/username', methods=['PUT'])
def update_username():
    """Update username"""
    try:
        data = request.json or {}
        new_username = data.get('username')
        
        if not new_username:
            return jsonify({'error': 'ユーザー名を入力してください。'}), 400
        
        user_status = UserStatus.query.first()
        if user_status:
            user_status.username = new_username
            db.session.commit()
            return jsonify({
                'success': True,
                'message': f'ユーザー名を「{new_username}」に更新しました。'
            })
        else:
            return jsonify({'error': 'ユーザーデータが見つかりません。'}), 404
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@api_bp.route('/user/reset', methods=['POST'])
def reset_all_data():
    """Reset all user data"""
    try:
        user_status = UserStatus.query.first()
        if user_status:
            user_status.total_xp = 0
            user_status.username = "新規ユーザー"
        
        db.session.query(Record).delete()
        db.session.query(Book).delete()
        db.session.query(ResourceLink).delete()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'すべての学習データをリセットしました。'
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# --- Archive API ---
@api_bp.route('/archive', methods=['GET'])
def get_archive():
    """Get archived records grouped by year"""
    all_records = Record.query.order_by(Record.date.desc()).all()
    
    archive_data = {}
    for record in all_records:
        year = record.get_year()
        if year not in archive_data:
            archive_data[year] = []
        archive_data[year].append({
            'id': record.id,
            'type': record.type,
            'subtype': record.subtype,
            'description': record.description,
            'xp_gained': record.xp_gained,
            'date': record.date.isoformat() if record.date else None,
            'duration_minutes': record.duration_minutes,
            'evaluation': record.evaluation,
            'image_path': record.image_path
        })
    
    return jsonify({
        'archive_data': archive_data,
        'sorted_years': sorted(archive_data.keys(), reverse=True)
    })


# --- Works API (for MyPage) ---
@api_bp.route('/works', methods=['GET'])
def get_works():
    """Get user works (acquisitions and posts)"""
    works = Record.query.filter(
        Record.type.in_(['科目習得', '作品投稿'])
    ).order_by(Record.date.desc()).all()
    
    return jsonify([{
        'id': w.id,
        'type': w.type,
        'subtype': w.subtype,
        'description': w.description,
        'xp_gained': w.xp_gained,
        'date': w.date.isoformat() if w.date else None,
        'evaluation': w.evaluation,
        'image_path': w.image_path
    } for w in works])


# --- Statistics API ---
@api_bp.route('/statistics/xp_by_technique', methods=['GET'])
def statistics_xp_by_technique():
    """Get XP grouped by technique type"""
    from sqlalchemy import func
    
    results = db.session.query(
        Record.subtype,
        func.sum(Record.xp_gained).label('total_xp')
    ).filter(
        Record.type.in_(['科目習得', '作品投稿'])
    ).group_by(Record.subtype).all()
    
    labels = [r[0] or '未分類' for r in results]
    data = [r[1] or 0 for r in results]
    
    return jsonify({
        'labels': labels,
        'data': data
    })


@api_bp.route('/statistics/xp_by_evaluation', methods=['GET'])
def statistics_xp_by_evaluation():
    """Get XP grouped by evaluation grade"""
    from sqlalchemy import func
    
    results = db.session.query(
        Record.evaluation,
        func.sum(Record.xp_gained).label('total_xp')
    ).filter(
        Record.type == '科目習得',
        Record.evaluation.isnot(None)
    ).group_by(Record.evaluation).all()
    
    labels = [r[0] or '未評価' for r in results]
    data = [r[1] or 0 for r in results]
    
    return jsonify({
        'labels': labels,
        'data': data
    })


@api_bp.route('/statistics/learning_patterns', methods=['GET'])
def statistics_learning_patterns():
    """Get learning patterns by day of week and hour"""
    from sqlalchemy import func, extract
    
    # By day of week (0=Monday, 6=Sunday)
    dow_results = db.session.query(
        extract('dow', Record.date).label('day_of_week'),
        func.count(Record.id).label('count')
    ).filter(
        Record.date.isnot(None)
    ).group_by('day_of_week').all()
    
    day_labels = ['月', '火', '水', '木', '金', '土', '日']
    day_data = [0] * 7
    for row in dow_results:
        day_idx = int(row[0]) if row[0] is not None else 0
        # SQLite: dow starts from 0 (Sunday) - adjust
        day_data[(day_idx + 6) % 7] = row[1] or 0
    
    # By hour
    hour_results = db.session.query(
        extract('hour', Record.date).label('hour'),
        func.count(Record.id).label('count')
    ).filter(
        Record.date.isnot(None)
    ).group_by('hour').all()
    
    hour_labels = [f'{h}時' for h in range(24)]
    hour_data = [0] * 24
    for row in hour_results:
        hour_idx = int(row[0]) if row[0] is not None else 0
        if 0 <= hour_idx < 24:
            hour_data[hour_idx] = row[1] or 0
    
    return jsonify({
        'by_day': {
            'labels': day_labels,
            'data': day_data
        },
        'by_hour': {
            'labels': hour_labels,
            'data': hour_data
        }
    })


@api_bp.route('/statistics/youtube_progress', methods=['GET'])
def statistics_youtube_progress():
    """Get YouTube playlist learning progress"""
    playlists = YouTubePlaylist.query.all()
    
    result = []
    for playlist in playlists:
        video_views = VideoView.query.filter_by(playlist_id=playlist.id).all()
        total_xp = sum(v.xp_gained or 0 for v in video_views)
        completed = sum(1 for v in video_views if v.is_completed)
        total_time = sum(v.watched_duration_seconds or 0 for v in video_views)
        
        result.append({
            'id': playlist.id,
            'title': playlist.title,
            'total_xp': total_xp,
            'completed_count': completed,
            'total_watch_time_seconds': total_time,
            'total_watch_time_formatted': f'{total_time // 3600}時間{(total_time % 3600) // 60}分'
        })
    
    return jsonify(result)


@api_bp.route('/statistics/activity_heatmap', methods=['GET'])
def statistics_activity_heatmap():
    """Get activity heatmap data for a specific year (GitHub-style)"""
    from sqlalchemy import func, and_
    from datetime import datetime, timedelta
    
    # Get year from query parameter, default to current year
    year = request.args.get('year', type=int)
    if year is None:
        year = datetime.now().year
    
    # Get data for the entire year
    start_date = datetime(year, 1, 1)
    end_date_next_year = datetime(year + 1, 1, 1)
    
    # Query all records to aggregate by date
    records = db.session.query(
        Record.date,
        Record.xp_gained,
        Record.duration_minutes
    ).filter(
        and_(
            Record.date >= start_date,
            Record.date < end_date_next_year
        )
    ).all()
    
    # Create a dictionary for easy lookup with aggregated data
    heatmap_data = {}
    for record_date, xp, duration_minutes in records:
        if record_date:  # Only process if date is not None
            date_str = record_date.strftime('%Y-%m-%d')
            if date_str not in heatmap_data:
                heatmap_data[date_str] = {'xp': 0, 'total_minutes': 0}
            heatmap_data[date_str]['xp'] += (xp or 0)
            heatmap_data[date_str]['total_minutes'] += (duration_minutes or 0)
    
    # Fill in all dates with 0 for missing dates
    current = start_date.date()
    end = datetime(year, 12, 31).date()
    all_dates = []
    while current <= end:
        date_str = str(current)
        date_data = heatmap_data.get(date_str, {'xp': 0, 'total_minutes': 0})
        all_dates.append({
            'date': date_str,
            'xp': date_data['xp'],
            'times': date_data['total_minutes'],  # Total minutes for the day
            'week': current.isocalendar()[1],
            'day': current.weekday()
        })
        current += timedelta(days=1)
    
    return jsonify({
        'data': all_dates,
        'start_date': str(start_date.date()),
        'end_date': str(end),
        'total_xp': sum(d['xp'] for d in all_dates),
        'days_active': len([d for d in all_dates if d['xp'] > 0])
    })


@api_bp.route('/statistics/time_analysis/<period>', methods=['GET'])
def statistics_time_analysis(period):
    """Get time-based analysis data (daily, weekly, monthly)"""
    from sqlalchemy import func, extract
    from datetime import datetime, timedelta
    
    now = datetime.now()
    
    if period == 'daily':
        # Last 7 days
        start_date = now - timedelta(days=7)
        results = db.session.query(
            func.date(Record.date).label('date'),
            func.sum(Record.duration_minutes).label('minutes'),
            func.sum(Record.xp_gained).label('xp')
        ).filter(
            Record.date >= start_date
        ).group_by(func.date(Record.date)).all()
        
        labels = [(start_date + timedelta(days=i)).strftime('%m/%d') for i in range(8)]
        
    elif period == 'weekly':
        # Last 4 weeks
        start_date = now - timedelta(weeks=4)
        results = db.session.query(
            extract('week', Record.date).label('week'),
            func.sum(Record.duration_minutes).label('minutes'),
            func.sum(Record.xp_gained).label('xp')
        ).filter(
            Record.date >= start_date
        ).group_by('week').all()
        
        labels = [f'第{i+1}週' for i in range(4)]
        
    else:  # monthly
        # Last 6 months
        start_date = now - timedelta(days=180)
        results = db.session.query(
            extract('month', Record.date).label('month'),
            func.sum(Record.duration_minutes).label('minutes'),
            func.sum(Record.xp_gained).label('xp')
        ).filter(
            Record.date >= start_date
        ).group_by('month').all()
        
        labels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
    
    # Build response
    minutes_data = [0] * len(labels)
    xp_data = [0] * len(labels)
    
    for row in results:
        try:
            if period == 'daily':
                idx = (datetime.strptime(str(row[0]), '%Y-%m-%d') - start_date).days
            elif period == 'weekly':
                idx = min(int(row[0] or 0) % 4, 3)
            else:
                idx = int(row[0] or 1) - 1
            
            if 0 <= idx < len(labels):
                minutes_data[idx] = row[1] or 0
                xp_data[idx] = row[2] or 0
        except (ValueError, TypeError):
            continue
    
    return jsonify({
        'labels': labels,
        'minutes': minutes_data,
        'xp': xp_data
    })


# --- Export API ---
@api_bp.route('/export/csv', methods=['GET'])
def export_csv():
    """Export all records as CSV"""
    import io
    import csv
    from flask import Response
    
    records = Record.query.order_by(Record.date.desc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow(['ID', '種別', 'サブタイプ', '説明', '取得XP', '日付', '時間(分)', '評価'])
    
    # Data
    for r in records:
        writer.writerow([
            r.id,
            r.type,
            r.subtype,
            r.description,
            r.xp_gained,
            r.date.strftime('%Y-%m-%d %H:%M:%S') if r.date else '',
            r.duration_minutes or '',
            r.evaluation or ''
        ])
    
    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={'Content-Disposition': 'attachment; filename=xp_records.csv'}
    )


@api_bp.route('/export/json', methods=['GET'])
def export_json():
    """Export all data as JSON"""
    user_status = UserStatus.query.first()
    records = Record.query.order_by(Record.date.desc()).all()
    books = Book.query.all()
    links = ResourceLink.query.all()
    
    export_data = {
        'exported_at': datetime.now().isoformat(),
        'user': {
            'username': user_status.username if user_status else '新規ユーザー',
            'total_xp': user_status.total_xp if user_status else 0
        },
        'records': [{
            'id': r.id,
            'type': r.type,
            'subtype': r.subtype,
            'description': r.description,
            'xp_gained': r.xp_gained,
            'date': r.date.isoformat() if r.date else None,
            'duration_minutes': r.duration_minutes,
            'evaluation': r.evaluation,
            'image_path': r.image_path
        } for r in records],
        'books': [{
            'id': b.id,
            'title': b.title,
            'author': b.author,
            'description': b.description
        } for b in books],
        'links': [{
            'id': l.id,
            'name': l.name,
            'url': l.url,
            'description': l.description
        } for l in links]
    }
    
    return jsonify(export_data)


# --- YouTube Playlist Processing API ---
@api_bp.route('/playlists', methods=['POST'])
def create_playlist():
    """Register or update YouTube playlist"""
    try:
        data = request.json or {}
        playlist_id_or_url = data.get('playlist_id_or_url', '').strip()
        title = data.get('title', '').strip()
        description = data.get('description', '').strip()
        
        if not playlist_id_or_url:
            return jsonify({'error': 'プレイリストURL/IDを入力してください。'}), 400
        
        # Import from app.py
        from app import extract_playlist_id, fetch_youtube_playlist_info, get_youtube_playlist_videos_info_ytdlp, get_youtube_playlist_video_ids
        
        # Extract playlist ID
        playlist_id = extract_playlist_id(playlist_id_or_url)
        if not playlist_id:
            return jsonify({'error': '有効なYouTubeプレイリストURL/IDではありません。'}), 400
        
        # Fetch playlist info via OEmbed
        playlist_info = fetch_youtube_playlist_info(playlist_id)
        
        if not playlist_info:
            return jsonify({'error': 'プレイリスト情報を取得できませんでした。'}), 400
        
        oembed_title = playlist_info.get('title', f'Playlist ({playlist_id[:8]}...)')
        
        # 動画一覧とサムネイルを取得
        thumbnail_url = ''
        video_count = 0
        try:
            video_ids = get_youtube_playlist_video_ids(playlist_id)
            video_count = len(video_ids)
            if video_ids:
                first_video_id = video_ids[0]
                # YouTubeの高画質サムネイルURLを直接生成
                thumbnail_url = f'https://i.ytimg.com/vi/{first_video_id}/hqdefault.jpg'
        except Exception as e:
            print(f"[WARNING] Failed to get playlist thumbnail: {e}")
        
        final_title = title if title else oembed_title
        
        # Check existing
        existing = YouTubePlaylist.query.filter_by(playlist_id=playlist_id).first()
        
        from datetime import datetime
        
        if existing:
            existing.title = final_title
            existing.description = description or existing.description
            if thumbnail_url:
                existing.thumbnail_url = thumbnail_url
            existing.cached_video_count = video_count
            existing.cache_updated_at = datetime.utcnow()
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': 'プレイリストを更新しました。',
                'playlist_id': existing.id
            })
        else:
            new_playlist = YouTubePlaylist(
                playlist_id=playlist_id,
                title=final_title,
                description=description,
                thumbnail_url=thumbnail_url,
                cached_video_count=video_count,
                cache_updated_at=datetime.utcnow()
            )
            db.session.add(new_playlist)
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': 'プレイリストを登録しました。',
                'playlist_id': new_playlist.id
            })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@api_bp.route('/playlists/<int:playlist_id>', methods=['PUT'])
def update_playlist_metadata(playlist_id):
    """Update playlist title and description"""
    try:
        playlist = db.session.get(YouTubePlaylist, playlist_id)
        if not playlist:
            return jsonify({'error': 'プレイリストが見つかりません。'}), 404
        
        data = request.json or {}
        
        if 'title' in data and data['title']:
            playlist.title = data['title'].strip()
        
        if 'description' in data:
            playlist.description = data['description'].strip() if data['description'] else ''
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'プレイリストを更新しました。'
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# --- Playlist Materials API ---
@api_bp.route('/playlists/<int:playlist_id>/materials', methods=['GET'])
def get_playlist_materials(playlist_id):
    """Get materials for a playlist"""
    from flask import url_for
    
    materials = PlaylistMaterial.query.filter_by(playlist_id=playlist_id).order_by(
        PlaylistMaterial.uploaded_at.desc()
    ).all()
    
    return jsonify([{
        'id': m.id,
        'display_name': m.display_name,
        'original_filename': m.original_filename,
        'file_size': m.file_size,
        'uploaded_at': m.uploaded_at.isoformat() if m.uploaded_at else None,
        'download_url': f'/playlist_materials/{m.id}/download'
    } for m in materials])


@api_bp.route('/playlists/<int:playlist_id>/materials', methods=['POST'])
def upload_playlist_materials(playlist_id):
    """Upload materials to a playlist"""
    try:
        playlist = db.session.get(YouTubePlaylist, playlist_id)
        if not playlist:
            return jsonify({'error': 'プレイリストが見つかりません。'}), 404
        
        # Support both 'material_file' and 'material_files'
        if 'material_file' in request.files:
            files = [request.files.get('material_file')]
        elif 'material_files' in request.files:
            files = request.files.getlist('material_files')
        else:
            return jsonify({'error': 'ファイルが選択されていません。'}), 400
        
        if not files or not files[0].filename:
            return jsonify({'error': 'ファイルが選択されていません。'}), 400
        
        from app import save_material_file
        
        uploaded_count = 0
        failed_count = 0
        
        for f in files:
            if not f.filename:
                continue
            
            file_info = save_material_file(f, playlist_id)
            
            if file_info:
                new_material = PlaylistMaterial(
                    playlist_id=playlist_id,
                    stored_filename=file_info['stored_filename'],
                    original_filename=file_info['original_filename'],
                    display_name=file_info['original_filename'],
                    file_size=file_info['file_size']
                )
                db.session.add(new_material)
                uploaded_count += 1
            else:
                failed_count += 1
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'{uploaded_count}件の資料をアップロードしました。',
            'uploaded_count': uploaded_count,
            'failed_count': failed_count
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@api_bp.route('/materials/<int:material_id>', methods=['DELETE'])
def delete_material(material_id):
    """Delete a playlist material"""
    try:
        material = db.session.get(PlaylistMaterial, material_id)
        if not material:
            return jsonify({'error': '講義資料が見つかりません。'}), 404
        
        from app import delete_uploaded_file, UPLOAD_FOLDER
        
        # Delete physical file
        delete_uploaded_file(f"{UPLOAD_FOLDER}/{material.stored_filename}")
        
        db.session.delete(material)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'講義資料「{material.display_name}」を削除しました。'
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# Note: This download endpoint is registered in app.py at /playlist_materials/<id>/download
# because it needs to be outside the /api prefix
