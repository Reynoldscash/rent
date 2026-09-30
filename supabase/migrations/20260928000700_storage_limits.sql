-- =============================================================================
-- Easy Rent — 0007: upload limits enforced by Supabase Storage
-- Matches the client-side checks in lib/storage.ts (5 MB; JPEG, PNG, WebP).
-- =============================================================================

update storage.buckets
set file_size_limit    = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id in ('listing-images', 'avatars');
