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
  { type: "Ingreso", name: "Sueldo", fv: "V" },
  { type: "Ingreso", name: "Freelance", fv: "V" },
  { type: "Ingreso", name: "Venta", fv: "V" },
  { type: "Ingreso", name: "Otros ingresos", fv: "V" },
  { type: "Egreso", name: "Supermercado", fv: "V" },
  { type: "Egreso", name: "Salud", fv: "V" },
  { type: "Egreso", name: "Salud mental", fv: "F" },
  { type: "Egreso", name: "Educación", fv: "F" },
  { type: "Egreso", name: "Transporte", fv: "V" },
  { type: "Egreso", name: "Servicios", fv: "F" },
  { type: "Egreso", name: "Alquiler", fv: "F" },
  { type: "Egreso", name: "Salidas", fv: "V" },
  { type: "Egreso", name: "Deuda", fv: "F" },
  { type: "Ahorro", name: "Fondo de emergencia", fv: "V" },
  { type: "Ahorro", name: "Ahorro USD", fv: "V" },
  { type: "Ahorro", name: "Caja ahorro", fv: "V" },
  { type: "Inversión", name: "FCI", fv: "V" },
  { type: "Inversión", name: "Acciones", fv: "V" },
  { type: "Inversión", name: "Cedears", fv: "V" },
  { type: "Inversión", name: "Cripto", fv: "V" },
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

const toArs = (amount, currency, rate) =>
  currency === "USD" ? Number(amount || 0) * Number(rate || 1) : Number(amount || 0);

const fromArs = (amountArs, currency, rate) =>
  currency === "USD" ? (rate > 0 ? amountArs / rate : 0) : amountArs;

const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);
const PALETTE = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2", "#ea580c", "#be185d"];

function buildCategoryMap(rows) {
  const map = {};
  rows.forEach((r) => {
    if (!r.active && r.active !== undefined) return;
    if (!map[r.type]) map[r.type] = [];
    if (!map[r.type].includes(r.name)) map[r.type].push(r.name);
  });
  return map;
}

