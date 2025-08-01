import json
import pandas as pd

# 1. 元の proto と例文 CSV 読み込み
with open('kanji_g2_proto.json','r',encoding='utf-8') as f:
    proto = json.load(f)

df = pd.read_csv('kanji_g2_example.csv')  # sep='\t' なら指定

# 2. 例文行を辞書化
example_map = {
    row['kanji']: {
        'word': row['kanji'],
        'reading': row['reading'],
        'sentence': row['example']
    }
    for _, row in df.iterrows()
}

# 3. proto の each entry にマージ
for entry in proto:
    k = entry['kanji']
    if k in example_map:
        entry['meaning'] = df.loc[df['kanji']==k,'meaning'].values[0]
        entry['examples'] = [ example_map[k] ]
        # もともとあった entry.pop('exampleSentence', None)
        entry.pop('exampleSentence', None)

# 4. 新ファイルへ書き出し
with open('kanji_g2_completed.json','w',encoding='utf-8') as f:
    json.dump(proto, f, ensure_ascii=False, indent=2)
print("kanji_g2_completed.json に出力完了")
