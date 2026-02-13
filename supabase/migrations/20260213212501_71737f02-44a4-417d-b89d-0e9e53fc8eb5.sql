-- Grant access to chat tables for authenticated and anon roles
GRANT SELECT, INSERT, UPDATE ON public.chat_conversations TO authenticated;
GRANT SELECT, INSERT ON public.chat_participants TO authenticated;
GRANT SELECT, INSERT ON public.chat_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.chat_typing_status TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.chat_presence TO authenticated;

-- Also grant to anon for completeness
GRANT SELECT ON public.chat_conversations TO anon;
GRANT SELECT ON public.chat_participants TO anon;
GRANT SELECT ON public.chat_messages TO anon;
GRANT SELECT ON public.chat_presence TO anon;