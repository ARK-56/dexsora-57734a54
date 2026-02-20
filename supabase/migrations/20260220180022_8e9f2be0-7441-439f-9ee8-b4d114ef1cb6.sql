
-- Truncate all tables with cascade to handle FK constraints and triggers
TRUNCATE TABLE 
  public.leads,
  public.chat_messages,
  public.chat_participants,
  public.chat_typing_status,
  public.chat_presence,
  public.chat_conversations,
  public.org_members,
  public.org_insurances,
  public.org_items,
  public.subscriptions,
  public.organizations,
  public.user_roles,
  public.profiles,
  public.login_verifications
CASCADE;
