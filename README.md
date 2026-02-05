README

What this repo is
- cursedAI is a staged build of a single Next.js app and Supabase backend.

How stages will run
- Each stage updates the same codebase inside Project folder/.
- You must confirm before proceeding to the next stage.

Supabase setup
- Create a Supabase project and open the SQL editor.
- Run `Project folder/supabase/schema.sql`.
- Run `Project folder/supabase/seed.sql`.
- Create a Storage bucket named `media` and make it public (or allow read access via policies).
- Enable email/password auth in Supabase Auth settings.
- Create a `.env.local` in `Project folder/app` with:
  - `NEXT_PUBLIC_SUPABASE_URL=your-project-url`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key`
  - `NEXT_PUBLIC_ADMIN_EMAILS=admin1@example.com,admin2@example.com`

Local dev
- cd "Project folder/app"
- npm install
- npm run dev

Deployment
- Create a Supabase project, run the schema/seed, set up Storage and Auth.
- Deploy the Next.js app to Vercel.
- Add env vars in Vercel:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_ADMIN_EMAILS`
- Deploy the Supabase Edge Function `rateMedia`.
- Validate Storage bucket policies for authenticated upload and public reads.

QA checklist
- Feed remains single-column with one dominant media item per row.
- Rating prompt always shows the last viewed item thumbnail.
- Graveyard excludes from main feed and orders least cursed first.
- Report + admin hide/remove remove items immediately.
- Ads show at 25/50/75 depth, max 3, with 2-minute spacing.
