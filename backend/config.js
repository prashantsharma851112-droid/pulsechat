require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5000,
  JWT_SECRET: process.env.JWT_SECRET || 'b0ffff3c2299551401bdfcf35ea9be8283c0aab612cc0241c5d813e4f0f2a393',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  MONGO_URI: process.env.MONGO_URI
};
