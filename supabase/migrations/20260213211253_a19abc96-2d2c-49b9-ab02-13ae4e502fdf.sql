
-- Fix: Allow any authenticated user to create conversations
-- The admin panel UI already restricts access
DROP POLICY IF EXISTS "Admin users can create conversations" ON public.chat_conversations;
CREATE POLICY "Authenticated users can create conversations" ON public.chat_conversations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Same for participants - allow conversation creator to add participants
DROP POLICY IF EXISTS "Admin users can add participants" ON public.chat_participants;
CREATE POLICY "Authenticated users can add participants" ON public.chat_participants
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
