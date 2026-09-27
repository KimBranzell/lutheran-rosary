/**
 * Scripture references to extract from SKB USX files.
 * Each entry maps a stable ID to a USX book code and verse range.
 * The extractor (scripts/extract-scriptures.mjs) reads these
 * and produces src/data/generated/scripture-passages.json.
 */

export const scriptureReferences = [
  // Glädjefylld mysteries
  { id: 'LUK_1_26-38', book: 'LUK', chapter: 1, verses: [26, 38] },
  { id: 'LUK_1_39-45', book: 'LUK', chapter: 1, verses: [39, 45] },
  { id: 'LUK_2_1-20', book: 'LUK', chapter: 2, verses: [1, 20] },
  { id: 'LUK_2_22-38', book: 'LUK', chapter: 2, verses: [22, 38] },
  { id: 'LUK_2_41-50', book: 'LUK', chapter: 2, verses: [41, 50] },

  // Lysande mysteries
  { id: 'MAT_3_13-16', book: 'MAT', chapter: 3, verses: [13, 16] },
  { id: 'JHN_2_1-11', book: 'JHN', chapter: 2, verses: [1, 11] },
  { id: 'MRK_1_14-15', book: 'MRK', chapter: 1, verses: [14, 15] },
  { id: 'MAT_17_1-8', book: 'MAT', chapter: 17, verses: [1, 8] },
  { id: 'LUK_22_14-20', book: 'LUK', chapter: 22, verses: [14, 20] },

  // Sorgfull mysteries
  { id: 'LUK_22_39-46', book: 'LUK', chapter: 22, verses: [39, 46] },
  { id: 'MAT_27_26', book: 'MAT', chapter: 27, verses: [26, 26] },
  { id: 'MAT_27_27-31', book: 'MAT', chapter: 27, verses: [27, 31] },
  { id: 'MAT_27_32', book: 'MAT', chapter: 27, verses: [32, 32] },
  { id: 'JHN_19_25-30', book: 'JHN', chapter: 19, verses: [25, 30] },

  // Härlig mysteries
  { id: 'MRK_16_1-7', book: 'MRK', chapter: 16, verses: [1, 7] },
  { id: 'LUK_24_45-53', book: 'LUK', chapter: 24, verses: [45, 53] },
  { id: 'ACT_2_1-7', book: 'ACT', chapter: 2, verses: [1, 7] },
  { id: '1CO_12_23-27', book: '1CO', chapter: 12, verses: [23, 27] },
  { id: 'REV_21_1-4', book: 'REV', chapter: 21, verses: [1, 4] },
];
