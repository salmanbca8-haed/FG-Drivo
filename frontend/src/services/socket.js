import { io } from 'socket.io-client';
import { api } from './api';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect() {
    if (this.socket && this.socket.connected) return this.socket;

    const token = api.token;
    if (!token) return null;

    this.socket = io('http://localhost:5000', {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    this.socket.on('connect', () => {
      console.log('⚡ [Socket.IO] Connected to FG DRIVO Real-Time Server:', this.socket.id);
    });

    this.socket.on('connect_error', (err) => {
      console.warn('⚠️ [Socket.IO] Connection error:', err.message);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 [Socket.IO] Disconnected:', reason);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinBookingRoom(bookingId) {
    if (!this.socket) this.connect();
    if (this.socket) {
      this.socket.emit('join_booking_room', { bookingId });
    }
  }

  leaveBookingRoom(bookingId) {
    if (this.socket) {
      this.socket.emit('leave_booking_room', { bookingId });
    }
  }

  emitDriverGps(data) {
    if (!this.socket) this.connect();
    if (this.socket) {
      this.socket.emit('driver_gps_update', data);
    }
  }

  on(event, callback) {
    if (!this.socket) this.connect();
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

export const socketService = new SocketService();
