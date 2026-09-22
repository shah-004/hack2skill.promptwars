import sqlite3

def check_latest_report():
    conn = sqlite3.connect('community.db')
    cursor = conn.cursor()
    cursor.execute("SELECT id, content_text, analysis_summary FROM reports ORDER BY created_at DESC LIMIT 1;")
    row = cursor.fetchone()
    if row:
        with open('latest_report_dump.txt', 'w', encoding='utf-8') as f:
            f.write(f"ID: {row[0]}\n")
            f.write(f"Content: {row[1]}\n")
            f.write(f"Analysis Summary:\n{row[2]}\n")
    else:
        print("No reports found.")
    conn.close()

if __name__ == '__main__':
    check_latest_report()
