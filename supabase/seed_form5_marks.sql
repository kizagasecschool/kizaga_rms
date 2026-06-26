-- Seed Form 5 students and marks from FV-CBG.csv (Stream A) and FV-HKL.csv (Stream B)
-- Exam: FORM FIVE MOCK EXAM 2026
-- Run as DB owner (bypasses RLS via supabase db query)

-- Constants (referenced below)
-- exam_id:     e070a156-89cb-441d-824e-792a8586fb45
-- stream_a:    3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5
-- stream_b:    ef110098-f27e-41d6-a40f-c17eecc00b77
-- class_id:    31c3502b-d57e-4db7-b625-3dfe6f35b63c
-- entered_by:  3a41fee2-40c7-4fc1-bc25-1a541cff10e2 (academic role)
-- Subjects (A_LEVEL):
--   CHEM  7d655d5d-8ec4-4e0a-9758-5fe10cd4b2b6  has_practical=true
--   BIOS  fff28737-5f70-4d5f-955d-42797db72114  has_practical=true
--   GEO   0a7b0f5f-ec9d-42f5-ae07-7f0aafd8b190
--   BAM   86167a9a-6edd-4592-a379-506fc9b5109b
--   HTM   255a3634-0326-499a-a236-a2bafda71ac7
--   ACOMM f3342168-fc9e-49a4-9c92-e237b7633529
--   HIST  8e78f6c9-2f31-4539-a1d5-49a83a88ffec
--   KISW  8bdbe2b5-2f90-4d22-b94b-f706d948f486
--   ENG   a2ceed82-0d2e-4357-a1bd-5013351ec5f6

-- ============================================================
-- 1. INSERT STUDENTS — Stream A (FV-CBG.csv)
-- ============================================================
INSERT INTO students (admission_number, first_name, middle_name, surname, gender, date_of_birth, class_id, class_stream_id, status)
VALUES
  ('2026K820','ABIGAELI','NOELI','KITUNDU','Female','2010-05-15','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K821','AGNES','EDWARD','SAMWELI','Female','2010-05-16','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K822','AGNES','ELIA','CHARLES','Female','2010-05-17','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K823','AMINA','JUMA','HALFANI','Female','2010-05-18','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K824','ANASTAZIA','EDGER','KASANGA','Female','2010-05-19','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K825','ANASTAZIA','EDWINE','ERNEST','Female','2010-05-20','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K826','ANET','JEREMIA','MKUMBO','Female','2010-05-21','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K827','ANJELA','FEDRICK','ABDALLAH','Female','2010-05-22','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K828','BAHATI','ATHUMANI','MASUDI','Female','2010-05-23','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K829','BELINDA','JACKSON','IDDI','Female','2010-05-24','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K830','CATHERINE','WILFRED','JOHN','Female','2010-05-25','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K831','DEBORA','BARNABA','SHILA','Female','2010-05-26','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K832','DORKASI','WILFRED','SWALEHE','Female','2010-05-27','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K833','ELILUMBA','JACKSON','MASHAUSI','Female','2010-05-28','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K834','ELILUMBA','SAMWELI','MATULU','Female','2010-05-29','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K835','ELIWINJUKA','JULIUS','MISHONI','Female','2010-05-30','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K836','ELIZABETH','EMANUELI','GIDIONI','Female','2010-05-31','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K837','ELIZABETH','HAMISI','KIULA','Female','2010-06-01','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K838','ELIZABETH','IBRAHIMU','ISSACK','Female','2010-06-02','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K839','ELIZABETH','LEONARD','HARUNA','Female','2010-06-03','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K840','ENERIKA','MAKALA','MAJOGO','Female','2010-06-04','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K841','ADAMU','OMARI','MIRAJI','Male','2010-06-05','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K842','ADINAN','SHABANI','RAMADHANI','Male','2010-06-06','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K843','ALLY','AYUBU','ALLY','Male','2010-06-07','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K844','ALMAS','MWINJUMA','KAJEZE','Male','2010-06-08','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K845','AMOS','BONIPHACE','NDELASIO','Male','2010-06-09','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K846','AMOSI','SHEDRACK','JOHN','Male','2010-06-10','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K847','AMOSI','SIMION','MGELO','Male','2010-06-11','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K848','AMOSI','YOHANA','EMANUELI','Male','2010-06-12','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K849','ANTON','EMANUEL','BRYSON','Male','2010-06-13','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K850','ATHUMANI','RAJABU','MKINGA','Male','2010-06-14','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K851','BARAKA','AMANI','SHABANI','Male','2010-06-15','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K852','CHARLES','EDSON','CHARLES','Male','2010-06-16','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K853','DAUDI','NICODEMO','DAUDI','Male','2010-06-17','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K854','DENIS','METSON','KINGU','Male','2010-06-18','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K855','ELIAS','JOHNSON','MATUGA','Male','2010-06-19','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K856','EMANUEL','BONFACE','BARNABA','Male','2010-06-20','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K857','EMANUEL','STIVINE','YONA','Male','2010-06-21','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K858','EMMANUEL','BENEDIC','MASHAMBA','Male','2010-06-22','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K859','ERICK','ZACHARIA','MDINDI','Male','2010-06-23','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K860','ERNEST','FREDSON','DILLU','Male','2010-06-24','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active'),
  ('2026K861','FADHILI','NAKEMBETWA','ENOCK','Male','2010-06-25','31c3502b-d57e-4db7-b625-3dfe6f35b63c','3a3bc1f2-61b5-47aa-ad6d-4d520da5dcd5','active')
