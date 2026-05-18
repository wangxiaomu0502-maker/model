/**
 * Idempotent: add platform_split_rules.orphan_model_referrer_policy if missing.
 * Usage: from xinglian-server dir, `node scripts/ensure-orphan-model-referrer-policy.cjs`
 * (loads .env from cwd)
 */
require("dotenv").config();
const mysql = require("mysql2/promise");

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    const [[row]] = await conn.query(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'platform_split_rules'
         AND COLUMN_NAME = 'orphan_model_referrer_policy'`
    );
    if (Number(row.c) === 0) {
      await conn.query(
        `ALTER TABLE platform_split_rules
         ADD COLUMN orphan_model_referrer_policy ENUM('to_platform', 'to_model') NOT NULL DEFAULT 'to_platform'
           COMMENT '无模特推荐人时 T 去向'
         AFTER orphan_merchant_referrer_policy`
      );
      console.log("Applied: ADD COLUMN orphan_model_referrer_policy");
    } else {
      console.log("Skip: orphan_model_referrer_policy already exists");
    }
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
