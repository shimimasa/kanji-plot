import json, csv

# JSON は UTF-8 なので encoding='utf-8' とします（デフォルトでもOK）
data = json.load(open('kanji_g5_proto.json', encoding='utf-8'))

# CSV は UTF-8 + BOM で出力すると Excel 親和性が高いです
with open('kanji_g5_proto.csv', 'w', newline='', encoding='utf-8-sig') as fp:
    w = csv.writer(fp)
    # ヘッダー行が不要ならこの行は削ってOK
    w.writerow(['id','kanji','onyomi','kunyomi','meaning','exampleSentence'])
    for r in data:
        w.writerow([
            r['id'],
            r['kanji'],
            ';'.join(r.get('onyomi', [])),
            ';'.join(r.get('kunyomi', [])),
            r.get('meaning',''),
            r.get('exampleSentence','')
        ])
