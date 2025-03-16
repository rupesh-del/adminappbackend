const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ✅ Test Route
app.get("/", (req, res) => {
  res.send("Accounts API is running...");
});

/* ==============================
       🚀 ACCOUNT ROUTES 
============================== */

// ✅ Fetch All Accounts
app.get("/accounts", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM accounts_app.accounts ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching accounts:", error);
    res.status(500).json({ error: "Server error fetching accounts" });
  }
});

// ✅ Create New Account
app.post("/accounts", async (req, res) => {
  const { name, balance, balanceType } = req.body;

  try {
    // ✅ Check if account already exists
    const existingAccount = await pool.query(
      "SELECT * FROM accounts_app.accounts WHERE name = $1",
      [name.trim()]
    );

    if (existingAccount.rows.length > 0) {
      return res.status(400).json({ error: "Account already exists." });
    }

    // ✅ Insert New Account
    const result = await pool.query(
      "INSERT INTO accounts_app.accounts (name, balance, balance_type) VALUES ($1, $2, $3) RETURNING *",
      [name.trim(), balance, balanceType]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating account:", error);
    res.status(500).json({ error: "Server error creating account" });
  }
});


// ✅ Delete Account
app.delete("/accounts/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM accounts_app.accounts WHERE id = $1", [id]);
    res.status(200).json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Error deleting account:", error);
    res.status(500).json({ error: "Server error deleting account" });
  }
});

/* ==============================
       💰 TRANSACTION ROUTES 
============================== */

// ✅ Fetch Transactions for an Account
app.get("/accounts/:id/transactions", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "SELECT * FROM accounts_app.transactions WHERE account_id = $1 ORDER BY date DESC",
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: "Server error fetching transactions" });
  }
});

// ✅ Add a New Transaction
app.post("/accounts/:id/transactions", async (req, res) => {
  const { id } = req.params;
  let { date, debit, credit, details } = req.body;

  try {
    // ✅ Ensure at least one value (debit or credit) is provided
    if ((!debit || debit === "") && (!credit || credit === "")) {
      return res.status(400).json({ error: "Either debit or credit must be entered." });
    }

    // ✅ Convert empty values to 0 (ensure numeric)
    debit = debit ? parseFloat(debit) : 0;
    credit = credit ? parseFloat(credit) : 0;

    if (isNaN(debit) || isNaN(credit)) {
      return res.status(400).json({ error: "Invalid numeric input for debit or credit." });
    }

    const result = await pool.query(
      "INSERT INTO accounts_app.transactions (account_id, date, debit, credit, details) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [id, date, debit, credit, details]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error adding transaction:", error);
    res.status(500).json({ error: "Server error adding transaction." });
  }
});

// ✅ Edit a Transaction
app.put("/transactions/:id", async (req, res) => {
  const { id } = req.params;
  const { date, debit, credit, details } = req.body;
  try {
    const result = await pool.query(
      "UPDATE accounts_app.transactions SET date = $1, debit = $2, credit = $3, details = $4 WHERE id = $5 RETURNING *",
      [date, debit, credit, details, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error editing transaction:", error);
    res.status(500).json({ error: "Server error editing transaction" });
  }
});

// ✅ Delete a Transaction
app.delete("/transactions/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM accounts_app.transactions WHERE id = $1", [id]);
    res.status(200).json({ message: "Transaction deleted successfully" });
  } catch (error) {
    console.error("Error deleting transaction:", error);
    res.status(500).json({ error: "Server error deleting transaction" });
  }
});


/// Cheque Endpoint///

// ✅ Fetch All Cheques
app.get("/cheques", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM cheques ORDER BY date_posted DESC");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching cheques:", error);
    res.status(500).json({ error: "Server error fetching cheques" });
  }
});

// ✅ Fetch a Single Cheque by Cheque Number
app.get("/cheques/:cheque_number", async (req, res) => {
  const { cheque_number } = req.params;
  try {
    const result = await pool.query("SELECT * FROM cheques WHERE cheque_number = $1", [cheque_number]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Cheque not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching cheque:", error);
    res.status(500).json({ error: "Server error fetching cheque" });
  }
});

// ✅ Add a New Cheque
app.post("/cheques", async (req, res) => {
  const { cheque_number, bank_drawn, payer, payee, amount, admin_charge, status } = req.body;

  console.log("Received cheque data:", req.body); // Debugging

  try {
    const result = await pool.query(
      "INSERT INTO cheques (cheque_number, bank_drawn, payer, payee, amount, admin_charge, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [cheque_number, bank_drawn, payer, payee, amount, admin_charge, status]
    );

    console.log("Cheque successfully stored in database:", result.rows[0]); // Debugging
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error adding cheque to database:", error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Edit an Existing Cheque
app.put("/cheques/:cheque_number", async (req, res) => {
  const { cheque_number } = req.params;
  const { bank_drawn, payer, payee, amount, admin_charge, status } = req.body;

  try {
    const result = await pool.query(
      "UPDATE cheques SET bank_drawn = $1, payer = $2, payee = $3, amount = $4, admin_charge = $5, status = $6 WHERE cheque_number = $7 RETURNING *",
      [bank_drawn, payer, payee, amount, admin_charge, status, cheque_number]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Cheque not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating cheque:", error);
    res.status(500).json({ error: "Server error updating cheque" });
  }
});

// ✅ Delete a Cheque
app.delete("/cheques/:cheque_number", async (req, res) => {
  const { cheque_number } = req.params;
  try {
    const result = await pool.query("DELETE FROM cheques WHERE cheque_number = $1 RETURNING *", [cheque_number]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Cheque not found" });
    }

    res.status(200).json({ message: "Cheque deleted successfully" });
  } catch (error) {
    console.error("Error deleting cheque:", error);
    res.status(500).json({ error: "Server error deleting cheque" });
  }
});


// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
