import { api } from '../services/api';
import confetti from 'canvas-confetti';

export function renderPaymentModal({ booking, onClose, onPaymentSuccess }) {
  const existing = document.getElementById('payment-modal-root');
  if (existing) existing.remove();

  if (!booking) return;

  const modalRoot = document.createElement('div');
  modalRoot.id = 'payment-modal-root';
  modalRoot.style.position = 'fixed';
  modalRoot.style.inset = '0';
  modalRoot.style.zIndex = '1050';
  modalRoot.style.display = 'flex';
  modalRoot.style.alignItems = 'center';
  modalRoot.style.justifyContent = 'center';
  modalRoot.style.backgroundColor = 'rgba(5, 2, 15, 0.85)';
  modalRoot.style.backdropFilter = 'blur(12px)';
  modalRoot.className = 'animate-fade-in';

  let selectedMethod = 'UPI'; // 'UPI', 'CASH', 'ONLINE'
  const amount = booking.finalFare || booking.estimatedFare;

  function renderView() {
    modalRoot.innerHTML = `
      <div class="glass-panel" style="width: 100%; max-width: 480px; padding: 2rem; border-color: var(--border-violet); position: relative; margin: 1rem;">
        <button id="pay-close-btn" style="position: absolute; top: 1.25rem; right: 1.25rem; background: transparent; border: none; color: var(--text-muted); font-size: 1.4rem; cursor: pointer;">✕</button>

        <div style="text-align: center; margin-bottom: 1.5rem;">
          <div class="badge badge-yellow" style="margin-bottom: 0.5rem;">Pay for Ride</div>
          <h2 style="font-size: 1.6rem; color: #fff;">₹${amount.toFixed(2)}</h2>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.2rem;">
            Booking Ref: <strong style="color: #fff;">${booking.bookingRef}</strong>
          </p>
        </div>

        <!-- Payment Method Tabs -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; margin-bottom: 1.5rem;">
          <button class="btn pay-tab ${selectedMethod === 'UPI' ? 'btn-primary-yellow' : 'btn-outline'}" data-method="UPI" style="padding: 0.65rem 0.5rem; font-size: 0.85rem;">
            📱 UPI QR
          </button>
          <button class="btn pay-tab ${selectedMethod === 'CASH' ? 'btn-primary-yellow' : 'btn-outline'}" data-method="CASH" style="padding: 0.65rem 0.5rem; font-size: 0.85rem;">
            💵 Cash
          </button>
          <button class="btn pay-tab ${selectedMethod === 'ONLINE' ? 'btn-primary-yellow' : 'btn-outline'}" data-method="ONLINE" style="padding: 0.65rem 0.5rem; font-size: 0.85rem;">
            💳 Card/Net
          </button>
        </div>

        <div id="payment-body">
          ${selectedMethod === 'UPI' ? `
            <div style="text-align: center; background: rgba(255, 255, 255, 0.04); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 1.5rem; margin-bottom: 1.25rem;">
              <!-- Simulated High Quality QR -->
              <div style="background: #ffffff; padding: 12px; border-radius: 12px; display: inline-block; margin-bottom: 0.75rem; box-shadow: 0 4px 14px rgba(0,0,0,0.3);">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi%3A%2F%2Fpay%3Fpa%3Dfgdrivo%40okaxis%26pn%3DFG%2520DRIVO%2520TAXI%26am%3D${amount}%26tn%3D${booking.bookingRef}" alt="UPI QR Code" style="width: 160px; height: 160px; display: block;" />
              </div>
              <div style="font-size: 0.85rem; font-weight: 600; color: #fff;">Scan using GPay / PhonePe / Paytm</div>
              <div style="font-size: 0.75rem; color: var(--brand-yellow); margin-top: 0.35rem;">UPI ID: fgdrivo@okaxis</div>
              <button id="copy-upi-btn" class="btn btn-ghost" style="font-size: 0.75rem; padding: 0.25rem 0.6rem; margin-top: 0.5rem; border: 1px solid var(--border-subtle);">
                📋 Copy UPI VPA
              </button>
            </div>
            <button id="confirm-pay-btn" class="btn btn-primary-yellow" style="width: 100%; padding: 0.85rem; font-size: 1rem;">
              Simulate UPI Payment Success
            </button>
          ` : selectedMethod === 'CASH' ? `
            <div style="text-align: center; background: rgba(255, 255, 255, 0.04); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 1.5rem; margin-bottom: 1.25rem;">
              <div style="font-size: 3rem; margin-bottom: 0.5rem;">💵</div>
              <h3 style="font-size: 1.1rem; color: #fff; margin-bottom: 0.35rem;">Pay ₹${amount.toFixed(2)} in Cash</h3>
              <p style="font-size: 0.85rem; color: var(--text-secondary);">
                Please hand over exact cash to the driver (${booking.driver?.name || 'Assigned Driver'}) upon completion of your trip.
              </p>
            </div>
            <button id="confirm-pay-btn" class="btn btn-primary-yellow" style="width: 100%; padding: 0.85rem; font-size: 1rem;">
              Confirm Cash on Arrival
            </button>
          ` : `
            <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 1.25rem; margin-bottom: 1.25rem;">
              <div class="form-group">
                <label class="form-label">Card Number</label>
                <input type="text" class="form-input" placeholder="4532 •••• •••• 8821" value="4532 9821 4410 8821" />
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                <div class="form-group">
                  <label class="form-label">Expiry Date</label>
                  <input type="text" class="form-input" placeholder="MM/YY" value="08/29" />
                </div>
                <div class="form-group">
                  <label class="form-label">CVV</label>
                  <input type="password" class="form-input" placeholder="•••" value="782" />
                </div>
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.35rem;">
                <span>🔒 256-Bit SSL Encrypted Mock Gateway</span>
              </div>
            </div>
            <button id="confirm-pay-btn" class="btn btn-primary-violet" style="width: 100%; padding: 0.85rem; font-size: 1rem;">
              Pay ₹${amount.toFixed(2)} Online
            </button>
          `}
        </div>
      </div>
    `;

    // Bind Close
    document.getElementById('pay-close-btn')?.addEventListener('click', onClose);

    // Bind Tabs
    modalRoot.querySelectorAll('.pay-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        selectedMethod = tab.getAttribute('data-method');
        renderView();
      });
    });

    // Copy UPI
    document.getElementById('copy-upi-btn')?.addEventListener('click', () => {
      navigator.clipboard.writeText('fgdrivo@okaxis');
      const btn = document.getElementById('copy-upi-btn');
      if (btn) btn.textContent = '✓ Copied!';
      setTimeout(() => { if (btn) btn.textContent = '📋 Copy UPI VPA'; }, 2000);
    });

    // Confirm Payment
    document.getElementById('confirm-pay-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('confirm-pay-btn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Processing Payment...';
      }

      try {
        const res = await api.verifyPayment(
          booking.id,
          `${selectedMethod}-TXN-${Date.now().toString().slice(-6)}`,
          selectedMethod,
          `SIG_VERIFIED_${Date.now()}`
        );

        // Trigger confetti celebration
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });

        onPaymentSuccess(res.payment);
        onClose();
      } catch (err) {
        alert(err.message || 'Payment confirmation failed');
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Retry Payment';
        }
      }
    });
  }

  renderView();
  document.body.appendChild(modalRoot);
}
