.[]
| [
    .id,
    .kanji,
    (.onyomi  | join(";")),
    (.kunyomi | join(";")),
    .meaning,
    .exampleSentence
  ]
| @csv
