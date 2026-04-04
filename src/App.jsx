import React, { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const DEFAULT_PEOPLE = ["Federico", "Mica", "Santy", "Compartido"];
const DEFAULT_PAYMENT_METHODS = ["Banco", "Tarjeta", "Efectivo", "Mercado Pago", "Transferencia"];
const DEFAULT_TYPES = ["Ingreso", "Egreso", "Ahorro", "Inversión"];
const DEFAULT_CATEGORY_ROWS = [
  { type: "Ingreso", name: "Sueldo", fv: "V", active: true },
  { type: "Ingreso", name: "Freelance", fv: "V", active: true },
  { type: "Ingreso", name: "Venta", fv: "V", active: true },
  { type: "Ingreso", name: "Otros ingresos", fv: "V", active: true },
  { type: "Egreso", name: "Supermercado", fv: "V", active: true },
  { type: "Egreso", name: "Salud", fv: "V", active: true },
  { type: "Egreso", name: "Salud mental", fv: "F", active: true },
  { type: "Egreso", name: "Educación", fv: "F", active: true },
  { type: "Egreso", name: "Transporte", fv: "V", active: true },
  { type: "Egreso", name: "Servicios", fv: "F", active: true },
  { type: "Egreso", name: "Alquiler", fv: "F", active: true },
  { type: "Egreso", name: "Salidas", fv: "V", active: true },
  { type: "Egreso", name: "Deuda", fv: "F", active: true },
  { type: "Ahorro", name: "Fondo de emergencia", fv: "V", active: true },
  { type: "Ahorro", name: "Ahorro USD", fv: "V", active: true },
  { type: "Ahorro", name: "Caja ahorro", fv: "V", active: true },
  { type: "Inversión", name: "FCI", fv: "V", active: true },
  { type: "Inversión", name: "Acciones", fv: "V", active: true },
  { type: "Inversión", name: "Cedears", fv: "V", active: true },
  { type: "Inversión", name: "Cripto", fv: "V", active: true },
];

const money = (n, cur = "ARS") =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: cur,
    maximumFractionDigits: cur === "USD" ? 2 : 0,
  }).format(Number(n || 0));

const monthKey = (d) => {
  const dt = new Date(`${d}T00:00:00`);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
};
const yearKey = (d) => String(new Date(`${d}T00:00:00`).getFullYear());
const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);
const currentYear = () => String(new Date().getFullYear());
const PALETTE = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2", "#ea580c", "#be185d"];

function buildCategoryMap(rows) {
  const out = {};
  rows.filter((r) => r.active !== false).forEach((r) => {
    if (!out[r.type]) out[r.type] = [];
    if (!out[r.type].includes(r.name)) out[r.type].push(r.name);
  });
  return out;
}
function buildCategoryFV(rows) {
  const out = {};
  rows.filter((r) => r.active !== false).forEach((r) => {
    out[`${r.type}__${r.name}`] = r.fv || "V";
  });
  return out;
}
function safeParseMeta(notes) {
  if (!notes || typeof notes !== "string") return {};
  if (!notes.startsWith("__META__")) return {};
  try {
    return JSON.parse(notes.replace("__META__", ""));
  } catch {
    return {};
  }
}
function serializeMeta(meta, plainNotes = "") {
  return `__META__${JSON.stringify({ ...meta, plainNotes })}`;
}

