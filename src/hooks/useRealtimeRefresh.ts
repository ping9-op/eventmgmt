import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

/**
 * 다른 직원(또는 다른 탭)이 테이블을 바꾸면 onChange를 다시 호출 — 새로고침 없이 최신 데이터 표시
 * - 알림 내용(암호문 포함)은 쓰지 않고 화면의 기존 load()로 다시 읽는다 (복호화·필터 경로 그대로)
 * - 여러 건이 한꺼번에 바뀌어도(일괄 변경·트리거 연쇄) 한 번만 다시 읽도록 잠깐 모아서 호출
 * - Realtime은 RLS를 적용하므로 매니저는 볼 수 있는 행의 변경만 받는다
 * DB: supabase_realtime publication에 sales_leads, sales_tasks 등록 (20261116010000_sales_realtime.sql)
 */
export function useRealtimeRefresh(tables: string[], onChange: () => void, delayMs = 800) {
  const cb = useRef(onChange)
  cb.current = onChange
  const key = tables.join(',')

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const fire = () => { clearTimeout(timer); timer = setTimeout(() => cb.current(), delayMs) }
    const channel = supabase.channel(`rt:${key}:${Math.random().toString(36).slice(2, 8)}`)
    for (const table of key.split(',')) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, fire)
    }
    channel.subscribe()
    return () => { clearTimeout(timer); supabase.removeChannel(channel) }
  }, [key, delayMs])
}
