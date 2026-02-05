SPEC-api-and-database-v1 (Supabase-first)

Tables needed:
- sessions (anonymous)
- media (items)
- ratings (unique per session+media)
- reports
- users (optional; Supabase auth handles)

Core requirements:
- Session created on first visit, stored client-side.
- Feed loads media items from DB.
- Rating submission requires session_id, media_id, rating.
- Duplicate rating blocked.
- Reports stored with reason codes.
- In v1, use Supabase queries; engine logic via Edge Function in Stage 3.

END.