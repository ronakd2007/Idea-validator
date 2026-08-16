import Link from 'next/link';
import type { Metadata } from 'next';
import WalkthroughPlayer from '@/components/WalkthroughPlayer';

export const metadata: Metadata = {
  title: 'Tutorial — How IdeaValidator Works',
  description:
    'A step-by-step guide to validating your business idea: submit it, get scored by vetted experts across 12 frameworks, test demand with surveys, and decide with data.',
};

// Fully static, public page — no auth, no client JS. Every step below mirrors
// the real product flow, so if a flow changes, change this page in the same PR.

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <div className="shrink-0 w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm">{n}</div>
      <div className="pb-8">
        <h4 className="font-semibold text-slate-900 mb-1">{title}</h4>
        <div className="text-sm text-slate-600 leading-relaxed">{children}</div>
      </div>
    </li>
  );
}

function SectionHeading({ kicker, title, blurb }: { kicker: string; title: string; blurb?: string }) {
  return (
    <div className="mb-8">
      <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-2">{kicker}</p>
      <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">{title}</h2>
      {blurb && <p className="text-slate-500 mt-2 max-w-2xl">{blurb}</p>}
    </div>
  );
}

export default function TutorialPage() {
  return (
    // The global Navbar from the root layout renders above this page (logo,
    // Tutorial, Login/Get Started or the logged-in links) — no local header.
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-16 pb-12 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight">How IdeaValidator works</h1>
        <p className="text-lg text-slate-500 mt-4 max-w-2xl mx-auto">
          Most startup ideas fail because nobody honestly stress-tested them. Here, vetted industry experts score your
          idea across 12 frameworks and real people answer your surveys — so you decide with evidence, not encouragement.
        </p>
        <div className="flex flex-wrap justify-center gap-3 mt-8 text-sm">
          <a href="#founders" className="bg-white border border-slate-200 rounded-full px-4 py-2 text-slate-700 hover:border-blue-300">🚀 I have an idea</a>
          <a href="#experts" className="bg-white border border-slate-200 rounded-full px-4 py-2 text-slate-700 hover:border-blue-300">🧠 I want to evaluate ideas</a>
          <a href="#surveys" className="bg-white border border-slate-200 rounded-full px-4 py-2 text-slate-700 hover:border-blue-300">📊 Market surveys</a>
          <a href="#faq" className="bg-white border border-slate-200 rounded-full px-4 py-2 text-slate-700 hover:border-blue-300">❓ FAQ</a>
        </div>
      </section>

      {/* Watch it first — the fastest way to understand the product. */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-14">
        <WalkthroughPlayer />
      </section>

      {/* Big picture */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: '📝', title: '1. Submit', body: 'Describe your idea once — problem, solution, market, revenue model and team.' },
            { icon: '🔬', title: '2. Get stress-tested', body: 'Approved experts score it across 12 frameworks and tell you its biggest strength and weakness.' },
            { icon: '📈', title: '3. Decide with data', body: 'A scored dashboard, an AI summary, survey evidence and a PDF report — build, pivot, or pass.' },
          ].map((c) => (
            <div key={c.title} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="text-3xl mb-3">{c.icon}</div>
              <h3 className="font-semibold text-slate-900 mb-1">{c.title}</h3>
              <p className="text-sm text-slate-600">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Founder walkthrough */}
      <section id="founders" className="max-w-5xl mx-auto px-4 sm:px-6 pb-16 scroll-mt-20">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 shadow-sm">
          <SectionHeading
            kicker="For founders"
            title="From idea to verdict, step by step"
            blurb="Everything happens in your founder dashboard — no calls, no pitch decks, no waiting weeks."
          />
          <ol>
            <Step n={1} title="Create your account">
              Sign up as a <strong>Founder</strong> with your email and phone, or one click with Google. You&apos;ll land in
              your dashboard immediately.
            </Step>
            <Step n={2} title="Submit your idea">
              One structured form: the problem you&apos;re solving, your solution, target customer, revenue model, current
              stage, and your team with LinkedIn profiles. You&apos;ll also rate your own founder fit (industry knowledge,
              experience, network, passion, skills) — experts later rate the same five things, so you can see where your
              self-image and their assessment differ.
            </Step>
            <Step n={3} title="Complete the submission payment">
              A one-time fee per idea keeps evaluations serious and spam out. Revised versions of the same idea are
              discounted. Your idea goes live to the expert pool the moment payment completes.
            </Step>
            <Step n={4} title="Experts evaluate your idea">
              Approved validators work through a structured 8-step evaluation covering 12 frameworks: market opportunity,
              feasibility, founder fit, revenue potential, scalability, risk assessment, investor attractiveness,
              innovation, social impact, customer validation, a Shark-Tank-style score and a startup success formula —
              plus written feedback on your biggest strength, biggest weakness and one concrete improvement.
            </Step>
            <Step n={5} title="Watch results arrive on your dashboard">
              Your dashboard is available <strong>immediately</strong> — expert validations appear as they come in.
              You get an overall score out of 100, per-framework scores out of 50, a radar chart, a risk heatmap,
              every expert&apos;s written feedback, and which experts opted in to be contacted by you.
            </Step>
            <Step n={6} title="Read the AI summary and download the report">
              One click generates an honest AI analysis of all the scores and feedback — verdict, what&apos;s working, what
              needs work, next steps. Export the whole thing as a PDF report or Excel sheet to share with co-founders or
              investors.
            </Step>
            <Step n={7} title="Back it up with real-market surveys">
              Expert opinion tells you if the idea is sound; surveys tell you if strangers actually want it. Build a
              survey in minutes (see below), share it with a link or QR code, and watch responses land in analytics —
              the strongest signals appear right inside your idea&apos;s dashboard as market evidence.
            </Step>
          </ol>
          <div className="flex flex-wrap gap-3 mt-2">
            <Link href="/auth/register/founder" className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700">
              Validate my idea →
            </Link>
          </div>
        </div>
      </section>

      {/* Expert walkthrough */}
      <section id="experts" className="max-w-5xl mx-auto px-4 sm:px-6 pb-16 scroll-mt-20">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 shadow-sm">
          <SectionHeading
            kicker="For experts"
            title="Become a validator"
            blurb="Lend your industry experience to founders at the moment it matters most — before they build."
          />
          <ol>
            <Step n={1} title="Apply with your professional profile">
              Register as a <strong>Validator</strong> with your occupation, years of experience, areas of expertise and
              LinkedIn profile. Choose whether founders may contact you afterwards — that&apos;s always your call.
            </Step>
            <Step n={2} title="Get approved">
              An admin reviews every application against the LinkedIn profile before approval. This human gate is why a
              score here means something — no anonymous drive-by ratings.
            </Step>
            <Step n={3} title="Pick ideas and evaluate">
              Browse live ideas in your dashboard, open one, and work through the guided 8-step scoring form
              (about 15 minutes). Every scale reads the same way: <strong>higher is always better for the idea</strong> —
              the form spells out what a 1 and a 10 mean on every slider.
            </Step>
            <Step n={4} title="Your feedback reaches the founder">
              Your scores join the aggregate, and your strength / weakness / improvement notes go to the founder
              verbatim. If you opted into contact, founders whose ideas you rated can reach out.
            </Step>
          </ol>
          <div className="flex flex-wrap gap-3 mt-2">
            <Link href="/auth/register/validator" className="bg-white border border-blue-200 text-blue-700 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-50">
              Apply as a validator →
            </Link>
          </div>
        </div>
      </section>

      {/* Surveys */}
      <section id="surveys" className="max-w-5xl mx-auto px-4 sm:px-6 pb-16 scroll-mt-20">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 shadow-sm">
          <SectionHeading
            kicker="Market surveys"
            title="Test real demand with real people"
            blurb="Attached to an idea or standalone — surveys are how you find out whether strangers, not friends, want what you're building."
          />
          <ol>
            <Step n={1} title="Build it in minutes">
              Use the <strong>AI Builder</strong> — paste your questions in plain text and it picks the right field type
              for each (choices, scales, yes/no, free text) — or build manually with 9 question types, including image
              choice for logo and packaging tests.
            </Step>
            <Step n={2} title="Sharpen it like a researcher">
              Optional power tools: A/B test two wordings of the same question (each respondent sees only one),
              consistency-check pairs to catch careless answers, response limits, and a giveaway incentive to lift
              response rates.
            </Step>
            <Step n={3} title="Publish and share anywhere">
              Publishing creates a public link that needs no account and works on any phone. Copy it, or open the{' '}
              <strong>QR code</strong> — show it across a table, paste it into a chat as an image, or download the PNG
              for a poster. Respondents stay anonymous, and giveaway entries are stored completely separately from
              answers, so honesty is safe.
            </Step>
            <Step n={4} title="Read the analytics">
              Response trends, completion time, drop-off per question, automatic quality flags on rushed or
              straight-lined responses, segmentation (&quot;how did students answer vs professionals?&quot;), question impact and
              A/B results — plus CSV export for your own analysis.
            </Step>
            <Step n={5} title="Iterate with versions">
              Published surveys are locked to protect the data. Need changes? One click creates a new draft version —
              the original and its responses stay intact forever.
            </Step>
          </ol>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="max-w-5xl mx-auto px-4 sm:px-6 pb-16 scroll-mt-20">
        <SectionHeading kicker="FAQ" title="Common questions" />
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            {
              q: 'When do I see my results?',
              a: 'Immediately — your dashboard opens as soon as your idea is submitted, and expert validations appear on it as they come in.',
            },
            {
              q: 'What do the scores mean?',
              a: 'Each framework is scored out of 50 (five criteria, 1–10 each) and rolls up into an overall score out of 100. Higher is always better — every slider an expert uses is labeled so complexity, capital needs and regulation are scored consistently.',
            },
            {
              q: 'Who are the validators?',
              a: 'Professionals who applied with their LinkedIn profile and were manually approved by an admin. Each can evaluate your idea exactly once, and their written feedback reaches you word for word.',
            },
            {
              q: 'Is my idea safe here?',
              a: 'Your full submission is only visible to you, approved validators reviewing it, and the platform admin. Other founders can never browse or read your idea.',
            },
            {
              q: 'Are survey respondents really anonymous?',
              a: 'Yes — respondents need no account, and if you run a giveaway, entries are stored with no link to any answers, so a respondent can be honest and still enter.',
            },
            {
              q: 'What if my idea scores badly?',
              a: "That's the product working. Read the weakness notes, fix what's fixable, and resubmit a revised version at a discount — or thank the experts for saving you a year of your life.",
            },
          ].map((f) => (
            <div key={f.q} className="bg-white border border-slate-200 rounded-xl p-5">
              <h4 className="font-semibold text-slate-900 text-sm mb-1.5">{f.q}</h4>
              <p className="text-sm text-slate-600 leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
        <div className="bg-blue-600 rounded-2xl p-10 text-center text-white">
          <h2 className="text-2xl sm:text-3xl font-bold">Stop guessing. Start validating.</h2>
          <p className="text-blue-100 mt-2 max-w-xl mx-auto">Know whether your idea deserves the next year of your life — before you spend it.</p>
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            <Link href="/auth/register/founder" className="bg-white text-blue-700 px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-50">
              Validate my idea →
            </Link>
            <Link href="/auth/register/validator" className="border border-blue-300 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-500">
              Become a validator
            </Link>
          </div>
        </div>
        <p className="text-center text-xs text-slate-400 mt-8">
          <Link href="/" className="hover:text-slate-600">← Back to home</Link>
        </p>
      </section>
    </div>
  );
}
