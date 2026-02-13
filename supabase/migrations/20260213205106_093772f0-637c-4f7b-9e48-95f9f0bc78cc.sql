
-- Chat conversations (DMs and groups)
CREATE TABLE public.chat_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT, -- null for DMs, set for groups
  is_group BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Participants in conversations
CREATE TABLE public.chat_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- Messages
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS: users can see conversations they participate in
CREATE POLICY "Users can view own conversations"
  ON public.chat_conversations FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.chat_participants WHERE conversation_id = id AND user_id = auth.uid()));

CREATE POLICY "Admin users can create conversations"
  ON public.chat_conversations FOR INSERT
  WITH CHECK (has_admin_access(auth.uid()));

CREATE POLICY "Users can view own participations"
  ON public.chat_participants FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.chat_participants cp WHERE cp.conversation_id = chat_participants.conversation_id AND cp.user_id = auth.uid()));

CREATE POLICY "Admin users can add participants"
  ON public.chat_participants FOR INSERT
  WITH CHECK (has_admin_access(auth.uid()));

CREATE POLICY "Users can view messages in their conversations"
  ON public.chat_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.chat_participants WHERE conversation_id = chat_messages.conversation_id AND user_id = auth.uid()));

CREATE POLICY "Users can send messages in their conversations"
  ON public.chat_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.chat_participants WHERE conversation_id = chat_messages.conversation_id AND user_id = auth.uid()));

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
