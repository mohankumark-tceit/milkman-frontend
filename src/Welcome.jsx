import { useNavigate } from "react-router-dom";

export default function Welcome() {
  
  const navigate = useNavigate();

  function handleStart() {
    navigate("/signup");   // ← go to signup page
  }

  return (
    <div className="welcome">
      <div className="welcome-content">

        <h1 className="welcome-title">PAALKAARAN</h1>
        <h2 className="welcome-subtitle">Welcome to our Community</h2>

        <p className="welcome-desc">
          Your Daily Milk, Perfectly Calculated.
        </p>

        <button className="welcome-btn" onClick={handleStart}>
          START
        </button>

      </div>
    </div>
  );
}
