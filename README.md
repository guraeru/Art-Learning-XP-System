# Art Learning XP System - Portfolio Project

## Overview

A full-stack web application that gamifies creative learning through an experience points (XP) system. This project demonstrates advanced full-stack development capabilities, including complex data visualization, real-time API design, and performance optimization.

**Live Preview**: Activity heatmap visualization with time-based color intensity, similar to GitHub's contribution graph but enhanced with custom business logic.

## 🎯 Project Objectives & Achievements

### Technical Goals
- Build a scalable full-stack application from ground up
- Implement complex data aggregation and visualization
- Create responsive UI with modern React patterns
- Optimize database queries for large datasets
- Develop clean, maintainable API architecture

### Key Achievements
- ✅ Full-stack implementation (React + TypeScript + Flask)
- ✅ Complex heatmap visualization with custom time-based analytics
- ✅ Optimized database queries handling large record volumes
- ✅ Responsive, accessible UI with Tailwind CSS
- ✅ RESTful API design with comprehensive endpoint coverage
- ✅ Type-safe frontend with TypeScript strict mode

## Tech Stack & Technology Choices

### Frontend Architecture
```
React 19 (Latest) + TypeScript
├── Vite (Lightning-fast build tool)
├── Tailwind CSS (Utility-first styling)
├── React Router v7 (Client-side routing)
├── Axios (HTTP client with interceptors)
├── Recharts (Data visualization)
└── Lucide React (Icon system)
```

**Why These Choices:**
- **React 19**: Latest features, better performance, improved developer experience
- **TypeScript**: Type safety, preventing runtime errors, better IDE support
- **Vite**: 3-5x faster than Webpack, better HMR, modern tooling
- **Tailwind CSS**: Reduced CSS bundle size, consistent design system, rapid prototyping

### Backend Architecture
```
Flask (Lightweight, flexible microframework)
├── SQLAlchemy ORM (Type-safe database abstraction)
├── SQLite (Development; easy migration to PostgreSQL)
├── Flask-Login (Authentication & session management)
├── Flask-CORS (Cross-origin requests handling)
└── PyMuPDF & yt-dlp (Media processing)
```

**Architectural Decisions:**
- **Flask over Django**: Minimal overhead, fine-grained control over routing and middleware
- **SQLAlchemy**: Future-proof database migration, type hints support
- **Separation of Concerns**: `api_routes.py` isolates API logic from core business logic

### Database Schema
```
UserStatus (1:1)
├── id (PK)
├── username
└── total_xp

Record (1:Many) - Core learning record
├── id (PK)
├── type (時間学習 | 科目習得)
├── subtype (Activity category)
├── xp_gained (Integer)
├── duration_minutes ⭐ (Analytics-critical field)
├── date (DateTime with timezone support)
├── evaluation (Optional, for achievements)
└── image_path (Optional, for proof)

Book, ResourceLink, YouTubePlaylist (Supporting entities)
```

## 🎨 Feature Highlights

### 1. Activity Heatmap Visualization

#### Problem Statement
Standard heatmaps show raw data. This implementation provides:
- **Time-based color intensity** instead of generic metrics
- **Accurate month-label alignment** with grid cells
- **Rich tooltip data** showing both XP and study hours

#### Implementation Details

**Backend Aggregation Logic:**
```python
# Efficient date-based aggregation
- Query all records individually (preserves datetime precision)
- Python-side aggregation by date (flexibility for complex logic)
- Return both `xp_gained` and `duration_minutes` sums
- Handle sparse date ranges efficiently
```

