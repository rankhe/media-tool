import api from './api'

const topCreatorsService = {
  getTopCreators: async (params?: { platform?: string; category?: string; limit?: number; page?: number }) => {
    const response = await api.get('/top-creators', { params })
    return response.data
  },
  addTopCreator: async (payload: {
    platform: string
    creator_user_id: string
    creator_username?: string
    creator_display_name?: string
    avatar_url?: string
    follower_count?: number
    verified?: boolean
    bio?: string
    category?: string
    score?: number
  }) => {
    const response = await api.post('/top-creators', payload)
    return response.data
  },
  deleteTopCreator: async (id: number) => {
    const response = await api.delete(`/top-creators/${id}`)
    return response.data
  },
}

export default topCreatorsService