ON CONFLICT (admission_number) DO NOTHING;

-- ============================================================
-- 2. INSERT STUDENTS — Stream B (FV-HKL.csv)
-- ============================================================
INSERT INTO students (admission_number, first_name, middle_name, surname, gender, date_of_birth, class_id, class_stream_id, status)
VALUES
  ('2026K862','ESTA','SAID','HAMISI','Female','2010-05-15','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K863','ESTA','ZAKAYO','MDIDI','Female','2010-05-16','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K864','ESTER','AMANI','PENDAEL','Female','2010-05-17','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K865','ESTER','BARNABA','MARTINI','Female','2010-05-18','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K866','ESTER','ELISHA','CHARLES','Female','2010-05-19','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K867','EVALINE','SAMWEL','YOEL','Female','2010-05-20','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K868','EVALINE','JOSEPH','MANDARA','Female','2010-05-21','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K869','FARAJA','DANIEL','EDSONI','Female','2010-05-22','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K870','FATUMA','JUMA','ATHUMANI','Female','2010-05-23','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K871','GASAWA','MARO','NYAMHANGA','Female','2010-05-24','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K872','GLORIA','ELIKANA','MAKALA','Female','2010-05-25','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K873','GRACE','EMMANUEL','BRYSON','Female','2010-05-26','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K874','HAPINNES','JAMES','AGUSTINO','Female','2010-05-27','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K875','HAPPINESS','ALLY','MAHUJA','Female','2010-05-28','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K876','HEPPINESS','MGISA','MSENGI','Female','2010-05-29','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K877','HERIETH','FREDSON','KITILA','Female','2010-05-30','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K878','IMAN','YOHANA','JOHN','Female','2010-05-31','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K879','IRENE','IBRAHIMU','EDSONI','Female','2010-06-01','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K880','JACKILINE','ROBERTH','SOLOMON','Female','2010-06-02','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K881','JANETH','PAULO','DAWI','Female','2010-06-03','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K882','JASMINI','MAMBO','HAMISI','Female','2010-06-04','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K883','JENIFA','SHIJA','EMANUELY','Female','2010-06-05','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K884','JENIPHER','INOCENT','MTUNDA','Female','2010-06-06','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K885','FAYADHI','MOHAMED','RAMADHANI','Male','2010-06-07','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K886','GODFREY','MAKALA','MLENDA','Male','2010-06-08','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K887','JACKOBO','JAMES','BAHA','Male','2010-06-09','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K888','JACKSON','DAUDI','DAUDI','Male','2010-06-10','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K889','JAFET','EMANUEL','NAKEMBETWA','Male','2010-06-11','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K890','JAMES','ROBERT','MKASI','Male','2010-06-12','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K891','JOHN','AYUBU','YUSTO','Male','2010-06-13','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K892','JOHN','DANIEL','MKUMBO','Male','2010-06-14','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K893','JOHN','MUSA','JOHN','Male','2010-06-15','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K894','JOSEPH','GODFREY','DAUDI','Male','2010-06-16','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K895','JOSEPH','JOHNSON','SHALUA','Male','2010-06-17','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K896','KALEBI','ELIA','KALEBI','Male','2010-06-18','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K897','KASIM','RAMADHANI','SIMA','Male','2010-06-19','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K898','LAMECK','PHABIANO','ANTHONY','Male','2010-06-20','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K899','LEONARD','HAMISI','NKANA','Male','2010-06-21','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K900','MHADU','BRAYTON','MHADU','Male','2010-06-22','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K901','MUSA','YONA','KIPA','Male','2010-06-23','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K902','MUSA','ZAKARIA','MKUMBO','Male','2010-06-24','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K903','MWAGALA','NAKWEMBETWA','ELIA','Male','2010-06-25','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K904','NADRI','HAMISI','NKANA','Male','2010-06-26','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active'),
  ('2026K905','NASHOKIGWA','THOMAS','WAIGINA','Male','2010-06-27','31c3502b-d57e-4db7-b625-3dfe6f35b63c','ef110098-f27e-41d6-a40f-c17eecc00b77','active')
