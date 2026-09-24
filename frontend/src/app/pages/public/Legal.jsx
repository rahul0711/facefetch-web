import { Link } from 'react-router'
import { useDocumentTitle } from '../../lib/hooks'
import { cn } from '../../lib/utils'

// Plain-language demo policies. Prototype copy, not legal advice.
const DOCS = {
  privacy: {
    title: 'Privacy Policy',
    intro: 'How Genesis Hub handles your photos and face data, in plain language.',
    sections: [
      ['What we collect', 'Your name and email when you create an account, the events you are invited to, and the selfie or photo you use to search. Event photos are uploaded by organizers and their photographers.'],
      ['How face search works', 'When you search, your photo is converted into a face signature: a list of numbers that describes facial features. That signature is compared with the faces in the event you chose, and matching photos are shown to you.'],
      ['What we do with your selfie', 'Your selfie is used to run your search in the event you picked. It is not added to the event gallery and is not shown to other guests or organizers.'],
      ['Event isolation', 'Each search is limited to one event. Your face is never compared against photos from events you don’t have access to.'],
      ['Who can see event photos', 'Guests see only the photos their own face matches. Event admins assigned by the organizer can see and manage their event’s gallery.'],
      ['Your choices', 'You can delete your search history and your account at any time. Organizers can remove photos from an event on request.'],
    ],
  },
  terms: {
    title: 'Terms of Use',
    intro: 'The ground rules for using Genesis Hub.',
    sections: [
      ['Searching only for yourself', 'Use face search to find photos of yourself. Don’t search for other people using their photos without their permission.'],
      ['Organizer responsibilities', 'Organizers confirm they have the right to upload event photos and to offer face search to their guests.'],
      ['Downloads', 'Photos you download are for personal use unless the organizer or photographer grants other rights.'],
      ['Prototype notice', 'This site is a product prototype running on demo data. No real accounts are created.'],
    ],
  },
  consent: {
    title: 'Biometric consent',
    intro: 'What you agree to when you take a selfie to search an event.',
    sections: [
      ['What you’re consenting to', 'You allow Genesis Hub to create a face signature from the photo you provide and compare it with faces in the event you selected, to show you photos you appear in.'],
      ['Scope', 'Consent applies to searches you start yourself, in events you choose. It does not allow anyone else to search for you.'],
      ['Withdrawing consent', 'You can stop at any time. Deleting your account removes your search history.'],
    ],
  },
}

export default function Legal({ doc }) {
  const d = DOCS[doc]
  useDocumentTitle(d.title)
  return (
    <div className="bg-canvas pt-28 pb-24">
      <div className="container-page grid max-w-5xl gap-10 lg:grid-cols-[200px_1fr]">
        <nav className="flex gap-2 lg:flex-col" aria-label="Policies">
          {Object.entries(DOCS).map(([k, v]) => (
            <Link key={k} to={`/${k}`} className={cn('rounded-lg px-3 py-2 text-sm font-medium', k === doc ? 'bg-white text-navy-950 shadow-card ring-1 ring-navy-100' : 'text-navy-500 hover:text-navy-900')}>
              {v.title}
            </Link>
          ))}
        </nav>
        <article className="rounded-3xl border border-navy-100 bg-white p-6 sm:p-10">
          <p className="text-sm font-medium text-brand-600">Last updated 24 September 2026</p>
          <h1 className="mt-2 text-3xl font-semibold text-navy-950 sm:text-4xl">{d.title}</h1>
          <p className="mt-3 text-lg text-navy-500">{d.intro}</p>
          <div className="mt-10 grid gap-8">
            {d.sections.map(([h, t]) => (
              <section key={h}>
                <h2 className="text-lg font-semibold text-navy-950">{h}</h2>
                <p className="mt-2 leading-relaxed text-navy-600">{t}</p>
              </section>
            ))}
          </div>
        </article>
      </div>
    </div>
  )
}
