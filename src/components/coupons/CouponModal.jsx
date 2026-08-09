import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { X, Tag, Percent, DollarSign, Truck, AlertCircle, Calendar, Hash } from 'lucide-react'

export default function CouponModal({ isOpen, onClose, coupon, onSave }) {
  const [code, setCode] = useState('')
  const [type, setType] = useState('percentage') // 'percentage' | 'fixed' | 'free_shipping'
  const [value, setValue] = useState('')
  const [minOrderValue, setMinOrderValue] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [active, setActive] = useState(true)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen) {
      if (coupon) {
        setCode(coupon.code || '')
        setType(coupon.type || 'percentage')
        setValue(coupon.value !== undefined ? String(coupon.value) : '')
        setMinOrderValue(coupon.min_order_value !== undefined ? String(coupon.min_order_value) : '')
        setMaxUses(coupon.max_uses !== null && coupon.max_uses !== undefined ? String(coupon.max_uses) : '')
        
        if (coupon.expires_at) {
          try {
            const d = new Date(coupon.expires_at)
            const isoStr = d.toISOString().slice(0, 16)
            setExpiresAt(isoStr)
          } catch (e) {
            setExpiresAt('')
          }
        } else {
          setExpiresAt('')
        }

        setActive(coupon.active !== undefined ? coupon.active : true)
      } else {
        setCode('')
        setType('percentage')
        setValue('')
        setMinOrderValue('')
        setMaxUses('')
        setExpiresAt('')
        setActive(true)
      }
      setError(null)
    }
  }, [isOpen, coupon])

  if (!isOpen) return null

  const handleCodeChange = (e) => {
    // Código em caixa alta, sem espaços
    const formatted = e.target.value.toUpperCase().replace(/\s+/g, '')
    setCode(formatted)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    const cleanCode = code.trim().toUpperCase().replace(/\s+/g, '')
    if (!cleanCode) {
      setError('Informe o código do cupom (ex: PROMO10, FRETEGRATIS, INFINITY50).')
      return
    }

    let numValue = 0
    if (type !== 'free_shipping') {
      const cleanVal = String(value).replace(',', '.').replace('%', '').trim()
      numValue = parseFloat(cleanVal)
      
      if (isNaN(numValue) || numValue <= 0) {
        setError(type === 'percentage' 
          ? 'Informe uma porcentagem válida maior que zero (ex: 10, 20, 50).' 
          : 'Informe um valor em reais válido maior que zero (ex: 10.00, 25.50).'
        )
        return
      }

      if (type === 'percentage' && numValue > 100) {
        setError('A porcentagem de desconto não pode ser maior que 100%.')
        return
      }
    }

    let parsedMin = 0
    if (minOrderValue) {
      const cleanMin = String(minOrderValue).replace(',', '.').trim()
      const parsed = parseFloat(cleanMin)
      if (!isNaN(parsed) && parsed > 0) parsedMin = parsed
    }

    let parsedMaxUses = null
    if (maxUses) {
      const cleanMax = String(maxUses).replace(/\D/g, '').trim()
      const parsed = parseInt(cleanMax, 10)
      if (!isNaN(parsed) && parsed > 0) parsedMaxUses = parsed
    }

    const payload = {
      code: cleanCode,
      type: type,
      value: numValue,
      min_order_value: parsedMin,
      max_uses: parsedMaxUses,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      active: active,
      updated_at: new Date().toISOString()
    }

    try {
      setSaving(true)

      if (coupon && coupon.id) {
        // Atualizar cupom existente
        const { error: updateError } = await supabase
          .from('coupons')
          .update(payload)
          .eq('id', coupon.id)

        if (updateError) throw updateError
      } else {
        // Criar novo cupom
        const { error: insertError } = await supabase
          .from('coupons')
          .insert([{ ...payload, used_count: 0 }])

        if (insertError) {
          if (insertError.code === '23505') {
            throw new Error(`Já existe um cupom cadastrado com o código "${cleanCode}".`)
          }
          throw insertError
        }
      }

      if (onSave) onSave()
      onClose()
    } catch (err) {
      console.error('Erro ao salvar cupom:', err)
      setError(err.message || 'Erro ao salvar cupom no banco de dados.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 md:p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                {coupon ? 'Editar Cupom de Desconto' : 'Criar Novo Cupom de Desconto'}
              </h3>
              <p className="text-xs text-slate-400">
                Configure descontos percentuais, valores fixos ou frete grátis
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form noValidate onSubmit={handleSubmit} className="p-5 md:p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Código do Cupom */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Código do Cupom *
            </label>
            <div className="relative">
              <input
                type="text"
                value={code}
                onChange={handleCodeChange}
                placeholder="Ex: INFINITY50, PROMO10, FRETEGRATIS"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white font-mono font-bold uppercase tracking-wider focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-600 transition-all"
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-semibold">
                CUPOM
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              O cliente digitará esse código no checkout da vitrine.
            </p>
          </div>

          {/* Tipo de Desconto */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Tipo de Desconto *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => { setType('percentage'); setError(null); }}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
                  type === 'percentage'
                    ? 'bg-indigo-600/15 border-indigo-500 text-indigo-400 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Percent className="w-5 h-5 mb-1 text-indigo-400" />
                <span>Porcentagem (%)</span>
              </button>

              <button
                type="button"
                onClick={() => { setType('fixed'); setError(null); }}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
                  type === 'fixed'
                    ? 'bg-emerald-600/15 border-emerald-500 text-emerald-400 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <DollarSign className="w-5 h-5 mb-1 text-emerald-400" />
                <span>Valor Fixo (R$)</span>
              </button>

              <button
                type="button"
                onClick={() => { setType('free_shipping'); setError(null); }}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
                  type === 'free_shipping'
                    ? 'bg-amber-600/15 border-amber-500 text-amber-400 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Truck className="w-5 h-5 mb-1 text-amber-400" />
                <span>Frete Grátis</span>
              </button>
            </div>
          </div>

          {/* Valor do Desconto (Oculto se Frete Grátis) */}
          {type !== 'free_shipping' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                {type === 'percentage' ? 'Porcentagem de Desconto (%) *' : 'Valor do Desconto (R$) *'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={value}
                  onChange={(e) => { setValue(e.target.value); setError(null); }}
                  placeholder={type === 'percentage' ? 'Ex: 10, 20, 50 (para 50% OFF)' : 'Ex: 10.00 ou 10,00 (para R$ 10 OFF)'}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-600 transition-all font-semibold"
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-bold">
                  {type === 'percentage' ? '%' : 'R$'}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {type === 'percentage' ? 'Digite apenas o número da porcentagem (ex: 10 para 10% de desconto).' : 'Digite o valor em reais (ex: 15.00 ou 15).' }
              </p>
            </div>
          )}

          {/* Regras Avançadas: Valor Mínimo & Limite de Usos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Valor Mínimo do Pedido
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={minOrderValue}
                  onChange={(e) => setMinOrderValue(e.target.value)}
                  placeholder="0.00 (Sem mínimo)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-600 transition-all"
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                  R$
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Opcional. Valor do carrinho para liberar o cupom.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Limite Total de Usos
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value.replace(/\D/g, ''))}
                  placeholder="Ilimitado"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-600 transition-all"
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                  <Hash className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Ex: primeiros 100 clientes ou deixe vazio.</p>
            </div>
          </div>

          {/* Data de Expiração */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Data e Hora de Expiração
            </label>
            <div className="relative">
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-600 transition-all [color-scheme:dark]"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Deixe em branco se o cupom não tiver prazo de validade.
            </p>
          </div>

          {/* Status Ativo / Inativo */}
          <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800">
            <div>
              <div className="text-sm font-semibold text-white">Cupom Ativo</div>
              <div className="text-xs text-slate-400">
                {active ? 'Clientes podem utilizar este cupom no checkout' : 'Cupom desativado temporariamente'}
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Salvando Cupom...
                </>
              ) : (
                <>
                  <Tag className="w-4 h-4" /> {coupon ? 'Atualizar Cupom' : 'Criar Cupom'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
