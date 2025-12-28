import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Youtube,
  Play,
  CheckCircle,
  ListVideo,
  Search,
} from 'lucide-react'
import { getPlaylists } from '../services/api'
import type { YouTubePlaylist } from '../types'

// サムネイルコンポーネント - エラー時にフォールバック表示
function PlaylistThumbnail({ playlist }: { playlist: YouTubePlaylist }) {
  const [imageError, setImageError] = useState(false)

  // 有効な画像URLかチェック
  const isValidImageUrl = (url: string | null | undefined): boolean => {
    if (!url) return false
    if (url.includes('<iframe') || url.includes('<')) return false
    return url.startsWith('http')
  }

  const thumbnailUrl = playlist.thumbnail_url
  const hasValidThumbnail = isValidImageUrl(thumbnailUrl)

  if (!hasValidThumbnail || imageError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-500 to-red-600">
        <div className="text-center">
          <Youtube className="w-12 h-12 text-white/80 mx-auto mb-2" />
          <div className="flex items-center justify-center gap-1 text-white/90">
            <ListVideo className="w-4 h-4" />
            <span className="text-sm font-medium">
              {playlist.total_videos ?? 0}本の動画
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <img
      src={thumbnailUrl!}
      alt={playlist.title}
      className="w-full h-full object-cover"
      onError={() => setImageError(true)}
    />
  )
}

export default function YouTubePlaylists() {
  const [playlists, setPlaylists] = useState<YouTubePlaylist[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchPlaylists()
  }, [])

  const fetchPlaylists = async () => {
    try {
      const res = await getPlaylists()
      setPlaylists(res.data)
    } catch (error) {
      console.error('Failed to fetch playlists:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredPlaylists = playlists.filter((playlist) =>
    playlist.title.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getProgressColor = (rate: number) => {
    if (rate >= 100) return 'bg-green-500'
    return 'bg-blue-500'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
          <Youtube className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">YouTube学習</h1>
          <p className="text-sm text-gray-500">
            {playlists.length}件の再生リスト
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="再生リストを検索..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-base"
        />
      </div>

      {/* Playlist Grid */}
      {filteredPlaylists.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
          <Youtube className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            {searchTerm ? '検索結果がありません' : '再生リストがありません'}
          </h3>
          <p className="text-gray-500">
            {searchTerm
              ? '別のキーワードで検索してみてください'
              : '管理画面から再生リストを追加してください'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlaylists.map((playlist) => (
            <Link
              key={playlist.id}
              to={`/youtube/${playlist.id}`}
              className="group bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video bg-gray-100">
                <PlaylistThumbnail playlist={playlist} />
                
                {/* Play overlay */}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                    <Play className="w-8 h-8 text-white ml-1" />
                  </div>
                </div>

                {/* Progress badge */}
                {playlist.progress_rate !== undefined && playlist.progress_rate >= 100 && (
                  <div className="absolute top-3 right-3 bg-green-500 text-white px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    完了
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-red-600 transition-colors">
                  {playlist.title}
                </h3>
                
                {playlist.description && (
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                    {playlist.description}
                  </p>
                )}

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                  <div className="flex items-center gap-1">
                    <ListVideo className="w-4 h-4" />
                    <span>{playlist.total_videos ?? 0}本</span>
                  </div>
                  {playlist.completed_videos !== undefined && (
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>{playlist.completed_videos}本完了</span>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                {playlist.progress_rate !== undefined && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">進捗</span>
                      <span className="font-medium text-gray-700">
                        {Math.round(playlist.progress_rate)}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getProgressColor(playlist.progress_rate)} transition-all duration-500`}
                        style={{ width: `${Math.min(100, playlist.progress_rate)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
