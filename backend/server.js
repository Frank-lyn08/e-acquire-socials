// ==============================================
// E-ACQUIRE BACKEND SERVER v1.0.0
// ==============================================

// 1. IMPORT REQUIRED PACKAGES
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// 2. CREATE EXPRESS APPLICATION
const app = express();

// 3. ENVIRONMENT VARIABLES VALIDATION
const requiredEnvVars = [
  'MONGODB_URI',
  'THEKCLAUT_API_KEY',
  'JWT_SECRET',
  'ADMIN_USERNAME',
  'ADMIN_PASSWORD',
  'ADMIN_EMAIL',
  'MONIEPOINT_ACCOUNT_NAME',
  'MONIEPOINT_ACCOUNT_NUMBER',
  'MONIEPOINT_BANK_NAME'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Constants from environment
const EQUITY_VALUE = parseInt(process.env.EQUITY_VALUE) || 10;
const MARKUP_PERCENTAGE = parseInt(process.env.MARKUP_PERCENTAGE) || 50;
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';
const APP_NAME = process.env.APP_NAME || 'E-Acquire';
const PORT = process.env.PORT || 5000;

console.log(`🚀 ${APP_NAME} Backend Server Initializing...`);
console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`💰 Equity Value: ${EQUITY_VALUE}`);
console.log(`📈 Markup Percentage: ${MARKUP_PERCENTAGE}%`);

// 4. SECURITY MIDDLEWARE SETUP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https://images.unsplash.com", "https://*"],
      connectSrc: ["'self'", process.env.FRONTEND_URL, "https://thekclaut.com"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// CORS Configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'https://e-acquire.netlify.app',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin && process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.get('/', (req, res) => {
  const frontendPath = path.join(__dirname, '../frontend', 'index.html');
  console.log('Looking for file at:', frontendPath); // Check Render logs
  res.sendFile(frontendPath);
});
// Handle preflight requests
app.options('*', cors());

// Request parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Custom request logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - IP: ${req.ip}`);
  next();
});

// 5. DATABASE CONNECTION
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4
    });
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    console.log(`👥 Collections: ${Object.keys(conn.connection.collections).length}`);
    
    // Test database connection
    await mongoose.connection.db.admin().ping();
    console.log(`📈 Database Ping: Success`);
    
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    console.error('💡 Tip: Check if your IP is whitelisted in MongoDB Atlas');
    process.exit(1);
  }
};

// Call connectDB
connectDB();

// 6. DATABASE SCHEMAS & MODELS
// =============================

// 6.1 USER SCHEMA
const userSchema = new mongoose.Schema({
  // Basic Information
  username: { 
    type: String, 
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers and underscores']
  },
  email: { 
    type: String, 
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  
  // Account Information
  balance: { 
    type: Number, 
    default: 0,
    min: [0, 'Balance cannot be negative']
  },
  totalSpent: { 
    type: Number, 
    default: 0
  },
  totalOrders: { 
    type: Number, 
    default: 0
  },
  
  // Referral System
  referralCode: { 
    type: String, 
    unique: true,
    sparse: true
  },
  referredBy: { 
    type: String, 
    default: null
  },
  referralCount: { 
    type: Number, 
    default: 0 
  },
  referralEarnings: { 
    type: Number, 
    default: 0 
  },
  
  // Account Status
  role: { 
    type: String, 
    enum: ['user', 'admin', 'support'], 
    default: 'user' 
  },
  isVerified: { 
    type: Boolean, 
    default: false 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  
  // Contact Information
  phone: { 
    type: String,
    match: [/^[0-9]{11}$/, 'Please enter a valid 11-digit phone number']
  },
  
  // Security
  lastLogin: { 
    type: Date 
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  
  // Timestamps
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 6.2 ORDER SCHEMA
const orderSchema = new mongoose.Schema({
  orderId: { 
    type: String, 
    unique: true, 
    required: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  // Service Information
  serviceId: { 
    type: String, 
    required: true 
  },
  serviceName: { 
    type: String, 
    required: true 
  },
  platform: {
    type: String,
    required: true,
    enum: ['instagram', 'tiktok', 'youtube', 'twitter', 'facebook', 'telegram', 'spotify']
  },
  type: {
    type: String,
    required: true,
    enum: ['followers', 'likes', 'views', 'comments', 'shares', 'subscribers', 'plays']
  },
  
  // Order Details
  targetUrl: { 
    type: String, 
    required: true 
  },
  quantity: { 
    type: Number, 
    required: true,
    min: [1, 'Quantity must be at least 1']
  },
  cost: { 
    type: Number, 
    required: true
  },
  
  // Status Tracking
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'in progress', 'completed', 'partial', 'cancelled', 'refunded', 'failed'],
    default: 'pending'
  },
  
  // API Integration
  apiOrderId: { 
    type: String 
  },
  startCount: { 
    type: Number 
  },
  remains: { 
    type: Number 
  },
  apiResponse: { 
    type: mongoose.Schema.Types.Mixed 
  },
  
  // Delivery Information
  estimatedDelivery: { 
    type: Date 
  },
  deliveredAt: { 
    type: Date 
  }
}, {
  timestamps: true
});

// 6.3 TRANSACTION SCHEMA
const transactionSchema = new mongoose.Schema({
  transactionId: { 
    type: String, 
    unique: true, 
    required: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  // Transaction Details
  type: { 
    type: String, 
    enum: ['deposit', 'order', 'refund', 'referral', 'bonus', 'withdrawal'], 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true
  },
  equities: { 
    type: Number, 
    required: true 
  },
  
  // Status
  status: { 
    type: String, 
    enum: ['pending', 'completed', 'failed', 'cancelled'], 
    default: 'pending' 
  },
  
  // Reference Information
  reference: { 
    type: String, 
    required: true 
  },
  
  // Deposit Specific
  proofImage: { 
    type: String 
  },
  moniepointDetails: {
    senderName: String,
    senderAccount: String,
    amount: Number,
    transactionDate: Date,
    transactionRef: String
  },
  
  // Verification
  verifiedBy: { 
    type: String, 
    default: null 
  },
  verifiedAt: { 
    type: Date 
  },
  notes: { 
    type: String 
  }
}, {
  timestamps: true
});

// 6.4 SERVICE SCHEMA
const serviceSchema = new mongoose.Schema({
  serviceId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  name: { 
    type: String, 
    required: true 
  },
  category: { 
    type: String, 
    required: true 
  },
  
  // Pricing
  rate: { 
    type: Number, 
    required: true
  },
  ourRate: { 
    type: Number, 
    required: true
  },
  nairaRate: {
    type: Number,
    required: true
  },
  
  // Limits
  min: { 
    type: Number, 
    required: true 
  },
  max: { 
    type: Number, 
    required: true 
  },
  
  // Features
  refill: { 
    type: Boolean, 
    default: false 
  },
  cancel: { 
    type: Boolean, 
    default: false 
  },
  
  // Platform Information
  platform: { 
    type: String, 
    required: true 
  },
  serviceType: {
    type: String,
    required: true
  },
  
  // Quality Information
  quality: { 
    type: String, 
    enum: ['high', 'medium', 'low'], 
    default: 'medium' 
  },
  speed: { 
    type: String, 
    enum: ['instant', 'fast', 'slow'], 
    default: 'fast' 
  },
  description: { 
    type: String 
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Metadata
  lastUpdated: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true
});

// 6.5 TICKET SCHEMA
const ticketSchema = new mongoose.Schema({
  ticketId: { 
    type: String, 
    unique: true, 
    required: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  // Ticket Information
  subject: { 
    type: String, 
    required: true,
    maxlength: [200, 'Subject cannot exceed 200 characters']
  },
  message: { 
    type: String, 
    required: true,
    maxlength: [2000, 'Message cannot exceed 2000 characters']
  },
  
  // Status Tracking
  status: { 
    type: String, 
    enum: ['open', 'in progress', 'awaiting reply', 'resolved', 'closed'],
    default: 'open'
  },
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  category: { 
    type: String, 
    enum: ['deposit', 'order', 'technical', 'account', 'refund', 'general', 'suggestion', 'complaint'],
    default: 'general'
  },
  
  // Assignment
  assignedTo: { 
    type: String, 
    default: null 
  },
  
  // Communication
  replies: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    message: String,
    isStaff: { type: Boolean, default: false },
    attachments: [String],
    createdAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

// 6.6 FAQ SCHEMA
const faqSchema = new mongoose.Schema({
  question: { 
    type: String, 
    required: true,
    maxlength: [500, 'Question cannot exceed 500 characters']
  },
  answer: { 
    type: String, 
    required: true,
    maxlength: [2000, 'Answer cannot exceed 2000 characters']
  },
  category: { 
    type: String, 
    required: true,
    enum: ['general', 'deposit', 'order', 'account', 'technical', 'pricing']
  },
  order: { 
    type: Number, 
    default: 0 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  }
}, {
  timestamps: true
});

// 6.7 NOTIFICATION SCHEMA
const notificationSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  title: { 
    type: String, 
    required: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  message: { 
    type: String, 
    required: true,
    maxlength: [500, 'Message cannot exceed 500 characters']
  },
  type: { 
    type: String, 
    enum: ['deposit', 'order', 'ticket', 'system', 'promotion', 'alert'],
    default: 'system'
  },
  isRead: { 
    type: Boolean, 
    default: false 
  },
  link: { 
    type: String 
  }
}, {
  timestamps: true
});

// 6.8 CREATE MODELS FROM SCHEMAS
const User = mongoose.model('User', userSchema);
const Order = mongoose.model('Order', orderSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const Service = mongoose.model('Service', serviceSchema);
const Ticket = mongoose.model('Ticket', ticketSchema);
const FAQ = mongoose.model('FAQ', faqSchema);
const Notification = mongoose.model('Notification', notificationSchema);

// 7. UTILITY FUNCTIONS
// ====================

// 7.1 Generate Unique IDs
const generateOrderId = () => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `EACQ-ORD-${timestamp}${random}`;
};

const generateTransactionId = () => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `EACQ-TXN-${timestamp}${random}`;
};

const generateTicketId = () => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `EACQ-TKT-${timestamp}${random}`;
};

const generateReference = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let ref = '';
  for (let i = 0; i < 10; i++) {
    ref += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `REF${ref}`;
};

// 7.2 Generate Referral Code
const generateReferralCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// 7.3 Validate Nigerian Phone Number
const validateNigerianPhone = (phone) => {
  const regex = /^(0|234)(7|8|9)(0|1)\d{8}$/;
  return regex.test(phone);
};

// 7.4 Format Currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN'
  }).format(amount);
};

// 8. AUTHENTICATION MIDDLEWARE
// ============================

// 8.1 JWT Verification Middleware
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found.'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Contact support.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Authentication failed.'
    });
  }
};

