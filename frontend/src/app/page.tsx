'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';

const FRAMEWORKS = [
  { icon: '📊', name: 'Market Opportunity', color: 'from-blue-500 to-indigo-600' },
  { icon: '⚙️', name: 'Feasibility', color: 'from-purple-500 to-violet-600' },
  { icon: '👤', name: 'Founder Fit', color: 'from-emerald-500 to-teal-600' },
  { icon: '💰', name: 'Revenue Potential', color: 'from-yellow-500 to-orange-500' },
  { icon: '🚀', name: 'Scalability', color: 'from-red-500 to-rose-600' },
  { icon: '⚠️', name: 'Risk Assessment', color: 'from-slate-500 to-gray-600' },
  { icon: '💼', name: 'Investor Attractiveness', color: 'from-indigo-500 to-purple-600' },
  { icon: '💡', name: 'Innovation', color: 'from-cyan-500 to-blue-500' },
  { icon: '🌍', name: 'Social Impact', color: 'from-green-500 to-emerald-600' },
  { icon: '✅', name: 'Customer Validation', color: 'from-teal-500 to-cyan-600' },
  { icon: '🦈', name: 'Shark Tank Score', color: 'from-violet-500 to-indigo-600' },
  { icon: '🏆', name: 'Startup Success', color: 'from-amber-500 to-yellow-500' },
];

