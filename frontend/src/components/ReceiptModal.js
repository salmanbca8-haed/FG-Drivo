export function renderReceiptModal({ booking, onClose }) {
  const existing = document.getElementById('receipt-modal-root');
  if (existing) existing.remove();

  if (!booking) return;

  const modalRoot = document.createElement('div');
  modalRoot.id = 'receipt-modal-root';
  modalRoot.style.position = 'fixed';
  modalRoot.style.inset = '0';
  modalRoot.style.zIndex = '1100';
  modalRoot.style.display = 'flex';
  modalRoot.style.alignItems = 'center';
  modalRoot.style.justifyContent = 'center';
  modalRoot.style.backgroundColor = 'rgba(5, 2, 15, 0.85)';
  modalRoot.style.backdropFilter = 'blur(12px)';
  modalRoot.className = 'animate-fade-in';

  const snapshot = booking.fareRuleSnapshot ? (typeof booking.fareRuleSnapshot === 'string' ? JSON.parse(booking.fareRuleSnapshot) : booking.fareRuleSnapshot) : {};
  const dateFormatted = new Date(booking.createdAt).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const payment = (booking.payments && booking.payments.length > 0) ? booking.payments[0] : null;

  modalRoot.innerHTML = `
    <div style="background: #ffffff; color: #111827; width: 100%; max-width: 520px; border-radius: 16px; padding: 2.25rem; position: relative; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); font-family: var(--font-body); margin: 1rem;" id="printable-receipt">
      <!-- Close button (hidden on print) -->
      <button id="receipt-close-btn" class="no-print" style="position: absolute; top: 1.25rem; right: 1.25rem; background: #f3f4f6; border: none; width: 32px; height: 32px; border-radius: 50%; color: #4b5563; font-size: 1.2rem; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>

      <!-- Receipt Header -->
      <div style="border-bottom: 2px dashed #e5e7eb; padding-bottom: 1.25rem; margin-bottom: 1.25rem; text-align: center;">
        <div style="font-family: var(--font-heading); font-size: 1.5rem; font-weight: 800; color: #6C3CE9; display: flex; align-items: center; justify-content: center; gap: 0.35rem;">
          <span style="color: #E6BC00; background: #000; padding: 2px 6px; border-radius: 6px;">FG</span> DRIVO TAXI
        </div>
        <div style="font-size: 0.8rem; color: #6b7280; margin-top: 0.25rem;">Dindigul City Fleet Services | GSTIN: 33AAACF1234F1Z5</div>
        <div style="font-size: 0.75rem; color: #9ca3af;">24/7 Helpline: 0451 - 2439800 | support@fgdrivo.com</div>
      </div>

      <!-- Booking Metadata -->
      <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 1rem;">
        <div>
          <span style="color: #6b7280;">Booking Ref:</span>
          <div style="font-weight: 700; color: #111827;">${booking.bookingRef}</div>
        </div>
        <div style="text-align: right;">
          <span style="color: #6b7280;">Date & Time:</span>
          <div style="font-weight: 600; color: #111827;">${dateFormatted}</div>
        </div>
      </div>

      <!-- Route Details -->
      <div style="background: #f9fafb; border-radius: 10px; padding: 0.85rem 1rem; margin-bottom: 1.25rem; font-size: 0.85rem;">
        <div style="margin-bottom: 0.5rem; display: flex; gap: 0.5rem;">
          <span style="color: #10B981; font-weight: bold;">● PICKUP:</span>
          <span style="color: #374151;">${booking.pickupAddress}</span>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <span style="color: #EF4444; font-weight: bold;">■ DROP:</span>
          <span style="color: #374151;">${booking.dropAddress}</span>
        </div>
      </div>

      <!-- Driver & Vehicle Info -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.85rem; margin-bottom: 1.25rem; border-bottom: 1px solid #f3f4f6; padding-bottom: 1rem;">
        <div>
          <span style="color: #6b7280; font-size: 0.75rem;">DRIVER</span>
          <div style="font-weight: 600;">${booking.driver?.name || 'Assigned Driver'}</div>
          <div style="color: #6b7280; font-size: 0.75rem;">${booking.driver?.phone || ''}</div>
        </div>
        <div>
          <span style="color: #6b7280; font-size: 0.75rem;">VEHICLE</span>
          <div style="font-weight: 600;">${booking.vehicle?.regNumber || 'TN 57 Taxi'}</div>
          <div style="color: #6b7280; font-size: 0.75rem;">${booking.category} (${booking.vehicle?.make || 'Fleet'} ${booking.vehicle?.model || ''})</div>
        </div>
      </div>

      <!-- Fare Breakdown Table -->
      <div style="font-size: 0.85rem; margin-bottom: 1.25rem;">
        <div style="display: flex; justify-content: space-between; padding: 0.35rem 0; color: #4b5563;">
          <span>Distance Traveled</span>
          <span style="font-weight: 600;">${booking.distanceKm} km (~${booking.durationMins} mins)</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 0.35rem 0; color: #4b5563;">
          <span>Base Fare (incl. ${snapshot.baseDistanceKm || 2} km)</span>
          <span>₹${booking.baseFare?.toFixed(2) || '0.00'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 0.35rem 0; color: #4b5563;">
          <span>Distance Rate (${booking.distanceKm} km @ ₹${booking.perKmRate}/km)</span>
          <span>₹${(snapshot.distanceFare || 0).toFixed(2)}</span>
        </div>
        ${snapshot.multiplier && snapshot.multiplier > 1.0 ? `
          <div style="display: flex; justify-content: space-between; padding: 0.35rem 0; color: #d97706;">
            <span>${snapshot.surchargeReason || 'Surcharge Multiplier'} (${snapshot.multiplier}x)</span>
            <span>Applied</span>
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; padding: 0.75rem 0 0.25rem; border-top: 2px solid #111827; font-size: 1.15rem; font-weight: 800; color: #111827;">
          <span>Total Fare Paid</span>
          <span style="color: #6C3CE9;">₹${(booking.finalFare || booking.estimatedFare).toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #10B981; font-weight: 600; margin-top: 0.25rem;">
          <span>Payment Mode: ${payment?.method || 'CASH'}</span>
          <span>Status: ${payment?.status || 'COMPLETED'}</span>
        </div>
      </div>

      <!-- Actions (Print) -->
      <div style="display: flex; gap: 0.75rem; margin-top: 1.5rem;" class="no-print">
        <button id="receipt-print-btn" class="btn btn-primary-violet" style="flex: 1; padding: 0.75rem;">
          🖨️ Print / Save PDF
        </button>
        <button id="receipt-done-btn" class="btn btn-outline" style="flex: 1; color: #111827; border-color: #d1d5db; padding: 0.75rem;">
          Close
        </button>
      </div>
    </div>
  `;

  document.getElementById('receipt-close-btn')?.addEventListener('click', onClose);
  document.getElementById('receipt-done-btn')?.addEventListener('click', onClose);
  document.getElementById('receipt-print-btn')?.addEventListener('click', () => {
    window.print();
  });

  document.body.appendChild(modalRoot);
}
