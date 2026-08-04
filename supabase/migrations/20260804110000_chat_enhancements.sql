-- Add pinning and editing to messages
ALTER TABLE public.messages 
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS edit_history JSONB DEFAULT '[]'::jsonb;

-- Grant access for these columns
GRANT UPDATE(is_pinned, body, edited_at, edit_history) ON public.messages TO authenticated;
