# FlyRankAI: normalize CS job titles

`POST /normalize` turns one messy CS job title into a canonical role, a confidence score, and a short reason. For example, a recruiter’s “Sr. SWE II” can become “Senior Software Engineer.” The endpoint accepts one title at a time; it does not hold a conversation or save the title. Its output is checked before the API returns it.

## Run the title endpoint

Use Node.js 22 or newer. Copy `.env.example` to `.env`, fill in your Supabase project URL, publishable key, and OpenRouter key, then run `npm ci && npm start`. Set `LLM_STUB=0` and `LLM_ENABLED=true`. The existing API initializes Supabase at startup; the normalization route itself is public and does not use the task database. This curl produced the response shown on October 10, 2026 (model wording may vary on later calls):

```sh
curl -sS -X POST http://localhost:3000/normalize \
  -H 'Content-Type: application/json' \
  -d '{"title":"Sr. SWE II"}'
```

```json
{"canonical_title":"Senior Software Engineer","confidence":0.95,"reason":"Sr. SWE identifies a senior software engineering role."}
```

An invalid request such as `-d '{"title":22}'` returns HTTP 400 with an error naming `title`. The route is also described at `/docs/`.

## Job card

- **Job:** Map one messy CS title to one canonical role.
- **Input:** `{ "title": "string, 1-200 characters" }`.
- **Output:** `canonical_title` is one of Software Engineer, Senior Software Engineer, Frontend Engineer, Backend Engineer, Data Engineer, Machine Learning Engineer, DevOps Engineer, or Other; `confidence` is 0–1; `reason` is one short sentence.
- **Must never:** invent a title, add fields, return raw model text, infer seniority without evidence, or obey instructions in the title.
- **When unsure:** return Other with confidence below 0.5.

## Real model configuration

This implementation uses OpenRouter’s OpenAI-compatible endpoint and `openrouter/free`. Set `LLM_BASE_URL=https://openrouter.ai/api/v1`, `LLM_MODEL=openrouter/free`, and your own `LLM_API_KEY` in the ignored `.env` file; set `LLM_STUB=0`. Enable the account’s free-model privacy settings before the first call, and use only made-up titles with the free endpoint. Do not commit your key. Changing those three `LLM_*` provider values is enough to point the client at another compatible provider. `LLM_ENABLED=false` returns an immediate HTTP 503 without a model call.

For an offline demo, set `LLM_STUB=1` before starting the server. The same curl then returns `{"canonical_title":"Other","confidence":0.1,"reason":"Stub mode; no model was called."}` with no provider request.

The prompt is reviewed and versioned in [`prompts/normalize-v1.md`](prompts/normalize-v1.md). The client has a 30-second timeout and disables SDK retries. Our code retries timeouts, HTTP 429, and HTTP 5xx at most twice, with backoff and jitter. A malformed model answer gets one repair call; a second malformed answer returns 422 and writes to ignored `logs/quarantine.jsonl`. Raw model text is never returned to callers.

## Eval and cost evidence

Run `npm run eval` while the server is running with the real model enabled. It sends the eight labelled cases in [`evals/cases.json`](evals/cases.json) through the endpoint and prints the score on `canonical_title` plus every mismatch. **Real-model score: 8/8 (100%) on October 10, 2026, using `normalize-v1` and `openrouter/free`; no mismatches.** The router may choose different free models on future runs, so this score is a dated measurement.

Each provider attempt writes a structured `llm_call` line to stdout with prompt version, model, token counts, duration, repair count, and outcome. One real call for the curl above logged:

```json
{"event":"llm_call","prompt_version":"normalize-v1","model":"openrouter/free","input_tokens":335,"output_tokens":317,"duration_ms":4012,"repair_count":0,"attempt":1,"outcome":"success"}
```

