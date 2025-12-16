import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Welcome from './Welcome.jsx';
import Signup from './Signup.jsx';
import Login from './Login.jsx';
import Dashboard from './Dashboard.jsx';
import CustomerDashboard from './CustomerDashboard.jsx';
import MilkmanDashboard from './MilkmanDashboard.jsx';
import PaymentProcess from './PaymentProcess.jsx';
import './App.css';
import LogoIntro from './components/LogoIntro';
import { useEffect, useState } from 'react';



export default function App() {
  const [showIntro, setShowIntro] = useState(true);

  // Router-aware wrapper to control navigation after intro
  function RouterWithIntro() {
    const { pathname } = useLocation();

    // Only show the intro if the user is on the root path on initial load.
    // If not on '/', hide immediately. If on '/', hide after 2000ms.
    useEffect(() => {
      if (pathname !== '/') {
        setShowIntro(false);
        return;
      }
      const id = setTimeout(() => setShowIntro(false), 2000);
      return () => clearTimeout(id);
    }, [pathname]);

    return (
      <>
        <LogoIntro visible={showIntro} />
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/customer-dashboard" element={<CustomerDashboard />} />
          <Route path="/milkman-dashboard" element={<MilkmanDashboard />} />
          <Route path="/paymentprocess" element={<PaymentProcess />} />
        </Routes>
      </>
    );
  }

  return (
    <BrowserRouter>
      <RouterWithIntro />
    </BrowserRouter>
  );
}