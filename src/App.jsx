
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const DEFAULT_PEOPLE = ["Federico", "Mica", "Santy", "Compartido"];
const DEFAULT_PAYMENT_METHODS = ["Banco", "Tarjeta", "Efectivo", "Mercado Pago", "Transferencia"];
const DEFAULT_TYPES = ["Ingreso", "Egreso", "Ahorro", "Inversión"];
const DEFAULT_CATEGORY_MAP = {
  Ingreso: ["Sueldo", "Freelance", "Venta", "Otros ingresos"],
  Egreso: ["Supermercado", "Salud", "Educación", "Transporte", "Servicios", "Alquiler", "Salidas", "Deuda", "Otros egresos"],
  Ahorro: ["Fondo de emergencia", "Ahorro USD", "Caja ahorro"],
  Inversión: ["FCI", "Acciones", "Cedears", "Cripto"],
};

const TABS = [
  { id: "cargar", label: "Cargar", icon: "＋" },
  { id: "dashboard", label: "Dashboard", icon: "◫" },
  { id: "datos", label: "Datos", icon: "▤" },
  { id: "presupuesto", label: "Presupuesto", icon: "◎" },
  { id: "deudas", label: "Deudas", icon: "◈" },
  { id: "metas", label: "Metas", icon: "★" },
  { id: "config", label: "Config", icon: "⚙" },
];

const PALETTE = ["#274690", "#576ca8", "#302b63", "#7c3aed", "#ec4899", "#0f766e", "#d97706", "#dc2626"];

const money = (n, cur = "ARS") =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: cur,
    maximumFractionDigits: cur === "USD" ? 2 : 0,
  }).format(Number(n || 0));

const toMonthKey = (date) => {
  if (!date) return "";
  const d = new Date(`${date}T00:00:00`);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);

const toArs = (amount, currency, rate) =>
  currency === "USD" ? Number(amount || 0) * Number(rate || 1) : Number(amount || 0);

const fromArs = (amountArs, currency, rate) =>
  currency === "USD" ? (Number(rate || 0) > 0 ? Number(amountArs || 0) / Number(rate) : 0) : Number(amountArs || 0);

function classNames(...parts) {
  return parts.filter(Boolean).join(" ");
}

function Card({ children, className = "" }) {
  return <section className={classNames("card", className)}>{children}</section>;
}

