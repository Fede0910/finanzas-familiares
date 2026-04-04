
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

const PEOPLE = ["Federico", "Mica", "Santy", "Compartido"];
const PAYMENT_METHODS = ["Banco", "Tarjeta", "Efectivo", "Mercado Pago", "Transferencia"];
const TYPES = ["Ingreso", "Egreso", "Ahorro", "Inversión"];
const CATEGORY_MAP = {
  Ingreso: ["Sueldo", "Freelance", "Venta", "Otros ingresos"],
  Egreso: ["Supermercado", "Salud", "Salud mental", "Educación", "Transporte", "Servicios", "Alquiler", "Salidas", "Deuda"],
  Ahorro: ["Fondo de emergencia", "Ahorro USD", "Caja ahorro"],
  Inversión: ["FCI", "Acciones", "Cedears", "Cripto"],
};

const SAMPLE_BUDGETS = [
  { id: 1, month: "2026-04", person: "Compartido", category: "Supermercado", plannedArs: 320000, actualArs: 278000 },
  { id: 2, month: "2026-04", person: "Federico", category: "Salud mental", plannedArs: 60000, actualArs: 45000 },
  { id: 3, month: "2026-04", person: "Compartido", category: "Servicios", plannedArs: 180000, actualArs: 191000 },
  { id: 4, month: "2026-04", person: "Compartido", category: "Deuda", plannedArs: 210000, actualArs: 150000 },
];

const SAMPLE_DEBTS = [
  { id: 1, name: "Tarjeta Visa", owner: "Federico", balanceArs: 420000, installmentArs: 70000, dueDay: 10, priority: "Alta", paidPct: 28, status: "Activa" },
  { id: 2, name: "Préstamo familiar", owner: "Compartido", balanceArs: 900000, installmentArs: 150000, dueDay: 5, priority: "Media", paidPct: 12, status: "Activa" },
  { id: 3, name: "Notebook", owner: "Mica", balanceArs: 310000, installmentArs: 52000, dueDay: 18, priority: "Media", paidPct: 46, status: "Activa" },
];

const SAMPLE_GOALS = [
  { id: 1, name: "Fondo de emergencia", targetArs: 3000000, currentArs: 860000 },
  { id: 2, name: "Vacaciones", targetArs: 1800000, currentArs: 420000 },
  { id: 3, name: "Inversión familiar", targetArs: 2500000, currentArs: 510000 },
];

function money(n, currency = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(Number(n || 0));
}

