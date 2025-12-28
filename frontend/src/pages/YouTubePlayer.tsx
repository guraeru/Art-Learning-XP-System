import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Play,
  SkipForward,
  SkipBack,
  CheckCircle,
  Circle,
  ArrowLeft,
  Youtube,
  Trophy,
} from 'lucide-react'
import { getPlaylist, recordVideoView, markVideoComplete } from '../services/api'
import type { PlaylistDetail } from '../types'
import Toast from '../components/Toast'

// YouTube IFrame API types
interface YTPlayer {
  destroy: () => void
  getCurrentTime: () => number
}

interface YTPlayerEvent {
  data: number
}

interface YTPlayerVars {
  autoplay?: number
  modestbranding?: number
  rel?: number
}

interface YTPlayerOptions {
  videoId: string
  playerVars?: YTPlayerVars
  events?: {
    onStateChange?: (event: YTPlayerEvent) => void
  }
}

interface YTPlayerConstructor {
  new (elementId: string, options: YTPlayerOptions): YTPlayer
}

interface YTNamespace {
  Player: YTPlayerConstructor
  PlayerState: {
    PLAYING: number
    ENDED: number
  }
}

declare global {
  interface Window {
    YT: YTNamespace
    onYouTubeIframeAPIReady: () => void
  }
}

