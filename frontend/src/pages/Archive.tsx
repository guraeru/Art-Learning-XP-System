import { useState, useEffect } from 'react'
import { Archive as ArchiveIcon, Calendar, Clock, Palette, Award, ChevronDown } from 'lucide-react'
import { getArchive } from '../services/api'
import type { Record, ArchiveData } from '../types'

export default function Archive() {
  const [archiveData, setArchiveData] = useState<ArchiveData | null>(null)
  const [selectedYear, setSelectedYear] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getArchive().then((res) => {
      setArchiveData(res.data)
      if (res.data.sorted_years.length > 0) {
        setSelectedYear(res.data.sorted_years[0])
      }
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

  const getTypeIcon = (type: string) => {
    switch (type) {
      case '時間学習':
        return <Clock className="w-4 h-4" />
      case '科目習得':
        return <Palette className="w-4 h-4" />
      case '作品投稿':
        return <Award className="w-4 h-4" />
      default:
        return <Calendar className="w-4 h-4" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case '時間学習':
        return 'bg-blue-100 text-blue-700'
      case '科目習得':
        return 'bg-purple-100 text-purple-700'
      case '作品投稿':
        return 'bg-pink-100 text-pink-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const currentRecords: Record[] = selectedYear && archiveData
    ? archiveData.archive_data[selectedYear] || []
    : []

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <ArchiveIcon className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">アーカイブ</h1>
            <p className="text-gray-500 text-sm sm:text-base">過去の学習記録を振り返る</p>
          </div>
        </div>

        {/* Year Selector */}
        {archiveData && archiveData.sorted_years.length > 0 && (
          <div className="relative">
            <select
              value={selectedYear || ''}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="appearance-none bg-white border border-gray-200 rounded-xl px-4 py-2 pr-10 focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm sm:text-base"
            >
              {archiveData.sorted_years.map((year) => (
                <option key={year} value={year}>
                  {year}年
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {currentRecords.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm">
            <p className="text-gray-500 text-xs sm:text-sm">総記録数</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-800">{currentRecords.length}</p>
          </div>
          <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm">
            <p className="text-gray-500 text-xs sm:text-sm">獲得XP</p>
            <p className="text-xl sm:text-2xl font-bold text-primary-600">
              {currentRecords.reduce((sum, r) => sum + r.xp_gained, 0).toLocaleString()}
            </p>
          </div>
          <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm">
            <p className="text-gray-500 text-xs sm:text-sm">時間学習</p>
            <p className="text-xl sm:text-2xl font-bold text-blue-600">
              {currentRecords.filter((r) => r.type === '時間学習').length}
            </p>
          </div>
          <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm">
            <p className="text-gray-500 text-xs sm:text-sm">作品</p>
            <p className="text-xl sm:text-2xl font-bold text-purple-600">
              {currentRecords.filter((r) => r.type !== '時間学習').length}
            </p>
          </div>
        </div>
      )}

      {/* Records List */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {currentRecords.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {currentRecords.map((record) => (
              <div
                key={record.id}
                className="p-4 hover:bg-gray-50 transition-colors flex items-center gap-4"
              >
                {/* Thumbnail */}
                {record.image_path ? (
                  <img
                    src={`/${record.image_path}`}
                    alt=""
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <div
                    className={`w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0 ${getTypeColor(
                      record.type
                    )}`}
                  >
                    {getTypeIcon(record.type)}
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getTypeColor(
                        record.type
                      )}`}
                    >
                      {getTypeIcon(record.type)}
                      {record.type}
                    </span>
                    {record.evaluation && (
                      <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full font-medium">
                        評価 {record.evaluation}
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-gray-800 truncate">
                    {record.description || record.subtype}
                  </p>
                  <p className="text-sm text-gray-500">
                    {record.date
                      ? new Date(record.date).toLocaleDateString('ja-JP', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '日付不明'}
                    {record.duration_minutes && ` • ${record.duration_minutes}分`}
                  </p>
                </div>

                {/* XP */}
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold text-primary-600">
                    +{record.xp_gained.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">XP</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <ArchiveIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">この年の記録はありません</p>
          </div>
        )}
      </div>
    </div>
  )
}
