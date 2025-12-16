import { useState, useEffect, useRef } from "react";
import { useNavigate } from 'react-router-dom';
import axios from "axios";
import "./styles/MilkmanDashboard.css";

const API_URL = import.meta.env.VITE_API_URL || "https://milkman-backend-rweo.onrender.com/api";

export default function MilkmanDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [pricePerLitre, setPricePerLitre] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [customers, setCustomers] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [requests, setRequests] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [communities, setCommunities] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedPurchases, setSelectedPurchases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: "", message: "" });
  const [isTracking, setIsTracking] = useState(false);
  const watchIdRef = useRef(null);
  const [customerFilter, setCustomerFilter] = useState(null);
  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  useEffect(() => {
    fetchMilkmanData();
  }, [token]);

  const fetchMilkmanData = async () => {
    setLoading(true);
    try {
      const [profileRes, customersRes, announcementsRes] = await Promise.all([
        axios.get(`${API_URL}/milkman/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/purchases/milkman-customers`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/announcements/milkman-announcements`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setPricePerLitre(profileRes.data.milkman.pricePerLitre || "");
      setReferralCode(profileRes.data.milkman.referralCode || "");
      setCustomers(customersRes.data.customers || []);
      const anns = announcementsRes.data.announcements || [];
      setAnnouncements(anns);
      // If a 'Live Location' announcement exists, show tracking as active (server-side)
      setIsTracking(anns.some(a => a.title === 'Live Location'));
      // fetch community requests for milkman
      try {
        const reqRes = await axios.get(`${API_URL}/community/requests`, { headers: { Authorization: `Bearer ${token}` } });
        setRequests(reqRes.data.requests || []);
      } catch (err) {
        // ignore; not critical
      }
    } catch (error) {
      alert(error.response?.data?.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const handleSetPrice = async (e) => {
    e.preventDefault();
    if (!newPrice || newPrice <= 0) {
      alert("Enter valid price");
      return;
    }

    try {
      await axios.post(
        `${API_URL}/milkman/set-price`,
        { pricePerLitre: parseFloat(newPrice) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Price updated successfully");
      setPricePerLitre(newPrice);
      setNewPrice("");
    } catch (error) {
      alert(error.response?.data?.message || "Failed to set price");
    }
  };

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!newAnnouncement.title || !newAnnouncement.message) {
      alert("Fill all fields");
      return;
    }

    try {
      await axios.post(
        `${API_URL}/announcements/create`,
        newAnnouncement,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Announcement created successfully");
      setNewAnnouncement({ title: "", message: "" });
      fetchMilkmanData();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to create announcement");
    }
  };

  // Derived overdue / running lists based on purchases dates and paid status
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const overduePurchases = [];
  const runningPurchases = [];
  customers.forEach((c) => {
    (c.purchases || []).forEach((p) => {
      if (p.isPaid) return;
      const checkDate = p.dueDate ? new Date(p.dueDate) : new Date(p.date);
      checkDate.setHours(0, 0, 0, 0);
      if (checkDate < todayStart) overduePurchases.push({ purchase: p, customer: c.customer });
      else runningPurchases.push({ purchase: p, customer: c.customer });
    });
  });

  const handleCreateCommunity = (e) => {
    e.preventDefault();
    const form = e.target;
    const name = form.elements.name.value.trim();
    const desc = form.elements.desc.value.trim();
    if (!name) return alert('Provide a community name');
    setCommunities((s) => [{ id: Date.now(), name, desc }, ...s]);
    setShowCreateCommunity(false);
  };

  const toggleTracking = async () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser');
      return;
    }

    if (isTracking) {
      // stop
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsTracking(false);
      try {
        await axios.post(`${API_URL}/milkman/track`, { stop: true }, { headers: { Authorization: `Bearer ${token}` } });
      } catch (err) { /* ignore */ }
      alert('Stopped sharing live location');
      return;
    }

    // start watch
    const id = navigator.geolocation.watchPosition(async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      try {
        await axios.post(`${API_URL}/milkman/track`, { latitude: lat, longitude: lng }, { headers: { Authorization: `Bearer ${token}` } });
      } catch (err) {
        console.error('Failed to send location', err?.response?.data || err.message);
      }
    }, (err) => {
      console.error('Geolocation error', err);
      if (err.code === 1) alert('Permission denied for location.');
    }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 });

    watchIdRef.current = id;
    setIsTracking(true);
    alert('Live tracking started — customers will be able to see your location under announcements');
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

  return (
    <div className="milkman-dashboard">

      {loading ? (
        <div className="loading"><p>Loading...</p></div>
      ) : (
        <div className="tab-content">
          <div className="page-header">
            <h1>Milkman Dashboard</h1>
            <div className="right-actions">
              <button
                className={"track-btn" + (isTracking ? " active" : "")}
                onClick={toggleTracking}
                title="Share live location with your customers"
                style={{ marginRight: 8 }}
              >
                {isTracking ? 'Stop Tracking' : 'Track'}
              </button>
              <button onClick={handleLogout} className="logout-btn">Logout</button>
            </div>

            <div className="notifications">
              <button className="payment-icon-btn" onClick={() => navigate('/paymentprocess')} title="Payments">💳</button>
              <button className="bell-btn" onClick={() => setShowNotifications((s) => !s)} title="Requests">
                🔔
                {requests.filter(r => !r.isRead).length > 0 && (
                  <span className="badge">{requests.filter(r => !r.isRead).length}</span>
                )}
              </button>
              {showNotifications && (
                <div className="notifications-dropdown">
                  <h4>Requests</h4>
                  {requests.length === 0 ? (
                    <div className="empty">No requests</div>
                  ) : (
                    requests.map((rq) => (
                      <div key={rq._id} className={`notif-item ${rq.isRead ? 'read' : 'unread'}`}>
                        <div className="notif-head">
                          <strong>{rq.title}</strong>
                          <small>{new Date(rq.createdAt).toLocaleString()}</small>
                        </div>
                        <div className="notif-from">From: {rq.senderId?.name || rq.senderId?.email || 'Anonymous'}</div>
                        <div className="notif-msg">{rq.message}</div>
                        {!rq.isRead && (
                          <button className="mark-read" onClick={async () => {
                            try {
                              await axios.put(`${API_URL}/community/requests/${rq._id}/read`, {}, { headers: { Authorization: `Bearer ${token}` } });
                              setRequests((s) => s.map(x => x._id === rq._id ? { ...x, isRead: true } : x));
                            } catch (err) { alert(err.response?.data?.message || 'Failed'); }
                          }}>Mark read</button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tabs removed: functions moved into overview containers */}
          {activeTab === "price" && (
            <div className="price-section">
              <h2>Set Milk Price</h2>
              {pricePerLitre && (
                <div className="current-price">
                  <p>Current Price: ₹{pricePerLitre}/litre</p>
                </div>
              )}
              <form onSubmit={handleSetPrice} className="price-form">
                <input
                  type="number"
                  placeholder="Price per litre (₹)"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  min="0"
                  step="0.1"
                  required
                />
                <button type="submit">Update Price</button>
              </form>
            </div>
          )}

          {activeTab === "overview" && (
            <div className="overview-section">
              <div className="overview-grid">
                <div className="left-pane">
                  <h3>Announce</h3>
                  <form onSubmit={handleCreateAnnouncement} className="quick-announcement">
                    <input
                      type="text"
                      placeholder="Title"
                      value={newAnnouncement.title}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                    />
                    <textarea
                      placeholder="Type something to announce..."
                      value={newAnnouncement.message}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, message: e.target.value })}
                    />
                    <div className="quick-actions">
                      <button type="submit">Post</button>
                      <button type="button" className="view-history-btn" onClick={() => setActiveTab('announcements')}>View History</button>
                    </div>

                    <div className="latest-announcements">
                      {announcements.slice(0, 1).map((a) => (
                        <div key={a._id} className="mini-ann">
                          <strong>{a.title}</strong>
                          <div className="msg">{a.message}</div>
                        </div>
                      ))}
                    </div>
                  </form>
 

                  <div className="price-compact">
                    <h4>Set Price (quick)</h4>
                    {pricePerLitre ? <div className="current">Current: ₹{pricePerLitre}/L</div> : <div className="current">No price set</div>}
                    <form onSubmit={handleSetPrice} className="price-form-compact">
                      <input type="number" step="0.1" min="0" placeholder="Price per litre" value={newPrice} onChange={(e)=>setNewPrice(e.target.value)} />
                      <button type="submit">Update</button>
                    </form>
                  </div>
                </div>

                <div className="center-pane">
                  <h2 className="task-title">TASK MANAGER</h2>
                  <div className="announce-large">
                    <textarea placeholder="Type something to announce... (big)" />
                    <div className="small-hint">Click the left panel to post</div>
                  </div>
                </div>

                <div className="right-pane">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0 }}>Community</h3>
                    </div>

                    <div className="community-box">
                      <p>Create a community to chat with your milkmen</p>
                      <button onClick={() => setShowCreateCommunity(true)}>Create Community</button>

                      <div className="communities-list">
                        {communities.length === 0 ? (
                          <small>No communities yet</small>
                        ) : (
                          communities.map((c) => (
                            <div key={c.id} className="community-item">
                              <strong>{c.name}</strong>
                              <div>{c.desc}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="referral-container">
                    <h4>Your Referral</h4>
                    <div className="referral-card">
                      {referralCode ? (
                        <div className="ref-row">
                          <strong className="ref-code">{referralCode}</strong>
                          <button className="copy-btn" onClick={() => { navigator.clipboard?.writeText(referralCode); alert('Referral copied'); }}>Copy</button>
                        </div>
                        ) : (
                          <div>No referral code yet</div>
                        )}
                      <p style={{ marginTop: '0.6rem', fontSize: '0.9rem', color: '#666' }}>Share this code with customers so they can link to your service.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="status-row">
                <div className="status-card after-due" role="button" tabIndex={0} onClick={() => { setCustomerFilter('overdue'); setActiveTab('customers'); }}>
                  <h4>AFTER DUE</h4>
                  <div className="count">{overduePurchases.length}</div>
                  <div className="list">
                    {overduePurchases.slice(0, 4).map((o, idx) => (
                      <div key={idx} className="item">
                        <div className="name">{o.customer.name}</div>
                        <div className="meta">{new Date(o.purchase.date).toLocaleDateString()} — ₹{o.purchase.totalAmount}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="status-card on-running" role="button" tabIndex={0} onClick={() => { setCustomerFilter('running'); setActiveTab('customers'); }}>
                  <h4>ON RUNNING</h4>
                  <div className="count">{runningPurchases.length}</div>
                  <div className="list">
                    {runningPurchases.slice(0, 4).map((o, idx) => (
                      <div key={idx} className="item">
                        <div className="name">{o.customer.name}</div>
                        <div className="meta">{new Date(o.purchase.date).toLocaleDateString()} — ₹{o.purchase.totalAmount}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "customers" && (
            <div className="customers-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Customer Payment Status</h2>
                {customerFilter ? (
                  <div>
                    <small style={{ marginRight: 8, color: '#666' }}>
                      Showing: {customerFilter === 'overdue' ? 'After Due' : 'On Running'}
                    </small>
                    <button onClick={() => setCustomerFilter(null)} className="view-history-btn">Show All</button>
                  </div>
                ) : null}
              </div>

              {/* apply filter if set */}
              {(() => {
                let filtered = customers;
                if (customerFilter === 'overdue') {
                  filtered = customers.filter(c => (c.purchases || []).some(p => !p.isPaid && (new Date(p.dueDate || p.date).setHours(0,0,0,0) < todayStart)));
                }
                if (customerFilter === 'running') {
                  filtered = customers.filter(c => (c.purchases || []).some(p => !p.isPaid && (new Date(p.dueDate || p.date).setHours(0,0,0,0) >= todayStart)));
                }

                return (
                  <div className="customers-list">
                    {filtered.length === 0 ? (
                      <p>No customers match this filter</p>
                    ) : (
                      filtered.map((c) => (
                        <div key={c.customer._id} className="customer-card">
                          <div className="customer-info">
                            <h3>{c.customer.name}</h3>
                            <p>{c.customer.phone}</p>
                          </div>
                          <div className="payment-summary">
                            <p>Total Due: <strong>₹{c.totalAmount.toFixed(2)}</strong></p>
                            <p className={c.totalUnpaid > 0 ? "unpaid" : "paid"}>
                              Outstanding: <strong>₹{c.totalUnpaid.toFixed(2)}</strong>
                            </p>
                          </div>
                          {c.totalUnpaid > 0 && (
                            <>
                              <span className="status-badge unpaid">Pending Payment</span>
                              <button
                                className="request-payment-btn"
                                onClick={() => {
                                  setSelectedCustomer(c);
                                  const unpaidIds = c.purchases.filter(p => !p.isPaid).map(p => p._id);
                                  setSelectedPurchases(unpaidIds);
                                  setShowPaymentModal(true);
                                }}
                                style={{ marginLeft: '8px' }}
                              >
                                Request Payment
                              </button>
                            </>
                          )}
                          {c.totalUnpaid === 0 && (
                            <span className="status-badge paid">All Paid</span>
                          )}
                          <details>
                            <summary>View Purchases</summary>
                            <table>
                              <thead>
                                <tr>
                                  <th>Date</th>
                                  <th>Litres</th>
                                  <th>Total</th>
                                  <th>Due Date</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {c.purchases.map((p) => (
                                  <tr key={p._id}>
                                    <td>{new Date(p.date).toLocaleDateString()}</td>
                                    <td>{p.litres}</td>
                                    <td>₹{p.totalAmount}</td>
                                    <td>{p.dueDate ? new Date(p.dueDate).toLocaleDateString() : '-'}</td>
                                    <td>{p.isPaid ? "✓ Paid" : "⏳ Unpaid"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </details>
                        </div>
                      ))
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {showPaymentModal && selectedCustomer && (
            <div className="payment-modal">
              <div className="payment-modal-content">
                <h3>Request Payment from {selectedCustomer.customer.name}</h3>
                <p>Phone: {selectedCustomer.customer.phone}</p>
                <div className="purchase-list">
                  {selectedCustomer.purchases.filter(p=>!p.isPaid).map((p) => (
                    <label key={p._id} className="purchase-item">
                      <input
                        type="checkbox"
                        checked={selectedPurchases.includes(p._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPurchases((s) => [...s, p._id]);
                          } else {
                            setSelectedPurchases((s) => s.filter(id => id !== p._id));
                          }
                        }}
                      />
                      <span>{new Date(p.date).toLocaleDateString()} — {p.litres}L — ₹{p.totalAmount}</span>
                    </label>
                  ))}
                </div>
                <div className="modal-actions">
                  <button onClick={() => setShowPaymentModal(false)}>Cancel</button>
                  <button
                    onClick={async () => {
                      if (!selectedPurchases.length) {
                        alert('Select at least one purchase');
                        return;
                      }
                      try {
                        const res = await axios.post(
                          `${API_URL}/milkman/create-payment-order`,
                          { customerId: selectedCustomer.customer._id, purchaseIds: selectedPurchases },
                          { headers: { Authorization: `Bearer ${token}` } }
                        );

                        const { order, keyId, paymentId } = res.data;

                        // Load Razorpay checkout script
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
                          description: `Payment for ${selectedPurchases.length} purchases`,
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
                              setShowPaymentModal(false);
                              fetchMilkmanData();
                            } catch (err) {
                              alert(err.response?.data?.message || 'Payment verification failed');
                            }
                          },
                          prefill: {},
                          theme: { color: '#3399cc' },
                        };

                        const rzp = new window.Razorpay(options);
                        rzp.open();
                      } catch (err) {
                        alert(err.response?.data?.message || 'Failed to create payment order');
                      }
                    }}
                  >
                    Create & Pay
                  </button>
                </div>
              </div>
            </div>
          )}

          {showCreateCommunity && (
            <div className="create-community-modal">
              <div className="create-community-content">
                <h3>Create Community</h3>
                <form onSubmit={handleCreateCommunity}>
                  <input name="name" placeholder="Community name" />
                  <textarea name="desc" placeholder="Description (optional)" />
                  <div className="modal-actions">
                    <button type="button" onClick={() => setShowCreateCommunity(false)}>Cancel</button>
                    <button type="submit">Create</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {activeTab === "announcements" && (
            <div className="announcements-section">
              <h2>Create & Manage Announcements</h2>
              <form onSubmit={handleCreateAnnouncement} className="announcement-form">
                <input
                  type="text"
                  placeholder="Title"
                  value={newAnnouncement.title}
                  onChange={(e) =>
                    setNewAnnouncement({ ...newAnnouncement, title: e.target.value })
                  }
                  required
                />
                <textarea
                  placeholder="Message"
                  value={newAnnouncement.message}
                  onChange={(e) =>
                    setNewAnnouncement({ ...newAnnouncement, message: e.target.value })
                  }
                  required
                />
                <button type="submit">Post Announcement</button>
              </form>

              <h3>Your Announcements</h3>
              <div className="announcements-list">
                {announcements.length === 0 ? (
                  <p>No announcements yet</p>
                ) : (
                  announcements.map((a) => (
                    <div key={a._id} className="announcement-card">
                      <h4>{a.title}</h4>
                      <p>{linkify(a.message)}</p>
                      <small>{new Date(a.createdAt).toLocaleDateString()}</small>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "referral" && (
            <div className="referral-section">
              <h2>Your Referral Code</h2>
              {referralCode ? (
                <div className="referral-card">
                  <p>
                    <strong>{referralCode}</strong>
                    <button
                      onClick={() => {
                        if (navigator.clipboard) {
                          navigator.clipboard.writeText(referralCode);
                          alert('Referral code copied to clipboard');
                        } else {
                          alert('Copy not supported in this browser');
                        }
                      }}
                      style={{ marginLeft: '8px' }}
                    >
                      Copy
                    </button>
                  </p>
                  <p>Share this code with customers so they can link to your service.</p>
                </div>
              ) : (
                <p>You don't have a referral code yet. It will be generated after signup.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