// 8.2 Admin Authorization Middleware
const authorizeAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Admin access required.'
    });
  }
};

// 8.3 Support Staff Authorization Middleware
const authorizeSupport = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'support')) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Support staff access required.'
    });
  }
};

// 9. THEKCLAUT API INTEGRATION
// ============================

// 9.1 Create API Instance - CORRECTED FOR THEKCLAUT API
const thekclautAPI = axios.create({
  baseURL: process.env.THEKCLAUT_API_URL || 'https://thekclaut.com/api/v2',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json'
  },
  timeout: 30000
});

// Helper function to convert object to URL-encoded string
const toFormData = (data) => {
  return Object.keys(data)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
    .join('&');
};

// Debug: Log API configuration on startup
console.log('🔧 Thekclaut API Configuration:');
console.log('- Base URL:', thekclautAPI.defaults.baseURL);
console.log('- API Key configured:', !!process.env.THEKCLAUT_API_KEY);
console.log('- Using POST with URL-encoded parameters');

// 9.2 Thekclaut API Helper Functions - FULLY FIXED
const thekclaut = {
  // Get all services
  async getServices() {
    try {
      console.log(`🔍 Calling Thekclaut API: ${thekclautAPI.defaults.baseURL} (action=services)`);
      
      const formData = toFormData({
        key: process.env.THEKCLAUT_API_KEY,
        action: 'services'
      });
      
      const response = await thekclautAPI.post('', formData);
      console.log(`✅ Thekclaut API Response [${response.status}]: Received ${Array.isArray(response.data) ? response.data.length : 0} services`);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Thekclaut API Error (getServices):');
      console.error('- Error Message:', error.message);
      console.error('- Response Status:', error.response?.status || 'No response');
      console.error('- Response Data:', error.response?.data || 'No data');
      console.error('- Request Data:', error.config?.data || 'No request data');
      
      return {
        success: false,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      };
    }
  },

  // Check balance
  async getBalance() {
    try {
      console.log(`🔍 Calling Thekclaut API: ${thekclautAPI.defaults.baseURL} (action=balance)`);
      
      const formData = toFormData({
        key: process.env.THEKCLAUT_API_KEY,
        action: 'balance'
      });
      
      const response = await thekclautAPI.post('', formData);
      console.log(`✅ Thekclaut API Response [${response.status}]: Balance = $${response.data?.balance || 'N/A'}`);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Thekclaut API Error (getBalance):');
      console.error('- Error Message:', error.message);
      console.error('- Response Status:', error.response?.status || 'No response');
      console.error('- Response Data:', error.response?.data || 'No data');
      
      return {
        success: false,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      };
    }
  },

  // Place order
  async placeOrder(serviceId, link, quantity, runs = null, interval = null) {
    try {
      console.log(`🔍 Calling Thekclaut API: ${thekclautAPI.defaults.baseURL} (action=add)`);
      console.log(`📦 Order Data: service=${serviceId}, link=${link}, quantity=${quantity}`);
      
      const formData = {
        key: process.env.THEKCLAUT_API_KEY,
        action: 'add',
        service: serviceId,
        link: link,
        quantity: quantity
      };
      
      // Add optional parameters
      if (runs) formData.runs = runs;
      if (interval) formData.interval = interval;
      
      const response = await thekclautAPI.post('', toFormData(formData));
      console.log(`✅ Thekclaut API Response [${response.status}]: Order ID = ${response.data?.order || 'N/A'}`);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Thekclaut API Error (placeOrder):');
      console.error('- Error Message:', error.message);
      console.error('- Response Status:', error.response?.status || 'No response');
      console.error('- Response Data:', error.response?.data || 'No data');
      
      return {
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status
      };
    }
  },

  // Check order status
  async checkOrderStatus(orderId) {
    try {
      console.log(`🔍 Calling Thekclaut API: ${thekclautAPI.defaults.baseURL} (action=status, order=${orderId})`);
      
      const formData = toFormData({
        key: process.env.THEKCLAUT_API_KEY,
        action: 'status',
        order: orderId
      });
      
      const response = await thekclautAPI.post('', formData);
      console.log(`✅ Thekclaut API Response [${response.status}]: Status = ${response.data?.status || 'N/A'}`);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Thekclaut API Error (checkOrderStatus):');
      console.error('- Error Message:', error.message);
      console.error('- Response Status:', error.response?.status || 'No response');
      console.error('- Response Data:', error.response?.data || 'No data');
      
      return {
        success: false,
        error: error.message,
        status: error.response?.status
      };
    }
  },

  // Create refill
  async createRefill(orderId) {
    try {
      console.log(`🔍 Calling Thekclaut API: ${thekclautAPI.defaults.baseURL} (action=refill, order=${orderId})`);
      
      const formData = toFormData({
        key: process.env.THEKCLAUT_API_KEY,
        action: 'refill',
        order: orderId
      });
      
      const response = await thekclautAPI.post('', formData);
      console.log(`✅ Thekclaut API Response [${response.status}]: Refill = ${response.data?.refill || 'N/A'}`);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Thekclaut API Error (createRefill):');
      console.error('- Error Message:', error.message);
      console.error('- Response Status:', error.response?.status || 'No response');
      console.error('- Response Data:', error.response?.data || 'No data');
      
      return {
        success: false,
        error: error.message,
        status: error.response?.status
      };
    }
  },

  // Cancel order
  async cancelOrder(orderId) {
    try {
      console.log(`🔍 Calling Thekclaut API: ${thekclautAPI.defaults.baseURL} (action=cancel, orders=${orderId})`);
      
      const formData = toFormData({
        key: process.env.THEKCLAUT_API_KEY,
        action: 'cancel',
        orders: orderId
      });
      
      const response = await thekclautAPI.post('', formData);
      console.log(`✅ Thekclaut API Response [${response.status}]: Cancel response received`);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Thekclaut API Error (cancelOrder):');
      console.error('- Error Message:', error.message);
      console.error('- Response Status:', error.response?.status || 'No response');
      console.error('- Response Data:', error.response?.data || 'No data');
      
      return {
        success: false,
        error: error.message,
        status: error.response?.status
      };
    }
  }
};

