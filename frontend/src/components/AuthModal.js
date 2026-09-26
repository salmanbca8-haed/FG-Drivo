import { api } from '../services/api';

export function renderAuthModal({ isOpen, onClose, onSuccess }) {
  const existing = document.getElementById('auth-modal-root');
  if (existing) existing.remove();

  if (!isOpen) return;

  const modalRoot = document.createElement('div');
  modalRoot.id = 'auth-modal-root';
  modalRoot.style.position = 'fixed';
  modalRoot.style.inset = '0';
  modalRoot.style.zIndex = '1000';
  modalRoot.style.display = 'flex';
  modalRoot.style.alignItems = 'center';
  modalRoot.style.justifyContent = 'center';
  modalRoot.style.backgroundColor = 'rgba(5, 2, 15, 0.85)';
  modalRoot.style.backdropFilter = 'blur(12px)';
  modalRoot.className = 'animate-fade-in';

  let mode = 'register'; // default to 'register' if opened or 'login'

  function updateContent() {
    modalRoot.innerHTML = `
      <div class="glass-panel" style="width: 100%; max-width: 480px; padding: 2rem; border-color: var(--border-violet); box-shadow: var(--shadow-lg); position: relative; margin: 1rem; max-height: 90vh; overflow-y: auto;">
        <button id="auth-close-btn" style="position: absolute; top: 1.25rem; right: 1.25rem; background: transparent; border: none; color: var(--text-muted); font-size: 1.5rem; cursor: pointer;">✕</button>

        <div style="text-align: center; margin-bottom: 1.25rem;">
          <img src="/assets/logo.jpg" alt="Logo" style="width: 52px; height: 52px; border-radius: 14px; margin: 0 auto 0.5rem; border: 2px solid var(--brand-yellow);" />
          <h2 style="font-size: 1.45rem; color: #fff;">${mode === 'login' ? 'Sign In to FG DRIVO' : 'Create Customer Account'}</h2>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.2rem;">
            ${mode === 'login' ? 'Access your rides, receipts, and dispatch controls' : 'Book instant and scheduled cabs in Dindigul'}
          </p>
        </div>

        <!-- Mode Toggle Tabs -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; background: rgba(255,255,255,0.05); padding: 4px; border-radius: var(--radius-md); margin-bottom: 1.25rem;">
          <button id="tab-login-btn" class="btn ${mode === 'login' ? 'btn-primary-yellow' : 'btn-ghost'}" style="padding: 0.5rem; font-size: 0.85rem;">
            Sign In
          </button>
          <button id="tab-register-btn" class="btn ${mode === 'register' ? 'btn-primary-yellow' : 'btn-ghost'}" style="padding: 0.5rem; font-size: 0.85rem;">
            New Registration
          </button>
        </div>

        <!-- Quick Demo Profiles for instant testing -->
        <div style="background: rgba(108, 60, 233, 0.12); border: 1px solid var(--border-violet); border-radius: var(--radius-md); padding: 0.65rem 0.75rem; margin-bottom: 1.25rem;">
          <div style="font-size: 0.7rem; font-weight: 700; color: var(--brand-yellow); text-transform: uppercase; margin-bottom: 0.35rem; display: flex; align-items: center; justify-content: space-between;">
            <span>⚡ 1-Click Demo Profiles</span>
            <span style="font-size: 0.65rem; color: var(--text-muted);">Fill & Sign In</span>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 0.35rem;">
            <button class="demo-chip btn btn-ghost" data-phone="9842122001" data-pass="drivo123" style="font-size: 0.75rem; padding: 0.2rem 0.5rem; background: rgba(255, 255, 255, 0.08); border-radius: 6px;">👤 Priya (Customer)</button>
            <button class="demo-chip btn btn-ghost" data-phone="9842111002" data-pass="drivo123" style="font-size: 0.75rem; padding: 0.2rem 0.5rem; background: rgba(255, 255, 255, 0.08); border-radius: 6px;">🚕 Anand (Driver)</button>
            <button class="demo-chip btn btn-ghost" data-phone="9842100001" data-pass="admin123" style="font-size: 0.75rem; padding: 0.2rem 0.5rem; background: rgba(255, 214, 41, 0.15); color: var(--brand-yellow); border-radius: 6px;">👑 Admin</button>
            <button class="demo-chip btn btn-ghost" data-phone="9842100002" data-pass="admin123" style="font-size: 0.75rem; padding: 0.2rem 0.5rem; background: rgba(108, 60, 233, 0.2); color: var(--brand-violet-light); border-radius: 6px;">📡 Dispatch</button>
          </div>
        </div>

        <div id="auth-error-box" style="display: none; background: var(--status-error-bg); border: 1px solid var(--status-error); color: #fca5a5; padding: 0.65rem 0.85rem; border-radius: var(--radius-md); font-size: 0.85rem; margin-bottom: 1rem;"></div>

        <form id="auth-form">
          ${mode === 'register' ? `
            <div class="form-group">
              <label class="form-label">Full Name *</label>
              <input type="text" id="reg-name" class="form-input" placeholder="e.g. Ramesh Kumar" required autocomplete="name" />
            </div>

            <div class="form-group">
              <label class="form-label">Mobile Number *</label>
              <div style="display: flex; gap: 0.5rem;">
                <span style="background: rgba(255,255,255,0.08); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 0.75rem 0.85rem; font-size: 0.9rem; font-weight: 700; color: var(--brand-yellow); display: flex; align-items: center;">
                  +91
                </span>
                <input type="tel" id="reg-phone" class="form-input" placeholder="98421 XXXXX" maxlength="14" required autocomplete="tel" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Email Address (Optional)</label>
              <input type="email" id="reg-email" class="form-input" placeholder="ramesh@gmail.com" autocomplete="email" />
            </div>

            <div class="form-group">
              <label class="form-label">Account Role</label>
              <select id="reg-role" class="form-select">
                <option value="CUSTOMER" selected>Customer (Book Cabs)</option>
                <option value="DRIVER">Fleet Driver</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Password *</label>
              <input type="password" id="reg-password" class="form-input" placeholder="Create a password (min 4 chars)" required autocomplete="new-password" />
            </div>
          ` : `
            <div class="form-group">
              <label class="form-label">Mobile Number or Email</label>
              <input type="text" id="login-identifier" class="form-input" placeholder="9842100001 or name@example.com" required autocomplete="username" />
            </div>

            <div class="form-group">
              <label class="form-label">Password</label>
              <input type="password" id="login-password" class="form-input" placeholder="••••••••" required autocomplete="current-password" />
            </div>
          `}

          <button type="submit" id="auth-submit-btn" class="btn btn-primary-yellow" style="width: 100%; padding: 0.85rem; margin-top: 0.5rem; font-size: 1rem; font-weight: 800;">
            ${mode === 'login' ? 'Sign In' : 'Create Account & Start Riding'}
          </button>
        </form>
      </div>
    `;

    // Bind Close
    document.getElementById('auth-close-btn')?.addEventListener('click', onClose);

    // Bind Tab buttons
    document.getElementById('tab-login-btn')?.addEventListener('click', () => {
      mode = 'login';
      updateContent();
    });

    document.getElementById('tab-register-btn')?.addEventListener('click', () => {
      mode = 'register';
      updateContent();
    });

    // Bind Demo Chips
    modalRoot.querySelectorAll('.demo-chip').forEach(chip => {
      chip.addEventListener('click', async () => {
        const phone = chip.getAttribute('data-phone');
        const pass = chip.getAttribute('data-pass');
        const submitBtn = document.getElementById('auth-submit-btn');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Logging in...';
        }
        try {
          const res = await api.login(phone, pass);
          onSuccess(res.user);
          onClose();
        } catch (e) {
          alert(e.message || 'Demo login failed');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign In';
          }
        }
      });
    });

    // Handle Submit
    const form = document.getElementById('auth-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorBox = document.getElementById('auth-error-box');
      const submitBtn = document.getElementById('auth-submit-btn');

      if (errorBox) errorBox.style.display = 'none';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = mode === 'login' ? 'Signing in...' : 'Creating Account...';
      }

      try {
        if (mode === 'login') {
          const identifier = document.getElementById('login-identifier')?.value.trim();
          const password = document.getElementById('login-password')?.value;

          const res = await api.login(identifier, password);
          onSuccess(res.user);
          onClose();
        } else {
          const name = document.getElementById('reg-name')?.value.trim();
          const phone = document.getElementById('reg-phone')?.value.trim();
          const email = document.getElementById('reg-email')?.value.trim();
          const role = document.getElementById('reg-role')?.value || 'CUSTOMER';
          const password = document.getElementById('reg-password')?.value;

          const res = await api.register({
            name,
            phone,
            email: email || undefined,
            password,
            role
          });
          onSuccess(res.user);
          onClose();
        }
      } catch (err) {
        if (errorBox) {
          errorBox.textContent = err.message || 'Authentication failed. Please verify your details.';
          errorBox.style.display = 'block';
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = mode === 'login' ? 'Sign In' : 'Create Account & Start Riding';
        }
      }
    });
  }

  updateContent();
  document.body.appendChild(modalRoot);
}
