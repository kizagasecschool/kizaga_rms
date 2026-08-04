// NECTA official codes — O-Level (CSEE)
const NECTA_O_LEVEL = [
  { keys: ['civics'],                       code: 'CIV'    },
  { keys: ['history'],                      code: 'HIST'   },
  { keys: ['geography', 'geografia'],       code: 'GEO'    },
  { keys: ['english'],                      code: 'ENG'    },
  { keys: ['kiswahili'],                    code: 'KIS'    },
  { keys: ['mathematics', 'hisabati'],      code: 'MTH'    },
  { keys: ['biology'],                      code: 'BIO'    },
  { keys: ['physics'],                      code: 'PHY'    },
  { keys: ['chemistry'],                    code: 'CHEM'   },
  { keys: ['commerce'],                     code: 'COMM'   },
  { keys: ['book-keeping', 'bookkeeping'],  code: 'B/KEEP' },
  { keys: ['business studies'],             code: 'B/STD'  },
  { keys: ['agriculture'],                  code: 'AGRI'   },
  { keys: ['computer'],                     code: 'CMP'    },
  { keys: ['ict'],                          code: 'ICT'    },
  { keys: ['fine art'],                     code: 'F/ART'  },
  { keys: ['music'],                        code: 'MUS'    },
  { keys: ['physical education'],           code: 'P/ED'   },
  { keys: ['home economics'],               code: 'H/EC'   },
  { keys: ['islamic knowledge'],            code: 'I/K'    },
  { keys: ['bible knowledge'],              code: 'B/K'    },
  { keys: ['french'],                       code: 'FRE'    },
  { keys: ['arabic'],                       code: 'ARAB'   },
]

// NECTA official codes — A-Level (ACSEE)
const NECTA_A_LEVEL = [
  { keys: ['history'],                      code: 'HIST'   },
  { keys: ['geography'],                    code: 'GEO'    },
  { keys: ['economics'],                    code: 'ECON'   },
  { keys: ['kiswahili'],                    code: 'KIS'    },
  { keys: ['literature'],                   code: 'LIT'    },
  { keys: ['french'],                       code: 'FRE'    },
  { keys: ['arabic'],                       code: 'ARAB'   },
  { keys: ['islamic knowledge'],            code: 'I/K'    },
  { keys: ['bible knowledge'],              code: 'B/K'    },
  { keys: ['physics'],                      code: 'PHY'    },
  { keys: ['chemistry'],                    code: 'CHEM'   },
  { keys: ['advanced mathematics'],         code: 'A/MTH'  },
  { keys: ['mathematics', 'hisabati'],      code: 'MTH'    },
  { keys: ['biology'],                      code: 'BIO'    },
  { keys: ['agriculture'],                  code: 'AGRI'   },
  { keys: ['accountancy'],                  code: 'ACCT'   },
  { keys: ['nutrition'],                    code: 'NUTR'   },
  { keys: ['computer'],                     code: 'CMP'    },
  { keys: ['ict'],                          code: 'ICT'    },
  { keys: ['general studies'],              code: 'GS'     },
]

/**
 * Returns the NECTA display code for a subject.
 * Prefers subject.short_name if set, otherwise auto-detects from subject_name.
 */
export function getNectaCode(subject, level) {
  if (subject.short_name) return subject.short_name
  const name = (subject.subject_name || '').toLowerCase()
  const list = level === 'A_LEVEL' ? NECTA_A_LEVEL : NECTA_O_LEVEL
  const entry = list.find(e => e.keys.some(k => name.includes(k)))
  return entry ? entry.code : (subject.subject_code || subject.subject_name || '')
}

/**
 * Sorts subjects A→Z by their NECTA code.
 * Subjects with short_name set sort first (by short_name A→Z),
 * then auto-detected, then any with no code fall back to subject_name order.
 */
export function sortSubjectsByNectaCode(subjects, level) {
  return [...subjects].sort((a, b) => {
    const ca = getNectaCode(a, level)
    const cb = getNectaCode(b, level)
    return ca.localeCompare(cb)
  })
}