export default function YouTubePlayer() {
  const { playlistId } = useParams<{ playlistId: string }>()
  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [playerReady, setPlayerReady] = useState(false)
  const playerRef = useRef<YTPlayer | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const playlistContainerRef = useRef<HTMLDivElement>(null)

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setPlayerReady(true)
      return
    }

    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    const firstScriptTag = document.getElementsByTagName('script')[0]
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)

    window.onYouTubeIframeAPIReady = () => {
      setPlayerReady(true)
    }
  }, [])

  // Fetch playlist data
  useEffect(() => {
    if (!playlistId) return
    getPlaylist(parseInt(playlistId), true).then((res) => {
      setPlaylist(res.data)
      
      // Find the first incomplete video
      const videos = res.data.videos
      if (videos && videos.length > 0) {
        const firstIncompleteIndex = videos.findIndex(v => !v.completed)
        if (firstIncompleteIndex >= 0) {
          setCurrentIndex(firstIncompleteIndex)
        }
      }
      
      setLoading(false)
    })
  }, [playlistId])

  // Scroll to current video in playlist
  useEffect(() => {
    if (!playlistContainerRef.current) return
    
    // Get the current video item element
    const currentVideoItem = playlistContainerRef.current.querySelector(
      `[data-video-index="${currentIndex}"]`
    )
    
    if (currentVideoItem) {
      currentVideoItem.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [currentIndex])

  // Initialize player
  useEffect(() => {
    if (!playerReady || !playlist || !playlist.videos || playlist.videos.length === 0) return

    const initPlayer = () => {
      if (playerRef.current) {
        playerRef.current.destroy()
      }

      const currentVideo = playlist.videos?.[currentIndex]
      playerRef.current = new window.YT.Player('youtube-player', {
        videoId: currentVideo?.id,
        playerVars: {
          autoplay: 0,
          modestbranding: 1,
          rel: 0,
          start: Math.floor(currentVideo?.total_watch_time || 0), // Start from last watch position
        },
        events: {
          onStateChange: handleStateChange,
        },
      })
    }

    // Small delay to ensure container is ready
    const timer = setTimeout(initPlayer, 100)
    return () => clearTimeout(timer)
  }, [playerReady, playlist, currentIndex])

  const handleStateChange = useCallback(
    (event: YTPlayerEvent) => {
      if (!playlist?.videos) return

      const currentVideo = playlist.videos[currentIndex]
      if (!currentVideo) return

      // Track watch time periodically when playing
      if (event.data === window.YT.PlayerState.PLAYING) {
        const trackProgress = setInterval(() => {
          if (playerRef.current) {
            const currentTime = playerRef.current.getCurrentTime()
            recordVideoView(playlist.playlist_id, currentVideo.id, Math.floor(currentTime))
          }
        }, 30000) // Every 30 seconds

        // Store interval for cleanup
        ;(window as { _trackInterval?: NodeJS.Timeout })._trackInterval = trackProgress
      }

      // Video ended
      if (event.data === window.YT.PlayerState.ENDED) {
        // Clear tracking interval
        if ((window as { _trackInterval?: NodeJS.Timeout })._trackInterval) {
          clearInterval((window as { _trackInterval?: NodeJS.Timeout })._trackInterval)
        }

        // Mark as complete
        markVideoComplete(playlist.playlist_id, currentVideo.id).then((res) => {
          if (res.data.success) {
            setToast({
              message: `動画を完了しました！ +${res.data.xp_gained} XP`,
              type: 'success',
            })
            // Refresh playlist data with videos
            getPlaylist(playlist.id, true).then((r) => setPlaylist(r.data))
          }
        })

        // Auto-advance to next video
        if (playlist?.videos && currentIndex < playlist.videos.length - 1) {
          setTimeout(() => setCurrentIndex(currentIndex + 1), 2000)
        }
      }
    },
    [playlist, currentIndex]
  )

  const playVideo = (index: number) => {
    setCurrentIndex(index)
  }

  const nextVideo = () => {
    if (playlist?.videos && currentIndex < playlist.videos.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const prevVideo = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!playlist) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">プレイリストが見つかりません</p>
        <Link to="/" className="text-primary-500 hover:underline mt-4 inline-block">
          ダッシュボードに戻る
        </Link>
      </div>
    )
  }

  const currentVideo = playlist?.videos?.[currentIndex]

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/youtube"
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800">{playlist.title}</h1>
          <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
            <span className="flex items-center gap-1">
              <Youtube className="w-4 h-4" />
              {playlist?.videos?.length || 0} 動画
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-green-500" />
              {playlist.total_completed} 完了
            </span>
            <span className="flex items-center gap-1">
              <Trophy className="w-4 h-4 text-primary-500" />
              {playlist?.progress_rate || 0}%
            </span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Video Player */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-black rounded-2xl overflow-hidden aspect-video" ref={containerRef}>
            <div id="youtube-player" className="w-full h-full" />
          </div>

          {/* Controls */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={prevVideo}
                  disabled={currentIndex === 0}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <SkipBack className="w-6 h-6" />
                </button>
                <button
                  onClick={nextVideo}
                  disabled={currentIndex === (playlist?.videos?.length || 0) - 1}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <SkipForward className="w-6 h-6" />
                </button>
              </div>
              <div className="text-center">
                <p className="font-medium text-gray-800 truncate max-w-md">
                  {currentVideo?.title || `動画 ${currentIndex + 1}`}
                </p>
                <p className="text-sm text-gray-500">
                  {currentIndex + 1} / {playlist?.videos?.length || 0}
                </p>
              </div>
              <div className="w-24" />
            </div>
          </div>
        </div>

        {/* Playlist */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-800">動画一覧</h2>
          </div>
          <div className="max-h-[600px] overflow-auto" ref={playlistContainerRef}>
            {playlist?.videos?.map((video, index) => (
              <div
                key={video.id}
                data-video-index={index}
                onClick={() => playVideo(index)}
                className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                  index === currentIndex
                    ? 'bg-primary-50 border-l-4 border-primary-500'
                    : 'hover:bg-gray-50'
                }`}
              >
                {/* Thumbnail */}
                <div className="relative w-24 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                  {index === currentIndex && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Play className="w-6 h-6 text-white" fill="white" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 line-clamp-2">
                    {video.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {video.completed ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <Circle className="w-4 h-4 text-gray-300" />
                    )}
                    <span className="text-xs text-gray-500">
                      {Math.floor(video.duration / 60)}:{(video.duration % 60)
                        .toString()
                        .padStart(2, '0')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