export default function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Three.js — floating 3D mesh
  useEffect(() => {
    let animId: number;
    let cleanup = () => {};

    (async () => {
      const THREE = await import('three');
      const canvas = canvasRef.current;
      if (!canvas) return;

      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100);
      camera.position.z = 5;

      // Main mesh
      const geo = new THREE.IcosahedronGeometry(1.8, 1);
      const mat = new THREE.MeshPhongMaterial({
        color: 0x6366f1,
        emissive: 0x312e81,
        shininess: 80,
        transparent: true,
        opacity: 0.85,
      });
      const mesh = new THREE.Mesh(geo, mat);

      // Wireframe overlay
      const wireGeo = new THREE.IcosahedronGeometry(1.85, 1);
      const wireMat = new THREE.MeshBasicMaterial({ color: 0x818cf8, wireframe: true, transparent: true, opacity: 0.25 });
      const wire = new THREE.Mesh(wireGeo, wireMat);

      const group = new THREE.Group();
      group.add(mesh);
      group.add(wire);
      scene.add(group);

      // Lights
      scene.add(new THREE.AmbientLight(0xffffff, 0.4));
      const pl1 = new THREE.PointLight(0x6366f1, 3, 20);
      pl1.position.set(4, 4, 4);
      scene.add(pl1);
      const pl2 = new THREE.PointLight(0xa855f7, 2, 20);
      pl2.position.set(-4, -3, 2);
      scene.add(pl2);

      // Mouse tracking
      let mx = 0, my = 0;
      const onMouse = (e: MouseEvent) => {
        mx = (e.clientX / window.innerWidth - 0.5) * 2;
        my = -(e.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener('mousemove', onMouse);

      // Resize
      const onResize = () => {
        const w2 = canvas.offsetWidth, h2 = canvas.offsetHeight;
        camera.aspect = w2 / h2;
        camera.updateProjectionMatrix();
        renderer.setSize(w2, h2);
      };
      window.addEventListener('resize', onResize);

      let tx = 0, ty = 0;
      const animate = () => {
        animId = requestAnimationFrame(animate);
        // Auto-rotate
        group.rotation.y += 0.004;
        // Mouse tilt (lerp)
        tx += (my * 0.4 - tx) * 0.04;
        ty += (mx * 0.4 - ty) * 0.04;
        mesh.rotation.x = tx;
        wire.rotation.x = tx;
        mesh.rotation.z = ty * 0.3;
        wire.rotation.z = ty * 0.3;
        renderer.render(scene, camera);
      };
      animate();

      cleanup = () => {
        cancelAnimationFrame(animId);
        window.removeEventListener('mousemove', onMouse);
        window.removeEventListener('resize', onResize);
        renderer.dispose();
      };
    })();

    return () => cleanup();
  }, []);

  // GSAP ScrollTrigger
  useEffect(() => {
    (async () => {
      const { gsap } = await import('gsap');
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);

      // Steps slide in from left
      gsap.fromTo('.step-card',
        { opacity: 0, x: -80, rotateY: -20 },
        {
          opacity: 1, x: 0, rotateY: 0,
          duration: 0.8, stagger: 0.2, ease: 'power3.out',
          scrollTrigger: { trigger: '.steps-section', start: 'top 75%' },
        }
      );

      // Framework cards cascade in
      gsap.fromTo('.fw-card',
        { opacity: 0, y: 50, scale: 0.85 },
        {
          opacity: 1, y: 0, scale: 1,
          duration: 0.5, stagger: 0.06, ease: 'back.out(1.4)',
          scrollTrigger: { trigger: '.fw-section', start: 'top 75%' },
        }
      );

      // Stats pop in
      gsap.fromTo('.stat-item',
        { opacity: 0, scale: 0.7 },
        {
          opacity: 1, scale: 1,
          duration: 0.6, stagger: 0.15, ease: 'back.out(1.7)',
          scrollTrigger: { trigger: '.stats-section', start: 'top 80%' },
        }
      );

      // CTA fade up
      gsap.fromTo('.cta-section',
        { opacity: 0, y: 40 },
        {
          opacity: 1, y: 0,
          duration: 0.8, ease: 'power3.out',
          scrollTrigger: { trigger: '.cta-section', start: 'top 85%' },
        }
      );
    })();
  }, []);

  // 3D card tilt on mouse move
  const handleCardTilt = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = ((e.clientY - rect.top) / rect.height - 0.5) * 16;
    const y = -((e.clientX - rect.left) / rect.width - 0.5) * 16;
    card.style.transform = `perspective(600px) rotateX(${x}deg) rotateY(${y}deg) scale(1.04)`;
  };
  const resetCardTilt = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = '';
  };

  return (
    <div className="overflow-x-hidden">

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gray-950">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

        {/* Depth orbs */}
        <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" style={{ animation: 'pulse 4s ease-in-out infinite' }} />
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" style={{ animation: 'pulse 4s ease-in-out infinite 2s' }} />
        <div className="absolute top-2/3 left-1/2 w-48 h-48 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Gradient fade to next section */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-gray-950 to-transparent pointer-events-none" />

        <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-indigo-300 px-5 py-2 rounded-full text-sm font-medium mb-10 backdrop-blur-sm">
            <span className="w-2 h-2 bg-indigo-400 rounded-full" style={{ animation: 'pulse 2s ease-in-out infinite' }}></span>
            12 Expert Validation Frameworks
          </div>

          <h1 className="text-6xl md:text-8xl font-black text-white mb-6 leading-none tracking-tight">
            Validate Before<br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              You Build
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-400 mb-14 max-w-2xl mx-auto leading-relaxed">
            Get structured, expert feedback on your business idea before you invest your time and money.
          </p>

          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/auth/register/founder"
              className="group bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-9 py-4 rounded-xl text-lg font-bold transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-indigo-500/40">
              Validate My Idea →
            </Link>
            <Link href="/auth/register/validator"
              className="border border-white/20 text-gray-300 px-9 py-4 rounded-xl text-lg font-semibold hover:border-indigo-400 hover:text-white hover:bg-indigo-600/10 transition-all duration-300 hover:scale-105 backdrop-blur-sm">
              Become a Validator
            </Link>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-gray-600" style={{ animation: 'bounce 2s infinite' }}>
          <span className="text-xs tracking-[0.2em] uppercase">Scroll</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="steps-section py-32 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <span className="text-indigo-600 font-bold text-xs tracking-[0.2em] uppercase">Process</span>
            <h2 className="text-5xl font-black text-gray-900 mt-3">How It Works</h2>
            <p className="text-gray-500 mt-4 text-lg max-w-xl mx-auto">Three simple steps from idea to expert insight.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', icon: '📝', title: 'Submit Your Idea', desc: 'Fill a structured form covering your problem, solution, target market, revenue model, and founder background.', accent: 'border-indigo-200 bg-indigo-50' },
              { step: '02', icon: '🔍', title: 'Experts Review It', desc: 'Approved validators score your idea across 12 structured frameworks — market, feasibility, risk, innovation, and more.', accent: 'border-purple-200 bg-purple-50' },
              { step: '03', icon: '✦', title: 'Get AI Dashboard', desc: 'Access your comprehensive validation dashboard with scores, feedback, AI-generated summary, and interested contacts.', accent: 'border-pink-200 bg-pink-50' },
            ].map(item => (
              <div key={item.step}
                className={`step-card relative rounded-2xl p-8 border-2 ${item.accent} transition-all duration-300 cursor-default`}
                style={{ transformStyle: 'preserve-3d', transition: 'transform 0.3s ease, box-shadow 0.3s ease' }}
                onMouseMove={handleCardTilt}
                onMouseLeave={resetCardTilt}>
                <div className="text-5xl mb-5">{item.icon}</div>
                <div className="absolute top-6 right-8 text-8xl font-black text-black/5 select-none">{item.step}</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 12 FRAMEWORKS ── */}
      <section className="fw-section py-32 px-6 bg-gray-950">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <span className="text-indigo-400 font-bold text-xs tracking-[0.2em] uppercase">Comprehensive</span>
            <h2 className="text-5xl font-black text-white mt-3">12 Validation Frameworks</h2>
            <p className="text-gray-400 mt-4 text-lg">Your idea is scored across every dimension that matters to investors and the market.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {FRAMEWORKS.map((f) => (
              <div key={f.name}
                className={`fw-card group relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br ${f.color} cursor-default`}
                style={{ transformStyle: 'preserve-3d', transition: 'transform 0.3s ease, box-shadow 0.3s ease' }}
                onMouseMove={handleCardTilt}
                onMouseLeave={resetCardTilt}>
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-200">{f.icon}</div>
                <p className="text-white font-semibold text-sm leading-tight">{f.name}</p>
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-200 rounded-2xl" />
                <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/5 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="stats-section py-32 px-6 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, white 1px, transparent 1px), radial-gradient(circle at 75% 75%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative max-w-5xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-20">Built for Founders,<br />Powered by Experts</h2>
          <div className="grid md:grid-cols-3 gap-12">
            {[
              { value: '12', label: 'Validation Frameworks', sub: 'Every angle covered' },
              { value: '100%', label: 'Anonymous Reviews', sub: 'All submissions private' },
              { value: 'Free', label: 'For Validators', sub: 'No cost to participate' },
            ].map(s => (
              <div key={s.value} className="stat-item">
                <div className="text-7xl font-black text-white mb-3">{s.value}</div>
                <div className="text-white/90 font-bold text-xl">{s.label}</div>
                <div className="text-white/50 text-sm mt-1">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta-section py-40 px-6 bg-gray-950 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-5xl md:text-6xl font-black text-white mb-6">Ready to Validate?</h2>
          <p className="text-gray-400 text-xl mb-14 leading-relaxed">Stop guessing. Get real, structured feedback<br />from real experts — before you build.</p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/auth/register/founder"
              className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-12 py-5 rounded-2xl text-xl font-bold hover:scale-105 hover:shadow-2xl hover:shadow-indigo-500/40 transition-all duration-300">
              Validate My Idea →
            </Link>
            <Link href="/auth/login"
              className="border border-white/20 text-gray-300 px-8 py-5 rounded-2xl text-xl font-semibold hover:border-white/40 hover:text-white transition-all duration-300">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <div className="bg-gray-950 border-t border-white/5 py-8 text-center text-gray-600 text-sm">
        © 2026 IdeaValidator · Built for founders
      </div>
    </div>
  );
}
