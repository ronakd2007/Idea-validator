'use client';
import { useState } from 'react';
import {
  IP_TYPES, IP_STATUSES, INDIAN_STATES, IP_PUBLIC_FIELD_OPTIONS, IP_STATUS_SOURCE_NOTE,
} from '@/lib/ipTypes';
import DocumentUpload, { UploadedDocument } from './DocumentUpload';

export interface IpFormValue {
  title: string;
  type: string;
  description: string;
  ideaId: string;
  status: string;
  applicationNumber: string;
  filingDate: string;
  jurisdiction: string;
  authority: string;
  inventorNames: string;
  ownerName: string;
  publicUrl: string;
  city: string;
  state: string;
  institution: string;
  notes: string;
  makePublic: boolean;
  publicFields: Record<string, boolean>;
}

export const emptyIpForm: IpFormValue = {
  title: '', type: 'PATENT', description: '', ideaId: '', status: 'PLANNED',
  applicationNumber: '', filingDate: '', jurisdiction: '', authority: '',
  inventorNames: '', ownerName: '', publicUrl: '', city: '', state: '',
  institution: '', notes: '', makePublic: false,
  publicFields: { showFilingDate: false, showApplicationNumber: false, showPublicUrl: false, showInstitution: false },
};

/** Server payload from the form's own shape. Blank strings become undefined so
 *  an untouched optional field is simply absent rather than an empty value. */
export function toIpPayload(form: IpFormValue) {
  const blank = (v: string) => (v.trim() ? v.trim() : undefined);
  return {
    title: form.title.trim(),
    type: form.type,
    description: blank(form.description),
    ideaId: blank(form.ideaId),
    status: form.status,
    applicationNumber: blank(form.applicationNumber),
    // A date input gives YYYY-MM-DD; the API wants a full ISO string.
    filingDate: form.filingDate ? new Date(`${form.filingDate}T00:00:00.000Z`).toISOString() : undefined,
    jurisdiction: blank(form.jurisdiction),
    authority: blank(form.authority),
    inventorNames: form.inventorNames.split(',').map((n) => n.trim()).filter(Boolean),
    ownerName: blank(form.ownerName),
    publicUrl: blank(form.publicUrl),
    city: blank(form.city),
    state: blank(form.state),
    institution: blank(form.institution),
    notes: blank(form.notes),
    makePublic: form.makePublic,
    publicFields: form.publicFields,
  };
}

