
-- Fix: the INSERT policy on chat_conversations is RESTRICTIVE with no PERMISSIVE counterpart
-- Drop and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Admin users can create conversations" ON public.chat_conversations;

CREATE POLICY "Admin users can create conversations" ON public.chat_conversations
  FOR INSERT
  WITH CHECK (has_admin_access(auth.uid()));

-- Also fix chat_participants INSERT - same issue (RESTRICTIVE with no PERMISSIVE)
DROP POLICY IF EXISTS "Admin users can add participants" ON public.chat_participants;

CREATE POLICY "Admin users can add participants" ON public.chat_participants
  FOR INSERT
  WITH CHECK (has_admin_access(auth.uid()));

-- Fix chat_messages INSERT policy if also restrictive
DROP POLICY IF EXISTS "Users can send messages in their conversations" ON public.chat_messages;

CREATE POLICY "Users can send messages in their conversations" ON public.chat_messages
  FOR INSERT
  WITH CHECK (sender_id = auth.uid() AND is_chat_participant(auth.uid(), conversation_id));

-- Fix chat_typing_status INSERT
DROP POLICY IF EXISTS "Users can upsert own typing status" ON public.chat_typing_status;

CREATE POLICY "Users can upsert own typing status" ON public.chat_typing_status
  FOR INSERT
  WITH CHECK (user_id = auth.uid() AND is_chat_participant(auth.uid(), conversation_id));

-- Fix chat_presence INSERT
DROP POLICY IF EXISTS "Users can upsert own presence" ON public.chat_presence;

CREATE POLICY "Users can upsert own presence" ON public.chat_presence
  FOR INSERT
  WITH CHECK (user_id = auth.uid());
