/** Original sample database for the SQL playground: a small bookshop. */

export const SAMPLE_DB_SQL = `
CREATE TABLE authors (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT
);

CREATE TABLE books (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  author_id INTEGER NOT NULL REFERENCES authors(id),
  genre TEXT NOT NULL,
  published INTEGER,
  price REAL NOT NULL
);

CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  joined TEXT NOT NULL
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  ordered_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('paid', 'shipped', 'refunded'))
);

CREATE TABLE order_items (
  order_id INTEGER NOT NULL REFERENCES orders(id),
  book_id INTEGER NOT NULL REFERENCES books(id),
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_price REAL NOT NULL,
  PRIMARY KEY (order_id, book_id)
);

INSERT INTO authors (id, name, country) VALUES
  (1, 'Mira Okafor', 'Nigeria'),
  (2, 'Tomas Lindqvist', 'Sweden'),
  (3, 'Ana Beltran', 'Chile'),
  (4, 'Kenji Arai', 'Japan'),
  (5, 'Priya Nair', 'India');

INSERT INTO books (id, title, author_id, genre, published, price) VALUES
  (1, 'The Salt Orchard', 1, 'Fiction', 2019, 14.99),
  (2, 'Rivers Under Lagos', 1, 'Fiction', 2022, 17.50),
  (3, 'Practical Data Pipelines', 2, 'Technology', 2021, 39.00),
  (4, 'Northern Light Cooking', 2, 'Food', 2018, 24.00),
  (5, 'Atlas of Small Islands', 3, 'Travel', 2020, 29.95),
  (6, 'The Quiet Algorithm', 4, 'Technology', 2023, 42.00),
  (7, 'Tea at Four', 4, 'Fiction', 2017, 12.00),
  (8, 'Monsoon Kitchen', 5, 'Food', 2021, 21.00),
  (9, 'Learning SQL by Puzzles', 5, 'Technology', 2024, 34.50),
  (10, 'Andes on Foot', 3, 'Travel', 2016, 19.99),
  (11, 'Winter Garden Notes', 2, 'Fiction', 2025, 16.00),
  (12, 'Edge Cases in Practice', 4, 'Technology', 2025, 31.00);

INSERT INTO customers (id, name, city, joined) VALUES
  (1, 'Leah Fischer', 'Berlin', '2024-01-14'),
  (2, 'Omar Haddad', 'Amman', '2024-03-02'),
  (3, 'Sofia Rossi', 'Milan', '2024-06-21'),
  (4, 'Daniel Park', 'Seoul', '2025-01-09'),
  (5, 'Grace Mensah', 'Accra', '2025-02-17'),
  (6, 'Lucas Martin', 'Lyon', '2025-05-30');

INSERT INTO orders (id, customer_id, ordered_at, status) VALUES
  (1, 1, '2025-01-05', 'shipped'),
  (2, 2, '2025-01-19', 'shipped'),
  (3, 1, '2025-02-11', 'paid'),
  (4, 3, '2025-03-03', 'shipped'),
  (5, 4, '2025-03-28', 'refunded'),
  (6, 5, '2025-04-15', 'shipped'),
  (7, 2, '2025-05-07', 'paid'),
  (8, 6, '2025-06-12', 'shipped'),
  (9, 3, '2025-06-30', 'paid');

INSERT INTO order_items (order_id, book_id, qty, unit_price) VALUES
  (1, 3, 1, 39.00), (1, 7, 2, 12.00),
  (2, 1, 1, 14.99),
  (3, 6, 1, 42.00), (3, 9, 1, 34.50),
  (4, 5, 1, 29.95), (4, 10, 1, 19.99),
  (5, 4, 1, 24.00),
  (6, 8, 3, 21.00), (6, 2, 1, 17.50),
  (7, 9, 2, 34.50),
  (8, 1, 1, 14.99), (8, 7, 1, 12.00), (8, 3, 1, 39.00),
  (9, 2, 2, 17.50);
`;

export const EXAMPLE_QUERIES: { label: string; sql: string }[] = [
  { label: "All books", sql: "SELECT * FROM books ORDER BY title;" },
  {
    label: "Revenue by genre",
    sql: `SELECT b.genre, SUM(oi.qty * oi.unit_price) AS revenue, SUM(oi.qty) AS copies
FROM order_items oi
JOIN books b ON b.id = oi.book_id
JOIN orders o ON o.id = oi.order_id
WHERE o.status <> 'refunded'
GROUP BY b.genre
ORDER BY revenue DESC;`,
  },
  {
    label: "Top customers",
    sql: `SELECT c.name, c.city, COUNT(DISTINCT o.id) AS orders,
       ROUND(SUM(oi.qty * oi.unit_price), 2) AS spent
FROM customers c
JOIN orders o ON o.customer_id = c.id AND o.status <> 'refunded'
JOIN order_items oi ON oi.order_id = o.id
GROUP BY c.id
ORDER BY spent DESC;`,
  },
  {
    label: "Books never ordered",
    sql: `SELECT b.title, a.name AS author
FROM books b
JOIN authors a ON a.id = b.author_id
LEFT JOIN order_items oi ON oi.book_id = b.id
WHERE oi.book_id IS NULL;`,
  },
  {
    label: "Monthly orders (window function)",
    sql: `SELECT strftime('%Y-%m', ordered_at) AS month,
       COUNT(*) AS orders,
       SUM(COUNT(*)) OVER (ORDER BY strftime('%Y-%m', ordered_at)) AS running_total
FROM orders
GROUP BY month;`,
  },
  {
    label: "Insert and update",
    sql: `INSERT INTO customers (name, city, joined) VALUES ('Nadia Petrova', 'Sofia', date('now'));
UPDATE books SET price = ROUND(price * 0.9, 2) WHERE genre = 'Travel';
SELECT * FROM customers ORDER BY id DESC LIMIT 3;`,
  },
];
