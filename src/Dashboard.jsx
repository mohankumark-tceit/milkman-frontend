import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "https://milkman-backend-rweo.onrender.com/api";

export default function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      alert("You must be logged in to view the dashboard.");
      navigate("/login");
      return;
    }
    
    axios
      .get(`${API_URL}/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => {
        setProfile(res.data.user);
        setLoading(false);
      })
      .catch(() => {
        alert("Session expired. Please log in again.");
        localStorage.removeItem("token");
        navigate("/login");
      });
  }, [token, navigate]);

  useEffect(() => {
    if (profile) {
      if (profile.role === "customer") {
        navigate("/customer-dashboard");
      } else if (profile.role === "milkman") {
        navigate("/milkman-dashboard");
      }
    }
  }, [profile, navigate]);

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/login"); 
  };

  return (
    <div className="dashboard-container"> 
      <h2>Redirecting...</h2>
      {loading ? (
        <p>Loading profile data...</p>
      ) : (
        <pre>{JSON.stringify(profile, null, 2)}</pre>
      )}
      <button onClick={logout}>Logout</button>
    </div>
  );
}