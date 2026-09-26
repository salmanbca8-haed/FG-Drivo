const API_BASE = 'http://localhost:5000/api';

class ApiService {
  constructor() {
    this.token = localStorage.getItem('fgdrivo_token') || null;
    this.currentUser = JSON.parse(localStorage.getItem('fgdrivo_user') || 'null');
  }

  setAuth(token, user) {
    this.token = token;
    this.currentUser = user;
    if (token) {
      localStorage.setItem('fgdrivo_token', token);
      localStorage.setItem('fgdrivo_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('fgdrivo_token');
      localStorage.removeItem('fgdrivo_user');
    }
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...(options.headers || {})
      }
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const res = await fetch(url, config);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP Error ${res.status}`);
      }
      return data;
    } catch (err) {
      console.error(`[API Error] ${endpoint}:`, err.message);
      throw err;
    }
  }

  // Health
  async checkHealth() {
    return this.request('/health');
  }

  // Auth
  async login(identifier, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: { identifier, password }
    });
    if (data.token && data.user) {
      this.setAuth(data.token, data.user);
    }
    return data;
  }

  async register(payload) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: payload
    });
    if (data.token && data.user) {
      this.setAuth(data.token, data.user);
    }
    return data;
  }

  async getProfile() {
    return this.request('/auth/profile');
  }

  logout() {
    this.setAuth(null, null);
  }

  // Fares & Geo
  async getFareRules() {
    return this.request('/fares/rules');
  }

  async getLandmarks(query = '') {
    return this.request(`/fares/landmarks?query=${encodeURIComponent(query)}`);
  }

  async estimateFare(payload) {
    return this.request('/bookings/estimate', {
      method: 'POST',
      body: payload
    });
  }

  // Bookings
  async createBooking(payload) {
    return this.request('/bookings', {
      method: 'POST',
      body: payload
    });
  }

  async getMyBookings() {
    return this.request('/bookings/my-bookings');
  }

  async getBooking(id) {
    return this.request(`/bookings/${id}`);
  }

  async cancelBooking(id, reason) {
    return this.request(`/bookings/${id}/cancel`, {
      method: 'POST',
      body: { reason }
    });
  }

  // Driver
  async toggleShift(isShiftActive, currentLat, currentLng) {
    return this.request('/drivers/shift', {
      method: 'POST',
      body: { isShiftActive, currentLat, currentLng }
    });
  }

  async getDriverTrips() {
    return this.request('/drivers/my-trips');
  }

  async updateTripStatus(bookingId, status, otpCode, cancellationReason) {
    return this.request(`/drivers/trips/${bookingId}/status`, {
      method: 'PATCH',
      body: { status, otpCode, cancellationReason }
    });
  }

  async getDriverEarnings() {
    return this.request('/drivers/earnings');
  }

  // Admin
  async getAdminMetrics() {
    return this.request('/admin/metrics');
  }

  async getDispatchBookings(status) {
    return this.request(`/admin/dispatch/bookings${status ? `?status=${status}` : ''}`);
  }

  async assignDriver(bookingId, driverId, vehicleId) {
    return this.request(`/admin/dispatch/assign/${bookingId}`, {
      method: 'POST',
      body: { driverId, vehicleId }
    });
  }

  async getFleet() {
    return this.request('/admin/fleet');
  }

  async saveVehicle(payload) {
    return this.request('/admin/fleet', {
      method: 'POST',
      body: payload
    });
  }

  async getDrivers() {
    return this.request('/admin/drivers');
  }

  async updateDriverKyc(driverId, kycStatus, assignedVehicleId) {
    return this.request(`/admin/drivers/${driverId}/kyc`, {
      method: 'PATCH',
      body: { kycStatus, assignedVehicleId }
    });
  }

  async updateFareRule(category, payload) {
    return this.request(`/admin/fares/${category}`, {
      method: 'PUT',
      body: payload
    });
  }

  async getPaymentsLedger() {
    return this.request('/admin/payments');
  }

  async getAuditLogs() {
    return this.request('/admin/audit-logs');
  }

  // Payments
  async initiatePayment(bookingId, amount, method, notes) {
    return this.request('/payments/initiate', {
      method: 'POST',
      body: { bookingId, amount, method, notes }
    });
  }

  async verifyPayment(bookingId, transactionRef, method, signature) {
    return this.request('/payments/verify', {
      method: 'POST',
      body: { bookingId, transactionRef, method, signature }
    });
  }

  async getReceipt(bookingId) {
    return this.request(`/payments/receipt/${bookingId}`);
  }

  // Support
  async createSupportTicket(subject, message, bookingId, priority) {
    return this.request('/support/tickets', {
      method: 'POST',
      body: { subject, message, bookingId, priority }
    });
  }

  async getMySupportTickets() {
    return this.request('/support/my-tickets');
  }

  async getAllSupportTickets() {
    return this.request('/support/admin/tickets');
  }

  async updateSupportTicket(ticketId, status, resolutionNotes) {
    return this.request(`/support/admin/tickets/${ticketId}`, {
      method: 'PATCH',
      body: { status, resolutionNotes }
    });
  }
}

export const api = new ApiService();
