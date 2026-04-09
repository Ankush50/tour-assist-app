import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../App";

function Profile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username");

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    // Fetch mock profile data based on standard schemas
    fetch(`${API_BASE_URL}/api/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error("Could not fetch profile");
        return res.json();
      })
      .then(data => {
        setProfile(data);
        setLoading(false);
      })
      .catch(() => {
        // Fallback to mock data if endpoint is missing
        setProfile({
          username: username || "Explorer",
          tier: "Trailblazer",
          review_count: 12,
          geo_verified_count: 8,
          helpful_votes_received: 45,
          member_since: new Date().toISOString()
        });
        setLoading(false);
      });
  }, [token, navigate, username]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 font-bold">Loading passport...</p>
      </div>
    );
  }

  // Tiers aesthetic
  const TIER_COLORS = {
    "Explorer": "from-blue-400 to-indigo-500",
    "Expert": "from-purple-500 to-pink-500",
    "Trailblazer": "from-amber-400 to-orange-500",
    "Local Guide": "from-emerald-400 to-teal-500"
  };

  const bgGradient = TIER_COLORS[profile.tier] || TIER_COLORS["Explorer"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 py-12 px-4 font-sans relative overflow-hidden">
      {/* Decorative background vectors */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent opacity-10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

      <div className="max-w-4xl mx-auto relative z-10">
        <Link to="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-6 font-bold transition-colors">
          ← Back Home
        </Link>

        {/* The Passport Container */}
        <div className="bg-[#fdfbf7] rounded-[2rem] shadow-2xl overflow-hidden border border-[#e5dfd3] flex flex-col md:flex-row transform transition-all hover:shadow-3xl">
          
          {/* Left Panel: Cover & ID */}
          <div className={`p-10 md:w-1/3 bg-gradient-to-br ${bgGradient} text-white flex flex-col items-center justify-center text-center relative overflow-hidden`}>
            <div className="absolute inset-0 bg-black/10 mix-blend-overlay pattern-diagonal-lines opacity-20" />
            <div className="relative z-10 w-32 h-32 bg-white rounded-full flex items-center justify-center text-5xl font-black text-gray-800 shadow-xl mb-6 border-4 border-white/30">
              {profile.username.charAt(0).toUpperCase()}
            </div>
            <h1 className="text-3xl font-black mb-1 drop-shadow-md">{profile.username}</h1>
            <p className="text-white/80 font-bold uppercase tracking-widest text-sm mb-6 flex items-center gap-2 justify-center">
              <span>✈️</span> Odyssey Passport
            </p>
            <div className="px-5 py-2 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 shadow-inner">
              <p className="text-xs uppercase tracking-wider text-white/70 mb-1">Current Tier</p>
              <p className="text-xl font-black">{profile.tier}</p>
            </div>
          </div>

          {/* Right Panel: Stats & Stamps */}
          <div className="p-8 md:p-12 md:w-2/3 flex flex-col">
            <h2 className="text-2xl font-black text-gray-800 mb-6 border-b-2 border-dashed border-gray-200 pb-4 flex items-center gap-2">
              <span>🛂</span> Travel Stats
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-center">
                <p className="text-3xl font-black text-blue-600 mb-1">{profile.review_count}</p>
                <p className="text-[10px] uppercase font-bold text-blue-800/60">Places Visited</p>
              </div>
              <div className="bg-teal-50 p-4 rounded-2xl border border-teal-100 text-center relative overflow-hidden">
                <div className="absolute top-1 right-2 text-2xl opacity-20">📍</div>
                <p className="text-3xl font-black text-teal-600 mb-1">{profile.geo_verified_count}</p>
                <p className="text-[10px] uppercase font-bold text-teal-800/60">Geo-Verified</p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100 text-center">
                <p className="text-3xl font-black text-yellow-600 mb-1">{profile.helpful_votes_received}</p>
                <p className="text-[10px] uppercase font-bold text-yellow-800/60">Helpful Votes</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100 text-center">
                <p className="text-3xl font-black text-purple-600 mb-1">
                  {Math.round((profile.geo_verified_count / Math.max(1, profile.review_count)) * 100)}%
                </p>
                <p className="text-[10px] uppercase font-bold text-purple-800/60">Trust Score</p>
              </div>
            </div>

            <h2 className="text-2xl font-black text-gray-800 mb-6 border-b-2 border-dashed border-gray-200 pb-4 flex items-center gap-2">
              <span>🏅</span> Achievement Stamps
            </h2>

            <div className="flex flex-wrap gap-6">
              {/* Fake aesthetic stamps */}
              <div className="w-28 h-28 rounded-full border-4 border-rose-500 flex flex-col items-center justify-center text-rose-600/80 -rotate-6 p-2 relative">
                <div className="absolute inset-0 border border-rose-500 rounded-full m-1 opacity-50" />
                <span className="text-sm font-black uppercase tracking-widest text-center mt-2 border-b border-rose-500/30 w-full mb-1">Verified</span>
                <span className="text-[10px] font-bold">2026-04-09</span>
                <span className="text-xl mt-1">🇮🇳</span>
              </div>
              
              {profile.review_count >= 10 && (
                <div className="w-28 h-28 border-[3px] border-indigo-600 rounded-lg flex flex-col items-center justify-center text-indigo-700/80 rotate-3 p-2 relative stamp-mask">
                  <span className="text-2xl mb-1">🍜</span>
                  <span className="text-[11px] font-black uppercase text-center leading-tight">Foodie<br/>Pro</span>
                </div>
              )}

              {profile.tier === "Trailblazer" && (
                <div className="w-28 h-28 rounded-full border-dashed border-4 border-amber-500 flex flex-col items-center justify-center text-amber-600/90 -rotate-12 p-2">
                  <span className="text-3xl mb-1 mt-1">🧭</span>
                  <span className="text-[10px] font-black uppercase">Trailblazer</span>
                </div>
              )}

              <div className="w-28 h-28 border-2 border-emerald-500/30 rounded-3xl flex items-center justify-center text-center p-2 opacity-50">
                <span className="text-xs font-bold text-gray-400 tracking-wider">MORE TO EXPLORE</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