// 10. HELPER FUNCTIONS
// ===================

// 10.1 Calculate our price with configurable markup
const calculateOurPrice = (thekclautRate) => {
  const markupMultiplier = 1 + (MARKUP_PERCENTAGE / 100);
  const ourPriceNaira = thekclautRate * markupMultiplier;
  const ourPriceEquities = ourPriceNaira / EQUITY_VALUE;
  
  return {
    naira: Math.ceil(ourPriceNaira),
    equities: Math.ceil(ourPriceEquities)
  };
};

// 10.2 Send notification
const sendNotification = async (userId, title, message, type = 'system', link = null) => {
  try {
    const notification = new Notification({
      userId,
      title,
      message,
      type,
      link
    });
    await notification.save();
    return true;
  } catch (error) {
    console.error('Error sending notification:', error);
    return false;
  }
};

// 10.3 Update user's last login
const updateLastLogin = async (userId) => {
  try {
    await User.findByIdAndUpdate(userId, {
      lastLogin: new Date(),
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Error updating last login:', error);
  }
};

// 10.4 Function to update services from Thekclaut
const updateServicesFromThekclaut = async () => {
  try {
    console.log('🔄 Updating services from Thekclaut...');
    
    const response = await thekclaut.getServices();
    
    if (!response.success) {
      console.error('❌ Failed to fetch services from Thekclaut:', response.error);
      return { success: false, error: response.error };
    }

    // IMPORTANT: Thekclaut returns array of services, not nested
    const services = response.data;
    
    if (!Array.isArray(services)) {
      console.error('❌ Invalid services response:', services);
      return { success: false, error: 'Invalid services response format' };
    }
    
    console.log(`📊 Received ${services.length} services from Thekclaut`);
    
    let updatedCount = 0;
    let newCount = 0;
    let errorCount = 0;

    for (const service of services) {
      try {
        // Convert rate from string to number
        const rate = parseFloat(service.rate);
        
        if (isNaN(rate)) {
          console.warn(`⚠️ Invalid rate for service ${service.service}: ${service.rate}`);
          continue;
        }
        
        const ourPrice = calculateOurPrice(rate);
        
        let platform = 'other';
        let serviceType = 'other';
        const name = service.name.toLowerCase();
        
        // Detect platform
        if (name.includes('instagram') || name.includes('ig')) platform = 'instagram';
        else if (name.includes('tiktok')) platform = 'tiktok';
        else if (name.includes('youtube') || name.includes('yt')) platform = 'youtube';
        else if (name.includes('twitter') || name.includes('x')) platform = 'twitter';
        else if (name.includes('facebook') || name.includes('fb')) platform = 'facebook';
        else if (name.includes('telegram') || name.includes('tg')) platform = 'telegram';
        else if (name.includes('spotify')) platform = 'spotify';

        // Detect service type
        if (name.includes('follower')) serviceType = 'followers';
        else if (name.includes('like')) serviceType = 'likes';
        else if (name.includes('view')) serviceType = 'views';
        else if (name.includes('comment')) serviceType = 'comments';
        else if (name.includes('share') || name.includes('retweet')) serviceType = 'shares';
        else if (name.includes('subscriber')) serviceType = 'subscribers';
        else if (name.includes('play')) serviceType = 'plays';

        // IMPORTANT: Thekclaut uses "service" field, not "id"
        const existingService = await Service.findOne({ serviceId: service.service.toString() });
        
        if (existingService) {
          existingService.name = service.name;
          existingService.category = service.type || service.category || 'Uncategorized';
          existingService.rate = rate;
          existingService.ourRate = ourPrice.equities;
          existingService.nairaRate = ourPrice.naira;
          existingService.min = parseInt(service.min) || 0;
          existingService.max = parseInt(service.max) || 0;
          existingService.refill = Boolean(service.refill);
          existingService.cancel = Boolean(service.cancel);
          existingService.platform = platform;
          existingService.serviceType = serviceType;
          existingService.lastUpdated = new Date();
          
          await existingService.save();
          updatedCount++;
        } else {
          const newService = new Service({
            serviceId: service.service.toString(),
            name: service.name,
            category: service.type || service.category || 'Uncategorized',
            rate: rate,
            ourRate: ourPrice.equities,
            nairaRate: ourPrice.naira,
            min: parseInt(service.min) || 0,
            max: parseInt(service.max) || 0,
            refill: Boolean(service.refill),
            cancel: Boolean(service.cancel),
            platform: platform,
            serviceType: serviceType,
            lastUpdated: new Date()
          });
          
          await newService.save();
          newCount++;
        }
      } catch (error) {
        console.error(`Error processing service ${service.service}:`, error.message);
        errorCount++;
      }
    }

    console.log(`✅ Services updated: ${updatedCount} updated, ${newCount} added, ${errorCount} errors`);
    return { success: true, updated: updatedCount, added: newCount, errors: errorCount };

  } catch (error) {
    console.error('❌ Error updating services:', error.message);
    return { success: false, error: error.message };
  }
};

// 11. API ROUTES
// ==============

// 11.1 HEALTH CHECK ENDPOINT
app.get('/api/health', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState;
    const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    
    const apiCheck = await thekclaut.getBalance();
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    res.json({
      success: true,
      message: `${APP_NAME} API is running`,
      timestamp: new Date().toISOString(),
      app: {
        name: APP_NAME,
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`
      },
      database: {
        status: dbStates[dbStatus],
        connected: dbStatus === 1,
        name: mongoose.connection.name,
        host: mongoose.connection.host
      },
      thekclautAPI: {
        status: apiCheck.success ? 'connected' : 'disconnected',
        balance: apiCheck.success ? `₦${apiCheck.data.balance}` : 'unavailable',
        key: process.env.THEKCLAUT_API_KEY ? 'Configured' : 'Missing'
      },
      configuration: {
        equityValue: EQUITY_VALUE,
        markupPercentage: MARKUP_PERCENTAGE,
        jwtExpire: JWT_EXPIRE,
        port: PORT,
        frontendUrl: process.env.FRONTEND_URL,
        moniepointAccount: process.env.MONIEPOINT_ACCOUNT_NUMBER ? 'Configured' : 'Missing'
      },
      system: {
        memory: {
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`
        },
        platform: process.platform,
        arch: process.arch
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 11.2 AUTHENTICATION ROUTES
// ==========================

// REGISTER
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, phone, referralCode } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required'
      });
    }

    // Email validation
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email ? 'Email already registered' : 'Username already taken'
      });
    }

    // Phone validation
    if (phone && !validateNigerianPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid Nigerian phone number'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate referral code
    const userReferralCode = generateReferralCode();

    // Create user
    const user = new User({
      username,
      email,
      password: hashedPassword,
      phone,
      referralCode: userReferralCode
    });

    // Handle referral
    if (referralCode) {
      const referrer = await User.findOne({ referralCode });
      if (referrer) {
        user.referredBy = referrer.referralCode;
      }
    }

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRE }
    );

    // Update last login
    await updateLastLogin(user._id);

    // Send welcome notification
    await sendNotification(
      user._id,
      'Welcome to E-Acquire! 🎉',
      'Your account has been created successfully. Make your first deposit to start boosting your social media.',
      'system'
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        balance: user.balance,
        referralCode: user.referralCode,
        role: user.role,
        phone: user.phone
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
});