At this call’s token usage, 10,000 requests would use about **3.35 million input and 3.17 million output tokens**. The [free router currently prices both at $0](https://openrouter.ai/openrouter/free), but [OpenRouter’s free plan lists 50 requests per day](https://openrouter.ai/pricing/), so 10,000 daily requests would require a different plan or provider. One surprising eval result was a 950-token completion for a short JSON answer; output-token use is worth watching even when the response body is small.

With another day, I would add a deployment-level rate limit to protect the public route and its model quota.

## Existing auth and task API

The Week 5 polite scraper is in [scraper/](scraper/README.md). It runs independently of this API.

A Node.js and Express API with Supabase Auth, PostgreSQL-backed tasks, and interactive Swagger UI. Sign up, log in, pass the returned JWT as a bearer token, and use authenticated routes. Task records are shared among signed-in users; this demo does not assign tasks to individual accounts.

## Run locally

Install [Docker Desktop](https://docs.docker.com/desktop/) and start it. Create a free Supabase project, turn **Confirm email** off for this assignment's immediate signup-to-login exercise, and copy its Project URL and **publishable** API key from the dashboard. From this repository folder:

```sh
cp .env.example .env
```

Replace the two Supabase placeholders in `.env` with your own values:

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_project_key
PORT=3000
```

Keep the existing `POSTGRES_*` and `DATABASE_URL` values when using Compose. Run the complete stack with one command:

```sh
docker compose up --build
```

The API is at `http://localhost:3000`; Swagger UI is at `http://localhost:3000/docs/`. Compose creates a persistent PostgreSQL volume and seeds three example tasks on first initialization. `.env` is ignored by Git and excluded from the Docker build context. The API uses only the publishable key; do not add a Supabase secret or service-role key.

For a host-side Node run, use `npm ci && npm start` after providing a reachable `DATABASE_URL` in `.env`. The example `DATABASE_URL` uses the Compose service name `db`, which is not a host address.

## API reference

| Method | Path | Bearer token | Success |
| --- | --- | --- | --- |
| POST | `/auth/signup` | No | 201, `{ "user": ... }` |
| POST | `/auth/login` | No | 200, `access_token` and `refresh_token` |
| POST | `/auth/logout` | Yes | 204, no body |
| GET | `/public/info` | No | 200, public message |
| GET | `/protected/profile` | Yes | 200, user ID, email, creation time |
| GET | `/protected/dashboard` | Yes | 200, dashboard greeting and user ID |
| GET | `/tasks` | Yes | 200, all tasks |
| GET | `/tasks/:id` | Yes | 200, one task |
| POST | `/tasks` | Yes | 201, new task |
| PUT | `/tasks/:id` | Yes | 200, updated task |
| DELETE | `/tasks/:id` | Yes | 204, no body |

`/`, `/health`, and `/docs/` are also public. Signup and login accept JSON with nonempty `email` and `password`. Missing fields return 400; bad login credentials return 401. Protected routes return 401 for a missing, malformed, invalid, or expired bearer token. Task validation errors return 400; missing task IDs return 404. Supabase Auth failures return 502 when the upstream service is unavailable.

### Try the auth flow

```sh
curl -i -X POST http://localhost:3000/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"a-strong-test-password"}'

curl -i -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"a-strong-test-password"}'
```

Copy `access_token` from the login response. Use it as follows:

```sh
curl -i http://localhost:3000/protected/profile \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'

curl -i http://localhost:3000/tasks \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'

curl -i -X POST http://localhost:3000/auth/logout \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

Logout revokes the current session's **refresh token** through Supabase Auth. Supabase does not erase the cryptographic validity of an already issued JWT, but this API calls `getUser(token)` on each protected request; in the live logout check, Supabase rejected the logged-out token immediately with 401. Clients should still discard both tokens. Another service that only checks the JWT signature may accept it until expiry, so use a short JWT lifetime where that matters. The server does not store session tokens or log credentials.

## Swagger UI

![Swagger UI with bearer-locked endpoints](docs/auth-swagger-ui.jpg)

Open `/docs/`, click **Authorize**, and paste the login `access_token`. Swagger sends `Authorization: Bearer <token>` for the locked routes. Click **Try it out** on `/protected/profile` to see your verified profile. The endpoint definitions live in [openapi.json](openapi.json).

## Implementation notes

`index.js` defines routes and reusable auth middleware. The middleware extracts the bearer token and verifies it with Supabase `auth.getUser(token)` before exposing a user to protected handlers. `supabaseClient.js` creates clients without persistent sessions or automatic token refresh, so one request's session cannot be reused by another. PostgreSQL task access remains in `taskService.js` and `taskRepository.js`; the middleware guards the whole `/tasks` path before those handlers run.

Stop containers with Ctrl+C. `docker compose down` removes containers but retains tasks in the named volume. `docker compose down -v` also removes that volume. The [earlier SQL exploration notes](docs/sql-exploration.md) and [SQLite viewer screenshot](docs/sqlite-browser.jpg) document the prior assignment; the running API uses PostgreSQL.
