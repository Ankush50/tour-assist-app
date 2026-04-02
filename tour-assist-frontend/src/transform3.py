import re

with open("g:/TourAssit/tour-assist-frontend/src/pages/PlaceDetail.jsx", "r", encoding="utf-8") as f:
    code = f.read()

# 1. Imports
if 'AIAssistant' not in code:
    code = code.replace(
        'import { useParams, useNavigate } from "react-router-dom";',
        'import { useParams, useNavigate } from "react-router-dom";\nimport AIAssistant from "../components/AIAssistant";'
    )

# 2. Add ask ai button
if "Ask AI About This Place" not in code:
    ask_btn = """          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">About</h2>
            <button
               onClick={() => document.getElementById("ai-trigger")?.click()}
               className="bg-accent text-gray-900 border border-gray-200 px-4 py-2 rounded-full font-bold shadow-md hover:bg-yellow-400 transition-colors flex items-center gap-2 transform hover:scale-105 active:scale-95"
            >
              <span className="text-xl">✨</span> Ask AI About This Place
            </button>
          </div>"""
    code = code.replace(
        '<h2 className="text-xl sm:text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">About</h2>',
        ask_btn
    )

# 3. Mount component at bottom
if "<AIAssistant" not in code:
    mount = """      <AIAssistant 
        filters={{type: place.type}} 
        setFilters={() => {}} 
        userLocation={null} 
        PlaceCardComponent={() => null} 
        placeContext={place.name}
      />
    </div>
  );
}"""
    code = code.replace(
        """    </div>
  );
}""", mount)

with open("g:/TourAssit/tour-assist-frontend/src/pages/PlaceDetail.jsx", "w", encoding="utf-8") as f:
    f.write(code)

with open("g:/TourAssit/tour-assist-frontend/src/components/AIAssistant.jsx", "r", encoding="utf-8") as f:
    ai_code = f.read()
    
if 'id="ai-trigger"' not in ai_code:
    ai_code = ai_code.replace(
        'onClick={() => setIsOpen(!isOpen)}',
        'id="ai-trigger"\n        onClick={() => setIsOpen(!isOpen)}'
    )
    with open("g:/TourAssit/tour-assist-frontend/src/components/AIAssistant.jsx", "w", encoding="utf-8") as f:
        f.write(ai_code)

print("PlaceDetail.jsx and AIAssistant.jsx transformed!")
