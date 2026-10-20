-- 첫 로그인 비밀번호 변경
-- 관리자가 계정 생성 후 app_metadata.must_change_password = true 를 넣으면,
-- 해당 사용자는 현재(임시) 비밀번호 확인 + 새 비밀번호 설정 전까지 앱을 쓸 수 없음.
-- 현재 비밀번호 검증·변경·플래그 해제를 서버에서 한 번에 처리 (클라이언트가 플래그만 지우는 우회 불가)
-- 2026-10-20 운영 DB에 적용됨 (Supabase MCP apply_migration)

create or replace function public.change_initial_password(current_password text, new_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  stored text;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select encrypted_password into stored from auth.users where id = uid;

  if stored is null or extensions.crypt(current_password, stored) <> stored then
    raise exception 'invalid_current_password';
  end if;

  if length(new_password) < 8 or new_password !~ '[A-Za-z]' or new_password !~ '[0-9]' then
    raise exception 'weak_password';
  end if;

  if new_password = current_password then
    raise exception 'same_password';
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
      raw_app_meta_data  = raw_app_meta_data - 'must_change_password',
      updated_at         = now()
  where id = uid;
end;
$$;

revoke all on function public.change_initial_password(text, text) from public, anon;
grant execute on function public.change_initial_password(text, text) to authenticated;
