import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../services/supabaseClient'
import type { Playthrough, PlaythroughFromDB } from '../../types'

// Data transformation helpers
const playthroughFromDb = (dbPlaythrough: any): Playthrough & { stories: any } => ({
  id: dbPlaythrough.id,
  userId: dbPlaythrough.user_id,
  storyId: dbPlaythrough.story_id,
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

// Fetch playthroughs for a user
export function usePlaythroughs(userId?: string) {
  return useQuery({
    queryKey: playthroughKeys.list({ userId }),
    queryFn: async () => {
      if (!userId) return []

      const { data, error } = await supabase
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

      if (error) throw error
      return data?.map(playthroughFromDb) || []
    },
    enabled: !!userId,
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
    mutationFn: async (playthrough: Partial<Playthrough>) => {
      const { data, error } = await supabase
        .from('playthroughs')
        .upsert({
          ...playthrough,
          updated_at: new Date().toISOString(),
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