# Art Learning XP System

A full-stack learning management system that gamifies creative learning through an experience points (XP) system. Track study time, visualize daily activity with an interactive heatmap, and monitor your learning progress.

## What You Can Do

- 📊 **Activity Heatmap** - Visualize daily learning activity similar to GitHub's contribution graph, with color intensity based on study hours
- 📈 **XP Tracking** - Earn experience points through learning activities
- 📚 **Book Management** - Upload and read PDF/EPUB learning materials
- 🎥 **YouTube Integration** - Track and manage YouTube playlist learning sessions
- 📝 **Resource Management** - Organize learning resources and external links
- 📊 **Statistics & Analytics** - View detailed learning patterns and progress
- 🗂️ **Archive System** - Review historical learning records by year

## Tech Stack

### Frontend
- **Language**: TypeScript
- **Framework**: React 19
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router v7
- **Data Visualization**: Recharts
- **HTTP Client**: Axios
- **Icons**: Lucide React

### Backend
- **Language**: Python 3.10+
- **Framework**: Flask
- **ORM**: SQLAlchemy
- **Database**: SQLite
- **Authentication**: Flask-Login
- **API**: RESTful REST API
- **CORS**: Flask-CORS
- **Media Processing**: PyMuPDF (PDF), yt-dlp (YouTube)

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- Git

### Backend Setup

1. **Navigate to project root**
```bash
# Already in project directory, or:
cd Art-Learning-XP-System
```

2. **Create virtual environment**
```bash
python -m venv myenv
myenv\Scripts\activate
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Initialize database**
```bash
python -c "from app import app, db; app.app_context().push(); db.create_all()"
```

5. **Run server**
```bash
python app.py
```
Backend runs on `http://localhost:5000`

### Frontend Setup

1. **Navigate to frontend directory**
```bash
cd frontend
```

2. **Install dependencies**
```bash
npm install
```

3. **Development mode**
```bash
npm run dev
```
Frontend runs on `http://localhost:5173`

4. **Build for production**
```bash
npm run build
```

## Project Structure

```
Art-Learning-XP-System/
├── app.py                    # Flask main application
├── api_routes.py            # REST API endpoints
├── models.py                # Database models
├── xp_core.py               # XP calculation logic
├── requirements.txt         # Python dependencies
├── static/                  # Static files & uploads
├── myenv/                   # Virtual environment
└── frontend/                # React TypeScript frontend
    ├── src/
    │   ├── components/      # React components
    │   ├── pages/          # Page components
    │   ├── services/       # API client
    │   └── types/          # TypeScript types
    ├── package.json
    ├── vite.config.ts
    └── tailwind.config.js
```

## API Endpoints

**Statistics**
- `GET /api/statistics/activity_heatmap?year=2025` - Get activity heatmap data
- `GET /api/statistics/time_analysis/<period>` - Get time-based analysis

**Records**
- `GET /api/records` - List all records
- `POST /api/records` - Create new record
- `GET /api/records/<id>` - Get record details
- `PUT /api/records/<id>` - Update record
- `DELETE /api/records/<id>` - Delete record

**User Status**
- `GET /api/status` - Get user info and total XP
- `PUT /api/status` - Update user info

**Books**
- `GET /api/books` - List all books
- `POST /api/books/upload` - Upload new book
- `GET /api/books/<id>` - Get book details

**YouTube Playlists**
- `GET /api/youtube-playlists` - List all playlists
- `POST /api/youtube-playlists` - Add new playlist
- `GET /api/youtube-playlists/<id>/videos` - Get playlist videos

## Features Explained

### Activity Heatmap
- Displays daily learning activity for the entire year
- Color intensity represents total study hours (0h to 4h+)
- Hover over cells to see exact XP and study time
- Navigate between years using arrow buttons

### Color Legend
- Gray (0h) - No activity
- Light Green (0-1h) - Minimal activity
- Green (1-2h) - Regular activity
- Dark Green (2-3h) - Good activity
- Darker Green (3-4h) - High activity
- Darkest Green (4h+) - Excellent activity

## License

MIT License