function buildCategoryFV(rows) {
  const map = {};
  rows.forEach((r) => {
    if (!r.active && r.active !== undefined) return;
    map[`${r.type}__${r.name}`] = r.fv || "V";
  });
  return map;
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
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`btn btn-${variant}${small ? " btn-sm" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return <div className="field"><label className="field-label">{label}</label>{children}</div>;
}

function Input({ type = "text", value, onChange, placeholder, min, max, step, className = "" }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
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

function BarChart({ data, xKey, bars }) {
  if (!data || data.length === 0) return <EmptyState msg="Sin datos para mostrar" />;
  const W = 600, H = 280, PL = 70, PR = 20, PT = 20, PB = 60;
  const iW = W - PL - PR, iH = H - PT - PB;
  const allVals = data.flatMap((d) => bars.map((b) => Math.max(0, d[b.key] || 0)));
  const maxVal = Math.max(...allVals, 1);
  const slot = iW / Math.max(data.length, 1);
  const barW = Math.max(10, (slot * 0.75) / Math.max(bars.length, 1));
  const ticks = 5;

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
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

        {data.map((d, di) => {
          const cx = PL + di * slot + slot / 2;
          const totalBars = bars.length;
          return bars.map((b, bi) => {
            const val = Math.max(0, d[b.key] || 0);
            const bH = (val / maxVal) * iH;
            const x = cx - (barW * totalBars) / 2 + bi * barW;
            const y = PT + iH - bH;
            return <rect key={`${di}-${b.key}`} x={x} y={y} width={barW - 2} height={bH} fill={b.color} rx="4" />;
          });
        })}

        {data.map((d, di) => (
          <text key={di} x={PL + di * slot + slot / 2} y={H - PB + 18} textAnchor="middle" fontSize="10" fill="#64748b">
            {String(d[xKey]).slice(5) || d[xKey]}
          </text>
        ))}

        {bars.map((b, bi) => (
          <g key={b.key} transform={`translate(${PL + bi * 110}, ${H - 14})`}>
            <rect width="10" height="10" fill={b.color} rx="2" />
            <text x="14" y="9" fontSize="10" fill="#475569">{b.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function PieChart({ data, nameKey, valueKey }) {
  const total = data.reduce((a, b) => a + (b[valueKey] || 0), 0);
  if (total === 0) return <EmptyState msg="Sin datos para mostrar" />;

  const W = 320, H = 260, cx = 120, cy = 120, r = 100, ir = 50;
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
    const slice = { path, color: PALETTE[i % PALETTE.length], pct, name: d[nameKey], value: d[valueKey] };
    startAngle = endAngle;
    return slice;
  });

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth="2" />)}
        {slices.map((s, i) => (
          <g key={i} transform={`translate(250, ${20 + i * 22})`}>
            <rect width="12" height="12" fill={s.color} rx="2" />
            <text x="16" y="10" fontSize="10" fill="#1e293b">{s.name.length > 14 ? `${s.name.slice(0, 13)}…` : s.name}</text>
            <text x="16" y="20" fontSize="9" fill="#64748b">{(s.pct * 100).toFixed(1)}%</text>
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
  { id: "metas", label: "⭐ Metas" },
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
  const [blueUpdatedAt, setBlueUpdatedAt] = useState("");
  const [fxStatus, setFxStatus] = useState("idle");
  const [displayCurrency, setDisplayCurrency] = useState("ARS");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reportMonth, setReportMonth] = useState(currentMonth());
  const [filters, setFilters] = useState({ person: "all", type: "all", category: "all", month: currentMonth(), currency: "all", fv: "all" });

  const emptyMovForm = useCallback(() => ({
    date: today(),
    person: "Compartido",
    type: "",
    category: "",
    description: "",
    originalAmount: "",
    currency: "ARS",
    fxRate: blueRate,
    paymentMethod: paymentMethods[0] || "",
    linkedDebtId: "",
  }), [blueRate, paymentMethods]);

  const [movForm, setMovForm] = useState(emptyMovForm());
  const [debtForm, setDebtForm] = useState({ name: "", owner: "Compartido", balance: "", installment: "", dueDay: "", priority: "Media", rate: "", notes: "" });
  const [goalForm, setGoalForm] = useState({ name: "", target: "", current: "" });
  const [budgetForm, setBudgetForm] = useState({ month: currentMonth(), person: "Compartido", type: "Egreso", category: "Supermercado", planned: "" });
  const [debtPayForm, setDebtPayForm] = useState({ debtId: "", date: today(), amount: "", person: "Compartido", paymentMethod: "Banco", notes: "" });
  const [balanceForm, setBalanceForm] = useState({ month: currentMonth(), opening: "", notes: "" });
  const [catalogForm, setCatalogForm] = useState({ person: "", paymentMethod: "", type: "", categoryType: "Egreso", category: "", categoryFv: "V" });

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [movsRes, dbsRes, dpsRes, glsRes, bgsRes, mbsRes, catsRes, categoriesRes] = await Promise.all([
          supabase.from("movements").select("*").order("movement_date", { ascending: false }),
          supabase.from("debts").select("*").order("created_at", { ascending: false }),
          supabase.from("debt_payments").select("*").order("payment_date", { ascending: false }),
          supabase.from("goals").select("*").order("created_at", { ascending: false }),
          supabase.from("budgets").select("*").order("created_at", { ascending: false }),
          supabase.from("monthly_balances").select("*").order("balance_month", { ascending: false }),
          supabase.from("settings_catalog").select("*").order("created_at"),
          supabase.from("categories").select("*").eq("active", true).order("type").order("name"),
        ]);

        const { data: movs } = movsRes;
        const { data: dbs } = dbsRes;
        const { data: dps } = dpsRes;
        const { data: gls } = glsRes;
        const { data: bgs } = bgsRes;
        const { data: mbs } = mbsRes;
        const { data: cats } = catsRes;
        const { data: categoriesData, error: categoriesError } = categoriesRes;

        if (movs) setMovements(movs.map((m) => ({ id: m.id, date: m.movement_date, person: m.person, type: m.type, category: m.category, description: m.description, originalAmount: m.original_amount, currency: m.original_currency, fxRate: m.fx_rate, amountArs: m.amount_ars, amountUsd: m.amount_usd, paymentMethod: m.payment_method, linkedDebtId: m.linked_debt_id })));
        if (dbs) setDebts(dbs.map((d) => ({ id: d.id, name: d.name, owner: d.owner, balance: d.current_balance, initialBalance: d.initial_balance, installment: d.installment_amount, dueDay: d.due_day, priority: d.priority, rate: d.rate, notes: d.notes, totalPaid: d.total_paid, status: d.status })));
        if (dps) setDebtPayments(dps.map((p) => ({ id: p.id, debtId: p.debt_id, date: p.payment_date, amount: p.amount_ars, person: p.person, paymentMethod: p.payment_method, notes: p.notes })));
        if (gls) setGoals(gls);
        if (bgs) setBudgets(bgs.map((b) => ({ id: b.id, month: b.budget_month, person: b.person, type: b.type, category: b.category, planned: b.planned_amount_ars })));
        if (mbs) setMonthlyBalances(mbs);

        if (cats && cats.length > 0) {
          const newPeople = cats.filter((c) => c.catalog_type === "person").map((c) => c.value);
          const newPMs = cats.filter((c) => c.catalog_type === "payment_method").map((c) => c.value);
          const newTypes = cats.filter((c) => c.catalog_type === "type").map((c) => c.value);
          if (newPeople.length) setPeople(newPeople);
          if (newPMs.length) setPaymentMethods(newPMs);
          if (newTypes.length) setTypes(newTypes);
        }

        if (!categoriesError && categoriesData && categoriesData.length > 0) {
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
      } catch {
        setFxStatus("error");
      }
    }
    fetchBlue();
  }, []);

  const fmt = useCallback((ars) => money(fromArs(ars, displayCurrency, blueRate), displayCurrency), [displayCurrency, blueRate]);
  const getFV = useCallback((type, category) => categoryFVMap[`${type}__${category}`] || "V", [categoryFVMap]);

  async function addMovement() {
    if (!movForm.category || !movForm.originalAmount || !movForm.person || !movForm.type) return;
    setSaving(true);
    const rate = movForm.currency === "USD" ? blueRate : 1;
    const amountArs = toArs(movForm.originalAmount, movForm.currency, rate);
    const amountUsd = movForm.currency === "USD" ? Number(movForm.originalAmount) : amountArs / blueRate;
    const selectedDebt = debts.find((d) => String(d.id) === String(movForm.linkedDebtId));

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
    const { data, error } = await supabase.from("debts").insert([{ name: debtForm.name, owner: debtForm.owner, initial_balance: bal, current_balance: bal, installment_amount: Number(debtForm.installment || 0), due_day: Number(debtForm.dueDay || 0), priority: debtForm.priority, rate: Number(debtForm.rate || 0), notes: debtForm.notes || null, total_paid: 0, status: "Activa" }]).select().single();
    if (!error && data) setDebts((prev) => [{ id: data.id, name: data.name, owner: data.owner, balance: data.current_balance, initialBalance: data.initial_balance, installment: data.installment_amount, dueDay: data.due_day, priority: data.priority, rate: data.rate, notes: data.notes, totalPaid: data.total_paid, status: data.status }, ...prev]);
    setDebtForm({ name: "", owner: "Compartido", balance: "", installment: "", dueDay: "", priority: "Media", rate: "", notes: "" });
    setSaving(false);
  }

  async function deleteDebt(id) {
    await supabase.from("debts").delete().eq("id", id);
    setDebts((prev) => prev.filter((d) => d.id !== id));
  }

  async function registerDebtPayment() {
    const debt = debts.find((d) => String(d.id) === String(debtPayForm.debtId));
    if (!debt || !debtPayForm.amount) return;
    setSaving(true);
    const amount = Math.min(Number(debtPayForm.amount), debt.balance);
    if (amount <= 0) {
      setSaving(false);
      return;
    }

    const newBalance = Math.max(0, debt.balance - amount);
    const newPaid = (debt.totalPaid || 0) + amount;
    await supabase.from("debts").update({ current_balance: newBalance, total_paid: newPaid }).eq("id", debt.id);
    const { data: dp } = await supabase.from("debt_payments").insert([{ debt_id: debt.id, payment_date: debtPayForm.date, amount_ars: amount, person: debtPayForm.person, payment_method: debtPayForm.paymentMethod, notes: debtPayForm.notes || null }]).select().single();
    const { data: mov } = await supabase.from("movements").insert([{ movement_date: debtPayForm.date, person: debtPayForm.person, type: "Egreso", category: "Deuda", description: `Pago deuda - ${debt.name}`, original_currency: "ARS", original_amount: amount, fx_rate: 1, amount_ars: amount, amount_usd: amount / blueRate, payment_method: debtPayForm.paymentMethod, linked_debt_id: debt.id }]).select().single();

    setDebts((prev) => prev.map((d) => d.id === debt.id ? { ...d, balance: newBalance, totalPaid: newPaid } : d));
    if (dp) setDebtPayments((prev) => [{ id: dp.id, debtId: dp.debt_id, date: dp.payment_date, amount: dp.amount_ars, person: dp.person, paymentMethod: dp.payment_method, notes: dp.notes }, ...prev]);
    if (mov) setMovements((prev) => [{ id: mov.id, date: mov.movement_date, person: mov.person, type: mov.type, category: mov.category, description: mov.description, originalAmount: mov.original_amount, currency: mov.original_currency, fxRate: mov.fx_rate, amountArs: mov.amount_ars, amountUsd: mov.amount_usd, paymentMethod: mov.payment_method, linkedDebtId: mov.linked_debt_id }, ...prev]);
    setDebtPayForm({ debtId: "", date: today(), amount: "", person: "Compartido", paymentMethod: "Banco", notes: "" });
    setSaving(false);
  }

  async function addGoal() {
    if (!goalForm.name || !goalForm.target) return;
    const { data } = await supabase.from("goals").insert([{ name: goalForm.name, target_amount: Number(goalForm.target), current_amount: Number(goalForm.current || 0) }]).select().single();
    if (data) setGoals((prev) => [data, ...prev]);
    setGoalForm({ name: "", target: "", current: "" });
  }

  async function deleteGoal(id) {
    await supabase.from("goals").delete().eq("id", id);
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }

  async function addBudget() {
    if (!budgetForm.month || !budgetForm.person || !budgetForm.type || !budgetForm.category || !budgetForm.planned) return;
    const { data } = await supabase.from("budgets").insert([{ budget_month: budgetForm.month, person: budgetForm.person, type: budgetForm.type, category: budgetForm.category, planned_amount_ars: Number(budgetForm.planned) }]).select().single();
    if (data) setBudgets((prev) => [{ id: data.id, month: data.budget_month, person: data.person, type: data.type, category: data.category, planned: data.planned_amount_ars }, ...prev]);
    setBudgetForm({ month: currentMonth(), person: "Compartido", type: "Egreso", category: (categoryMap["Egreso"] || [])[0] || "", planned: "" });
  }

  async function deleteBudget(id) {
    await supabase.from("budgets").delete().eq("id", id);
    setBudgets((prev) => prev.filter((b) => b.id !== id));
  }

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
    const fv = catalogForm.categoryFv;
    if (!type || !name) return;
    if ((categoryMap[type] || []).includes(name)) {
      alert("Esa categoría ya existe.");
      return;
    }
    const { data, error } = await supabase.from("categories").insert([{ type, name, fv, active: true }]).select().single();
    if (error) {
      console.error(error);
      alert("No se pudo guardar la categoría.");
      return;
    }
    const nextRows = [...categoryRows, { id: data.id, type: data.type, name: data.name, fv: data.fv, active: data.active }];
    setCategoryRows(nextRows);
    setCategoryMap(buildCategoryMap(nextRows));
    setCategoryFVMap(buildCategoryFV(nextRows));
    setCatalogForm((prev) => ({ ...prev, category: "", categoryFv: "V" }));
  }

  async function toggleCategoryFV(row) {
    const newFv = row.fv === "F" ? "V" : "F";
    const { error } = await supabase.from("categories").update({ fv: newFv }).eq("id", row.id);
    if (error) {
      console.error(error);
      alert("No se pudo actualizar F/V.");
      return;
    }
    const nextRows = categoryRows.map((r) => r.id === row.id ? { ...r, fv: newFv } : r);
    setCategoryRows(nextRows);
    setCategoryMap(buildCategoryMap(nextRows));
    setCategoryFVMap(buildCategoryFV(nextRows));
  }

  async function removeCategory(row) {
    const used = movements.some((m) => m.type === row.type && m.category === row.name);
    if (used) {
      alert("No se puede eliminar porque ya tiene movimientos cargados.");
      return;
    }
    const { error } = await supabase.from("categories").update({ active: false }).eq("id", row.id);
    if (error) {
      console.error(error);
      alert("No se pudo eliminar la categoría.");
      return;
    }
    const nextRows = categoryRows.filter((r) => r.id !== row.id);
    setCategoryRows(nextRows);
    setCategoryMap(buildCategoryMap(nextRows));
    setCategoryFVMap(buildCategoryFV(nextRows));
  }

  const summary = useMemo(() => {
    const income = movements.filter((m) => m.type === "Ingreso").reduce((a, b) => a + b.amountArs, 0);
    const expenses = movements.filter((m) => m.type === "Egreso").reduce((a, b) => a + b.amountArs, 0);
    const savings = movements.filter((m) => m.type === "Ahorro").reduce((a, b) => a + b.amountArs, 0);
    const investments = movements.filter((m) => m.type === "Inversión").reduce((a, b) => a + b.amountArs, 0);
    const totalDebt = debts.reduce((a, b) => a + b.balance, 0);
    const net = income - expenses - savings - investments;
    return { income, expenses, savings, investments, totalDebt, net };
  }, [movements, debts]);

  const monthBalance = useMemo(() => {
    const rec = monthlyBalances.find((b) => b.balance_month === reportMonth);
    const opening = rec?.opening_balance_ars || 0;
    const inc = movements.filter((m) => m.type === "Ingreso" && monthKey(m.date) === reportMonth).reduce((a, b) => a + b.amountArs, 0);
    const exp = movements.filter((m) => m.type === "Egreso" && monthKey(m.date) === reportMonth).reduce((a, b) => a + b.amountArs, 0);
    const sav = movements.filter((m) => m.type === "Ahorro" && monthKey(m.date) === reportMonth).reduce((a, b) => a + b.amountArs, 0);
    const inv = movements.filter((m) => m.type === "Inversión" && monthKey(m.date) === reportMonth).reduce((a, b) => a + b.amountArs, 0);
    const closing = opening + inc - exp - sav - inv;
    return { opening, inc, exp, sav, inv, closing };
  }, [movements, monthlyBalances, reportMonth]);

  const monthlyKpis = useMemo(() => {
    const monthMovs = movements.filter((m) => monthKey(m.date) === reportMonth);
    const income = monthMovs.filter((m) => m.type === "Ingreso").reduce((a, b) => a + b.amountArs, 0);
    const egresos = monthMovs.filter((m) => m.type === "Egreso");
    const fixed = egresos.filter((m) => getFV(m.type, m.category) === "F").reduce((a, b) => a + b.amountArs, 0);
    const variable = egresos.filter((m) => getFV(m.type, m.category) !== "F").reduce((a, b) => a + b.amountArs, 0);
    const contribution = income - variable;
    const contributionMargin = income > 0 ? contribution / income : 0;
    const breakEven = contributionMargin > 0 ? fixed / contributionMargin : 0;
    const liquidity = fixed > 0 ? monthBalance.closing / fixed : 0;
    return {
      income,
      fixed,
      variable,
      contributionMargin,
      breakEven,
      liquidity,
      fixedPct: income > 0 ? fixed / income : 0,
      variablePct: income > 0 ? variable / income : 0,
      savingsPotential: income - fixed,
      operationalResult: income - fixed - variable,
    };
  }, [movements, reportMonth, monthBalance.closing, getFV]);

  const annualByMonth = useMemo(() => {
    const bucket = {};
    movements.forEach((m) => {
      const k = monthKey(m.date);
      if (!bucket[k]) bucket[k] = { month: k, income: 0, expenses: 0, fixed: 0, variable: 0 };
      if (m.type === "Ingreso") bucket[k].income += fromArs(m.amountArs, displayCurrency, blueRate);
      if (m.type === "Egreso") {
        bucket[k].expenses += fromArs(m.amountArs, displayCurrency, blueRate);
        if (getFV(m.type, m.category) === "F") bucket[k].fixed += fromArs(m.amountArs, displayCurrency, blueRate);
        else bucket[k].variable += fromArs(m.amountArs, displayCurrency, blueRate);
      }
    });
    return Object.values(bucket).sort((a, b) => a.month.localeCompare(b.month));
  }, [movements, displayCurrency, blueRate, getFV]);

  const monthlyByCategory = useMemo(() => {
    const bucket = {};
    movements.filter((m) => m.type === "Egreso" && monthKey(m.date) === reportMonth).forEach((m) => {
      bucket[m.category] = (bucket[m.category] || 0) + fromArs(m.amountArs, displayCurrency, blueRate);
    });
    return Object.entries(bucket).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
  }, [movements, reportMonth, displayCurrency, blueRate]);

  const monthlyByPerson = useMemo(() => {
    const bucket = {};
    movements.filter((m) => m.type === "Egreso" && monthKey(m.date) === reportMonth).forEach((m) => {
      bucket[m.person] = (bucket[m.person] || 0) + fromArs(m.amountArs, displayCurrency, blueRate);
    });
    return Object.entries(bucket).map(([person, total]) => ({ person, total })).sort((a, b) => b.total - a.total);
  }, [movements, reportMonth, displayCurrency, blueRate]);

  const monthlyFixedVariable = useMemo(() => {
    const fixed = movements.filter((m) => m.type === "Egreso" && monthKey(m.date) === reportMonth && getFV(m.type, m.category) === "F").reduce((a, b) => a + fromArs(b.amountArs, displayCurrency, blueRate), 0);
    const variable = movements.filter((m) => m.type === "Egreso" && monthKey(m.date) === reportMonth && getFV(m.type, m.category) !== "F").reduce((a, b) => a + fromArs(b.amountArs, displayCurrency, blueRate), 0);
    return [{ name: "Fijos", total: fixed }, { name: "Variables", total: variable }];
  }, [movements, reportMonth, displayCurrency, blueRate, getFV]);

  const budgetComparison = useMemo(() => {
    return budgets.filter((b) => b.month === reportMonth).map((b) => {
      const actual = movements.filter((m) => monthKey(m.date) === b.month && m.person === b.person && m.type === b.type && m.category === b.category).reduce((a, c) => a + c.amountArs, 0);
      const execution = b.planned > 0 ? (actual / b.planned) * 100 : 0;
      return { ...b, actual, difference: b.planned - actual, execution };
    });
  }, [budgets, movements, reportMonth]);

  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      if (filters.person !== "all" && m.person !== filters.person) return false;
      if (filters.type !== "all" && m.type !== filters.type) return false;
      if (filters.category !== "all" && m.category !== filters.category) return false;
      if (filters.currency !== "all" && m.currency !== filters.currency) return false;
      if (filters.month && monthKey(m.date) !== filters.month) return false;
      if (filters.fv !== "all" && m.type === "Egreso" && getFV(m.type, m.category) !== filters.fv) return false;
      if (filters.fv !== "all" && m.type !== "Egreso") return false;
      return true;
    });
  }, [movements, filters, getFV]);

  function exportCSV() {
    const headers = ["Fecha","Persona","Tipo","Categoría","F/V","Descripción","Moneda","Importe original","TC","Importe ARS","Importe USD","Medio de pago"];
    const rows = filteredMovements.map((m) => [m.date, m.person, m.type, m.category, m.type === "Egreso" ? getFV(m.type, m.category) : "", m.description || "", m.currency, m.originalAmount, m.fxRate, m.amountArs.toFixed(2), (m.amountUsd || 0).toFixed(2), m.paymentMethod]);
    const csv = [headers, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `movimientos_${filters.month || "todos"}.csv`;
    a.click();
  }

  const selectedDebtForMov = debts.find((d) => String(d.id) === String(movForm.linkedDebtId));
  const selectedDebtForPay = debts.find((d) => String(d.id) === String(debtPayForm.debtId));

  if (loading) return <div className="loading-screen"><Spinner /><p>Cargando datos…</p></div>;

  return (
    <div className="app-shell">
      <div className="app-container">
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

        <div className="tabs-scroll"><div className="tabs-list">{TABS.map((t) => <button key={t.id} onClick={() => setTab(t.id)} className={`tab-btn${tab === t.id ? " active" : ""}`}>{t.label}</button>)}</div></div>

        {tab === "cargar" && (
          <div className="tab-content">
            <Card>
              <CardHead title="Carga rápida" icon="📥" />
              <div className="form-grid">
                <Field label="Fecha"><Input type="date" value={movForm.date} onChange={(e) => setMovForm({ ...movForm, date: e.target.value })} /></Field>
                <Field label="Persona"><Select value={movForm.person} onChange={(v) => setMovForm({ ...movForm, person: v })}>{people.map((p) => <option key={p} value={p}>{p}</option>)}</Select></Field>
                <Field label="Tipo"><Select value={movForm.type} onChange={(v) => setMovForm({ ...movForm, type: v, category: "", linkedDebtId: "" })}><option value="">Seleccionar…</option>{types.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
                <Field label="Categoría"><Select value={movForm.category} onChange={(v) => setMovForm({ ...movForm, category: v, linkedDebtId: v !== "Deuda" ? "" : movForm.linkedDebtId })} disabled={!movForm.type}><option value="">Seleccionar…</option>{(categoryMap[movForm.type] || []).map((c) => <option key={c} value={c}>{c}{movForm.type === "Egreso" ? ` · ${getFV(movForm.type, c)}` : ""}</option>)}</Select></Field>
                {movForm.type === "Egreso" && movForm.category === "Deuda" && <Field label="Deuda"><Select value={movForm.linkedDebtId} onChange={(v) => setMovForm({ ...movForm, linkedDebtId: v, originalAmount: debts.find((d) => String(d.id) === String(v))?.installment || "" })}><option value="">Elegir deuda…</option>{debts.map((d) => <option key={d.id} value={String(d.id)}>{d.name} ({fmt(d.balance)} pendiente)</option>)}</Select></Field>}
                <Field label="Moneda"><Select value={movForm.currency} onChange={(v) => setMovForm({ ...movForm, currency: v })}><option value="ARS">Pesos (ARS)</option><option value="USD">Dólar blue (USD)</option></Select></Field>
                <Field label={`Importe${movForm.currency === "USD" ? " (USD)" : " (ARS)"}`}><Input type="number" value={movForm.originalAmount} onChange={(e) => setMovForm({ ...movForm, originalAmount: e.target.value })} placeholder="0" /></Field>
                <Field label="Medio de pago"><Select value={movForm.paymentMethod} onChange={(v) => setMovForm({ ...movForm, paymentMethod: v })}>{paymentMethods.map((m) => <option key={m} value={m}>{m}</option>)}</Select></Field>
                <Field label="Descripción"><Input value={movForm.description} onChange={(e) => setMovForm({ ...movForm, description: e.target.value })} placeholder="Detalle opcional" /></Field>
              </div>

              {movForm.type === "Egreso" && movForm.category && <InfoBox color="green">Esta categoría está clasificada como <strong>{getFV("Egreso", movForm.category)}</strong>.</InfoBox>}
              {selectedDebtForMov && movForm.category === "Deuda" && <InfoBox color="blue">Cuota sugerida: <strong>{fmt(selectedDebtForMov.installment)}</strong> · Saldo pendiente: <strong>{fmt(selectedDebtForMov.balance)}</strong> · Al guardar, se actualiza el saldo de la deuda.</InfoBox>}
              {movForm.currency === "USD" && <InfoBox color="amber">Cotización blue actual: <strong>{money(blueRate)} por USD</strong> · Importe en ARS: <strong>{money(toArs(movForm.originalAmount || 0, "USD", blueRate))}</strong></InfoBox>}
              <div style={{ marginTop: 16 }}><Btn onClick={addMovement} disabled={saving || !movForm.type || !movForm.category || !movForm.originalAmount}>{saving ? "Guardando…" : "＋ Agregar movimiento"}</Btn></div>
            </Card>
          </div>
        )}

        {tab === "dashboard" && (
          <div className="tab-content">
            <div className="fx-bar"><span>💱 USD blue: <strong>{money(blueRate)}</strong></span>{blueUpdatedAt && <span className="muted">Actualizado: {new Date(blueUpdatedAt).toLocaleString("es-AR")}</span>}<Badge color={fxStatus === "ok" ? "green" : fxStatus === "loading" ? "amber" : "red"}>{fxStatus === "ok" ? "Cotización online" : fxStatus === "loading" ? "Actualizando…" : "Valor manual"}</Badge></div>
            <Card><CardHead title="Mes analizado" icon="📅" /><div className="form-grid three-col"><Field label="Mes"><Input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} /></Field><Field label="Visualización"><Select value={displayCurrency} onChange={setDisplayCurrency}><option value="ARS">Pesos</option><option value="USD">USD</option></Select></Field><Field label="Clasificación base"><Input value="F / V por categoría" onChange={() => {}} className="control" /></Field></div></Card>

            <div className="stats-grid">{[
              { label: "Ingresos", value: monthlyKpis.income, icon: "💵", color: "green" },
              { label: "Gastos fijos", value: monthlyKpis.fixed, icon: "🏠", color: "red" },
              { label: "Gastos variables", value: monthlyKpis.variable, icon: "🛒", color: "amber" },
              { label: "P. equilibrio", value: monthlyKpis.breakEven, icon: "🎯", color: "purple" },
              { label: "Liquidez", value: monthlyKpis.liquidity, icon: "💧", color: monthlyKpis.liquidity >= 1 ? "green" : "red", suffix: "x" },
              { label: "Resultado", value: monthlyKpis.operationalResult, icon: "⚖️", color: monthlyKpis.operationalResult >= 0 ? "green" : "red" },
            ].map((s) => <div key={s.label} className={`stat-card stat-${s.color}`}><div className="stat-icon">{s.icon}</div><div className="stat-label">{s.label}</div><div className="stat-value">{s.suffix ? `${s.value.toFixed(2)}${s.suffix}` : fmt(s.value)}</div></div>)}</div>

            <div className="two-col">
              <Card><CardHead title={`Saldo del mes · ${reportMonth}`} icon="📅" /><div className="balance-grid"><div className="balance-row"><span>Saldo inicial</span><strong>{fmt(monthBalance.opening)}</strong></div><div className="balance-row green"><span>＋ Ingresos</span><strong>{fmt(monthBalance.inc)}</strong></div><div className="balance-row red"><span>− Egresos</span><strong>{fmt(monthBalance.exp)}</strong></div><div className="balance-row amber"><span>− Ahorro</span><strong>{fmt(monthBalance.sav)}</strong></div><div className="balance-row purple"><span>− Inversión</span><strong>{fmt(monthBalance.inv)}</strong></div><div className="balance-row total"><span>= Saldo final</span><strong>{fmt(monthBalance.closing)}</strong></div></div></Card>
              <Card><CardHead title="KPIs derivados" icon="🧮" /><div className="balance-grid"><div className="balance-row"><span>% fijos / ingresos</span><strong>{(monthlyKpis.fixedPct * 100).toFixed(1)}%</strong></div><div className="balance-row"><span>% variables / ingresos</span><strong>{(monthlyKpis.variablePct * 100).toFixed(1)}%</strong></div><div className="balance-row"><span>Margen de contribución</span><strong>{(monthlyKpis.contributionMargin * 100).toFixed(1)}%</strong></div><div className="balance-row"><span>Ahorro potencial</span><strong>{fmt(monthlyKpis.savingsPotential)}</strong></div><div className="balance-row total"><span>Deuda total</span><strong>{fmt(summary.totalDebt)}</strong></div></div></Card>
            </div>

            <div className="two-col"><Card><CardHead title="Ingresos vs Fijos vs Variables" icon="📊" /><BarChart data={annualByMonth} xKey="month" bars={[{ key: "income", label: "Ingresos", color: "#16a34a" },{ key: "fixed", label: "Fijos", color: "#dc2626" },{ key: "variable", label: "Variables", color: "#f59e0b" }]} /></Card><Card><CardHead title={`Composición del gasto · ${reportMonth}`} icon="🥧" /><PieChart data={monthlyFixedVariable} nameKey="name" valueKey="total" /></Card></div>

            {debts.length > 0 && <Card><CardHead title="Próximos vencimientos" icon="📆" /><div className="debt-list">{debts.slice().sort((a, b) => a.dueDay - b.dueDay).slice(0, 4).map((d) => <div key={d.id} className="debt-mini"><div><div className="fw">{d.name}</div><div className="muted small">{d.owner} · Prioridad {d.priority}</div></div><div className="text-right"><div className="fw">{fmt(d.installment)}</div><div className="muted small">Día {d.dueDay}</div></div></div>)}</div></Card>}
          </div>
        )}

        {tab === "datos" && (
          <div className="tab-content">
            <Card><CardHead title="Filtros" icon="🔍" /><div className="filter-grid"><Field label="Mes"><Input type="month" value={filters.month} onChange={(e) => setFilters({ ...filters, month: e.target.value })} /></Field><Field label="Persona"><Select value={filters.person} onChange={(v) => setFilters({ ...filters, person: v })}><option value="all">Todas</option>{people.map((p) => <option key={p} value={p}>{p}</option>)}</Select></Field><Field label="Tipo"><Select value={filters.type} onChange={(v) => setFilters({ ...filters, type: v, category: "all", fv: v === "Egreso" ? filters.fv : "all" })}><option value="all">Todos</option>{types.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field><Field label="Categoría"><Select value={filters.category} onChange={(v) => setFilters({ ...filters, category: v })}><option value="all">Todas</option>{Object.values(categoryMap).flat().map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field><Field label="Moneda"><Select value={filters.currency} onChange={(v) => setFilters({ ...filters, currency: v })}><option value="all">Todas</option><option value="ARS">ARS</option><option value="USD">USD</option></Select></Field><Field label="F/V"><Select value={filters.fv} onChange={(v) => setFilters({ ...filters, fv: v })}><option value="all">Todos</option><option value="F">Fijos</option><option value="V">Variables</option></Select></Field></div><div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}><Btn onClick={exportCSV} variant="outline">⬇ Exportar CSV</Btn><span className="muted small" style={{ alignSelf: "center" }}>{filteredMovements.length} registros</span></div></Card>

            <Card><div className="table-wrap"><table className="data-table"><thead><tr><th>Fecha</th><th>Persona</th><th>Tipo</th><th>Categoría</th><th>F/V</th><th>Descripción</th><th>Moneda</th><th>Original</th><th>TC</th><th>ARS</th><th>USD</th><th>Medio</th><th></th></tr></thead><tbody>{filteredMovements.map((m) => <tr key={m.id}><td>{m.date}</td><td>{m.person}</td><td><Badge color={m.type === "Ingreso" ? "green" : m.type === "Egreso" ? "red" : m.type === "Ahorro" ? "blue" : "purple"}>{m.type}</Badge></td><td>{m.category}</td><td>{m.type === "Egreso" ? <Badge color={getFV(m.type, m.category) === "F" ? "red" : "amber"}>{getFV(m.type, m.category)}</Badge> : "—"}</td><td className="muted">{m.description || "—"}</td><td>{m.currency}</td><td className="number">{money(m.originalAmount, m.currency)}</td><td className="number muted">{m.fxRate !== 1 ? money(m.fxRate) : "—"}</td><td className="number fw">{money(m.amountArs)}</td><td className="number muted">{money(m.amountUsd || 0, "USD")}</td><td>{m.paymentMethod}</td><td><button className="del-btn" onClick={() => deleteMovement(m.id)} title="Eliminar">🗑</button></td></tr>)}</tbody></table>{filteredMovements.length === 0 && <EmptyState msg="No hay movimientos con esos filtros." />}</div>
              <div className="cards-mobile">{filteredMovements.map((m) => <div key={m.id} className="mov-card"><div className="mov-card-head"><div><div className="fw">{m.category} · {m.description || "Sin detalle"}</div><div className="muted small">{m.date} · {m.person} · {m.paymentMethod}</div></div><button className="del-btn" onClick={() => deleteMovement(m.id)}>🗑</button></div><div className="mov-card-amounts"><div><span className="muted small">ARS</span><div className="fw">{money(m.amountArs)}</div></div><div><span className="muted small">USD</span><div className="fw">{money(m.amountUsd || 0, "USD")}</div></div><div><span className="muted small">Original</span><div>{money(m.originalAmount, m.currency)}</div></div><div><span className="muted small">F/V</span><div>{m.type === "Egreso" ? getFV(m.type, m.category) : "—"}</div></div></div><Badge color={m.type === "Ingreso" ? "green" : m.type === "Egreso" ? "red" : "blue"}>{m.type}</Badge></div>)}{filteredMovements.length === 0 && <EmptyState msg="No hay movimientos con esos filtros." />}</div></Card>
          </div>
        )}

        {tab === "presupuesto" && (
          <div className="tab-content">
            <Card><CardHead title="Saldo inicial del mes" icon="🏦" /><div className="form-grid three-col"><Field label="Mes"><Input type="month" value={balanceForm.month} onChange={(e) => setBalanceForm({ ...balanceForm, month: e.target.value })} /></Field><Field label="Saldo inicial (ARS)"><Input type="number" value={balanceForm.opening} onChange={(e) => setBalanceForm({ ...balanceForm, opening: e.target.value })} placeholder="0" /></Field><Field label="Notas"><Input value={balanceForm.notes} onChange={(e) => setBalanceForm({ ...balanceForm, notes: e.target.value })} placeholder="Opcional" /></Field></div><div style={{ marginTop: 12 }}><Btn onClick={saveBalance}>Guardar saldo inicial</Btn></div></Card>
            <Card><CardHead title="Agregar presupuesto" icon="🎯" /><div className="form-grid"><Field label="Mes"><Input type="month" value={budgetForm.month} onChange={(e) => setBudgetForm({ ...budgetForm, month: e.target.value })} /></Field><Field label="Persona"><Select value={budgetForm.person} onChange={(v) => setBudgetForm({ ...budgetForm, person: v })}>{people.map((p) => <option key={p} value={p}>{p}</option>)}</Select></Field><Field label="Tipo"><Select value={budgetForm.type} onChange={(v) => setBudgetForm({ ...budgetForm, type: v, category: (categoryMap[v] || [])[0] || "" })}>{types.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field><Field label="Categoría"><Select value={budgetForm.category} onChange={(v) => setBudgetForm({ ...budgetForm, category: v })}>{(categoryMap[budgetForm.type] || []).map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field><Field label="Importe presupuestado"><Input type="number" value={budgetForm.planned} onChange={(e) => setBudgetForm({ ...budgetForm, planned: e.target.value })} placeholder="0" /></Field></div><div style={{ marginTop: 12 }}><Btn onClick={addBudget}>＋ Agregar presupuesto</Btn></div></Card>
            <Card><CardHead title="Presupuesto vs Real" icon="📊" /><div style={{ marginBottom: 14 }}><Field label="Mes a analizar"><Input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="w-auto" /></Field></div>{budgetComparison.length === 0 && <EmptyState msg="No hay presupuestos para este mes." />}{budgetComparison.map((b) => { const over = b.execution > 100; const warn = b.execution >= 85; return <div key={b.id} className={`budget-row ${over ? "budget-over" : warn ? "budget-warn" : "budget-ok"}`}><div className="budget-row-head"><div><div className="fw">{over ? "⚠️ " : ""}{b.category}</div><div className="muted small">{b.month} · {b.person} · {b.type}{b.type === "Egreso" ? ` · ${getFV(b.type, b.category)}` : ""}</div></div><div style={{ display: "flex", gap: 8, alignItems: "center" }}><Badge color={over ? "red" : warn ? "amber" : "green"}>{b.execution.toFixed(1)}%</Badge><button className="del-btn" onClick={() => deleteBudget(b.id)}>🗑</button></div></div><div className="budget-amounts"><div><span className="muted small">Presupuesto</span><div>{fmt(b.planned)}</div></div><div><span className="muted small">Real</span><div className={b.actual > b.planned ? "red" : ""}>{fmt(b.actual)}</div></div><div><span className="muted small">Diferencia</span><div className={b.difference < 0 ? "red" : "green"}>{fmt(b.difference)}</div></div><div><span className="muted small">Estado</span><div>{over ? "Excedido" : warn ? "Al límite" : "Dentro"}</div></div></div><Progress value={b.execution} /></div>; })}</Card>
          </div>
        )}

        {tab === "reportes" && (
          <div className="tab-content"><div className="two-col"><Card><CardHead title={`Top categorías · ${reportMonth}`} icon="📂" />{monthlyByCategory.length === 0 && <EmptyState msg="Sin egresos para ese mes." />}{monthlyByCategory.map((r) => <div key={r.category} className="report-row"><div><div className="fw">{r.category}</div><div className="muted small">{getFV("Egreso", r.category) === "F" ? "Fijo" : "Variable"}</div></div><strong>{fmt(r.total)}</strong></div>)}</Card><Card><CardHead title={`Gasto por persona · ${reportMonth}`} icon="👥" />{monthlyByPerson.length === 0 && <EmptyState msg="Sin egresos para ese mes." />}{monthlyByPerson.map((r) => <div key={r.person} className="report-row"><span>{r.person}</span><strong>{fmt(r.total)}</strong></div>)}</Card></div><div className="two-col"><Card><CardHead title="Tendencia mensual" icon="📈" /><BarChart data={annualByMonth} xKey="month" bars={[{ key: "income", label: "Ingresos", color: "#16a34a" }, { key: "expenses", label: "Egresos", color: "#dc2626" }]} /></Card><Card><CardHead title="Fijos vs Variables" icon="🧩" /><BarChart data={annualByMonth} xKey="month" bars={[{ key: "fixed", label: "Fijos", color: "#dc2626" }, { key: "variable", label: "Variables", color: "#f59e0b" }]} /></Card></div></div>
        )}

        {tab === "deudas" && (
          <div className="tab-content"><div className="two-col"><Card><CardHead title="Agregar deuda" icon="💳" /><div className="form-grid two-col-form"><Field label="Nombre"><Input value={debtForm.name} onChange={(e) => setDebtForm({ ...debtForm, name: e.target.value })} placeholder="Ej. Tarjeta Visa" /></Field><Field label="Responsable"><Select value={debtForm.owner} onChange={(v) => setDebtForm({ ...debtForm, owner: v })}>{people.map((p) => <option key={p} value={p}>{p}</option>)}</Select></Field><Field label="Saldo actual"><Input type="number" value={debtForm.balance} onChange={(e) => setDebtForm({ ...debtForm, balance: e.target.value })} /></Field><Field label="Cuota estimada"><Input type="number" value={debtForm.installment} onChange={(e) => setDebtForm({ ...debtForm, installment: e.target.value })} /></Field><Field label="Día de vencimiento"><Input type="number" value={debtForm.dueDay} onChange={(e) => setDebtForm({ ...debtForm, dueDay: e.target.value })} /></Field><Field label="Prioridad"><Select value={debtForm.priority} onChange={(v) => setDebtForm({ ...debtForm, priority: v })}><option value="Alta">Alta</option><option value="Media">Media</option><option value="Baja">Baja</option></Select></Field><Field label="Tasa"><Input type="number" value={debtForm.rate} onChange={(e) => setDebtForm({ ...debtForm, rate: e.target.value })} /></Field><Field label="Notas"><Input value={debtForm.notes} onChange={(e) => setDebtForm({ ...debtForm, notes: e.target.value })} /></Field></div><div style={{ marginTop: 12 }}><Btn onClick={addDebt}>＋ Agregar deuda</Btn></div></Card><Card><CardHead title="Registrar pago de deuda" icon="💸" /><div className="form-grid two-col-form"><Field label="Deuda"><Select value={debtPayForm.debtId} onChange={(v) => setDebtPayForm({ ...debtPayForm, debtId: v })}><option value="">Elegir deuda…</option>{debts.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}</Select></Field><Field label="Fecha"><Input type="date" value={debtPayForm.date} onChange={(e) => setDebtPayForm({ ...debtPayForm, date: e.target.value })} /></Field><Field label="Importe"><Input type="number" value={debtPayForm.amount} onChange={(e) => setDebtPayForm({ ...debtPayForm, amount: e.target.value })} /></Field><Field label="Persona"><Select value={debtPayForm.person} onChange={(v) => setDebtPayForm({ ...debtPayForm, person: v })}>{people.map((p) => <option key={p} value={p}>{p}</option>)}</Select></Field><Field label="Medio de pago"><Select value={debtPayForm.paymentMethod} onChange={(v) => setDebtPayForm({ ...debtPayForm, paymentMethod: v })}>{paymentMethods.map((m) => <option key={m} value={m}>{m}</option>)}</Select></Field><Field label="Notas"><Input value={debtPayForm.notes} onChange={(e) => setDebtPayForm({ ...debtPayForm, notes: e.target.value })} /></Field></div>{selectedDebtForPay && <InfoBox color="blue">Saldo actual: <strong>{fmt(selectedDebtForPay.balance)}</strong> · Cuota estimada: <strong>{fmt(selectedDebtForPay.installment)}</strong></InfoBox>}<div style={{ marginTop: 12 }}><Btn onClick={registerDebtPayment}>Registrar pago</Btn></div></Card></div>
            <div className="debt-cards">{debts.length === 0 && <EmptyState msg="No hay deudas cargadas." />}{debts.map((d) => { const pctPaid = d.initialBalance > 0 ? ((d.totalPaid || 0) / d.initialBalance) * 100 : 0; return <Card key={d.id}><div className="debt-card-head"><div><div className="fw">{d.name}</div><div className="muted small">{d.owner} · Día {d.dueDay} · Prioridad {d.priority}</div></div><button className="del-btn" onClick={() => deleteDebt(d.id)}>🗑</button></div><div className="debt-amounts"><div><span className="muted small">Saldo</span><div className="fw">{fmt(d.balance)}</div></div><div><span className="muted small">Inicial</span><div>{fmt(d.initialBalance)}</div></div><div><span className="muted small">Pagado</span><div>{fmt(d.totalPaid || 0)}</div></div><div><span className="muted small">Cuota</span><div>{fmt(d.installment)}</div></div></div><Progress value={pctPaid} /><div className="muted small" style={{ marginTop: 6 }}>{pctPaid.toFixed(1)}% cancelado</div></Card>; })}</div>
            {debtPayments.length > 0 && <Card><CardHead title="Historial de pagos" icon="🧾" /><div className="table-wrap"><table className="data-table"><thead><tr><th>Fecha</th><th>Deuda</th><th>Persona</th><th>Medio</th><th>Importe</th><th>Notas</th></tr></thead><tbody>{debtPayments.map((p) => { const debtName = debts.find((d) => d.id === p.debtId)?.name || `Deuda #${p.debtId}`; return <tr key={p.id}><td>{p.date}</td><td>{debtName}</td><td>{p.person}</td><td>{p.paymentMethod}</td><td className="number fw">{money(p.amount)}</td><td className="muted">{p.notes || "—"}</td></tr>; })}</tbody></table></div></Card>}
          </div>
        )}

        {tab === "metas" && (
          <div className="tab-content"><Card><CardHead title="Agregar meta" icon="⭐" /><div className="form-grid three-col"><Field label="Nombre de la meta"><Input value={goalForm.name} onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })} placeholder="Ej. Fondo de emergencia" /></Field><Field label="Objetivo (ARS)"><Input type="number" value={goalForm.target} onChange={(e) => setGoalForm({ ...goalForm, target: e.target.value })} /></Field><Field label="Actual (ARS)"><Input type="number" value={goalForm.current} onChange={(e) => setGoalForm({ ...goalForm, current: e.target.value })} /></Field></div><div style={{ marginTop: 12 }}><Btn onClick={addGoal}>＋ Agregar meta</Btn></div></Card><div className="two-col">{goals.length === 0 && <EmptyState msg="No hay metas cargadas." />}{goals.map((g) => { const current = g.current_amount || g.current || 0; const target = g.target_amount || g.target || 1; const pct = Math.min(100, (current / target) * 100); return <Card key={g.id}><div className="debt-card-head"><div><div className="fw">{g.name}</div><div className="muted small">{fmt(current)} de {fmt(target)}</div></div><button className="del-btn" onClick={() => deleteGoal(g.id)}>🗑</button></div><Progress value={pct} /><div className="muted small" style={{ marginTop: 4 }}>{pct.toFixed(1)}% completado</div></Card>; })}</div></div>
        )}

        {tab === "config" && (
          <div className="tab-content"><div className="two-col"><Card><CardHead title="Catálogos rápidos" icon="⚙️" />
            <div className="catalog-section"><label className="field-label">Personas</label><div className="catalog-add"><Input value={catalogForm.person} onChange={(e) => setCatalogForm({ ...catalogForm, person: e.target.value })} placeholder="Nueva persona" /><Btn small onClick={() => { const v = catalogForm.person.trim(); if (v && !people.includes(v)) setPeople([...people, v]); setCatalogForm({ ...catalogForm, person: "" }); }}>+ Agregar</Btn></div><div className="tag-list">{people.map((p) => <span key={p} className="tag">{p}<button onClick={() => setPeople(people.filter((x) => x !== p))}>×</button></span>)}</div></div>
            <div className="catalog-section"><label className="field-label">Medios de pago</label><div className="catalog-add"><Input value={catalogForm.paymentMethod} onChange={(e) => setCatalogForm({ ...catalogForm, paymentMethod: e.target.value })} placeholder="Nuevo medio" /><Btn small onClick={() => { const v = catalogForm.paymentMethod.trim(); if (v && !paymentMethods.includes(v)) setPaymentMethods([...paymentMethods, v]); setCatalogForm({ ...catalogForm, paymentMethod: "" }); }}>+ Agregar</Btn></div><div className="tag-list">{paymentMethods.map((m) => <span key={m} className="tag">{m}<button onClick={() => setPaymentMethods(paymentMethods.filter((x) => x !== m))}>×</button></span>)}</div></div>
            <div className="catalog-section"><label className="field-label">Tipos</label><div className="catalog-add"><Input value={catalogForm.type} onChange={(e) => setCatalogForm({ ...catalogForm, type: e.target.value })} placeholder="Nuevo tipo" /><Btn small onClick={() => { const v = catalogForm.type.trim(); if (v && !types.includes(v)) setTypes([...types, v]); setCatalogForm({ ...catalogForm, type: "" }); }}>+ Agregar</Btn></div><div className="tag-list">{types.map((t) => <span key={t} className="tag">{t}<button onClick={() => setTypes(types.filter((x) => x !== t))}>×</button></span>)}</div></div>
          </Card>
          <Card><CardHead title="Categorías con F / V" icon="🧩" /><div className="form-grid three-col"><Field label="Tipo"><Select value={catalogForm.categoryType} onChange={(v) => setCatalogForm({ ...catalogForm, categoryType: v })}>{types.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field><Field label="Categoría"><Input value={catalogForm.category} onChange={(e) => setCatalogForm({ ...catalogForm, category: e.target.value })} placeholder="Nueva categoría" /></Field><Field label="F / V"><Select value={catalogForm.categoryFv} onChange={(v) => setCatalogForm({ ...catalogForm, categoryFv: v })}><option value="F">Fijo</option><option value="V">Variable</option></Select></Field></div><div style={{ marginTop: 12 }}><Btn onClick={addCategory}>＋ Agregar categoría</Btn></div><div style={{ marginTop: 16 }}>{types.map((type) => { const rows = categoryRows.filter((r) => r.type === type); if (rows.length === 0) return null; return <div key={type} className="catalog-section"><label className="field-label">{type}</label><div className="tag-list">{rows.map((row) => <span key={row.id} className="tag">{row.name}{type === "Egreso" && <button onClick={() => toggleCategoryFV(row)}>{row.fv}</button>}<button onClick={() => removeCategory(row)}>×</button></span>)}</div></div>; })}</div><InfoBox color="blue">En <strong>Egreso</strong>, cada categoría queda clasificada como <strong>F</strong> o <strong>V</strong>. Esa clasificación alimenta automáticamente los KPIs del dashboard.</InfoBox></Card></div></div>
        )}
      </div>
    </div>
  );
}
