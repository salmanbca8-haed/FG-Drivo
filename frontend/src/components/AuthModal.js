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
  modalRoot.style.backgroundColor = 'rgba(5, 2, 15, 0.8)';
  modalRoot.style.backdropFilter = 'blur(10px)';
  modalRoot.className = 'animate-fade-in';

  let mode = 'login'; // 'login' or 'register'

  function updateContent() {
    modalRoot.innerHTML = `
      <div class="glass-panel" style="width: 100%; max-width: 480px; padding: 2rem; border-color: var(--border-violet); box-shadow: var(--shadow-lg); position: relative; margin: 1rem;">
        <button id="auth-close-btn" style="position: absolute; top: 1.25rem; right: 1.25rem; background: transparent; border: none; color: var(--text-muted); font-size: 1.5rem; cursor: pointer;">✕</button>

        <div style="text-align: center; margin-bottom: 1.5rem;">
          <img src="/assets/logo.jpg" alt="Logo" style="width: 52px; height: 52px; border-radius: 14px; margin: 0 auto 0.75rem; border: 2px solid var(--brand-yellow);" />
          <h2 style="font-size: 1.5rem; color: #fff;">${mode === 'login' ? 'Welcome to FG DRIVO' : 'Create an Account'}</h2>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">
            ${mode === 'login' ? 'Sign in to book cabs or manage dispatch operations' : 'Join Dindigul’s most reliable fleet service'}
          </p>
        </div>

        <!-- Quick Demo Profiles for instant testing -->
        <div style="background: rgba(108, 60, 233, 0.12); border: 1px solid var(--border-violet); border-radius: var(--radius-md); padding: 0.75rem; margin-bottom: 1.25rem;">
          <div style="font-size: 0.75rem; font-weight: 700; color: var(--brand-yellow); text-transform: uppercase; margin-bottom: 0.4rem; display: flex; align-items: center; justify-content: space-between;">
            <span>⚡ Quick Demo Logins</span>
            <span style="font-size: 0.7rem; color: var(--text-muted);">1-Click Fill</span>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
            <button class="demo-chip btn btn-ghost" data-phone="9842122001" data-pass="drivo123" style="font-size: 0.75rem; padding: 0.25rem 0.6rem; background: rgba(255, 255, 255, 0.08); border-radius: 6px;">👤 Customer (Priya)</button>
            <button class="demo-chip btn btn-ghost" data-phone="9842111002" data-pass="drivo123" style="font-size: 0.75rem; padding: 0.25rem 0.6rem; background: rgba(255, 255, 255, 0.08); border-radius: 6px;">🚕 Driver (Anand - Sedan)</button>
            <button class="demo-chip btn btn-ghost" data-phone="9842111001" data-pass="drivo123" style="font-size: 0.75rem; padding: 0.25rem 0.6rem; background: rgba(255, 255, 255, 0.08); border-radius: 6px;">🛺 Driver (Senthil - Auto)</button>
            <button class="demo-chip btn btn-ghost" data-phone="9842100001" data-pass="admin123" style="font-size: 0.75rem; padding: 0.25rem 0.6rem; background: rgba(255, 214, 41, 0.15); color: var(--brand-yellow); border-radius: 6px;">👑 Admin</button>
            <button class="demo-chip btn btn-ghost" data-phone="9842100002" data-pass="admin123" style="font-size: 0.75rem; padding: 0.25rem 0.6rem; background: rgba(108, 60, 233, 0.2); color: var(--brand-violet-light); border-radius: 6px;">📡 Dispatcher</button>
          </div>
        </div>

        <div id="auth-error-box" style="display: none; background: var(--status-error-bg); border: 1px solid var(--status-error); color: #fca5a5; padding: 0.65rem 0.85rem; border-radius: var(--radius-md); font-size: 0.85rem; margin-bottom: 1rem;"></div>

        <form id="auth-form">
          ${mode === 'register' ? `
            <div class="form-group">
              <label class="form-label">Full Name</label>
              <input type="text" id="auth-name" class="form-input" placeholder="e.g. Ramesh Kumar" required />
            </div>
            <div class="form-group">
              <label class="form-label">Email (Optional)</label>
              <input type="email" id="auth-email" class="form-input" placeholder="ramesh@gmail.com" />
            </div>
            <div class="form-group">
              <label class="form-label">Account Role</label>
              <select id="auth-role" class="form-select">
                <option value="CUSTOMER">Customer (Book Cabs)</option>
                <option value="DRIVER">Fleet Driver</option>
              </select>
            </div>
          ` : ''}

          <div class="form-group">
            <label class="form-label">Mobile Number (or Email)</label>
            <input type="text" id="auth-identifier" class="form-input" placeholder="98421XXXXX" required />
          </div>

          <div class="form-group">
            <label class="form-label">Password</label>
            <input type="password" id="auth-password" class="form-input" placeholder="••••••••" required />
          </div>

          <button type="submit" id="auth-submit-btn" class="btn btn-primary-yellow" style="width: 100%; padding: 0.85rem; margin-top: 0.5rem; font-size: 1rem;">
            ${mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style="text-align: center; margin-top: 1.25rem; font-size: 0.85rem; color: var(--text-secondary);">
          ${mode === 'login' ? `
            Don't have an account? <a href="#" id="toggle-auth-mode" style="color: var(--brand-yellow); font-weight: 600; text-decoration: none;">Sign Up</a>
          ` : `
            Already have an account? <a href="#" id="toggle-auth-mode" style="color: var(--brand-yellow); font-weight: 600; text-decoration: none;">Sign In</a>
          `}
        </div>
      </div>
    `;

    // Bind Close
    document.getElementById('auth-close-btn')?.addEventListener('click', onClose);

    // Bind Toggle Mode
    document.getElementById('toggle-auth-mode')?.addEventListener('click', (e) => {
      e.preventDefault();
      mode = mode === 'login' ? 'register' : 'login';
      updateContent();
    });

    // Bind Demo Chips
    modalRoot.querySelectorAll('.demo-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const phone = chip.getAttribute('data-phone');
        const pass = chip.getAttribute('data-pass');
        const idInput = document.getElementById('auth-identifier');
        const passInput = document.getElementById('auth-password');
        if (idInput) idInput.value = phone;
        if (passInput) passInput.value = pass;
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
        submitBtn.textContent = 'Authenticating...';
      }

      try {
        const identifier = document.getElementById('auth-identifier')?.value.trim();
        const password = document.getElementById('auth-password')?.value;

        if (mode === 'login') {
          const res = await api.login(identifier, password);
          onSuccess(res.user);
          onClose();
        } else {
          const name = document.getElementById('auth-name')?.value.trim();
          const email = document.getElementById('auth-email')?.value.trim();
          const role = document.getElementById('auth-role')?.value || 'CUSTOMER';
          const res = await api.register({
            name,
            phone: identifier,
            email: email || undefined,
            password,
            role
          });
          onSuccess(res.user);
          onClose();
        }
      } catch (err) {
        if (errorBox) {
          errorBox.textContent = err.message || 'Authentication failed. Please verify your credentials.';
          errorBox.style.display = 'block';
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = mode === 'login' ? 'Sign In' : 'Create Account';
        }
      }
    });
  }

  updateContent();
  document.body.appendChild(modalRoot);
}
