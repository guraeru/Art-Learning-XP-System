import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  X,
  Minimize2,
  Maximize2,
  GripHorizontal,
  Flame,
  Coffee,
} from 'lucide-react'
import { usePomodoroContext } from '../contexts/PomodoroContext'

const STORAGE_KEY = 'pomodoro_mini_position'

interface Position {
  x: number
  y: number
}

interface DragState {
  startX: number
  startY: number
  initialX: number
  initialY: number
  lastX: number
  lastY: number
}

// Utility: Calculate nearest corner position
// Always snaps to the closest corner regardless of distance
const getSnappedPosition = (x: number, y: number, width: number, height: number): Position => {
  const snapPoints = [
    // Top-left
    { x: 8, y: 60 },
    // Top-right
    { x: window.innerWidth - width - 8, y: 60 },
    // Bottom-left
    { x: 8, y: window.innerHeight - height - 8 },
    // Bottom-right
    { x: window.innerWidth - width - 8, y: window.innerHeight - height - 8 },
  ]
  
  let closest = { point: snapPoints[0], distance: Infinity }
  
  for (const point of snapPoints) {
    const distance = Math.hypot(x - point.x, y - point.y)
    if (distance < closest.distance) {
      closest = { point, distance }
    }
  }
  
  // Always snap to the nearest corner
  return closest.point
}

