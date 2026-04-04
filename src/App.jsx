import React, { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── Supabase ────────────────────────────────────────────────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ─── Catálogos por defecto ────────────────────────────────────────────────────
const DEFAULT_PEOPLE = ["Federico", "Mica", "Santy", "Compartido"];
const DEFAULT_PAYMENT_METHODS = ["Banco", "Tarjeta", "Efectivo", "Mercado Pago", "Transferencia"];
const DEFAULT_TYPES = ["Ingreso", "Egreso", "Ahorro", "Inversión"];
const DEFAULT_CATEGORY_MAP = {
  Ingreso: ["Sueldo", "Freelance", "Venta", "Otros ingresos"],
  Egreso: ["Supermercado", "Salud", "Salud mental", "Educación", "Transporte", "Servicios", "Alquiler", "Salidas", "Deuda"],
  Ahorro: ["Fondo de emergencia", "Ahorro USD", "Caja ahorro"],
  Inversión: ["FCI", "Acciones", "Cedears", "Cripto"],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const money = (n, cur = "ARS") =>
  new Intl.NumberFormat("es-AR", {
    style: "currency", currency: cur,
    maximumFractionDigits: cur === "USD" ? 2 : 0,
  }).format(Number(n || 0));

const monthKey = (d) => {
  const dt = new Date(d + "T00:00:00");
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
};

const toArs = (amount, currency, rate) =>
  currency === "USD" ? Number(amount || 0) * Number(rate || 1) : Number(amount || 0);

const fromArs = (amountArs, currency, rate) =>
  currency === "USD" ? (rate > 0 ? amountArs / rate : 0) : amountArs;

const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);

const PALETTE = ["#2563eb","#16a34a","#f59e0b","#dc2626","#7c3aed","#0891b2","#ea580c","#be185d"];

// ─── Tiny components ──────────────────────────────────────────────────────────
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
function Btn({ children, onClick, variant = "primary", disabled = false, small = false, className = "" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn btn-${variant}${small ? " btn-sm" : ""} ${className}`}
    >{children}</button>
  );
}
function Field({ label, children }) {
  return <div className="field"><label className="field-label">{label}</label>{children}</div>;
}
function Input({ type = "text", value, onChange, placeholder, min, max, step, className = "" }) {
  return (
    <input
      type={type} value={value} onChange={onChange}
      placeholder={placeholder} min={min} max={max} step={step}
      className={`control ${className}`}
    />
  );
}
function Select({ value, onChange, children, disabled = false, className = "" }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={`control ${className}`}>
      {children}
    </select>
  );
}
function Badge({ children, color = "blue" }) {
  return <span className={`badge badge-${color}`}>{children}</span>;
}
function Progress({ value }) {
  const pct = Math.min(100, Math.max(0, value));
  const color = pct > 100 ? "#dc2626" : pct >= 85 ? "#f59e0b" : "#16a34a";
  return (
    <div className="progress-track">
      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
function Spinner() {
  return <div className="spinner" />;
}
function EmptyState({ msg }) {
  return <div className="empty-state">{msg}</div>;
}
function InfoBox({ children, color = "blue" }) {
  return <div className={`info-box info-${color}`}>{children}</div>;
}

// ─── Simple bar chart (pure SVG) ─────────────────────────────────────────────
function BarChart({ data, xKey, bars, currency = "ARS" }) {
  const W = 600, H = 280, PL = 70, PR = 20, PT = 20, PB = 60;
  const iW = W - PL - PR, iH = H - PT - PB;
  const allVals = data.flatMap(d => bars.map(b => d[b.key] || 0));
  const maxVal = Math.max(...allVals, 1);
  const barW = (iW / data.length) * 0.7;
  const gap = iW / data.length;

  const ticks = 5;
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        {/* Y axis ticks */}
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const v = (maxVal / ticks) * i;
          const y = PT + iH - (iH * i) / ticks;
          return (
            <g key={i}>
              <line x1={PL} x2={PL + iW} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={PL - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#64748b">
                {v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toFixed(0)}
              </text>
            </g>
          );
        })}
        {/* Bars */}
        {data.map((d, di) => {
          const cx = PL + di * gap + gap / 2;
          const totalBars = bars.length;
          return bars.map((b, bi) => {
            const val = d[b.key] || 0;
            const bH = (val / maxVal) * iH;
            const x = cx - (barW * totalBars) / 2 + bi * barW;
            const y = PT + iH - bH;
            return (
              <g key={b.key}>
                <rect x={x} y={y} width={barW - 2} height={bH} fill={b.color} rx="4" />
              </g>
            );
          });
        })}
        {/* X labels */}
        {data.map((d, di) => (
          <text key={di} x={PL + di * gap + gap / 2} y={H - PB + 18}
            textAnchor="middle" fontSize="10" fill="#64748b">
            {String(d[xKey]).slice(5) || d[xKey]}
          </text>
        ))}
        {/* Legend */}
        {bars.map((b, bi) => (
          <g key={b.key} transform={`translate(${PL + bi * 100}, ${H - 14})`}>
            <rect width="10" height="10" fill={b.color} rx="2" />
            <text x="14" y="9" fontSize="10" fill="#475569">{b.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function PieChart({ data, nameKey, valueKey, currency = "ARS" }) {
  const W = 320, H = 260, cx = 120, cy = 120, r = 100, ir = 50;
  const total = data.reduce((a, b) => a + (b[valueKey] || 0), 0);
  if (total === 0) return <EmptyState msg="Sin datos para mostrar" />;

  let startAngle = -Math.PI / 2;
  const slices = data.slice(0, 8).map((d, i) => {
    const pct = d[valueKey] / total;
    const angle = pct * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + ir * Math.cos(startAngle);
    const iy1 = cy + ir * Math.sin(startAngle);
    const ix2 = cx + ir * Math.cos(endAngle);
    const iy2 = cy + ir * Math.sin(endAngle);
    const large = angle > Math.PI ? 1 : 0;
    const path = `M ${ix1} ${iy1} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${ir} ${ir} 0 ${large} 0 ${ix1} ${iy1} Z`;
    const midA = startAngle + angle / 2;
    const slice = { path, color: PALETTE[i % PALETTE.length], midA, pct, name: d[nameKey], value: d[valueKey] };
    startAngle = endAngle;
    return slice;
  });

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth="2" />
        ))}
        {/* Legend */}
        {slices.map((s, i) => (
          <g key={i} transform={`translate(250, ${20 + i * 22})`}>
            <rect width="12" height="12" fill={s.color} rx="2" />
            <text x="16" y="10" fontSize="10" fill="#1e293b">
              {s.name.length > 14 ? s.name.slice(0, 13) + "…" : s.name}
            </text>
            <text x="16" y="20" fontSize="9" fill="#64748b">{(s.pct * 100).toFixed(1)}%</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "cargar", label: "📥 Cargar" },
  { id: "dashboard", label: "📊 Dashboard" },
  { id: "datos", label: "🗂 Datos" },
  { id: "presupuesto", label: "🎯 Presupuesto" },
  { id: "reportes", label: "📈 Reportes" },
  { id: "deudas", label: "💳 Deudas" },
  { id: "metas", label: "⭐ Metas" },
  { id: "config", label: "⚙️ Config" },
];

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("cargar");

  // Catalogs
  const [people, setPeople] = useState(DEFAULT_PEOPLE);
  const [paymentMethods, setPaymentMethods] = useState(DEFAULT_PAYMENT_METHODS);
  const [types, setTypes] = useState(DEFAULT_TYPES);
  const [categoryMap, setCategoryMap] = useState(DEFAULT_CATEGORY_MAP);

  // Data
  const [movements, setMovements] = useState([]);
  const [debts, setDebts] = useState([]);
  const [debtPayments, setDebtPayments] = useState([]);
  const [goals, setGoals] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [monthlyBalances, setMonthlyBalances] = useState([]);

  // FX
  const [blueRate, setBlueRate] = useState(1250);
  const [blueUpdatedAt, setBlueUpdatedAt] = useState("");
  const [fxStatus, setFxStatus] = useState("idle");
  const [displayCurrency, setDisplayCurrency] = useState("ARS");

  // Loading
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Report filters
  const [reportMonth, setReportMonth] = useState(currentMonth());
  const [reportYear, setReportYear] = useState(String(new Date().getFullYear()));

  // Movement filters
  const [filters, setFilters] = useState({ person: "all", type: "all", category: "all", month: currentMonth(), currency: "all" });

  // Forms
  const emptyMovForm = useCallback(() => ({
    date: today(), person: "Compartido", type: "", category: "",
    description: "", originalAmount: "", currency: "ARS",
    fxRate: blueRate, paymentMethod: paymentMethods[0] || "", linkedDebtId: "",
  }), [blueRate, paymentMethods]);

  const [movForm, setMovForm] = useState(emptyMovForm());
  const [debtForm, setDebtForm] = useState({ name: "", owner: "Compartido", balance: "", installment: "", dueDay: "", priority: "Media", rate: "", notes: "" });
  const [goalForm, setGoalForm] = useState({ name: "", target: "", current: "" });
  const [budgetForm, setBudgetForm] = useState({ month: currentMonth(), person: "Compartido", type: "Egreso", category: "Supermercado", planned: "" });
  const [debtPayForm, setDebtPayForm] = useState({ debtId: "", date: today(), amount: "", person: "Compartido", paymentMethod: "Banco", notes: "" });
  const [balanceForm, setBalanceForm] = useState({ month: currentMonth(), opening: "", notes: "" });
  const [catalogForm, setCatalogForm] = useState({ person: "", paymentMethod: "", type: "", categoryType: "Egreso", category: "" });

  // ── Load data from Supabase ──────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [{ data: movs }, { data: dbs }, { data: dps }, { data: gls }, { data: bgs }, { data: mbs }, { data: cats }] = await Promise.all([
          supabase.from("movements").select("*").order("movement_date", { ascending: false }),
          supabase.from("debts").select("*").order("created_at", { ascending: false }),
          supabase.from("debt_payments").select("*").order("payment_date", { ascending: false }),
          supabase.from("goals").select("*").order("created_at", { ascending: false }),
          supabase.from("budgets").select("*").order("created_at", { ascending: false }),
          supabase.from("monthly_balances").select("*").order("balance_month", { ascending: false }),
          supabase.from("settings_catalog").select("*").order("created_at"),
        ]);

        if (movs) setMovements(movs.map(m => ({
          id: m.id, date: m.movement_date, person: m.person, type: m.type,
          category: m.category, description: m.description,
          originalAmount: m.original_amount, currency: m.original_currency,
          fxRate: m.fx_rate, amountArs: m.amount_ars, amountUsd: m.amount_usd,
          paymentMethod: m.payment_method, linkedDebtId: m.linked_debt_id,
        })));

        if (dbs) setDebts(dbs.map(d => ({
          id: d.id, name: d.name, owner: d.owner, balance: d.current_balance,
          initialBalance: d.initial_balance, installment: d.installment_amount,
          dueDay: d.due_day, priority: d.priority, rate: d.rate,
          notes: d.notes, totalPaid: d.total_paid, status: d.status,
        })));

        if (dps) setDebtPayments(dps.map(p => ({
          id: p.id, debtId: p.debt_id, date: p.payment_date, amount: p.amount_ars,
          person: p.person, paymentMethod: p.payment_method, notes: p.notes,
        })));

        if (gls) setGoals(gls);
        if (bgs) setBudgets(bgs.map(b => ({
          id: b.id, month: b.budget_month, person: b.person, type: b.type,
          category: b.category, planned: b.planned_amount_ars,
        })));
        if (mbs) setMonthlyBalances(mbs);

        // Reconstruct catalogs from DB if any saved
        if (cats && cats.length > 0) {
          const newPeople = cats.filter(c => c.catalog_type === "person").map(c => c.value);
          const newPMs = cats.filter(c => c.catalog_type === "payment_method").map(c => c.value);
          const newTypes = cats.filter(c => c.catalog_type === "type").map(c => c.value);
          const catEntries = cats.filter(c => c.catalog_type === "category");
          if (newPeople.length) setPeople(newPeople);
          if (newPMs.length) setPaymentMethods(newPMs);
          if (newTypes.length) setTypes(newTypes);
          if (catEntries.length) {
            const map = {};
            catEntries.forEach(c => {
              if (!map[c.parent_type]) map[c.parent_type] = [];
              map[c.parent_type].push(c.value);
            });
            setCategoryMap(map);
          }
        }
      } catch (e) {
        console.error("Error cargando datos:", e);
      }
      setLoading(false);
    }
    load();
  }, []);

  // ── Fetch blue rate ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchBlue() {
      try {
        setFxStatus("loading");
        const res = await fetch("https://dolarapi.com/v1/dolares/blue");
        if (!res.ok) throw new Error();
        const data = await res.json();
        const rate = Number(data?.venta || 0);
        if (rate > 0) {
          setBlueRate(rate);
          setBlueUpdatedAt(data?.fechaActualizacion || "");
          setFxStatus("ok");
        } else throw new Error();
      } catch { setFxStatus("error"); }
    }
    fetchBlue();
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const fmt = (ars) => money(fromArs(ars, displayCurrency, blueRate), displayCurrency);

  // ── Add movement ─────────────────────────────────────────────────────────────
  async function addMovement() {
    if (!movForm.category || !movForm.originalAmount || !movForm.person || !movForm.type) return;
    setSaving(true);
    const rate = movForm.currency === "USD" ? blueRate : 1;
    const amountArs = toArs(movForm.originalAmount, movForm.currency, rate);
    const amountUsd = movForm.currency === "USD" ? Number(movForm.originalAmount) : amountArs / blueRate;
    const selectedDebt = debts.find(d => String(d.id) === String(movForm.linkedDebtId));

    const row = {
      movement_date: movForm.date,
      person: movForm.person,
      type: movForm.type,
      category: movForm.category,
      description: movForm.description || null,
      original_currency: movForm.currency,
      original_amount: Number(movForm.originalAmount),
      fx_rate: rate,
      amount_ars: amountArs,
      amount_usd: amountUsd,
      payment_method: movForm.paymentMethod,
      linked_debt_id: movForm.linkedDebtId ? Number(movForm.linkedDebtId) : null,
    };

    const { data, error } = await supabase.from("movements").insert([row]).select().single();
    if (!error && data) {
      const mov = {
        id: data.id, date: data.movement_date, person: data.person, type: data.type,
        category: data.category, description: data.description,
        originalAmount: data.original_amount, currency: data.original_currency,
        fxRate: data.fx_rate, amountArs: data.amount_ars, amountUsd: data.amount_usd,
        paymentMethod: data.payment_method, linkedDebtId: data.linked_debt_id,
      };
      setMovements(prev => [mov, ...prev]);

      // If debt payment, update debt balance
      if (movForm.type === "Egreso" && movForm.category === "Deuda" && selectedDebt) {
        const newBalance = Math.max(0, selectedDebt.balance - amountArs);
        const newPaid = (selectedDebt.totalPaid || 0) + amountArs;
        await supabase.from("debts").update({ current_balance: newBalance, total_paid: newPaid }).eq("id", selectedDebt.id);
        await supabase.from("debt_payments").insert([{
          debt_id: selectedDebt.id, payment_date: movForm.date, amount_ars: amountArs,
          person: movForm.person, payment_method: movForm.paymentMethod,
          notes: movForm.description || "Pago desde egreso", linked_movement_id: data.id,
        }]);
        setDebts(prev => prev.map(d => d.id === selectedDebt.id ? { ...d, balance: newBalance, totalPaid: newPaid } : d));
      }
    }
    setMovForm(emptyMovForm());
    setSaving(false);
  }

  // ── Delete movement ──────────────────────────────────────────────────────────
  async function deleteMovement(id) {
    await supabase.from("movements").delete().eq("id", id);
    setMovements(prev => prev.filter(m => m.id !== id));
  }

  // ── Add debt ─────────────────────────────────────────────────────────────────
  async function addDebt() {
    if (!debtForm.name || !debtForm.balance) return;
    setSaving(true);
    const bal = Number(debtForm.balance);
    const { data, error } = await supabase.from("debts").insert([{
      name: debtForm.name, owner: debtForm.owner, initial_balance: bal,
      current_balance: bal, installment_amount: Number(debtForm.installment || 0),
      due_day: Number(debtForm.dueDay || 0), priority: debtForm.priority,
      rate: Number(debtForm.rate || 0), notes: debtForm.notes || null, total_paid: 0, status: "Activa",
    }]).select().single();
    if (!error && data) {
      setDebts(prev => [{
        id: data.id, name: data.name, owner: data.owner, balance: data.current_balance,
        initialBalance: data.initial_balance, installment: data.installment_amount,
        dueDay: data.due_day, priority: data.priority, rate: data.rate,
        notes: data.notes, totalPaid: data.total_paid, status: data.status,
      }, ...prev]);
    }
    setDebtForm({ name: "", owner: "Compartido", balance: "", installment: "", dueDay: "", priority: "Media", rate: "", notes: "" });
    setSaving(false);
  }

  // ── Delete debt ───────────────────────────────────────────────────────────────
  async function deleteDebt(id) {
    await supabase.from("debts").delete().eq("id", id);
    setDebts(prev => prev.filter(d => d.id !== id));
  }

  // ── Register debt payment ─────────────────────────────────────────────────────
  async function registerDebtPayment() {
    const debt = debts.find(d => String(d.id) === String(debtPayForm.debtId));
    if (!debt || !debtPayForm.amount) return;
    setSaving(true);
    const amount = Math.min(Number(debtPayForm.amount), debt.balance);
    if (amount <= 0) { setSaving(false); return; }
    const newBalance = Math.max(0, debt.balance - amount);
    const newPaid = (debt.totalPaid || 0) + amount;

    await supabase.from("debts").update({ current_balance: newBalance, total_paid: newPaid }).eq("id", debt.id);
    const { data: dp } = await supabase.from("debt_payments").insert([{
      debt_id: debt.id, payment_date: debtPayForm.date, amount_ars: amount,
      person: debtPayForm.person, payment_method: debtPayForm.paymentMethod, notes: debtPayForm.notes || null,
    }]).select().single();
    const { data: mov } = await supabase.from("movements").insert([{
      movement_date: debtPayForm.date, person: debtPayForm.person, type: "Egreso",
      category: "Deuda", description: `Pago deuda - ${debt.name}`,
      original_currency: "ARS", original_amount: amount, fx_rate: 1,
      amount_ars: amount, amount_usd: amount / blueRate,
      payment_method: debtPayForm.paymentMethod, linked_debt_id: debt.id,
    }]).select().single();

    setDebts(prev => prev.map(d => d.id === debt.id ? { ...d, balance: newBalance, totalPaid: newPaid } : d));
    if (dp) setDebtPayments(prev => [{ id: dp.id, debtId: dp.debt_id, date: dp.payment_date, amount: dp.amount_ars, person: dp.person, paymentMethod: dp.payment_method, notes: dp.notes }, ...prev]);
    if (mov) setMovements(prev => [{
      id: mov.id, date: mov.movement_date, person: mov.person, type: mov.type,
      category: mov.category, description: mov.description, originalAmount: mov.original_amount,
      currency: mov.original_currency, fxRate: mov.fx_rate, amountArs: mov.amount_ars,
      amountUsd: mov.amount_usd, paymentMethod: mov.payment_method, linkedDebtId: mov.linked_debt_id,
    }, ...prev]);
    setDebtPayForm({ debtId: "", date: today(), amount: "", person: "Compartido", paymentMethod: "Banco", notes: "" });
    setSaving(false);
  }

  // ── Goals ─────────────────────────────────────────────────────────────────────
  async function addGoal() {
    if (!goalForm.name || !goalForm.target) return;
    const { data } = await supabase.from("goals").insert([{ name: goalForm.name, target_amount: Number(goalForm.target), current_amount: Number(goalForm.current || 0) }]).select().single();
    if (data) setGoals(prev => [data, ...prev]);
    setGoalForm({ name: "", target: "", current: "" });
  }
  async function deleteGoal(id) {
    await supabase.from("goals").delete().eq("id", id);
    setGoals(prev => prev.filter(g => g.id !== id));
  }

  // ── Budgets ───────────────────────────────────────────────────────────────────
  async function addBudget() {
    if (!budgetForm.month || !budgetForm.person || !budgetForm.type || !budgetForm.category || !budgetForm.planned) return;
    const { data } = await supabase.from("budgets").insert([{
      budget_month: budgetForm.month, person: budgetForm.person, type: budgetForm.type,
      category: budgetForm.category, planned_amount_ars: Number(budgetForm.planned),
    }]).select().single();
    if (data) setBudgets(prev => [{ id: data.id, month: data.budget_month, person: data.person, type: data.type, category: data.category, planned: data.planned_amount_ars }, ...prev]);
    setBudgetForm({ month: currentMonth(), person: "Compartido", type: "Egreso", category: "Supermercado", planned: "" });
  }
  async function deleteBudget(id) {
    await supabase.from("budgets").delete().eq("id", id);
    setBudgets(prev => prev.filter(b => b.id !== id));
  }

  // ── Monthly balance ───────────────────────────────────────────────────────────
  async function saveBalance() {
    if (!balanceForm.month || balanceForm.opening === "") return;
    const existing = monthlyBalances.find(b => b.balance_month === balanceForm.month);
    if (existing) {
      await supabase.from("monthly_balances").update({ opening_balance_ars: Number(balanceForm.opening), notes: balanceForm.notes }).eq("id", existing.id);
      setMonthlyBalances(prev => prev.map(b => b.balance_month === balanceForm.month ? { ...b, opening_balance_ars: Number(balanceForm.opening), notes: balanceForm.notes } : b));
    } else {
      const { data } = await supabase.from("monthly_balances").insert([{ balance_month: balanceForm.month, opening_balance_ars: Number(balanceForm.opening), notes: balanceForm.notes }]).select().single();
      if (data) setMonthlyBalances(prev => [data, ...prev]);
    }
    setBalanceForm({ month: currentMonth(), opening: "", notes: "" });
  }

  // ── Computed ──────────────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const income = movements.filter(m => m.type === "Ingreso").reduce((a, b) => a + b.amountArs, 0);
    const expenses = movements.filter(m => m.type === "Egreso").reduce((a, b) => a + b.amountArs, 0);
    const savings = movements.filter(m => m.type === "Ahorro").reduce((a, b) => a + b.amountArs, 0);
    const investments = movements.filter(m => m.type === "Inversión").reduce((a, b) => a + b.amountArs, 0);
    const totalDebt = debts.reduce((a, b) => a + b.balance, 0);
    const net = income - expenses - savings - investments;
    return { income, expenses, savings, investments, totalDebt, net };
  }, [movements, debts]);

  const monthBalance = useMemo(() => {
    const rec = monthlyBalances.find(b => b.balance_month === reportMonth);
    const opening = rec?.opening_balance_ars || 0;
    const inc = movements.filter(m => m.type === "Ingreso" && monthKey(m.date) === reportMonth).reduce((a, b) => a + b.amountArs, 0);
    const exp = movements.filter(m => m.type === "Egreso" && monthKey(m.date) === reportMonth).reduce((a, b) => a + b.amountArs, 0);
    const sav = movements.filter(m => m.type === "Ahorro" && monthKey(m.date) === reportMonth).reduce((a, b) => a + b.amountArs, 0);
    const inv = movements.filter(m => m.type === "Inversión" && monthKey(m.date) === reportMonth).reduce((a, b) => a + b.amountArs, 0);
    const closing = opening + inc - exp - sav - inv;
    return { opening, inc, exp, sav, inv, closing };
  }, [movements, monthlyBalances, reportMonth]);

  const annualByMonth = useMemo(() => {
    const bucket = {};
    movements.forEach(m => {
      const k = monthKey(m.date);
      if (!bucket[k]) bucket[k] = { month: k, income: 0, expenses: 0, savings: 0, investments: 0 };
      if (m.type === "Ingreso") bucket[k].income += fromArs(m.amountArs, displayCurrency, blueRate);
      if (m.type === "Egreso") bucket[k].expenses += fromArs(m.amountArs, displayCurrency, blueRate);
      if (m.type === "Ahorro") bucket[k].savings += fromArs(m.amountArs, displayCurrency, blueRate);
      if (m.type === "Inversión") bucket[k].investments += fromArs(m.amountArs, displayCurrency, blueRate);
    });
    return Object.values(bucket).sort((a, b) => a.month.localeCompare(b.month));
  }, [movements, displayCurrency, blueRate]);

  const monthlyByCategory = useMemo(() => {
    const bucket = {};
    movements.filter(m => m.type === "Egreso" && monthKey(m.date) === reportMonth).forEach(m => {
      bucket[m.category] = (bucket[m.category] || 0) + fromArs(m.amountArs, displayCurrency, blueRate);
    });
    return Object.entries(bucket).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
  }, [movements, reportMonth, displayCurrency, blueRate]);

  const monthlyByPerson = useMemo(() => {
    const bucket = {};
    movements.filter(m => m.type === "Egreso" && monthKey(m.date) === reportMonth).forEach(m => {
      bucket[m.person] = (bucket[m.person] || 0) + fromArs(m.amountArs, displayCurrency, blueRate);
    });
    return Object.entries(bucket).map(([person, total]) => ({ person, total })).sort((a, b) => b.total - a.total);
  }, [movements, reportMonth, displayCurrency, blueRate]);

  const budgetComparison = useMemo(() => {
    return budgets.filter(b => b.month === reportMonth).map(b => {
      const actual = movements
        .filter(m => monthKey(m.date) === b.month && m.person === b.person && m.type === b.type && m.category === b.category)
        .reduce((a, c) => a + c.amountArs, 0);
      const execution = b.planned > 0 ? (actual / b.planned) * 100 : 0;
      return { ...b, actual, difference: b.planned - actual, execution };
    });
  }, [budgets, movements, reportMonth]);

  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      if (filters.person !== "all" && m.person !== filters.person) return false;
      if (filters.type !== "all" && m.type !== filters.type) return false;
      if (filters.category !== "all" && m.category !== filters.category) return false;
      if (filters.currency !== "all" && m.currency !== filters.currency) return false;
      if (filters.month && monthKey(m.date) !== filters.month) return false;
      return true;
    });
  }, [movements, filters]);

  // ── Export CSV ────────────────────────────────────────────────────────────────
  function exportCSV() {
    const headers = ["Fecha","Persona","Tipo","Categoría","Descripción","Moneda","Importe original","TC","Importe ARS","Importe USD","Medio de pago"];
    const rows = filteredMovements.map(m => [
      m.date, m.person, m.type, m.category, m.description || "",
      m.currency, m.originalAmount, m.fxRate, m.amountArs.toFixed(2),
      (m.amountUsd || 0).toFixed(2), m.paymentMethod,
    ]);
    const csv = [headers, ...rows].map(r => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `movimientos_${filters.month || "todos"}.csv`; a.click();
  }

  const selectedDebtForMov = debts.find(d => String(d.id) === String(movForm.linkedDebtId));
  const selectedDebtForPay = debts.find(d => String(d.id) === String(debtPayForm.debtId));

  if (loading) return (
    <div className="loading-screen">
      <Spinner />
      <p>Cargando datos…</p>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      <div className="app-container">

        {/* Header */}
        <div className="header">
          <div>
            <h1 className="app-title">💰 Finanzas Familiares</h1>
            <p className="app-subtitle">Gastos, presupuesto, deudas y metas · Guardado en la nube</p>
          </div>
          <div className="header-controls">
            <Select value={displayCurrency} onChange={setDisplayCurrency} className="w-auto">
              <option value="ARS">Ver en ARS</option>
              <option value="USD">Ver en USD</option>
            </Select>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs-scroll">
          <div className="tabs-list">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`tab-btn${tab === t.id ? " active" : ""}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── CARGAR ── */}
        {tab === "cargar" && (
          <div className="tab-content">
            <Card>
              <CardHead title="Carga rápida" icon="📥" />
              <div className="form-grid">
                <Field label="Fecha">
                  <Input type="date" value={movForm.date} onChange={e => setMovForm({ ...movForm, date: e.target.value })} />
                </Field>
                <Field label="Persona">
                  <Select value={movForm.person} onChange={v => setMovForm({ ...movForm, person: v })}>
                    {people.map(p => <option key={p} value={p}>{p}</option>)}
                  </Select>
                </Field>
                <Field label="Tipo">
                  <Select value={movForm.type} onChange={v => setMovForm({ ...movForm, type: v, category: "", linkedDebtId: "" })}>
                    <option value="">Seleccionar…</option>
                    {types.map(t => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </Field>
                <Field label="Categoría">
                  <Select value={movForm.category} onChange={v => setMovForm({ ...movForm, category: v, linkedDebtId: v !== "Deuda" ? "" : movForm.linkedDebtId })} disabled={!movForm.type}>
                    <option value="">Seleccionar…</option>
                    {(categoryMap[movForm.type] || []).map(c => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </Field>
                {movForm.type === "Egreso" && movForm.category === "Deuda" && (
                  <Field label="Deuda">
                    <Select value={movForm.linkedDebtId} onChange={v => setMovForm({ ...movForm, linkedDebtId: v, originalAmount: debts.find(d => String(d.id) === String(v))?.installment || "" })}>
                      <option value="">Elegir deuda…</option>
                      {debts.map(d => <option key={d.id} value={String(d.id)}>{d.name} ({fmt(d.balance)} pendiente)</option>)}
                    </Select>
                  </Field>
                )}
                <Field label="Moneda">
                  <Select value={movForm.currency} onChange={v => setMovForm({ ...movForm, currency: v })}>
                    <option value="ARS">Pesos (ARS)</option>
                    <option value="USD">Dólar blue (USD)</option>
                  </Select>
                </Field>
                <Field label={`Importe${movForm.currency === "USD" ? " (USD)" : " (ARS)"}`}>
                  <Input type="number" value={movForm.originalAmount} onChange={e => setMovForm({ ...movForm, originalAmount: e.target.value })} placeholder="0" />
                </Field>
                <Field label="Medio de pago">
                  <Select value={movForm.paymentMethod} onChange={v => setMovForm({ ...movForm, paymentMethod: v })}>
                    {paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
                  </Select>
                </Field>
                <Field label="Descripción">
                  <Input value={movForm.description} onChange={e => setMovForm({ ...movForm, description: e.target.value })} placeholder="Detalle opcional" />
                </Field>
              </div>

              {selectedDebtForMov && movForm.category === "Deuda" && (
                <InfoBox color="blue">
                  Cuota sugerida: <strong>{fmt(selectedDebtForMov.installment)}</strong> · Saldo pendiente: <strong>{fmt(selectedDebtForMov.balance)}</strong> · Al guardar, se actualiza el saldo de la deuda.
                </InfoBox>
              )}
              {movForm.currency === "USD" && (
                <InfoBox color="amber">
                  Cotización blue actual: <strong>{money(blueRate)} por USD</strong> · Importe en ARS: <strong>{money(toArs(movForm.originalAmount || 0, "USD", blueRate))}</strong>
                </InfoBox>
              )}
              <div style={{ marginTop: 16 }}>
                <Btn onClick={addMovement} disabled={saving || !movForm.type || !movForm.category || !movForm.originalAmount}>
                  {saving ? "Guardando…" : "＋ Agregar movimiento"}
                </Btn>
              </div>
            </Card>
          </div>
        )}

        {/* ── DASHBOARD ── */}
        {tab === "dashboard" && (
          <div className="tab-content">
            <div className="fx-bar">
              <span>💱 USD blue: <strong>{money(blueRate)}</strong></span>
              {blueUpdatedAt && <span className="muted">Actualizado: {new Date(blueUpdatedAt).toLocaleString("es-AR")}</span>}
              <Badge color={fxStatus === "ok" ? "green" : fxStatus === "loading" ? "amber" : "red"}>
                {fxStatus === "ok" ? "Cotización online" : fxStatus === "loading" ? "Actualizando…" : "Valor manual"}
              </Badge>
            </div>

            <div className="stats-grid">
              {[
                { label: "Ingresos", value: summary.income, icon: "💵", color: "green" },
                { label: "Gastos", value: summary.expenses, icon: "💸", color: "red" },
                { label: "Ahorro", value: summary.savings, icon: "🐷", color: "blue" },
                { label: "Inversión", value: summary.investments, icon: "📈", color: "purple" },
                { label: "Deuda total", value: summary.totalDebt, icon: "💳", color: "red" },
                { label: "Neto", value: summary.net, icon: "⚖️", color: summary.net >= 0 ? "green" : "red" },
              ].map(s => (
                <div key={s.label} className={`stat-card stat-${s.color}`}>
                  <div className="stat-icon">{s.icon}</div>
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-value">{fmt(s.value)}</div>
                </div>
              ))}
            </div>

            {/* Saldo del mes */}
            <Card>
              <CardHead title={`Saldo del mes · ${reportMonth}`} icon="📅" />
              <div className="balance-grid">
                <div className="balance-row">
                  <span>Saldo inicial</span>
                  <strong>{fmt(monthBalance.opening)}</strong>
                </div>
                <div className="balance-row green">
                  <span>＋ Ingresos</span>
                  <strong>{fmt(monthBalance.inc)}</strong>
                </div>
                <div className="balance-row red">
                  <span>− Gastos</span>
                  <strong>{fmt(monthBalance.exp)}</strong>
                </div>
                <div className="balance-row amber">
                  <span>− Ahorro</span>
                  <strong>{fmt(monthBalance.sav)}</strong>
                </div>
                <div className="balance-row purple">
                  <span>− Inversión</span>
                  <strong>{fmt(monthBalance.inv)}</strong>
                </div>
                <div className="balance-row total">
                  <span>= Saldo final</span>
                  <strong>{fmt(monthBalance.closing)}</strong>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <p className="muted small">Configurá el saldo inicial del mes en la sección Presupuesto.</p>
              </div>
            </Card>

            {/* Próximos vencimientos */}
            {debts.length > 0 && (
              <Card>
                <CardHead title="Próximos vencimientos" icon="📆" />
                <div className="debt-list">
                  {debts.slice().sort((a, b) => a.dueDay - b.dueDay).slice(0, 4).map(d => (
                    <div key={d.id} className="debt-mini">
                      <div>
                        <div className="fw">{d.name}</div>
                        <div className="muted small">{d.owner} · Prioridad {d.priority}</div>
                      </div>
                      <div className="text-right">
                        <div className="fw">{fmt(d.installment)}</div>
                        <div className="muted small">Día {d.dueDay}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ── DATOS ── */}
        {tab === "datos" && (
          <div className="tab-content">
            <Card>
              <CardHead title="Filtros" icon="🔍" />
              <div className="filter-grid">
                <Field label="Mes">
                  <Input type="month" value={filters.month} onChange={e => setFilters({ ...filters, month: e.target.value })} />
                </Field>
                <Field label="Persona">
                  <Select value={filters.person} onChange={v => setFilters({ ...filters, person: v })}>
                    <option value="all">Todas</option>
                    {people.map(p => <option key={p} value={p}>{p}</option>)}
                  </Select>
                </Field>
                <Field label="Tipo">
                  <Select value={filters.type} onChange={v => setFilters({ ...filters, type: v })}>
                    <option value="all">Todos</option>
                    {types.map(t => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </Field>
                <Field label="Categoría">
                  <Select value={filters.category} onChange={v => setFilters({ ...filters, category: v })}>
                    <option value="all">Todas</option>
                    {Object.values(categoryMap).flat().map(c => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </Field>
                <Field label="Moneda">
                  <Select value={filters.currency} onChange={v => setFilters({ ...filters, currency: v })}>
                    <option value="all">Todas</option>
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </Select>
                </Field>
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <Btn onClick={exportCSV} variant="outline">⬇ Exportar CSV</Btn>
                <span className="muted small" style={{ alignSelf: "center" }}>{filteredMovements.length} registros</span>
              </div>
            </Card>

            {/* Table desktop */}
            <Card>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th><th>Persona</th><th>Tipo</th><th>Categoría</th>
                      <th>Descripción</th><th>Moneda</th><th>Original</th>
                      <th>TC</th><th>ARS</th><th>USD</th><th>Medio</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMovements.map(m => (
                      <tr key={m.id}>
                        <td>{m.date}</td>
                        <td>{m.person}</td>
                        <td><Badge color={m.type === "Ingreso" ? "green" : m.type === "Egreso" ? "red" : m.type === "Ahorro" ? "blue" : "purple"}>{m.type}</Badge></td>
                        <td>{m.category}</td>
                        <td className="muted">{m.description || "—"}</td>
                        <td>{m.currency}</td>
                        <td className="number">{money(m.originalAmount, m.currency)}</td>
                        <td className="number muted">{m.fxRate !== 1 ? money(m.fxRate) : "—"}</td>
                        <td className="number fw">{money(m.amountArs)}</td>
                        <td className="number muted">{money(m.amountUsd || 0, "USD")}</td>
                        <td>{m.paymentMethod}</td>
                        <td>
                          <button className="del-btn" onClick={() => deleteMovement(m.id)} title="Eliminar">🗑</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredMovements.length === 0 && <EmptyState msg="No hay movimientos con esos filtros." />}
              </div>

              {/* Cards mobile */}
              <div className="cards-mobile">
                {filteredMovements.map(m => (
                  <div key={m.id} className="mov-card">
                    <div className="mov-card-head">
                      <div>
                        <div className="fw">{m.category} · {m.description || "Sin detalle"}</div>
                        <div className="muted small">{m.date} · {m.person} · {m.paymentMethod}</div>
                      </div>
                      <button className="del-btn" onClick={() => deleteMovement(m.id)}>🗑</button>
                    </div>
                    <div className="mov-card-amounts">
                      <div><span className="muted small">ARS</span><div className="fw">{money(m.amountArs)}</div></div>
                      <div><span className="muted small">USD</span><div className="fw">{money(m.amountUsd || 0, "USD")}</div></div>
                      <div><span className="muted small">Original</span><div>{money(m.originalAmount, m.currency)}</div></div>
                      <div><span className="muted small">TC</span><div>{m.fxRate !== 1 ? money(m.fxRate) : "—"}</div></div>
                    </div>
                    <Badge color={m.type === "Ingreso" ? "green" : m.type === "Egreso" ? "red" : "blue"}>{m.type}</Badge>
                  </div>
                ))}
                {filteredMovements.length === 0 && <EmptyState msg="No hay movimientos con esos filtros." />}
              </div>
            </Card>
          </div>
        )}

        {/* ── PRESUPUESTO ── */}
        {tab === "presupuesto" && (
          <div className="tab-content">
            {/* Saldo inicial */}
            <Card>
              <CardHead title="Saldo inicial del mes" icon="🏦" />
              <div className="form-grid three-col">
                <Field label="Mes">
                  <Input type="month" value={balanceForm.month} onChange={e => setBalanceForm({ ...balanceForm, month: e.target.value })} />
                </Field>
                <Field label="Saldo inicial (ARS)">
                  <Input type="number" value={balanceForm.opening} onChange={e => setBalanceForm({ ...balanceForm, opening: e.target.value })} placeholder="0" />
                </Field>
                <Field label="Notas">
                  <Input value={balanceForm.notes} onChange={e => setBalanceForm({ ...balanceForm, notes: e.target.value })} placeholder="Opcional" />
                </Field>
              </div>
              <div style={{ marginTop: 12 }}>
                <Btn onClick={saveBalance} variant="primary">Guardar saldo inicial</Btn>
              </div>
            </Card>

            {/* Budget form */}
            <Card>
              <CardHead title="Agregar presupuesto" icon="🎯" />
              <div className="form-grid">
                <Field label="Mes">
                  <Input type="month" value={budgetForm.month} onChange={e => setBudgetForm({ ...budgetForm, month: e.target.value })} />
                </Field>
                <Field label="Persona">
                  <Select value={budgetForm.person} onChange={v => setBudgetForm({ ...budgetForm, person: v })}>
                    {people.map(p => <option key={p} value={p}>{p}</option>)}
                  </Select>
                </Field>
                <Field label="Tipo">
                  <Select value={budgetForm.type} onChange={v => setBudgetForm({ ...budgetForm, type: v, category: (categoryMap[v] || [])[0] || "" })}>
                    {types.map(t => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </Field>
                <Field label="Categoría">
                  <Select value={budgetForm.category} onChange={v => setBudgetForm({ ...budgetForm, category: v })}>
                    {(categoryMap[budgetForm.type] || []).map(c => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </Field>
                <Field label="Importe presupuestado">
                  <Input type="number" value={budgetForm.planned} onChange={e => setBudgetForm({ ...budgetForm, planned: e.target.value })} placeholder="0" />
                </Field>
              </div>
              <div style={{ marginTop: 12 }}>
                <Btn onClick={addBudget}>＋ Agregar presupuesto</Btn>
              </div>
            </Card>

            {/* Comparativa */}
            <Card>
              <CardHead title="Presupuesto vs Real" icon="📊" />
              <div style={{ marginBottom: 14 }}>
                <Field label="Mes a analizar">
                  <Input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} className="w-auto" />
                </Field>
              </div>
              {budgetComparison.length === 0 && <EmptyState msg="No hay presupuestos para este mes." />}
              {budgetComparison.map(b => {
                const over = b.execution > 100;
                const warn = b.execution >= 85;
                return (
                  <div key={b.id} className={`budget-row ${over ? "budget-over" : warn ? "budget-warn" : "budget-ok"}`}>
                    <div className="budget-row-head">
                      <div>
                        <div className="fw">{over ? "⚠️ " : ""}{b.category}</div>
                        <div className="muted small">{b.month} · {b.person} · {b.type}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <Badge color={over ? "red" : warn ? "amber" : "green"}>{b.execution.toFixed(1)}%</Badge>
                        <button className="del-btn" onClick={() => deleteBudget(b.id)}>🗑</button>
                      </div>
                    </div>
                    <div className="budget-amounts">
                      <div><span className="muted small">Presupuesto</span><div>{fmt(b.planned)}</div></div>
                      <div><span className="muted small">Real</span><div className={b.actual > b.planned ? "red" : ""}>{fmt(b.actual)}</div></div>
                      <div><span className="muted small">Diferencia</span><div className={b.difference < 0 ? "red" : "green"}>{fmt(b.difference)}</div></div>
                      <div><span className="muted small">Estado</span><div>{over ? "Excedido" : warn ? "Al límite" : "Dentro"}</div></div>
                    </div>
                    <Progress value={b.execution} />
                  </div>
                );
              })}
            </Card>
          </div>
        )}

        {/* ── REPORTES ── */}
        {tab === "reportes" && (
          <div className="tab-content">
            <Card>
              <CardHead title="Parámetros" icon="⚙️" />
              <div className="form-grid three-col">
                <Field label="Mes">
                  <Input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} />
                </Field>
                <Field label="Año">
                  <Input value={reportYear} onChange={e => setReportYear(e.target.value)} />
                </Field>
                <Field label="Moneda de visualización">
                  <Select value={displayCurrency} onChange={setDisplayCurrency}>
                    <option value="ARS">Pesos (ARS)</option>
                    <option value="USD">Dólar blue (USD)</option>
                  </Select>
                </Field>
              </div>
            </Card>

            <div className="two-col">
              <Card>
                <CardHead title="Gastos por categoría" icon="🍩" />
                <PieChart data={monthlyByCategory} nameKey="category" valueKey="total" currency={displayCurrency} />
              </Card>
              <Card>
                <CardHead title="Gastos por persona" icon="👤" />
                {monthlyByPerson.length === 0
                  ? <EmptyState msg="Sin datos para este mes." />
                  : monthlyByPerson.map((r, i) => (
                    <div key={r.person} className="report-row">
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 12, height: 12, borderRadius: 3, background: PALETTE[i % PALETTE.length] }} />
                        {r.person}
                      </div>
                      <strong>{money(r.total, displayCurrency)}</strong>
                    </div>
                  ))
                }
              </Card>
            </div>

            <Card>
              <CardHead title="Comparativa anual por mes" icon="📅" />
              {annualByMonth.length === 0
                ? <EmptyState msg="Sin movimientos registrados." />
                : <BarChart
                    data={annualByMonth}
                    xKey="month"
                    bars={[
                      { key: "income", label: "Ingresos", color: "#16a34a" },
                      { key: "expenses", label: "Gastos", color: "#dc2626" },
                      { key: "savings", label: "Ahorro", color: "#2563eb" },
                      { key: "investments", label: "Inversión", color: "#7c3aed" },
                    ]}
                    currency={displayCurrency}
                  />
              }
            </Card>
          </div>
        )}

        {/* ── DEUDAS ── */}
        {tab === "deudas" && (
          <div className="tab-content">
            <div className="two-col">
              <Card>
                <CardHead title="Agregar deuda" icon="💳" />
                <div className="form-grid two-col-form">
                  <Field label="Nombre">
                    <Input value={debtForm.name} onChange={e => setDebtForm({ ...debtForm, name: e.target.value })} placeholder="Ej. Tarjeta Visa" />
                  </Field>
                  <Field label="Titular">
                    <Select value={debtForm.owner} onChange={v => setDebtForm({ ...debtForm, owner: v })}>
                      {people.map(p => <option key={p} value={p}>{p}</option>)}
                    </Select>
                  </Field>
                  <Field label="Saldo inicial (ARS)">
                    <Input type="number" value={debtForm.balance} onChange={e => setDebtForm({ ...debtForm, balance: e.target.value })} />
                  </Field>
                  <Field label="Cuota sugerida">
                    <Input type="number" value={debtForm.installment} onChange={e => setDebtForm({ ...debtForm, installment: e.target.value })} />
                  </Field>
                  <Field label="Día de vencimiento">
                    <Input type="number" value={debtForm.dueDay} onChange={e => setDebtForm({ ...debtForm, dueDay: e.target.value })} min="1" max="31" />
                  </Field>
                  <Field label="Prioridad">
                    <Select value={debtForm.priority} onChange={v => setDebtForm({ ...debtForm, priority: v })}>
                      <option>Alta</option><option>Media</option><option>Baja</option>
                    </Select>
                  </Field>
                  <Field label="Tasa %">
                    <Input type="number" value={debtForm.rate} onChange={e => setDebtForm({ ...debtForm, rate: e.target.value })} />
                  </Field>
                  <Field label="Notas">
                    <Input value={debtForm.notes} onChange={e => setDebtForm({ ...debtForm, notes: e.target.value })} placeholder="Opcional" />
                  </Field>
                </div>
                <div style={{ marginTop: 12 }}>
                  <Btn onClick={addDebt} disabled={saving}>＋ Agregar deuda</Btn>
                </div>
              </Card>

              <Card>
                <CardHead title="Registrar pago" icon="💸" />
                <div className="form-grid two-col-form">
                  <Field label="Deuda" style={{ gridColumn: "span 2" }}>
                    <Select value={debtPayForm.debtId} onChange={v => setDebtPayForm({ ...debtPayForm, debtId: v, amount: debts.find(d => String(d.id) === String(v))?.installment || "" })}>
                      <option value="">Elegir deuda…</option>
                      {debts.map(d => <option key={d.id} value={String(d.id)}>{d.name} · {fmt(d.balance)} pendiente</option>)}
                    </Select>
                  </Field>
                  <Field label="Fecha">
                    <Input type="date" value={debtPayForm.date} onChange={e => setDebtPayForm({ ...debtPayForm, date: e.target.value })} />
                  </Field>
                  <Field label="Importe">
                    <Input type="number" value={debtPayForm.amount} onChange={e => setDebtPayForm({ ...debtPayForm, amount: e.target.value })} />
                  </Field>
                  <Field label="Persona">
                    <Select value={debtPayForm.person} onChange={v => setDebtPayForm({ ...debtPayForm, person: v })}>
                      {people.map(p => <option key={p} value={p}>{p}</option>)}
                    </Select>
                  </Field>
                  <Field label="Medio de pago">
                    <Select value={debtPayForm.paymentMethod} onChange={v => setDebtPayForm({ ...debtPayForm, paymentMethod: v })}>
                      {paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
                    </Select>
                  </Field>
                  <Field label="Notas" style={{ gridColumn: "span 2" }}>
                    <Input value={debtPayForm.notes} onChange={e => setDebtPayForm({ ...debtPayForm, notes: e.target.value })} placeholder="Opcional" />
                  </Field>
                </div>
                {selectedDebtForPay && (
                  <InfoBox color="green">
                    Saldo pendiente: <strong>{fmt(selectedDebtForPay.balance)}</strong> · Cuota: <strong>{fmt(selectedDebtForPay.installment)}</strong> · Al guardar, se genera un egreso automáticamente.
                  </InfoBox>
                )}
                <div style={{ marginTop: 12 }}>
                  <Btn onClick={registerDebtPayment} disabled={saving}>✔ Registrar pago</Btn>
                </div>
              </Card>
            </div>

            {/* Debt cards */}
            <div className="debt-cards">
              {debts.length === 0 && <EmptyState msg="No hay deudas cargadas." />}
              {debts.map(d => {
                const pct = d.totalPaid > 0 ? Math.min(100, (d.totalPaid / (d.totalPaid + d.balance)) * 100) : 0;
                return (
                  <Card key={d.id}>
                    <div className="debt-card-head">
                      <div>
                        <div className="fw">{d.name}</div>
                        <div className="muted small">{d.owner} · Prioridad {d.priority}</div>
                      </div>
                      <button className="del-btn" onClick={() => deleteDebt(d.id)}>🗑</button>
                    </div>
                    <div className="debt-amounts">
                      <div><span className="muted small">Saldo</span><div className="fw red">{fmt(d.balance)}</div></div>
                      <div><span className="muted small">Cuota</span><div>{fmt(d.installment)}</div></div>
                      <div><span className="muted small">Total pagado</span><div className="green">{fmt(d.totalPaid || 0)}</div></div>
                      <div><span className="muted small">Vence día</span><div>{d.dueDay || "—"}</div></div>
                    </div>
                    <Progress value={pct} />
                    <div className="muted small" style={{ marginTop: 4 }}>Cancelado: {pct.toFixed(1)}%</div>
                    {d.notes && <div className="muted small">Notas: {d.notes}</div>}
                  </Card>
                );
              })}
            </div>

            {/* Historial de pagos */}
            {debtPayments.length > 0 && (
              <Card>
                <CardHead title="Historial de pagos" icon="📋" />
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr><th>Fecha</th><th>Deuda</th><th>Persona</th><th>Medio</th><th>Importe</th><th>Notas</th></tr>
                    </thead>
                    <tbody>
                      {debtPayments.map(p => (
                        <tr key={p.id}>
                          <td>{p.date}</td>
                          <td>{debts.find(d => d.id === p.debtId)?.name || "—"}</td>
                          <td>{p.person}</td>
                          <td>{p.paymentMethod}</td>
                          <td className="number fw">{money(p.amount)}</td>
                          <td className="muted">{p.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ── METAS ── */}
        {tab === "metas" && (
          <div className="tab-content">
            <Card>
              <CardHead title="Agregar meta" icon="⭐" />
              <div className="form-grid three-col">
                <Field label="Nombre de la meta">
                  <Input value={goalForm.name} onChange={e => setGoalForm({ ...goalForm, name: e.target.value })} placeholder="Ej. Fondo de emergencia" />
                </Field>
                <Field label="Objetivo (ARS)">
                  <Input type="number" value={goalForm.target} onChange={e => setGoalForm({ ...goalForm, target: e.target.value })} />
                </Field>
                <Field label="Actual (ARS)">
                  <Input type="number" value={goalForm.current} onChange={e => setGoalForm({ ...goalForm, current: e.target.value })} />
                </Field>
              </div>
              <div style={{ marginTop: 12 }}>
                <Btn onClick={addGoal}>＋ Agregar meta</Btn>
              </div>
            </Card>

            <div className="two-col">
              {goals.length === 0 && <EmptyState msg="No hay metas cargadas." />}
              {goals.map(g => {
                const current = g.current_amount || g.current || 0;
                const target = g.target_amount || g.target || 1;
                const pct = Math.min(100, (current / target) * 100);
                return (
                  <Card key={g.id}>
                    <div className="debt-card-head">
                      <div>
                        <div className="fw">{g.name}</div>
                        <div className="muted small">{fmt(current)} de {fmt(target)}</div>
                      </div>
                      <button className="del-btn" onClick={() => deleteGoal(g.id)}>🗑</button>
                    </div>
                    <Progress value={pct} />
                    <div className="muted small" style={{ marginTop: 4 }}>{pct.toFixed(1)}% completado</div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* ── CONFIG ── */}
        {tab === "config" && (
          <div className="tab-content">
            <div className="two-col">
              <Card>
                <CardHead title="Catálogos" icon="⚙️" />

                <div className="catalog-section">
                  <label className="field-label">Personas</label>
                  <div className="catalog-add">
                    <Input value={catalogForm.person} onChange={e => setCatalogForm({ ...catalogForm, person: e.target.value })} placeholder="Nueva persona" />
                    <Btn small onClick={() => {
                      const v = catalogForm.person.trim();
                      if (v && !people.includes(v)) setPeople([...people, v]);
                      setCatalogForm({ ...catalogForm, person: "" });
                    }}>+ Agregar</Btn>
                  </div>
                  <div className="tag-list">
                    {people.map(p => (
                      <span key={p} className="tag">{p}
                        <button onClick={() => setPeople(people.filter(x => x !== p))}>×</button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="catalog-section">
                  <label className="field-label">Medios de pago</label>
                  <div className="catalog-add">
                    <Input value={catalogForm.paymentMethod} onChange={e => setCatalogForm({ ...catalogForm, paymentMethod: e.target.value })} placeholder="Nuevo medio" />
                    <Btn small onClick={() => {
                      const v = catalogForm.paymentMethod.trim();
                      if (v && !paymentMethods.includes(v)) setPaymentMethods([...paymentMethods, v]);
                      setCatalogForm({ ...catalogForm, paymentMethod: "" });
                    }}>+ Agregar</Btn>
                  </div>
                  <div className="tag-list">
                    {paymentMethods.map(m => (
                      <span key={m} className="tag">{m}
                        <button onClick={() => setPaymentMethods(paymentMethods.filter(x => x !== m))}>×</button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="catalog-section">
                  <label className="field-label">Tipos</label>
                  <div className="catalog-add">
                    <Input value={catalogForm.type} onChange={e => setCatalogForm({ ...catalogForm, type: e.target.value })} placeholder="Nuevo tipo" />
                    <Btn small onClick={() => {
                      const v = catalogForm.type.trim();
                      if (v && !types.includes(v)) { setTypes([...types, v]); setCategoryMap(prev => ({ ...prev, [v]: [] })); }
                      setCatalogForm({ ...catalogForm, type: "" });
                    }}>+ Agregar</Btn>
                  </div>
                  <div className="tag-list">
                    {types.map(t => (
                      <span key={t} className="tag">{t}
                        <button onClick={() => { setTypes(types.filter(x => x !== t)); setCategoryMap(prev => { const c = { ...prev }; delete c[t]; return c; }); }}>×</button>
                      </span>
                    ))}
                  </div>
                </div>
              </Card>

              <Card>
                <CardHead title="Categorías por tipo" icon="🏷" />
                <div className="catalog-section">
                  <label className="field-label">Agregar categoría</label>
                  <Field label="Tipo">
                    <Select value={catalogForm.categoryType} onChange={v => setCatalogForm({ ...catalogForm, categoryType: v })}>
                      {types.map(t => <option key={t} value={t}>{t}</option>)}
                    </Select>
                  </Field>
                  <div className="catalog-add" style={{ marginTop: 8 }}>
                    <Input value={catalogForm.category} onChange={e => setCatalogForm({ ...catalogForm, category: e.target.value })} placeholder="Nueva categoría" />
                    <Btn small onClick={() => {
                      const v = catalogForm.category.trim();
                      const t = catalogForm.categoryType;
                      if (v && !(categoryMap[t] || []).includes(v)) setCategoryMap(prev => ({ ...prev, [t]: [...(prev[t] || []), v] }));
                      setCatalogForm({ ...catalogForm, category: "" });
                    }}>+ Agregar</Btn>
                  </div>
                </div>
                {types.map(type => (
                  <div key={type} className="catalog-section">
                    <label className="field-label">{type}</label>
                    <div className="tag-list">
                      {(categoryMap[type] || []).map(c => (
                        <span key={c} className="tag">{c}
                          <button onClick={() => setCategoryMap(prev => ({ ...prev, [type]: prev[type].filter(x => x !== c) }))}>×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </Card>
            </div>

            {/* FX manual */}
            <Card>
              <CardHead title="Cotización manual" icon="💱" />
              <div className="form-grid three-col">
                <Field label="USD blue (ARS por dólar)">
                  <Input type="number" value={blueRate} onChange={e => setBlueRate(Number(e.target.value))} />
                </Field>
              </div>
              <div className="muted small" style={{ marginTop: 8 }}>La cotización online se actualiza al abrir la app. Podés corregirla manualmente aquí.</div>
            </Card>
          </div>
        )}

      </div>
    </div>
  );
}
