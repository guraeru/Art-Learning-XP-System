# Art Learning XP System

A comprehensive learning management system that gamifies art and creative learning through an XP (Experience Points) system. Track your study time, earn XP through various activities, and visualize your learning progress with an activity heatmap similar to GitHub's contribution graph.

## Features

- **XP-Based Learning Tracking**: Earn experience points through time-based learning and skill acquisition
- **Activity Heatmap**: Visualize daily learning activity with a color-coded heatmap showing study hours
- **Dashboard**: Real-time statistics and progress tracking
- **Book Management**: Upload and read PDF/EPUB files with learning integration
- **YouTube Integration**: Track YouTube playlist learning sessions
- **Resource Management**: Curate and manage learning resources and links
- **Statistics & Analytics**: Detailed analysis of learning patterns and progress
- **Archive System**: Review past learning records organized by year

## Tech Stack

### Backend
- **Framework**: Flask
- **Database**: SQLite (SQLAlchemy ORM)
- **Authentication**: Flask-Login
- **APIs**: Flask-RESTful
- **Task Processing**: PDF extraction (PyMuPDF), YouTube data extraction (yt-dlp)

### Frontend
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router v7
- **Charts**: Recharts
- **HTTP Client**: Axios
- **Icons**: Lucide React

### Database Models
- `UserStatus`: User profile and total XP
- `Record`: Individual learning records with XP and duration
- `Book`: Uploaded learning materials
- `ResourceLink`: External learning resources
- `YouTubePlaylist`: Tracked YouTube playlists
- `PlaylistViewHistory`: YouTube playlist viewing sessions
- `VideoView`: Individual video view history

## Setup Instructions

### Prerequisites
- Python 3.10+
- Node.js 18+
- pip and npm package managers

### Backend Setup

1. **Clone the repository**
```bash
cd c:\Users\Phant\Documents\Art-Learning-XP-System
```

2. **Create and activate virtual environment**
```bash
python -m venv myenv
myenv\Scripts\activate
```

3. **Install Python dependencies**
```bash
pip install -r requirements.txt
```

4. **Initialize the database**
```bash
python -c "from app import app, db; app.app_context().push(); db.create_all()"
```

5. **Run the Flask server**
```bash
python app.py
```
The backend server will start on `http://localhost:5000`

### Frontend Setup

1. **Navigate to frontend directory**
```bash
cd frontend
```

2. **Install Node dependencies**
```bash
npm install
```

3. **Development mode**
```bash
npm run dev
```
Access the development server at `http://localhost:5173`

4. **Build for production**
```bash
npm run build
```
The built files will be output to `dist/` directory

5. **Preview production build**
```bash
npm run preview
```

## Project Structure

```
Art-Learning-XP-System/
├── app.py                    # Main Flask application
├── api_routes.py            # REST API endpoints
├── models.py                # Database models
├── xp_core.py               # XP calculation logic
├── requirements.txt         # Python dependencies
├── run.bat                  # Windows batch runner
├── static/                  # Static assets
│   ├── uploads/            # User uploaded files
│   └── assets/             # Application assets
├── instance/               # Flask instance config
├── myenv/                  # Virtual environment
├── frontend/               # React TypeScript frontend
│   ├── src/
│   │   ├── components/     # Reusable React components
│   │   │   ├── ActivityHeatmap.tsx      # Main heatmap visualization
│   │   │   ├── Button.tsx
│   │   │   ├── Layout.tsx
│   │   │   ├── Toast.tsx
│   │   │   └── XPProgressCard.tsx
│   │   ├── pages/         # Page components
│   │   │   ├── Admin.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Statistics.tsx
│   │   │   ├── BookReader.tsx
│   │   │   ├── YouTubePlayer.tsx
│   │   │   └── ...
│   │   ├── services/      # API clients
│   │   │   └── api.ts
│   │   ├── types/         # TypeScript types
│   │   └── App.tsx
│   ├── package.json       # Node dependencies
│   ├── tsconfig.json      # TypeScript config
│   ├── vite.config.ts     # Vite config
│   └── tailwind.config.js # Tailwind config
└── README.md
```

