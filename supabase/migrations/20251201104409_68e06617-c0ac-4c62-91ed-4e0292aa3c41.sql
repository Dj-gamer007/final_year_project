-- Fix timestamp_ms column to handle JavaScript timestamps
ALTER TABLE public.transcripts 
ALTER COLUMN timestamp_ms TYPE bigint;