function monthKey(dateString) {
  const d = new Date(`${dateString}T00:00:00`);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function convertToArs(amount, currency, rate) {
  if (currency === "USD") return Number(amount || 0) * Number(rate || 0);
  return Number(amount || 0);
}

function convertFromArs(amountArs, currency, rate) {
  if (currency === "USD") return rate > 0 ? Number(amountArs || 0) / Number(rate) : 0;
  return Number(amountArs || 0);
}

function formatDisplay(amountArs, displayCurrency, blueRate) {
  const shown = convertFromArs(amountArs, displayCurrency, blueRate);
  return money(shown, displayCurrency);
}

function emptyMovement(today) {
  return {
    date: today,
    person: "Compartido",
    type: "",
    category: "",
    description: "",
    originalAmount: "",
    currency: "ARS",
    paymentMethod: PAYMENT_METHODS[0],
  };
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Stat({ title, value, note }) {
  return (
    <div className="stat-card">
      <span>{title}</span>
      <strong>{value}</strong>
      {note ? <small>{note}</small> : null}
    </div>
  );
}

export default function App() {
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = new Date().toISOString().slice(0, 7);

  const [activeTab, setActiveTab] = useState("cargar");
  const [displayCurrency, setDisplayCurrency] = useState("ARS");
  const [blueRate, setBlueRate] = useState(1250);
  const [blueLabel, setBlueLabel] = useState("Cotización cargada");
  const [movements, setMovements] = useState([]);
  const [loadingMovements, setLoadingMovements] = useState(true);
  const [savingMovement, setSavingMovement] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [movementForm, setMovementForm] = useState(emptyMovement(today));
  const [filters, setFilters] = useState({
    month: currentMonth,
    person: "all",
    type: "all",
    category: "all",
    currency: "all",
  });

  useEffect(() => {
    async function fetchBlue() {
      try {
        const res = await fetch("https://dolarapi.com/v1/dolares/blue");
        if (!res.ok) return;
        const data = await res.json();
        const rate = Number(data?.venta || 0);
        if (rate > 0) {
          setBlueRate(rate);
          setBlueLabel("Cotización cargada");
        }
      } catch {
        setBlueLabel("Valor manual");
      }
    }
    fetchBlue();
  }, []);

  useEffect(() => {
    loadMovements();
  }, []);

  async function loadMovements() {
    setLoadingMovements(true);
    const { data, error } = await supabase
      .from("movements")
      .select("*")
      .order("movement_date", { ascending: false })
      .order("id", { ascending: false });

    if (!error && data) {
      setMovements(
        data.map((row) => ({
          id: row.id,
          date: row.movement_date,
          person: row.person,
          type: row.type,
          category: row.category,
          description: row.description || "",
          originalAmount: Number(row.original_amount || 0),
          currency: row.original_currency || "ARS",
          fxRate: Number(row.fx_rate || 1),
          amountArs: Number(row.amount_ars || 0),
          amountUsd: Number(row.amount_usd || 0),
          paymentMethod: row.payment_method || "",
        }))
      );
    }
    setLoadingMovements(false);
  }

  const categoriesForType = movementForm.type ? CATEGORY_MAP[movementForm.type] || [] : [];

  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      if (filters.month && monthKey(m.date) !== filters.month) return false;
      if (filters.person !== "all" && m.person !== filters.person) return false;
      if (filters.type !== "all" && m.type !== filters.type) return false;
      if (filters.category !== "all" && m.category !== filters.category) return false;
      if (filters.currency !== "all" && m.currency !== filters.currency) return false;
      return true;
    });
  }, [movements, filters]);

  const summary = useMemo(() => {
    const income = filteredMovements.filter((m) => m.type === "Ingreso").reduce((a, b) => a + b.amountArs, 0);
    const expenses = filteredMovements.filter((m) => m.type === "Egreso").reduce((a, b) => a + b.amountArs, 0);
    const savings = filteredMovements.filter((m) => m.type === "Ahorro").reduce((a, b) => a + b.amountArs, 0);
    const investments = filteredMovements.filter((m) => m.type === "Inversión").reduce((a, b) => a + b.amountArs, 0);
    return {
      income,
      expenses,
      savings,
      investments,
      net: income - expenses - savings - investments,
    };
  }, [filteredMovements]);

  const expenseByCategory = useMemo(() => {
    const buckets = {};
    filteredMovements
      .filter((m) => m.type === "Egreso")
      .forEach((m) => {
        buckets[m.category] = (buckets[m.category] || 0) + m.amountArs;
      });
    const total = Object.values(buckets).reduce((a, b) => a + b, 0);
    return Object.entries(buckets)
      .map(([category, amountArs]) => ({
        category,
        amountArs,
        pct: total > 0 ? (amountArs / total) * 100 : 0,
      }))
      .sort((a, b) => b.amountArs - a.amountArs);
  }, [filteredMovements]);

  const spendingByPerson = useMemo(() => {
    const buckets = {};
    filteredMovements
      .filter((m) => m.type === "Egreso")
      .forEach((m) => {
        buckets[m.person] = (buckets[m.person] || 0) + m.amountArs;
      });
    const total = Object.values(buckets).reduce((a, b) => a + b, 0);
    return Object.entries(buckets)
      .map(([person, amountArs]) => ({
        person,
        amountArs,
        pct: total > 0 ? (amountArs / total) * 100 : 0,
      }))
      .sort((a, b) => b.amountArs - a.amountArs);
  }, [filteredMovements]);

  const budgets = useMemo(() => {
    return SAMPLE_BUDGETS.filter((b) => b.month === filters.month).map((b) => {
      const execution = b.plannedArs > 0 ? (b.actualArs / b.plannedArs) * 100 : 0;
      return { ...b, execution, diffArs: b.plannedArs - b.actualArs };
    });
  }, [filters.month]);

  async function handleSaveMovement() {
    if (!movementForm.type || !movementForm.category || !movementForm.originalAmount) return;

    setSavingMovement(true);
    setSaveMessage("");

    const resolvedRate = movementForm.currency === "USD" ? Number(blueRate || 1) : 1;
    const amountArs = convertToArs(movementForm.originalAmount, movementForm.currency, resolvedRate);
    const amountUsd =
      movementForm.currency === "USD"
        ? Number(movementForm.originalAmount || 0)
        : resolvedRate > 0
          ? amountArs / resolvedRate
          : 0;

    const payload = {
      movement_date: movementForm.date,
      person: movementForm.person,
      type: movementForm.type,
      category: movementForm.category,
      description: movementForm.description || null,
      original_currency: movementForm.currency,
      original_amount: Number(movementForm.originalAmount || 0),
      fx_rate: resolvedRate,
      amount_ars: amountArs,
      amount_usd: amountUsd,
      payment_method: movementForm.paymentMethod || null,
      linked_debt_id: null,
      linked_budget_id: null,
    };

    const { data, error } = await supabase.from("movements").insert(payload).select().single();

    if (error) {
      setSaveMessage("No se pudo guardar en Supabase.");
      setSavingMovement(false);
      return;
    }

    setMovements((prev) => [
      {
        id: data.id,
        date: data.movement_date,
        person: data.person,
        type: data.type,
        category: data.category,
        description: data.description || "",
        originalAmount: Number(data.original_amount || 0),
        currency: data.original_currency || "ARS",
        fxRate: Number(data.fx_rate || 1),
        amountArs: Number(data.amount_ars || 0),
        amountUsd: Number(data.amount_usd || 0),
        paymentMethod: data.payment_method || "",
      },
      ...prev,
    ]);

    setMovementForm(emptyMovement(today));
    setSaveMessage("Guardado en Supabase.");
    setSavingMovement(false);
    setActiveTab("datos");
  }

  async function handleDeleteMovement(id) {
    const ok = window.confirm("¿Querés borrar este movimiento?");
    if (!ok) return;

    const backup = movements;
    setMovements((prev) => prev.filter((m) => m.id !== id));
    const { error } = await supabase.from("movements").delete().eq("id", id);
    if (error) {
      setMovements(backup);
      window.alert("No se pudo borrar el movimiento.");
    }
  }

  return (
    <div className="app-shell">
      <div className="app-container">
        <header className="hero">
          <div>
            <h1>Finanzas Familiares</h1>
            <p>Vista integral de la app: movimientos reales en Supabase y estructura completa para evaluar diseño, reportes, presupuesto, deudas y metas.</p>
          </div>
          <div className="hero-right">
            <select className="control control-compact" value={displayCurrency} onChange={(e) => setDisplayCurrency(e.target.value)}>
              <option value="ARS">Ver en ARS</option>
              <option value="USD">Ver en USD</option>
            </select>
          </div>
        </header>

        <nav className="tabs">
          {[
            ["cargar", "Cargar"],
            ["dashboard", "Dashboard"],
            ["datos", "Datos"],
            ["presupuesto", "Presupuesto"],
            ["deudas", "Deudas"],
            ["metas", "Metas"],
            ["config", "Config."],
          ].map(([value, label]) => (
            <button key={value} className={`tab ${activeTab === value ? "active" : ""}`} onClick={() => setActiveTab(value)}>
              {label}
            </button>
          ))}
        </nav>

        <section className="hero-strip">
          <Stat title="USD blue" value={money(blueRate, "ARS")} note={blueLabel} />
          <Stat title="Ingresos" value={formatDisplay(summary.income, displayCurrency, blueRate)} note="Mes filtrado" />
          <Stat title="Gastos" value={formatDisplay(summary.expenses, displayCurrency, blueRate)} note="Mes filtrado" />
          <Stat title="Ahorro" value={formatDisplay(summary.savings, displayCurrency, blueRate)} note="Mes filtrado" />
          <Stat title="Neto" value={formatDisplay(summary.net, displayCurrency, blueRate)} note="Mes filtrado" />
        </section>

        {activeTab === "cargar" && (
          <section className="panel">
            <div className="panel-header">
              <h2>Carga rápida</h2>
              <span className="panel-note">Uso diario</span>
            </div>

            <div className="grid-form">
              <Field label="Fecha">
                <input className="control" type="date" value={movementForm.date} onChange={(e) => setMovementForm({ ...movementForm, date: e.target.value })} />
              </Field>
              <Field label="Persona">
                <select className="control" value={movementForm.person} onChange={(e) => setMovementForm({ ...movementForm, person: e.target.value })}>
                  {PEOPLE.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Tipo">
                <select className="control" value={movementForm.type} onChange={(e) => setMovementForm({ ...movementForm, type: e.target.value, category: "" })}>
                  <option value="">Seleccionar</option>
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Categoría">
                <select className="control" value={movementForm.category} onChange={(e) => setMovementForm({ ...movementForm, category: e.target.value })} disabled={!movementForm.type}>
                  <option value="">Seleccionar</option>
                  {(movementForm.type ? CATEGORY_MAP[movementForm.type] || [] : []).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Moneda">
                <select className="control" value={movementForm.currency} onChange={(e) => setMovementForm({ ...movementForm, currency: e.target.value })}>
                  <option value="ARS">Pesos</option>
                  <option value="USD">Dólar blue</option>
                </select>
              </Field>
              <Field label="Importe original">
                <input className="control" type="number" value={movementForm.originalAmount} onChange={(e) => setMovementForm({ ...movementForm, originalAmount: e.target.value })} placeholder="0" />
              </Field>
              <Field label="Medio de pago">
                <select className="control" value={movementForm.paymentMethod} onChange={(e) => setMovementForm({ ...movementForm, paymentMethod: e.target.value })}>
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Descripción">
                <input className="control" value={movementForm.description} onChange={(e) => setMovementForm({ ...movementForm, description: e.target.value })} placeholder="Detalle opcional" />
              </Field>
            </div>

            <div className="info-box">
              Esta carga sigue usando Supabase. El dólar histórico por fecha todavía no está resuelto; lo que ves es solo para poder evaluar el diseño integral completo.
            </div>

            <button className="primary-btn" onClick={handleSaveMovement} disabled={savingMovement}>
              {savingMovement ? "Guardando..." : "Agregar movimiento"}
            </button>

            {saveMessage && <div className="save-message">{saveMessage}</div>}
          </section>
        )}

        {activeTab === "dashboard" && (
          <div className="stack">
            <section className="panel">
              <div className="panel-header">
                <h2>Gasto por categoría</h2>
                <span className="panel-note">Importe + %</span>
              </div>
              {expenseByCategory.length === 0 ? (
                <div className="empty-state">Todavía no hay egresos para el mes filtrado.</div>
              ) : (
                <div className="bars-list">
                  {expenseByCategory.map((row) => (
                    <div key={row.category} className="bar-item">
                      <div className="bar-head">
                        <strong>{row.category}</strong>
                        <span>{formatDisplay(row.amountArs, displayCurrency, blueRate)} · {row.pct.toFixed(1)}%</span>
                      </div>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${Math.max(6, row.pct)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2>Gasto por persona</h2>
                <span className="panel-note">Comparativa rápida</span>
              </div>
              {spendingByPerson.length === 0 ? (
                <div className="empty-state">Todavía no hay egresos para el mes filtrado.</div>
              ) : (
                <div className="bars-list">
                  {spendingByPerson.map((row) => (
                    <div key={row.person} className="bar-item">
                      <div className="bar-head">
                        <strong>{row.person}</strong>
                        <span>{formatDisplay(row.amountArs, displayCurrency, blueRate)} · {row.pct.toFixed(1)}%</span>
                      </div>
                      <div className="bar-track">
                        <div className="bar-fill alt" style={{ width: `${Math.max(6, row.pct)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === "datos" && (
          <div className="stack">
            <section className="panel">
              <div className="panel-header">
                <h2>Filtros</h2>
                <span className="panel-note">Tabla completa</span>
              </div>

              <div className="grid-filters">
                <Field label="Mes">
                  <input className="control" type="month" value={filters.month} onChange={(e) => setFilters({ ...filters, month: e.target.value })} />
                </Field>
                <Field label="Persona">
                  <select className="control" value={filters.person} onChange={(e) => setFilters({ ...filters, person: e.target.value })}>
                    <option value="all">Todas</option>
                    {PEOPLE.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label="Tipo">
                  <select className="control" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
                    <option value="all">Todos</option>
                    {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Categoría">
                  <select className="control" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
                    <option value="all">Todas</option>
                    {Object.values(CATEGORY_MAP).flat().map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Moneda">
                  <select className="control" value={filters.currency} onChange={(e) => setFilters({ ...filters, currency: e.target.value })}>
                    <option value="all">Todas</option>
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </select>
                </Field>
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2>Datos ingresados</h2>
                <span className="panel-note">{filteredMovements.length} filas</span>
              </div>

              {loadingMovements ? (
                <div className="empty-state">Cargando desde Supabase...</div>
              ) : filteredMovements.length === 0 ? (
                <div className="empty-state">No hay movimientos para esos filtros.</div>
              ) : (
                <>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Persona</th>
                          <th>Tipo</th>
                          <th>Categoría</th>
                          <th>Descripción</th>
                          <th>Moneda</th>
                          <th>Original</th>
                          <th>TC</th>
                          <th>ARS</th>
                          <th>USD</th>
                          <th>Medio</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMovements.map((m) => (
                          <tr key={m.id}>
                            <td>{m.date}</td>
                            <td>{m.person}</td>
                            <td>{m.type}</td>
                            <td>{m.category}</td>
                            <td>{m.description || "-"}</td>
                            <td>{m.currency}</td>
                            <td>{money(m.originalAmount, m.currency)}</td>
                            <td>{Number(m.fxRate || 0).toFixed(2)}</td>
                            <td>{money(m.amountArs, "ARS")}</td>
                            <td>{money(m.amountUsd || convertFromArs(m.amountArs, "USD", m.fxRate), "USD")}</td>
                            <td>{m.paymentMethod || "-"}</td>
                            <td><button className="delete-btn" onClick={() => handleDeleteMovement(m.id)}>Borrar</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="cards-mobile">
                    {filteredMovements.map((m) => (
                      <article key={m.id} className="movement-card">
                        <div className="movement-card-head">
                          <strong>{m.category}</strong>
                          <span>{m.type}</span>
                        </div>
                        <div className="movement-card-sub">{m.date} · {m.person} · {m.paymentMethod || "-"}</div>
                        <div className="movement-card-desc">{m.description || "Sin detalle"}</div>
                        <div className="movement-metrics">
                          <div><span>Original</span><strong>{money(m.originalAmount, m.currency)}</strong></div>
                          <div><span>ARS</span><strong>{money(m.amountArs, "ARS")}</strong></div>
                          <div><span>USD</span><strong>{money(m.amountUsd || convertFromArs(m.amountArs, "USD", m.fxRate), "USD")}</strong></div>
                          <div><span>TC</span><strong>{Number(m.fxRate || 0).toFixed(2)}</strong></div>
                        </div>
                        <button className="delete-btn mobile-delete" onClick={() => handleDeleteMovement(m.id)}>Borrar movimiento</button>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        {activeTab === "presupuesto" && (
          <section className="panel">
            <div className="panel-header">
              <h2>Presupuesto</h2>
              <span className="panel-note">Preview funcional</span>
            </div>

            <div className="budget-grid">
              {budgets.map((b) => (
                <div key={b.id} className="budget-card">
                  <div className="budget-top">
                    <strong>{b.category}</strong>
                    <span>{b.person}</span>
                  </div>
                  <div className="budget-values">
                    <div><span>Presupuesto</span><strong>{formatDisplay(b.plannedArs, displayCurrency, blueRate)}</strong></div>
                    <div><span>Real</span><strong>{formatDisplay(b.actualArs, displayCurrency, blueRate)}</strong></div>
                    <div><span>Diferencia</span><strong className={b.diffArs < 0 ? "text-red" : "text-green"}>{formatDisplay(b.diffArs, displayCurrency, blueRate)}</strong></div>
                    <div><span>Ejecución</span><strong>{b.execution.toFixed(1)}%</strong></div>
                  </div>
                  <div className="bar-track">
                    <div className={`bar-fill ${b.execution > 100 ? "danger" : b.execution >= 85 ? "warning" : ""}`} style={{ width: `${Math.min(100, b.execution)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "deudas" && (
          <section className="panel">
            <div className="panel-header">
              <h2>Deudas</h2>
              <span className="panel-note">Preview visual</span>
            </div>
            <div className="debt-grid">
              {SAMPLE_DEBTS.map((d) => (
                <div key={d.id} className="debt-card">
                  <div className="budget-top">
                    <strong>{d.name}</strong>
                    <span>{d.owner}</span>
                  </div>
                  <div className="budget-values">
                    <div><span>Saldo</span><strong>{formatDisplay(d.balanceArs, displayCurrency, blueRate)}</strong></div>
                    <div><span>Cuota</span><strong>{formatDisplay(d.installmentArs, displayCurrency, blueRate)}</strong></div>
                    <div><span>Vence</span><strong>Día {d.dueDay}</strong></div>
                    <div><span>Prioridad</span><strong>{d.priority}</strong></div>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill alt" style={{ width: `${d.paidPct}%` }} />
                  </div>
                  <small className="muted-note">Avance cancelado: {d.paidPct}%</small>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "metas" && (
          <section className="panel">
            <div className="panel-header">
              <h2>Metas</h2>
              <span className="panel-note">Preview visual</span>
            </div>
            <div className="goal-grid">
              {SAMPLE_GOALS.map((g) => {
                const pct = g.targetArs > 0 ? (g.currentArs / g.targetArs) * 100 : 0;
                return (
                  <div key={g.id} className="goal-card">
                    <div className="budget-top">
                      <strong>{g.name}</strong>
                      <span>{pct.toFixed(1)}%</span>
                    </div>
                    <div className="budget-values two">
                      <div><span>Actual</span><strong>{formatDisplay(g.currentArs, displayCurrency, blueRate)}</strong></div>
                      <div><span>Objetivo</span><strong>{formatDisplay(g.targetArs, displayCurrency, blueRate)}</strong></div>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === "config" && (
          <section className="panel">
            <div className="panel-header">
              <h2>Config.</h2>
              <span className="panel-note">Base editable futura</span>
            </div>
            <div className="config-grid">
              <div className="config-card">
                <strong>Personas</strong>
                <ul>{PEOPLE.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
              <div className="config-card">
                <strong>Medios de pago</strong>
                <ul>{PAYMENT_METHODS.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
              <div className="config-card">
                <strong>Tipos</strong>
                <ul>{TYPES.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
              <div className="config-card">
                <strong>Categorías</strong>
                <ul>{Object.entries(CATEGORY_MAP).map(([k, arr]) => <li key={k}><b>{k}:</b> {arr.join(", ")}</li>)}</ul>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
