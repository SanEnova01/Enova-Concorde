DROP TABLE IF EXISTS daily_metrics CASCADE;

CREATE TABLE daily_metrics (
    id SERIAL PRIMARY KEY,
    store_id VARCHAR(255) NOT NULL,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    redirect_ms INT,
    dns_ms INT,
    tcp_ms INT,
    ttfb_ms INT,
    dom_interactive_ms INT,
    dom_ms INT,
    load_ms INT,
    total_weight_mb REAL,
    total_requests INT,
    ram_mb REAL,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);
