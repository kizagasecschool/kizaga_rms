import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { sortSubjectsByNectaCode } from '../../lib/subjectUtils'
import domtoimage from 'dom-to-image-more'
import jsPDF from 'jspdf'

const SCIENCE_SUBJECTS = ['BIO', 'CHEM', 'PHY', 'BIOS', 'BIO_O', 'CHEM_O', 'PHY_O']

function groupExamsByType(examList) {
  const groups = {}
  examList.forEach(exam => {
    const type = exam.exam_type || 'OTHER'
    if (!groups[type]) groups[type] = []
    groups[type].push(exam)
  })
  return Object.entries(groups)
}

function subjectHasPractical(subject, exam) {
  if (!exam?.has_practical) return false
  return subject?.has_practical || SCIENCE_SUBJECTS.includes(subject?.subject_code)
}

function calcDivision(totalPoints, level) {
  if (totalPoints <= 0) return '0'
  if (level === 'A_LEVEL') {
    if (totalPoints >= 3 && totalPoints <= 9) return 'I'
    if (totalPoints >= 10 && totalPoints <= 12) return 'II'
    if (totalPoints >= 13 && totalPoints <= 17) return 'III'
    if (totalPoints >= 18 && totalPoints <= 19) return 'IV'
    return '0'
  }
  if (totalPoints >= 7 && totalPoints <= 17) return 'I'
  if (totalPoints >= 18 && totalPoints <= 21) return 'II'
  if (totalPoints >= 22 && totalPoints <= 25) return 'III'
  if (totalPoints >= 26 && totalPoints <= 33) return 'IV'
  return '0'
}

function getGradeForPercentage(pct, grades) {
  if (pct === null || pct === undefined) return null
  for (const g of grades) {
    if (pct >= g.min_mark) return g
  }
  return grades[grades.length - 1] || null
}

function getMarkTotal(mark, hp) {
  if (!mark || mark.is_absent) return { theory: null, practical: null, total: null }
  const theory = mark.marks_obtained ?? 0
  const practical = hp ? (mark.practical_marks ?? 0) : 0
  return { theory, practical, total: theory + practical }
}

function computeCombinedMark(mark, hp) {
  const t = getMarkTotal(mark, hp)
  const max = hp ? 150 : 100
  const pct = t.total != null ? (t.total / max) * 100 : null
  return { ...t, max, pct }
}

function injectHexColors(doc) {
  const s = doc.createElement('style')
  s.textContent = `
    :root {
      --color-gray-50: #f9fafb; --color-gray-100: #f3f4f6;
      --color-gray-200: #e5e7eb; --color-gray-300: #d1d5db;
      --color-gray-400: #9ca3af; --color-gray-500: #6b7280;
      --color-gray-600: #4b5563; --color-gray-700: #374151;
      --color-gray-800: #1f2937; --color-gray-900: #111827;
      --color-green-50: #f0fdf4; --color-green-100: #dcfce7;
      --color-green-200: #bbf7d0; --color-green-300: #86efac;
      --color-green-400: #4ade80; --color-green-500: #22c55e;
      --color-green-600: #16a34a; --color-green-700: #15803d;
      --color-green-800: #166534; --color-green-900: #14532d;
      --color-blue-50: #eff6ff; --color-blue-100: #dbeafe;
      --color-blue-200: #bfdbfe; --color-blue-300: #93c5fd;
      --color-blue-400: #60a5fa; --color-blue-500: #3b82f6;
      --color-blue-600: #2563eb; --color-blue-700: #1d4ed8;
      --color-blue-800: #1e40af; --color-blue-900: #1e3a8a;
      --color-red-50: #fef2f2; --color-red-100: #fee2e2;
      --color-red-200: #fecaca; --color-red-300: #fca5a5;
      --color-red-400: #f87171; --color-red-500: #ef4444;
      --color-red-600: #dc2626; --color-red-700: #b91c1c;
      --color-red-800: #991b1b; --color-red-900: #7f1d1d;
      --color-amber-50: #fffbeb; --color-amber-100: #fef3c7;
      --color-amber-200: #fde68a; --color-amber-300: #fcd34d;
      --color-amber-400: #fbbf24; --color-amber-500: #f59e0b;
      --color-amber-600: #d97706; --color-amber-700: #b45309;
      --color-amber-800: #92400e; --color-amber-900: #78350f;
      --color-indigo-50: #eef2ff; --color-indigo-100: #e0e7ff;
      --color-indigo-200: #c7d2fe; --color-indigo-300: #a5b4fc;
      --color-indigo-400: #818cf8; --color-indigo-500: #6366f1;
      --color-indigo-600: #4f46e5; --color-indigo-700: #4338ca;
      --color-indigo-800: #3730a3; --color-indigo-900: #312e81;
      --color-purple-50: #faf5ff; --color-purple-100: #f3e8ff;
      --color-purple-200: #e9d5ff; --color-purple-300: #d8b4fe;
      --color-purple-400: #c084fc; --color-purple-500: #a855f7;
      --color-purple-600: #9333ea; --color-purple-700: #7e22ce;
      --color-purple-800: #6b21a8; --color-purple-900: #581c87;
      --color-emerald-50: #ecfdf5; --color-emerald-100: #d1fae5;
      --color-emerald-200: #a7f3d0; --color-emerald-300: #6ee7b7;
      --color-emerald-400: #34d399; --color-emerald-500: #10b981;
      --color-emerald-600: #059669; --color-emerald-700: #047857;
      --color-emerald-800: #065f46; --color-emerald-900: #064e3b;
      --color-maroon-50: #fdf2f3; --color-maroon-100: #fde8e9;
      --color-maroon-200: #fbd0d4; --color-maroon-300: #f7a9b0;
      --color-maroon-400: #f27a86; --color-maroon-500: #e84c5c;
      --color-maroon-600: #b91c3b; --color-maroon-700: #99152e;
      --color-maroon-800: #7a1224; --color-maroon-900: #3f0d12;
    }
  `
  doc.head.appendChild(s)
}

function stripUIElements(doc) {
  const selectors = [
    'aside', 'header', 'nav', 'footer',
    '.no-print', '[class*="sidebar"]', '[class*="topbar"]',
    '[class*="navbar"]', '[class*="profile-dropdown"]',
    '[class*="notif"]',
  ]
  selectors.forEach(sel => {
    try {
      const els = doc.querySelectorAll(sel)
      els.forEach(el => { if (el) el.style.display = 'none' })
    } catch {
      // selector may not match, skip
    }
  })
  const root = doc.documentElement
  if (root) {
    root.style.overflow = 'hidden'
    root.style.height = 'auto'
  }
  const body = doc.body
  if (body) {
    body.style.overflow = 'hidden'
    body.style.height = 'auto'
  }
  const style = doc.createElement('style')
  style.textContent = '::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }'
  doc.head.appendChild(style)
}

async function captureElementWithRetry(element, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await domtoimage.toCanvas(element, {
        scale: 2,
        bgcolor: '#ffffff',
        style: {
          overflow: 'visible',
          height: 'auto',
          width: element.scrollWidth + 'px',
        },
        onclone: (node) => {
          const doc = node.ownerDocument
          injectHexColors(doc)
          const imgs = doc.querySelectorAll('img')
          imgs.forEach(img => { img.crossOrigin = 'anonymous' })
          stripUIElements(doc)
        },
      })
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 300))
      } else {
        throw err
      }
    }
  }
}

function addImageToPDF(pdf, imgData, margin, usableWidth, scaledHeight) {
  const pdfHeight = pdf.internal.pageSize.getHeight()
  const usableHeight = pdfHeight - margin * 2
  let heightLeft = scaledHeight
  let position = margin
  pdf.addImage(imgData, 'JPEG', margin, position, usableWidth, scaledHeight)
  heightLeft -= usableHeight
  while (heightLeft > 1) {
    position = margin - (scaledHeight - heightLeft)
    pdf.addPage()
    pdf.addImage(imgData, 'JPEG', margin, position, usableWidth, scaledHeight)
    heightLeft -= usableHeight
  }
}

