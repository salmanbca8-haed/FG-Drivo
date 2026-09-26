import { api } from '../services/api';

export function renderNavbar(container, { currentPortal, onNavigate, onOpenAuth, onLogout }) {
  const user = api.currentUser;

  container.innerHTML = `
    <header class="sticky top-0 z-50 backdrop-blur-xl bg-opacity-85 border-b border-[var(--border-subtle)]" style="background-color: rgba(10, 5, 24, 0.85);">
      <div class="container" style="display: flex; align-items: center; justify-content: space-between; height: 72px;">
        <!-- Brand Logo & Name -->
        <div style="display: flex; align-items: center; gap: 0.85rem; cursor: pointer;" id="nav-brand-logo">
          <img src="/assets/logo.jpg" alt="FG DRIVO Logo" style="width: 44px; height: 44px; border-radius: 12px; border: 2px solid var(--brand-yellow); object-fit: cover;" />
          <div>
            <div style="font-family: var(--font-heading); font-weight: 800; font-size: 1.35rem; letter-spacing: -0.02em; display: flex; align-items: center; gap: 0.35rem;">
              <span style="color: var(--brand-yellow);">FG</span>
              <span style="color: #fff;">DRIVO</span>
              <span class="badge badge-violet" style="font-size: 0.65rem; padding: 2px 6px;">DINDIGUL</span>
            </div>
            <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 500;">Direct Fleet Taxi Service</div>
          </div>
        </div>

        <!-- Portal Tabs Navigation -->
        <nav style="display: flex; align-items: center; gap: 0.5rem;" class="portal-nav">
          <button id="nav-portal-customer" class="btn ${currentPortal === 'customer' ? 'btn-primary-yellow' : 'btn-ghost'}" style="font-size: 0.85rem; padding: 0.5rem 1rem;">
            <span>🚕</span> <span>Customer Ride</span>
          </button>
          <button id="nav-portal-driver" class="btn ${currentPortal === 'driver' ? 'btn-primary-yellow' : 'btn-ghost'}" style="font-size: 0.85rem; padding: 0.5rem 1rem;">
            <span>🧭</span> <span>Driver Portal</span>
          </button>
          <button id="nav-portal-admin" class="btn ${currentPortal === 'admin' ? 'btn-primary-yellow' : 'btn-ghost'}" style="font-size: 0.85rem; padding: 0.5rem 1rem;">
            <span>⚡</span> <span>Admin & Dispatch</span>
          </button>
        </nav>

        <!-- Right Side: DB Health & User Profile / Login -->
        <div style="display: flex; align-items: center; gap: 0.85rem;">
          <div id="db-health-badge" style="display: flex; align-items: center; gap: 0.4rem; padding: 0.3rem 0.65rem; border-radius: 9999px; font-size: 0.75rem; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-subtle);">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: #10B981; display: inline-block;"></span>
            <span id="db-health-text" style="color: var(--text-secondary);">Checking DB...</span>
          </div>

          ${user ? `
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <div style="text-align: right; display: none;" class="md-block">
                <div style="font-size: 0.85rem; font-weight: 600; color: #fff;">${user.name}</div>
                <div style="font-size: 0.7rem; color: var(--brand-yellow); text-transform: uppercase;">${user.role}</div>
              </div>
              <button id="nav-logout-btn" class="btn btn-outline" style="padding: 0.45rem 0.85rem; font-size: 0.8rem; border-radius: var(--radius-md);">
                Logout
              </button>
            </div>
          ` : `
            <button id="nav-login-btn" class="btn btn-primary-yellow" style="padding: 0.5rem 1.1rem; font-size: 0.85rem;">
              Sign In
            </button>
          `}
        </div>
      </div>
    </header>
  `;

  // Attach Event Listeners
  document.getElementById('nav-brand-logo')?.addEventListener('click', () => onNavigate('customer'));
  document.getElementById('nav-portal-customer')?.addEventListener('click', () => onNavigate('customer'));
  document.getElementById('nav-portal-driver')?.addEventListener('click', () => onNavigate('driver'));
  document.getElementById('nav-portal-admin')?.addEventListener('click', () => onNavigate('admin'));

  document.getElementById('nav-login-btn')?.addEventListener('click', onOpenAuth);
  document.getElementById('nav-logout-btn')?.addEventListener('click', onLogout);

  // Check health and update badge
  api.checkHealth().then(data => {
    const textEl = document.getElementById('db-health-text');
    const badgeEl = document.getElementById('db-health-badge');
    if (!textEl || !badgeEl) return;

    if (data.database && data.database.status === 'UP') {
      textEl.textContent = `MySQL Connected (${data.database.latencyMs}ms)`;
      textEl.style.color = '#10B981';
      badgeEl.querySelector('span').style.background = '#10B981';
    } else {
      textEl.textContent = `DB: Ready (${data.database.provider})`;
      textEl.style.color = '#F59E0B';
      badgeEl.querySelector('span').style.background = '#F59E0B';
    }
  }).catch(() => {
    const textEl = document.getElementById('db-health-text');
    if (textEl) textEl.textContent = 'API Ready';
  });
}
