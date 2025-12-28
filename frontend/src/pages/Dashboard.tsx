import { useState, useEffect } from 'react'
import {
  Trophy,
  Clock,
  Palette,
  Upload,
  Link2,
  Youtube,
  ExternalLink,
  Play,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { getStatus, getConstants, getLinks, getPlaylists, logTime, logAcquisition, logPost, getPixivTopics } from '../services/api'
import type { UserStatus, Constants, ResourceLink, YouTubePlaylist, PixivTopic } from '../types'
import XPProgressCard from '../components/XPProgressCard'
import Toast from '../components/Toast'

export default function Dashboard() {
  const [status, setStatus] = useState<UserStatus | null>(null)
  const [constants, setConstants] = useState<Constants | null>(null)
  const [links, setLinks] = useState<ResourceLink[]>([])
  const [playlists, setPlaylists] = useState<YouTubePlaylist[]>([])
  const [pixivTopics, setPixivTopics] = useState<PixivTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Form states
  const [timeForm, setTimeForm] = useState({ activity_type: '', duration: '', description: '' })
  const [acqForm, setAcqForm] = useState({ technique_type: '', evaluation: 'C', description: '' })
  const [acqImage, setAcqImage] = useState<File | null>(null)
  const [postDescription, setPostDescription] = useState('')
  const [postImage, setPostImage] = useState<File | null>(null)

  useEffect(() => {
    Promise.all([
      getStatus(),
      getConstants(),
      getLinks(5),
      getPlaylists(),
      getPixivTopics().catch(() => ({ data: [] })),
    ]).then(([statusRes, constantsRes, linksRes, playlistsRes, pixivRes]) => {
      setStatus(statusRes.data)
      setConstants(constantsRes.data)
      setLinks(linksRes.data)
      setPlaylists(playlistsRes.data)
      setPixivTopics(pixivRes.data)
      setLoading(false)
    })
  }, [])

  const handleTimeLog = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await logTime({
        activity_type: timeForm.activity_type,
        duration: parseInt(timeForm.duration),
        description: timeForm.description,
      })
      if (res.data.success) {
        setToast({ message: res.data.message || '記録しました！', type: 'success' })
        setTimeForm({ activity_type: '', duration: '', description: '' })
        getStatus().then((r) => setStatus(r.data))
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } }
      setToast({ message: error.response?.data?.error || 'エラーが発生しました', type: 'error' })
    }
  }

  const handleAcqLog = async (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData()
    formData.append('technique_type', acqForm.technique_type)
    formData.append('evaluation', acqForm.evaluation)
    formData.append('description', acqForm.description)
    if (acqImage) formData.append('image_proof', acqImage)

    try {
      const res = await logAcquisition(formData)
      if (res.data.success) {
        setToast({ message: res.data.message || '記録しました！', type: 'success' })
        setAcqForm({ technique_type: '', evaluation: 'C', description: '' })
        setAcqImage(null)
        getStatus().then((r) => setStatus(r.data))
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } }
      setToast({ message: error.response?.data?.error || 'エラーが発生しました', type: 'error' })
    }
  }

  const handlePostLog = async (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData()
    formData.append('description', postDescription)
    if (postImage) formData.append('post_work', postImage)

    try {
      const res = await logPost(formData)
      if (res.data.success) {
        setToast({ message: res.data.message || '投稿しました！', type: 'success' })
        setPostDescription('')
        setPostImage(null)
        getStatus().then((r) => setStatus(r.data))
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } }
      setToast({ message: error.response?.data?.error || 'エラーが発生しました', type: 'error' })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">ダッシュボード</h1>
          <p className="text-gray-600 mt-1 font-medium text-sm sm:text-base">今日も学習を楽しみましょう！</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 sm:px-4 py-2 rounded-xl shadow-lg">
          <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="font-semibold text-sm sm:text-base">{status?.total_xp.toLocaleString()} XP</span>
        </div>
      </div>

      {/* XP Progress */}
      {status && <XPProgressCard status={status} />}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm card-hover">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{status?.total_time_hours || 0}</p>
              <p className="text-xs text-gray-700 font-medium">学習時間</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm card-hover">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{status?.rank || 1}</p>
              <p className="text-xs text-gray-700 font-medium">現在ランク</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm card-hover">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{playlists.length}</p>
              <p className="text-xs text-gray-700 font-medium">プレイリスト</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm card-hover">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <Link2 className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{links.length}</p>
              <p className="text-xs text-gray-700 font-medium">リソース</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Forms Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Time Learning Form */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-800">時間学習を記録</h2>
            </div>
            <form onSubmit={handleTimeLog} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <select
                  value={timeForm.activity_type}
                  onChange={(e) => setTimeForm({ ...timeForm, activity_type: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                >
                  <option value="">活動タイプを選択</option>
                  {constants &&
                    Object.entries(constants.xp_rates).map(([type, rate]) => (
                      <option key={type} value={type}>
                        {type} ({rate} XP/分)
                      </option>
                    ))}
                </select>
                <input
                  type="number"
                  value={timeForm.duration}
                  onChange={(e) => setTimeForm({ ...timeForm, duration: e.target.value })}
                  placeholder="学習時間（分）"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                  min="1"
                />
              </div>
              <input
                type="text"
                value={timeForm.description}
                onChange={(e) => setTimeForm({ ...timeForm, description: e.target.value })}
                placeholder="メモ（任意）"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-blue-200 transition-all"
              >
                記録する
              </button>
            </form>
          </div>

          {/* Acquisition Form */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <Palette className="w-5 h-5 text-purple-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-800">科目習得を記録</h2>
            </div>
            <form onSubmit={handleAcqLog} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <select
                  value={acqForm.technique_type}
                  onChange={(e) => setAcqForm({ ...acqForm, technique_type: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                >
                  <option value="">技法タイプを選択</option>
                  {constants &&
                    Object.keys(constants.acq_types).map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                </select>
                <select
                  value={acqForm.evaluation}
                  onChange={(e) => setAcqForm({ ...acqForm, evaluation: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {constants &&
                    Object.keys(constants.evaluations).map((eval_) => (
                      <option key={eval_} value={eval_}>
                        評価 {eval_}
                      </option>
                    ))}
                </select>
              </div>
              <input
                type="text"
                value={acqForm.description}
                onChange={(e) => setAcqForm({ ...acqForm, description: e.target.value })}
                placeholder="作品名・説明"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-primary-400 transition-colors">
                <Upload className="w-5 h-5 text-gray-400" />
                <span className="text-gray-500">
                  {acqImage ? acqImage.name : '画像をアップロード（任意）'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setAcqImage(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-purple-200 transition-all"
              >
                記録する
              </button>
            </form>
          </div>

          {/* Post Work Form */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-pink-100 rounded-xl flex items-center justify-center">
                <Upload className="w-5 h-5 text-pink-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-800">作品を投稿</h2>
            </div>
            <form onSubmit={handlePostLog} className="space-y-4">
              <input
                type="text"
                value={postDescription}
                onChange={(e) => setPostDescription(e.target.value)}
                placeholder="作品の説明"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-primary-400 transition-colors">
                <Upload className="w-5 h-5 text-gray-400" />
                <span className="text-gray-500">
                  {postImage ? postImage.name : '作品画像をアップロード'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPostImage(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-pink-500 to-pink-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-pink-200 transition-all"
              >
                投稿する
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Pixiv Topics */}
          {pixivTopics.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">🎨 Pixivお題</h2>
              <div className="space-y-3">
                {pixivTopics.map((topic, idx) => (
                  <a
                    key={idx}
                    href={topic.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 transition-colors"
                  >
                    <p className="font-medium text-gray-800 text-sm truncate">{topic.title}</p>
                    <div className="flex items-center gap-1 mt-1 text-xs text-primary-600">
                      <ExternalLink className="w-3 h-3" />
                      <span>Pixivで見る</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* YouTube Playlists */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">📺 YouTube学習</h2>
              <Youtube className="w-5 h-5 text-red-500" />
            </div>
            {playlists.length > 0 ? (
              <div className="space-y-3">
                {playlists.slice(0, 5).map((playlist) => (
                  <Link
                    key={playlist.id}
                    to={`/youtube/${playlist.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Play className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">{playlist.title}</p>
                      <p className="text-xs text-gray-500">
                        {playlist.completed_videos || 0}/{playlist.total_videos || 0} 完了
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">プレイリストがありません</p>
            )}
          </div>

          {/* Resource Links */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">🔗 リソース</h2>
              <Link2 className="w-5 h-5 text-gray-400" />
            </div>
            {links.length > 0 ? (
              <div className="space-y-2">
                {links.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 text-primary-500 flex-shrink-0" />
                    <span className="text-sm text-gray-700 truncate">{link.name}</span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">リンクがありません</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