/** Server record back into form state. */
export function fromIpRecord(record: any): IpFormValue {
  return {
    title: record.title ?? '',
    type: record.type ?? 'PATENT',
    description: record.description ?? '',
    ideaId: record.ideaId ?? '',
    status: record.status ?? 'PLANNED',
    applicationNumber: record.applicationNumber ?? '',
    filingDate: record.filingDate ? String(record.filingDate).slice(0, 10) : '',
    jurisdiction: record.jurisdiction ?? '',
    authority: record.authority ?? '',
    inventorNames: (record.inventorNames ?? []).join(', '),
    ownerName: record.ownerName ?? '',
    publicUrl: record.publicUrl ?? '',
    city: record.city ?? '',
    state: record.state ?? '',
    institution: record.institution ?? '',
    notes: record.notes ?? '',
    makePublic: record.visibility === 'PUBLIC',
    publicFields: { ...emptyIpForm.publicFields, ...(record.publicFields ?? {}) },
  };
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

function Section({ title, blurb, children }: { title: string; blurb?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {blurb && <p className="text-sm text-slate-500 mt-1 mb-5">{blurb}</p>}
      <div className={blurb ? 'space-y-5' : 'space-y-5 mt-5'}>{children}</div>
    </section>
  );
}

const inputCls =
  'w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

/**
 * Create/edit form for an IP record.
 *
 * Only title and type are required — a founder recording something they have
 * not filed yet must not be blocked by an application number they don't have.
 *
 * The publish checkbox is deliberately the last thing on the page and states
 * exactly what it does: ticking it submits the record for review, it does not
 * publish anything on its own.
 */
export default function IpRecordForm({
  value,
  onChange,
  ideas,
  documents,
  onAddDocument,
  onRemoveDocument,
  documentsDisabled,
  documentsDisabledNote,
}: {
  value: IpFormValue;
  onChange: (next: IpFormValue) => void;
  ideas: { id: string; title: string }[];
  documents: UploadedDocument[];
  onAddDocument: (doc: UploadedDocument) => void | Promise<void>;
  onRemoveDocument: (doc: UploadedDocument, index: number) => void | Promise<void>;
  documentsDisabled?: boolean;
  documentsDisabledNote?: string;
}) {
  const [showOptional, setShowOptional] = useState(
    // Open the optional block automatically when it already has something in it.
    !!(value.applicationNumber || value.filingDate || value.jurisdiction || value.authority ||
      value.inventorNames || value.ownerName || value.publicUrl)
  );
  const set = (patch: Partial<IpFormValue>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-6">
      <Section title="The basics" blurb="Just enough to save the record. You can fill in the rest whenever you have it.">
        <Field label="Title *">
          <input
            className={inputCls}
            value={value.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="e.g. KisanCold Cooling System"
            maxLength={200}
          />
        </Field>

        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Type *">
            <select className={inputCls} value={value.type} onChange={(e) => set({ type: e.target.value })}>
              {IP_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Current status" hint={IP_STATUS_SOURCE_NOTE + ' — we do not check this with any patent office.'}>
            <select className={inputCls} value={value.status} onChange={(e) => set({ status: e.target.value })}>
              {IP_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Short description" hint="What does it cover? A couple of plain sentences is plenty.">
          <textarea
            className={inputCls}
            rows={4}
            value={value.description}
            onChange={(e) => set({ description: e.target.value })}
            maxLength={4000}
            placeholder="A solar-powered cold storage unit that keeps produce fresh for smallholder farms without grid electricity."
          />
        </Field>

        {ideas.length > 0 && (
          <Field label="Linked idea" hint="Optional — connects this record to an idea you already submitted.">
            <select className={inputCls} value={value.ideaId} onChange={(e) => set({ ideaId: e.target.value })}>
              <option value="">Not linked to an idea</option>
              {ideas.map((i) => (
                <option key={i.id} value={i.id}>{i.title}</option>
              ))}
            </select>
          </Field>
        )}
      </Section>

      <Section
        title="Where you are"
        blurb="Used for ecosystem statistics — for example, how much patent activity is coming out of Gujarat."
      >
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="State">
            <select className={inputCls} value={value.state} onChange={(e) => set({ state: e.target.value })}>
              <option value="">Prefer not to say</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="City">
            <input
              className={inputCls}
              value={value.city}
              onChange={(e) => set({ city: e.target.value })}
              placeholder="e.g. Ahmedabad"
              maxLength={120}
            />
          </Field>
        </div>
        <Field label="College / institution" hint="Optional. Helpful if this came out of a college project or lab.">
          <input
            className={inputCls}
            value={value.institution}
            onChange={(e) => set({ institution: e.target.value })}
            placeholder="e.g. LD College of Engineering"
            maxLength={200}
          />
        </Field>
      </Section>

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <button
          type="button"
          onClick={() => setShowOptional((v) => !v)}
          className="w-full flex items-center justify-between text-left"
        >
          <span>
            <span className="block text-lg font-semibold text-slate-900">Filing details</span>
            <span className="block text-sm text-slate-500 mt-1">
              All optional — skip anything you don&apos;t have yet.
            </span>
          </span>
          <span className="text-slate-400 text-sm shrink-0 ml-4">{showOptional ? 'Hide' : 'Show'}</span>
        </button>

        {showOptional && (
          <div className="space-y-5 mt-5 pt-5 border-t border-slate-100">
            <div className="grid sm:grid-cols-2 gap-5">
              <Field label="Application number">
                <input
                  className={inputCls}
                  value={value.applicationNumber}
                  onChange={(e) => set({ applicationNumber: e.target.value })}
                  placeholder="e.g. 202521012345"
                  maxLength={120}
                />
              </Field>
              <Field label="Filing date">
                <input
                  type="date"
                  className={inputCls}
                  value={value.filingDate}
                  onChange={(e) => set({ filingDate: e.target.value })}
                />
              </Field>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <Field label="Country / jurisdiction">
                <input
                  className={inputCls}
                  value={value.jurisdiction}
                  onChange={(e) => set({ jurisdiction: e.target.value })}
                  placeholder="e.g. India"
                  maxLength={80}
                />
              </Field>
              <Field label="Patent office / authority">
                <input
                  className={inputCls}
                  value={value.authority}
                  onChange={(e) => set({ authority: e.target.value })}
                  placeholder="e.g. Indian Patent Office"
                  maxLength={160}
                />
              </Field>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <Field label="Inventor(s)" hint="Separate names with commas.">
                <input
                  className={inputCls}
                  value={value.inventorNames}
                  onChange={(e) => set({ inventorNames: e.target.value })}
                  placeholder="Asha Patel, Ravi Shah"
                />
              </Field>
              <Field label="Owner / applicant" hint="The person or company that holds it.">
                <input
                  className={inputCls}
                  value={value.ownerName}
                  onChange={(e) => set({ ownerName: e.target.value })}
                  maxLength={160}
                />
              </Field>
            </div>

            <Field label="Public patent-office link" hint="If the filing has a page anyone can look up.">
              <input
                className={inputCls}
                value={value.publicUrl}
                onChange={(e) => set({ publicUrl: e.target.value })}
                placeholder="https://…"
                maxLength={400}
              />
            </Field>
          </div>
        )}
      </section>

      <Section title="Documents & notes" blurb="Both stay private. Neither is ever shown on the public registry.">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Supporting documents</label>
          {documentsDisabled ? (
            <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
              {documentsDisabledNote ?? 'Save the record first, then you can attach files.'}
            </p>
          ) : (
            <DocumentUpload documents={documents} onAdd={onAddDocument} onRemove={onRemoveDocument} />
          )}
        </div>

        <Field label="Notes" hint="Only you and the review team can read these.">
          <textarea
            className={inputCls}
            rows={3}
            value={value.notes}
            onChange={(e) => set({ notes: e.target.value })}
            maxLength={4000}
          />
        </Field>
      </Section>

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900">Who can see this</h2>
        <p className="text-sm text-slate-500 mt-1 mb-5">
          Private by default. Nothing here appears anywhere public unless you tick the box below
          <span className="font-medium text-slate-600"> and </span>
          our team approves it.
        </p>

        <label className="flex items-start gap-3 cursor-pointer bg-slate-50 border border-slate-200 rounded-lg p-4">
          <input
            type="checkbox"
            checked={value.makePublic}
            onChange={(e) => set({ makePublic: e.target.checked })}
            className="mt-0.5 w-4 h-4 accent-blue-600"
          />
          <span>
            <span className="block text-sm font-medium text-slate-800">
              Show this record on the public registry
            </span>
            <span className="block text-xs text-slate-500 mt-1">
              Ticking this sends the record to our team for review. It only goes live once they approve it,
              and you can untick this at any time to take it straight back down.
            </span>
          </span>
        </label>

        {value.makePublic && (
          <div className="mt-5 pt-5 border-t border-slate-100">
            <p className="text-sm font-medium text-slate-700">If it&apos;s approved, the registry will show:</p>
            <p className="text-sm text-slate-500 mt-1.5">
              Your name, the title, type, description, status, country, filing year, and your city and state.
            </p>

            <p className="text-sm font-medium text-slate-700 mt-5 mb-2">Also show these? (all hidden by default)</p>
            <div className="space-y-2">
              {IP_PUBLIC_FIELD_OPTIONS.map((opt) => (
                <label key={opt.key} className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!value.publicFields[opt.key]}
                    onChange={(e) => set({ publicFields: { ...value.publicFields, [opt.key]: e.target.checked } })}
                    className="mt-0.5 w-4 h-4 accent-blue-600"
                  />
                  <span className="text-sm text-slate-700">
                    {opt.label} <span className="text-slate-400">— {opt.hint}</span>
                  </span>
                </label>
              ))}
            </div>

            <p className="text-xs text-slate-500 mt-5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
              Your notes, documents, inventor names and owner name are never published, whatever you pick here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
