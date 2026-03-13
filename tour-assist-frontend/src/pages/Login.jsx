import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Utensils, Coffee, Pizza, Croissant, ChefHat } from "lucide-react";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // Determine backend URL
    const API_BASE_URL =
      import.meta.env.VITE_API_URL ||
      (import.meta.env.MODE === "production" ||
      window.location.hostname !== "localhost"
        ? "https://tour-assist-app.onrender.com"
        : "http://localhost:8000");

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Login failed");
      }

      // Save token and redirect
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("username", username);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Decorative Foodie Elements (Background Animations) */}
      <div className="absolute top-10 left-10 text-orange-300 opacity-50 animate-[bounce_8s_infinite]">
        <Pizza size={80} />
      </div>
      <div className="absolute bottom-20 left-20 text-orange-300 opacity-50 animate-[pulse_6s_infinite]">
        <Coffee size={100} />
      </div>
      <div className="absolute top-20 right-20 text-orange-300 opacity-50 animate-[spin_10s_linear_infinite]">
        <Croissant size={70} />
      </div>
      <div className="absolute bottom-10 right-10 text-orange-300 opacity-50 animate-[bounce_6s_infinite]">
        <Utensils size={90} />
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden z-10 transform transition-all duration-500 hover:scale-[1.02] border-t-8 border-orange-500">
        <div className="p-8">
          <div className="text-center mb-8 flex flex-col items-center">
            <div className="bg-orange-100 p-4 rounded-full mb-4 text-orange-600 animate-pulse">
              <ChefHat size={48} />
            </div>
            <h2 className="text-3xl font-extrabold text-gray-800 font-serif mb-2">
              Welcome Back!
            </h2>
            <p className="text-gray-500 font-medium">
              Ready for your next delicious journey?
            </p>
          </div>

          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md text-sm font-medium animate-[pulse_1s_ease-in-out]">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Username
              </label>
              <input
                type="text"
                required
                className="w-full px-4 py-3 rounded-xl bg-orange-50 border border-orange-200 text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Password
              </label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 rounded-xl bg-orange-50 border border-orange-200 text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg transform transition-all hover:-translate-y-1 hover:shadow-xl disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                  Logging in...
                </span>
              ) : (
                "Dive In"
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-gray-600 font-medium">
            Don't have an account?{" "}
            <Link
              to="/signup"
              className="text-orange-600 hover:text-orange-700 font-bold hover:underline transition-all"
            >
              Join the feast
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
