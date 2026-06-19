import { Link } from 'react-router-dom'

export default function JoiningInstructions() {
  const steps = [
    {
      title: 'Hatua ya 1: Jaza Ombi',
      description: 'Tembelea ukurasa wetu wa maombi ya kujiunga (Apply) na ujaze taarifa zote muhimu za mwanafunzi na mzazi/mlezi. Hakikisha umejaza sehemu zote zenye nyota (*).',
    },
    {
      title: 'Hatua ya 2: Wasilisha Ombi',
      description: 'Baada ya kukamilisha fomu, bonyeza "Tuma Ombi". Utapokea namba ya ombi (APP-2025-XXXX) ambayo utaitumia kufuatilia hali ya ombi lako.',
    },
    {
      title: 'Hatua ya 3: Subiri Uhakiki',
      description: 'Uongozi wa shule utakagua ombi lako na kukujulisha hali yake. Unaweza kufuatilia ombi lako kwa kutumia namba ya ombi kwenye ukurasa wa "Fuatilia Ombi".',
    },
    {
      title: 'Hatua ya 4: Kukubaliwa',
      description: 'Ombi lako likikubaliwa, utapokea taarifa kupitia simu au barua pepe. Utahitaji kuja shuleni kukamilisha usajili na kulipa ada.',
    },
    {
      title: 'Hatua ya 5: Vifaa Vinavyohitajika',
      description: 'Lete picha 2 za pasi, nakala ya cheti cha kuzaliwa, nakala ya kadi ya taifa ya mzazi, na nyaraka za shule ya awali (kama zipo).',
    },
  ]

  const requirements = [
    'Mtoto awe na umri wa kuanzia miaka 14 hadi 18 kwa Form 1.',
    'Awe amemaliza elimu ya msingi (darasa la 7) kwa mafanikio.',
    'Kwa A-Level, awe amemaliza O-Level kwa mafanikio na kupata daraja la kutosha.',
    'Awe na afya njema na hawezi kuwa na ugonjwa wa kuambukiza.',
    'Awe tayari kufuata kanuni na sheria za shule.',
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-maroon-700 text-white py-6 px-4">
        <div className="max-w-4xl mx-auto">
          <Link to="/" className="text-white/70 hover:text-white text-sm">&larr; Rudi Nyuma</Link>
          <h1 className="text-2xl font-bold mt-1">Maelekezo ya Kujiunga</h1>
          <p className="text-white/70 text-sm mt-1">Hatua rahisi za kufuata ili kujiunga na shule yetu</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Process Steps */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Hatua za Kujiunga</h2>
          <div className="space-y-4">
            {steps.map((step, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-10 h-10 bg-maroon-100 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-maroon-700">{i + 1}</span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{step.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Requirements */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Vigezo vya Kuingia</h2>
          <ul className="space-y-2">
            {requirements.map((req, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-green-600 mt-0.5 shrink-0">✓</span>
                <span>{req}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            to="/apply"
            className="inline-flex px-6 py-3 bg-maroon-700 text-white text-sm font-semibold rounded-xl hover:bg-maroon-800 transition"
          >
            Tuma Ombi Sasa
          </Link>
        </div>
      </div>
    </div>
  )
}
