// Local Magento REST API + Storefront mock
// REST endpoints: POST /rest/V1/customers, POST /rest/V1/integration/customer/token,
//                 GET  /rest/V1/customers/me
// UI pages:       GET/POST /customer/account/create(Post)
//                 GET/POST /customer/account/login(Post)
//                 GET      /customer/account/

const express = require("express");

function createMockServer() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true })); // parse form POST bodies


  // Shared in-memory store — used by both REST API and form endpoints
  const customers = new Map(); // email.toLowerCase() → record
  const tokens = new Map();    // token → email
  let nextId = 1001;

  // ── REST API ──────────────────────────────────────────────────────────────

  app.post("/rest/V1/customers", (req, res) => {
    const { customer = {}, password } = req.body || {};
    const { email, firstname, lastname } = customer;

    if (!firstname || !lastname || !email) {
      return res.status(400).json({ message: "One or more required fields are missing." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: `"${email}" is not a valid email address.` });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({
        message: "Password requirements: minimum length of 8 characters.",
      });
    }
    if (customers.has(email.toLowerCase())) {
      return res.status(400).json({
        message: "A customer with the same email address already exists in an associated website.",
      });
    }

    const id = nextId++;
    customers.set(email.toLowerCase(), { id, email, firstname, lastname, password });
    return res.status(200).json({ id, email, firstname, lastname });
  });

  app.post("/rest/V1/integration/customer/token", (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: "username and password are required." });
    }
    const record = customers.get((username || "").toLowerCase());
    if (!record || record.password !== password) {
      return res.status(401).json({ message: "Invalid login or password." });
    }
    const token = Buffer.from(`${username}:${Date.now()}:${Math.random()}`).toString("base64");
    tokens.set(token, username.toLowerCase());
    return res.status(200).json(token);
  });

  app.get("/rest/V1/customers/me", (req, res) => {
    const auth = req.headers.authorization || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ message: "Authorization required." });
    const email = tokens.get(token);
    if (!email) return res.status(401).json({ message: "The consumer isn't authorized to access the resource." });
    const { password, ...safe } = customers.get(email);
    return res.status(200).json(safe);
  });

  // ── Storefront Pages ───────────────────────────────────────────────────────

  // Registration page
  app.get("/customer/account/create", (req, res) => {
    const error = req.query.error ? decodeURIComponent(req.query.error) : "";
    res.send(registrationPage(error));
  });

  // Registration form POST
  app.post("/customer/account/createPost", (req, res) => {
    const { firstname, lastname, email, password, password_confirmation } = req.body;

    if (!firstname || !lastname || !email || !password) {
      return res.redirect(
        `/customer/account/create?error=${encodeURIComponent("One or more required fields are missing.")}`
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.redirect(
        `/customer/account/create?error=${encodeURIComponent(`"${email}" is not a valid email address.`)}`
      );
    }
    if (password.length < 8) {
      return res.redirect(
        `/customer/account/create?error=${encodeURIComponent(
          "Password requirements: minimum length of 8 characters."
        )}`
      );
    }
    if (password !== password_confirmation) {
      return res.redirect(
        `/customer/account/create?error=${encodeURIComponent("Please enter the same value again.")}`
      );
    }
    if (customers.has(email.toLowerCase())) {
      return res.redirect(
        `/customer/account/create?error=${encodeURIComponent(
          "There is already an account with this email address. If you are sure that it is your email address, click here to get your password and access your account."
        )}`
      );
    }

    const id = nextId++;
    customers.set(email.toLowerCase(), { id, email, firstname, lastname, password });
    return res.redirect(`/customer/account/?firstname=${encodeURIComponent(firstname)}`);
  });

  // Login page
  app.get("/customer/account/login", (req, res) => {
    const error = req.query.error ? decodeURIComponent(req.query.error) : "";
    res.send(loginPage(error));
  });

  // Login form POST
  app.post("/customer/account/loginPost", (req, res) => {
    const email = req.body.email || "";
    const pass = req.body.pass || "";
    const record = customers.get(email.toLowerCase());

    if (!record || record.password !== pass) {
      return res.redirect(
        `/customer/account/login?error=${encodeURIComponent("Invalid login or password.")}`
      );
    }

    return res.redirect(`/customer/account/?firstname=${encodeURIComponent(record.firstname)}`);
  });

  // Account dashboard — firstname passed as a query param by createPost/loginPost
  app.get(["/customer/account", "/customer/account/"], (req, res) => {
    const firstname = req.query.firstname || "";
    res.send(dashboardPage(firstname));
  });

  // Catch-all error handler — prevents unhandled exceptions from leaving
  // Cypress waiting indefinitely for a response that never arrives.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    console.error("[mock-server error]", err.message);
    res.status(500).send("Mock server error: " + err.message);
  });

  return app;
}

// ── HTML page templates ────────────────────────────────────────────────────

function registrationPage(error = "") {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Create New Customer Account</title></head>
<body>
  <h1>Create New Customer Account</h1>
  ${error ? `<div class="message-error" role="alert"><div>${error}</div></div>` : ""}
  <div id="pw-error" style="color:red;display:none"></div>
  <form id="form-validate" method="post" action="/customer/account/createPost">
    <label for="firstname">First Name</label>
    <input type="text" id="firstname" name="firstname" required><br>
    <label for="lastname">Last Name</label>
    <input type="text" id="lastname" name="lastname" required><br>
    <label for="email_address">Email</label>
    <input type="email" id="email_address" name="email" required><br>
    <label for="password">Password</label>
    <input type="password" id="password" name="password" required><br>
    <label for="password-confirmation">Confirm Password</label>
    <input type="password" id="password-confirmation" name="password_confirmation" required><br>
    <button type="submit" title="Create an Account">Create an Account</button>
  </form>
  <script>
    document.getElementById('form-validate').addEventListener('submit', function(e) {
      var pass = document.getElementById('password').value;
      var conf = document.getElementById('password-confirmation').value;
      var errDiv = document.getElementById('pw-error');
      errDiv.style.display = 'none';
      document.getElementById('password-confirmation').setCustomValidity('');

      if (pass.length > 0 && pass.length < 8) {
        e.preventDefault();
        errDiv.textContent = 'Password requirements: minimum length of 8 characters.';
        errDiv.style.display = 'block';
        return;
      }
      if (pass && conf && pass !== conf) {
        e.preventDefault();
        errDiv.textContent = 'Please enter the same value again.';
        errDiv.style.display = 'block';
        document.getElementById('password-confirmation').setCustomValidity('Please enter the same value again.');
      }
    });
  </script>
</body>
</html>`;
}

function loginPage(error = "") {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Customer Login</title></head>
<body>
  <h1>Customer Login</h1>
  ${error ? `<div class="message-error" role="alert"><div>${error}</div></div>` : ""}
  <form method="post" action="/customer/account/loginPost">
    <label for="email">Email</label>
    <input type="email" id="email" name="email" required><br>
    <label for="pass">Password</label>
    <input type="password" id="pass" name="pass" required><br>
    <button type="submit" id="send2">Sign In</button>
  </form>
</body>
</html>`;
}

function dashboardPage(firstname = "") {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>My Account</title></head>
<body>
  <h1>My Account</h1>
  ${firstname ? `<p class="hello">Welcome, <strong class="logged-in">${firstname}</strong>!</p>` : ""}
  <p>Thank you for registering with Main Website Store.</p>
</body>
</html>`;
}

module.exports = { createMockServer };
