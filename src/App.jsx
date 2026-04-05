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

function HorizontalBarChart({ data, formatter }) {
  // data: [{ label, real, budget, isIncome }]  grouped by type via sections
  // isIncome=true → positive deviation is good; false → negative deviation is good
  if (!data.length) return <EmptyState msg="Sin presupuestos para mostrar" />;

  const maxVal = Math.max(...data.map((d) => Math.max(d.real, d.budget || 0)), 1);
  const rowH = 34, PL = 130, PR = 100, PT = 4, barH = 16;
  const W = 580;
  const H = PT + data.length * rowH + 24;
  const trackW = W - PL - PR;

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        {data.map((d, i) => {
          if (d.isHeader) {
            return (
              <g key={i}>
                <text x={0} y={PT + i * rowH + barH - 2} fontSize="10" fontWeight="700" fill="#64748b" textTransform="uppercase">{d.label}</text>
              </g>
            );
          }
          const y = PT + i * rowH;
          const budgetW = d.budget > 0 ? (d.budget / maxVal) * trackW : 0;
          const realW = Math.min((d.real / maxVal) * trackW, trackW);
          const over = d.budget > 0 && d.real > d.budget;
          const under = d.budget > 0 && !over && d.isIncome && d.real < d.budget;
          const warn = d.budget > 0 && !over && !d.isIncome && (d.real / d.budget) >= 0.85;
          const barColor = over
            ? (d.isIncome ? "#16a34a" : "#dc2626")   // income over = good green; expense over = bad red
            : under ? "#dc2626"                        // income under = bad red
            : warn ? "#f59e0b"
            : "#16a34a";

          // % label: for expenses, negative if over. For income, negative if under.
          const pct = d.budget > 0 ? (d.real / d.budget) * 100 : null;
          let pctLabel = "";
          if (pct !== null) {
            if (d.isIncome) {
              pctLabel = pct >= 100 ? `+${Math.round(pct - 100)}%` : `-${Math.round(100 - pct)}%`;
            } else {
              pctLabel = over ? `-${Math.round(pct - 100)}%` : `${Math.round(pct)}%`;
            }
          }
          const pctColor = d.isIncome ? (over ? "#16a34a" : "#dc2626") : (over ? "#dc2626" : "#16a34a");

          return (
            <g key={i}>
              {/* label */}
              <text x={PL - 6} y={y + barH / 2 + 4} textAnchor="end" fontSize="10" fill="#334155">{d.label}</text>
              {/* budget track */}
              {budgetW > 0 && <rect x={PL} y={y} width={budgetW} height={barH} fill="#e2e8f0" rx="3" />}
              {/* budget label — at right edge of grey track */}
              {d.budget > 0 && (
                <text x={PL + budgetW} y={y + barH + 10} textAnchor="end" fontSize="8" fill="#94a3b8">
                  {formatter ? formatter(d.budget) : d.budget}
                </text>
              )}
              {/* real fill */}
              {d.real > 0 && <rect x={PL} y={y} width={Math.max(realW, 3)} height={barH} fill={barColor} rx="3" opacity="0.9" />}
              {/* real amount — fixed right */}
              <text x={W - PR + 4} y={y + barH / 2 + 4} fontSize="10" fontWeight="700" fill={barColor}>
                {formatter ? formatter(d.real) : d.real}
              </text>
              {/* pct */}
              {pct !== null && (
                <text x={W - 2} y={y + barH / 2 + 4} fontSize="9" fill={pctColor} textAnchor="end" fontWeight="700">
                  {pctLabel}
                </text>
              )}
            </g>
          );
        })}
        <g transform={`translate(${PL}, ${H - 14})`}>
          <rect width="8" height="8" fill="#e2e8f0" rx="2" /><text x="12" y="8" fontSize="9" fill="#64748b">Presp.</text>
          <rect x="65" width="8" height="8" fill="#16a34a" rx="2" /><text x="77" y="8" fontSize="9" fill="#64748b">Ok</text>
          <rect x="105" width="8" height="8" fill="#f59e0b" rx="2" /><text x="117" y="8" fontSize="9" fill="#64748b">Cerca</text>
          <rect x="160" width="8" height="8" fill="#dc2626" rx="2" /><text x="172" y="8" fontSize="9" fill="#64748b">Excedido / No alcanzado</text>
        </g>
      </svg>
    </div>
  );
}

