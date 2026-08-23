import React, { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const DEFAULT_PEOPLE = ["Federico", "Mica", "Santy"];
const PAYMENT_METHODS = ["Banco", "Tarjeta", "Efectivo", "Mercado Pago", "Transferencia"];
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

const PALETTE = ["#38bdf8", "#34d399", "#fbbf24", "#f87171", "#b39ffb", "#22d3ee", "#fb923c", "#f472b6"];

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

function mapMovementRow(m) {
  return {
    id: m.id, date: m.movement_date, person: m.person, type: m.type, category: m.category,
    subcategoryId: m.subcategory_id, description: m.description, originalAmount: m.original_amount, currency: m.original_currency,
    fxRate: m.fx_rate, amountArs: m.amount_ars, amountUsd: m.amount_usd, paymentMethod: m.payment_method,
    linkedDebtId: m.linked_debt_id, linkedGoalId: m.linked_goal_id, cardId: m.card_id, seriesId: m.series_id,
    installmentNo: m.installment_no, sharedGroupId: m.shared_group_id,
  };
}

const daysInMonth = (year, month) => new Date(year, month, 0).getDate(); // month: 1-12

// Genera `count` fechas mensuales consecutivas a partir del mes de startDate, ancladas al día dayOfMonth
// (recortado al último día válido de cada mes, ej. día 31 en febrero -> 28).
function generateSeriesDates(startDate, dayOfMonth, count) {
  const [sy, sm] = startDate.split("-").map(Number);
  const dates = [];
  for (let i = 0; i < count; i++) {
    const total = (sm - 1) + i;
    const y = sy + Math.floor(total / 12);
    const m = (total % 12) + 1;
    const day = Math.min(dayOfMonth, daysInMonth(y, m));
    dates.push(`${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  return dates;
}

function monthsBetweenInclusive(startDate, endDate) {
  const [sy, sm] = startDate.split("-").map(Number);
  const [ey, em] = endDate.split("-").map(Number);
  return Math.max(1, (ey - sy) * 12 + (em - sm) + 1);
}

// Cronograma de amortización simplificado (sin indexación por IPC): sistema francés con cuota fija.
// Si el préstamo tiene plazo (termMonths) se calcula la cuota; si en cambio tiene una cuota objetivo,
// se estima cuántos períodos hacen falta para cancelar (equivalente a NPER). Durante los meses de
// gracia no se cobra cuota y el interés se capitaliza sobre el saldo.
// `overrides` permite proyectar el cronograma desde un saldo/fecha/cuota distintos al alta original
// (por ejemplo, desde el saldo real pendiente hoy, o simulando una cuota nueva tras una ampliación).
function computeLoanSchedule(loan, overrides = {}) {
  const principal = Number(overrides.principal ?? loan.principal ?? 0);
  const monthlyRate = Number(loan.annualRate || 0) / 12;
  const grace = Number(overrides.graceMonths ?? loan.graceMonths ?? 0);
  const startDate = overrides.startDate || loan.startDate;
  const term = !overrides.installment && loan.termMonths ? Number(loan.termMonths) : null;
  let installment = overrides.installment != null ? Number(overrides.installment) : (loan.targetInstallment ? Number(loan.targetInstallment) : null);

  // Durante los meses de gracia el interés se capitaliza sobre el saldo (no se cobra cuota), así que
  // la cuota (y la estimación de plazo) tienen que amortizar ese saldo ya crecido al cabo de la
  // gracia, no el capital original — si no, la cuota queda corta y sobra un período extra al final.
  const balanceAfterGrace = principal * Math.pow(1 + monthlyRate, grace);

  if (!installment && term) {
    installment = monthlyRate > 0
      ? (balanceAfterGrace * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -term))
      : balanceAfterGrace / term;
  }
  if (!installment || principal <= 0) return { installment: installment || 0, rows: [], estimatedTerm: term, canCancel: !!term };

  const interestFirstPeriod = balanceAfterGrace * monthlyRate;
  let estimatedTerm = term;
  let canCancel = true;
  if (!estimatedTerm) {
    if (monthlyRate === 0) {
      estimatedTerm = Math.ceil(balanceAfterGrace / installment);
    } else if (installment <= interestFirstPeriod) {
      canCancel = false;
      estimatedTerm = null;
    } else {
      estimatedTerm = Math.ceil(-Math.log(1 - (balanceAfterGrace * monthlyRate) / installment) / Math.log(1 + monthlyRate));
    }
  }

  const maxPeriods = Math.min(360, (estimatedTerm || 120) + grace + 1);
  const dates = generateSeriesDates(startDate, Number(loan.dayOfMonth || 10), maxPeriods);
  const rows = [];
  let balance = principal;
  for (let period = 0; period < maxPeriods; period++) {
    const interest = balance * monthlyRate;
    const inGrace = period < grace;
    // Nunca cobrar de más: si lo que falta (interés + saldo) es menor a la cuota nominal —
    // típicamente el último período, por redondeo — se cobra solo eso.
    const payment = inGrace ? 0 : Math.min(installment, interest + balance);
    let principalPortion = inGrace ? 0 : Math.min(payment - interest, balance);
    let closingBalance = inGrace ? balance + interest : Math.max(0, balance - principalPortion);
    rows.push({ period: period + 1, date: dates[period], openingBalance: balance, interest, payment, principalPortion, closingBalance });
    balance = closingBalance;
    if (!inGrace && balance <= 0.5) break;
  }
  return { installment, rows, estimatedTerm, canCancel };
}

// Factor acumulado de inflación (IPC INDEC) entre dos fechas, para llevar un pago a "pesos de la
// fecha de desembolso" y así comparar la ganancia real de un préstamo, no solo la nominal.
function ipcFactorBetween(ipcRows, fromDate, toDate) {
  const fromMonth = monthKey(fromDate);
  const toMonth = monthKey(toDate);
  if (!ipcRows.length || toMonth <= fromMonth) return 1;
  let factor = 1;
  ipcRows.forEach((r) => {
    const mo = r.fecha.slice(0, 7);
    if (mo > fromMonth && mo <= toMonth) factor *= 1 + Number(r.valor) / 100;
  });
  return factor;
}

// Proyección de cuánto vamos a ganar en términos reales si el préstamo se cobra tal como está
// pactado hasta el final. Lo ya cobrado se deflacta con el IPC real (mes a mes); lo que falta
// cobrar se deflacta con el IPC real hasta hoy + un supuesto de inflación futura = promedio de los
// últimos 6 meses de IPC conocido (lo más razonable sin poder adivinar el futuro).
function computeProjectedRealGain(loan, remainingSchedule, collectedNominal, realCollected, ipcData) {
  if (!ipcData.length || !remainingSchedule || !remainingSchedule.rows.length) return null;
  const recent = ipcData.slice(-6);
  const avgMonthly = recent.reduce((a, r) => a + Number(r.valor), 0) / recent.length / 100;
  const pastFactor = ipcFactorBetween(ipcData, loan.startDate, today());
  let realFuture = 0, nominalFuture = 0;
  remainingSchedule.rows.forEach((r, i) => {
    if (r.payment <= 0) return;
    const factor = pastFactor * Math.pow(1 + avgMonthly, i + 1);
    realFuture += r.payment / factor;
    nominalFuture += r.payment;
  });
  const totalNominal = collectedNominal + nominalFuture;
  const totalReal = realCollected + realFuture;
  const principal = Number(loan.principal || 0);
  return { avgMonthly, nominalGain: totalNominal - principal, realGain: totalReal - principal };
}

// Tasas de préstamos personales relevadas manualmente (no hay API pública confiable para esto).
// Sirven como referencia para elegir una TNA intermedia al otorgar un préstamo — no son una
// cotización exacta, varían por banco, perfil crediticio y momento.
const REFERENCE_LOAN_RATES = [
  { name: "Banco Nación (con sueldo)", tna: 56 },
  { name: "Banco Santander", tna: 80 },
  { name: "Banco Provincia", tna: 98 },
  { name: "Banco Galicia", tna: 142 },
];
const REFERENCE_LOAN_RATES_DATE = "agosto 2026";

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

function buildSubcategoryMap(rows) {
  const map = {};
  rows.forEach((r) => {
    if (r.active === false) return;
    if (!map[r.category_id]) map[r.category_id] = [];
    map[r.category_id].push({ id: r.id, name: r.name });
  });
  Object.values(map).forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name)));
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
  const color = pct > 100 ? "#f87171" : pct >= 85 ? "#fbbf24" : "#34d399";
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
              <line x1={PL} x2={PL + iW} y1={y} y2={y} stroke="var(--border)" strokeWidth="1" />
              <text x={PL - 6} y={y + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{formatter ? formatter(val, true) : val.toFixed(0)}</text>
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
                {val > 0 && <text x={x + (barW - 2) / 2} y={y - 4} textAnchor="middle" fontSize="9" fill="var(--text)">{formatter ? formatter(val) : val.toFixed(0)}</text>}
              </g>
            );
          });
        })}
        {data.map((d, di) => (
          <text key={di} x={PL + di * gap + gap / 2} y={H - PB + 20} textAnchor="middle" fontSize="10" fill="var(--muted)">{String(d[xKey]).slice(5)}</text>
        ))}
        {bars.map((b, bi) => (
          <g key={b.key} transform={`translate(${PL + bi * 110}, ${H - 14})`}>
            <rect width="10" height="10" fill={b.color} rx="2" />
            <text x="14" y="9" fontSize="10" fill="var(--muted)">{b.label}</text>
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
        {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} stroke="var(--surface)" strokeWidth="2" />)}
        {slices.map((s, i) => (
          <g key={i} transform={`translate(245, ${20 + i * 38})`}>
            <rect width="12" height="12" fill={s.color} rx="2" />
            <text x="18" y="10" fontSize="10" fill="var(--text)">{s.label}</text>
            <text x="18" y="24" fontSize="9" fill="var(--muted)">{(s.pct * 100).toFixed(1)}% · {formatter ? formatter(s.value) : s.value}</text>
          </g>
        ))}
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
        placeholder="Detalle (opcional)" className="control" autoComplete="off" />
      {open && filtered.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
          background: "var(--surface-2)", border: "1.5px solid var(--border)", borderRadius: 10,
          boxShadow: "0 4px 16px rgba(0,0,0,.35)", maxHeight: 200, overflowY: "auto", marginTop: 2 }}>
          {filtered.map((s) => (
            <div key={s} onMouseDown={() => select(s)}
              style={{ padding: "9px 14px", cursor: "pointer", fontSize: "0.9rem", borderBottom: "1px solid var(--border)" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--primary-light)"}
              onMouseLeave={e => e.currentTarget.style.background = "var(--surface-2)"}>{s}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// Panel de edición completo de un movimiento (todos los campos, no solo importe/detalle).
function MovementEditPanel({ data, onChange, types, categoryMap, subcategoryMap, categoryIdFor, people, cards, onSave, onCancel }) {
  return (
    <div className="form-grid" style={{ margin: "8px 0", padding: 10, background: "var(--surface-2)", borderRadius: 10 }}>
      <Field label="Fecha"><Input type="date" value={data.date} onChange={(e) => onChange({ ...data, date: e.target.value })} /></Field>
      <Field label="Persona"><Select value={data.person} onChange={(v) => onChange({ ...data, person: v })}>{people.map((p) => <option key={p} value={p}>{p}</option>)}</Select></Field>
      <Field label="Tipo"><Select value={data.type} onChange={(v) => onChange({ ...data, type: v, category: "", subcategoryId: "" })}>{types.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
      <Field label="Categoría"><Select value={data.category} onChange={(v) => onChange({ ...data, category: v, subcategoryId: "" })}><option value="">Seleccionar…</option>{(categoryMap[data.type] || []).map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field>
      <Field label="Subcategoría">
        <Select value={data.subcategoryId} onChange={(v) => onChange({ ...data, subcategoryId: v })}>
          <option value="">Sin subcategoría</option>
          {(subcategoryMap[categoryIdFor(data.type, data.category)] || []).map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
        </Select>
      </Field>
      <Field label="Detalle"><Input value={data.description} onChange={(e) => onChange({ ...data, description: e.target.value })} /></Field>
      <Field label="Moneda"><Select value={data.currency} onChange={(v) => onChange({ ...data, currency: v })}><option value="ARS">Pesos (ARS)</option><option value="USD">Dólar blue (USD)</option></Select></Field>
      <Field label="Importe"><Input type="number" value={data.originalAmount} onChange={(e) => onChange({ ...data, originalAmount: e.target.value })} /></Field>
      <Field label="Medio de pago">
        <Select value={data.paymentMethod} onChange={(v) => onChange({ ...data, paymentMethod: v, cardId: v === "Tarjeta" ? data.cardId : "" })}>
          <option value="">Sin especificar</option>
          {PAYMENT_METHODS.map((p) => <option key={p} value={p}>{p}</option>)}
        </Select>
      </Field>
      {data.paymentMethod === "Tarjeta" && (
        <Field label="Tarjeta">
          <Select value={data.cardId} onChange={(v) => onChange({ ...data, cardId: v })}>
            <option value="">Elegir tarjeta…</option>
            {cards.map((c) => <option key={c.id} value={String(c.id)}>{c.name}{c.owner ? ` · ${c.owner}` : ""}</option>)}
          </Select>
        </Field>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
        <Btn small onClick={onSave}>✓ Guardar</Btn>
        <Btn small variant="outline" onClick={onCancel}>✕ Cancelar</Btn>
      </div>
      <div className="muted small" style={{ gridColumn: "1 / -1" }}>Nota: esto edita solo este movimiento. Si es parte de una compra en cuotas, cambiar acá no reparte el cambio al resto de las cuotas.</div>
    </div>
  );
}

const TABS = [
  { id: "cargar", label: "📥 Cargar" },
  { id: "recurrentes", label: "🔁 Recurrentes" },
  { id: "dashboard", label: "📊 Dashboard" },
  { id: "datos", label: "🗂 Datos" },
  { id: "presupuesto", label: "🎯 Presupuesto" },
  { id: "reportes", label: "📈 Reportes" },
  { id: "deudas", label: "🏦 Préstamos" },
  { id: "config", label: "⚙️ Config" },
];

export default function App() {
  const [tab, setTab] = useState("cargar");
  const [people, setPeople] = useState(DEFAULT_PEOPLE);
  const [types, setTypes] = useState(DEFAULT_TYPES);
  const [categoryRows, setCategoryRows] = useState(DEFAULT_CATEGORY_ROWS);
  const [categoryMap, setCategoryMap] = useState(buildCategoryMap(DEFAULT_CATEGORY_ROWS));
  const [categoryFVMap, setCategoryFVMap] = useState(buildCategoryFV(DEFAULT_CATEGORY_ROWS));
  const [catalogRows, setCatalogRows] = useState([]); // settings_catalog rows (person/type), con id para poder borrar
  const [subcategoryRows, setSubcategoryRows] = useState([]); // { id, category_id, name, active }
  const [cards, setCards] = useState([]); // { id, name, owner, active }
  const [movementSeries, setMovementSeries] = useState([]); // { id, kind, ... } débito automático + cuotas de tarjeta

  const [movements, setMovements] = useState([]);
  const [debts, setDebts] = useState([]);
  const [debtPayments, setDebtPayments] = useState([]);
  const [loans, setLoans] = useState([]); // plata que la familia le presta a un tercero (asset)
  const [loanPayments, setLoanPayments] = useState([]);
  const [goals, setGoals] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [monthlyBalances, setMonthlyBalances] = useState([]);

  const [blueRate, setBlueRate] = useState(1250);
  const [blueUpdatedAt, setBlueUpdatedAt] = useState("");
  const [fxStatus, setFxStatus] = useState("idle");
  const [ipcData, setIpcData] = useState([]); // [{ fecha, valor }] variación mensual IPC en %
  const [displayCurrency, setDisplayCurrency] = useState("ARS");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingMovId, setEditingMovId] = useState(null);
  const [editMovData, setEditMovData] = useState({ date: "", person: "", type: "", category: "", subcategoryId: "", description: "", currency: "ARS", originalAmount: "", paymentMethod: "", cardId: "" });

  const [reportMonth, setReportMonth] = useState(currentMonth());
  const [selectedPerson, setSelectedPerson] = useState("all");
  const [reportBudgetPerson, setReportBudgetPerson] = useState("all");
  const [filters, setFilters] = useState({ type: "all", category: "all", subcategoryId: "all", dateFrom: currentMonth() + "-01", dateTo: today(), currency: "all", fv: "all", search: "" });
  const [evolutionSearch, setEvolutionSearch] = useState("");
  const [expandedTypes, setExpandedTypes] = useState({});
  const [expandedCats, setExpandedCats] = useState({});

  const emptyMovForm = useCallback(() => ({
    date: today(), person: "Federico", type: "", category: "", subcategoryId: "", description: "", originalAmount: "", currency: "ARS",
    fxRate: blueRate, linkedDebtId: "", linkedGoalId: "", paymentMethod: "Efectivo", cardId: "", installments: "1",
    shared: false, sharedPeople: [],
  }), [blueRate]);

  const [movForm, setMovForm] = useState(emptyMovForm());
  const [transferForm, setTransferForm] = useState({ date: today(), person: "Federico", fromType: "Ahorro", fromCategory: "", toType: "Inversión", toCategory: "", originalAmount: "", currency: "ARS", description: "" });
  const [debtForm, setDebtForm] = useState({ name: "", owner: "Federico", balance: "", installment: "", dueDay: "", priority: "Media", rate: "", notes: "" });
  const [goalForm, setGoalForm] = useState({ name: categoryMap["Ahorro"]?.[0] || "", owner: "Federico", goalType: "Ahorro", periodType: "Mensual", target: "", notes: "" });
  const [budgetForm, setBudgetForm] = useState({ month: currentMonth(), person: "Federico", type: "Egreso", category: "Supermercado", planned: "" });
  const [debtPayForm, setDebtPayForm] = useState({ debtId: "", date: today(), amount: "", person: "Federico", notes: "" });
  const [loanForm, setLoanForm] = useState({
    name: "", principal: "", annualRate: "", startDate: today(),
    dayOfMonth: "10", graceMonths: "0", termMonths: "", targetInstallment: "", notes: "",
  });
  const [loanPayForm, setLoanPayForm] = useState({ loanId: "", date: today(), selectedPeriods: [], amount: "", notes: "" });
  const [loanIncreaseForm, setLoanIncreaseForm] = useState({}); // { [loanId]: { amount, newInstallment } }
  const [expandedLoans, setExpandedLoans] = useState({});
  const [debtsSubTab, setDebtsSubTab] = useState("prestamos"); // "deudas" | "prestamos" — sub-vista dentro de la tab fusionada; Préstamos es la que se usa a diario, Deudas queda como sub-vista secundaria para las 2 deudas históricas casi saldadas
  const [balanceForm, setBalanceForm] = useState({ month: currentMonth(), opening: "", notes: "" });
  const [catalogForm, setCatalogForm] = useState({ person: "", type: "", categoryType: "Egreso", category: "", categoryFv: "V" });
  const [subcatForm, setSubcatForm] = useState({ categoryType: "Egreso", categoryId: "", name: "" });
  const [cardForm, setCardForm] = useState({ name: "", owner: "Federico" });
  const [debitoForm, setDebitoForm] = useState({
    person: "Federico", type: "Egreso", category: "", subcategoryId: "", description: "",
    currency: "ARS", amount: "", dayOfMonth: "10", startDate: today(),
  });
  const [seriesEndDateInputs, setSeriesEndDateInputs] = useState({}); // seriesId -> fecha elegida para truncar
  const [reconcileForm, setReconcileForm] = useState({ cardId: "", month: currentMonth(), statementTotal: "" });
  const [copyBudgetMsg, setCopyBudgetMsg] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [movsR, dbsR, dpsR, glsR, bgsR, mbsR, catsR, categoriesR, subcatsR, cardsR, seriesR, loansR, loanPaysR] = await Promise.all([
          supabase.from("movements").select("*").order("movement_date", { ascending: false }),
          supabase.from("debts").select("*").order("created_at", { ascending: false }),
          supabase.from("debt_payments").select("*").order("payment_date", { ascending: false }),
          supabase.from("goals").select("*").order("created_at", { ascending: false }),
          supabase.from("budgets").select("*").order("created_at", { ascending: false }),
          supabase.from("monthly_balances").select("*").order("balance_month", { ascending: false }),
          supabase.from("settings_catalog").select("*").order("created_at"),
          supabase.from("categories").select("*").eq("active", true).order("type").order("name"),
          supabase.from("subcategories").select("*").eq("active", true).order("category_id").order("name"),
          supabase.from("cards").select("*").eq("active", true).order("name"),
          supabase.from("movement_series").select("*").eq("active", true).order("created_at", { ascending: false }),
          supabase.from("loans").select("*").order("created_at", { ascending: false }),
          supabase.from("loan_payments").select("*").order("payment_date", { ascending: false }),
        ]);

        const movs = movsR.data || [];
        const dbs = dbsR.data || [];
        const dps = dpsR.data || [];
        const gls = glsR.data || [];
        const bgs = bgsR.data || [];
        const mbs = mbsR.data || [];
        const cats = catsR.data || [];
        const categoriesData = categoriesR.data || [];
        const subcats = subcatsR.data || [];
        const cardsData = cardsR.data || [];
        const seriesData = seriesR.data || [];
        const loansData = loansR.data || [];
        const loanPaysData = loanPaysR.data || [];

        setMovements(movs.map(mapMovementRow));
        setSubcategoryRows(subcats);
        setCards(cardsData);
        setMovementSeries(seriesData);
        setLoans(loansData.map((l) => ({
          id: l.id, name: l.name, owner: l.owner, principal: l.principal, annualRate: l.annual_rate,
          startDate: l.start_date, dayOfMonth: l.day_of_month, graceMonths: l.grace_months,
          termMonths: l.term_months, targetInstallment: l.target_installment, notes: l.notes,
          status: l.status, linkedMovementId: l.linked_movement_id,
        })));
        setLoanPayments(loanPaysData.map((p) => ({
          id: p.id, loanId: p.loan_id, date: p.payment_date, amount: p.amount, person: p.person,
          notes: p.notes, linkedMovementId: p.linked_movement_id,
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
          setCatalogRows(cats);
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

  // IPC mensual (INDEC) para calcular la ganancia real de los préstamos otorgados, ajustada por inflación.
  useEffect(() => {
    async function fetchIpc() {
      try {
        const res = await fetch("https://api.argentinadatos.com/v1/finanzas/indices/inflacion");
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (Array.isArray(data)) setIpcData(data);
      } catch {
        // sin conexión al índice: la ganancia real de préstamos simplemente no se muestra
      }
    }
    fetchIpc();
  }, []);

  const getFV = useCallback((type, category) => categoryFVMap[`${type}__${category}`] || "V", [categoryFVMap]);
  const subcategoryMap = useMemo(() => buildSubcategoryMap(subcategoryRows), [subcategoryRows]);
  const subcategoryNameById = useMemo(() => {
    const map = {};
    subcategoryRows.forEach((r) => { map[r.id] = r.name; });
    return map;
  }, [subcategoryRows]);
  const categoryIdFor = useCallback((type, category) => {
    const row = categoryRows.find((r) => r.type === type && r.name === category);
    return row ? row.id : null;
  }, [categoryRows]);
  const cardNameById = useMemo(() => {
    const map = {};
    cards.forEach((c) => { map[c.id] = c.name; });
    return map;
  }, [cards]);

  const reconcileMovements = useMemo(() => {
    if (!reconcileForm.cardId) return [];
    return movements
      .filter((m) => String(m.cardId) === String(reconcileForm.cardId) && monthKey(m.date) === reconcileForm.month)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [movements, reconcileForm.cardId, reconcileForm.month]);
  const reconcileSum = useMemo(() => reconcileMovements.reduce((a, m) => a + Number(m.amountArs || 0), 0), [reconcileMovements]);
  const reconcileDiff = reconcileForm.statementTotal !== "" ? Number(reconcileForm.statementTotal) - reconcileSum : null;
  const amountDisplay = useCallback((m) => displayCurrency === "USD" ? Number(m.amountUsd || 0) : Number(m.amountArs || 0), [displayCurrency]);
  const fmt = useCallback((value) => money(value, displayCurrency), [displayCurrency]);
  const fmtArs = useCallback((value) => money(value, "ARS"), []);

  async function addMovement() {
    if (!movForm.category || !movForm.originalAmount || !movForm.person || !movForm.type) return;
    setSaving(true);

    const isShared = movForm.shared && movForm.sharedPeople.length >= 2;
    if (isShared) {
      await addSharedMovement();
      setSaving(false);
      return;
    }

    const isCardInstallments = movForm.paymentMethod === "Tarjeta" && movForm.cardId && Number(movForm.installments) > 1;
    if (isCardInstallments) {
      await addCardInstallmentPurchase();
      setSaving(false);
      return;
    }

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
        (selectedPerson === "all" || g.owner === movForm.person) &&
        g.name.toLowerCase() === movForm.category.toLowerCase()
      );
      if (autoGoal) linkedGoalId = autoGoal.id;
    }

    const row = {
      card_id: movForm.paymentMethod === "Tarjeta" && movForm.cardId ? Number(movForm.cardId) : null,
      movement_date: movForm.date,
      person: movForm.person,
      type: movForm.type,
      category: movForm.category,
      subcategory_id: movForm.subcategoryId ? Number(movForm.subcategoryId) : null,
      description: movForm.description || null,
      original_currency: movForm.currency,
      original_amount: Number(movForm.originalAmount),
      fx_rate: rate,
      amount_ars: amountArs,
      amount_usd: amountUsd,
      payment_method: movForm.paymentMethod || null,
      linked_debt_id: movForm.linkedDebtId ? Number(movForm.linkedDebtId) : null,
      linked_goal_id: linkedGoalId,
    };

    const { data, error } = await supabase.from("movements").insert([row]).select().single();
    if (!error && data) {
      setMovements((prev) => [mapMovementRow(data), ...prev]);

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
    const mov = movements.find((m) => m.id === id);
    if (mov?.sharedGroupId) {
      const groupMovs = movements.filter((m) => m.sharedGroupId === mov.sharedGroupId);
      if (groupMovs.length > 1) {
        const deleteAll = window.confirm(`Este movimiento es parte de un gasto compartido entre ${groupMovs.map((m) => m.person).join(", ")}. ¿Borrar los ${groupMovs.length} movimientos del grupo? (Cancelar borra solo este)`);
        if (deleteAll) {
          await supabase.from("movements").delete().in("id", groupMovs.map((m) => m.id));
          const ids = new Set(groupMovs.map((m) => m.id));
          setMovements((prev) => prev.filter((m) => !ids.has(m.id)));
          return;
        }
      }
    }
    await supabase.from("movements").delete().eq("id", id);
    setMovements((prev) => prev.filter((m) => m.id !== id));
  }

  // Gasto compartido: reparte el importe total en partes iguales entre las personas elegidas,
  // un movimiento por persona, todos ligados por shared_group_id. Si además es una compra en
  // tarjeta a varias cuotas, la parte de cada persona se reparte a su vez en N movimientos
  // mensuales (con su propia serie), manteniendo el shared_group_id común a todo el grupo.
  async function addSharedMovement() {
    const total = Number(movForm.originalAmount);
    const peopleList = movForm.sharedPeople;
    const n = peopleList.length;
    if (!total || n < 2) return;
    const rate = movForm.currency === "USD" ? blueRate : 1;
    const share = Math.round((total / n) * 100) / 100;
    const subcategoryId = movForm.subcategoryId ? Number(movForm.subcategoryId) : null;
    const groupId = crypto.randomUUID();
    const cardId = movForm.paymentMethod === "Tarjeta" && movForm.cardId ? Number(movForm.cardId) : null;
    const installments = Number(movForm.installments);
    const isCardInstallments = movForm.paymentMethod === "Tarjeta" && cardId && installments > 1;

    const peopleShares = peopleList.map((person, i) => ({
      person, amount: i === n - 1 ? Math.round((total - share * (n - 1)) * 100) / 100 : share,
    }));

    if (isCardInstallments) {
      const dayOfMonth = Number(movForm.date.split("-")[2]);
      const dates = generateSeriesDates(movForm.date, dayOfMonth, installments);
      const newSeries = [];
      const allRows = [];
      for (const { person, amount } of peopleShares) {
        const perInstallment = Math.round((amount / installments) * 100) / 100;
        const { data: seriesRow, error: seriesErr } = await supabase.from("movement_series").insert([{
          kind: "tarjeta_cuotas", person, type: movForm.type, category: movForm.category,
          subcategory_id: subcategoryId, description: movForm.description || null, currency: movForm.currency,
          installment_amount: perInstallment, installments_total: installments, day_of_month: dayOfMonth,
          start_date: movForm.date, end_date: dates[dates.length - 1], card_id: cardId, payment_method: "Tarjeta", active: true,
        }]).select().single();
        if (seriesErr || !seriesRow) { console.error(seriesErr); continue; }
        newSeries.push(seriesRow);
        dates.forEach((d, i) => {
          const originalAmount = i === installments - 1 ? Math.round((amount - perInstallment * (installments - 1)) * 100) / 100 : perInstallment;
          const amountArs = toArs(originalAmount, movForm.currency, rate);
          const amountUsd = movForm.currency === "USD" ? originalAmount : amountArs / Math.max(blueRate, 1);
          allRows.push({
            movement_date: d, person, type: movForm.type, category: movForm.category,
            subcategory_id: subcategoryId, description: movForm.description ? `${movForm.description} (cuota ${i + 1}/${installments})` : `Cuota ${i + 1}/${installments}`,
            original_currency: movForm.currency, original_amount: originalAmount, fx_rate: rate,
            amount_ars: amountArs, amount_usd: amountUsd, payment_method: "Tarjeta",
            linked_debt_id: null, linked_goal_id: null, card_id: cardId, series_id: seriesRow.id, installment_no: i + 1,
            shared_group_id: groupId,
          });
        });
      }
      if (!allRows.length) return;
      const { data, error } = await supabase.from("movements").insert(allRows).select();
      if (error) { console.error(error); return; }
      if (data) setMovements((prev) => [...data.map(mapMovementRow), ...prev]);
      if (newSeries.length) setMovementSeries((prev) => [...newSeries, ...prev]);
      setMovForm(emptyMovForm());
      return;
    }

    const rows = peopleShares.map(({ person, amount }) => {
      const amountArs = toArs(amount, movForm.currency, rate);
      const amountUsd = movForm.currency === "USD" ? amount : amountArs / Math.max(blueRate, 1);
      return {
        movement_date: movForm.date, person, type: movForm.type, category: movForm.category,
        subcategory_id: subcategoryId, description: movForm.description || null,
        original_currency: movForm.currency, original_amount: amount, fx_rate: rate,
        amount_ars: amountArs, amount_usd: amountUsd, payment_method: movForm.paymentMethod || null,
        linked_debt_id: null, linked_goal_id: null, card_id: cardId, shared_group_id: groupId,
      };
    });
    const { data, error } = await supabase.from("movements").insert(rows).select();
    if (error) { console.error(error); return; }
    if (data) setMovements((prev) => [...data.map(mapMovementRow), ...prev]);
    setMovForm(emptyMovForm());
  }

  // Compra con tarjeta en cuotas: parte el importe total en N movimientos mensuales ligados a una serie.
  async function addCardInstallmentPurchase() {
    const n = Number(movForm.installments);
    const total = Number(movForm.originalAmount);
    if (!n || n < 2 || !total) return;
    const dayOfMonth = Number(movForm.date.split("-")[2]);
    const dates = generateSeriesDates(movForm.date, dayOfMonth, n);
    const rate = movForm.currency === "USD" ? blueRate : 1;
    const perInstallment = Math.round((total / n) * 100) / 100;
    const cardId = Number(movForm.cardId);
    const subcategoryId = movForm.subcategoryId ? Number(movForm.subcategoryId) : null;

    const { data: seriesRow, error: seriesErr } = await supabase.from("movement_series").insert([{
      kind: "tarjeta_cuotas", person: movForm.person, type: movForm.type, category: movForm.category,
      subcategory_id: subcategoryId, description: movForm.description || null, currency: movForm.currency,
      installment_amount: perInstallment, installments_total: n, day_of_month: dayOfMonth,
      start_date: movForm.date, end_date: dates[dates.length - 1], card_id: cardId, payment_method: "Tarjeta", active: true,
    }]).select().single();
    if (seriesErr || !seriesRow) { console.error(seriesErr); return; }

    const rows = dates.map((d, i) => {
      const originalAmount = i === n - 1 ? Math.round((total - perInstallment * (n - 1)) * 100) / 100 : perInstallment;
      const amountArs = toArs(originalAmount, movForm.currency, rate);
      const amountUsd = movForm.currency === "USD" ? originalAmount : amountArs / Math.max(blueRate, 1);
      return {
        movement_date: d, person: movForm.person, type: movForm.type, category: movForm.category,
        subcategory_id: subcategoryId, description: movForm.description ? `${movForm.description} (cuota ${i + 1}/${n})` : `Cuota ${i + 1}/${n}`,
        original_currency: movForm.currency, original_amount: originalAmount, fx_rate: rate,
        amount_ars: amountArs, amount_usd: amountUsd, payment_method: "Tarjeta",
        linked_debt_id: null, linked_goal_id: null, card_id: cardId, series_id: seriesRow.id, installment_no: i + 1,
      };
    });
    const { data: movRows, error: movErr } = await supabase.from("movements").insert(rows).select();
    if (movErr) { console.error(movErr); return; }
    if (movRows) setMovements((prev) => [...movRows.map(mapMovementRow), ...prev]);
    setMovementSeries((prev) => [seriesRow, ...prev]);
    setMovForm(emptyMovForm());
  }

  async function addDebitoAutomatico() {
    if (!debitoForm.category || !debitoForm.amount || !debitoForm.dayOfMonth || !debitoForm.startDate) return;
    setSaving(true);
    const dayOfMonth = Number(debitoForm.dayOfMonth);
    const yearEnd = `${debitoForm.startDate.slice(0, 4)}-12-31`;
    const count = monthsBetweenInclusive(debitoForm.startDate, yearEnd);
    const dates = generateSeriesDates(debitoForm.startDate, dayOfMonth, count);
    const rate = debitoForm.currency === "USD" ? blueRate : 1;
    const amountArs = toArs(debitoForm.amount, debitoForm.currency, rate);
    const amountUsd = debitoForm.currency === "USD" ? Number(debitoForm.amount) : amountArs / Math.max(blueRate, 1);
    const subcategoryId = debitoForm.subcategoryId ? Number(debitoForm.subcategoryId) : null;

    const { data: seriesRow, error: seriesErr } = await supabase.from("movement_series").insert([{
      kind: "debito_automatico", person: debitoForm.person, type: debitoForm.type, category: debitoForm.category,
      subcategory_id: subcategoryId, description: debitoForm.description || null, currency: debitoForm.currency,
      installment_amount: Number(debitoForm.amount), installments_total: null, day_of_month: dayOfMonth,
      start_date: debitoForm.startDate, end_date: dates[dates.length - 1], active: true,
    }]).select().single();
    if (seriesErr || !seriesRow) { console.error(seriesErr); setSaving(false); return; }

    const rows = dates.map((d) => ({
      movement_date: d, person: debitoForm.person, type: debitoForm.type, category: debitoForm.category,
      subcategory_id: subcategoryId, description: debitoForm.description || null,
      original_currency: debitoForm.currency, original_amount: Number(debitoForm.amount), fx_rate: rate,
      amount_ars: amountArs, amount_usd: amountUsd, payment_method: null,
      linked_debt_id: null, linked_goal_id: null, series_id: seriesRow.id,
    }));
    const { data: movRows, error: movErr } = await supabase.from("movements").insert(rows).select();
    if (movErr) { console.error(movErr); setSaving(false); return; }
    if (movRows) setMovements((prev) => [...movRows.map(mapMovementRow), ...prev]);
    setMovementSeries((prev) => [seriesRow, ...prev]);
    setDebitoForm((f) => ({ ...f, amount: "", description: "" }));
    setSaving(false);
  }

  // Trunca una serie: actualiza su fecha de fin y borra los movimientos generados posteriores a esa
  // fecha (respeta los meses ya cerrados, que no se tocan).
  async function truncateSeries(series, newEndDate) {
    if (!newEndDate) return;
    const closedMonths = new Set(monthlyBalances.filter((b) => b.closed).map((b) => b.balance_month));
    const toDelete = movements.filter((m) => m.seriesId === series.id && m.date > newEndDate);
    const deletable = toDelete.filter((m) => !closedMonths.has(monthKey(m.date)));
    const blocked = toDelete.length - deletable.length;
    if (deletable.length) {
      await supabase.from("movements").delete().in("id", deletable.map((m) => m.id));
      const deletedIds = new Set(deletable.map((m) => m.id));
      setMovements((prev) => prev.filter((m) => !deletedIds.has(m.id)));
    }
    await supabase.from("movement_series").update({ end_date: newEndDate }).eq("id", series.id);
    setMovementSeries((prev) => prev.map((s) => s.id === series.id ? { ...s, end_date: newEndDate } : s));
    if (blocked > 0) window.alert(`Se actualizó la fecha, pero ${blocked} movimiento(s) no se pudieron borrar porque son de un mes ya cerrado.`);
  }

  async function deleteSeries(series) {
    if (!window.confirm("¿Eliminar esta serie? Se borran los movimientos futuros generados (no los que ya pasaron ni los de meses cerrados).")) return;
    await truncateSeries(series, today());
    await supabase.from("movement_series").update({ active: false }).eq("id", series.id);
    setMovementSeries((prev) => prev.filter((s) => s.id !== series.id));
  }

  // Conciliación de resumen de tarjeta: registra la diferencia entre lo cargado y el total del resumen
  // (mayormente impuestos) como un gasto en la categoría "Impuestos Tarjetas".
  async function registerCardDifference() {
    const cardId = Number(reconcileForm.cardId);
    if (!cardId || reconcileDiff === null || reconcileDiff <= 0) return;
    setSaving(true);
    const [y, m] = reconcileForm.month.split("-").map(Number);
    const date = `${reconcileForm.month}-${String(daysInMonth(y, m)).padStart(2, "0")}`;
    const row = {
      movement_date: date, person: "Federico", type: "Egreso", category: "Impuestos Tarjetas",
      subcategory_id: null, description: `Diferencia resumen · ${cardNameById[cardId] || "tarjeta"} · ${reconcileForm.month}`,
      original_currency: "ARS", original_amount: reconcileDiff, fx_rate: 1, amount_ars: reconcileDiff,
      amount_usd: reconcileDiff / Math.max(blueRate, 1), payment_method: "Tarjeta",
      linked_debt_id: null, linked_goal_id: null, card_id: cardId,
    };
    const { data, error } = await supabase.from("movements").insert([row]).select().single();
    if (!error && data) {
      setMovements((prev) => [mapMovementRow(data), ...prev]);
      setReconcileForm((f) => ({ ...f, statementTotal: "" }));
    }
    setSaving(false);
  }

  async function addTransfer() {
    const { date, person, fromType, fromCategory, toType, toCategory, originalAmount, currency, description } = transferForm;
    if (!fromCategory || !toCategory || !originalAmount) return;
    setSaving(true);
    const rate = currency === "USD" ? blueRate : 1;
    const amountArs = toArs(originalAmount, currency, rate);
    const amountUsd = currency === "USD" ? Number(originalAmount) : amountArs / Math.max(blueRate, 1);
    const desc = description || `Transferencia ${fromType} → ${toType}`;
    const rowOut = { movement_date: date, person, type: fromType, category: fromCategory, description: desc, original_currency: currency, original_amount: Number(originalAmount), fx_rate: rate, amount_ars: amountArs, amount_usd: amountUsd, payment_method: null, linked_debt_id: null, linked_goal_id: null };
    const rowIn  = { movement_date: date, person, type: toType,   category: toCategory,   description: desc, original_currency: currency, original_amount: Number(originalAmount), fx_rate: rate, amount_ars: amountArs, amount_usd: amountUsd, payment_method: null, linked_debt_id: null, linked_goal_id: null };
    const [{ data: d1 }, { data: d2 }] = await Promise.all([
      supabase.from("movements").insert([rowOut]).select().single(),
      supabase.from("movements").insert([rowIn]).select().single(),
    ]);
    const toMov = (d) => d ? { id: d.id, date: d.movement_date, person: d.person, type: d.type, category: d.category, description: d.description, originalAmount: d.original_amount, currency: d.original_currency, fxRate: d.fx_rate, amountArs: d.amount_ars, amountUsd: d.amount_usd, paymentMethod: d.payment_method, linkedDebtId: d.linked_debt_id, linkedGoalId: d.linked_goal_id } : null;
    const newMovs = [toMov(d1), toMov(d2)].filter(Boolean);
    if (newMovs.length) setMovements((prev) => [...newMovs, ...prev]);
    setTransferForm({ date: today(), person: "Federico", fromType: "Ahorro", fromCategory: "", toType: "Inversión", toCategory: "", originalAmount: "", currency: "ARS", description: "" });
    setSaving(false);
  }

  function startEditMovement(m) {
    setEditingMovId(m.id);
    setEditMovData({
      date: m.date, person: m.person, type: m.type, category: m.category,
      subcategoryId: m.subcategoryId ? String(m.subcategoryId) : "", description: m.description || "",
      currency: m.currency, originalAmount: String(m.originalAmount),
      paymentMethod: m.paymentMethod || "", cardId: m.cardId ? String(m.cardId) : "",
    });
  }

  async function saveEditMovement(id) {
    const mov = movements.find((m) => m.id === id);
    if (!mov) return;
    const newAmount = Number(editMovData.originalAmount);
    if (!newAmount || !editMovData.type || !editMovData.category) return;
    // Si cambió de moneda usa la cotización actual; si sigue igual, respeta la que tenía el movimiento.
    const rate = editMovData.currency === "USD" ? (editMovData.currency !== mov.currency ? blueRate : mov.fxRate) : 1;
    const amountArs = toArs(newAmount, editMovData.currency, rate);
    const amountUsd = editMovData.currency === "USD" ? newAmount : amountArs / Math.max(blueRate, 1);
    const subcategoryId = editMovData.subcategoryId ? Number(editMovData.subcategoryId) : null;
    const cardId = editMovData.paymentMethod === "Tarjeta" && editMovData.cardId ? Number(editMovData.cardId) : null;
    const { error } = await supabase.from("movements").update({
      movement_date: editMovData.date, person: editMovData.person, type: editMovData.type, category: editMovData.category,
      subcategory_id: subcategoryId, description: editMovData.description || null,
      original_currency: editMovData.currency, original_amount: newAmount, fx_rate: rate,
      amount_ars: amountArs, amount_usd: amountUsd,
      payment_method: editMovData.paymentMethod || null, card_id: cardId,
    }).eq("id", id);
    if (!error) {
      setMovements((prev) => prev.map((m) => m.id === id ? {
        ...m, date: editMovData.date, person: editMovData.person, type: editMovData.type, category: editMovData.category,
        subcategoryId, description: editMovData.description, currency: editMovData.currency, originalAmount: newAmount,
        fxRate: rate, amountArs, amountUsd, paymentMethod: editMovData.paymentMethod || null, cardId,
      } : m));
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
    setDebtForm({ name: "", owner: "Federico", balance: "", installment: "", dueDay: "", priority: "Media", rate: "", notes: "" });
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
    setDebtPayForm({ debtId: "", date: today(), amount: "", person: "Federico", notes: "" });
    setSaving(false);
  }

  // Préstamos: plata que la familia le da a un tercero (a diferencia de Deudas, que es lo que la
  // familia debe). Al otorgar uno se descuenta el capital como Inversión > Prestamos.
  async function addLoan() {
    if (!loanForm.name || !loanForm.principal || !loanForm.startDate) return;
    if (!loanForm.termMonths && !loanForm.targetInstallment) return;
    setSaving(true);
    const principal = Number(loanForm.principal);
    // Es plata de la familia, no de una persona en particular — se guarda con owner "Familia" fijo,
    // sin pedir a quién de la familia "pertenece".
    const { data, error } = await supabase.from("loans").insert([{
      name: loanForm.name, owner: "Familia", principal, annual_rate: Number(loanForm.annualRate || 0) / 100,
      start_date: loanForm.startDate, day_of_month: Number(loanForm.dayOfMonth || 10), grace_months: Number(loanForm.graceMonths || 0),
      term_months: loanForm.termMonths ? Number(loanForm.termMonths) : null,
      target_installment: loanForm.targetInstallment ? Number(loanForm.targetInstallment) : null,
      notes: loanForm.notes || null, status: "Activo",
    }]).select().single();
    if (error || !data) { console.error(error); setSaving(false); return; }

    const { data: mov } = await supabase.from("movements").insert([{
      movement_date: loanForm.startDate, person: "Familia", type: "Inversión", category: "Prestamos",
      description: `Préstamo otorgado a ${loanForm.name}`, original_currency: "ARS", original_amount: principal,
      fx_rate: 1, amount_ars: principal, amount_usd: principal / Math.max(blueRate, 1), payment_method: null,
      linked_debt_id: null, linked_goal_id: null,
    }]).select().single();
    if (mov) {
      setMovements((prev) => [mapMovementRow(mov), ...prev]);
      await supabase.from("loans").update({ linked_movement_id: mov.id }).eq("id", data.id);
    }
    setLoans((prev) => [{
      id: data.id, name: data.name, owner: data.owner, principal: data.principal, annualRate: data.annual_rate,
      startDate: data.start_date, dayOfMonth: data.day_of_month, graceMonths: data.grace_months,
      termMonths: data.term_months, targetInstallment: data.target_installment, notes: data.notes,
      status: data.status, linkedMovementId: mov?.id || null,
    }, ...prev]);
    setLoanForm({ name: "", principal: "", annualRate: "", startDate: today(), dayOfMonth: "10", graceMonths: "0", termMonths: "", targetInstallment: "", notes: "" });
    setSaving(false);
  }

  async function deleteLoan(id) {
    const loan = loans.find((l) => l.id === id);
    if (!window.confirm("¿Eliminar este préstamo? También se borran el desembolso y todos los cobros ya registrados.")) return;
    const payments = loanPayments.filter((p) => p.loanId === id);
    const movIdsToDelete = [loan?.linkedMovementId, ...payments.map((p) => p.linkedMovementId)].filter(Boolean);
    if (movIdsToDelete.length) await supabase.from("movements").delete().in("id", movIdsToDelete);
    await supabase.from("loan_payments").delete().eq("loan_id", id);
    await supabase.from("loans").delete().eq("id", id);
    setMovements((prev) => prev.filter((m) => !movIdsToDelete.includes(m.id)));
    setLoanPayments((prev) => prev.filter((p) => p.loanId !== id));
    setLoans((prev) => prev.filter((l) => l.id !== id));
  }

  async function registerLoanPayment() {
    const loan = loans.find((l) => String(l.id) === String(loanPayForm.loanId));
    if (!loan || !loanPayForm.amount) return;
    setSaving(true);
    const amount = Number(loanPayForm.amount);
    const { data: mov } = await supabase.from("movements").insert([{
      movement_date: loanPayForm.date, person: "Familia", type: "Ingreso", category: "Prestamos",
      description: `Cobro préstamo - ${loan.name}`, original_currency: "ARS", original_amount: amount,
      fx_rate: 1, amount_ars: amount, amount_usd: amount / Math.max(blueRate, 1), payment_method: null,
    }]).select().single();
    const { data: lp } = await supabase.from("loan_payments").insert([{
      loan_id: loan.id, payment_date: loanPayForm.date, amount, person: "Familia",
      notes: loanPayForm.notes || null, linked_movement_id: mov?.id || null,
    }]).select().single();
    if (mov) setMovements((prev) => [mapMovementRow(mov), ...prev]);
    if (lp) setLoanPayments((prev) => [{ id: lp.id, loanId: lp.loan_id, date: lp.payment_date, amount: lp.amount, person: lp.person, notes: lp.notes, linkedMovementId: lp.linked_movement_id }, ...prev]);
    setLoanPayForm({ loanId: "", date: today(), selectedPeriods: [], amount: "", notes: "" });
    setSaving(false);
  }

  // Ampliar un préstamo activo: suma capital extra (queda reflejado en el saldo pendiente) y opcionalmente
  // redefine la cuota para el tramo que sigue. Genera un movimiento de desembolso adicional.
  async function increaseLoan(loan) {
    const form = loanIncreaseForm[loan.id];
    const extra = Number(form?.amount || 0);
    if (!extra) return;
    setSaving(true);
    const newPrincipal = Number(loan.principal) + extra;
    const patch = { principal: newPrincipal };
    if (form?.newInstallment) patch.target_installment = Number(form.newInstallment);
    const { error } = await supabase.from("loans").update(patch).eq("id", loan.id);
    if (!error) {
      const { data: mov } = await supabase.from("movements").insert([{
        movement_date: today(), person: loan.owner, type: "Inversión", category: "Prestamos",
        description: `Ampliación de préstamo a ${loan.name}`, original_currency: "ARS", original_amount: extra,
        fx_rate: 1, amount_ars: extra, amount_usd: extra / Math.max(blueRate, 1), payment_method: null,
      }]).select().single();
      if (mov) setMovements((prev) => [mapMovementRow(mov), ...prev]);
      setLoans((prev) => prev.map((l) => l.id === loan.id ? { ...l, principal: newPrincipal, targetInstallment: form?.newInstallment ? Number(form.newInstallment) : l.targetInstallment } : l));
      setLoanIncreaseForm((prev) => ({ ...prev, [loan.id]: undefined }));
    }
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
    setGoalForm({ name: (categoryMap["Ahorro"] || [])[0] || "", owner: "Federico", goalType: "Ahorro", periodType: "Mensual", target: "", notes: "" });
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

  async function addPerson() {
    const v = catalogForm.person.trim();
    if (!v || people.includes(v)) { setCatalogForm((f) => ({ ...f, person: "" })); return; }
    const { data, error } = await supabase.from("settings_catalog").insert([{ catalog_type: "person", value: v }]).select().single();
    if (error) { console.error(error); return; }
    setCatalogRows((prev) => [...prev, data]);
    setPeople((prev) => [...prev, v]);
    setCatalogForm((f) => ({ ...f, person: "" }));
  }
  async function removePerson(name) {
    const row = catalogRows.find((r) => r.catalog_type === "person" && r.value === name);
    if (row) await supabase.from("settings_catalog").delete().eq("id", row.id);
    setCatalogRows((prev) => prev.filter((r) => r.id !== row?.id));
    setPeople((prev) => prev.filter((p) => p !== name));
  }
  async function addType() {
    const v = catalogForm.type.trim();
    if (!v || types.includes(v)) { setCatalogForm((f) => ({ ...f, type: "" })); return; }
    const { data, error } = await supabase.from("settings_catalog").insert([{ catalog_type: "type", value: v }]).select().single();
    if (error) { console.error(error); return; }
    setCatalogRows((prev) => [...prev, data]);
    setTypes((prev) => [...prev, v]);
    setCatalogForm((f) => ({ ...f, type: "" }));
  }
  async function removeType(name) {
    const row = catalogRows.find((r) => r.catalog_type === "type" && r.value === name);
    if (row) await supabase.from("settings_catalog").delete().eq("id", row.id);
    setCatalogRows((prev) => prev.filter((r) => r.id !== row?.id));
    setTypes((prev) => prev.filter((t) => t !== name));
  }

  async function addSubcategory() {
    const categoryId = subcatForm.categoryId ? Number(subcatForm.categoryId) : null;
    const name = subcatForm.name.trim();
    if (!categoryId || !name) return;
    const existing = (subcategoryMap[categoryId] || []).some((s) => s.name.toLowerCase() === name.toLowerCase());
    if (existing) return;
    const { data, error } = await supabase.from("subcategories").insert([{ category_id: categoryId, name, active: true }]).select().single();
    if (error) { console.error(error); return; }
    setSubcategoryRows((prev) => [...prev, data]);
    setSubcatForm((f) => ({ ...f, name: "" }));
  }
  async function removeSubcategory(row) {
    const used = movements.some((m) => m.subcategoryId === row.id);
    if (used) return;
    const { error } = await supabase.from("subcategories").update({ active: false }).eq("id", row.id);
    if (error) return;
    setSubcategoryRows((prev) => prev.filter((r) => r.id !== row.id));
  }

  async function addCard() {
    const name = cardForm.name.trim();
    if (!name) return;
    const { data, error } = await supabase.from("cards").insert([{ name, owner: cardForm.owner, active: true }]).select().single();
    if (error) { console.error(error); return; }
    setCards((prev) => [...prev, data]);
    setCardForm((f) => ({ ...f, name: "" }));
  }
  async function removeCard(row) {
    const used = movements.some((m) => m.cardId === row.id);
    if (used) return;
    const { error } = await supabase.from("cards").update({ active: false }).eq("id", row.id);
    if (error) return;
    setCards((prev) => prev.filter((c) => c.id !== row.id));
  }

  const personMovements = useMemo(() => movements.filter((m) => selectedPerson === "all" || m.person === selectedPerson), [movements, selectedPerson]);
  const personDebts = useMemo(() => debts.filter((d) => selectedPerson === "all" || d.owner === selectedPerson), [debts, selectedPerson]);
  // Los préstamos son plata de la familia, no de una persona — se muestran siempre todos, sin
  // importar el filtro global de "Persona".
  const personLoans = loans;
  const loanCollectedById = useMemo(() => {
    const map = {};
    loanPayments.forEach((p) => { map[p.loanId] = (map[p.loanId] || 0) + Number(p.amount || 0); });
    return map;
  }, [loanPayments]);

  // Cobros de préstamos esperados para el mes de Presupuesto elegido — en base al saldo real
  // pendiente hoy de cada préstamo (no el plan original), así refleja pagos ya adelantados o
  // atrasados. Es solo informativo: no reemplaza al presupuesto por categoría.
  const expectedLoanCollectionsByMonth = useMemo(() => {
    return loans.map((loan) => {
      const collected = loanCollectedById[loan.id] || 0;
      const pending = Math.max(0, Number(loan.principal || 0) - collected);
      if (pending <= 0) return { loan, amount: 0 };
      const base = computeLoanSchedule(loan);
      const remaining = computeLoanSchedule(loan, { principal: pending, startDate: today(), graceMonths: 0, installment: base.installment });
      const amount = remaining.rows.filter((r) => monthKey(r.date) === budgetForm.month && r.payment > 0).reduce((a, r) => a + r.payment, 0);
      return { loan, amount };
    }).filter((x) => x.amount > 0);
  }, [loans, loanCollectedById, budgetForm.month]);
  const selectedLoanForPay = loans.find((l) => String(l.id) === String(loanPayForm.loanId));
  const loanForwardScheduleForPay = useMemo(() => {
    if (!selectedLoanForPay) return null;
    const pending = Math.max(0, Number(selectedLoanForPay.principal || 0) - (loanCollectedById[selectedLoanForPay.id] || 0));
    // Mantiene la cuota original del préstamo (no la recalcula para el plazo de alta) y proyecta
    // cuántos períodos hacen falta desde el saldo real pendiente.
    const originalInstallment = computeLoanSchedule(selectedLoanForPay).installment;
    return computeLoanSchedule(selectedLoanForPay, { principal: pending, startDate: today(), graceMonths: 0, installment: originalInstallment });
  }, [selectedLoanForPay, loanCollectedById]);

  // Simulación en vivo del préstamo a otorgar: se calcula 100% en el cliente a partir de lo tipeado
  // en el formulario, sin tocar Supabase — así se puede ver cuota, plazo y ganancia real proyectada
  // ANTES de decidir otorgarlo. Recién al tocar "Otorgar préstamo" se confirma y se persiste.
  const loanPreview = useMemo(() => {
    const principal = Number(loanForm.principal || 0);
    if (!principal || (!loanForm.termMonths && !loanForm.targetInstallment) || !loanForm.startDate) return null;
    const virtualLoan = {
      principal, annualRate: Number(loanForm.annualRate || 0) / 100, startDate: loanForm.startDate,
      dayOfMonth: Number(loanForm.dayOfMonth || 10), graceMonths: Number(loanForm.graceMonths || 0),
      termMonths: loanForm.termMonths ? Number(loanForm.termMonths) : null,
      targetInstallment: loanForm.targetInstallment ? Number(loanForm.targetInstallment) : null,
    };
    const schedule = computeLoanSchedule(virtualLoan);
    if (!schedule.rows.length) return { schedule, gain: null };
    const gain = computeProjectedRealGain(virtualLoan, schedule, 0, 0, ipcData);
    return { schedule, gain };
  }, [loanForm.principal, loanForm.annualRate, loanForm.startDate, loanForm.dayOfMonth, loanForm.graceMonths, loanForm.termMonths, loanForm.targetInstallment, ipcData]);

  const personGoals = useMemo(() => goals.filter((g) => selectedPerson === "all" || g.owner === selectedPerson), [goals, selectedPerson]);

  const summary = useMemo(() => {
    const income = personMovements.filter((m) => m.type === "Ingreso").reduce((a, b) => a + b.amountArs, 0);
    const expenses = personMovements.filter((m) => m.type === "Egreso").reduce((a, b) => a + b.amountArs, 0);
    const savings = personMovements.filter((m) => m.type === "Ahorro").reduce((a, b) => a + b.amountArs, 0);
    const investments = personMovements.filter((m) => m.type === "Inversión").reduce((a, b) => a + b.amountArs, 0);
    const totalDebt = personDebts.reduce((a, b) => a + b.balance, 0);
    return { income, expenses, savings, investments, totalDebt, net: income - expenses - savings - investments };
  }, [personMovements, personDebts]);

  // Mapa mes -> {inc,exp,sav,inv} y mes -> fila de monthly_balances, para poder encadenar el saldo
  // de un mes con el cierre calculado del anterior sin recorrer todo movements en cada paso.
  const movementsByMonth = useMemo(() => {
    const map = {};
    personMovements.forEach((m) => {
      const k = monthKey(m.date);
      if (!map[k]) map[k] = { inc: 0, exp: 0, sav: 0, inv: 0 };
      if (m.type === "Ingreso") map[k].inc += m.amountArs;
      else if (m.type === "Egreso") map[k].exp += m.amountArs;
      else if (m.type === "Ahorro") map[k].sav += m.amountArs;
      else if (m.type === "Inversión") map[k].inv += m.amountArs;
    });
    return map;
  }, [personMovements]);
  const monthlyBalanceByMonth = useMemo(() => {
    const map = {};
    monthlyBalances.forEach((b) => { map[b.balance_month] = b; });
    return map;
  }, [monthlyBalances]);
  const prevMonthKeyOf = (mk) => {
    const [y, m] = mk.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  // Saldo inicial de un mes: si hay una fila guardada para ese mes (aunque sea "usar este valor" o
  // la que arma closeMonth), se respeta tal cual. Si no hay fila, se deriva del cierre calculado del
  // mes anterior (recursivo) — así el saldo arrastra solo aunque nunca se haya guardado a mano.
  const computeMonthBalance = useCallback((mk, cache = {}) => {
    if (cache[mk]) return cache[mk];
    const rec = monthlyBalanceByMonth[mk];
    const movs = movementsByMonth[mk] || { inc: 0, exp: 0, sav: 0, inv: 0 };
    let opening;
    if (rec) {
      opening = Number(rec.opening_balance_ars || 0);
    } else {
      const prevKey = prevMonthKeyOf(mk);
      const hasPrevData = movementsByMonth[prevKey] || monthlyBalanceByMonth[prevKey];
      opening = hasPrevData ? computeMonthBalance(prevKey, cache).closing : 0;
    }
    const result = { opening, inc: movs.inc, exp: movs.exp, sav: movs.sav, inv: movs.inv, closing: opening + movs.inc - movs.exp - movs.sav - movs.inv };
    cache[mk] = result;
    return result;
  }, [monthlyBalanceByMonth, movementsByMonth]);

  const monthBalance = useMemo(() => computeMonthBalance(reportMonth), [computeMonthBalance, reportMonth]);

  // Sugerencia de presupuesto = promedio del gasto real de los 3 meses previos (persona+tipo+categoría)
  // Promedio de los últimos meses con datos reales para esta persona+tipo+categoría — si sólo hay
  // 1 mes de historial (ej. recién arrancado) usa ese, con 2 promedia esos 2, y a partir de 3 siempre
  // toma los 3 más recientes (no un promedio histórico acumulado).
  const budgetAvgSuggestion = useMemo(() => {
    const [y, m] = budgetForm.month.split("-").map(Number);
    const found = [];
    for (let n = 1; n <= 12 && found.length < 3; n++) {
      const d = new Date(y, m - 1 - n, 1);
      const mo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthMovs = personMovements.filter((mv) => monthKey(mv.date) === mo && mv.person === budgetForm.person && mv.type === budgetForm.type && mv.category === budgetForm.category);
      if (monthMovs.length) found.push(monthMovs.reduce((a, mv) => a + mv.amountArs, 0));
    }
    if (!found.length) return null;
    return { value: Math.round(found.reduce((a, b) => a + b, 0) / found.length), months: found.length };
  }, [personMovements, budgetForm.month, budgetForm.person, budgetForm.type, budgetForm.category]);

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

  // Evolución mensual por categoría+descripción
  const evolutionData = useMemo(() => {
    // Todos los meses con datos
    const months = [...new Set(personMovements.map((m) => monthKey(m.date)))].sort();
    // Todas las categorías con egresos
    const cats = [...new Set(personMovements.filter((m) => m.type === "Egreso").map((m) => m.category))].sort();
    // Por categoría → por descripción → por mes
    const result = {};
    cats.forEach((cat) => {
      const catMovs = personMovements.filter((m) => m.type === "Egreso" && m.category === cat);
      // Total por mes para esta categoría
      const byMonth = {};
      months.forEach((mo) => { byMonth[mo] = 0; });
      catMovs.forEach((m) => { byMonth[monthKey(m.date)] = (byMonth[monthKey(m.date)] || 0) + amountDisplay(m); });
      // Subcategorías estandarizadas (catálogo), no texto libre — así son comparables entre meses
      const subIds = [...new Set(catMovs.filter((m) => m.subcategoryId).map((m) => m.subcategoryId))];
      const subRows = subIds.map((subId) => {
        const subByMonth = {};
        months.forEach((mo) => { subByMonth[mo] = 0; });
        catMovs.filter((m) => m.subcategoryId === subId).forEach((m) => { subByMonth[monthKey(m.date)] = (subByMonth[monthKey(m.date)] || 0) + amountDisplay(m); });
        return { desc: subcategoryNameById[subId] || `#${subId}`, byMonth: subByMonth };
      }).sort((a, b) => a.desc.localeCompare(b.desc));
      result[cat] = { byMonth, subRows };
    });
    return { months, cats, result };
  }, [personMovements, amountDisplay, subcategoryNameById]);

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
    const q = filters.search.trim().toLowerCase();
    return personMovements.filter((m) => {
      if (filters.type !== "all" && m.type !== filters.type) return false;
      if (filters.category !== "all" && m.category !== filters.category) return false;
      if (filters.subcategoryId !== "all" && String(m.subcategoryId) !== filters.subcategoryId) return false;
      if (filters.currency !== "all" && m.currency !== filters.currency) return false;
      if (filters.dateFrom && m.date < filters.dateFrom) return false;
      if (filters.dateTo && m.date > filters.dateTo) return false;
      if (filters.fv !== "all" && (m.type !== "Egreso" || getFV(m.type, m.category) !== filters.fv)) return false;
      if (q) {
        const haystack = `${m.category} ${subcategoryNameById[m.subcategoryId] || ""} ${m.description || ""} ${m.person}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [personMovements, filters, getFV, subcategoryNameById]);

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
    const headers = ["Fecha","Persona","Tipo","Categoría","Subcategoría","F/V","Detalle","Medio de pago","Moneda","Original","TC","ARS","USD"];
    const rows = filteredMovements.map((m) => [
      m.date, m.person, m.type, m.category, subcategoryNameById[m.subcategoryId] || "", m.type === "Egreso" ? getFV(m.type, m.category) : "", m.description || "",
      m.paymentMethod || "", m.currency, m.originalAmount, m.fxRate, Number(m.amountArs || 0).toFixed(2), Number(m.amountUsd || 0).toFixed(2),
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
    const closing = computeMonthBalance(month).closing;
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
  const descriptionSuggestions = useMemo(() => {
    if (!movForm.category) return [];
    const seen = new Set();
    movements.forEach((m) => { if (m.category === movForm.category && m.description?.trim()) seen.add(m.description.trim()); });
    return Array.from(seen).sort();
  }, [movements, movForm.category]);
  const selectedDebtForPay = personDebts.find((d) => String(d.id) === String(debtPayForm.debtId));

  if (loading) return <div className="loading-screen"><Spinner /><p>Cargando datos…</p></div>;

  return (
    <div className="app-shell">
      <div className="app-container">
        <div className="header">
          <div>
            <h1 className="app-title"><span className="app-title-icon">💰</span> Finanzas Familiares</h1>
            <p className="app-subtitle">Gastos, presupuesto, deudas y metas · Guardado en la nube</p>
          </div>
          <div className="header-controls" />
        </div>

        <Card>
          <div className="filter-grid">
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
            {tab === "datos" && (
              <>
                <Field label="Desde"><Input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} /></Field>
                <Field label="Hasta"><Input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} /></Field>
                <Field label="Tipo"><Select value={filters.type} onChange={(v) => setFilters({ ...filters, type: v })}><option value="all">Todos</option>{types.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
                <Field label="Categoría"><Select value={filters.category} onChange={(v) => setFilters({ ...filters, category: v, subcategoryId: "all" })}><option value="all">Todas</option>{[...new Set(Object.values(categoryMap).flat())].map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field>
                <Field label="Subcategoría">
                  <Select value={filters.subcategoryId} onChange={(v) => setFilters({ ...filters, subcategoryId: v })}>
                    <option value="all">Todas</option>
                    {subcategoryRows
                      .filter((s) => filters.category === "all" || categoryRows.find((c) => c.id === s.category_id)?.name === filters.category)
                      .map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                  </Select>
                </Field>
                <Field label="F/V"><Select value={filters.fv} onChange={(v) => setFilters({ ...filters, fv: v })}><option value="all">Todos</option><option value="F">Fijos</option><option value="V">Variables</option></Select></Field>
                <Field label="Buscar"><Input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Ej. Dany" /></Field>
              </>
            )}
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
                <Field label="Persona">
                  {movForm.shared
                    ? <div className="control" style={{ display: "flex", alignItems: "center", color: "var(--muted)" }}>Se reparte abajo 👇</div>
                    : <Select value={movForm.person} onChange={(v) => setMovForm({ ...movForm, person: v })}>{people.map((p) => <option key={p} value={p}>{p}</option>)}</Select>}
                </Field>
                <Field label="¿Es compartido?">
                  <label style={{ display: "flex", alignItems: "center", gap: 6, height: "100%" }}>
                    <input type="checkbox" checked={movForm.shared} onChange={(e) => setMovForm({ ...movForm, shared: e.target.checked, sharedPeople: e.target.checked ? [...people] : [] })} />
                    <span className="muted small">Repartir entre varias personas</span>
                  </label>
                </Field>
                {movForm.shared && (
                  <Field label="Repartir entre">
                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", height: "100%" }}>
                      {people.map((p) => (
                        <label key={p} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <input
                            type="checkbox"
                            checked={movForm.sharedPeople.includes(p)}
                            onChange={(e) => {
                              const next = e.target.checked ? [...movForm.sharedPeople, p] : movForm.sharedPeople.filter((x) => x !== p);
                              setMovForm({ ...movForm, sharedPeople: next });
                            }}
                          /> {p}
                        </label>
                      ))}
                    </div>
                  </Field>
                )}
                <Field label="Tipo"><Select value={movForm.type} onChange={(v) => setMovForm({ ...movForm, type: v, category: "", subcategoryId: "", linkedDebtId: "", linkedGoalId: "" })}><option value="">Seleccionar…</option>{types.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
                <Field label="Categoría"><Select value={movForm.category} onChange={(v) => setMovForm({ ...movForm, category: v, subcategoryId: "", linkedDebtId: v !== "Deuda" ? "" : movForm.linkedDebtId })} disabled={!movForm.type}><option value="">Seleccionar…</option>{(categoryMap[movForm.type] || []).map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field>
                {movForm.type === "Egreso" && movForm.category === "Deuda" && <Field label="Deuda"><Select value={movForm.linkedDebtId} onChange={(v) => setMovForm({ ...movForm, linkedDebtId: v, originalAmount: personDebts.find((d) => String(d.id) === String(v))?.installment || "" })}><option value="">Elegir deuda…</option>{personDebts.map((d) => <option key={d.id} value={String(d.id)}>{d.name} ({fmtArs(d.balance)} pendiente)</option>)}</Select></Field>}

                <Field label="Subcategoría">
                  <Select value={movForm.subcategoryId} onChange={(v) => setMovForm({ ...movForm, subcategoryId: v })} disabled={!movForm.category}>
                    <option value="">Sin subcategoría</option>
                    {(subcategoryMap[categoryIdFor(movForm.type, movForm.category)] || []).map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                  </Select>
                </Field>
                <Field label="Detalle (opcional)"><DescriptionAutocomplete value={movForm.description} onChange={(v) => setMovForm({ ...movForm, description: v })} suggestions={descriptionSuggestions} /></Field>
                <Field label="Medio de pago"><Select value={movForm.paymentMethod} onChange={(v) => setMovForm({ ...movForm, paymentMethod: v, cardId: v === "Tarjeta" ? movForm.cardId : "", installments: v === "Tarjeta" ? movForm.installments : "1" })}><option value="">Sin especificar</option>{PAYMENT_METHODS.map((p) => <option key={p} value={p}>{p}</option>)}</Select></Field>
                {movForm.paymentMethod === "Tarjeta" && (
                  <>
                    <Field label="Tarjeta">
                      <Select value={movForm.cardId} onChange={(v) => setMovForm({ ...movForm, cardId: v })}>
                        <option value="">Elegir tarjeta…</option>
                        {cards.map((c) => <option key={c.id} value={String(c.id)}>{c.name}{c.owner ? ` · ${c.owner}` : ""}</option>)}
                      </Select>
                    </Field>
                    <Field label="Cuotas"><Input type="number" min="1" value={movForm.installments} onChange={(e) => setMovForm({ ...movForm, installments: e.target.value })} placeholder="1" /></Field>
                  </>
                )}

                <Field label="Moneda"><Select value={movForm.currency} onChange={(v) => setMovForm({ ...movForm, currency: v })}><option value="ARS">Pesos (ARS)</option><option value="USD">Dólar blue (USD)</option></Select></Field>
                <Field label={movForm.paymentMethod === "Tarjeta" && Number(movForm.installments) > 1 ? "Importe total de la compra" : `Importe${movForm.currency === "USD" ? " (USD)" : " (ARS)"}`}><Input type="number" value={movForm.originalAmount} onChange={(e) => setMovForm({ ...movForm, originalAmount: e.target.value })} placeholder="0" /></Field>
              </div>
              {selectedDebtForMov && movForm.category === "Deuda" && <InfoBox color="blue">Cuota sugerida: <strong>{fmtArs(selectedDebtForMov.installment)}</strong> · Saldo pendiente: <strong>{fmtArs(selectedDebtForMov.balance)}</strong>.</InfoBox>}
              {movForm.currency === "USD" && <InfoBox color="amber">Cotización blue del momento: <strong>{money(blueRate)}</strong> por USD · Importe en ARS: <strong>{money(toArs(movForm.originalAmount || 0, "USD", blueRate))}</strong></InfoBox>}
              {movForm.paymentMethod === "Tarjeta" && Number(movForm.installments) > 1 && movForm.originalAmount && movForm.shared && movForm.sharedPeople.length >= 2 && (() => {
                const n = movForm.sharedPeople.length;
                const share = Number(movForm.originalAmount) / n;
                const perInstallment = share / Number(movForm.installments);
                return (
                  <InfoBox color="blue">
                    Se reparte en partes iguales entre <strong>{movForm.sharedPeople.join(", ")}</strong>: <strong>{money(share, movForm.currency)}</strong> cada uno · y la parte de cada uno se cobra en <strong>{movForm.installments} cuotas mensuales</strong> de <strong>{money(perInstallment, movForm.currency)}</strong>, empezando el {movForm.date}.
                  </InfoBox>
                );
              })()}
              {movForm.paymentMethod === "Tarjeta" && Number(movForm.installments) > 1 && movForm.originalAmount && !(movForm.shared && movForm.sharedPeople.length >= 2) && (
                <InfoBox color="blue">Se van a crear <strong>{movForm.installments} movimientos mensuales</strong> de <strong>{money(Number(movForm.originalAmount) / Number(movForm.installments), movForm.currency)}</strong> cada uno, empezando el {movForm.date}.</InfoBox>
              )}
              {!(movForm.paymentMethod === "Tarjeta" && Number(movForm.installments) > 1) && movForm.shared && movForm.sharedPeople.length >= 2 && movForm.originalAmount && (
                <InfoBox color="blue">Se reparte en partes iguales entre <strong>{movForm.sharedPeople.join(", ")}</strong>: <strong>{money(Number(movForm.originalAmount) / movForm.sharedPeople.length, movForm.currency)}</strong> cada uno.</InfoBox>
              )}
              {movForm.shared && movForm.sharedPeople.length < 2 && (
                <InfoBox color="amber">Elegí al menos 2 personas para repartir el gasto.</InfoBox>
              )}
              {!movForm.shared && movForm.type && movForm.category && (movForm.type === "Egreso" || movForm.type === "Ingreso") && (() => {
                const monthMov = monthKey(movForm.date);
                const hasBudget = budgets.some((b) => b.month === monthMov && b.person === movForm.person && b.type === movForm.type && b.category === movForm.category);
                return !hasBudget ? <InfoBox color="amber">⚠️ No hay presupuesto cargado para <strong>{movForm.category}</strong> · {movForm.person} en {monthMov}. Podés cargarlo en la pestaña Presupuesto.</InfoBox> : null;
              })()}
              <div style={{ marginTop: 16 }}><Btn onClick={addMovement} disabled={saving || !movForm.type || !movForm.category || !movForm.originalAmount || (movForm.shared && movForm.sharedPeople.length < 2)}>{saving ? "Guardando…" : "＋ Agregar movimiento"}</Btn></div>
            </Card>

            <Card>
              <CardHead title="Transferencia entre tipos" icon="🔀" />
              <p className="muted small" style={{ marginBottom: 12 }}>Movés plata de un tipo a otro (ej. Ahorro → Inversión). Se crean dos movimientos automáticamente.</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
                <Field label="Fecha"><Input type="date" value={transferForm.date} onChange={(e) => setTransferForm({ ...transferForm, date: e.target.value })} /></Field>
                <Field label="Persona"><Select value={transferForm.person} onChange={(v) => setTransferForm({ ...transferForm, person: v })}>{people.map((p) => <option key={p} value={p}>{p}</option>)}</Select></Field>
                <Field label="De"><Select value={transferForm.fromType} onChange={(v) => setTransferForm({ ...transferForm, fromType: v, fromCategory: "" })}>{types.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
                <Field label="Categoría"><Select value={transferForm.fromCategory} onChange={(v) => setTransferForm({ ...transferForm, fromCategory: v })}><option value="">Seleccionar…</option>{(categoryMap[transferForm.fromType] || []).map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field>
                <div style={{ fontSize: "1.2rem", paddingBottom: 9, color: "var(--muted)" }}>→</div>
                <Field label="A"><Select value={transferForm.toType} onChange={(v) => setTransferForm({ ...transferForm, toType: v, toCategory: "" })}>{types.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
                <Field label="Categoría"><Select value={transferForm.toCategory} onChange={(v) => setTransferForm({ ...transferForm, toCategory: v })}><option value="">Seleccionar…</option>{(categoryMap[transferForm.toType] || []).map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field>
                <Field label="Moneda"><Select value={transferForm.currency} onChange={(v) => setTransferForm({ ...transferForm, currency: v })}><option value="ARS">Pesos (ARS)</option><option value="USD">Dólar blue (USD)</option></Select></Field>
                <Field label={`Importe (${transferForm.currency})`}><Input type="number" value={transferForm.originalAmount} onChange={(e) => setTransferForm({ ...transferForm, originalAmount: e.target.value })} placeholder="0" /></Field>
              </div>
              <div style={{ marginTop: 10 }}>
                <Field label="Descripción (opcional)"><Input value={transferForm.description} onChange={(e) => setTransferForm({ ...transferForm, description: e.target.value })} placeholder={`Ej. Paso fondos de ${transferForm.fromCategory || "origen"} a ${transferForm.toCategory || "destino"}`} /></Field>
              </div>
              {transferForm.originalAmount && transferForm.fromCategory && transferForm.toCategory && (
                <InfoBox color="blue">Se crearán 2 movimientos por <strong>{transferForm.currency === "USD" ? money(transferForm.originalAmount, "USD") : money(toArs(transferForm.originalAmount, "ARS", 1))}</strong>: un egreso de <strong>{transferForm.fromCategory}</strong> ({transferForm.fromType}) y un ingreso en <strong>{transferForm.toCategory}</strong> ({transferForm.toType}).</InfoBox>
              )}
              <div style={{ marginTop: 14 }}>
                <Btn onClick={addTransfer} disabled={saving || !transferForm.fromCategory || !transferForm.toCategory || !transferForm.originalAmount}>{saving ? "Guardando…" : "🔀 Registrar transferencia"}</Btn>
              </div>
            </Card>

            {loans.length > 0 && (
              <Card>
                <CardHead title="Cobrar cuota de préstamo" icon="🏦" />
                <div className="form-grid three-col">
                  <Field label="Préstamo">
                    <Select value={loanPayForm.loanId} onChange={(v) => setLoanPayForm({ ...loanPayForm, loanId: v, selectedPeriods: [], amount: "" })}>
                      <option value="">Elegir préstamo…</option>
                      {personLoans.map((l) => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="Fecha"><Input type="date" value={loanPayForm.date} onChange={(e) => setLoanPayForm({ ...loanPayForm, date: e.target.value })} /></Field>
                </div>
                {selectedLoanForPay && loanForwardScheduleForPay?.rows.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div className="field-label" style={{ marginBottom: 6 }}>Tocá las cuotas que se están cancelando ahora</div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {loanForwardScheduleForPay.rows.slice(0, 6).map((r) => {
                        const checked = loanPayForm.selectedPeriods.includes(r.period);
                        return (
                          <label key={r.period} className="tag" style={{ cursor: "pointer", background: checked ? "var(--primary)" : "var(--primary-light)", color: checked ? "#fff" : "var(--primary)" }}>
                            <input
                              type="checkbox" checked={checked} style={{ marginRight: 4 }}
                              onChange={(e) => {
                                const nextPeriods = e.target.checked
                                  ? [...loanPayForm.selectedPeriods, r.period]
                                  : loanPayForm.selectedPeriods.filter((p) => p !== r.period);
                                const sum = loanForwardScheduleForPay.rows.filter((row) => nextPeriods.includes(row.period)).reduce((a, row) => a + row.payment, 0);
                                setLoanPayForm({ ...loanPayForm, selectedPeriods: nextPeriods, amount: sum ? String(Math.round(sum)) : "" });
                              }}
                            />
                            {r.date} · {fmtArs(r.payment)}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="form-grid three-col" style={{ marginTop: 12 }}>
                  <Field label="Importe a registrar"><Input type="number" value={loanPayForm.amount} onChange={(e) => setLoanPayForm({ ...loanPayForm, amount: e.target.value })} placeholder="0" /></Field>
                  <Field label="Notas"><Input value={loanPayForm.notes || ""} onChange={(e) => setLoanPayForm({ ...loanPayForm, notes: e.target.value })} /></Field>
                </div>
                <div style={{ marginTop: 12 }}><Btn onClick={registerLoanPayment} disabled={saving || !loanPayForm.loanId || !loanPayForm.amount}>{saving ? "Guardando…" : "＋ Registrar cobro"}</Btn></div>
              </Card>
            )}
          </div>
        )}

        {tab === "recurrentes" && (
          <div className="tab-content">
            <Card>
              <CardHead title="Débito automático — nueva alta" icon="🔁" />
              <p className="muted small" style={{ marginBottom: 12 }}>Para gastos que se repiten todos los meses (alquiler, suscripciones, seguros). Se generan movimientos automáticamente desde la fecha elegida hasta el 31/12 de ese año. Si necesitás cortarlo antes (por ejemplo, si se dio de baja), lo hacés después desde "Series activas".</p>
              <div className="form-grid">
                <Field label="Persona"><Select value={debitoForm.person} onChange={(v) => setDebitoForm({ ...debitoForm, person: v })}>{people.map((p) => <option key={p} value={p}>{p}</option>)}</Select></Field>
                <Field label="Tipo"><Select value={debitoForm.type} onChange={(v) => setDebitoForm({ ...debitoForm, type: v, category: "", subcategoryId: "" })}>{types.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
                <Field label="Categoría"><Select value={debitoForm.category} onChange={(v) => setDebitoForm({ ...debitoForm, category: v, subcategoryId: "" })}><option value="">Seleccionar…</option>{(categoryMap[debitoForm.type] || []).map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field>
                <Field label="Subcategoría">
                  <Select value={debitoForm.subcategoryId} onChange={(v) => setDebitoForm({ ...debitoForm, subcategoryId: v })} disabled={!debitoForm.category}>
                    <option value="">Sin subcategoría</option>
                    {(subcategoryMap[categoryIdFor(debitoForm.type, debitoForm.category)] || []).map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                  </Select>
                </Field>
                <Field label="Detalle (opcional)"><Input value={debitoForm.description} onChange={(e) => setDebitoForm({ ...debitoForm, description: e.target.value })} placeholder="Ej. Netflix, Alquiler depto" /></Field>
                <Field label="Moneda"><Select value={debitoForm.currency} onChange={(v) => setDebitoForm({ ...debitoForm, currency: v })}><option value="ARS">Pesos (ARS)</option><option value="USD">Dólar blue (USD)</option></Select></Field>
                <Field label={`Importe${debitoForm.currency === "USD" ? " (USD)" : " (ARS)"}`}><Input type="number" value={debitoForm.amount} onChange={(e) => setDebitoForm({ ...debitoForm, amount: e.target.value })} placeholder="0" /></Field>
                <Field label="Día del mes"><Input type="number" min="1" max="28" value={debitoForm.dayOfMonth} onChange={(e) => setDebitoForm({ ...debitoForm, dayOfMonth: e.target.value })} /></Field>
                <Field label="Desde"><Input type="date" value={debitoForm.startDate} onChange={(e) => setDebitoForm({ ...debitoForm, startDate: e.target.value })} /></Field>
              </div>
              {debitoForm.amount && debitoForm.category && (
                <InfoBox color="blue">Se van a crear movimientos el día {debitoForm.dayOfMonth} de cada mes, desde {debitoForm.startDate} hasta el 31/12/{debitoForm.startDate.slice(0, 4)}.</InfoBox>
              )}
              <div style={{ marginTop: 12 }}><Btn onClick={addDebitoAutomatico} disabled={saving || !debitoForm.category || !debitoForm.amount}>{saving ? "Guardando…" : "＋ Crear débito automático"}</Btn></div>
            </Card>

            <Card>
              <CardHead title="Series activas" icon="📋" />
              {movementSeries.length === 0 && <EmptyState msg="No hay débitos automáticos ni compras en cuotas activas." />}
              {movementSeries.map((s) => {
                const genMovs = movements.filter((m) => m.seriesId === s.id);
                const pending = genMovs.filter((m) => m.date > today()).length;
                return (
                  <div key={s.id} className="budget-inline-row" style={{ flexWrap: "wrap" }}>
                    <div className="budget-inline-left">
                      <span className="budget-inline-cat">
                        {s.kind === "tarjeta_cuotas" ? "💳" : "🔁"} {s.category}
                        {s.subcategory_id && subcategoryNameById[s.subcategory_id] ? ` · ${subcategoryNameById[s.subcategory_id]}` : ""}
                      </span>
                      <span className="muted small">
                        {s.person} · {money(s.installment_amount, s.currency)}{s.kind === "tarjeta_cuotas" ? ` · cuota ${Math.max(0, (s.installments_total || 0) - pending)}/${s.installments_total} · ${cardNameById[s.card_id] || "tarjeta"}` : ` · día ${s.day_of_month}`} · {s.start_date} → {s.end_date}
                      </span>
                    </div>
                    <div className="budget-inline-right" style={{ gap: 8, alignItems: "center" }}>
                      <Input type="date" value={seriesEndDateInputs[s.id] || s.end_date} onChange={(e) => setSeriesEndDateInputs((p) => ({ ...p, [s.id]: e.target.value }))} />
                      <Btn small variant="outline" onClick={() => truncateSeries(s, seriesEndDateInputs[s.id] || s.end_date)}>Definir fin</Btn>
                      <button className="del-btn" onClick={() => deleteSeries(s)}>🗑</button>
                    </div>
                  </div>
                );
              })}
            </Card>

            <Card>
              <CardHead title="Conciliación de resumen de tarjeta" icon="🧾" />
              <p className="muted small" style={{ marginBottom: 12 }}>Elegí la tarjeta y el mes para ver qué cargaste. Si falta algo, cargalo en "Cargar". Cuando esté completo, poné el total del resumen del banco: la diferencia (mayormente impuestos) se registra sola como gasto en "Impuestos Tarjetas".</p>
              <div className="form-grid three-col">
                <Field label="Tarjeta">
                  <Select value={reconcileForm.cardId} onChange={(v) => setReconcileForm({ ...reconcileForm, cardId: v })}>
                    <option value="">Elegir tarjeta…</option>
                    {cards.map((c) => <option key={c.id} value={String(c.id)}>{c.name}{c.owner ? ` · ${c.owner}` : ""}</option>)}
                  </Select>
                </Field>
                <Field label="Mes"><Input type="month" value={reconcileForm.month} onChange={(e) => setReconcileForm({ ...reconcileForm, month: e.target.value })} /></Field>
                <Field label="Total según resumen del banco"><Input type="number" value={reconcileForm.statementTotal} onChange={(e) => setReconcileForm({ ...reconcileForm, statementTotal: e.target.value })} placeholder="0" /></Field>
              </div>
              {reconcileForm.cardId && (
                <>
                  {reconcileMovements.length === 0 && <EmptyState msg="No hay movimientos cargados con esta tarjeta en ese mes." />}
                  {reconcileMovements.map((m) => (
                    <div key={m.id} className="report-row"><div>{m.date} · {m.category}{m.description ? ` · ${m.description}` : ""}</div><strong>{fmtArs(m.amountArs)}</strong></div>
                  ))}
                  <div className="report-row total"><div>Total cargado</div><strong>{fmtArs(reconcileSum)}</strong></div>
                  {reconcileDiff !== null && (
                    <>
                      <InfoBox color={reconcileDiff > 0 ? "blue" : "amber"}>
                        {reconcileDiff > 0
                          ? <>Diferencia a registrar: <strong>{fmtArs(reconcileDiff)}</strong> (resumen − cargado).</>
                          : <>El total cargado ya cubre o supera el resumen ({fmtArs(reconcileSum)} vs {fmtArs(Number(reconcileForm.statementTotal))}). Revisá que no haya algo duplicado antes de seguir.</>}
                      </InfoBox>
                      <div style={{ marginTop: 12 }}>
                        <Btn onClick={registerCardDifference} disabled={saving || reconcileDiff <= 0}>{saving ? "Guardando…" : "Registrar diferencia como gasto de tarjeta"}</Btn>
                      </div>
                    </>
                  )}
                </>
              )}
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
                                <div key={cat} style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px 80px", gap: 6, alignItems: "center", padding: "7px 14px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", fontSize: "0.85rem" }}>
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
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Btn onClick={exportCSV} variant="outline" small>⬇ Exportar movimientos</Btn>
              <Btn onClick={() => exportSection("desviaciones")} variant="outline" small>⬇ Exportar desviaciones</Btn>
              <span className="muted small">{filteredMovements.length} registros</span>
            </div>
            <Card>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Fecha</th><th>Persona</th><th>Tipo</th><th>Categoría</th><th>Subcategoría</th><th>F/V</th><th>Detalle</th><th>Moneda</th><th>Original</th><th>ARS</th><th>USD</th><th></th></tr></thead>
                  <tbody>
                    {filteredMovements.map((m) => {
                      const isEditing = editingMovId === m.id;
                      const isClosed = monthlyBalances.find((b) => b.balance_month === monthKey(m.date) && b.closed);
                      return (
                        <React.Fragment key={m.id}>
                          <tr>
                            <td>{m.date}</td>
                            <td>
                              {m.person}
                              {m.sharedGroupId && (
                                <span
                                  className="muted small"
                                  title={`Compartido con ${movements.filter((x) => x.sharedGroupId === m.sharedGroupId && x.id !== m.id).map((x) => x.person).join(", ")}`}
                                  style={{ marginLeft: 4 }}
                                >🤝</span>
                              )}
                            </td>
                            <td><Badge color={m.type === "Ingreso" ? "green" : m.type === "Egreso" ? "red" : m.type === "Ahorro" ? "blue" : "purple"}>{m.type}</Badge></td>
                            <td>{m.category}</td>
                            <td className="muted">{subcategoryNameById[m.subcategoryId] || "—"}</td>
                            <td>{m.type === "Egreso" ? <Badge color={getFV(m.type, m.category) === "F" ? "red" : "amber"}>{getFV(m.type, m.category)}</Badge> : "—"}</td>
                            <td className="muted">{m.description || "—"}</td>
                            <td>{m.currency}</td>
                            <td className="number">{money(m.originalAmount, m.currency)}</td>
                            <td className="number fw">{fmtArs(m.amountArs)}</td>
                            <td className="number muted">{money(m.amountUsd || 0, "USD")}</td>
                            <td style={{ display: "flex", gap: 4, alignItems: "center" }}>
                              {!isClosed && (
                                isEditing
                                  ? <button className="del-btn" onClick={() => setEditingMovId(null)}>✕</button>
                                  : <button className="del-btn" style={{ borderColor: "var(--primary)", color: "var(--primary)" }} onClick={() => startEditMovement(m)}>✏</button>
                              )}
                              {!isClosed && <button className="del-btn" onClick={() => deleteMovement(m.id)}>🗑</button>}
                              {isClosed && <span className="muted small">🔒</span>}
                            </td>
                          </tr>
                          {isEditing && (
                            <tr>
                              <td colSpan={12}>
                                <MovementEditPanel
                                  data={editMovData} onChange={setEditMovData} types={types} categoryMap={categoryMap}
                                  subcategoryMap={subcategoryMap} categoryIdFor={categoryIdFor} people={people} cards={cards}
                                  onSave={() => saveEditMovement(m.id)} onCancel={() => setEditingMovId(null)}
                                />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
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
                          {subcategoryNameById[m.subcategoryId] && <span className="muted small" style={{ marginLeft: 6 }}>· {subcategoryNameById[m.subcategoryId]}</span>}
                          {m.type === "Egreso" && <Badge color={getFV(m.type, m.category) === "F" ? "red" : "amber"} style={{ marginLeft: 6 }}>{getFV(m.type, m.category)}</Badge>}
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          {!isClosed && (isEditing
                            ? <button className="del-btn" onClick={() => setEditingMovId(null)}>✕</button>
                            : <button className="del-btn" style={{ borderColor: "var(--primary)", color: "var(--primary)" }} onClick={() => startEditMovement(m)}>✏</button>
                          )}
                          {!isClosed && <button className="del-btn" onClick={() => deleteMovement(m.id)}>🗑</button>}
                          {isClosed && <span className="muted small">🔒</span>}
                        </div>
                      </div>
                      <div className="mov-card-amounts">
                        <div><span className="muted small">Fecha</span><div>{m.date}</div></div>
                        <div><span className="muted small">Persona</span><div>{m.person}{m.sharedGroupId && <span className="muted small"> 🤝</span>}</div></div>
                        <div><span className="muted small">{m.currency === "USD" ? "USD" : "ARS"}</span><div className="fw">{money(m.originalAmount, m.currency)}</div></div>
                        <div><span className="muted small">ARS</span><div className="fw">{fmtArs(m.amountArs)}</div></div>
                      </div>
                      {m.description && <div className="muted small">{m.description}</div>}
                      {isEditing && (
                        <MovementEditPanel
                          data={editMovData} onChange={setEditMovData} types={types} categoryMap={categoryMap}
                          subcategoryMap={subcategoryMap} categoryIdFor={categoryIdFor} people={people} cards={cards}
                          onSave={() => saveEditMovement(m.id)} onCancel={() => setEditingMovId(null)}
                        />
                      )}
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
                // Cierre calculado del mes anterior (encadenado), sugerido como saldo inicial
                const prevMonth = prevMonthKeyOf(balanceForm.month);
                const prevBalance = computeMonthBalance(prevMonth);
                const suggestedOpening = prevBalance.closing;
                const hasSuggestion = prevBalance.inc > 0 || prevBalance.exp > 0 || prevBalance.opening > 0;
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
                          style={{ marginLeft: 8, background: "none", border: "none", color: "var(--primary)", fontWeight: 700, cursor: "pointer", textDecoration: "underline", fontSize: "inherit" }}
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
              {budgetAvgSuggestion !== null && (
                <InfoBox color="blue">
                  Promedio real de {budgetAvgSuggestion.months === 1 ? "el último mes" : `los últimos ${budgetAvgSuggestion.months} meses`} para <strong>{budgetForm.category}</strong> · {budgetForm.person}: <strong>{fmtArs(budgetAvgSuggestion.value)}</strong> ·{" "}
                  <button
                    onClick={() => setBudgetForm((f) => ({ ...f, planned: String(budgetAvgSuggestion.value) }))}
                    style={{ background: "none", border: "none", color: "var(--primary)", fontWeight: 700, cursor: "pointer", textDecoration: "underline", fontSize: "inherit" }}
                  >Usar este valor</button>
                </InfoBox>
              )}
              <div style={{ marginTop: 12 }}><Btn onClick={addBudget}>＋ Agregar línea</Btn></div>
            </Card>

            {expectedLoanCollectionsByMonth.length > 0 && (
              <Card>
                <CardHead title="Cobros de préstamos esperados este mes" icon="🏦" />
                <p className="muted small" style={{ marginBottom: 10 }}>En base al saldo real pendiente de cada préstamo — no es parte del presupuesto por categoría, es un ingreso adicional a tener en cuenta para {budgetForm.month}.</p>
                {expectedLoanCollectionsByMonth.map(({ loan, amount }) => (
                  <div key={loan.id} className="balance-row"><span>{loan.name}</span><strong className="green">{fmtArs(amount)}</strong></div>
                ))}
                <div className="balance-row total"><span>Total esperado</span><strong>{fmtArs(expectedLoanCollectionsByMonth.reduce((a, x) => a + x.amount, 0))}</strong></div>
              </Card>
            )}

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
                        ? (over ? "#f87171" : warn ? "#fbbf24" : "#34d399")
                        : (over ? "#34d399" : "#38bdf8");
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
                const barColor = pct >= 100 ? "#34d399" : pct >= 60 ? "#38bdf8" : "#fbbf24";
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
                        const barColor = isExp ? (over ? "#f87171" : warn ? "#fbbf24" : "#34d399") : (over ? "#34d399" : "#38bdf8");
                        const badgeColor = isExp ? (over ? "red" : warn ? "amber" : "green") : (over ? "green" : "blue");
                        const maxVal = Math.max(b.planned, b.actual, 1);
                        const plannedPct = (b.planned / maxVal) * 100;
                        const actualPct  = Math.min((b.actual / maxVal) * 100, 100);
                        const diff = isExp ? b.planned - b.actual : b.actual - b.planned;
                        const diffColor = diff >= 0 ? "#34d399" : "#f87171";
                        return (
                          <div key={b.category} className="budget-inline-row">
                            <div className="budget-inline-left">
                              <span className="budget-inline-cat">{b.category}</span>
                            </div>
                            <div className="budget-inline-bar-wrap">
                              <div style={{ position: "relative", height: 8, borderRadius: 999, background: "var(--border)" }}>
                                <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${plannedPct}%`, background: "var(--muted)", borderRadius: 999 }} />
                                <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${actualPct}%`, background: barColor, borderRadius: 999, opacity: 0.9 }} />
                                {b.actual > b.planned && (
                                  <div style={{ position: "absolute", left: `${plannedPct}%`, top: -2, height: 12, width: `${Math.min(((b.actual - b.planned) / maxVal) * 100, 100 - plannedPct)}%`, background: "#f87171", borderRadius: "0 999px 999px 0", opacity: 0.75 }} />
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
                <BarChart data={annualByMonth} xKey="month" bars={[{ key: "income", label: "Ingresos", color: "#34d399" }, { key: "expenses", label: "Egresos", color: "#f87171" }]} formatter={(v, short) => short ? (displayCurrency === "USD" ? `${v.toFixed(0)}` : `${Math.round(v/1000)}K`) : fmt(v)} />
              </Card>
              <Card>
                <CardHead title="Fijos vs variables" icon="🧩" />
                <BarChart data={annualByMonth} xKey="month" bars={[{ key: "fixed", label: "Fijos", color: "#f87171" }, { key: "variable", label: "Variables", color: "#fbbf24" }]} formatter={(v, short) => short ? (displayCurrency === "USD" ? `${v.toFixed(0)}` : `${Math.round(v/1000)}K`) : fmt(v)} />
              </Card>
            </div>

            {/* ── Evolución por categoría y subcategoría ── */}
            <Card>
              <CardHead title="Evolución mensual por categoría" icon="📊" />
              <p className="muted small" style={{ marginBottom: 14 }}>
                Tocá una categoría para ver el desglose por subcategoría. Verde = bajó, rojo = subió respecto al mes anterior. El filtro de persona aplica desde arriba. Los movimientos sin subcategoría asignada solo cuentan en el total de la categoría.
              </p>
              <Field label="Buscar categoría o subcategoría"><Input value={evolutionSearch} onChange={(e) => setEvolutionSearch(e.target.value)} placeholder="Ej. Nafta" /></Field>
              {evolutionData.cats.length === 0 && <EmptyState msg="Sin egresos registrados." />}
              {evolutionData.cats.length > 0 && (() => {
                const { months, result } = evolutionData;
                const q = evolutionSearch.trim().toLowerCase();
                const cats = q
                  ? evolutionData.cats.filter((cat) => cat.toLowerCase().includes(q) || result[cat].subRows.some((s) => s.desc.toLowerCase().includes(q)))
                  : evolutionData.cats;
                // Mostrar últimos 6 meses máximo para que entre en pantalla
                const visibleMonths = months.slice(-6);
                return (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "2px solid var(--border)", background: "var(--surface-2)", minWidth: 160 }}>Categoría</th>
                          {visibleMonths.map((mo) => (
                            <th key={mo} style={{ textAlign: "right", padding: "8px 10px", borderBottom: "2px solid var(--border)", background: "var(--surface-2)", whiteSpace: "nowrap" }}>
                              {mo.slice(5)} {/* solo mm */}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {cats.map((cat) => {
                          const { byMonth, subRows } = result[cat];
                          const isExpanded = expandedCats[cat];
                          const hasAny = visibleMonths.some((mo) => byMonth[mo] > 0);
                          if (!hasAny) return null;
                          return (
                            <React.Fragment key={cat}>
                              {/* Fila de categoría */}
                              <tr
                                onClick={() => setExpandedCats((p) => ({ ...p, [cat]: !p[cat] }))}
                                style={{ cursor: subRows.length > 0 ? "pointer" : "default", background: isExpanded ? "var(--surface-2)" : "transparent" }}
                              >
                                <td style={{ padding: "9px 10px", borderBottom: "1px solid var(--border)", fontWeight: 700 }}>
                                  {subRows.length > 0 && <span style={{ marginRight: 6, fontSize: "0.75rem", color: "var(--muted)" }}>{isExpanded ? "▼" : "▶"}</span>}
                                  {cat}
                                </td>
                                {visibleMonths.map((mo, mi) => {
                                  const val = byMonth[mo] || 0;
                                  const prev = mi > 0 ? (byMonth[visibleMonths[mi - 1]] || 0) : null;
                                  const trend = prev !== null && prev > 0 ? (val - prev) / prev : null;
                                  const trendColor = trend === null ? "var(--muted)" : trend > 0.05 ? "#f87171" : trend < -0.05 ? "#34d399" : "var(--muted)";
                                  return (
                                    <td key={mo} style={{ textAlign: "right", padding: "9px 10px", borderBottom: "1px solid var(--border)", fontWeight: 700, color: val > 0 ? "var(--text)" : "var(--border)" }}>
                                      {val > 0 ? (
                                        <span>
                                          {fmt(val)}
                                          {trend !== null && <span style={{ fontSize: "0.7rem", color: trendColor, marginLeft: 4 }}>{trend > 0 ? "▲" : trend < 0 ? "▼" : "─"}{Math.abs(trend * 100).toFixed(0)}%</span>}
                                        </span>
                                      ) : <span style={{ color: "var(--border)"}}>—</span>}
                                    </td>
                                  );
                                })}
                              </tr>
                              {/* Filas de subcategoría (descripción) */}
                              {isExpanded && subRows.map((sub) => (
                                <tr key={sub.desc} style={{ background: "var(--surface-2)" }}>
                                  <td style={{ padding: "7px 10px 7px 28px", borderBottom: "1px solid var(--border)", color: "var(--muted)", fontSize: "0.82rem" }}>
                                    └ {sub.desc}
                                  </td>
                                  {visibleMonths.map((mo, mi) => {
                                    const val = sub.byMonth[mo] || 0;
                                    const prev = mi > 0 ? (sub.byMonth[visibleMonths[mi - 1]] || 0) : null;
                                    const trend = prev !== null && prev > 0 ? (val - prev) / prev : null;
                                    const trendColor = trend === null ? "var(--muted)" : trend > 0.05 ? "#f87171" : trend < -0.05 ? "#34d399" : "var(--muted)";
                                    return (
                                      <td key={mo} style={{ textAlign: "right", padding: "7px 10px", borderBottom: "1px solid var(--border)", fontSize: "0.82rem", color: val > 0 ? "var(--muted)" : "var(--border)" }}>
                                        {val > 0 ? (
                                          <span>
                                            {fmt(val)}
                                            {trend !== null && <span style={{ fontSize: "0.68rem", color: trendColor, marginLeft: 4 }}>{trend > 0 ? "▲" : "▼"}{Math.abs(trend * 100).toFixed(0)}%</span>}
                                          </span>
                                        ) : <span style={{ color: "var(--border)"}}>—</span>}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </Card>
          </div>
        )}

        {tab === "deudas" && (
          <div className="tab-content">
            <div className="tabs-list" style={{ marginBottom: -4 }}>
              <button className={`tab-btn${debtsSubTab === "prestamos" ? " active" : ""}`} onClick={() => setDebtsSubTab("prestamos")}>🏦 Préstamos <span className="muted small">(lo que nos deben)</span></button>
              <button className={`tab-btn${debtsSubTab === "deudas" ? " active" : ""}`} onClick={() => setDebtsSubTab("deudas")}>💳 Deudas <span className="muted small">(histórico, lo que debemos)</span></button>
            </div>

            {debtsSubTab === "deudas" && (
              <>
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
              </>
            )}

            {debtsSubTab === "prestamos" && (
              <>
            <Card>
              <CardHead title="Otorgar préstamo" icon="🏦" />
              <p className="muted small" style={{ marginBottom: 12 }}>Plata que la familia le presta a un tercero (al revés de Deudas). Al otorgarlo se descuenta el capital como Inversión · Prestamos. Completá <strong>Plazo</strong> o <strong>Cuota objetivo</strong> — no hace falta los dos. Los cobros de cuota se registran desde la solapa <strong>Cargar</strong>.</p>
              <div className="form-grid three-col">
                <Field label="Nombre / a quién"><Input value={loanForm.name} onChange={(e) => setLoanForm({ ...loanForm, name: e.target.value })} placeholder="Ej. Ale" /></Field>
                <Field label="Capital"><Input type="number" value={loanForm.principal} onChange={(e) => setLoanForm({ ...loanForm, principal: e.target.value })} /></Field>
                <Field label="TNA (%)"><Input type="number" value={loanForm.annualRate} onChange={(e) => setLoanForm({ ...loanForm, annualRate: e.target.value })} placeholder="Ej. 50" /></Field>
                <Field label="Fecha de desembolso"><Input type="date" value={loanForm.startDate} onChange={(e) => setLoanForm({ ...loanForm, startDate: e.target.value })} /></Field>
                <Field label="Día de vencimiento"><Input type="number" min="1" max="28" value={loanForm.dayOfMonth} onChange={(e) => setLoanForm({ ...loanForm, dayOfMonth: e.target.value })} /></Field>
                <Field label="Meses de gracia"><Input type="number" min="0" value={loanForm.graceMonths} onChange={(e) => setLoanForm({ ...loanForm, graceMonths: e.target.value })} /></Field>
                <Field label="Plazo (meses)"><Input type="number" value={loanForm.termMonths} onChange={(e) => setLoanForm({ ...loanForm, termMonths: e.target.value, targetInstallment: "" })} placeholder="Opcional" /></Field>
                <Field label="Cuota objetivo"><Input type="number" value={loanForm.targetInstallment} onChange={(e) => setLoanForm({ ...loanForm, targetInstallment: e.target.value, termMonths: "" })} placeholder="Opcional" /></Field>
                <Field label="Notas"><Input value={loanForm.notes} onChange={(e) => setLoanForm({ ...loanForm, notes: e.target.value })} /></Field>
              </div>
              <InfoBox color="blue">
                Tasas de referencia (TNA) relevadas en {REFERENCE_LOAN_RATES_DATE} para elegir un valor intermedio — varían según banco y perfil, no son una cotización exacta:{" "}
                {REFERENCE_LOAN_RATES.map((r, i) => <span key={r.name}>{i > 0 ? " · " : ""}{r.name}: <strong>{r.tna}%</strong></span>)}
              </InfoBox>

              {loanPreview && (
                <InfoBox color="green">
                  <strong>📋 Simulación (pendiente de aceptar — todavía no se guardó nada):</strong>
                  <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: "6px 18px" }}>
                    <span>Cuota: <strong>{money(loanPreview.schedule.installment)}</strong></span>
                    <span>Plazo estimado: <strong>{loanPreview.schedule.estimatedTerm ?? "—"} meses</strong></span>
                    {!loanPreview.schedule.canCancel && <span style={{ color: "var(--red)" }}>⚠️ La cuota no alcanza a cubrir el interés: nunca se cancela.</span>}
                    {loanPreview.gain && (
                      <>
                        <span>Ganancia nominal proyectada: <strong>{money(loanPreview.gain.nominalGain)}</strong></span>
                        <span>Ganancia real proyectada (ajustada por IPC): <strong style={{ color: loanPreview.gain.realGain >= 0 ? "var(--green)" : "var(--red)" }}>{money(loanPreview.gain.realGain)}</strong></span>
                      </>
                    )}
                  </div>
                  <div className="muted small" style={{ marginTop: 6 }}>Si te sirve así, tocá <strong>Otorgar préstamo</strong> para recién ahí confirmarlo y descontar el capital. Podés seguir ajustando los datos mientras no lo confirmes.</div>
                </InfoBox>
              )}

              <div style={{ marginTop: 12 }}><Btn onClick={addLoan} disabled={saving || !loanForm.name || !loanForm.principal || (!loanForm.termMonths && !loanForm.targetInstallment)}>{saving ? "Guardando…" : "✓ Aceptar y otorgar préstamo"}</Btn></div>
            </Card>
            <div className="debt-cards">
              {personLoans.length === 0 && <EmptyState msg="No hay préstamos otorgados cargados." />}
              {personLoans.map((loan) => {
                const collected = loanCollectedById[loan.id] || 0;
                const pending = Math.max(0, Number(loan.principal || 0) - collected);
                const pct = loan.principal > 0 ? (collected / loan.principal) * 100 : 0;
                const schedule = computeLoanSchedule(loan); // plan original, desde el desembolso
                const remaining = computeLoanSchedule(loan, { principal: pending, startDate: today(), graceMonths: 0, installment: schedule.installment }); // real, desde hoy, misma cuota
                const realCollected = loanPayments.filter((p) => p.loanId === loan.id).reduce((sum, p) => sum + Number(p.amount || 0) / ipcFactorBetween(ipcData, loan.startDate, p.date), 0);
                const projectedGain = computeProjectedRealGain(loan, remaining, collected, realCollected, ipcData);
                const isExpanded = expandedLoans[loan.id];
                const incForm = loanIncreaseForm[loan.id] || { amount: "", newInstallment: "" };
                const previewIncrease = incForm.amount ? computeLoanSchedule(loan, {
                  principal: pending + Number(incForm.amount), startDate: today(), graceMonths: 0,
                  installment: incForm.newInstallment ? Number(incForm.newInstallment) : schedule.installment,
                }) : null;
                return (
                  <Card key={loan.id}>
                    <div className="debt-card-head"><div><div className="fw">{loan.name}</div><div className="muted small">TNA {(loan.annualRate * 100).toFixed(0)}% · desde {loan.startDate}</div></div><button className="del-btn" onClick={() => deleteLoan(loan.id)}>🗑</button></div>
                    <div className="debt-amounts">
                      <div><span className="muted small">Capital</span><div className="fw">{fmtArs(loan.principal)}</div></div>
                      <div><span className="muted small">Cuota</span><div>{fmtArs(schedule.installment)}</div></div>
                      <div><span className="muted small">Cobrado</span><div className="green">{fmtArs(collected)}</div></div>
                      <div><span className="muted small">Pendiente</span><div className="fw red">{fmtArs(pending)}</div></div>
                    </div>
                    <Progress value={pct} />
                    <div className="muted small" style={{ marginTop: 4 }}>
                      Cancelado: {pct.toFixed(1)}% · {pending <= 0 ? "Préstamo cancelado" : remaining.canCancel ? `Cuotas restantes desde hoy: ${remaining.estimatedTerm}` : "⚠️ La cuota actual no alcanza a cubrir el interés — nunca se cancela"}
                    </div>
                    {projectedGain && (
                      <div className="muted small" style={{ marginTop: 2 }}>
                        Si se cobra tal como está pactado hasta el final — ganancia nominal: <strong>{fmtArs(projectedGain.nominalGain)}</strong> · ganancia real ajustada por IPC (asumiendo ~{(projectedGain.avgMonthly * 100).toFixed(1)}%/mes de inflación futura, promedio de los últimos 6 meses): <strong className={projectedGain.realGain >= 0 ? "green" : "red"}>{fmtArs(projectedGain.realGain)}</strong>
                      </div>
                    )}
                    {!projectedGain && ipcData.length === 0 && (
                      <div className="muted small" style={{ marginTop: 2 }}>No se pudo cargar el IPC (INDEC) para calcular la ganancia real.</div>
                    )}
                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button className="del-btn" style={{ borderColor: "var(--primary)", color: "var(--primary)" }} onClick={() => setExpandedLoans((p) => ({ ...p, [loan.id]: !p[loan.id] }))}>
                        {isExpanded ? "▲ ocultar cronograma" : "▼ ver cronograma planificado"}
                      </button>
                      <button className="del-btn" style={{ borderColor: "var(--amber)", color: "var(--amber)" }} onClick={() => setLoanIncreaseForm((p) => ({ ...p, [loan.id]: p[loan.id] ? undefined : { amount: "", newInstallment: "" } }))}>
                        {loanIncreaseForm[loan.id] ? "▲ cancelar ampliación" : "▼ ampliar préstamo"}
                      </button>
                    </div>
                    {loanIncreaseForm[loan.id] && (
                      <div style={{ marginTop: 10, padding: 10, background: "var(--surface-2)", borderRadius: 10 }}>
                        <p className="muted small" style={{ marginBottom: 8 }}>Piden más plata sobre este préstamo. Poné cuánto más y, si querés, la cuota nueva — te muestro en cuánto quedan las cuotas antes de confirmar.</p>
                        <div className="form-grid three-col">
                          <Field label="Importe adicional"><Input type="number" value={incForm.amount} onChange={(e) => setLoanIncreaseForm((p) => ({ ...p, [loan.id]: { ...incForm, amount: e.target.value } }))} /></Field>
                          <Field label="Cuota nueva (opcional)"><Input type="number" value={incForm.newInstallment} onChange={(e) => setLoanIncreaseForm((p) => ({ ...p, [loan.id]: { ...incForm, newInstallment: e.target.value } }))} placeholder={fmtArs(schedule.installment)} /></Field>
                        </div>
                        {previewIncrease && (
                          <InfoBox color="amber">
                            Nuevo saldo pendiente: <strong>{fmtArs(pending + Number(incForm.amount))}</strong> · Cuota: <strong>{fmtArs(previewIncrease.installment)}</strong> ·{" "}
                            {previewIncrease.canCancel ? <>quedarían <strong>{previewIncrease.estimatedTerm}</strong> cuotas.</> : "esa cuota no alcanza a cubrir el interés."}
                          </InfoBox>
                        )}
                        <div style={{ marginTop: 10 }}>
                          <Btn small onClick={() => increaseLoan(loan)} disabled={saving || !incForm.amount}>{saving ? "Guardando…" : "✓ Confirmar ampliación"}</Btn>
                        </div>
                      </div>
                    )}
                    {isExpanded && (
                      <div style={{ overflowX: "auto", marginTop: 8 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: "left", padding: "4px 8px" }}>Cuota</th>
                              <th style={{ textAlign: "right", padding: "4px 8px" }}>Fecha</th>
                              <th style={{ textAlign: "right", padding: "4px 8px" }}>Interés</th>
                              <th style={{ textAlign: "right", padding: "4px 8px" }}>Cuota planificada</th>
                              <th style={{ textAlign: "right", padding: "4px 8px" }}>Saldo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {schedule.rows.slice(0, 36).map((r) => (
                              <tr key={r.period} style={{ borderBottom: "1px solid var(--border)" }}>
                                <td style={{ padding: "4px 8px" }}>{r.period}</td>
                                <td style={{ textAlign: "right", padding: "4px 8px" }}>{r.date}</td>
                                <td style={{ textAlign: "right", padding: "4px 8px" }} className="muted">{fmtArs(r.interest)}</td>
                                <td style={{ textAlign: "right", padding: "4px 8px" }}>{fmtArs(r.payment)}</td>
                                <td style={{ textAlign: "right", padding: "4px 8px" }} className="fw">{fmtArs(r.closingBalance)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {schedule.rows.length > 36 && <div className="muted small" style={{ marginTop: 6 }}>Mostrando las primeras 36 cuotas de {schedule.rows.length}.</div>}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
              </>
            )}
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
                    <Btn small onClick={addPerson}>+ Agregar</Btn>
                  </div>
                  <div className="tag-list">{people.map((p) => <span key={p} className="tag">{p}<button onClick={() => removePerson(p)}>×</button></span>)}</div>
                </div>
                <div className="catalog-section">
                  <label className="field-label">Tipos</label>
                  <div className="catalog-add">
                    <Input value={catalogForm.type} onChange={(e) => setCatalogForm({ ...catalogForm, type: e.target.value })} placeholder="Nuevo tipo" />
                    <Btn small onClick={addType}>+ Agregar</Btn>
                  </div>
                  <div className="tag-list">{types.map((t) => <span key={t} className="tag">{t}<button onClick={() => removeType(t)}>×</button></span>)}</div>
                </div>
              </Card>
              <Card>
                <CardHead title="Tarjetas" icon="💳" />
                <div className="form-grid three-col">
                  <Field label="Nombre"><Input value={cardForm.name} onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })} placeholder="Ej. Visa Banco X" /></Field>
                  <Field label="Responsable"><Select value={cardForm.owner} onChange={(v) => setCardForm({ ...cardForm, owner: v })}>{people.map((p) => <option key={p} value={p}>{p}</option>)}</Select></Field>
                </div>
                <div style={{ marginTop: 12 }}><Btn onClick={addCard}>＋ Agregar tarjeta</Btn></div>
                <div className="tag-list" style={{ marginTop: 12 }}>
                  {cards.map((c) => <span key={c.id} className="tag">{c.name} · {c.owner}<button onClick={() => removeCard(c)}>×</button></span>)}
                  {cards.length === 0 && <span className="muted small">Sin tarjetas cargadas.</span>}
                </div>
              </Card>
              <Card>
                <CardHead title="Subcategorías" icon="🏷️" />
                <p className="muted small" style={{ marginBottom: 12 }}>Estandarizan el detalle de un gasto (ej. Supermercado → Verdulería) para poder compararlas correctamente en Reportes.</p>
                <div className="form-grid three-col">
                  <Field label="Tipo"><Select value={subcatForm.categoryType} onChange={(v) => setSubcatForm({ ...subcatForm, categoryType: v, categoryId: "" })}>{types.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
                  <Field label="Categoría">
                    <Select value={subcatForm.categoryId} onChange={(v) => setSubcatForm({ ...subcatForm, categoryId: v })}>
                      <option value="">Seleccionar…</option>
                      {categoryRows.filter((r) => r.type === subcatForm.categoryType).map((r) => <option key={r.id} value={String(r.id)}>{r.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="Subcategoría"><Input value={subcatForm.name} onChange={(e) => setSubcatForm({ ...subcatForm, name: e.target.value })} placeholder="Nueva subcategoría" /></Field>
                </div>
                <div style={{ marginTop: 12 }}><Btn onClick={addSubcategory} disabled={!subcatForm.categoryId || !subcatForm.name.trim()}>＋ Agregar subcategoría</Btn></div>
                <div style={{ marginTop: 16 }}>
                  {categoryRows.filter((r) => (subcategoryMap[r.id] || []).length > 0).map((r) => (
                    <div key={r.id} className="catalog-section">
                      <label className="field-label">{r.type} · {r.name}</label>
                      <div className="tag-list">
                        {(subcategoryMap[r.id] || []).map((s) => (
                          <span key={s.id} className="tag">{s.name}<button onClick={() => removeSubcategory(s)}>×</button></span>
                        ))}
                      </div>
                    </div>
                  ))}
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
