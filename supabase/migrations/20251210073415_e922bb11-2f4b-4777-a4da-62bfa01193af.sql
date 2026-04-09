-- Create recordings table for storing meeting audio metadata
CREATE TABLE public.recordings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  duration_ms BIGINT NOT NULL DEFAULT 0,
  file_size BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public access (matching existing pattern)
CREATE POLICY "Allow public read access to recordings"
ON public.recordings FOR SELECT USING (true);

CREATE POLICY "Allow public insert to recordings"
ON public.recordings FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update to recordings"
ON public.recordings FOR UPDATE USING (true);

CREATE POLICY "Allow public delete to recordings"
ON public.recordings FOR DELETE USING (true);

-- Create storage bucket for audio recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('recordings', 'recordings', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for recordings bucket
CREATE POLICY "Allow public read access to recordings bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'recordings');

CREATE POLICY "Allow public upload to recordings bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'recordings');

CREATE POLICY "Allow public update to recordings bucket"
ON storage.objects FOR UPDATE
USING (bucket_id = 'recordings');

CREATE POLICY "Allow public delete from recordings bucket"
ON storage.objects FOR DELETE
USING (bucket_id = 'recordings');

-- Enable realtime for recordings
ALTER PUBLICATION supabase_realtime ADD TABLE public.recordings;