ON CONFLICT (admission_number) DO NOTHING;

-- ============================================================
-- 3. STUDENT_SUBJECTS — Stream A (CHEM, BIOS, GEO, BAM, HTM, A/COMM)
-- ============================================================
INSERT INTO student_subjects (student_id, subject_id)
SELECT s.id, sub.id
FROM students s
CROSS JOIN subjects sub
WHERE s.admission_number BETWEEN '2026K820' AND '2026K861'
  AND sub.subject_code IN ('CHEM','BIOS','GEO','BAM','HTM','A/COMM')
  AND sub.level = 'A_LEVEL'
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. STUDENT_SUBJECTS — Stream B (HIST, KISW, ENG, HTM, A/COMM)
-- ============================================================
INSERT INTO student_subjects (student_id, subject_id)
SELECT s.id, sub.id
FROM students s
CROSS JOIN subjects sub
WHERE s.admission_number BETWEEN '2026K862' AND '2026K905'
  AND sub.subject_code IN ('HIST','KISW','ENG','HTM','A/COMM')
  AND sub.level = 'A_LEVEL'
ON CONFLICT DO NOTHING;

-- ============================================================
-- 5. MARKS — Stream A (FV-CBG.csv)
-- Columns: CHEM, BIOS, GEO, BAM, HTM, A/COMM
-- ============================================================
INSERT INTO marks (student_id, exam_id, subject_id, marks_obtained, practical_marks, is_absent, entered_by)
SELECT s.id,
       'e070a156-89cb-441d-824e-792a8586fb45'::uuid,
       sub.id,
       d.marks,
       0,
       false,
       '3a41fee2-40c7-4fc1-bc25-1a541cff10e2'::uuid