async function generatePDF(element, filename, orientation = 'p') {
  const canvas = await captureElementWithRetry(element)
  const imgData = canvas.toDataURL('image/jpeg', 0.95)
  const pdf = new jsPDF(orientation, 'mm', 'a4')
  const pdfWidth = pdf.internal.pageSize.getWidth()
  const margin = 8
  const usableWidth = pdfWidth - margin * 2
  const canvasWidth = canvas.width
  const canvasHeight = canvas.height
  const ratio = usableWidth / canvasWidth
  const scaledHeight = canvasHeight * ratio
  addImageToPDF(pdf, imgData, margin, usableWidth, scaledHeight)
  pdf.save(`${filename}.pdf`)
}

const printStyles = `
  .print-all-students { display: none; }
  @media print {
    @page { margin: 10mm 6mm 14mm; size: A4 portrait; }
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      overflow: visible !important;
      height: auto !important;
    }
    html, body, #root, .h-screen, .flex, .flex-1, .flex-col {
      overflow: visible !important;
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
      width: 100% !important;
    }
    html::-webkit-scrollbar,
    body::-webkit-scrollbar,
    #root::-webkit-scrollbar {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
    }
    .no-print { display: none !important; }
    .print-only { display: block !important; }
    .print-area { display: none !important; }
    .print-all-students { display: block !important; }
    aside, header, footer, nav {
      display: none !important;
    }
    .print-all-students > div { page-break-after: always; }
  }
`

