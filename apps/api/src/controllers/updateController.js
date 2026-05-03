import { getDatabase } from "../config/database.js";

function serializeUpdate(row) {
  return {
    id: String(row.id),
    authorType: row.author_type,
    authorName: row.author_name,
    message: row.message,
    priority: row.priority,
    context: row.context,
    createdAt: row.created_at
  };
}

export async function listUpdates(req, res) {
  try {
    const db = getDatabase();
    const authorType = req.query.authorType ? String(req.query.authorType) : undefined;
    const updates = authorType
      ? db.all("SELECT * FROM updates WHERE author_type = ? ORDER BY created_at DESC LIMIT 50", [authorType])
      : db.all("SELECT * FROM updates ORDER BY created_at DESC LIMIT 50");

    res.json({
      updates: updates.map(serializeUpdate)
    });
  } catch {
    res.status(500).json({ message: "Failed to load updates." });
  }
}

export async function createUpdate(req, res) {
  try {
    const { authorType, authorName, message, priority = "normal", context = "operations" } = req.body;

    if (!authorType || !authorName || !message) {
      return res.status(400).json({ message: "authorType, authorName, and message are required." });
    }

    const db = getDatabase();
    const now = new Date().toISOString();
    const result = db.run(`
      INSERT INTO updates (author_type, author_name, message, priority, context, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [authorType, authorName, message, priority, context, now, now]);

    const created = db.get("SELECT * FROM updates WHERE id = ?", [result.lastInsertRowid]);

    return res.status(201).json(serializeUpdate(created));
  } catch {
    return res.status(400).json({ message: "Failed to create update." });
  }
}
