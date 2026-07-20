import { useState, useEffect, useCallback, useRef } from "react";
import {
  ShoppingCart, Bell, Calendar, Home, Plus, Check, Trash2,
  Clock, MapPin, X, ChevronLeft, Users, Link2, Copy, LogOut, Lock,
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

export default function App() {
  const [household, setHousehold] = useState(() => {
    try { return JSON.parse(localStorage.getItem(HH_KEY) || "null"); } catch { return null; }
  });
  const [me, setMe] = useState(() => localStorage.getItem(ME_KEY) || null);
  const [members, setMembers] = useState([]);
  const [lists, setLists] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(!!household);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("home");
  const [openListId, setOpenListId] = useState(null);
  const [showMembers, setShowMembers] = useState(false);
  const notified = useRef(new Set());

  const fetchAll = useCallback(async () => {
    if (!household) return;
    const hid = household.id;
    try {
      const [m, l, li, r, ev] = await Promise.all([
        supabase.from("handy_members").select("*").eq("household_id", hid).order("created_at"),
        supabase.from("handy_lists").select("*").eq("household_id", hid).order("created_at"),
        supabase.from("handy_list_items").select("*").eq("household_id", hid).order("created_at"),
        supabase.from("handy_reminders").select("*").eq("household_id", hid).order("due_at"),
        supabase.from("handy_events").select("*").eq("household_id", hid),
      ]);
      const firstError = [m, l, li, r, ev].find((x) => x.error);
      if (firstError) throw firstError.error;
      setMembers(m.data);
      setLists(l.data.map((x) => ({ ...x, items: li.data.filter((i) => i.list_id === x.id) })));
      setReminders(r.data);
      setEvents(ev.data);
      setError("");
    } catch (e) {
      setError("Couldn't load data. Check your connection and Supabase setup.");
    }
    setLoading(false);
  }, [household]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Live sync: refetch whenever anyone in the household changes anything.
  useEffect(() => {
    if (!household) return;
    const hid = household.id;
    const tables = ["handy_members", "handy_lists", "handy_list_items", "handy_reminders", "handy_events"];
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

  // In-app notifications for reminders coming due (works while the app is open).
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
    setMembers([]); setLists([]); setReminders([]); setEvents([]);
    setShowMembers(false);
  };

  // ---- mutations (realtime triggers refetch, but we also refetch directly for snappiness) ----
  const run = async (promise) => {
    const { error: e } = await promise;
    if (e) setError("Couldn't save that change. Try again.");
    else fetchAll();
  };
  const addMember = (name) => {
    if (!name.trim()) return;
    return supabase.from("handy_members").insert({ household_id: household.id, name: name.trim() }).select().single();
  };
  const addList = (name) => name.trim() && run(supabase.from("handy_lists").insert({ household_id: household.id, name: name.trim() }));
  const deleteList = (id) => {
    if (!window.confirm("Delete this list for everyone?")) return;
    setOpenListId(null);
    run(supabase.from("handy_lists").delete().eq("id", id));
  };
  const addItem = (listId, content) => content.trim() && run(
    supabase.from("handy_list_items").insert({ household_id: household.id, list_id: listId, content: content.trim(), added_by: me })
  );
  const toggleItem = (item) => run(supabase.from("handy_list_items").update({ done: !item.done }).eq("id", item.id));
  const deleteItem = (id) => run(supabase.from("handy_list_items").delete().eq("id", id));
  const addReminder = (content, dueLocal, sharedWith) => {
    if (!content.trim() || !dueLocal) return;
    // sharedWith: null = everyone, [] = just me, [ids] = me + those members
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
      notes: ev.notes || null, list_id: ev.listId || null, added_by: me,
    }));
  };
  const deleteEvent = (id) => run(supabase.from("handy_events").delete().eq("id", id));

  // ---- derived ----
  const now = new Date();
  const canSee = (r) => r.shared_with == null || r.added_by === me || (r.shared_with || []).includes(me);
  const visibleReminders = reminders.filter(canSee);
  const isOverdue = (r) => !r.done && new Date(r.due_at) < now;
  const dueTodayCount = visibleReminders.filter((r) => !r.done && new Date(r.due_at).toDateString() === now.toDateString()).length;
  const overdueCount = visibleReminders.filter(isOverdue).length;
  const toBuyCount = lists.reduce((n, l) => n + l.items.filter((i) => !i.done).length, 0);
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

  const openList = lists.find((l) => l.id === openListId);

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
            <HomeTab members={members} lists={lists} reminders={visibleReminders}
              toBuyCount={toBuyCount} dueTodayCount={dueTodayCount} overdueCount={overdueCount}
              todayEventsCount={todayEventsCount} isOverdue={isOverdue} upcoming={upcoming}
              toggleReminder={toggleReminder} toggleItem={toggleItem}
              goTo={(t, listId) => { setTab(t); setOpenListId(listId || null); }} />
          )}
          {tab === "handy_lists" && !openList && <ListsTab lists={lists} addList={addList} openL={setOpenListId} />}
          {tab === "handy_lists" && openList && (
            <ListDetail members={members} list={openList} back={() => setOpenListId(null)}
              addItem={addItem} toggleItem={toggleItem} deleteItem={deleteItem} deleteList={deleteList} />
          )}
          {tab === "handy_reminders" && (
            <RemindersTab members={members} me={me} reminders={visibleReminders} isOverdue={isOverdue}
              addReminder={addReminder} toggleReminder={toggleReminder} deleteReminder={deleteReminder} />
          )}
          {tab === "handy_events" && (
            <EventsTab members={members} lists={lists} events={sortedEvents}
              addEvent={addEvent} deleteEvent={deleteEvent}
              openLinkedList={(listId) => { setTab("handy_lists"); setOpenListId(listId); }} />
          )}
        </div>

        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-x border-stone-200 flex justify-around py-2"
          style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}>
          {[
            { id: "home", icon: Home, label: "Home" },
            { id: "handy_lists", icon: ShoppingCart, label: "Lists" },
            { id: "handy_reminders", icon: Bell, label: "Reminders" },
            { id: "handy_events", icon: Calendar, label: "Events" },
          ].map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); setOpenListId(null); }}
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
          Shared shopping lists, reminders, and events for your family.
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
function HomeTab({ members, lists, reminders, toBuyCount, dueTodayCount, overdueCount,
  todayEventsCount, isOverdue, upcoming, toggleReminder, toggleItem, goTo }) {
  const previewList = lists.find((l) => l.items.some((i) => !i.done)) || lists[0];
  const homeReminders = [...reminders].filter((r) => !r.done).slice(0, 3);
  return (
    <div className="space-y-5">
      <div className="bg-stone-50 rounded-xl px-4 py-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
        <span className="flex items-center gap-1"><ShoppingCart size={13} /> {toBuyCount} to buy</span>
        <span className="flex items-center gap-1"><Bell size={13} /> {dueTodayCount} due today{overdueCount > 0 ? ` · ${overdueCount} overdue` : ""}</span>
        <span className="flex items-center gap-1"><Calendar size={13} /> {todayEventsCount} event{todayEventsCount === 1 ? "" : "s"} today</span>
      </div>

      {previewList && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-stone-500">{previewList.name}</h2>
            <button onClick={() => goTo("handy_lists", previewList.id)} className="text-xs text-teal-700">Open</button>
          </div>
          <div className="border border-stone-200 rounded-xl divide-y divide-stone-100">
            {previewList.items.slice(0, 4).map((it) => (
              <ItemRow key={it.id} members={members} item={it} onToggle={() => toggleItem(it)} />
            ))}
            {previewList.items.length === 0 && (
              <p className="p-3 text-sm text-stone-400">List is empty — open it to add items.</p>
            )}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-stone-500">Reminders</h2>
          <button onClick={() => goTo("handy_reminders")} className="text-xs text-teal-700">All</button>
        </div>
        <div className="border border-stone-200 rounded-xl divide-y divide-stone-100">
          {homeReminders.map((r) => (
            <ReminderRow key={r.id} members={members} r={r} overdue={isOverdue(r)} onToggle={() => toggleReminder(r)} />
          ))}
          {homeReminders.length === 0 && <p className="p-3 text-sm text-stone-400">Nothing due. Add one from the Reminders tab.</p>}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-stone-500">Upcoming events</h2>
          <button onClick={() => goTo("handy_events")} className="text-xs text-teal-700">All</button>
        </div>
        <div className="border border-stone-200 rounded-xl divide-y divide-stone-100">
          {upcoming.slice(0, 2).map((ev) => <EventRow key={ev.id} members={members} lists={[]} ev={ev} highlight />)}
          {upcoming.length === 0 && <p className="p-3 text-sm text-stone-400">No upcoming events. Add one from the Events tab.</p>}
        </div>
      </section>
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
          ? <Users size={13} className="text-stone-400 shrink-0" title="Shared with selected members" />
          : <Lock size={13} className="text-stone-300 shrink-0" title="Only you can see this" />
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

function EventRow({ members, lists, ev, highlight, onDelete, onOpenList }) {
  const past = ev.event_date < todayStr();
  const linked = lists.find((l) => l.id === ev.list_id);
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
          <button onClick={onOpenList} className="text-[11px] text-teal-700 flex items-center gap-1 mt-1">
            <Link2 size={11} /> {linked.name} list
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

/* ---------- Lists ---------- */
function ListsTab({ lists, addList, openL }) {
  const [name, setName] = useState("");
  const submit = () => { addList(name); setName(""); };
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="New list, like Groceries" maxLength={40}
          className="flex-1 h-10 px-3 text-sm border border-stone-200 rounded-xl outline-none focus:border-teal-500 bg-white text-stone-900" />
        <button onClick={submit} className="h-10 px-4 bg-teal-600 text-white text-sm rounded-xl hover:bg-teal-700 flex items-center gap-1">
          <Plus size={15} /> Add
        </button>
      </div>
      {lists.length === 0 && (
        <p className="text-sm text-stone-400 text-center py-8">No lists yet. Create your first one above.</p>
      )}
      <div className="space-y-2">
        {lists.map((l) => {
          const left = l.items.filter((i) => !i.done).length;
          return (
            <button key={l.id} onClick={() => openL(l.id)}
              className="w-full flex items-center gap-3 p-4 border border-stone-200 rounded-xl hover:bg-stone-50 text-left">
              <ShoppingCart size={18} className="text-teal-700 shrink-0" />
              <span className="flex-1 text-sm font-medium text-stone-800">{l.name}</span>
              <span className="text-xs text-stone-400">
                {l.items.length === 0 ? "Empty" : left === 0 ? "All done" : `${left} to buy`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ListDetail({ members, list, back, addItem, toggleItem, deleteItem, deleteList }) {
  const [text, setText] = useState("");
  const done = list.items.filter((i) => i.done).length;
  const submit = () => { addItem(list.id, text); setText(""); };
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={back} aria-label="Back" className="text-stone-500"><ChevronLeft size={20} /></button>
        <h2 className="flex-1 text-base font-medium text-stone-900">{list.name}</h2>
        <span className="text-xs text-teal-700">{done} of {list.items.length} done</span>
        <button onClick={() => deleteList(list.id)} aria-label="Delete list" className="text-stone-300 hover:text-red-500">
          <Trash2 size={16} />
        </button>
      </div>
      <div className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Add item, like Milk 2L" maxLength={80}
          className="flex-1 h-10 px-3 text-sm border border-stone-200 rounded-xl outline-none focus:border-teal-500 bg-white text-stone-900" />
        <button onClick={submit} aria-label="Add item" className="h-10 px-4 bg-teal-600 text-white text-sm rounded-xl hover:bg-teal-700">
          <Plus size={15} />
        </button>
      </div>
      <div className="border border-stone-200 rounded-xl divide-y divide-stone-100">
        {list.items.map((it) => (
          <ItemRow key={it.id} members={members} item={it}
            onToggle={() => toggleItem(it)} onDelete={() => deleteItem(it.id)} />
        ))}
        {list.items.length === 0 && <p className="p-3 text-sm text-stone-400">List is empty. Add the first item above.</p>}
      </div>
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
          placeholder="Remind everyone to…" maxLength={100}
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
function EventsTab({ members, lists, events, addEvent, deleteEvent, openLinkedList }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", date: "", time: "", location: "", notes: "", listId: "" });
  const set = (k, v) => setForm({ ...form, [k]: v });
  const submit = () => {
    addEvent(form);
    setForm({ title: "", date: "", time: "", location: "", notes: "", listId: "" });
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
          {lists.length > 0 && (
            <select value={form.listId} onChange={(e) => set("listId", e.target.value)}
              className="w-full h-10 px-3 text-sm border border-stone-200 rounded-xl outline-none focus:border-teal-500 bg-white text-stone-600">
              <option value="">Link a shopping list (optional)</option>
              {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
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
          <EventRow key={ev.id} members={members} lists={lists} ev={ev} highlight
            onDelete={() => deleteEvent(ev.id)} onOpenList={() => openLinkedList(ev.list_id)} />
        ))}
        {upcoming.length === 0 && <p className="p-3 text-sm text-stone-400">No upcoming events. Add one above.</p>}
      </div>
      {past.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-stone-400 mb-2">Past</h3>
          <div className="border border-stone-200 rounded-xl divide-y divide-stone-100">
            {past.map((ev) => (
              <EventRow key={ev.id} members={members} lists={lists} ev={ev}
                onDelete={() => deleteEvent(ev.id)} onOpenList={() => openLinkedList(ev.list_id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
