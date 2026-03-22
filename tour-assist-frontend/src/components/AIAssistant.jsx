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

// We leverage the simplest logic for API URL so this component is portable
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (import.meta.env.MODE === "production" || window.location.hostname !== "localhost") {
    return "https://tour-assist-app.onrender.com";
  }
  return "http://localhost:8000";
};

const API_BASE_URL = getApiBaseUrl();

export default function AIAssistant({ filters, userLocation, PlaceCardComponent }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Initialize with greeting
  useEffect(() => {
    if (messages.length === 0 && isOpen) {
      sendAIRequest([{ role: "user", content: "Say a short, friendly hello and suggest something broadly based on my filters!" }]);
    }
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const fetchHistory = async () => {
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
        const formattedHistory = data.map(msg => ({
          role: msg.role === 'model' ? 'assistant' : msg.role,
          content: msg.content,
          places: msg.places_json ? JSON.parse(msg.places_json) : []
        }));
        if (formattedHistory.length > 0) {
           setMessages(formattedHistory);
        }
      }
    } catch (err) {
      console.error("Failed to load history", err);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    // Handled intrinsically by the useEffect that triggers when messages.length === 0,
    // but we can manually invoke it to be safe in case user closes directly.
    sendAIRequest([{ role: "user", content: "Say a short, friendly hello and suggest something broadly based on my filters!" }]);
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
          budget: []
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, { role: "assistant", content: data.reply, places: data.places || [] }]);
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
    const apiHistory = newMessages.filter(m => !(m.role === "user" && m.content.includes("Say a short, friendly hello")));
    
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
                  onClick={fetchHistory} 
                  title="Load Chat History"
                  disabled={isLoading}
                  className={`p-1.5 rounded-full transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/20'}`}
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

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
            {messages.filter(m => !(m.role === 'user' && m.content.includes("Say a short, friendly hello"))).map((msg, idx) => (
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

          {/* Input Area */}
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
        </div>
      )}

      {/* Floating Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`bg-gradient-to-r from-primary to-accent text-white p-4 rounded-full shadow-2xl hover:shadow-primary/50 transition-all duration-300 transform hover:scale-110 flex items-center justify-center ${isOpen ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'}`}
      >
        <ChatIcon />
      </button>
    </div>
  );
}