// LOGIN
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Contact support.'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRE }
    );

    // Update last login
    await updateLastLogin(user._id);

    // Send login notification
    await sendNotification(
      user._id,
      'New Login Detected',
      `You logged into your E-Acquire account at ${new Date().toLocaleTimeString()}.`,
      'alert'
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        balance: user.balance,
        referralCode: user.referralCode,
        role: user.role,
        phone: user.phone
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

// 11.3 USER PROFILE ROUTES
// ========================

// GET PROFILE
app.get('/api/user/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        balance: user.balance,
        totalSpent: user.totalSpent,
        totalOrders: user.totalOrders,
        referralCode: user.referralCode,
        referralCount: user.referralCount,
        referralEarnings: user.referralEarnings,
        role: user.role,
        phone: user.phone,
        isVerified: user.isVerified,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: error.message
    });
  }
});

// UPDATE PROFILE
app.put('/api/user/profile', authenticate, async (req, res) => {
  try {
    const { phone } = req.body;
    const updates = {};

    if (phone) {
      if (!validateNigerianPhone(phone)) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid Nigerian phone number'
        });
      }
      updates.phone = phone;
    }

    updates.updatedAt = new Date();

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
});

// CHANGE PASSWORD
app.post('/api/user/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    // Verify current password
    const user = await User.findById(req.user._id).select('+password');
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedPassword;
    user.updatedAt = new Date();
    await user.save();

    // Send notification
    await sendNotification(
      user._id,
      'Password Changed',
      'Your E-Acquire account password has been changed successfully.',
      'alert'
    );

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message
    });
  }
});

// 11.4 DEPOSIT ROUTES
// ====================

// GET DEPOSIT DETAILS
app.get('/api/deposit/details', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      accountDetails: {
        accountName: process.env.MONIEPOINT_ACCOUNT_NAME,
        accountNumber: process.env.MONIEPOINT_ACCOUNT_NUMBER,
        bankName: process.env.MONIEPOINT_BANK_NAME,
        note: 'Send exact amount with your reference number. Upload proof after payment.'
      },
      support: {
        email: process.env.SUPPORT_EMAIL,
        phone: process.env.SUPPORT_PHONE,
        whatsapp: process.env.SUPPORT_WHATSAPP
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch deposit details',
      error: error.message
    });
  }
});

// REQUEST DEPOSIT
app.post('/api/deposit/request', authenticate, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || isNaN(amount)) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required'
      });
    }

    const amountNum = parseFloat(amount);
    
    // Minimum deposit: ₦500 (50 equities)
    if (amountNum < 500) {
      return res.status(400).json({
        success: false,
        message: 'Minimum deposit is ₦500'
      });
    }

    // Maximum deposit: ₦500,000 (50,000 equities)
    if (amountNum > 500000) {
      return res.status(400).json({
        success: false,
        message: 'Maximum deposit is ₦500,000'
      });
    }

    // Calculate equities
    const equities = Math.floor(amountNum / EQUITY_VALUE);

    // Generate reference
    const reference = generateReference();
    const transactionId = generateTransactionId();

    // Create deposit request
    const transaction = new Transaction({
      transactionId,
      userId: req.user._id,
      type: 'deposit',
      amount: amountNum,
      equities: equities,
      status: 'pending',
      reference: reference
    });

    await transaction.save();

    // Send notification
    await sendNotification(
      req.user._id,
      'Deposit Request Created',
      `Your deposit request of ${formatCurrency(amountNum)} (${equities} equities) has been created.`,
      'deposit'
    );

    res.status(201).json({
      success: true,
      message: 'Deposit request created successfully',
      deposit: {
        transactionId: transaction.transactionId,
        amount: transaction.amount,
        equities: transaction.equities,
        reference: transaction.reference,
        status: transaction.status,
        createdAt: transaction.createdAt
      },
      instructions: {
        1: `Send ${formatCurrency(amountNum)} to: ${process.env.MONIEPOINT_ACCOUNT_NAME}`,
        2: `Account Number: ${process.env.MONIEPOINT_ACCOUNT_NUMBER}`,
        3: `Bank: ${process.env.MONIEPOINT_BANK_NAME}`,
        4: `Use Reference: ${reference}`,
        5: 'Upload payment proof after payment'
      }
    });

  } catch (error) {
    console.error('Deposit request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create deposit request',
      error: error.message
    });
  }
});

// UPLOAD PAYMENT PROOF
app.post('/api/deposit/upload-proof', authenticate, async (req, res) => {
  try {
    const { transactionId, proofImage, senderName, senderAccount, transactionDate } = req.body;

    if (!transactionId || !proofImage) {
      return res.status(400).json({
        success: false,
        message: 'Transaction ID and proof image are required'
      });
    }

    // Find the transaction
    const transaction = await Transaction.findOne({
      transactionId,
      userId: req.user._id,
      type: 'deposit',
      status: 'pending'
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Pending deposit not found'
      });
    }

    // Update transaction with proof
    transaction.proofImage = proofImage;
    transaction.moniepointDetails = {
      senderName: senderName || 'Not provided',
      senderAccount: senderAccount || 'Not provided',
      transactionDate: transactionDate ? new Date(transactionDate) : new Date()
    };
    transaction.updatedAt = new Date();

    await transaction.save();

    // Send notification to user
    await sendNotification(
      req.user._id,
      'Payment Proof Uploaded',
      'Your payment proof has been uploaded successfully. Please wait for admin verification (usually within 2-12 hours).',
      'deposit'
    );

    res.json({
      success: true,
      message: 'Payment proof uploaded successfully',
      transaction: {
        transactionId: transaction.transactionId,
        status: transaction.status,
        updatedAt: transaction.updatedAt
      }
    });

  } catch (error) {
    console.error('Upload proof error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload proof',
      error: error.message
    });
  }
});

// GET DEPOSIT HISTORY
app.get('/api/deposit/history', authenticate, async (req, res) => {
  try {
    const transactions = await Transaction.find({
      userId: req.user._id,
      type: 'deposit'
    }).sort({ createdAt: -1 }).limit(50);

    res.json({
      success: true,
      transactions: transactions.map(t => ({
        transactionId: t.transactionId,
        amount: t.amount,
        equities: t.equities,
        status: t.status,
        reference: t.reference,
        proofImage: t.proofImage,
        verifiedBy: t.verifiedBy,
        verifiedAt: t.verifiedAt,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt
      })),
      total: transactions.length
    });
  } catch (error) {
    console.error('Deposit history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch deposit history',
      error: error.message
    });
  }
});

// 11.5 SERVICE ROUTES
// ===================

// GET ALL SERVICES
app.get('/api/services', async (req, res) => {
  try {
    // Get all active services
    const services = await Service.find({ isActive: true }).sort({
      platform: 1,
      serviceType: 1,
      rate: 1
    });

    // Group services by platform
    const groupedServices = {};
    services.forEach(service => {
      if (!groupedServices[service.platform]) {
        groupedServices[service.platform] = [];
      }
      
      groupedServices[service.platform].push({
        id: service.serviceId,
        name: service.name,
        category: service.category,
        platform: service.platform,
        type: service.serviceType,
        rate: service.rate,
        ourRate: service.ourRate,
        nairaRate: service.nairaRate,
        min: service.min,
        max: service.max,
        refill: service.refill,
        cancel: service.cancel,
        quality: service.quality,
        speed: service.speed,
        description: service.description,
        isActive: service.isActive
      });
    });

    // Get last updated service
    const lastUpdatedService = await Service.findOne().sort({ lastUpdated: -1 });

    res.json({
      success: true,
      services: groupedServices,
      lastUpdated: lastUpdatedService?.lastUpdated || new Date(),
      count: services.length,
      pricing: {
        equityValue: EQUITY_VALUE,
        markupPercentage: MARKUP_PERCENTAGE
      }
    });

  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch services',
      error: error.message
    });
  }
});

