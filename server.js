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

// DAILY REPORTS COMPONENT
// DAILY RECEIVABLES 
// ✅ Create a New Daily Receivables Report (Auto-Save)
app.post("/daily-receivables", async (req, res) => {
  try {
    const { report_date, opening_balance, closing_balance, report_data } = req.body;

    console.log("📝 Received Report Data:", req.body);

    // ✅ Ensure empty fields have default values
    const validData = {
      report_date: report_date || new Date().toISOString().split("T")[0],
      opening_balance: opening_balance || "0",
      closing_balance: closing_balance || "0",
      report_data: report_data || { customers: [], digicel_wholesale: [], misc_sales: [], cash_payouts: [] }
    };

    // ✅ Check if a report already exists for this date
    const existingReport = await pool.query(
      "SELECT * FROM daily_receivables WHERE report_date = $1",
      [validData.report_date]
    );

    if (existingReport.rows.length > 0) {
      // ✅ If report exists, UPDATE instead of inserting
      const updateResult = await pool.query(
        `UPDATE daily_receivables 
         SET opening_balance = $1, closing_balance = $2, report_data = $3
         WHERE report_date = $4 RETURNING *`,
        [validData.opening_balance, validData.closing_balance, JSON.stringify(validData.report_data), validData.report_date]
      );

      console.log("✅ Report Updated:", updateResult.rows[0]);
      return res.status(200).json(updateResult.rows[0]);
    }

    // ✅ If no report exists, INSERT a new one
    const result = await pool.query(
      `INSERT INTO daily_receivables (report_date, opening_balance, closing_balance, report_data)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [validData.report_date, validData.opening_balance, validData.closing_balance, JSON.stringify(validData.report_data)]
    );

    console.log("✅ New Report Created:", result.rows[0]);
    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error("❌ Error saving report:", error);
    res.status(500).json({ error: "Server error while saving report", details: error.message });
  }
});


// ✅ Fetch All Reports (Only Dates & IDs)
app.get("/daily-receivables", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, report_date FROM daily_receivables ORDER BY report_date DESC"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({ error: "Server error while fetching reports" });
  }
});

// ✅ Retrieve a Specific Report by Date
app.get("/daily-receivables/:date", async (req, res) => {
  try {
    let { date } = req.params;

    // ✅ Convert input to Date format for PostgreSQL
    date = new Date(date).toISOString().split("T")[0];

    const result = await pool.query(
      "SELECT * FROM daily_receivables WHERE report_date = $1::date",
      [date]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No report found for this date" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error retrieving report:", error);
    res.status(500).json({ error: "Server error while retrieving report" });
  }
});


// ✅ Update an Existing Report by Date
app.put("/daily-receivables/:date", async (req, res) => {
  try {
    const { date } = req.params;
    const { opening_balance, closing_balance, report_data } = req.body;

    const result = await pool.query(
      `UPDATE daily_receivables 
       SET opening_balance = $1, closing_balance = $2, report_data = $3 
       WHERE report_date = $4 RETURNING *`,
      [opening_balance, closing_balance, report_data, date]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Report not found for update" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating report:", error);
    res.status(500).json({ error: "Server error while updating report" });
  }
});

// ✅ Delete a Report by Date
app.delete("/daily-receivables/:date", async (req, res) => {
  try {
    const { date } = req.params;

    const result = await pool.query(
      "DELETE FROM daily_receivables WHERE report_date = $1 RETURNING *",
      [date]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No report found to delete" });
    }

    res.status(200).json({ message: "Report deleted successfully" });
  } catch (error) {
    console.error("Error deleting report:", error);
    res.status(500).json({ error: "Server error while deleting report" });
  }
});



// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
