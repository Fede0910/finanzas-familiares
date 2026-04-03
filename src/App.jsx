import React, { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const initialPeople = ['Federico', 'Mica', 'Santy', 'Compartido']
const initialPaymentMethods = ['Banco', 'Tarjeta', 'Efectivo', 'Mercado Pago', 'Transferencia']
const initialTypes = ['Ingreso', 'Egreso', 'Ahorro', 'Inversión']
const initialCategoryMap = {
  Ingreso: ['Sueldo', 'Freelance', 'Venta', 'Otros ingresos'],
  Egreso: ['Supermercado', 'Salud', 'Salud mental', 'Educación', 'Transporte', 'Servicios', 'Alquiler', 'Salidas'],
  Ahorro: ['Fondo de emergencia', 'Ahorro USD', 'Caja ahorro'],
  Inversión: ['FCI', 'Acciones', 'Cedears', 'Cripto'],
}

const initialMovements = [
  { id: 1, date: '2026-04-01', person: 'Federico', type: 'Ingreso', category: 'Sueldo', description: 'Sueldo mensual', amountArs: 1800000, originalAmount: 1800000, currency: 'ARS', fxRate: 1, paymentMethod: 'Banco' },
  { id: 2, date: '2026-04-02', person: 'Mica', type: 'Egreso', category: 'Supermercado', description: 'Compra semanal', amountArs: 85000, originalAmount: 85000, currency: 'ARS', fxRate: 1, paymentMethod: 'Tarjeta' },
  { id: 3, date: '2026-04-02', person: 'Compartido', type: 'Ahorro', category: 'Fondo de emergencia', description: 'Transferencia a ahorro', amountArs: 120000, originalAmount: 120000, currency: 'ARS', fxRate: 1, paymentMethod: 'Banco' },
  { id: 4, date: '2026-03-18', person: 'Compartido', type: 'Inversión', category: 'FCI', description: 'Aporte inversión', amountArs: 90000, originalAmount: 90000, currency: 'ARS', fxRate: 1, paymentMethod: 'Banco' },
  { id: 5, date: '2026-04-05', person: 'Federico', type: 'Egreso', category: 'Salud mental', description: 'Sesión mensual', amountArs: 45000, originalAmount: 45000, currency: 'ARS', fxRate: 1, paymentMethod: 'Transferencia' },
  { id: 6, date: '2026-04-06', person: 'Compartido', type: 'Ahorro', category: 'Ahorro USD', description: 'Compra de dólares', amountArs: 250000, originalAmount: 200, currency: 'USD', fxRate: 1250, paymentMethod: 'Banco' },
]

const initialDebts = [
  { id: 1, name: 'Tarjeta Visa', owner: 'Federico', balance: 420000, installment: 70000, dueDay: 10, priority: 'Alta', rate: 0, notes: 'Revisar resumen' },
  { id: 2, name: 'Préstamo familiar', owner: 'Compartido', balance: 900000, installment: 150000, dueDay: 5, priority: 'Media', rate: 0, notes: 'Sin interés' },
]

const initialGoals = [
  { id: 1, name: 'Fondo de emergencia', target: 3000000, current: 650000 },
  { id: 2, name: 'Inversión familiar', target: 2000000, current: 210000 },
]

const initialBudgets = [
  { id: 1, month: '2026-04', person: 'Compartido', type: 'Egreso', category: 'Supermercado', planned: 250000 },
  { id: 2, month: '2026-04', person: 'Federico', type: 'Egreso', category: 'Salud mental', planned: 50000 },
]

const chartPalette = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#ea580c']

function money(n, currency = 'ARS') {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'USD' ? 2 : 0,
  }).format(Number(n || 0))
}

