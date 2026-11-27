-- Phase 3 Banner Controls: alt_text, text_color, overlay_opacity, start_date, end_date, target_audience
ALTER TABLE public.promotional_banners
  ADD COLUMN IF NOT EXISTS alt_text TEXT,
  ADD COLUMN IF NOT EXISTS text_color TEXT DEFAULT '#FFFFFF',
  ADD COLUMN IF NOT EXISTS overlay_opacity INTEGER DEFAULT 75,
  ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS target_audience TEXT DEFAULT 'all';
