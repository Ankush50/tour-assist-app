import re

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add useLocation to react-router-dom import
if "useLocation" not in content:
    content = content.replace('from "react-router-dom";', ', useLocation } from "react-router-dom";')

# 2. Modify Navbar to accept hideSearch
content = content.replace('navigate,\n}) => {', 'navigate,\n  hideSearch,\n}) => {')
content = content.replace('{/* Search Bar - Full width on Mobile', '{!hideSearch && (\n          <><div className="w-full md:flex-1 max-w-2xl relative order-3 md:order-2">')
content = content.replace('onSelect={onSuggestionSelect}\n            />\n          </div>', 'onSelect={onSuggestionSelect}\n            />\n          </div></>\n          )}')

# 3. Add useLocation to Home and the URL listener
home_start = content.find('function Home() {')
if home_start != -1:
    inject = """
  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get("q");
    if (q) {
       if (q !== destination) {
           setDestination(q);
           handleSearch(null, q);
       }
    } else if (location.search === "") {
       if (destination !== "") {
           setDestination("");
           setAllPlaces([]);
           setPage(0);
       }
    }
  }, [location.search]);
"""
    content = content[:home_start + 17] + inject + content[home_start + 17:]


# 4. Remove Navbar render from Home
navbar_render_pattern = r'\{/\* Navbar Wrapper.*?</nav>\s*</div>\s*</div>\s*</nav>\s*\)\s*;\s*}\s*'
# Wait, it's actually:
content = re.sub(r'\{/\* Navbar Wrapper.*?</nav>.*?</div>.*?</div>', '', content, flags=re.DOTALL)
# Actually, safely locating it:
content = re.sub(r'<div className="w-full">\s*<Navbar.*?/>\s*</div>', '', content, flags=re.DOTALL)
content = re.sub(r'\{/\* Navbar Wrapper to match centering .*? \*/\}', '', content)


# 5. Replace App Component
app_layout_code = """
function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined" && localStorage.getItem("theme")) return localStorage.getItem("theme");
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", theme);
  }, [theme]);
  const toggleTheme = () => setTheme(prev => prev === "light" ? "dark" : "light");

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUsername = localStorage.getItem("username");
    if (token && storedUsername) { setIsLoggedIn(true); setUsername(storedUsername); }
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setIsLoggedIn(false);
    setUsername("");
    navigate("/");
  };

  const [globalDest, setGlobalDest] = useState("");
  const handleGlobalSearch = (e) => {
    if (e) e.preventDefault();
    if (globalDest.trim()) {
      navigate(`/?q=${encodeURIComponent(globalDest)}`);
    } else {
      setGlobalDest("");
      navigate("/");
    }
  };

  return (
    <>
      <div className={`w-full relative z-50 ${theme === 'dark' ? 'dark' : ''}`}>
        <Navbar
          destination={globalDest}
          setDestination={setGlobalDest}
          onSearch={handleGlobalSearch}
          loading={false}
          suggestions={[]}
          onSuggestionSelect={(s) => { setGlobalDest(s); navigate(`/?q=${encodeURIComponent(s)}`); }}
          theme={theme}
          toggleTheme={toggleTheme}
          onLoginClick={() => navigate("/login")}
          isLoggedIn={isLoggedIn}
          username={username}
          onLogout={handleLogout}
          navigate={navigate}
          hideSearch={location.pathname !== "/"}
        />
      </div>
      <div className={`flex-grow flex flex-col relative w-full ${theme === 'dark' ? 'dark' : ''}`}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/saved" element={<SavedPlaces />} />
            <Route path="/places/:id" element={<PlaceDetail />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/trips" element={<TripPlanner />} />
            <Route path="/trip/:shareToken" element={<SharedTrip />} />
          </Routes>
      </div>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
"""

content = re.sub(r'function App\(\) \{.*?\}\s*export default App;', app_layout_code + '\nexport default App;', content, flags=re.DOTALL)

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
