import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, BookOpen, Grid3x3 } from 'lucide-react'
import type { Book } from '../types'

type ViewMode = 'select' | 'single' | 'all'

// Priority-based page loader (Industry best practice - similar to Google Books/Kindle)
class PageLoadManager {
  private queue: Map<number, { priority: number; resolve: (data: string) => void; reject: (e: Error) => void }> = new Map()
  private loading: Set<number> = new Set()
  private loaded: Map<number, string> = new Map()
  private maxConcurrent = 6  // Browser limit per domain
  private abortController: AbortController
  private bookId: string
  private onPageLoaded: (pageNum: number, data: string) => void
  private onProgress: (loaded: number) => void

  constructor(
    bookId: string,
    onPageLoaded: (pageNum: number, data: string) => void,
    onProgress: (loaded: number) => void
  ) {
    this.bookId = bookId
    this.onPageLoaded = onPageLoaded
    this.onProgress = onProgress
    this.abortController = new AbortController()
  }

  // Update priorities based on viewport (called on scroll)
  updatePriorities(visibleStart: number, visibleEnd: number, scrollDirection: 'down' | 'up') {
    this.queue.forEach((item, pageNum) => {
      // Visible pages get highest priority
      if (pageNum >= visibleStart && pageNum <= visibleEnd) {
        item.priority = 0
      }
      // Pages in scroll direction get next priority
      else if (scrollDirection === 'down' && pageNum > visibleEnd && pageNum <= visibleEnd + 5) {
        item.priority = 1
      }
      else if (scrollDirection === 'up' && pageNum < visibleStart && pageNum >= visibleStart - 5) {
        item.priority = 1
      }
      // Nearby pages
      else if (Math.abs(pageNum - visibleStart) <= 10 || Math.abs(pageNum - visibleEnd) <= 10) {
        item.priority = 2
      }
      // Far pages
      else {
        item.priority = 3
      }
    })
    
    this.processQueue()
  }

  // Request a page (returns immediately if cached)
  requestPage(pageNum: number, priority: number = 2): Promise<string> {
    // Already loaded
    if (this.loaded.has(pageNum)) {
      return Promise.resolve(this.loaded.get(pageNum)!)
    }

    // Already in queue
    if (this.queue.has(pageNum)) {
      const item = this.queue.get(pageNum)!
      item.priority = Math.min(item.priority, priority)  // Upgrade priority if needed
      this.processQueue()
      return new Promise((resolve) => {
        const existing = this.queue.get(pageNum)!
        const originalResolve = existing.resolve
        existing.resolve = (data: string) => {
          originalResolve(data)
          resolve(data)
        }
      })
    }

    // Add to queue
    return new Promise((resolve, reject) => {
      this.queue.set(pageNum, { priority, resolve, reject })
      this.processQueue()
    })
  }

  private async processQueue() {
    // Get available slots
    const availableSlots = this.maxConcurrent - this.loading.size
    if (availableSlots <= 0) return

    // Sort queue by priority and get top items
    const sorted = Array.from(this.queue.entries())
      .filter(([pageNum]) => !this.loading.has(pageNum))
      .sort((a, b) => a[1].priority - b[1].priority)
      .slice(0, availableSlots)

    for (const [pageNum, item] of sorted) {
      this.loading.add(pageNum)
      this.fetchPage(pageNum, item)
    }
  }

  private async fetchPage(pageNum: number, item: { resolve: (data: string) => void; reject: (e: Error) => void }) {
    try {
      const res = await fetch(
        `/api/books/${this.bookId}/page/${pageNum}?zoom=2`,
        { signal: this.abortController.signal }
      )

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const blob = await res.blob()
      const dataUrl = await this.blobToDataUrl(blob)

      this.loaded.set(pageNum, dataUrl)
      this.queue.delete(pageNum)
      this.loading.delete(pageNum)

      item.resolve(dataUrl)
      this.onPageLoaded(pageNum, dataUrl)
      this.onProgress(this.loaded.size)

      // Process next in queue
      this.processQueue()
    } catch (error) {
      this.loading.delete(pageNum)
      if (error instanceof Error && error.name !== 'AbortError') {
        // Retry with lower priority
        const existing = this.queue.get(pageNum)
        if (existing) {
          existing.priority = Math.min(existing.priority + 1, 5)
        }
        this.processQueue()
      }
    }
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  // Prefetch pages (low priority background loading)
  prefetchRange(start: number, end: number) {
    for (let i = start; i <= end; i++) {
      if (!this.loaded.has(i) && !this.queue.has(i)) {
        this.requestPage(i, 3)
      }
    }
  }

  isLoaded(pageNum: number): boolean {
    return this.loaded.has(pageNum)
  }

  getLoadedData(pageNum: number): string | undefined {
    return this.loaded.get(pageNum)
  }

  cancel() {
    this.abortController.abort()
    this.queue.clear()
    this.loading.clear()
  }

  getLoadedCount(): number {
    return this.loaded.size
  }
}

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
  const [loadedPageCount, setLoadedPageCount] = useState(0)

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

