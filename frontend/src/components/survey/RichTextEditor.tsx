'use client';
import { useRef, useState } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { api } from '@/lib/api';
import { plainToEditorHtml } from '@/lib/richText';

const MAX_IMAGE_MB = 5;

// Enforce a safe, absolute URL. Bare domains get https:// prepended;
// anything that isn't http(s)/mailto is rejected.
function normalizeUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  if (/^(https?:\/\/|mailto:)/i.test(url)) return url;
  if (/^[a-z]+:/i.test(url)) return null;
  return `https://${url}`;
}

function ToolbarButton({ onClick, active, disabled, title, children }: {
  onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault() /* keep editor selection/focus */}
      onClick={onClick}
      disabled={disabled}
      className={`px-2 py-1 rounded text-sm leading-none transition disabled:opacity-30 ${
        active ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Rich-text editor for the survey description. Emits sanitizable HTML
 * (the backend whitelist in survey/rich-text.util.ts is the trust boundary);
 * legacy plain-text values are converted to paragraphs on load. Pasted
 * Google Docs / Word content is parsed by ProseMirror into this schema, so
 * structure (paragraphs, lists, links, bold/italic) survives while
 * vendor junk markup is dropped.
 */
export default function RichTextEditor({ value, onChange, placeholder }: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkNewTab, setLinkNewTab] = useState(true);
  const [imageOpen, setImageOpen] = useState(false);
  const [imageAlt, setImageAlt] = useState('');
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // Not in the toolbar and not in the sanitizer whitelist.
        code: false,
        codeBlock: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
          HTMLAttributes: { rel: 'noopener noreferrer' },
        },
      }),
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content: plainToEditorHtml(value),
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML()),
    editorProps: {
      attributes: { class: 'rich-desc focus:outline-none min-h-[110px] text-sm text-slate-700' },
    },
  });

  if (!editor) {
    return <div className="border border-slate-200 rounded-lg p-3 min-h-[150px] text-sm text-slate-400">Loading editor…</div>;
  }

  const openLinkDialog = (e: Editor) => {
    const attrs = e.getAttributes('link');
    setLinkUrl(attrs.href || '');
    setLinkNewTab(attrs.href ? attrs.target === '_blank' : true);
    setLinkOpen(true);
    setImageOpen(false);
  };

  const applyLink = () => {
    const href = normalizeUrl(linkUrl);
    if (!href) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link')
        .setLink({ href, target: linkNewTab ? '_blank' : null })
        .run();
    }
    setLinkOpen(false);
  };

  const uploadImage = (file: File) => {
    setUploadError('');
    if (!file.type.startsWith('image/')) { setUploadError('Choose an image file (PNG or JPG).'); return; }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setUploadError(`That image is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is ${MAX_IMAGE_MB}MB.`);
      return;
    }
    setUploadPct(0);
    api.getImageUploadSignature()
      .then((sig: any) => {
        const form = new FormData();
        form.append('file', file);
        form.append('api_key', sig.apiKey);
        form.append('timestamp', String(sig.timestamp));
        form.append('signature', sig.signature);
        form.append('folder', sig.folder);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`);
        xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) setUploadPct(Math.round((ev.loaded / ev.total) * 100)); };
        xhr.onload = () => {
          setUploadPct(null);
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const url = JSON.parse(xhr.responseText).secure_url;
              editor.chain().focus().setImage({ src: url, alt: imageAlt.trim() || undefined }).run();
              setImageOpen(false);
              setImageAlt('');
            } catch { setUploadError('Upload finished but the response was unreadable.'); }
          } else {
            let msg = 'Upload failed. Please try again.';
            try { msg = JSON.parse(xhr.responseText)?.error?.message || msg; } catch { /* keep default */ }
            setUploadError(msg);
          }
        };
        xhr.onerror = () => { setUploadPct(null); setUploadError('Upload failed — check your connection.'); };
        xhr.send(form);
      })
      .catch((err: any) => { setUploadPct(null); setUploadError(err.message || 'Could not start the upload.'); });
  };

  const inList = editor.isActive('bulletList') || editor.isActive('orderedList');

  return (
    <div className="border border-slate-200 rounded-lg focus-within:border-blue-400 transition">
      <div className="flex items-center gap-0.5 flex-wrap border-b border-slate-100 px-2 py-1.5">
        <ToolbarButton title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <span className="font-bold">B</span>
        </ToolbarButton>
        <ToolbarButton title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <span className="italic font-serif">I</span>
        </ToolbarButton>
        <ToolbarButton title="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <span className="underline">U</span>
        </ToolbarButton>
        <span className="w-px h-4 bg-slate-200 mx-1" />
        <ToolbarButton title="Heading" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <span className="font-semibold">H</span>
        </ToolbarButton>
        <ToolbarButton title="Small heading" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <span className="font-semibold text-xs">H2</span>
        </ToolbarButton>
        <span className="w-px h-4 bg-slate-200 mx-1" />
        <ToolbarButton title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          •≡
        </ToolbarButton>
        <ToolbarButton title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          1.
        </ToolbarButton>
        <ToolbarButton title="Indent list item" disabled={!inList || !editor.can().sinkListItem('listItem')} onClick={() => editor.chain().focus().sinkListItem('listItem').run()}>
          →
        </ToolbarButton>
        <ToolbarButton title="Outdent list item" disabled={!inList || !editor.can().liftListItem('listItem')} onClick={() => editor.chain().focus().liftListItem('listItem').run()}>
          ←
        </ToolbarButton>
        <span className="w-px h-4 bg-slate-200 mx-1" />
        <ToolbarButton title="Add or edit link" active={editor.isActive('link')} onClick={() => openLinkDialog(editor)}>
          🔗
        </ToolbarButton>
        <ToolbarButton title="Insert image" onClick={() => { setImageOpen((v) => !v); setLinkOpen(false); setUploadError(''); }}>
          🖼
        </ToolbarButton>
        <ToolbarButton title="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          —
        </ToolbarButton>
      </div>

      {linkOpen && (
        <div className="border-b border-slate-100 px-3 py-2 flex items-center gap-2 flex-wrap bg-slate-50">
          <input
            type="text"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } }}
            placeholder="https://example.com"
            className="flex-1 min-w-[180px] text-sm border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:border-blue-400"
            autoFocus
          />
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={linkNewTab} onChange={(e) => setLinkNewTab(e.target.checked)} />
            New tab
          </label>
          <button type="button" onClick={applyLink} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700">Set</button>
          {editor.isActive('link') && (
            <button type="button" onClick={() => { editor.chain().focus().extendMarkRange('link').unsetLink().run(); setLinkOpen(false); }}
              className="text-sm text-red-600 px-2 py-1.5 hover:underline">Remove</button>
          )}
          <button type="button" onClick={() => setLinkOpen(false)} className="text-sm text-slate-500 px-2 py-1.5 hover:text-slate-700">Cancel</button>
        </div>
      )}

      {imageOpen && (
        <div className="border-b border-slate-100 px-3 py-2 flex items-center gap-2 flex-wrap bg-slate-50">
          <input
            type="text"
            value={imageAlt}
            onChange={(e) => setImageAlt(e.target.value)}
            placeholder="Alt text (optional, describes the image)"
            className="flex-1 min-w-[180px] text-sm border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:border-blue-400"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploadPct !== null}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 disabled:opacity-60"
          >
            {uploadPct !== null ? `Uploading ${uploadPct}%` : 'Choose image'}
          </button>
          <button type="button" onClick={() => { setImageOpen(false); setUploadError(''); }} className="text-sm text-slate-500 px-2 py-1.5 hover:text-slate-700">Cancel</button>
          {uploadError && <p className="w-full text-xs text-red-600 font-medium">{uploadError}</p>}
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ''; }} />
        </div>
      )}

      <div className="px-3 py-2 cursor-text relative" onClick={() => editor.chain().focus().run()}>
        {editor.isEmpty && (
          <p className="text-sm text-slate-400 pointer-events-none absolute">{placeholder || 'Description (optional)'}</p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
