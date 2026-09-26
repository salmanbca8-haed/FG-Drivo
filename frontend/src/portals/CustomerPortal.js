import { api } from '../services/api';
import { socketService } from '../services/socket';
import { renderReceiptModal } from '../components/ReceiptModal';
import { renderPaymentModal } from '../components/PaymentModal';
import L from 'leaflet';

export function renderCustomerPortal(container, { onOpenAuth }) {
  let activeTab = 'book'; // 'book', 'track', 'history', 'support'
  let activeBooking = null;

  // Tracking Map references
  let trackingMap = null;
  let driverMarker = null;
  let pickupMarker = null;
  let dropMarker = null;
  let routePolyline = null;

  // Booking Form State (preserved across renders)
  let landmarks = [];
  let fareRules = [];
  let selectedPickupId = 'bus_stand';
  let selectedDropId = 'gtn_college';
  let pickupData = null;
  let dropData = null;
  let selectedCategory = 'SEDAN';
  let isScheduled = false;
  let scheduledFor = '';
  let paymentMethod = 'CASH';
  let estimatedData = null;
  let isEstimating = false;

  // Quick routes for instant 1-click booking tests in Dindigul
  const popularRoutes = [
    { name: 'Bus Stand ➔ Railway Station', pId: 'bus_stand', dId: 'railway_junction' },
    { name: 'Railway Station ➔ GTN College', pId: 'railway_junction', dId: 'gtn_college' },
    { name: 'Bus Stand ➔ Malai Kottai (Rock Fort)', pId: 'bus_stand', dId: 'rock_fort' },
    { name: 'Collectorate ➔ PSNA College', pId: 'collectorate', dId: 'psna_college' },
    { name: 'Bus Stand ➔ Gandhigram Univ', pId: 'bus_stand', dId: 'gandhigram' },
    { name: 'Nagal Nagar ➔ Batlagundu Bypass', pId: 'nagal_nagar', dId: 'batlagundu_road' }
  ];

  async function initData() {
    try {
      const [lmRes, frRes] = await Promise.all([
        api.getLandmarks(),
        api.getFareRules()
      ]);
      landmarks = lmRes.landmarks || [];
      fareRules = frRes.rules || [];

      // Initialize default pickup and drop objects
      if (landmarks.length > 0) {
        pickupData = landmarks.find(lm => lm.id === selectedPickupId) || landmarks[0];
        dropData = landmarks.find(lm => lm.id === selectedDropId) || landmarks[1] || landmarks[0];
        selectedPickupId = pickupData.id;
        selectedDropId = dropData.id;
      }

      // Check for ongoing booking
      if (api.token) {
        const myBookings = await api.getMyBookings();
        const ongoing = myBookings.bookings?.find(b => ['PENDING', 'ASSIGNED', 'DRIVER_ARRIVED', 'TRIP_STARTED'].includes(b.status));
        if (ongoing) {
          activeBooking = ongoing;
          activeTab = 'track';
        }
      }
    } catch (e) {
      console.warn('Initial data load note:', e.message);
    }

    render();
    if (activeTab === 'book' && pickupData && dropData) {
      calculateAndRefreshFares();
    }
  }

  function render() {
    container.innerHTML = `
      <!-- Sub-Navigation for Customer Portal -->
      <div style="background: rgba(19, 11, 41, 0.7); border-bottom: 1px solid var(--border-subtle); padding: 0.75rem 0;">
        <div class="container" style="display: flex; gap: 0.5rem; justify-content: flex-start; overflow-x: auto;">
          <button class="cust-tab-btn btn ${activeTab === 'book' ? 'btn-primary-yellow' : 'btn-ghost'}" data-tab="book" style="font-size: 0.85rem; padding: 0.45rem 1rem;">
            🚖 Book a Cab
          </button>
          <button class="cust-tab-btn btn ${activeTab === 'track' ? 'btn-primary-yellow' : 'btn-ghost'}" data-tab="track" style="font-size: 0.85rem; padding: 0.45rem 1rem;">
            🗺️ Live Trip Tracking ${activeBooking ? '<span class="badge badge-success" style="margin-left: 4px; font-size: 0.6rem;">LIVE</span>' : ''}
          </button>
          <button class="cust-tab-btn btn ${activeTab === 'history' ? 'btn-primary-yellow' : 'btn-ghost'}" data-tab="history" style="font-size: 0.85rem; padding: 0.45rem 1rem;">
            📜 Trip History & Receipts
          </button>
          <button class="cust-tab-btn btn ${activeTab === 'support' ? 'btn-primary-yellow' : 'btn-ghost'}" data-tab="support" style="font-size: 0.85rem; padding: 0.45rem 1rem;">
            🛡️ Safety & Support
          </button>
        </div>
      </div>

      <!-- Main Portal Content -->
      <main class="container" style="padding-top: 2rem; padding-bottom: 4rem;">
        ${activeTab === 'book' ? renderBookingView() : ''}
        ${activeTab === 'track' ? renderTrackingView() : ''}
        ${activeTab === 'history' ? renderHistoryView() : ''}
        ${activeTab === 'support' ? renderSupportView() : ''}
      </main>
    `;

    bindTabEvents();
    if (activeTab === 'book') bindBookingEvents();
    if (activeTab === 'track') initTrackingMap();
    if (activeTab === 'history') loadHistoryData();
    if (activeTab === 'support') bindSupportEvents();
  }

  function bindTabEvents() {
    container.querySelectorAll('.cust-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-tab');
        render();
        if (activeTab === 'book' && pickupData && dropData) {
          calculateAndRefreshFares();
        }
      });
    });
  }

  // ===================== 1. BOOKING VIEW =====================
  function renderBookingView() {
    return `
      <!-- Hero Section with Dindigul Theme -->
      <div style="position: relative; border-radius: var(--radius-xl); overflow: hidden; margin-bottom: 2rem; border: 1px solid var(--border-violet); box-shadow: var(--shadow-lg);">
        <div style="position: absolute; inset: 0; background-image: url('/assets/hero_taxi.jpg'); background-size: cover; background-position: center; filter: brightness(0.35);"></div>
        <div style="position: relative; z-index: 10; padding: 3rem 2rem; max-width: 740px;">
          <div class="badge badge-yellow" style="margin-bottom: 0.85rem; font-size: 0.8rem; padding: 4px 10px;">
            ⚡ Dindigul's Official Fleet Service
          </div>
          <h1 style="font-size: clamp(2rem, 4.5vw, 3rem); font-weight: 900; line-height: 1.15; margin-bottom: 0.85rem;">
            Direct Taxi Booking in <span style="color: var(--brand-yellow);">Dindigul City</span>
          </h1>
          <p style="font-size: 1rem; color: var(--text-secondary); line-height: 1.6; margin-bottom: 1.25rem;">
            Zero hidden surcharges, fully verified company drivers, live meter pricing, and real-time GPS tracking across Dindigul district landmarks.
          </p>
          <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; font-size: 0.8rem; color: #fff;">
            <div style="background: rgba(0,0,0,0.5); padding: 0.35rem 0.75rem; border-radius: 9999px; border: 1px solid rgba(255,255,255,0.15);">
              <span style="color: var(--brand-yellow);">✓</span> 25km Municipal Boundary
            </div>
            <div style="background: rgba(0,0,0,0.5); padding: 0.35rem 0.75rem; border-radius: 9999px; border: 1px solid rgba(255,255,255,0.15);">
              <span style="color: var(--brand-yellow);">✓</span> Transparent Rate Cards
            </div>
            <div style="background: rgba(0,0,0,0.5); padding: 0.35rem 0.75rem; border-radius: 9999px; border: 1px solid rgba(255,255,255,0.15);">
              <span style="color: var(--brand-yellow);">✓</span> Cash & Instant UPI
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Route Selector Chips -->
      <div style="margin-bottom: 1.75rem;">
        <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.6rem; display: flex; align-items: center; justify-content: space-between;">
          <span>⚡ Popular Dindigul Routes (1-Click Fill)</span>
          <span style="font-size: 0.75rem; color: var(--brand-yellow);">Click to select</span>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;" id="popular-routes-container">
          ${popularRoutes.map(r => `
            <button class="btn btn-ghost quick-route-chip" data-pid="${r.pId}" data-did="${r.dId}" style="font-size: 0.8rem; padding: 0.4rem 0.8rem; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); text-align: left;">
              📍 ${r.name}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Booking Form & Vehicle Category Selector -->
      <div style="display: grid; grid-template-columns: 1fr; gap: 2rem;" class="lg-grid-2">
        <!-- Form Panel -->
        <div class="glass-panel" style="padding: 2rem; border-color: var(--border-violet);">
          <h2 style="font-size: 1.35rem; margin-bottom: 1.25rem; display: flex; align-items: center; gap: 0.5rem; color: #fff;">
            <span>📍</span> <span>Configure Pickup & Drop</span>
          </h2>

          <div id="booking-error-box" style="display: none; background: var(--status-error-bg); border: 1px solid var(--status-error); color: #fca5a5; padding: 0.75rem 1rem; border-radius: var(--radius-md); font-size: 0.85rem; margin-bottom: 1.25rem;"></div>

          <form id="cab-booking-form">
            <!-- Pickup Dropdown with Swap Button -->
            <div style="display: flex; flex-direction: column; gap: 1rem; position: relative;">
              <!-- Pickup -->
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="display: flex; align-items: center; gap: 0.4rem; color: #10B981; font-weight: 700;">
                  <span>●</span> <span>Pickup Point (Dindigul)</span>
                </label>
                <select id="pickup-select" class="form-select" style="border-left: 3px solid #10B981;" required>
                  <option value="">-- Choose Pickup Landmark --</option>
                  ${landmarks.map(lm => `
                    <option value="${lm.id}" ${lm.id === selectedPickupId ? 'selected' : ''}>
                      ${lm.name} ${lm.tamilName ? `(${lm.tamilName})` : ''} - [${lm.category}]
                    </option>
                  `).join('')}
                </select>
              </div>

              <!-- Swap Button -->
              <div style="display: flex; justify-content: center; margin: -6px 0; z-index: 10;">
                <button type="button" id="swap-locations-btn" class="btn btn-ghost" style="padding: 0.25rem 0.75rem; font-size: 0.9rem; background: var(--bg-surface-elevated); border: 1px solid var(--border-violet); border-radius: 9999px; color: var(--brand-yellow); box-shadow: var(--shadow-sm);" title="Swap Pickup and Drop">
                  ⇅ Swap Pickup & Drop
                </button>
              </div>

              <!-- Destination -->
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="display: flex; align-items: center; gap: 0.4rem; color: #EF4444; font-weight: 700;">
                  <span>■</span> <span>Drop-off Destination (Dindigul)</span>
                </label>
                <select id="drop-select" class="form-select" style="border-left: 3px solid #EF4444;" required>
                  <option value="">-- Choose Destination Landmark --</option>
                  ${landmarks.map(lm => `
                    <option value="${lm.id}" ${lm.id === selectedDropId ? 'selected' : ''}>
                      ${lm.name} ${lm.tamilName ? `(${lm.tamilName})` : ''} - [${lm.category}]
                    </option>
                  `).join('')}
                </select>
              </div>
            </div>

            <!-- Schedule Toggle -->
            <div style="display: flex; align-items: center; justify-content: space-between; margin: 1.25rem 0 1rem; padding: 0.75rem 1rem; background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <div>
                <div style="font-size: 0.9rem; font-weight: 600; color: #fff;">Schedule for Later?</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">Advance booking for train or early morning rides</div>
              </div>
              <input type="checkbox" id="schedule-checkbox" ${isScheduled ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: var(--brand-yellow); cursor: pointer;" />
            </div>

            <div id="schedule-datetime-container" style="display: ${isScheduled ? 'block' : 'none'}; margin-bottom: 1rem;">
              <label class="form-label">Select Pickup Date & Time</label>
              <input type="datetime-local" id="schedule-time-input" class="form-input" value="${scheduledFor || ''}" />
            </div>

            <!-- Payment Method Choice -->
            <div class="form-group">
              <label class="form-label">Payment Preference</label>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                <label style="display: flex; align-items: center; gap: 0.5rem; background: rgba(255,255,255,0.05); padding: 0.65rem 0.85rem; border-radius: var(--radius-md); cursor: pointer; border: 1px solid ${paymentMethod === 'CASH' ? 'var(--brand-yellow)' : 'var(--border-subtle)'};">
                  <input type="radio" name="paymentMethod" value="CASH" ${paymentMethod === 'CASH' ? 'checked' : ''} style="accent-color: var(--brand-yellow);" />
                  <span style="font-size: 0.85rem; font-weight: 600;">💵 Cash on Ride</span>
                </label>
                <label style="display: flex; align-items: center; gap: 0.5rem; background: rgba(255,255,255,0.05); padding: 0.65rem 0.85rem; border-radius: var(--radius-md); cursor: pointer; border: 1px solid ${paymentMethod === 'UPI' ? 'var(--brand-yellow)' : 'var(--border-subtle)'};">
                  <input type="radio" name="paymentMethod" value="UPI" ${paymentMethod === 'UPI' ? 'checked' : ''} style="accent-color: var(--brand-yellow);" />
                  <span style="font-size: 0.85rem; font-weight: 600;">📱 UPI QR / Online</span>
                </label>
              </div>
            </div>

            <button type="submit" id="submit-booking-btn" class="btn btn-primary-yellow" style="width: 100%; padding: 0.95rem; font-size: 1.05rem; margin-top: 0.75rem; font-weight: 800;">
              🚖 Confirm & Book FG DRIVO
            </button>
          </form>
        </div>

        <!-- Vehicle Category Cards & Live Fare Preview -->
        <div>
          <div style="font-size: 1.15rem; font-weight: 700; margin-bottom: 1rem; color: #fff;">
            Choose Vehicle Category
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;" id="category-cards-grid">
            <!-- Auto -->
            <div class="category-card glass-panel-interactive ${selectedCategory === 'AUTO' ? 'selected' : ''}" data-cat="AUTO" style="padding: 1.25rem; cursor: pointer; ${selectedCategory === 'AUTO' ? 'border-color: var(--brand-yellow); background: var(--bg-card-hover);' : ''}">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                <span style="font-size: 2rem;">🛺</span>
                <span class="badge badge-yellow">3 Seats</span>
              </div>
              <div style="font-size: 1.05rem; font-weight: 700; color: #fff;">City Auto</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Quick city hops</div>
              <div class="category-fare-label" data-cat="AUTO" style="margin-top: 0.75rem; font-size: 1.15rem; font-weight: 800; color: var(--brand-yellow);">
                From ₹40
              </div>
            </div>

            <!-- Mini -->
            <div class="category-card glass-panel-interactive ${selectedCategory === 'MINI' ? 'selected' : ''}" data-cat="MINI" style="padding: 1.25rem; cursor: pointer; ${selectedCategory === 'MINI' ? 'border-color: var(--brand-yellow); background: var(--bg-card-hover);' : ''}">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                <span style="font-size: 2rem;">🚗</span>
                <span class="badge badge-violet">4 Seats</span>
              </div>
              <div style="font-size: 1.05rem; font-weight: 700; color: #fff;">Mini / EV</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Tiago EV / Hatchback</div>
              <div class="category-fare-label" data-cat="MINI" style="margin-top: 0.75rem; font-size: 1.15rem; font-weight: 800; color: var(--brand-yellow);">
                From ₹80
              </div>
            </div>

            <!-- Sedan -->
            <div class="category-card glass-panel-interactive ${selectedCategory === 'SEDAN' ? 'selected' : ''}" data-cat="SEDAN" style="padding: 1.25rem; cursor: pointer; ${selectedCategory === 'SEDAN' ? 'border-color: var(--brand-yellow); background: var(--bg-card-hover);' : ''}">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                <span style="font-size: 2rem;">🚘</span>
                <span class="badge badge-violet">4 Seats</span>
              </div>
              <div style="font-size: 1.05rem; font-weight: 700; color: #fff;">Sedan Prime</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Maruti Dzire AC</div>
              <div class="category-fare-label" data-cat="SEDAN" style="margin-top: 0.75rem; font-size: 1.15rem; font-weight: 800; color: var(--brand-yellow);">
                From ₹120
              </div>
            </div>

            <!-- SUV -->
            <div class="category-card glass-panel-interactive ${selectedCategory === 'SUV' ? 'selected' : ''}" data-cat="SUV" style="padding: 1.25rem; cursor: pointer; ${selectedCategory === 'SUV' ? 'border-color: var(--brand-yellow); background: var(--bg-card-hover);' : ''}">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                <span style="font-size: 2rem;">🚙</span>
                <span class="badge badge-violet">7 Seats</span>
              </div>
              <div style="font-size: 1.05rem; font-weight: 700; color: #fff;">Innova SUV</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Family & Luggage</div>
              <div class="category-fare-label" data-cat="SUV" style="margin-top: 0.75rem; font-size: 1.15rem; font-weight: 800; color: var(--brand-yellow);">
                From ₹180
              </div>
            </div>
          </div>

          <!-- Dynamic Fare Summary Card -->
          <div id="dynamic-fare-summary-container">
            <div class="glass-panel" style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
              Calculating fare estimate for selected Dindigul route...
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function bindBookingEvents() {
    // Category click handler
    container.querySelectorAll('.category-card').forEach(card => {
      card.addEventListener('click', () => {
        selectedCategory = card.getAttribute('data-cat');
        // Update selection UI without full DOM destroy
        container.querySelectorAll('.category-card').forEach(c => {
          const isSelected = c.getAttribute('data-cat') === selectedCategory;
          c.classList.toggle('selected', isSelected);
          c.style.borderColor = isSelected ? 'var(--brand-yellow)' : 'var(--border-subtle)';
          c.style.background = isSelected ? 'var(--bg-card-hover)' : 'var(--bg-card)';
        });
        calculateAndRefreshFares();
      });
    });

    // Popular Route Chips
    container.querySelectorAll('.quick-route-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const pId = chip.getAttribute('data-pid');
        const dId = chip.getAttribute('data-did');

        selectedPickupId = pId;
        selectedDropId = dId;

        const pSelect = document.getElementById('pickup-select');
        const dSelect = document.getElementById('drop-select');
        if (pSelect) pSelect.value = pId;
        if (dSelect) dSelect.value = dId;

        pickupData = landmarks.find(lm => lm.id === pId) || null;
        dropData = landmarks.find(lm => lm.id === dId) || null;

        calculateAndRefreshFares();
      });
    });

    // Swap Locations Button
    document.getElementById('swap-locations-btn')?.addEventListener('click', () => {
      const tempId = selectedPickupId;
      selectedPickupId = selectedDropId;
      selectedDropId = tempId;

      const tempObj = pickupData;
      pickupData = dropData;
      dropData = tempObj;

      const pSelect = document.getElementById('pickup-select');
      const dSelect = document.getElementById('drop-select');
      if (pSelect) pSelect.value = selectedPickupId;
      if (dSelect) dSelect.value = selectedDropId;

      calculateAndRefreshFares();
    });

    // Pickup dropdown change
    document.getElementById('pickup-select')?.addEventListener('change', (e) => {
      selectedPickupId = e.target.value;
      pickupData = landmarks.find(lm => lm.id === selectedPickupId) || null;
      calculateAndRefreshFares();
    });

    // Drop dropdown change
    document.getElementById('drop-select')?.addEventListener('change', (e) => {
      selectedDropId = e.target.value;
      dropData = landmarks.find(lm => lm.id === selectedDropId) || null;
      calculateAndRefreshFares();
    });

    // Schedule Checkbox
    document.getElementById('schedule-checkbox')?.addEventListener('change', (e) => {
      isScheduled = e.target.checked;
      const schedContainer = document.getElementById('schedule-datetime-container');
      if (schedContainer) schedContainer.style.display = isScheduled ? 'block' : 'none';
    });

    document.getElementById('schedule-time-input')?.addEventListener('change', (e) => {
      scheduledFor = e.target.value;
    });

    // Payment Radio
    container.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        paymentMethod = e.target.value;
      });
    });

    // Submit Booking
    document.getElementById('cab-booking-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!api.token) {
        onOpenAuth();
        return;
      }

      if (!pickupData || !dropData) {
        alert('Please select both pickup and drop-off locations');
        return;
      }

      if (pickupData.id === dropData.id) {
        alert('Pickup and drop-off locations cannot be the same. Please choose different locations.');
        return;
      }

      const errBox = document.getElementById('booking-error-box');
      const btn = document.getElementById('submit-booking-btn');

      if (errBox) errBox.style.display = 'none';
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Processing Booking...';
      }

      try {
        const payload = {
          pickupAddress: `${pickupData.name}, ${pickupData.address}`,
          pickupLat: pickupData.lat,
          pickupLng: pickupData.lng,
          dropAddress: `${dropData.name}, ${dropData.address}`,
          dropLat: dropData.lat,
          dropLng: dropData.lng,
          category: selectedCategory,
          isScheduled,
          scheduledFor: isScheduled && scheduledFor ? new Date(scheduledFor).toISOString() : null,
          paymentMethod
        };

        const res = await api.createBooking(payload);
        activeBooking = res.booking;
        activeTab = 'track';
        render();
      } catch (err) {
        if (errBox) {
          errBox.textContent = err.message || 'Failed to create booking. Check location boundaries.';
          errBox.style.display = 'block';
        }
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = '🚖 Confirm & Book FG DRIVO';
        }
      }
    });
  }

  async function calculateAndRefreshFares() {
    if (!pickupData || !dropData || pickupData.id === dropData.id) {
      const summaryContainer = document.getElementById('dynamic-fare-summary-container');
      if (summaryContainer) {
        summaryContainer.innerHTML = `
          <div class="glass-panel" style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
            ${pickupData && dropData && pickupData.id === dropData.id
              ? '<span style="color: #EF4444;">Pickup and Drop locations must be different.</span>'
              : 'Select both pickup and drop locations above.'}
          </div>
        `;
      }
      return;
    }

    try {
      // Calculate fare for currently selected category
      const res = await api.estimateFare({
        pickupLat: pickupData.lat,
        pickupLng: pickupData.lng,
        dropLat: dropData.lat,
        dropLng: dropData.lng,
        category: selectedCategory
      });

      estimatedData = res.data;

      // Update the fare tags on all 4 category cards
      const categories = ['AUTO', 'MINI', 'SEDAN', 'SUV'];
      for (const cat of categories) {
        try {
          const catRes = await api.estimateFare({
            pickupLat: pickupData.lat,
            pickupLng: pickupData.lng,
            dropLat: dropData.lat,
            dropLng: dropData.lng,
            category: cat
          });
          const label = container.querySelector(`.category-fare-label[data-cat="${cat}"]`);
          if (label) {
            label.textContent = `₹${catRes.data.estimatedFare}`;
          }
        } catch (e) {
          // fallback
        }
      }

      // Render the Detailed Breakdown Summary
      const summaryContainer = document.getElementById('dynamic-fare-summary-container');
      if (summaryContainer && estimatedData) {
        summaryContainer.innerHTML = `
          <div class="glass-panel" style="padding: 1.5rem; border-color: var(--border-yellow); animation: fadeIn 0.25s ease;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem;">
              <span style="font-weight: 700; color: #fff;">Route & Fare Breakdown</span>
              <span class="badge badge-success">✓ Dindigul Zone Verified</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.35rem;">
              <span>Distance:</span>
              <span style="font-weight: 600; color: #fff;">${estimatedData.distanceKm} km</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.35rem;">
              <span>Est. Travel Time:</span>
              <span style="font-weight: 600; color: #fff;">~${estimatedData.durationMins} minutes</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.35rem;">
              <span>Base Fare (incl. 2 km):</span>
              <span>₹${estimatedData.baseFare}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.75rem;">
              <span>Per Km Rate:</span>
              <span>₹${estimatedData.perKmRate}/km</span>
            </div>
            ${estimatedData.multiplier > 1.0 ? `
              <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: #F59E0B; margin-bottom: 0.75rem;">
                <span>${estimatedData.surchargeReason}:</span>
                <span>${estimatedData.multiplier}x Applied</span>
              </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; border-top: 1px solid var(--border-subtle); padding-top: 0.75rem; font-size: 1.35rem; font-weight: 900;">
              <span style="color: #fff;">Total Fare:</span>
              <span style="color: var(--brand-yellow);">₹${estimatedData.estimatedFare}</span>
            </div>
          </div>
        `;
      }
    } catch (err) {
      console.warn('Fare calculation error:', err.message);
    }
  }

  // ===================== 2. TRACKING VIEW =====================
  function renderTrackingView() {
    if (!activeBooking) {
      return `
        <div class="glass-panel" style="padding: 3rem; text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">🗺️</div>
          <h2 style="font-size: 1.5rem; margin-bottom: 0.5rem; color: #fff;">No Active Ride</h2>
          <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">You don't have any ongoing trip right now.</p>
          <button id="goto-book-btn" class="btn btn-primary-yellow">Book a Ride Now</button>
        </div>
      `;
    }

    const b = activeBooking;
    const isAssigned = !!b.driver;
    const statusMap = {
      'PENDING': { label: 'Dispatching Driver...', color: 'var(--brand-yellow)' },
      'ASSIGNED': { label: 'Driver Assigned & En Route', color: 'var(--brand-violet-light)' },
      'DRIVER_ARRIVED': { label: 'Driver Arrived at Pickup', color: '#10B981' },
      'TRIP_STARTED': { label: 'Trip in Progress', color: '#10B981' },
      'COMPLETED': { label: 'Trip Completed', color: '#10B981' },
      'CANCELLED': { label: 'Trip Cancelled', color: '#EF4444' }
    };

    const currentStatus = statusMap[b.status] || { label: b.status, color: '#fff' };

    return `
      <div style="display: grid; grid-template-columns: 1fr; gap: 1.5rem;" class="lg-grid-2">
        <!-- Live Map Card -->
        <div class="glass-panel" style="padding: 1.25rem; display: flex; flex-direction: column;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem;">
            <div style="font-weight: 700; color: #fff; display: flex; align-items: center; gap: 0.5rem;">
              <span>📍 Live Dindigul GPS Route</span>
              <span class="badge badge-success animate-pulse-glow" style="font-size: 0.65rem;">GPS ACTIVE</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Ref: ${b.bookingRef}</div>
          </div>

          <div id="customer-live-map" style="height: 380px; width: 100%; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--border-violet);"></div>
        </div>

        <!-- Status & Driver Details Card -->
        <div class="glass-panel" style="padding: 1.75rem;">
          <!-- Status Banner -->
          <div style="background: rgba(108, 60, 233, 0.15); border: 1px solid var(--border-violet); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Current Status</div>
              <div style="font-size: 1.15rem; font-weight: 800; color: ${currentStatus.color};">${currentStatus.label}</div>
            </div>
            ${b.status !== 'COMPLETED' && b.status !== 'CANCELLED' ? `
              <div style="text-align: right; background: rgba(0,0,0,0.3); padding: 0.4rem 0.8rem; border-radius: 8px; border: 1px solid rgba(255,214,41,0.3);">
                <div style="font-size: 0.7rem; color: var(--brand-yellow); font-weight: 600;">RIDE OTP</div>
                <div style="font-size: 1.25rem; font-weight: 900; letter-spacing: 0.1em; color: #fff;">${b.otpCode}</div>
              </div>
            ` : ''}
          </div>

          <!-- Driver & Vehicle Profile -->
          ${isAssigned ? `
            <div style="display: flex; align-items: center; gap: 1rem; padding: 1rem; background: rgba(255,255,255,0.03); border-radius: var(--radius-md); border: 1px solid var(--border-subtle); margin-bottom: 1.25rem;">
              <img src="${b.driver?.profilePic || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'}" alt="Driver" style="width: 54px; height: 54px; border-radius: 50%; object-fit: cover; border: 2px solid var(--brand-yellow);" />
              <div style="flex: 1;">
                <div style="font-size: 1.05rem; font-weight: 700; color: #fff;">${b.driver?.name}</div>
                <div style="font-size: 0.8rem; color: var(--brand-yellow); font-weight: 600;">★ 4.95 Rating • Dindigul Fleet</div>
                <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.2rem;">
                  ${b.vehicle?.make || ''} ${b.vehicle?.model || ''} (<strong style="color: #fff;">${b.vehicle?.regNumber || 'TN 57 Taxi'}</strong>)
                </div>
              </div>
              <a href="tel:${b.driver?.phone || '9629255773'}" class="btn btn-outline" style="padding: 0.5rem 0.85rem; font-size: 0.85rem; border-radius: var(--radius-md);">
                📞 Call
              </a>
            </div>
          ` : `
            <div style="padding: 1.25rem; background: rgba(255,214,41,0.08); border-radius: var(--radius-md); border: 1px solid rgba(255,214,41,0.2); margin-bottom: 1.25rem; text-align: center;">
              <div class="animate-spin-slow" style="font-size: 1.5rem; display: inline-block; margin-bottom: 0.5rem;">⌛</div>
              <div style="font-size: 0.95rem; font-weight: 700; color: var(--brand-yellow);">Matching Closest Available Driver in Dindigul...</div>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">Our centralized dispatch console is assigning your vehicle.</div>
            </div>
          `}

          <!-- Route Info -->
          <div style="font-size: 0.85rem; margin-bottom: 1.25rem; line-height: 1.6;">
            <div style="display: flex; gap: 0.5rem; margin-bottom: 0.4rem;">
              <span style="color: #10B981; font-weight: bold;">●</span>
              <span style="color: var(--text-secondary);"><strong style="color: #fff;">Pickup:</strong> ${b.pickupAddress}</span>
            </div>
            <div style="display: flex; gap: 0.5rem;">
              <span style="color: #EF4444; font-weight: bold;">■</span>
              <span style="color: var(--text-secondary);"><strong style="color: #fff;">Drop:</strong> ${b.dropAddress}</span>
            </div>
          </div>

          <!-- Total Fare -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 1rem; margin-bottom: 1.25rem;">
            <span style="font-size: 0.95rem; color: var(--text-secondary);">Total Fare:</span>
            <span style="font-size: 1.4rem; font-weight: 800; color: var(--brand-yellow);">₹${(b.finalFare || b.estimatedFare).toFixed(2)}</span>
          </div>

          <!-- Actions -->
          <div style="display: flex; flex-direction: column; gap: 0.65rem;">
            ${b.status === 'COMPLETED' ? `
              <button id="cust-pay-btn" class="btn btn-primary-yellow" style="width: 100%; padding: 0.75rem;">
                💳 Settle Payment / Verify UPI
              </button>
              <button id="cust-receipt-btn" class="btn btn-primary-violet" style="width: 100%; padding: 0.75rem;">
                🧾 View / Print Tax Receipt
              </button>
            ` : ''}

            ${['PENDING', 'ASSIGNED'].includes(b.status) ? `
              <button id="cust-cancel-btn" class="btn btn-danger" style="width: 100%; padding: 0.75rem; font-size: 0.85rem;">
                Cancel Trip
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  function initTrackingMap() {
    const mapEl = document.getElementById('customer-live-map');
    if (!mapEl || !activeBooking) {
      document.getElementById('goto-book-btn')?.addEventListener('click', () => {
        activeTab = 'book';
        render();
        calculateAndRefreshFares();
      });
      return;
    }

    const b = activeBooking;
    const pLat = b.pickupLat || 10.3625;
    const pLng = b.pickupLng || 77.9701;
    const dLat = b.dropLat || 10.3695;
    const dLng = b.dropLng || 77.9730;

    trackingMap = L.map('customer-live-map').setView([pLat, pLng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap FG DRIVO'
    }).addTo(trackingMap);

    const pickupIcon = L.divIcon({
      className: 'custom-pin',
      html: `<div style="background:#10B981; color:#fff; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; border:2px solid #fff; box-shadow:0 0 10px rgba(0,0,0,0.5);">P</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    const dropIcon = L.divIcon({
      className: 'custom-pin',
      html: `<div style="background:#EF4444; color:#fff; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; border:2px solid #fff; box-shadow:0 0 10px rgba(0,0,0,0.5);">D</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    const taxiIcon = L.divIcon({
      className: 'custom-taxi-pin',
      html: `<div style="background:#FFD629; color:#000; width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.1rem; border:2px solid #6C3CE9; box-shadow:0 0 15px #FFD629;">🚕</div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });

    pickupMarker = L.marker([pLat, pLng], { icon: pickupIcon }).addTo(trackingMap).bindPopup(`<b>Pickup:</b> ${b.pickupAddress}`);
    dropMarker = L.marker([dLat, dLng], { icon: dropIcon }).addTo(trackingMap).bindPopup(`<b>Destination:</b> ${b.dropAddress}`);

    routePolyline = L.polyline([[pLat, pLng], [dLat, dLng]], {
      color: '#6C3CE9',
      weight: 5,
      opacity: 0.8,
      dashArray: '8, 8'
    }).addTo(trackingMap);

    trackingMap.fitBounds(routePolyline.getBounds(), { padding: [40, 40] });

    socketService.joinBookingRoom(b.id);

    socketService.on('ride:location_update', (data) => {
      if (!data || !data.lat || !data.lng) return;
      if (!driverMarker) {
        driverMarker = L.marker([data.lat, data.lng], { icon: taxiIcon }).addTo(trackingMap);
      } else {
        driverMarker.setLatLng([data.lat, data.lng]);
      }
    });

    socketService.on('booking:status_update', (updated) => {
      if (updated.id === b.id) {
        activeBooking = updated;
        render();
      }
    });

    document.getElementById('cust-receipt-btn')?.addEventListener('click', () => {
      renderReceiptModal({ booking: activeBooking, onClose: () => {} });
    });

    document.getElementById('cust-pay-btn')?.addEventListener('click', () => {
      renderPaymentModal({
        booking: activeBooking,
        onClose: () => {},
        onPaymentSuccess: (payment) => {
          render();
        }
      });
    });

    document.getElementById('cust-cancel-btn')?.addEventListener('click', async () => {
      if (confirm('Are you sure you want to cancel this booking?')) {
        try {
          await api.cancelBooking(activeBooking.id, 'Cancelled by customer');
          activeBooking.status = 'CANCELLED';
          render();
        } catch (e) {
          alert(e.message || 'Failed to cancel booking');
        }
      }
    });
  }

  // ===================== 3. TRIP HISTORY VIEW =====================
  function renderHistoryView() {
    return `
      <div class="glass-panel" style="padding: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <h2 style="font-size: 1.35rem; color: #fff;">📜 Your Trip History & Invoices</h2>
          <button id="refresh-history-btn" class="btn btn-outline" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">
            🔄 Refresh
          </button>
        </div>

        <div id="history-list-container">
          <div style="text-align: center; color: var(--text-muted); padding: 2rem;">Loading past trips...</div>
        </div>
      </div>
    `;
  }

  async function loadHistoryData() {
    const histContainer = document.getElementById('history-list-container');
    if (!histContainer) return;

    if (!api.token) {
      histContainer.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
          <p style="color: var(--text-secondary); margin-bottom: 1rem;">Please sign in to view your trip receipts and history.</p>
          <button id="history-login-btn" class="btn btn-primary-yellow">Sign In</button>
        </div>
      `;
      document.getElementById('history-login-btn')?.addEventListener('click', onOpenAuth);
      return;
    }

    try {
      const res = await api.getMyBookings();
      const bookings = res.bookings || [];

      if (bookings.length === 0) {
        histContainer.innerHTML = `
          <div style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            <div>🚕</div>
            <div style="margin-top: 0.5rem;">No past trips recorded yet.</div>
          </div>
        `;
        return;
      }

      histContainer.innerHTML = bookings.map(b => `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1rem; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem;">
          <div style="flex: 1; min-width: 250px;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
              <span class="badge ${b.status === 'COMPLETED' ? 'badge-success' : (b.status === 'CANCELLED' ? 'badge-error' : 'badge-yellow')}">${b.status}</span>
              <span style="font-size: 0.8rem; color: var(--text-muted);">${new Date(b.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</span>
              <span style="font-size: 0.75rem; color: var(--brand-yellow);">${b.bookingRef}</span>
            </div>
            <div style="font-size: 0.9rem; font-weight: 600; color: #fff;">${b.pickupAddress} ➔ ${b.dropAddress}</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.2rem;">
              ${b.category} • ${b.distanceKm} km • Driver: ${b.driver?.name || 'Fleet'}
            </div>
          </div>

          <div style="text-align: right; display: flex; align-items: center; gap: 1rem;">
            <div>
              <div style="font-size: 1.2rem; font-weight: 800; color: var(--brand-yellow);">₹${(b.finalFare || b.estimatedFare).toFixed(2)}</div>
              <div style="font-size: 0.7rem; color: #10B981;">${b.payments?.[0]?.status === 'COMPLETED' ? 'PAID' : 'PENDING'}</div>
            </div>
            <button class="btn btn-outline view-receipt-btn" data-id="${b.id}" style="font-size: 0.8rem; padding: 0.45rem 0.85rem;">
              Receipt
            </button>
          </div>
        </div>
      `).join('');

      histContainer.querySelectorAll('.view-receipt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const booking = bookings.find(b => b.id === id);
          if (booking) renderReceiptModal({ booking, onClose: () => {} });
        });
      });
    } catch (err) {
      histContainer.innerHTML = `<div style="color: var(--status-error); text-align: center;">${err.message || 'Error loading history'}</div>`;
    }
  }

  // ===================== 4. SUPPORT & SAFETY VIEW =====================
  function renderSupportView() {
    return `
      <div style="display: grid; grid-template-columns: 1fr; gap: 2rem;" class="lg-grid-2">
        <div class="glass-panel" style="padding: 2rem;">
          <div class="badge badge-yellow" style="margin-bottom: 0.75rem;">FG DRIVO SAFETY FIRST</div>
          <h2 style="font-size: 1.4rem; color: #fff; margin-bottom: 1rem;">Dindigul Passenger Safety & Trust</h2>

          <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1.5rem;">
            <div style="font-weight: 700; color: #10B981; margin-bottom: 0.25rem;">🚨 24/7 Dindigul Fleet Emergency Control Room</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #fff;">0451 - 2439800 / 9842100001</div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">Immediate response team in Dindigul Municipal limits.</div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 1rem; font-size: 0.85rem; color: var(--text-secondary);">
            <div style="display: flex; gap: 0.75rem;">
              <span style="font-size: 1.2rem;">🔒</span>
              <div>
                <strong style="color: #fff;">Secure Ride Start OTP:</strong> Drivers cannot start a trip without verifying your unique 4-digit code.
              </div>
            </div>
            <div style="display: flex; gap: 0.75rem;">
              <span style="font-size: 1.2rem;">📡</span>
              <div>
                <strong style="color: #fff;">Authorized Real-Time GPS:</strong> GPS coordinates are shared exclusively during active trips and terminated immediately upon completion.
              </div>
            </div>
            <div style="display: flex; gap: 0.75rem;">
              <span style="font-size: 1.2rem;">📄</span>
              <div>
                <strong style="color: #fff;">Strict Fleet KYC:</strong> All drivers undergo police verification, Aadhaar KYC, and fitness inspections.
              </div>
            </div>
          </div>
        </div>

        <div class="glass-panel" style="padding: 2rem;">
          <h2 style="font-size: 1.35rem; color: #fff; margin-bottom: 1.25rem;">Need Assistance? Open a Ticket</h2>

          <div id="ticket-success-box" style="display: none; background: var(--status-success-bg); border: 1px solid var(--status-success); color: #6ee7b7; padding: 0.75rem 1rem; border-radius: var(--radius-md); font-size: 0.85rem; margin-bottom: 1rem;"></div>

          <form id="support-ticket-form">
            <div class="form-group">
              <label class="form-label">Subject</label>
              <input type="text" id="tkt-subject" class="form-input" placeholder="e.g. Lost item / Fare question" required />
            </div>

            <div class="form-group">
              <label class="form-label">Priority</label>
              <select id="tkt-priority" class="form-select">
                <option value="LOW">Low</option>
                <option value="MEDIUM" selected>Medium</option>
                <option value="HIGH">High / Urgent</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Detailed Message</label>
              <textarea id="tkt-message" class="form-textarea" rows="4" placeholder="Describe your query or issue in detail..." required></textarea>
            </div>

            <button type="submit" class="btn btn-primary-yellow" style="width: 100%; padding: 0.8rem;">
              Submit Support Ticket
            </button>
          </form>
        </div>
      </div>
    `;
  }

  function bindSupportEvents() {
    document.getElementById('support-ticket-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!api.token) {
        onOpenAuth();
        return;
      }

      const subject = document.getElementById('tkt-subject')?.value;
      const priority = document.getElementById('tkt-priority')?.value;
      const message = document.getElementById('tkt-message')?.value;
      const successBox = document.getElementById('ticket-success-box');

      try {
        const res = await api.createSupportTicket(subject, message, activeBooking?.id, priority);
        if (successBox) {
          successBox.textContent = `Ticket ${res.ticket.ticketRef} created! Our Dindigul team will get back shortly.`;
          successBox.style.display = 'block';
        }
        document.getElementById('support-ticket-form')?.reset();
      } catch (err) {
        alert(err.message || 'Failed to submit ticket');
      }
    });
  }

  initData();
}
