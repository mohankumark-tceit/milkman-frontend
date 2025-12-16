import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "https://milkman-backend-rweo.onrender.com/api";

export default function Signup() {
  const [step, setStep] = useState(1); // Step 1: Send OTP, Step 2: Verify OTP
  const [form, setForm] = useState({
    email: "",
    password: "",
    role: "customer",
    referralCode: ""
  });
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Step 1: Send OTP
  const handleSendOTP = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/signup`, {
        email: form.email,
        password: form.password,
        role: form.role,
        referralCode: form.referralCode
      });
      alert(res.data.message);
      setStep(2); // Move to OTP verification step
    } catch (err) {
      alert(err.response?.data?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP and Create Account
  const handleVerifyOTP = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/verify-otp`, {
        email: form.email,
        password: form.password,
        role: form.role,
        referralCode: form.referralCode,
        otp
      });
      alert(res.data.message);
      localStorage.setItem("token", res.data.token);
      navigate("/dashboard");
    } catch (err) {
      alert(err.response?.data?.message || "OTP verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-container">
      <h2>{step === 1 ? "Create Account" : "Verify Email"}</h2>

      {step === 1 ? (
        <form onSubmit={handleSendOTP}>
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            required
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            required
          />

          <select
            name="role"
            value={form.role}
            onChange={handleChange}
          >
            <option value="customer">Customer</option>
            <option value="milkman">Milkman</option>
          </select>

          {form.role === "customer" && (
            <input
              type="text"
              name="referralCode"
              placeholder="Referral Code (Optional)"
              value={form.referralCode}
              onChange={handleChange}
            />
          )}

          <button type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send OTP to Email"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOTP}>
          <p>OTP has been sent to <strong>{form.email}</strong></p>
          <input
            type="text"
            placeholder="Enter OTP (6 digits)"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            maxLength="6"
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Verifying..." : "Verify & Create Account"}
          </button>

          <button 
            type="button" 
            onClick={() => setStep(1)}
            style={{ marginTop: "10px", background: "#ccc" }}
          >
            Back
          </button>
        </form>
      )}

      <br />
      <p>
        Already have an account?{" "}
        <Link to="/login">Go to Login</Link>
      </p>
    </div>
  );
}