function PomodoroMiniWindow() {
  const {
    mode,
    timeLeft,
    isRunning,
    showMiniWindow,
    setShowMiniWindow,
    toggleTimer,
    resetTimer,
    formatTime,
    getModeColor,
    progressPercent,
    completedSessions,
    todaySessions,
  } = usePomodoroContext()

  const location = useLocation()
  const navigate = useNavigate()
  const [isMinimized, setIsMinimized] = useState(true)
  const [position, setPosition] = useState<Position>({ x: 20, y: 100 })
  const [isDragging, setIsDragging] = useState(false)
  const [isSnapping, setIsSnapping] = useState(false)
  const dragRef = useRef<DragState | null>(null)
  const windowRef = useRef<HTMLDivElement>(null)
  const throttleRef = useRef<number | null>(null)

  // === Load Position from Storage ===
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          setPosition(parsed)
        }
      } catch {
        console.debug('Invalid saved position')
      }
    }
  }, [])

  // === Persist Position to Storage ===
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(position))
  }, [position])

  // === Drag Handlers - ALL hooks MUST be before conditional returns ===
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Skip if clicking on interactive element
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return

    const element = e.currentTarget as HTMLElement
    if (element instanceof HTMLElement && 'setPointerCapture' in element) {
      try {
        (element as any).setPointerCapture((e as any).pointerId)
      } catch {}
    }

    setIsDragging(true)
    setIsSnapping(false)
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
      lastX: position.x,
      lastY: position.y,
    }
  }, [position])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragRef.current) return

    const deltaX = e.clientX - dragRef.current.startX
    const deltaY = e.clientY - dragRef.current.startY

    const el = windowRef.current
    const elW = el?.offsetWidth ?? 200
    const elH = el?.offsetHeight ?? 100

    const newX = Math.max(0, Math.min(window.innerWidth - elW, dragRef.current.initialX + deltaX))
    const newY = Math.max(60, Math.min(window.innerHeight - elH, dragRef.current.initialY + deltaY))

    dragRef.current.lastX = newX
    dragRef.current.lastY = newY

    setPosition({ x: newX, y: newY })
  }, [isDragging])

  const handleMouseUp = useCallback((e: MouseEvent) => {
    const element = windowRef.current
    if (element instanceof HTMLElement && 'releasePointerCapture' in element) {
      try {
        (element as any).releasePointerCapture((e as any).pointerId)
      } catch {}
    }

    setIsDragging(false)
    
    if (throttleRef.current !== null) {
      cancelAnimationFrame(throttleRef.current)
      throttleRef.current = null
    }

    // Apply snap-to-corner on drag end using the last tracked position
    const el = windowRef.current
    if (el && dragRef.current) {
      const elW = el.offsetWidth
      const elH = el.offsetHeight
      // Use the last position from dragRef to ensure accurate snap
      const snappedPos = getSnappedPosition(dragRef.current.lastX, dragRef.current.lastY, elW, elH)
      
      if (snappedPos.x !== dragRef.current.lastX || snappedPos.y !== dragRef.current.lastY) {
        setIsSnapping(true)
        setPosition(snappedPos)
        
        // Remove snapping class after animation completes (700ms)
        setTimeout(() => setIsSnapping(false), 700)
      }
    }
    
    dragRef.current = null
  }, [])

  // === Add/Remove Global Listeners ===
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      if (throttleRef.current !== null) {
        cancelAnimationFrame(throttleRef.current)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // === Ensure the window stays inside viewport on resize / mount ===
  useEffect(() => {
    const handleResize = () => {
      const el = windowRef.current
      if (!el) return

      const w = el.offsetWidth
      const h = el.offsetHeight

      setPosition(prev => {
        // スナップ位置を計算
        const snappedPos = getSnappedPosition(prev.x, prev.y, w, h)
        return snappedPos
      })
      
      // リサイズ時はスナッピングアニメーションを表示
      setIsSnapping(true)
      setTimeout(() => setIsSnapping(false), 700)
    }

    // リサイズイベントに登録
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // === Mode UI Helpers - using useMemo for computed values ===
  const modeIcon = useMemo(() => {
    switch (mode) {
      case 'work':
        return <Flame className="w-4 h-4" />
      case 'shortBreak':
      case 'longBreak':
        return <Coffee className="w-4 h-4" />
    }
  }, [mode])

  const modeLabel = useMemo(() => {
    switch (mode) {
      case 'work':
        return '作業中'
      case 'shortBreak':
        return '短休憩'
      case 'longBreak':
        return '長休憩'
    }
  }, [mode])

  const modeBgClass = useMemo(() => {
    switch (mode) {
      case 'work':
        return 'bg-gradient-to-br from-red-500 to-orange-500'
      case 'shortBreak':
        return 'bg-gradient-to-br from-green-500 to-teal-500'
      case 'longBreak':
        return 'bg-gradient-to-br from-blue-500 to-purple-500'
    }
  }, [mode])

  const handleNavigateToPomodoro = useCallback(() => {
    navigate('/pomodoro')
  }, [navigate])

  // === Check if on Pomodoro Page - AFTER all hooks ===
  const isOnPomodoroPage = location.pathname === '/pomodoro'
  if (isOnPomodoroPage || !showMiniWindow) {
    return null
  }

  // === Minimized View (Compact Pill) ===
  if (isMinimized) {
    return (
      <div
        ref={windowRef}
        style={{ 
          left: position.x, 
          top: position.y,
          transition: isSnapping ? 'all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none'
        }}
        className={`fixed z-[100] ${modeBgClass} text-white rounded-full shadow-2xl cursor-move select-none will-change-transform`}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2 px-4 py-2">
          <div className="flex items-center gap-2">
            {modeIcon}
            <span className="font-mono font-bold text-lg">{formatTime(timeLeft)}</span>
          </div>
          <div className="flex items-center gap-1" data-no-drag>
            <button
              onClick={toggleTimer}
              className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
              title={isRunning ? '停止' : '開始'}
            >
              {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setIsMinimized(false)}
              className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
              title="展開"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // === Expanded View ===
  return (
    <div
      ref={windowRef}
      style={{ 
        left: position.x, 
        top: position.y,
        transition: isSnapping ? 'all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none'
      }}
      className="fixed z-[100] bg-white rounded-2xl shadow-2xl overflow-hidden select-none border border-gray-200 will-change-transform"
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className={`${modeBgClass} text-white px-4 py-2 flex items-center justify-between cursor-move`}>
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-4 h-4 opacity-60" />
          <Timer className="w-4 h-4" />
          <span className="font-semibold text-sm">ポモドーロ</span>
        </div>
        <div className="flex items-center gap-1" data-no-drag>
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 rounded hover:bg-white/20 transition-colors"
            title="最小化"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowMiniWindow(false)}
            className="p-1 rounded hover:bg-white/20 transition-colors"
            title="閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 w-64">
        {/* Mode Indicator */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
              mode === 'work'
                ? 'bg-red-100 text-red-700'
                : mode === 'shortBreak'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-blue-100 text-blue-700'
            }`}
          >
            {modeIcon}
            <span>{modeLabel}</span>
          </span>
        </div>

        {/* Timer Display */}
        <div className="relative w-32 h-32 mx-auto mb-4">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="58"
              stroke="currentColor"
              strokeWidth="6"
              fill="none"
              className="text-gray-100"
            />
            <circle
              cx="64"
              cy="64"
              r="58"
              stroke="url(#mini-gradient)"
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 58}
              strokeDashoffset={2 * Math.PI * 58 * (1 - progressPercent() / 100)}
              className="transition-all duration-1000"
            />
            <defs>
              <linearGradient id="mini-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop
                  offset="0%"
                  stopColor={mode === 'work' ? '#ef4444' : mode === 'shortBreak' ? '#22c55e' : '#3b82f6'}
                />
                <stop
                  offset="100%"
                  stopColor={mode === 'work' ? '#f97316' : mode === 'shortBreak' ? '#14b8a6' : '#8b5cf6'}
                />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-gray-800 font-mono">{formatTime(timeLeft)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-2 mb-4" data-no-drag>
          <button
            onClick={resetTimer}
            className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors text-gray-600"
            title="リセット"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <button
            onClick={toggleTimer}
            className={`px-6 py-2 rounded-xl bg-gradient-to-r ${getModeColor()} text-white shadow-lg hover:shadow-xl transition-all flex items-center gap-2 font-semibold`}
            title={isRunning ? '停止' : '開始'}
          >
            {isRunning ? (
              <>
                <Pause className="w-5 h-5" />
                <span>停止</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                <span>開始</span>
              </>
            )}
          </button>
        </div>

        {/* Stats */}
        <div className="flex justify-between text-xs text-gray-500 mb-3">
          <span>連続: {completedSessions}回</span>
          <span>今日: {todaySessions}回</span>
        </div>

        {/* Go to Full Page Button */}
        <button
          onClick={handleNavigateToPomodoro}
          data-no-drag
          className="w-full py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors font-medium"
        >
          フルページで開く →
        </button>
      </div>
    </div>
  )
}

export default memo(PomodoroMiniWindow)