function Card({ children, className = "" }) {
  return <div className={`card ${className}`}>{children}</div>;
}
function CardHead({ title, icon }) {
  return (
    <div className="card-head">
      {icon && <span className="card-icon">{icon}</span>}
      <h2 className="card-title">{title}</h2>
    </div>
  );
}
function Btn({ children, onClick, variant = "primary", disabled = false, small = false, className = "", type = "button" }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`btn btn-${variant}${small ? " btn-sm" : ""} ${className}`}>
      {children}
    </button>
  );
}
function Field({ label, children }) {
  return <div className="field"><label className="field-label">{label}</label>{children}</div>;
}
function Input({ type = "text", value, onChange, placeholder, min, max, step, className = "", disabled = false }) {
  return <input type={type} value={value} onChange={onChange} placeholder={placeholder} min={min} max={max} step={step} className={`control ${className}`} disabled={disabled} />;
}
function Select({ value, onChange, children, disabled = false, className = "" }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={`control ${className}`}>{children}</select>;
}
function Badge({ children, color = "blue" }) {
  return <span className={`badge badge-${color}`}>{children}</span>;
}
function Progress({ value }) {
  const pct = Math.min(100, Math.max(0, value));
  const color = pct > 100 ? "#dc2626" : pct >= 85 ? "#f59e0b" : "#16a34a";
  return <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%`, background: color }} /></div>;
}
function Spinner() { return <div className="spinner" />; }
function EmptyState({ msg }) { return <div className="empty-state">{msg}</div>; }
function InfoBox({ children, color = "blue" }) { return <div className={`info-box info-${color}`}>{children}</div>; }

function BarChart({ data, xKey, bars, formatter }) {
  if (!data?.length) return <EmptyState msg="Sin datos para mostrar" />;
  const W = 740, H = 320, PL = 60, PR = 20, PT = 24, PB = 66;
  const iW = W - PL - PR, iH = H - PT - PB;
  const positiveVals = data.flatMap((d) => bars.map((b) => Math.max(0, Number(d[b.key] || 0))));
  const maxVal = Math.max(...positiveVals, 1);
  const gap = iW / data.length;
  const barW = Math.max(12, (gap * 0.76) / bars.length);

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        {Array.from({ length: 5 }, (_, i) => {
          const ratio = i / 4;
          const y = PT + iH - iH * ratio;
          const v = maxVal * ratio;
          return (
            <g key={i}>
              <line x1={PL} x2={PL + iW} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={PL - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#64748b">{formatter(v, true)}</text>
            </g>
          );
        })}
        {data.map((d, di) => {
          const cx = PL + di * gap + gap / 2;
          return bars.map((b, bi) => {
            const val = Math.max(0, Number(d[b.key] || 0));
            const h = (val / maxVal) * iH;
            const x = cx - (bars.length * barW) / 2 + bi * barW;
            const y = PT + iH - h;
            return (
              <g key={`${di}-${b.key}`}>
                <rect x={x} y={y} width={barW - 2} height={h} fill={b.color} rx="4" />
                {val > 0 && <text x={x + (barW - 2) / 2} y={Math.max(PT + 10, y - 6)} textAnchor="middle" fontSize="9" fill="#334155">{formatter(val, true)}</text>}
              </g>
            );
          });
        })}
        {data.map((d, di) => <text key={di} x={PL + di * gap + gap / 2} y={H - PB + 18} textAnchor="middle" fontSize="10" fill="#64748b">{String(d[xKey]).slice(5) || d[xKey]}</text>)}
        {bars.map((b, bi) => (
          <g key={b.key} transform={`translate(${PL + bi * 120}, ${H - 14})`}>
            <rect width="10" height="10" fill={b.color} rx="2" />
            <text x="14" y="9" fontSize="10" fill="#475569">{b.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function PieChart({ data, nameKey, valueKey, formatter }) {
  const total = data.reduce((a, b) => a + Number(b[valueKey] || 0), 0);
  if (!total) return <EmptyState msg="Sin datos para mostrar" />;
  const W = 360, H = 280, cx = 120, cy = 130, r = 94, ir = 50;
  let start = -Math.PI / 2;
  const slices = data.slice(0, 8).map((d, i) => {
    const val = Number(d[valueKey] || 0);
    const pct = val / total;
    const angle = pct * Math.PI * 2;
    const end = start + angle;
    const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
    const ix1 = cx + ir * Math.cos(start), iy1 = cy + ir * Math.sin(start);
    const ix2 = cx + ir * Math.cos(end), iy2 = cy + ir * Math.sin(end);
    const large = angle > Math.PI ? 1 : 0;
    const path = `M ${ix1} ${iy1} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${ir} ${ir} 0 ${large} 0 ${ix1} ${iy1} Z`;
    const item = { path, color: PALETTE[i % PALETTE.length], pct, value: val, name: d[nameKey] };
    start = end;
    return item;
  });
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth="2" />)}
        {slices.map((s, i) => (
          <g key={i} transform={`translate(235, ${20 + i * 28})`}>
            <rect width="12" height="12" fill={s.color} rx="2" />
            <text x="16" y="10" fontSize="10" fill="#1e293b">{s.name.length > 14 ? `${s.name.slice(0, 13)}…` : s.name}</text>
            <text x="16" y="21" fontSize="9" fill="#64748b">{(s.pct * 100).toFixed(1)}% · {formatter(s.value, true)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

const TABS = [
  { id: "cargar", label: "📥 Cargar" },
  { id: "dashboard", label: "📊 Dashboard" },
  { id: "datos", label: "🗂 Datos" },
  { id: "presupuesto", label: "🎯 Presupuesto" },
  { id: "reportes", label: "📈 Reportes" },
  { id: "deudas", label: "💳 Deudas" },
  { id: "config", label: "⚙️ Config" },
];

export default function App() {
  const [tab, setTab] = useState("cargar");
  const [people, setPeople] = useState(DEFAULT_PEOPLE);
  const [paymentMethods, setPaymentMethods] = useState(DEFAULT_PAYMENT_METHODS);
  const [types, setTypes] = useState(DEFAULT_TYPES);
  const [categoryRows, setCategoryRows] = useState(DEFAULT_CATEGORY_ROWS);
  const [categoryMap, setCategoryMap] = useState(buildCategoryMap(DEFAULT_CATEGORY_ROWS));
  const [categoryFVMap, setCategoryFVMap] = useState(buildCategoryFV(DEFAULT_CATEGORY_ROWS));

  const [movements, setMovements] = useState([]);
  const [debts, setDebts] = useState([]);
  const [debtPayments, setDebtPayments] = useState([]);
  const [goals, setGoals] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [monthlyBalances, setMonthlyBalances] = useState([]);

  const [blueRate, setBlueRate] = useState(1250);
  const [displayCurrency, setDisplayCurrency] = useState("ARS");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reportMonth, setReportMonth] = useState(currentMonth());
  const [reportYear, setReportYear] = useState(currentYear());
  const [globalPerson, setGlobalPerson] = useState("all");

  const [filters, setFilters] = useState({ person: "all", type: "all", category: "all", month: currentMonth(), currency: "all", fv: "all" });

  const emptyMovForm = useCallback(() => ({
    date: today(), person: "Compartido", type: "", category: "", description: "", originalAmount: "", currency: "ARS", paymentMethod: paymentMethods[0] || "", linkedDebtId: "",
  }), [paymentMethods]);

  const [movForm, setMovForm] = useState(emptyMovForm());
  const [debtForm, setDebtForm] = useState({ name: "", owner: "Compartido", balance: "", installment: "", dueDay: "", priority: "Media", rate: "", notes: "" });
  const [goalForm, setGoalForm] = useState({ name: "", target: "", current: "", kind: "Ahorro", period: "Mensual", linkedCategory: "" });
  const [budgetForm, setBudgetForm] = useState({ month: currentMonth(), person: "Compartido", type: "Egreso", category: "Supermercado", planned: "" });
  const [debtPayForm, setDebtPayForm] = useState({ debtId: "", date: today(), amount: "", person: "Compartido", paymentMethod: "Banco", notes: "" });
  const [balanceForm, setBalanceForm] = useState({ month: currentMonth(), opening: "", notes: "" });
  const [catalogForm, setCatalogForm] = useState({ person: "", paymentMethod: "", type: "", categoryType: "Egreso", category: "", categoryFv: "V" });

  function getFV(type, category) {
    return categoryFVMap[`${type}__${category}`] || "V";
  }
  function amountDisplay(m) {
    return displayCurrency === "USD" ? Number(m.amountUsd || 0) : Number(m.amountArs || 0);
  }
  function fmtDisplay(v) { return money(v, displayCurrency); }
  function fmtTick(v) {
    const n = Number(v || 0);
    if (displayCurrency === "USD") return `$${n.toFixed(0)}`;
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return `${n.toFixed(0)}`;
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [movRes, debtRes, dpRes, goalRes, budRes, balRes, catRes, categoriesRes] = await Promise.all([
          supabase.from("movements").select("*").order("movement_date", { ascending: false }),
          supabase.from("debts").select("*").order("created_at", { ascending: false }),
          supabase.from("debt_payments").select("*").order("payment_date", { ascending: false }),
          supabase.from("goals").select("*").order("created_at", { ascending: false }),
          supabase.from("budgets").select("*").order("created_at", { ascending: false }),
          supabase.from("monthly_balances").select("*").order("balance_month", { ascending: false }),
          supabase.from("settings_catalog").select("*").order("created_at"),
          supabase.from("categories").select("*").order("type").order("name"),
        ]);

        const movs = movRes.data || [];
        const dbs = debtRes.data || [];
        const dps = dpRes.data || [];
        const gls = goalRes.data || [];
        const bgs = budRes.data || [];
        const mbs = balRes.data || [];
        const cats = catRes.data || [];
        const categoriesData = categoriesRes.data || [];

        setMovements(movs.map((m) => ({
          id: m.id, date: m.movement_date, person: m.person, type: m.type, category: m.category, description: m.description,
          originalAmount: m.original_amount, currency: m.original_currency, fxRate: m.fx_rate, amountArs: m.amount_ars, amountUsd: m.amount_usd,
          paymentMethod: m.payment_method, linkedDebtId: m.linked_debt_id,
        })));
        setDebts(dbs.map((d) => ({
          id: d.id, name: d.name, owner: d.owner, balance: d.current_balance, initialBalance: d.initial_balance,
          installment: d.installment_amount, dueDay: d.due_day, priority: d.priority, rate: d.rate, notes: d.notes, totalPaid: d.total_paid, status: d.status,
        })));
        setDebtPayments(dps.map((p) => ({ id: p.id, debtId: p.debt_id, date: p.payment_date, amount: p.amount_ars, person: p.person, paymentMethod: p.payment_method, notes: p.notes })));
        setGoals(gls.map((g) => ({ ...g, meta: safeParseMeta(g.notes) })));
        setBudgets(bgs.map((b) => ({ id: b.id, month: b.budget_month, person: b.person, type: b.type, category: b.category, planned: b.planned_amount_ars })));
        setMonthlyBalances(mbs);

        if (cats.length) {
          const newPeople = cats.filter((c) => c.catalog_type === "person").map((c) => c.value);
          const newPM = cats.filter((c) => c.catalog_type === "payment_method").map((c) => c.value);
          const newTypes = cats.filter((c) => c.catalog_type === "type").map((c) => c.value);
          if (newPeople.length) setPeople(newPeople);
          if (newPM.length) setPaymentMethods(newPM);
          if (newTypes.length) setTypes(newTypes);
        }
        if (categoriesData.length) {
          const rows = categoriesData.map((r) => ({ id: r.id, type: r.type, name: r.name, fv: r.fv || "V", active: r.active }));
          setCategoryRows(rows);
          setCategoryMap(buildCategoryMap(rows));
          setCategoryFVMap(buildCategoryFV(rows));
        }
      } catch (e) {
        console.error("Error cargando datos:", e);
      }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    async function fetchBlue() {
      try {
        const res = await fetch("https://dolarapi.com/v1/dolares/blue");
        if (!res.ok) return;
        const data = await res.json();
        if (Number(data?.venta || 0) > 0) setBlueRate(Number(data.venta));
      } catch {}
    }
    fetchBlue();
  }, []);

  const scopedMovements = useMemo(() => globalPerson === "all" ? movements : movements.filter((m) => m.person === globalPerson), [movements, globalPerson]);
  const scopedBudgets = useMemo(() => globalPerson === "all" ? budgets : budgets.filter((b) => b.person === globalPerson), [budgets, globalPerson]);
  const scopedDebts = useMemo(() => globalPerson === "all" ? debts : debts.filter((d) => d.owner === globalPerson || d.owner === "Compartido"), [debts, globalPerson]);

  async function addMovement() {
    if (!movForm.category || !movForm.originalAmount || !movForm.person || !movForm.type) return;
    setSaving(true);
    const rate = movForm.currency === "USD" ? blueRate : 1;
    const amountArs = movForm.currency === "USD" ? Number(movForm.originalAmount || 0) * rate : Number(movForm.originalAmount || 0);
    const amountUsd = movForm.currency === "USD" ? Number(movForm.originalAmount || 0) : amountArs / (Number(movForm.fxRate || blueRate) || 1);
    const selectedDebt = debts.find((d) => String(d.id) === String(movForm.linkedDebtId));
    const row = {
      movement_date: movForm.date, person: movForm.person, type: movForm.type, category: movForm.category, description: movForm.description || null,
      original_currency: movForm.currency, original_amount: Number(movForm.originalAmount), fx_rate: rate,
      amount_ars: amountArs, amount_usd: amountUsd, payment_method: movForm.paymentMethod, linked_debt_id: movForm.linkedDebtId ? Number(movForm.linkedDebtId) : null,
    };
    const { data, error } = await supabase.from("movements").insert([row]).select().single();
    if (!error && data) {
      const mov = { id: data.id, date: data.movement_date, person: data.person, type: data.type, category: data.category, description: data.description, originalAmount: data.original_amount, currency: data.original_currency, fxRate: data.fx_rate, amountArs: data.amount_ars, amountUsd: data.amount_usd, paymentMethod: data.payment_method, linkedDebtId: data.linked_debt_id };
      setMovements((prev) => [mov, ...prev]);
      if (movForm.type === "Egreso" && movForm.category === "Deuda" && selectedDebt) {
        const newBalance = Math.max(0, selectedDebt.balance - amountArs);
        const newPaid = (selectedDebt.totalPaid || 0) + amountArs;
        await supabase.from("debts").update({ current_balance: newBalance, total_paid: newPaid }).eq("id", selectedDebt.id);
        await supabase.from("debt_payments").insert([{ debt_id: selectedDebt.id, payment_date: movForm.date, amount_ars: amountArs, person: movForm.person, payment_method: movForm.paymentMethod, notes: movForm.description || "Pago desde egreso", linked_movement_id: data.id }]);
        setDebts((prev) => prev.map((d) => d.id === selectedDebt.id ? { ...d, balance: newBalance, totalPaid: newPaid } : d));
      }
    }
    setMovForm(emptyMovForm());
    setSaving(false);
  }
  async function deleteMovement(id) {
    await supabase.from("movements").delete().eq("id", id);
    setMovements((prev) => prev.filter((m) => m.id !== id));
  }
  async function addDebt() {
    if (!debtForm.name || !debtForm.balance) return;
    setSaving(true);
    const bal = Number(debtForm.balance);
    const { data } = await supabase.from("debts").insert([{ name: debtForm.name, owner: debtForm.owner, initial_balance: bal, current_balance: bal, installment_amount: Number(debtForm.installment || 0), due_day: Number(debtForm.dueDay || 0), priority: debtForm.priority, rate: Number(debtForm.rate || 0), notes: debtForm.notes || null, total_paid: 0, status: "Activa" }]).select().single();
    if (data) setDebts((prev) => [{ id: data.id, name: data.name, owner: data.owner, balance: data.current_balance, initialBalance: data.initial_balance, installment: data.installment_amount, dueDay: data.due_day, priority: data.priority, rate: data.rate, notes: data.notes, totalPaid: data.total_paid, status: data.status }, ...prev]);
    setDebtForm({ name: "", owner: "Compartido", balance: "", installment: "", dueDay: "", priority: "Media", rate: "", notes: "" });
    setSaving(false);
  }
  async function deleteDebt(id) { await supabase.from("debts").delete().eq("id", id); setDebts((prev) => prev.filter((d) => d.id !== id)); }
  async function registerDebtPayment() {
    const debt = debts.find((d) => String(d.id) === String(debtPayForm.debtId));
    if (!debt || !debtPayForm.amount) return;
    setSaving(true);
    const amount = Math.min(Number(debtPayForm.amount), debt.balance);
    const newBalance = Math.max(0, debt.balance - amount);
    const newPaid = (debt.totalPaid || 0) + amount;
    await supabase.from("debts").update({ current_balance: newBalance, total_paid: newPaid }).eq("id", debt.id);
    const { data: dp } = await supabase.from("debt_payments").insert([{ debt_id: debt.id, payment_date: debtPayForm.date, amount_ars: amount, person: debtPayForm.person, payment_method: debtPayForm.paymentMethod, notes: debtPayForm.notes || null }]).select().single();
    const { data: mov } = await supabase.from("movements").insert([{ movement_date: debtPayForm.date, person: debtPayForm.person, type: "Egreso", category: "Deuda", description: `Pago deuda - ${debt.name}`, original_currency: "ARS", original_amount: amount, fx_rate: 1, amount_ars: amount, amount_usd: amount / (blueRate || 1), payment_method: debtPayForm.paymentMethod, linked_debt_id: debt.id }]).select().single();
    setDebts((prev) => prev.map((d) => d.id === debt.id ? { ...d, balance: newBalance, totalPaid: newPaid } : d));
    if (dp) setDebtPayments((prev) => [{ id: dp.id, debtId: dp.debt_id, date: dp.payment_date, amount: dp.amount_ars, person: dp.person, paymentMethod: dp.payment_method, notes: dp.notes }, ...prev]);
    if (mov) setMovements((prev) => [{ id: mov.id, date: mov.movement_date, person: mov.person, type: mov.type, category: mov.category, description: mov.description, originalAmount: mov.original_amount, currency: mov.original_currency, fxRate: mov.fx_rate, amountArs: mov.amount_ars, amountUsd: mov.amount_usd, paymentMethod: mov.payment_method, linkedDebtId: mov.linked_debt_id }, ...prev]);
    setDebtPayForm({ debtId: "", date: today(), amount: "", person: "Compartido", paymentMethod: "Banco", notes: "" });
    setSaving(false);
  }
  async function addBudget() {
    if (!budgetForm.month || !budgetForm.person || !budgetForm.type || !budgetForm.category || !budgetForm.planned) return;
    const { data } = await supabase.from("budgets").insert([{ budget_month: budgetForm.month, person: budgetForm.person, type: budgetForm.type, category: budgetForm.category, planned_amount_ars: Number(budgetForm.planned) }]).select().single();
    if (data) setBudgets((prev) => [{ id: data.id, month: data.budget_month, person: data.person, type: data.type, category: data.category, planned: data.planned_amount_ars }, ...prev]);
    setBudgetForm({ month: currentMonth(), person: globalPerson === "all" ? "Compartido" : globalPerson, type: "Egreso", category: (categoryMap["Egreso"] || [])[0] || "", planned: "" });
  }
  async function deleteBudget(id) { await supabase.from("budgets").delete().eq("id", id); setBudgets((prev) => prev.filter((b) => b.id !== id)); }
  async function saveBalance() {
    if (!balanceForm.month || balanceForm.opening === "") return;
    const existing = monthlyBalances.find((b) => b.balance_month === balanceForm.month);
    if (existing) {
      await supabase.from("monthly_balances").update({ opening_balance_ars: Number(balanceForm.opening), notes: balanceForm.notes }).eq("id", existing.id);
      setMonthlyBalances((prev) => prev.map((b) => b.balance_month === balanceForm.month ? { ...b, opening_balance_ars: Number(balanceForm.opening), notes: balanceForm.notes } : b));
    } else {
      const { data } = await supabase.from("monthly_balances").insert([{ balance_month: balanceForm.month, opening_balance_ars: Number(balanceForm.opening), notes: balanceForm.notes }]).select().single();
      if (data) setMonthlyBalances((prev) => [data, ...prev]);
    }
    setBalanceForm({ month: currentMonth(), opening: "", notes: "" });
  }

  async function addCategory() {
    const type = catalogForm.categoryType;
    const name = catalogForm.category.trim();
    if (!type || !name) return;
    if ((categoryMap[type] || []).includes(name)) return;
    const payload = { type, name, fv: catalogForm.categoryFv, active: true };
    const { data, error } = await supabase.from("categories").insert([payload]).select().single();
    if (error) { console.error(error); return; }
    const nextRows = [...categoryRows, { id: data.id, type: data.type, name: data.name, fv: data.fv || "V", active: data.active }];
    setCategoryRows(nextRows);
    setCategoryMap(buildCategoryMap(nextRows));
    setCategoryFVMap(buildCategoryFV(nextRows));
    setCatalogForm((prev) => ({ ...prev, category: "", categoryFv: "V" }));
  }
  async function toggleCategoryFV(row) {
    const next = row.fv === "F" ? "V" : "F";
    const { error } = await supabase.from("categories").update({ fv: next }).eq("id", row.id);
    if (error) return;
    const nextRows = categoryRows.map((r) => r.id === row.id ? { ...r, fv: next } : r);
    setCategoryRows(nextRows); setCategoryMap(buildCategoryMap(nextRows)); setCategoryFVMap(buildCategoryFV(nextRows));
  }
  async function removeCategory(row) {
    if (movements.some((m) => m.type === row.type && m.category === row.name)) return alert("No se puede eliminar una categoría ya usada.");
    const { error } = await supabase.from("categories").update({ active: false }).eq("id", row.id);
    if (error) return;
    const nextRows = categoryRows.filter((r) => r.id !== row.id);
    setCategoryRows(nextRows); setCategoryMap(buildCategoryMap(nextRows)); setCategoryFVMap(buildCategoryFV(nextRows));
  }

  async function addGoal() {
    if (!goalForm.name || !goalForm.target) return;
    const notes = serializeMeta({ kind: goalForm.kind, period: goalForm.period, linkedCategory: goalForm.linkedCategory || "" });
    const { data } = await supabase.from("goals").insert([{ name: goalForm.name, target_amount: Number(goalForm.target), current_amount: Number(goalForm.current || 0), notes }]).select().single();
    if (data) setGoals((prev) => [{ ...data, meta: safeParseMeta(data.notes) }, ...prev]);
    setGoalForm({ name: "", target: "", current: "", kind: "Ahorro", period: "Mensual", linkedCategory: "" });
  }
  async function deleteGoal(id) { await supabase.from("goals").delete().eq("id", id); setGoals((prev) => prev.filter((g) => g.id !== id)); }

  const summary = useMemo(() => {
    const income = scopedMovements.filter((m) => m.type === "Ingreso").reduce((a, b) => a + b.amountArs, 0);
    const expenses = scopedMovements.filter((m) => m.type === "Egreso").reduce((a, b) => a + b.amountArs, 0);
    const savings = scopedMovements.filter((m) => m.type === "Ahorro").reduce((a, b) => a + b.amountArs, 0);
    const investments = scopedMovements.filter((m) => m.type === "Inversión").reduce((a, b) => a + b.amountArs, 0);
    const totalDebt = scopedDebts.reduce((a, b) => a + b.balance, 0);
    return { income, expenses, savings, investments, totalDebt, net: income - expenses - savings - investments };
  }, [scopedMovements, scopedDebts]);

  const monthBalance = useMemo(() => {
    const rec = monthlyBalances.find((b) => b.balance_month === reportMonth);
    const opening = rec?.opening_balance_ars || 0;
    const monthMovs = scopedMovements.filter((m) => monthKey(m.date) === reportMonth);
    const inc = monthMovs.filter((m) => m.type === "Ingreso").reduce((a, b) => a + b.amountArs, 0);
    const exp = monthMovs.filter((m) => m.type === "Egreso").reduce((a, b) => a + b.amountArs, 0);
    const sav = monthMovs.filter((m) => m.type === "Ahorro").reduce((a, b) => a + b.amountArs, 0);
    const inv = monthMovs.filter((m) => m.type === "Inversión").reduce((a, b) => a + b.amountArs, 0);
    return { opening, inc, exp, sav, inv, closing: opening + inc - exp - sav - inv };
  }, [scopedMovements, monthlyBalances, reportMonth]);

  const monthlyKpis = useMemo(() => {
    const monthMovs = scopedMovements.filter((m) => monthKey(m.date) === reportMonth);
    const income = monthMovs.filter((m) => m.type === "Ingreso").reduce((a, b) => a + b.amountArs, 0);
    const egresos = monthMovs.filter((m) => m.type === "Egreso");
    const fixed = egresos.filter((m) => getFV(m.type, m.category) === "F").reduce((a, b) => a + b.amountArs, 0);
    const variable = egresos.filter((m) => getFV(m.type, m.category) !== "F").reduce((a, b) => a + b.amountArs, 0);
    const contributionMargin = income > 0 ? (income - variable) / income : 0;
    return {
      income, fixed, variable,
      fixedPct: income > 0 ? fixed / income : 0,
      variablePct: income > 0 ? variable / income : 0,
      breakEven: contributionMargin > 0 ? fixed / contributionMargin : 0,
      liquidity: fixed > 0 ? monthBalance.closing / fixed : 0,
      savingsPotential: income - fixed,
      operationalResult: income - fixed - variable,
      contributionMargin,
    };
  }, [scopedMovements, reportMonth, monthBalance.closing, categoryFVMap]);

  const annualByMonth = useMemo(() => {
    const bucket = {};
    scopedMovements.filter((m) => yearKey(m.date) === reportYear).forEach((m) => {
      const k = monthKey(m.date);
      if (!bucket[k]) bucket[k] = { month: k, income: 0, expenses: 0, fixed: 0, variable: 0, savings: 0, investments: 0 };
      const val = amountDisplay(m);
      if (m.type === "Ingreso") bucket[k].income += val;
      if (m.type === "Egreso") {
        bucket[k].expenses += val;
        if (getFV(m.type, m.category) === "F") bucket[k].fixed += val; else bucket[k].variable += val;
      }
      if (m.type === "Ahorro") bucket[k].savings += val;
      if (m.type === "Inversión") bucket[k].investments += val;
    });
    return Object.values(bucket).sort((a, b) => a.month.localeCompare(b.month));
  }, [scopedMovements, reportYear, displayCurrency, categoryFVMap]);

  const monthlyByCategory = useMemo(() => {
    const bucket = {};
    scopedMovements.filter((m) => m.type === "Egreso" && monthKey(m.date) === reportMonth).forEach((m) => { bucket[m.category] = (bucket[m.category] || 0) + amountDisplay(m); });
    return Object.entries(bucket).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
  }, [scopedMovements, reportMonth, displayCurrency]);

  const monthlyByPerson = useMemo(() => {
    const bucket = {};
    movements.filter((m) => m.type === "Egreso" && monthKey(m.date) === reportMonth).forEach((m) => { bucket[m.person] = (bucket[m.person] || 0) + amountDisplay(m); });
    return Object.entries(bucket).map(([person, total]) => ({ person, total })).sort((a, b) => b.total - a.total);
  }, [movements, reportMonth, displayCurrency]);

  const monthlyFixedVariable = useMemo(() => {
    const fixed = scopedMovements.filter((m) => m.type === "Egreso" && monthKey(m.date) === reportMonth && getFV(m.type, m.category) === "F").reduce((a, b) => a + amountDisplay(b), 0);
    const variable = scopedMovements.filter((m) => m.type === "Egreso" && monthKey(m.date) === reportMonth && getFV(m.type, m.category) !== "F").reduce((a, b) => a + amountDisplay(b), 0);
    return [{ name: "Fijos", total: fixed }, { name: "Variables", total: variable }];
  }, [scopedMovements, reportMonth, displayCurrency, categoryFVMap]);

  const budgetComparison = useMemo(() => scopedBudgets.filter((b) => b.month === reportMonth).map((b) => {
    const actual = scopedMovements.filter((m) => monthKey(m.date) === b.month && m.person === b.person && m.type === b.type && m.category === b.category).reduce((a, c) => a + c.amountArs, 0);
    const execution = b.planned > 0 ? (actual / b.planned) * 100 : 0;
    const isEgreso = b.type === "Egreso";
    const status = isEgreso ? (execution > 100 ? "over" : execution >= 85 ? "warn" : "ok") : (execution >= 100 ? "good" : execution >= 85 ? "warn" : "ok");
    return { ...b, actual, difference: b.planned - actual, execution, status };
  }), [scopedBudgets, scopedMovements, reportMonth]);

  const filteredMovements = useMemo(() => movements.filter((m) => {
    if (filters.person !== "all" && m.person !== filters.person) return false;
    if (filters.type !== "all" && m.type !== filters.type) return false;
    if (filters.category !== "all" && m.category !== filters.category) return false;
    if (filters.currency !== "all" && m.currency !== filters.currency) return false;
    if (filters.month && monthKey(m.date) !== filters.month) return false;
    if (filters.fv !== "all") {
      if (m.type !== "Egreso") return false;
      if (getFV(m.type, m.category) !== filters.fv) return false;
    }
    return true;
  }), [movements, filters, categoryFVMap]);

  const goalsForBudget = useMemo(() => goals.map((g) => {
    const meta = g.meta || safeParseMeta(g.notes);
    let autoCurrent = Number(g.current_amount || 0);
    if (meta.linkedCategory) {
      const sourceType = meta.kind === "Inversión" ? "Inversión" : "Ahorro";
      autoCurrent = scopedMovements.filter((m) => m.type === sourceType && m.category === meta.linkedCategory && (meta.period === "Anual" ? yearKey(m.date) === reportYear : monthKey(m.date) === reportMonth)).reduce((a, b) => a + b.amountArs, 0);
    }
    return { ...g, meta, autoCurrent };
  }), [goals, scopedMovements, reportMonth, reportYear]);

  function exportCSV() {
    const headers = ["Fecha","Persona","Tipo","Categoría","F/V","Descripción","Moneda","Importe original","TC","Importe ARS","Importe USD","Medio de pago"];
    const rows = filteredMovements.map((m) => [m.date, m.person, m.type, m.category, m.type === "Egreso" ? getFV(m.type, m.category) : "", m.description || "", m.currency, m.originalAmount, m.fxRate, Number(m.amountArs || 0).toFixed(2), Number(m.amountUsd || 0).toFixed(2), m.paymentMethod]);
    const csv = [headers, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `movimientos_${filters.month || "todos"}.csv`; a.click();
  }

  const selectedDebtForMov = debts.find((d) => String(d.id) === String(movForm.linkedDebtId));
  const selectedDebtForPay = debts.find((d) => String(d.id) === String(debtPayForm.debtId));
  const personLabel = globalPerson === "all" ? "Todas las personas" : globalPerson;

  if (loading) return <div className="loading-screen"><Spinner /><p>Cargando datos…</p></div>;

  return (
    <div className="app-shell">
      <div className="app-container">
        <div className="header">
          <div>
            <h1 className="app-title">💰 Finanzas Familiares</h1>
            <p className="app-subtitle">Gastos, presupuesto, deudas y metas · Guardado en la nube</p>
          </div>
          <div className="header-controls" style={{ gap: 12, flexWrap: "wrap" }}>
            <Select value={globalPerson} onChange={setGlobalPerson} className="w-auto">
              <option value="all">Todas las personas</option>
              {people.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
            <Select value={displayCurrency} onChange={setDisplayCurrency} className="w-auto">
              <option value="ARS">Ver en ARS</option>
              <option value="USD">Ver en USD</option>
            </Select>
          </div>
        </div>

        <div className="tabs-scroll"><div className="tabs-list">{TABS.map((t) => <button key={t.id} onClick={() => setTab(t.id)} className={`tab-btn${tab === t.id ? " active" : ""}`}>{t.label}</button>)}</div></div>

        {tab === "cargar" && <div className="tab-content"><Card><CardHead title="Carga rápida" icon="📥" />
          <div className="form-grid">
            <Field label="Fecha"><Input type="date" value={movForm.date} onChange={(e) => setMovForm({ ...movForm, date: e.target.value })} /></Field>
            <Field label="Persona"><Select value={movForm.person} onChange={(v) => setMovForm({ ...movForm, person: v })}>{people.map((p) => <option key={p} value={p}>{p}</option>)}</Select></Field>
            <Field label="Tipo"><Select value={movForm.type} onChange={(v) => setMovForm({ ...movForm, type: v, category: "", linkedDebtId: "" })}><option value="">Seleccionar…</option>{types.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
            <Field label="Categoría"><Select value={movForm.category} onChange={(v) => setMovForm({ ...movForm, category: v, linkedDebtId: v !== "Deuda" ? "" : movForm.linkedDebtId })} disabled={!movForm.type}><option value="">Seleccionar…</option>{(categoryMap[movForm.type] || []).map((c) => <option key={c} value={c}>{c}{movForm.type === "Egreso" ? ` · ${getFV("Egreso", c)}` : ""}</option>)}</Select></Field>
            {movForm.type === "Egreso" && movForm.category === "Deuda" && <Field label="Deuda"><Select value={movForm.linkedDebtId} onChange={(v) => setMovForm({ ...movForm, linkedDebtId: v, originalAmount: debts.find((d) => String(d.id) === String(v))?.installment || "" })}><option value="">Elegir deuda…</option>{debts.map((d) => <option key={d.id} value={String(d.id)}>{d.name} ({money(d.balance)} pendiente)</option>)}</Select></Field>}
            <Field label="Moneda"><Select value={movForm.currency} onChange={(v) => setMovForm({ ...movForm, currency: v })}><option value="ARS">Pesos (ARS)</option><option value="USD">Dólar blue (USD)</option></Select></Field>
            <Field label={`Importe${movForm.currency === "USD" ? " (USD)" : " (ARS)"}`}><Input type="number" value={movForm.originalAmount} onChange={(e) => setMovForm({ ...movForm, originalAmount: e.target.value })} placeholder="0" /></Field>
            <Field label="Medio de pago"><Select value={movForm.paymentMethod} onChange={(v) => setMovForm({ ...movForm, paymentMethod: v })}>{paymentMethods.map((m) => <option key={m} value={m}>{m}</option>)}</Select></Field>
            <Field label="Descripción"><Input value={movForm.description} onChange={(e) => setMovForm({ ...movForm, description: e.target.value })} placeholder="Detalle opcional" /></Field>
          </div>
          {movForm.type === "Egreso" && movForm.category && <InfoBox color="green">Clasificación automática: <strong>{getFV("Egreso", movForm.category)}</strong></InfoBox>}
          {selectedDebtForMov && movForm.category === "Deuda" && <InfoBox color="blue">Cuota sugerida: <strong>{money(selectedDebtForMov.installment)}</strong> · Saldo pendiente: <strong>{money(selectedDebtForMov.balance)}</strong></InfoBox>}
          <div style={{ marginTop: 16 }}><Btn onClick={addMovement} disabled={saving || !movForm.type || !movForm.category || !movForm.originalAmount}>{saving ? "Guardando…" : "＋ Agregar movimiento"}</Btn></div>
        </Card></div>}

        {tab === "dashboard" && <div className="tab-content">
          <Card>
            <CardHead title="Vista general" icon="📌" />
            <div className="muted small">Persona: {personLabel} · Mes: {reportMonth}</div>
          </Card>
          <div className="stats-grid kpi-compact">
            {[
              { label: "Ingresos", icon: "💵", value: monthlyKpis.income, color: "green", raw: false },
              { label: "Fijos", icon: "🏠", value: monthlyKpis.fixed, color: "red", raw: false },
              { label: "Variables", icon: "🛒", value: monthlyKpis.variable, color: "amber", raw: false },
              { label: "Liquidez", icon: "💧", value: monthlyKpis.liquidity, color: monthlyKpis.liquidity >= 1 ? "green" : "red", raw: true },
              { label: "P. equilibrio", icon: "🎯", value: monthlyKpis.breakEven, color: "purple", raw: false },
              { label: "Resultado", icon: "⚖️", value: monthlyKpis.operationalResult, color: monthlyKpis.operationalResult >= 0 ? "green" : "red", raw: false },
            ].map((k) => <div key={k.label} className={`stat-card stat-${k.color}`}><div className="stat-topline"><span className="stat-icon">{k.icon}</span><span className="stat-label-inline">{k.label}</span></div><div className="stat-value">{k.raw ? `${Number(k.value || 0).toFixed(2)}x` : fmtDisplay(displayCurrency === "USD" ? k.value / (blueRate || 1) : k.value)}</div></div>)}
          </div>
          <div className="two-col">
            <Card><CardHead title={`Saldo del mes · ${reportMonth}`} icon="📅" /><div className="balance-grid">
              <div className="balance-row"><span>Saldo inicial</span><strong>{fmtDisplay(displayCurrency === "USD" ? monthBalance.opening / (blueRate || 1) : monthBalance.opening)}</strong></div>
              <div className="balance-row green"><span>＋ Ingresos</span><strong>{fmtDisplay(displayCurrency === "USD" ? monthBalance.inc / (blueRate || 1) : monthBalance.inc)}</strong></div>
              <div className="balance-row red"><span>− Gastos</span><strong>{fmtDisplay(displayCurrency === "USD" ? monthBalance.exp / (blueRate || 1) : monthBalance.exp)}</strong></div>
              <div className="balance-row amber"><span>− Ahorro</span><strong>{fmtDisplay(displayCurrency === "USD" ? monthBalance.sav / (blueRate || 1) : monthBalance.sav)}</strong></div>
              <div className="balance-row purple"><span>− Inversión</span><strong>{fmtDisplay(displayCurrency === "USD" ? monthBalance.inv / (blueRate || 1) : monthBalance.inv)}</strong></div>
              <div className="balance-row total"><span>= Saldo final</span><strong>{fmtDisplay(displayCurrency === "USD" ? monthBalance.closing / (blueRate || 1) : monthBalance.closing)}</strong></div>
            </div></Card>
            <Card><CardHead title="KPIs derivados" icon="🧮" /><div className="balance-grid">
              <div className="balance-row"><span>% fijos / ingresos</span><strong>{(monthlyKpis.fixedPct * 100).toFixed(1)}%</strong></div>
              <div className="balance-row"><span>% variables / ingresos</span><strong>{(monthlyKpis.variablePct * 100).toFixed(1)}%</strong></div>
              <div className="balance-row"><span>Margen contribución</span><strong>{(monthlyKpis.contributionMargin * 100).toFixed(1)}%</strong></div>
              <div className="balance-row"><span>Ahorro potencial</span><strong>{fmtDisplay(displayCurrency === "USD" ? monthlyKpis.savingsPotential / (blueRate || 1) : monthlyKpis.savingsPotential)}</strong></div>
              <div className="balance-row total"><span>Deuda total</span><strong>{fmtDisplay(displayCurrency === "USD" ? summary.totalDebt / (blueRate || 1) : summary.totalDebt)}</strong></div>
            </div></Card>
          </div>
        </div>}

        {tab === "datos" && <div className="tab-content">
          <Card><CardHead title="Filtros" icon="🔍" />
            <div className="filter-grid six-col">
              <Field label="Mes"><Input type="month" value={filters.month} onChange={(e) => setFilters({ ...filters, month: e.target.value })} /></Field>
              <Field label="Persona"><Select value={filters.person} onChange={(v) => setFilters({ ...filters, person: v })}><option value="all">Todas</option>{people.map((p) => <option key={p} value={p}>{p}</option>)}</Select></Field>
              <Field label="Tipo"><Select value={filters.type} onChange={(v) => setFilters({ ...filters, type: v })}><option value="all">Todos</option>{types.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
              <Field label="Categoría"><Select value={filters.category} onChange={(v) => setFilters({ ...filters, category: v })}><option value="all">Todas</option>{Object.values(categoryMap).flat().map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field>
              <Field label="Moneda"><Select value={filters.currency} onChange={(v) => setFilters({ ...filters, currency: v })}><option value="all">Todas</option><option value="ARS">ARS</option><option value="USD">USD</option></Select></Field>
              <Field label="F/V"><Select value={filters.fv} onChange={(v) => setFilters({ ...filters, fv: v })}><option value="all">Todos</option><option value="F">Fijos</option><option value="V">Variables</option></Select></Field>
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}><Btn onClick={exportCSV} variant="outline">⬇ Exportar CSV</Btn><span className="muted small" style={{ alignSelf: "center" }}>{filteredMovements.length} registros</span></div>
          </Card>
          <Card><div className="table-wrap"><table className="data-table"><thead><tr><th>Fecha</th><th>Persona</th><th>Tipo</th><th>Categoría</th><th>F/V</th><th>Descripción</th><th>Original</th><th>ARS</th><th>USD</th><th>Medio</th><th></th></tr></thead><tbody>
            {filteredMovements.map((m) => <tr key={m.id}><td>{m.date}</td><td>{m.person}</td><td><Badge color={m.type === "Ingreso" ? "green" : m.type === "Egreso" ? "red" : m.type === "Ahorro" ? "blue" : "purple"}>{m.type}</Badge></td><td>{m.category}</td><td>{m.type === "Egreso" ? <Badge color={getFV(m.type, m.category) === "F" ? "red" : "amber"}>{getFV(m.type, m.category)}</Badge> : "—"}</td><td className="muted">{m.description || "—"}</td><td className="number">{money(m.originalAmount, m.currency)}</td><td className="number fw">{money(m.amountArs)}</td><td className="number">{money(m.amountUsd || 0, "USD")}</td><td>{m.paymentMethod}</td><td><button className="del-btn" onClick={() => deleteMovement(m.id)}>🗑</button></td></tr>)}
          </tbody></table>{filteredMovements.length === 0 && <EmptyState msg="No hay movimientos con esos filtros." />}</div></Card>
        </div>}

        {tab === "presupuesto" && <div className="tab-content">
          <Card><CardHead title="Saldo inicial del mes" icon="🏦" /><div className="form-grid three-col"><Field label="Mes"><Input type="month" value={balanceForm.month} onChange={(e) => setBalanceForm({ ...balanceForm, month: e.target.value })} /></Field><Field label="Saldo inicial (ARS)"><Input type="number" value={balanceForm.opening} onChange={(e) => setBalanceForm({ ...balanceForm, opening: e.target.value })} placeholder="0" /></Field><Field label="Notas"><Input value={balanceForm.notes} onChange={(e) => setBalanceForm({ ...balanceForm, notes: e.target.value })} placeholder="Opcional" /></Field></div><div style={{ marginTop: 12 }}><Btn onClick={saveBalance}>Guardar saldo inicial</Btn></div></Card>
          <Card><CardHead title="Agregar presupuesto" icon="🎯" /><div className="form-grid"><Field label="Mes"><Input type="month" value={budgetForm.month} onChange={(e) => setBudgetForm({ ...budgetForm, month: e.target.value })} /></Field><Field label="Persona"><Select value={budgetForm.person} onChange={(v) => setBudgetForm({ ...budgetForm, person: v })}>{people.map((p) => <option key={p} value={p}>{p}</option>)}</Select></Field><Field label="Tipo"><Select value={budgetForm.type} onChange={(v) => setBudgetForm({ ...budgetForm, type: v, category: (categoryMap[v] || [])[0] || "" })}>{types.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field><Field label="Categoría"><Select value={budgetForm.category} onChange={(v) => setBudgetForm({ ...budgetForm, category: v })}>{(categoryMap[budgetForm.type] || []).map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field><Field label="Importe presupuestado"><Input type="number" value={budgetForm.planned} onChange={(e) => setBudgetForm({ ...budgetForm, planned: e.target.value })} placeholder="0" /></Field></div><div style={{ marginTop: 12 }}><Btn onClick={addBudget}>＋ Agregar presupuesto</Btn></div></Card>
          <Card><CardHead title="Presupuesto vs Real" icon="📊" />{budgetComparison.length === 0 && <EmptyState msg="No hay presupuestos para este mes." />}{budgetComparison.map((b) => {
            const colorClass = b.status === "over" ? "budget-over" : b.status === "warn" ? "budget-warn" : "budget-ok";
            const badgeColor = b.status === "over" ? (b.type === "Egreso" ? "red" : "green") : b.status === "warn" ? "amber" : "green";
            const statusLabel = b.type === "Egreso" ? (b.status === "over" ? "Excedido" : b.status === "warn" ? "Al límite" : "Dentro") : (b.execution >= 100 ? "Cumplido" : b.status === "warn" ? "Cerca" : "En curso");
            return <div key={b.id} className={`budget-row ${colorClass}`}><div className="budget-row-head"><div><div className="fw">{b.category}</div><div className="muted small">{b.month} · {b.person} · {b.type}{b.type === "Egreso" ? ` · ${getFV(b.type, b.category)}` : ""}</div></div><div style={{ display: "flex", gap: 8, alignItems: "center" }}><Badge color={badgeColor}>{b.execution.toFixed(1)}%</Badge><button className="del-btn" onClick={() => deleteBudget(b.id)}>🗑</button></div></div><div className="budget-amounts"><div><span className="muted small">Presupuesto</span><div>{money(b.planned)}</div></div><div><span className="muted small">Real</span><div className={b.type === "Egreso" && b.actual > b.planned ? "red" : "green"}>{money(b.actual)}</div></div><div><span className="muted small">Diferencia</span><div className={b.type === "Egreso" && b.difference < 0 ? "red" : "green"}>{money(b.difference)}</div></div><div><span className="muted small">Estado</span><div>{statusLabel}</div></div></div><Progress value={b.execution} /></div>;
          })}</Card>
          <div className="two-col">
            <Card><CardHead title="Meta de ahorro / inversión" icon="⭐" /><div className="form-grid"><Field label="Nombre"><Input value={goalForm.name} onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })} /></Field><Field label="Tipo"><Select value={goalForm.kind} onChange={(v) => setGoalForm({ ...goalForm, kind: v, linkedCategory: "" })}><option value="Ahorro">Ahorro</option><option value="Inversión">Inversión</option></Select></Field><Field label="Periodo"><Select value={goalForm.period} onChange={(v) => setGoalForm({ ...goalForm, period: v })}><option value="Mensual">Mensual</option><option value="Anual">Anual</option></Select></Field><Field label="Categoría vinculada"><Select value={goalForm.linkedCategory} onChange={(v) => setGoalForm({ ...goalForm, linkedCategory: v })}><option value="">Sin vínculo</option>{(categoryMap[goalForm.kind] || []).map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field><Field label="Objetivo (ARS)"><Input type="number" value={goalForm.target} onChange={(e) => setGoalForm({ ...goalForm, target: e.target.value })} /></Field><Field label="Actual manual (ARS)"><Input type="number" value={goalForm.current} onChange={(e) => setGoalForm({ ...goalForm, current: e.target.value })} /></Field></div><div style={{ marginTop: 12 }}><Btn onClick={addGoal}>＋ Agregar meta</Btn></div></Card>
            <Card><CardHead title="Evolución de metas" icon="📈" />{goalsForBudget.length === 0 && <EmptyState msg="No hay metas cargadas." />}{goalsForBudget.map((g) => { const current = g.autoCurrent || Number(g.current_amount || 0); const target = Number(g.target_amount || 1); const pct = Math.min(100, target > 0 ? (current / target) * 100 : 0); return <div key={g.id} className="budget-row budget-ok"><div className="budget-row-head"><div><div className="fw">{g.name}</div><div className="muted small">{g.meta?.kind || "Ahorro"} · {g.meta?.period || "Mensual"}{g.meta?.linkedCategory ? ` · ${g.meta.linkedCategory}` : ""}</div></div><button className="del-btn" onClick={() => deleteGoal(g.id)}>🗑</button></div><div className="budget-amounts"><div><span className="muted small">Objetivo</span><div>{money(target)}</div></div><div><span className="muted small">Actual</span><div>{money(current)}</div></div><div><span className="muted small">Avance</span><div>{pct.toFixed(1)}%</div></div><div><span className="muted small">Periodo</span><div>{g.meta?.period || "Mensual"}</div></div></div><Progress value={pct} /></div>; })}</Card>
          </div>
        </div>}

        {tab === "reportes" && <div className="tab-content">
          <Card><CardHead title="Parámetros" icon="⚙️" /><div className="form-grid three-col"><Field label="Mes"><Input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} /></Field><Field label="Año"><Input value={reportYear} onChange={(e) => setReportYear(e.target.value)} /></Field><Field label="Persona"><Select value={globalPerson} onChange={setGlobalPerson}><option value="all">Todas</option>{people.map((p) => <option key={p} value={p}>{p}</option>)}</Select></Field></div></Card>
          <div className="two-col">
            <Card><CardHead title="Gastos por categoría" icon="🍩" /><PieChart data={monthlyByCategory} nameKey="category" valueKey="total" formatter={fmtTick} /></Card>
            <Card><CardHead title="Gastos por persona" icon="👤" />{monthlyByPerson.length === 0 ? <EmptyState msg="Sin datos para este mes." /> : monthlyByPerson.map((r, i) => { const total = monthlyByPerson.reduce((a, b) => a + b.total, 0); const pct = total > 0 ? (r.total / total) * 100 : 0; return <div key={r.person} className="report-row"><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 12, height: 12, borderRadius: 3, background: PALETTE[i % PALETTE.length] }} />{r.person}</div><strong>{fmtDisplay(r.total)} · {pct.toFixed(1)}%</strong></div>; })}</Card>
          </div>
          <Card><CardHead title="Comparativa anual por mes" icon="📅" /><BarChart data={annualByMonth} xKey="month" bars={[{ key: "income", label: "Ingresos", color: "#16a34a" }, { key: "fixed", label: "Fijos", color: "#dc2626" }, { key: "variable", label: "Variables", color: "#f59e0b" }, { key: "investments", label: "Inversión", color: "#7c3aed" }]} formatter={fmtTick} /></Card>
        </div>}

        {tab === "deudas" && <div className="tab-content"><div className="two-col"><Card><CardHead title="Agregar deuda" icon="💳" /><div className="form-grid two-col-form"><Field label="Nombre"><Input value={debtForm.name} onChange={(e) => setDebtForm({ ...debtForm, name: e.target.value })} /></Field><Field label="Responsable"><Select value={debtForm.owner} onChange={(v) => setDebtForm({ ...debtForm, owner: v })}>{people.map((p) => <option key={p} value={p}>{p}</option>)}</Select></Field><Field label="Saldo actual"><Input type="number" value={debtForm.balance} onChange={(e) => setDebtForm({ ...debtForm, balance: e.target.value })} /></Field><Field label="Cuota estimada"><Input type="number" value={debtForm.installment} onChange={(e) => setDebtForm({ ...debtForm, installment: e.target.value })} /></Field><Field label="Día de vencimiento"><Input type="number" value={debtForm.dueDay} onChange={(e) => setDebtForm({ ...debtForm, dueDay: e.target.value })} /></Field><Field label="Prioridad"><Select value={debtForm.priority} onChange={(v) => setDebtForm({ ...debtForm, priority: v })}><option value="Alta">Alta</option><option value="Media">Media</option><option value="Baja">Baja</option></Select></Field><Field label="Tasa"><Input type="number" value={debtForm.rate} onChange={(e) => setDebtForm({ ...debtForm, rate: e.target.value })} /></Field><Field label="Notas"><Input value={debtForm.notes} onChange={(e) => setDebtForm({ ...debtForm, notes: e.target.value })} /></Field></div><div style={{ marginTop: 12 }}><Btn onClick={addDebt}>＋ Agregar deuda</Btn></div></Card>
        <Card><CardHead title="Registrar pago de deuda" icon="💸" /><div className="form-grid two-col-form"><Field label="Deuda"><Select value={debtPayForm.debtId} onChange={(v) => setDebtPayForm({ ...debtPayForm, debtId: v })}><option value="">Elegir deuda…</option>{debts.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}</Select></Field><Field label="Fecha"><Input type="date" value={debtPayForm.date} onChange={(e) => setDebtPayForm({ ...debtPayForm, date: e.target.value })} /></Field><Field label="Importe"><Input type="number" value={debtPayForm.amount} onChange={(e) => setDebtPayForm({ ...debtPayForm, amount: e.target.value })} /></Field><Field label="Persona"><Select value={debtPayForm.person} onChange={(v) => setDebtPayForm({ ...debtPayForm, person: v })}>{people.map((p) => <option key={p} value={p}>{p}</option>)}</Select></Field><Field label="Medio de pago"><Select value={debtPayForm.paymentMethod} onChange={(v) => setDebtPayForm({ ...debtPayForm, paymentMethod: v })}>{paymentMethods.map((m) => <option key={m} value={m}>{m}</option>)}</Select></Field><Field label="Notas"><Input value={debtPayForm.notes} onChange={(e) => setDebtPayForm({ ...debtPayForm, notes: e.target.value })} /></Field></div>{selectedDebtForPay && <InfoBox color="blue">Saldo actual: <strong>{money(selectedDebtForPay.balance)}</strong> · Cuota estimada: <strong>{money(selectedDebtForPay.installment)}</strong></InfoBox>}<div style={{ marginTop: 12 }}><Btn onClick={registerDebtPayment}>Registrar pago</Btn></div></Card></div>
        <div className="debt-cards">{scopedDebts.length === 0 && <EmptyState msg="No hay deudas cargadas." />}{scopedDebts.map((d) => { const pct = d.initialBalance > 0 ? ((d.totalPaid || 0) / d.initialBalance) * 100 : 0; return <Card key={d.id}><div className="debt-card-head"><div><div className="fw">{d.name}</div><div className="muted small">{d.owner} · Día {d.dueDay} · Prioridad {d.priority}</div></div><button className="del-btn" onClick={() => deleteDebt(d.id)}>🗑</button></div><div className="debt-amounts"><div><span className="muted small">Saldo</span><div className="fw red">{money(d.balance)}</div></div><div><span className="muted small">Cuota</span><div>{money(d.installment)}</div></div><div><span className="muted small">Total pagado</span><div className="green">{money(d.totalPaid || 0)}</div></div><div><span className="muted small">Vence día</span><div>{d.dueDay || "—"}</div></div></div><Progress value={pct} /><div className="muted small" style={{ marginTop: 4 }}>Cancelado: {pct.toFixed(1)}%</div>{d.notes && <div className="muted small">Notas: {d.notes}</div>}</Card>; })}</div>
        {debtPayments.length > 0 && <Card><CardHead title="Historial de pagos" icon="📋" /><div className="table-wrap"><table className="data-table"><thead><tr><th>Fecha</th><th>Deuda</th><th>Persona</th><th>Medio</th><th>Importe</th><th>Notas</th></tr></thead><tbody>{debtPayments.map((p) => <tr key={p.id}><td>{p.date}</td><td>{debts.find((d) => d.id === p.debtId)?.name || "—"}</td><td>{p.person}</td><td>{p.paymentMethod}</td><td className="number fw">{money(p.amount)}</td><td className="muted">{p.notes || "—"}</td></tr>)}</tbody></table></div></Card>}
        </div>}

        {tab === "config" && <div className="tab-content"><div className="two-col"><Card><CardHead title="Catálogos" icon="⚙️" />
          <div className="catalog-section"><label className="field-label">Personas</label><div className="catalog-add"><Input value={catalogForm.person} onChange={(e) => setCatalogForm({ ...catalogForm, person: e.target.value })} placeholder="Nueva persona" /><Btn small onClick={() => { const v = catalogForm.person.trim(); if (v && !people.includes(v)) setPeople([...people, v]); setCatalogForm({ ...catalogForm, person: "" }); }}>+ Agregar</Btn></div><div className="tag-list">{people.map((p) => <span key={p} className="tag">{p}<button onClick={() => setPeople(people.filter((x) => x !== p))}>×</button></span>)}</div></div>
          <div className="catalog-section"><label className="field-label">Medios de pago</label><div className="catalog-add"><Input value={catalogForm.paymentMethod} onChange={(e) => setCatalogForm({ ...catalogForm, paymentMethod: e.target.value })} placeholder="Nuevo medio" /><Btn small onClick={() => { const v = catalogForm.paymentMethod.trim(); if (v && !paymentMethods.includes(v)) setPaymentMethods([...paymentMethods, v]); setCatalogForm({ ...catalogForm, paymentMethod: "" }); }}>+ Agregar</Btn></div><div className="tag-list">{paymentMethods.map((m) => <span key={m} className="tag">{m}<button onClick={() => setPaymentMethods(paymentMethods.filter((x) => x !== m))}>×</button></span>)}</div></div>
          <div className="catalog-section"><label className="field-label">Tipos</label><div className="catalog-add"><Input value={catalogForm.type} onChange={(e) => setCatalogForm({ ...catalogForm, type: e.target.value })} placeholder="Nuevo tipo" /><Btn small onClick={() => { const v = catalogForm.type.trim(); if (v && !types.includes(v)) setTypes([...types, v]); setCatalogForm({ ...catalogForm, type: "" }); }}>+ Agregar</Btn></div><div className="tag-list">{types.map((t) => <span key={t} className="tag">{t}<button onClick={() => setTypes(types.filter((x) => x !== t))}>×</button></span>)}</div></div>
        </Card>
        <Card><CardHead title="Categorías con F / V" icon="🧩" /><div className="form-grid three-col"><Field label="Tipo"><Select value={catalogForm.categoryType} onChange={(v) => setCatalogForm({ ...catalogForm, categoryType: v })}>{types.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field><Field label="Categoría"><Input value={catalogForm.category} onChange={(e) => setCatalogForm({ ...catalogForm, category: e.target.value })} placeholder="Nueva categoría" /></Field><Field label="F / V"><Select value={catalogForm.categoryFv} onChange={(v) => setCatalogForm({ ...catalogForm, categoryFv: v })}><option value="F">Fijo</option><option value="V">Variable</option></Select></Field></div><div style={{ marginTop: 12 }}><Btn onClick={addCategory}>＋ Agregar categoría</Btn></div><div style={{ marginTop: 16 }}>{types.map((type) => { const rows = categoryRows.filter((r) => r.type === type && r.active !== false); if (!rows.length) return null; return <div key={type} className="catalog-section"><label className="field-label">{type}</label><div className="tag-list">{rows.map((row) => <span key={row.id} className="tag">{row.name}{type === "Egreso" && <button onClick={() => toggleCategoryFV(row)}>{row.fv}</button>}<button onClick={() => removeCategory(row)}>×</button></span>)}</div></div>; })}</div></Card></div>
          <Card><CardHead title="Cotización manual" icon="💱" /><div className="form-grid three-col"><Field label="USD blue (ARS por dólar)"><Input type="number" value={blueRate} onChange={(e) => setBlueRate(Number(e.target.value))} /></Field></div><div className="muted small" style={{ marginTop: 8 }}>Solo se usa para nuevas cargas en USD. Los reportes en USD usan la columna histórica ya guardada por movimiento.</div></Card>
        </div>}
      </div>
    </div>
  );
}
