import pandas as pd

# 1. データ読み込み（CSV or TSV）
df = pd.read_csv('kanji_g2_example.csv')  # sep='\t' なら指定

# 2. 学年外漢字リスト読み込み
with open('high_grade_kanji.txt','r', encoding='utf-8') as f:
    high_grade_kanji = set(line.strip() for line in f if line.strip())

# 3. 各例文のチェック
def contains_high_grade_kanji(sent):
    return any(ch in high_grade_kanji for ch in sent)

df['grade_ok'] = df['example'].apply(lambda s: not contains_high_grade_kanji(s))

# 4. NG行だけ抽出してレポート出力
ng = df.loc[~df['grade_ok'], ['kanji','example']]
if not ng.empty:
    print("【学年外漢字混入あり】")
    for _, row in ng.iterrows():
        print(f"{row.kanji}: {row.example}")
else:
    print("All clear! 学年外漢字は混入していません。")