FROM (VALUES
  ('2026K820','CHEM',56), ('2026K820','BIOS',34), ('2026K820','GEO',66),  ('2026K820','BAM',30),  ('2026K820','HTM',85),  ('2026K820','A/COMM',49),
  ('2026K821','CHEM',66), ('2026K821','BIOS',54), ('2026K821','GEO',44),  ('2026K821','BAM',33),  ('2026K821','HTM',82),  ('2026K821','A/COMM',25),
  ('2026K822','CHEM',81), ('2026K822','BIOS',36), ('2026K822','GEO',70),  ('2026K822','BAM',27),  ('2026K822','HTM',81),  ('2026K822','A/COMM',24),
  ('2026K823','CHEM',35), ('2026K823','BIOS',34), ('2026K823','GEO',62),  ('2026K823','BAM',46),  ('2026K823','HTM',53),  ('2026K823','A/COMM',66),
  ('2026K824','CHEM',76), ('2026K824','BIOS',33), ('2026K824','GEO',20),  ('2026K824','BAM',80),  ('2026K824','HTM',45),  ('2026K824','A/COMM',39),
  ('2026K825','CHEM',42), ('2026K825','BIOS',39), ('2026K825','GEO',84),  ('2026K825','BAM',80),  ('2026K825','HTM',43),  ('2026K825','A/COMM',21),
  ('2026K826','CHEM',46), ('2026K826','BIOS',23), ('2026K826','GEO',73),  ('2026K826','BAM',82),  ('2026K826','HTM',82),  ('2026K826','A/COMM',82),
  ('2026K827','CHEM',38), ('2026K827','BIOS',33), ('2026K827','GEO',84),  ('2026K827','BAM',20),  ('2026K827','HTM',21),  ('2026K827','A/COMM',21),
  ('2026K828','CHEM',81), ('2026K828','BIOS',42), ('2026K828','GEO',37),  ('2026K828','BAM',77),  ('2026K828','HTM',72),  ('2026K828','A/COMM',54),
  ('2026K829','CHEM',34), ('2026K829','BIOS',71), ('2026K829','GEO',61),  ('2026K829','BAM',23),  ('2026K829','HTM',57),  ('2026K829','A/COMM',73),
  ('2026K830','CHEM',63), ('2026K830','BIOS',26), ('2026K830','GEO',39),  ('2026K830','BAM',84),  ('2026K830','HTM',34),  ('2026K830','A/COMM',61),
  ('2026K831','CHEM',48), ('2026K831','BIOS',20), ('2026K831','GEO',37),  ('2026K831','BAM',49),  ('2026K831','HTM',83),  ('2026K831','A/COMM',37),
  ('2026K832','CHEM',57), ('2026K832','BIOS',62), ('2026K832','GEO',65),  ('2026K832','BAM',22),  ('2026K832','HTM',28),  ('2026K832','A/COMM',35),
  ('2026K833','CHEM',78), ('2026K833','BIOS',73), ('2026K833','GEO',52),  ('2026K833','BAM',81),  ('2026K833','HTM',32),  ('2026K833','A/COMM',41),
  ('2026K834','CHEM',41), ('2026K834','BIOS',49), ('2026K834','GEO',83),  ('2026K834','BAM',51),  ('2026K834','HTM',55),  ('2026K834','A/COMM',38),
  ('2026K835','CHEM',44), ('2026K835','BIOS',68), ('2026K835','GEO',76),  ('2026K835','BAM',24),  ('2026K835','HTM',55),  ('2026K835','A/COMM',44),
  ('2026K836','CHEM',66), ('2026K836','BIOS',47), ('2026K836','GEO',30),  ('2026K836','BAM',70),  ('2026K836','HTM',65),  ('2026K836','A/COMM',20),
  ('2026K837','CHEM',79), ('2026K837','BIOS',42), ('2026K837','GEO',21),  ('2026K837','BAM',70),  ('2026K837','HTM',68),  ('2026K837','A/COMM',27),
  ('2026K838','CHEM',54), ('2026K838','BIOS',38), ('2026K838','GEO',32),  ('2026K838','BAM',74),  ('2026K838','HTM',82),  ('2026K838','A/COMM',50),
  ('2026K839','CHEM',41), ('2026K839','BIOS',73), ('2026K839','GEO',75),  ('2026K839','BAM',75),  ('2026K839','HTM',38),  ('2026K839','A/COMM',82),
  ('2026K840','CHEM',46), ('2026K840','BIOS',77), ('2026K840','GEO',64),  ('2026K840','BAM',22),  ('2026K840','HTM',39),  ('2026K840','A/COMM',45),
  ('2026K841','CHEM',70), ('2026K841','BIOS',55), ('2026K841','GEO',74),  ('2026K841','BAM',32),  ('2026K841','HTM',57),  ('2026K841','A/COMM',44),
  ('2026K842','CHEM',41), ('2026K842','BIOS',80), ('2026K842','GEO',66),  ('2026K842','BAM',65),  ('2026K842','HTM',40),  ('2026K842','A/COMM',67),
  ('2026K843','CHEM',59), ('2026K843','BIOS',78), ('2026K843','GEO',23),  ('2026K843','BAM',78),  ('2026K843','HTM',34),  ('2026K843','A/COMM',37),
  ('2026K844','CHEM',29), ('2026K844','BIOS',70), ('2026K844','GEO',21),  ('2026K844','BAM',35),  ('2026K844','HTM',78),  ('2026K844','A/COMM',55),
  ('2026K845','CHEM',57), ('2026K845','BIOS',44), ('2026K845','GEO',38),  ('2026K845','BAM',34),  ('2026K845','HTM',53),  ('2026K845','A/COMM',27),
  ('2026K846','CHEM',67), ('2026K846','BIOS',49), ('2026K846','GEO',36),  ('2026K846','BAM',31),  ('2026K846','HTM',49),  ('2026K846','A/COMM',43),
  ('2026K847','CHEM',34), ('2026K847','BIOS',39), ('2026K847','GEO',40),  ('2026K847','BAM',35),  ('2026K847','HTM',27),  ('2026K847','A/COMM',47),
  ('2026K848','CHEM',25), ('2026K848','BIOS',67), ('2026K848','GEO',37),  ('2026K848','BAM',38),  ('2026K848','HTM',43),  ('2026K848','A/COMM',23),
  ('2026K849','CHEM',68), ('2026K849','BIOS',46), ('2026K849','GEO',42),  ('2026K849','BAM',21),  ('2026K849','HTM',67),  ('2026K849','A/COMM',56),
  ('2026K850','CHEM',71), ('2026K850','BIOS',30), ('2026K850','GEO',49),  ('2026K850','BAM',65),  ('2026K850','HTM',33),  ('2026K850','A/COMM',40),
  ('2026K851','CHEM',33), ('2026K851','BIOS',48), ('2026K851','GEO',61),  ('2026K851','BAM',54),  ('2026K851','HTM',64),  ('2026K851','A/COMM',85),
  ('2026K852','CHEM',84), ('2026K852','BIOS',55), ('2026K852','GEO',40),  ('2026K852','BAM',32),  ('2026K852','HTM',50),  ('2026K852','A/COMM',23),
  ('2026K853','CHEM',22), ('2026K853','BIOS',75), ('2026K853','GEO',39),  ('2026K853','BAM',24),  ('2026K853','HTM',55),  ('2026K853','A/COMM',35),
  ('2026K854','CHEM',51), ('2026K854','BIOS',49), ('2026K854','GEO',40),  ('2026K854','BAM',35),  ('2026K854','HTM',42),  ('2026K854','A/COMM',64),
  ('2026K855','CHEM',62), ('2026K855','BIOS',83), ('2026K855','GEO',82),  ('2026K855','BAM',60),  ('2026K855','HTM',45),  ('2026K855','A/COMM',78),
  ('2026K856','CHEM',52), ('2026K856','BIOS',63), ('2026K856','GEO',81),  ('2026K856','BAM',55),  ('2026K856','HTM',46),  ('2026K856','A/COMM',83),
  ('2026K857','CHEM',25), ('2026K857','BIOS',76), ('2026K857','GEO',25),  ('2026K857','BAM',72),  ('2026K857','HTM',52),  ('2026K857','A/COMM',32),
  ('2026K858','CHEM',32), ('2026K858','BIOS',21), ('2026K858','GEO',25),  ('2026K858','BAM',22),  ('2026K858','HTM',40),  ('2026K858','A/COMM',46),
  ('2026K859','CHEM',34), ('2026K859','BIOS',64), ('2026K859','GEO',51),  ('2026K859','BAM',68),  ('2026K859','HTM',40),  ('2026K859','A/COMM',49),
  ('2026K860','CHEM',58), ('2026K860','BIOS',50), ('2026K860','GEO',79),  ('2026K860','BAM',60),  ('2026K860','HTM',39),  ('2026K860','A/COMM',29),
  ('2026K861','CHEM',40), ('2026K861','BIOS',84), ('2026K861','GEO',33),  ('2026K861','BAM',84),  ('2026K861','HTM',33),  ('2026K861','A/COMM',51)
) AS d(adm_no, subject_code, marks)
JOIN students s ON s.admission_number = d.adm_no
JOIN subjects sub ON sub.subject_code = d.subject_code AND sub.level = 'A_LEVEL'
ON CONFLICT (student_id, exam_id, subject_id)
DO UPDATE SET marks_obtained = EXCLUDED.marks_obtained, updated_at = NOW();