function SectionHead({ eyebrow, title, subtitle, action }) {
  return (
    <div className="section-head">
      <div>
        {eyebrow && <div className="section-eyebrow">{eyebrow}</div>}
        <h2 className="section-title">{title}</h2>
        {subtitle && <p className="section-subtitle">{subtitle}</p>}
      </div>
      {action && <div className="section-action">{action}</div>}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="field">
      <div className="field-top">
        <label className="field-label">{label}</label>
        {hint && <span className="field-hint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Input({ className = "", ...props }) {
  return <input className={classNames("control", className)} {...props} />;
}

function Select({ className = "", children, onChange, ...props }) {
  return (
    <select className={classNames("control", className)} onChange={(e) => onChange?.(e.target.value)} {...props}>
      {children}
    </select>
  );
}

function Button({ children, variant = "primary", small = false, className = "", ...props }) {
  return (
    <button className={classNames("btn", `btn-${variant}`, small && "btn-sm", className)} {...props}>
      {children}
    </button>
  );
}

function Badge({ children, tone = "blue" }) {
  return <span className={classNames("badge", `badge-${tone}`)}>{children}</span>;
}

function StatCard({ label, value, tone = "blue", hint }) {
  return (
    <Card className={classNames("stat-card", `stat-${tone}`)}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </Card>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="empty-state">
      <div className="empty-title">{title}</div>
      <div className="empty-text">{text}</div>
    </div>
  );
}

function Progress({ value }) {
  const pct = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div className="progress">
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

function MiniBarChart({ data, valueKey, labelKey }) {
  const max = Math.max(...data.map((item) => Number(item[valueKey] || 0)), 1);
  return (
    <div className="mini-chart">
      {data.map((item, index) => (
        <div className="mini-chart-row" key={`${item[labelKey]}-${index}`}>
          <div className="mini-chart-label">{item[labelKey]}</div>
          <div className="mini-chart-track">
            <div
              className="mini-chart-fill"
              style={{ width: `${(Number(item[valueKey] || 0) / max) * 100}%` }}
            />
          </div>
          <div className="mini-chart-value">{item.displayValue || money(item[valueKey] || 0)}</div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [movements, setMovements] = useState([]);
  const [debts, setDebts] = useState([]);
  const [debtPayments, setDebtPayments] = useState([]);
  const [goals, setGoals] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [monthlyBalances, setMonthlyBalances] = useState([]);

  const [people, setPeople] = useState(DEFAULT_PEOPLE);
  const [paymentMethods, setPaymentMethods] = useState(DEFAULT_PAYMENT_METHODS);
  const [types, setTypes] = useState(DEFAULT_TYPES);
  const [categoryMap, setCategoryMap] = useState(DEFAULT_CATEGORY_MAP);

  const [blueRate, setBlueRate] = useState(1250);
  const [blueUpdatedAt, setBlueUpdatedAt] = useState("");
  const [fxStatus, setFxStatus] = useState("idle");
  const [displayCurrency, setDisplayCurrency] = useState("ARS");
  const [message, setMessage] = useState("");

  const emptyMovementForm = useCallback(
    () => ({
      date: today(),
      person: "Compartido",
      type: "",
      category: "",
      description: "",
      originalAmount: "",
      currency: "ARS",
      paymentMethod: paymentMethods[0] || "Banco",
      linkedDebtId: "",
    }),
    [paymentMethods]
  );

  const [movementForm, setMovementForm] = useState(emptyMovementForm());
  const [debtForm, setDebtForm] = useState({
    name: "",
    owner: "Compartido",
    balance: "",
    installment: "",
    dueDay: "",
    priority: "Media",
    rate: "",
    notes: "",
  });
  const [debtPaymentForm, setDebtPaymentForm] = useState({
    debtId: "",
    date: today(),
    amount: "",
    person: "Compartido",
    paymentMethod: "Banco",
    notes: "",
  });
  const [goalForm, setGoalForm] = useState({ name: "", target: "", current: "", notes: "" });
  const [budgetForm, setBudgetForm] = useState({
    month: currentMonth(),
    person: "Compartido",
    type: "Egreso",
    category: DEFAULT_CATEGORY_MAP.Egreso[0],
    planned: "",
  });
  const [balanceForm, setBalanceForm] = useState({
    month: currentMonth(),
    opening: "",
    notes: "",
  });

  const [filters, setFilters] = useState({
    month: currentMonth(),
    person: "all",
    type: "all",
    category: "all",
    currency: "all",
  });

  const [catalogForm, setCatalogForm] = useState({
    person: "",
    paymentMethod: "",
    type: "",
    categoryType: "Egreso",
    category: "",
  });

  const fmt = useCallback(
    (amountArs) => money(fromArs(amountArs, displayCurrency, blueRate), displayCurrency),
    [displayCurrency, blueRate]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      try {
        setLoading(true);

        const [
          movRes,
          debtRes,
          debtPayRes,
          goalRes,
          budgetRes,
          balanceRes,
          catalogRes,
        ] = await Promise.all([
          supabase.from("movements").select("*").order("movement_date", { ascending: false }),
          supabase.from("debts").select("*").order("created_at", { ascending: false }),
          supabase.from("debt_payments").select("*").order("payment_date", { ascending: false }),
          supabase.from("goals").select("*").order("created_at", { ascending: false }),
          supabase.from("budgets").select("*").order("created_at", { ascending: false }),
          supabase.from("monthly_balances").select("*").order("balance_month", { ascending: false }),
          supabase.from("settings_catalog").select("*").order("created_at", { ascending: true }),
        ]);

        if (cancelled) return;

        if (movRes.data) {
          setMovements(
            movRes.data.map((m) => ({
              id: m.id,
              date: m.movement_date,
              person: m.person,
              type: m.type,
              category: m.category,
              description: m.description || "",
              originalAmount: Number(m.original_amount || 0),
              currency: m.original_currency,
              fxRate: Number(m.fx_rate || 1),
              amountArs: Number(m.amount_ars || 0),
              amountUsd: Number(m.amount_usd || 0),
              paymentMethod: m.payment_method,
              linkedDebtId: m.linked_debt_id,
            }))
          );
        }

        if (debtRes.data) {
          setDebts(
            debtRes.data.map((d) => ({
              id: d.id,
              name: d.name,
              owner: d.owner,
              balance: Number(d.current_balance || 0),
              initialBalance: Number(d.initial_balance || 0),
              installment: Number(d.installment_amount || 0),
              dueDay: Number(d.due_day || 0),
              priority: d.priority || "Media",
              rate: Number(d.rate || 0),
              notes: d.notes || "",
              totalPaid: Number(d.total_paid || 0),
              status: d.status || "Activa",
            }))
          );
        }

        if (debtPayRes.data) {
          setDebtPayments(
            debtPayRes.data.map((p) => ({
              id: p.id,
              debtId: p.debt_id,
              date: p.payment_date,
              amount: Number(p.amount_ars || 0),
              person: p.person,
              paymentMethod: p.payment_method,
              notes: p.notes || "",
            }))
          );
        }

        if (goalRes.data) {
          setGoals(
            goalRes.data.map((g) => ({
              ...g,
              target_amount: Number(g.target_amount || 0),
              current_amount: Number(g.current_amount || 0),
            }))
          );
        }

        if (budgetRes.data) {
          setBudgets(
            budgetRes.data.map((b) => ({
              id: b.id,
              month: b.budget_month,
              person: b.person,
              type: b.type,
              category: b.category,
              planned: Number(b.planned_amount_ars || 0),
            }))
          );
        }

        if (balanceRes.data) {
          setMonthlyBalances(balanceRes.data);
        }

        if (catalogRes.data?.length) {
          const dbPeople = catalogRes.data.filter((c) => c.catalog_type === "person").map((c) => c.value);
          const dbMethods = catalogRes.data.filter((c) => c.catalog_type === "payment_method").map((c) => c.value);
          const dbTypes = catalogRes.data.filter((c) => c.catalog_type === "type").map((c) => c.value);
          const dbCategories = catalogRes.data.filter((c) => c.catalog_type === "category");

          if (dbPeople.length) setPeople(dbPeople);
          if (dbMethods.length) setPaymentMethods(dbMethods);
          if (dbTypes.length) setTypes(dbTypes);

          if (dbCategories.length) {
            const rebuilt = {};
            dbCategories.forEach((row) => {
              const parent = row.parent_type || "Egreso";
              if (!rebuilt[parent]) rebuilt[parent] = [];
              rebuilt[parent].push(row.value);
            });
            setCategoryMap((prev) => ({ ...prev, ...rebuilt }));
          }
        }
      } catch (error) {
        console.error("Error cargando datos", error);
        setMessage("No se pudo cargar todo desde Supabase. Revisá consola y tablas.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAll();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    async function fetchBlue() {
      try {
        setFxStatus("loading");
        const res = await fetch("https://dolarapi.com/v1/dolares/blue");
        if (!res.ok) throw new Error("No se pudo obtener cotización");
        const data = await res.json();
        if (Number(data?.venta || 0) > 0) {
          setBlueRate(Number(data.venta));
          setBlueUpdatedAt(data?.fechaActualizacion || "");
          setFxStatus("ok");
        } else {
          throw new Error("Cotización inválida");
        }
      } catch (error) {
        console.error(error);
        setFxStatus("error");
      }
    }

    fetchBlue();
  }, []);

  useEffect(() => {
    setMovementForm((prev) => ({
      ...prev,
      paymentMethod: paymentMethods.includes(prev.paymentMethod)
        ? prev.paymentMethod
        : paymentMethods[0] || "Banco",
    }));
  }, [paymentMethods]);

  function notify(text) {
    setMessage(text);
    window.clearTimeout(window.__finanzasToastTimer);
    window.__finanzasToastTimer = window.setTimeout(() => setMessage(""), 3000);
  }

  async function addMovement() {
    if (!movementForm.type || !movementForm.category || !movementForm.originalAmount || !movementForm.person) return;

    try {
      setBusy(true);

      const rate = movementForm.currency === "USD" ? blueRate : 1;
      const amountArs = toArs(movementForm.originalAmount, movementForm.currency, rate);
      const amountUsd =
        movementForm.currency === "USD"
          ? Number(movementForm.originalAmount || 0)
          : Number(rate) > 0
          ? amountArs / Number(blueRate || 1)
          : 0;

      const selectedDebt = debts.find((d) => String(d.id) === String(movementForm.linkedDebtId));

      const payload = {
        movement_date: movementForm.date,
        person: movementForm.person,
        type: movementForm.type,
        category: movementForm.category,
        description: movementForm.description || null,
        original_currency: movementForm.currency,
        original_amount: Number(movementForm.originalAmount),
        fx_rate: rate,
        amount_ars: amountArs,
        amount_usd: amountUsd,
        payment_method: movementForm.paymentMethod,
        linked_debt_id: movementForm.linkedDebtId ? Number(movementForm.linkedDebtId) : null,
      };

      const { data, error } = await supabase.from("movements").insert([payload]).select().single();
      if (error) throw error;

      if (data) {
        const normalized = {
          id: data.id,
          date: data.movement_date,
          person: data.person,
          type: data.type,
          category: data.category,
          description: data.description || "",
          originalAmount: Number(data.original_amount || 0),
          currency: data.original_currency,
          fxRate: Number(data.fx_rate || 1),
          amountArs: Number(data.amount_ars || 0),
          amountUsd: Number(data.amount_usd || 0),
          paymentMethod: data.payment_method,
          linkedDebtId: data.linked_debt_id,
        };

        setMovements((prev) => [normalized, ...prev]);
      }

      if (movementForm.type === "Egreso" && movementForm.category === "Deuda" && selectedDebt) {
        const newBalance = Math.max(0, Number(selectedDebt.balance || 0) - amountArs);
        const newPaid = Number(selectedDebt.totalPaid || 0) + amountArs;

        const debtUpdate = await supabase
          .from("debts")
          .update({ current_balance: newBalance, total_paid: newPaid })
          .eq("id", selectedDebt.id);

        if (debtUpdate.error) throw debtUpdate.error;

        const paymentInsert = await supabase.from("debt_payments").insert([
          {
            debt_id: selectedDebt.id,
            payment_date: movementForm.date,
            amount_ars: amountArs,
            person: movementForm.person,
            payment_method: movementForm.paymentMethod,
            notes: movementForm.description || "Pago desde movimiento",
          },
        ]).select().single();

        if (paymentInsert.error) throw paymentInsert.error;

        setDebts((prev) =>
          prev.map((d) =>
            d.id === selectedDebt.id
              ? { ...d, balance: newBalance, totalPaid: newPaid }
              : d
          )
        );

        if (paymentInsert.data) {
          setDebtPayments((prev) => [
            {
              id: paymentInsert.data.id,
              debtId: paymentInsert.data.debt_id,
              date: paymentInsert.data.payment_date,
              amount: Number(paymentInsert.data.amount_ars || 0),
              person: paymentInsert.data.person,
              paymentMethod: paymentInsert.data.payment_method,
              notes: paymentInsert.data.notes || "",
            },
            ...prev,
          ]);
        }
      }

      setMovementForm(emptyMovementForm());
      notify("Movimiento guardado.");
    } catch (error) {
      console.error(error);
      notify("No se pudo guardar el movimiento.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteMovement(id) {
    try {
      setBusy(true);
      const { error } = await supabase.from("movements").delete().eq("id", id);
      if (error) throw error;
      setMovements((prev) => prev.filter((m) => m.id !== id));
      notify("Movimiento eliminado.");
    } catch (error) {
      console.error(error);
      notify("No se pudo eliminar el movimiento.");
    } finally {
      setBusy(false);
    }
  }

  async function addDebt() {
    if (!debtForm.name || !debtForm.balance) return;

    try {
      setBusy(true);
      const initial = Number(debtForm.balance || 0);
      const payload = {
        name: debtForm.name,
        owner: debtForm.owner,
        initial_balance: initial,
        current_balance: initial,
        installment_amount: Number(debtForm.installment || 0),
        due_day: Number(debtForm.dueDay || 0),
        priority: debtForm.priority,
        rate: Number(debtForm.rate || 0),
        notes: debtForm.notes || null,
        total_paid: 0,
        status: "Activa",
      };

      const { data, error } = await supabase.from("debts").insert([payload]).select().single();
      if (error) throw error;

      if (data) {
        setDebts((prev) => [
          {
            id: data.id,
            name: data.name,
            owner: data.owner,
            balance: Number(data.current_balance || 0),
            initialBalance: Number(data.initial_balance || 0),
            installment: Number(data.installment_amount || 0),
            dueDay: Number(data.due_day || 0),
            priority: data.priority || "Media",
            rate: Number(data.rate || 0),
            notes: data.notes || "",
            totalPaid: Number(data.total_paid || 0),
            status: data.status || "Activa",
          },
          ...prev,
        ]);
      }

      setDebtForm({
        name: "",
        owner: "Compartido",
        balance: "",
        installment: "",
        dueDay: "",
        priority: "Media",
        rate: "",
        notes: "",
      });
      notify("Deuda agregada.");
    } catch (error) {
      console.error(error);
      notify("No se pudo guardar la deuda.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteDebt(id) {
    try {
      setBusy(true);
      const { error } = await supabase.from("debts").delete().eq("id", id);
      if (error) throw error;
      setDebts((prev) => prev.filter((d) => d.id !== id));
      notify("Deuda eliminada.");
    } catch (error) {
      console.error(error);
      notify("No se pudo eliminar la deuda.");
    } finally {
      setBusy(false);
    }
  }

  async function registerDebtPayment() {
    const debt = debts.find((d) => String(d.id) === String(debtPaymentForm.debtId));
    if (!debt || !debtPaymentForm.amount) return;

    try {
      setBusy(true);
      const amount = Math.min(Number(debtPaymentForm.amount || 0), Number(debt.balance || 0));
      if (amount <= 0) return;

      const newBalance = Math.max(0, Number(debt.balance || 0) - amount);
      const newPaid = Number(debt.totalPaid || 0) + amount;

      const debtUpdate = await supabase
        .from("debts")
        .update({ current_balance: newBalance, total_paid: newPaid })
        .eq("id", debt.id);

      if (debtUpdate.error) throw debtUpdate.error;

      const paymentInsert = await supabase.from("debt_payments").insert([
        {
          debt_id: debt.id,
          payment_date: debtPaymentForm.date,
          amount_ars: amount,
          person: debtPaymentForm.person,
          payment_method: debtPaymentForm.paymentMethod,
          notes: debtPaymentForm.notes || null,
        },
      ]).select().single();

      if (paymentInsert.error) throw paymentInsert.error;

      const movementInsert = await supabase.from("movements").insert([
        {
          movement_date: debtPaymentForm.date,
          person: debtPaymentForm.person,
          type: "Egreso",
          category: "Deuda",
          description: `Pago deuda - ${debt.name}`,
          original_currency: "ARS",
          original_amount: amount,
          fx_rate: 1,
          amount_ars: amount,
          amount_usd: Number(blueRate || 1) > 0 ? amount / Number(blueRate) : 0,
          payment_method: debtPaymentForm.paymentMethod,
          linked_debt_id: debt.id,
        },
      ]).select().single();

      if (movementInsert.error) throw movementInsert.error;

      setDebts((prev) =>
        prev.map((item) =>
          item.id === debt.id ? { ...item, balance: newBalance, totalPaid: newPaid } : item
        )
      );

      if (paymentInsert.data) {
        setDebtPayments((prev) => [
          {
            id: paymentInsert.data.id,
            debtId: paymentInsert.data.debt_id,
            date: paymentInsert.data.payment_date,
            amount: Number(paymentInsert.data.amount_ars || 0),
            person: paymentInsert.data.person,
            paymentMethod: paymentInsert.data.payment_method,
            notes: paymentInsert.data.notes || "",
          },
          ...prev,
        ]);
      }

      if (movementInsert.data) {
        setMovements((prev) => [
          {
            id: movementInsert.data.id,
            date: movementInsert.data.movement_date,
            person: movementInsert.data.person,
            type: movementInsert.data.type,
            category: movementInsert.data.category,
            description: movementInsert.data.description || "",
            originalAmount: Number(movementInsert.data.original_amount || 0),
            currency: movementInsert.data.original_currency,
            fxRate: Number(movementInsert.data.fx_rate || 1),
            amountArs: Number(movementInsert.data.amount_ars || 0),
            amountUsd: Number(movementInsert.data.amount_usd || 0),
            paymentMethod: movementInsert.data.payment_method,
            linkedDebtId: movementInsert.data.linked_debt_id,
          },
          ...prev,
        ]);
      }

      setDebtPaymentForm({
        debtId: "",
        date: today(),
        amount: "",
        person: "Compartido",
        paymentMethod: "Banco",
        notes: "",
      });

      notify("Pago de deuda registrado.");
    } catch (error) {
      console.error(error);
      notify("No se pudo registrar el pago.");
    } finally {
      setBusy(false);
    }
  }

  async function addGoal() {
    if (!goalForm.name || !goalForm.target) return;

    try {
      setBusy(true);
      const payload = {
        name: goalForm.name,
        target_amount: Number(goalForm.target || 0),
        current_amount: Number(goalForm.current || 0),
        notes: goalForm.notes || null,
      };
      const { data, error } = await supabase.from("goals").insert([payload]).select().single();
      if (error) throw error;
      if (data) {
        setGoals((prev) => [
          {
            ...data,
            target_amount: Number(data.target_amount || 0),
            current_amount: Number(data.current_amount || 0),
          },
          ...prev,
        ]);
      }
      setGoalForm({ name: "", target: "", current: "", notes: "" });
      notify("Meta agregada.");
    } catch (error) {
      console.error(error);
      notify("No se pudo guardar la meta.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteGoal(id) {
    try {
      setBusy(true);
      const { error } = await supabase.from("goals").delete().eq("id", id);
      if (error) throw error;
      setGoals((prev) => prev.filter((g) => g.id !== id));
      notify("Meta eliminada.");
    } catch (error) {
      console.error(error);
      notify("No se pudo eliminar la meta.");
    } finally {
      setBusy(false);
    }
  }

  async function addBudget() {
    if (!budgetForm.month || !budgetForm.person || !budgetForm.type || !budgetForm.category || !budgetForm.planned) return;

    try {
      setBusy(true);
      const payload = {
        budget_month: budgetForm.month,
        person: budgetForm.person,
        type: budgetForm.type,
        category: budgetForm.category,
        planned_amount_ars: Number(budgetForm.planned || 0),
      };

      const { data, error } = await supabase.from("budgets").insert([payload]).select().single();
      if (error) throw error;

      if (data) {
        setBudgets((prev) => [
          {
            id: data.id,
            month: data.budget_month,
            person: data.person,
            type: data.type,
            category: data.category,
            planned: Number(data.planned_amount_ars || 0),
          },
          ...prev,
        ]);
      }

      setBudgetForm({
        month: currentMonth(),
        person: "Compartido",
        type: "Egreso",
        category: categoryMap.Egreso?.[0] || "Otros egresos",
        planned: "",
      });
      notify("Presupuesto guardado.");
    } catch (error) {
      console.error(error);
      notify("No se pudo guardar el presupuesto.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteBudget(id) {
    try {
      setBusy(true);
      const { error } = await supabase.from("budgets").delete().eq("id", id);
      if (error) throw error;
      setBudgets((prev) => prev.filter((b) => b.id !== id));
      notify("Presupuesto eliminado.");
    } catch (error) {
      console.error(error);
      notify("No se pudo eliminar el presupuesto.");
    } finally {
      setBusy(false);
    }
  }

  async function saveBalance() {
    if (!balanceForm.month || balanceForm.opening === "") return;

    try {
      setBusy(true);
      const existing = monthlyBalances.find((b) => b.balance_month === balanceForm.month);

      if (existing) {
        const { error } = await supabase
          .from("monthly_balances")
          .update({
            opening_balance_ars: Number(balanceForm.opening || 0),
            notes: balanceForm.notes || null,
          })
          .eq("id", existing.id);

        if (error) throw error;

        setMonthlyBalances((prev) =>
          prev.map((b) =>
            b.id === existing.id
              ? { ...b, opening_balance_ars: Number(balanceForm.opening || 0), notes: balanceForm.notes || "" }
              : b
          )
        );
      } else {
        const { data, error } = await supabase
          .from("monthly_balances")
          .insert([
            {
              balance_month: balanceForm.month,
              opening_balance_ars: Number(balanceForm.opening || 0),
              notes: balanceForm.notes || null,
            },
          ])
          .select()
          .single();

        if (error) throw error;
        if (data) setMonthlyBalances((prev) => [data, ...prev]);
      }

      setBalanceForm({ month: currentMonth(), opening: "", notes: "" });
      notify("Saldo inicial guardado.");
    } catch (error) {
      console.error(error);
      notify("No se pudo guardar el saldo inicial.");
    } finally {
      setBusy(false);
    }
  }

  async function addCatalogItem(kind) {
    const map = {
      person: catalogForm.person.trim(),
      payment_method: catalogForm.paymentMethod.trim(),
      type: catalogForm.type.trim(),
      category: catalogForm.category.trim(),
    };

    const rawValue = map[kind];
    if (!rawValue) return;

    try {
      setBusy(true);

      const normalizedValue = rawValue.trim();

      if (kind === "person" && !people.includes(normalizedValue)) {
        setPeople((prev) => [...prev, normalizedValue]);
      }

      if (kind === "payment_method" && !paymentMethods.includes(normalizedValue)) {
        setPaymentMethods((prev) => [...prev, normalizedValue]);
      }

      if (kind === "type" && !types.includes(normalizedValue)) {
        setTypes((prev) => [...prev, normalizedValue]);
      }

      if (kind === "category") {
        setCategoryMap((prev) => {
          const current = prev[catalogForm.categoryType] || [];
          if (current.includes(normalizedValue)) return prev;
          return { ...prev, [catalogForm.categoryType]: [...current, normalizedValue] };
        });
      }

      const payload = {
        catalog_type: kind,
        value: normalizedValue,
        parent_type: kind === "category" ? catalogForm.categoryType : null,
      };

      const { error } = await supabase.from("settings_catalog").insert([payload]);
      if (error) {
        console.warn("No se pudo persistir settings_catalog", error);
      }

      setCatalogForm((prev) => ({
        ...prev,
        person: kind === "person" ? "" : prev.person,
        paymentMethod: kind === "payment_method" ? "" : prev.paymentMethod,
        type: kind === "type" ? "" : prev.type,
        category: kind === "category" ? "" : prev.category,
      }));
      notify("Ítem agregado.");
    } catch (error) {
      console.error(error);
      notify("No se pudo agregar el ítem.");
    } finally {
      setBusy(false);
    }
  }

  const selectedDebtInMovement = debts.find((d) => String(d.id) === String(movementForm.linkedDebtId));
  const selectedDebtInPayment = debts.find((d) => String(d.id) === String(debtPaymentForm.debtId));

  const summary = useMemo(() => {
    const income = movements.filter((m) => m.type === "Ingreso").reduce((acc, m) => acc + Number(m.amountArs || 0), 0);
    const expenses = movements.filter((m) => m.type === "Egreso").reduce((acc, m) => acc + Number(m.amountArs || 0), 0);
    const savings = movements.filter((m) => m.type === "Ahorro").reduce((acc, m) => acc + Number(m.amountArs || 0), 0);
    const investments = movements.filter((m) => m.type === "Inversión").reduce((acc, m) => acc + Number(m.amountArs || 0), 0);
    const totalDebt = debts.reduce((acc, d) => acc + Number(d.balance || 0), 0);
    const net = income - expenses - savings - investments;

    return { income, expenses, savings, investments, totalDebt, net };
  }, [movements, debts]);

  const reportMonth = filters.month || currentMonth();

  const monthBalance = useMemo(() => {
    const openingRecord = monthlyBalances.find((b) => b.balance_month === reportMonth);
    const opening = Number(openingRecord?.opening_balance_ars || 0);

    const monthItems = movements.filter((m) => toMonthKey(m.date) === reportMonth);
    const income = monthItems.filter((m) => m.type === "Ingreso").reduce((acc, m) => acc + Number(m.amountArs || 0), 0);
    const expenses = monthItems.filter((m) => m.type === "Egreso").reduce((acc, m) => acc + Number(m.amountArs || 0), 0);
    const savings = monthItems.filter((m) => m.type === "Ahorro").reduce((acc, m) => acc + Number(m.amountArs || 0), 0);
    const investments = monthItems.filter((m) => m.type === "Inversión").reduce((acc, m) => acc + Number(m.amountArs || 0), 0);
    const closing = opening + income - expenses - savings - investments;

    return { opening, income, expenses, savings, investments, closing };
  }, [monthlyBalances, movements, reportMonth]);

  const topExpensesByCategory = useMemo(() => {
    const bucket = {};
    movements
      .filter((m) => m.type === "Egreso" && toMonthKey(m.date) === reportMonth)
      .forEach((m) => {
        bucket[m.category] = (bucket[m.category] || 0) + Number(m.amountArs || 0);
      });

    return Object.entries(bucket)
      .map(([label, value]) => ({ label, value, displayValue: fmt(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [movements, reportMonth, fmt]);

  const topExpensesByPerson = useMemo(() => {
    const bucket = {};
    movements
      .filter((m) => m.type === "Egreso" && toMonthKey(m.date) === reportMonth)
      .forEach((m) => {
        bucket[m.person] = (bucket[m.person] || 0) + Number(m.amountArs || 0);
      });

    return Object.entries(bucket)
      .map(([label, value]) => ({ label, value, displayValue: fmt(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [movements, reportMonth, fmt]);

  const budgetComparison = useMemo(() => {
    return budgets
      .filter((b) => b.month === reportMonth)
      .map((b) => {
        const actual = movements
          .filter(
            (m) =>
              toMonthKey(m.date) === b.month &&
              m.person === b.person &&
              m.type === b.type &&
              m.category === b.category
          )
          .reduce((acc, m) => acc + Number(m.amountArs || 0), 0);

        const execution = b.planned > 0 ? (actual / b.planned) * 100 : 0;

        return {
          ...b,
          actual,
          difference: Number(b.planned || 0) - actual,
          execution,
        };
      })
      .sort((a, b) => b.execution - a.execution);
  }, [budgets, movements, reportMonth]);

  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      if (filters.month && toMonthKey(m.date) !== filters.month) return false;
      if (filters.person !== "all" && m.person !== filters.person) return false;
      if (filters.type !== "all" && m.type !== filters.type) return false;
      if (filters.category !== "all" && m.category !== filters.category) return false;
      if (filters.currency !== "all" && m.currency !== filters.currency) return false;
      return true;
    });
  }, [movements, filters]);

  function exportCsv() {
    const headers = [
      "Fecha",
      "Persona",
      "Tipo",
      "Categoría",
      "Descripción",
      "Moneda",
      "Importe original",
      "TC",
      "Importe ARS",
      "Importe USD",
      "Medio de pago",
    ];

    const rows = filteredMovements.map((m) => [
      m.date,
      m.person,
      m.type,
      m.category,
      m.description || "",
      m.currency,
      m.originalAmount,
      m.fxRate,
      m.amountArs,
      m.amountUsd,
      m.paymentMethod,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `movimientos_${filters.month || "todos"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="screen-center">
        <div className="loader" />
        <div className="screen-title">Cargando tu tablero</div>
        <div className="screen-text">Consultando movimientos, deudas, metas y presupuestos.</div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="app-frame">
        <aside className="sidebar">
          <div className="brand-card">
            <div className="brand-mark">F</div>
            <div>
              <div className="brand-title">Finanzas familiares</div>
              <div className="brand-subtitle">Supabase + Vercel</div>
            </div>
          </div>

          <nav className="sidebar-nav">
            {TABS.map((item) => (
              <button
                key={item.id}
                className={classNames("nav-btn", tab === item.id && "active")}
                onClick={() => setTab(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <Card className="sidebar-card">
            <div className="sidebar-card-label">Moneda de visualización</div>
            <Select value={displayCurrency} onChange={setDisplayCurrency}>
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </Select>
            <div className="sidebar-card-note">
              {fxStatus === "ok"
                ? `USD blue: ${money(blueRate)}`
                : fxStatus === "loading"
                ? "Actualizando dólar blue…"
                : "Cotización manual"}
            </div>
          </Card>
        </aside>

        <main className="main-panel">
          <header className="hero">
            <div>
              <div className="hero-eyebrow">Panel integral</div>
              <h1 className="hero-title">Controlá gastos, deuda y presupuesto sin romper Supabase</h1>
              <p className="hero-text">
                Diseño más limpio, mobile-first y con todas las secciones principales en una sola app.
              </p>
            </div>

            <div className="hero-meta">
              <div className="hero-pill">
                <span className="hero-pill-label">Mes</span>
                <Input type="month" value={filters.month} onChange={(e) => setFilters({ ...filters, month: e.target.value })} />
              </div>
              <div className="hero-pill">
                <span className="hero-pill-label">Dólar</span>
                <strong>{money(blueRate)}</strong>
              </div>
            </div>
          </header>

          {message && <div className="toast">{message}</div>}

          {tab === "dashboard" && (
            <div className="page-grid">
              <div className="stats-grid">
                <StatCard label="Ingresos" value={fmt(summary.income)} tone="green" />
                <StatCard label="Gastos" value={fmt(summary.expenses)} tone="red" />
                <StatCard label="Ahorro" value={fmt(summary.savings)} tone="blue" />
                <StatCard label="Inversión" value={fmt(summary.investments)} tone="purple" />
                <StatCard label="Deuda total" value={fmt(summary.totalDebt)} tone="amber" />
                <StatCard label="Resultado neto" value={fmt(summary.net)} tone={summary.net >= 0 ? "green" : "red"} />
              </div>

              <div className="grid-2">
                <Card>
                  <SectionHead
                    eyebrow="Resumen mensual"
                    title={`Saldo del mes · ${reportMonth}`}
                    subtitle="Toma saldo inicial, ingresos, gastos, ahorro e inversión."
                  />
                  <div className="balance-list">
                    <div className="balance-item"><span>Saldo inicial</span><strong>{fmt(monthBalance.opening)}</strong></div>
                    <div className="balance-item positive"><span>Ingresos</span><strong>{fmt(monthBalance.income)}</strong></div>
                    <div className="balance-item negative"><span>Gastos</span><strong>{fmt(monthBalance.expenses)}</strong></div>
                    <div className="balance-item neutral"><span>Ahorro</span><strong>{fmt(monthBalance.savings)}</strong></div>
                    <div className="balance-item neutral"><span>Inversión</span><strong>{fmt(monthBalance.investments)}</strong></div>
                    <div className="balance-item total"><span>Saldo final</span><strong>{fmt(monthBalance.closing)}</strong></div>
                  </div>
                </Card>

                <Card>
                  <SectionHead
                    eyebrow="Alertas"
                    title="Próximas deudas"
                    subtitle="Ordenadas por día de vencimiento."
                  />
                  <div className="stack-list">
                    {debts.length === 0 ? (
                      <EmptyState title="Sin deudas cargadas" text="Cuando agregues deudas, van a aparecer acá." />
                    ) : (
                      debts
                        .slice()
                        .sort((a, b) => Number(a.dueDay || 0) - Number(b.dueDay || 0))
                        .slice(0, 5)
                        .map((debt) => (
                          <div className="list-row" key={debt.id}>
                            <div>
                              <div className="row-title">{debt.name}</div>
                              <div className="row-subtitle">{debt.owner} · prioridad {debt.priority}</div>
                            </div>
                            <div className="row-right">
                              <div className="row-title">{fmt(debt.installment || debt.balance)}</div>
                              <div className="row-subtitle">día {debt.dueDay || "-"}</div>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </Card>
              </div>

              <div className="grid-2">
                <Card>
                  <SectionHead
                    eyebrow="Top categorías"
                    title="Gastos por categoría"
                    subtitle="Solo egresos del mes seleccionado."
                  />
                  {topExpensesByCategory.length === 0 ? (
                    <EmptyState title="Sin egresos del mes" text="Todavía no hay gastos cargados para este período." />
                  ) : (
                    <MiniBarChart data={topExpensesByCategory} labelKey="label" valueKey="value" />
                  )}
                </Card>

                <Card>
                  <SectionHead
                    eyebrow="Top personas"
                    title="Gastos por persona"
                    subtitle="Comparativo rápido por responsable."
                  />
                  {topExpensesByPerson.length === 0 ? (
                    <EmptyState title="Sin egresos del mes" text="Todavía no hay movimientos para comparar." />
                  ) : (
                    <MiniBarChart data={topExpensesByPerson} labelKey="label" valueKey="value" />
                  )}
                </Card>
              </div>
            </div>
          )}

          {tab === "cargar" && (
            <div className="page-grid">
              <Card>
                <SectionHead
                  eyebrow="Formulario principal"
                  title="Cargar movimiento"
                  subtitle="Mantiene lectura, guardado y borrado con Supabase."
                  action={<Badge tone="blue">{busy ? "Procesando…" : "Listo"}</Badge>}
                />
                <div className="form-grid">
                  <Field label="Fecha">
                    <Input type="date" value={movementForm.date} onChange={(e) => setMovementForm({ ...movementForm, date: e.target.value })} />
                  </Field>
                  <Field label="Persona">
                    <Select value={movementForm.person} onChange={(value) => setMovementForm({ ...movementForm, person: value })}>
                      {people.map((person) => (
                        <option value={person} key={person}>{person}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Tipo">
                    <Select
                      value={movementForm.type}
                      onChange={(value) =>
                        setMovementForm({
                          ...movementForm,
                          type: value,
                          category: "",
                          linkedDebtId: "",
                        })
                      }
                    >
                      <option value="">Seleccionar…</option>
                      {types.map((type) => (
                        <option value={type} key={type}>{type}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Categoría">
                    <Select
                      value={movementForm.category}
                      onChange={(value) =>
                        setMovementForm({
                          ...movementForm,
                          category: value,
                          linkedDebtId: value === "Deuda" ? movementForm.linkedDebtId : "",
                        })
                      }
                      disabled={!movementForm.type}
                    >
                      <option value="">Seleccionar…</option>
                      {(categoryMap[movementForm.type] || []).map((category) => (
                        <option value={category} key={category}>{category}</option>
                      ))}
                    </Select>
                  </Field>

                  {movementForm.type === "Egreso" && movementForm.category === "Deuda" && (
                    <Field label="Deuda vinculada">
                      <Select
                        value={movementForm.linkedDebtId}
                        onChange={(value) => {
                          const debt = debts.find((item) => String(item.id) === String(value));
                          setMovementForm({
                            ...movementForm,
                            linkedDebtId: value,
                            originalAmount: debt?.installment ? String(debt.installment) : movementForm.originalAmount,
                          });
                        }}
                      >
                        <option value="">Elegir deuda…</option>
                        {debts.map((debt) => (
                          <option value={String(debt.id)} key={debt.id}>
                            {debt.name} · pendiente {fmt(debt.balance)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}

                  <Field label="Moneda">
                    <Select value={movementForm.currency} onChange={(value) => setMovementForm({ ...movementForm, currency: value })}>
                      <option value="ARS">Pesos</option>
                      <option value="USD">USD blue</option>
                    </Select>
                  </Field>
                  <Field label={movementForm.currency === "USD" ? "Importe USD" : "Importe ARS"}>
                    <Input
                      type="number"
                      value={movementForm.originalAmount}
                      onChange={(e) => setMovementForm({ ...movementForm, originalAmount: e.target.value })}
                      placeholder="0"
                    />
                  </Field>
                  <Field label="Medio de pago">
                    <Select
                      value={movementForm.paymentMethod}
                      onChange={(value) => setMovementForm({ ...movementForm, paymentMethod: value })}
                    >
                      {paymentMethods.map((method) => (
                        <option value={method} key={method}>{method}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Descripción">
                    <Input
                      value={movementForm.description}
                      onChange={(e) => setMovementForm({ ...movementForm, description: e.target.value })}
                      placeholder="Detalle opcional"
                    />
                  </Field>
                </div>

                {selectedDebtInMovement && (
                  <div className="inline-note">
                    Cuota sugerida <strong>{fmt(selectedDebtInMovement.installment)}</strong> · saldo pendiente{" "}
                    <strong>{fmt(selectedDebtInMovement.balance)}</strong>
                  </div>
                )}

                {movementForm.currency === "USD" && (
                  <div className="inline-note secondary">
                    USD blue actual <strong>{money(blueRate)}</strong> · equivalente{" "}
                    <strong>{money(toArs(movementForm.originalAmount, "USD", blueRate))}</strong>
                  </div>
                )}

                <div className="actions-row">
                  <Button onClick={addMovement} disabled={busy || !movementForm.type || !movementForm.category || !movementForm.originalAmount}>
                    Guardar movimiento
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {tab === "datos" && (
            <div className="page-grid">
              <Card>
                <SectionHead
                  eyebrow="Filtros"
                  title="Movimientos"
                  subtitle="Tabla completa con exportación CSV."
                  action={<Button variant="ghost" onClick={exportCsv}>Exportar CSV</Button>}
                />
                <div className="filter-grid">
                  <Field label="Mes">
                    <Input type="month" value={filters.month} onChange={(e) => setFilters({ ...filters, month: e.target.value })} />
                  </Field>
                  <Field label="Persona">
                    <Select value={filters.person} onChange={(value) => setFilters({ ...filters, person: value })}>
                      <option value="all">Todas</option>
                      {people.map((person) => (
                        <option value={person} key={person}>{person}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Tipo">
                    <Select value={filters.type} onChange={(value) => setFilters({ ...filters, type: value })}>
                      <option value="all">Todos</option>
                      {types.map((type) => (
                        <option value={type} key={type}>{type}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Categoría">
                    <Select value={filters.category} onChange={(value) => setFilters({ ...filters, category: value })}>
                      <option value="all">Todas</option>
                      {Object.values(categoryMap).flat().map((category) => (
                        <option value={category} key={category}>{category}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Moneda">
                    <Select value={filters.currency} onChange={(value) => setFilters({ ...filters, currency: value })}>
                      <option value="all">Todas</option>
                      <option value="ARS">ARS</option>
                      <option value="USD">USD</option>
                    </Select>
                  </Field>
                </div>

                {filteredMovements.length === 0 ? (
                  <EmptyState title="Sin registros" text="No hay movimientos con los filtros seleccionados." />
                ) : (
                  <>
                    <div className="desktop-table">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Persona</th>
                            <th>Tipo</th>
                            <th>Categoría</th>
                            <th>Descripción</th>
                            <th>Original</th>
                            <th>ARS</th>
                            <th>USD</th>
                            <th>Medio</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredMovements.map((movement) => (
                            <tr key={movement.id}>
                              <td>{movement.date}</td>
                              <td>{movement.person}</td>
                              <td>
                                <Badge
                                  tone={
                                    movement.type === "Ingreso"
                                      ? "green"
                                      : movement.type === "Egreso"
                                      ? "red"
                                      : movement.type === "Ahorro"
                                      ? "blue"
                                      : "purple"
                                  }
                                >
                                  {movement.type}
                                </Badge>
                              </td>
                              <td>{movement.category}</td>
                              <td>{movement.description || "—"}</td>
                              <td>{money(movement.originalAmount, movement.currency)}</td>
                              <td>{money(movement.amountArs)}</td>
                              <td>{money(movement.amountUsd, "USD")}</td>
                              <td>{movement.paymentMethod}</td>
                              <td>
                                <button className="icon-btn danger" onClick={() => deleteMovement(movement.id)}>Eliminar</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mobile-cards">
                      {filteredMovements.map((movement) => (
                        <div className="data-card" key={movement.id}>
                          <div className="data-card-top">
                            <div>
                              <div className="row-title">{movement.category}</div>
                              <div className="row-subtitle">{movement.date} · {movement.person}</div>
                            </div>
                            <Badge
                              tone={
                                movement.type === "Ingreso"
                                  ? "green"
                                  : movement.type === "Egreso"
                                  ? "red"
                                  : movement.type === "Ahorro"
                                  ? "blue"
                                  : "purple"
                              }
                            >
                              {movement.type}
                            </Badge>
                          </div>
                          <div className="data-card-grid">
                            <div><span className="data-key">Original</span><strong>{money(movement.originalAmount, movement.currency)}</strong></div>
                            <div><span className="data-key">ARS</span><strong>{money(movement.amountArs)}</strong></div>
                            <div><span className="data-key">USD</span><strong>{money(movement.amountUsd, "USD")}</strong></div>
                            <div><span className="data-key">Medio</span><strong>{movement.paymentMethod}</strong></div>
                          </div>
                          {movement.description && <div className="row-subtitle">{movement.description}</div>}
                          <div className="actions-row">
                            <Button variant="danger" onClick={() => deleteMovement(movement.id)}>Eliminar</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </Card>
            </div>
          )}

          {tab === "presupuesto" && (
            <div className="page-grid">
              <div className="grid-2">
                <Card>
                  <SectionHead
                    eyebrow="Base del mes"
                    title="Saldo inicial"
                    subtitle="Impacta el cálculo del saldo mensual del dashboard."
                  />
                  <div className="form-grid compact">
                    <Field label="Mes">
                      <Input type="month" value={balanceForm.month} onChange={(e) => setBalanceForm({ ...balanceForm, month: e.target.value })} />
                    </Field>
                    <Field label="Saldo inicial ARS">
                      <Input type="number" value={balanceForm.opening} onChange={(e) => setBalanceForm({ ...balanceForm, opening: e.target.value })} />
                    </Field>
                    <Field label="Notas">
                      <Input value={balanceForm.notes} onChange={(e) => setBalanceForm({ ...balanceForm, notes: e.target.value })} />
                    </Field>
                  </div>
                  <div className="actions-row">
                    <Button onClick={saveBalance}>Guardar saldo inicial</Button>
                  </div>
                </Card>

                <Card>
                  <SectionHead
                    eyebrow="Planificación"
                    title="Nuevo presupuesto"
                    subtitle="Por mes, persona, tipo y categoría."
                  />
                  <div className="form-grid compact">
                    <Field label="Mes">
                      <Input type="month" value={budgetForm.month} onChange={(e) => setBudgetForm({ ...budgetForm, month: e.target.value })} />
                    </Field>
                    <Field label="Persona">
                      <Select value={budgetForm.person} onChange={(value) => setBudgetForm({ ...budgetForm, person: value })}>
                        {people.map((person) => (
                          <option value={person} key={person}>{person}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Tipo">
                      <Select
                        value={budgetForm.type}
                        onChange={(value) =>
                          setBudgetForm({
                            ...budgetForm,
                            type: value,
                            category: categoryMap[value]?.[0] || "",
                          })
                        }
                      >
                        {types.map((type) => (
                          <option value={type} key={type}>{type}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Categoría">
                      <Select value={budgetForm.category} onChange={(value) => setBudgetForm({ ...budgetForm, category: value })}>
                        {(categoryMap[budgetForm.type] || []).map((category) => (
                          <option value={category} key={category}>{category}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Importe ARS">
                      <Input type="number" value={budgetForm.planned} onChange={(e) => setBudgetForm({ ...budgetForm, planned: e.target.value })} />
                    </Field>
                  </div>
                  <div className="actions-row">
                    <Button onClick={addBudget}>Guardar presupuesto</Button>
                  </div>
                </Card>
              </div>

              <Card>
                <SectionHead
                  eyebrow="Seguimiento"
                  title={`Presupuesto vs real · ${reportMonth}`}
                  subtitle="Marca con claridad lo excedido y lo que todavía está dentro de rango."
                />
                {budgetComparison.length === 0 ? (
                  <EmptyState title="Sin presupuestos cargados" text="Agregá presupuestos para comparar contra el gasto real." />
                ) : (
                  <div className="budget-list">
                    {budgetComparison.map((item) => {
                      const tone = item.execution > 100 ? "red" : item.execution >= 85 ? "amber" : "green";
                      return (
                        <div className={classNames("budget-card", `budget-${tone}`)} key={item.id}>
                          <div className="budget-head">
                            <div>
                              <div className="row-title">{item.category}</div>
                              <div className="row-subtitle">{item.person} · {item.type}</div>
                            </div>
                            <Badge tone={tone}>{item.execution.toFixed(1)}%</Badge>
                          </div>
                          <div className="data-card-grid">
                            <div><span className="data-key">Presupuesto</span><strong>{fmt(item.planned)}</strong></div>
                            <div><span className="data-key">Real</span><strong>{fmt(item.actual)}</strong></div>
                            <div><span className="data-key">Diferencia</span><strong>{fmt(item.difference)}</strong></div>
                            <div><span className="data-key">Estado</span><strong>{item.execution > 100 ? "Excedido" : item.execution >= 85 ? "Al límite" : "Dentro"}</strong></div>
                          </div>
                          <Progress value={item.execution} />
                          <div className="actions-row">
                            <Button variant="ghost" onClick={() => deleteBudget(item.id)}>Eliminar</Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          )}

          {tab === "deudas" && (
            <div className="page-grid">
              <div className="grid-2">
                <Card>
                  <SectionHead
                    eyebrow="Alta"
                    title="Agregar deuda"
                    subtitle="Nombre, saldo, cuota, vencimiento y prioridad."
                  />
                  <div className="form-grid compact">
                    <Field label="Nombre">
                      <Input value={debtForm.name} onChange={(e) => setDebtForm({ ...debtForm, name: e.target.value })} placeholder="Ej. Tarjeta Visa" />
                    </Field>
                    <Field label="Responsable">
                      <Select value={debtForm.owner} onChange={(value) => setDebtForm({ ...debtForm, owner: value })}>
                        {people.map((person) => (
                          <option value={person} key={person}>{person}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Saldo inicial">
                      <Input type="number" value={debtForm.balance} onChange={(e) => setDebtForm({ ...debtForm, balance: e.target.value })} />
                    </Field>
                    <Field label="Cuota">
                      <Input type="number" value={debtForm.installment} onChange={(e) => setDebtForm({ ...debtForm, installment: e.target.value })} />
                    </Field>
                    <Field label="Día vencimiento">
                      <Input type="number" value={debtForm.dueDay} onChange={(e) => setDebtForm({ ...debtForm, dueDay: e.target.value })} />
                    </Field>
                    <Field label="Prioridad">
                      <Select value={debtForm.priority} onChange={(value) => setDebtForm({ ...debtForm, priority: value })}>
                        <option value="Alta">Alta</option>
                        <option value="Media">Media</option>
                        <option value="Baja">Baja</option>
                      </Select>
                    </Field>
                    <Field label="Tasa %">
                      <Input type="number" value={debtForm.rate} onChange={(e) => setDebtForm({ ...debtForm, rate: e.target.value })} />
                    </Field>
                    <Field label="Notas">
                      <Input value={debtForm.notes} onChange={(e) => setDebtForm({ ...debtForm, notes: e.target.value })} />
                    </Field>
                  </div>
                  <div className="actions-row">
                    <Button onClick={addDebt}>Guardar deuda</Button>
                  </div>
                </Card>

                <Card>
                  <SectionHead
                    eyebrow="Pago manual"
                    title="Registrar pago de deuda"
                    subtitle="Además crea el movimiento asociado en Supabase."
                  />
                  <div className="form-grid compact">
                    <Field label="Deuda">
                      <Select value={debtPaymentForm.debtId} onChange={(value) => setDebtPaymentForm({ ...debtPaymentForm, debtId: value })}>
                        <option value="">Elegir deuda…</option>
                        {debts.map((debt) => (
                          <option value={String(debt.id)} key={debt.id}>
                            {debt.name} · {fmt(debt.balance)} pendiente
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Fecha">
                      <Input type="date" value={debtPaymentForm.date} onChange={(e) => setDebtPaymentForm({ ...debtPaymentForm, date: e.target.value })} />
                    </Field>
                    <Field label="Importe">
                      <Input type="number" value={debtPaymentForm.amount} onChange={(e) => setDebtPaymentForm({ ...debtPaymentForm, amount: e.target.value })} />
                    </Field>
                    <Field label="Persona">
                      <Select value={debtPaymentForm.person} onChange={(value) => setDebtPaymentForm({ ...debtPaymentForm, person: value })}>
                        {people.map((person) => (
                          <option value={person} key={person}>{person}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Medio de pago">
                      <Select value={debtPaymentForm.paymentMethod} onChange={(value) => setDebtPaymentForm({ ...debtPaymentForm, paymentMethod: value })}>
                        {paymentMethods.map((method) => (
                          <option value={method} key={method}>{method}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Notas">
                      <Input value={debtPaymentForm.notes} onChange={(e) => setDebtPaymentForm({ ...debtPaymentForm, notes: e.target.value })} />
                    </Field>
                  </div>

                  {selectedDebtInPayment && (
                    <div className="inline-note">
                      Saldo actual <strong>{fmt(selectedDebtInPayment.balance)}</strong> · cuota cargada{" "}
                      <strong>{fmt(selectedDebtInPayment.installment)}</strong>
                    </div>
                  )}

                  <div className="actions-row">
                    <Button onClick={registerDebtPayment}>Registrar pago</Button>
                  </div>
                </Card>
              </div>

              <Card>
                <SectionHead
                  eyebrow="Listado"
                  title="Deudas activas"
                  subtitle="Vista clara con saldo, pagado y prioridad."
                />
                {debts.length === 0 ? (
                  <EmptyState title="Sin deudas" text="Agregá una deuda para empezar a seguirla." />
                ) : (
                  <div className="debt-grid">
                    {debts.map((debt) => {
                      const paidPct =
                        Number(debt.initialBalance || 0) > 0
                          ? (Number(debt.totalPaid || 0) / Number(debt.initialBalance || 0)) * 100
                          : 0;
                      const tone = debt.priority === "Alta" ? "red" : debt.priority === "Media" ? "amber" : "blue";

                      return (
                        <div className="debt-card" key={debt.id}>
                          <div className="budget-head">
                            <div>
                              <div className="row-title">{debt.name}</div>
                              <div className="row-subtitle">{debt.owner} · vence día {debt.dueDay || "-"}</div>
                            </div>
                            <Badge tone={tone}>{debt.priority}</Badge>
                          </div>

                          <div className="data-card-grid">
                            <div><span className="data-key">Saldo</span><strong>{fmt(debt.balance)}</strong></div>
                            <div><span className="data-key">Pagado</span><strong>{fmt(debt.totalPaid)}</strong></div>
                            <div><span className="data-key">Cuota</span><strong>{fmt(debt.installment)}</strong></div>
                            <div><span className="data-key">Tasa</span><strong>{debt.rate || 0}%</strong></div>
                          </div>

                          <Progress value={paidPct} />

                          {debt.notes && <div className="row-subtitle">{debt.notes}</div>}

                          <div className="actions-row">
                            <Button variant="ghost" onClick={() => deleteDebt(debt.id)}>Eliminar deuda</Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          )}

          {tab === "metas" && (
            <div className="page-grid">
              <Card>
                <SectionHead
                  eyebrow="Objetivos"
                  title="Agregar meta"
                  subtitle="Ahorro objetivo con progreso actual."
                />
                <div className="form-grid compact">
                  <Field label="Nombre">
                    <Input value={goalForm.name} onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })} placeholder="Ej. Vacaciones" />
                  </Field>
                  <Field label="Objetivo">
                    <Input type="number" value={goalForm.target} onChange={(e) => setGoalForm({ ...goalForm, target: e.target.value })} />
                  </Field>
                  <Field label="Actual">
                    <Input type="number" value={goalForm.current} onChange={(e) => setGoalForm({ ...goalForm, current: e.target.value })} />
                  </Field>
                  <Field label="Notas">
                    <Input value={goalForm.notes} onChange={(e) => setGoalForm({ ...goalForm, notes: e.target.value })} />
                  </Field>
                </div>
                <div className="actions-row">
                  <Button onClick={addGoal}>Guardar meta</Button>
                </div>
              </Card>

              <Card>
                <SectionHead
                  eyebrow="Seguimiento"
                  title="Metas activas"
                  subtitle="Progreso visual simple y claro."
                />
                {goals.length === 0 ? (
                  <EmptyState title="Sin metas" text="Creá tu primera meta para verla acá." />
                ) : (
                  <div className="goal-grid">
                    {goals.map((goal) => {
                      const pct = Number(goal.target_amount || 0) > 0
                        ? (Number(goal.current_amount || 0) / Number(goal.target_amount || 0)) * 100
                        : 0;

                      return (
                        <div className="goal-card" key={goal.id}>
                          <div className="budget-head">
                            <div>
                              <div className="row-title">{goal.name}</div>
                              <div className="row-subtitle">{goal.notes || "Sin notas"}</div>
                            </div>
                            <Badge tone={pct >= 100 ? "green" : pct >= 60 ? "amber" : "blue"}>{pct.toFixed(0)}%</Badge>
                          </div>
                          <div className="data-card-grid">
                            <div><span className="data-key">Actual</span><strong>{fmt(goal.current_amount)}</strong></div>
                            <div><span className="data-key">Objetivo</span><strong>{fmt(goal.target_amount)}</strong></div>
                          </div>
                          <Progress value={pct} />
                          <div className="actions-row">
                            <Button variant="ghost" onClick={() => deleteGoal(goal.id)}>Eliminar meta</Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          )}

          {tab === "config" && (
            <div className="page-grid">
              <div className="grid-2">
                <Card>
                  <SectionHead
                    eyebrow="Catálogos"
                    title="Personas"
                    subtitle="Se usan en movimientos, deuda y presupuestos."
                  />
                  <div className="catalog-input-row">
                    <Input
                      value={catalogForm.person}
                      onChange={(e) => setCatalogForm({ ...catalogForm, person: e.target.value })}
                      placeholder="Nueva persona"
                    />
                    <Button onClick={() => addCatalogItem("person")}>Agregar</Button>
                  </div>
                  <div className="tag-wrap">
                    {people.map((person) => (
                      <span className="tag" key={person}>{person}</span>
                    ))}
                  </div>
                </Card>

                <Card>
                  <SectionHead
                    eyebrow="Catálogos"
                    title="Medios de pago"
                    subtitle="Disponibles al cargar movimientos."
                  />
                  <div className="catalog-input-row">
                    <Input
                      value={catalogForm.paymentMethod}
                      onChange={(e) => setCatalogForm({ ...catalogForm, paymentMethod: e.target.value })}
                      placeholder="Nuevo medio"
                    />
                    <Button onClick={() => addCatalogItem("payment_method")}>Agregar</Button>
                  </div>
                  <div className="tag-wrap">
                    {paymentMethods.map((method) => (
                      <span className="tag" key={method}>{method}</span>
                    ))}
                  </div>
                </Card>
              </div>

              <div className="grid-2">
                <Card>
                  <SectionHead
                    eyebrow="Catálogos"
                    title="Tipos"
                    subtitle="Ingreso, egreso, ahorro, inversión u otros."
                  />
                  <div className="catalog-input-row">
                    <Input
                      value={catalogForm.type}
                      onChange={(e) => setCatalogForm({ ...catalogForm, type: e.target.value })}
                      placeholder="Nuevo tipo"
                    />
                    <Button onClick={() => addCatalogItem("type")}>Agregar</Button>
                  </div>
                  <div className="tag-wrap">
                    {types.map((type) => (
                      <span className="tag" key={type}>{type}</span>
                    ))}
                  </div>
                </Card>

                <Card>
                  <SectionHead
                    eyebrow="Catálogos"
                    title="Categorías"
                    subtitle="Se guardan por tipo para no mezclar egresos con ingresos."
                  />
                  <div className="catalog-input-row split">
                    <Select value={catalogForm.categoryType} onChange={(value) => setCatalogForm({ ...catalogForm, categoryType: value })}>
                      {types.map((type) => (
                        <option value={type} key={type}>{type}</option>
                      ))}
                    </Select>
                    <Input
                      value={catalogForm.category}
                      onChange={(e) => setCatalogForm({ ...catalogForm, category: e.target.value })}
                      placeholder="Nueva categoría"
                    />
                    <Button onClick={() => addCatalogItem("category")}>Agregar</Button>
                  </div>
                  <div className="stack-tags">
                    {types.map((type) => (
                      <div className="tag-group" key={type}>
                        <div className="tag-group-title">{type}</div>
                        <div className="tag-wrap">
                          {(categoryMap[type] || []).map((category) => (
                            <span className="tag" key={`${type}-${category}`}>{category}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