// GET SERVICE BY ID
app.get('/api/services/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    
    const service = await Service.findOne({ serviceId });
    
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    res.json({
      success: true,
      service: {
        id: service.serviceId,
        name: service.name,
        category: service.category,
        platform: service.platform,
        type: service.serviceType,
        rate: service.rate,
        ourRate: service.ourRate,
        nairaRate: service.nairaRate,
        min: service.min,
        max: service.max,
        refill: service.refill,
        cancel: service.cancel,
        description: service.description,
        quality: service.quality,
        speed: service.speed,
        isActive: service.isActive,
        lastUpdated: service.lastUpdated
      }
    });

  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service',
      error: error.message
    });
  }
});

// 11.6 ORDER ROUTES
// =================

// CALCULATE ORDER COST
app.post('/api/orders/calculate', authenticate, async (req, res) => {
  try {
    const { serviceId, quantity } = req.body;

    if (!serviceId || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'Service ID and quantity are required'
      });
    }

    const service = await Service.findOne({ serviceId });
    
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Validate quantity
    const quantityNum = parseInt(quantity);
    if (quantityNum < service.min || quantityNum > service.max) {
      return res.status(400).json({
        success: false,
        message: `Quantity must be between ${service.min} and ${service.max}`
      });
    }

    // Calculate cost
    const cost = Math.ceil((service.ourRate / 1000) * quantityNum);
    const costNaira = cost * EQUITY_VALUE;

    res.json({
      success: true,
      calculation: {
        serviceName: service.name,
        platform: service.platform,
        type: service.serviceType,
        quantity: quantityNum,
        costEquities: cost,
        costNaira: costNaira,
        perUnit: {
          equities: (service.ourRate / 1000).toFixed(3),
          naira: ((service.ourRate * EQUITY_VALUE) / 1000).toFixed(2)
        },
        min: service.min,
        max: service.max
      }
    });

  } catch (error) {
    console.error('Calculate order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate order cost',
      error: error.message
    });
  }
});

// PLACE ORDER
app.post('/api/orders/place', authenticate, async (req, res) => {
  try {
    const { serviceId, targetUrl, quantity } = req.body;

    if (!serviceId || !targetUrl || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'Service ID, target URL, and quantity are required'
      });
    }

    // Get service
    const service = await Service.findOne({ serviceId });
    
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Validate quantity
    const quantityNum = parseInt(quantity);
    if (quantityNum < service.min || quantityNum > service.max) {
      return res.status(400).json({
        success: false,
        message: `Quantity must be between ${service.min} and ${service.max}`
      });
    }

    // Calculate cost
    const cost = Math.ceil((service.ourRate / 1000) * quantityNum);

    // Check user balance
    if (req.user.balance < cost) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance. Please deposit more funds.'
      });
    }

    // Generate order ID
    const orderId = generateOrderId();

    // Create order in database
    const order = new Order({
      orderId,
      userId: req.user._id,
      serviceId,
      serviceName: service.name,
      platform: service.platform,
      type: service.serviceType,
      targetUrl,
      quantity: quantityNum,
      cost,
      status: 'pending'
    });

    // Place order on Thekclaut API
    const thekclautOrder = await thekclaut.placeOrder(serviceId, targetUrl, quantityNum);
    
    if (!thekclautOrder.success) {
      // Update order status to failed
      order.status = 'failed';
      order.apiResponse = thekclautOrder.error;
      await order.save();

      return res.status(500).json({
        success: false,
        message: 'Failed to place order on Thekclaut',
        error: thekclautOrder.error
      });
    }

    // Update order with Thekclaut response
    order.apiOrderId = thekclautOrder.data.order;
    order.status = 'processing';
    order.apiResponse = thekclautOrder.data;
    await order.save();

    // Deduct from user balance
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 
        balance: -cost,
        totalSpent: cost,
        totalOrders: 1
      },
      $set: { updatedAt: new Date() }
    });

    // Create transaction record
    const transaction = new Transaction({
      transactionId: generateTransactionId(),
      userId: req.user._id,
      type: 'order',
      amount: cost * EQUITY_VALUE,
      equities: cost,
      status: 'completed',
      reference: orderId,
      notes: `Order: ${service.name} - ${quantityNum} units`
    });

    await transaction.save();

    // Send notification
    await sendNotification(
      req.user._id,
      'Order Placed Successfully!',
      `Your order for ${service.name} has been placed. Order ID: ${orderId}`,
      'order',
      `/orders/${orderId}`
    );

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      order: {
        orderId: order.orderId,
        serviceName: order.serviceName,
        targetUrl: order.targetUrl,
        quantity: order.quantity,
        cost: order.cost,
        status: order.status,
        apiOrderId: order.apiOrderId,
        createdAt: order.createdAt
      }
    });

  } catch (error) {
    console.error('Place order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to place order',
      error: error.message
    });
  }
});

// GET USER ORDERS
app.get('/api/orders/my-orders', authenticate, async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;
    const skip = (page - 1) * limit;
    
    const query = { userId: req.user._id };
    if (status && status !== 'all') {
      query.status = status;
    }
    
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      orders: orders.map(order => ({
        orderId: order.orderId,
        serviceName: order.serviceName,
        platform: order.platform,
        type: order.type,
        targetUrl: order.targetUrl,
        quantity: order.quantity,
        cost: order.cost,
        status: order.status,
        apiOrderId: order.apiOrderId,
        startCount: order.startCount,
        remains: order.remains,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        deliveredAt: order.deliveredAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
});

// GET ORDER DETAILS
app.get('/api/orders/:orderId', authenticate, async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({
      orderId,
      userId: req.user._id
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check order status from Thekclaut if still processing
    if (order.apiOrderId && (order.status === 'processing' || order.status === 'in progress')) {
      try {
        const statusCheck = await thekclaut.checkOrderStatus(order.apiOrderId);
        
        if (statusCheck.success) {
          order.status = statusCheck.data.status;
          order.startCount = statusCheck.data.start_count;
          order.remains = statusCheck.data.remains;
          order.updatedAt = new Date();

          if (statusCheck.data.status === 'completed') {
            order.deliveredAt = new Date();
            
            await sendNotification(
              req.user._id,
              'Order Completed! ✅',
              `Your order ${orderId} has been completed successfully.`,
              'order'
            );
          }

          await order.save();
        }
      } catch (apiError) {
        console.error('Error checking order status:', apiError);
      }
    }

    res.json({
      success: true,
      order: {
        orderId: order.orderId,
        serviceName: order.serviceName,
        platform: order.platform,
        type: order.type,
        targetUrl: order.targetUrl,
        quantity: order.quantity,
        cost: order.cost,
        status: order.status,
        apiOrderId: order.apiOrderId,
        startCount: order.startCount,
        remains: order.remains,
        estimatedDelivery: order.estimatedDelivery,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        deliveredAt: order.deliveredAt
      }
    });

  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order',
      error: error.message
    });
  }
});

// CANCEL ORDER
app.post('/api/orders/:orderId/cancel', authenticate, async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({
      orderId,
      userId: req.user._id,
      status: { $in: ['pending', 'processing'] }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or cannot be cancelled'
      });
    }

    // Check if service supports cancellation
    const service = await Service.findOne({ serviceId: order.serviceId });
    if (!service?.cancel) {
      return res.status(400).json({
        success: false,
        message: 'This service does not support cancellation'
      });
    }

    // Try to cancel on Thekclaut
    if (order.apiOrderId) {
      const cancelResult = await thekclaut.cancelOrder(order.apiOrderId);
      
      if (!cancelResult.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to cancel order on Thekclaut',
          error: cancelResult.error
        });
      }
    }

    // Update order status
    order.status = 'cancelled';
    order.updatedAt = new Date();
    await order.save();

    // Refund user balance
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { balance: order.cost },
      $set: { updatedAt: new Date() }
    });

    // Create refund transaction
    const transaction = new Transaction({
      transactionId: generateTransactionId(),
      userId: req.user._id,
      type: 'refund',
      amount: order.cost * EQUITY_VALUE,
      equities: order.cost,
      status: 'completed',
      reference: orderId,
      notes: `Refund for cancelled order: ${order.serviceName}`
    });

    await transaction.save();

    // Send notification
    await sendNotification(
      req.user._id,
      'Order Cancelled',
      `Your order ${orderId} has been cancelled and ${order.cost} equities have been refunded to your account.`,
      'order'
    );

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      refunded: order.cost
    });

  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel order',
      error: error.message
    });
  }
});

