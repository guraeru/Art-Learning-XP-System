import axios from 'axios'
import type {
  UserStatus,
  Record,
  Book,
  ResourceLink,
  YouTubePlaylist,
  PlaylistDetail,
  PixivTopic,
  Constants,
  ApiResponse,
  VideoCompleteResponse,
  LearningPatterns,
  ArchiveData,
} from '../types'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Status API
export const getStatus = () => api.get<UserStatus>('/status')
export const getConstants = () => api.get<Constants>('/constants')
export const updateUsername = (username: string) => 
  api.put<ApiResponse>('/user/username', { username })
export const resetAllData = () => api.post<ApiResponse>('/user/reset')

// Records API
export const getRecords = (params?: { type?: string; year?: string; limit?: number }) =>
  api.get<Record[]>('/records', { params })

export const getRecord = (id: number) => api.get<Record>(`/records/${id}`)

export const logTime = (data: { activity_type: string; duration: number; description?: string }) =>
  api.post<ApiResponse>('/records/time', data)

export const logAcquisition = (formData: FormData) =>
  api.post<ApiResponse>('/records/acquisition', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

export const logPost = (formData: FormData) =>
  api.post<ApiResponse>('/records/post', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

export const deleteRecord = (id: number) => api.delete<ApiResponse>(`/records/${id}`)

// Books API
export const getBooks = (params?: { page?: number; limit?: number; search?: string }) =>
  api.get<{
    data: Book[]
    pagination: {
      page: number
      limit: number
      total: number
      total_pages: number
      has_next: boolean
      has_prev: boolean
    }
  }>('/books', { params })
export const createBook = (formData: FormData) =>
  api.post<ApiResponse>('/books', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
export const updateBook = (id: number, formData: FormData) =>
  api.put<ApiResponse>(`/books/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
export const deleteBook = (id: number) => api.delete<ApiResponse>(`/books/${id}`)

// Links API
export const getLinks = (limit?: number) =>
  api.get<ResourceLink[]>('/links', { params: limit ? { limit } : undefined })
export const createLink = (data: { name: string; url: string; description?: string }) =>
  api.post<ApiResponse>('/links', data)
export const updateLink = (id: number, data: { name: string; url: string; description?: string }) =>
  api.put<ApiResponse>(`/links/${id}`, data)
export const deleteLink = (id: number) => api.delete<ApiResponse>(`/links/${id}`)

// YouTube Playlists API
export const getPlaylists = () => api.get<YouTubePlaylist[]>('/playlists')
export const getPlaylist = (id: number, includeVideos: boolean = false) =>
  api.get<PlaylistDetail>(`/playlists/${id}?include_videos=${includeVideos}`)
export const createPlaylist = (data: { playlist_id_or_url: string; title?: string; description?: string }) =>
  api.post<ApiResponse>('/playlists', data)
export const updatePlaylist = (id: number, data: { title?: string; description?: string }) =>
  api.put<ApiResponse>(`/playlists/${id}`, data)
export const deletePlaylist = (id: number) => api.delete<ApiResponse>(`/playlists/${id}`)
export const resetPlaylistProgress = (id: number) =>
  api.post<ApiResponse>(`/playlists/${id}/reset`)
export const uploadPlaylistMaterial = (playlistId: number, formData: FormData) =>
  api.post<ApiResponse>(`/playlists/${playlistId}/materials`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
export const deletePlaylistMaterial = (playlistId: number, materialId: number) =>
  api.delete<ApiResponse>(`/playlists/${playlistId}/materials/${materialId}`)
export const recordVideoView = (playlistId: string, videoId: string, watchTime: number) =>
  api.post<ApiResponse>(`/playlists/${playlistId}/video/${videoId}/view`, { watch_time: watchTime })
export const markVideoComplete = (playlistId: string, videoId: string) =>
  api.post<VideoCompleteResponse>(`/playlists/${playlistId}/video/${videoId}/complete`)

// Pixiv API
export const getPixivTopics = () => api.get<PixivTopic[]>('/pixiv/topics')

// Archive API
export const getArchive = () => api.get<ArchiveData>('/archive')

// Works API
export const getWorks = () => api.get<Record[]>('/works')

// Statistics API
export const getXpByTechnique = () => api.get<{ labels: string[]; data: number[] }>('/statistics/xp_by_technique')
export const getXpByEvaluation = () => api.get<{ labels: string[]; data: number[] }>('/statistics/xp_by_evaluation')
export const getLearningPatterns = () => api.get<LearningPatterns>('/statistics/learning_patterns')
export const getYoutubeProgress = () => api.get<Array<{
  id: number
  title: string
  total_xp: number
  completed_count: number
  total_watch_time_formatted: string
}>>('/statistics/youtube_progress')
export const getTimeAnalysis = (period: 'daily' | 'weekly' | 'monthly') =>
  api.get<{ labels: string[]; minutes: number[]; xp: number[] }>(`/statistics/time_analysis/${period}`)
export const getActivityHeatmap = (year?: number) => api.get<{
  data: Array<{
    date: string
    xp: number
    week: number
    day: number
  }>
  start_date: string
  end_date: string
  total_xp: number
  days_active: number
}>('/statistics/activity_heatmap', { params: year ? { year } : {} })

// Export API
export const exportCSV = () => window.open('/api/export/csv', '_blank')
export const exportJSON = () => window.open('/api/export/json', '_blank')

export default api
