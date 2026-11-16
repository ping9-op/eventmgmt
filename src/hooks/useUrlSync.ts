import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * 화면의 필터·검색·보기 상태를 URL(?key=value)에 남긴다 — 새로고침·링크 공유·뒤로가기 후에도 같은 화면
 * - 상태는 기존처럼 useState로 두고(한글 입력 등 안전), 처음 값만 urlParam()으로 URL에서 읽는다
 * - 값이 바뀌면 URL을 교체(replace)해서 브라우저 기록이 쌓이지 않게 한다
 * - 기본값(빈 값·null)은 URL에 쓰지 않는다 → 아무 필터도 없으면 주소가 깨끗하게 유지
 */
export type UrlValue = string | number | null | undefined | false

/** 화면을 처음 열 때 URL에 있던 값 */
export function urlParam(key: string): string | null {
  return new URLSearchParams(window.location.search).get(key)
}

export function useUrlSync(values: Record<string, UrlValue>) {
  const location = useLocation()
  const navigate = useNavigate()
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(values)) {
    if (v !== null && v !== undefined && v !== '' && v !== false) p.set(k, String(v))
  }
  const qs = p.toString()
  const latest = useRef(location)
  latest.current = location

  useEffect(() => {
    const loc = latest.current
    if (qs === loc.search.replace(/^\?/, '')) return
    navigate({ pathname: loc.pathname, search: qs ? `?${qs}` : '' }, { replace: true, state: loc.state })
  }, [qs, navigate])
}

/**
 * 사이드바에서 같은 메뉴를 다시 눌러 주소가 맨 주소(필터 없음)로 바뀌면 reset 호출 — 첫 화면 상태로
 * (필터를 모두 지워 주소가 비게 된 경우에도 호출되지만 이미 기본값이라 영향 없음)
 */
export function useResetOnBareUrl(reset: () => void) {
  const location = useLocation()
  const first = useRef(true)
  const cb = useRef(reset)
  cb.current = reset
  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (!location.search) cb.current()
  }, [location.key, location.search])
}
