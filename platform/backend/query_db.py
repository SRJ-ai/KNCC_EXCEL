import sqlite3

db_path = "kncc_platform.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("--- Database Counts ---")
for table in ["projects", "materials", "documents", "deliveries", "co_adjustments"]:
    cursor.execute(f"SELECT count(*) FROM {table};")
    print(f"{table.capitalize()} count: {cursor.fetchone()[0]}")

print("\n--- Sample Materials (First 5) ---")
cursor.execute("SELECT id, project_id, type, qty, po_co_qty, material_type, cost_mbf, total_cost FROM materials LIMIT 5;")
for row in cursor.fetchall():
    print(f"ID: {row[0]} | ProjID: {row[1]} | Type: {row[2]} | Qty: {row[3]} | TotalQty: {row[4]} | Desc: {row[5]} | Cost: {row[6]} | TotalCost: {row[7]}")

print("\n--- Sample Deliveries (First 5) ---")
cursor.execute("SELECT id, material_id, document_id, invoice_number, quantity, uom FROM deliveries LIMIT 5;")
for row in cursor.fetchall():
    print(f"ID: {row[0]} | MaterialID: {row[1]} | DocID: {row[2]} | Inv#: {row[3]} | Qty: {row[4]} | UOM: {row[5]}")

conn.close()
