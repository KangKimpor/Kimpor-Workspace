"""Local-only BP04 preparation; writes private files, never connects to a database.

Usage: python scripts/nbc-bp04-extract.py SOURCE.xlsx
"""
import base64
import json
from pathlib import Path
import runpy
import shutil
import sys

shared = runpy.run_path(str(Path(__file__).with_name('nbc-bp03-extract.py')))
source = Path(sys.argv[1])
dataset = shared['extract'](source, 'nbc-bp04')
output = Path('.private/nbc-bp04')
output.mkdir(parents=True, exist_ok=True)
for name, value in [('initial', dataset), ('reconciliation', dataset['reconciliation'])]:
    (output / (name + '.json')).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
shutil.copyfile(source, output / 'template.xlsx')
sql = shared['seed_sql'](dataset)
# Store the matching template in the same guarded transaction. Never replace an existing template.
template = base64.b64encode(source.read_bytes()).decode()
sql = sql.replace('commit;', "insert into public.kw_nbc_templates(project_id,name,base64) values('nbc-bp04','NBC-BP04-Progress Tracking by BOQ.xlsx','" + template + "') on conflict(project_id) do nothing;\ncommit;")
(output / 'initialize.sql').write_text(sql, encoding='utf-8')
print(json.dumps(dataset['reconciliation'], indent=2))
