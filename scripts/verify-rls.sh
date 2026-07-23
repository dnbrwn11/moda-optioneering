#!/usr/bin/env bash
# RLS / auth verification (plan §10 A–D). Reads config from the environment:
#   SUPABASE_URL           required
#   SUPABASE_ANON_KEY      required
#   USER_A_EMAIL/USER_A_PASSWORD   optional — enables authed-read checks
#   USER_B_EMAIL/USER_B_PASSWORD   optional — enables cross-user isolation checks
# Never takes the service key. Exit code 0 = all executed checks passed.
set -u

: "${SUPABASE_URL:?export SUPABASE_URL first}"
: "${SUPABASE_ANON_KEY:?export SUPABASE_ANON_KEY first}"

PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  PASS  $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  FAIL  $1"; }

echo "A. Unauthenticated access must be denied"
for t in line_items app_constants scenarios user_state; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$SUPABASE_URL/rest/v1/$t?select=*" \
    -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_ANON_KEY")
  if [ "$code" = "401" ] || [ "$code" = "403" ]; then ok "anon $t -> $code"; else bad "anon $t -> $code (expected 401/403)"; fi
done
code=$(curl -s -o /dev/null -w "%{http_code}" "$SUPABASE_URL/rest/v1/line_items?select=*")
if [ "$code" = "401" ]; then ok "no apikey -> 401"; else bad "no apikey -> $code (expected 401)"; fi

echo "B. Signups must be disabled"
body=$(curl -s "$SUPABASE_URL/auth/v1/signup" -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" -d '{"email":"probe@example.com","password":"x1y2z3w4pq"}')
if echo "$body" | grep -qi "not allowed\|disabled"; then ok "signup rejected"; else bad "signup response: $body"; fi

token_for() {
  curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"$2\"}" |
    sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p'
}

if [ -n "${USER_A_EMAIL:-}" ] && [ -n "${USER_A_PASSWORD:-}" ]; then
  echo "C. Authenticated reads (user A)"
  TOKEN_A=$(token_for "$USER_A_EMAIL" "$USER_A_PASSWORD")
  if [ -z "$TOKEN_A" ]; then bad "could not get token for user A"; else
    n=$(curl -s "$SUPABASE_URL/rest/v1/line_items?select=id" \
      -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN_A" | grep -o '"id"' | wc -l)
    if [ "$n" = "65" ]; then ok "line_items rows: $n"; else bad "line_items rows: $n (expected 65)"; fi
    code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SUPABASE_URL/rest/v1/line_items" \
      -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN_A" \
      -H "Content-Type: application/json" -d '{"id":"HACK-01"}')
    if [ "$code" = "401" ] || [ "$code" = "403" ]; then ok "authed write to line_items -> $code"; else bad "authed write -> $code (expected 401/403)"; fi
  fi

  if [ -n "${USER_B_EMAIL:-}" ] && [ -n "${USER_B_PASSWORD:-}" ] && [ -n "${TOKEN_A:-}" ]; then
    echo "D. Cross-user isolation (A creates, B must not see)"
    row=$(curl -s -X POST "$SUPABASE_URL/rest/v1/scenarios" \
      -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN_A" \
      -H "Content-Type: application/json" -H "Prefer: return=representation" \
      -d '{"id":"rls-probe","name":"RLS probe","snapshot":{"itemState":{},"rates":{"2026":0.05,"2027":0.05,"2028":0.05,"2029":0.05}}}')
    if echo "$row" | grep -q '"rls-probe"'; then ok "A created probe scenario"; else bad "A create failed: $row"; fi
    TOKEN_B=$(token_for "$USER_B_EMAIL" "$USER_B_PASSWORD")
    if [ -z "$TOKEN_B" ]; then bad "could not get token for user B"; else
      seen=$(curl -s "$SUPABASE_URL/rest/v1/scenarios?select=id" \
        -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN_B")
      if echo "$seen" | grep -q 'rls-probe'; then bad "B can see A's scenario"; else ok "B sees none of A's scenarios ($seen)"; fi
      patched=$(curl -s -X PATCH "$SUPABASE_URL/rest/v1/scenarios?id=eq.rls-probe" \
        -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN_B" \
        -H "Content-Type: application/json" -H "Prefer: return=representation" -d '{"name":"pwned"}')
      if [ "$patched" = "[]" ]; then ok "B's PATCH affected 0 rows"; else bad "B PATCH result: $patched"; fi
    fi
    curl -s -o /dev/null -X DELETE "$SUPABASE_URL/rest/v1/scenarios?id=eq.rls-probe" \
      -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN_A"
  fi
else
  echo "C/D skipped — set USER_A_EMAIL/USER_A_PASSWORD (and USER_B_*) to run them."
fi

echo
echo "$PASS passed, $FAIL failed"
[ "$FAIL" = "0" ]
