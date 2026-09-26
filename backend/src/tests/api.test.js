const request = require('supertest');
const { app } = require('../server');

describe('FG DRIVO API & Business Logic Test Suite', () => {
  let customerToken = '';
  let driverToken = '';
  let adminToken = '';
  let createdBookingId = '';
  let rideOtp = '';

  test('1. Health Check Endpoint returns sanitized status without leaking secrets', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('service');
    expect(res.body).toHaveProperty('database');
    expect(res.body.database).toHaveProperty('status');
    expect(res.body.database).not.toHaveProperty('password');
  });

  test('2. Boundary Check: Dindigul Localities Fare Estimation Succeeds', async () => {
    // Dindigul Bus Stand (10.3625, 77.9701) to GTN Arts College (10.3950, 77.9890)
    const res = await request(app)
      .post('/api/bookings/estimate')
      .send({
        pickupLat: 10.3625,
        pickupLng: 77.9701,
        dropLat: 10.3950,
        dropLng: 77.9890,
        category: 'SEDAN'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.boundaryStatus).toBe('VERIFIED_DINDIGUL_SERVICE_ZONE');
    expect(res.body.data.distanceKm).toBeGreaterThan(0);
    expect(res.body.data.estimatedFare).toBeGreaterThanOrEqual(120);
    expect(res.body.data.fareRuleSnapshot).toBeDefined();
  });

  test('3. Boundary Check: Outside Dindigul (e.g., Chennai coordinates) is rejected', async () => {
    // Chennai coordinates (13.0827, 80.2707) is ~380km away from Dindigul
    const res = await request(app)
      .post('/api/bookings/estimate')
      .send({
        pickupLat: 13.0827,
        pickupLng: 80.2707,
        dropLat: 10.3625,
        dropLng: 77.9701,
        category: 'SEDAN'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.boundaryError).toBe(true);
    expect(res.body.error).toContain('outside Dindigul');
  });

  test('4. Customer Registration & Login', async () => {
    const randomPhone = `9842${Math.floor(100000 + Math.random() * 900000)}`;
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Vimal Test User',
        phone: randomPhone,
        email: `test_${randomPhone}@example.com`,
        password: 'password123',
        role: 'CUSTOMER'
      });

    expect(regRes.statusCode).toBe(201);
    expect(regRes.body.success).toBe(true);
    expect(regRes.body.token).toBeDefined();

    // Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: randomPhone,
        password: 'password123'
      });

    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body.token).toBeDefined();
    customerToken = loginRes.body.token;
  });

  test('5. Driver Login & Shift Toggle', async () => {
    // Login with pre-seeded driver (Anand Raj)
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: '9842111002',
        password: 'drivo123'
      });

    expect(loginRes.statusCode).toBe(200);
    driverToken = loginRes.body.token;

    // Start shift
    const shiftRes = await request(app)
      .post('/api/drivers/shift')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        isShiftActive: true,
        currentLat: 10.3680,
        currentLng: 77.9740
      });

    expect(shiftRes.statusCode).toBe(200);
    expect(shiftRes.body.success).toBe(true);
  });

  test('6. Admin Login & Metrics', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: '9842100001',
        password: 'admin123'
      });

    expect(loginRes.statusCode).toBe(200);
    adminToken = loginRes.body.token;

    const metricsRes = await request(app)
      .get('/api/admin/metrics')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(metricsRes.statusCode).toBe(200);
    expect(metricsRes.body.metrics).toHaveProperty('availableDrivers');
  });

  test('7. Customer Creates Booking within Dindigul with OTP & Fare Snapshot', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        pickupAddress: 'Dindigul Railway Junction, Nagal Nagar',
        pickupLat: 10.3695,
        pickupLng: 77.9730,
        dropAddress: 'Collectorate Complex, Dindigul',
        dropLat: 10.3440,
        dropLng: 77.9850,
        category: 'SEDAN',
        isScheduled: false,
        paymentMethod: 'CASH'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.booking.bookingRef).toMatch(/^FGD-\d{8}-\d{4}$/);
    expect(res.body.booking.otpCode).toBeDefined();

    createdBookingId = res.body.booking.id;
    rideOtp = res.body.booking.otpCode;
  });

  test('8. Dispatcher assigns available driver (usr-driver-4) to booking', async () => {
    const assignRes = await request(app)
      .post(`/api/admin/dispatch/assign/${createdBookingId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        driverId: 'usr-driver-4',
        vehicleId: 'veh-4'
      });

    expect(assignRes.statusCode).toBe(200);
    expect(assignRes.body.success).toBe(true);
    expect(assignRes.body.booking.driverId).toBe('usr-driver-4');
  });

  test('9. Driver Starts Trip: Fails with incorrect OTP, Succeeds with correct OTP', async () => {
    // Login as driver 4 (Muthu Krishnan)
    const driver4Login = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: '9842111004',
        password: 'drivo123'
      });
    const driver4Token = driver4Login.body.token;

    // First set to DRIVER_ARRIVED
    const arrivedRes = await request(app)
      .patch(`/api/drivers/trips/${createdBookingId}/status`)
      .set('Authorization', `Bearer ${driver4Token}`)
      .send({ status: 'DRIVER_ARRIVED' });

    expect(arrivedRes.statusCode).toBe(200);

    // Try starting with wrong OTP
    const wrongOtpRes = await request(app)
      .patch(`/api/drivers/trips/${createdBookingId}/status`)
      .set('Authorization', `Bearer ${driver4Token}`)
      .send({
        status: 'TRIP_STARTED',
        otpCode: '0000'
      });

    expect(wrongOtpRes.statusCode).toBe(400);
    expect(wrongOtpRes.body.error).toContain('Incorrect OTP');

    // Start with correct OTP
    const correctOtpRes = await request(app)
      .patch(`/api/drivers/trips/${createdBookingId}/status`)
      .set('Authorization', `Bearer ${driver4Token}`)
      .send({
        status: 'TRIP_STARTED',
        otpCode: rideOtp
      });

    expect(correctOtpRes.statusCode).toBe(200);
    expect(correctOtpRes.body.booking.status).toBe('TRIP_STARTED');

    // Complete Trip
    const completeRes = await request(app)
      .patch(`/api/drivers/trips/${createdBookingId}/status`)
      .set('Authorization', `Bearer ${driver4Token}`)
      .send({ status: 'COMPLETED' });

    expect(completeRes.statusCode).toBe(200);
    expect(completeRes.body.booking.status).toBe('COMPLETED');

    // Confirm Payment
    const payRes = await request(app)
      .post('/api/payments/verify')
      .set('Authorization', `Bearer ${driver4Token}`)
      .send({
        bookingId: createdBookingId,
        method: 'CASH'
      });

    expect(payRes.statusCode).toBe(200);
    expect(payRes.body.payment.status).toBe('COMPLETED');
  });
});
