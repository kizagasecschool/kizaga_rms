export const O_LEVEL_GRADES = [
  { min: 75, max: 100, grade: 'A', points: 1, remarks: 'Excellent' },
  { min: 65, max: 74,  grade: 'B', points: 2, remarks: 'Very Good' },
  { min: 45, max: 64,  grade: 'C', points: 3, remarks: 'Good' },
  { min: 30, max: 44,  grade: 'D', points: 4, remarks: 'Satisfactory' },
  { min: 0,  max: 29,  grade: 'F', points: 5, remarks: 'Fail' },
]

export const A_LEVEL_GRADES = [
  { min: 80, max: 100, grade: 'A', points: 1, remarks: 'Excellent' },
  { min: 70, max: 79,  grade: 'B', points: 2, remarks: 'Very Good' },
  { min: 60, max: 69,  grade: 'C', points: 3, remarks: 'Good' },
  { min: 50, max: 59,  grade: 'D', points: 4, remarks: 'Satisfactory' },
  { min: 40, max: 49,  grade: 'E', points: 5, remarks: 'Pass' },
  { min: 35, max: 39,  grade: 'S', points: 6, remarks: 'Subsidiary' },
  { min: 0,  max: 34,  grade: 'F', points: 7, remarks: 'Fail' },
]

export const O_LEVEL_DIVISIONS = [
  { min: 7,  max: 17, division: 'I' },
  { min: 18, max: 21, division: 'II' },
  { min: 22, max: 25, division: 'III' },
  { min: 26, max: 33, division: 'IV' },
]

export const A_LEVEL_DIVISIONS = [
  { min: 3,  max: 9,  division: 'I' },
  { min: 10, max: 12, division: 'II' },
  { min: 13, max: 17, division: 'III' },
  { min: 18, max: 19, division: 'IV' },
]

export function getGradeForMark(marks, level) {
  const grades = level === 'A_LEVEL' ? A_LEVEL_GRADES : O_LEVEL_GRADES
  return grades.find(g => marks >= g.min && marks <= g.max) || null
}

export function getPointsForMark(marks, level) {
  const grade = getGradeForMark(marks, level)
  return grade ? grade.points : 0
}

export function calculateDivision(totalPoints, level) {
  const divisions = level === 'A_LEVEL' ? A_LEVEL_DIVISIONS : O_LEVEL_DIVISIONS
  const found = divisions.find(d => totalPoints >= d.min && totalPoints <= d.max)
  return found ? `Division ${found.division}` : 'Division 0'
}

export function calculateBestSubjects(markEntries, subjectCount, compulsorySubjectIds = []) {
  const compulsory = markEntries.filter(e => compulsorySubjectIds.includes(e.subjectId))
  const optional = markEntries.filter(e => !compulsorySubjectIds.includes(e.subjectId))

  const bestCompulsory = compulsory.slice().sort((a, b) => a.points - b.points)
  const bestOptional = optional.slice().sort((a, b) => a.points - b.points)

  const selected = [...bestCompulsory]
  const remaining = subjectCount - selected.length
  if (remaining > 0) {
    selected.push(...bestOptional.slice(0, remaining))
  }

  const totalPoints = selected.reduce((sum, e) => sum + e.points, 0)
  return { selected, totalPoints }
}