function DescriptionAutocomplete({ value, onChange, suggestions }) {
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState(value || "");
  const ref = React.useRef(null);
  React.useEffect(() => { setInputVal(value || ""); }, [value]);
  React.useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const filtered = suggestions.filter((s) =>
    s.toLowerCase().includes(inputVal.toLowerCase()) && s.toLowerCase() !== inputVal.toLowerCase()
  );
  function select(s) { setInputVal(s); onChange(s); setOpen(false); }
  function handleChange(e) { setInputVal(e.target.value); onChange(e.target.value); setOpen(true); }
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input type="text" value={inputVal} onChange={handleChange} onFocus={() => setOpen(true)}
        placeholder="Descripción / subcategoría" className="control" autoComplete="off" />
      {open && filtered.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
          background: "white", border: "1.5px solid #e2e8f0", borderRadius: 10,
          boxShadow: "0 4px 16px rgba(0,0,0,.1)", maxHeight: 200, overflowY: "auto", marginTop: 2 }}>
          {filtered.map((s) => (
            <div key={s} onMouseDown={() => select(s)}
              style={{ padding: "9px 14px", cursor: "pointer", fontSize: "0.9rem", borderBottom: "1px solid #f1f5f9" }}
              onMouseEnter={e => e.currentTarget.style.background = "#eff6ff"}
              onMouseLeave={e => e.currentTarget.style.background = "white"}>{s}</div>
          ))}
        </div>
      )}
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
  const [editingMovId, setEditingMovId] = useState(null);
  const [editMovData, setEditMovData] = useState({ originalAmount: "", description: "" });

  const [reportMonth, setReportMonth] = useState(currentMonth());
  const [selectedPerson, setSelectedPerson] = useState("all");
  const [reportBudgetPerson, setReportBudgetPerson] = useState("all");
  const [filters, setFilters] = useState({ type: "all", category: "all", dateFrom: currentMonth() + "-01", dateTo: today(), currency: "all", fv: "all" });
  const [expandedTypes, setExpandedTypes] = useState({});

  const emptyMovForm = useCallback(() => ({
    date: today(), person: "Compartido", type: "", category: "", description: "", originalAmount: "", currency: "ARS",
    fxRate: blueRate, linkedDebtId: "", linkedGoalId: "",
  }), [blueRate]);

  const [movForm, setMovForm] = useState(emptyMovForm());
  const [transferForm, setTransferForm] = useState({ date: today(), person: "Compartido", fromType: "Ahorro", fromCategory: "", toType: "Inversión", toCategory: "", originalAmount: "", currency: "ARS", description: "" });
  const [debtForm, setDebtForm] = useState({ name: "", owner: "Compartido", balance: "", installment: "", dueDay: "", priority: "Media", rate: "", notes: "" });
  const [goalForm, setGoalForm] = useState({ name: categoryMap["Ahorro"]?.[0] || "", owner: "Compartido", goalType: "Ahorro", periodType: "Mensual", target: "", notes: "" });
  const [budgetForm, setBudgetForm] = useState({ month: currentMonth(), person: "Compartido", type: "Egreso", category: "Supermercado", planned: "" });
  const [debtPayForm, setDebtPayForm] = useState({ debtId: "", date: today(), amount: "", person: "Compartido", notes: "" });
  const [balanceForm, setBalanceForm] = useState({ month: currentMonth(), opening: "", notes: "" });
  const [catalogForm, setCatalogForm] = useState({ person: "", type: "", categoryType: "Egreso", category: "", categoryFv: "V" });
  const [copyBudgetMsg, setCopyBudgetMsg] = useState("");

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

    // Auto-link goal: if no explicit link, find a goal whose name matches the category (case-insensitive)
    let linkedGoalId = movForm.linkedGoalId ? Number(movForm.linkedGoalId) : null;
    if (!linkedGoalId && (movForm.type === "Ahorro" || movForm.type === "Inversión")) {
      const autoGoal = goals.find((g) =>
        g.active !== false &&
        g.goal_type === movForm.type &&
        (selectedPerson === "all" || g.owner === movForm.person || g.owner === "Compartido") &&
        g.name.toLowerCase() === movForm.category.toLowerCase()
      );
      if (autoGoal) linkedGoalId = autoGoal.id;
    }

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
      payment_method: null,
      linked_debt_id: movForm.linkedDebtId ? Number(movForm.linkedDebtId) : null,
      linked_goal_id: linkedGoalId,
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
          person: movForm.person, payment_method: null,
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

  async function addTransfer() {
    const { date, person, fromType, fromCategory, toType, toCategory, originalAmount, currency, description } = transferForm;
    if (!fromCategory || !toCategory || !originalAmount) return;
    setSaving(true);
    const rate = currency === "USD" ? blueRate : 1;
    const amountArs = toArs(originalAmount, currency, rate);
    const amountUsd = currency === "USD" ? Number(originalAmount) : amountArs / Math.max(blueRate, 1);
    const desc = description || `Transferencia ${fromType} → ${toType}`;

    // Movimiento 1: egreso del origen
    const rowOut = {
      movement_date: date, person, type: fromType, category: fromCategory,
      description: desc, original_currency: currency,
      original_amount: Number(originalAmount), fx_rate: rate,
      amount_ars: amountArs, amount_usd: amountUsd,
      payment_method: null, linked_debt_id: null, linked_goal_id: null,
    };
    // Movimiento 2: ingreso en el destino
    const rowIn = {
      movement_date: date, person, type: toType, category: toCategory,
      description: desc, original_currency: currency,
      original_amount: Number(originalAmount), fx_rate: rate,
      amount_ars: amountArs, amount_usd: amountUsd,
      payment_method: null, linked_debt_id: null, linked_goal_id: null,
    };

    const [{ data: d1 }, { data: d2 }] = await Promise.all([
      supabase.from("movements").insert([rowOut]).select().single(),
      supabase.from("movements").insert([rowIn]).select().single(),
    ]);

    const toMov = (d) => d ? {
      id: d.id, date: d.movement_date, person: d.person, type: d.type, category: d.category,
      description: d.description, originalAmount: d.original_amount, currency: d.original_currency,
      fxRate: d.fx_rate, amountArs: d.amount_ars, amountUsd: d.amount_usd,
      paymentMethod: d.payment_method, linkedDebtId: d.linked_debt_id, linkedGoalId: d.linked_goal_id,
    } : null;

    const newMovs = [toMov(d1), toMov(d2)].filter(Boolean);
    if (newMovs.length) setMovements((prev) => [...newMovs, ...prev]);

    setTransferForm({ date: today(), person: "Compartido", fromType: "Ahorro", fromCategory: "", toType: "Inversión", toCategory: "", originalAmount: "", currency: "ARS", description: "" });
    setSaving(false);
  }

  async function saveEditMovement(id) {
    const mov = movements.find((m) => m.id === id);
    if (!mov) return;
    const newAmount = Number(editMovData.originalAmount);
    if (!newAmount) return;
    const rate = mov.currency === "USD" ? mov.fxRate : 1;
    const amountArs = mov.currency === "USD" ? newAmount * rate : newAmount;
    const amountUsd = mov.currency === "USD" ? newAmount : amountArs / Math.max(blueRate, 1);
    const { error } = await supabase.from("movements").update({
      original_amount: newAmount, amount_ars: amountArs, amount_usd: amountUsd,
      description: editMovData.description || null,
    }).eq("id", id);
    if (!error) {
      setMovements((prev) => prev.map((m) => m.id === id ? { ...m, originalAmount: newAmount, amountArs, amountUsd, description: editMovData.description } : m));
    }
    setEditingMovId(null);
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
      person: debtPayForm.person, payment_method: null, notes: debtPayForm.notes || null,
    }]).select().single();
    const { data: mov } = await supabase.from("movements").insert([{
      movement_date: debtPayForm.date, person: debtPayForm.person, type: "Egreso", category: "Deuda", description: `Pago deuda - ${debt.name}`,
      original_currency: "ARS", original_amount: amount, fx_rate: 1, amount_ars: amount, amount_usd: amount / Math.max(blueRate, 1),
      payment_method: null, linked_debt_id: debt.id,
    }]).select().single();
    setDebts((prev) => prev.map((d) => d.id === debt.id ? { ...d, balance: newBalance, totalPaid: newPaid } : d));
    if (dp) setDebtPayments((prev) => [{ id: dp.id, debtId: dp.debt_id, date: dp.payment_date, amount: dp.amount_ars, person: dp.person, paymentMethod: dp.payment_method, notes: dp.notes }, ...prev]);
    if (mov) setMovements((prev) => [{
      id: mov.id, date: mov.movement_date, person: mov.person, type: mov.type, category: mov.category, description: mov.description,
      originalAmount: mov.original_amount, currency: mov.original_currency, fxRate: mov.fx_rate, amountArs: mov.amount_ars,
      amountUsd: mov.amount_usd, paymentMethod: null, linkedDebtId: mov.linked_debt_id, linkedGoalId: mov.linked_goal_id,
    }, ...prev]);
    setDebtPayForm({ debtId: "", date: today(), amount: "", person: "Compartido", notes: "" });
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
    setGoalForm({ name: (categoryMap["Ahorro"] || [])[0] || "", owner: "Compartido", goalType: "Ahorro", periodType: "Mensual", target: "", notes: "" });
  }
  async function deleteGoal(id) {
    await supabase.from("goals").delete().eq("id", id);
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }

  async function addBudget() {
    if (!budgetForm.month || !budgetForm.person || !budgetForm.type || !budgetForm.category || !budgetForm.planned) return;
    const duplicate = budgets.find((b) =>
      b.month === budgetForm.month && b.person === budgetForm.person &&
      b.type === budgetForm.type && b.category === budgetForm.category
    );
    if (duplicate) {
      setCopyBudgetMsg(`⚠️ Ya existe "${budgetForm.category}" para ${budgetForm.person} en ${budgetForm.month}. Eliminá esa línea primero si querés cambiar el importe.`);
      setTimeout(() => setCopyBudgetMsg(""), 5000);
      return;
    }
    const { data } = await supabase.from("budgets").insert([{
      budget_month: budgetForm.month, person: budgetForm.person, type: budgetForm.type, category: budgetForm.category,
      planned_amount_ars: Number(budgetForm.planned),
    }]).select().single();
    if (data) setBudgets((prev) => [{ id: data.id, month: data.budget_month, person: data.person, type: data.type, category: data.category, planned: data.planned_amount_ars }, ...prev]);
    // Mantiene mes/persona/tipo, solo limpia importe
    setBudgetForm((f) => ({ ...f, planned: "" }));
  }
  async function deleteBudget(id) {
    await supabase.from("budgets").delete().eq("id", id);
    setBudgets((prev) => prev.filter((b) => b.id !== id));
  }

  async function copyBudgetFromPrevMonth(targetMonth) {
    // Calcular mes anterior
    const [y, m] = targetMonth.split("-").map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
    const prevBudgets = budgets.filter((b) => b.month === prevMonth);
    if (!prevBudgets.length) return { count: 0 };
    // Solo copiar los que no existen ya en el mes destino
    const existing = budgets.filter((b) => b.month === targetMonth);
    const toInsert = prevBudgets.filter((pb) =>
      !existing.some((eb) => eb.person === pb.person && eb.type === pb.type && eb.category === pb.category)
    );
    if (!toInsert.length) return { count: 0, skipped: true };
    const rows = toInsert.map((b) => ({
      budget_month: targetMonth, person: b.person, type: b.type,
      category: b.category, planned_amount_ars: b.planned,
    }));
    const { data } = await supabase.from("budgets").insert(rows).select();
    if (data) {
      setBudgets((prev) => [
        ...data.map((d) => ({ id: d.id, month: d.budget_month, person: d.person, type: d.type, category: d.category, planned: d.planned_amount_ars })),
        ...prev,
      ]);
    }
    return { count: toInsert.length };
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
      if (filters.dateFrom && m.date < filters.dateFrom) return false;
      if (filters.dateTo && m.date > filters.dateTo) return false;
      if (filters.fv !== "all" && (m.type !== "Egreso" || getFV(m.type, m.category) !== filters.fv)) return false;
      return true;
    });
  }, [personMovements, filters, getFV]);

  const goalProgress = useMemo(() => {
    return personGoals.filter((g) => g.active !== false).map((g) => {
      const currentArs = personMovements.filter((m) => {
        const inPeriod = g.period_type === "Anual"
          ? m.date.slice(0, 4) === reportMonth.slice(0, 4)
          : monthKey(m.date) === reportMonth;
        if (!inPeriod) return false;
        // Direct link takes priority, otherwise auto-match by category name
        if (m.linkedGoalId === g.id) return true;
        if (!m.linkedGoalId && (m.type === "Ahorro" || m.type === "Inversión") &&
            m.category.toLowerCase() === g.name.toLowerCase()) return true;
        return false;
      }).reduce((a, b) => a + b.amountArs, 0);
      const pct = Number(g.target_amount || 0) > 0 ? (currentArs / Number(g.target_amount)) * 100 : 0;
      return { ...g, currentArs, pct };
    });
  }, [personGoals, personMovements, reportMonth]);

  function exportCSV() {
    const headers = ["Fecha","Persona","Tipo","Categoría","F/V","Descripción","Moneda","Original","TC","ARS","USD"];
    const rows = filteredMovements.map((m) => [
      m.date, m.person, m.type, m.category, m.type === "Egreso" ? getFV(m.type, m.category) : "", m.description || "",
      m.currency, m.originalAmount, m.fxRate, Number(m.amountArs || 0).toFixed(2), Number(m.amountUsd || 0).toFixed(2),
    ]);
    downloadCSV([headers, ...rows], `movimientos_${filters.dateFrom}_${filters.dateTo}`);
  }

  function exportSection(section) {
    let headers, rows, filename;
    if (section === "deudas") {
      headers = ["Nombre","Responsable","Saldo","Cuota","Día venc.","Prioridad","Tasa","Total pagado","Estado","Notas"];
      rows = debts.map((d) => [d.name, d.owner, d.balance, d.installment, d.dueDay, d.priority, d.rate, d.totalPaid || 0, d.status, d.notes || ""]);
      filename = "deudas";
    } else if (section === "presupuesto") {
      headers = ["Mes","Persona","Tipo","Categoría","Presupuestado","Real","Diferencia","% Ejecución"];
      rows = budgetComparison.map((b) => [b.month, b.person, b.type, b.category, b.planned.toFixed(2), b.actual.toFixed(2), b.difference.toFixed(2), b.execution.toFixed(1) + "%"]);
      filename = `presupuesto_${reportMonth}`;
    } else if (section === "metas") {
      headers = ["Nombre","Responsable","Tipo","Periodicidad","Objetivo","Actual","Pendiente","% Avance"];
      rows = goalProgress.map((g) => [g.name, g.owner, g.goal_type, g.period_type, g.target_amount || 0, g.currentArs.toFixed(2), Math.max(0, (g.target_amount || 0) - g.currentArs).toFixed(2), g.pct.toFixed(1) + "%"]);
      filename = `metas_${reportMonth}`;
    } else if (section === "desviaciones") {
      // Build deviation report: for each budget in the period, show real vs planned
      const months = new Set(filteredMovements.map((m) => monthKey(m.date)));
      const desvRows = [];
      budgets.filter((b) => months.has(b.month) && (selectedPerson === "all" || b.person === selectedPerson)).forEach((b) => {
        const actual = filteredMovements.filter((m) => monthKey(m.date) === b.month && m.person === b.person && m.type === b.type && m.category === b.category).reduce((a, c) => a + c.amountArs, 0);
        const diff = b.planned - actual;
        const exec = b.planned > 0 ? (actual / b.planned * 100).toFixed(1) + "%" : "—";
        desvRows.push([b.month, b.person, b.type, b.category, b.planned.toFixed(2), actual.toFixed(2), diff.toFixed(2), exec]);
      });
      headers = ["Mes","Persona","Tipo","Categoría","Presupuestado","Real","Diferencia","% Ejecución"];
      rows = desvRows;
      filename = `desviaciones_${filters.dateFrom}_${filters.dateTo}`;
    }
    if (headers && rows && filename) downloadCSV([headers, ...rows], filename);
  }

  function downloadCSV(data, filename) {
    const csv = data.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${filename}.csv`; a.click();
  }

  async function closeMonth(month) {
    if (!window.confirm(`¿Cerrar el mes ${month}? No podrás editar movimientos de ese período.`)) return;
    const existing = monthlyBalances.find((b) => b.balance_month === month);
    const closing = (() => {
      const rec = monthlyBalances.find((b) => b.balance_month === month);
      const opening = rec?.opening_balance_ars || 0;
      const monthMovs = personMovements.filter((m) => monthKey(m.date) === month);
      const inc = monthMovs.filter((m) => m.type === "Ingreso").reduce((a, b) => a + b.amountArs, 0);
      const exp = monthMovs.filter((m) => m.type === "Egreso").reduce((a, b) => a + b.amountArs, 0);
      const sav = monthMovs.filter((m) => m.type === "Ahorro").reduce((a, b) => a + b.amountArs, 0);
      const inv = monthMovs.filter((m) => m.type === "Inversión").reduce((a, b) => a + b.amountArs, 0);
      return opening + inc - exp - sav - inv;
    })();
    // Compute next month
    const [y, mo] = month.split("-").map(Number);
    const nextDate = new Date(y, mo, 1);
    const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;

    // Mark current month as closed
    if (existing) {
      await supabase.from("monthly_balances").update({ closed: true, closing_balance_ars: closing }).eq("id", existing.id);
      setMonthlyBalances((prev) => prev.map((b) => b.balance_month === month ? { ...b, closed: true, closing_balance_ars: closing } : b));
    } else {
      const { data } = await supabase.from("monthly_balances").insert([{ balance_month: month, opening_balance_ars: 0, closing_balance_ars: closing, closed: true }]).select().single();
      if (data) setMonthlyBalances((prev) => [data, ...prev]);
    }
    // Auto-set next month opening if not already set
    const nextExisting = monthlyBalances.find((b) => b.balance_month === nextMonth);
    if (!nextExisting) {
      const { data: nd } = await supabase.from("monthly_balances").insert([{ balance_month: nextMonth, opening_balance_ars: Math.round(closing), closed: false }]).select().single();
      if (nd) setMonthlyBalances((prev) => [nd, ...prev]);
    } else if (!nextExisting.opening_balance_ars) {
      await supabase.from("monthly_balances").update({ opening_balance_ars: Math.round(closing) }).eq("id", nextExisting.id);
      setMonthlyBalances((prev) => prev.map((b) => b.balance_month === nextMonth ? { ...b, opening_balance_ars: Math.round(closing) } : b));
    }
  }

  const selectedDebtForMov = personDebts.find((d) => String(d.id) === String(movForm.linkedDebtId));
  const availableGoalsForMov = personGoals.filter((g) => g.active !== false && g.goal_type === movForm.type);
  const descriptionSuggestions = useMemo(() => {
    if (!movForm.category) return [];
    const seen = new Set();
    movements.forEach((m) => { if (m.category === movForm.category && m.description?.trim()) seen.add(m.description.trim()); });
    return Array.from(seen).sort();
  }, [movements, movForm.category]);
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
          <div className="header-controls" />
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
              <Input type="month" value={reportMonth} onChange={(e) => {
                const m = e.target.value;
                setReportMonth(m);
                const [y, mo] = m.split("-").map(Number);
                const lastDay = new Date(y, mo, 0).getDate();
                setFilters((f) => ({ ...f, dateFrom: `${m}-01`, dateTo: `${m}-${String(lastDay).padStart(2,"0")}` }));
              }} />
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
                <Field label="Categoría"><Select value={movForm.category} onChange={(v) => setMovForm({ ...movForm, category: v, linkedDebtId: v !== "Deuda" ? "" : movForm.linkedDebtId })} disabled={!movForm.type}><option value="">Seleccionar…</option>{(categoryMap[movForm.type] || []).map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field>
                {movForm.type === "Egreso" && movForm.category === "Deuda" && <Field label="Deuda"><Select value={movForm.linkedDebtId} onChange={(v) => setMovForm({ ...movForm, linkedDebtId: v, originalAmount: personDebts.find((d) => String(d.id) === String(v))?.installment || "" })}><option value="">Elegir deuda…</option>{personDebts.map((d) => <option key={d.id} value={String(d.id)}>{d.name} ({fmtArs(d.balance)} pendiente)</option>)}</Select></Field>}

                <Field label="Moneda"><Select value={movForm.currency} onChange={(v) => setMovForm({ ...movForm, currency: v })}><option value="ARS">Pesos (ARS)</option><option value="USD">Dólar blue (USD)</option></Select></Field>
                <Field label={`Importe${movForm.currency === "USD" ? " (USD)" : " (ARS)"}`}><Input type="number" value={movForm.originalAmount} onChange={(e) => setMovForm({ ...movForm, originalAmount: e.target.value })} placeholder="0" /></Field>
                <Field label="Descripción / subcategoría"><DescriptionAutocomplete value={movForm.description} onChange={(v) => setMovForm({ ...movForm, description: v })} suggestions={descriptionSuggestions} /></Field>
              </div>
              {selectedDebtForMov && movForm.category === "Deuda" && <InfoBox color="blue">Cuota sugerida: <strong>{fmtArs(selectedDebtForMov.installment)}</strong> · Saldo pendiente: <strong>{fmtArs(selectedDebtForMov.balance)}</strong>.</InfoBox>}
              {movForm.currency === "USD" && <InfoBox color="amber">Cotización blue del momento: <strong>{money(blueRate)}</strong> por USD · Importe en ARS: <strong>{money(toArs(movForm.originalAmount || 0, "USD", blueRate))}</strong></InfoBox>}
              {movForm.type && movForm.category && (movForm.type === "Egreso" || movForm.type === "Ingreso") && (() => {
                const monthMov = monthKey(movForm.date);
                const hasBudget = budgets.some((b) => b.month === monthMov && b.person === movForm.person && b.type === movForm.type && b.category === movForm.category);
                return !hasBudget ? <InfoBox color="amber">⚠️ No hay presupuesto cargado para <strong>{movForm.category}</strong> · {movForm.person} en {monthMov}. Podés cargarlo en la pestaña Presupuesto.</InfoBox> : null;
              })()}
              <div style={{ marginTop: 16 }}><Btn onClick={addMovement} disabled={saving || !movForm.type || !movForm.category || !movForm.originalAmount}>{saving ? "Guardando…" : "＋ Agregar movimiento"}</Btn></div>
            </Card>

            <Card>
              <CardHead title="Transferencia entre tipos" icon="🔀" />
              <p className="muted small" style={{ marginBottom: 12 }}>
                Movés plata de un tipo a otro (ej. Ahorro → Inversión). Se crean dos movimientos automáticamente: uno que resta del origen y otro que suma en el destino.
              </p>
              <div className="form-grid">
                <Field label="Fecha">
                  <Input type="date" value={transferForm.date} onChange={(e) => setTransferForm({ ...transferForm, date: e.target.value })} />
                </Field>
                <Field label="Persona">
                  <Select value={transferForm.person} onChange={(v) => setTransferForm({ ...transferForm, person: v })}>
                    {people.map((p) => <option key={p} value={p}>{p}</option>)}
                  </Select>
                </Field>
                <Field label="Moneda">
                  <Select value={transferForm.currency} onChange={(v) => setTransferForm({ ...transferForm, currency: v })}>
                    <option value="ARS">Pesos (ARS)</option>
                    <option value="USD">Dólar blue (USD)</option>
                  </Select>
                </Field>
                <Field label={`Importe (${transferForm.currency})`}>
                  <Input type="number" value={transferForm.originalAmount} onChange={(e) => setTransferForm({ ...transferForm, originalAmount: e.target.value })} placeholder="0" />
                </Field>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "end", margin: "12px 0" }}>
                {/* ORIGEN */}
                <div style={{ display: "grid", gap: 8, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: 12 }}>
                  <div className="field-label" style={{ color: "#dc2626" }}>⬆ Origen (resta de…)</div>
                  <Field label="Tipo">
                    <Select value={transferForm.fromType} onChange={(v) => setTransferForm({ ...transferForm, fromType: v, fromCategory: "" })}>
                      {types.map((t) => <option key={t} value={t}>{t}</option>)}
                    </Select>
                  </Field>
                  <Field label="Categoría">
                    <Select value={transferForm.fromCategory} onChange={(v) => setTransferForm({ ...transferForm, fromCategory: v })}>
                      <option value="">Seleccionar…</option>
                      {(categoryMap[transferForm.fromType] || []).map((c) => <option key={c} value={c}>{c}</option>)}
                    </Select>
                  </Field>
                </div>
                {/* FLECHA */}
                <div style={{ textAlign: "center", fontSize: "1.5rem", paddingBottom: 8 }}>→</div>
                {/* DESTINO */}
                <div style={{ display: "grid", gap: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: 12 }}>
                  <div className="field-label" style={{ color: "#16a34a" }}>⬇ Destino (suma a…)</div>
                  <Field label="Tipo">
                    <Select value={transferForm.toType} onChange={(v) => setTransferForm({ ...transferForm, toType: v, toCategory: "" })}>
                      {types.map((t) => <option key={t} value={t}>{t}</option>)}
                    </Select>
                  </Field>
                  <Field label="Categoría">
                    <Select value={transferForm.toCategory} onChange={(v) => setTransferForm({ ...transferForm, toCategory: v })}>
                      <option value="">Seleccionar…</option>
                      {(categoryMap[transferForm.toType] || []).map((c) => <option key={c} value={c}>{c}</option>)}
                    </Select>
                  </Field>
                </div>
              </div>
              <Field label="Descripción (opcional)">
                <Input value={transferForm.description} onChange={(e) => setTransferForm({ ...transferForm, description: e.target.value })} placeholder={`Ej. Paso fondos de ${transferForm.fromCategory || "origen"} a ${transferForm.toCategory || "destino"}`} />
              </Field>
              {transferForm.originalAmount && (
                <InfoBox color="blue" style={{ marginTop: 10 }}>
                  Se crearán 2 movimientos por <strong>{transferForm.currency === "USD" ? money(transferForm.originalAmount, "USD") : money(toArs(transferForm.originalAmount, "ARS", 1))}</strong>:
                  un <strong>{transferForm.fromType}</strong> de {transferForm.fromCategory || "…"} y
                  un <strong>{transferForm.toType}</strong> de {transferForm.toCategory || "…"}.
                </InfoBox>
              )}
              <div style={{ marginTop: 14 }}>
                <Btn
                  onClick={addTransfer}
                  disabled={saving || !transferForm.fromCategory || !transferForm.toCategory || !transferForm.originalAmount || transferForm.fromType === transferForm.toType && transferForm.fromCategory === transferForm.toCategory}
                >
                  {saving ? "Guardando…" : "🔀 Registrar transferencia"}
                </Btn>
              </div>
            </Card>
          </div>
        )}

        {tab === "dashboard" && (
          <div className="tab-content">
            <Card>
              <CardHead title="Vista general" icon="📌" />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div className="muted small">Persona: {selectedPerson === "all" ? "Todas" : selectedPerson} · Mes: {reportMonth}</div>
                {(() => {
                  const rec = monthlyBalances.find((b) => b.balance_month === reportMonth);
                  const isClosed = rec?.closed;
                  return isClosed
                    ? <Badge color="purple">🔒 Mes cerrado</Badge>
                    : <Btn small variant="outline" onClick={() => closeMonth(reportMonth)}>🔒 Cerrar mes</Btn>;
                })()}
              </div>
            </Card>
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
                  {(() => {
                    const cvt = (v) => displayCurrency === "USD" ? fmt(v / Math.max(blueRate, 1)) : fmtArs(v);
                    const types4 = [
                      { key: "Ingreso",   label: "＋ Ingresos",  val: monthBalance.inc, cls: "green",  icon: "💵" },
                      { key: "Egreso",    label: "− Gastos",     val: monthBalance.exp, cls: "red",    icon: "💸" },
                      { key: "Ahorro",    label: "− Ahorro",     val: monthBalance.sav, cls: "amber",  icon: "🐷" },
                      { key: "Inversión", label: "− Inversión",  val: monthBalance.inv, cls: "",       icon: "📈" },
                    ];
                    return (<>
                      {/* Saldo inicial — aligned under Real column */}
                      <div className="balance-row" style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px 80px", gap: 6, alignItems: "center" }}>
                        <span>Saldo inicial</span>
                        <span></span>
                        <strong style={{ textAlign: "right" }}>{cvt(monthBalance.opening)}</strong>
                        <span></span>
                      </div>
                      {/* Column headers */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px 80px", gap: 6, padding: "4px 14px", fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        <span></span><span style={{ textAlign: "right" }}>Presp.</span><span style={{ textAlign: "right" }}>Real</span><span style={{ textAlign: "right" }}>Desv.</span>
                      </div>
                      {types4.map(({ key, label, val, cls, icon }) => {
                        const budgeted = budgets.filter((b) => b.month === reportMonth && b.type === key && (selectedPerson === "all" || b.person === selectedPerson)).reduce((a, b) => a + b.planned, 0);
                        const isExpanded = expandedTypes[key];
                        // deviation: for Egreso/Ahorro/Inversión: negative = over budget (bad), positive = under (good). Ingreso: positive = over (good)
                        const desvArs = key === "Ingreso" ? val - budgeted : budgeted - val;
                        const desvColor = budgeted === 0 ? "var(--muted)" : desvArs >= 0 ? "var(--green)" : "var(--red)";
                        const catBreakdown = (() => {
                          const bucket = {};
                          personMovements.filter((m) => monthKey(m.date) === reportMonth && m.type === key).forEach((m) => {
                            if (!bucket[m.category]) bucket[m.category] = { real: 0 };
                            bucket[m.category].real += m.amountArs;
                          });
                          // add budget per category
                          budgets.filter((b) => b.month === reportMonth && b.type === key && (selectedPerson === "all" || b.person === selectedPerson)).forEach((b) => {
                            if (!bucket[b.category]) bucket[b.category] = { real: 0 };
                            bucket[b.category].budget = (bucket[b.category].budget || 0) + b.planned;
                          });
                          return Object.entries(bucket).sort((a, b) => b[1].real - a[1].real);
                        })();
                        return (
                          <div key={key}>
                            <div
                              className={`balance-row ${cls}`}
                              style={{ cursor: catBreakdown.length > 0 ? "pointer" : "default", userSelect: "none", display: "grid", gridTemplateColumns: "1fr 90px 90px 80px", gap: 6, alignItems: "center" }}
                              onClick={() => catBreakdown.length > 0 && setExpandedTypes((p) => ({ ...p, [key]: !p[key] }))}
                            >
                              <span>{label} {catBreakdown.length > 0 ? (isExpanded ? "▲" : "▼") : ""}</span>
                              <span style={{ textAlign: "right", fontSize: "0.85rem", color: "var(--muted)" }}>{budgeted > 0 ? cvt(budgeted) : "—"}</span>
                              <strong style={{ textAlign: "right" }}>{cvt(val)}</strong>
                              <span style={{ textAlign: "right", fontWeight: 700, fontSize: "0.85rem", color: budgeted > 0 ? desvColor : "var(--muted)" }}>
                                {budgeted > 0 ? (desvArs >= 0 ? "+" : "") + cvt(desvArs) : "—"}
                              </span>
                            </div>
                            {isExpanded && catBreakdown.map(([cat, data]) => {
                              const catBudget = data.budget || 0;
                              const catReal = data.real;
                              const catDesv = key === "Ingreso" ? catReal - catBudget : catBudget - catReal;
                              const catDesvColor = catBudget === 0 ? "var(--muted)" : catDesv >= 0 ? "var(--green)" : "var(--red)";
                              return (
                                <div key={cat} style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px 80px", gap: 6, alignItems: "center", padding: "7px 14px", background: "#f8fafc", borderBottom: "1px solid var(--border)", fontSize: "0.85rem" }}>
                                  <span className="muted" style={{ paddingLeft: 16 }}>{cat}</span>
                                  <span style={{ textAlign: "right", color: "var(--muted)" }}>{catBudget > 0 ? cvt(catBudget) : "—"}</span>
                                  <span style={{ textAlign: "right", fontWeight: 700 }}>{cvt(catReal)}</span>
                                  <span style={{ textAlign: "right", fontWeight: 700, color: catBudget > 0 ? catDesvColor : "var(--muted)" }}>
                                    {catBudget > 0 ? (catDesv >= 0 ? "+" : "") + cvt(catDesv) : "—"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                      {/* Saldo final — aligned under Real column */}
                      <div className="balance-row total" style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px 80px", gap: 6, alignItems: "center" }}>
                        <span>= Saldo final</span>
                        <span></span>
                        <strong style={{ textAlign: "right" }}>{cvt(monthBalance.closing)}</strong>
                        <span></span>
                      </div>
                    </>);
                  })()}
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
                <Field label="Desde"><Input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} /></Field>
                <Field label="Hasta"><Input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} /></Field>
                <Field label="Tipo"><Select value={filters.type} onChange={(v) => setFilters({ ...filters, type: v })}><option value="all">Todos</option>{types.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
                <Field label="Categoría"><Select value={filters.category} onChange={(v) => setFilters({ ...filters, category: v })}><option value="all">Todas</option>{Object.values(categoryMap).flat().map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field>
                <Field label="F/V"><Select value={filters.fv} onChange={(v) => setFilters({ ...filters, fv: v })}><option value="all">Todos</option><option value="F">Fijos</option><option value="V">Variables</option></Select></Field>
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Btn onClick={exportCSV} variant="outline">⬇ Exportar movimientos</Btn>
                <Btn onClick={() => exportSection("desviaciones")} variant="outline">⬇ Exportar desviaciones</Btn>
                <span className="muted small" style={{ alignSelf: "center" }}>{filteredMovements.length} registros</span>
              </div>
            </Card>
            <Card>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Fecha</th><th>Persona</th><th>Tipo</th><th>Categoría</th><th>F/V</th><th>Descripción</th><th>Moneda</th><th>Original</th><th>ARS</th><th>USD</th><th></th></tr></thead>
                  <tbody>
                    {filteredMovements.map((m) => {
                      const isEditing = editingMovId === m.id;
                      const isClosed = monthlyBalances.find((b) => b.balance_month === monthKey(m.date) && b.closed);
                      return (
                        <tr key={m.id}>
                          <td>{m.date}</td><td>{m.person}</td>
                          <td><Badge color={m.type === "Ingreso" ? "green" : m.type === "Egreso" ? "red" : m.type === "Ahorro" ? "blue" : "purple"}>{m.type}</Badge></td>
                          <td>{m.category}</td>
                          <td>{m.type === "Egreso" ? <Badge color={getFV(m.type, m.category) === "F" ? "red" : "amber"}>{getFV(m.type, m.category)}</Badge> : "—"}</td>
                          <td className="muted">
                            {isEditing
                              ? <Input value={editMovData.description} onChange={(e) => setEditMovData((d) => ({ ...d, description: e.target.value }))} placeholder="Descripción" />
                              : m.description || "—"}
                          </td>
                          <td>{m.currency}</td>
                          <td className="number">
                            {isEditing
                              ? <Input type="number" value={editMovData.originalAmount} onChange={(e) => setEditMovData((d) => ({ ...d, originalAmount: e.target.value }))} style={{ width: 100 }} />
                              : money(m.originalAmount, m.currency)}
                          </td>
                          <td className="number fw">{fmtArs(m.amountArs)}</td>
                          <td className="number muted">{money(m.amountUsd || 0, "USD")}</td>
                          <td style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            {!isClosed && (
                              isEditing
                                ? <>
                                    <button className="del-btn" style={{ borderColor: "#bbf7d0", color: "#16a34a" }} onClick={() => saveEditMovement(m.id)}>✓</button>
                                    <button className="del-btn" onClick={() => setEditingMovId(null)}>✕</button>
                                  </>
                                : <button className="del-btn" style={{ borderColor: "#bfdbfe", color: "#1e40af" }} onClick={() => { setEditingMovId(m.id); setEditMovData({ originalAmount: String(m.originalAmount), description: m.description || "" }); }}>✏</button>
                            )}
                            {!isClosed && <button className="del-btn" onClick={() => deleteMovement(m.id)}>🗑</button>}
                            {isClosed && <span className="muted small">🔒</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredMovements.length === 0 && <EmptyState msg="No hay movimientos con esos filtros." />}
              </div>
              {/* Mobile cards — visible below 780px via CSS */}
              <div className="cards-mobile">
                {filteredMovements.map((m) => {
                  const isEditing = editingMovId === m.id;
                  const isClosed = monthlyBalances.find((b) => b.balance_month === monthKey(m.date) && b.closed);
                  return (
                    <div key={m.id} className="mov-card">
                      <div className="mov-card-head">
                        <div>
                          <Badge color={m.type === "Ingreso" ? "green" : m.type === "Egreso" ? "red" : m.type === "Ahorro" ? "blue" : "purple"}>{m.type}</Badge>
                          <span style={{ marginLeft: 8, fontWeight: 700 }}>{m.category}</span>
                          {m.type === "Egreso" && <Badge color={getFV(m.type, m.category) === "F" ? "red" : "amber"} style={{ marginLeft: 6 }}>{getFV(m.type, m.category)}</Badge>}
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          {!isClosed && (isEditing
                            ? <>
                                <button className="del-btn" style={{ borderColor: "#bbf7d0", color: "#16a34a" }} onClick={() => saveEditMovement(m.id)}>✓</button>
                                <button className="del-btn" onClick={() => setEditingMovId(null)}>✕</button>
                              </>
                            : <button className="del-btn" style={{ borderColor: "#bfdbfe", color: "#1e40af" }} onClick={() => { setEditingMovId(m.id); setEditMovData({ originalAmount: String(m.originalAmount), description: m.description || "" }); }}>✏</button>
                          )}
                          {!isClosed && <button className="del-btn" onClick={() => deleteMovement(m.id)}>🗑</button>}
                          {isClosed && <span className="muted small">🔒</span>}
                        </div>
                      </div>
                      <div className="mov-card-amounts">
                        <div><span className="muted small">Fecha</span><div>{m.date}</div></div>
                        <div><span className="muted small">Persona</span><div>{m.person}</div></div>
                        <div><span className="muted small">{m.currency === "USD" ? "USD" : "ARS"}</span>
                          <div className="fw">
                            {isEditing
                              ? <Input type="number" value={editMovData.originalAmount} onChange={(e) => setEditMovData((d) => ({ ...d, originalAmount: e.target.value }))} />
                              : money(m.originalAmount, m.currency)}
                          </div>
                        </div>
                        <div><span className="muted small">ARS</span><div className="fw">{fmtArs(m.amountArs)}</div></div>
                      </div>
                      {isEditing && (
                        <Input value={editMovData.description} onChange={(e) => setEditMovData((d) => ({ ...d, description: e.target.value }))} placeholder="Descripción" />
                      )}
                      {!isEditing && m.description && <div className="muted small">{m.description}</div>}
                    </div>
                  );
                })}
                {filteredMovements.length === 0 && <EmptyState msg="No hay movimientos con esos filtros." />}
              </div>
            </Card>
          </div>
        )}

        {tab === "presupuesto" && (
          <div className="tab-content">
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Btn small variant="outline" onClick={() => exportSection("presupuesto")}>⬇ Exportar presupuesto CSV</Btn>
              <Btn small variant="outline" onClick={() => exportSection("metas")}>⬇ Exportar metas CSV</Btn>
            </div>
            <Card>
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}
                onClick={() => setExpandedTypes((p) => ({ ...p, _saldoInicial: !p._saldoInicial }))}
              >
                <CardHead title="Saldo inicial del mes" icon="🏦" />
                <span className="muted small" style={{ paddingRight: 4 }}>{expandedTypes._saldoInicial ? "▲ ocultar" : "▼ editar"}</span>
              </div>
              {expandedTypes._saldoInicial && (() => {
                // Compute previous month closing to suggest as opening
                const prevMonth = (() => {
                  const [y, m] = balanceForm.month.split("-").map(Number);
                  const d = new Date(y, m - 2, 1);
                  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                })();
                const prevRec = monthlyBalances.find((b) => b.balance_month === prevMonth);
                const prevOpening = prevRec?.opening_balance_ars || 0;
                const prevMovs = personMovements.filter((m) => monthKey(m.date) === prevMonth);
                const prevInc = prevMovs.filter((m) => m.type === "Ingreso").reduce((a, b) => a + b.amountArs, 0);
                const prevExp = prevMovs.filter((m) => m.type === "Egreso").reduce((a, b) => a + b.amountArs, 0);
                const prevSav = prevMovs.filter((m) => m.type === "Ahorro").reduce((a, b) => a + b.amountArs, 0);
                const prevInv = prevMovs.filter((m) => m.type === "Inversión").reduce((a, b) => a + b.amountArs, 0);
                const suggestedOpening = prevOpening + prevInc - prevExp - prevSav - prevInv;
                const hasSuggestion = prevInc > 0 || prevExp > 0 || prevOpening > 0;
                return (
                  <>
                    <div className="form-grid three-col">
                      <Field label="Mes"><Input type="month" value={balanceForm.month} onChange={(e) => setBalanceForm({ ...balanceForm, month: e.target.value })} /></Field>
                      <Field label="Saldo inicial (ARS)"><Input type="number" value={balanceForm.opening} onChange={(e) => setBalanceForm({ ...balanceForm, opening: e.target.value })} placeholder="0" /></Field>
                      <Field label="Notas"><Input value={balanceForm.notes} onChange={(e) => setBalanceForm({ ...balanceForm, notes: e.target.value })} placeholder="Opcional" /></Field>
                    </div>
                    {hasSuggestion && (
                      <InfoBox color="blue">
                        Saldo final de {prevMonth}: <strong>{fmtArs(suggestedOpening)}</strong> · 
                        <button
                          onClick={() => setBalanceForm((f) => ({ ...f, opening: String(Math.round(suggestedOpening)) }))}
                          style={{ marginLeft: 8, background: "none", border: "none", color: "#1e40af", fontWeight: 700, cursor: "pointer", textDecoration: "underline", fontSize: "inherit" }}
                        >Usar este valor</button>
                      </InfoBox>
                    )}
                    <div style={{ marginTop: 12 }}><Btn onClick={saveBalance}>Guardar saldo inicial</Btn></div>
                  </>
                );
              })()}
            </Card>

            <Card>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                <CardHead title="Agregar presupuesto" icon="🎯" />
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {copyBudgetMsg && <span className="muted small">{copyBudgetMsg}</span>}
                  <Btn small variant="outline" onClick={async () => {
                    setCopyBudgetMsg("Copiando…");
                    const result = await copyBudgetFromPrevMonth(budgetForm.month);
                    if (result.skipped) setCopyBudgetMsg("Ya están todos cargados para este mes.");
                    else if (result.count === 0) setCopyBudgetMsg("No hay presupuesto en el mes anterior.");
                    else setCopyBudgetMsg(`✓ ${result.count} línea${result.count !== 1 ? "s" : ""} copiada${result.count !== 1 ? "s" : ""}`);
                    setTimeout(() => setCopyBudgetMsg(""), 3000);
                  }}>📋 Copiar mes anterior</Btn>
                </div>
              </div>
              <div className="form-grid">
                <Field label="Mes"><Input type="month" value={budgetForm.month} onChange={(e) => setBudgetForm({ ...budgetForm, month: e.target.value })} /></Field>
                <Field label="Persona"><Select value={budgetForm.person} onChange={(v) => setBudgetForm({ ...budgetForm, person: v })}>{people.map((p) => <option key={p} value={p}>{p}</option>)}</Select></Field>
                <Field label="Tipo"><Select value={budgetForm.type} onChange={(v) => setBudgetForm({ ...budgetForm, type: v, category: (categoryMap[v] || [])[0] || "" })}>{types.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
                <Field label="Categoría"><Select value={budgetForm.category} onChange={(v) => setBudgetForm({ ...budgetForm, category: v })}>{(categoryMap[budgetForm.type] || []).map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field>
                <Field label="Importe presupuestado"><Input type="number" value={budgetForm.planned} onChange={(e) => setBudgetForm({ ...budgetForm, planned: e.target.value })} placeholder="0" /></Field>
              </div>
              <div style={{ marginTop: 12 }}><Btn onClick={addBudget}>＋ Agregar línea</Btn></div>
            </Card>

            <Card>
              <CardHead title="Presupuesto vs Real" icon="📊" />
              {budgetComparison.length === 0 && <EmptyState msg="No hay presupuestos para este mes." />}
              {/* Group by type */}
              {["Egreso","Ingreso","Ahorro","Inversión"].map((tipo) => {
                const rows = budgetComparison.filter((b) => b.type === tipo);
                if (!rows.length) return null;
                return (
                  <div key={tipo} style={{ marginBottom: 18 }}>
                    <div className="budget-type-header">{tipo === "Egreso" ? "💸" : tipo === "Ingreso" ? "💵" : tipo === "Ahorro" ? "🐷" : "📈"} {tipo}</div>
                    {rows.map((b) => {
                      const isExp = b.type === "Egreso" || b.type === "Ahorro" || b.type === "Inversión";
                      const over = b.execution > 100;
                      const warn = b.execution >= 85;
                      const barColor = isExp
                        ? (over ? "#dc2626" : warn ? "#f59e0b" : "#16a34a")
                        : (over ? "#16a34a" : "#2563eb");
                      const badgeColor = isExp
                        ? (over ? "red" : warn ? "amber" : "green")
                        : (over ? "green" : "blue");
                      const pct = Math.min(100, b.execution);
                      // Signo correcto: egreso/ahorro/inversión superado = negativo; ingreso superado = positivo
                      const diff = isExp ? b.planned - b.actual : b.actual - b.planned;
                      const diffColor = diff >= 0 ? "green" : "red";
                      return (
                        <div key={b.id} className="budget-inline-row">
                          <div className="budget-inline-left">
                            <span className="budget-inline-cat">{b.category}</span>
                            <span className="muted small">{b.person}</span>
                          </div>
                          <div className="budget-inline-bar-wrap">
                            <div className="budget-inline-bar-track">
                              <div className="budget-inline-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
                            </div>
                            <div className="budget-inline-nums">
                              <span className="muted small">{fmt(displayCurrency === "USD" ? b.actual/Math.max(blueRate,1) : b.actual)} / {fmt(displayCurrency === "USD" ? b.planned/Math.max(blueRate,1) : b.planned)}</span>
                              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: diffColor }}>{diff >= 0 ? "+" : ""}{fmt(displayCurrency === "USD" ? diff/Math.max(blueRate,1) : diff)}</span>
                            </div>
                          </div>
                          <div className="budget-inline-right">
                            <Badge color={badgeColor}>{b.execution.toFixed(0)}%</Badge>
                            <button className="del-btn" onClick={() => deleteBudget(b.id)}>🗑</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </Card>

            <Card>
              <CardHead title="Crear meta" icon="⭐" />
              <InfoBox color="blue">💡 El nombre de la meta es la categoría — así los movimientos de esa categoría se acumulan automáticamente.</InfoBox>
              <div className="form-grid" style={{ marginTop: 12 }}>
                <Field label="Tipo"><Select value={goalForm.goalType} onChange={(v) => setGoalForm({ ...goalForm, goalType: v, name: (categoryMap[v] || [])[0] || "" })}><option value="Ahorro">Ahorro</option><option value="Inversión">Inversión</option></Select></Field>
                <Field label="Categoría (= nombre de meta)"><Select value={goalForm.name} onChange={(v) => setGoalForm({ ...goalForm, name: v })}><option value="">Seleccionar…</option>{(categoryMap[goalForm.goalType] || []).map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field>
                <Field label="Responsable"><Select value={goalForm.owner} onChange={(v) => setGoalForm({ ...goalForm, owner: v })}>{people.map((p) => <option key={p} value={p}>{p}</option>)}</Select></Field>
                <Field label="Periodicidad"><Select value={goalForm.periodType} onChange={(v) => setGoalForm({ ...goalForm, periodType: v })}><option value="Mensual">Mensual</option><option value="Anual">Anual</option></Select></Field>
                <Field label="Objetivo (ARS)"><Input type="number" value={goalForm.target} onChange={(e) => setGoalForm({ ...goalForm, target: e.target.value })} /></Field>
                <Field label="Notas"><Input value={goalForm.notes} onChange={(e) => setGoalForm({ ...goalForm, notes: e.target.value })} /></Field>
              </div>
              <div style={{ marginTop: 12 }}><Btn onClick={addGoal}>＋ Crear meta</Btn></div>
            </Card>

            <Card>
              <CardHead title="Avance de metas" icon="🚀" />
              {!goalProgress.length && <EmptyState msg="No hay metas cargadas." />}
              {goalProgress.map((g) => {
                const pct = Math.min(100, g.pct);
                const barColor = pct >= 100 ? "#16a34a" : pct >= 60 ? "#2563eb" : "#f59e0b";
                return (
                  <div key={g.id} className="budget-inline-row">
                    <div className="budget-inline-left">
                      <span className="budget-inline-cat">{g.name}</span>
                      <span className="muted small">{g.owner} · {g.goal_type} · {g.period_type}</span>
                    </div>
                    <div className="budget-inline-bar-wrap">
                      <div className="budget-inline-bar-track">
                        <div className="budget-inline-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
                      </div>
                      <div className="budget-inline-nums">
                        <span className="muted small">{fmt(displayCurrency === "USD" ? g.currentArs / Math.max(blueRate,1) : g.currentArs)} / {fmt(displayCurrency === "USD" ? (g.target_amount||0) / Math.max(blueRate,1) : (g.target_amount||0))}</span>
                        <span className="muted small">Faltan {fmt(displayCurrency === "USD" ? Math.max(0,(g.target_amount||0)-g.currentArs)/Math.max(blueRate,1) : Math.max(0,(g.target_amount||0)-g.currentArs))}</span>
                      </div>
                    </div>
                    <div className="budget-inline-right">
                      <Badge color={pct >= 100 ? "green" : pct >= 60 ? "blue" : "amber"}>{g.pct.toFixed(0)}%</Badge>
                      <button className="del-btn" onClick={() => deleteGoal(g.id)}>🗑</button>
                    </div>
                  </div>
                );
              })}
            </Card>
          </div>
        )}

        {tab === "reportes" && (
          <div className="tab-content">
            <div className="two-col">
              <Card>
                <CardHead title={`Gastos por categoría · ${reportMonth}`} icon="🥧" />
                <PieChart data={monthlyByCategory} nameKey="category" valueKey="total" formatter={fmt} />
              </Card>
              <Card>
                <CardHead title={`Gasto por persona · ${reportMonth}`} icon="👥" />
                {!monthlyByPerson.length && <EmptyState msg="Sin egresos para ese mes." />}
                {monthlyByPerson.map((r) => <div key={r.person} className="report-row"><div>{r.person}</div><strong>{fmt(r.total)} · {(r.pct * 100).toFixed(1)}%</strong></div>)}
              </Card>
            </div>
            <Card>
              <CardHead title={`Presupuesto vs Real · ${reportMonth}`} icon="🎯" />
              {(() => {
                const cv = (ars) => displayCurrency === "USD" ? ars / Math.max(blueRate, 1) : ars;
                // Agrupar por tipo+categoría sumando todas las personas (filtro global ya aplica en budgetComparison)
                const grouped = {};
                budgetComparison.forEach((b) => {
                  const key = `${b.type}||${b.category}`;
                  if (!grouped[key]) grouped[key] = { type: b.type, category: b.category, planned: 0, actual: 0 };
                  grouped[key].planned += b.planned;
                  grouped[key].actual  += b.actual;
                });
                const items = Object.values(grouped);
                if (!items.length) return <EmptyState msg="No hay presupuestos para este mes." />;
                return ["Egreso","Ingreso","Ahorro","Inversión"].map((tipo) => {
                  const tipoRows = items.filter((r) => r.type === tipo).sort((a, b) => b.planned - a.planned);
                  if (!tipoRows.length) return null;
                  const tipoIcon = tipo === "Egreso" ? "💸" : tipo === "Ingreso" ? "💵" : tipo === "Ahorro" ? "🐷" : "📈";
                  return (
                    <div key={tipo} style={{ marginBottom: 18 }}>
                      <div className="budget-type-header">{tipoIcon} {tipo.toUpperCase()}</div>
                      {tipoRows.map((b) => {
                        const isExp = tipo === "Egreso" || tipo === "Ahorro" || tipo === "Inversión";
                        const execution = b.planned > 0 ? (b.actual / b.planned) * 100 : 0;
                        const over = execution > 100;
                        const warn = execution >= 85;
                        const barColor = isExp ? (over ? "#dc2626" : warn ? "#f59e0b" : "#16a34a") : (over ? "#16a34a" : "#2563eb");
                        const badgeColor = isExp ? (over ? "red" : warn ? "amber" : "green") : (over ? "green" : "blue");
                        const maxVal = Math.max(b.planned, b.actual, 1);
                        const plannedPct = (b.planned / maxVal) * 100;
                        const actualPct  = Math.min((b.actual / maxVal) * 100, 100);
                        const diff = isExp ? b.planned - b.actual : b.actual - b.planned;
                        const diffColor = diff >= 0 ? "#16a34a" : "#dc2626";
                        return (
                          <div key={b.category} className="budget-inline-row">
                            <div className="budget-inline-left">
                              <span className="budget-inline-cat">{b.category}</span>
                            </div>
                            <div className="budget-inline-bar-wrap">
                              <div style={{ position: "relative", height: 8, borderRadius: 999, background: "#e2e8f0" }}>
                                <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${plannedPct}%`, background: "#cbd5e1", borderRadius: 999 }} />
                                <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${actualPct}%`, background: barColor, borderRadius: 999, opacity: 0.9 }} />
                                {b.actual > b.planned && (
                                  <div style={{ position: "absolute", left: `${plannedPct}%`, top: -2, height: 12, width: `${Math.min(((b.actual - b.planned) / maxVal) * 100, 100 - plannedPct)}%`, background: "#dc2626", borderRadius: "0 999px 999px 0", opacity: 0.75 }} />
                                )}
                              </div>
                              <div className="budget-inline-nums" style={{ marginTop: 4 }}>
                                <span className="muted small">Real: <strong>{fmt(cv(b.actual))}</strong> / Presup.: {fmt(cv(b.planned))}</span>
                                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: diffColor }}>{diff >= 0 ? "+" : ""}{fmt(cv(diff))}</span>
                              </div>
                            </div>
                            <div className="budget-inline-right">
                              <Badge color={badgeColor}>{execution.toFixed(0)}%</Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                });
              })()}
            </Card>
            <div className="two-col">
              <Card>
                <CardHead title="Ingresos vs egresos" icon="📈" />
                <BarChart data={annualByMonth} xKey="month" bars={[{ key: "income", label: "Ingresos", color: "#16a34a" }, { key: "expenses", label: "Egresos", color: "#dc2626" }]} formatter={(v, short) => short ? (displayCurrency === "USD" ? `${v.toFixed(0)}` : `${Math.round(v/1000)}K`) : fmt(v)} />
              </Card>
              <Card>
                <CardHead title="Fijos vs variables" icon="🧩" />
                <BarChart data={annualByMonth} xKey="month" bars={[{ key: "fixed", label: "Fijos", color: "#dc2626" }, { key: "variable", label: "Variables", color: "#f59e0b" }]} formatter={(v, short) => short ? (displayCurrency === "USD" ? `${v.toFixed(0)}` : `${Math.round(v/1000)}K`) : fmt(v)} />
              </Card>
            </div>
          </div>
        )}

        {tab === "deudas" && (
          <div className="tab-content">
            <div style={{ display: "flex", justifyContent: "flex-end" }}><Btn small variant="outline" onClick={() => exportSection("deudas")}>⬇ Exportar deudas CSV</Btn></div>
            <div className="two-col">
              <Card>
                <CardHead title="Agregar deuda" icon="💳" />
                <div className="form-grid two-col-form">
                  <Field label="Nombre"><Input value={debtForm.name} onChange={(e) => setDebtForm({ ...debtForm, name: e.target.value })} /></Field>
                  <Field label="Responsable"><Select value={debtForm.owner} onChange={(v) => setDebtForm({ ...debtForm, owner: v })}>{people.map((p) => <option key={p} value={p}>{p}</option>)}</Select></Field>
                  <Field label="Saldo actual"><Input type="number" value={debtForm.balance} onChange={(e) => setDebtForm({ ...debtForm, balance: e.target.value })} /></Field>
                  <Field label="Cuota estimada"><Input type="number" value={debtForm.installment} onChange={(e) => setDebtForm({ ...debtForm, installment: e.target.value })} /></Field>
                  <Field label="Día de vencimiento"><Input type="number" value={debtForm.dueDay} onChange={(e) => setDebtForm({ ...debtForm, dueDay: e.target.value })} /></Field>
                  <Field label="Prioridad"><Select value={debtForm.priority} onChange={(v) => setDebtForm({ ...debtForm, priority: v })}><option value="Alta">Alta</option><option value="Media">Media</option><option value="Baja">Baja</option></Select></Field>
                  <Field label="Tasa"><Input type="number" value={debtForm.rate} onChange={(e) => setDebtForm({ ...debtForm, rate: e.target.value })} /></Field>
                  <Field label="Notas"><Input value={debtForm.notes} onChange={(e) => setDebtForm({ ...debtForm, notes: e.target.value })} /></Field>
                </div>
                <div style={{ marginTop: 12 }}><Btn onClick={addDebt}>＋ Agregar deuda</Btn></div>
              </Card>
              <Card>
                <CardHead title="Registrar pago de deuda" icon="💸" />
                <div className="form-grid two-col-form">
                  <Field label="Deuda"><Select value={debtPayForm.debtId} onChange={(v) => setDebtPayForm({ ...debtPayForm, debtId: v })}><option value="">Elegir deuda…</option>{personDebts.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}</Select></Field>
                  <Field label="Fecha"><Input type="date" value={debtPayForm.date} onChange={(e) => setDebtPayForm({ ...debtPayForm, date: e.target.value })} /></Field>
                  <Field label="Importe"><Input type="number" value={debtPayForm.amount} onChange={(e) => setDebtPayForm({ ...debtPayForm, amount: e.target.value })} /></Field>
                  <Field label="Persona"><Select value={debtPayForm.person} onChange={(v) => setDebtPayForm({ ...debtPayForm, person: v })}>{people.map((p) => <option key={p} value={p}>{p}</option>)}</Select></Field>
                  <Field label="Notas"><Input value={debtPayForm.notes} onChange={(e) => setDebtPayForm({ ...debtPayForm, notes: e.target.value })} /></Field>
                </div>
                {selectedDebtForPay && <InfoBox color="blue">Saldo actual: <strong>{fmtArs(selectedDebtForPay.balance)}</strong> · Cuota estimada: <strong>{fmtArs(selectedDebtForPay.installment)}</strong></InfoBox>}
                <div style={{ marginTop: 12 }}><Btn onClick={registerDebtPayment}>Registrar pago</Btn></div>
              </Card>
            </div>
            <div className="debt-cards">
              {personDebts.length === 0 && <EmptyState msg="No hay deudas cargadas." />}
              {personDebts.map((d) => {
                const pct = d.initialBalance > 0 ? ((d.totalPaid || 0) / d.initialBalance) * 100 : 0;
                return (
                  <Card key={d.id}>
                    <div className="debt-card-head"><div><div className="fw">{d.name}</div><div className="muted small">{d.owner} · Día {d.dueDay} · Prioridad {d.priority}</div></div><button className="del-btn" onClick={() => deleteDebt(d.id)}>🗑</button></div>
                    <div className="debt-amounts"><div><span className="muted small">Saldo</span><div className="fw red">{fmtArs(d.balance)}</div></div><div><span className="muted small">Cuota</span><div>{fmtArs(d.installment)}</div></div><div><span className="muted small">Pagado</span><div className="green">{fmtArs(d.totalPaid || 0)}</div></div><div><span className="muted small">Vence día</span><div>{d.dueDay || "—"}</div></div></div>
                    <Progress value={pct} />
                    <div className="muted small" style={{ marginTop: 4 }}>Cancelado: {pct.toFixed(1)}%</div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {tab === "config" && (
          <div className="tab-content">
            <div className="two-col">
              <Card>
                <CardHead title="Catálogos" icon="⚙️" />
                <div className="catalog-section">
                  <label className="field-label">Personas</label>
                  <div className="catalog-add">
                    <Input value={catalogForm.person} onChange={(e) => setCatalogForm({ ...catalogForm, person: e.target.value })} placeholder="Nueva persona" />
                    <Btn small onClick={() => { const v = catalogForm.person.trim(); if (v && !people.includes(v)) setPeople([...people, v]); setCatalogForm({ ...catalogForm, person: "" }); }}>+ Agregar</Btn>
                  </div>
                  <div className="tag-list">{people.map((p) => <span key={p} className="tag">{p}<button onClick={() => setPeople(people.filter((x) => x !== p))}>×</button></span>)}</div>
                </div>
                <div className="catalog-section">
                  <label className="field-label">Tipos</label>
                  <div className="catalog-add">
                    <Input value={catalogForm.type} onChange={(e) => setCatalogForm({ ...catalogForm, type: e.target.value })} placeholder="Nuevo tipo" />
                    <Btn small onClick={() => { const v = catalogForm.type.trim(); if (v && !types.includes(v)) setTypes([...types, v]); setCatalogForm({ ...catalogForm, type: "" }); }}>+ Agregar</Btn>
                  </div>
                  <div className="tag-list">{types.map((t) => <span key={t} className="tag">{t}<button onClick={() => setTypes(types.filter((x) => x !== t))}>×</button></span>)}</div>
                </div>
              </Card>
              <Card>
                <CardHead title="Categorías con F / V" icon="🧩" />
                <div className="form-grid three-col">
                  <Field label="Tipo"><Select value={catalogForm.categoryType} onChange={(v) => setCatalogForm({ ...catalogForm, categoryType: v, categoryFv: "V" })}>{types.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
                  <Field label="Categoría"><Input value={catalogForm.category} onChange={(e) => setCatalogForm({ ...catalogForm, category: e.target.value })} placeholder="Nueva categoría" /></Field>
                  {catalogForm.categoryType === "Egreso" && (
                    <Field label="F / V"><Select value={catalogForm.categoryFv} onChange={(v) => setCatalogForm({ ...catalogForm, categoryFv: v })}><option value="F">Fijo</option><option value="V">Variable</option></Select></Field>
                  )}
                </div>
                <div style={{ marginTop: 12 }}><Btn onClick={addCategory}>＋ Agregar categoría</Btn></div>
                <div style={{ marginTop: 16 }}>
                  {types.map((type) => {
                    const rows = categoryRows.filter((r) => r.type === type);
                    if (!rows.length) return null;
                    return (
                      <div key={type} className="catalog-section">
                        <label className="field-label">{type}</label>
                        <div className="tag-list">
                          {rows.map((row) => (
                            <span key={row.id} className="tag">
                              {row.name}
                              {type === "Egreso" && <button onClick={() => toggleCategoryFV(row)}>{row.fv}</button>}
                              <button onClick={() => removeCategory(row)}>×</button>
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <InfoBox color="blue">En <strong>Egreso</strong>, cada categoría queda clasificada como <strong>F</strong> o <strong>V</strong>. Esa clasificación alimenta automáticamente los KPIs.</InfoBox>
              </Card>
            </div>
            <Card>
              <CardHead title="Cotización manual" icon="💱" />
              <div className="form-grid three-col"><Field label="USD blue (ARS por dólar)"><Input type="number" value={blueRate} onChange={(e) => setBlueRate(Number(e.target.value))} /></Field></div>
              <div className="muted small" style={{ marginTop: 8 }}>Se usa solo para nuevas cargas en USD. Los reportes en USD toman la columna histórica del movimiento.</div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
