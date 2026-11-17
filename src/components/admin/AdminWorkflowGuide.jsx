import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Compass,
  CreditCard,
  FileQuestion,
  GraduationCap,
  Layers,
  Sparkles,
  Tag,
  Users,
  Wrench,
  CheckCircle2
} from 'lucide-react';

const WORKFLOW_STEPS = [
  {
    step: '1',
    title: '1. पाठ्यक्रम व अध्याय बनाएं (Content Manager)',
    subtitle: 'Exam ➔ Folder ➔ Chapter Tree',
    desc: 'छात्रों के लिए सबसे पहले Exam (उदा. BPSC), उसके अंदर विषय फ़ोल्डर (उदा. इतिहास) और फिर Chapters बनाएं। नोट्स व PDF भी यहीं अपलोड होते हैं।',
    to: '/admin/content',
    badge: 'पहला कदम',
    badgeColor: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    Icon: BookOpen
  },
  {
    step: '2',
    title: '2. सवाल जोड़ें या इम्पोर्ट करें (Question Bank)',
    subtitle: 'Bilingual (Hindi + English) & Math',
    desc: 'प्रश्न बैंक में प्रश्न बनाएं या CSV से एक साथ सैकड़ों सवाल अपलोड करें। हर प्रश्न को उसके संबंधित Chapter से जोड़ें और सही उत्तर मार्क करें।',
    to: '/admin/qbank',
    badge: 'दूसरा कदम',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    Icon: FileQuestion
  },
  {
    step: '3',
    title: '3. मॉक टेस्ट कॉन्फ़िगर करें (Test Manager)',
    subtitle: 'Timer, Negative Marks & 4/5 Options',
    desc: 'अध्याय या विषय चुनें, 4-विकल्प या BPSC 5-विकल्प पैटर्न सेट करें, समय व अंक तय करें और प्रश्न बैंक से सवाल जोड़कर टेस्ट लाइव (Published) करें।',
    to: '/admin/tests',
    badge: 'तीसरा कदम',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    Icon: GraduationCap
  },
  {
    step: '4',
    title: '4. फ़ीस व कूपन तय करें (Pricing & Offers)',
    subtitle: 'Free Tier, Paid Packs & Discounts',
    desc: 'तय करें कि कौन सा कोर्स या टेस्ट हमेशा Free रहेगा और किसकी क्या कीमत होगी। छात्रों के लिए डिस्काउंट कूपन और कॉम्बो पास भी यहीं से मैनेज करें।',
    to: '/admin/pricing',
    badge: 'चौथा कदम',
    badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    Icon: Tag
  }
];

const DAILY_OPERATIONS = [
  {
    title: 'छात्र को मैन्युअल एक्सेस देना',
    desc: 'Users & Access में जाकर किसी भी छात्र को खोजें और "Grant Access" से कोई भी कोर्स सीधे अनलॉक करें।',
    to: '/admin/users',
    Icon: Users
  },
  {
    title: 'Question of the Day व बैनर लगाना',
    desc: 'Engagement में जाकर होम स्क्रीन का हीरो बैनर बदलें और छात्रों के लिए आज का दैनिक सवाल सेट करें।',
    to: '/admin/engagement',
    Icon: Sparkles
  },
  {
    title: 'टूलबॉक्स और प्रो टूल्स (Flashcards / Vault)',
    desc: 'Tools Manager में जाकर तय करें कि Flashcards और Mistake Vault छात्रों को फ्री मिलेंगे या पेड।',
    to: '/admin/tools',
    Icon: Wrench
  },
  {
    title: 'पेमेंट और लेन-देन ऑडिट',
    desc: 'Orders & Payments में जाकर Razorpay ऑर्डर स्थिति, पेंडिंग पेमेंट और यूजर ईमेल की लाइव जांच करें।',
    to: '/admin/orders',
    Icon: CreditCard
  }
];

export default function AdminWorkflowGuide() {
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('zyvra_admin_guide_open');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggle = () => {
    setIsOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('zyvra_admin_guide_open', String(next));
      } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <section className="rounded-3xl border dark:border-indigo-500/30 border-indigo-200 dark:bg-gradient-to-br dark:from-slate-900/90 dark:via-[#131b2e] dark:to-slate-900/90 bg-white p-4 sm:p-6 shadow-md transition-all">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 cursor-pointer select-none" onClick={toggle}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Compass className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                नया एडमिन गाइड / WORKFLOW CHEATSHEET
              </span>
              <span className="text-xs text-slate-400 hidden sm:inline">• Zyvra कैसे काम करता है?</span>
            </div>
            <h2 className="text-sm sm:text-base font-black dark:text-white text-slate-900 tracking-tight mt-0.5">
              4 स्टेप्स में पूरा सिस्टम समझें (कंटेंट से लेकर पब्लिशिंग तक)
            </h2>
          </div>
        </div>

        <button
          type="button"
          aria-expanded={isOpen}
          className="px-3 py-1.5 rounded-xl dark:bg-slate-800 bg-slate-100 hover:dark:bg-slate-700 text-xs font-bold dark:text-slate-200 text-slate-700 flex items-center gap-1.5 transition-all shrink-0"
        >
          <span>{isOpen ? 'गाइड छुपाएं' : 'गाइड देखें'}</span>
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Expandable Body */}
      {isOpen && (
        <div className="mt-5 space-y-6 pt-5 border-t dark:border-slate-800 border-slate-200 animate-fadeIn">
          {/* 4 Steps Timeline */}
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Layers size={13} className="text-indigo-400" />
              <span>कंटेंट तैयार और पब्लिश करने का सही क्रम:</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {WORKFLOW_STEPS.map((s) => {
                const Icon = s.Icon;
                return (
                  <div
                    key={s.step}
                    className="p-4 rounded-2xl dark:bg-slate-800/60 bg-slate-50 border dark:border-slate-700/60 border-slate-200 flex flex-col justify-between space-y-3 hover:border-indigo-500/50 transition-all group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${s.badgeColor}`}>
                          {s.badge}
                        </span>
                        <div className="w-7 h-7 rounded-xl dark:bg-slate-900 bg-white flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                          <Icon size={14} />
                        </div>
                      </div>

                      <h3 className="text-xs font-black dark:text-white text-slate-900 leading-snug">
                        {s.title}
                      </h3>
                      <div className="text-[10px] font-bold text-indigo-400">
                        {s.subtitle}
                      </div>
                      <p className="text-[11px] dark:text-slate-400 text-slate-600 leading-relaxed">
                        {s.desc}
                      </p>
                    </div>

                    <Link
                      to={s.to}
                      className="pt-2 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 transition-colors"
                    >
                      <span>यहाँ जाएं</span>
                      <span>→</span>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Operations Cheatsheet */}
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-400" />
              <span>दैनिक एडमिन कार्य (Quick Operations Reference):</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {DAILY_OPERATIONS.map((op, idx) => {
                const Icon = op.Icon;
                return (
                  <Link
                    key={idx}
                    to={op.to}
                    className="p-3 rounded-2xl dark:bg-slate-900/60 bg-slate-50 border dark:border-slate-800 border-slate-200 hover:border-indigo-500/40 flex items-start gap-2.5 transition-all group"
                  >
                    <div className="w-7 h-7 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                      <Icon size={14} />
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold dark:text-slate-200 text-slate-800 group-hover:text-indigo-400 transition-colors">
                        {op.title}
                      </h4>
                      <p className="text-[10px] dark:text-slate-400 text-slate-500 leading-relaxed">
                        {op.desc}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
