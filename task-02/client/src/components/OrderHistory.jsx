import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { getOrderHistory, payOrder, cancelOrder, refundOrder } from '../api';

function Countdown({ expiresAt }) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  if (!expiresAt || remaining <= 0) return <span>expired</span>;
  const s = Math.floor(remaining / 1000);
  return <span>{Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')} left</span>;
}

export default function OrderHistory({ userId }) {
  const [orders, setOrders] = useState([]);
  const load = () => getOrderHistory(userId).then(setOrders).catch(console.error);
  useEffect(() => { load(); const t = setInterval(load, 3000); return () => clearInterval(t); }, [userId]);

  const pay = async (id, outcome) => {
    try { await payOrder(id, { outcome, paymentIdempotencyKey: uuidv4() }); }
    catch (err) { alert(err.response?.data?.message || 'Payment failed'); }
    load();
  };
  const cancel = async (id) => {
    try { await cancelOrder(id); }
    catch (err) { alert(err.response?.data?.message || 'Cancel failed'); }
    load();
  };
  const refund = async (id) => {
    try { await refundOrder(id); }
    catch (err) { alert(err.response?.data?.message || 'Refund failed'); }
    load();
  };

  return (
    <div>
      <h3>Order history for "{userId}"</h3>
      {orders.length === 0 && <div className="card">No orders yet.</div>}
      {orders.map((o) => (
        <div className="card" key={o._id}>
          <div className="row">
            <span>Order {o._id.slice(-6)}</span>
            <span className={`badge ${o.status}`}>{o.status}{o.refunded ? ' · Refunded' : ''}</span>
          </div>
          <div>Total: ${o.totalAmount.toFixed(2)}</div>
          <ul>
            {o.items.map((it, i) => <li key={i}>{it.name} x{it.quantity}</li>)}
          </ul>
          {o.status === 'Reserved' && (
            <>
              <div>Reservation: <Countdown expiresAt={o.expiresAt} /></div>
              <div className="row" style={{ marginTop: 8 }}>
                <button onClick={() => pay(o._id, 'success')}>Pay (success)</button>
                <button className="secondary" onClick={() => pay(o._id, 'failure')}>Pay (fail)</button>
                <button className="secondary" onClick={() => pay(o._id, 'timeout')}>Pay (timeout)</button>
                <button className="danger" onClick={() => cancel(o._id)}>Cancel</button>
              </div>
            </>
          )}
          {o.status === 'Paid' && !o.refunded && (
            <div className="row" style={{ marginTop: 8 }}>
              <button className="danger" onClick={() => cancel(o._id)}>Cancel & refund</button>
              <button className="secondary" onClick={() => refund(o._id)}>Refund only</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
