const pool = require("../db");
const { v4: uuidv4 } = require("uuid");

module.exports = async function identify(req, res) {
  try {
    //  Read input
    const email = req.body.email;
    const phoneNumber = req.body.phoneNumber;

    // Step 1: Find contacts having same email OR phone number
    const result = await pool.query(
      "SELECT * FROM contacts WHERE email = $1 OR phonenumber = $2",
      [email, phoneNumber]
    );
    const contacts = result.rows;

    // Step 2: If no contact exists → create PRIMARY contact
    if (contacts.length === 0) {
      const newId = uuidv4();

      await pool.query(
        "INSERT INTO contacts (id, email, phonenumber, linkprecedence) VALUES ($1, $2, $3, 'primary')",
        [newId, email, phoneNumber]
      );

      return res.json({
        contact: {
          primaryContactId: newId,
          emails: email ? [email] : [],
          phoneNumbers: phoneNumber ? [phoneNumber] : [],
          secondaryContactIds: []
        }
      });
    }

    // Step 3: Find PRIMARY contact from existing ones
    let primaryContact = null;
    for (let contact of contacts) {
      if (contact.linkprecedence === "primary") {
        primaryContact = contact;
        break;
      }
    }

    // If none marked primary, pick first one
    if (!primaryContact) {
      primaryContact = contacts[0];
    }

    // Step 4: Convert extra PRIMARY contacts to SECONDARY
    for (let contact of contacts) {
      if (
        contact.linkprecedence === "primary" &&
        contact.id !== primaryContact.id
      ) {
        await pool.query(
          "UPDATE contacts SET linkprecedence = 'secondary', linkedid = $1 WHERE id = $2",
          [primaryContact.id, contact.id]
        );
      }
    }

    // Step 5: Check if email or phone already exists
    let emailExists = false;
    let phoneExists = false;

    for (let contact of contacts) {
      if (contact.email === email) emailExists = true;
      if (contact.phonenumber === phoneNumber) phoneExists = true;
    }

    // Step 6: Insert SECONDARY contact if new info is provided
    if ((email && !emailExists) || (phoneNumber && !phoneExists)) {
      await pool.query(
        "INSERT INTO contacts (id, email, phonenumber, linkedid, linkprecedence) VALUES ($1, $2, $3, $4, 'secondary')",
        [uuidv4(), email, phoneNumber, primaryContact.id]
      );
    }

    // Step 7: Fetch all linked contacts (primary + secondary)
    const finalResult = await pool.query(
      "SELECT * FROM contacts WHERE id = $1 OR linkedid = $1",
      [primaryContact.id]
    );
    const finalContacts = finalResult.rows;

    // Step 8: Prepare response arrays
    const emails = [];
    const phoneNumbers = [];
    const secondaryContactIds = [];

    for (let contact of finalContacts) {
      if (contact.email && !emails.includes(contact.email)) {
        emails.push(contact.email);
      }

      if (contact.phonenumber && !phoneNumbers.includes(contact.phonenumber)) {
        phoneNumbers.push(contact.phonenumber);
      }

      if (contact.linkprecedence === "secondary") {
        secondaryContactIds.push(contact.id);
      }
    }

    // Step 9: Send final response
    res.json({
      contact: {
        primaryContactId: primaryContact.id,
        emails,
        phoneNumbers,
        secondaryContactIds
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};