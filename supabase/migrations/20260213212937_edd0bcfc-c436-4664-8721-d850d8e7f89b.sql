-- Drop and recreate chat_conversations INSERT policy targeting authenticated role
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.chat_conversations;
CREATE POLICY "Authenticated users can create conversations"
  ON public.chat_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Fix chat_participants INSERT policy
DROP POLICY IF EXISTS "Authenticated users can add participants" ON public.chat_participants;
CREATE POLICY "Authenticated users can add participants"
  ON public.chat_participants FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Fix chat_messages INSERT policy
DROP POLICY IF EXISTS "Users can send messages in their conversations" ON public.chat_messages;
CREATE POLICY "Users can send messages in their conversations"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid() AND is_chat_participant(auth.uid(), conversation_id));

-- Fix SELECT policies to target authenticated
DROP POLICY IF EXISTS "Users can view own conversations" ON public.chat_conversations;
CREATE POLICY "Users can view own conversations"
  ON public.chat_conversations FOR SELECT
  TO authenticated
  USING (is_chat_participant(auth.uid(), id));

DROP POLICY IF EXISTS "Participants can update conversation timestamp" ON public.chat_conversations;
CREATE POLICY "Participants can update conversation timestamp"
  ON public.chat_conversations FOR UPDATE
  TO authenticated
  USING (is_chat_participant(auth.uid(), id));

DROP POLICY IF EXISTS "Users can view participants in their conversations" ON public.chat_participants;
CREATE POLICY "Users can view participants in their conversations"
  ON public.chat_participants FOR SELECT
  TO authenticated
  USING (is_chat_participant(auth.uid(), conversation_id));

DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.chat_messages;
CREATE POLICY "Users can view messages in their conversations"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (is_chat_participant(auth.uid(), conversation_id));

-- Fix typing/presence policies
DROP POLICY IF EXISTS "Users can upsert own typing status" ON public.chat_typing_status;
CREATE POLICY "Users can upsert own typing status"
  ON public.chat_typing_status FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_chat_participant(auth.uid(), conversation_id));

DROP POLICY IF EXISTS "Users can update own typing status" ON public.chat_typing_status;
CREATE POLICY "Users can update own typing status"
  ON public.chat_typing_status FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view typing in their conversations" ON public.chat_typing_status;
CREATE POLICY "Users can view typing in their conversations"
  ON public.chat_typing_status FOR SELECT
  TO authenticated
  USING (is_chat_participant(auth.uid(), conversation_id));

DROP POLICY IF EXISTS "Anyone authenticated can view presence" ON public.chat_presence;
CREATE POLICY "Anyone authenticated can view presence"
  ON public.chat_presence FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can upsert own presence" ON public.chat_presence;
CREATE POLICY "Users can upsert own presence"
  ON public.chat_presence FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own presence" ON public.chat_presence;
CREATE POLICY "Users can update own presence"
  ON public.chat_presence FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());