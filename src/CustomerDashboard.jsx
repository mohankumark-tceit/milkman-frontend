import { useState, useEffect } from "react";
import axios from "axios";
import "./styles/CustomerDashboard.css";

const API_URL = import.meta.env.VITE_API_URL || "https://milkman-backend-rweo.onrender.com/api";

export default function CustomerDashboard() {
  const [activeTab, setActiveTab] = useState("purchases");
  const [communityForm, setCommunityForm] = useState({ milkmanCode: "", title: "", message: "" });
  const [purchases, setPurchases] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [totalUnpaid, setTotalUnpaid] = useState(0);
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [newPurchase, setNewPurchase] = useState({ litres: "", date: "", frequency: "15" });
  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [purchasesRes, announcementsRes] = await Promise.all([
          axios.get(`${API_URL}/purchases/my-purchases`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_URL}/announcements/my-announcements`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        setPurchases(purchasesRes.data.purchases || []);
        setTotalUnpaid(purchasesRes.data.totalUnpaid || 0);
        setAnnouncements(announcementsRes.data.announcements || []);
      } catch (error) {
        alert(error.response?.data?.message || "Failed to fetch data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  // Fetch payments history
  useEffect(() => {
    if (activeTab !== 'payments') return;
    const fetchPayments = async () => {
      setPaymentsLoading(true);
      try {
        const res = await axios.get(`${API_URL}/payments/history`, { headers: { Authorization: `Bearer ${token}` } });
        setPayments(res.data.payments || []);
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to fetch payments');
      } finally {
        setPaymentsLoading(false);
      }
    };
    fetchPayments();
  }, [activeTab, token]);

  // Poll announcements regularly so customers receive live location updates in near real-time
  useEffect(() => {
    let mounted = true;
    let pollId = null;

    const fetchAnnouncements = async () => {
      try {
        const res = await axios.get(`${API_URL}/announcements/my-announcements`, { headers: { Authorization: `Bearer ${token}` } });
        if (!mounted) return;
        setAnnouncements(res.data.announcements || []);
      } catch (err) {
        // ignore polling errors silently
        console.debug('Announcements poll failed', err?.response?.data || err.message);
      }
    };

    // Initial fetch (if token exists)
    if (token) fetchAnnouncements();

    // Poll every 8 seconds
    pollId = setInterval(fetchAnnouncements, 8000);

    return () => {
      mounted = false;
      if (pollId) clearInterval(pollId);
    };
  }, [token]);

  const handleAddPurchase = async (e) => {
    e.preventDefault();
    if (!newPurchase.litres) {
      alert("Enter litres");
      return;
    }

    try {
      const freq = Number(newPurchase.frequency) || 15;
      if (![15, 30].includes(freq)) return alert('Frequency must be 15 or 30');

      await axios.post(
        `${API_URL}/purchases/add`,
        {
          litres: parseFloat(newPurchase.litres),
          date: newPurchase.date || new Date().toISOString().split("T")[0],
          frequency: freq,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Purchase recorded successfully");
      setNewPurchase({ litres: "", date: "" });
      // Refresh purchases
      const res = await axios.get(`${API_URL}/purchases/my-purchases`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPurchases(res.data.purchases);
      setTotalUnpaid(res.data.totalUnpaid);
    } catch (error) {
      alert(error.response?.data?.message || "Failed to add purchase");
    }
  };

  const handlePayment = async (purchaseIds) => {
    try {
      const res = await axios.post(
        `${API_URL}/payments/create-order`,
        { purchaseIds },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const { order, keyId, paymentId, amount } = res.data;

      if (!order || !keyId) {
        alert(`Payment record created. Total: ₹${amount}. Razorpay not configured by milkman/server.`);
        // Refresh purchases to show pending invoice
        const r = await axios.get(`${API_URL}/purchases/my-purchases`, { headers: { Authorization: `Bearer ${token}` } });
        setPurchases(r.data.purchases);
        setTotalUnpaid(r.data.totalUnpaid);
        return;
      }

      // Load Razorpay SDK if not already loaded
      await new Promise((resolve, reject) => {
        const existing = document.getElementById('razorpay-sdk');
        if (existing) return resolve();
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.id = 'razorpay-sdk';
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });

      const options = {
        key: keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'Milkman App',
        description: `Payment for ${purchaseIds.length} purchases`,
        order_id: order.id,
        handler: async function(response) {
          try {
            await axios.post(
              `${API_URL}/payments/verify`,
              {
                paymentId,
                razorpayPaymentId: response.razorpay_payment_id || response.razorpayPaymentId,
                razorpayOrderId: response.razorpay_order_id || response.razorpayOrderId,
                razorpaySignature: response.razorpay_signature || response.razorpaySignature,
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );
            alert('Payment verified and purchases marked as paid');
            const r = await axios.get(`${API_URL}/purchases/my-purchases`, { headers: { Authorization: `Bearer ${token}` } });
            setPurchases(r.data.purchases);
            setTotalUnpaid(r.data.totalUnpaid);
          } catch (err) {
            alert(err.response?.data?.message || 'Payment verification failed');
          }
        },
        prefill: {},
        theme: { color: '#3399cc' },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();

    } catch (error) {
      alert(error.response?.data?.message || "Failed to create payment");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  // Safely convert URLs in announcement text to anchor elements
  const linkify = (text) => {
    if (!text) return null;
    const parts = text.split(/(https?:\/\/[\S]+)/g);
    return parts.map((part, idx) => {
      if (/^https?:\/\//.test(part)) {
        return (
          <a key={idx} href={part} target="_blank" rel="noopener noreferrer">
            Open Live Location
          </a>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  // Helper to extract the first URL from announcement text
  const extractFirstUrl = (text) => {
    if (!text) return null;
    const m = text.match(/(https?:\/\/[\S]+)/);
    return m ? m[0] : null;
  };

  // Find live location announcement (if any)
  const liveAnnouncement = announcements.find(a => a.title === 'Live Location');

  return (
    <div className="customer-dashboard">
      <nav className="navbar">
        <h1>Customer Dashboard</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className={"live-btn" + (liveAnnouncement ? " active" : "")}
            onClick={() => {
              if (!liveAnnouncement) return alert('No live location available right now');
              const url = extractFirstUrl(liveAnnouncement.message);
              if (!url) return alert('Live location link not available');
              window.open(url, '_blank', 'noopener');
            }}
            title={liveAnnouncement ? `Live: updated ${new Date(liveAnnouncement.updatedAt || liveAnnouncement.createdAt).toLocaleString()}` : 'No live location'}
          >
            {liveAnnouncement ? 'Live Location' : 'No Live Location'}
          </button>

          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </nav>

      <div className="tabs">
        <button
          className={`tab ${activeTab === "purchases" ? "active" : ""}`}
          onClick={() => setActiveTab("purchases")}
        >
          My Purchases
        </button>
        <button
          className={`tab ${activeTab === "announcements" ? "active" : ""}`}
          onClick={() => setActiveTab("announcements")}
        >
          Announcements
        </button>
        <button
          className={`tab ${activeTab === "payments" ? "active" : ""}`}
          onClick={() => setActiveTab("payments")}
        >
          Payments
        </button>
        <button
          className={`tab ${activeTab === "community" ? "active" : ""}`}
          onClick={() => setActiveTab("community")}
        >
          Community
        </button>
      </div>

      {loading ? (
        <p className="loading">Loading...</p>
      ) : (
        <div className="tab-content">
          {liveAnnouncement && (
            <div className="live-location-card">
              <div className="live-head">📍 Milkman Live Location</div>
              <div className="live-body">
                <div className="live-link">
                  <a href={extractFirstUrl(liveAnnouncement.message)} target="_blank" rel="noopener noreferrer">Open in Maps</a>
                </div>
                <div className="live-meta">Updated: {new Date(liveAnnouncement.updatedAt || liveAnnouncement.createdAt).toLocaleString()}</div>
              </div>
            </div>
          )}
          {activeTab === "purchases" && (
            <div className="purchases-section">
              <h2>Record Your Milk Purchase</h2>
              <form onSubmit={handleAddPurchase} className="purchase-form">
                <input
                  type="number"
                  placeholder="Litres"
                  value={newPurchase.litres}
                  onChange={(e) =>
                    setNewPurchase({ ...newPurchase, litres: e.target.value })
                  }
                  min="0"
                  step="0.1"
                  required
                />
                <input
                  type="date"
                  value={newPurchase.date}
                  onChange={(e) =>
                    setNewPurchase({ ...newPurchase, date: e.target.value })
                  }
                />
                <input
                  type="text"
                  placeholder="Frequency (15 or 30 days)"
                  value={newPurchase.frequency}
                  onChange={(e) => setNewPurchase({ ...newPurchase, frequency: e.target.value })}
                />
                <button type="submit">Record Purchase</button>
              </form>

              <div className="total-unpaid">
                <h3>Total Unpaid: ₹{totalUnpaid.toFixed(2)}</h3>
                {purchases.filter((p) => !p.isPaid).length > 0 && (
                  <button
                    onClick={() =>
                      handlePayment(
                        purchases.filter((p) => !p.isPaid).map((p) => p._id)
                      )
                    }
                    className="pay-btn"
                  >
                    Pay Now
                  </button>
                )}
              </div>

              <h3>Purchase History</h3>
              <div className="purchases-list">
                {purchases.length === 0 ? (
                  <p>No purchases yet</p>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Litres</th>
                        <th>Price/L</th>
                        <th>Total</th>
                        <th>Due Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchases.map((p) => (
                        <tr key={p._id} className={p.isPaid ? "paid" : "unpaid"}>
                          <td>{new Date(p.date).toLocaleDateString()}</td>
                          <td>{p.litres}</td>
                          <td>₹{p.pricePerLitre}</td>
                          <td>₹{p.totalAmount}</td>
                          <td>{p.dueDate ? new Date(p.dueDate).toLocaleDateString() : '-'}</td>
                          <td>{p.isPaid ? "✓ Paid" : "⏳ Unpaid"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {activeTab === "announcements" && (
            <div className="announcements-section">
              <h2>Announcements from Your Milkman</h2>
              <div className="announcements-list">
                {announcements.length === 0 ? (
                  <p>No announcements yet</p>
                ) : (
                  announcements.map((a) => (
                    <div key={a._id} className="announcement-card">
                      <h3>{a.title}</h3>
                      <p>{linkify(a.message)}</p>
                      <small>{new Date(a.createdAt).toLocaleDateString()}</small>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "payments" && (
            <div className="payments-section">
              <h2>Your Payments</h2>
              {paymentsLoading ? (
                <p>Loading payments...</p>
              ) : (
                <div>
                  {payments.length === 0 ? (
                    <p>No payments yet</p>
                  ) : (
                    payments.map((pay) => (
                      <div key={pay._id} style={{ border: '1px solid #e6e6e6', padding: 12, marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div>
                            <strong>₹{pay.amount.toFixed(2)}</strong>
                            <div style={{ fontSize: 12, color: '#666' }}>{new Date(pay.createdAt).toLocaleString()}</div>
                            <div style={{ fontSize: 13 }}>{pay.status === 'completed' ? 'Paid' : pay.status}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div>Milkman: {pay.milkmanId?.name || pay.milkmanId?.email || '—'}</div>
                            <div style={{ fontSize: 12, color: '#666' }}>{pay.razorpayPaymentId ? `RZP: ${pay.razorpayPaymentId}` : 'No payment id'}</div>
                          </div>
                        </div>

                        <details style={{ marginTop: 8 }}>
                          <summary>View linked purchases ({(pay.dailyPurchases || []).length})</summary>
                          <table style={{ width: '100%', marginTop: 8 }}>
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Litres</th>
                                <th>Total</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(pay.dailyPurchases || []).map((p) => (
                                <tr key={p._id}>
                                  <td>{new Date(p.date).toLocaleDateString()}</td>
                                  <td>{p.litres}</td>
                                  <td>₹{p.totalAmount}</td>
                                  <td>{p.isPaid ? '✓ Paid' : '⏳ Unpaid'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </details>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "community" && (
            <div className="community-section">
              <h2>Message a Milkman</h2>
              <p>Provide the milkman's referral code, a short title and a message.</p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!communityForm.milkmanCode || !communityForm.title || !communityForm.message) {
                    alert('Fill all fields');
                    return;
                  }
                  try {
                    await axios.post(
                      `${API_URL}/community/request`,
                      {
                        milkmanCode: communityForm.milkmanCode.trim(),
                        title: communityForm.title.trim(),
                        message: communityForm.message.trim(),
                      },
                      { headers: { Authorization: `Bearer ${token}` } }
                    );
                    alert('Message sent to milkman');
                    setCommunityForm({ milkmanCode: '', title: '', message: '' });
                  } catch (err) {
                    alert(err.response?.data?.message || 'Failed to send message');
                  }
                }}
                className="community-form"
              >
                <input
                  placeholder="Milkman referral code (e.g. REF1234)"
                  value={communityForm.milkmanCode}
                  onChange={(e) => setCommunityForm({ ...communityForm, milkmanCode: e.target.value })}
                />
                <input
                  placeholder="Title"
                  value={communityForm.title}
                  onChange={(e) => setCommunityForm({ ...communityForm, title: e.target.value })}
                />
                <textarea
                  placeholder="Message"
                  value={communityForm.message}
                  onChange={(e) => setCommunityForm({ ...communityForm, message: e.target.value })}
                />
                <button type="submit">Send</button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
