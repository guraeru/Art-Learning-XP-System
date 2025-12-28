import { useState, useEffect } from 'react'
import {
  Settings,
  BookOpen,
  Link2,
  Youtube,
  User,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react'
import {
  getBooks,
  createBook,
  deleteBook,
  updateBook,
  getLinks,
  createLink,
  updateLink,
  deleteLink,
  getPlaylists,
  getPlaylist,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  resetPlaylistProgress,
  uploadPlaylistMaterial,
  deletePlaylistMaterial,
  getStatus,
  updateUsername,
  resetAllData,
} from '../services/api'
import type { Book, ResourceLink, YouTubePlaylist, PlaylistDetail, UserStatus } from '../types'
import Toast from '../components/Toast'
import Button from '../components/Button'

type Tab = 'books' | 'links' | 'youtube' | 'user'

export default function Admin() {
  const [activeTab, setActiveTab] = useState<Tab>('books')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Data
  const [books, setBooks] = useState<Book[]>([])
  const [links, setLinks] = useState<ResourceLink[]>([])
  const [playlists, setPlaylists] = useState<YouTubePlaylist[]>([])
  const [status, setStatus] = useState<UserStatus | null>(null)

  // Form states
  const [bookForm, setBookForm] = useState({ title: '', author: '', description: '' })
  const [bookPdf, setBookPdf] = useState<File | null>(null)
  const [bookCover, setBookCover] = useState<File | null>(null)
  const [editingBook, setEditingBook] = useState<Book | null>(null)

  const [linkForm, setLinkForm] = useState({ name: '', url: '', description: '' })
  const [editingLink, setEditingLink] = useState<ResourceLink | null>(null)

  const [playlistUrl, setPlaylistUrl] = useState('')
  const [playlistForm, setPlaylistForm] = useState({ title: '', description: '' })
  const [editingPlaylist, setEditingPlaylist] = useState<YouTubePlaylist | null>(null)
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistDetail | null>(null)
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null)
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<number>>(new Set())
  const [materialFiles, setMaterialFiles] = useState<File[]>([])
  const [dragOverMaterial, setDragOverMaterial] = useState(false)
  const [loadingPlaylistId, setLoadingPlaylistId] = useState<number | null>(null)

  const [dragOverPdf, setDragOverPdf] = useState(false)
  const [dragOverCover, setDragOverCover] = useState(false)

  const [newUsername, setNewUsername] = useState('')
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [editingUsername, setEditingUsername] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = () => {
    Promise.all([getBooks(), getLinks(), getPlaylists(), getStatus()]).then(
      ([booksRes, linksRes, playlistsRes, statusRes]) => {
        setBooks(booksRes.data.data)
        setLinks(linksRes.data)
        setPlaylists(playlistsRes.data)
        setStatus(statusRes.data)
        setNewUsername(statusRes.data.username)
      }
    )
  }

  // Book handlers
  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate required fields
    if (!bookForm.title.trim()) {
      setToast({ message: 'タイトルを入力してください', type: 'error' })
      return
    }
    
    if (!editingBook && !bookPdf) {
      setToast({ message: 'PDFファイルを選択してください', type: 'error' })
      return
    }

    // Confirm before creating/updating
    if (editingBook) {
      if (!confirm(`書籍「${bookForm.title}」を更新しますか？`)) return
    } else {
      if (!confirm(`書籍「${bookForm.title}」を追加しますか？`)) return
    }

    const formData = new FormData()
    formData.append('title', bookForm.title)
    formData.append('author', bookForm.author)
    formData.append('description', bookForm.description)
    if (bookPdf) formData.append('pdf_file', bookPdf)
    if (bookCover) formData.append('cover_image', bookCover)

    try {
      const res = editingBook
        ? await updateBook(editingBook.id, formData)
        : await createBook(formData)
      if (res.data.success) {
        setToast({ message: res.data.message || (editingBook ? '書籍を更新しました' : '書籍を追加しました'), type: 'success' })
        setBookForm({ title: '', author: '', description: '' })
        setBookPdf(null)
        setBookCover(null)
        setEditingBook(null)
        getBooks().then((r) => setBooks(r.data.data))
      }
    } catch {
      setToast({ message: 'エラーが発生しました', type: 'error' })
    }
  }

  const handleEditBook = (book: Book) => {
    setEditingBook(book)
    setBookForm({
      title: book.title,
      author: book.author || '',
      description: book.description || '',
    })
    window.scrollTo(0, 0)
  }

  const handleCancelEditBook = () => {
    setEditingBook(null)
    setBookForm({ title: '', author: '', description: '' })
    setBookPdf(null)
    setBookCover(null)
  }

  const handleDeleteBook = async (id: number) => {
    if (!confirm('この書籍を削除しますか？')) return
    try {
      await deleteBook(id)
      setToast({ message: '書籍を削除しました', type: 'success' })
      getBooks().then((r) => setBooks(r.data.data))
    } catch {
      setToast({ message: 'エラーが発生しました', type: 'error' })
    }
  }

  // Drag & Drop handlers
  const handleDragOverPdf = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverPdf(true)
  }

  const handleDragLeavePdf = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverPdf(false)
  }

  const handleDropPdf = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverPdf(false)
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        setBookPdf(file)
      } else {
        setToast({ message: 'PDFファイルをドラッグしてください', type: 'error' })
      }
    }
  }

  const handleDragOverCover = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverCover(true)
  }

  const handleDragLeaveCover = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverCover(false)
  }

  const handleDropCover = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverCover(false)
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      if (file.type.startsWith('image/')) {
        setBookCover(file)
      } else {
        setToast({ message: '画像ファイルをドラッグしてください', type: 'error' })
      }
    }
  }


  // Link handlers
  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Confirm before creating/updating
    if (editingLink) {
      if (!confirm(`リンク「${linkForm.name}」を更新しますか？`)) return
    } else {
      if (!confirm(`リンク「${linkForm.name}」を追加しますか？`)) return
    }

    try {
      const res = editingLink
        ? await updateLink(editingLink.id, linkForm)
        : await createLink(linkForm)
      if (res.data.success) {
        setToast({ message: res.data.message || '保存しました', type: 'success' })
        setLinkForm({ name: '', url: '', description: '' })
        setEditingLink(null)
        getLinks().then((r) => setLinks(r.data))
      }
    } catch {
      setToast({ message: 'エラーが発生しました', type: 'error' })
    }
  }

  const handleDeleteLink = async (id: number) => {
    if (!confirm('このリンクを削除しますか？')) return
    try {
      await deleteLink(id)
      setToast({ message: 'リンクを削除しました', type: 'success' })
      getLinks().then((r) => setLinks(r.data))
    } catch {
      setToast({ message: 'エラーが発生しました', type: 'error' })
    }
  }

  // Playlist handlers
  const handleAddPlaylist = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await createPlaylist({ playlist_id_or_url: playlistUrl })
      if (res.data.success) {
        setToast({ message: res.data.message || 'プレイリストを追加しました', type: 'success' })
        setPlaylistUrl('')
        getPlaylists().then((r) => setPlaylists(r.data))
      }
    } catch {
      setToast({ message: 'エラーが発生しました', type: 'error' })
    }
  }

  const handleDeletePlaylist = async (id: number) => {
    if (!confirm('このプレイリストを削除しますか？')) return
    try {
      await deletePlaylist(id)
      setToast({ message: 'プレイリストを削除しました', type: 'success' })
      setSelectedPlaylist(null)
      getPlaylists().then((r) => setPlaylists(r.data))
    } catch {
      setToast({ message: 'エラーが発生しました', type: 'error' })
    }
  }

  const handleEditPlaylist = (playlist: YouTubePlaylist) => {
    setEditingPlaylist(playlist)
    setPlaylistForm({
      title: playlist.title,
      description: playlist.description || '',
    })
    window.scrollTo(0, 0)
  }

  const handleUpdatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPlaylist) return
    
    // Confirm before updating
    if (!confirm(`「${playlistForm.title}」を更新しますか？`)) return

    try {
      const res = await updatePlaylist(editingPlaylist.id, playlistForm)
      if (res.data.success) {
        setToast({ message: res.data.message || 'プレイリストを更新しました', type: 'success' })
        setEditingPlaylist(null)
        setPlaylistForm({ title: '', description: '' })
        getPlaylists().then((r) => setPlaylists(r.data))
      }
    } catch {
      setToast({ message: 'エラーが発生しました', type: 'error' })
    }
  }

  const handleCancelEditPlaylist = () => {
    setEditingPlaylist(null)
    setPlaylistForm({ title: '', description: '' })
  }

  const handleSelectPlaylist = (playlistId: number) => {
    setSelectedPlaylistId(playlistId)
    setLoadingPlaylistId(playlistId)
    setSelectedMaterialIds(new Set()) // Reset selection when choosing new playlist
    setMaterialFiles([]) // Reset files when choosing new playlist
    getPlaylist(playlistId).then((res) => {
      setSelectedPlaylist(res.data)
      setLoadingPlaylistId(null)
    }).catch(() => {
      setLoadingPlaylistId(null)
    })
  }

  const handleUploadMaterial = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPlaylist || materialFiles.length === 0) {
      setToast({ message: '資料ファイルを選択してください', type: 'error' })
      return
    }

    // Confirm before uploading
    const fileNames = materialFiles.map(f => f.name).join('、')
    if (!confirm(`以下の${materialFiles.length}件を追加しますか？\n${fileNames}`)) return

    const formData = new FormData()
    materialFiles.forEach((file) => {
      formData.append('material_file', file)
    })

    try {
      const res = await uploadPlaylistMaterial(selectedPlaylist.id, formData)
      if (res.data.success) {
        setToast({ message: res.data.message || `${materialFiles.length}件の資料を追加しました`, type: 'success' })
        setMaterialFiles([])
        getPlaylist(selectedPlaylist.id).then((r) => setSelectedPlaylist(r.data))
      }
    } catch {
      setToast({ message: 'エラーが発生しました', type: 'error' })
    }
  }

  const handleMaterialFileChange = (files: FileList | null) => {
    if (!files) return
    setMaterialFiles(Array.from(files))
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverMaterial(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverMaterial(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverMaterial(false)
    handleMaterialFileChange(e.dataTransfer.files)
  }

  const removeMaterialFile = (index: number) => {
    setMaterialFiles(materialFiles.filter((_, i) => i !== index))
  }

  const handleDeleteMaterial = async (materialId: number) => {
    if (!selectedPlaylist) return
    if (!confirm('この資料を削除しますか？')) return

    try {
      await deletePlaylistMaterial(selectedPlaylist.id, materialId)
      setToast({ message: '資料を削除しました', type: 'success' })
      getPlaylist(selectedPlaylist.id).then((r) => setSelectedPlaylist(r.data))
    } catch {
      setToast({ message: 'エラーが発生しました', type: 'error' })
    }
  }

  const handleDeleteMultipleMaterials = async () => {
    if (!selectedPlaylist || selectedMaterialIds.size === 0) return
    if (!confirm(`${selectedMaterialIds.size}件の資料を削除しますか？`)) return

    try {
      let deletedCount = 0
      for (const materialId of selectedMaterialIds) {
        try {
          await deletePlaylistMaterial(selectedPlaylist.id, materialId)
          deletedCount++
        } catch (err) {
          console.error(`Failed to delete material ${materialId}:`, err)
        }
      }
      setToast({ message: `${deletedCount}件の資料を削除しました`, type: 'success' })
      setSelectedMaterialIds(new Set())
      getPlaylist(selectedPlaylist.id).then((r) => setSelectedPlaylist(r.data))
    } catch {
      setToast({ message: 'エラーが発生しました', type: 'error' })
    }
  }

  const toggleMaterialSelection = (materialId: number) => {
    const newSet = new Set(selectedMaterialIds)
    if (newSet.has(materialId)) {
      newSet.delete(materialId)
    } else {
      newSet.add(materialId)
    }
    setSelectedMaterialIds(newSet)
  }

  const toggleAllMaterials = () => {
    if (!selectedPlaylist?.materials) return
    if (selectedMaterialIds.size === selectedPlaylist.materials.length) {
      setSelectedMaterialIds(new Set())
    } else {
      setSelectedMaterialIds(new Set(selectedPlaylist.materials.map(m => m.id)))
    }
  }

  const handleResetProgress = async (id: number) => {
    if (!confirm('このプレイリストの進捗をリセットしますか？')) return
    try {
      const res = await resetPlaylistProgress(id)
      if (res.data.success) {
        setToast({ message: res.data.message || '進捗をリセットしました', type: 'success' })
        getPlaylists().then((r) => setPlaylists(r.data))
      }
    } catch {
      setToast({ message: 'エラーが発生しました', type: 'error' })
    }
  }

  // User handlers
  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await updateUsername(newUsername)
      if (res.data.success) {
        setToast({ message: res.data.message || 'ユーザー名を更新しました', type: 'success' })
        setEditingUsername(false)
        getStatus().then((r) => setStatus(r.data))
      }
    } catch {
      setToast({ message: 'エラーが発生しました', type: 'error' })
    }
  }

  const handleResetAllData = async () => {
    try {
      const res = await resetAllData()
      if (res.data.success) {
        setToast({ message: res.data.message || 'データをリセットしました', type: 'success' })
        setShowResetConfirm(false)
        loadData()
      }
    } catch {
      setToast({ message: 'エラーが発生しました', type: 'error' })
    }
  }

  const tabs = [
    { id: 'books' as Tab, icon: BookOpen, label: '書籍管理' },
    { id: 'links' as Tab, icon: Link2, label: 'リンク管理' },
    { id: 'youtube' as Tab, icon: Youtube, label: 'YouTube管理' },
    { id: 'user' as Tab, icon: User, label: 'ユーザー設定' },
  ]

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center">
          <Settings className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-800">管理コンソール</h1>
          <p className="text-gray-500">コンテンツとデータを管理</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center justify-center gap-1.5 px-6 py-4 rounded-xl font-black transition-all shadow-sm ${
              activeTab === tab.id
                ? 'bg-primary-700 text-black shadow-md'
                : 'bg-white text-black hover:bg-gray-100 border border-gray-300'
            }`}
          >
            <tab.icon className={`w-6 h-6 ${activeTab === tab.id ? 'text-black' : 'text-black'}`} />
            <span className="text-sm leading-tight">
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        {/* Books Tab */}
        {activeTab === 'books' && (
          <div className="space-y-6">
            <form onSubmit={handleAddBook} className="space-y-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                {editingBook ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {editingBook ? '書籍を編集' : '書籍を追加'}
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <input
                  type="text"
                  value={bookForm.title}
                  onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
                  placeholder="タイトル"
                  className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500"
                  required
                />
                <input
                  type="text"
                  value={bookForm.author}
                  onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })}
                  placeholder="著者"
                  className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <input
                type="text"
                value={bookForm.description}
                onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })}
                placeholder="説明"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500"
              />
              <div className="grid md:grid-cols-2 gap-4">
                <label
                  onDragOver={handleDragOverPdf}
                  onDragLeave={handleDragLeavePdf}
                  onDrop={handleDropPdf}
                  className={`flex items-center gap-3 px-4 py-3 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                    dragOverPdf
                      ? 'border-primary-400 bg-primary-50'
                      : 'border-gray-200 hover:border-primary-400'
                  }`}
                >
                  <span className="text-gray-500 text-sm truncate">{bookPdf ? bookPdf.name : `📄 PDFファイル ${!editingBook ? '*' : '（任意）'}`}</span>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setBookPdf(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
                <label
                  onDragOver={handleDragOverCover}
                  onDragLeave={handleDragLeaveCover}
                  onDrop={handleDropCover}
                  className={`flex items-center gap-3 px-4 py-3 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                    dragOverCover
                      ? 'border-primary-400 bg-primary-50'
                      : 'border-gray-200 hover:border-primary-400'
                  }`}
                >
                  <span className="text-gray-500 text-sm truncate">{bookCover ? bookCover.name : '🖼️ 表紙画像（任意）'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setBookCover(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <Button type="submit" variant="primary" size="lg" fullWidth>
                  <Save className="w-4 h-4" />
                  {editingBook ? '更新' : '追加'}
                </Button>
                {editingBook && (
                  <Button type="button" variant="secondary" size="lg" fullWidth onClick={handleCancelEditBook}>
                    <X className="w-4 h-4" />
                    キャンセル
                  </Button>
                )}
              </div>
            </form>

            <div className="border-t pt-6">
              <h3 className="font-semibold text-gray-800 mb-4">登録済み書籍</h3>
              {books.length > 0 ? (
                <div className="space-y-2">
                  {books.map((book) => (
                    <div
                      key={book.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                    >
                      <div>
                        <p className="font-medium text-gray-800">{book.title}</p>
                        <p className="text-sm text-gray-700 font-medium">{book.author}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditBook(book)}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          title="編集"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteBook(book.id)}
                          className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                          title="削除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">書籍がありません</p>
              )}
            </div>
          </div>
        )}

        {/* Links Tab */}
        {activeTab === 'links' && (
          <div className="space-y-6">
            <form onSubmit={handleAddLink} className="space-y-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                {editingLink ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {editingLink ? 'リンクを編集' : 'リンクを追加'}
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <input
                  type="text"
                  value={linkForm.name}
                  onChange={(e) => setLinkForm({ ...linkForm, name: e.target.value })}
                  placeholder="名前"
                  className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500"
                  required
                />
                <input
                  type="url"
                  value={linkForm.url}
                  onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })}
                  placeholder="URL"
                  className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              <input
                type="text"
                value={linkForm.description}
                onChange={(e) => setLinkForm({ ...linkForm, description: e.target.value })}
                placeholder="説明"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500"
              />
              <div className="flex gap-2">
                <Button type="submit" variant="primary" size="lg" fullWidth>
                  <Save className="w-4 h-4" />
                  {editingLink ? '更新' : '追加'}
                </Button>
                {editingLink && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    onClick={() => {
                      setEditingLink(null)
                      setLinkForm({ name: '', url: '', description: '' })
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </form>

            <div className="border-t pt-6">
              <h3 className="font-semibold text-gray-800 mb-4">登録済みリンク</h3>
              {links.length > 0 ? (
                <div className="space-y-2">
                  {links.map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                    >
                      <div>
                        <p className="font-medium text-gray-800">{link.name}</p>
                        <p className="text-sm text-gray-500 truncate max-w-md">{link.url}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingLink(link)
                            setLinkForm({
                              name: link.name,
                              url: link.url,
                              description: link.description || '',
                            })
                          }}
                          className="p-2 text-blue-500 hover:bg-blue-100 rounded-lg"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteLink(link.id)}
                          className="p-2 text-red-500 hover:bg-red-100 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">リンクがありません</p>
              )}
            </div>
          </div>
        )}

        {/* YouTube Tab */}
        {activeTab === 'youtube' && (
          <div className="space-y-4">
            {/* Add Playlist Form - Fixed at top */}
            <form onSubmit={handleAddPlaylist} className="space-y-3 bg-gradient-to-r from-red-50 to-red-100 p-4 rounded-xl border border-red-200">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                プレイリストを追加
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={playlistUrl}
                  onChange={(e) => setPlaylistUrl(e.target.value)}
                  placeholder="YouTubeプレイリストURL または ID"
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500"
                  required
                />
                <Button type="submit" variant="danger" size="lg">
                  追加
                </Button>
              </div>
            </form>

            {/* Main Content - 2 Panel Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left Panel: Playlist List */}
              <div className="lg:col-span-1 space-y-3">
                <h3 className="font-semibold text-gray-800 text-sm">登録済みプレイリスト</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {playlists.length > 0 ? (
                    playlists.map((playlist) => (
                      <div
                        key={playlist.id}
                        className={`p-3 rounded-lg cursor-pointer transition-all border-2 ${
                          selectedPlaylistId === playlist.id
                            ? 'bg-blue-100 border-blue-400 shadow-md'
                            : 'bg-white border-gray-200 hover:border-blue-300'
                        }`}
                        onClick={() => handleSelectPlaylist(playlist.id)}
                      >
                        <p className="font-medium text-gray-900 text-sm truncate">{playlist.title}</p>
                        <p className="text-xs text-gray-600">
                          {playlist.completed_videos || 0}/{playlist.total_videos || 0} 完了
                        </p>
                        <div className="mt-2 flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditPlaylist(playlist)
                            }}
                            className="flex-1 p-1 text-xs bg-blue-100 text-blue-600 hover:bg-blue-200 rounded transition-colors"
                            title="編集"
                          >
                            編集
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm('進捗をリセットしますか？')) handleResetProgress(playlist.id)
                            }}
                            className="flex-1 p-1 text-xs bg-orange-100 text-orange-600 hover:bg-orange-200 rounded transition-colors"
                            title="リセット"
                          >
                            リセット
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm('削除しますか？')) handleDeletePlaylist(playlist.id)
                            }}
                            className="flex-1 p-1 text-xs bg-red-100 text-red-600 hover:bg-red-200 rounded transition-colors"
                            title="削除"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm text-center py-4">プレイリストがありません</p>
                  )}
                </div>
              </div>

              {/* Right Panel: Edit & Materials */}
              <div className="lg:col-span-2 space-y-3">
                {/* Edit Form */}
                {editingPlaylist && (
                  <form onSubmit={handleUpdatePlaylist} className="space-y-3 bg-blue-50 p-4 rounded-xl border border-blue-200">
                    <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                      <Edit2 className="w-4 h-4" />
                      プレイリストを編集
                    </h4>
                    <input
                      type="text"
                      value={playlistForm.title}
                      onChange={(e) => setPlaylistForm({ ...playlistForm, title: e.target.value })}
                      placeholder="タイトル"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      required
                    />
                    <input
                      type="text"
                      value={playlistForm.description}
                      onChange={(e) => setPlaylistForm({ ...playlistForm, description: e.target.value })}
                      placeholder="説明（任意）"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <div className="flex gap-2">
                      <Button type="submit" variant="primary" size="lg" fullWidth>
                        <Save className="w-5 h-5" />
                        更新する
                      </Button>
                      <Button type="button" variant="secondary" size="lg" onClick={handleCancelEditPlaylist}>
                        <X className="w-5 h-5" />
                        キャンセル
                      </Button>
                    </div>
                  </form>
                )}

                {/* Materials Section */}
                {selectedPlaylistId !== null && loadingPlaylistId === selectedPlaylistId && !selectedPlaylist ? (
                  <div className="p-8 text-center text-gray-500">
                    <div className="inline-block animate-spin mb-2">
                      <RefreshCw className="w-6 h-6" />
                    </div>
                    <p>読み込み中...</p>
                  </div>
                ) : selectedPlaylist ? (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-800 text-sm">
                      {selectedPlaylist.title} - 講義資料
                    </h4>

                    {/* Upload Material Form */}
                    <form onSubmit={handleUploadMaterial} className="space-y-2 bg-green-50 p-3 rounded-lg border border-green-200">
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`px-3 py-4 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                          dragOverMaterial
                            ? 'border-green-600 bg-green-100'
                            : 'border-green-400 hover:border-green-600 hover:bg-green-100'
                        }`}
                      >
                        <label className="flex items-center justify-center gap-2 cursor-pointer">
                          <Plus className="w-5 h-5 text-green-600 flex-shrink-0" />
                          <div className="text-center flex-1">
                            <p className="text-sm font-medium text-gray-700">
                              {materialFiles.length > 0 ? `${materialFiles.length}個のファイルが選択されています` : 'ファイルをドラッグ or クリック'}
                            </p>
                            <p className="text-xs text-gray-600">複数選択可能です</p>
                          </div>
                          <input
                            type="file"
                            multiple
                            onChange={(e) => handleMaterialFileChange(e.target.files)}
                            className="hidden"
                          />
                        </label>
                      </div>

                      {/* Selected files preview */}
                      {materialFiles.length > 0 && (
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {materialFiles.map((file, index) => (
                            <div
                              key={`${file.name}-${index}`}
                              className="flex items-center justify-between p-2 bg-white rounded border border-green-300"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-gray-800 truncate font-medium">{file.name}</p>
                                <p className="text-xs text-gray-600">
                                  {(file.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeMaterialFile(index)}
                                className="p-1 text-red-500 hover:bg-red-100 rounded transition-colors flex-shrink-0 ml-2"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {materialFiles.length > 0 && (
                        <Button type="submit" variant="primary" size="md" fullWidth>
                          {materialFiles.length}件を追加
                        </Button>
                      )}
                    </form>

                    {/* Materials List */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-gray-600">
                          登録済み資料 ({selectedPlaylist.materials?.length || 0})
                        </p>
                        {selectedPlaylist.materials && selectedPlaylist.materials.length > 0 && (
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={toggleAllMaterials}
                            >
                              {selectedMaterialIds.size === selectedPlaylist.materials.length ? '全解除' : '全選択'}
                            </Button>
                            {selectedMaterialIds.size > 0 && (
                              <Button
                                type="button"
                                variant="danger"
                                size="sm"
                                onClick={handleDeleteMultipleMaterials}
                              >
                                <Trash2 className="w-3 h-3" />
                                {selectedMaterialIds.size}件削除
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                      {selectedPlaylist.materials && selectedPlaylist.materials.length > 0 ? (
                        <div className="space-y-1 max-h-60 overflow-y-auto">
                          {selectedPlaylist.materials.map((material) => (
                            <div
                              key={material.id}
                              className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                                selectedMaterialIds.has(material.id)
                                  ? 'bg-blue-100 border border-blue-300'
                                  : 'bg-gray-100 hover:bg-gray-200'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedMaterialIds.has(material.id)}
                                onChange={() => toggleMaterialSelection(material.id)}
                                className="w-4 h-4 rounded cursor-pointer"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-gray-800 truncate text-sm">{material.file_name}</p>
                                <p className="text-xs text-gray-600">
                                  {new Date(material.uploaded_at || '').toLocaleDateString('ja-JP')}
                                </p>
                              </div>
                              {!selectedMaterialIds.has(material.id) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm('この資料を削除しますか？')) {
                                      handleDeleteMaterial(material.id)
                                    }
                                  }}
                                  className="p-1 text-red-500 hover:bg-red-100 rounded transition-colors flex-shrink-0"
                                  title="削除"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 py-2">資料がありません</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-400">
                    <p className="text-sm">左からプレイリストを選択してください</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* User Tab */}
        {activeTab === 'user' && (
          <div className="space-y-6">
            {/* Username Section */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-sm font-medium text-gray-600 mb-3">現在のユーザー名</h3>
              
              {!editingUsername ? (
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-primary-600">
                    {status?.username || '未設定'}
                  </span>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => {
                      setEditingUsername(true)
                      setNewUsername(status?.username || '')
                    }}
                  >
                    変更する
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleUpdateUsername} className="space-y-4">
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500"
                    autoFocus
                    required
                  />
                  <div className="flex gap-2">
                    <Button type="submit" variant="primary" size="lg" fullWidth>
                      更新する
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="lg"
                      fullWidth
                      onClick={() => {
                        setEditingUsername(false)
                        setNewUsername('')
                      }}
                    >
                      キャンセル
                    </Button>
                  </div>
                </form>
              )}
            </div>

            <div className="border-t pt-6">
              <h3 className="font-semibold text-red-600 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                データリセット
              </h3>
              <p className="text-gray-500 text-sm mt-2 mb-4">
                すべての学習記録、書籍、リンクを削除します。この操作は取り消せません。
              </p>
              {!showResetConfirm ? (
                <Button variant="danger" size="lg" onClick={() => setShowResetConfirm(true)}>
                  全データをリセット
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="danger" size="lg" onClick={handleResetAllData}>
                    確認してリセット
                  </Button>
                  <Button variant="secondary" size="lg" onClick={() => setShowResetConfirm(false)}>
                    キャンセル
                  </Button>
                </div>
              )}
            </div>

            {/* Current Status */}
            {status && (
              <div className="border-t pt-6">
                <h3 className="font-semibold text-gray-800 mb-4">現在のステータス</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-gray-500 text-sm">総XP</p>
                    <p className="text-2xl font-bold text-primary-600">
                      {status.total_xp.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-gray-500 text-sm">ランク</p>
                    <p className="text-2xl font-bold text-gray-800">{status.rank}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-gray-500 text-sm">学習時間</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {status.total_time_hours}時間
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
