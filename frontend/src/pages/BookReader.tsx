import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, BookOpen, Grid3x3 } from 'lucide-react'
import type { Book } from '../types'

type ViewMode = 'select' | 'single' | 'all'

export default function BookReader() {
  const { bookId } = useParams<{ bookId: string }>()
  const navigate = useNavigate()
  
  const [book, setBook] = useState<Book | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('select')
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [pageImage, setPageImage] = useState<string | null>(null)
  const [allPages, setAllPages] = useState<{ page_num: number; data: string }[]>([])
  const [loadingPages, setLoadingPages] = useState(false)
  const [loadedPageCount, setLoadedPageCount] = useState(0)

  // Ref to track if the component is still mounted and fetches should continue
  const isCancelledRef = useRef(false)

  // Fetch book info
  useEffect(() => {
    const fetchBook = async () => {
      try {
        const res = await fetch(`/api/books/${bookId}`)
        if (!res.ok) throw new Error('Book not found')
        
        const bookData = await res.json()
        setBook(bookData)
        
        // Fetch page info
        const pagesRes = await fetch(`/api/books/${bookId}/pages`)
        const pagesData = await pagesRes.json()
        setTotalPages(pagesData.total_pages)
        setLoading(false)
      } catch (error) {
        console.error('Failed to fetch book:', error)
        navigate('/resources')
      }
    }

    fetchBook()
  }, [bookId, navigate])

  // Fetch single page
  useEffect(() => {
    if (viewMode === 'single' && totalPages > 0) {
      const fetchPage = async () => {
        try {
          const url = `/api/books/${bookId}/page/${currentPage}?zoom=2`
          console.log(`Fetching single page: ${url}`)
          const res = await fetch(url)
          
          if (!res.ok) {
            console.error(`Failed to fetch page: ${res.status} ${res.statusText}`)
            return
          }
          
          const blob = await res.blob()
          console.log(`Page blob size: ${blob.size} bytes`)
          
          if (blob.size === 0) {
            console.error(`Page returned empty blob`)
            return
          }
          
          const url_obj = URL.createObjectURL(blob)
          setPageImage(url_obj)
        } catch (error) {
          console.error('Failed to fetch page:', error)
        }
      }

      fetchPage()
    }
  }, [bookId, currentPage, viewMode, totalPages])

  // Fetch all pages with lazy loading
  useEffect(() => {
    if (viewMode === 'all' && totalPages > 0) {
      // Reset cancel flag when starting new fetch
      isCancelledRef.current = false
      setLoadingPages(true)
      const pagesPerRequest = 5
      const pageMap: Map<number, { page_num: number; data: string }> = new Map()
      let loadedPages = 0
      const abortController = new AbortController()

      const fetchPagesInBatch = async (startPage: number): Promise<void> => {
        // Check if cancelled before sending request
        if (isCancelledRef.current) {
          console.log('Fetch cancelled before request')
          return
        }

        try {
          const res = await fetch(
            `/api/books/${bookId}/pages/batch?start=${startPage}&count=${pagesPerRequest}&zoom=2`,
            { signal: abortController.signal }
          )

          // Check if cancelled after receiving response
          if (isCancelledRef.current) {
            console.log('Fetch cancelled after response')
            return
          }

          if (!res.ok) {
            console.error(`Failed to fetch batch starting at ${startPage}: ${res.status}`)
            return
          }

          const data = await res.json()

          // Check if cancelled before processing data
          if (isCancelledRef.current) {
            console.log('Fetch cancelled before processing')
            return
          }

          const newPages: { page_num: number; data: string }[] = []

          data.pages.forEach((page: { page_num: number; data: string }) => {
            pageMap.set(page.page_num, page)
            newPages.push(page)
            loadedPages++
            setLoadedPageCount(loadedPages)
          })

          // Convert map to sorted array
          const sortedPages = Array.from(pageMap.values()).sort((a, b) => a.page_num - b.page_num)
          setAllPages(sortedPages)
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            console.log('Page fetching aborted')
          } else {
            console.error(`Error fetching batch at ${startPage}:`, error)
          }
        }
      }

      // Queue all batch fetches to execute sequentially (one at a time)
      // This ensures cancel is effective immediately
      let fetchPromise = Promise.resolve()
      for (let i = 0; i < totalPages; i += pagesPerRequest) {
        fetchPromise = fetchPromise.then(() => {
          if (!isCancelledRef.current) {
            return fetchPagesInBatch(i)
          }
        })
      }

      fetchPromise.finally(() => {
        setLoadingPages(false)
      })

      // Cleanup function - cancel immediately with highest priority
      return () => {
        isCancelledRef.current = true
        abortController.abort()
      }
    }
  }, [viewMode, bookId, totalPages])

  const handleDownload = async () => {
    try {
      const res = await fetch(`/uploads/${book?.pdf_file_path}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${book?.title}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download:', error)
    }
  }

  const goNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1)
    }
  }

  const goPrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const page = parseInt(e.target.value) - 1
    if (page >= 0 && page < totalPages) {
      setCurrentPage(page)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!book) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">書籍が見つかりません</p>
      </div>
    )
  }

  // Select View Mode
  if (viewMode === 'select') {
    return (
      <div className="space-y-8">
        <button
          onClick={() => navigate('/resources')}
          className="flex items-center gap-2 text-primary-500 hover:text-primary-600 font-medium"
        >
          <ChevronLeft className="w-5 h-5" />
          本棚に戻る
        </button>

        <div className="bg-white rounded-2xl p-8 shadow-sm">
          <div className="flex gap-8 mb-8">
            {/* Cover */}
            <div className="w-40 flex-shrink-0">
              {book.cover_image_path ? (
                <img
                  src={`/uploads/${book.cover_image_path}`}
                  alt={book.title}
                  className="w-full rounded-lg shadow-lg"
                />
              ) : (
                <div className="w-full aspect-[3/4] bg-gray-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-12 h-12 text-gray-300" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{book.title}</h1>
              {book.author && (
                <p className="text-lg text-gray-800 mb-4 font-medium">著者: {book.author}</p>
              )}
              {book.description && (
                <p className="text-gray-700 mb-8 leading-relaxed">{book.description}</p>
              )}
              <p className="text-sm text-gray-600 mb-8">全 {totalPages} ページ</p>

              <div className="space-y-3">
                <h2 className="text-xl font-bold text-gray-800 mb-4">閲覧方法を選択</h2>
                
                <button
                  onClick={() => setViewMode('single')}
                  className="w-full p-4 border-2 border-primary-500 bg-primary-50 hover:bg-primary-100 rounded-xl transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <ChevronRight className="w-6 h-6 text-primary-500" />
                    <div>
                      <p className="font-semibold text-gray-900">1ページずつ読む</p>
                      <p className="text-sm text-gray-600">ページ送りで読み進める</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setViewMode('all')}
                  className="w-full p-4 border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 rounded-xl transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <Grid3x3 className="w-6 h-6 text-gray-600" />
                    <div>
                      <p className="font-semibold text-gray-900">すべて表示</p>
                      <p className="text-sm text-gray-600">全ページをスクロールで閲覧</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={handleDownload}
                  className="w-full p-4 border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 rounded-xl transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <Download className="w-6 h-6 text-gray-600" />
                    <div>
                      <p className="font-semibold text-gray-900">ダウンロード</p>
                      <p className="text-sm text-gray-600">PDFファイルをダウンロード</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Single Page View - Spread (2 pages side by side)
  if (viewMode === 'single') {
    return (
      <div className="flex flex-col h-screen bg-black">
        {/* Header */}
        <div className="flex items-center justify-between bg-gray-900 p-4 border-b border-gray-700">
          <button
            onClick={() => setViewMode('select')}
            className="flex items-center gap-2 text-white hover:text-gray-300 font-medium"
          >
            <ChevronLeft className="w-5 h-5" />
            戻る
          </button>

          <div className="text-center">
            <h2 className="text-lg font-bold text-white">{book.title}</h2>
            <p className="text-sm text-gray-400">
              ページ <input
                type="number"
                min="1"
                max={totalPages}
                value={currentPage + 1}
                onChange={handlePageInput}
                className="w-12 px-2 py-1 border border-gray-600 rounded bg-gray-800 text-white text-center"
              /> / {totalPages}
            </p>
          </div>

          <div className="w-20" />
        </div>

        {/* Main Content - Full Page */}
        <div className="flex-1 flex items-center justify-center overflow-hidden bg-black p-0 cursor-pointer" onClick={goNextPage}>
          {pageImage ? (
            <img
              src={pageImage}
              alt={`Page ${currentPage + 1}`}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full" />
          )}
        </div>

        {/* Navigation Footer */}
        <div className="flex items-center justify-between bg-gray-900 p-4 border-t border-gray-700">
          <button
            onClick={goPrevPage}
            disabled={currentPage === 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            前
          </button>

          <div className="flex gap-1">
            {Array.from({ length: Math.min(10, totalPages) }, (_, i) => {
              const pageNum = Math.max(0, Math.min(currentPage - 4, totalPages - 10)) + i
              if (pageNum >= totalPages) return null
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                    pageNum === currentPage
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {pageNum + 1}
                </button>
              )
            })}
          </div>

          <button
            onClick={goNextPage}
            disabled={currentPage === totalPages - 1}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            次
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    )
  }

  // All Pages View
  if (viewMode === 'all') {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between bg-white rounded-xl p-4 shadow-sm">
          <button
            onClick={() => setViewMode('select')}
            className="flex items-center gap-2 text-primary-500 hover:text-primary-600 font-medium"
          >
            <ChevronLeft className="w-5 h-5" />
            戻る
          </button>

          <h2 className="text-lg font-bold text-gray-900">{book.title}</h2>

          <div className="w-20" />
        </div>

        {/* Pages List - Single Column with scrolling */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col items-center py-4 px-4">
            {allPages.length > 0 ? (
              allPages.map((pageData, idx) => (
                <div key={idx} className="bg-white rounded-lg shadow overflow-hidden max-w-4xl w-full mb-4">
                  <img
                    src={pageData.data}
                    alt={`Page ${idx + 1}`}
                    className="w-full h-auto block"
                  />
                  <p className="text-center py-2 text-xs text-gray-500">ページ {idx + 1}</p>
                </div>
              ))
            ) : loadingPages ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full" />
                <p className="text-gray-600">読み込み中... {loadedPageCount} / {totalPages}</p>
              </div>
            ) : (
              <div className="text-center py-20">
                <p className="text-gray-500">ページを読み込めませんでした</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}