// 11.7 ADMIN ROUTES
// =================

// ADMIN LOGIN
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Check against environment variables
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
      
      // Find or create admin user
      let adminUser = await User.findOne({ email: process.env.ADMIN_EMAIL });
      
      if (!adminUser) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        adminUser = new User({
          username: process.env.ADMIN_USERNAME,
          email: process.env.ADMIN_EMAIL,
          password: hashedPassword,
          role: 'admin',
          isVerified: true,
          referralCode: generateReferralCode()
        });

        await adminUser.save();
      }

      // Update last login
      adminUser.lastLogin = new Date();
      adminUser.updatedAt = new Date();
      await adminUser.save();

      // Generate JWT token
      const token = jwt.sign(
        { userId: adminUser._id, role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: JWT_EXPIRE }
      );

      res.json({
        success: true,
        message: 'Admin login successful',
        token,
        user: {
          id: adminUser._id,
          username: adminUser.username,
          email: adminUser.email,
          role: adminUser.role,
          balance: adminUser.balance
        }
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Admin login failed',
      error: error.message
    });
  }
});

// GET PENDING DEPOSITS
app.get('/api/admin/deposits/pending', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const pendingDeposits = await Transaction.find({
      type: 'deposit',
      status: 'pending'
    })
    .populate('userId', 'username email')
    .sort({ createdAt: 1 })
    .limit(100);

    res.json({
      success: true,
      deposits: pendingDeposits.map(deposit => ({
        transactionId: deposit.transactionId,
        userId: deposit.userId._id,
        username: deposit.userId.username,
        email: deposit.userId.email,
        amount: deposit.amount,
        equities: deposit.equities,
        reference: deposit.reference,
        proofImage: deposit.proofImage,
        moniepointDetails: deposit.moniepointDetails,
        createdAt: deposit.createdAt,
        updatedAt: deposit.updatedAt
      })),
      total: pendingDeposits.length
    });

  } catch (error) {
    console.error('Get pending deposits error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending deposits',
      error: error.message
    });
  }
});

// APPROVE DEPOSIT
app.post('/api/admin/deposit/approve', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { transactionId, action } = req.body;

    if (!transactionId || !action) {
      return res.status(400).json({
        success: false,
        message: 'Transaction ID and action are required'
      });
    }

    const transaction = await Transaction.findOne({
      transactionId,
      type: 'deposit',
      status: 'pending'
    }).populate('userId');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Pending deposit not found'
      });
    }

    if (action === 'approve') {
      // Update transaction
      transaction.status = 'completed';
      transaction.verifiedBy = req.user.username;
      transaction.verifiedAt = new Date();
      transaction.notes = 'Deposit approved by admin';
      transaction.updatedAt = new Date();

      // Update user balance
      const user = await User.findById(transaction.userId._id);
      user.balance += transaction.equities;
      user.updatedAt = new Date();
      await user.save();

      // Handle referral bonus (10% of deposit for referrer)
      if (user.referredBy) {
        const referrer = await User.findOne({ referralCode: user.referredBy });
        if (referrer) {
          const referralBonus = Math.floor(transaction.equities * 0.10);
          
          referrer.referralEarnings += referralBonus;
          referrer.balance += referralBonus;
          referrer.referralCount += 1;
          await referrer.save();

          // Create referral transaction
          const referralTransaction = new Transaction({
            transactionId: generateTransactionId(),
            userId: referrer._id,
            type: 'referral',
            amount: referralBonus * EQUITY_VALUE,
            equities: referralBonus,
            status: 'completed',
            reference: transaction.transactionId,
            notes: `Referral bonus from ${user.username}`
          });
          await referralTransaction.save();

          // Send notification to referrer
          await sendNotification(
            referrer._id,
            'Referral Bonus! 🎉',
            `You received ${referralBonus} equities (₦${referralBonus * EQUITY_VALUE}) for referring ${user.username}`,
            'bonus'
          );
        }
      }

      // Send notification to user
      await sendNotification(
        user._id,
        'Deposit Approved ✅',
        `Your deposit of ${formatCurrency(transaction.amount)} has been approved. ${transaction.equities} equities added to your account.`,
        'deposit'
      );

      await transaction.save();

      res.json({
        success: true,
        message: 'Deposit approved successfully',
        transaction: {
          transactionId: transaction.transactionId,
          status: transaction.status,
          verifiedBy: transaction.verifiedBy,
          verifiedAt: transaction.verifiedAt
        }
      });

    } else if (action === 'reject') {
      // Update transaction
      transaction.status = 'cancelled';
      transaction.verifiedBy = req.user.username;
      transaction.verifiedAt = new Date();
      transaction.notes = req.body.reason || 'Deposit rejected by admin';
      transaction.updatedAt = new Date();

      await transaction.save();

      // Send notification to user
      await sendNotification(
        transaction.userId._id,
        'Deposit Rejected ❌',
        `Your deposit of ${formatCurrency(transaction.amount)} was rejected. Reason: ${transaction.notes}`,
        'deposit'
      );

      res.json({
        success: true,
        message: 'Deposit rejected',
        transaction: {
          transactionId: transaction.transactionId,
          status: transaction.status,
          verifiedBy: transaction.verifiedBy,
          verifiedAt: transaction.verifiedAt
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "approve" or "reject"'
      });
    }

  } catch (error) {
    console.error('Approve deposit error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process deposit',
      error: error.message
    });
  }
});

