# Art Learning XP System

A gamified learning management system for mastering illustration and art skills. Track various learning activities as XP and maintain motivation through a rank-up system that progresses from rank 1 to 51.

## Key Features

- **Dashboard** - View your current rank, XP progress, and learning statistics at a glance
- **Time-Based Learning Records** - Track learning hours in minutes for activities like freehand sketches, fundamental techniques, and advanced techniques
- **XP Rank System** - Earn experience points from learning activities and climb through ranks 1-51
- **Pomodoro Timer** - 25-minute focused study timer for efficient learning sessions
- **Pixiv Daily Challenge** - Automatically fetch daily art prompts from Pixiv and set challenge goals
- **Book Reader** - View learning materials directly in PDF/EPUB formats
- **YouTube Learning Tracker** - Manage and record viewing progress for learning playlists
- **Learning Resource Management** - Organize reference links and learning materials by category
- **Learning Statistics & Analytics** - Visualize detailed data including study hours, acquired skills, and progress rates
- **Activity Heatmap** - Visualize your learning activity patterns on a monthly basis
- **My Page** - Manage your acquired skills list and profile settings
- **Archive Function** - Save and reference past learning records and achievements

## Setup Guide

### Requirements
- **Python**: 3.10 or higher
- **Node.js**: 18 or higher
- **npm**: 9 or higher

### Installation Steps

#### 1. Create Virtual Environment (Windows)

```cmd
python -m venv myenv
myenv\Scripts\activate
```

#### 2. Install Python Dependencies

```cmd
pip install -r requirements.txt
```

#### 3. Setup Frontend

```cmd
cd frontend
npm install
npm run build
cd ..
```

#### 4. Start Backend Server

```cmd
python app.py
```

Access in your browser at:
- **Local**: `http://127.0.0.1:5000`
- **Network**: `http://192.168.X.X:5000`

## Technology Stack

- **Backend**: Flask, SQLAlchemy, Flask-Login
- **Frontend**: React (TypeScript), Vite, Tailwind CSS
- **Database**: SQLite
- **Others**: Flask-CORS, PyMuPDF (PDF support)

## License

MIT License
