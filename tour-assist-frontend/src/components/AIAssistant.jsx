import React, { useState, useEffect, useRef } from "react";

// Icons
const ChatIcon = ({ className = "w-6 h-6" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
  </svg>
);

const CloseIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const SendIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const HistoryIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const PlusIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const EditIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

const DeleteIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

// We leverage the simplest logic for API URL so this component is portable
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (import.meta.env.MODE === "production" || window.location.hostname !== "localhost") {
    return "https://tour-assist-app.onrender.com";
  }
  return "http://localhost:8000";
};

const API_BASE_URL = getApiBaseUrl();

export default function AIAssistant({ filters, setFilters, userLocation, PlaceCardComponent, placeContext = null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(() => crypto.randomUUID());
  const [showHistoryList, setShowHistoryList] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editChatName, setEditChatName] = useState("");
  const messagesEndRef = useRef(null);

  const PROACTIVE_GREETING_PROMPT = placeContext 
    ? `Say a short friendly hello and proactively share a small, interesting fact about the place they are currently viewing: '${placeContext}'. Ask them if they'd like to know more.`
    : "Say a short, friendly hello and proactively ask me what type of place I want to visit (like Restaurants, Hotels, or something else) so you can find the nearest matching results based on my location.";

  // Initialize with greeting
  useEffect(() => {
    if (messages.length === 0 && isOpen) {
      sendAIRequest([{ role: "user", content: PROACTIVE_GREETING_PROMPT }]);
    }
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const fetchHistoryList = async () => {
    if (isLoading) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/history`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setHistoryList(data);
        setShowHistoryList(prev => !prev);
      }
    } catch (err) {
      console.error("Failed to load history list", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSessionHistory = async (sessionId) => {
    if (isLoading) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/history/${sessionId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const formattedHistory = data.map(msg => ({
          role: msg.role === 'model' ? 'assistant' : msg.role,
          content: msg.content,
          places: msg.places_json ? JSON.parse(msg.places_json) : []
        }));
        setMessages(formattedHistory);
        setCurrentSessionId(sessionId);
        setShowHistoryList(false);
      }
    } catch (err) {
      console.error("Failed to load session", err);
    } finally {
      setIsLoading(false);
    }
  };

  const renameSession = async (sessionId) => {
    const token = localStorage.getItem("token");
    if (!token || !editChatName.trim()) {
      setEditingSessionId(null);
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/history/${sessionId}`, {
        method: "PUT",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ chat_name: editChatName })
      });
      if (response.ok) {
        setHistoryList(prev => prev.map(s => s.session_id === sessionId ? { ...s, chat_name: editChatName } : s));
      }
    } catch (err) {
      console.error("Failed to rename session", err);
    } finally {
      setEditingSessionId(null);
    }
  };

  const deleteSession = async (sessionId, e) => {
    e.stopPropagation();
    const token = localStorage.getItem("token");
    if (!token) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/history/${sessionId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        setHistoryList(prev => prev.filter(s => s.session_id !== sessionId));
        if (currentSessionId === sessionId) {
           startNewChat();
        }
      }
    } catch (err) {
      console.error("Failed to delete session", err);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setCurrentSessionId(crypto.randomUUID());
    setShowHistoryList(false);
    sendAIRequest([{ role: "user", content: PROACTIVE_GREETING_PROMPT }]);
  };

  const sendAIRequest = async (chatHistory) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/suggest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": localStorage.getItem("token") ? `Bearer ${localStorage.getItem("token")}` : ""
        },
        body: JSON.stringify({
          history: chatHistory,
          filters: filters || {},
          budget: [],
          session_id: currentSessionId,
          user_location: userLocation || null
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, { role: "assistant", content: data.reply, places: data.places || [] }]);
        if (data.new_filters && setFilters) {
          setFilters(prev => ({ ...prev, ...data.new_filters }));
        }
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: "Oops, my circuits are a bit jumbled. Try again later!" }]);
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: "assistant", content: "I'm having trouble connecting to the network right now." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMessages = [...messages, { role: "user", content: inputText }];
    setMessages(newMessages);
    setInputText("");
    
    // We filter out the internal welcome trigger if present, to not confuse the AI
    const apiHistory = newMessages.filter(m => !(m.role === "user" && m.content.includes("friendly hello")));
    
    sendAIRequest(apiHistory);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div className="mb-4 w-[calc(100vw-3rem)] sm:w-[380px] h-[500px] max-h-[70vh] bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-white/40 dark:border-gray-700/50 shadow-2xl rounded-2xl flex flex-col overflow-hidden animate-fade-in-up transition-all duration-300">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-accent p-4 text-white flex justify-between items-center shadow-md">
            <div className="flex items-center gap-2">
              <span className="text-xl">🧭</span>
              <div>
                <h3 className="font-bold font-serif">Odyssey AI</h3>
                <p className="text-[10px] opacity-80 uppercase tracking-wider font-semibold">Proactive Assistant</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <button 
                onClick={startNewChat} 
                title="New Chat"
                disabled={isLoading}
                className={`p-1.5 rounded-full transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/20'}`}
              >
                <PlusIcon />
              </button>
              {localStorage.getItem("token") && (
                <button 
                  onClick={fetchHistoryList} 
                  title="Toggle Chat History"
                  disabled={isLoading}
                  className={`p-1.5 rounded-full transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : (showHistoryList ? 'bg-white/30' : 'hover:bg-white/20')}`}
                >
                  <HistoryIcon />
                </button>
              )}
              <button 
                onClick={() => setIsOpen(false)} 
                title="Close"
                className="hover:bg-white/20 p-1.5 rounded-full transition-colors"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          {/* Messages or History List Area */}
          {showHistoryList ? (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 custom-scrollbar">
              <h4 className="font-bold text-lg mb-2 text-text-main flex items-center justify-between">
                <span>Past Chats</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowHistoryList(false); }}
                  title="Close History"
                  className="p-1 opacity-60 hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              </h4>
              <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                {historyList.length === 0 && <p className="text-sm opacity-60">No past chats found.</p>}
                {historyList.map(session => (
                  <div key={session.session_id} className="bg-surface border border-secondary p-3 rounded-xl flex justify-between items-center hover:shadow-md cursor-pointer transition-all border-l-4 hover:border-l-primary" 
                       onClick={() => editingSessionId !== session.session_id && loadSessionHistory(session.session_id)}>
                    <div className="flex-1 mr-2 overflow-hidden">
                      {editingSessionId === session.session_id ? (
                        <input 
                          className="w-full bg-transparent border-b border-primary focus:outline-none text-text-main font-semibold"
                          value={editChatName}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditChatName(e.target.value)}
                          onBlur={() => renameSession(session.session_id)}
                          onKeyDown={(e) => e.key === 'Enter' && renameSession(session.session_id)}
                        />
                      ) : (
                        <span className="font-bold text-text-main block truncate text-sm mb-1">{session.chat_name}</span>
                      )}
                      <span className="block text-[10px] text-gray-500 font-medium">
                        {new Date(session.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center shrink-0">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setEditChatName(session.chat_name); setEditingSessionId(session.session_id); }}
                        className="p-2 opacity-60 hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                        title="Rename Chat"
                      >
                        <EditIcon className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => deleteSession(session.session_id, e)}
                        className="p-2 opacity-60 hover:opacity-100 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/30 rounded-full transition-colors"
                        title="Delete Chat"
                      >
                        <DeleteIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
              {messages.filter(m => !(m.role === 'user' && m.content.includes("friendly hello"))).map((msg, idx) => (
                <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-primary text-white rounded-br-none' 
                      : 'bg-surface border border-secondary text-text-main rounded-bl-none'
                  }`}>
                    {msg.content}
                  </div>
                  
                  {/* Render suggested places directly in chat! */}
                  {msg.places && msg.places.length > 0 && PlaceCardComponent && (
                    <div className="mt-3 flex flex-col gap-3 w-full max-w-[95%]">
                      {msg.places.map((place, pIdx) => (
                        <div key={pIdx} className="w-full transform transition-transform hover:scale-[1.02]">
                          <PlaceCardComponent place={place} userLocation={userLocation} priority={false} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex items-start">
                  <div className="bg-surface border border-secondary text-text-main px-4 py-3 rounded-2xl rounded-bl-none shadow-sm flex gap-1 items-center">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Input Area (hide when viewing history list) */}
          {!showHistoryList && (
            <form onSubmit={handleSend} className="p-3 bg-surface border-t border-secondary/50 flex gap-2">
              <input 
                type="text" 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask for recommendations..." 
                className="flex-1 bg-transparent border border-gray-300 dark:border-gray-600 rounded-full px-4 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
              <button 
                type="submit" 
                disabled={!inputText.trim() || isLoading}
                className="bg-primary hover:bg-opacity-90 disabled:opacity-50 text-white p-2.5 rounded-full transition-colors flex items-center justify-center shadow-md transform hover:scale-105 active:scale-95"
              >
                <SendIcon className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      )}

      {/* Floating Button */}
      <button 
        id="ai-trigger"
        onClick={() => setIsOpen(!isOpen)}
        className={`bg-gradient-to-r from-primary to-accent text-white p-4 rounded-full shadow-2xl hover:shadow-primary/50 transition-all duration-300 transform hover:scale-110 flex items-center justify-center ${isOpen ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'}`}
      >
        <ChatIcon />
      </button>
    </div>
  );
}
