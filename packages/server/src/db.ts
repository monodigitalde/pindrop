import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export interface Reply {
  id: string;
  author: string;
  text: string;
  created_at: string;
}

export interface Comment {
  id: string;
  url: string;
  x: number;
  y: number;
  selector: string | null;
  relX: number | null;
  relY: number | null;
  author: string;
  text: string;
  created_at: string;
  replies: Reply[];
}

export interface NewComment {
  url: string;
  x: number;
  y: number;
  selector?: string | null;
  relX?: number | null;
  relY?: number | null;
  author: string;
  text: string;
}

export interface CommentStore {
  listByUrl(url: string): Comment[];
  create(input: NewComment): Comment;
  /** Adds a reply to a top-level comment; null if the parent is missing. */
  addReply(parentId: string, author: string, text: string): Reply | null;
  /** Removes a comment (and any replies) or a single reply. */
  remove(id: string): boolean;
  close(): void;
}

declare module 'hono' {
  interface ContextVariableMap {
    store: CommentStore;
  }
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS comments (
  id         TEXT PRIMARY KEY,
  url        TEXT NOT NULL,
  x          REAL NOT NULL,
  y          REAL NOT NULL,
  selector   TEXT,
  rel_x      REAL,
  rel_y      REAL,
  parent_id  TEXT,
  author     TEXT NOT NULL,
  text       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_url ON comments(url);
`;

interface Row {
  id: string;
  url: string;
  x: number;
  y: number;
  selector: string | null;
  relX: number | null;
  relY: number | null;
  parent_id: string | null;
  author: string;
  text: string;
  created_at: string;
}

/** Adds columns to databases created before they existed. */
function migrate(db: Database.Database): void {
  const cols = new Set(
    (db.prepare('PRAGMA table_info(comments)').all() as { name: string }[]).map((c) => c.name),
  );
  for (const [name, ddl] of [
    ['selector', 'selector TEXT'],
    ['rel_x', 'rel_x REAL'],
    ['rel_y', 'rel_y REAL'],
    ['parent_id', 'parent_id TEXT'],
  ] as const) {
    if (!cols.has(name)) db.exec(`ALTER TABLE comments ADD COLUMN ${ddl}`);
  }
  // Index on parent_id must come after the column exists (incl. migrated DBs).
  db.exec('CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id)');
}

/** Opens (or creates) the SQLite database and returns a typed store. */
export function openStore(dbPath: string): CommentStore {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  migrate(db);

  // All rows for a URL (pins + replies), ordered oldest-first.
  const listStmt = db.prepare<[string]>(
    `SELECT id, url, x, y, selector, rel_x AS relX, rel_y AS relY, parent_id, author, text, created_at
     FROM comments WHERE url = ? ORDER BY created_at ASC`,
  );
  const getStmt = db.prepare<[string]>('SELECT id, url, parent_id FROM comments WHERE id = ?');
  const insertStmt = db.prepare(
    `INSERT INTO comments (id, url, x, y, selector, rel_x, rel_y, parent_id, author, text, created_at)
     VALUES (@id, @url, @x, @y, @selector, @rel_x, @rel_y, @parent_id, @author, @text, @created_at)`,
  );
  // Deletes a comment plus any replies that hang off it.
  const deleteStmt = db.prepare<[string, string]>(
    'DELETE FROM comments WHERE id = ? OR parent_id = ?',
  );

  return {
    listByUrl(url) {
      const rows = listStmt.all(url) as Row[];
      const repliesByParent = new Map<string, Reply[]>();
      const tops: Comment[] = [];

      for (const r of rows) {
        if (r.parent_id) {
          const reply: Reply = { id: r.id, author: r.author, text: r.text, created_at: r.created_at };
          const list = repliesByParent.get(r.parent_id);
          if (list) list.push(reply);
          else repliesByParent.set(r.parent_id, [reply]);
        } else {
          tops.push({
            id: r.id,
            url: r.url,
            x: r.x,
            y: r.y,
            selector: r.selector,
            relX: r.relX,
            relY: r.relY,
            author: r.author,
            text: r.text,
            created_at: r.created_at,
            replies: [],
          });
        }
      }
      for (const t of tops) t.replies = repliesByParent.get(t.id) ?? [];
      return tops;
    },

    create(input) {
      const created_at = new Date().toISOString();
      const id = randomUUID();
      insertStmt.run({
        id,
        url: input.url,
        x: input.x,
        y: input.y,
        selector: input.selector ?? null,
        rel_x: input.relX ?? null,
        rel_y: input.relY ?? null,
        parent_id: null,
        author: input.author,
        text: input.text,
        created_at,
      });
      return {
        id,
        url: input.url,
        x: input.x,
        y: input.y,
        selector: input.selector ?? null,
        relX: input.relX ?? null,
        relY: input.relY ?? null,
        author: input.author,
        text: input.text,
        created_at,
        replies: [],
      };
    },

    addReply(parentId, author, text) {
      const parent = getStmt.get(parentId) as Pick<Row, 'url' | 'parent_id'> | undefined;
      // Only top-level comments can be replied to (no nested threads).
      if (!parent || parent.parent_id) return null;

      const created_at = new Date().toISOString();
      const id = randomUUID();
      insertStmt.run({
        id,
        url: parent.url,
        x: 0,
        y: 0,
        selector: null,
        rel_x: null,
        rel_y: null,
        parent_id: parentId,
        author,
        text,
        created_at,
      });
      return { id, author, text, created_at };
    },

    remove(id) {
      return deleteStmt.run(id, id).changes > 0;
    },

    close() {
      db.close();
    },
  };
}
