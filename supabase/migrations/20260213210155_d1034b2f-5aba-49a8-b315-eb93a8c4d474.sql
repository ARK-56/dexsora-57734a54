
-- Fix chat RLS infinite recursion by using security definer function
CREATE OR REPLACE FUNCTION public.is_chat_participant(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE user_id = _user_id AND conversation_id = _conversation_id
  )
$$;

-- Drop old broken policies
DROP POLICY IF EXISTS "Users can view own conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Participants can update conversation timestamp" ON public.chat_conversations;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can send messages in their conversations" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can view own participations" ON public.chat_participants;

-- Recreate with security definer function
CREATE POLICY "Users can view own conversations" ON public.chat_conversations
  FOR SELECT USING (is_chat_participant(auth.uid(), id));

CREATE POLICY "Participants can update conversation timestamp" ON public.chat_conversations
  FOR UPDATE USING (is_chat_participant(auth.uid(), id));

CREATE POLICY "Users can view messages in their conversations" ON public.chat_messages
  FOR SELECT USING (is_chat_participant(auth.uid(), conversation_id));

CREATE POLICY "Users can send messages in their conversations" ON public.chat_messages
  FOR INSERT WITH CHECK (sender_id = auth.uid() AND is_chat_participant(auth.uid(), conversation_id));

-- For chat_participants: admins can add, users can view their own conversations' participants
CREATE POLICY "Users can view participants in their conversations" ON public.chat_participants
  FOR SELECT USING (is_chat_participant(auth.uid(), conversation_id));

-- Create typing status table
CREATE TABLE public.chat_typing_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  is_typing boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

ALTER TABLE public.chat_typing_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view typing in their conversations" ON public.chat_typing_status
  FOR SELECT USING (is_chat_participant(auth.uid(), conversation_id));

CREATE POLICY "Users can upsert own typing status" ON public.chat_typing_status
  FOR INSERT WITH CHECK (user_id = auth.uid() AND is_chat_participant(auth.uid(), conversation_id));

CREATE POLICY "Users can update own typing status" ON public.chat_typing_status
  FOR UPDATE USING (user_id = auth.uid());

-- Create online presence table
CREATE TABLE public.chat_presence (
  user_id uuid PRIMARY KEY,
  is_online boolean NOT NULL DEFAULT false,
  last_seen timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view presence" ON public.chat_presence
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can upsert own presence" ON public.chat_presence
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own presence" ON public.chat_presence
  FOR UPDATE USING (user_id = auth.uid());

-- Add file attachment columns to chat_messages
ALTER TABLE public.chat_messages ADD COLUMN file_url text;
ALTER TABLE public.chat_messages ADD COLUMN file_name text;
ALTER TABLE public.chat_messages ADD COLUMN file_type text;

-- Enable realtime for typing and presence
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_typing_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_presence;

-- Create chat-attachments storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-attachments', 'chat-attachments', false);

CREATE POLICY "Chat users can upload attachments" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Chat users can view attachments" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL);
