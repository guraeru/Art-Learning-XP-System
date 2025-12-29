import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import MyPage from './pages/MyPage'
import Pomodoro from './pages/Pomodoro'
import Archive from './pages/Archive'
import Resources from './pages/Resources'
import BookReader from './pages/BookReader'
import Statistics from './pages/Statistics'
import YouTubePlaylists from './pages/YouTubePlaylists'
import YouTubePlayer from './pages/YouTubePlayer'
import Admin from './pages/Admin'
import { PomodoroProvider } from './contexts/PomodoroContext'
import PomodoroMiniWindow from './components/PomodoroMiniWindow'

function App() {
  return (
    <PomodoroProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="mypage" element={<MyPage />} />
          <Route path="pomodoro" element={<Pomodoro />} />
          <Route path="archive" element={<Archive />} />
          <Route path="resources" element={<Resources />} />
          <Route path="book/:bookId" element={<BookReader />} />
          <Route path="statistics" element={<Statistics />} />
          <Route path="youtube" element={<YouTubePlaylists />} />
          <Route path="youtube/:playlistId" element={<YouTubePlayer />} />
          <Route path="admin" element={<Admin />} />
        </Route>
      </Routes>
      <PomodoroMiniWindow />
    </PomodoroProvider>
  )
}

export default App
