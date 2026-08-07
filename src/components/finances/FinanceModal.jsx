import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { X, TrendingUp, TrendingDown, DollarSign, Calendar, Tag, FileText, AlertCircle, ShoppingCart } from 'lucide-react'

export default function FinanceModal({ isOpen, onClose, transaction, onSave }) {
  const [type, setType] = useState('expense') // 'income' (lucro) ou 'expense' (custo)
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Filamento / Resina')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const categories = [
    'Filamento / Resina',
    'Energia Elétrica',
    'Manutenção & Equipamentos',
    'Vendas Loja',
    'Vendas Diretas',
    'Marketing & Anúncios',
    'Embalagens & Envio',
    'Outros'
  ]

  useEffect(() => {
    if (isOpen) {
      if (transaction) {
        setType(transaction.type || 'income')
        setTitle(transaction.title || '')
        setAmount(transaction.amount ? transaction.amount.toString() : '')
        setCategory(transaction.category || (transaction.isOrder ? 'Vendas Loja' : 'Outros'))
        setDate(transaction.date || new Date().toISOString().split('T')[0])
        setDescription(transaction.description || '')
      } else {
        setType('expense')
        setTitle('')
        setAmount('')
        setCategory('Filamento / Resina')
        setDate(new Date().toISOString().split('T')[0])
        setDescription('')
      }
      setError(null)
    }
  }, [isOpen, transaction])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!title.trim()) {
      setError('O título da movimentação é obrigatório.')
      return
    }

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError('Informe um valor numérico válido maior que zero.')
      return
    }

    setSaving(true)

    try {
      if (transaction?.isOrder) {
        // Atualiza a venda diretamente na tabela 'orders'
        const orderId = transaction.id.replace('order-', '')
        const { error: orderError } = await supabase
          .from('orders')
          .update({
            total_amount: parseFloat(amount),
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId)

        if (orderError) throw orderError
      } else {
        const payload = {
          title: title.trim(),
          amount: parseFloat(amount),
          type,
          category,
          date,
          description: description.trim() || null,
          updated_at: new Date().toISOString()
        }

        if (transaction) {
          const { error: updateError } = await supabase
            .from('finances')
            .update(payload)
            .eq('id', transaction.id)

          if (updateError) throw updateError
        } else {
          const { error: insertError } = await supabase
            .from('finances')
            .insert([payload])

          if (insertError) throw insertError
        }
      }

      onSave()
      onClose()
    } catch (err) {
      setError('Erro ao salvar movimentação: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header Modal */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            {transaction?.isOrder ? (
              <span className="text-emerald-400 flex items-center gap-1.5">
                <ShoppingCart className="w-5 h-5" /> Editar Valor de Venda da Loja
              </span>
            ) : type === 'income' ? (
              <span className="text-emerald-400 flex items-center gap-1.5">
                <TrendingUp className="w-5 h-5" /> {transaction ? 'Editar Receita/Lucro' : 'Novo Lucro / Receita'}
              </span>
            ) : (
              <span className="text-rose-400 flex items-center gap-1.5">
                <TrendingDown className="w-5 h-5" /> {transaction ? 'Editar Custo/Despesa' : 'Novo Custo / Despesa'}
              </span>
            )}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Seleção do Tipo (Lucro vs Custo) - Oculto se for Venda de Pedido */}
          {!transaction?.isOrder && (
            <div className="grid grid-cols-2 gap-3 p-1 bg-slate-950 border border-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setType('income')}
                className={`py-2.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  type === 'income'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <TrendingUp className="w-4 h-4" /> Lucro / Entrada (+R$)
              </button>

              <button
                type="button"
                onClick={() => setType('expense')}
                className={`py-2.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  type === 'expense'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <TrendingDown className="w-4 h-4" /> Custo / Saída (-R$)
              </button>
            </div>
          )}

          {/* Título */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Título da Movimentação <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              disabled={Boolean(transaction?.isOrder)}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={type === 'income' ? 'Ex: Venda de Encomenda Especial 3D' : 'Ex: Compra de 5kg Filamento PLA Hyper'}
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none disabled:opacity-75"
            />
          </div>

          {/* Valor e Data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Valor (R$) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 text-sm font-semibold">
                  R$
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="150.00"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Data do Lançamento
              </label>
              <input
                type="date"
                required
                disabled={Boolean(transaction?.isOrder)}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none disabled:opacity-75"
              />
            </div>
          </div>

          {/* Categoria */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Categoria
            </label>
            <select
              disabled={Boolean(transaction?.isOrder)}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none disabled:opacity-75"
            >
              {categories.map((cat, idx) => (
                <option key={idx} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Observações / Detalhes (Opcional)
            </label>
            <textarea
              rows={2}
              disabled={Boolean(transaction?.isOrder)}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Adicione detalhes sobre o fornecedor, nota fiscal ou observação..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none disabled:opacity-75"
            />
          </div>

          {/* Botões do Modal */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`px-5 py-2.5 rounded-xl text-white font-semibold text-sm shadow-lg transition-all disabled:opacity-50 ${
                type === 'income'
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                  : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
              }`}
            >
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
