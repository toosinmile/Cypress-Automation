// Local Magento REST API mock — replicates the exact response contracts used
// by the test suites so tests can run without hitting the live (Cloudflare-
// protected) site.
//
// Endpoints implemented:
//   POST /rest/V1/customers                       — registration
//   POST /rest/V1/integration/customer/token      — login (returns bearer token)
//   GET  /rest/V1/customers/me                    — fetch own profile (auth required)

const express = require("express");

function createMockServer() {
  const app = express();
  app.use(express.json());

  // In-memory store: email → { id, firstname, lastname, email, password }
  const customers = new Map();
  // token → email (so /customers/me can look up the owner)
  const tokens = new Map();
  let nextId = 1001;

  // ── Registration ──────────────────────────────────────────────────────────
  app.post("/rest/V1/customers", (req, res) => {
    const { customer = {}, password } = req.body || {};
    const { email, firstname, lastname } = customer;

    if (!firstname || !lastname || !email) {
      return res.status(400).json({
        message: "One or more required fields are missing.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: `"${email}" is not a valid email address.` });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({
        message:
          "The password needs at least 8 characters. Create a new password and try again.",
      });
    }

    if (customers.has(email.toLowerCase())) {
      return res.status(400).json({
        message:
          "A customer with the same email address already exists in an associated website.",
      });
    }

    const id = nextId++;
    const record = { id, email, firstname, lastname, password };
    customers.set(email.toLowerCase(), record);

    return res.status(200).json({ id, email, firstname, lastname });
  });

  // ── Login ─────────────────────────────────────────────────────────────────
  app.post("/rest/V1/integration/customer/token", (req, res) => {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ message: "username and password are required." });
    }

    const record = customers.get((username || "").toLowerCase());
    if (!record || record.password !== password) {
      return res.status(401).json({ message: "Invalid login or password." });
    }

    const token = Buffer.from(`${username}:${Date.now()}:${Math.random()}`).toString(
      "base64"
    );
    tokens.set(token, username.toLowerCase());

    return res.status(200).json(token);
  });

  // ── Customer profile (auth-guarded) ───────────────────────────────────────
  app.get("/rest/V1/customers/me", (req, res) => {
    const auth = req.headers.authorization || "";
    const token = auth.replace(/^Bearer\s+/i, "");

    if (!token) {
      return res.status(401).json({ message: "Authorization required." });
    }

    const email = tokens.get(token);
    if (!email) {
      return res.status(401).json({ message: "The consumer isn't authorized to access the resource." });
    }

    const { password, ...safe } = customers.get(email);
    return res.status(200).json(safe);
  });

  return app;
}

module.exports = { createMockServer };
