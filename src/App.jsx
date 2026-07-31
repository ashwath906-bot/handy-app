import { useState, useEffect, useCallback, useRef } from "react";
import {
  ShoppingCart, Bell, Calendar, Home, Plus, Check, Trash2,
  Clock, MapPin, X, Users, Link2, Copy, LogOut, Lock, Pencil,
  Mic, Wallet, Fuel, Zap, UtensilsCrossed, Car, Heart, Home as HomeIcon,
  Gift, Shirt, Plane, MoreHorizontal, HelpCircle, Cake, Share2, ChevronRight,
} from "lucide-react";
import { supabase } from "./supabase.js";

const COLORS = [
  { bg: "bg-teal-100", text: "text-teal-800" },
  { bg: "bg-violet-100", text: "text-violet-800" },
  { bg: "bg-orange-100", text: "text-orange-800" },
  { bg: "bg-pink-100", text: "text-pink-800" },
  { bg: "bg-amber-100", text: "text-amber-800" },
  { bg: "bg-sky-100", text: "text-sky-800" },
];
const STORE_DOT = ["bg-teal-500", "bg-violet-500", "bg-orange-500", "bg-pink-500", "bg-amber-500", "bg-sky-500"];
const STORE_TEXT = ["text-teal-700", "text-violet-700", "text-orange-700", "text-pink-700", "text-amber-700", "text-sky-700"];

const DEFAULT_EXPENSE_CATS = [
  { name: "Groceries", icon: "cart" },
  { name: "Fuel", icon: "fuel" },
  { name: "Utilities", icon: "zap" },
  { name: "Dining out", icon: "food" },
  { name: "Transport", icon: "car" },
  { name: "Health", icon: "heart" },
  { name: "Rent", icon: "home" },
  { name: "Other", icon: "more" },
];
const CAT_ICONS = {
  cart: ShoppingCart, fuel: Fuel, zap: Zap, food: UtensilsCrossed, car: Car,
  heart: Heart, home: HomeIcon, gift: Gift, shirt: Shirt, plane: Plane,
  wallet: Wallet, more: MoreHorizontal,
};
const CatIcon = ({ icon, size = 15, className = "" }) => {
  const Ico = CAT_ICONS[icon] || Wallet;
  return <Ico size={size} className={className} />;
};

const speechSupported = typeof window !== "undefined" &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

/* Tap-to-talk hook. onResult gets the final transcript string. */
function useSpeech(onResult) {
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const start = () => {
    if (!speechSupported) return;
    if (listening) { try { recRef.current && recRef.current.stop(); } catch { /* ignore */ } return; }
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new Rec();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript.trim();
      if (text) onResult(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try { rec.start(); } catch { setListening(false); }
  };
  return { listening, start, supported: !!speechSupported };
}

function MicButton({ listening, onClick }) {
  return (
    <button onClick={onClick} aria-label={listening ? "Stop listening" : "Add by voice"}
      className={`h-10 px-3 rounded-xl border shrink-0 flex items-center justify-center ${listening ? "bg-teal-600 border-teal-600 text-white animate-pulse" : "bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100"}`}>
      <Mic size={17} />
    </button>
  );
}

const HELP = {
  landing: {
    title: "Welcome to Handy APP",
    tips: [
      ["users", "One shared space", "A household is your shared space — everyone in it sees the same shopping list, reminders, and events, updating live."],
      ["plus", "Starting fresh?", "Tap New household, name it, and add your family. You'll get an invite link to share with them."],
      ["link", "Someone invited you?", "Tap Join with code and paste the code (or open their invite link). You'll join their household."],
      ["lock", "Save your invite link", "Once you're in, open the Family panel and copy your invite link. Keep it somewhere safe — it's how you get back in if your phone forgets."],
    ],
  },
  home: {
    title: "Using Home",
    tips: [
      ["home", "Your daily glance", "Everything that needs attention in one place — items to buy, reminders you can see, and upcoming events."],
      ["cake", "Birthday alerts", "The day before a birthday, a dark banner appears here. On the day itself it turns festive with a Wish button to send a card."],
      ["check", "Tick things off here", "Tap the circle next to a shopping item to mark it bought, without leaving this page."],
      ["users", "Who added what", "The coloured initial shows which family member added each thing."],
    ],
  },
  birthdays: {
    title: "Using Birthdays",
    tips: [
      ["cake", "Add a birthday", "Switch to the Birthdays tab, enter a name and date of birth, tap +. The list shows who's next and the age they're turning."],
      ["home", "You'll be reminded", "The day before, Home shows a dark reminder banner. On the day, it turns festive with a Wish button."],
      ["gift", "Send a wish", "Tap Wish to make a birthday card — pick a design, then share it by WhatsApp or your phone's share sheet. No phone numbers are stored."],
    ],
  },
  shopping: {
    title: "Using Shopping",
    tips: [
      ["cart", "Add an item", "Type it, pick a store, tap +. Or tap the mic and say \"milk from Costco\"."],
      ["store", "Organise by store", "Tap Edit stores to add the shops you use. Tap a store chip to see only its items while you shop."],
      ["check", "Tick as you go", "Check items off as they go in the trolley. Tap Clear done to tidy up after the trip."],
    ],
  },
  reminders: {
    title: "Using Reminders",
    tips: [
      ["bell", "Add a reminder", "Type it, set a date and time, tap Add. Overdue ones turn red and jump to the top."],
      ["lock", "Choose who sees it", "Just me keeps it private. Tap a name to share with certain people, or Everyone for the whole household."],
      ["clock", "A note on alerts", "Pop-ups only work while the app is open — it can't ring your phone when fully closed. Treat it as a shared list you check."],
    ],
  },
  events: {
    title: "Using Events",
    tips: [
      ["calendar", "Add an event", "Give it a title and date. Time, location, and notes are optional — the address shows right on the card."],
      ["link", "Link a shopping run", "Planning a party? Link a store, and jump straight to that shopping list from the event."],
      ["cake", "Birthdays too", "Switch to the Birthdays tab to add them — you'll get a home reminder the day before and a shareable card on the day."],
      ["clock", "Past events fade", "Once they're done, events dim and drop to the bottom automatically."],
    ],
  },
  expenses: {
    title: "Using Expenses",
    tips: [
      ["wallet", "Log a spend", "Pick the date and category, type the amount, tap Add. The month's total shows at the top."],
      ["calendar", "Browse by month", "Use the arrows by the month name to look back at previous months."],
      ["store", "Your categories", "Tap Edit categories to add or rename them — like adding Childcare or Subscriptions."],
    ],
  },
};
const HELP_ICONS = {
  users: Users, plus: Plus, link: Link2, lock: Lock, home: Home, check: Check,
  cart: ShoppingCart, store: ShoppingCart, bell: Bell, clock: Clock, calendar: Calendar, wallet: Wallet, cake: Cake, gift: Gift,
};

function HelpSheet({ page, onClose }) {
  const content = HELP[page];
  if (!content) return null;
  return (
    <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-[60]" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-medium text-stone-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center text-sm">?</span>
            {content.title}
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-stone-400"><X size={18} /></button>
        </div>
        <div className="space-y-3.5">
          {content.tips.map(([icon, head, body], i) => {
            const Ico = HELP_ICONS[icon] || HelpCircle;
            return (
              <div key={i} className="flex gap-3">
                <Ico size={17} className="text-teal-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-stone-800">{head}</p>
                  <p className="text-xs text-stone-500 mt-0.5">{body}</p>
                </div>
              </div>
            );
          })}
        </div>
        <button onClick={onClose} className="w-full h-10 mt-5 bg-teal-600 text-white text-sm rounded-xl hover:bg-teal-700">
          Got it
        </button>
      </div>
    </div>
  );
}

const HH_KEY = "handy_household";
const ME_KEY = "handy_me";

/* Storage that survives browser eviction better than localStorage alone.
   Writes to both localStorage and a 1-year cookie; reads from either. */
const readCookie = (key) => {
  const hit = document.cookie.split("; ").find((c) => c.startsWith(key + "="));
  return hit ? decodeURIComponent(hit.slice(key.length + 1)) : null;
};
const store = {
  get(key) {
    try {
      const v = localStorage.getItem(key);
      if (v != null) return v;
    } catch { /* localStorage blocked */ }
    return readCookie(key);
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* quota or blocked */ }
    try {
      document.cookie = `${key}=${encodeURIComponent(value)}; max-age=31536000; path=/; SameSite=Lax`;
    } catch { /* cookies blocked */ }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    try { document.cookie = `${key}=; max-age=0; path=/; SameSite=Lax`; } catch { /* ignore */ }
  },
};