  // Page load manager ref
  const loadManagerRef = useRef<PageLoadManager | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const lastScrollTop = useRef(0)
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  // Initialize page loading for all-pages view
  useEffect(() => {
    if (viewMode === 'all' && totalPages > 0 && bookId) {
      setLoadedPageCount(0)
      setAllPages([])

      // Create page manager
      const manager = new PageLoadManager(
        bookId,
        (pageNum, data) => {
          // Update allPages when a page is loaded
          setAllPages(prev => {
            const newPages = [...prev]
            const existingIndex = newPages.findIndex(p => p.page_num === pageNum)
            if (existingIndex >= 0) {
              newPages[existingIndex] = { page_num: pageNum, data }
            } else {
              newPages.push({ page_num: pageNum, data })
              newPages.sort((a, b) => a.page_num - b.page_num)
            }
            return newPages
          })
        },
        (loaded) => {
          setLoadedPageCount(loaded)
        }
      )

      loadManagerRef.current = manager

      // Initial load: first 3 pages with highest priority, then prefetch next 10
      for (let i = 0; i < Math.min(3, totalPages); i++) {
        manager.requestPage(i, 0)
      }
      manager.prefetchRange(3, Math.min(15, totalPages - 1))
      
      // Background prefetch all remaining pages
      setTimeout(() => {
        manager.prefetchRange(16, totalPages - 1)
      }, 500)

      return () => {
        manager.cancel()
        loadManagerRef.current = null
      }
    }
  }, [viewMode, bookId, totalPages])

  // Scroll handler for dynamic priority adjustment
  const handleScroll = useCallback(() => {
    if (!loadManagerRef.current || !scrollContainerRef.current) return

    const container = scrollContainerRef.current
    const scrollTop = container.scrollTop
    const scrollDirection = scrollTop > lastScrollTop.current ? 'down' : 'up'
    lastScrollTop.current = scrollTop

    // Find visible pages
    const containerRect = container.getBoundingClientRect()
    let visibleStart = 0
    let visibleEnd = 0

    pageRefs.current.forEach((el, pageNum) => {
      const rect = el.getBoundingClientRect()
      const isVisible = rect.bottom > containerRect.top && rect.top < containerRect.bottom

      if (isVisible) {
        if (visibleStart === 0 || pageNum < visibleStart) visibleStart = pageNum
        if (pageNum > visibleEnd) visibleEnd = pageNum
      }
    })

    // Update priorities based on what's visible
    loadManagerRef.current.updatePriorities(visibleStart, visibleEnd, scrollDirection)

    // Prefetch ahead in scroll direction
    if (scrollDirection === 'down') {
      loadManagerRef.current.prefetchRange(visibleEnd + 1, Math.min(visibleEnd + 10, totalPages - 1))
    } else {
      loadManagerRef.current.prefetchRange(Math.max(0, visibleStart - 10), visibleStart - 1)
    }
  }, [totalPages])

