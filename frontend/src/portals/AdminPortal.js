import { api } from '../services/api';
import { socketService } from '../services/socket';
import L from 'leaflet';

export function renderAdminPortal(container, { onOpenAuth }) {
  let activeTab = 'dispatch'; // 'dispatch', 'fleet', 'drivers', 'fares', 'payments', 'support', 'audit'
  let metrics = null;
  let bookings = [];
  let fleet = [];
  let drivers = [];
  let fareRules = [];
  let payments = [];
  let tickets = [];
  let auditLogs = [];
  let dispatchMap = null;
  let driverMarkersMap = new Map();

  async function init() {
    if (!api.currentUser || (api.currentUser.role !== 'ADMIN' && api.currentUser.role !== 'DISPATCHER')) {
      renderAuthRequired();
      return;
    }

    try {
      const [mRes, bRes, fRes, dRes, fareRes] = await Promise.all([
        api.getAdminMetrics().catch(() => ({ metrics: {} })),
        api.getDispatchBookings().catch(() => ({ bookings: [] })),
        api.getFleet().catch(() => ({ vehicles: [] })),
        api.getDrivers().catch(() => ({ drivers: [] })),
        api.getFareRules().catch(() => ({ rules: [] }))
      ]);

      metrics = mRes.metrics || {};
      bookings = bRes.bookings || [];
      fleet = fRes.vehicles || [];
      drivers = dRes.drivers || [];
      fareRules = fareRes.rules || [];

      // Setup Socket for Dispatch Center
      socketService.connect();
      socketService.on('dispatch:new_booking', (newB) => {
        bookings.unshift(newB);
        render();
      });

      socketService.on('dispatch:driver_location', (loc) => {
        updateMapDriverLocation(loc);
      });
    } catch (e) {
      console.warn('Admin init error:', e.message);
    }

    render();
  }

  function renderAuthRequired() {
    container.innerHTML = `
      <main class="container" style="padding: 3rem 1rem;">
        <div class="glass-panel" style="max-width: 540px; margin: 0 auto; padding: 2.5rem; text-align: center; border-color: var(--border-violet);">
          <div style="font-size: 3rem; margin-bottom: 1rem;">⚡</div>
          <h2 style="font-size: 1.6rem; color: #fff; margin-bottom: 0.5rem;">FG DRIVO Dispatch & Admin Portal</h2>
          <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1.5rem;">
            Centralized operations console for Dindigul taxi fleet dispatch, vehicle tracking, fare configuration, and audit logs.
          </p>
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <button id="admin-quick-login-btn" class="btn btn-primary-yellow" style="padding: 0.85rem;">
              👑 Quick Sign In as Admin (Murugan)
            </button>
            <button id="dispatch-quick-login-btn" class="btn btn-primary-violet" style="padding: 0.85rem;">
              📡 Quick Sign In as Dispatcher (Kavitha)
            </button>
            <button id="admin-custom-login-btn" class="btn btn-outline" style="padding: 0.85rem;">
              Sign In with Credentials
            </button>
          </div>
        </div>
      </main>
    `;

    document.getElementById('admin-quick-login-btn')?.addEventListener('click', async () => {
      try {
        await api.login('9842100001', 'admin123');
        init();
      } catch (e) {
        alert(e.message || 'Login failed');
      }
    });

    document.getElementById('dispatch-quick-login-btn')?.addEventListener('click', async () => {
      try {
        await api.login('9842100002', 'admin123');
        init();
      } catch (e) {
        alert(e.message || 'Login failed');
      }
    });

    document.getElementById('admin-custom-login-btn')?.addEventListener('click', onOpenAuth);
  }

  function render() {
    container.innerHTML = `
      <!-- Admin Top Bar & Tabs -->
      <div style="background: rgba(19, 11, 41, 0.75); border-bottom: 1px solid var(--border-subtle); padding: 0.75rem 0;">
        <div class="container" style="display: flex; gap: 0.5rem; justify-content: flex-start; overflow-x: auto;">
          <button class="admin-tab-btn btn ${activeTab === 'dispatch' ? 'btn-primary-yellow' : 'btn-ghost'}" data-tab="dispatch" style="font-size: 0.85rem; padding: 0.45rem 1rem;">
            ⚡ Live Dispatch Console
          </button>
          <button class="admin-tab-btn btn ${activeTab === 'fleet' ? 'btn-primary-yellow' : 'btn-ghost'}" data-tab="fleet" style="font-size: 0.85rem; padding: 0.45rem 1rem;">
            🚗 Fleet Management (${fleet.length})
          </button>
          <button class="admin-tab-btn btn ${activeTab === 'drivers' ? 'btn-primary-yellow' : 'btn-ghost'}" data-tab="drivers" style="font-size: 0.85rem; padding: 0.45rem 1rem;">
            👨‍✈️ Drivers & KYC (${drivers.length})
          </button>
          <button class="admin-tab-btn btn ${activeTab === 'fares' ? 'btn-primary-yellow' : 'btn-ghost'}" data-tab="fares" style="font-size: 0.85rem; padding: 0.45rem 1rem;">
            💰 Fare Rules & Surge
          </button>
          <button class="admin-tab-btn btn ${activeTab === 'payments' ? 'btn-primary-yellow' : 'btn-ghost'}" data-tab="payments" style="font-size: 0.85rem; padding: 0.45rem 1rem;">
            💳 Payments Ledger
          </button>
          <button class="admin-tab-btn btn ${activeTab === 'support' ? 'btn-primary-yellow' : 'btn-ghost'}" data-tab="support" style="font-size: 0.85rem; padding: 0.45rem 1rem;">
            🎫 Support Tickets
          </button>
          <button class="admin-tab-btn btn ${activeTab === 'audit' ? 'btn-primary-yellow' : 'btn-ghost'}" data-tab="audit" style="font-size: 0.85rem; padding: 0.45rem 1rem;">
            🛡️ Audit Logs & DB Health
          </button>
        </div>
      </div>

      <!-- Main Admin Content Area -->
      <main class="container" style="padding: 2rem 1rem 4rem;">
        ${activeTab === 'dispatch' ? renderDispatchConsole() : ''}
        ${activeTab === 'fleet' ? renderFleetView() : ''}
        ${activeTab === 'drivers' ? renderDriversView() : ''}
        ${activeTab === 'fares' ? renderFareRulesView() : ''}
        ${activeTab === 'payments' ? renderPaymentsView() : ''}
        ${activeTab === 'support' ? renderSupportTicketsView() : ''}
        ${activeTab === 'audit' ? renderAuditView() : ''}
      </main>
    `;

    bindTabEvents();
    if (activeTab === 'dispatch') {
      initDispatchMap();
      bindDispatchEvents();
    }
    if (activeTab === 'fleet') bindFleetEvents();
    if (activeTab === 'drivers') bindDriversEvents();
    if (activeTab === 'fares') bindFaresEvents();
    if (activeTab === 'payments') loadPayments();
    if (activeTab === 'support') loadSupportTickets();
    if (activeTab === 'audit') loadAuditLogs();
  }

  function bindTabEvents() {
    container.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-tab');
        render();
      });
    });
  }

  // ===================== 1. DISPATCH CONSOLE =====================
  function renderDispatchConsole() {
    return `
      <!-- KPI Metric Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
        <div class="glass-panel" style="padding: 1.25rem; border-color: var(--border-violet);">
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Active Rides</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: #10B981; margin-top: 0.25rem;">
            ${metrics?.activeRides || 0}
          </div>
        </div>

        <div class="glass-panel" style="padding: 1.25rem; border-color: var(--border-yellow);">
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Pending Dispatch</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: var(--brand-yellow); margin-top: 0.25rem;">
            ${metrics?.pendingDispatch || 0}
          </div>
        </div>

        <div class="glass-panel" style="padding: 1.25rem;">
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Drivers Online</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: #fff; margin-top: 0.25rem;">
            ${metrics?.availableDrivers || 0} / ${drivers.length}
          </div>
        </div>

        <div class="glass-panel" style="padding: 1.25rem;">
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Today's Revenue</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: var(--brand-yellow); margin-top: 0.25rem;">
            ₹${metrics?.todayRevenue || 0}
          </div>
        </div>
      </div>

      <!-- Live Operations Map & Bookings Queue -->
      <div style="display: grid; grid-template-columns: 1fr; gap: 2rem;" class="lg-grid-2">
        <!-- Live Dispatch Map -->
        <div class="glass-panel" style="padding: 1.5rem; display: flex; flex-direction: column;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <div style="font-weight: 700; color: #fff; display: flex; align-items: center; gap: 0.5rem;">
              <span>🗺️ Dindigul Fleet Live Radar</span>
              <span class="badge badge-success animate-pulse-glow" style="font-size: 0.65rem;">ONLINE</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Radius: 25 km</div>
          </div>
          <div id="admin-dispatch-map" style="height: 420px; width: 100%; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--border-violet);"></div>
        </div>

        <!-- Bookings Queue -->
        <div class="glass-panel" style="padding: 1.75rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
            <h2 style="font-size: 1.25rem; color: #fff;">📋 Booking & Dispatch Queue</h2>
            <button id="refresh-dispatch-btn" class="btn btn-outline" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;">
              🔄 Refresh
            </button>
          </div>

          <div style="max-height: 440px; overflow-y: auto; padding-right: 0.5rem;">
            ${bookings.length === 0 ? `
              <div style="text-align: center; padding: 2rem; color: var(--text-muted);">No bookings in queue</div>
            ` : bookings.map(b => `
              <div style="background: rgba(255,255,255,0.03); border: 1px solid ${b.status === 'PENDING' ? 'var(--brand-yellow)' : 'var(--border-subtle)'}; border-radius: var(--radius-md); padding: 1rem; margin-bottom: 0.85rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                  <span style="font-size: 0.8rem; font-weight: 700; color: var(--brand-yellow);">${b.bookingRef}</span>
                  <span class="badge ${b.status === 'PENDING' ? 'badge-yellow' : (b.status === 'COMPLETED' ? 'badge-success' : 'badge-violet')}">${b.status}</span>
                </div>
                <div style="font-size: 0.85rem; color: #fff; font-weight: 600;">${b.pickupAddress} ➔ ${b.dropAddress}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem; display: flex; justify-content: space-between;">
                  <span>Customer: ${b.customer?.name || 'Customer'} (${b.customer?.phone || ''})</span>
                  <span style="color: var(--brand-yellow); font-weight: 700;">₹${(b.finalFare || b.estimatedFare).toFixed(2)} (${b.category})</span>
                </div>

                ${b.status === 'PENDING' ? `
                  <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
                    <button class="btn btn-primary-yellow auto-assign-btn" data-id="${b.id}" style="flex: 1; padding: 0.4rem; font-size: 0.75rem;">
                      ⚡ Auto Dispatch
                    </button>
                    <button class="btn btn-outline manual-assign-btn" data-id="${b.id}" data-category="${b.category}" style="flex: 1; padding: 0.4rem; font-size: 0.75rem;">
                      👤 Assign Driver
                    </button>
                  </div>
                ` : `
                  <div style="font-size: 0.75rem; color: #10B981; margin-top: 0.4rem;">
                    Assigned: ${b.driver?.name || 'Driver'} (${b.vehicle?.regNumber || 'Vehicle'})
                  </div>
                `}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function initDispatchMap() {
    const mapEl = document.getElementById('admin-dispatch-map');
    if (!mapEl) return;

    dispatchMap = L.map('admin-dispatch-map').setView([10.3673, 77.9803], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap FG DRIVO Dispatch'
    }).addTo(dispatchMap);

    // Add Dindigul 25km Service Boundary Circle
    L.circle([10.3673, 77.9803], {
      color: '#6C3CE9',
      fillColor: '#6C3CE9',
      fillOpacity: 0.08,
      radius: 12000 // 12km core radius circle
    }).addTo(dispatchMap).bindPopup('<b>Dindigul Core Service Zone</b>');

    // Add active drivers markers
    drivers.forEach(d => {
      const lat = d.currentLat || (10.3673 + (Math.random() - 0.5) * 0.02);
      const lng = d.currentLng || (77.9803 + (Math.random() - 0.5) * 0.02);
      const isOnline = d.isShiftActive;

      const icon = L.divIcon({
        className: 'dispatch-driver-pin',
        html: `<div style="background:${isOnline ? '#FFD629' : '#6b7280'}; color:#000; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.95rem; border:2px solid ${isOnline ? '#6C3CE9' : '#fff'}; box-shadow:0 0 10px rgba(0,0,0,0.5);">🚕</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const marker = L.marker([lat, lng], { icon }).addTo(dispatchMap)
        .bindPopup(`<b>${d.user?.name || 'Driver'}</b><br>Vehicle: ${d.assignedVehicle?.regNumber || 'N/A'}<br>Status: ${isOnline ? 'Online' : 'Offline'}`);

      driverMarkersMap.set(d.userId, marker);
    });
  }

  function updateMapDriverLocation(loc) {
    if (!dispatchMap || !loc.lat || !loc.lng) return;
    const existing = driverMarkersMap.get(loc.driverId);
    if (existing) {
      existing.setLatLng([loc.lat, loc.lng]);
    }
  }

  function bindDispatchEvents() {
    document.getElementById('refresh-dispatch-btn')?.addEventListener('click', init);

    // Auto Dispatch
    container.querySelectorAll('.auto-assign-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        try {
          btn.textContent = 'Dispatching...';
          const res = await api.assignDriver(id, 'usr-driver-2', 'veh-2');
          alert('Driver dispatched successfully!');
          init();
        } catch (e) {
          alert(e.message || 'Auto dispatch failed');
        }
      });
    });

    // Manual Assign
    container.querySelectorAll('.manual-assign-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const driver = drivers.find(d => d.isShiftActive) || drivers[0];
        if (!driver) {
          alert('No drivers online');
          return;
        }
        try {
          await api.assignDriver(id, driver.userId, driver.assignedVehicleId);
          alert(`Assigned ${driver.user?.name} to ride!`);
          init();
        } catch (e) {
          alert(e.message || 'Assignment failed');
        }
      });
    });
  }

  // ===================== 2. FLEET VIEW =====================
  function renderFleetView() {
    return `
      <div class="glass-panel" style="padding: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <div>
            <h2 style="font-size: 1.35rem; color: #fff;">🚗 FG DRIVO Owned Vehicle Fleet</h2>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">Directly managed and company-serviced vehicles in Dindigul</div>
          </div>
          <button id="add-vehicle-btn" class="btn btn-primary-yellow" style="font-size: 0.85rem; padding: 0.5rem 1rem;">
            + Add Vehicle
          </button>
        </div>

        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-subtle); text-align: left; color: var(--text-muted);">
                <th style="padding: 0.75rem 0.5rem;">Registration No.</th>
                <th style="padding: 0.75rem 0.5rem;">Model & Make</th>
                <th style="padding: 0.75rem 0.5rem;">Category</th>
                <th style="padding: 0.75rem 0.5rem;">Capacity</th>
                <th style="padding: 0.75rem 0.5rem;">Fuel</th>
                <th style="padding: 0.75rem 0.5rem;">Status</th>
                <th style="padding: 0.75rem 0.5rem;">Assigned Driver</th>
              </tr>
            </thead>
            <tbody>
              ${fleet.map(v => `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); color: #fff;">
                  <td style="padding: 0.85rem 0.5rem; font-weight: 700; color: var(--brand-yellow);">${v.regNumber}</td>
                  <td style="padding: 0.85rem 0.5rem;">${v.make} ${v.model} (${v.year})</td>
                  <td style="padding: 0.85rem 0.5rem;"><span class="badge badge-violet">${v.category}</span></td>
                  <td style="padding: 0.85rem 0.5rem;">${v.capacity} Pax</td>
                  <td style="padding: 0.85rem 0.5rem;">${v.fuelType || 'PETROL'}</td>
                  <td style="padding: 0.85rem 0.5rem;"><span class="badge ${v.status === 'ACTIVE' ? 'badge-success' : 'badge-error'}">${v.status}</span></td>
                  <td style="padding: 0.85rem 0.5rem; color: var(--text-secondary);">${v.driverProfiles?.[0]?.user?.name || 'Unassigned'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function bindFleetEvents() {
    document.getElementById('add-vehicle-btn')?.addEventListener('click', async () => {
      const regNumber = prompt('Enter Vehicle Registration Number (e.g. TN 57 E 9920):');
      if (!regNumber) return;
      const model = prompt('Enter Make and Model (e.g. Maruti Dzire / Tata Tiago EV):', 'Maruti Dzire');
      const category = prompt('Enter Category (AUTO, MINI, SEDAN, SUV):', 'SEDAN');

      try {
        await api.saveVehicle({
          regNumber,
          make: model.split(' ')[0] || 'Fleet',
          model: model.split(' ').slice(1).join(' ') || 'Cab',
          year: 2025,
          color: 'Yellow & Violet',
          category: category.toUpperCase(),
          capacity: category.toUpperCase() === 'SUV' ? 7 : (category.toUpperCase() === 'AUTO' ? 3 : 4),
          fuelType: 'PETROL',
          status: 'ACTIVE'
        });
        alert('Vehicle registered into fleet successfully!');
        init();
      } catch (e) {
        alert(e.message || 'Failed to add vehicle');
      }
    });
  }

  // ===================== 3. DRIVERS & KYC =====================
  function renderDriversView() {
    return `
      <div class="glass-panel" style="padding: 2rem;">
        <div style="margin-bottom: 1.5rem;">
          <h2 style="font-size: 1.35rem; color: #fff;">👨‍✈️ Driver Roster & KYC Compliance</h2>
          <div style="font-size: 0.8rem; color: var(--text-secondary);">Police verification, license verification, and duty status</div>
        </div>

        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-subtle); text-align: left; color: var(--text-muted);">
                <th style="padding: 0.75rem 0.5rem;">Driver Name</th>
                <th style="padding: 0.75rem 0.5rem;">Phone</th>
                <th style="padding: 0.75rem 0.5rem;">License Number</th>
                <th style="padding: 0.75rem 0.5rem;">Vehicle Assigned</th>
                <th style="padding: 0.75rem 0.5rem;">Rating</th>
                <th style="padding: 0.75rem 0.5rem;">KYC Status</th>
                <th style="padding: 0.75rem 0.5rem;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${drivers.map(d => `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); color: #fff;">
                  <td style="padding: 0.85rem 0.5rem; font-weight: 700;">${d.user?.name}</td>
                  <td style="padding: 0.85rem 0.5rem;">${d.user?.phone}</td>
                  <td style="padding: 0.85rem 0.5rem; font-family: monospace; color: var(--brand-yellow);">${d.licenseNumber}</td>
                  <td style="padding: 0.85rem 0.5rem;">${d.assignedVehicle?.regNumber || 'Not Assigned'}</td>
                  <td style="padding: 0.85rem 0.5rem; color: var(--brand-yellow);">★ ${d.rating}</td>
                  <td style="padding: 0.85rem 0.5rem;"><span class="badge ${d.kycStatus === 'APPROVED' ? 'badge-success' : 'badge-warning'}">${d.kycStatus}</span></td>
                  <td style="padding: 0.85rem 0.5rem;">
                    <button class="btn btn-outline toggle-kyc-btn" data-id="${d.userId}" data-status="${d.kycStatus === 'APPROVED' ? 'PENDING' : 'APPROVED'}" style="font-size: 0.75rem; padding: 0.3rem 0.65rem;">
                      ${d.kycStatus === 'APPROVED' ? 'Revoke KYC' : 'Approve KYC'}
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function bindDriversEvents() {
    container.querySelectorAll('.toggle-kyc-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const status = btn.getAttribute('data-status');
        try {
          await api.updateDriverKyc(id, status);
          alert(`Driver KYC status updated to ${status}`);
          init();
        } catch (e) {
          alert(e.message || 'Failed to update KYC');
        }
      });
    });
  }

  // ===================== 4. FARE RULES & SURGE =====================
  function renderFareRulesView() {
    return `
      <div class="glass-panel" style="padding: 2rem;">
        <div style="margin-bottom: 1.5rem;">
          <h2 style="font-size: 1.35rem; color: #fff;">💰 Dindigul Fare Matrix & Surge Configurator</h2>
          <div style="font-size: 0.8rem; color: var(--text-secondary);">Configure base fares, per km rates, minimum fares, and night surcharges.</div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem;">
          ${fareRules.map(r => `
            <div class="glass-panel" style="padding: 1.5rem; border-color: var(--border-violet);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <span style="font-size: 1.25rem; font-weight: 800; color: var(--brand-yellow);">${r.category}</span>
                <span class="badge badge-success">ACTIVE</span>
              </div>

              <form class="fare-update-form" data-category="${r.category}">
                <div class="form-group">
                  <label class="form-label">Base Fare (₹)</label>
                  <input type="number" class="form-input fare-base" value="${r.baseFare}" step="1" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Rate per Km (₹)</label>
                  <input type="number" class="form-input fare-per-km" value="${r.perKmRate}" step="0.5" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Minimum Fare (₹)</label>
                  <input type="number" class="form-input fare-min" value="${r.minimumFare}" step="1" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Night Surcharge Multiplier (10 PM - 5 AM)</label>
                  <input type="number" class="form-input fare-night" value="${r.nightSurchargeMultiplier || 1.25}" step="0.05" required />
                </div>

                <button type="submit" class="btn btn-primary-yellow" style="width: 100%; padding: 0.65rem; font-size: 0.85rem; margin-top: 0.5rem;">
                  Save Fare Rule
                </button>
              </form>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function bindFaresEvents() {
    container.querySelectorAll('.fare-update-form').forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const category = form.getAttribute('data-category');
        const baseFare = form.querySelector('.fare-base')?.value;
        const perKmRate = form.querySelector('.fare-per-km')?.value;
        const minimumFare = form.querySelector('.fare-min')?.value;
        const nightMultiplier = form.querySelector('.fare-night')?.value;

        try {
          await api.updateFareRule(category, {
            baseFare: Number(baseFare),
            baseDistanceKm: 2.0,
            perKmRate: Number(perKmRate),
            minimumFare: Number(minimumFare),
            waitingChargePerMin: 2.0,
            nightSurchargeMultiplier: Number(nightMultiplier),
            peakHourMultiplier: 1.15
          });
          alert(`Fare rules for ${category} updated successfully!`);
          init();
        } catch (err) {
          alert(err.message || 'Failed to update fare rule');
        }
      });
    });
  }

  // ===================== 5. PAYMENTS LEDGER =====================
  function renderPaymentsView() {
    return `
      <div class="glass-panel" style="padding: 2rem;">
        <h2 style="font-size: 1.35rem; color: #fff; margin-bottom: 1.5rem;">💳 Payments & Settlements Ledger</h2>
        <div id="payments-table-container">
          <div style="text-align: center; color: var(--text-muted); padding: 2rem;">Loading ledger...</div>
        </div>
      </div>
    `;
  }

  async function loadPayments() {
    const container = document.getElementById('payments-table-container');
    if (!container) return;

    try {
      const res = await api.getPaymentsLedger();
      const pays = res.payments || [];

      container.innerHTML = `
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-subtle); text-align: left; color: var(--text-muted);">
                <th style="padding: 0.75rem 0.5rem;">Transaction Ref</th>
                <th style="padding: 0.75rem 0.5rem;">Booking</th>
                <th style="padding: 0.75rem 0.5rem;">Amount</th>
                <th style="padding: 0.75rem 0.5rem;">Method</th>
                <th style="padding: 0.75rem 0.5rem;">Status</th>
                <th style="padding: 0.75rem 0.5rem;">Collected By</th>
                <th style="padding: 0.75rem 0.5rem;">Date</th>
              </tr>
            </thead>
            <tbody>
              ${pays.map(p => `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); color: #fff;">
                  <td style="padding: 0.85rem 0.5rem; font-family: monospace; color: var(--brand-yellow);">${p.transactionRef || p.id}</td>
                  <td style="padding: 0.85rem 0.5rem;">${p.booking?.bookingRef || p.bookingId}</td>
                  <td style="padding: 0.85rem 0.5rem; font-weight: 700;">₹${Number(p.amount).toFixed(2)}</td>
                  <td style="padding: 0.85rem 0.5rem;"><span class="badge badge-violet">${p.method}</span></td>
                  <td style="padding: 0.85rem 0.5rem;"><span class="badge ${p.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}">${p.status}</span></td>
                  <td style="padding: 0.85rem 0.5rem;">${p.collectedBy || 'DRIVER'}</td>
                  <td style="padding: 0.85rem 0.5rem; color: var(--text-muted);">${new Date(p.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (e) {
      container.innerHTML = `<div style="color: var(--status-error);">${e.message}</div>`;
    }
  }

  // ===================== 6. SUPPORT TICKETS =====================
  function renderSupportTicketsView() {
    return `
      <div class="glass-panel" style="padding: 2rem;">
        <h2 style="font-size: 1.35rem; color: #fff; margin-bottom: 1.5rem;">🎫 Customer Support Helpdesk</h2>
        <div id="admin-tickets-container">
          <div style="text-align: center; color: var(--text-muted); padding: 2rem;">Loading tickets...</div>
        </div>
      </div>
    `;
  }

  async function loadSupportTickets() {
    const container = document.getElementById('admin-tickets-container');
    if (!container) return;

    try {
      const res = await api.getAllSupportTickets();
      const tkts = res.tickets || [];

      container.innerHTML = tkts.length === 0 ? `<div style="text-align:center; color:var(--text-muted);">No tickets open</div>` : tkts.map(t => `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <div>
              <span style="font-weight: 700; color: var(--brand-yellow);">${t.ticketRef}</span>
              <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 0.5rem;">From: ${t.customer?.name} (${t.customer?.phone})</span>
            </div>
            <span class="badge ${t.status === 'RESOLVED' ? 'badge-success' : 'badge-warning'}">${t.status}</span>
          </div>
          <div style="font-weight: 600; color: #fff; margin-bottom: 0.25rem;">${t.subject}</div>
          <div style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5;">${t.message}</div>
          ${t.resolutionNotes ? `<div style="font-size: 0.8rem; color: #10B981; margin-top: 0.5rem;">Resolution: ${t.resolutionNotes}</div>` : `
            <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem;">
              <button class="btn btn-outline resolve-tkt-btn" data-id="${t.id}" style="font-size: 0.75rem; padding: 0.35rem 0.75rem;">
                ✓ Mark Resolved
              </button>
            </div>
          `}
        </div>
      `).join('');

      container.querySelectorAll('.resolve-tkt-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          const notes = prompt('Enter resolution note:');
          if (notes) {
            await api.updateSupportTicket(id, 'RESOLVED', notes);
            loadSupportTickets();
          }
        });
      });
    } catch (e) {
      container.innerHTML = `<div style="color: var(--status-error);">${e.message}</div>`;
    }
  }

  // ===================== 7. AUDIT & DB HEALTH =====================
  function renderAuditView() {
    return `
      <div style="display: grid; grid-template-columns: 1fr; gap: 2rem;" class="lg-grid-2">
        <!-- DB Health Details -->
        <div class="glass-panel" style="padding: 2rem;">
          <h2 style="font-size: 1.35rem; color: #fff; margin-bottom: 1.25rem;">🏥 Database & System Diagnostics</h2>
          <div id="health-diagnostic-box">
            <div style="color: var(--text-muted);">Probing database health...</div>
          </div>
        </div>

        <!-- Audit Log Stream -->
        <div class="glass-panel" style="padding: 2rem;">
          <h2 style="font-size: 1.35rem; color: #fff; margin-bottom: 1.25rem;">🛡️ Administrative Action Audit Trail</h2>
          <div id="audit-logs-container" style="max-height: 400px; overflow-y: auto;">
            <div style="color: var(--text-muted);">Loading logs...</div>
          </div>
        </div>
      </div>
    `;
  }

  async function loadAuditLogs() {
    const healthBox = document.getElementById('health-diagnostic-box');
    const logBox = document.getElementById('audit-logs-container');

    // Health
    if (healthBox) {
      try {
        const h = await api.checkHealth();
        healthBox.innerHTML = `
          <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.25rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <span style="color: var(--text-secondary);">Database Engine:</span>
              <strong style="color: #fff;">MySQL / Prisma Client</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <span style="color: var(--text-secondary);">Database Status:</span>
              <span class="badge ${h.database?.status === 'UP' ? 'badge-success' : 'badge-warning'}">${h.database?.status || 'READY'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <span style="color: var(--text-secondary);">Server Latency:</span>
              <span style="color: var(--brand-yellow);">${h.database?.latencyMs || 0} ms</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <span style="color: var(--text-secondary);">Service Uptime:</span>
              <span>${h.uptimeSeconds || 0} seconds</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-secondary);">Socket.IO State:</span>
              <span style="color: #10B981; font-weight: 700;">CONNECTED</span>
            </div>
          </div>
        `;
      } catch (e) {
        healthBox.innerHTML = `<div style="color: var(--status-error);">${e.message}</div>`;
      }
    }

    // Logs
    if (logBox) {
      try {
        const res = await api.getAuditLogs();
        const logs = res.logs || [];
        logBox.innerHTML = logs.length === 0 ? `<div style="color:var(--text-muted);">No audit logs</div>` : logs.map(l => `
          <div style="border-bottom: 1px solid rgba(255,255,255,0.05); padding: 0.65rem 0; font-size: 0.8rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.2rem;">
              <strong style="color: var(--brand-yellow);">${l.action}</strong>
              <span style="color: var(--text-muted);">${new Date(l.createdAt).toLocaleTimeString('en-IN')}</span>
            </div>
            <div style="color: var(--text-secondary);">Actor: ${l.actor?.name || l.actorRole} • Entity: ${l.entityType} (${l.entityId || 'N/A'})</div>
          </div>
        `).join('');
      } catch (e) {
        logBox.innerHTML = `<div style="color: var(--status-error);">${e.message}</div>`;
      }
    }
  }

  init();
}
