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

const PALETTE = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2", "#ea580c", "#be185d"];

const money = (n, cur = "ARS") =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: cur,
    maximumFractionDigits: cur === "USD" ? 2 : 0,
  }).format(Number(n || 0));

const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);

const monthKey = (d) => {
  const dt = new Date(`${d}T00:00:00`);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
};

const toArs = (amount, currency, rate) =>
  currency === "USD" ? Number(amount || 0) * Number(rate || 1) : Number(amount || 0);

function buildCategoryMap(rows) {
  const map = {};
  rows.forEach((r) => {
    if (r.active === false) return;
    if (!map[r.type]) map[r.type] = [];
    if (!map[r.type].includes(r.name)) map[r.type].push(r.name);
  });
  return map;
}

function buildCategoryFV(rows) {
  const map = {};
  rows.forEach((r) => {
    if (r.active === false) return;
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
    <button type={type} onClick={onClick} disabled={disabled} className={`btn btn-${variant}${small ? " btn-sm" : ""} ${className}`}>
      {children}
    </button>
  );
}
function Field({ label, children }) {
  return <div className="field"><label className="field-label">{label}</label>{children}</div>;
}
function Input({ type = "text", value, onChange, placeholder, min, max, step, className = "" }) {
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} min={min} max={max} step={step} className={`control ${className}`} />
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
  return <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%`, background: color }} /></div>;
}
function Spinner() { return <div className="spinner" />; }
function EmptyState({ msg }) { return <div className="empty-state">{msg}</div>; }
function InfoBox({ children, color = "blue" }) { return <div className={`info-box info-${color}`}>{children}</div>; }

function BarChart({ data, xKey, bars, formatter }) {
  const W = 640, H = 300, PL = 60, PR = 20, PT = 20, PB = 70;
  if (!data.length) return <EmptyState msg="Sin datos para mostrar" />;
  const iW = W - PL - PR, iH = H - PT - PB;
  const values = data.flatMap((d) => bars.map((b) => Math.max(0, d[b.key] || 0)));
  const maxVal = Math.max(...values, 1);
  const gap = iW / data.length;
  const barW = Math.max(12, (gap * 0.65) / bars.length);

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        {Array.from({ length: 5 }, (_, i) => {
          const y = PT + (iH * i) / 4;
          const val = maxVal - (maxVal * i) / 4;
          return (
            <g key={i}>
              <line x1={PL} x2={PL + iW} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={PL - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#64748b">{formatter ? formatter(val, true) : val.toFixed(0)}</text>
            </g>
          );
        })}
        {data.map((d, di) => {
          const cx = PL + di * gap + gap / 2;
          return bars.map((b, bi) => {
            const val = Math.max(0, d[b.key] || 0);
            const h = (val / maxVal) * iH;
            const x = cx - (bars.length * barW) / 2 + bi * barW;
            const y = PT + iH - h;
            return (
              <g key={`${di}-${b.key}`}>
                <rect x={x} y={y} width={barW - 2} height={h} fill={b.color} rx="4" />
                {val > 0 && <text x={x + (barW - 2) / 2} y={y - 4} textAnchor="middle" fontSize="9" fill="#334155">{formatter ? formatter(val) : val.toFixed(0)}</text>}
              </g>
            );
          });
        })}
        {data.map((d, di) => (
          <text key={di} x={PL + di * gap + gap / 2} y={H - PB + 20} textAnchor="middle" fontSize="10" fill="#64748b">{String(d[xKey]).slice(5)}</text>
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

function PieChart({ data, nameKey, valueKey, formatter }) {
  const W = 360, H = 280, cx = 120, cy = 130, r = 95, ir = 52;
  const total = data.reduce((a, b) => a + (b[valueKey] || 0), 0);
  if (total === 0) return <EmptyState msg="Sin datos para mostrar" />;
  let start = -Math.PI / 2;
  const slices = data.slice(0, 6).map((d, i) => {
    const pct = (d[valueKey] || 0) / total;
    const angle = pct * 2 * Math.PI;
    const end = start + angle;
    const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
    const ix1 = cx + ir * Math.cos(start), iy1 = cy + ir * Math.sin(start);
    const ix2 = cx + ir * Math.cos(end), iy2 = cy + ir * Math.sin(end);
    const large = angle > Math.PI ? 1 : 0;
    const path = `M ${ix1} ${iy1} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${ir} ${ir} 0 ${large} 0 ${ix1} ${iy1} Z`;
    const slice = { path, color: PALETTE[i % PALETTE.length], pct, label: d[nameKey], value: d[valueKey] };
    start = end;
    return slice;
  });
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth="2" />)}
        {slices.map((s, i) => (
          <g key={i} transform={`translate(245, ${20 + i * 38})`}>
            <rect width="12" height="12" fill={s.color} rx="2" />
            <text x="18" y="10" fontSize="10" fill="#1e293b">{s.label}</text>
            <text x="18" y="24" fontSize="9" fill="#64748b">{(s.pct * 100).toFixed(1)}% · {formatter ? formatter(s.value) : s.value}</text>
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
  const [paymentMethods] = useState(DEFAULT_PAYMENT_METHODS);
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
  const [selectedPerson, setSelectedPerson] = useState("all");
  const [filters, setFilters] = useState({ type: "all", category: "all", month: currentMonth(), currency: "all", fv: "all" });

  const emptyMovForm = useCallback(() => ({
    date: today(), person: "Compartido", type: "", category: "", description: "", originalAmount: "", currency: "ARS",
    fxRate: blueRate, paymentMethod: paymentMethods[0] || "", linkedDebtId: "", linkedGoalId: "",
  }), [blueRate, paymentMethods]);

  const [movForm, setMovForm] = useState(emptyMovForm());
  const [debtForm, setDebtForm] = useState({ name: "", owner: "Compartido", balance: "", installment: "", dueDay: "", priority: "Media", rate: "", notes: "" });
  const [goalForm, setGoalForm] = useState({ name: "", owner: "Compartido", goalType: "Ahorro", periodType: "Mensual", target: "", notes: "" });
  const [budgetForm, setBudgetForm] = useState({ month: currentMonth(), person: "Compartido", type: "Egreso", category: "Supermercado", planned: "" });
  const [debtPayForm, setDebtPayForm] = useState({ debtId: "", date: today(), amount: "", person: "Compartido", paymentMethod: "Banco", notes: "" });
  const [balanceForm, setBalanceForm] = useState({ month: currentMonth(), opening: "", notes: "" });
  const [catalogForm, setCatalogForm] = useState({ person: "", type: "", categoryType: "Egreso", category: "", categoryFv: "V" });

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [movsR, dbsR, dpsR, glsR, bgsR, mbsR, catsR, categoriesR] = await Promise.all([
          supabase.from("movements").select("*").order("movement_date", { ascending: false }),
          supabase.from("debts").select("*").order("created_at", { ascending: false }),
          supabase.from("debt_payments").select("*").order("payment_date", { ascending: false }),
          supabase.from("goals").select("*").order("created_at", { ascending: false }),
          supabase.from("budgets").select("*").order("created_at", { ascending: false }),
          supabase.from("monthly_balances").select("*").order("balance_month", { ascending: false }),
          supabase.from("settings_catalog").select("*").order("created_at"),
          supabase.from("categories").select("*").eq("active", true).order("type").order("name"),
        ]);

        const movs = movsR.data || [];
        const dbs = dbsR.data || [];
        const dps = dpsR.data || [];
        const gls = glsR.data || [];
        const bgs = bgsR.data || [];
        const mbs = mbsR.data || [];
        const cats = catsR.data || [];
        const categoriesData = categoriesR.data || [];

        setMovements(movs.map((m) => ({
          id: m.id, date: m.movement_date, person: m.person, type: m.type, category: m.category, description: m.description,
          originalAmount: m.original_amount, currency: m.original_currency, fxRate: m.fx_rate, amountArs: m.amount_ars,
          amountUsd: m.amount_usd, paymentMethod: m.payment_method, linkedDebtId: m.linked_debt_id, linkedGoalId: m.linked_goal_id,
        })));

        setDebts(dbs.map((d) => ({
          id: d.id, name: d.name, owner: d.owner, balance: d.current_balance, initialBalance: d.initial_balance,
          installment: d.installment_amount, dueDay: d.due_day, priority: d.priority, rate: d.rate,
          notes: d.notes, totalPaid: d.total_paid, status: d.status,
        })));

        setDebtPayments(dps.map((p) => ({
          id: p.id, debtId: p.debt_id, date: p.payment_date, amount: p.amount_ars, person: p.person,
          paymentMethod: p.payment_method, notes: p.notes,
        })));

        setGoals(gls);
        setBudgets(bgs.map((b) => ({ id: b.id, month: b.budget_month, person: b.person, type: b.type, category: b.category, planned: b.planned_amount_ars })));
        setMonthlyBalances(mbs);

        if (cats.length) {
          const newPeople = cats.filter((c) => c.catalog_type === "person").map((c) => c.value);
          const newTypes = cats.filter((c) => c.catalog_type === "type").map((c) => c.value);
          if (newPeople.length) setPeople(newPeople);
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

  const getFV = useCallback((type, category) => categoryFVMap[`${type}__${category}`] || "V", [categoryFVMap]);
  const amountDisplay = useCallback((m) => displayCurrency === "USD" ? Number(m.amountUsd || 0) : Number(m.amountArs || 0), [displayCurrency]);
  const fmt = useCallback((value) => money(value, displayCurrency), [displayCurrency]);
  const fmtArs = useCallback((value) => money(value, "ARS"), []);

  async function addMovement() {
    if (!movForm.category || !movForm.originalAmount || !movForm.person || !movForm.type) return;
    setSaving(true);
    const rate = movForm.currency === "USD" ? blueRate : 1;
    const amountArs = toArs(movForm.originalAmount, movForm.currency, rate);
    const amountUsd = movForm.currency === "USD" ? Number(movForm.originalAmount) : amountArs / Math.max(blueRate, 1);
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
      linked_goal_id: movForm.linkedGoalId ? Number(movForm.linkedGoalId) : null,
    };

    const { data, error } = await supabase.from("movements").insert([row]).select().single();
    if (!error && data) {
      const mov = {
        id: data.id, date: data.movement_date, person: data.person, type: data.type, category: data.category,
        description: data.description, originalAmount: data.original_amount, currency: data.original_currency,
        fxRate: data.fx_rate, amountArs: data.amount_ars, amountUsd: data.amount_usd, paymentMethod: data.payment_method,
        linkedDebtId: data.linked_debt_id, linkedGoalId: data.linked_goal_id,
      };
      setMovements((prev) => [mov, ...prev]);

      if (movForm.type === "Egreso" && movForm.category === "Deuda" && selectedDebt) {
        const newBalance = Math.max(0, selectedDebt.balance - amountArs);
        const newPaid = (selectedDebt.totalPaid || 0) + amountArs;
        await supabase.from("debts").update({ current_balance: newBalance, total_paid: newPaid }).eq("id", selectedDebt.id);
        await supabase.from("debt_payments").insert([{
          debt_id: selectedDebt.id, payment_date: movForm.date, amount_ars: amountArs,
          person: movForm.person, payment_method: movForm.paymentMethod,
          notes: movForm.description || "Pago desde egreso", linked_movement_id: data.id,
        }]);
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
    const { data, error } = await supabase.from("debts").insert([{
      name: debtForm.name, owner: debtForm.owner, initial_balance: bal, current_balance: bal,
      installment_amount: Number(debtForm.installment || 0), due_day: Number(debtForm.dueDay || 0), priority: debtForm.priority,
      rate: Number(debtForm.rate || 0), notes: debtForm.notes || null, total_paid: 0, status: "Activa",
    }]).select().single();
    if (!error && data) {
      setDebts((prev) => [{
        id: data.id, name: data.name, owner: data.owner, balance: data.current_balance, initialBalance: data.initial_balance,
        installment: data.installment_amount, dueDay: data.due_day, priority: data.priority, rate: data.rate,
        notes: data.notes, totalPaid: data.total_paid, status: data.status,
      }, ...prev]);
    }
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
    if (amount <= 0) { setSaving(false); return; }
    const newBalance = Math.max(0, debt.balance - amount);
    const newPaid = (debt.totalPaid || 0) + amount;
    await supabase.from("debts").update({ current_balance: newBalance, total_paid: newPaid }).eq("id", debt.id);
    const { data: dp } = await supabase.from("debt_payments").insert([{
      debt_id: debt.id, payment_date: debtPayForm.date, amount_ars: amount,
      person: debtPayForm.person, payment_method: debtPayForm.paymentMethod, notes: debtPayForm.notes || null,
    }]).select().single();
    const { data: mov } = await supabase.from("movements").insert([{
      movement_date: debtPayForm.date, person: debtPayForm.person, type: "Egreso", category: "Deuda", description: `Pago deuda - ${debt.name}`,
      original_currency: "ARS", original_amount: amount, fx_rate: 1, amount_ars: amount, amount_usd: amount / Math.max(blueRate, 1),
      payment_method: debtPayForm.paymentMethod, linked_debt_id: debt.id,
    }]).select().single();
    setDebts((prev) => prev.map((d) => d.id === debt.id ? { ...d, balance: newBalance, totalPaid: newPaid } : d));
    if (dp) setDebtPayments((prev) => [{ id: dp.id, debtId: dp.debt_id, date: dp.payment_date, amount: dp.amount_ars, person: dp.person, paymentMethod: dp.payment_method, notes: dp.notes }, ...prev]);
    if (mov) setMovements((prev) => [{
      id: mov.id, date: mov.movement_date, person: mov.person, type: mov.type, category: mov.category, description: mov.description,
      originalAmount: mov.original_amount, currency: mov.original_currency, fxRate: mov.fx_rate, amountArs: mov.amount_ars,
      amountUsd: mov.amount_usd, paymentMethod: mov.payment_method, linkedDebtId: mov.linked_debt_id, linkedGoalId: mov.linked_goal_id,
    }, ...prev]);
    setDebtPayForm({ debtId: "", date: today(), amount: "", person: "Compartido", paymentMethod: "Banco", notes: "" });
    setSaving(false);
  }

  async function addGoal() {
    if (!goalForm.name || !goalForm.target) return;
    const { data, error } = await supabase.from("goals").insert([{
      name: goalForm.name, owner: goalForm.owner, goal_type: goalForm.goalType, period_type: goalForm.periodType,
      target_amount: Number(goalForm.target), current_amount: 0, notes: goalForm.notes || null, active: true,
    }]).select().single();
    if (error) { console.error(error); return; }
    if (data) setGoals((prev) => [data, ...prev]);
    setGoalForm({ name: "", owner: "Compartido", goalType: "Ahorro", periodType: "Mensual", target: "", notes: "" });
  }
  async function deleteGoal(id) {
    await supabase.from("goals").delete().eq("id", id);
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }

  async function addBudget() {
    if (!budgetForm.month || !budgetForm.person || !budgetForm.type || !budgetForm.category || !budgetForm.planned) return;
    const { data } = await supabase.from("budgets").insert([{
      budget_month: budgetForm.month, person: budgetForm.person, type: budgetForm.type, category: budgetForm.category,
      planned_amount_ars: Number(budgetForm.planned),
    }]).select().single();
    if (data) setBudgets((prev) => [{ id: data.id, month: data.budget_month, person: data.person, type: data.type, category: data.category, planned: data.planned_amount_ars }, ...prev]);
    setBudgetForm({ month: currentMonth(), person: "Compartido", type: "Egreso", category: "Supermercado", planned: "" });
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
    if ((categoryMap[type] || []).includes(name)) return;
    const { data, error } = await supabase.from("categories").insert([{ type, name, fv, active: true }]).select().single();
    if (error) { console.error(error); return; }
    const nextRows = [...categoryRows, { id: data.id, type: data.type, name: data.name, fv: data.fv, active: data.active }];
    setCategoryRows(nextRows);
    setCategoryMap(buildCategoryMap(nextRows));
    setCategoryFVMap(buildCategoryFV(nextRows));
    setCatalogForm((prev) => ({ ...prev, category: "", categoryFv: "V" }));
  }
  async function toggleCategoryFV(row) {
    const newFv = row.fv === "F" ? "V" : "F";
    const { error } = await supabase.from("categories").update({ fv: newFv }).eq("id", row.id);
    if (error) return;
    const nextRows = categoryRows.map((r) => r.id === row.id ? { ...r, fv: newFv } : r);
    setCategoryRows(nextRows);
    setCategoryMap(buildCategoryMap(nextRows));
    setCategoryFVMap(buildCategoryFV(nextRows));
  }
  async function removeCategory(row) {
    const used = movements.some((m) => m.type === row.type && m.category === row.name);
    if (used) return;
    const { error } = await supabase.from("categories").update({ active: false }).eq("id", row.id);
    if (error) return;
    const nextRows = categoryRows.filter((r) => r.id !== row.id);
    setCategoryRows(nextRows);
    setCategoryMap(buildCategoryMap(nextRows));
    setCategoryFVMap(buildCategoryFV(nextRows));
  }

  const personMovements = useMemo(() => movements.filter((m) => selectedPerson === "all" || m.person === selectedPerson), [movements, selectedPerson]);
  const personDebts = useMemo(() => debts.filter((d) => selectedPerson === "all" || d.owner === selectedPerson), [debts, selectedPerson]);
  const personGoals = useMemo(() => goals.filter((g) => selectedPerson === "all" || g.owner === selectedPerson), [goals, selectedPerson]);

  const summary = useMemo(() => {
    const income = personMovements.filter((m) => m.type === "Ingreso").reduce((a, b) => a + b.amountArs, 0);
    const expenses = personMovements.filter((m) => m.type === "Egreso").reduce((a, b) => a + b.amountArs, 0);
    const savings = personMovements.filter((m) => m.type === "Ahorro").reduce((a, b) => a + b.amountArs, 0);
    const investments = personMovements.filter((m) => m.type === "Inversión").reduce((a, b) => a + b.amountArs, 0);
    const totalDebt = personDebts.reduce((a, b) => a + b.balance, 0);
    return { income, expenses, savings, investments, totalDebt, net: income - expenses - savings - investments };
  }, [personMovements, personDebts]);

  const monthBalance = useMemo(() => {
    const rec = monthlyBalances.find((b) => b.balance_month === reportMonth);
    const opening = rec?.opening_balance_ars || 0;
    const monthMovs = personMovements.filter((m) => monthKey(m.date) === reportMonth);
    const inc = monthMovs.filter((m) => m.type === "Ingreso").reduce((a, b) => a + b.amountArs, 0);
    const exp = monthMovs.filter((m) => m.type === "Egreso").reduce((a, b) => a + b.amountArs, 0);
    const sav = monthMovs.filter((m) => m.type === "Ahorro").reduce((a, b) => a + b.amountArs, 0);
    const inv = monthMovs.filter((m) => m.type === "Inversión").reduce((a, b) => a + b.amountArs, 0);
    return { opening, inc, exp, sav, inv, closing: opening + inc - exp - sav - inv };
  }, [personMovements, monthlyBalances, reportMonth]);

  const monthlyExpenseByFV = useMemo(() => {
    const monthEgresos = personMovements.filter((m) => m.type === "Egreso" && monthKey(m.date) === reportMonth);
    const fixedArs = monthEgresos.filter((m) => getFV(m.type, m.category) === "F").reduce((a, b) => a + b.amountArs, 0);
    const variableArs = monthEgresos.filter((m) => getFV(m.type, m.category) !== "F").reduce((a, b) => a + b.amountArs, 0);
    const fixed = displayCurrency === "USD" ? monthEgresos.filter((m) => getFV(m.type, m.category) === "F").reduce((a, b) => a + Number(b.amountUsd || 0), 0) : fixedArs;
    const variable = displayCurrency === "USD" ? monthEgresos.filter((m) => getFV(m.type, m.category) !== "F").reduce((a, b) => a + Number(b.amountUsd || 0), 0) : variableArs;
    return { fixedArs, variableArs, fixed, variable };
  }, [personMovements, reportMonth, displayCurrency, getFV]);

  const monthlyKpis = useMemo(() => {
    const monthMovs = personMovements.filter((m) => monthKey(m.date) === reportMonth);
    const incomeArs = monthMovs.filter((m) => m.type === "Ingreso").reduce((a, b) => a + b.amountArs, 0);
    const income = displayCurrency === "USD" ? monthMovs.filter((m) => m.type === "Ingreso").reduce((a, b) => a + Number(b.amountUsd || 0), 0) : incomeArs;
    const fixedArs = monthlyExpenseByFV.fixedArs;
    const variableArs = monthlyExpenseByFV.variableArs;
    const fixed = monthlyExpenseByFV.fixed;
    const variable = monthlyExpenseByFV.variable;
    const contribution = income - variable;
    const contributionMargin = income > 0 ? contribution / income : 0;
    const breakEven = contributionMargin > 0 ? fixed / contributionMargin : 0;
    const liquidity = fixedArs > 0 ? monthBalance.closing / fixedArs : 0;
    return {
      income, fixed, variable, liquidity, breakEven,
      fixedPct: income > 0 ? fixed / income : 0,
      variablePct: income > 0 ? variable / income : 0,
      contributionMargin,
      savingsPotential: income - fixed,
      operationalResult: income - fixed - variable,
    };
  }, [personMovements, reportMonth, displayCurrency, monthBalance.closing, monthlyExpenseByFV]);

  const annualByMonth = useMemo(() => {
    const bucket = {};
    personMovements.forEach((m) => {
      const k = monthKey(m.date);
      if (!bucket[k]) bucket[k] = { month: k, income: 0, expenses: 0, fixed: 0, variable: 0 };
      const val = amountDisplay(m);
      if (m.type === "Ingreso") bucket[k].income += val;
      if (m.type === "Egreso") {
        bucket[k].expenses += val;
        if (getFV(m.type, m.category) === "F") bucket[k].fixed += val;
        else bucket[k].variable += val;
      }
    });
    return Object.values(bucket).sort((a, b) => a.month.localeCompare(b.month));
  }, [personMovements, amountDisplay, getFV]);

  const monthlyByCategory = useMemo(() => {
    const bucket = {};
    personMovements.filter((m) => m.type === "Egreso" && monthKey(m.date) === reportMonth).forEach((m) => {
      bucket[m.category] = (bucket[m.category] || 0) + amountDisplay(m);
    });
    const total = Object.values(bucket).reduce((a, b) => a + b, 0);
    return Object.entries(bucket).map(([category, totalAmount]) => ({ category, total: totalAmount, pct: total > 0 ? totalAmount / total : 0 })).sort((a, b) => b.total - a.total);
  }, [personMovements, reportMonth, amountDisplay]);

  const monthlyByPerson = useMemo(() => {
    const bucket = {};
    movements.filter((m) => m.type === "Egreso" && monthKey(m.date) === reportMonth).forEach((m) => {
      bucket[m.person] = (bucket[m.person] || 0) + amountDisplay(m);
    });
    const total = Object.values(bucket).reduce((a, b) => a + b, 0);
    return Object.entries(bucket).map(([person, totalAmount]) => ({ person, total: totalAmount, pct: total > 0 ? totalAmount / total : 0 })).sort((a, b) => b.total - a.total);
  }, [movements, reportMonth, amountDisplay]);

  const budgetComparison = useMemo(() => {
    return budgets
      .filter((b) => b.month === reportMonth && (selectedPerson === "all" || b.person === selectedPerson))
      .map((b) => {
        const actual = personMovements
          .filter((m) => monthKey(m.date) === b.month && m.person === b.person && m.type === b.type && m.category === b.category)
          .reduce((a, c) => a + c.amountArs, 0);
        const execution = b.planned > 0 ? (actual / b.planned) * 100 : 0;
        return { ...b, actual, difference: b.planned - actual, execution };
      });
  }, [budgets, personMovements, reportMonth, selectedPerson]);

  const filteredMovements = useMemo(() => {
    return personMovements.filter((m) => {
      if (filters.type !== "all" && m.type !== filters.type) return false;
      if (filters.category !== "all" && m.category !== filters.category) return false;
      if (filters.currency !== "all" && m.currency !== filters.currency) return false;
      if (filters.month && monthKey(m.date) !== filters.month) return false;
      if (filters.fv !== "all" && (m.type !== "Egreso" || getFV(m.type, m.category) !== filters.fv)) return false;
      return true;
    });
  }, [personMovements, filters, getFV]);

  const goalProgress = useMemo(() => {
    return personGoals.filter((g) => g.active !== false).map((g) => {
      const currentArs = personMovements.filter((m) => {
        if (m.linkedGoalId !== g.id) return false;
        if (g.period_type === "Anual") return m.date.slice(0, 4) === reportMonth.slice(0, 4);
        return monthKey(m.date) === reportMonth;
      }).reduce((a, b) => a + b.amountArs, 0);
      const pct = Number(g.target_amount || 0) > 0 ? (currentArs / Number(g.target_amount)) * 100 : 0;
      return { ...g, currentArs, pct };
    });
  }, [personGoals, personMovements, reportMonth]);

  function exportCSV() {
    const headers = ["Fecha","Persona","Tipo","Categoría","F/V","Descripción","Moneda","Original","TC","ARS","USD","Medio"];
    const rows = filteredMovements.map((m) => [
      m.date, m.person, m.type, m.category, m.type === "Egreso" ? getFV(m.type, m.category) : "", m.description || "",
      m.currency, m.originalAmount, m.fxRate, Number(m.amountArs || 0).toFixed(2), Number(m.amountUsd || 0).toFixed(2), m.paymentMethod,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `movimientos_${filters.month || "todos"}.csv`; a.click();
  }

  const selectedDebtForMov = personDebts.find((d) => String(d.id) === String(movForm.linkedDebtId));
  const availableGoalsForMov = personGoals.filter((g) => g.active !== false && g.goal_type === movForm.type);
  const selectedGoalForMov = personGoals.find((g) => String(g.id) === String(movForm.linkedGoalId));
  const selectedDebtForPay = personDebts.find((d) => String(d.id) === String(debtPayForm.debtId));

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

        <Card>
          <div className="filter-grid three-col">
            <Field label="Persona global">
              <Select value={selectedPerson} onChange={setSelectedPerson}>
                <option value="all">Todas</option>
                {people.map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
            </Field>
            <Field label="Mes global">
              <Input type="month" value={reportMonth} onChange={(e) => { setReportMonth(e.target.value); setFilters((f) => ({ ...f, month: e.target.value })); }} />
            </Field>
            <Field label="Visualización">
              <Select value={displayCurrency} onChange={setDisplayCurrency}>
                <option value="ARS">Pesos</option>
                <option value="USD">USD</option>
              </Select>
            </Field>
          </div>
        </Card>

        <div className="tabs-scroll">
          <div className="tabs-list">
            {TABS.map((t) => <button key={t.id} onClick={() => setTab(t.id)} className={`tab-btn${tab === t.id ? " active" : ""}`}>{t.label}</button>)}
          </div>
        </div>

        {tab === "cargar" && (
          <div className="tab-content">
            <Card>
              <CardHead title="Carga rápida" icon="📥" />
              <div className="form-grid">
                <Field label="Fecha"><Input type="date" value={movForm.date} onChange={(e) => setMovForm({ ...movForm, date: e.target.value })} /></Field>
                <Field label="Persona"><Select value={movForm.person} onChange={(v) => setMovForm({ ...movForm, person: v })}>{people.map((p) => <option key={p} value={p}>{p}</option>)}</Select></Field>
                <Field label="Tipo"><Select value={movForm.type} onChange={(v) => setMovForm({ ...movForm, type: v, category: "", linkedDebtId: "", linkedGoalId: "" })}><option value="">Seleccionar…</option>{types.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
                <Field label="Categoría"><Select value={movForm.category} onChange={(v) => setMovForm({ ...movForm, category: v, linkedDebtId: v !== "Deuda" ? "" : movForm.linkedDebtId })} disabled={!movForm.type}><option value="">Seleccionar…</option>{(categoryMap[movForm.type] || []).map((c) => <option key={c} value={c}>{c}{movForm.type === "Egreso" ? ` · ${getFV(movForm.type, c)}` : ""}</option>)}</Select></Field>
                {movForm.type === "Egreso" && movForm.category === "Deuda" && <Field label="Deuda"><Select value={movForm.linkedDebtId} onChange={(v) => setMovForm({ ...movForm, linkedDebtId: v, originalAmount: personDebts.find((d) => String(d.id) === String(v))?.installment || "" })}><option value="">Elegir deuda…</option>{personDebts.map((d) => <option key={d.id} value={String(d.id)}>{d.name} ({fmtArs(d.balance)} pendiente)</option>)}</Select></Field>}
                {(movForm.type === "Ahorro" || movForm.type === "Inversión") && <Field label="Meta"><Select value={movForm.linkedGoalId} onChange={(v) => setMovForm({ ...movForm, linkedGoalId: v })}><option value="">Elegir meta…</option>{availableGoalsForMov.map((g) => <option key={g.id} value={String(g.id)}>{g.name} · {g.period_type}</option>)}</Select></Field>}
                <Field label="Moneda"><Select value={movForm.currency} onChange={(v) => setMovForm({ ...movForm, currency: v })}><option value="ARS">Pesos (ARS)</option><option value="USD">Dólar blue (USD)</option></Select></Field>
                <Field label={`Importe${movForm.currency === "USD" ? " (USD)" : " (ARS)"}`}><Input type="number" value={movForm.originalAmount} onChange={(e) => setMovForm({ ...movForm, originalAmount: e.target.value })} placeholder="0" /></Field>
                <Field label="Medio de pago"><Select value={movForm.paymentMethod} onChange={(v) => setMovForm({ ...movForm, paymentMethod: v })}>{paymentMethods.map((m) => <option key={m} value={m}>{m}</option>)}</Select></Field>
                <Field label="Descripción"><Input value={movForm.description} onChange={(e) => setMovForm({ ...movForm, description: e.target.value })} placeholder="Detalle opcional" /></Field>
              </div>
              {movForm.type === "Egreso" && movForm.category && <InfoBox color="green">Esta categoría está clasificada como <strong>{getFV("Egreso", movForm.category)}</strong>.</InfoBox>}
              {selectedDebtForMov && movForm.category === "Deuda" && <InfoBox color="blue">Cuota sugerida: <strong>{fmtArs(selectedDebtForMov.installment)}</strong> · Saldo pendiente: <strong>{fmtArs(selectedDebtForMov.balance)}</strong>.</InfoBox>}
              {selectedGoalForMov && <InfoBox color="amber">Meta vinculada: <strong>{selectedGoalForMov.name}</strong> · {selectedGoalForMov.period_type}.</InfoBox>}
              {movForm.currency === "USD" && <InfoBox color="amber">Cotización blue del momento: <strong>{money(blueRate)}</strong> por USD · Importe en ARS: <strong>{money(toArs(movForm.originalAmount || 0, "USD", blueRate))}</strong></InfoBox>}
              <div style={{ marginTop: 16 }}><Btn onClick={addMovement} disabled={saving || !movForm.type || !movForm.category || !movForm.originalAmount}>{saving ? "Guardando…" : "＋ Agregar movimiento"}</Btn></div>
            </Card>
          </div>
        )}

        {tab === "dashboard" && (
          <div className="tab-content">
            <Card><CardHead title="Vista general" icon="📌" /><div className="muted small">Persona: {selectedPerson === "all" ? "Todas" : selectedPerson} · Mes: {reportMonth}</div></Card>
            <div className="stats-grid compact-stats-grid">
              {[
                { label: "Ingresos", value: monthlyKpis.income, icon: "💵", color: "green", suffix: "" },
                { label: "Fijos", value: monthlyKpis.fixed, icon: "🏠", color: "red", suffix: "" },
                { label: "Variables", value: monthlyKpis.variable, icon: "🛒", color: "amber", suffix: "" },
                { label: "Liquidez", value: monthlyKpis.liquidity, icon: "💧", color: monthlyKpis.liquidity >= 1 ? "green" : "red", suffix: "x" },
                { label: "P. equilibrio", value: monthlyKpis.breakEven, icon: "🎯", color: "purple", suffix: "" },
                { label: "Resultado", value: monthlyKpis.operationalResult, icon: "⚖️", color: monthlyKpis.operationalResult >= 0 ? "green" : "red", suffix: "" },
              ].map((s) => (
                <div key={s.label} className={`stat-card stat-${s.color} compact-stat-card`}>
                  <div className="stat-topline"><span className="stat-icon">{s.icon}</span><div className="stat-label">{s.label}</div></div>
                  <div className="stat-value">{s.suffix ? `${s.value.toFixed(2)}${s.suffix}` : fmt(s.value)}</div>
                </div>
              ))}
            </div>
            <div className="two-col">
              <Card>
                <CardHead title={`Saldo del mes · ${reportMonth}`} icon="🗓️" />
                <div className="balance-grid">
                  <div className="balance-row"><span>Saldo inicial</span><strong>{fmtArs(monthBalance.opening)}</strong></div>
                  <div className="balance-row green"><span>＋ Ingresos</span><strong>{fmtArs(monthBalance.inc)}</strong></div>
                  <div className="balance-row red"><span>− Gastos</span><strong>{fmtArs(monthBalance.exp)}</strong></div>
                  <div className="balance-row amber"><span>− Ahorro</span><strong>{fmtArs(monthBalance.sav)}</strong></div>
                  <div className="balance-row purple"><span>− Inversión</span><strong>{fmtArs(monthBalance.inv)}</strong></div>
                  <div className="balance-row total"><span>= Saldo final</span><strong>{fmtArs(monthBalance.closing)}</strong></div>
                </div>
              </Card>
              <Card>
                <CardHead title="KPIs derivados" icon="🧮" />
                <div className="balance-grid">
                  <div className="balance-row"><span>% fijos / ingresos</span><strong>{(monthlyKpis.fixedPct * 100).toFixed(1)}%</strong></div>
                  <div className="balance-row"><span>% variables / ingresos</span><strong>{(monthlyKpis.variablePct * 100).toFixed(1)}%</strong></div>
                  <div className="balance-row"><span>Margen contribución</span><strong>{(monthlyKpis.contributionMargin * 100).toFixed(1)}%</strong></div>
                  <div className="balance-row"><span>Ahorro potencial</span><strong>{fmt(monthlyKpis.savingsPotential)}</strong></div>
                  <div className="balance-row total"><span>Deuda total</span><strong>{fmtArs(summary.totalDebt)}</strong></div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {tab === "datos" && (
          <div className="tab-content">
            <Card>
              <CardHead title="Filtros" icon="🔍" />
              <div className="filter-grid">
                <Field label="Mes"><Input type="month" value={filters.month} onChange={(e) => setFilters({ ...filters, month: e.target.value })} /></Field>
                <Field label="Tipo"><Select value={filters.type} onChange={(v) => setFilters({ ...filters, type: v })}><option value="all">Todos</option>{types.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
                <Field label="Categoría"><Select value={filters.category} onChange={(v) => setFilters({ ...filters, category: v })}><option value="all">Todas</option>{Object.values(categoryMap).flat().map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field>
                <Field label="Moneda"><Select value={filters.currency} onChange={(v) => setFilters({ ...filters, currency: v })}><option value="all">Todas</option><option value="ARS">ARS</option><option value="USD">USD</option></Select></Field>
                <Field label="F/V"><Select value={filters.fv} onChange={(v) => setFilters({ ...filters, fv: v })}><option value="all">Todos</option><option value="F">Fijos</option><option value="V">Variables</option></Select></Field>
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}><Btn onClick={exportCSV} variant="outline">⬇ Exportar CSV</Btn><span className="muted small" style={{ alignSelf: "center" }}>{filteredMovements.length} registros</span></div>
            </Card>
            <Card>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Fecha</th><th>Persona</th><th>Tipo</th><th>Categoría</th><th>F/V</th><th>Descripción</th><th>Moneda</th><th>Original</th><th>ARS</th><th>USD</th><th>Medio</th><th></th></tr></thead>
                  <tbody>
                    {filteredMovements.map((m) => (
                      <tr key={m.id}>
                        <td>{m.date}</td><td>{m.person}</td>
                        <td><Badge color={m.type === "Ingreso" ? "green" : m.type === "Egreso" ? "red" : m.type === "Ahorro" ? "blue" : "purple"}>{m.type}</Badge></td>
                        <td>{m.category}</td>
                        <td>{m.type === "Egreso" ? <Badge color={getFV(m.type, m.category) === "F" ? "red" : "amber"}>{getFV(m.type, m.category)}</Badge> : "—"}</td>
                        <td className="muted">{m.description || "—"}</td>
                        <td>{m.currency}</td>
                        <td className="number">{money(m.originalAmount, m.currency)}</td>
                        <td className="number fw">{fmtArs(m.amountArs)}</td>
                        <td className="number muted">{money(m.amountUsd || 0, "USD")}</td>
                        <td>{m.paymentMethod}</td>
                        <td><button className="del-btn" onClick={() => deleteMovement(m.id)}>🗑</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredMovements.length === 0 && <EmptyState msg="No hay movimientos con esos filtros." />}
              </div>
            </Card>
          </div>
        )}

        {tab === "presupuesto" && (
          <div className="tab-content">
            <Card>
              <CardHead title="Saldo inicial del mes" icon="🏦" />
              <div className="form-grid three-col">
                <Field label="Mes">
                  <Input
                    type="month"
                    value={balanceForm.month}
                    onChange={(e) => setBalanceForm({ ...balanceForm, month: e.target.value })}
                  />
                </Field>

                <Field label="Saldo inicial (ARS)">
                  <Input
                    type="number"
                    value={balanceForm.opening}
                    onChange={(e) => setBalanceForm({ ...balanceForm, opening: e.target.value })}
                    placeholder="0"
                  />
                </Field>

                <Field label="Notas">
                  <Input
                    value={balanceForm.notes}
                    onChange={(e) => setBalanceForm({ ...balanceForm, notes: e.target.value })}
                    placeholder="Opcional"
                  />
                </Field>
              </div>

              <div style={{ marginTop: 12 }}>
                <Btn onClick={saveBalance}>Guardar saldo inicial</Btn>
              </div>
            </Card>

            <Card>
              <CardHead title="Agregar presupuesto" icon="🎯" />
              <div className="form-grid">
                <Field label="Mes">
                  <Input
                    type="month"
                    value={budgetForm.month}
                    onChange={(e) => setBudgetForm({ ...budgetForm, month: e.target.value })}
                  />
                </Field>

                <Field label="Persona">
                  <Select
                    value={budgetForm.person}
                    onChange={(v) => setBudgetForm({ ...budgetForm, person: v })}
                  >
                    {people.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Tipo">
                  <Select
                    value={budgetForm.type}
                    onChange={(v) =>
                      setBudgetForm({
                        ...budgetForm,
                        type: v,
                        category: (categoryMap[v] || [])[0] || "",
                      })
                    }
                  >
                    {types.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Categoría">
                  <Select
                    value={budgetForm.category}
                    onChange={(v) => setBudgetForm({ ...budgetForm, category: v })}
                  >
                    {(categoryMap[budgetForm.type] || []).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Importe presupuestado">
                  <Input
                    type="number"
                    value={budgetForm.planned}
                    onChange={(e) => setBudgetForm({ ...budgetForm, planned: e.target.value })}
                    placeholder="0"
                  />
                </Field>
              </div>

              <div style={{ marginTop: 12 }}>
                <Btn onClick={addBudget}>＋ Agregar presupuesto</Btn>
              </div>
            </Card>

            <Card>
              <CardHead title="Presupuesto vs Real" icon="📊" />
              <div style={{ marginBottom: 14 }}>
                <Field label="Mes a analizar">
                  <Input
                    type="month"
                    value={reportMonth}
                    onChange={(e) => {
                      setReportMonth(e.target.value);
                      setFilters((f) => ({ ...f, month: e.target.value }));
                    }}
                    className="w-auto"
                  />
                </Field>
              </div>

              {budgetComparison.length === 0 && <EmptyState msg="No hay presupuestos para este mes." />}

              {budgetComparison.map((b) => {
                const isExpenseLike = b.type === "Egreso";
                const over = b.execution > 100;
                const warn = b.execution >= 85;

                const rowClass = isExpenseLike
                  ? over
                    ? "budget-over"
                    : warn
                      ? "budget-warn"
                      : "budget-ok"
                  : over
                    ? "budget-ok"
                    : "budget-warn";

                return (
                  <div key={b.id} className={`budget-row ${rowClass} budget-row-inline`}>
                    <div className="budget-inline-main">
                      <div className="budget-inline-title">
                        <div className="fw">
                          {b.category}
                          {b.type === "Egreso" ? ` · ${getFV(b.type, b.category)}` : ""}
                        </div>
                        <div className="muted small">
                          {b.month} · {b.person} · {b.type}
                        </div>
                      </div>

                      <div className="budget-inline-metrics">
                        <div className="budget-metric">
                          <span className="muted small">Presupuesto</span>
                          <strong>{fmt(b.planned, b.plannedUsd || 0)}</strong>
                        </div>

                        <div className="budget-metric">
                          <span className="muted small">Real</span>
                          <strong className={isExpenseLike && b.actual > b.planned ? "red" : ""}>
                            {fmt(b.actual, b.actualUsd || 0)}
                          </strong>
                        </div>

                        <div className="budget-metric">
                          <span className="muted small">Diferencia</span>
                          <strong className={b.difference < 0 && isExpenseLike ? "red" : "green"}>
                            {fmt(b.difference, b.differenceUsd || 0)}
                          </strong>
                        </div>

                        <div className="budget-metric">
                          <span className="muted small">Estado</span>
                          <strong>
                            {isExpenseLike
                              ? over
                                ? "Excedido"
                                : warn
                                  ? "Al límite"
                                  : "Dentro"
                              : over
                                ? "Cumplido / superado"
                                : "En progreso"}
                          </strong>
                        </div>

                        <div className="budget-metric budget-metric-badge">
                          <Badge
                            color={
                              isExpenseLike
                                ? over
                                  ? "red"
                                  : warn
                                    ? "amber"
                                    : "green"
                                : over
                                  ? "green"
                                  : "amber"
                            }
                          >
                            {b.execution.toFixed(1)}%
                          </Badge>
                        </div>

                        <button className="del-btn" onClick={() => deleteBudget(b.id)}>
                          🗑
                        </button>
                      </div>
                    </div>

                    <div className="budget-inline-progress">
                      <Progress value={b.execution} />
                    </div>
                  </div>
                );
              })}
            </Card>

            <Card>
              <CardHead title="Crear meta" icon="⭐" />
              <div className="form-grid">
                <Field label="Nombre">
                  <Input
                    value={goalForm.name}
                    onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })}
                  />
                </Field>

                <Field label="Responsable">
                  <Select
                    value={goalForm.owner}
                    onChange={(v) => setGoalForm({ ...goalForm, owner: v })}
                  >
                    {people.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Tipo">
                  <Select
                    value={goalForm.goalType}
                    onChange={(v) => setGoalForm({ ...goalForm, goalType: v })}
                  >
                    <option value="Ahorro">Ahorro</option>
                    <option value="Inversión">Inversión</option>
                  </Select>
                </Field>

                <Field label="Periodicidad">
                  <Select
                    value={goalForm.periodType}
                    onChange={(v) => setGoalForm({ ...goalForm, periodType: v })}
                  >
                    <option value="Mensual">Mensual</option>
                    <option value="Anual">Anual</option>
                  </Select>
                </Field>

                <Field label="Objetivo (ARS)">
                  <Input
                    type="number"
                    value={goalForm.target}
                    onChange={(e) => setGoalForm({ ...goalForm, target: e.target.value })}
                  />
                </Field>

                <Field label="Notas">
                  <Input
                    value={goalForm.notes}
                    onChange={(e) => setGoalForm({ ...goalForm, notes: e.target.value })}
                  />
                </Field>
              </div>

              <div style={{ marginTop: 12 }}>
                <Btn onClick={addGoal}>＋ Crear meta</Btn>
              </div>
            </Card>

            <Card>
              <CardHead title="Avance de metas" icon="🚀" />
              {!goalProgress.length && <EmptyState msg="No hay metas cargadas." />}

              {goalProgress.map((g) => (
                <div key={g.id} className="budget-row budget-ok budget-row-inline">
                  <div className="budget-inline-main">
                    <div className="budget-inline-title">
                      <div className="fw">{g.name}</div>
                      <div className="muted small">
                        {g.owner} · {g.goalType} · {g.periodType}
                      </div>
                    </div>

                    <div className="budget-inline-metrics">
                      <div className="budget-metric">
                        <span className="muted small">Objetivo</span>
                        <strong>{fmt(g.target, g.targetUsd || 0)}</strong>
                      </div>

                      <div className="budget-metric">
                        <span className="muted small">Actual</span>
                        <strong>{fmt(g.currentArs, g.currentUsd || 0)}</strong>
                      </div>

                      <div className="budget-metric">
                        <span className="muted small">%</span>
                        <strong>{g.pct.toFixed(1)}%</strong>
                      </div>

                      <div className="budget-metric">
                        <span className="muted small">Período</span>
                        <strong>{g.periodType}</strong>
                      </div>

                      <button className="del-btn" onClick={() => deleteGoal(g.id)}>
                        🗑
                      </button>
                    </div>
                  </div>

                  <div className="budget-inline-progress">
                    <Progress value={g.pct} />
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}