// GET ALL TRANSACTIONS
app.get('/api/admin/transactions', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { type, status, page = 1, limit = 50, userId } = req.query;
    
    const query = {};
    if (type && type !== 'all') query.type = type;
    if (status && status !== 'all') query.status = status;
    if (userId) query.userId = userId;

    const skip = (page - 1) * limit;

    const transactions = await Transaction.find(query)
      .populate('userId', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Transaction.countDocuments(query);

    res.json({
      success: true,
      transactions: transactions.map(t => ({
        transactionId: t.transactionId,
        userId: t.userId?._id,
        username: t.userId?.username,
        email: t.userId?.email,
        type: t.type,
        amount: t.amount,
        equities: t.equities,
        status: t.status,
        reference: t.reference,
        proofImage: t.proofImage,
        verifiedBy: t.verifiedBy,
        verifiedAt: t.verifiedAt,
        notes: t.notes,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: error.message
    });
  }
});

// GET ALL ORDERS
app.get('/api/admin/orders', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { status, platform, page = 1, limit = 50, userId } = req.query;
    
    const query = {};
    if (status && status !== 'all') query.status = status;
    if (platform && platform !== 'all') query.platform = platform;
    if (userId) query.userId = userId;

    const skip = (page - 1) * limit;

    const orders = await Order.find(query)
      .populate('userId', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      orders: orders.map(order => ({
        orderId: order.orderId,
        userId: order.userId?._id,
        username: order.userId?.username,
        email: order.userId?.email,
        serviceName: order.serviceName,
        platform: order.platform,
        type: order.type,
        targetUrl: order.targetUrl,
        quantity: order.quantity,
        cost: order.cost,
        status: order.status,
        apiOrderId: order.apiOrderId,
        startCount: order.startCount,
        remains: order.remains,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        deliveredAt: order.deliveredAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
});

// GET ADMIN STATS
app.get('/api/admin/stats', authenticate, authorizeAdmin, async (req, res) => {
  try {
    // Total users
    const totalUsers = await User.countDocuments({ role: 'user' });
    
    // Total orders
    const totalOrders = await Order.countDocuments();
    
    // Total deposits (approved)
    const totalDeposits = await Transaction.aggregate([
      { $match: { type: 'deposit', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    // Total revenue (equities spent)
    const totalRevenue = await Order.aggregate([
      { $group: { _id: null, total: { $sum: '$cost' } } }
    ]);
    
    // Pending deposits
    const pendingDeposits = await Transaction.countDocuments({ 
      type: 'deposit', 
      status: 'pending' 
    });
    
    // Recent users
    const recentUsers = await User.find({ role: 'user' })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('username email balance createdAt lastLogin');

    // Recent orders
    const recentOrders = await Order.find()
      .populate('userId', 'username')
      .sort({ createdAt: -1 })
      .limit(10);

    // Thekclaut balance
    const balanceCheck = await thekclaut.getBalance();
    const thekclautBalance = balanceCheck.success ? balanceCheck.data.balance : 0;

    // User activity stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newUsersToday = await User.countDocuments({ 
      createdAt: { $gte: today } 
    });

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalOrders,
        totalDeposits: totalDeposits[0]?.total || 0,
        totalRevenue: totalRevenue[0]?.total || 0,
        pendingDeposits,
        thekclautBalance,
        newUsersToday,
        recentUsers,
        recentOrders
      }
    });

  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin stats',
      error: error.message
    });
  }
});

// GET ALL USERS
app.get('/api/admin/users', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, role, search } = req.query;
    const skip = (page - 1) * limit;
    
    const query = {};
    if (role && role !== 'all') query.role = role;
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { referralCode: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      users: users.map(user => ({
        _id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        balance: user.balance,
        totalSpent: user.totalSpent,
        totalOrders: user.totalOrders,
        referralCode: user.referralCode,
        referredBy: user.referredBy,
        referralCount: user.referralCount,
        referralEarnings: user.referralEarnings,
        role: user.role,
        isVerified: user.isVerified,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        updatedAt: user.updatedAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
});

// UPDATE USER STATUS
app.put('/api/admin/users/:userId/status', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { action } = req.body;

    if (!action || !['activate', 'deactivate'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Valid action (activate/deactivate) is required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isActive = action === 'activate';
    user.updatedAt = new Date();
    await user.save();

    res.json({
      success: true,
      message: `User ${action}d successfully`,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isActive: user.isActive
      }
    });

  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status',
      error: error.message
    });
  }
});

// UPDATE USER ROLE
app.put('/api/admin/users/:userId/role', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!role || !['user', 'admin', 'support'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Valid role (user/admin/support) is required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.role = role;
    user.updatedAt = new Date();
    await user.save();

    res.json({
      success: true,
      message: `User role updated to ${role}`,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user role',
      error: error.message
    });
  }
});

// SYNC SERVICES FROM THEKCLAUT
app.post('/api/admin/services/sync', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const result = await updateServicesFromThekclaut();
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Services synced successfully',
        stats: {
          updated: result.updated,
          added: result.added,
          errors: result.errors
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to sync services',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Sync services error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync services',
      error: error.message
    });
  }
});

// 11.8 CUSTOMER SUPPORT ROUTES
// =============================

// CREATE SUPPORT TICKET
app.post('/api/support/ticket', authenticate, async (req, res) => {
  try {
    const { subject, message, category, priority } = req.body;

    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Subject and message are required'
      });
    }

    if (subject.length > 200) {
      return res.status(400).json({
        success: false,
        message: 'Subject cannot exceed 200 characters'
      });
    }

    if (message.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot exceed 2000 characters'
      });
    }

    const ticket = new Ticket({
      ticketId: generateTicketId(),
      userId: req.user._id,
      subject,
      message,
      category: category || 'general',
      priority: priority || 'medium',
      status: 'open'
    });

    await ticket.save();

    // Send notification to user
    await sendNotification(
      req.user._id,
      'Support Ticket Created',
      `Your support ticket "${subject}" has been created successfully. We will respond shortly.`,
      'ticket'
    );

    res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      ticket: {
        ticketId: ticket.ticketId,
        subject: ticket.subject,
        status: ticket.status,
        category: ticket.category,
        priority: ticket.priority,
        createdAt: ticket.createdAt
      }
    });

  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create ticket',
      error: error.message
    });
  }
});

// GET USER TICKETS
app.get('/api/support/my-tickets', authenticate, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    
    const query = { userId: req.user._id };
    if (status && status !== 'all') {
      query.status = status;
    }
    
    const tickets = await Ticket.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Ticket.countDocuments(query);

    res.json({
      success: true,
      tickets: tickets.map(ticket => ({
        ticketId: ticket.ticketId,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        replies: ticket.replies?.length || 0,
        assignedTo: ticket.assignedTo
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tickets',
      error: error.message
    });
  }
});

// GET TICKET DETAILS
app.get('/api/support/ticket/:ticketId', authenticate, async (req, res) => {
  try {
    const { ticketId } = req.params;

    const ticket = await Ticket.findOne({
      ticketId,
      userId: req.user._id
    }).populate('replies.userId', 'username role');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    res.json({
      success: true,
      ticket: {
        ticketId: ticket.ticketId,
        subject: ticket.subject,
        message: ticket.message,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        assignedTo: ticket.assignedTo,
        replies: ticket.replies || [],
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt
      }
    });

  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ticket',
      error: error.message
    });
  }
});

// REPLY TO TICKET
app.post('/api/support/ticket/:ticketId/reply', authenticate, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    if (message.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot exceed 2000 characters'
      });
    }

    const ticket = await Ticket.findOne({
      ticketId,
      userId: req.user._id
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Add reply
    ticket.replies.push({
      userId: req.user._id,
      message,
      isStaff: req.user.role === 'admin' || req.user.role === 'support',
      createdAt: new Date()
    });

    ticket.updatedAt = new Date();
    
    // Update status
    if (ticket.status === 'resolved') {
      ticket.status = 'awaiting reply';
    } else if (req.user.role === 'admin' || req.user.role === 'support') {
      ticket.status = 'awaiting reply';
      ticket.assignedTo = req.user.username;
    }

    await ticket.save();

    // Send notification if staff replied
    if (req.user.role === 'admin' || req.user.role === 'support') {
      await sendNotification(
        ticket.userId,
        'New Reply on Your Ticket',
        `Staff has replied to your ticket: "${ticket.subject}"`,
        'ticket',
        `/support/ticket/${ticketId}`
      );
    }

    res.json({
      success: true,
      message: 'Reply sent successfully',
      ticket: {
        ticketId: ticket.ticketId,
        status: ticket.status,
        updatedAt: ticket.updatedAt,
        replies: ticket.replies.length
      }
    });

  } catch (error) {
    console.error('Reply ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send reply',
      error: error.message
    });
  }
});

