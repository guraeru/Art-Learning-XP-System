// User Status
export interface UserStatus {
  rank: number
  title: string
  username: string
  total_xp: number
  xp_to_next_rank: number
  next_xp_goal: number
  xp_start_of_current_level: number
  total_time_minutes: number
  total_time_hours: number
}

// Records
export interface Record {
  id: number
  type: string
  subtype: string
  description: string | null
  xp_gained: number
  date: string | null
  duration_minutes: number | null
  evaluation: string | null
  image_path: string | null
  year: string
}

// Books
export interface Book {
  id: number
  title: string
  author: string | null
  description: string | null
  pdf_file_path: string
  cover_image_path: string | null
  added_date: string | null
}

// Resource Links
export interface ResourceLink {
  id: number
  name: string
  url: string
  description: string | null
  added_date: string | null
}

// YouTube Playlists
export interface YouTubePlaylist {
  id: number
  playlist_id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  added_date: string | null
  total_videos?: number
  completed_videos?: number
  progress_rate?: number
}

export interface PlaylistVideo {
  id: string
  title: string
  thumbnail: string
  channel: string
  duration: number
  completed: boolean
  views: number
  total_watch_time: number
}

export interface PlaylistDetail extends YouTubePlaylist {
  videos?: PlaylistVideo[]
  materials: PlaylistMaterial[]
  total_completed?: number
}

export interface PlaylistMaterial {
  id: number
  file_name: string
  file_path: string
  uploaded_at: string | null
}

// Pixiv Topics
export interface PixivTopic {
  title: string
  image: string
  url: string
}

// Constants
export interface Constants {
  xp_rates: { [key: string]: number }
  acq_types: { [key: string]: number }
  evaluations: { [key: string]: number }
}

// API Responses
export interface ApiResponse<T = unknown> {
  success?: boolean
  message?: string
  error?: string
  data?: T
}

export interface VideoCompleteResponse {
  success: boolean
  xp_gained: number
}

// Statistics
export interface ChartData {
  labels: string[]
  data: number[]
}

export interface LearningPatterns {
  by_day: ChartData
  by_hour: ChartData
}

export interface ArchiveData {
  archive_data: { [year: string]: Record[] }
  sorted_years: string[]
}
