ALTER TABLE public.summaries DROP CONSTRAINT IF EXISTS summaries_role_check;

ALTER TABLE public.summaries
ADD CONSTRAINT summaries_role_check
CHECK (
  role = ANY (
    ARRAY[
      'general'::text,
      'developer'::text,
      'manager'::text,
      'student'::text,
      'client'::text,
      'designer'::text,
      'others'::text
    ]
  )
);