function ReportCard({ student, ctx }) {
  const s = student
  const {
    mode, studentResults, subjects, markMap, selectedExam, selectedExam2,
    grades, classes, selectedClassId, schoolInfo, reportHeading, examLabel1, examLabel2,
    subjectRanks, teacherSubjects, parentGreeting, closingMessage,
    schoolClosingDate, schoolOpeningDate, classTeacherComment, headTeacherComment,
    students, computeCombinedData
  } = ctx

  const sr = mode === 'single' ? studentResults.find(r => r.student_id === s.id) || null : null

  let totalPtsSingle = 0
  let divisionSingle = '0'
  if (mode === 'single') {
    const pts = []
    const classLevel = classes.find(c => c.id === selectedClassId)?.level || 'O_LEVEL'
    subjects.forEach(subject => {
      if (classLevel === 'A_LEVEL' && subject.subject_type === 'ELECTIVE') return
      const mark = markMap[`${s.id}_${subject.id}`]
      const hp = subjectHasPractical(subject, selectedExam)
      const total = ((mark?.marks_obtained ?? 0) + (hp ? (mark?.practical_marks ?? 0) : 0))
      const max = hp ? 150 : 100
      const pct = mark && !mark.is_absent ? (total / max) * 100 : null
      const g = getGradeForPercentage(pct, grades)
      if (g && g.points > 0) pts.push(g.points)
    })
    pts.sort((a, b) => a - b)
    const bestN = classLevel === 'A_LEVEL' ? 3 : 7
    const bestPoints = pts.slice(0, bestN)
    totalPtsSingle = bestPoints.reduce((s, p) => s + p, 0)
    // Prefer division stored in DB after exam processing; fall back to frontend calc
    divisionSingle = (sr?.division || calcDivision(totalPtsSingle, classLevel)).replace('Division ', '')
  }

  const cData = mode === 'combined' ? computeCombinedData(s) : null

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px', lineHeight: '1.35', color: '#000', pageBreakAfter: 'always', background: '#fff', padding: '18px 25px', overflow: 'hidden' }}>
      {/* HEADER: Logos + User Heading */}
      <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '6px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ width: '130px', display: 'flex', justifyContent: 'flex-start' }}>
            {schoolInfo?.national_logo_url && (
              <img src={schoolInfo.national_logo_url} alt="" style={{ width: '110px', height: '110px', objectFit: 'contain' }} crossOrigin="anonymous" />
            )}
          </div>
          <div style={{ flex: 1, textAlign: 'center', fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase', whiteSpace: 'pre-line', lineHeight: '1.2' }}>
            {reportHeading || (mode === 'combined' ? 'RIPOTI MCHANGANYIKO' : 'RIPOTI YA MWANAFUNZI')}
          </div>
          <div style={{ width: '130px', display: 'flex', justifyContent: 'flex-end' }}>
            {schoolInfo?.logo_url && (
              <img src={schoolInfo.logo_url} alt="" style={{ width: '110px', height: '110px', objectFit: 'contain' }} crossOrigin="anonymous" />
            )}
          </div>
        </div>
        {mode === 'combined' && (
          <div style={{ fontSize: '11px', marginTop: '4px' }}>{(examLabel1 || selectedExam?.name)} + {(examLabel2 || selectedExam2?.name)}</div>
        )}
      </div>

      {/* STUDENT NAME */}
      <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '4px', whiteSpace: 'pre-line' }}>
        JINA LA MWANAFUNZI: {s.first_name} {s.middle_name || ''} {s.surname}
      </div>

      {/* TABLE 1: Subject Results */}
      <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '6px', marginTop: '0' }}>MATOKEO YA MASOMO</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '11px', marginBottom: '6px' }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'left', width: '4%' }}>#</th>
            <th style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'left' }}>Somo</th>
            {mode === 'combined' ? (
              <>
                <th style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center', width: '10%' }}>{(examLabel1 || selectedExam?.name || 'Mth. 1')}</th>
                <th style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center', width: '10%' }}>{(examLabel2 || selectedExam2?.name || 'Mth. 2')}</th>
              </>
            ) : selectedExam?.has_practical ? (
              <>
                <th style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center', width: '10%' }}>{examLabel1 || 'Nadharia'}</th>
                <th style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center', width: '10%' }}>{examLabel2 || 'Vitendo'}</th>
              </>
            ) : (
              <th style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center', width: '10%' }}>{examLabel1 || 'Alama'}</th>
            )}
            <th style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center', width: '8%' }}>Wastani</th>
            <th style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center', width: '7%' }}>Daraja</th>
            <th style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center', width: '6%' }}>Nafasi</th>
            <th style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center', width: '18%' }}>Sahihi ya Mwalimu</th>
          </tr>
        </thead>
        <tbody>
          {mode === 'single' && subjects.map((subject, idx) => {
            const mark = markMap[`${s.id}_${subject.id}`]
            const hp = subjectHasPractical(subject, selectedExam)
            const theoryMark = mark?.marks_obtained ?? null
            const practicalMark = hp ? (mark?.practical_marks ?? null) : null
            const total = (theoryMark || 0) + (practicalMark || 0)
            const max = hp ? 150 : 100
            const pct = mark && !mark.is_absent ? (total / max) * 100 : null
            const gradeObj = getGradeForPercentage(pct, grades)
            const isAbsent = mark?.is_absent

            return (
              <tr key={subject.id}>
                <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'center' }}>{idx + 1}</td>
                <td style={{ border: '1px solid #000', padding: '1px 3px' }}>{subject.subject_name}</td>
                {selectedExam?.has_practical ? (
                  <>
                    <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'center' }}>
                      {isAbsent ? '-' : theoryMark != null ? theoryMark : '-'}
                    </td>
                    <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'center' }}>
                      {isAbsent ? '-' : practicalMark != null ? practicalMark : '-'}
                    </td>
                  </>
                ) : (
                  <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'center' }}>
                    {isAbsent ? '-' : theoryMark != null ? theoryMark : '-'}
                  </td>
                )}
                <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'center' }}>
                  {isAbsent ? '-' : pct != null ? `${pct.toFixed(0)}` : '-'}
                </td>
                <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'center', fontWeight: 'bold' }}>
                  {isAbsent ? '-' : gradeObj?.grade || '-'}
                </td>
                <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'center' }}>
                  {isAbsent ? '-' : subjectRanks[`${s.id}_${subject.id}`] || '-'}
                </td>
                <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {teacherSubjects[subject.id] || ''}
                </td>
              </tr>
            )
          })}
          {mode === 'combined' && cData?.entries.map((entry, idx) => (
            <tr key={entry.subject.id}>
              <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'center' }}>{idx + 1}</td>
              <td style={{ border: '1px solid #000', padding: '1px 3px' }}>{entry.subject.subject_name}</td>
              <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'center' }}>
                {entry.isAbsent1 ? '-' : entry.exam1Total != null ? entry.exam1Total : '-'}
              </td>
              <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'center' }}>
                {entry.isAbsent2 ? '-' : entry.exam2Total != null ? entry.exam2Total : '-'}
              </td>
              <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'center' }}>
                {entry.combinedPct != null ? `${entry.combinedPct.toFixed(0)}` : '-'}
              </td>
              <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'center', fontWeight: 'bold' }}>
                {entry.gradeObj?.grade || '-'}
              </td>
              <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'center' }}>
                {entry.isAbsent1 && entry.isAbsent2 ? '-' : subjectRanks[`${s.id}_${entry.subject.id}`] || '-'}
              </td>
              <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                {teacherSubjects[entry.subject.id] || ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* TABLE 2: Character Assessment */}
      <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '6px', marginTop: '0' }}>TATHMINI YA MWENENDO WA MWANAFUNZI</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '11px', marginBottom: '6px' }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            {['Tabia', 'Uwajibikaji', 'Ubunifu', 'Kujiamini', 'Usafi', 'Ushirikiano', 'Michezo'].map(h => (
              <th key={h} style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {[1, 2, 3, 4, 5, 6, 7].map(i => (
              <td key={i} style={{ border: '1px solid #000', padding: '8px 4px', textAlign: 'center' }}></td>
            ))}
          </tr>
        </tbody>
      </table>

      {/* TABLE 3: Grade Boundary */}
      <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '6px', marginTop: '0' }}>VIWANGO VYA DARAJA</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '11px', marginBottom: '6px' }}>
        <tbody>
          <tr>
            <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'left' }}>
              {grades.slice().reverse().map((g, idx) => (
                <span key={idx}>{idx > 0 && '    '}<strong>{g.grade}</strong> ({g.min_mark}-{g.max_mark}%, {g.points != null ? g.points : '-'}, {g.remarks || '-'})</span>
              ))}
            </td>
          </tr>
        </tbody>
      </table>

      {/* SUMMARY */}
      <p style={{ fontSize: '12px', marginBottom: '8px', fontWeight: 'bold', fontStyle: 'italic' }}>
        {s.first_name} amekuwa namba <strong>{mode === 'single' ? (sr?.position || '-') : '-'}</strong> kati ya wanafunzi <strong>{students.length}</strong>.
        Amepata wastani wa <strong>{mode === 'single' ? (sr?.average_marks != null ? `${sr.average_marks.toFixed(1)}%` : '-') : (cData?.avgPct != null ? `${cData.avgPct.toFixed(1)}%` : '-')}</strong>,
        daraja <strong>{mode === 'single' ? (sr?.grade || getGradeForPercentage(sr?.average_marks, grades)?.grade || '-') : (cData?.gradeObj?.grade || '-')}</strong>,
        division <strong>{mode === 'single' ? (divisionSingle || '-') : (cData?.division || '-')}</strong>{' '}
        ya pointi <strong>{mode === 'single' ? (totalPtsSingle > 0 ? totalPtsSingle : '-') : (cData?.pts != null ? cData.pts : '-')}</strong>.
      </p>

      {/* AUTO COMMENTS BASED ON GRADE */}
      {(() => {
        const avg = mode === 'single' ? (sr?.average_marks ?? null) : (cData?.avgPct ?? null)
        const g = mode === 'single' ? (sr?.grade || getGradeForPercentage(sr?.average_marks, grades)?.grade || '') : (cData?.gradeObj?.grade || '')

        let autoClass = 'Endelea kujitahidi katika masomo yako.'
        let autoHead = 'Nawahimiza wazazi kuendelea kushirikiana na shule kwa ajili ya maendeleo ya mtoto wenu.'

        if (g === 'A') {
          autoClass = 'Hongera kwa ufaulu huu wa hali ya juu. Umeonyesha nidhamu ya kipekee na bidii ya kweli katika masomo yako. Endelea kudumisha kiwango hiki cha ubora na uwe mfano wa kuigwa kwa wenzako.'
          autoHead = 'Napenda kuwapongeza sana kwa juhudi mlizozifanya kumfunza mtoto wenu. Mwanafunzi huyu ameonyesha uwezo wa kipekee na anastahili pongezi za dhati. Msaidieni kuendelea na kiwango hiki cha juu cha ufaulu.'
        } else if (g === 'B') {
          autoClass = 'Umefanya vizuri sana na unaonyesha maendeleo ya kuridhisha. Ukizidi kuongeza bidii na kujishughulisha zaidi na masomo yako, unaweza kufikia daraja la A. Endelea kuwa makini na kujitahidi bila kupumzika.'
          autoHead = 'Matokeo ya mtoto wenu yanaonyesha juhudi na uwezo wa kustahili pongezi. Nawahimiza mzidishe ushirikiano na walimu wa shule na kumhimiza mtoto wenu kusoma kwa bidii zaidi ili apige hatua kubwa zaidi katika ufaulu wake.'
        } else if (g === 'C') {
          autoClass = 'Umefanya wastani katika mtihani huu na kuna nafasi kubwa ya kuboresha matokeo yako. Tafadhali zingatia zaidi masomo yako, fanya mazoezi ya kutosha na usisite kuuliza maswali pale unapokosa kuelewa. Uwezo wako ni mkubwa zaidi ya hili.'
          autoHead = 'Matokeo ya mtoto wenu yanaweza kuboreshwa zaidi kwa juhudi na ushirikiano. Nashauri mzazi au mlezi kushirikiana nasi kwa karibu, kuhakikisha mtoto wenu anafanya mazoezi ya kutosha nyumbani na kuhudhuria masomo yote kwa wakati na makini.'
        } else if (g === 'D') {
          autoClass = 'Unahitaji juhudi kubwa zaidi katika masomo yako. Tafadhali zingatia mada ambazo una ugumu nazo, hudhuria masomo yote bila kukosa na ushirikiane na walimu wako ili kupata msaada unaohitajika. Bado una nafasi nzuri ya kuboresha ufaulu wako.'
          autoHead = 'Matokeo ya mtoto wenu yanahitaji kuzingatiwa kwa makini zaidi na pande zote mbili. Nashauri mkutane na walimu wake hivi karibuni ili kupanga mkakati wa pamoja wa kumsaidia kuboresha utendaji wake wa kitaaluma. Msaada wenu wa nyumbani ni nguzo muhimu sana.'
        } else if (g === 'E') {
          autoClass = 'Umepita lakini kwa kiwango cha chini. Unahitaji kuongeza juhudi za ziada, kufanya mapitio ya kina ya masomo na kutumia vizuri muda wako wa kujisomea. Ninakuamini una uwezo wa kufanya vizuri zaidi — jitahidi kupiga hatua kubwa zaidi.'
          autoHead = 'Mtoto wenu amepita lakini kwa kiwango cha chini cha ufaulu. Ninawahimiza sana kushirikiana nasi kwa karibu zaidi ili kumwezesha kuboresha ufaulu wake. Ushirikiano wenu na mwelekeo mzuri wa nyumbani ni nguzo muhimu sana wakati huu.'
        } else if (g === 'S') {
          autoClass = 'Unahitaji kurekebisha mkakati wako wa masomo kwa haraka na kwa makini. Tumia kila fursa unayopata kufanya mazoezi, elewa mada vizuri zaidi na usiache muda kupita bila kufanya kitu. Ninatarajia uonyeshe mabadiliko ya dhahiri katika kipindi kinachokuja.'
          autoHead = 'Matokeo ya mtoto wenu yanalazimu uangalizi wa karibu na wa haraka. Nashauri mzazi au mlezi azungumze na walimu wa shule mara moja ili tuweze pamoja kupanga njia bora za kumsaidia mtoto wenu kupiga hatua muhimu za kimasomo.'
        } else if (g === 'F') {
          autoClass = 'Haujafaulu katika mtihani huu na hii ni ishara ya dharura inayohitaji hatua za haraka. Tafadhali ongea na mwalimu wako ili kupata msaada maalum, panga ratiba nzuri ya masomo na uambie wazazi wako ili wakusaidie. Usikate tamaa — mabadiliko ya kweli yanaweza kutokea ukijitahidi kwa dhati.'
          autoHead = 'Matokeo ya mtoto wenu yanahitaji umakini wa haraka kutoka kwa pande zote. Ninawahimiza sana kuwasiliana nasi mara moja ili tuweze pamoja kuelewa changamoto anazopitia na kumwandalia mpango maalum wa msaada. Ushirikiano wenu ni muhimu zaidi kuliko wakati wowote sasa hivi.'
        }

        return (
          <div style={{ fontSize: '12px', marginBottom: '8px' }}>
            <p style={{ margin: '2px 0' }}>
              <strong>Maoni ya Mwalimu wa Darasa:</strong> {classTeacherComment || (avg != null ? autoClass : '________________________________________')}
            </p>
            <p style={{ margin: '2px 0' }}>
              <strong>Maoni ya Mkuu wa Shule:</strong> {headTeacherComment || (avg != null ? autoHead : '________________________________________')}
            </p>
          </div>
        )
      })()}

      {/* CLOSING MESSAGE */}
      <p style={{ fontSize: '12px', fontStyle: 'italic', marginBottom: '4px' }}>
        {closingMessage || 'Asante kwa ushirikiano wenu katika kuhakikisha maendeleo ya mtoto wenu. Mungu awabariki.'}
      </p>
      <p style={{ fontSize: '12px', marginBottom: '8px' }}>
        <strong>Tarehe ya Kufunga:</strong> {schoolClosingDate ? new Date(schoolClosingDate).toLocaleDateString('en-TZ') : '________'} &nbsp;|&nbsp;
        <strong>Tarehe ya Kufungua:</strong> {schoolOpeningDate ? new Date(schoolOpeningDate).toLocaleDateString('en-TZ') : '________'}
      </p>

      {/* SIGNATURES */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '12px' }}>
        <div style={{ textAlign: 'center', width: '30%' }}>
          <div style={{ height: '28px' }}></div>
          <div style={{ borderTop: '1px solid #000', paddingTop: '2px' }}>
            <div style={{ fontWeight: 'bold' }}>Mkuu wa Shule</div>
            <div style={{ fontSize: '8px', color: '#555' }}>Sahihi na Tarehe</div>
          </div>
        </div>
        <div style={{ textAlign: 'center', width: '30%' }}>
          <div style={{ height: '40px' }}></div>
          <div style={{ borderTop: '1px solid #000', paddingTop: '2px' }}>
            <div style={{ fontWeight: 'bold' }}>Ofisi ya Taaluma</div>
            <div style={{ fontSize: '8px', color: '#555' }}>Sahihi na Tarehe</div>
          </div>
        </div>
        <div style={{ textAlign: 'center', width: '30%' }}>
          <div style={{ height: '40px' }}></div>
          <div style={{ borderTop: '1px solid #000', paddingTop: '2px' }}>
            <div style={{ fontWeight: 'bold' }}>Mhuri wa Shule</div>
            <div style={{ fontSize: '8px', color: '#555' }}>Mhuri</div>
          </div>
        </div>
      </div>

      {/* PARENT SECTION */}
      <div style={{ border: '2px solid #000', padding: '8px', marginTop: '6px' }}>
        <h4 style={{ fontSize: '12px', fontWeight: 'bold', textAlign: 'center', margin: '0 0 4px 0' }}>
          SEHEMU YA MZAZI / MLEZI
        </h4>
        <p style={{ fontSize: '12px', marginBottom: '6px' }}>
          Tafadhali jaza sehemu hii, kisha kata na kurudisha shuleni.
        </p>
        <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
          <div style={{ display: 'flex', margin: '2px 0' }}>
            <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Maoni:&nbsp;</span>
            <span style={{ flex: 1, borderBottom: '1px solid #000', height: '1.2em' }}>&nbsp;</span>
          </div>
          <div style={{ display: 'flex', margin: '2px 0' }}>
            <span style={{ width: '50px' }}>&nbsp;</span>
            <span style={{ flex: 1, borderBottom: '1px solid #000', height: '1.2em' }}>&nbsp;</span>
          </div>
          <div style={{ display: 'flex', margin: '2px 0' }}>
            <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap', width: '55px' }}>Sahihi:&nbsp;</span>
            <span style={{ flex: 1, borderBottom: '1px solid #000', height: '1.2em' }}>&nbsp;</span>
            <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap', marginLeft: '12px', width: '40px' }}>Jina:&nbsp;</span>
            <span style={{ flex: 1, borderBottom: '1px solid #000', height: '1.2em' }}>&nbsp;</span>
          </div>
          <div style={{ display: 'flex', margin: '2px 0' }}>
            <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap', width: '55px' }}>Uhusiano:&nbsp;</span>
            <span style={{ flex: 1, borderBottom: '1px solid #000', height: '1.2em' }}>&nbsp;</span>
            <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap', marginLeft: '12px', width: '40px' }}>Tarehe:&nbsp;</span>
            <span style={{ flex: 1, borderBottom: '1px solid #000', height: '1.2em' }}>&nbsp;</span>
          </div>
        </div>

      </div>
    </div>
  )
}

