import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  IceCream,
  CakeSlice,
  Apple,
  Grape,
  UtensilsCrossed,
} from "lucide-react";

const Signup = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords don't match!");
      return;
    }

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
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Registration failed");
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
    <div className="min-h-screen bg-pink-50 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Decorative Foodie Elements (Background Animations) */}
      <div className="absolute top-10 right-10 text-pink-300 opacity-50 animate-[bounce_5s_infinite]">
        <IceCream size={70} />
      </div>
      <div className="absolute bottom-10 right-20 text-pink-300 opacity-50 animate-[pulse_4s_infinite]">
        <CakeSlice size={90} />
      </div>
      <div className="absolute top-32 left-20 text-pink-300 opacity-50 animate-[spin_12s_linear_infinite]">
        <Apple size={60} />
      </div>
      <div className="absolute bottom-32 left-10 text-pink-300 opacity-50 animate-[bounce_7s_infinite]">
        <Grape size={80} />
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden z-10 transform transition-all duration-500 hover:scale-[1.01] border-t-8 border-pink-500">
        <div className="p-8">
          <div className="text-center mb-8 flex flex-col items-center">
            <div className="bg-pink-100 p-4 rounded-full mb-4 text-pink-600 animate-bounce">
              <UtensilsCrossed size={48} />
            </div>
            <h2 className="text-3xl font-extrabold text-gray-800 font-serif mb-2">
              Join the Feast!
            </h2>
            <p className="text-gray-500 font-medium">
              Create an account to explore delicious spots.
            </p>
          </div>

          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md text-sm font-medium animate-[pulse_1s_ease-in-out]">
              {error}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-5">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Username
              </label>
              <input
                type="text"
                required
                className="w-full px-4 py-3 rounded-xl bg-pink-50 border border-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                placeholder="Pick a tasty username"
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
                className="w-full px-4 py-3 rounded-xl bg-pink-50 border border-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                placeholder="Create a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 rounded-xl bg-pink-50 border border-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg transform transition-all hover:-translate-y-1 hover:shadow-xl disabled:opacity-50 flex justify-center items-center gap-2 mt-2"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                  Cooking...
                </span>
              ) : (
                "Sign Up Now"
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600 font-medium">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-pink-600 hover:text-pink-700 font-bold hover:underline transition-all"
            >
              Log in here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
