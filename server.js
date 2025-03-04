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
      console.log("📥 Incoming Report Data:", req.body);

      let { report_date, opening_balance, closing_balance, report_data } = req.body;

      if (!report_date) {
          return res.status(400).json({ error: "Report date is required" });
      }

      // ✅ Ensure numeric fields are set to 0 if missing
      opening_balance = opening_balance === "" || opening_balance === undefined ? 0 : parseFloat(opening_balance);
      closing_balance = closing_balance === "" || closing_balance === undefined ? 0 : parseFloat(closing_balance);
      report_data = report_data && typeof report_data === "object" ? report_data : {};

      const formattedReportData = JSON.stringify(report_data);

      // ✅ First, check if a report for this date already exists
      const existingReport = await pool.query(
          `SELECT * FROM daily_receivables WHERE report_date = $1`,
          [report_date]
      );

      if (existingReport.rows.length > 0) {
          console.log(`🔄 Report for ${report_date} already exists. Updating instead of inserting.`);

          // ✅ If the report exists, update it
          const result = await pool.query(
              `UPDATE daily_receivables 
               SET opening_balance = $1, closing_balance = $2, report_data = $3 
               WHERE report_date = $4 RETURNING *`,
              [opening_balance, closing_balance, formattedReportData, report_date]
          );

          console.log("✅ Report Updated Successfully:", result.rows[0]);
          return res.json(result.rows[0]);
      }

      // ✅ If no report exists, insert a new one
      const result = await pool.query(
          `INSERT INTO daily_receivables (report_date, opening_balance, closing_balance, report_data, status) 
           VALUES ($1, $2, $3, $4, 'open') RETURNING *`,
          [report_date, opening_balance, closing_balance, formattedReportData]
      );

      console.log("✅ New Report Created Successfully:", result.rows[0]);
      res.json(result.rows[0]);

  } catch (error) {
      console.error("❌ Error creating or updating report:", error);
      res.status(500).json({ error: "Failed to create or update report" });
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
      console.log("📝 Updating Report:", req.body);
      const { report_date, opening_balance, closing_balance, report_data, status } = req.body;

      const result = await pool.query(
          `UPDATE daily_receivables 
           SET opening_balance = $1, closing_balance = $2, report_data = $3, status = $4 
           WHERE report_date = $5 RETURNING *`,
          [opening_balance, closing_balance, report_data, status, report_date]
      );

      if (result.rows.length === 0) {
          return res.status(404).json({ message: "Report not found for update" });
      }

      console.log("✅ Report Updated:", result.rows[0]);
      res.json(result.rows[0]);
  } catch (error) {
      console.error("❌ Error updating report:", error);
      res.status(500).json({ error: "Failed to update report" });
  }
});

app.put("/daily-receivables/:date", async (req, res) => {
  try {
      console.log("📝 Updating Report:", req.body);

      let { report_date, opening_balance, closing_balance, report_data, status } = req.body;

      // ✅ Ensure numeric fields are set to 0 if missing
      opening_balance = opening_balance === "" || opening_balance === undefined ? 0 : parseFloat(opening_balance);
      closing_balance = closing_balance === "" || closing_balance === undefined ? 0 : parseFloat(closing_balance);

      // ✅ Ensure report_data is always valid JSON
      report_data = report_data && typeof report_data === "object" ? report_data : {};

      const formattedReportData = JSON.stringify(report_data); // Ensure JSONB format

      const result = await pool.query(
          `UPDATE daily_receivables 
           SET opening_balance = $1, closing_balance = $2, report_data = $3, status = COALESCE($4, status)
           WHERE report_date = $5 RETURNING *`,
          [opening_balance, closing_balance, formattedReportData, status, report_date]
      );

      if (result.rows.length === 0) {
          return res.status(404).json({ message: "Report not found for update" });
      }

      console.log("✅ Report Updated Successfully:", result.rows[0]);
      res.json(result.rows[0]);
  } catch (error) {
      console.error("❌ Error updating report:", error);
      res.status(500).json({ error: "Failed to update report" });
  }
});

