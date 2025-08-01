const express = require('express');
const multer = require('multer');
const mysql = require('mysql2');
const app = express();
const flash = require('connect-flash');
const session = require('express-session');

// Validation middleware for registration
const validateRegistration = (req, res, next) => {
  const { username, email, password, address, contact, role } = req.body;

  if (!username || !email || !password || !address || !contact || !role) {
    return res.status(400).send('All fields are required.');
  }

  if (password.length < 6) {
    req.flash('error', 'Password should be at least 6 or more characters long');
    req.flash('formData', req.body);
    return res.redirect('/register');
  }
  next();
};

// Authentication & authorization middlewares
const checkAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  } else {
    req.flash('error', 'Please log in to view this resource');
    res.redirect('/login');
  }
};

const checkAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') {
    return next();
  } else {
    req.flash('error', 'Access denied');
    res.redirect('/shop');
  }
};

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/images'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname) // prevent filename collision
});
const upload = multer({ storage });

// MySQL connection
const connection = mysql.createConnection({
  host: 'c237-all.mysql.database.azure.com',
  user: 'c237admin',
  port: 3306,
  password: 'c2372025!',
  database: 'c237_027_team3'
});

connection.connect(err => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL database');
});

// Middleware setup
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));
app.use(flash());
app.use(session({
  secret: 'secret',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

// Routes

// Home
app.get('/', (req, res) => {
  res.render('home');
});

// Add Fish Form
app.get('/addFish', checkAdmin, (req, res) => {
  res.render('addFish');
});

// Add Fish POST
app.post('/addFish', checkAdmin, upload.single('image'), (req, res) => {
  const { name, weight, length, type, price, diet_use } = req.body;
  const image = req.file ? req.file.filename : null;

  const sql = 'INSERT INTO fish (name, weight, length, type, price, diet_use, image) VALUES (?, ?, ?, ?, ?, ?, ?)';
  connection.query(sql, [name, weight, length, type, price, diet_use, image], err => {
    if (err) {
      console.error('Error adding fish:', err);
      return res.status(500).send('Error adding fish');
    }
    res.redirect('/shop');
  });
});

// Edit Fish Form
app.get('/editFish/:id', checkAdmin, (req, res) => {
  const fishId = req.params.id;
  connection.query('SELECT * FROM fish WHERE id = ?', [fishId], (err, results) => {
    if (err) return res.status(500).send('DB error');
    if (results.length === 0) return res.status(404).send('Fish not found');
    res.render('editFish', { fish: results[0] });
  });
});

// Edit Fish POST
app.post('/editFish/:id', checkAdmin, upload.single('image'), (req, res) => {
  const fishId = req.params.id;
  const { name, weight, length, type, price, diet_use, currentImage } = req.body;
  let image = currentImage;
  if (req.file) image = req.file.filename;

  const sql = 'UPDATE fish SET name=?, weight=?, length=?, type=?, price=?, diet_use=?, image=? WHERE id=?';
  connection.query(sql, [name, weight, length, type, price, diet_use, image, fishId], err => {
    if (err) return res.status(500).send('Update error');
    res.redirect('/shop');
  });
});

// Delete Fish
app.post('/deleteFish/:id', checkAdmin, (req, res) => {
  const fishId = req.params.id;
  connection.query('DELETE FROM fish WHERE id = ?', [fishId], err => {
    if (err) return res.status(500).send('Delete error');
    res.redirect('/shop');
  });
});

// Login form
app.get('/login', (req, res) => {
  res.render('login', { messages: req.flash('success'), errors: req.flash('error') });
});

// Login POST
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    req.flash('error', 'All fields are required.');
    return res.redirect('/login');
  }
  const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
  connection.query(sql, [email, password], (err, results) => {
    if (err) throw err;

    if (results.length > 0) {
      req.session.user = results[0];
      req.flash('success', 'Login successful!');
      res.redirect('/shop');
    } else {
      req.flash('error', 'Invalid email or password.');
      res.redirect('/login');
    }
  });
});

// Registration form
app.get('/register', (req, res) => {
  res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
});

// Register POST
app.post('/register', validateRegistration, (req, res) => {
  const { username, email, password, address, contact, role } = req.body;

  const sql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
  connection.query(sql, [username, email, password, address, contact, role], (err, result) => {
    if (err) throw err;
    req.flash('success', 'Registration successful! Please log in.');
    res.redirect('/login');
  });
});

// Show Shop with fish and cart count
app.get('/shop', (req, res) => {
  const sql = 'SELECT * FROM fish';
  connection.query(sql, (err, results) => {
    if (err) return res.status(500).send('Internal Server Error');
    res.render('shop', {
      fish: results,
      user: req.session.user,
      cart: req.session.cart || [],
    });
  });
});

// Add to cart POST
app.post('/cart/add', (req, res) => {
  const fishId = req.body.fishId;
  if (!req.session.cart) {
    req.session.cart = [];
  }
  const existing = req.session.cart.find(item => item.id == fishId);
  if (existing) {
    existing.qty += 1;
  } else {
    req.session.cart.push({ id: fishId, qty: 1 });
  }
  res.redirect('/shop');
});

// View Cart GET
app.get('/cart', (req, res) => {
  if (!req.session.cart || req.session.cart.length === 0) {
    return res.render('cart', { cartItems: [] });
  }
  const ids = req.session.cart.map(item => item.id);
  const sql = 'SELECT * FROM fish WHERE id IN (?)';
  connection.query(sql, [ids], (err, results) => {
    if (err) return res.status(500).send('Internal Server Error');

    const cartItems = results.map(fish => {
      const cartItem = req.session.cart.find(item => item.id == fish.id);
      return { ...fish, qty: cartItem.qty };
    });
    res.render('cart', { cartItems });
  });
});

// Remove from cart POST
app.post('/cart/remove', (req, res) => {
  const fishId = req.body.fishId;
  if (req.session.cart) {
    req.session.cart = req.session.cart.filter(item => item.id != fishId);
  }
  res.redirect('/cart');
});

// Server listen
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
