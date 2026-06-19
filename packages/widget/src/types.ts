export interface Reply {
  id: string;
  author: string;
  text: string;
  created_at: string;
}

export interface Comment {
  id: string;
  url: string;
  /** Fallback horizontal position as a percentage (0-100) of the document. */
  x: number;
  /** Fallback vertical position as a percentage (0-100) of the document. */
  y: number;
  /** CSS selector of the anchored element (preferred over x/y when present). */
  selector?: string | null;
  /** Click offset within the anchored element, as a fraction (0-1). */
  relX?: number | null;
  relY?: number | null;
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