-- ============================================================
-- 6. MARKS — Stream B (FV-HKL.csv)
-- Columns: HIST, KISW, ENG, HTM, A/COMM
-- ============================================================
INSERT INTO marks (student_id, exam_id, subject_id, marks_obtained, practical_marks, is_absent, entered_by)
SELECT s.id,
       'e070a156-89cb-441d-824e-792a8586fb45'::uuid,
       sub.id,
       d.marks,
       0,
       false,
       '3a41fee2-40c7-4fc1-bc25-1a541cff10e2'::uuid
FROM (VALUES
  ('2026K862','HIST',91),  ('2026K862','KISW',60),  ('2026K862','ENG',70),  ('2026K862','HTM',72),  ('2026K862','A/COMM',58),
  ('2026K863','HIST',50),  ('2026K863','KISW',52),  ('2026K863','ENG',69),  ('2026K863','HTM',64),  ('2026K863','A/COMM',40),
  ('2026K864','HIST',100), ('2026K864','KISW',78),  ('2026K864','ENG',63),  ('2026K864','HTM',79),  ('2026K864','A/COMM',78),
  ('2026K865','HIST',68),  ('2026K865','KISW',53),  ('2026K865','ENG',63),  ('2026K865','HTM',88),  ('2026K865','A/COMM',58),
  ('2026K866','HIST',71),  ('2026K866','KISW',56),  ('2026K866','ENG',96),  ('2026K866','HTM',85),  ('2026K866','A/COMM',62),
  ('2026K867','HIST',73),  ('2026K867','KISW',78),  ('2026K867','ENG',64),  ('2026K867','HTM',46),  ('2026K867','A/COMM',80),
  ('2026K868','HIST',92),  ('2026K868','KISW',80),  ('2026K868','ENG',99),  ('2026K868','HTM',92),  ('2026K868','A/COMM',41),
  ('2026K869','HIST',85),  ('2026K869','KISW',86),  ('2026K869','ENG',80),  ('2026K869','HTM',82),  ('2026K869','A/COMM',45),
  ('2026K870','HIST',66),  ('2026K870','KISW',84),  ('2026K870','ENG',62),  ('2026K870','HTM',52),  ('2026K870','A/COMM',71),
  ('2026K871','HIST',56),  ('2026K871','KISW',70),  ('2026K871','ENG',72),  ('2026K871','HTM',100), ('2026K871','A/COMM',53),
  ('2026K872','HIST',77),  ('2026K872','KISW',57),  ('2026K872','ENG',68),  ('2026K872','HTM',97),  ('2026K872','A/COMM',98),
  ('2026K873','HIST',93),  ('2026K873','KISW',64),  ('2026K873','ENG',78),  ('2026K873','HTM',47),  ('2026K873','A/COMM',51),
  ('2026K874','HIST',86),  ('2026K874','KISW',66),  ('2026K874','ENG',73),  ('2026K874','HTM',91),  ('2026K874','A/COMM',66),
  ('2026K875','HIST',96),  ('2026K875','KISW',74),  ('2026K875','ENG',61),  ('2026K875','HTM',93),  ('2026K875','A/COMM',76),
  ('2026K876','HIST',53),  ('2026K876','KISW',94),  ('2026K876','ENG',49),  ('2026K876','HTM',53),  ('2026K876','A/COMM',82),
  ('2026K877','HIST',54),  ('2026K877','KISW',63),  ('2026K877','ENG',82),  ('2026K877','HTM',53),  ('2026K877','A/COMM',69),
  ('2026K878','HIST',51),  ('2026K878','KISW',71),  ('2026K878','ENG',60),  ('2026K878','HTM',72),  ('2026K878','A/COMM',68),
  ('2026K879','HIST',86),  ('2026K879','KISW',98),  ('2026K879','ENG',59),  ('2026K879','HTM',74),  ('2026K879','A/COMM',86),
  ('2026K880','HIST',77),  ('2026K880','KISW',98),  ('2026K880','ENG',71),  ('2026K880','HTM',87),  ('2026K880','A/COMM',56),
  ('2026K881','HIST',60),  ('2026K881','KISW',61),  ('2026K881','ENG',93),  ('2026K881','HTM',90),  ('2026K881','A/COMM',70),
  ('2026K882','HIST',95),  ('2026K882','KISW',99),  ('2026K882','ENG',90),  ('2026K882','HTM',56),  ('2026K882','A/COMM',53),
  ('2026K883','HIST',75),  ('2026K883','KISW',94),  ('2026K883','ENG',87),  ('2026K883','HTM',57),  ('2026K883','A/COMM',41),
  ('2026K884','HIST',81),  ('2026K884','KISW',93),  ('2026K884','ENG',69),  ('2026K884','HTM',75),  ('2026K884','A/COMM',98),
  ('2026K885','HIST',52),  ('2026K885','KISW',52),  ('2026K885','ENG',43),  ('2026K885','HTM',91),  ('2026K885','A/COMM',51),
  ('2026K886','HIST',64),  ('2026K886','KISW',77),  ('2026K886','ENG',90),  ('2026K886','HTM',48),  ('2026K886','A/COMM',60),
  ('2026K887','HIST',67),  ('2026K887','KISW',57),  ('2026K887','ENG',97),  ('2026K887','HTM',95),  ('2026K887','A/COMM',45),
  ('2026K888','HIST',43),  ('2026K888','KISW',61),  ('2026K888','ENG',63),  ('2026K888','HTM',92),  ('2026K888','A/COMM',96),
  ('2026K889','HIST',85),  ('2026K889','KISW',67),  ('2026K889','ENG',65),  ('2026K889','HTM',62),  ('2026K889','A/COMM',90),
  ('2026K890','HIST',51),  ('2026K890','KISW',68),  ('2026K890','ENG',43),  ('2026K890','HTM',63),  ('2026K890','A/COMM',46),
  ('2026K891','HIST',93),  ('2026K891','KISW',100), ('2026K891','ENG',82),  ('2026K891','HTM',88),  ('2026K891','A/COMM',97),
  ('2026K892','HIST',94),  ('2026K892','KISW',66),  ('2026K892','ENG',67),  ('2026K892','HTM',82),  ('2026K892','A/COMM',79),
  ('2026K893','HIST',48),  ('2026K893','KISW',72),  ('2026K893','ENG',79),  ('2026K893','HTM',98),  ('2026K893','A/COMM',71),
  ('2026K894','HIST',93),  ('2026K894','KISW',64),  ('2026K894','ENG',75),  ('2026K894','HTM',57),  ('2026K894','A/COMM',74),
  ('2026K895','HIST',81),  ('2026K895','KISW',86),  ('2026K895','ENG',54),  ('2026K895','HTM',44),  ('2026K895','A/COMM',73),
  ('2026K896','HIST',88),  ('2026K896','KISW',99),  ('2026K896','ENG',92),  ('2026K896','HTM',86),  ('2026K896','A/COMM',67),
  ('2026K897','HIST',85),  ('2026K897','KISW',100), ('2026K897','ENG',74),  ('2026K897','HTM',67),  ('2026K897','A/COMM',64),
  ('2026K898','HIST',89),  ('2026K898','KISW',80),  ('2026K898','ENG',58),  ('2026K898','HTM',51),  ('2026K898','A/COMM',77),
  ('2026K899','HIST',79),  ('2026K899','KISW',42),  ('2026K899','ENG',44),  ('2026K899','HTM',68),  ('2026K899','A/COMM',51),
  ('2026K900','HIST',57),  ('2026K900','KISW',80),  ('2026K900','ENG',43),  ('2026K900','HTM',79),  ('2026K900','A/COMM',45),
  ('2026K901','HIST',60),  ('2026K901','KISW',91),  ('2026K901','ENG',49),  ('2026K901','HTM',97),  ('2026K901','A/COMM',67),
  ('2026K902','HIST',43),  ('2026K902','KISW',65),  ('2026K902','ENG',92),  ('2026K902','HTM',41),  ('2026K902','A/COMM',50),
  ('2026K903','HIST',54),  ('2026K903','KISW',65),  ('2026K903','ENG',97),  ('2026K903','HTM',54),  ('2026K903','A/COMM',70),
  ('2026K904','HIST',58),  ('2026K904','KISW',89),  ('2026K904','ENG',94),  ('2026K904','HTM',71),  ('2026K904','A/COMM',86),
  ('2026K905','HIST',60),  ('2026K905','KISW',97),  ('2026K905','ENG',70),  ('2026K905','HTM',76),  ('2026K905','A/COMM',82)
) AS d(adm_no, subject_code, marks)
JOIN students s ON s.admission_number = d.adm_no
JOIN subjects sub ON sub.subject_code = d.subject_code AND sub.level = 'A_LEVEL'
ON CONFLICT (student_id, exam_id, subject_id)
DO UPDATE SET marks_obtained = EXCLUDED.marks_obtained, updated_at = NOW();

-- ============================================================
-- 7. PROCESS EXAM — recalculate grades, divisions, rankings
-- ============================================================
SELECT process_exam('e070a156-89cb-441d-824e-792a8586fb45');
