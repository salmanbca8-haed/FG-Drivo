const { z } = require('zod');
const { VEHICLE_CATEGORIES, BOOKING_STATUS, PAYMENT_METHODS } = require('../config/constants');

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['CUSTOMER', 'DRIVER', 'ADMIN', 'DISPATCHER']).default('CUSTOMER')
});

const loginSchema = z.object({
  identifier: z.string().min(3, 'Phone number or email required'),
  password: z.string().min(4, 'Password is required')
});

const bookingSchema = z.object({
  pickupAddress: z.string().min(3, 'Pickup address is required'),
  pickupLat: z.number({ required_error: 'Pickup latitude is required' }),
  pickupLng: z.number({ required_error: 'Pickup longitude is required' }),
  dropAddress: z.string().min(3, 'Drop address is required'),
  dropLat: z.number({ required_error: 'Drop latitude is required' }),
  dropLng: z.number({ required_error: 'Drop longitude is required' }),
  category: z.nativeEnum(VEHICLE_CATEGORIES, { errorMap: () => ({ message: 'Invalid vehicle category' }) }),
  isScheduled: z.boolean().optional().default(false),
  scheduledFor: z.string().datetime().optional().nullable()
});

const statusUpdateSchema = z.object({
  status: z.enum([
    BOOKING_STATUS.DRIVER_ARRIVED,
    BOOKING_STATUS.TRIP_STARTED,
    BOOKING_STATUS.COMPLETED,
    BOOKING_STATUS.CANCELLED
  ]),
  otpCode: z.string().optional(),
  cancellationReason: z.string().optional()
});

const locationUpdateSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  lat: z.number(),
  lng: z.number(),
  speed: z.number().optional().default(0),
  heading: z.number().optional().default(0)
});

function validate(schema) {
  return (req, res, next) => {
    try {
      req.validatedBody = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errorMessages = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return res.status(400).json({
          success: false,
          error: `Validation error: ${errorMessages}`,
          details: err.errors
        });
      }
      return res.status(400).json({
        success: false,
        error: 'Invalid request payload.'
      });
    }
  };
}

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  bookingSchema,
  statusUpdateSchema,
  locationUpdateSchema
};
