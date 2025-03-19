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

    // Convert fields to numbers before sending response
    const formattedCheques = result.rows.map(cheque => ({
      ...cheque,
      amount: parseFloat(cheque.amount),
      admin_charge: parseFloat(cheque.admin_charge),
      net_to_payee: parseFloat(cheque.net_to_payee),
      date_posted: cheque.date_posted ? new Date(cheque.date_posted).toISOString().split('T')[0] : null
    }));

    res.json(formattedCheques);
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

    // Convert fields to numbers before sending response
    const cheque = result.rows[0];
    const formattedCheque = {
      ...cheque,
      amount: parseFloat(cheque.amount),
      admin_charge: parseFloat(cheque.admin_charge),
      net_to_payee: parseFloat(cheque.net_to_payee),
      date_posted: cheque.date_posted ? new Date(cheque.date_posted).toISOString().split('T')[0] : null
    };

    res.json(formattedCheque);
  } catch (error) {
    console.error("Error fetching cheque:", error);
    res.status(500).json({ error: "Server error fetching cheque" });
  }
});

// ✅ Add a New Cheque
// ✅ Add a New Cheque to the Main `cheques` Table
app.post("/cheques", async (req, res) => {
  const { cheque_number, bank_drawn, payer, payee, amount, admin_charge, date_posted, status } = req.body;

  console.log("🔹 Incoming Cheque Data:", req.body);

  try {
    // ✅ Ensure all required fields are present
    if (!cheque_number || !bank_drawn || !payer || !payee || !amount || !admin_charge || !date_posted || !status) {
      return res.status(400).json({ error: "All cheque fields are required!" });
    }

    // ✅ Insert new cheque into the `cheques` table
    const insertQuery = `
      INSERT INTO cheques (cheque_number, bank_drawn, payer, payee, amount, admin_charge, date_posted, status) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`;
    const insertValues = [
      cheque_number,
      bank_drawn,
      payer,
      payee,
      amount,
      admin_charge,
      date_posted,
      status
    ];

    const result = await pool.query(insertQuery, insertValues);
    console.log("✅ Cheque Added:", result.rows[0]); // ✅ Log inserted cheque
    return res.json(result.rows[0]);
  } catch (error) {
    console.error("❌ Error adding cheque:", error);
    return res.status(500).json({ error: "Server error adding cheque" });
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

// ✅ Save or Update Cheque Details (Single or Multiple Fields Dynamically)
app.post("/cheques/:cheque_number/details", async (req, res) => {
  const { cheque_number } = req.params;
  let {
    address,
    phone_number,
    id_type,
    id_number,
    date_of_issue,
    date_of_expiry,
    date_of_birth,
  } = req.body;

  console.log("🔹 Incoming Data:", req.body); // ✅ Debug Log

  try {
    // ✅ Ensure all fields are present
    if (
      !address?.trim() ||
      !phone_number?.trim() ||
      !id_type?.trim() ||
      !id_number?.trim() ||
      !date_of_issue ||
      !date_of_expiry ||
      !date_of_birth
    ) {
      return res.status(400).json({ error: "All fields are required!" });
    }

    // ✅ Format Dates to YYYY-MM-DD
    date_of_issue = new Date(date_of_issue).toISOString().split("T")[0];
    date_of_expiry = new Date(date_of_expiry).toISOString().split("T")[0];
    date_of_birth = new Date(date_of_birth).toISOString().split("T")[0];

    // ✅ Format Phone Number (Remove non-numeric characters)
    phone_number = phone_number.replace(/\D/g, "").slice(0, 20);

    // ✅ Check if the record exists
    const existingDetails = await pool.query(
      "SELECT * FROM cheque_details WHERE cheque_number = $1",
      [cheque_number]
    );

    if (existingDetails.rows.length > 0) {
      // ✅ If record exists, UPDATE instead of rejecting
      const updateQuery = `
        UPDATE cheque_details 
        SET address = $1, phone_number = $2, id_type = $3, id_number = $4, 
            date_of_issue = $5, date_of_expiry = $6, date_of_birth = $7 
        WHERE cheque_number = $8 RETURNING *`;
      const updateValues = [
        address.trim(),
        phone_number,
        id_type.trim(),
        id_number.trim(),
        date_of_issue,
        date_of_expiry,
        date_of_birth,
        cheque_number,
      ];

      const updateResult = await pool.query(updateQuery, updateValues);
      console.log(`✅ Updated cheque details for ${cheque_number}`);
      return res.json(updateResult.rows[0]);
    }

    // ✅ If no record exists, INSERT a new one
    const insertQuery = `
      INSERT INTO cheque_details (cheque_number, address, phone_number, id_type, id_number, date_of_issue, date_of_expiry, date_of_birth) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`;
    const insertValues = [
      cheque_number,
      address.trim(),
      phone_number,
      id_type.trim(),
      id_number.trim(),
      date_of_issue,
      date_of_expiry,
      date_of_birth,
    ];

    const insertResult = await pool.query(insertQuery, insertValues);
    console.log(`✅ Inserted new cheque details for ${cheque_number}`);
    return res.json(insertResult.rows[0]);
  } catch (error) {
    console.error("❌ Error saving cheque details:", error);
    return res.status(500).json({ error: "Server error saving cheque details" });
  }
});

app.patch("/cheques/:cheque_number/details", async (req, res) => {
  const { cheque_number } = req.params;
  const updates = req.body;

  console.log(`🔹 Incoming Update Request for Cheque ${cheque_number}:`, updates);

  try {
    // ✅ Ensure the cheque exists before updating details
    const chequeExists = await pool.query(
      "SELECT * FROM cheque_details WHERE cheque_number = $1",
      [cheque_number]
    );

    if (chequeExists.rows.length === 0) {
      return res.status(404).json({ error: "Cheque details not found!" });
    }

    // ✅ Dynamically construct update query based on provided fields
    const fieldsToUpdate = [];
    const values = [];
    let index = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && value !== null) {
        fieldsToUpdate.push(`${key} = $${index}`);
        values.push(value);
        index++;
      }
    }

    // ✅ If no valid fields are provided, return an error
    if (fieldsToUpdate.length === 0) {
      return res.status(400).json({ error: "No valid fields provided for update!" });
    }

    // ✅ Add cheque_number as the last parameter
    values.push(cheque_number);

    // ✅ Construct & execute the update query
    const updateQuery = `
      UPDATE cheque_details 
      SET ${fieldsToUpdate.join(", ")} 
      WHERE cheque_number = $${index} 
      RETURNING *;
    `;

    const result = await pool.query(updateQuery, values);
    console.log(`✅ Cheque Details Updated for ${cheque_number}:`, result.rows[0]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error("❌ Error updating cheque details:", error);
    res.status(500).json({ error: "Server error updating cheque details" });
  }
});

app.patch("/cheques/:cheque_number/status", async (req, res) => {
  const { cheque_number } = req.params;
  const { status } = req.body;

  console.log(`🔹 Updating status for Cheque ${cheque_number} to: ${status}`);

  try {
    // ✅ Ensure cheque exists
    const chequeExists = await pool.query(
      "SELECT * FROM cheques WHERE cheque_number = $1",
      [cheque_number]
    );

    if (chequeExists.rows.length === 0) {
      return res.status(404).json({ error: "Cheque not found!" });
    }

    // ✅ Update only the status field
    const updateQuery = `
      UPDATE cheques 
      SET status = $1 
      WHERE cheque_number = $2 
      RETURNING *;
    `;
    const values = [status, cheque_number];

    const result = await pool.query(updateQuery, values);
    console.log(`✅ Status Updated for Cheque ${cheque_number}:`, result.rows[0]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error("❌ Error updating cheque status:", error);
    res.status(500).json({ error: "Server error updating cheque status" });
  }
});


app.get("/cheques/:cheque_number", async (req, res) => {
  const { cheque_number } = req.params;

  try {
    // ✅ Fetch cheque details from the `cheques` table
    const cheque = await pool.query(
      "SELECT * FROM cheques WHERE cheque_number = $1",
      [cheque_number]
    );

    if (cheque.rows.length === 0) {
      return res.status(404).json({ error: "Cheque not found" });
    }

    res.json(cheque.rows[0]);
  } catch (error) {
    console.error("❌ Error retrieving main cheque details:", error);
    res.status(500).json({ error: "Server error retrieving cheque details" });
  }
});


// ✅ Fetch Cheque Details
app.get("/cheques/:cheque_number/details", async (req, res) => {
  const { cheque_number } = req.params;

  try {
    // ✅ Fetch cheque details from the correct table: `cheque_details`
    const chequeDetails = await pool.query(
      "SELECT * FROM cheque_details WHERE cheque_number = $1",
      [cheque_number]
    );

    if (chequeDetails.rows.length === 0) {
      return res.status(404).json({ error: "Cheque details not found" });
    }

    res.json(chequeDetails.rows[0]);
  } catch (error) {
    console.error("❌ Error retrieving cheque details:", error);
    res.status(500).json({ error: "Server error retrieving cheque details" });
  }
});


// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
