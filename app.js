const express = require('express');
const multer = require('multer');
const mysql = require('mysql2');
const app = express();
const flash = require('connect-flash');
const session = require('express-session');
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

const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('error', 'Please log in to view this resource');
        res.redirect('/login');
    }
};
 
const checkAdmin = (req, res, next) => {
    if (req.session.user.role === 'admin') {
        return next();
    } else {
        req.flash('error', 'Access denied');
        res.redirect('/shop');
    }
};

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

// MySQL connection
const connection = mysql.createConnection({
    host: 'c237-all.mysql.database.azure.com',
    user: 'c237admin',
    port: 3306,
    password: 'c2372025!',
    database: 'c237_027_team3'
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Middleware
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
app.get('/', (req, res) => {
    const sql = 'SELECT * FROM fishes';
    connection.query(sql, (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving products');
        }
        res.render('index', { fishList: results });
    });
});

app.get('/addFish', (req, res) => {
    res.render('addFish');
});

app.get('/fish/:id', (req, res) => {
    const fishId = req.params.id;
    const query = 'SELECT * FROM fishes WHERE fishId = ?';
    connection.query(query, [fishId], (err, results) => {
        if (err) {
            console.error('Error fetching fish:', err);
            return res.status(500).send('Internal Server Error');
        }
        if (results.length === 0) {
            return res.status(404).send('Fish not found');
        }
        res.render('fishDetails', { fish: results[0] });
    });
});

app.post('/addFish', upload.single('image'), (req, res) => {
    const { name, weight, length, type, price, diet_use } = req.body;
    const image = req.file ? req.file.filename : null;

    const sql = 'INSERT INTO fishes (name, weight, length, type, price, diet_use, image) VALUES (?, ?, ?, ?, ?, ?, ?)';
    connection.query(sql, [name, weight, length, type, price, diet_use, image], (err) => {
        if (err) {
            console.error('Error adding fish:', err);
            return res.status(500).send('Error adding fish');
        }
        res.redirect('/');
    });
});

app.get('/editFish/:id', (req, res) => {
    const fishId = req.params.id;
    const query = 'SELECT * FROM fishes WHERE fishId = ?';
    connection.query(query, [fishId], (err, results) => {
        if (err) {
            console.error('Error fetching fish:', err);
            return res.status(500).send('Internal Server Error');
        }
        if (results.length === 0) {
            return res.status(404).send('Fish not found');
        }
        res.render('editFish', { fish: results[0] });
    });
});

app.post('/editFish/:id', upload.single('image'), (req, res) => {
    const fishId = req.params.id;
    const { name, weight, length, type, price, diet_use, currentImage } = req.body;
    let image = currentImage;
    
    if (req.file) {
        image = req.file.filename;
    }

    const sql = 'UPDATE fishes SET name = ?, weight = ?, length = ?, type = ?, price = ?, diet_use = ?, image = ? WHERE fishId = ?';
    connection.query(sql, [name, weight, length, type, price, diet_use, image, fishId], (err) => {
        if (err) {
            console.error("Error updating fish:", err);
            return res.status(500).send('Error updating fish');
        }
        res.redirect('/');
    });
});

app.get('/deleteFish/:id', (req, res) => {
    const fishId = req.params.id;
    const sql = 'DELETE FROM fishes WHERE fishId = ?';
    connection.query(sql, [fishId], (err) => {
        if (err) {
            console.error("Error deleting fish:", err);
            return res.status(500).send('Error deleting fish');
        }
        res.redirect('/');
    });
});


app.get('/login', (req, res) => {
    res.render('login', { messages: req.flash('success'), errors: req.flash('error') });
});
 
 
app.post('/login', (req, res) => {
    const { email, password } = req.body;
 
    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }
 
    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    connection.query(sql, [email, password], (err, results) => {
        if (err) {
            throw err;
        }
 
        if (results.length > 0) {
            req.session.user = results[0];
            req.flash('success', 'Login successful!');
            if (req.session.user.role == 'user')
                res.redirect('/shop');
            else
                res.redirect('/inventory');
        } else {
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});

app.get('/register', (req, res) => {
    res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
});
 
app.post('/register', validateRegistration, (req, res) => {
    const { username, email, password, address, contact, role } = req.body;
 
    const sql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
    connection.query(sql, [username, email, password, address, contact, role], (err, result) => {
        if (err) {
            throw err;
        }
        console.log(result);
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));