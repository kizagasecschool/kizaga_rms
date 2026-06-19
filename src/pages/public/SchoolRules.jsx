import { Link } from 'react-router-dom'

export default function SchoolRules() {
  const rules = [
    {
      title: 'Mahudhurio',
      items: [
        'Kila mwanafunzi anatakiwa kuhudhuria shuleni kwa wakati kila siku.',
        'Uchkaji wa siku 3 mfululizo bila ruhusa utasababisha kufukuzwa.',
        'Kila mwanafunzi anatakiwa kuwa na barua ya ruhusa kutoka kwa mzazi akikosa shule.',
        'Saa za shule ni kuanzia saa 7:00 asubuhi hadi saa 4:00 jioni.',
      ],
    },
    {
      title: 'Sare na Mwonekano',
      items: [
        'Kila mwanafunzi anatakiwa kuvaa sare kamili ya shule kila siku.',
        'Nywele za wavulana zinapaswa kuwa fupi na safi.',
        'Wasichana wanatakiwa kusuka nywele zao vizuri.',
        'Pete, nyoo, na vito vya mapambo havihimizwa shuleni.',
        'Viatu vya shule lazima viwe vyeusi au vyeupe kulingana na kanuni za shule.',
      ],
    },
    {
      title: 'Tabia na Nidhamu',
      items: [
        'Heshima kwa walimu, wafanyakazi, na wanafunzi wenzako ni lazima.',
        'Ugombvi, mapigano, na matumizi ya lugha chafu ni marufuku.',
        'Tumbo, sigara, na pombe ni marufuku kabisa shuleni na nje ya shule.',
        'Uharibifu wa mali ya shule utasababisha malipo ya fidia na hatua za kinidhamu.',
        'Wizi, udanganyifu, na vitendo vingine vyovyote vya kinyume cha sheria vitapelekea kufukuzwa.',
      ],
    },
    {
      title: 'Masomo na Kazi za Shule',
      items: [
        'Kila mwanafunzi anatakiwa kufanya kazi za nyumbani na kuzikabidhi kwa wakati.',
        'Vitabu vya kiada na vifaa vingine vya shule ni lazima viwekwe safi.',
        'Kushiriki katika masomo ya ziada na klabu za shule kunahimizwa.',
        'Mitihani na majaribio ni sehemu ya tathmini ya mwanafunzi.',
      ],
    },
    {
      title: 'Usalama na Afya',
      items: [
        'Wanafunzi hawaruhusiwi kuondoka eneo la shule wakati wa masomo bila ruhusa.',
        'Kuweka moto, vitu hatarishi, au silaha shuleni ni marufuku.',
        'Usafi wa mazingira na afya binafsi ni jukumu la kila mwanafunzi.',
        'Mwanafunzi mgonjwa anapaswa kuripoti kwa mwalimu wa darasa au afisi ya shule.',
      ],
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-maroon-700 text-white py-6 px-4">
        <div className="max-w-4xl mx-auto">
          <Link to="/" className="text-white/70 hover:text-white text-sm">&larr; Rudi Nyuma</Link>
          <h1 className="text-2xl font-bold mt-1">Kanuni na Sheria za Shule</h1>
          <p className="text-white/70 text-sm mt-1">Tazama na ujifunze sheria na taratibu za shule yetu</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {rules.map((section, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">{i + 1}. {section.title}</h2>
            <ul className="space-y-2">
              {section.items.map((item, j) => (
                <li key={j} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-maroon-600 mt-0.5 shrink-0">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
          <p className="text-sm text-amber-800">
            Kwa maelezo zaidi, tafadhali wasiliana na afisi ya shule au mwalimu mkuu.
          </p>
        </div>
      </div>
    </div>
  )
}
