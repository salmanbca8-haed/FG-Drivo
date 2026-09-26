import './styles/theme.css';
import { api } from './services/api';
import { socketService } from './services/socket';
import { renderNavbar } from './components/Navbar';
import { renderAuthModal } from './components/AuthModal';
import { renderCustomerPortal } from './portals/CustomerPortal';
import { renderDriverPortal } from './portals/DriverPortal';
import { renderAdminPortal } from './portals/AdminPortal';

class App {
  constructor() {
    this.currentPortal = 'customer'; // 'customer', 'driver', 'admin'
    this.appRoot = document.getElementById('app');
    this.init();
  }

  init() {
    // Initial Socket connection if token exists
    if (api.token) {
      socketService.connect();
    }

    this.render();
  }

  setPortal(portalName) {
    this.currentPortal = portalName;
    this.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  openAuth() {
    renderAuthModal({
      isOpen: true,
      onClose: () => renderAuthModal({ isOpen: false }),
      onSuccess: (user) => {
        socketService.connect();
        this.render();
      }
    });
  }

  logout() {
    api.logout();
    socketService.disconnect();
    this.render();
  }

  render() {
    this.appRoot.innerHTML = `
      <div id="navbar-container"></div>
      <div id="portal-content-container"></div>
      <footer style="border-top: 1px solid var(--border-subtle); padding: 2.5rem 0; background: rgba(10, 5, 24, 0.95); margin-top: 3rem;">
        <div class="container" style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1.5rem; font-size: 0.85rem; color: var(--text-muted);">
          <div>
            <div style="font-family: var(--font-heading); font-weight: 800; color: #fff; font-size: 1.15rem; margin-bottom: 0.35rem;">
              <span style="color: var(--brand-yellow);">FG</span> DRIVO TAXI
            </div>
            <div>Operating Exclusively in Dindigul City, Tamil Nadu, India.</div>
            <div style="font-size: 0.75rem; margin-top: 0.2rem;">Head Office: Palani Road, Near Bus Terminal, Dindigul 624001.</div>
          </div>
          <div style="display: flex; gap: 1.5rem;">
            <a href="#" style="color: var(--text-secondary); text-decoration: none;" onclick="window.scrollTo({top: 0, behavior: 'smooth'}); return false;">Back to Top</a>
            <span>•</span>
            <span>Helpline: 0451 - 2439800</span>
            <span>•</span>
            <span style="color: var(--brand-yellow);">Brand: #FFD629 / #6C3CE9</span>
          </div>
        </div>
      </footer>
    `;

    // Render Navbar
    const navContainer = document.getElementById('navbar-container');
    renderNavbar(navContainer, {
      currentPortal: this.currentPortal,
      onNavigate: (portal) => this.setPortal(portal),
      onOpenAuth: () => this.openAuth(),
      onLogout: () => this.logout()
    });

    // Render Active Portal
    const portalContainer = document.getElementById('portal-content-container');
    if (this.currentPortal === 'customer') {
      renderCustomerPortal(portalContainer, {
        onOpenAuth: () => this.openAuth()
      });
    } else if (this.currentPortal === 'driver') {
      renderDriverPortal(portalContainer, {
        onOpenAuth: () => this.openAuth()
      });
    } else if (this.currentPortal === 'admin') {
      renderAdminPortal(portalContainer, {
        onOpenAuth: () => this.openAuth()
      });
    }
  }
}

// Boot application
new App();
