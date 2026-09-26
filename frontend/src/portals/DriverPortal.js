import { api } from '../services/api';
import { socketService } from '../services/socket';
import confetti from 'canvas-confetti';

export function renderDriverPortal(container, { onOpenAuth }) {
  let isShiftActive = false;
  let activeTrip = null;
  let earnings = null;
  let gpsInterval = null;
  let currentLat = 10.3680;
  let currentLng = 77.9740;

  async function init() {
    if (!api.currentUser || (api.currentUser.role !== 'DRIVER' && api.currentUser.role !== 'ADMIN')) {
      renderAuthRequired();
      return;
    }

    try {
      const [tripsRes, earningsRes] = await Promise.all([
        api.getDriverTrips(),
        api.getDriverEarnings().catch(() => ({ data: { todayEarnings: 0, todayTripsCount: 0 } }))
      ]);

      earnings = earningsRes.data;
      const trips = tripsRes.trips || [];
      activeTrip = trips.find(t => ['ASSIGNED', 'DRIVER_ARRIVED', 'TRIP_STARTED'].includes(t.status)) || null;

      // Socket setup for incoming assignments
      socketService.connect();
      socketService.on('trip:new_assignment', (newBooking) => {
        activeTrip = newBooking;
        playAlertSound();
        render();
      });

      socketService.on('trip:cancelled', () => {
        alert('Active trip was cancelled by customer or dispatcher');
        activeTrip = null;
        render();
      });
    } catch (e) {
      console.warn('Driver data error:', e.message);
    }

    render();
  }

  function playAlertSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 587.33; // D5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
      // audio context restriction bypass
    }
  }

  function renderAuthRequired() {
    container.innerHTML = `
      <main class="container" style="padding: 3rem 1rem;">
        <div class="glass-panel" style="max-width: 520px; margin: 0 auto; padding: 2.5rem; text-align: center; border-color: var(--border-violet);">
          <div style="font-size: 3rem; margin-bottom: 1rem;">🚕</div>
          <h2 style="font-size: 1.6rem; color: #fff; margin-bottom: 0.5rem;">FG DRIVO Driver Portal</h2>
          <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1.5rem;">
            Please sign in with your authorized driver credentials to manage shifts, view assignments, verify trip OTPs, and broadcast live GPS.
          </p>
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <button id="driver-quick-login-btn" class="btn btn-primary-yellow" style="padding: 0.85rem;">
              ⚡ Quick Sign In as Driver (Anand Raj - Sedan)
            </button>
            <button id="driver-custom-login-btn" class="btn btn-outline" style="padding: 0.85rem;">
              Sign In with Other Account
            </button>
          </div>
        </div>
      </main>
    `;

    document.getElementById('driver-quick-login-btn')?.addEventListener('click', async () => {
      try {
        await api.login('9842111002', 'drivo123');
        init();
      } catch (e) {
        alert(e.message || 'Login failed');
      }
    });

    document.getElementById('driver-custom-login-btn')?.addEventListener('click', onOpenAuth);
  }

  function render() {
    container.innerHTML = `
      <main class="container" style="padding: 2rem 1rem 4rem;">
        <!-- Driver Top Header & Shift Toggle -->
        <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 2rem; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem; border-color: var(--border-violet);">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <img src="${api.currentUser?.profilePic || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150'}" alt="Driver" style="width: 56px; height: 56px; border-radius: 50%; object-fit: cover; border: 2px solid var(--brand-yellow);" />
            <div>
              <div style="font-size: 1.25rem; font-weight: 800; color: #fff;">${api.currentUser?.name}</div>
              <div style="font-size: 0.8rem; color: var(--brand-yellow); font-weight: 600;">
                ★ 4.95 Rating • Dindigul Fleet No. 4420
              </div>
            </div>
          </div>

          <!-- Shift Status Button -->
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="text-align: right;">
              <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Duty Status</div>
              <div style="font-size: 0.95rem; font-weight: 700; color: ${isShiftActive ? '#10B981' : '#EF4444'};">
                ${isShiftActive ? '● ONLINE (ACCEPTING RIDES)' : '○ OFFLINE (OFF DUTY)'}
              </div>
            </div>
            <button id="shift-toggle-btn" class="btn ${isShiftActive ? 'btn-danger' : 'btn-success'}" style="padding: 0.75rem 1.4rem; font-weight: 700;">
              ${isShiftActive ? '🔴 Go Offline' : '🟢 Go Online'}
            </button>
          </div>
        </div>

        <!-- Shift Offline Warning -->
        ${!isShiftActive ? `
          <div style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 2rem; display: flex; align-items: center; gap: 1rem;">
            <span style="font-size: 1.8rem;">⚠️</span>
            <div>
              <div style="font-weight: 700; color: var(--brand-yellow);">You are currently OFFLINE</div>
              <div style="font-size: 0.85rem; color: var(--text-secondary);">Click "Go Online" to make your vehicle visible to Dindigul central dispatch and receive nearby trip assignments.</div>
            </div>
          </div>
        ` : ''}

        <!-- Active Trip Management Console -->
        <div style="display: grid; grid-template-columns: 1fr; gap: 2rem;" class="lg-grid-2">
          <!-- Active Assignment Card -->
          <div class="glass-panel" style="padding: 2rem; border-color: ${activeTrip ? 'var(--brand-yellow)' : 'var(--border-subtle)'};">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
              <h2 style="font-size: 1.35rem; color: #fff;">🧭 Current Assignment</h2>
              ${activeTrip ? `<span class="badge badge-yellow">LIVE TRIP</span>` : `<span class="badge badge-violet">READY</span>`}
            </div>

            ${activeTrip ? renderActiveTripWorkflow(activeTrip) : `
              <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
                <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">📡</div>
                <div style="font-size: 1.1rem; font-weight: 700; color: #fff;">Waiting for New Dindigul Rides...</div>
                <div style="font-size: 0.85rem; margin-top: 0.25rem;">Stay online. Central dispatch will route customer bookings to you in real time.</div>
              </div>
            `}
          </div>

          <!-- Driver Earnings & Stats Card -->
          <div class="glass-panel" style="padding: 2rem;">
            <h2 style="font-size: 1.35rem; color: #fff; margin-bottom: 1.5rem;">📊 Today's Earnings & Shift Stats</h2>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
              <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.25rem;">
                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Today's Revenue</div>
                <div style="font-size: 1.8rem; font-weight: 900; color: var(--brand-yellow); margin-top: 0.25rem;">
                  ₹${earnings?.todayEarnings || 0}
                </div>
              </div>

              <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.25rem;">
                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Trips Completed</div>
                <div style="font-size: 1.8rem; font-weight: 900; color: #fff; margin-top: 0.25rem;">
                  ${earnings?.todayTripsCount || 0}
                </div>
              </div>
            </div>

            <!-- GPS Broadcaster Telemetry Status -->
            <div style="background: rgba(108, 60, 233, 0.1); border: 1px solid var(--border-violet); border-radius: var(--radius-md); padding: 1.25rem;">
              <div style="font-weight: 700; color: #fff; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.4rem;">
                <span>📡</span> <span>Live Telemetry & GPS Broadcaster</span>
              </div>
              <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.75rem;">
                Broadcasting coordinates every 3s to authorized customer & dispatch control.
              </div>
              <div style="font-size: 0.75rem; font-family: monospace; color: var(--brand-yellow); background: rgba(0,0,0,0.4); padding: 0.5rem 0.75rem; border-radius: 6px;">
                Lat: ${currentLat.toFixed(5)} | Lng: ${currentLng.toFixed(5)} | GPS: LOCKED
              </div>
            </div>
          </div>
        </div>
      </main>
    `;

    bindDriverEvents();
  }

  function renderActiveTripWorkflow(b) {
    return `
      <div>
        <!-- Trip Header -->
        <div style="background: rgba(255,255,255,0.04); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1.25rem; border: 1px solid var(--border-subtle);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <span style="font-size: 0.8rem; color: var(--brand-yellow); font-weight: 700;">${b.bookingRef}</span>
            <span class="badge badge-success">${b.status}</span>
          </div>
          <div style="font-size: 1.05rem; font-weight: 700; color: #fff; margin-bottom: 0.25rem;">
            Customer: ${b.customer?.name || 'Customer'} (${b.customer?.phone || 'N/A'})
          </div>
          <div style="font-size: 0.85rem; color: var(--text-secondary);">
            Fare: <strong style="color: var(--brand-yellow);">₹${(b.finalFare || b.estimatedFare).toFixed(2)}</strong> • ${b.distanceKm} km
          </div>
        </div>

        <!-- Route Details -->
        <div style="font-size: 0.85rem; margin-bottom: 1.5rem; line-height: 1.6;">
          <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
            <span style="color: #10B981; font-weight: bold;">● PICKUP:</span>
            <span style="color: #fff;">${b.pickupAddress}</span>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <span style="color: #EF4444; font-weight: bold;">■ DROP:</span>
            <span style="color: #fff;">${b.dropAddress}</span>
          </div>
        </div>

        <!-- Step-by-Step Execution Workflow -->
        <div style="display: flex; flex-direction: column; gap: 0.85rem;">
          ${b.status === 'ASSIGNED' ? `
            <button id="driver-arrived-btn" class="btn btn-primary-yellow" style="width: 100%; padding: 0.85rem;">
              📍 I Have Arrived at Pickup Location
            </button>
          ` : ''}

          ${b.status === 'DRIVER_ARRIVED' ? `
            <div style="background: rgba(255, 214, 41, 0.1); border: 1px solid var(--brand-yellow); border-radius: var(--radius-md); padding: 1rem;">
              <label class="form-label" style="color: #fff; font-weight: 700;">Enter 4-Digit Customer Ride OTP:</label>
              <input type="text" id="driver-otp-input" class="form-input" placeholder="e.g. 4821" maxlength="6" style="font-size: 1.25rem; font-weight: 900; letter-spacing: 0.15em; text-align: center; margin: 0.5rem 0;" />
              <button id="driver-start-trip-btn" class="btn btn-primary-yellow" style="width: 100%; padding: 0.85rem;">
                🚀 Verify OTP & Start Trip
              </button>
            </div>
          ` : ''}

          ${b.status === 'TRIP_STARTED' ? `
            <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid #10B981; border-radius: var(--radius-md); padding: 1rem; margin-bottom: 0.5rem; text-align: center;">
              <div style="font-weight: 700; color: #10B981;">🚗 Trip In Progress to Destination</div>
              <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.2rem;">Live GPS broadcaster is sharing your route with the passenger.</div>
            </div>
            <button id="driver-complete-trip-btn" class="btn btn-primary-violet" style="width: 100%; padding: 0.85rem; font-size: 1rem;">
              🏁 Arrived at Destination & Complete Trip
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  function bindDriverEvents() {
    // Shift toggle
    document.getElementById('shift-toggle-btn')?.addEventListener('click', async () => {
      try {
        isShiftActive = !isShiftActive;
        await api.toggleShift(isShiftActive, currentLat, currentLng);

        if (isShiftActive) {
          startGpsSimulator();
        } else {
          stopGpsSimulator();
        }
        render();
      } catch (err) {
        alert(err.message || 'Failed to toggle shift');
      }
    });

    // Workflow actions
    document.getElementById('driver-arrived-btn')?.addEventListener('click', async () => {
      try {
        const res = await api.updateTripStatus(activeTrip.id, 'DRIVER_ARRIVED');
        activeTrip = res.booking;
        render();
      } catch (e) {
        alert(e.message || 'Failed to update status');
      }
    });

    document.getElementById('driver-start-trip-btn')?.addEventListener('click', async () => {
      const otp = document.getElementById('driver-otp-input')?.value.trim();
      if (!otp) {
        alert('Please enter the customer OTP');
        return;
      }

      try {
        const res = await api.updateTripStatus(activeTrip.id, 'TRIP_STARTED', otp);
        activeTrip = res.booking;
        render();
      } catch (e) {
        alert(e.message || 'Incorrect OTP');
      }
    });

    document.getElementById('driver-complete-trip-btn')?.addEventListener('click', async () => {
      try {
        const res = await api.updateTripStatus(activeTrip.id, 'COMPLETED');
        confetti({ particleCount: 100, spread: 80 });
        alert(`Trip completed! Collect ₹${res.booking.finalFare || res.booking.estimatedFare} from passenger.`);
        activeTrip = null;
        render();
      } catch (e) {
        alert(e.message || 'Failed to complete trip');
      }
    });
  }

  function startGpsSimulator() {
    if (gpsInterval) clearInterval(gpsInterval);

    gpsInterval = setInterval(() => {
      // Simulate minor vehicle movement in Dindigul road network
      currentLat += (Math.random() - 0.5) * 0.0008;
      currentLng += (Math.random() - 0.5) * 0.0008;

      socketService.emitDriverGps({
        bookingId: activeTrip?.id || null,
        lat: currentLat,
        lng: currentLng,
        speed: 32 + Math.floor(Math.random() * 12),
        heading: 45
      });
    }, 3000);
  }

  function stopGpsSimulator() {
    if (gpsInterval) {
      clearInterval(gpsInterval);
      gpsInterval = null;
    }
  }

  init();
}
