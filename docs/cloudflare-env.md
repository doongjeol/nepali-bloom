# Cloudflare Workers (Wrangler) 환경변수 설정

이 프로젝트는 `wrangler.jsonc`를 사용합니다.

## 1) 공개 변수(vars) 설정

`wrangler.jsonc`의 `"vars"`에 아래 값을 설정합니다.

- `SUPABASE_URL`: Supabase Project URL
- `VITE_SUPABASE_URL`: Supabase Project URL (클라이언트 번들에 필요)
- `VITE_SUPABASE_ANON_KEY`: Supabase anon public key (클라이언트 번들에 필요)

예시:

```jsonc
{
  "vars": {
    "SUPABASE_URL": "https://<project-ref>.supabase.co",
    "VITE_SUPABASE_URL": "https://<project-ref>.supabase.co",
    "VITE_SUPABASE_ANON_KEY": "<anon-public-key>"
  }
}
```

## 2) 비밀키(secret) 설정 (필수)

아래 값은 절대 `VITE_`로 시작하면 안 됩니다. (브라우저에 노출되면 안 됨)

- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service_role key

설정 명령:

```bash
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

확인:

```bash
wrangler secret list
```

## 3) 배포

```bash
wrangler deploy
```

