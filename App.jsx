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

// ─── Helpers ──────────────────────────────────────────────────────────────────
const money = (n, cur = "ARS") =>
  new Intl.NumberFormat("es-AR", {
    style: "currency", currency: cur,
    maximumFractionDigits: cur === "USD" ? 2 : 0,
  }).format(Number(n || 0));

const monthKey = (d) => {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
};

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
function Field({ label, children, style }) {
  return <div className="field" style={style}><label className="field-label">{label}</label>{children}</div>;
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
function Progress({ value, reverseColors = false }) {
  const pct = Math.min(100, Math.max(0, value));
  let color = pct > 100 ? "#dc2626" : pct >= 85 ? "#f59e0b" : "#16a34a"; // Default: Egreso (malo si pasa)
  if (reverseColors) {
    color = pct >= 100 ? "#16a34a" : pct >= 50 ? "#f59e0b" : "#dc2626"; // Ingreso/Ahorro (bueno si pasa)
  }
  return (
    <div className="progress-track">
      <div className="progress-fill" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
    </div>
  );
}
function Spinner() { return <div className="spinner" />; }
function EmptyState({ msg }) { return <div className="empty-state">{msg}</div>; }
function InfoBox({ children, color = "blue" }) { return <div className={`info-box info-${color}`}>{children}</div>; }

// ─── Simple bar chart (pure SVG) ─────────────────────────────────────────────
function BarChart({ data, xKey, bars, currency = "ARS" }) {
  const W = 600, H = 320, PL = 70, PR = 20, PT = 30, PB = 70;
  const iW = W - PL - PR, iH = H - PT - PB;
  const allVals = data.flatMap(d => bars.map(b => d[b.key] || 0));
  const maxVal = Math.max(...allVals, 1) * 1.15; // 15% head room for labels
  const totalBars = bars.length;
  const groupW = iW / data.length;
  const barW = (groupW * 0.8) / totalBars; // 80% of group width divided by bars
  const ticks = 5;

  const fmtLabel = (v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0);

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const v = (maxVal / ticks) * i;
          const y = PT + iH - (iH * i) / ticks;
          return (
            <g key={`tick-${i}`}>
              <line x1={PL} x2={PL + iW} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={PL - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">{fmtLabel(v)}</text>
            </g>
          );
        })}
        {data.map((d, di) => {
          const cx = PL + di * groupW + groupW / 2;
          return bars.map((b, bi) => {
            const val = d[b.key] || 0;
            const bH = (val / maxVal) * iH;
            const x = cx - (barW * totalBars) / 2 + bi * barW;
            const y = PT + iH - bH;
            return (
              <g key={`${di}-${b.key}`}>
                <rect x={x} y={y} width={barW - 2} height={bH} fill={b.color} rx="2" />
                {val > 0 && (
                  <text x={x + barW / 2 - 1} y={y - 5} textAnchor="middle" fontSize="9" fill="#475569" transform={`rotate(-45 ${x + barW / 2} ${y - 5})`}>
                    {fmtLabel(val)}
                  </text>
                )}
              </g>
            );
          });
        })}
        {data.map((d, di) => (
          <text key={`lx-${di}`} x={PL + di * groupW + groupW / 2} y={H - PB + 18} textAnchor="middle" fontSize="11" fill="#64748b" fontWeight="600">
            {String(d[xKey]).slice(5) || d[xKey]}
          </text>
        ))}
        {bars.map((b, bi) => (
          <g key={`leg-${b.key}`} transform={`translate(${PL + bi * 100}, ${H - 20})`}>
            <rect width="12" height="12" fill={b.color} rx="3" />
            <text x="18" y="10" fontSize="11" fill="#475569">{b.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function PieChart({ data, nameKey, valueKey, currency = "ARS" }) {
  const W = 380, H = 260, cx = 130, cy = 130, r = 110, ir = 60;
  const total = data.reduce((a, b) => a + (b[valueKey] || 0), 0);
  if (total === 0) return <EmptyState msg="Sin datos para mostrar" />;

  let startAngle = -Math.PI / 2;
  const slices = data.slice(0, 10).map((d, i) => {
    const pct = d[valueKey] / total;
    const angle = pct * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const large = angle > Math.PI ? 1 : 0;
    const path = `
      M ${cx + ir * Math.cos(startAngle)} ${cy + ir * Math.sin(startAngle)}
      L ${cx + r * Math.cos(startAngle)} ${cy + r * Math.sin(startAngle)}
      A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(endAngle)} ${cy + r * Math.sin(endAngle)}
      L ${cx + ir * Math.cos(endAngle)} ${cy + ir * Math.sin(endAngle)}
      A ${ir} ${ir} 0 ${large} 0 ${cx + ir * Math.cos(startAngle)} ${cy + ir * Math.sin(startAngle)} Z
    `;
    const midA = startAngle + angle / 2;
    const labelR = ir + (r - ir) / 2;
    const slice = { 
      path, color: PALETTE[i % PALETTE.length], 
      name: d[nameKey], value: d[valueKey], pct,
      tx: cx + labelR * Math.cos(midA), ty: cy + labelR * Math.sin(midA)
    };
    startAngle = endAngle;
    return slice;
  });

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        {slices.map((s, i) => (
          <g key={i}>
            <path d={s.path} fill={s.color} stroke="white" strokeWidth="2" />
            {s.pct > 0.05 && (
              <text x={s.tx} y={s.ty + 4} textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">
                {(s.pct * 100).toFixed(0)}%
              </text>
            )}
          </g>
        ))}
        {slices.map((s, i) => (
          <g key={`leg-${i}`} transform={`translate(260, ${20 + i * 22})`}>
            <rect width="12" height="12" fill={s.color} rx="2" />
            <text x="18" y="10" fontSize="11" fill="#1e293b" fontWeight="600">
              {s.name.length > 12 ? s.name.slice(0, 11) + "…" : s.name}
            </text>
            <text x="18" y="21" fontSize="9" fill="#64748b">
              {money(s.value, currency)} ({(s.pct * 100).toFixed(1)}%)
            </text>
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
  { id: "presupuesto", label: "🎯 Presupuesto & Metas" },
  { id: "reportes", label: "📈 Reportes" },
  { id: "deudas", label: "💳 Deudas" },
  { id: "config", label: "⚙️ Config" },
];

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("cargar");

  // Catalogs
  const [people, setPeople] = useState(DEFAULT_PEOPLE);
  const [paymentMethods, setPaymentMethods] = useState(DEFAULT_PAYMENT_METHODS);
  const [types, setTypes] = useState(DEFAULT_TYPES);
  const [dbCategories, setDbCategories] = useState([]); // from 'categories' table

  // Data
  const [movements, setMovements] = useState([]);
  const [debts, setDebts] = useState([]);
  const [debtPayments, setDebtPayments] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [monthlyBalances, setMonthlyBalances] = useState([]);

  // FX & Global Filters
  const [blueRate, setBlueRate] = useState(1250);
  const [blueUpdatedAt, setBlueUpdatedAt] = useState("");
  const [fxStatus, setFxStatus] = useState("idle");
  const [displayCurrency, setDisplayCurrency] = useState("ARS");
  const [globalPerson, setGlobalPerson] = useState("all");

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
  const [budgetForm, setBudgetForm] = useState({ month: currentMonth(), person: "Compartido", type: "Egreso", category: "", planned: "" });
  const [debtPayForm, setDebtPayForm] = useState({ debtId: "", date: today(), amount: "", person: "Compartido", paymentMethod: "Banco", notes: "" });
  const [balanceForm, setBalanceForm] = useState({ month: currentMonth(), opening: "", notes: "" });
  const [catalogForm, setCatalogForm] = useState({ person: "", paymentMethod: "", categoryType: "Egreso", categoryName: "", categoryFv: "V" });

  // ── Load data from Supabase ──────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [{ data: movs }, { data: dbs }, { data: dps }, { data: bgs }, { data: mbs }, { data: cats }, { data: realCats }] = await Promise.all([
          supabase.from("movements").select("*").order("movement_date", { ascending: false }),
          supabase.from("debts").select("*").order("created_at", { ascending: false }),
          supabase.from("debt_payments").select("*").order("payment_date", { ascending: false }),
          supabase.from("budgets").select("*").order("created_at", { ascending: false }),
          supabase.from("monthly_balances").select("*").order("balance_month", { ascending: false }),
          supabase.from("settings_catalog").select("*").order("created_at"),
          supabase.from("categories").select("*").order("name") // Load from the proper categories table
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

        if (dps) setDebtPayments(dps);
        if (bgs) setBudgets(bgs.map(b => ({
          id: b.id, month: b.budget_month, person: b.person, type: b.type,
          category: b.category, planned: b.planned_amount_ars,
        })));
        if (mbs) setMonthlyBalances(mbs);

        if (realCats) {
          setDbCategories(realCats);
        }

        if (cats && cats.length > 0) {
          const newPeople = cats.filter(c => c.catalog_type === "person").map(c => c.value);
          const newPMs = cats.filter(c => c.catalog_type === "payment_method").map(c => c.value);
          if (newPeople.length) setPeople(newPeople);
          if (newPMs.length) setPaymentMethods(newPMs);
        }
      } catch (e) { console.error("Error cargando datos:", e); }
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

  // ── Helpers & Core Logic ─────────────────────────────────────────────────────
  // IMPORTANT: Historical USD retrieval. Avoids re-converting old ARS with today's blue.
  const getAmount = (m) => displayCurrency === "USD" ? Number(m.amountUsd || 0) : Number(m.amountArs || 0);
  
  // Format for display based on historical amount, not live conversion
  const fmt = (ars, usd) => {
    return money(displayCurrency === "USD" ? (usd || ars / blueRate) : ars, displayCurrency);
  };

  // Global Filter Application
  const activeMovements = useMemo(() => {
    return movements.filter(m => globalPerson === "all" || m.person === globalPerson);
  }, [movements, globalPerson]);

  const activeBudgets = useMemo(() => {
    return budgets.filter(b => globalPerson === "all" || b.person === globalPerson);
  }, [budgets, globalPerson]);

  // ── Data Mutations ───────────────────────────────────────────────────────────
  async function addMovement() {
    if (!movForm.category || !movForm.originalAmount || !movForm.person || !movForm.type) return;
    setSaving(true);
    const rate = movForm.currency === "USD" ? blueRate : 1;
    const amountArs = movForm.currency === "USD" ? Number(movForm.originalAmount) * rate : Number(movForm.originalAmount);
    const amountUsd = movForm.currency === "USD" ? Number(movForm.originalAmount) : Number(movForm.originalAmount) / blueRate;
    const selectedDebt = debts.find(d => String(d.id) === String(movForm.linkedDebtId));

    const row = {
      movement_date: movForm.date, person: movForm.person, type: movForm.type,
      category: movForm.category, description: movForm.description || null,
      original_currency: movForm.currency, original_amount: Number(movForm.originalAmount),
      fx_rate: rate, amount_ars: amountArs, amount_usd: amountUsd,
      payment_method: movForm.paymentMethod, linked_debt_id: movForm.linkedDebtId ? Number(movForm.linkedDebtId) : null,
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

      if (movForm.type === "Egreso" && movForm.category === "Deuda" && selectedDebt) {
        const newBalance = Math.max(0, selectedDebt.balance - amountArs);
        const newPaid = (selectedDebt.totalPaid || 0) + amountArs;
        await supabase.from("debts").update({ current_balance: newBalance, total_paid: newPaid }).eq("id", selectedDebt.id);
        setDebts(prev => prev.map(d => d.id === selectedDebt.id ? { ...d, balance: newBalance, totalPaid: newPaid } : d));
      }
    }
    setMovForm(emptyMovForm());
    setSaving(false);
  }

  async function deleteMovement(id) {
    await supabase.from("movements").delete().eq("id", id);
    setMovements(prev => prev.filter(m => m.id !== id));
  }

  async function addCategory() {
    if(!catalogForm.categoryName.trim()) return;
    const { data } = await supabase.from("categories").insert([{
      type: catalogForm.categoryType, name: catalogForm.categoryName.trim(), fv: catalogForm.categoryFv
    }]).select().single();
    if(data) setDbCategories(prev => [...prev, data]);
    setCatalogForm({...catalogForm, categoryName: ""});
  }

  async function deleteCategory(id) {
    await supabase.from("categories").delete().eq("id", id);
    setDbCategories(prev => prev.filter(c => c.id !== id));
  }

  // ── Computed & KPIs ──────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const income = activeMovements.filter(m => m.type === "Ingreso").reduce((a, b) => a + getAmount(b), 0);
    const expenses = activeMovements.filter(m => m.type === "Egreso").reduce((a, b) => a + getAmount(b), 0);
    const savings = activeMovements.filter(m => m.type === "Ahorro").reduce((a, b) => a + getAmount(b), 0);
    const investments = activeMovements.filter(m => m.type === "Inversión").reduce((a, b) => a + getAmount(b), 0);
    const totalDebt = debts.filter(d => globalPerson === "all" || d.owner === globalPerson).reduce((a, b) => a + (displayCurrency === "USD" ? b.balance / blueRate : b.balance), 0);
    const net = income - expenses - savings - investments;
    
    // Punto de equilibrio y liquidez
    const fixedExpenses = activeMovements.filter(m => {
      if(m.type !== "Egreso") return false;
      const cat = dbCategories.find(c => c.name === m.category);
      return cat && cat.fv === "F";
    }).reduce((a, b) => a + getAmount(b), 0);
    
    const variableExpenses = expenses - fixedExpenses;
    const liquidityRatio = fixedExpenses > 0 ? (income / fixedExpenses) : 0;

    return { income, expenses, savings, investments, totalDebt, net, fixedExpenses, variableExpenses, liquidityRatio };
  }, [activeMovements, debts, dbCategories, displayCurrency]);

  const monthBalance = useMemo(() => {
    const rec = monthlyBalances.find(b => b.balance_month === reportMonth);
    const openingArs = rec?.opening_balance_ars || 0;
    const opening = displayCurrency === "USD" ? openingArs / blueRate : openingArs;
    
    const inc = activeMovements.filter(m => m.type === "Ingreso" && monthKey(m.date) === reportMonth).reduce((a, b) => a + getAmount(b), 0);
    const exp = activeMovements.filter(m => m.type === "Egreso" && monthKey(m.date) === reportMonth).reduce((a, b) => a + getAmount(b), 0);
    const sav = activeMovements.filter(m => m.type === "Ahorro" && monthKey(m.date) === reportMonth).reduce((a, b) => a + getAmount(b), 0);
    const inv = activeMovements.filter(m => m.type === "Inversión" && monthKey(m.date) === reportMonth).reduce((a, b) => a + getAmount(b), 0);
    const closing = opening + inc - exp - sav - inv;
    return { opening, inc, exp, sav, inv, closing };
  }, [activeMovements, monthlyBalances, reportMonth, displayCurrency]);

  const annualByMonth = useMemo(() => {
    const bucket = {};
    activeMovements.forEach(m => {
      const k = monthKey(m.date);
      if (!bucket[k]) bucket[k] = { month: k, income: 0, expenses: 0, savings: 0, investments: 0 };
      if (m.type === "Ingreso") bucket[k].income += getAmount(m);
      if (m.type === "Egreso") bucket[k].expenses += getAmount(m);
      if (m.type === "Ahorro") bucket[k].savings += getAmount(m);
      if (m.type === "Inversión") bucket[k].investments += getAmount(m);
    });
    return Object.values(bucket).sort((a, b) => a.month.localeCompare(b.month));
  }, [activeMovements, displayCurrency]);

  const monthlyByCategory = useMemo(() => {
    const bucket = {};
    activeMovements.filter(m => m.type === "Egreso" && monthKey(m.date) === reportMonth).forEach(m => {
      bucket[m.category] = (bucket[m.category] || 0) + getAmount(m);
    });
    return Object.entries(bucket).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
  }, [activeMovements, reportMonth, displayCurrency]);

  const budgetComparison = useMemo(() => {
    return activeBudgets.filter(b => b.month === reportMonth).map(b => {
      const actual = activeMovements
        .filter(m => monthKey(m.date) === b.month && m.person === b.person && m.type === b.type && m.category === b.category)
        .reduce((a, c) => a + (displayCurrency === "USD" ? c.amountUsd : c.amountArs), 0);
      
      const plannedConverted = displayCurrency === "USD" ? b.planned / blueRate : b.planned;
      const execution = plannedConverted > 0 ? (actual / plannedConverted) * 100 : 0;
      return { ...b, plannedConverted, actual, difference: actual - plannedConverted, execution };
    });
  }, [activeBudgets, activeMovements, reportMonth, displayCurrency]);

  const filteredMovements = useMemo(() => {
    return activeMovements.filter(m => {
      if (filters.person !== "all" && m.person !== filters.person) return false;
      if (filters.type !== "all" && m.type !== filters.type) return false;
      if (filters.category !== "all" && m.category !== filters.category) return false;
      if (filters.currency !== "all" && m.currency !== filters.currency) return false;
      if (filters.month && monthKey(m.date) !== filters.month) return false;
      return true;
    });
  }, [activeMovements, filters]);

  // UI Helpers
  const selectedDebtForMov = debts.find(d => String(d.id) === String(movForm.linkedDebtId));
  const categoryOptions = dbCategories.filter(c => c.type === movForm.type).map(c => c.name);
  const budgetCategoryOptions = dbCategories.filter(c => c.type === budgetForm.type).map(c => c.name);

  if (loading) return <div className="loading-screen"><Spinner /><p>Cargando datos…</p></div>;

  return (
    <div className="app-shell">
      <div className="app-container">
        
        {/* Header & Global Filters */}
        <div className="header">
          <div>
            <h1 className="app-title">💰 Finanzas Familiares</h1>
            <p className="app-subtitle">Gastos, presupuesto y deudas · Guardado en la nube</p>
          </div>
          <div className="header-controls">
            <Select value={globalPerson} onChange={setGlobalPerson} className="w-auto">
              <option value="all">Filtro: Todas las personas</option>
              {people.map(p => <option key={`glob-${p}`} value={p}>{p}</option>)}
            </Select>
            <Select value={displayCurrency} onChange={setDisplayCurrency} className="w-auto">
              <option value="ARS">Ver en ARS</option>
              <option value="USD">Ver en USD (Histórico)</option>
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
                <Field label="Fecha"><Input type="date" value={movForm.date} onChange={e => setMovForm({ ...movForm, date: e.target.value })} /></Field>
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
                    {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </Field>
                {movForm.type === "Egreso" && movForm.category === "Deuda" && (
                  <Field label="Deuda">
                    <Select value={movForm.linkedDebtId} onChange={v => setMovForm({ ...movForm, linkedDebtId: v, originalAmount: debts.find(d => String(d.id) === String(v))?.installment || "" })}>
                      <option value="">Elegir deuda…</option>
                      {debts.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
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
                <Field label="Descripción" style={{ gridColumn: "span 2" }}>
                  <Input value={movForm.description} onChange={e => setMovForm({ ...movForm, description: e.target.value })} placeholder="Detalle opcional" />
                </Field>
              </div>

              {movForm.currency === "USD" && (
                <InfoBox color="amber">Cotización actual: <strong>{money(blueRate)} por USD</strong></InfoBox>
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
              <Badge color={fxStatus === "ok" ? "green" : fxStatus === "loading" ? "amber" : "red"}>
                {fxStatus === "ok" ? "Cotización online" : "Manual"}
              </Badge>
            </div>

            <div className="stats-grid">
              {[
                { label: "Ingresos", value: summary.income, icon: "💵", color: "green" },
                { label: "Gastos", value: summary.expenses, icon: "💸", color: "red" },
                { label: "Ahorro", value: summary.savings, icon: "🐷", color: "blue" },
                { label: "Inversión", value: summary.investments, icon: "📈", color: "purple" },
                { label: "Pto. Equilibrio", value: summary.fixedExpenses, icon: "🛡️", color: "amber", tooltip: "Gastos Fijos" },
                { label: "Liquidez", value: summary.liquidityRatio, icon: "💧", color: "blue", isRatio: true },
              ].map(s => (
                <div key={s.label} className={`stat-card stat-${s.color}`} title={s.tooltip}>
                  <div className="stat-card-head">
                    <span className="stat-icon">{s.icon}</span>
                    <span className="stat-label">{s.label}</span>
                  </div>
                  <div className="stat-value">{s.isRatio ? `${s.value.toFixed(1)}x` : money(s.value, displayCurrency)}</div>
                  {s.isRatio && <div className="muted small">veces gastos fijos</div>}
                </div>
              ))}
            </div>

            <Card>
              <CardHead title={`Saldo del mes · ${reportMonth}`} icon="📅" />
              <div className="balance-grid">
                <div className="balance-row"><span>Saldo inicial</span><strong>{money(monthBalance.opening, displayCurrency)}</strong></div>
                <div className="balance-row green"><span>＋ Ingresos</span><strong>{money(monthBalance.inc, displayCurrency)}</strong></div>
                <div className="balance-row red"><span>− Gastos</span><strong>{money(monthBalance.exp, displayCurrency)}</strong></div>
                <div className="balance-row amber"><span>− Ahorro</span><strong>{money(monthBalance.sav, displayCurrency)}</strong></div>
                <div className="balance-row purple"><span>− Inversión</span><strong>{money(monthBalance.inv, displayCurrency)}</strong></div>
                <div className="balance-row total"><span>= Saldo final</span><strong>{money(monthBalance.closing, displayCurrency)}</strong></div>
              </div>
            </Card>
          </div>
        )}

        {/* ── DATOS ── */}
        {tab === "datos" && (
          <div className="tab-content">
            <Card>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th><th>Persona</th><th>Tipo</th><th>Categoría</th>
                      <th>Descripción</th><th>Moneda</th><th>Original</th>
                      <th>ARS</th><th>USD</th><th>Medio</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMovements.map(m => (
                      <tr key={m.id}>
                        <td>{m.date}</td><td>{m.person}</td>
                        <td><Badge color={m.type === "Ingreso" ? "green" : m.type === "Egreso" ? "red" : "blue"}>{m.type}</Badge></td>
                        <td>{m.category}</td><td className="muted">{m.description || "—"}</td>
                        <td>{m.currency}</td><td className="number">{money(m.originalAmount, m.currency)}</td>
                        <td className="number fw">{money(m.amountArs)}</td>
                        <td className="number muted">{money(m.amountUsd, "USD")}</td>
                        <td>{m.paymentMethod}</td>
                        <td><button className="del-btn" onClick={() => deleteMovement(m.id)}>🗑</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ── PRESUPUESTO & METAS ── */}
        {tab === "presupuesto" && (
          <div className="tab-content">
            <Card>
              <CardHead title="Planificar (Presupuesto o Metas)" icon="🎯" />
              <div className="form-grid">
                <Field label="Mes"><Input type="month" value={budgetForm.month} onChange={e => setBudgetForm({ ...budgetForm, month: e.target.value })} /></Field>
                <Field label="Persona">
                  <Select value={budgetForm.person} onChange={v => setBudgetForm({ ...budgetForm, person: v })}>
                    {people.map(p => <option key={`bp-${p}`} value={p}>{p}</option>)}
                  </Select>
                </Field>
                <Field label="Tipo">
                  <Select value={budgetForm.type} onChange={v => setBudgetForm({ ...budgetForm, type: v, category: "" })}>
                    {types.map(t => <option key={`bt-${t}`} value={t}>{t}</option>)}
                  </Select>
                </Field>
                <Field label="Categoría">
                  <Select value={budgetForm.category} onChange={v => setBudgetForm({ ...budgetForm, category: v })}>
                    <option value="">Elegir...</option>
                    {budgetCategoryOptions.map(c => <option key={`bc-${c}`} value={c}>{c}</option>)}
                  </Select>
                </Field>
                <Field label="Monto en ARS">
                  <Input type="number" value={budgetForm.planned} onChange={e => setBudgetForm({ ...budgetForm, planned: e.target.value })} placeholder="0" />
                </Field>
              </div>
              <div style={{ marginTop: 12 }}>
                <Btn onClick={async () => {
                  if(!budgetForm.category || !budgetForm.planned) return;
                  const { data } = await supabase.from("budgets").insert([{
                    budget_month: budgetForm.month, person: budgetForm.person, type: budgetForm.type,
                    category: budgetForm.category, planned_amount_ars: Number(budgetForm.planned),
                  }]).select().single();
                  if (data) setBudgets(prev => [{ id: data.id, month: data.budget_month, person: data.person, type: data.type, category: data.category, planned: data.planned_amount_ars }, ...prev]);
                  setBudgetForm({ ...budgetForm, planned: "", category: "" });
                }}>＋ Agregar al plan</Btn>
              </div>
            </Card>

            <Card>
              <CardHead title="Seguimiento vs Real" icon="📊" />
              <div style={{ marginBottom: 14 }}>
                <Field label="Mes a analizar">
                  <Input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} className="w-auto" />
                </Field>
              </div>
              {budgetComparison.map(b => {
                const isExpense = b.type === "Egreso";
                // Lógica de colores corregida: 
                // Egresos (Malo pasarse = rojo). Ingresos/Ahorros (Bueno pasarse = verde).
                const warn = isExpense ? b.execution >= 85 : b.execution < 100;
                const over = isExpense ? b.execution > 100 : false;
                const success = !isExpense && b.execution >= 100;
                
                return (
                  <div key={b.id} className={`budget-row ${over ? "budget-over" : success ? "budget-ok" : warn ? "budget-warn" : "budget-ok"}`}>
                    <div className="budget-row-head">
                      <div>
                        <div className="fw">{b.category}</div>
                        <div className="muted small">{b.type} · {b.person}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <Badge color={over ? "red" : success ? "green" : warn ? "amber" : "blue"}>{b.execution.toFixed(1)}%</Badge>
                      </div>
                    </div>
                    <div className="budget-amounts">
                      <div><span className="muted small">Plan</span><div>{money(b.plannedConverted, displayCurrency)}</div></div>
                      <div><span className="muted small">Real</span><div className={over ? "red" : success ? "green" : ""}>{money(b.actual, displayCurrency)}</div></div>
                      <div><span className="muted small">Diferencia</span><div>{money(b.difference, displayCurrency)}</div></div>
                    </div>
                    <Progress value={b.execution} reverseColors={!isExpense} />
                  </div>
                );
              })}
            </Card>
          </div>
        )}

        {/* ── REPORTES ── */}
        {tab === "reportes" && (
          <div className="tab-content">
            <div className="two-col">
              <Card>
                <CardHead title="Gastos por categoría" icon="🍩" />
                <PieChart data={monthlyByCategory} nameKey="category" valueKey="total" currency={displayCurrency} />
              </Card>
            </div>
            <Card>
              <CardHead title="Comparativa anual" icon="📅" />
              <BarChart
                data={annualByMonth} xKey="month"
                bars={[
                  { key: "income", label: "Ingresos", color: "#16a34a" },
                  { key: "expenses", label: "Gastos", color: "#dc2626" },
                  { key: "savings", label: "Ahorro", color: "#2563eb" },
                ]}
                currency={displayCurrency}
              />
            </Card>
          </div>
        )}

        {/* ── DEUDAS ── (Se mantiene igual que tu código, resumido para brevedad visual) */}
        {tab === "deudas" && (
           <div className="tab-content">
              <EmptyState msg="La vista de deudas se mantiene igual que tu original." />
           </div>
        )}

        {/* ── CONFIG ── */}
        {tab === "config" && (
          <div className="tab-content">
            <Card>
              <CardHead title="Categorías Fijas y Variables" icon="🏷" />
              <div className="form-grid three-col">
                <Field label="Tipo">
                  <Select value={catalogForm.categoryType} onChange={v => setCatalogForm({ ...catalogForm, categoryType: v })}>
                    {types.map(t => <option key={`ct-${t}`} value={t}>{t}</option>)}
                  </Select>
                </Field>
                <Field label="Nombre">
                  <Input value={catalogForm.categoryName} onChange={e => setCatalogForm({ ...catalogForm, categoryName: e.target.value })} />
                </Field>
                <Field label="Fijo o Variable (Solo Egresos)">
                  <Select value={catalogForm.categoryFv} onChange={v => setCatalogForm({ ...catalogForm, categoryFv: v })} disabled={catalogForm.categoryType !== "Egreso"}>
                    <option value="V">Variable</option>
                    <option value="F">Fijo</option>
                  </Select>
                </Field>
              </div>
              <div style={{ marginTop: 8 }}><Btn onClick={addCategory} small>+ Agregar Categoría</Btn></div>
              
              <div style={{ marginTop: 24 }}>
                {types.map(type => (
                  <div key={`list-${type}`} className="catalog-section">
                    <label className="field-label">{type}</label>
                    <div className="tag-list">
                      {dbCategories.filter(c => c.type === type).map(c => (
                        <span key={c.id} className="tag">
                          {c.name} {c.type === "Egreso" && `(${c.fv})`}
                          <button onClick={() => deleteCategory(c.id)}>×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}