## API Endpoints

### Statistics
- `GET /api/statistics/activity_heatmap?year=2025` - Get activity heatmap data for a specific year
- `GET /api/statistics/time_analysis/<period>` - Get time-based analysis (daily/weekly/monthly)

### Records
- `GET /api/records` - Get all learning records
- `POST /api/records` - Create a new record
- `GET /api/records/<id>` - Get specific record
- `PUT /api/records/<id>` - Update record
- `DELETE /api/records/<id>` - Delete record

### User Status
- `GET /api/status` - Get user status and total XP
- `PUT /api/status` - Update user information

### Books
- `GET /api/books` - List all books
- `POST /api/books/upload` - Upload new book
- `GET /api/books/<id>` - Get book details

### YouTube Playlists
- `GET /api/youtube-playlists` - List all playlists
- `POST /api/youtube-playlists` - Add playlist
- `GET /api/youtube-playlists/<id>/videos` - Get videos in playlist

## Recent Changes (Latest Commit)

### Activity Heatmap Improvements

**Modified Files:**
- `frontend/src/components/ActivityHeatmap.tsx`
- `api_routes.py`

**Changes:**
1. **Month Label Alignment**: Fixed month label positioning to perfectly align with heatmap grid cells using accurate width calculations based on week span indices

2. **Time Data Integration**: 
   - Backend now returns `duration_minutes` from `Record` model for each date
   - Properly aggregates total study time per day
   - Python processes records individually to collect time data accurately

3. **Time-Based Color Intensity**:
   - Cell colors now represent total daily study hours (not XP)
   - Color scale (0h to 4h+):
     - 0h: Gray (`bg-gray-100`)
     - 0-1h: Light green (`bg-green-200`)
     - 1-2h: Green (`bg-green-400`)
     - 2-3h: Darker green (`bg-green-500`)
     - 3-4h: Even darker green (`bg-green-600`)
     - 4h+: Darkest green (`bg-green-700`)

4. **Enhanced Tooltips**:
   - Display format: "DATE: XP XP\n学習時間: XhYm"
   - Shows both XP earned and total study time
   - Converts minutes to readable "Xh Ym" format (e.g., "1h 30m", "45m")

5. **Updated Legend**:
   - Changed from generic "Less/More" to specific time ranges "0h to 4h+"
   - Added new color level (`bg-green-600`) for better gradation

6. **Data Flow**:
   - Query: Retrieve all individual records with date and duration_minutes
   - Process: Aggregate by date, sum XP and study time
   - Display: Color based on hours, tooltip shows both metrics

## Configuration

### Environment Variables
Create a `.env` file in the root directory:
```
FLASK_ENV=development
FLASK_DEBUG=1
DATABASE_URL=sqlite:///xp_system.db
```

### Database
The system uses SQLite by default. The database file `xp_system.db` is created automatically on first run.

## Development Workflow

1. **Backend Development**:
   - Modify Python files in root directory
   - Changes in `api_routes.py` are automatically reflected
   - Restart Flask server to see changes

2. **Frontend Development**:
   - Run `npm run dev` in the `frontend` directory
   - Vite provides hot module reloading
   - TypeScript compilation happens automatically

3. **Building for Production**:
   - Run `npm run build` in frontend directory
   - Run Flask in production mode with appropriate configuration
   - Backend serves the built frontend from `static/dist/`

## Performance Considerations

- **Activity Heatmap**: Queries all records for a specific year and aggregates by date
- **Large Datasets**: Consider pagination for record lists
- **Database**: Use indexes on date fields for faster queries

## Contributing

When making changes:
1. Update both backend and frontend as needed
2. Write clear commit messages
3. Test changes locally before committing
4. Update this README for significant changes

## License

See LICENSE file for details

## Support

For issues or questions, please refer to the project structure and inline code documentation.
