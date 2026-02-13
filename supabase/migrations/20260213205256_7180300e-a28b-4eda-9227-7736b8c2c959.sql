
-- Allow participants to update conversation updated_at
CREATE POLICY "Participants can update conversation timestamp"
  ON public.chat_conversations FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.chat_participants WHERE conversation_id = id AND user_id = auth.uid()));
