import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, FileText, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { getBooks } from '../services/api'
import type { Book } from '../types'

export default function Resources() {
  const navigate = useNavigate()
  const [books, setBooks] = useState<Book[]>([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 100,
    total: 0,
    total_pages: 0,
    has_next: false,
    has_prev: false,
  })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch books when page or search changes
  useEffect(() => {
    const fetchBooks = async () => {
      setLoading(true)
      try {
        const params = {
          page: pagination.page,
          limit: 100,
          ...(debouncedSearch && { search: debouncedSearch }),
        }
        const res = await getBooks(params)
        setBooks(res.data.data)
        setPagination(res.data.pagination)
      } catch (error) {
        console.error('Failed to fetch books:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBooks()
  }, [pagination.page, debouncedSearch])

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setPagination((prev) => ({ ...prev, page: 1 })) // Reset to page 1 on search
  }

  const clearSearch = () => {
    setSearchQuery('')
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const goToPage = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.total_pages) {
      setPagination((prev) => ({ ...prev, page: newPage }))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  if (loading && books.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">本棚</h1>
            <p className="text-gray-500">学習教材を管理</p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-4 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="書籍タイトルまたは著者で検索..."
            value={searchQuery}
            onChange={handleSearch}
            className="w-full pl-12 pr-10 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        {debouncedSearch && (
          <p className="mt-2 text-sm text-gray-500">
            「{debouncedSearch}」の検索結果: {pagination.total}件
          </p>
        )}
      </div>

      {/* Books Grid */}
      {books.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {books.map((book) => (
              <div
                key={book.id}
                className="bg-white rounded-lg shadow-sm overflow-hidden card-hover cursor-pointer group"
                onClick={() => navigate(`/book/${book.id}`)}
              >
                {/* Cover */}
                <div className="aspect-[3/4] bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
                  {book.cover_image_path ? (
                    <img
                      src={`/uploads/${book.cover_image_path}`}
                      alt={book.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-16 h-16 text-gray-300" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4">
                    <span className="bg-white text-gray-800 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      読む
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-2">
                  <h3 className="font-semibold text-gray-800 truncate text-sm">{book.title}</h3>
                  {book.author && (
                    <p className="text-xs text-gray-500 truncate">{book.author}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination.total_pages > 1 && (
            <div className="flex items-center justify-between bg-white rounded-xl p-4 shadow-sm">
              <div className="text-sm text-gray-600">
                ページ {pagination.page} / {pagination.total_pages} （全{pagination.total}件）
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => goToPage(pagination.page - 1)}
                  disabled={!pagination.has_prev}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  前へ
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.total_pages) }, (_, i) => {
                    const pageNum =
                      pagination.page <= 3
                        ? i + 1
                        : Math.max(1, pagination.page - 2) + i
                    if (pageNum > pagination.total_pages) return null
                    return (
                      <button
                        key={pageNum}
                        onClick={() => goToPage(pageNum)}
                        className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                          pageNum === pagination.page
                            ? 'bg-primary-500 text-white'
                            : 'border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>

                <button
                  onClick={() => goToPage(pagination.page + 1)}
                  disabled={!pagination.has_next}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  次へ
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-2xl p-16 text-center shadow-sm">
          <BookOpen className="w-20 h-20 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-2">
            {debouncedSearch ? '検索条件に一致する書籍がありません' : 'まだ書籍が登録されていません'}
          </p>
          <p className="text-gray-400 text-sm">管理ページから書籍を追加できます</p>
        </div>
      )}    </div>
  )
}
