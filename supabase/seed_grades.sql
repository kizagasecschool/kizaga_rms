-- Seed NECTA grade boundaries for O-Level and A-Level
-- O-Level: A=1pt, B=2pt, C=3pt, D=4pt, F=5pt
-- A-Level: A=1pt, B=2pt, C=3pt, D=4pt, E=5pt, S=6pt, F=7pt

DELETE FROM grades;

INSERT INTO grades (min_mark, max_mark, grade, points, remarks, level)
VALUES
  -- O-Level
  (75, 100, 'A', 1, 'Vizuri Sana',  'O_LEVEL'),
  (65,  74, 'B', 2, 'Vizuri',       'O_LEVEL'),
  (45,  64, 'C', 3, 'Wastani',      'O_LEVEL'),
  (30,  44, 'D', 4, 'Mbaya',        'O_LEVEL'),
  ( 0,  29, 'F', 5, 'Mbaya Sana',   'O_LEVEL'),
  -- A-Level
  (80, 100, 'A', 1, 'Bora sana',    'A_LEVEL'),
  (70,  79, 'B', 2, 'Mzuri sana',   'A_LEVEL'),
  (60,  69, 'C', 3, 'Mzuri',        'A_LEVEL'),
  (50,  59, 'D', 4, 'Wastani',      'A_LEVEL'),
  (40,  49, 'E', 5, 'Hafifu',       'A_LEVEL'),
  (35,  39, 'S', 6, 'Dhaifu sana',  'A_LEVEL'),
  ( 0,  34, 'F', 7, 'Amefeli',      'A_LEVEL');

-- Reprocess both exams now that grades exist
SELECT process_exam('e070a156-89cb-441d-824e-792a8586fb45');  -- FORM FIVE MOCK EXAM 2026
SELECT process_exam('2c66818a-8acd-4ea2-8c00-23c37003a1af');  -- Terminal (O-Level Form 1 & 2)
