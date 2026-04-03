
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

function money(n, currency = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(Number(n || 0));
}

function monthKey(dateString) {
  const d = new Date(dateString + "T00:00:00");
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

function formatByDisplayCurrency(amountArs, displayCurrency, blueRate) {
  const shown = convertFromArs(amountArs, displayCurrency, blueRate);
  return money(shown, displayCurrency);
}

function emptyMovement(today, blueRate) {
  return {
    date: today,
    person: "Compartido",
    type: "",
    category: "",
    description: "",
    originalAmount: "",
    currency: "ARS",
    paymentMethod: PAYMENT_METHODS[0],
    fxRate: blueRate || 1,
  };
}

export default function App() {
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = new Date().toISOString().slice(0, 7);

  const [tab, setTab] = useState("cargar");
  const [displayCurrency, setDisplayCurrency] = useState("ARS");
  const [blueRate, setBlueRate] = useState(1250);
  const [blueUpdatedAt, setBlueUpdatedAt] = useState("");
  const [fxStatus, setFxStatus] = useState("idle");

  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const [movementForm, setMovementForm] = useState(emptyMovement(today, 1250));
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
        setFxStatus("loading");
        const res = await fetch("https://dolarapi.com/v1/dolares/blue");
        if (!res.ok) throw new Error("No se pudo consultar la cotización");
        const data = await res.json();
        const rate = Number(data?.venta || 0);
        if (rate > 0) {
          setBlueRate(rate);
          setBlueUpdatedAt(data?.fechaActualizacion || "");
          setFxStatus("success");
        } else {
          setFxStatus("error");
        }
      } catch {
        setFxStatus("error");
      }
    }
    fetchBlue();
  }, []);

  useEffect(() => {
    async function loadMovements() {
      setLoading(true);
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
      setLoading(false);
    }
    loadMovements();
  }, []);

  const categoriesForType = movementForm.type ? CATEGORY_MAP[movementForm.type] || [] : [];

  const summary = useMemo(() => {
    const income = movements.filter((m) => m.type === "Ingreso").reduce((a, b) => a + b.amountArs, 0);
    const expenses = movements.filter((m) => m.type === "Egreso").reduce((a, b) => a + b.amountArs, 0);
    const savings = movements.filter((m) => m.type === "Ahorro").reduce((a, b) => a + b.amountArs, 0);
    const investments = movements.filter((m) => m.type === "Inversión").reduce((a, b) => a + b.amountArs, 0);
    return {
      income,
      expenses,
      savings,
      investments,
      net: income - expenses - savings - investments,
    };
  }, [movements]);

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

  const categoryTotals = useMemo(() => {
    const map = {};
    filteredMovements
      .filter((m) => m.type === "Egreso")
      .forEach((m) => {
        map[m.category] = (map[m.category] || 0) + m.amountArs;
      });

    const total = Object.values(map).reduce((a, b) => a + b, 0);
    return Object.entries(map)
      .map(([category, amountArs]) => ({
        category,
        amountArs,
        pct: total > 0 ? (amountArs / total) * 100 : 0,
      }))
      .sort((a, b) => b.amountArs - a.amountArs);
  }, [filteredMovements]);

  const addMovement = async () => {
    if (!movementForm.type || !movementForm.category || !movementForm.originalAmount) return;

    setSaving(true);
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
      setSaving(false);
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

    setMovementForm(emptyMovement(today, blueRate));
    setSaveMessage("Guardado en Supabase.");
    setSaving(false);
    setTab("datos");
  };

  return (
    <div className="app-shell">
      <div className="app-wrap">
        <header className="hero">
          <div>
            <h1>Finanzas Familiares</h1>
            <p>Ahora con guardado real en Supabase. El próximo paso será sumar tabla completa, exportación y deudas conectadas.</p>
          </div>
          <div className="hero-actions">
            <select
              className="control"
              value={displayCurrency}
              onChange={(e) => setDisplayCurrency(e.target.value)}
            >
              <option value="ARS">Ver en ARS</option>
              <option value="USD">Ver en USD</option>
            </select>
          </div>
        </header>

        <section className="status-strip">
          <div className="status-card">
            <span className="status-label">Cotización USD blue</span>
            <strong>{money(blueRate, "ARS")}</strong>
          </div>
          <div className="status-card">
            <span className="status-label">Estado</span>
            <strong>
              {fxStatus === "success" ? "Cotización cargada" : fxStatus === "loading" ? "Actualizando..." : "Valor manual"}
            </strong>
          </div>
          <div className="status-card status-wide">
            <span className="status-label">Última actualización</span>
            <strong>{blueUpdatedAt ? new Date(blueUpdatedAt).toLocaleString("es-AR") : "-"}</strong>
          </div>
        </section>

        <nav className="tabs">
          {[
            ["cargar", "Cargar"],
            ["dashboard", "Dashboard"],
            ["datos", "Datos"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={`tab-btn ${tab === value ? "active" : ""}`}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === "cargar" && (
          <section className="panel">
            <div className="panel-header">
              <h2>Carga rápida</h2>
              <span className="pill">Mobile first</span>
            </div>

            <div className="form-grid">
              <Field label="Fecha">
                <input
                  className="control"
                  type="date"
                  value={movementForm.date}
                  onChange={(e) => setMovementForm({ ...movementForm, date: e.target.value })}
                />
              </Field>

              <Field label="Persona">
                <select
                  className="control"
                  value={movementForm.person}
                  onChange={(e) => setMovementForm({ ...movementForm, person: e.target.value })}
                >
                  {PEOPLE.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </Field>

              <Field label="Tipo">
                <select
                  className="control"
                  value={movementForm.type}
                  onChange={(e) => setMovementForm({ ...movementForm, type: e.target.value, category: "" })}
                >
                  <option value="">Seleccionar</option>
                  {TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>

              <Field label="Categoría">
                <select
                  className="control"
                  value={movementForm.category}
                  onChange={(e) => setMovementForm({ ...movementForm, category: e.target.value })}
                  disabled={!movementForm.type}
                >
                  <option value="">Seleccionar</option>
                  {categoriesForType.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>

              <Field label="Moneda">
                <select
                  className="control"
                  value={movementForm.currency}
                  onChange={(e) => setMovementForm({ ...movementForm, currency: e.target.value })}
                >
                  <option value="ARS">Pesos</option>
                  <option value="USD">Dólar blue</option>
                </select>
              </Field>

              <Field label="Importe original">
                <input
                  className="control"
                  type="number"
                  value={movementForm.originalAmount}
                  onChange={(e) => setMovementForm({ ...movementForm, originalAmount: e.target.value })}
                  placeholder="0"
                />
              </Field>

              <Field label="Medio de pago">
                <select
                  className="control"
                  value={movementForm.paymentMethod}
                  onChange={(e) => setMovementForm({ ...movementForm, paymentMethod: e.target.value })}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </Field>

              <Field label="Descripción">
                <input
                  className="control"
                  value={movementForm.description}
                  onChange={(e) => setMovementForm({ ...movementForm, description: e.target.value })}
                  placeholder="Detalle opcional"
                />
              </Field>
            </div>

            <div className="info-box">
              Los movimientos ya se guardan en Supabase. El USD todavía usa cotización actual; después lo cambiamos a cotización histórica por fecha.
            </div>

            <button className="primary-btn" onClick={addMovement} disabled={saving}>
              {saving ? "Guardando..." : "Agregar movimiento"}
            </button>

            {saveMessage && <div className="save-message">{saveMessage}</div>}
          </section>
        )}

        {tab === "dashboard" && (
          <>
            <section className="stats-grid">
              <Stat title="Ingresos" value={formatByDisplayCurrency(summary.income, displayCurrency, blueRate)} />
              <Stat title="Gastos" value={formatByDisplayCurrency(summary.expenses, displayCurrency, blueRate)} />
              <Stat title="Ahorro" value={formatByDisplayCurrency(summary.savings, displayCurrency, blueRate)} />
              <Stat title="Inversión" value={formatByDisplayCurrency(summary.investments, displayCurrency, blueRate)} />
              <Stat title="Neto" value={formatByDisplayCurrency(summary.net, displayCurrency, blueRate)} />
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2>Gasto por categoría del mes filtrado</h2>
                <span className="pill">Importe + %</span>
              </div>

              {categoryTotals.length === 0 ? (
                <div className="empty">Todavía no hay egresos para ese filtro.</div>
              ) : (
                <div className="bars-wrap">
                  {categoryTotals.map((row) => (
                    <div key={row.category} className="bar-row">
                      <div className="bar-header">
                        <strong>{row.category}</strong>
                        <span>{formatByDisplayCurrency(row.amountArs, displayCurrency, blueRate)} · {row.pct.toFixed(1)}%</span>
                      </div>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${Math.max(6, row.pct)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {tab === "datos" && (
          <>
            <section className="panel">
              <div className="panel-header">
                <h2>Filtros</h2>
                <span className="pill">Datos</span>
              </div>

              <div className="form-grid filters-grid">
                <Field label="Mes">
                  <input
                    className="control"
                    type="month"
                    value={filters.month}
                    onChange={(e) => setFilters({ ...filters, month: e.target.value })}
                  />
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
                <h2>Movimientos guardados</h2>
                <span className="pill">{filteredMovements.length} filas</span>
              </div>

              {loading ? (
                <div className="empty">Cargando desde Supabase...</div>
              ) : filteredMovements.length === 0 ? (
                <div className="empty">No hay movimientos para esos filtros.</div>
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
                          <th>Importe original</th>
                          <th>TC</th>
                          <th>ARS</th>
                          <th>USD</th>
                          <th>Medio</th>
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mobile-cards">
                    {filteredMovements.map((m) => (
                      <article key={m.id} className="movement-card">
                        <div className="movement-card-top">
                          <strong>{m.category}</strong>
                          <span>{m.type}</span>
                        </div>
                        <div className="movement-meta">{m.date} · {m.person} · {m.paymentMethod || "-"}</div>
                        <div className="movement-desc">{m.description || "Sin detalle"}</div>
                        <div className="movement-values">
                          <div><span>Original</span><strong>{money(m.originalAmount, m.currency)}</strong></div>
                          <div><span>ARS</span><strong>{money(m.amountArs, "ARS")}</strong></div>
                          <div><span>USD</span><strong>{money(m.amountUsd || convertFromArs(m.amountArs, "USD", m.fxRate), "USD")}</strong></div>
                          <div><span>TC</span><strong>{Number(m.fxRate || 0).toFixed(2)}</strong></div>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Stat({ title, value }) {
  return (
    <div className="stat-card">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}