const initial = (name) => (name || "?").trim().charAt(0).toUpperCase();

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};
const fmtTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${ampm}`;
};
const fmtDue = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `Today · ${time}`;
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${time}`;
};
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Days until the next occurrence of a birthday (0 = today, 1 = tomorrow).
const daysUntilBirthday = (dob) => {
  const b = new Date(dob + "T00:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(today.getFullYear(), b.getMonth(), b.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, b.getMonth(), b.getDate());
  return Math.round((next - today) / (24 * 60 * 60 * 1000));
};
const turningAge = (dob) => {
  const b = new Date(dob + "T00:00:00");
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const hadThisYear = new Date(now.getFullYear(), b.getMonth(), b.getDate()) <= new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // age they turn on their next birthday
  return hadThisYear ? age + 1 : age;
};
const fmtBirthday = (dob) => {
  const b = new Date(dob + "T00:00:00");
  return b.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
const daysLabel = (n) => (n === 0 ? "today" : n === 1 ? "tomorrow" : `${n} days`);

function Avatar({ members, id, size = "w-7 h-7 text-xs" }) {
  const i = members.findIndex((m) => m.id === id);
  const c = COLORS[(i < 0 ? 0 : i) % COLORS.length];
  const m = members.find((x) => x.id === id);
  return (
    <div className={`${size} ${c.bg} ${c.text} rounded-full flex items-center justify-center font-medium shrink-0`}>
      {initial(m ? m.name : "?")}
    </div>
  );
}

function Logo({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true" className="shrink-0">
      <rect width="120" height="120" rx="27" fill="#0D9488" />
      <line x1="36" y1="30" x2="36" y2="90" stroke="#fff" strokeWidth="13" strokeLinecap="round" />
      <line x1="84" y1="30" x2="84" y2="90" stroke="#fff" strokeWidth="13" strokeLinecap="round" />
      <path d="M36 62 L56 76 L84 42" fill="none" stroke="#fff" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const storeIndex = (stores, id) => stores.findIndex((s) => s.id === id);
const storeDot = (stores, id) => {
  const i = storeIndex(stores, id);
  return i < 0 ? "bg-stone-400" : STORE_DOT[i % STORE_DOT.length];
};
const storeText = (stores, id) => {
  const i = storeIndex(stores, id);
  return i < 0 ? "text-stone-500" : STORE_TEXT[i % STORE_TEXT.length];
};

export default function App() {
  const [household, setHousehold] = useState(() => {
    try { return JSON.parse(store.get(HH_KEY) || "null"); } catch { return null; }
  });
  const [me, setMe] = useState(() => store.get(ME_KEY) || null);
  const [members, setMembers] = useState([]);
  const [items, setItems] = useState([]);
  const [stores, setStores] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [events, setEvents] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [expenseCats, setExpenseCats] = useState([]);
  const [birthdays, setBirthdays] = useState([]);
  const [loading, setLoading] = useState(!!household);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("home");
  const [storeFilter, setStoreFilter] = useState("all");
  const [showMembers, setShowMembers] = useState(false);
  const [helpPage, setHelpPage] = useState(null);
  const [eventsSub, setEventsSub] = useState("events");
  const notified = useRef(new Set());
  const seededCats = useRef(false);

  const fetchAll = useCallback(async () => {
    if (!household) return;
    const hid = household.id;
    try {
      const [m, li, r, ev, st, ex, ec, bd] = await Promise.all([
        supabase.from("handy_members").select("*").eq("household_id", hid).order("created_at"),
        supabase.from("handy_list_items").select("*").eq("household_id", hid).order("created_at"),
        supabase.from("handy_reminders").select("*").eq("household_id", hid).order("due_at"),
        supabase.from("handy_events").select("*").eq("household_id", hid),
        supabase.from("handy_stores").select("*").eq("household_id", hid).order("created_at"),
        supabase.from("handy_expenses").select("*").eq("household_id", hid).order("spent_on", { ascending: false }),
        supabase.from("handy_expense_categories").select("*").eq("household_id", hid).order("created_at"),
        supabase.from("handy_birthdays").select("*").eq("household_id", hid),
      ]);
      const firstError = [m, li, r, ev, st, ex, ec, bd].find((x) => x.error);
      if (firstError) throw firstError.error;
      setMembers(m.data);
      setItems(li.data);
      setStores(st.data);
      setReminders(r.data);
      setEvents(ev.data);
      setExpenses(ex.data);
      setExpenseCats(ec.data);
      setBirthdays(bd.data);
      setError("");
      // Seed default expense categories once, for a household that has none yet.
      if (ec.data.length === 0 && !seededCats.current && m.data.length > 0) {
        seededCats.current = true;
        await supabase.from("handy_expense_categories").insert(
          DEFAULT_EXPENSE_CATS.map((c) => ({ household_id: hid, name: c.name, icon: c.icon }))
        );
        const { data: seeded } = await supabase.from("handy_expense_categories")
          .select("*").eq("household_id", hid).order("created_at");
        if (seeded) setExpenseCats(seeded);
      }
    } catch (e) {
      setError("Couldn't load data. Check your connection and Supabase setup.");
    }
    setLoading(false);
  }, [household]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Ask the browser not to evict our stored household when storage runs low.
  useEffect(() => {
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persisted().then((already) => {
        if (!already) navigator.storage.persist().catch(() => {});
      }).catch(() => {});
    }
  }, []);

  // Recovery: opening the app with ?h=<household id> rejoins automatically,
  // so a saved link or the family's invite link always gets you back in.
  useEffect(() => {
    if (household) return;
    const hid = new URLSearchParams(window.location.search).get("h");
    if (!hid) return;
    (async () => {
      const { data } = await supabase.from("handy_households").select("*").eq("id", hid).maybeSingle();
      if (data) {
        store.set(HH_KEY, JSON.stringify({ id: data.id, name: data.name }));
        setHousehold({ id: data.id, name: data.name });
        setLoading(true);
      }
    })();
  }, [household]);

  useEffect(() => {
    if (!household) return;
    const hid = household.id;
    const tables = ["handy_members", "handy_list_items", "handy_reminders", "handy_events", "handy_stores", "handy_expenses", "handy_expense_categories", "handy_birthdays"];
    const channel = supabase.channel(`handy-${hid}`);
    tables.forEach((t) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: t, filter: `household_id=eq.${hid}` },
        () => fetchAll()
      );
    });
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [household, fetchAll]);

  useEffect(() => {
    const check = () => {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      const now = Date.now();
      const mine = reminders.filter(
        (r) => r.shared_with == null || r.added_by === me || (r.shared_with || []).includes(me)
      );
      mine.forEach((r) => {
        const due = new Date(r.due_at).getTime();
        if (!r.done && due <= now && now - due < 60000 && !notified.current.has(r.id)) {
          notified.current.add(r.id);
          new Notification("Handy APP", { body: r.content, icon: "/icons/icon-192.png" });
        }
      });
    };
    const t = setInterval(check, 20000);
    check();
    return () => clearInterval(t);
  }, [reminders, me]);

  const saveHousehold = (h) => {
    store.set(HH_KEY, JSON.stringify(h));
    setHousehold(h);
    setLoading(true);
  };
  const chooseMe = (id) => {
    store.set(ME_KEY, id);
    setMe(id);
    setShowMembers(false);
  };
  const leaveHousehold = () => {
    if (!window.confirm("Leave this household on this device? Shared data stays intact.")) return;
    store.remove(HH_KEY);
    store.remove(ME_KEY);
    setHousehold(null);
    setMe(null);
    setMembers([]); setItems([]); setStores([]); setReminders([]); setEvents([]); setExpenses([]); setExpenseCats([]); setBirthdays([]);
    setShowMembers(false);
  };

  const run = async (promise) => {
    const { error: e } = await promise;
    if (e) setError("Couldn't save that change. Try again.");
    else fetchAll();
  };
  const addMember = (name) => {
    if (!name.trim()) return;
    return supabase.from("handy_members").insert({ household_id: household.id, name: name.trim() }).select().single();
  };
  const addItem = (content, storeId) => content.trim() && run(
    supabase.from("handy_list_items").insert({
      household_id: household.id, store_id: storeId || null, content: content.trim(), added_by: me,
    })
  );
  const toggleItem = (item) => run(supabase.from("handy_list_items").update({ done: !item.done }).eq("id", item.id));
  const editItem = (id, content) => content.trim() && run(supabase.from("handy_list_items").update({ content: content.trim() }).eq("id", id));
  const deleteItem = (id) => run(supabase.from("handy_list_items").delete().eq("id", id));
  const clearDone = (storeId) => {
    let q = supabase.from("handy_list_items").delete().eq("household_id", household.id).eq("done", true);
    q = storeId ? q.eq("store_id", storeId) : q.is("store_id", null);
    run(q);
  };
  const addStore = (name) => name.trim() && run(
    supabase.from("handy_stores").insert({ household_id: household.id, name: name.trim() })
  );
  const renameStore = (id, name) => name && name.trim() && run(
    supabase.from("handy_stores").update({ name: name.trim() }).eq("id", id)
  );
  const deleteStore = (id) => {
    if (!window.confirm("Delete this store? Its items move to No store.")) return;
    if (storeFilter === id) setStoreFilter("all");
    run(supabase.from("handy_stores").delete().eq("id", id));
  };
  const addReminder = (content, dueLocal, sharedWith) => {
    if (!content.trim() || !dueLocal) return;
    run(supabase.from("handy_reminders").insert({
      household_id: household.id, content: content.trim(),
      due_at: new Date(dueLocal).toISOString(), added_by: me,
      shared_with: sharedWith,
    }));
  };
  const toggleReminder = (r) => run(supabase.from("handy_reminders").update({ done: !r.done }).eq("id", r.id));
  const editReminder = (id, content, dueLocal) => {
    if (!content.trim() || !dueLocal) return;
    run(supabase.from("handy_reminders").update({
      content: content.trim(), due_at: new Date(dueLocal).toISOString(),
    }).eq("id", id));
  };
  const deleteReminder = (id) => run(supabase.from("handy_reminders").delete().eq("id", id));
  const addEvent = (ev) => {
    if (!ev.title.trim() || !ev.date) return;
    run(supabase.from("handy_events").insert({
      household_id: household.id, title: ev.title.trim(), event_date: ev.date,
      event_time: ev.time || null, location: ev.location || null,
      notes: ev.notes || null, store_id: ev.storeId || null, added_by: me,
    }));
  };
  const deleteEvent = (id) => run(supabase.from("handy_events").delete().eq("id", id));
  const editEvent = (id, ev) => {
    if (!ev.title.trim() || !ev.date) return;
    run(supabase.from("handy_events").update({
      title: ev.title.trim(), event_date: ev.date, event_time: ev.time || null,
      location: ev.location || null, notes: ev.notes || null, store_id: ev.storeId || null,
    }).eq("id", id));
  };
  const addExpense = (ex) => {
    const amt = parseFloat(ex.amount);
    if (!ex.categoryName || !ex.date || !(amt > 0)) return;
    run(supabase.from("handy_expenses").insert({
      household_id: household.id, category_id: ex.categoryId || null,
      category_name: ex.categoryName, amount: amt, spent_on: ex.date, added_by: me,
    }));
  };
  const editExpense = (id, ex) => {
    const amt = parseFloat(ex.amount);
    if (!ex.categoryName || !ex.date || !(amt > 0)) return;
    run(supabase.from("handy_expenses").update({
      category_id: ex.categoryId || null, category_name: ex.categoryName,
      amount: amt, spent_on: ex.date,
    }).eq("id", id));
  };
  const deleteExpense = (id) => run(supabase.from("handy_expenses").delete().eq("id", id));
  const addCategory = (name, icon) => name.trim() && run(
    supabase.from("handy_expense_categories").insert({ household_id: household.id, name: name.trim(), icon: icon || "wallet" })
  );
  const renameCategory = (id, name) => name && name.trim() && run(
    supabase.from("handy_expense_categories").update({ name: name.trim() }).eq("id", id)
  );
  const deleteCategory = (id) => {
    if (!window.confirm("Delete this category? Past expenses keep their category name.")) return;
    run(supabase.from("handy_expense_categories").delete().eq("id", id));
  };
  const addBirthday = (name, dob) => {
    if (!name.trim() || !dob) return;
    run(supabase.from("handy_birthdays").insert({ household_id: household.id, name: name.trim(), dob, added_by: me }));
  };
  const editBirthday = (id, name, dob) => {
    if (!name.trim() || !dob) return;
    run(supabase.from("handy_birthdays").update({ name: name.trim(), dob }).eq("id", id));
  };
  const deleteBirthday = (id) => run(supabase.from("handy_birthdays").delete().eq("id", id));

  const now = new Date();
  const canSee = (r) => r.shared_with == null || r.added_by === me || (r.shared_with || []).includes(me);
  const visibleReminders = reminders.filter(canSee);
  const isOverdue = (r) => !r.done && new Date(r.due_at) < now;
  const dueTodayCount = visibleReminders.filter((r) => !r.done && new Date(r.due_at).toDateString() === now.toDateString()).length;
  const overdueCount = visibleReminders.filter(isOverdue).length;
  const toBuy = items.filter((i) => !i.done);
  const sortedEvents = [...events].sort((a, b) =>
    (a.event_date + (a.event_time || "")) > (b.event_date + (b.event_time || "")) ? 1 : -1
  );
  const upcoming = sortedEvents.filter((e) => e.event_date >= todayStr());
  const todayEventsCount = upcoming.filter((e) => e.event_date === todayStr()).length;
  const sortedBirthdays = [...birthdays].sort((a, b) => daysUntilBirthday(a.dob) - daysUntilBirthday(b.dob));
  const todayBirthdays = birthdays.filter((b) => daysUntilBirthday(b.dob) === 0);
  const tomorrowBirthdays = birthdays.filter((b) => daysUntilBirthday(b.dob) === 1);

  if (!household) return <JoinScreen onJoined={saveHousehold} />;

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center gap-3">
        <Logo size={48} />
        <p className="text-stone-400 text-sm">Loading Handy APP…</p>
      </div>
    );
  }

  if (members.length === 0 || !me || !members.some((m) => m.id === me)) {
    return (
      <PickMember members={members} household={household}
        onAdd={async (name) => {
          const { data, error: e } = await addMember(name);
          if (e) { setError("Couldn't add member."); return; }
          await fetchAll();
          if (!me) chooseMe(data.id);
        }}
        onPick={chooseMe} onLeave={leaveHousehold} error={error} />
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 flex justify-center">
      <div className="w-full max-w-md bg-white min-h-screen flex flex-col border-x border-stone-200">

        <div className="px-5 pt-5 pb-3 flex items-center justify-between" style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top))" }}>
          <div className="flex items-center gap-2.5">
            <Logo size={34} />
            <div>
              <h1 className="text-lg font-medium text-stone-900 leading-tight">Handy APP</h1>
              <p className="text-xs text-stone-400">
                {now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setHelpPage(tab === "events" && eventsSub === "birthdays" ? "birthdays" : tab)} aria-label="How to use this page"
              className="w-7 h-7 rounded-full border border-stone-300 text-stone-500 hover:border-teal-500 hover:text-teal-700 flex items-center justify-center text-sm shrink-0">
              ?
            </button>
            <button onClick={() => setShowMembers(true)} className="flex items-center" aria-label="Family members">
              {members.slice(0, 4).map((m, i) => (
                <div key={m.id} className={i > 0 ? "-ml-2" : ""} style={{ zIndex: 4 - i }}>
                  <div className="ring-2 ring-white rounded-full">
                    <Avatar members={members} id={m.id} />
                  </div>
                </div>
              ))}
            </button>
          </div>
        </div>

        {error && <p className="mx-5 mb-2 text-xs text-red-700 bg-red-50 rounded-lg p-2">{error}</p>}

        <div className="flex-1 overflow-y-auto px-5 pb-24">
          {tab === "home" && (
            <HomeTab members={members} stores={stores} toBuy={toBuy}
              dueTodayCount={dueTodayCount} overdueCount={overdueCount} todayEventsCount={todayEventsCount}
              visibleReminders={visibleReminders} isOverdue={isOverdue} upcoming={upcoming}
              todayBirthdays={todayBirthdays} tomorrowBirthdays={tomorrowBirthdays}
              toggleReminder={toggleReminder} toggleItem={toggleItem}
              goTo={(t, sf) => { setTab(t); if (sf) setStoreFilter(sf); }} />
          )}
          {tab === "shopping" && (
            <ShoppingTab members={members} items={items} stores={stores}
              filter={storeFilter} setFilter={setStoreFilter}
              addItem={addItem} toggleItem={toggleItem} deleteItem={deleteItem} editItem={editItem} clearDone={clearDone}
              addStore={addStore} renameStore={renameStore} deleteStore={deleteStore} />
          )}
          {tab === "reminders" && (
            <RemindersTab members={members} me={me} reminders={visibleReminders} isOverdue={isOverdue}
              addReminder={addReminder} toggleReminder={toggleReminder} deleteReminder={deleteReminder} editReminder={editReminder} />
          )}
          {tab === "events" && (
            <EventsTab members={members} stores={stores} events={sortedEvents}
              sub={eventsSub} setSub={setEventsSub}
              addEvent={addEvent} deleteEvent={deleteEvent} editEvent={editEvent}
              birthdays={sortedBirthdays} addBirthday={addBirthday} editBirthday={editBirthday} deleteBirthday={deleteBirthday}
              openStore={(storeId) => { setTab("shopping"); setStoreFilter(storeId); }} />
          )}
          {tab === "expenses" && (
            <ExpensesTab members={members} expenses={expenses} cats={expenseCats}
              addExpense={addExpense} editExpense={editExpense} deleteExpense={deleteExpense}
              addCategory={addCategory} renameCategory={renameCategory} deleteCategory={deleteCategory} />
          )}
        </div>

        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-x border-stone-200 flex justify-around py-2"
          style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}>
          {[
            { id: "home", icon: Home, label: "Home" },
            { id: "shopping", icon: ShoppingCart, label: "Shopping" },
            { id: "reminders", icon: Bell, label: "Reminders" },
            { id: "events", icon: Calendar, label: "Events" },
            { id: "expenses", icon: Wallet, label: "Expenses" },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 ${tab === t.id ? "text-teal-700" : "text-stone-400"}`}>
              <t.icon size={19} />
              <span className="text-[9px]">{t.label}</span>
            </button>
          ))}
        </div>

        {showMembers && (
          <MembersModal members={members} me={me} household={household}
            close={() => setShowMembers(false)} chooseMe={chooseMe}
            onAdd={async (name) => {
              const { error: e } = await addMember(name);
              if (e) setError("Couldn't add member.");
              else fetchAll();
            }}
            onLeave={leaveHousehold} />
        )}
        {helpPage && <HelpSheet page={helpPage} onClose={() => setHelpPage(null)} />}
      </div>
    </div>
  );
}

/* ---------- Join / onboarding ---------- */
function JoinScreen({ onJoined }) {
  const [mode, setMode] = useState("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const seen = store.get("handy_help_landing");
    if (!seen) {
      setShowHelp(true);
      store.set("handy_help_landing", "1");
    }
  }, []);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true); setErr("");
    const { data, error } = await supabase.from("handy_households").insert({ name: name.trim() }).select().single();
    setBusy(false);
    if (error) { setErr("Couldn't create the household. Check your Supabase setup."); return; }
    onJoined({ id: data.id, name: data.name });
  };
  const join = async () => {
    const id = code.trim();
    if (!id) return;
    setBusy(true); setErr("");
    const { data, error } = await supabase.from("handy_households").select("*").eq("id", id).maybeSingle();
    setBusy(false);
    if (error || !data) { setErr("No household found with that code. Double-check it."); return; }
    onJoined({ id: data.id, name: data.name });
  };

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white border border-stone-200 rounded-3xl p-6">
        <div className="flex items-center gap-3 mb-1">
          <Logo size={40} />
          <h1 className="text-xl font-medium text-stone-900">Handy APP</h1>
        </div>
        <p className="text-sm text-stone-500 mt-1 mb-5">
          Shared shopping, reminders, and events for your family.
        </p>
        <div className="flex gap-1 bg-stone-100 rounded-xl p-1 mb-4">
          <button onClick={() => setMode("create")}
            className={`flex-1 h-9 text-sm rounded-lg ${mode === "create" ? "bg-white text-stone-900 border border-stone-200" : "text-stone-500"}`}>
            New household
          </button>
          <button onClick={() => setMode("join")}
            className={`flex-1 h-9 text-sm rounded-lg ${mode === "join" ? "bg-white text-stone-900 border border-stone-200" : "text-stone-500"}`}>
            Join with code
          </button>
        </div>
        {mode === "create" ? (
          <div className="space-y-3">
            <input value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="Household name, like The Smiths" maxLength={40}
              className="w-full h-11 px-3 text-sm border border-stone-200 rounded-xl outline-none focus:border-teal-500 bg-white text-stone-900" />
            <button onClick={create} disabled={busy || !name.trim()}
              className="w-full h-11 bg-teal-600 text-white text-sm rounded-xl hover:bg-teal-700 disabled:opacity-40">
              {busy ? "Creating…" : "Create household"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <input value={code} onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && join()}
              placeholder="Paste the household code"
              className="w-full h-11 px-3 text-sm border border-stone-200 rounded-xl outline-none focus:border-teal-500 bg-white text-stone-900" />
            <button onClick={join} disabled={busy || !code.trim()}
              className="w-full h-11 bg-teal-600 text-white text-sm rounded-xl hover:bg-teal-700 disabled:opacity-40">
              {busy ? "Joining…" : "Join household"}
            </button>
            <p className="text-xs text-stone-400">Ask a family member to share the code from the Family panel.</p>
          </div>
        )}
        {err && <p className="text-xs text-red-700 bg-red-50 rounded-lg p-2 mt-3">{err}</p>}
        <button onClick={() => setShowHelp(true)}
          className="mt-4 text-xs text-teal-700 hover:underline flex items-center gap-1 mx-auto">
          <HelpCircle size={13} /> How does this work?
        </button>
      </div>
      {showHelp && <HelpSheet page="landing" onClose={() => setShowHelp(false)} />}
    </div>
  );
}

function PickMember({ members, household, onAdd, onPick, onLeave, error }) {
  const [name, setName] = useState("");
  const submit = () => { onAdd(name); setName(""); };
  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white border border-stone-200 rounded-3xl p-6">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <h1 className="text-xl font-medium text-stone-900">{household.name}</h1>
        </div>
        <p className="text-sm text-stone-500 mt-1 mb-5">
          {members.length === 0 ? "Add your family members to get started." : "Who are you? Your pick is saved on this device."}
        </p>
        {members.length > 0 && (
          <div className="space-y-2 mb-5">
            {members.map((m) => (
              <button key={m.id} onClick={() => onPick(m.id)}
                className="w-full flex items-center gap-3 p-3 border border-stone-200 rounded-xl hover:bg-stone-50 text-left">
                <Avatar members={members} id={m.id} />
                <span className="text-sm text-stone-800">{m.name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Family member name" maxLength={24}
            className="flex-1 h-10 px-3 text-sm border border-stone-200 rounded-xl outline-none focus:border-teal-500 bg-white text-stone-900" />
          <button onClick={submit} className="h-10 px-4 bg-teal-600 text-white text-sm rounded-xl hover:bg-teal-700">Add</button>
        </div>
        {error && <p className="text-xs text-red-700 bg-red-50 rounded-lg p-2 mt-3">{error}</p>}
        <button onClick={onLeave} className="mt-4 text-xs text-stone-400 hover:text-stone-600">Switch household</button>
      </div>
    </div>
  );
}

function MembersModal({ members, me, household, close, chooseMe, onAdd, onLeave }) {
  const [name, setName] = useState("");
  const [copied, setCopied] = useState("");
  const submit = () => { onAdd(name); setName(""); };
  const copy = async (text, which) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(""), 1500);
    } catch { /* clipboard unavailable */ }
  };
  const inviteLink = `${window.location.origin}/?h=${household.id}`;
  return (
    <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={close}>
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-medium text-stone-900 flex items-center gap-2">
            <Users size={18} /> {household.name}
          </h2>
          <button onClick={close} aria-label="Close" className="text-stone-400"><X size={18} /></button>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4">
          <button onClick={() => copy(inviteLink, "link")} className="flex items-center gap-1.5 text-xs text-teal-700">
            <Copy size={12} /> {copied === "link" ? "Copied" : "Copy invite link"}
          </button>
          <button onClick={() => copy(household.id, "code")} className="flex items-center gap-1.5 text-xs text-stone-500">
            <Copy size={12} /> {copied === "code" ? "Copied" : "Copy code only"}
          </button>
        </div>
        <div className="space-y-2 mb-4">
          {members.map((m) => (
            <button key={m.id} onClick={() => chooseMe(m.id)}
              className={`w-full flex items-center gap-3 p-3 border rounded-xl text-left ${me === m.id ? "border-teal-500 bg-teal-50" : "border-stone-200 hover:bg-stone-50"}`}>
              <Avatar members={members} id={m.id} />
              <span className="text-sm text-stone-800 flex-1">{m.name}</span>
              {me === m.id && <span className="text-xs text-teal-700">You</span>}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Add family member" maxLength={24}
            className="flex-1 h-10 px-3 text-sm border border-stone-200 rounded-xl outline-none focus:border-teal-500 bg-white text-stone-900" />
          <button onClick={submit} className="h-10 px-4 bg-teal-600 text-white text-sm rounded-xl hover:bg-teal-700">Add</button>
        </div>
        <button onClick={onLeave} className="mt-4 text-xs text-stone-400 hover:text-red-600 flex items-center gap-1">
          <LogOut size={12} /> Leave household on this device
        </button>
      </div>
    </div>
  );
}

/* ---------- Home ---------- */
const CARD_TEMPLATES = [
  { id: "sunset", bg: "linear-gradient(135deg,#7C3AED,#DB2777,#F59E0B)", emoji: "🎂", msg: "Wishing you a day as wonderful as you are. Have an amazing year ahead! 🎉" },
  { id: "ocean", bg: "linear-gradient(135deg,#0EA5E9,#2563EB,#7C3AED)", emoji: "🎈", msg: "Happy Birthday! May this year bring you joy, health, and everything you wish for." },
  { id: "confetti", bg: "linear-gradient(135deg,#F59E0B,#EF4444,#EC4899)", emoji: "🎉", msg: "Another trip around the sun! Hope your day is filled with cake and laughter. 🥳" },
  { id: "calm", bg: "linear-gradient(135deg,#059669,#0D9488,#0891B2)", emoji: "🌿", msg: "Warmest birthday wishes. Wishing you peace, happiness, and a beautiful year." },
];

function BirthdayCardModal({ name, onClose }) {
  const [tpl, setTpl] = useState(CARD_TEMPLATES[0]);
  const [busy, setBusy] = useState(false);

  const renderImage = () => new Promise((resolve) => {
    const W = 800, H = 1000;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    const colors = tpl.bg.match(/#[0-9A-Fa-f]{6}/g) || ["#7C3AED", "#DB2777"];
    const g = ctx.createLinearGradient(0, 0, W, H);
    colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.font = "120px sans-serif";
    ctx.fillText(tpl.emoji, W / 2, 320);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "40px sans-serif";
    ctx.fillText("Happy Birthday", W / 2, 420);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 80px sans-serif";
    ctx.fillText(name + "!", W / 2, 510);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "34px sans-serif";
    const words = tpl.msg.split(" ");
    let line = "", y = 610;
    words.forEach((w) => {
      if ((line + w).length > 28) { ctx.fillText(line.trim(), W / 2, y); line = ""; y += 50; }
      line += w + " ";
    });
    ctx.fillText(line.trim(), W / 2, y);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "26px sans-serif";
    ctx.fillText("from all of us · Handy APP", W / 2, H - 70);
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });

  const share = async () => {
    setBusy(true);
    const text = `Happy Birthday ${name}! 🎉`;
    try {
      const blob = await renderImage();
      const file = new File([blob], `birthday-${name}.png`, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text });
      } else if (navigator.share) {
        await navigator.share({ text });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `birthday-${name}.png`; a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) { /* cancelled/unsupported */ }
    setBusy(false);
  };

  const shareWhatsApp = async () => {
    const text = `Happy Birthday ${name}! 🎉 Wishing you an amazing year ahead!`;
    try {
      const blob = await renderImage();
      const file = new File([blob], `birthday-${name}.png`, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text });
        return;
      }
    } catch (e) { /* fall through */ }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-[60]" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-medium text-stone-900">Birthday wish for {name}</h2>
          <button onClick={onClose} aria-label="Close" className="text-stone-400"><X size={18} /></button>
        </div>

        <div className="rounded-2xl overflow-hidden mb-3">
          <div style={{ background: tpl.bg }} className="px-5 py-8 text-center">
            <div className="text-4xl mb-1">{tpl.emoji}</div>
            <p className="text-sm text-white/90">Happy Birthday</p>
            <p className="text-2xl font-semibold text-white mt-0.5 mb-2">{name}!</p>
            <p className="text-xs text-white/90 max-w-[220px] mx-auto leading-relaxed">{tpl.msg}</p>
            <p className="text-[10px] text-white/70 mt-3">from all of us · Handy APP</p>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          {CARD_TEMPLATES.map((t) => (
            <button key={t.id} onClick={() => setTpl(t)} aria-label={`Template ${t.id}`}
              className={`w-9 h-9 rounded-full shrink-0 border-2 ${tpl.id === t.id ? "border-stone-800" : "border-transparent"}`}
              style={{ background: t.bg }} />
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={shareWhatsApp} disabled={busy}
            className="flex-1 h-11 rounded-xl text-white text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: "#25D366" }}>
            <Share2 size={16} /> WhatsApp
          </button>
          <button onClick={share} disabled={busy}
            className="flex-1 h-11 rounded-xl border border-stone-200 text-stone-700 text-sm hover:bg-stone-50 flex items-center justify-center gap-2 disabled:opacity-50">
            <Share2 size={15} /> Share / Save
          </button>
        </div>
        <p className="text-[11px] text-stone-400 mt-3">Opens your phone's share sheet — you choose who to send it to. No phone numbers are stored in the app.</p>
      </div>
    </div>
  );
}

function HomeTab({ members, stores, toBuy, dueTodayCount, overdueCount, todayEventsCount,
  visibleReminders, isOverdue, upcoming, todayBirthdays, tomorrowBirthdays, toggleReminder, toggleItem, goTo }) {
  const homeReminders = visibleReminders.filter((r) => !r.done);
  const preview = toBuy;
  const [wishFor, setWishFor] = useState(null);
  return (
    <div className="space-y-3.5">
      {tomorrowBirthdays.map((b) => (
        <div key={b.id} className="bg-stone-900 rounded-xl px-4 py-3 flex items-center gap-3">
          <Cake size={20} className="text-amber-300 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-white font-medium">Tomorrow is {b.name}'s birthday</p>
            <p className="text-[11px] text-stone-400 mt-0.5">Turning {turningAge(b.dob)}</p>
          </div>
        </div>
      ))}
      {todayBirthdays.map((b) => (
        <div key={b.id} className="rounded-xl px-4 py-3 flex items-center gap-3"
          style={{ background: "linear-gradient(120deg,#7C3AED,#DB2777)" }}>
          <Gift size={20} className="text-white shrink-0" />
          <p className="flex-1 text-sm text-white font-medium">🎉 It's {b.name}'s birthday!</p>
          <button onClick={() => setWishFor(b)}
            className="bg-white/25 hover:bg-white/35 rounded-lg px-3 py-1.5 text-[11px] text-white flex items-center gap-1">
            <Share2 size={12} /> Wish
          </button>
        </div>
      ))}

      <div className="bg-stone-50 rounded-lg px-3 py-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-stone-600">
        <span className="flex items-center gap-1"><ShoppingCart size={12} /> {toBuy.length} to buy</span>
        <span className="flex items-center gap-1"><Bell size={12} /> {dueTodayCount} due today{overdueCount > 0 ? ` · ${overdueCount} overdue` : ""}</span>
        <span className="flex items-center gap-1"><Calendar size={12} /> {todayEventsCount} event{todayEventsCount === 1 ? "" : "s"} today</span>
      </div>

      {wishFor && <BirthdayCardModal name={wishFor.name} onClose={() => setWishFor(null)} />}

      <section>
        <div className="flex items-center justify-between mb-1.5">
          <h2 className="text-xs font-medium text-stone-500">To buy</h2>
          <button onClick={() => goTo("shopping")} className="text-[11px] text-teal-700">All</button>
        </div>
        <div className="border border-stone-200 rounded-lg divide-y divide-stone-100">
          {preview.map((it) => {
            const store = stores.find((s) => s.id === it.store_id);
            return (
              <div key={it.id} className="flex items-center gap-2.5 px-2.5 py-1.5">
                <button onClick={() => toggleItem(it)} aria-label="Mark done"
                  className="w-4 h-4 rounded-full border border-stone-300 hover:border-teal-500 shrink-0" />
                <span className="flex-1 text-[13px] text-stone-800 truncate">{it.content}</span>
                {store && (
                  <span className="flex items-center gap-1 text-[10px] text-stone-400 shrink-0">
                    <span className={`w-1.5 h-1.5 rounded-full ${storeDot(stores, it.store_id)}`} />
                    {store.name}
                  </span>
                )}
                <Avatar members={members} id={it.added_by} size="w-5 h-5 text-[9px]" />
              </div>
            );
          })}
          {preview.length === 0 && <p className="px-2.5 py-2 text-[13px] text-stone-400">Nothing to buy. Add items from the Shopping tab.</p>}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-1.5">
          <h2 className="text-xs font-medium text-stone-500">Reminders</h2>
          <button onClick={() => goTo("reminders")} className="text-[11px] text-teal-700">All</button>
        </div>
        <div className="border border-stone-200 rounded-lg divide-y divide-stone-100">
          {homeReminders.map((r) => (
            <HomeReminderRow key={r.id} members={members} r={r} overdue={isOverdue(r)} onToggle={() => toggleReminder(r)} />
          ))}
          {homeReminders.length === 0 && <p className="px-2.5 py-2 text-[13px] text-stone-400">Nothing due. Add one from the Reminders tab.</p>}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-1.5">
          <h2 className="text-xs font-medium text-stone-500">Upcoming events</h2>
          <button onClick={() => goTo("events")} className="text-[11px] text-teal-700">All</button>
        </div>
        <div className="border border-stone-200 rounded-lg divide-y divide-stone-100">
          {upcoming.map((ev) => <HomeEventRow key={ev.id} members={members} stores={stores} ev={ev} />)}
          {upcoming.length === 0 && <p className="px-2.5 py-2 text-[13px] text-stone-400">No upcoming events. Add one from the Events tab.</p>}
        </div>
      </section>
    </div>
  );
}

function HomeReminderRow({ members, r, overdue, onToggle }) {
  return (
    <div className="flex items-center gap-2.5 px-2.5 py-1.5">
      <button onClick={onToggle} aria-label="Mark done"
        className="w-4 h-4 rounded-full border border-stone-300 hover:border-teal-500 shrink-0" />
      <span className="flex-1 text-[13px] text-stone-800 truncate">{r.content}</span>
      {r.shared_with != null && (
        (r.shared_with || []).length > 0
          ? <Users size={11} className="text-stone-400 shrink-0" />
          : <Lock size={11} className="text-stone-300 shrink-0" />
      )}
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0 ${overdue ? "bg-red-50 text-red-700" : "bg-stone-100 text-stone-500"}`}>
        {overdue ? "Overdue · " : ""}{fmtDue(r.due_at)}
      </span>
      <Avatar members={members} id={r.added_by} size="w-5 h-5 text-[9px]" />
    </div>
  );
}

