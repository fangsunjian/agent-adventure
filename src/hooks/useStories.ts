import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../services/supabaseClient'
import type { Story, StoryFromDB } from '../../types'

// Data transformation helpers
const storyFromDb = (dbStory: StoryFromDB): Story => ({
  id: dbStory.id,
  creatorId: dbStory.creator_id,
  creatorName: dbStory.creator_name,
  title: dbStory.title,
  description: dbStory.description,
  coverImageUrl: dbStory.cover_image_url,
  visibility: dbStory.visibility,
  category: dbStory.category,
  library: dbStory.library,
  backgroundSetting: dbStory.background_setting,
  openingMonologue: dbStory.opening_monologue,
  openingAction: dbStory.opening_action,
  openingSpeaker: dbStory.opening_speaker,
})

const storyToDb = (appStory: Partial<Story>): Omit<StoryFromDB, 'creator_id'> & { creator_id?: string } => ({
  id: appStory.id,
  creator_id: appStory.creatorId,
  creator_name: appStory.creatorName,
  title: appStory.title,
  description: appStory.description,
  cover_image_url: appStory.coverImageUrl,
  visibility: appStory.visibility,
  category: appStory.category,
  library: appStory.library,
  background_setting: appStory.backgroundSetting,
  opening_monologue: appStory.openingMonologue,
  opening_action: appStory.openingAction,
  opening_speaker: appStory.openingSpeaker,
})

// Query keys
export const storyKeys = {
  all: ['stories'] as const,
  lists: () => [...storyKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...storyKeys.lists(), { filters }] as const,
  details: () => [...storyKeys.all, 'detail'] as const,
  detail: (id: string) => [...storyKeys.details(), id] as const,
}

// Fetch stories
export function useStories(userId?: string) {
  return useQuery({
    queryKey: storyKeys.list({ userId }),
    queryFn: async () => {
      let query = supabase
        .from('stories')
        .select('*')
        .order('title', { ascending: true })

      if (userId) {
        query = query.eq('creator_id', userId)
      } else {
        query = query.eq('visibility', 'public')
      }

      const { data, error } = await query
      if (error) throw error
      return data?.map(storyFromDb) || []
    },
  })
}

// Fetch single story
export function useStory(id: string | null) {
  return useQuery({
    queryKey: storyKeys.detail(id || ''),
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('stories')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return storyFromDb(data)
    },
    enabled: !!id,
  })
}

// Save story mutation
export function useSaveStory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (story: Partial<Story>) => {
      const dbPayload = storyToDb(story)
      const { data, error } = await supabase
        .from('stories')
        .upsert(dbPayload)
        .select()
        .single()

      if (error) throw error
      return storyFromDb(data)
    },
    onSuccess: (data) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: storyKeys.lists() })
      queryClient.setQueryData(storyKeys.detail(data.id), data)
    },
  })
}

// Delete story mutation
export function useDeleteStory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('stories')
        .delete()
        .eq('id', id)

      if (error) throw error
      return id
    },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: storyKeys.lists() })
      queryClient.removeQueries({ queryKey: storyKeys.detail(deletedId) })
    },
  })
}