// GET ALL TICKETS (ADMIN)
app.get('/api/admin/tickets', authenticate, authorizeSupport, async (req, res) => {
  try {
    const { status, priority, page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;
    
    const query = {};
    if (status && status !== 'all') query.status = status;
    if (priority && priority !== 'all') query.priority = priority;

    const tickets = await Ticket.find(query)
      .populate('userId', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Ticket.countDocuments(query);

    res.json({
      success: true,
      tickets: tickets.map(ticket => ({
        ticketId: ticket.ticketId,
        userId: ticket.userId?._id,
        username: ticket.userId?.username,
        email: ticket.userId?.email,
        subject: ticket.subject,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        assignedTo: ticket.assignedTo,
        replies: ticket.replies?.length || 0,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get all tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tickets',
      error: error.message
    });
  }
});

// UPDATE TICKET STATUS (ADMIN)
app.put('/api/admin/tickets/:ticketId/status', authenticate, authorizeSupport, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status, assignedTo } = req.body;

    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    if (status) ticket.status = status;
    if (assignedTo) ticket.assignedTo = assignedTo;
    ticket.updatedAt = new Date();
    
    await ticket.save();

    // Send notification to user if status changed
    if (status && ['resolved', 'closed'].includes(status)) {
      await sendNotification(
        ticket.userId,
        `Ticket ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        `Your ticket "${ticket.subject}" has been marked as ${status}.`,
        'ticket'
      );
    }

    res.json({
      success: true,
      message: 'Ticket updated successfully',
      ticket: {
        ticketId: ticket.ticketId,
        status: ticket.status,
        assignedTo: ticket.assignedTo,
        updatedAt: ticket.updatedAt
      }
    });

  } catch (error) {
    console.error('Update ticket status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update ticket',
      error: error.message
    });
  }
});

// 11.9 FAQ ROUTES
// ===============

// GET FAQS
app.get('/api/faqs', async (req, res) => {
  try {
    const faqs = await FAQ.find({ isActive: true })
      .sort({ order: 1, category: 1 });

    // Group by category
    const groupedFaqs = {};
    faqs.forEach(faq => {
      if (!groupedFaqs[faq.category]) {
        groupedFaqs[faq.category] = [];
      }
      groupedFaqs[faq.category].push({
        question: faq.question,
        answer: faq.answer,
        order: faq.order
      });
    });

    res.json({
      success: true,
      faqs: groupedFaqs,
      count: faqs.length
    });

  } catch (error) {
    console.error('Get FAQs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch FAQs',
      error: error.message
    });
  }
});

// CREATE FAQ (ADMIN)
app.post('/api/admin/faqs', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { question, answer, category, order, isActive } = req.body;

    if (!question || !answer || !category) {
      return res.status(400).json({
        success: false,
        message: 'Question, answer, and category are required'
      });
    }

    const faq = new FAQ({
      question,
      answer,
      category,
      order: order || 0,
      isActive: isActive !== undefined ? isActive : true
    });

    await faq.save();

    res.status(201).json({
      success: true,
      message: 'FAQ created successfully',
      faq
    });

  } catch (error) {
    console.error('Create FAQ error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create FAQ',
      error: error.message
    });
  }
});

// 11.10 NOTIFICATION ROUTES
// =========================

// GET USER NOTIFICATIONS
app.get('/api/notifications', authenticate, async (req, res) => {
  try {
    const { limit = 50, page = 1, unreadOnly } = req.query;
    const skip = (page - 1) * limit;
    
    const query = { userId: req.user._id };
    if (unreadOnly === 'true') {
      query.isRead = false;
    }
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ 
      userId: req.user._id, 
      isRead: false 
    });

    res.json({
      success: true,
      notifications: notifications.map(notif => ({
        id: notif._id,
        title: notif.title,
        message: notif.message,
        type: notif.type,
        isRead: notif.isRead,
        link: notif.link,
        createdAt: notif.createdAt
      })),
      unreadCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
});

// MARK NOTIFICATION AS READ
app.put('/api/notifications/:id/read', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    await Notification.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { isRead: true }
    );

    res.json({
      success: true,
      message: 'Notification marked as read'
    });

  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification',
      error: error.message
    });
  }
});

// MARK ALL NOTIFICATIONS AS READ
app.put('/api/notifications/read-all', authenticate, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { isRead: true }
    );

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });

  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notifications',
      error: error.message
    });
  }
});

// 11.11 TRANSACTION HISTORY
// =========================

// GET ALL USER TRANSACTIONS
app.get('/api/transactions', authenticate, async (req, res) => {
  try {
    const { type, page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;
    
    const query = { userId: req.user._id };
    if (type && type !== 'all') query.type = type;

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Transaction.countDocuments(query);

    res.json({
      success: true,
      transactions: transactions.map(t => ({
        transactionId: t.transactionId,
        type: t.type,
        amount: t.amount,
        equities: t.equities,
        status: t.status,
        reference: t.reference,
        notes: t.notes,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: error.message
    });
  }
});

// 12. INITIALIZATION FUNCTIONS
// ============================

// Create sample FAQs
const createSampleFAQs = async () => {
  try {
    const count = await FAQ.countDocuments();
    
    if (count === 0) {
      const sampleFAQs = [
        {
          question: "What is E-Acquire?",
          answer: "E-Acquire is a social media boosting platform that helps you grow your Instagram, TikTok, YouTube, and other social media accounts with real engagement.",
          category: "general",
          order: 1
        },
        {
          question: "How does the deposit system work?",
          answer: "1. Request deposit on dashboard 2. Send money to provided account 3. Upload payment proof 4. Admin verifies (2-12 hours) 5. Equities added to your account",
          category: "deposit",
          order: 1
        },
        {
          question: "What is 1 Equity worth?",
          answer: `1 Equity = ₦${EQUITY_VALUE}. This is fixed and will never change.`,
          category: "pricing",
          order: 1
        },
        {
          question: "How long do orders take to complete?",
          answer: "Depends on service: Instant (0-30 mins), Fast (1-24 hours), Slow (1-7 days). Check service details for estimated time.",
          category: "order",
          order: 1
        },
        {
          question: "Can I get a refund?",
          answer: "We offer refunds for failed orders only. Deposit refunds are considered on case-by-case basis. Contact support for refund requests.",
          category: "account",
          order: 1
        },
        {
          question: "How do I contact support?",
          answer: `Email: ${process.env.SUPPORT_EMAIL || 'support.eaquire@gmail.com'}, Phone: ${process.env.SUPPORT_PHONE || '+2348028354309'}, WhatsApp: ${process.env.SUPPORT_WHATSAPP || '+2348028354309'}`,
          category: "general",
          order: 2
        }
      ];

      await FAQ.insertMany(sampleFAQs);
      console.log('✅ Sample FAQs created');
    }
  } catch (error) {
    console.error('Error creating sample FAQs:', error);
  }
};

// Initialize admin user on first run
const initializeAdminUser = async () => {
  try {
    const adminExists = await User.findOne({ email: process.env.ADMIN_EMAIL });
    
    if (!adminExists) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, salt);

      const adminUser = new User({
        username: process.env.ADMIN_USERNAME,
        email: process.env.ADMIN_EMAIL,
        password: hashedPassword,
        role: 'admin',
        isVerified: true,
        referralCode: generateReferralCode()
      });

      await adminUser.save();
      console.log('✅ Admin user created');
    }
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
};

// 13. ERROR HANDLING MIDDLEWARE
// =============================

// 404 Route Not Found
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found on this server`,
    timestamp: new Date().toISOString()
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Global error:', err.stack);
  
  const statusCode = err.status || 500;
  const message = err.message || 'Internal server error';
  
  res.status(statusCode).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    timestamp: new Date().toISOString()
  });
});

// 14. START SERVER AND INITIALIZE
// ================================

app.listen(PORT, async () => {
  console.log(`
  ==============================================
  🚀 ${APP_NAME} Backend Server Started
  ==============================================
  📍 Port: ${PORT}
  🌐 Environment: ${process.env.NODE_ENV || 'development'}
  🔗 Health Check: http://localhost:${PORT}/api/health
  🗄️  Database: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}
  💰 Equity Value: ₦${EQUITY_VALUE} per equity
  📈 Markup: ${MARKUP_PERCENTAGE}%
  ==============================================
  `);
  
  try {
    // Initialize data
    await createSampleFAQs();
    await initializeAdminUser();
    
    // Update services on startup
    const serviceResult = await updateServicesFromThekclaut();
    if (serviceResult.success) {
      console.log(`✅ Services loaded: ${serviceResult.updated + serviceResult.added} services`);
    } else {
      console.log('⚠️ Could not load services on startup:', serviceResult.error);
    }
    
    // Check Thekclaut balance
    const balanceCheck = await thekclaut.getBalance();
    if (balanceCheck.success) {
      console.log(`💰 Thekclaut Balance: ₦${balanceCheck.data.balance}`);
    } else {
      console.log('⚠️ Could not check Thekclaut balance:', balanceCheck.error);
    }
    
    console.log('✅ Server initialization complete');
    console.log('✅ Ready to accept requests');
    
  } catch (error) {
    console.error('Startup error:', error);
  }
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  mongoose.connection.close(false, () => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  mongoose.connection.close(false, () => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

// Export app for testing

module.exports = app;


