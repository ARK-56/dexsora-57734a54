import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Send, Plus, Users, MessageCircle, X, ArrowLeft } from "lucide-react";

interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface Participant {
  user_id: string;
  conversation_id: string;
}

interface ProfileInfo {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

export const AdminChat = () => {
  const { user, profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [allProfiles, setAllProfiles] = useState<ProfileInfo[]>([]);
  const [messageText, setMessageText] = useState("");
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [newConvoType, setNewConvoType] = useState<"dm" | "group">("dm");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = useCallback(async () => {
    const { data } = await supabase
      .from("chat_conversations")
      .select("*")
      .order("updated_at", { ascending: false });
    setConversations((data as Conversation[]) || []);
    setLoading(false);
  }, []);

  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, email");
    setAllProfiles((data as ProfileInfo[]) || []);
  }, []);

  const fetchParticipants = useCallback(async () => {
    const { data } = await supabase
      .from("chat_participants")
      .select("user_id, conversation_id");
    setParticipants((data as Participant[]) || []);
  }, []);

  useEffect(() => {
    fetchConversations();
    fetchProfiles();
    fetchParticipants();
  }, [fetchConversations, fetchProfiles, fetchParticipants]);

  // Fetch messages for active conversation
  useEffect(() => {
    if (!activeConvo) {
      setMessages([]);
      return;
    }
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", activeConvo.id)
        .order("created_at", { ascending: true });
      setMessages((data as Message[]) || []);
    };
    fetchMessages();
  }, [activeConvo?.id]);

  // Realtime messages
  useEffect(() => {
    if (!activeConvo) return;
    const channel = supabase
      .channel(`chat-${activeConvo.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `conversation_id=eq.${activeConvo.id}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConvo?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const getProfileName = (userId: string) => {
    const p = allProfiles.find((pr) => pr.user_id === userId);
    return p?.full_name || p?.email || "Unknown";
  };

  const getConvoDisplayName = (convo: Conversation) => {
    if (convo.is_group && convo.name) return convo.name;
    // For DMs, show the other person's name
    const convoParticipants = participants.filter((p) => p.conversation_id === convo.id);
    const other = convoParticipants.find((p) => p.user_id !== user?.id);
    return other ? getProfileName(other.user_id) : "Chat";
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !activeConvo || !user) return;
    const text = messageText.trim();
    setMessageText("");
    await supabase.from("chat_messages").insert({
      conversation_id: activeConvo.id,
      sender_id: user.id,
      content: text,
    });
    // Update conversation updated_at
    await supabase
      .from("chat_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", activeConvo.id);
  };

  const createConversation = async () => {
    if (!user) return;
    if (selectedUsers.length === 0) return;

    // For DM, check if conversation already exists
    if (newConvoType === "dm" && selectedUsers.length === 1) {
      const existingDm = conversations.find((c) => {
        if (c.is_group) return false;
        const convoPs = participants.filter((p) => p.conversation_id === c.id);
        const userIds = convoPs.map((p) => p.user_id);
        return userIds.includes(user.id) && userIds.includes(selectedUsers[0]);
      });
      if (existingDm) {
        setActiveConvo(existingDm);
        setShowNewConvo(false);
        setSelectedUsers([]);
        return;
      }
    }

    const isGroup = newConvoType === "group";
    const { data: convo } = await supabase
      .from("chat_conversations")
      .insert({
        name: isGroup ? groupName || "Group Chat" : null,
        is_group: isGroup,
        created_by: user.id,
      })
      .select()
      .single();

    if (!convo) return;

    // Add all selected users + self as participants
    const allParticipantIds = [...new Set([user.id, ...selectedUsers])];
    await supabase.from("chat_participants").insert(
      allParticipantIds.map((uid) => ({
        conversation_id: convo.id,
        user_id: uid,
      }))
    );

    setShowNewConvo(false);
    setSelectedUsers([]);
    setGroupName("");
    await fetchConversations();
    await fetchParticipants();
    setActiveConvo(convo as Conversation);
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const otherProfiles = allProfiles.filter((p) => p.user_id !== user?.id);

  const initials = (name: string) =>
    name.split(" ").filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="flex h-[600px] overflow-hidden rounded-xl border border-border bg-card">
      {/* Sidebar */}
      <div className={`w-full sm:w-72 shrink-0 border-r border-border flex flex-col ${activeConvo ? "hidden sm:flex" : "flex"}`}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Messages</h3>
          <button
            onClick={() => setShowNewConvo(true)}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            title="New conversation"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              No conversations yet. Start one!
            </div>
          ) : (
            conversations.map((convo) => (
              <button
                key={convo.id}
                onClick={() => setActiveConvo(convo)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                  activeConvo?.id === convo.id ? "bg-primary/5 border-l-2 border-primary" : ""
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {convo.is_group ? <Users className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{getConvoDisplayName(convo)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(convo.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className={`flex-1 flex flex-col ${!activeConvo ? "hidden sm:flex" : "flex"}`}>
        {activeConvo ? (
          <>
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <button
                onClick={() => setActiveConvo(null)}
                className="sm:hidden flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
              >
                <ArrowLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                {activeConvo.is_group ? <Users className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{getConvoDisplayName(activeConvo)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {participants.filter((p) => p.conversation_id === activeConvo.id).length} members
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((msg) => {
                const isOwn = msg.sender_id === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-xl px-3 py-2 ${
                      isOwn
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}>
                      {!isOwn && (
                        <p className="text-[10px] font-medium mb-0.5 opacity-70">{getProfileName(msg.sender_id)}</p>
                      )}
                      <p className="text-sm break-words">{msg.content}</p>
                      <p className={`text-[10px] mt-1 ${isOwn ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-border p-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
                  placeholder="Type a message..."
                  className="flex-1 h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-ring"
                />
                <button
                  onClick={sendMessage}
                  disabled={!messageText.trim()}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select a conversation or start a new one</p>
            </div>
          </div>
        )}
      </div>

      {/* New Conversation Modal */}
      {showNewConvo && (
        <>
          <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm" onClick={() => setShowNewConvo(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl animate-fade-in">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2 className="font-display text-base font-bold text-foreground">New Conversation</h2>
                <button onClick={() => setShowNewConvo(false)} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-muted">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Type toggle */}
                <div className="flex gap-1 rounded-lg border border-border p-1">
                  <button
                    onClick={() => { setNewConvoType("dm"); setSelectedUsers([]); }}
                    className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                      newConvoType === "dm" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Direct Message
                  </button>
                  <button
                    onClick={() => { setNewConvoType("group"); setSelectedUsers([]); }}
                    className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                      newConvoType === "group" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Group Chat
                  </button>
                </div>

                {newConvoType === "group" && (
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Group name..."
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-ring"
                  />
                )}

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Select {newConvoType === "dm" ? "a user" : "users"}
                  </p>
                  <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-border p-2">
                    {otherProfiles.map((p) => (
                      <button
                        key={p.user_id}
                        onClick={() => {
                          if (newConvoType === "dm") {
                            setSelectedUsers([p.user_id]);
                          } else {
                            toggleUserSelection(p.user_id);
                          }
                        }}
                        className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors ${
                          selectedUsers.includes(p.user_id)
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-muted text-foreground"
                        }`}
                      >
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                          {initials(p.full_name || p.email || "?")}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{p.full_name || "No name"}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{p.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={createConversation}
                  disabled={selectedUsers.length === 0}
                  className="w-full h-9 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {newConvoType === "dm" ? "Start Chat" : "Create Group"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
