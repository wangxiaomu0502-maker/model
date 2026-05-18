import { ResultSetHeader, RowDataPacket } from "mysql2";

import { dbPool } from "../../config/db";

import { CONTRACT_KIND_ORDER } from "./contract-templates.metadata";

export type ContractTemplateRow = RowDataPacket & {
  contract_kind: string;
  title: string;
  content_html: string;
  updated_at: Date;
};

export async function insertDefaultContractTemplates(): Promise<void> {
  await dbPool.query(
    `INSERT IGNORE INTO contract_templates (contract_kind, title, content_html) VALUES
       ('platform_broker', '平台与经纪人服务合同', ''),
       ('platform_merchant', '平台与商家服务合同', ''),
       ('broker_model', '经纪人与模特合作协议', '')`
  );
}

export async function listContractTemplatesOrdered(): Promise<ContractTemplateRow[]> {
  const fields = CONTRACT_KIND_ORDER.map(() => "?").join(", ");
  const [rows] = await dbPool.query<ContractTemplateRow[]>(
    `SELECT contract_kind, title, content_html, updated_at
     FROM contract_templates
     ORDER BY FIELD(contract_kind, ${fields})`,
    [...CONTRACT_KIND_ORDER]
  );
  return rows;
}

export async function findContractTemplateByKind(kind: string): Promise<ContractTemplateRow | null> {
  const [rows] = await dbPool.query<ContractTemplateRow[]>(
    `SELECT contract_kind, title, content_html, updated_at
     FROM contract_templates WHERE contract_kind = ? LIMIT 1`,
    [kind]
  );
  return rows[0] ?? null;
}

export async function updateContractTemplateByKind(
  kind: string,
  patch: { title: string; contentHtml: string }
): Promise<boolean> {
  const [result] = await dbPool.query<ResultSetHeader>(
    `UPDATE contract_templates
       SET title = ?, content_html = ?, updated_at = CURRENT_TIMESTAMP
     WHERE contract_kind = ?`,
    [patch.title, patch.contentHtml, kind]
  );
  return result.affectedRows > 0;
}