function StudentReports() {
  const reportRef = useRef(null)
  const bulkContainerRef = useRef(null)

  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [generatingBulkPDF, setGeneratingBulkPDF] = useState(false)

  const [mode, setMode] = useState('single')

  const [exams, setExams] = useState([])
  const [selectedExamId, setSelectedExamId] = useState('')
  const [selectedExam, setSelectedExam] = useState(null)
  const [selectedExam2Id, setSelectedExam2Id] = useState('')
  const [selectedExam2, setSelectedExam2] = useState(null)

  const [academicYears, setAcademicYears] = useState([])
  const [selectedYearId, setSelectedYearId] = useState('')
  const [selectedYear2Id, setSelectedYear2Id] = useState('')

  const [examClasses, setExamClasses] = useState([])
  const [classes, setClasses] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')

  const [subjects, setSubjects] = useState([])
  const [students, setStudents] = useState([])
  const [marks, setMarks] = useState([])
  const [marks2, setMarks2] = useState([])
  const [studentResults, setStudentResults] = useState([])
  const [grades, setGrades] = useState([])
  const [schoolInfo, setSchoolInfo] = useState(null)

  const [selectedStudent, setSelectedStudent] = useState(null)
  const [bulkStudents, setBulkStudents] = useState([])
  const [activeTab, setActiveTab] = useState('list')

  const [reportHeading, setReportHeading] = useState('')
  const [localHeading, setLocalHeading] = useState('')
  const headingDebounceRef = useRef(null)
  const [schoolClosingDate, setSchoolClosingDate] = useState('')
  const [schoolOpeningDate, setSchoolOpeningDate] = useState('')
  const [parentGreeting, setParentGreeting] = useState('')
  const [closingMessage, setClosingMessage] = useState('')
  const [classTeacherComment, setClassTeacherComment] = useState('')
  const [headTeacherComment, setHeadTeacherComment] = useState('')

  const [examLabel1, setExamLabel1] = useState('')
  const [examLabel2, setExamLabel2] = useState('')
  const [teacherSubjects, setTeacherSubjects] = useState([])
  const [subjectRanks, setSubjectRanks] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [initError, setInitError] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setInitError(null)
      try {
        // Paginate exam_classes — it can grow to exams × classes rows
        const fetchExamClassesPaged = async () => {
          const PAGE = 1000; let from = 0; const all = []
          while (true) {
            const { data } = await supabase.from('exam_classes').select('*').range(from, from + PAGE - 1)
            if (!data || !data.length) break
            all.push(...data)
            if (data.length < PAGE) break
            from += PAGE
          }
          return all
        }
        const [eRes, cRes, schRes, yRes, ecAll] = await Promise.all([
          supabase.from('exams').select('*').order('created_at', { ascending: false }).limit(500),
          supabase.from('classes').select('*').order('sort_order').limit(50),
          supabase.from('school_settings').select('*').limit(1),
          supabase.from('academic_years').select('*').order('year_name', { ascending: false }).limit(20),
          fetchExamClassesPaged(),
        ])
        if (eRes.data) setExams(eRes.data)
        if (cRes.data) setClasses(cRes.data)
        setExamClasses(ecAll)
        if (schRes.data && schRes.data.length > 0) setSchoolInfo(schRes.data[0])
        if (yRes.data) setAcademicYears(yRes.data)
      } catch (err) {
        console.error('Init load error:', err)
        setInitError('Imeshindwa kupakia data. Tafadhali angalia mtandao wako na ujaribu tena.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedExamId) { setSelectedExam(null); return }
    setSelectedExam(exams.find(e => e.id === selectedExamId) || null)
  }, [selectedExamId, exams])

  useEffect(() => {
    if (!selectedExam2Id) { setSelectedExam2(null); return }
    setSelectedExam2(exams.find(e => e.id === selectedExam2Id) || null)
  }, [selectedExam2Id, exams])

  const resetSelections = useCallback(() => {
    setSelectedClassId('')
    setSelectedStudent(null)
    setStudents([])
    setMarks([])
    setMarks2([])
    setStudentResults([])
    setGrades([])
    setActiveTab('list')
  }, [])

  const activeExamIds = useMemo(() => {
    if (mode === 'single') return selectedExamId ? [selectedExamId] : []
    const ids = []
    if (selectedExamId) ids.push(selectedExamId)
    if (selectedExam2Id) ids.push(selectedExam2Id)
    return ids
  }, [mode, selectedExamId, selectedExam2Id])

  const classIdsForExams = useMemo(() => {
    if (activeExamIds.length === 0) return []
    const union = new Set()
    activeExamIds.forEach(eid =>
      examClasses.filter(ec => ec.exam_id === eid).forEach(ec => union.add(ec.class_id))
    )
    return classes.filter(c => union.has(c.id)).map(c => c.id)
  }, [activeExamIds, examClasses, classes])

  const filteredClasses = useMemo(() => {
    return classes.filter(c => classIdsForExams.includes(c.id))
  }, [classes, classIdsForExams])

  useEffect(() => {
    if (!selectedClassId || activeExamIds.length === 0) {
      setSubjects([])
      setStudents([])
      setMarks([])
      setMarks2([])
      setStudentResults([])
      setGrades([])
      setSelectedStudent(null)
      return
    }
    const loadData = async () => {
      setLoadingData(true)
      try {
        const selectedClass = classes.find(c => c.id === selectedClassId)
        if (!selectedClass) return
        const classLevel = selectedClass.level || 'O_LEVEL'

        const [gRes, sRes, exclRes, tsRes] = await Promise.all([
          supabase.from('grades').select('*').eq('level', classLevel).order('min_mark', { ascending: false }),
          supabase.from('subjects').select('*').eq('level', classLevel).order('subject_name'),
          supabase.from('class_excluded_subjects').select('subject_id').eq('class_id', selectedClassId),
          supabase.from('teacher_subjects').select('*, teachers!inner(*, profiles!inner(full_name)), class_streams!inner(class_id)').eq('class_streams.class_id', selectedClassId),
        ])
        setGrades(gRes.data || [])
        const excludedIds = new Set((exclRes.data || []).map(r => r.subject_id))
        const assignedSubjects = sortSubjectsByNectaCode(
          (sRes.data || []).filter(s => !excludedIds.has(s.id)),
          classLevel
        )
        setSubjects(assignedSubjects)
        const tsMap = {}
        ;(tsRes.data || []).forEach(ts => {
          const fullName = ts.teachers?.profiles?.full_name || ''
          if (fullName && !tsMap[ts.subject_id]) {
            const parts = fullName.trim().split(/\s+/)
            const initial = parts[0].charAt(0).toUpperCase()
            const surname = parts.length > 1 ? parts[parts.length - 1] : parts[0]
            tsMap[ts.subject_id] = `Mwl. ${initial}. ${surname}`
          } else if (!tsMap[ts.subject_id]) {
            tsMap[ts.subject_id] = ''
          }
        })
        setTeacherSubjects(tsMap)

        let loadedStudents = []
        let loadedMarks = []
        let loadedMarks2 = []
        let loadedResults = []

        if (assignedSubjects.length > 0) {
          const subjectIds = assignedSubjects.map(s => s.id)

          // Paginated fetcher — marks can exceed 1000 rows (students × subjects per exam)
          const fetchPaged = async (buildFn) => {
            const PAGE = 1000; let from = 0; const all = []
            while (true) {
              const { data } = await buildFn().range(from, from + PAGE - 1)
              if (!data || !data.length) break
              all.push(...data)
              if (data.length < PAGE) break
              from += PAGE
            }
            return all
          }

          const mData = []
          const srData = []
          for (let i = 0; i < activeExamIds.length; i++) {
            const eid = activeExamIds[i]
            const [m, sr] = await Promise.all([
              fetchPaged(() => supabase.from('marks').select('*').eq('exam_id', eid).in('subject_id', subjectIds)),
              fetchPaged(() => supabase.from('student_results').select('*').eq('exam_id', eid)),
            ])
            m.forEach(mk => mData.push({ ...mk, _exam_idx: i }))
            srData.push(...sr)
          }

          loadedMarks = mData.filter(m => m._exam_idx === 0)
          loadedMarks2 = activeExamIds.length > 1 ? mData.filter(m => m._exam_idx === 1) : []
          loadedResults = srData

          const studentIdsFromMarks = [...new Set(mData.map(m => m.student_id))]

          if (studentIdsFromMarks.length > 0) {
            const { data: sData } = await supabase
              .from('students')
              .select('*')
              .in('id', studentIdsFromMarks)
              .order('surname')
            loadedStudents = sData || []
          }

          if (loadedStudents.length === 0) {
            const { data: byClassId } = await supabase
              .from('students')
              .select('*')
              .eq('class_id', selectedClassId)
              .order('surname')
            if (byClassId?.length > 0) {
              loadedStudents = byClassId
            }
            if (loadedStudents.length === 0) {
              const { data: byJoin } = await supabase
                .from('students')
                .select('*, class_streams!inner(*)')
                .eq('class_streams.class_id', selectedClassId)
                .order('surname')
              if (byJoin?.length > 0) {
                loadedStudents = byJoin.map(s => { const { class_streams, ...rest } = s; return rest })
              }
            }
          }
        }

        // Calculate subject ranks
        const ranks = {}
        if (mode === 'single') {
          assignedSubjects.forEach(subj => {
            const rankScores = []
            loadedMarks.forEach(m => {
              if (m.subject_id !== subj.id || m.is_absent) return
              const theory = m.marks_obtained || 0
              const hp = subjectHasPractical(subj, selectedExam)
              const practical = hp ? (m.practical_marks || 0) : 0
              rankScores.push({ student_id: m.student_id, total: theory + practical })
            })
            rankScores.sort((a, b) => b.total - a.total)
            let rank = 1
            rankScores.forEach((s, idx) => {
              if (idx > 0 && s.total < rankScores[idx - 1].total) rank = idx + 1
              ranks[`${s.student_id}_${subj.id}`] = rank
            })
          })
        } else {
          // Combined mode: rank by combined percentage of both exams
          assignedSubjects.forEach(subj => {
            const rankScores = []
            const uniqueStudentIds = [...new Set([...loadedMarks, ...loadedMarks2].map(m => m.student_id))]
            uniqueStudentIds.forEach(sid => {
              const m1 = loadedMarks.find(m => m.student_id === sid && m.subject_id === subj.id)
              const m2 = loadedMarks2.find(m => m.student_id === sid && m.subject_id === subj.id)
              if ((!m1 || m1.is_absent) && (!m2 || m2.is_absent)) return
              const hp1 = subjectHasPractical(subj, selectedExam)
              const hp2 = subjectHasPractical(subj, selectedExam2)
              const c1 = computeCombinedMark(m1, hp1)
              const c2 = computeCombinedMark(m2, hp2)
              const has1 = c1.total != null
              const has2 = c2.total != null
              const combinedTotal = (c1.total ?? 0) + (c2.total ?? 0)
              const combinedMax = (has1 ? c1.max : 0) + (has2 ? c2.max : 0)
              const pct = combinedMax > 0 ? (combinedTotal / combinedMax) * 100 : null
              if (pct != null) rankScores.push({ student_id: sid, pct })
            })
            rankScores.sort((a, b) => b.pct - a.pct)
            let rank = 1
            rankScores.forEach((s, idx) => {
              if (idx > 0 && s.pct < rankScores[idx - 1].pct) rank = idx + 1
              ranks[`${s.student_id}_${subj.id}`] = rank
            })
          })
        }
        setSubjectRanks(ranks)

        setStudents(loadedStudents)
        setMarks(loadedMarks)
        setMarks2(loadedMarks2)
        setStudentResults(loadedResults)
      } catch (err) {
        console.error('Load data error:', err)
      } finally {
        setLoadingData(false)
      }
    }
    loadData()
  }, [selectedClassId, activeExamIds, classes, mode, selectedExam, selectedExam2])

  const markMap = useMemo(() => {
    const map = {}
    marks.forEach(m => { map[`${m.student_id}_${m.subject_id}`] = m })
    return map
  }, [marks])

  const markMap2 = useMemo(() => {
    const map = {}
    marks2.forEach(m => { map[`${m.student_id}_${m.subject_id}`] = m })
    return map
  }, [marks2])

  const sortedStudents = useMemo(() => {
    const resultMap = {}
    studentResults.forEach(sr => { resultMap[sr.student_id] = sr })

    const withRank = students.map(s => ({ ...s, result: resultMap[s.id] || null }))
      .filter(s => s.result?.position != null)
      .sort((a, b) => a.result.position - b.result.position)
    const withoutRank = students.map(s => ({ ...s, result: resultMap[s.id] || null }))
      .filter(s => !s.result?.position)
    return [...withRank, ...withoutRank]
  }, [students, studentResults])

  const isProcessed = mode === 'single'
    ? selectedExam && ['processed', 'published', 'locked'].includes(selectedExam.status)
    : selectedExam && selectedExam2
      && ['processed', 'published', 'locked'].includes(selectedExam.status)
      && ['processed', 'published', 'locked'].includes(selectedExam2.status)

  const handleViewReport = useCallback((student) => {
    setSelectedStudent(student)
    setActiveTab('report')
  }, [])

  const handleBack = useCallback(() => {
    setSelectedStudent(null)
    setActiveTab('list')
  }, [])

  const handleDownloadPDF = useCallback(async () => {
    if (!selectedStudent) return
    setGeneratingPDF(true)
    try {
      const name = `${selectedStudent.first_name} ${selectedStudent.middle_name || ''} ${selectedStudent.surname}`.replace(/\s+/g, ' ').trim()
      const filename = `${name.replace(/[^a-zA-Z0-9]/g, '_')}_report`
      await generatePDF(reportRef.current, filename)
    } catch (err) {
      console.error('PDF generation error:', err)
    } finally {
      setGeneratingPDF(false)
    }
  }, [selectedStudent])

  const handleDownloadClassPDF = useCallback(() => {
    const studentList = mode === 'single'
      ? sortedStudents.filter(s => s.result?.position != null)
      : sortedStudents
    if (studentList.length === 0) {
      alert('Hakuna wanafunzi wenye matokeo kwa darasa hili.')
      return
    }
    setGeneratingBulkPDF('Inaandaa...')
    setBulkStudents(studentList)
  }, [sortedStudents, mode])

  // Bulk PDF: single multi-page PDF with all students (one per page)
  useEffect(() => {
    if (bulkStudents.length === 0 || generatingBulkPDF === false) return
    const timer = setTimeout(async () => {
      const errors = []
      try {
        const c = classes.find(cl => cl.id === selectedClassId)
        const className = c?.class_name || 'Darasa'
        const filename = `${className.replace(/[^a-zA-Z0-9]/g, '_')}_Ripoti_Zote`

        const pdf = new jsPDF('p', 'mm', 'a4')
        const pdfWidth = pdf.internal.pageSize.getWidth()
        const margin = 8
        const usableWidth = pdfWidth - margin * 2

        for (let i = 0; i < bulkStudents.length; i++) {
          setGeneratingBulkPDF(`Inaandaa ${i + 1} kati ya ${bulkStudents.length}...`)
          await new Promise(resolve => setTimeout(resolve, 50))

          const studentEl = bulkContainerRef.current?.children[i]
          if (!studentEl) {
            console.warn(`Bulk PDF: student element at index ${i} not found, skipping`)
            continue
          }

          const s = bulkStudents[i]
          const studentName = `${s.first_name || ''} ${s.middle_name || ''} ${s.surname || ''}`.trim()

          try {
            const canvas = await captureElementWithRetry(studentEl)
            const imgData = canvas.toDataURL('image/jpeg', 0.95)
            const canvasWidth = canvas.width
            const canvasHeight = canvas.height
            const ratio = usableWidth / canvasWidth
            const scaledHeight = canvasHeight * ratio

            if (i > 0 || pdf.getNumberOfPages() > 0) {
              if (i > 0) pdf.addPage()
            }
            addImageToPDF(pdf, imgData, margin, usableWidth, scaledHeight)
          } catch (studentErr) {
            console.error(`Bulk PDF: failed to capture report for ${studentName}:`, studentErr)
            errors.push({ name: studentName, error: studentErr.message })
          }
        }

        if (errors.length > 0) {
          console.warn(`Bulk PDF completed with ${errors.length} error(s):`, errors.map(e => e.name).join(', '))
        }

        pdf.save(`${filename}.pdf`)
      } catch (err) {
        console.error('Bulk PDF generation error:', err)
        alert('Kuna tatizo wakati wa kuandaa PDF. Tafadhali jaribu tena.')
      } finally {
        setGeneratingBulkPDF(false)
        setBulkStudents([])
      }
    }, 800)
    return () => clearTimeout(timer)
  }, [bulkStudents, generatingBulkPDF])

  // Load per-class report settings from DB when class changes or report tab opens
  useEffect(() => {
    if (!selectedClassId) { setReportHeading(''); setExamLabel1(''); setExamLabel2(''); return }
    supabase
      .from('class_report_settings')
      .select('report_heading, exam_label_1, exam_label_2')
      .eq('class_id', selectedClassId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.warn('Report settings load error:', error)
        setReportHeading(data?.report_heading || '')
        setLocalHeading(data?.report_heading || '')
        if (data?.exam_label_1) setExamLabel1(data.exam_label_1)
        else if (selectedExam?.name) setExamLabel1(selectedExam.name)
        else setExamLabel1('')
        if (data?.exam_label_2) setExamLabel2(data.exam_label_2)
        else if (selectedExam2?.name) setExamLabel2(selectedExam2.name)
        else setExamLabel2('')
      })
  }, [selectedClassId, selectedExam?.name, selectedExam2?.name, activeTab])

  // Auto-save report settings to DB with debounce
  useEffect(() => {
    if (!selectedClassId) return
    const timer = setTimeout(async () => {
      await supabase
        .from('class_report_settings')
        .upsert(
          { class_id: selectedClassId, report_heading: reportHeading, exam_label_1: examLabel1, exam_label_2: examLabel2 },
          { onConflict: 'class_id' }
        )
    }, 2000)
    return () => clearTimeout(timer)
  }, [reportHeading, examLabel1, examLabel2, selectedClassId])

  const computeCombinedData = useCallback((student) => {
    if (mode !== 'combined' || !student) return null
    const classLevel = classes.find(c => c.id === selectedClassId)?.level || 'O_LEVEL'

    const entries = subjects.map(subject => {
      const mark1 = markMap[`${student.id}_${subject.id}`]
      const mark2 = markMap2[`${student.id}_${subject.id}`]
      const hp1 = subjectHasPractical(subject, selectedExam)
      const hp2 = subjectHasPractical(subject, selectedExam2)
      const c1 = computeCombinedMark(mark1, hp1)
      const c2 = computeCombinedMark(mark2, hp2)
      const has1 = c1.total != null
      const has2 = c2.total != null
      const combinedTotal = (c1.total ?? 0) + (c2.total ?? 0)
      const combinedMax = (has1 ? c1.max : 0) + (has2 ? c2.max : 0)
      const pct = combinedMax > 0 ? (combinedTotal / combinedMax) * 100 : null
      const gradeObj = pct != null ? getGradeForPercentage(pct, grades) : null
      return {
        subject,
        exam1Total: c1.total, exam1Pct: c1.pct,
        exam2Total: c2.total, exam2Pct: c2.pct,
        combinedTotal, combinedPct: pct,
        gradeObj,
        isAbsent1: !mark1 || mark1.is_absent,
        isAbsent2: !mark2 || mark2.is_absent,
      }
    })

    const valid = entries.filter(e => e.combinedPct != null)
    const totalPct = valid.reduce((s, e) => s + e.combinedPct, 0)
    const avgPct = valid.length > 0 ? totalPct / valid.length : null
    const overallGrade = getGradeForPercentage(avgPct, grades)
    const totalMarks = entries.reduce((s, e) => s + (e.combinedTotal || 0), 0)

    // For A-Level: only COMPULSORY/PRINCIPAL subjects count toward division points
    const principalValid = classLevel === 'A_LEVEL'
      ? valid.filter(e => e.subject.subject_type !== 'ELECTIVE')
      : valid

    const allPoints = principalValid.map(e => e.gradeObj?.points || 0).filter(p => p > 0)
    allPoints.sort((a, b) => a - b)
    const bestN = classLevel === 'A_LEVEL' ? 3 : 7
    const bestPoints = allPoints.slice(0, bestN)
    const totalPoints = bestPoints.reduce((s, p) => s + p, 0)

    const division = calcDivision(totalPoints, classLevel)

    return { entries, avgPct, gradeObj: overallGrade, pts: totalPoints, totalMarks, division, validCount: principalValid.length }
  }, [mode, subjects, markMap, markMap2, selectedExam, selectedExam2, grades, classes, selectedClassId])

  const reportContext = useMemo(() => ({
    mode, studentResults, subjects, markMap, selectedExam, selectedExam2,
    grades, classes, selectedClassId, schoolInfo, reportHeading, examLabel1, examLabel2,
    subjectRanks, teacherSubjects, parentGreeting, closingMessage,
    schoolClosingDate, schoolOpeningDate, classTeacherComment, headTeacherComment,
    students, computeCombinedData
  }), [
    mode, studentResults, subjects, markMap, selectedExam, selectedExam2,
    grades, classes, selectedClassId, schoolInfo, reportHeading, examLabel1, examLabel2,
    subjectRanks, teacherSubjects, parentGreeting, closingMessage,
    schoolClosingDate, schoolOpeningDate, classTeacherComment, headTeacherComment,
    students, computeCombinedData
  ])

  if (loading) {
    return (
      <div className="no-print flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-gray-200 border-t-maroon-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (initError) {
    return (
      <div className="no-print bg-white rounded-xl border border-red-200 p-10 text-center">
        <div className="w-14 h-14 mx-auto bg-red-50 rounded-full flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Kosa la Kupakia Data</h3>
        <p className="text-sm text-gray-500 max-w-md mx-auto mb-4">{initError}</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 text-sm font-medium text-white bg-maroon-600 rounded-lg hover:bg-maroon-700 transition">
          Jaribu Tena
        </button>
      </div>
    )
  }

  return (
    <div>
      <style>{printStyles}</style>
      <div className="no-print mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ripoti za Wanafunzi</h1>
        <p className="text-gray-500 mt-1">Tengeneza na pakua ripoti za wanafunzi kwa PDF</p>
      </div>

      <div className="no-print bg-white rounded-xl border border-gray-200 p-5 mb-6">
        {/* Report type toggle */}
        <div className="flex items-center gap-3 mb-5">
          <span className="text-sm font-medium text-gray-700">Report Type:</span>
          <div className="flex gap-2">
            <button
              onClick={() => { setMode('single'); resetSelections() }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                mode === 'single' ? 'bg-maroon-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Single Exam
            </button>
            <button
              onClick={() => { setMode('combined'); resetSelections() }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                mode === 'combined' ? 'bg-maroon-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Combined Report
            </button>
          </div>
          {mode === 'combined' && (
            <span className="text-xs text-gray-400 hidden sm:inline">Merge two written exams into one report (e.g. Mid-Term + End-Term)</span>
          )}
        </div>

        {/* ── Single mode ── */}
        {mode === 'single' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
              <select
                value={selectedYearId}
                onChange={(e) => { setSelectedYearId(e.target.value); setSelectedExamId(''); resetSelections() }}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
              >
                <option value="">All Years</option>
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>{y.year_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Exam</label>
              <select
                value={selectedExamId}
                onChange={(e) => { setSelectedExamId(e.target.value); resetSelections() }}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
              >
                <option value="">Choose an exam...</option>
                {groupExamsByType(selectedYearId ? exams.filter(e => e.academic_year_id === selectedYearId) : exams).map(([type, typeExams]) => (
                  <optgroup key={type} label={type.replace(/_/g, ' ')}>
                    {typeExams.map((exam) => (
                      <option key={exam.id} value={exam.id}>
                        {exam.name}{exam.has_practical ? ' (+ Practical)' : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Class</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                disabled={activeExamIds.length === 0 || filteredClasses.length === 0}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">Choose a class...</option>
                {filteredClasses.map((c) => (
                  <option key={c.id} value={c.id}>{c.class_name}</option>
                ))}
              </select>
            </div>
          </div>
        )}
        {mode === 'single' && selectedExam && (
          <div className="mt-3 flex items-center gap-3 text-sm text-gray-500">
            <span>Status: <span className="font-medium text-gray-700 capitalize">{selectedExam.status?.replace(/_/g, ' ')}</span></span>
            {selectedExam.has_practical && (
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs font-medium">Includes Practical Marks</span>
            )}
          </div>
        )}

        {/* ── Combined mode ── */}
        {mode === 'combined' && (() => {
          const writtenExams = exams.filter(e => e.exam_type !== 'PRACTICAL')
          const exam1List = selectedYearId ? writtenExams.filter(e => e.academic_year_id === selectedYearId) : writtenExams
          const exam2List = (selectedYear2Id ? writtenExams.filter(e => e.academic_year_id === selectedYear2Id) : writtenExams)
            .filter(e => e.id !== selectedExamId)
          const practicalMismatch = selectedExam && selectedExam2 && selectedExam.has_practical !== selectedExam2.has_practical
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Exam 1 card */}
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold text-white bg-maroon-600 px-2 py-0.5 rounded">Exam 1</span>
                    {selectedExam?.has_practical && (
                      <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">+ Practical</span>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Academic Year</label>
                      <select
                        value={selectedYearId}
                        onChange={(e) => { setSelectedYearId(e.target.value); setSelectedExamId(''); resetSelections() }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 bg-white"
                      >
                        <option value="">All Years</option>
                        {academicYears.map((y) => (
                          <option key={y.id} value={y.id}>{y.year_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Select Exam</label>
                      <select
                        value={selectedExamId}
                        onChange={(e) => { setSelectedExamId(e.target.value); resetSelections() }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 bg-white"
                      >
                        <option value="">Choose an exam...</option>
                        {groupExamsByType(exam1List).map(([type, typeExams]) => (
                          <optgroup key={type} label={type.replace(/_/g, ' ')}>
                            {typeExams.map((exam) => (
                              <option key={exam.id} value={exam.id}>
                                {exam.name}{exam.has_practical ? ' (+ Practical)' : ''}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Exam 2 card */}
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold text-white bg-gray-600 px-2 py-0.5 rounded">Exam 2</span>
                    {selectedExam2?.has_practical && (
                      <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">+ Practical</span>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Academic Year</label>
                      <select
                        value={selectedYear2Id}
                        onChange={(e) => { setSelectedYear2Id(e.target.value); setSelectedExam2Id(''); resetSelections() }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 bg-white"
                      >
                        <option value="">All Years</option>
                        {academicYears.map((y) => (
                          <option key={y.id} value={y.id}>{y.year_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Select Exam</label>
                      <select
                        value={selectedExam2Id}
                        onChange={(e) => { setSelectedExam2Id(e.target.value) }}
                        disabled={!selectedExamId}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 bg-white disabled:bg-gray-100 disabled:text-gray-400"
                      >
                        <option value="">{selectedExamId ? 'Choose an exam...' : 'Select Exam 1 first'}</option>
                        {groupExamsByType(exam2List).map(([type, typeExams]) => (
                          <optgroup key={type} label={type.replace(/_/g, ' ')}>
                            {typeExams.map((exam) => (
                              <option key={exam.id} value={exam.id}>
                                {exam.name}{exam.has_practical ? ' (+ Practical)' : ''}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Class selector */}
              <div className="max-w-xs">
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Class</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  disabled={activeExamIds.length < 2 || filteredClasses.length === 0}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="">{activeExamIds.length < 2 ? 'Select both exams first' : 'Choose a class...'}</option>
                  {filteredClasses.map((c) => (
                    <option key={c.id} value={c.id}>{c.class_name}</option>
                  ))}
                </select>
              </div>

              {/* Practical mismatch warning */}
              {practicalMismatch && (
                <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                  <svg className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <span>
                    <strong>Practical mismatch:</strong> {selectedExam.name} {selectedExam.has_practical ? 'includes' : 'does not include'} practical marks, while {selectedExam2.name} {selectedExam2.has_practical ? 'includes' : 'does not include'} practical marks. Science subject totals will be weighted differently between the two exams.
                  </span>
                </div>
              )}

              {/* Combined summary row */}
              {selectedExam && selectedExam2 && (
                <div className="flex items-center gap-2 text-sm text-gray-500 pt-1">
                  <span className="font-medium text-gray-800">{selectedExam.name}</span>
                  <span className="text-gray-400">+</span>
                  <span className="font-medium text-gray-800">{selectedExam2.name}</span>
                  <span className="text-gray-300 mx-1">|</span>
                  <span>Exam 1 status: <span className="capitalize font-medium text-gray-700">{selectedExam.status?.replace(/_/g, ' ')}</span></span>
                  <span className="text-gray-300 mx-1">·</span>
                  <span>Exam 2 status: <span className="capitalize font-medium text-gray-700">{selectedExam2.status?.replace(/_/g, ' ')}</span></span>
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {loadingData && (
        <div className="no-print flex items-center justify-center py-12">
          <div className="w-6 h-6 border-3 border-gray-200 border-t-maroon-600 rounded-full animate-spin" />
        </div>
      )}

      {!loadingData && selectedClassId && subjects.length > 0 && students.length > 0 && !isProcessed && (
        <div className="no-print bg-white rounded-xl border border-amber-200 p-10 text-center">
          <div className="w-14 h-14 mx-auto bg-amber-50 rounded-full flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Exam(s) Not Yet Processed</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            All selected exams must be processed before generating report cards.
          </p>
        </div>
      )}

      {!loadingData && selectedClassId && isProcessed && (
        <div>
          {activeTab === 'list' && (
            <div className="no-print bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">
                  Students - {students.length} total
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadClassPDF}
                    disabled={sortedStudents.length === 0 || generatingBulkPDF !== false}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {generatingBulkPDF !== false ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                    )}
                    {generatingBulkPDF !== false ? generatingBulkPDF : `Pakua Zote (${sortedStudents.length})`}
                  </button>
                </div>
              </div>
              {students.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-sm text-gray-500">No students found for this class.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">#</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Admission No</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Student Name</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Gender</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sortedStudents.map((student, idx) => (
                        <tr key={student.id} className="hover:bg-gray-50 transition">
                          <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                          <td className="px-4 py-3 text-gray-700 font-mono text-xs">{student.admission_number}</td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-gray-900">{student.first_name} {student.middle_name || ''} {student.surname}</span>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-700">{student.gender === 'Male' ? 'M' : 'F'}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleViewReport(student)}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-maroon-600 rounded-lg hover:bg-maroon-700 transition"
                            >
                              View Report
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'report' && selectedStudent && (
            <div>
              <div className="no-print mb-2 bg-blue-50 border border-blue-200 rounded px-3 py-1.5 flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs text-blue-700">Chapisha ripoti zote: bonyeza <kbd className="px-1 py-0.5 bg-blue-100 border border-blue-200 rounded text-xs font-mono">Ctrl+P</kbd> ukiwa kwenye mtazamo huu</span>
              </div>
              <div className="no-print flex items-center justify-between mb-4">
                <button
                  onClick={handleBack}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                  </svg>
                  Rudi kwenye Orodha
                </button>
                <button
                  onClick={handleDownloadPDF}
                  disabled={generatingPDF}
                  className="px-4 py-2 text-sm font-medium text-white bg-maroon-600 rounded-lg hover:bg-maroon-700 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generatingPDF ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                  )}
                  {generatingPDF ? 'Inaandaa...' : 'Pakua PDF'}
                </button>
              </div>

              <div className="no-print bg-white rounded-xl border border-gray-200 p-4 mb-4">
                <h4 className="text-sm font-semibold text-gray-800 mb-3">Mipangilio ya Ripoti</h4>
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Kichwa cha Ripoti <span className="text-gray-400">(bonyeza Enter kwa mstari mpya, hadi mistari 4)</span></label>
                  <textarea
                    value={localHeading}
                    onChange={e => {
                      const val = e.target.value
                      setLocalHeading(val)
                      clearTimeout(headingDebounceRef.current)
                      headingDebounceRef.current = setTimeout(() => setReportHeading(val), 500)
                    }}
                    placeholder="e.g. TAARIFA YA MATOKEO YA MTIHANI WA MWISHO WA MUHULA WA KWANZA 2025"
                    rows={4}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-maroon-500 resize-none"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Tarehe ya Kufunga</label>
                    <input type="date" value={schoolClosingDate} onChange={e => setSchoolClosingDate(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-maroon-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Tarehe ya Kufungua</label>
                    <input type="date" value={schoolOpeningDate} onChange={e => setSchoolOpeningDate(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-maroon-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Salamu kwa Mzazi</label>
                    <input type="text" value={parentGreeting} onChange={e => setParentGreeting(e.target.value)} placeholder="e.g. Wazazi wa [Jina] ..." className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-maroon-500" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Maoni ya Mwalimu wa Darasa <span className="text-gray-400">(moja kwa moja kama tupu)</span></label>
                    <input type="text" value={classTeacherComment} onChange={e => setClassTeacherComment(e.target.value)} placeholder="" className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-maroon-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Maoni ya Mkuu wa Shule <span className="text-gray-400">(moja kwa moja kama tupu)</span></label>
                    <input type="text" value={headTeacherComment} onChange={e => setHeadTeacherComment(e.target.value)} placeholder="" className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-maroon-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ujumbe wa Kufunga</label>
                  <input type="text" value={closingMessage} onChange={e => setClosingMessage(e.target.value)} placeholder="e.g. Asante kwa ushirikiano wenu. Mungu awabariki." className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-maroon-500" />
                </div>
                <div className="border-t border-gray-200 pt-3 mt-3">
                  <h5 className="text-xs font-semibold text-gray-700 mb-2">Majina ya Safu Wima Kwenye Ripoti</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {mode === 'combined' ? (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Jina la Mtihani 1</label>
                          <input type="text" value={examLabel1} onChange={e => setExamLabel1(e.target.value)} placeholder={selectedExam?.name || 'Mtihani 1'} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-maroon-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Jina la Mtihani 2</label>
                          <input type="text" value={examLabel2} onChange={e => setExamLabel2(e.target.value)} placeholder={selectedExam2?.name || 'Mtihani 2'} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-maroon-500" />
                        </div>
                      </>
                    ) : selectedExam?.has_practical ? (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Jina la Nadharia</label>
                          <input type="text" value={examLabel1} onChange={e => setExamLabel1(e.target.value)} placeholder="Nadharia" className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-maroon-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Jina la Vitendo</label>
                          <input type="text" value={examLabel2} onChange={e => setExamLabel2(e.target.value)} placeholder="Vitendo" className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-maroon-500" />
                        </div>
                      </>
                    ) : (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Jina la Alama</label>
                        <input type="text" value={examLabel1} onChange={e => setExamLabel1(e.target.value)} placeholder="Alama" className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-maroon-500" />
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Majina haya yataonekana kwenye safu wima za jedwali la matokeo kwa darasa hili tu.</p>
                </div>
              </div>

              <div className="print-area" ref={reportRef}>
                <ReportCard student={selectedStudent} ctx={reportContext} />
              </div>
            </div>
          )}

          {/* Bulk container — off-screen for dom-to-image-more capture */}
          <div ref={bulkContainerRef} style={{ position: 'absolute', left: '-99999px', top: 0, width: '794px', background: '#fff', zIndex: -1 }}>
            {bulkStudents.map((student) => (
              <ReportCard key={student.id} student={student} ctx={reportContext} />
            ))}
          </div>

          {/* Print all students — visible only during Ctrl+P / browser print */}
          <div className="print-all-students">
            {(mode === 'single'
              ? sortedStudents.filter(s => s.result?.position != null)
              : sortedStudents
            ).map(student => (
              <ReportCard key={student.id} student={student} ctx={reportContext} />
            ))}
          </div>
        </div>
      )}

      {!loadingData && selectedClassId && subjects.length === 0 && (
        <div className="no-print bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-sm text-gray-500">No subjects found for this class.</p>
        </div>
      )}

      {!loadingData && selectedClassId && subjects.length > 0 && students.length === 0 && (
        <div className="no-print bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-sm text-gray-500">No students found for this class.</p>
        </div>
      )}

      {!selectedClassId && !loading && (
        <div className="no-print bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-sm text-gray-500">Select exam(s) and class to view students.</p>
        </div>
      )}
    </div>
  )
}

export default StudentReports
