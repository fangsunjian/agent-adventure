import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../services/supabaseClient'
import type { Playthrough } from '../../types'

// Data transformation helpers
const playthroughFromDb = (dbPlaythrough: any): Playthrough & { stories: any } => ({
  id: dbPlaythrough.id,
  userId: dbPlaythrough.user_id,
  storyId: dbPlaythrough.story_id,
  isPreview: dbPlaythrough.is_preview ?? false,
  history: dbPlaythrough.game_state?.history || [],
  summaries: dbPlaythrough.game_state?.summaries || [],
  grandSummaries: dbPlaythrough.game_state?.grandSummaries || [],
  milestoneSummaries: dbPlaythrough.game_state?.milestoneSummaries || [],
  turn: dbPlaythrough.game_state?.turn || 0,
  userName: dbPlaythrough.game_state?.userName || '',
  charName: dbPlaythrough.game_state?.charName || '',
  gameStatus: dbPlaythrough.game_state?.gameStatus || 0,
  dialogue: dbPlaythrough.game_state?.dialogue || null,
  placeholderValues: dbPlaythrough.game_state?.placeholderValues || {},
  playerLocation: dbPlaythrough.game_state?.playerLocation || null,
  mapData: dbPlaythrough.game_state?.mapData || null,
  hasUnviewedLocationChange: dbPlaythrough.game_state?.hasUnviewedLocationChange || false,
  stories: dbPlaythrough.stories
})

// Query keys
export const playthroughKeys = {
  all: ['playthroughs'] as const,
  lists: () => [...playthroughKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...playthroughKeys.lists(), { filters }] as const,
  details: () => [...playthroughKeys.all, 'detail'] as const,
  detail: (id: string) => [...playthroughKeys.details(), id] as const,
}

interface PlaythroughListFilters {
  storyId?: string | null
  isPreview?: boolean
}

// Fetch playthroughs for a user
export function usePlaythroughs(userId?: string, filters: PlaythroughListFilters = {}) {
  const { storyId, isPreview } = filters

  return useQuery({
    queryKey: playthroughKeys.list({ userId, storyId: storyId ?? undefined, isPreview }),
    queryFn: async () => {
      if (!userId) return []

      let query = supabase
        .from('playthroughs')
        .select(`
          *,
          stories (
            title,
            description,
            cover_image_url
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (storyId) {
        query = query.eq('story_id', storyId)
      }

      if (typeof isPreview === 'boolean') {
        if (isPreview) {
          query = query.eq('is_preview', true)
        } else {
          query = query.or('is_preview.eq.false,is_preview.is.null')
        }
      }

      const { data, error } = await query

      if (error) throw error
      return data?.map(playthroughFromDb) || []
    },
    enabled: Boolean(userId && (storyId === undefined || storyId === null || storyId)),
  })
}

// Fetch single playthrough
export function usePlaythrough(id: string | null) {
  return useQuery({
    queryKey: playthroughKeys.detail(id || ''),
    queryFn: async () => {
      if (!id) return null

      const { data, error } = await supabase
        .from('playthroughs')
        .select(`
          *,
          stories (*)
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return data as Playthrough & { stories: any }
    },
    enabled: !!id,
  })
}

// Save playthrough mutation
export function useSavePlaythrough() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (playthrough: Record<string, any>) => {
      const { data, error } = await supabase
        .from('playthroughs')
        .upsert({
          ...playthrough,
          // 不添加 updated_at 字段，因为数据库表中没有这个字段
          // 数据库只有: id, created_at, user_id, story_id, game_state, is_preview
        }, {
          onConflict: 'user_id,story_id,is_preview' // 指定冲突处理字段，对应数据库的唯一约束
        })
        .select()
        .single()

      if (error) throw error
      return data as Playthrough
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: playthroughKeys.lists() })
      queryClient.setQueryData(playthroughKeys.detail(data.id), data)
    },
  })
}

// Delete playthrough mutation
export function useDeletePlaythrough() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('playthroughs')
        .delete()
        .eq('id', id)

      if (error) throw error
      return id
    },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: playthroughKeys.lists() })
      queryClient.removeQueries({ queryKey: playthroughKeys.detail(deletedId) })
    },
  })
}
