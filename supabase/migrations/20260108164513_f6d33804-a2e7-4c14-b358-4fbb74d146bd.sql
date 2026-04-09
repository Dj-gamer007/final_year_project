-- Add email column to participants table
ALTER TABLE public.participants 
ADD COLUMN email TEXT;

-- Create index for faster email lookups
CREATE INDEX idx_participants_email ON public.participants(email) WHERE email IS NOT NULL;