import { useState, useEffect, useCallback, useRef } from "react";
import {
  ShoppingCart, Bell, Calendar, Home, Plus, Check, Trash2,
  Clock, MapPin, X, Users, Link2, Copy, LogOut, Lock, Pencil,
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

const HH_KEY = "handy_household";
const ME_KEY = "handy_me";

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
    try { return JSON.parse(localStorage.getItem(HH_KEY) || "null"); } catch { return null; }
  });
  const [me, setMe] = useState(() => localStorage.getItem(ME_KEY) || null);
  const [members, setMembers] = useState([]);
  const [items, setItems] = useState([]);
  const [stores, setStores] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(!!household);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("home");
  const [storeFilter, setStoreFilter] = useState("all");
  const [showMembers, setShowMembers] = useState(false);
  const notified = useRef(new Set());

  const fetchAll = useCallback(async () => {
    if (!household) return;
    const hid = household.id;
    try {
      const [m, li, r, ev, st] = await Promise.all([
        supabase.from("handy_members").select("*").eq("household_id", hid).order("created_at"),
        supabase.from("handy_list_items").select("*").eq("household_id", hid).order("created_at"),
        supabase.from("handy_reminders").select("*").eq("household_id", hid).order("due_at"),
        supabase.from("handy_events").select("*").eq("household_id", hid),
        supabase.from("handy_stores").select("*").eq("household_id", hid).order("created_at"),
      ]);
      const firstError = [m, li, r, ev, st].find((x) => x.error);
      if (firstError) throw firstError.error;
      setMembers(m.data);
      setItems(li.data);
      setStores(st.data);
      setReminders(r.data);
      setEvents(ev.data);
      setError("");
    } catch (e) {
      setError("Couldn't load data. Check your connection and Supabase setup.");
    }
    setLoading(false);
  }, [household]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!household) return;
    const hid = household.id;
    const tables = ["handy_members", "handy_list_items", "handy_reminders", "handy_events", "handy_stores"];
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
    localStorage.setItem(HH_KEY, JSON.stringify(h));
    setHousehold(h);
    setLoading(true);
  };
  const chooseMe = (id) => {
    localStorage.setItem(ME_KEY, id);
    setMe(id);
    setShowMembers(false);
  };
  const leaveHousehold = () => {
    if (!window.confirm("Leave this household on this device? Shared data stays intact.")) return;
    localStorage.removeItem(HH_KEY);
    localStorage.removeItem(ME_KEY);
    setHousehold(null);
    setMe(null);
    setMembers([]); setItems([]); setStores([]); setReminders([]); setEvents([]);
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

        {error && <p className="mx-5 mb-2 text-xs text-red-700 bg-red-50 rounded-lg p-2">{error}</p>}

        <div className="flex-1 overflow-y-auto px-5 pb-24">
          {tab === "home" && (
            <HomeTab members={members} stores={stores} toBuy={toBuy}
              dueTodayCount={dueTodayCount} overdueCount={overdueCount} todayEventsCount={todayEventsCount}
              visibleReminders={visibleReminders} isOverdue={isOverdue} upcoming={upcoming}
              toggleReminder={toggleReminder} toggleItem={toggleItem}
              goTo={(t, sf) => { setTab(t); if (sf) setStoreFilter(sf); }} />
          )}
          {tab === "shopping" && (
            <ShoppingTab members={members} items={items} stores={stores}
              filter={storeFilter} setFilter={setStoreFilter}
              addItem={addItem} toggleItem={toggleItem} deleteItem={deleteItem} clearDone={clearDone}
              addStore={addStore} renameStore={renameStore} deleteStore={deleteStore} />
          )}
          {tab === "reminders" && (
            <RemindersTab members={members} me={me} reminders={visibleReminders} isOverdue={isOverdue}
              addReminder={addReminder} toggleReminder={toggleReminder} deleteReminder={deleteReminder} />
          )}
          {tab === "events" && (
            <EventsTab members={members} stores={stores} events={sortedEvents}
              addEvent={addEvent} deleteEvent={deleteEvent}
              openStore={(storeId) => { setTab("shopping"); setStoreFilter(storeId); }} />
          )}
        </div>

        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-x border-stone-200 flex justify-around py-2"
          style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}>
          {[
            { id: "home", icon: Home, label: "Home" },
            { id: "shopping", icon: ShoppingCart, label: "Shopping" },
            { id: "reminders", icon: Bell, label: "Reminders" },
            { id: "events", icon: Calendar, label: "Events" },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 ${tab === t.id ? "text-teal-700" : "text-stone-400"}`}>
              <t.icon size={20} />
              <span className="text-[10px]">{t.label}</span>
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
      </div>
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
  const [copied, setCopied] = useState(false);
  const submit = () => { onAdd(name); setName(""); };
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(household.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };
  return (
    <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={close}>
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-medium text-stone-900 flex items-center gap-2">
            <Users size={18} /> {household.name}
          </h2>
          <button onClick={close} aria-label="Close" className="text-stone-400"><X size={18} /></button>
        </div>
        <button onClick={copyCode} className="flex items-center gap-1.5 text-xs text-teal-700 mb-4">
          <Copy size={12} /> {copied ? "Copied" : "Copy invite code"}
        </button>
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
function HomeTab({ members, stores, toBuy, dueTodayCount, overdueCount, todayEventsCount,
  visibleReminders, isOverdue, upcoming, toggleReminder, toggleItem, goTo }) {
  const homeReminders = visibleReminders.filter((r) => !r.done);
  const preview = toBuy;
  return (
    <div className="space-y-3.5">
      <div className="bg-stone-50 rounded-lg px-3 py-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-stone-600">
        <span className="flex items-center gap-1"><ShoppingCart size={12} /> {toBuy.length} to buy</span>
        <span className="flex items-center gap-1"><Bell size={12} /> {dueTodayCount} due today{overdueCount > 0 ? ` · ${overdueCount} overdue` : ""}</span>
        <span className="flex items-center gap-1"><Calendar size={12} /> {todayEventsCount} event{todayEventsCount === 1 ? "" : "s"} today</span>
      </div>

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
  addItem, toggleItem, deleteItem, clearDone, addStore, renameStore, deleteStore }) {
  const [text, setText] = useState("");
  const [storeId, setStoreId] = useState("");
  const [manage, setManage] = useState(false);
  const [newStore, setNewStore] = useState("");
  const submit = () => { addItem(text, storeId); setText(""); };
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
          className="w-28 h-10 px-2 text-xs border border-stone-200 rounded-xl outline-none focus:border-teal-500 bg-white text-stone-600">
          <option value="">No store</option>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button onClick={submit} aria-label="Add item" className="h-10 px-3 bg-teal-600 text-white text-sm rounded-xl hover:bg-teal-700">
          <Plus size={15} />
        </button>
      </div>
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
                  onToggle={() => toggleItem(it)} onDelete={() => deleteItem(it.id)} />
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
function ItemRow({ members, item, onToggle, onDelete }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <button onClick={onToggle} aria-label={item.done ? "Mark not done" : "Mark done"}
        className={`w-5 h-5 rounded-full flex items-center justify-center border shrink-0 ${item.done ? "bg-teal-600 border-teal-600" : "border-stone-300 hover:border-teal-500"}`}>
        {item.done && <Check size={12} className="text-white" />}
      </button>
      <span className={`flex-1 text-sm ${item.done ? "text-stone-400 line-through" : "text-stone-800"}`}>{item.content}</span>
      <Avatar members={members} id={item.added_by} size="w-6 h-6 text-[10px]" />
      {onDelete && (
        <button onClick={onDelete} aria-label="Delete item" className="text-stone-300 hover:text-red-500">
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}

function ReminderRow({ members, r, overdue, onToggle, onDelete }) {
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
      {onDelete && (
        <button onClick={onDelete} aria-label="Delete reminder" className="text-stone-300 hover:text-red-500">
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}

function EventRow({ members, stores, ev, highlight, onDelete, onOpenStore }) {
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
      {onDelete && (
        <button onClick={onDelete} aria-label="Delete event" className="text-stone-300 hover:text-red-500 mt-1">
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}

/* ---------- Reminders ---------- */
function RemindersTab({ members, me, reminders, isOverdue, addReminder, toggleReminder, deleteReminder }) {
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
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <input value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Remind me to…" maxLength={100}
          className="w-full h-10 px-3 text-sm border border-stone-200 rounded-xl outline-none focus:border-teal-500 bg-white text-stone-900" />
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
            onToggle={() => toggleReminder(r)} onDelete={() => deleteReminder(r.id)} />
        ))}
        {open.length === 0 && <p className="p-3 text-sm text-stone-400">All caught up. Add a reminder above.</p>}
      </div>
      {doneList.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-stone-400 mb-2">Done</h3>
          <div className="border border-stone-200 rounded-xl divide-y divide-stone-100">
            {doneList.map((r) => (
              <ReminderRow key={r.id} members={members} r={r} overdue={false}
                onToggle={() => toggleReminder(r)} onDelete={() => deleteReminder(r.id)} />
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
function EventsTab({ members, stores, events, addEvent, deleteEvent, openStore }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", date: "", time: "", location: "", notes: "", storeId: "" });
  const set = (k, v) => setForm({ ...form, [k]: v });
  const submit = () => {
    addEvent(form);
    setForm({ title: "", date: "", time: "", location: "", notes: "", storeId: "" });
    setShowForm(false);
  };
  const upcoming = events.filter((e) => e.event_date >= todayStr());
  const past = events.filter((e) => e.event_date < todayStr());
  return (
    <div className="space-y-4">
      {!showForm ? (
        <button onClick={() => setShowForm(true)}
          className="w-full h-10 border border-dashed border-stone-300 rounded-xl text-sm text-stone-500 hover:border-teal-500 hover:text-teal-700 flex items-center justify-center gap-1">
          <Plus size={15} /> Add event
        </button>
      ) : (
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
              Save event
            </button>
            <button onClick={() => setShowForm(false)} className="h-10 px-4 border border-stone-200 text-sm text-stone-600 rounded-xl hover:bg-stone-50">
              Cancel
            </button>
          </div>
        </div>
      )}
      <div className="border border-stone-200 rounded-xl divide-y divide-stone-100">
        {upcoming.map((ev) => (
          <EventRow key={ev.id} members={members} stores={stores} ev={ev} highlight
            onDelete={() => deleteEvent(ev.id)} onOpenStore={() => openStore(ev.store_id)} />
        ))}
        {upcoming.length === 0 && <p className="p-3 text-sm text-stone-400">No upcoming events. Add one above.</p>}
      </div>
      {past.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-stone-400 mb-2">Past</h3>
          <div className="border border-stone-200 rounded-xl divide-y divide-stone-100">
            {past.map((ev) => (
              <EventRow key={ev.id} members={members} stores={stores} ev={ev}
                onDelete={() => deleteEvent(ev.id)} onOpenStore={() => openStore(ev.store_id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