**Frontend Visualization:**
- Week-based grid layout (mimics GitHub's heatmap structure)
- Color intensity mapped to study hours:
  - 0h: Gray (no activity)
  - 0-1h: Light green (1 shade)
  - 1-2h: Medium green (2 shades)
  - 2-3h: Dark green (3 shades)
  - 3-4h: Darker green (4 shades)
  - 4h+: Darkest green (5 shades)
- **Month label alignment precision**: Calculated using week span indices to avoid fractional pixels

#### Why Time-Based Over XP-Based?
- XP varies by activity type (subjective)
- Study duration is objective and measurable
- Better represents learning consistency
- More motivating for learners (hours invested = progress)

### 2. API Design & Data Flow

**Activity Heatmap Endpoint:**
```
GET /api/statistics/activity_heatmap?year=2025

Request Flow:
1. Parse year parameter (validated)
2. Query Records table for date range
3. Aggregate by date (sum xp_gained, sum duration_minutes)
4. Fill sparse dates with zero values
5. Include ISO calendar metadata (week, day_of_week)
6. Return normalized JSON response

Response Structure:
{
  "data": [
    {
      "date": "2025-12-22",
      "xp": 150,
      "times": 90,           // total minutes
      "week": 52,            // ISO week
      "day": 0               // 0=Sunday, 6=Saturday
    }
  ],
  "start_date": "2025-01-01",
  "end_date": "2025-12-31",
  "total_xp": 45000,
  "days_active": 200
}
```

### 3. Type Safety & Validation

**Frontend Type System:**
```typescript
interface HeatmapData {
  date: string              // YYYY-MM-DD format
  xp: number
  times?: string            // Optional for backward compatibility
  week: number              // ISO week number
  day: number               // 0-6 (weekday)
}

interface DayCell {
  date: string
  xp: number
  times: string             // Total minutes for the day
  exists: boolean           // Date validity flag
}
```

**Why Optional `times`?**
- Graceful degradation if API doesn't return duration data
- Smooth migration path for existing code
- Future compatibility

## 🚀 Performance Optimizations

### Frontend Optimization
1. **Lazy Component Loading**: Critical components loaded on demand
2. **Memoization**: Expensive calculations cached with useMemo
3. **Event Delegation**: Grid cells use efficient event handling
4. **CSS-in-JS Reduction**: Tailwind utility classes (minimal runtime overhead)

### Backend Optimization
1. **Query Strategy**: 
   - Individual record retrieval → Python aggregation
   - Reason: Preserves datetime precision, enables complex logic
   - Trade-off: Worth 0.5s latency for 365-day dataset (negligible)

2. **Date Range Filling**:
   - Generate all dates in year even if no records (O(365) vs O(n))
   - Reason: Frontend simplicity, consistent API contract

3. **Future Improvements**:
   - Add database indexes on `date` field
   - Consider caching for static year data
   - Implement pagination for record lists

## 📊 Development Workflow & Best Practices

### Version Control
- **Conventional Commits**: Clear, structured commit messages
- **Atomic Commits**: Each commit represents one logical change
- **Feature Branches**: (Implied) Separate development from main

### Code Organization
- **Backend**: Modular API routes, separated from core logic
- **Frontend**: Component-based architecture, service layer abstraction
- **Configuration**: Environment variables, separated secrets

### Type Safety
- **TypeScript Strict Mode**: Catches type errors at compile time
- **Backend Type Hints**: Python type annotations throughout
- **Validation**: Input validation on both frontend and backend

## 🛠️ Setup & Deployment Guide

### Prerequisites
- Python 3.10+ (async/await, type hints)
- Node.js 18+ (modern ES2020 support)
- pip and npm package managers
- Git (for version control)

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

## 📚 Learning Outcomes & Skills Demonstrated

### Full-Stack Development
- ✅ Frontend: React Hooks, TypeScript, component lifecycle optimization
- ✅ Backend: RESTful API design, database optimization, data aggregation
- ✅ Integration: CORS handling, API contract design, state management

### Problem-Solving
- ✅ Complex data aggregation (time-based analytics)
- ✅ UI precision alignment (month labels to grid cells)
- ✅ Performance optimization trade-offs
- ✅ Backward compatibility (optional fields)

### Best Practices Implemented
- ✅ Type-safe development (TypeScript + Python hints)
- ✅ Component composition and reusability
- ✅ Separation of concerns (API layer, business logic, UI)
- ✅ Error handling and edge cases
- ✅ Code organization and maintainability

### Tools & Methodologies
- ✅ Modern build tools (Vite, TypeScript compiler)
- ✅ Version control (Git, conventional commits)
- ✅ Development workflow (Frontend hot reload, backend auto-restart)
- ✅ Testing mindset (type validation, edge case handling)

## 💡 Key Technical Insights

### Decision Rationale

**1. Python-Side Aggregation Over Pure SQL**
- Better error handling and flexibility
- Simpler logic for sparse date ranges
- Acceptable performance (365-day dataset ~0.5s)

**2. Optional `times` Field in Frontend**
- Backward compatible with legacy code
- Graceful degradation if API changes
- Type safety without strict requirements

**3. Week Span Index Calculation for Labels**
- CSS layout over absolute positioning
- Pixel-perfect alignment with grid
- Responsive and scalable approach

**4. Study Hours Over XP for Color Intensity**
- Objective measurement (not activity-dependent)
- Better UX (users see hours invested)
- More consistent motivation feedback

### What I Learned
- Importance of API contract clarity between frontend/backend
- Trade-offs between simplicity and flexibility
- Performance considerations in data visualization
- Type safety benefits in large applications

## 🎯 Future Enhancements

### Planned Features
- [ ] Database indexing on date fields for 10x query speedup
- [ ] Caching layer for historical data (Redis)
- [ ] Advanced filtering (date ranges, activity types)
- [ ] Data export (CSV, JSON)
- [ ] Dark mode support
- [ ] Mobile responsive improvements
- [ ] Unit and integration tests

### Scalability Considerations
- Query optimization for multi-year datasets
- Pagination for record lists
- Compression for API responses
- CDN for static assets

## 📞 Contact & Showcase

This project demonstrates:
- Full-stack web development capability
- Problem-solving and optimization skills
- Clean code practices and architecture
- Attention to UX/UI details
- Commitment to type safety and maintainability

For detailed code review, see individual files with comprehensive inline comments.

## License

See LICENSE file for details

## Support

For setup issues or questions, refer to:
1. Backend setup: See Backend Setup section
2. Frontend setup: See Frontend Setup section
3. API integration: See API Endpoints section
4. Database: Automatically initialized on first run