function HomeEventRow({ members, stores, ev }) {
  const d = new Date(ev.event_date + "T00:00:00");
  return (
    <div className="flex items-center gap-2.5 px-2.5 py-1.5">
      <div className="w-9 text-center rounded-md py-0.5 shrink-0 bg-teal-50">
        <p className="text-[9px] text-teal-700 leading-tight">{d.toLocaleDateString(undefined, { weekday: "short" })}</p>
        <p className="text-sm font-medium text-teal-800 leading-tight">{d.getDate()}</p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-stone-800 truncate">{ev.title}</p>
        <p className="text-[10px] text-stone-400 flex items-center gap-1.5 flex-wrap">
          <span>{fmtDate(ev.event_date)}</span>
          {ev.event_time && <span className="flex items-center gap-0.5"><Clock size={9} /> {fmtTime(ev.event_time)}</span>}
          {ev.location && <span className="flex items-center gap-0.5 truncate"><MapPin size={9} /> {ev.location}</span>}
        </p>
      </div>
      <Avatar members={members} id={ev.added_by} size="w-5 h-5 text-[9px]" />
    </div>
  );
}

/* ---------- Shopping ---------- */
function ShoppingTab({ members, items, stores, filter, setFilter,
  addItem, toggleItem, deleteItem, editItem, clearDone, addStore, renameStore, deleteStore }) {
  const [text, setText] = useState("");
  const [storeId, setStoreId] = useState("");
  const [manage, setManage] = useState(false);
  const [newStore, setNewStore] = useState("");
  const [heard, setHeard] = useState("");
  const submit = () => { addItem(text, storeId); setText(""); };

  // Parse "milk from Costco" or "eggs, bread and bananas from Aldi".
  const parseVoice = (transcript) => {
    setHeard(transcript);
    setTimeout(() => setHeard(""), 3000);
    let body = transcript;
    let matchedStore = null;
    const fromMatch = transcript.match(/\s+from\s+(.+)$/i);
    if (fromMatch) {
      const spoken = fromMatch[1].trim().toLowerCase();
      matchedStore = stores.find((s) => {
        const n = s.name.toLowerCase();
        return spoken.includes(n) || n.includes(spoken) || spoken.replace(/\s/g, "") === n.replace(/\s/g, "");
      });
      if (matchedStore) body = transcript.slice(0, fromMatch.index);
    }
    const parts = body.split(/,|\band\b/i).map((p) => p.trim()).filter(Boolean);
    parts.forEach((p) => addItem(p, matchedStore ? matchedStore.id : (storeId || null)));
  };
  const { listening, start, supported } = useSpeech(parseVoice);

  const chip = (active) =>
    `text-[11px] px-2.5 py-1 rounded-full border whitespace-nowrap ${active ? "border-teal-500 bg-teal-50 text-teal-700" : "border-stone-200 text-stone-500 hover:border-stone-300"}`;
  const groups = [
    ...stores.map((s, i) => ({ key: s.id, store: s, i, its: items.filter((it) => it.store_id === s.id) })),
    { key: "none", store: null, i: -1, its: items.filter((it) => !it.store_id || !stores.some((s) => s.id === it.store_id)) },
  ].filter((g) => g.its.length > 0 && (filter === "all" || filter === g.key));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => setFilter("all")} className={chip(filter === "all")}>All</button>
        {stores.map((s) => (
          <button key={s.id} onClick={() => setFilter(filter === s.id ? "all" : s.id)} className={chip(filter === s.id)}>
            {s.name}
          </button>
        ))}
        <button onClick={() => setManage(true)}
          className="text-[11px] px-2.5 py-1 rounded-full border border-dashed border-stone-300 text-stone-400 hover:text-teal-700 hover:border-teal-500">
          Edit stores
        </button>
      </div>
      <div className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Add item, like Milk 2L" maxLength={80}
          className="flex-1 min-w-0 h-10 px-3 text-sm border border-stone-200 rounded-xl outline-none focus:border-teal-500 bg-white text-stone-900" />
        <select value={storeId} onChange={(e) => setStoreId(e.target.value)}
          className="w-24 h-10 px-2 text-xs border border-stone-200 rounded-xl outline-none focus:border-teal-500 bg-white text-stone-600">
          <option value="">No store</option>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {supported && <MicButton listening={listening} onClick={start} />}
        <button onClick={submit} aria-label="Add item" className="h-10 px-3 bg-teal-600 text-white text-sm rounded-xl hover:bg-teal-700">
          <Plus size={15} />
        </button>
      </div>
      {(listening || heard) && (
        <p className="text-[11px] text-teal-700 bg-teal-50 rounded-lg px-3 py-2">
          {listening ? "Listening… try \"milk from Costco\"" : `Heard: "${heard}"`}
        </p>
      )}
      {items.length === 0 && (
        <p className="text-sm text-stone-400 text-center py-8">Nothing here yet. Add your first item above.</p>
      )}
      {items.length > 0 && groups.length === 0 && (
        <p className="text-sm text-stone-400 text-center py-8">No items for this store yet.</p>
      )}
      {groups.map((g) => {
        const left = g.its.filter((i) => !i.done).length;
        const doneCount = g.its.length - left;
        return (
          <div key={g.key}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2 h-2 rounded-full ${g.store ? STORE_DOT[g.i % STORE_DOT.length] : "bg-stone-400"}`} />
              <h2 className="flex-1 text-sm font-medium text-stone-500">{g.store ? g.store.name : "No store"}</h2>
              <span className="text-xs text-stone-400">{left === 0 ? "All done" : `${left} to buy`}</span>
              {doneCount > 0 && (
                <button onClick={() => clearDone(g.store ? g.store.id : null)} className="text-[11px] text-stone-400 hover:text-red-600">
                  Clear done
                </button>
              )}
            </div>
            <div className="border border-stone-200 rounded-xl divide-y divide-stone-100">
              {g.its.map((it) => (
                <ItemRow key={it.id} members={members} item={it}
                  onToggle={() => toggleItem(it)} onDelete={() => deleteItem(it.id)}
                  onEdit={(content) => editItem(it.id, content)} />
              ))}
            </div>
          </div>
        );
      })}
      {manage && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setManage(false)}>
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-medium text-stone-900">Stores</h2>
              <button onClick={() => setManage(false)} aria-label="Close" className="text-stone-400"><X size={18} /></button>
            </div>
            <div className="space-y-1 mb-4">
              {stores.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3 py-2 border-b border-stone-100">
                  <span className={`w-2 h-2 rounded-full ${STORE_DOT[i % STORE_DOT.length]}`} />
                  <span className="flex-1 text-sm text-stone-800">{s.name}</span>
                  <button onClick={() => renameStore(s.id, window.prompt("Rename store", s.name))}
                    aria-label="Rename store" className="text-stone-300 hover:text-teal-700">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => deleteStore(s.id)} aria-label="Delete store" className="text-stone-300 hover:text-red-500">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              {stores.length === 0 && <p className="text-sm text-stone-400 py-2">No stores yet. Add your first below.</p>}
            </div>
            <div className="flex gap-2">
              <input value={newStore} onChange={(e) => setNewStore(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (addStore(newStore), setNewStore(""))}
                placeholder="Add store, like Trader Joe's" maxLength={30}
                className="flex-1 h-10 px-3 text-sm border border-stone-200 rounded-xl outline-none focus:border-teal-500 bg-white text-stone-900" />
              <button onClick={() => { addStore(newStore); setNewStore(""); }}
                className="h-10 px-4 bg-teal-600 text-white text-sm rounded-xl hover:bg-teal-700">Add</button>
            </div>
            <p className="text-[11px] text-stone-400 mt-3">Deleting a store keeps its items — they move to "No store".</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- shared rows ---------- */
function ItemRow({ members, item, onToggle, onDelete, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(item.content);
  const save = () => { if (val.trim()) { onEdit(val); setEditing(false); } };
  if (editing) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <input autoFocus value={val} onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setVal(item.content); setEditing(false); } }}
          maxLength={80}
          className="flex-1 min-w-0 h-8 px-2 text-sm border border-teal-400 rounded-lg outline-none bg-white text-stone-900" />
        <button onClick={save} aria-label="Save" className="text-teal-600 hover:text-teal-700"><Check size={17} /></button>
        <button onClick={() => { setVal(item.content); setEditing(false); }} aria-label="Cancel" className="text-stone-400 hover:text-stone-600"><X size={17} /></button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <button onClick={onToggle} aria-label={item.done ? "Mark not done" : "Mark done"}
        className={`w-5 h-5 rounded-full flex items-center justify-center border shrink-0 ${item.done ? "bg-teal-600 border-teal-600" : "border-stone-300 hover:border-teal-500"}`}>
        {item.done && <Check size={12} className="text-white" />}
      </button>
      <span className={`flex-1 text-sm ${item.done ? "text-stone-400 line-through" : "text-stone-800"}`}>{item.content}</span>
      <Avatar members={members} id={item.added_by} size="w-6 h-6 text-[10px]" />
      {onEdit && (
        <button onClick={() => { setVal(item.content); setEditing(true); }} aria-label="Edit item" className="text-stone-300 hover:text-teal-700">
          <Pencil size={14} />
        </button>
      )}
      {onDelete && (
        <button onClick={onDelete} aria-label="Delete item" className="text-stone-300 hover:text-red-500">
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}

function ReminderRow({ members, r, overdue, onToggle, onDelete, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(r.content);
  const toLocalInput = (iso) => {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const [due, setDue] = useState(toLocalInput(r.due_at));
  const save = () => { if (val.trim() && due) { onEdit(val, due); setEditing(false); } };
  if (editing) {
    return (
      <div className="px-3 py-2 space-y-2">
        <input autoFocus value={val} onChange={(e) => setVal(e.target.value)} maxLength={100}
          className="w-full h-9 px-2 text-sm border border-teal-400 rounded-lg outline-none bg-white text-stone-900" />
        <div className="flex items-center gap-2">
          <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)}
            className="flex-1 min-w-0 h-9 px-2 text-sm border border-stone-200 rounded-lg outline-none focus:border-teal-500 bg-white text-stone-600" />
          <button onClick={save} aria-label="Save" className="text-teal-600 hover:text-teal-700"><Check size={17} /></button>
          <button onClick={() => { setVal(r.content); setDue(toLocalInput(r.due_at)); setEditing(false); }} aria-label="Cancel" className="text-stone-400 hover:text-stone-600"><X size={17} /></button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <button onClick={onToggle} aria-label={r.done ? "Mark not done" : "Mark done"}
        className={`w-5 h-5 rounded-full flex items-center justify-center border shrink-0 ${r.done ? "bg-teal-600 border-teal-600" : "border-stone-300 hover:border-teal-500"}`}>
        {r.done && <Check size={12} className="text-white" />}
      </button>
      <span className={`flex-1 text-sm ${r.done ? "text-stone-400 line-through" : "text-stone-800"}`}>{r.content}</span>
      {r.shared_with != null && (
        (r.shared_with || []).length > 0
          ? <Users size={13} className="text-stone-400 shrink-0" />
          : <Lock size={13} className="text-stone-300 shrink-0" />
      )}
      <span className={`text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ${overdue ? "bg-red-50 text-red-700" : "bg-stone-100 text-stone-500"}`}>
        {overdue ? "Overdue · " : ""}{fmtDue(r.due_at)}
      </span>
      <Avatar members={members} id={r.added_by} size="w-6 h-6 text-[10px]" />
      {onEdit && (
        <button onClick={() => { setVal(r.content); setDue(toLocalInput(r.due_at)); setEditing(true); }} aria-label="Edit reminder" className="text-stone-300 hover:text-teal-700">
          <Pencil size={14} />
        </button>
      )}
      {onDelete && (
        <button onClick={onDelete} aria-label="Delete reminder" className="text-stone-300 hover:text-red-500">
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}

function EventRow({ members, stores, ev, highlight, onDelete, onEdit, onOpenStore }) {
  const past = ev.event_date < todayStr();
  const linked = stores.find((s) => s.id === ev.store_id);
  return (
    <div className={`flex items-start gap-3 px-3 py-3 ${past ? "opacity-50" : ""}`}>
      <div className={`w-11 text-center rounded-lg py-1 shrink-0 ${highlight ? "bg-teal-50" : "bg-stone-50"}`}>
        <p className={`text-[10px] ${highlight ? "text-teal-700" : "text-stone-400"}`}>
          {new Date(ev.event_date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" })}
        </p>
        <p className={`text-base font-medium ${highlight ? "text-teal-800" : "text-stone-600"}`}>
          {new Date(ev.event_date + "T00:00:00").getDate()}
        </p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-800">{ev.title}</p>
        <p className="text-xs text-stone-400 flex items-center gap-2 mt-0.5 flex-wrap">
          <span>{fmtDate(ev.event_date)}</span>
          {ev.event_time && <span className="flex items-center gap-1"><Clock size={11} /> {fmtTime(ev.event_time)}</span>}
          {ev.location && <span className="flex items-center gap-1"><MapPin size={11} /> {ev.location}</span>}
        </p>
        {ev.notes && <p className="text-xs text-stone-500 mt-1">{ev.notes}</p>}
        {linked && (
          <button onClick={onOpenStore} className={`text-[11px] flex items-center gap-1 mt-1 ${storeText(stores, ev.store_id)}`}>
            <Link2 size={11} /> {linked.name} shopping
          </button>
        )}
      </div>
      <Avatar members={members} id={ev.added_by} size="w-6 h-6 text-[10px]" />
      {onEdit && (
        <button onClick={onEdit} aria-label="Edit event" className="text-stone-300 hover:text-teal-700 mt-1">
          <Pencil size={14} />
        </button>
      )}
      {onDelete && (
        <button onClick={onDelete} aria-label="Delete event" className="text-stone-300 hover:text-red-500 mt-1">
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}

/* ---------- Reminders ---------- */
function RemindersTab({ members, me, reminders, isOverdue, addReminder, toggleReminder, deleteReminder, editReminder }) {
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const [visAll, setVisAll] = useState(false);
  const [withIds, setWithIds] = useState([]);
  const [notifState, setNotifState] = useState(
    "Notification" in window ? Notification.permission : "unsupported"
  );
  const open = reminders.filter((r) => !r.done);
  const doneList = reminders.filter((r) => r.done);
  const others = members.filter((m) => m.id !== me);
  const toggleWith = (id) => {
    setVisAll(false);
    setWithIds((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]));
  };
  const chip = (active) =>
    `text-[11px] px-2.5 py-1 rounded-full border ${active ? "border-teal-500 bg-teal-50 text-teal-700" : "border-stone-200 text-stone-500 hover:border-stone-300"}`;
  const submit = () => {
    addReminder(text, due, visAll ? null : withIds);
    setText(""); setDue(""); setVisAll(false); setWithIds([]);
  };
  const enableNotifs = async () => {
    const p = await Notification.requestPermission();
    setNotifState(p);
  };
  const { listening, start, supported } = useSpeech((t) => setText((prev) => (prev ? prev + " " : "") + t));
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Remind me to…" maxLength={100}
            className="flex-1 min-w-0 h-10 px-3 text-sm border border-stone-200 rounded-xl outline-none focus:border-teal-500 bg-white text-stone-900" />
          {supported && <MicButton listening={listening} onClick={start} />}
        </div>
        <div className="flex gap-2">
          <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)}
            className="flex-1 min-w-0 h-10 px-3 text-sm border border-stone-200 rounded-xl outline-none focus:border-teal-500 bg-white text-stone-600" />
          <button onClick={submit} disabled={!text.trim() || !due}
            className="h-10 px-4 bg-teal-600 text-white text-sm rounded-xl hover:bg-teal-700 disabled:opacity-40">
            Add
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] text-stone-400 mr-0.5">Visible to:</span>
          <button onClick={() => { setVisAll(false); setWithIds([]); }} className={chip(!visAll && withIds.length === 0)}>
            Just me
          </button>
          <button onClick={() => { setVisAll(true); setWithIds([]); }} className={chip(visAll)}>
            Everyone
          </button>
          {others.map((m) => (
            <button key={m.id} onClick={() => toggleWith(m.id)} className={chip(withIds.includes(m.id))}>
              {m.name}
            </button>
          ))}
        </div>
      </div>
      <div className="border border-stone-200 rounded-xl divide-y divide-stone-100">
        {open.map((r) => (
          <ReminderRow key={r.id} members={members} r={r} overdue={isOverdue(r)}
            onToggle={() => toggleReminder(r)} onDelete={() => deleteReminder(r.id)}
            onEdit={(content, due) => editReminder(r.id, content, due)} />
        ))}
        {open.length === 0 && <p className="p-3 text-sm text-stone-400">All caught up. Add a reminder above.</p>}
      </div>
      {doneList.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-stone-400 mb-2">Done</h3>
          <div className="border border-stone-200 rounded-xl divide-y divide-stone-100">
            {doneList.map((r) => (
              <ReminderRow key={r.id} members={members} r={r} overdue={false}
                onToggle={() => toggleReminder(r)} onDelete={() => deleteReminder(r.id)}
                onEdit={(content, due) => editReminder(r.id, content, due)} />
            ))}
          </div>
        </div>
      )}
      {notifState === "default" && (
        <button onClick={enableNotifs} className="text-xs text-teal-700 flex items-center gap-1">
          <Bell size={12} /> Enable notification pop-ups for due reminders
        </button>
      )}
      <p className="text-[11px] text-stone-400">
        Reminders pop up while the app is open. They can't ring your phone when the app is fully closed.
      </p>
    </div>
  );
}

/* ---------- Events ---------- */
const emptyEventForm = { title: "", date: "", time: "", location: "", notes: "", storeId: "" };
function EventsTab({ members, stores, events, addEvent, deleteEvent, editEvent,
  birthdays, addBirthday, editBirthday, deleteBirthday, openStore, sub, setSub }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyEventForm);
  const set = (k, v) => setForm({ ...form, [k]: v });
  const openAdd = () => { setEditingId(null); setForm(emptyEventForm); setShowForm(true); };
  const openEdit = (ev) => {
    setEditingId(ev.id);
    setForm({
      title: ev.title, date: ev.event_date, time: ev.event_time || "",
      location: ev.location || "", notes: ev.notes || "", storeId: ev.store_id || "",
    });
    setShowForm(true);
  };
  const close = () => { setShowForm(false); setEditingId(null); setForm(emptyEventForm); };
  const submit = () => {
    if (editingId) editEvent(editingId, form);
    else addEvent(form);
    close();
  };
  const upcoming = events.filter((e) => e.event_date >= todayStr());
  const past = events.filter((e) => e.event_date < todayStr());
  const EventForm = (
    <div className="border border-stone-200 rounded-xl p-4 space-y-2">
      <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Event title" maxLength={80}
        className="w-full h-10 px-3 text-sm border border-stone-200 rounded-xl outline-none focus:border-teal-500 bg-white text-stone-900" />
      <div className="flex gap-2">
        <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)}
          className="flex-1 min-w-0 h-10 px-3 text-sm border border-stone-200 rounded-xl outline-none focus:border-teal-500 bg-white text-stone-600" />
        <input type="time" value={form.time} onChange={(e) => set("time", e.target.value)}
          className="flex-1 min-w-0 h-10 px-3 text-sm border border-stone-200 rounded-xl outline-none focus:border-teal-500 bg-white text-stone-600" />
      </div>
      <input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Location (optional)" maxLength={80}
        className="w-full h-10 px-3 text-sm border border-stone-200 rounded-xl outline-none focus:border-teal-500 bg-white text-stone-900" />
      <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Notes (optional)" maxLength={300} rows={2}
        className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl outline-none focus:border-teal-500 bg-white text-stone-900 resize-none" />
      {stores.length > 0 && (
        <select value={form.storeId} onChange={(e) => set("storeId", e.target.value)}
          className="w-full h-10 px-3 text-sm border border-stone-200 rounded-xl outline-none focus:border-teal-500 bg-white text-stone-600">
          <option value="">Link store shopping (optional)</option>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}
      <div className="flex gap-2 pt-1">
        <button onClick={submit} disabled={!form.title.trim() || !form.date}
          className="flex-1 h-10 bg-teal-600 text-white text-sm rounded-xl hover:bg-teal-700 disabled:opacity-40">
          {editingId ? "Save changes" : "Save event"}
        </button>
        <button onClick={close} className="h-10 px-4 border border-stone-200 text-sm text-stone-600 rounded-xl hover:bg-stone-50">
          Cancel
        </button>
      </div>
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-stone-100 rounded-xl p-1">
        <button onClick={() => setSub("events")}
          className={`flex-1 h-9 text-sm rounded-lg ${sub === "events" ? "bg-white text-stone-900 border border-stone-200 font-medium" : "text-stone-500"}`}>
          Events
        </button>
        <button onClick={() => setSub("birthdays")}
          className={`flex-1 h-9 text-sm rounded-lg ${sub === "birthdays" ? "bg-white text-stone-900 border border-stone-200 font-medium" : "text-stone-500"}`}>
          Birthdays
        </button>
      </div>

      {sub === "birthdays" ? (
        <BirthdaysView members={members} birthdays={birthdays}
          addBirthday={addBirthday} editBirthday={editBirthday} deleteBirthday={deleteBirthday} />
      ) : (
      <div className="space-y-4">
      {showForm && !editingId ? EventForm : (
        <button onClick={openAdd}
          className="w-full h-10 border border-dashed border-stone-300 rounded-xl text-sm text-stone-500 hover:border-teal-500 hover:text-teal-700 flex items-center justify-center gap-1">
          <Plus size={15} /> Add event
        </button>
      )}
      <div className="border border-stone-200 rounded-xl divide-y divide-stone-100">
        {upcoming.map((ev) => (
          editingId === ev.id ? <div key={ev.id} className="p-2">{EventForm}</div> : (
            <EventRow key={ev.id} members={members} stores={stores} ev={ev} highlight
              onDelete={() => deleteEvent(ev.id)} onEdit={() => openEdit(ev)} onOpenStore={() => openStore(ev.store_id)} />
          )
        ))}
        {upcoming.length === 0 && <p className="p-3 text-sm text-stone-400">No upcoming events. Add one above.</p>}
      </div>
      {past.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-stone-400 mb-2">Past</h3>
          <div className="border border-stone-200 rounded-xl divide-y divide-stone-100">
            {past.map((ev) => (
              editingId === ev.id ? <div key={ev.id} className="p-2">{EventForm}</div> : (
                <EventRow key={ev.id} members={members} stores={stores} ev={ev}
                  onDelete={() => deleteEvent(ev.id)} onEdit={() => openEdit(ev)} onOpenStore={() => openStore(ev.store_id)} />
              )
            ))}
          </div>
        </div>
      )}
      </div>
      )}
    </div>
  );
}

function BirthdaysView({ members, birthdays, addBirthday, editBirthday, deleteBirthday }) {
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [eName, setEName] = useState("");
  const [eDob, setEDob] = useState("");
  const submit = () => { addBirthday(name, dob); setName(""); setDob(""); };
  const startEdit = (b) => { setEditingId(b.id); setEName(b.name); setEDob(b.dob); };
  const saveEdit = () => { editBirthday(editingId, eName, eDob); setEditingId(null); };
  const shown = showAll ? birthdays : birthdays.slice(0, 5);
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Name" maxLength={40}
          className="flex-1 min-w-0 h-10 px-3 text-sm border border-stone-200 rounded-xl outline-none focus:border-teal-500 bg-white text-stone-900" />
        <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} aria-label="Date of birth"
          className="w-36 h-10 px-2 text-sm border border-stone-200 rounded-xl outline-none focus:border-teal-500 bg-white text-stone-600" />
        <button onClick={submit} disabled={!name.trim() || !dob} aria-label="Add birthday"
          className="h-10 px-3 bg-teal-600 text-white text-sm rounded-xl hover:bg-teal-700 disabled:opacity-40">
          <Plus size={15} />
        </button>
      </div>

      {birthdays.length === 0 && (
        <p className="text-sm text-stone-400 text-center py-8">No birthdays yet. Add one above.</p>
      )}

      {birthdays.length > 0 && (
        <div className="border border-stone-200 rounded-xl divide-y divide-stone-100">
          {shown.map((b, i) => {
            if (editingId === b.id) {
              return (
                <div key={b.id} className="p-2 flex gap-2">
                  <input value={eName} onChange={(e) => setEName(e.target.value)} maxLength={40}
                    className="flex-1 min-w-0 h-9 px-2 text-sm border border-teal-400 rounded-lg outline-none bg-white text-stone-900" />
                  <input type="date" value={eDob} onChange={(e) => setEDob(e.target.value)}
                    className="w-32 h-9 px-2 text-sm border border-stone-200 rounded-lg outline-none focus:border-teal-500 bg-white text-stone-600" />
                  <button onClick={saveEdit} aria-label="Save" className="text-teal-600 hover:text-teal-700"><Check size={17} /></button>
                  <button onClick={() => setEditingId(null)} aria-label="Cancel" className="text-stone-400"><X size={17} /></button>
                </div>
              );
            }
            const days = daysUntilBirthday(b.dob);
            const colorBg = ["bg-orange-100", "bg-violet-100", "bg-teal-100", "bg-pink-100", "bg-amber-100", "bg-sky-100"][i % 6];
            const colorText = ["text-orange-700", "text-violet-700", "text-teal-700", "text-pink-700", "text-amber-700", "text-sky-700"][i % 6];
            return (
              <div key={b.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className={`w-8 h-8 rounded-lg ${colorBg} flex items-center justify-center shrink-0`}>
                  <Cake size={15} className={colorText} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-800">{b.name}</p>
                  <p className="text-[11px] text-stone-400">{fmtBirthday(b.dob)} · turning {turningAge(b.dob)}</p>
                </div>
                <span className={`text-[11px] ${days <= 1 ? "text-teal-700 font-medium" : "text-stone-400"}`}>{daysLabel(days)}</span>
                <button onClick={() => startEdit(b)} aria-label="Edit birthday" className="text-stone-300 hover:text-teal-700">
                  <Pencil size={14} />
                </button>
                <button onClick={() => deleteBirthday(b.id)} aria-label="Delete birthday" className="text-stone-300 hover:text-red-500">
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {birthdays.length > 5 && (
        <button onClick={() => setShowAll(!showAll)} className="text-xs text-teal-700 flex items-center gap-1 mx-auto">
          {showAll ? "Show less" : `More (${birthdays.length - 5})`} <ChevronRight size={13} />
        </button>
      )}
    </div>
  );
}

/* ---------- Expenses ---------- */
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (key) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
};
const fmtMoney = (n) => `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function ExpensesTab({ members, expenses, cats, addExpense, editExpense, deleteExpense, addCategory, renameCategory, deleteCategory }) {
  const [month, setMonth] = useState(monthKey(new Date()));
  const [date, setDate] = useState(todayStr());
  const [catId, setCatId] = useState("");
  const [amount, setAmount] = useState("");
  const [manage, setManage] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [editingId, setEditingId] = useState(null);

  const catById = (id) => cats.find((c) => c.id === id);
  const submit = () => {
    const cat = catById(catId) || cats[0];
    if (!cat) return;
    if (editingId) {
      editExpense(editingId, { categoryId: cat.id, categoryName: cat.name, amount, date });
      setEditingId(null);
    } else {
      addExpense({ categoryId: cat.id, categoryName: cat.name, amount, date });
    }
    setAmount("");
  };
  const startEdit = (ex) => {
    setEditingId(ex.id);
    setDate(ex.spent_on);
    setCatId(ex.category_id || "");
    setAmount(String(ex.amount));
  };
  const cancelEdit = () => { setEditingId(null); setAmount(""); setDate(todayStr()); };

  const monthExpenses = expenses.filter((e) => e.spent_on.startsWith(month));
  const total = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const byDate = {};
  monthExpenses.forEach((e) => { (byDate[e.spent_on] = byDate[e.spent_on] || []).push(e); });
  const dates = Object.keys(byDate).sort((a, b) => (a < b ? 1 : -1));
  const shiftMonth = (delta) => {
    const [y, m] = month.split("-").map(Number);
    setMonth(monthKey(new Date(y, m - 1 + delta, 1)));
  };
  const iconFor = (ex) => (catById(ex.category_id)?.icon) || "wallet";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium text-stone-900">Expenses</h2>
        <div className="flex items-center gap-2 text-xs text-stone-500">
          <button onClick={() => shiftMonth(-1)} aria-label="Previous month" className="hover:text-stone-800">‹</button>
          <span className="min-w-[92px] text-center">{monthLabel(month)}</span>
          <button onClick={() => shiftMonth(1)} aria-label="Next month" className="hover:text-stone-800">›</button>
        </div>
      </div>

      <div className="bg-teal-50 rounded-xl px-4 py-3 flex items-baseline justify-between">
        <span className="text-xs text-teal-700">This month</span>
        <span className="text-2xl font-medium text-teal-800">{fmtMoney(total)}</span>
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="flex-1 min-w-0 h-10 px-3 text-sm border border-stone-200 rounded-xl outline-none focus:border-teal-500 bg-white text-stone-600" />
          <select value={catId} onChange={(e) => setCatId(e.target.value)}
            className="flex-1 min-w-0 h-10 px-2 text-sm border border-stone-200 rounded-xl outline-none focus:border-teal-500 bg-white text-stone-600">
            {cats.length === 0 && <option value="">No categories</option>}
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 min-w-0 h-10 flex items-center border border-stone-200 rounded-xl bg-white focus-within:border-teal-500 px-3">
            <span className="text-stone-400 text-sm mr-1">$</span>
            <input type="number" inputMode="decimal" min="0" step="0.01" value={amount}
              onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Amount"
              className="flex-1 min-w-0 h-full text-sm outline-none bg-transparent text-stone-900" />
          </div>
          <button onClick={submit} disabled={!amount || !(parseFloat(amount) > 0) || cats.length === 0}
            className="h-10 px-4 bg-teal-600 text-white text-sm rounded-xl hover:bg-teal-700 disabled:opacity-40 flex items-center gap-1">
            {editingId ? <><Check size={15} /> Save</> : <><Plus size={15} /> Add</>}
          </button>
          {editingId && (
            <button onClick={cancelEdit} className="h-10 px-3 border border-stone-200 text-sm text-stone-600 rounded-xl hover:bg-stone-50">
              <X size={15} />
            </button>
          )}
        </div>
        <button onClick={() => setManage(true)} className="text-[11px] text-teal-700">Edit categories</button>
      </div>

      {dates.length === 0 && (
        <p className="text-sm text-stone-400 text-center py-8">No expenses this month. Add one above.</p>
      )}
      {dates.map((d) => (
        <div key={d}>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs text-stone-400">{fmtDate(d)}</p>
            <p className="text-xs text-stone-400">{fmtMoney(byDate[d].reduce((s, e) => s + Number(e.amount), 0))}</p>
          </div>
          <div className="border border-stone-200 rounded-xl divide-y divide-stone-100">
            {byDate[d].map((ex) => (
              <div key={ex.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                  <CatIcon icon={iconFor(ex)} size={15} className="text-stone-600" />
                </span>
                <span className="flex-1 text-sm text-stone-800">{ex.category_name}</span>
                <span className="text-sm font-medium text-stone-900">{fmtMoney(ex.amount)}</span>
                <Avatar members={members} id={ex.added_by} size="w-6 h-6 text-[10px]" />
                <button onClick={() => startEdit(ex)} aria-label="Edit expense" className="text-stone-300 hover:text-teal-700">
                  <Pencil size={14} />
                </button>
                <button onClick={() => deleteExpense(ex.id)} aria-label="Delete expense" className="text-stone-300 hover:text-red-500">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {manage && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setManage(false)}>
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-medium text-stone-900">Categories</h2>
              <button onClick={() => setManage(false)} aria-label="Close" className="text-stone-400"><X size={18} /></button>
            </div>
            <div className="space-y-1 mb-4 max-h-64 overflow-y-auto">
              {cats.map((c) => (
                <div key={c.id} className="flex items-center gap-3 py-2 border-b border-stone-100">
                  <span className="w-7 h-7 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                    <CatIcon icon={c.icon} size={14} className="text-stone-600" />
                  </span>
                  <span className="flex-1 text-sm text-stone-800">{c.name}</span>
                  <button onClick={() => renameCategory(c.id, window.prompt("Rename category", c.name))}
                    aria-label="Rename category" className="text-stone-300 hover:text-teal-700">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => deleteCategory(c.id)} aria-label="Delete category" className="text-stone-300 hover:text-red-500">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newCat} onChange={(e) => setNewCat(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (addCategory(newCat, "wallet"), setNewCat(""))}
                placeholder="Add category, like Childcare" maxLength={30}
                className="flex-1 h-10 px-3 text-sm border border-stone-200 rounded-xl outline-none focus:border-teal-500 bg-white text-stone-900" />
              <button onClick={() => { addCategory(newCat, "wallet"); setNewCat(""); }}
                className="h-10 px-4 bg-teal-600 text-white text-sm rounded-xl hover:bg-teal-700">Add</button>
            </div>
            <p className="text-[11px] text-stone-400 mt-3">New categories use a default icon. Deleting one keeps past expenses' names intact.</p>
          </div>
        </div>
      )}
    </div>
  );
}
