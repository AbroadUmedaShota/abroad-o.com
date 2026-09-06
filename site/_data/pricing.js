// User decision received 2026-09-06; see docs/pricing-decision-20260906.md.
const adf = { dpi: 200, yen: 4, mono300Yen: 6 };
const book = { dpi: 200, yen: 20, color300Yen: 30 };
const booklet = { pages: 100, copies: 100 };
const questionnaire = { sheets: 10000 };
const format = value => value.toLocaleString('ja-JP');

export default {
  adf,
  book,
  booklet: {
    ...booklet,
    total: format(book.color300Yen * booklet.pages * booklet.copies)
  },
  questionnaire: {
    sheets: format(questionnaire.sheets),
    total: format(adf.mono300Yen * questionnaire.sheets)
  }
};