function monthKey(dateString) {
  const d = new Date(dateString + 'T00:00:00')
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function yearKey(dateString) {
  return String(new Date(dateString + 'T00:00:00').getFullYear())
}

function convertFromArs(amountArs, currency, rate) {
  if (currency === 'USD') return rate > 0 ? amountArs / rate : 0
  return amountArs
}

function convertToArs(amount, currency, rate) {
  if (currency === 'USD') return Number(amount || 0) * Number(rate || 0)
  return Number(amount || 0)
}

function getDefaultCategory(type, categoryMap) {
  return categoryMap[type]?.[0] || ''
}

function emptyMovement(today, paymentMethods, people, blueRate) {
  return {
    date: today,
    person: people.includes('Compartido') ? 'Compartido' : people[0] || '',
    type: '',
    category: '',
    description: '',
    originalAmount: '',
    currency: 'ARS',
    fxRate: blueRate || 1,
    paymentMethod: paymentMethods[0] || '',
  }
}

function semaforoLabel(execution) {
  if (execution > 100) return 'Excedido'
  if (execution >= 85) return 'Al límite'
  return 'Dentro'
}

function semaforoClass(execution) {
  if (execution > 100) return 'alert danger'
  if (execution >= 85) return 'alert warning'
  return 'alert success'
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function Card({ title, children, right }) {
  return (
    <section className="card">
      {(title || right) && (
        <div className="card-header">
          <h3>{title}</h3>
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

function App() {
  const today = new Date().toISOString().slice(0, 10)
  const currentMonth = new Date().toISOString().slice(0, 7)

  const [tab, setTab] = useState('movimientos')
  const [people, setPeople] = useState(initialPeople)
  const [paymentMethods, setPaymentMethods] = useState(initialPaymentMethods)
  const [types, setTypes] = useState(initialTypes)
  const [categoryMap, setCategoryMap] = useState(initialCategoryMap)

  const [movements, setMovements] = useState(initialMovements)
  const [debts, setDebts] = useState(initialDebts)
  const [goals, setGoals] = useState(initialGoals)
  const [budgets, setBudgets] = useState(initialBudgets)

  const [blueRate, setBlueRate] = useState(1250)
  const [blueUpdatedAt, setBlueUpdatedAt] = useState('')
  const [displayCurrency, setDisplayCurrency] = useState('ARS')

  const [movementForm, setMovementForm] = useState({
    date: today,
    person: 'Compartido',
    type: '',
    category: '',
    description: '',
    originalAmount: '',
    currency: 'ARS',
    fxRate: 1250,
    paymentMethod: initialPaymentMethods[0] || '',
  })
  const [debtForm, setDebtForm] = useState({ name: '', owner: 'Compartido', balance: '', installment: '', dueDay: '', priority: 'Media', rate: '', notes: '' })
  const [goalForm, setGoalForm] = useState({ name: '', target: '', current: '' })
  const [budgetForm, setBudgetForm] = useState({ month: currentMonth, person: 'Compartido', type: 'Egreso', category: getDefaultCategory('Egreso', initialCategoryMap), planned: '' })
  const [catalogForm, setCatalogForm] = useState({ person: '', paymentMethod: '', type: '', categoryType: 'Egreso', category: '' })
  const [reportMonth, setReportMonth] = useState(currentMonth)
  const [reportYear, setReportYear] = useState(new Date().getFullYear().toString())

  useEffect(() => {
    async function fetchBlue() {
      try {
        const res = await fetch('https://dolarapi.com/v1/dolares/blue')
        if (!res.ok) throw new Error('No se pudo consultar la cotización')
        const data = await res.json()
        const rate = Number(data?.venta || 0)
        if (rate > 0) {
          setBlueRate(rate)
          setBlueUpdatedAt(data?.fechaActualizacion || new Date().toISOString())
        }
      } catch {
        // sin bloqueo; sigue con valor manual
      }
    }
    fetchBlue()
  }, [])

  const categoriesForMovementType = movementForm.type ? categoryMap[movementForm.type] || [] : []
  const categoriesForBudgetType = budgetForm.type ? categoryMap[budgetForm.type] || [] : []

  useEffect(() => {
    if (!movementForm.type) return
    if (!categoriesForMovementType.includes(movementForm.category)) {
      setMovementForm((prev) => ({ ...prev, category: categoriesForMovementType[0] || '' }))
    }
  }, [movementForm.type])

  useEffect(() => {
    if (!categoriesForBudgetType.includes(budgetForm.category)) {
      setBudgetForm((prev) => ({ ...prev, category: categoriesForBudgetType[0] || '' }))
    }
  }, [budgetForm.type])

  const formatAmount = (amountArs) => {
    const shown = convertFromArs(amountArs, displayCurrency, blueRate)
    return money(shown, displayCurrency)
  }

  const summary = useMemo(() => {
    const income = movements.filter((m) => m.type === 'Ingreso').reduce((a, b) => a + b.amountArs, 0)
    const expenses = movements.filter((m) => m.type === 'Egreso').reduce((a, b) => a + b.amountArs, 0)
    const savings = movements.filter((m) => m.type === 'Ahorro').reduce((a, b) => a + b.amountArs, 0)
    const investments = movements.filter((m) => m.type === 'Inversión').reduce((a, b) => a + b.amountArs, 0)
    const totalDebt = debts.reduce((a, b) => a + b.balance, 0)
    const totalBudgetMonth = budgets.filter((b) => b.month === reportMonth).reduce((a, b) => a + b.planned, 0)
    const net = income - expenses - savings - investments
    return { income, expenses, savings, investments, totalDebt, totalBudgetMonth, net }
  }, [movements, debts, budgets, reportMonth])

  const annualByMonth = useMemo(() => {
    const bucket = {}
    movements.forEach((m) => {
      const k = monthKey(m.date)
      if (!bucket[k]) bucket[k] = { income: 0, expenses: 0, savings: 0, investments: 0 }
      if (m.type === 'Ingreso') bucket[k].income += m.amountArs
      if (m.type === 'Egreso') bucket[k].expenses += m.amountArs
      if (m.type === 'Ahorro') bucket[k].savings += m.amountArs
      if (m.type === 'Inversión') bucket[k].investments += m.amountArs
    })
    return Object.entries(bucket)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, values]) => ({
        month,
        income: convertFromArs(values.income, displayCurrency, blueRate),
        expenses: convertFromArs(values.expenses, displayCurrency, blueRate),
        savings: convertFromArs(values.savings, displayCurrency, blueRate),
        investments: convertFromArs(values.investments, displayCurrency, blueRate),
      }))
  }, [movements, displayCurrency, blueRate])

  const monthlyBudgetComparison = useMemo(() => {
    return budgets
      .filter((b) => b.month === reportMonth)
      .map((b) => {
        const actual = movements
          .filter((m) => monthKey(m.date) === b.month && m.person === b.person && m.type === b.type && m.category === b.category)
          .reduce((a, c) => a + c.amountArs, 0)
        return { ...b, actual, difference: b.planned - actual, execution: b.planned > 0 ? (actual / b.planned) * 100 : 0 }
      })
  }, [budgets, movements, reportMonth])

  const monthlyByPerson = useMemo(() => {
    return people.map((person) => {
      const total = movements
        .filter((m) => monthKey(m.date) === reportMonth && m.person === person && m.type === 'Egreso')
        .reduce((a, c) => a + c.amountArs, 0)
      return { person, total: convertFromArs(total, displayCurrency, blueRate) }
    }).sort((a, b) => b.total - a.total)
  }, [movements, people, reportMonth, displayCurrency, blueRate])

  const monthlyByCategory = useMemo(() => {
    return Object.values(categoryMap).flat().map((category) => {
      const total = movements
        .filter((m) => monthKey(m.date) === reportMonth && m.type === 'Egreso' && m.category === category)
        .reduce((a, c) => a + c.amountArs, 0)
      return { category, total: convertFromArs(total, displayCurrency, blueRate) }
    }).filter((x) => x.total > 0).sort((a, b) => b.total - a.total)
  }, [movements, categoryMap, reportMonth, displayCurrency, blueRate])

  const annualByPerson = useMemo(() => {
    return people.map((person) => {
      const total = movements
        .filter((m) => yearKey(m.date) === reportYear && m.person === person && m.type === 'Egreso')
        .reduce((a, c) => a + c.amountArs, 0)
      return { person, total: convertFromArs(total, displayCurrency, blueRate) }
    }).sort((a, b) => b.total - a.total)
  }, [movements, people, reportYear, displayCurrency, blueRate])

  const annualByType = useMemo(() => {
    return types.map((type) => {
      const total = movements
        .filter((m) => yearKey(m.date) === reportYear && m.type === type)
        .reduce((a, c) => a + c.amountArs, 0)
      return { type, total: convertFromArs(total, displayCurrency, blueRate) }
    }).filter((x) => x.total > 0)
  }, [movements, types, reportYear, displayCurrency, blueRate])

  const upcomingDebts = useMemo(() => debts.slice().sort((a, b) => a.dueDay - b.dueDay).slice(0, 4), [debts])

  const addMovement = () => {
    if (!movementForm.type || !movementForm.category || !movementForm.originalAmount) return
    const amountArs = convertToArs(movementForm.originalAmount, movementForm.currency, movementForm.currency === 'USD' ? movementForm.fxRate || blueRate : 1)
    setMovements([{ id: Date.now(), ...movementForm, amountArs, originalAmount: Number(movementForm.originalAmount), fxRate: Number(movementForm.fxRate || 1) }, ...movements])
    setMovementForm(emptyMovement(today, paymentMethods, people, blueRate))
  }

  const addBudget = () => {
    if (!budgetForm.month || !budgetForm.person || !budgetForm.type || !budgetForm.category || !budgetForm.planned) return
    setBudgets([{ id: Date.now(), ...budgetForm, planned: Number(budgetForm.planned) }, ...budgets])
    setBudgetForm({ month: reportMonth, person: 'Compartido', type: 'Egreso', category: getDefaultCategory('Egreso', categoryMap), planned: '' })
  }

  const addDebt = () => {
    if (!debtForm.name || !debtForm.balance) return
    setDebts([{ id: Date.now(), ...debtForm, balance: Number(debtForm.balance), installment: Number(debtForm.installment || 0), dueDay: Number(debtForm.dueDay || 0), rate: Number(debtForm.rate || 0) }, ...debts])
    setDebtForm({ name: '', owner: 'Compartido', balance: '', installment: '', dueDay: '', priority: 'Media', rate: '', notes: '' })
  }

  const addGoal = () => {
    if (!goalForm.name || !goalForm.target) return
    setGoals([{ id: Date.now(), name: goalForm.name, target: Number(goalForm.target), current: Number(goalForm.current || 0) }, ...goals])
    setGoalForm({ name: '', target: '', current: '' })
  }

  const addCatalogItem = (field) => {
    const raw = (catalogForm[field] || '').trim()
    if (!raw) return
    if (field === 'person' && !people.includes(raw)) setPeople([...people, raw])
    if (field === 'paymentMethod' && !paymentMethods.includes(raw)) setPaymentMethods([...paymentMethods, raw])
    if (field === 'type' && !types.includes(raw)) {
      setTypes([...types, raw])
      setCategoryMap((prev) => ({ ...prev, [raw]: prev[raw] || [] }))
    }
    if (field === 'category') {
      const type = catalogForm.categoryType
      const current = categoryMap[type] || []
      if (!current.includes(raw)) setCategoryMap((prev) => ({ ...prev, [type]: [...(prev[type] || []), raw] }))
    }
    setCatalogForm((prev) => ({ ...prev, [field]: '' }))
  }

  const removeItem = (type, id) => {
    if (type === 'movement') setMovements(movements.filter((x) => x.id !== id))
    if (type === 'budget') setBudgets(budgets.filter((x) => x.id !== id))
    if (type === 'debt') setDebts(debts.filter((x) => x.id !== id))
    if (type === 'goal') setGoals(goals.filter((x) => x.id !== id))
  }

  const removeCategoryFromType = (type, category) => {
    setCategoryMap((prev) => ({ ...prev, [type]: (prev[type] || []).filter((x) => x !== category) }))
  }

  const removeChip = (kind, value) => {
    if (kind === 'person') setPeople(people.filter((x) => x !== value))
    if (kind === 'paymentMethod') setPaymentMethods(paymentMethods.filter((x) => x !== value))
  }

  return (
    <div className="app-shell">
      <div className="container">
        <header className="hero">
          <div>
            <h1>Finanzas Familiares</h1>
            <p>Control simple para dos o más personas, pensado para cargar rápido desde el celular.</p>
          </div>
          <div className="hero-actions">
            <select value={displayCurrency} onChange={(e) => setDisplayCurrency(e.target.value)}>
              <option value="ARS">Ver en ARS</option>
              <option value="USD">Ver en USD blue</option>
            </select>
          </div>
        </header>

        <Card>
          <div className="fx-box">
            <div>
              <strong>Dólar blue:</strong> {money(blueRate, 'ARS')} por USD
              <div className="subtle">Última actualización: {blueUpdatedAt ? new Date(blueUpdatedAt).toLocaleString('es-AR') : 'manual'}</div>
            </div>
            <div className="fx-actions">
              <input type="number" value={blueRate} onChange={(e) => setBlueRate(Number(e.target.value || 0))} />
            </div>
          </div>
        </Card>

        <section className="stats-grid">
          <div className="stat-card"><span>Ingresos</span><strong>{formatAmount(summary.income)}</strong></div>
          <div className="stat-card"><span>Gastos</span><strong>{formatAmount(summary.expenses)}</strong></div>
          <div className="stat-card"><span>Presupuesto mes</span><strong>{formatAmount(summary.totalBudgetMonth)}</strong></div>
          <div className="stat-card"><span>Ahorro</span><strong>{formatAmount(summary.savings)}</strong></div>
          <div className="stat-card"><span>Inversión</span><strong>{formatAmount(summary.investments)}</strong></div>
          <div className="stat-card"><span>Disponible</span><strong>{formatAmount(summary.net)}</strong></div>
        </section>

        <nav className="tabs">
          {['movimientos', 'presupuesto', 'reportes', 'deudas', 'metas', 'configuracion'].map((item) => (
            <button key={item} className={tab === item ? 'tab active' : 'tab'} onClick={() => setTab(item)}>
              {item === 'configuracion' ? 'config.' : item}
            </button>
          ))}
        </nav>

        {tab === 'movimientos' && (
          <div className="stack">
            <Card title="Carga rápida desde el celular">
              <div className="form-grid">
                <Field label="Fecha"><input type="date" value={movementForm.date} onChange={(e) => setMovementForm({ ...movementForm, date: e.target.value })} /></Field>
                <Field label="Persona"><select value={movementForm.person} onChange={(e) => setMovementForm({ ...movementForm, person: e.target.value })}>{people.map((p) => <option key={p}>{p}</option>)}</select></Field>
                <Field label="Tipo"><select value={movementForm.type} onChange={(e) => setMovementForm({ ...movementForm, type: e.target.value, category: '' })}><option value="">Seleccionar</option>{types.map((t) => <option key={t}>{t}</option>)}</select></Field>
                <Field label="Categoría"><select value={movementForm.category} onChange={(e) => setMovementForm({ ...movementForm, category: e.target.value })} disabled={!movementForm.type}><option value="">Seleccionar</option>{categoriesForMovementType.map((c) => <option key={c}>{c}</option>)}</select></Field>
                <Field label="Moneda"><select value={movementForm.currency} onChange={(e) => setMovementForm({ ...movementForm, currency: e.target.value, fxRate: e.target.value === 'USD' ? blueRate : 1 })}><option value="ARS">Pesos</option><option value="USD">Dólar blue</option></select></Field>
                <Field label="Importe original"><input type="number" value={movementForm.originalAmount} onChange={(e) => setMovementForm({ ...movementForm, originalAmount: e.target.value })} /></Field>
                <Field label="Cotización usada"><input type="number" value={movementForm.fxRate} onChange={(e) => setMovementForm({ ...movementForm, fxRate: e.target.value })} disabled={movementForm.currency === 'ARS'} /></Field>
                <Field label="Medio de pago"><select value={movementForm.paymentMethod} onChange={(e) => setMovementForm({ ...movementForm, paymentMethod: e.target.value })}>{paymentMethods.map((m) => <option key={m}>{m}</option>)}</select></Field>
                <Field label="Descripción"><input value={movementForm.description} onChange={(e) => setMovementForm({ ...movementForm, description: e.target.value })} /></Field>
              </div>
              <button className="primary-btn" onClick={addMovement}>Agregar movimiento</button>
            </Card>

            <Card title="Últimos movimientos">
              <div className="list">
                {movements.map((m) => (
                  <div className="list-item" key={m.id}>
                    <div>
                      <strong>{m.category} · {m.description || 'Sin detalle'}</strong>
                      <div className="subtle">{m.date} · {m.person} · {m.type} · {m.paymentMethod} · {m.currency}</div>
                    </div>
                    <div className="item-right">
                      <div>
                        <strong>{formatAmount(m.amountArs)}</strong>
                        <div className="subtle">Original: {money(m.originalAmount, m.currency)}</div>
                      </div>
                      <button className="ghost-btn" onClick={() => removeItem('movement', m.id)}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {tab === 'presupuesto' && (
          <div className="stack">
            <Card title="Presupuesto anticipado mensual">
              <div className="form-grid">
                <Field label="Mes"><input type="month" value={budgetForm.month} onChange={(e) => setBudgetForm({ ...budgetForm, month: e.target.value })} /></Field>
                <Field label="Persona"><select value={budgetForm.person} onChange={(e) => setBudgetForm({ ...budgetForm, person: e.target.value })}>{people.map((p) => <option key={p}>{p}</option>)}</select></Field>
                <Field label="Tipo"><select value={budgetForm.type} onChange={(e) => setBudgetForm({ ...budgetForm, type: e.target.value, category: getDefaultCategory(e.target.value, categoryMap) })}>{types.map((t) => <option key={t}>{t}</option>)}</select></Field>
                <Field label="Categoría"><select value={budgetForm.category} onChange={(e) => setBudgetForm({ ...budgetForm, category: e.target.value })}>{categoriesForBudgetType.map((c) => <option key={c}>{c}</option>)}</select></Field>
                <Field label="Importe presupuestado"><input type="number" value={budgetForm.planned} onChange={(e) => setBudgetForm({ ...budgetForm, planned: e.target.value })} /></Field>
              </div>
              <button className="primary-btn" onClick={addBudget}>Agregar presupuesto</button>
            </Card>

            <Card title="Comparativa presupuesto vs real" right={<input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} /> }>
              <div className="list">
                {monthlyBudgetComparison.map((b) => (
                  <div key={b.id} className={semaforoClass(b.execution)}>
                    <div className="row-between wrap-gap">
                      <div>
                        <strong>{b.category}</strong>
                        <div className="subtle">{b.month} · {b.person} · {b.type}</div>
                      </div>
                      <div className="row-between wrap-gap">
                        <span className="pill">{b.execution.toFixed(1)}%</span>
                        <button className="ghost-btn" onClick={() => removeItem('budget', b.id)}>×</button>
                      </div>
                    </div>
                    <div className="mini-grid">
                      <div><span>Presupuesto</span><strong>{formatAmount(b.planned)}</strong></div>
                      <div><span>Real</span><strong className={b.actual > b.planned ? 'danger-text' : ''}>{formatAmount(b.actual)}</strong></div>
                      <div><span>Diferencia</span><strong className={b.difference < 0 ? 'danger-text' : 'success-text'}>{formatAmount(b.difference)}</strong></div>
                      <div><span>Estado</span><strong>{semaforoLabel(b.execution)}</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {tab === 'reportes' && (
          <div className="stack">
            <Card title="Parámetros de reporte">
              <div className="form-grid three">
                <Field label="Mes a analizar"><input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} /></Field>
                <Field label="Año a analizar"><input value={reportYear} onChange={(e) => setReportYear(e.target.value)} /></Field>
                <Field label="Moneda"><select value={displayCurrency} onChange={(e) => setDisplayCurrency(e.target.value)}><option value="ARS">Pesos</option><option value="USD">USD blue</option></select></Field>
              </div>
            </Card>

            <div className="chart-grid">
              <Card title="Gasto mensual por persona">
                <div className="chart-box">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyByPerson}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="person" /><YAxis /><Tooltip formatter={(v) => money(v, displayCurrency)} /><Bar dataKey="total">{monthlyByPerson.map((_, i) => <Cell key={i} fill={chartPalette[i % chartPalette.length]} />)}</Bar></BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card title="Gasto mensual por categoría">
                <div className="chart-box">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={monthlyByCategory.slice(0, 6)} dataKey="total" nameKey="category" outerRadius={90} label>
                        {monthlyByCategory.slice(0, 6).map((_, i) => <Cell key={i} fill={chartPalette[i % chartPalette.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => money(v, displayCurrency)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            <div className="two-col">
              <Card title="Comparativa anual por persona">
                <div className="simple-list">{annualByPerson.map((row) => <div className="simple-row" key={row.person}><span>{row.person}</span><strong>{money(row.total, displayCurrency)}</strong></div>)}</div>
              </Card>
              <Card title="Comparativa anual por tipo">
                <div className="simple-list">{annualByType.map((row) => <div className="simple-row" key={row.type}><span>{row.type}</span><strong>{money(row.total, displayCurrency)}</strong></div>)}</div>
              </Card>
            </div>

            <Card title="Comparativa anual por mes">
              <div className="chart-box big">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={annualByMonth}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip formatter={(v) => money(v, displayCurrency)} /><Legend /><Bar dataKey="income" name="Ingresos" fill="#16a34a" /><Bar dataKey="expenses" name="Gastos" fill="#dc2626" /></BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        )}

        {tab === 'deudas' && (
          <div className="stack">
            <div className="two-col wider-left">
              <Card title="Agregar deuda">
                <div className="form-grid">
                  <Field label="Nombre"><input value={debtForm.name} onChange={(e) => setDebtForm({ ...debtForm, name: e.target.value })} /></Field>
                  <Field label="Titular"><select value={debtForm.owner} onChange={(e) => setDebtForm({ ...debtForm, owner: e.target.value })}>{people.map((p) => <option key={p}>{p}</option>)}</select></Field>
                  <Field label="Saldo"><input type="number" value={debtForm.balance} onChange={(e) => setDebtForm({ ...debtForm, balance: e.target.value })} /></Field>
                  <Field label="Cuota"><input type="number" value={debtForm.installment} onChange={(e) => setDebtForm({ ...debtForm, installment: e.target.value })} /></Field>
                  <Field label="Día vencimiento"><input type="number" value={debtForm.dueDay} onChange={(e) => setDebtForm({ ...debtForm, dueDay: e.target.value })} /></Field>
                  <Field label="Prioridad"><select value={debtForm.priority} onChange={(e) => setDebtForm({ ...debtForm, priority: e.target.value })}><option>Alta</option><option>Media</option><option>Baja</option></select></Field>
                  <Field label="Tasa %"><input type="number" value={debtForm.rate} onChange={(e) => setDebtForm({ ...debtForm, rate: e.target.value })} /></Field>
                  <Field label="Notas"><input value={debtForm.notes} onChange={(e) => setDebtForm({ ...debtForm, notes: e.target.value })} /></Field>
                </div>
                <button className="primary-btn" onClick={addDebt}>Agregar deuda</button>
              </Card>
              <Card title="Próximos vencimientos">
                <div className="simple-list">{upcomingDebts.map((d) => <div className="simple-card" key={d.id}><strong>{d.name}</strong><span>{d.owner}</span><span>Cuota: {formatAmount(d.installment)}</span><span>Vence el día: {d.dueDay}</span></div>)}</div>
              </Card>
            </div>

            <div className="two-col">{debts.map((d) => <Card key={d.id}><div className="simple-card"><div className="row-between"><div><strong>{d.name}</strong><div className="subtle">{d.owner} · Prioridad {d.priority}</div></div><button className="ghost-btn" onClick={() => removeItem('debt', d.id)}>×</button></div><span>Saldo: {formatAmount(d.balance)}</span><span>Cuota: {formatAmount(d.installment)}</span><span>Vence el día: {d.dueDay || '-'}</span><span>Tasa: {d.rate || 0}%</span><span>Notas: {d.notes || '-'}</span></div></Card>)}</div>
          </div>
        )}

        {tab === 'metas' && (
          <div className="stack">
            <Card title="Agregar meta">
              <div className="form-grid three">
                <Field label="Meta"><input value={goalForm.name} onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })} /></Field>
                <Field label="Objetivo"><input type="number" value={goalForm.target} onChange={(e) => setGoalForm({ ...goalForm, target: e.target.value })} /></Field>
                <Field label="Actual"><input type="number" value={goalForm.current} onChange={(e) => setGoalForm({ ...goalForm, current: e.target.value })} /></Field>
              </div>
              <button className="primary-btn" onClick={addGoal}>Agregar meta</button>
            </Card>
            <div className="two-col">{goals.map((g) => { const pct = g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0; return <Card key={g.id}><div className="simple-card"><div className="row-between"><div><strong>{g.name}</strong><div className="subtle">{formatAmount(g.current)} de {formatAmount(g.target)}</div></div><button className="ghost-btn" onClick={() => removeItem('goal', g.id)}>×</button></div><div className="progress"><div style={{ width: `${pct}%` }} /></div><span>{pct.toFixed(1)}% completado</span></div></Card> })}</div>
          </div>
        )}

        {tab === 'configuracion' && (
          <div className="stack">
            <div className="two-col">
              <Card title="Personas y medios de pago">
                <div className="stack-sm">
                  <Field label="Nueva persona"><div className="inline-field"><input value={catalogForm.person} onChange={(e) => setCatalogForm({ ...catalogForm, person: e.target.value })} /><button className="primary-btn small" onClick={() => addCatalogItem('person')}>Agregar</button></div></Field>
                  <div className="chip-wrap">{people.map((p) => <button key={p} className="chip" onClick={() => removeChip('person', p)}>{p} ×</button>)}</div>
                  <Field label="Nuevo medio de pago"><div className="inline-field"><input value={catalogForm.paymentMethod} onChange={(e) => setCatalogForm({ ...catalogForm, paymentMethod: e.target.value })} /><button className="primary-btn small" onClick={() => addCatalogItem('paymentMethod')}>Agregar</button></div></Field>
                  <div className="chip-wrap">{paymentMethods.map((p) => <button key={p} className="chip" onClick={() => removeChip('paymentMethod', p)}>{p} ×</button>)}</div>
                </div>
              </Card>

              <Card title="Tipos y categorías">
                <div className="stack-sm">
                  <Field label="Nuevo tipo"><div className="inline-field"><input value={catalogForm.type} onChange={(e) => setCatalogForm({ ...catalogForm, type: e.target.value })} /><button className="primary-btn small" onClick={() => addCatalogItem('type')}>Agregar</button></div></Field>
                  <Field label="Agregar categoría ligada a un tipo"><select value={catalogForm.categoryType} onChange={(e) => setCatalogForm({ ...catalogForm, categoryType: e.target.value })}>{types.map((t) => <option key={t}>{t}</option>)}</select></Field>
                  <div className="inline-field"><input value={catalogForm.category} onChange={(e) => setCatalogForm({ ...catalogForm, category: e.target.value })} /><button className="primary-btn small" onClick={() => addCatalogItem('category')}>Agregar</button></div>
                  {types.map((type) => <div className="type-box" key={type}><strong>{type}</strong><div className="chip-wrap">{(categoryMap[type] || []).map((c) => <button key={c} className="chip" onClick={() => removeCategoryFromType(type, c)}>{c} ×</button>)}</div></div>)}
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
