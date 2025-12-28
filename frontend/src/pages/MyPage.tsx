import { useState, useEffect } from 'react'
import { User, Image, ExternalLink, Award } from 'lucide-react'
import { getStatus, getWorks, getPixivTopics } from '../services/api'
import type { UserStatus, Record, PixivTopic } from '../types'
import XPProgressCard from '../components/XPProgressCard'

export default function MyPage() {
  const [status, setStatus] = useState<UserStatus | null>(null)
  const [works, setWorks] = useState<Record[]>([])
  const [pixivTopics, setPixivTopics] = useState<PixivTopic[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getStatus(),
      getWorks(),
      getPixivTopics().catch(() => ({ data: [] })),
    ]).then(([statusRes, worksRes, pixivRes]) => {
      setStatus(statusRes.data)
      setWorks(worksRes.data)
      setPixivTopics(pixivRes.data)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const evaluationColors: { [key: string]: string } = {
    A: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    B: 'bg-blue-100 text-blue-700 border-blue-300',
    C: 'bg-green-100 text-green-700 border-green-300',
    D: 'bg-orange-100 text-orange-700 border-orange-300',
    E: 'bg-gray-100 text-gray-700 border-gray-300',
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">マイページ</h1>
          <p className="text-gray-500 text-sm sm:text-base">あなたの成長を確認しましょう</p>
        </div>
      </div>

      {/* XP Progress */}
      {status && <XPProgressCard status={status} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Works Gallery */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <Image className="w-6 h-6 text-primary-500" />
              <h2 className="text-xl font-semibold text-gray-800">作品ギャラリー</h2>
              <span className="bg-primary-100 text-primary-700 text-sm px-3 py-1 rounded-full">
                {works.length}作品
              </span>
            </div>

            {works.length > 0 ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {works.map((work) => (
                  <div
                    key={work.id}
                    className="group relative bg-gray-50 rounded-xl overflow-hidden card-hover"
                  >
                    {work.image_path ? (
                      <img
                        src={`/${work.image_path}`}
                        alt={work.description || work.subtype}
                        className="w-full h-48 object-cover"
                      />
                    ) : (
                      <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                        <Image className="w-12 h-12 text-gray-300" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 transform translate-y-full group-hover:translate-y-0 transition-transform">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium truncate">
                            {work.description || work.subtype}
                          </p>
                          <p className="text-white/70 text-sm">{work.type}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {work.evaluation && (
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded border ${
                                evaluationColors[work.evaluation]
                              }`}
                            >
                              {work.evaluation}
                            </span>
                          )}
                          <span className="bg-primary-500 text-white text-xs px-2 py-1 rounded">
                            +{work.xp_gained.toLocaleString()} XP
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">
                          {work.date
                            ? new Date(work.date).toLocaleDateString('ja-JP')
                            : '日付不明'}
                        </span>
                        <div className="flex items-center gap-1 text-primary-600">
                          <Award className="w-4 h-4" />
                          <span className="text-sm font-medium">
                            +{work.xp_gained.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Image className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">まだ作品がありません</p>
                <p className="text-gray-400 text-sm mt-1">
                  ダッシュボードから作品を投稿しましょう
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Pixiv Topics */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">🎨 Pixivお題</h2>
            {pixivTopics.length > 0 ? (
              <div className="space-y-4">
                {pixivTopics.map((topic, idx) => (
                  <a
                    key={idx}
                    href={topic.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                      {topic.image && !topic.image.includes('placeholder') && (
                        <img
                          src={`/static/${topic.image}`}
                          alt={topic.title}
                          className="w-full h-32 object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      )}
                      <div className="p-4">
                        <p className="font-medium text-gray-800 text-sm">{topic.title}</p>
                        <div className="flex items-center gap-1 mt-2 text-xs text-primary-600">
                          <ExternalLink className="w-3 h-3" />
                          <span>Pixivで見る</span>
                        </div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">お題情報を取得中...</p>
            )}
          </div>

          {/* Quick Stats */}
          {status && (
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">📊 統計</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium">総作品数</span>
                  <span className="font-semibold text-gray-800">{works.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium">評価A作品</span>
                  <span className="font-semibold text-yellow-600">
                    {works.filter((w) => w.evaluation === 'A').length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium">総獲得XP</span>
                  <span className="font-semibold text-primary-600">
                    {works.reduce((sum, w) => sum + w.xp_gained, 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
