import { useState, useEffect } from "react";
import axios from "axios";
import './styles/PaymentProcess.css';

const API_URL = import.meta.env.VITE_API_URL || "https://milkman-backend-rweo.onrender.com/api";

export default function PaymentProcess() {
  const [loading, setLoading] = useState(false);
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [upi, setUpi] = useState("");
  const [paytm, setPaytm] = useState("");
  const [gpay, setGpay] = useState("");
  const [phonepe, setPhonepe] = useState("");
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedPurchases, setSelectedPurchases] = useState([]);
  const token = localStorage.getItem("token");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [profileRes, customersRes] = await Promise.all([
        axios.get(`${API_URL}/milkman/profile`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/purchases/milkman-customers`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const prof = profileRes.data.milkman;
      setKeyId(prof?.paymentDetails?.razorpayKeyId || "");
      setKeySecret(prof?.paymentDetails?.razorpayKeySecret || "");
      setUpi(prof?.paymentDetails?.upiId || "");
      setPaytm(prof?.paymentDetails?.walletContacts?.paytm || "");
      setGpay(prof?.paymentDetails?.walletContacts?.gpay || "");
      setPhonepe(prof?.paymentDetails?.walletContacts?.phonepe || "");
      setCustomers(customersRes.data.customers || []);
    } catch (error) {
      alert(error.response?.data?.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const saveKeys = async (e) => {
    e.preventDefault();
    if (!keyId && !keySecret && !upi && !paytm && !gpay && !phonepe) return alert("Provide at least one payment detail");
    try {
      await axios.post(`${API_URL}/milkman/payment-details`, { razorpayKeyId: keyId.trim() || null, razorpayKeySecret: keySecret.trim() || null, upiId: upi?.trim() || null, paytm: paytm?.trim() || null, gpay: gpay?.trim() || null, phonepe: phonepe?.trim() || null }, { headers: { Authorization: `Bearer ${token}` } });
      alert('Payment details saved');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save payment details');
    }
  };

  const openRequestModal = (customer) => {
    setSelectedCustomer(customer);
    setSelectedPurchases(customer.purchases.filter(p => !p.isPaid).map(p => p._id));
  };

  const createAndPay = async () => {
    if (!selectedPurchases.length) return alert('Select purchases');
    try {
      const res = await axios.post(`${API_URL}/milkman/create-payment-order`, { customerId: selectedCustomer.customer._id, purchaseIds: selectedPurchases }, { headers: { Authorization: `Bearer ${token}` } });
      const { order, keyId: kId, paymentId } = res.data;

      if (!order || !kId) {
        alert('Payment record created; Razorpay not configured. Customer will see pending invoice.');
        setSelectedCustomer(null);
        fetchData();
        return;
      }

      // load SDK
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
        key: kId,
        amount: order.amount,
        currency: order.currency,
        name: 'Milkman App',
        description: `Payment for ${selectedPurchases.length} purchases`,
        order_id: order.id,
        handler: async function(response) {
          try {
            await axios.post(`${API_URL}/payments/verify`, {
              paymentId,
              razorpayPaymentId: response.razorpay_payment_id || response.razorpayPaymentId,
              razorpayOrderId: response.razorpay_order_id || response.razorpayOrderId,
              razorpaySignature: response.razorpay_signature || response.razorpaySignature,
            }, { headers: { Authorization: `Bearer ${token}` } });
            alert('Payment verified and purchases marked as paid');
            setSelectedCustomer(null);
            fetchData();
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
  };

  return (
    <div className="payment-process-page">
      <div className="payment-process-header">
        <h1>Payment Process</h1>
        <div>
          <small style={{ color: '#666' }}>Accept multiple methods: Razorpay, UPI, Paytm, GPay, PhonePe</small>
        </div>
      </div>

      {loading ? <p>Loading...</p> : (
        <div className="payment-section">
          <div className="payment-card">
            <h3>Payment Details (milkman)</h3>
            <form className="payment-card-form" onSubmit={saveKeys}>
              <div className="payment-details-form">
                <input className="input" placeholder="Razorpay Key ID" value={keyId} onChange={(e) => setKeyId(e.target.value)} />
                <input className="input" placeholder="Razorpay Key Secret" value={keySecret} onChange={(e) => setKeySecret(e.target.value)} />
              </div>

              <div className="mt-12">
                <label className="label">UPI ID</label>
                <input className="input" placeholder="example@upi" value={upi} onChange={(e) => setUpi(e.target.value)} />

                <div className="mt-12">
                  <label className="label">Wallet Contacts</label>
                  <div className="wallet-options">
                    <div className="wallet-option">
                      <label className="label-small">Paytm</label>
                      <input className="input" placeholder="Phone or ID" value={paytm} onChange={(e) => setPaytm(e.target.value)} />
                    </div>
                    <div className="wallet-option">
                      <label className="label-small">GPay</label>
                      <input className="input" placeholder="Phone or UPI" value={gpay} onChange={(e) => setGpay(e.target.value)} />
                    </div>
                    <div className="wallet-option">
                      <label className="label-small">PhonePe</label>
                      <input className="input" placeholder="Phone or UPI" value={phonepe} onChange={(e) => setPhonepe(e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="small-note">Note: These are UI placeholders — to accept payments via UPI / wallet apps you will need to share your QR/UPI with customers or integrate the provider's APIs.</div>

                <div style={{ marginTop: 16 }}>
                  <button type="submit" className="btn btn-success">Save Payment Details</button>
                </div>
              </div>
            </form>
          </div>

          <div>
            <div className="payment-card">
              <h3>Customers & Unpaid Amounts</h3>
              {customers.length === 0 ? <p>No customers yet</p> : (
                <div className="customers-list">
                  {customers.map((c) => (
                    <div className="customer-item" key={c.customer._id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                          <strong>{c.customer.name}</strong> — {c.customer.phone}
                          <div>Outstanding: ₹{c.totalUnpaid.toFixed(2)}</div>
                        </div>
                        <div>
                          {c.totalUnpaid > 0 ? (
                            <div className="request-actions">
                              <button className="btn btn-primary" onClick={() => openRequestModal(c)}>Create Order</button>
                              <button className="btn btn-outline" onClick={() => {
                                // show UPI/QR info in alert for quick copy
                                const lines = [];
                                if (upi) lines.push(`UPI: ${upi}`);
                                if (paytm) lines.push(`Paytm: ${paytm}`);
                                if (gpay) lines.push(`GPay: ${gpay}`);
                                if (phonepe) lines.push(`PhonePe: ${phonepe}`);
                                if (!lines.length) return alert('No UPI/wallet details configured');
                                alert(lines.join('\n'));
                              }}>Show UPI/Wallet</button>
                            </div>
                          ) : (
                            <small>All Paid</small>
                          )}
                        </div>
                      </div>

                      {selectedCustomer?.customer?._id === c.customer._id && (
                        <div style={{ marginTop: 10 }}>
                          <h4>Select Purchases</h4>
                          {c.purchases.filter(p => !p.isPaid).map((p) => (
                            <label key={p._id} style={{ display: 'block' }}>
                              <input type="checkbox" checked={selectedPurchases.includes(p._id)} onChange={(e) => {
                                if (e.target.checked) setSelectedPurchases(s => [...s, p._id]);
                                else setSelectedPurchases(s => s.filter(id => id !== p._id));
                              }} />
                              {new Date(p.date).toLocaleDateString()} — {p.litres}L — ₹{p.totalAmount}
                            </label>
                          ))}
                          <div style={{ marginTop: 8 }}>
                            <button className="btn btn-outline" onClick={() => setSelectedCustomer(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={createAndPay}>Create & Pay</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