  // Throttled scroll handler
  const throttledScrollHandler = useCallback(() => {
    let ticking = false
    return () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll()
          ticking = false
        })
        ticking = true
      }
    }
  }, [handleScroll])

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
      <div className="space-y-6 sm:space-y-8">
        <button
          onClick={() => navigate('/resources')}
          className="flex items-center gap-2 text-primary-500 hover:text-primary-600 font-medium"
        >
          <ChevronLeft className="w-5 h-5" />
          本棚に戻る
        </button>

        <div className="bg-white rounded-2xl p-4 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 mb-6 sm:mb-8">
            {/* Cover */}
            <div className="w-32 sm:w-40 flex-shrink-0 mx-auto sm:mx-0">
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
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 sm:mb-4">{book.title}</h1>
              {book.author && (
                <p className="text-base sm:text-lg text-gray-800 mb-2 sm:mb-4 font-medium">著者: {book.author}</p>
              )}
              {book.description && (
                <p className="text-gray-700 mb-4 sm:mb-8 leading-relaxed text-sm sm:text-base">{book.description}</p>
              )}
              <p className="text-sm text-gray-600 mb-4 sm:mb-8">全 {totalPages} ページ</p>

              <div className="space-y-3">
                <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">閲覧方法を選択</h2>
                
                <button
                  onClick={() => setViewMode('single')}
                  className="w-full p-3 sm:p-4 border-2 border-primary-500 bg-primary-50 hover:bg-primary-100 rounded-xl transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-primary-500 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-900 text-sm sm:text-base">1ページずつ読む</p>
                      <p className="text-xs sm:text-sm text-gray-600">ページ送りで読み進める</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setViewMode('all')}
                  className="w-full p-3 sm:p-4 border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 rounded-xl transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <Grid3x3 className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-900 text-sm sm:text-base">すべて表示</p>
                      <p className="text-xs sm:text-sm text-gray-600">全ページをスクロールで閲覧</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={handleDownload}
                  className="w-full p-3 sm:p-4 border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 rounded-xl transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <Download className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-900 text-sm sm:text-base">ダウンロード</p>
                      <p className="text-xs sm:text-sm text-gray-600">PDFファイルをダウンロード</p>
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
        <div className="flex items-center justify-between bg-gray-900 p-2 sm:p-4 border-b border-gray-700">
          <button
            onClick={() => setViewMode('select')}
            className="flex items-center gap-1 sm:gap-2 text-white hover:text-gray-300 font-medium text-sm sm:text-base"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            戻る
          </button>

          <div className="text-center flex-1 min-w-0 px-2">
            <h2 className="text-sm sm:text-lg font-bold text-white truncate">{book.title}</h2>
            <p className="text-xs sm:text-sm text-gray-400">
              ページ <input
                type="number"
                min="1"
                max={totalPages}
                value={currentPage + 1}
                onChange={handlePageInput}
                className="w-10 sm:w-12 px-1 sm:px-2 py-1 border border-gray-600 rounded bg-gray-800 text-white text-center text-xs sm:text-sm"
              /> / {totalPages}
            </p>
          </div>

          <div className="w-12 sm:w-20" />
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
        <div className="flex items-center justify-between bg-gray-900 p-2 sm:p-4 border-t border-gray-700 gap-2">
          <button
            onClick={goPrevPage}
            disabled={currentPage === 0}
            className="flex items-center gap-1 px-2 sm:px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex-shrink-0"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">前</span>
          </button>

          <div className="flex gap-1 overflow-x-auto flex-1 justify-center scrollbar-hide">
            {Array.from({ length: Math.min(10, totalPages) }, (_, i) => {
              const pageNum = Math.max(0, Math.min(currentPage - 4, totalPages - 10)) + i
              if (pageNum >= totalPages) return null
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded text-xs font-medium transition-colors flex-shrink-0 ${
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
            className="flex items-center gap-1 px-2 sm:px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex-shrink-0"
          >
            <span className="hidden sm:inline">次</span>
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
    )
  }

  // All Pages View - Priority-based loading with viewport awareness
  if (viewMode === 'all') {
    const scrollHandler = throttledScrollHandler()
    
    return (
      <div className="space-y-4 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between bg-white rounded-xl p-4 shadow-sm sticky top-0 z-10">
          <button
            onClick={() => setViewMode('select')}
            className="flex items-center gap-2 text-primary-500 hover:text-primary-600 font-medium"
          >
            <ChevronLeft className="w-5 h-5" />
            戻る
          </button>

          <h2 className="text-lg font-bold text-gray-900">{book.title}</h2>

          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary-500 transition-all duration-300"
                style={{ width: `${(loadedPageCount / totalPages) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 w-16 text-right">
              {loadedPageCount}/{totalPages}
            </span>
          </div>
        </div>

        {/* Pages List - All pages with placeholders */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto"
          onScroll={scrollHandler}
        >
          <div className="flex flex-col items-center py-4 px-4">
            {Array.from({ length: totalPages }, (_, idx) => {
              const pageData = allPages.find(p => p.page_num === idx)
              
              return (
                <div 
                  key={idx}
                  ref={(el) => {
                    if (el) pageRefs.current.set(idx, el)
                  }}
                  className="bg-white rounded-lg shadow overflow-hidden max-w-4xl w-full mb-4"
                >
                  {pageData ? (
                    <img
                      src={pageData.data}
                      alt={`Page ${idx + 1}`}
                      className="w-full h-auto block"
                    />
                  ) : (
                    <div 
                      className="w-full bg-gray-100 flex items-center justify-center"
                      style={{ aspectRatio: '0.707' }}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className="animate-pulse w-8 h-8 rounded-full bg-gray-300" />
                        <span className="text-sm text-gray-400">読み込み中...</span>
                      </div>
                    </div>
                  )}
                  <p className="text-center py-2 text-xs text-gray-500">
                    ページ {idx + 1} / {totalPages}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return null
}
