import React, { useState } from "react";

const MOODS = [
  { emoji: "😴", label: "Relaxing",  color: "from-blue-400 to-indigo-500",  hoverBg: "hover:bg-blue-50 dark:hover:bg-blue-900/30", activeBg: "bg-blue-100 dark:bg-blue-900/40", border: "border-blue-300 dark:border-blue-700" },
  { emoji: "🎉", label: "Lively",    color: "from-orange-400 to-pink-500",  hoverBg: "hover:bg-orange-50 dark:hover:bg-orange-900/30", activeBg: "bg-orange-100 dark:bg-orange-900/40", border: "border-orange-300 dark:border-orange-700" },
  { emoji: "👨‍👩‍👧", label: "Family",   color: "from-green-400 to-teal-500",   hoverBg: "hover:bg-green-50 dark:hover:bg-green-900/30", activeBg: "bg-green-100 dark:bg-green-900/40", border: "border-green-300 dark:border-green-700" },
  { emoji: "💑",  label: "Romantic", color: "from-rose-400 to-pink-600",    hoverBg: "hover:bg-rose-50 dark:hover:bg-rose-900/30", activeBg: "bg-rose-100 dark:bg-rose-900/40", border: "border-rose-300 dark:border-rose-700" },
  { emoji: "🏋️", label: "Adventure", color: "from-yellow-400 to-amber-500", hoverBg: "hover:bg-yellow-50 dark:hover:bg-yellow-900/30", activeBg: "bg-yellow-100 dark:bg-yellow-900/40", border: "border-yellow-300 dark:border-yellow-700" },
  { emoji: "🧘",  label: "Solo",     color: "from-purple-400 to-violet-500", hoverBg: "hover:bg-purple-50 dark:hover:bg-purple-900/30", activeBg: "bg-purple-100 dark:bg-purple-900/40", border: "border-purple-300 dark:border-purple-700" },
];

export default function MoodPicker({ selectedMood, onMoodSelect }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const activeMoodObj = MOODS.find(m => m.label === selectedMood);

  const handleSelect = (mood) => {
    if (selectedMood === mood.label) {
      onMoodSelect(null); // deselect
    } else {
      onMoodSelect(mood.label);
    }
  };

  return (
    <div className="w-full">
      {/* Toggle header */}
      <button
        onClick={() => setIsExpanded(v => !v)}
        className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 hover:text-primary transition-colors group"
      >
        <span className="text-base transition-transform group-hover:scale-110">
          {activeMoodObj ? activeMoodObj.emoji : "🎭"}
        </span>
        <span>
          Mood
          {activeMoodObj && (
            <span className={`ml-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r ${activeMoodObj.color} text-white`}>
              {activeMoodObj.label}
            </span>
          )}
        </span>
        <svg
          className={`w-3.5 h-3.5 ml-auto transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Mood chips */}
      <div
        className={`overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          isExpanded ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="flex flex-wrap gap-2 pt-1 pb-2">
          {MOODS.map((mood) => {
            const isActive = selectedMood === mood.label;
            return (
              <button
                key={mood.label}
                onClick={() => handleSelect(mood)}
                title={`${mood.label} vibe`}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-sm font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                  isActive
                    ? `${mood.activeBg} ${mood.border} text-gray-800 dark:text-gray-100 shadow-md scale-105`
                    : `border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 ${mood.hoverBg}`
                }`}
              >
                <span className="text-base">{mood.emoji}</span>
                <span className="text-xs font-semibold">{mood.label}</span>
                {isActive && (
                  <span className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${mood.color} animate-pulse`} />
                )}
              </button>
            );
          })}

          {/* Clear button */}
          {selectedMood && (
            <button
              onClick={() => onMoodSelect(null)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full border-2 border-dashed border-gray-300 text-xs text-gray-400 hover:text-red-400 hover:border-red-300 transition-colors"
            >
              ✕ Clear
            </button>
          )}
        </div>

        {selectedMood && (
          <p className="text-xs text-gray-400 italic mt-1">
            ✨ AI recommendations now tuned for <strong className="text-primary">{selectedMood}</strong> experiences
          </p>
        )}
      </div>
    </div>
  );
}
