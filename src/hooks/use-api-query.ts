'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useApiQuery<T>(
  key: string | unknown[],
  url: string | null,
  options?: {
    enabled?: boolean
    staleTime?: number
    refetchInterval?: number
  }
) {
  const queryKey = Array.isArray(key) ? key : [key]
  return useQuery<T>({
    queryKey,
    queryFn: () => api<T>(url!),
    enabled: !!url && (options?.enabled ?? true),
    staleTime: options?.staleTime,
    refetchInterval: options?.refetchInterval,
  })
}

export function useApiMutation<TData, TVars>(
  mutationFn: (vars: TVars) => Promise<TData>,
  invalidateKeys: string[][] = []
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      invalidateKeys.forEach(key => qc.invalidateQueries({ queryKey: key }))
    },
  })
}

export function useInvalidate() {
  const qc = useQueryClient()
  return (keys: string[][]) => {
    keys.forEach(key => qc.invalidateQueries({ queryKey: key }))
  }
}

export function usePrefetch() {
  const qc = useQueryClient()
  return (key: string, url: string, staleTime = 5 * 60 * 1000) => {
    qc.prefetchQuery({ queryKey: [key], queryFn: () => api(url), staleTime })
  }
}