app.put("/daily-receivables/finish/:date", async (req, res) => {
  try {
      console.log(`🚫 Finishing Report for Date: ${req.params.date}`);

      // ✅ Ensure the date is properly formatted to match the database (YYYY-MM-DD)
      const formattedDate = new Date(req.params.date).toISOString().split("T")[0];

      const result = await pool.query(
          `UPDATE daily_receivables 
           SET status = 'finished' 
           WHERE report_date::TEXT LIKE $1 RETURNING *`,  // ✅ Match only the date part
          [`${formattedDate}%`]
      );

      if (result.rows.length === 0) {
          return res.status(404).json({ message: "Report not found to finish" });
      }

      console.log("✅ Report Successfully Finished:", result.rows[0]);
      res.json(result.rows[0]);
  } catch (error) {
      console.error("❌ Error finishing report:", error);
      res.status(500).json({ error: "Failed to finish report" });
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

// Daily report 
// ✅ 1️⃣ Create a New Daily Report
app.post("/daily-report", async (req, res) => {
  try {
      const {
          report_date,
          cash_particulars,
          credit_particulars,
          outbound_cash_sale,
          cash_correspondence,
          cash_bf,
          starting_cash,
          total_proceedings,
          cash_payouts
      } = req.body;

      // Auto-calculate fields
      const total_cash_payouts = Object.values(outbound_cash_sale).reduce((sum, val) => sum + Number(val), 0);
      const total_cash_proceedings = Object.values(cash_particulars).reduce((sum, val) => sum + Number(val), 0);
      const subtotal = total_cash_payouts + total_cash_proceedings;
      const cash_surplus_deficit = cash_bf + starting_cash - subtotal;
      const overall_sales =
          total_proceedings["Cash Sales"] +
          total_proceedings["Credit Sales"] +
          total_proceedings["Outbound Sales"] -
          total_proceedings["Cash Payouts"];

      const result = await pool.query(
          `INSERT INTO daily_reports (
              report_date, cash_particulars, credit_particulars, outbound_cash_sale,
              cash_correspondence, total_cash_payouts, total_cash_proceedings, subtotal,
              cash_bf, starting_cash, cash_surplus_deficit, total_proceedings, overall_sales
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
          [
              report_date,
              cash_particulars,
              credit_particulars,
              outbound_cash_sale,
              cash_correspondence,
              total_cash_payouts,
              total_cash_proceedings,
              subtotal,
              cash_bf,
              starting_cash,
              cash_surplus_deficit,
              total_proceedings,
              overall_sales
          ]
      );

      res.json({ message: "✅ Report created successfully!", report: result.rows[0] });
  } catch (error) {
      console.error("❌ Error creating report:", error);
      res.status(500).json({ error: "Server error while creating report." });
  }
});

// ✅ 2️⃣ Retrieve All Reports
app.get("/daily-reports", async (req, res) => {
  try {
      const result = await pool.query("SELECT id, report_date FROM daily_reports ORDER BY report_date DESC");
      res.json(result.rows);
  } catch (error) {
      console.error("❌ Error fetching reports:", error);
      res.status(500).json({ error: "Server error while fetching reports." });
  }
});

// ✅ 3️⃣ Retrieve a Specific Report by Date
app.get("/daily-report/:date", async (req, res) => {
  try {
      const { date } = req.params;
      const result = await pool.query("SELECT * FROM daily_reports WHERE report_date = $1::date", [date]);

      if (result.rows.length === 0) {
          return res.status(404).json({ message: "No report found for this date" });
      }

      res.json(result.rows[0]);
  } catch (error) {
      console.error("❌ Error retrieving report:", error);
      res.status(500).json({ error: "Server error while retrieving report." });
  }
});

// ✅ 4️⃣ Update a Daily Report
app.put("/daily-report/:id", async (req, res) => {
  try {
      const { id } = req.params;
      const {
          cash_particulars,
          credit_particulars,
          outbound_cash_sale,
          cash_correspondence,
          cash_bf,
          starting_cash,
          total_proceedings,
          cash_payouts
      } = req.body;

      // Auto-calculate updates
      const total_cash_payouts = Object.values(outbound_cash_sale).reduce((sum, val) => sum + Number(val), 0);
      const total_cash_proceedings = Object.values(cash_particulars).reduce((sum, val) => sum + Number(val), 0);
      const subtotal = total_cash_payouts + total_cash_proceedings;
      const cash_surplus_deficit = cash_bf + starting_cash - subtotal;
      const overall_sales =
          total_proceedings["Cash Sales"] +
          total_proceedings["Credit Sales"] +
          total_proceedings["Outbound Sales"] -
          total_proceedings["Cash Payouts"];

      const result = await pool.query(
          `UPDATE daily_reports SET 
              cash_particulars = $1, credit_particulars = $2, outbound_cash_sale = $3, 
              cash_correspondence = $4, total_cash_payouts = $5, total_cash_proceedings = $6, 
              subtotal = $7, cash_bf = $8, starting_cash = $9, cash_surplus_deficit = $10, 
              total_proceedings = $11, overall_sales = $12
          WHERE id = $13 RETURNING *`,
          [
              cash_particulars,
              credit_particulars,
              outbound_cash_sale,
              cash_correspondence,
              total_cash_payouts,
              total_cash_proceedings,
              subtotal,
              cash_bf,
              starting_cash,
              cash_surplus_deficit,
              total_proceedings,
              overall_sales,
              id
          ]
      );

      res.json({ message: "✅ Report updated successfully!", report: result.rows[0] });
  } catch (error) {
      console.error("❌ Error updating report:", error);
      res.status(500).json({ error: "Server error while updating report." });
  }
});

// ✅ 5️⃣ Delete a Report
app.delete("/daily-report/:id", async (req, res) => {
  try {
      const { id } = req.params;
      await pool.query("DELETE FROM daily_reports WHERE id = $1", [id]);
      res.json({ message: "✅ Report deleted successfully!" });
  } catch (error) {
      console.error("❌ Error deleting report:", error);
      res.status(500).json({ error: "Server error while deleting report." });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
