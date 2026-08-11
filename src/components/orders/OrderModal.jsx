import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { 
  X, 
  ShoppingCart, 
  User, 
  Mail, 
  Phone, 
  FileText, 
  MapPin, 
  Plus, 
  Trash2, 
  DollarSign, 
  CreditCard, 
  Calendar,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'

export default function OrderModal({ isOpen, onClose, order = null, onSave }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Form State
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerCpf, setCustomerCpf] = useState('')
  
  // Endereço
  const [cep, setCep] = useState('')
  const [street, setStreet] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')

  // Pedido e Itens
  const [items, setItems] = useState([
    { name: '', quantity: 1, price: 0 }
  ])
  const [manualTotal, setManualTotal] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('pix')
  const [status, setStatus] = useState('paid')
  const [statusEntrega, setStatusEntrega] = useState('imprimindo')
  const [orderDate, setOrderDate] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (isOpen) {
      setError('')
      if (order) {
        setCustomerName(order.customer_name || '')
        setCustomerEmail(order.customer_email || '')
        setCustomerPhone(order.customer_phone || '')
        setCustomerCpf(order.customer_cpf || '')

        const addr = order.shipping_address || {}
        setCep(addr.cep || '')
        setStreet(addr.street || addr.address || '')
        setNeighborhood(addr.neighborhood || '')
        setCity(addr.city || '')
        setState(addr.state || '')

        if (Array.isArray(order.items) && order.items.length > 0) {
          setItems(order.items.map(i => ({
            name: i.name || '',
            quantity: Number(i.quantity || 1),
            price: Number(i.price || i.unit_price || 0)
          })))
        } else {
          setItems([{ name: 'Produto 3D', quantity: 1, price: Number(order.total_amount || 0) }])
        }

        setManualTotal(order.total_amount ? String(order.total_amount) : '')
        setPaymentMethod(order.payment_method || 'pix')
        setStatus(order.status || 'paid')
        const initialDelivery = order.status_entrega || (order.comments && order.comments.match(/<!--DELIVERY:(imprimindo|a_caminho|entregue)-->/i)?.[1]) || 'imprimindo'
        setStatusEntrega(initialDelivery)
        
        if (order.created_at) {
          const d = new Date(order.created_at)
          setOrderDate(d.toISOString().slice(0, 16))
        } else {
          setOrderDate(new Date().toISOString().slice(0, 16))
        }

        setNotes(order.comments || order.notes || '')
      } else {
        // Reset formulário para nova venda
        setCustomerName('')
        setCustomerEmail('')
        setCustomerPhone('')
        setCustomerCpf('')
        setCep('')
        setStreet('')
        setNeighborhood('')
        setCity('')
        setState('')
        setItems([{ name: '', quantity: 1, price: 0 }])
        setManualTotal('')
        setPaymentMethod('pix')
        setStatus('paid')
        setStatusEntrega('imprimindo')
        
        // Data/Hora atual formatada para input datetime-local em fuso local
        const now = new Date()
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
        setOrderDate(now.toISOString().slice(0, 16))
        setNotes('')
      }
    }
  }, [isOpen, order])

  if (!isOpen) return null

  // Cálculo automático do subtotal dos itens
  const calculatedItemsTotal = items.reduce((acc, curr) => {
    return acc + (Number(curr.quantity || 0) * Number(curr.price || 0))
  }, 0)

  // Total final considera valor manual se preenchido, senão a soma dos itens
  const finalTotal = manualTotal !== '' && !isNaN(Number(manualTotal))
    ? Number(manualTotal)
    : calculatedItemsTotal

  const handleAddItem = () => {
    setItems([...items, { name: '', quantity: 1, price: 0 }])
  }

  const handleRemoveItem = (index) => {
    if (items.length === 1) {
      setItems([{ name: '', quantity: 1, price: 0 }])
    } else {
      setItems(items.filter((_, i) => i !== index))
    }
  }

  const handleItemChange = (index, field, value) => {
    const newItems = [...items]
    newItems[index][field] = value
    setItems(newItems)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Formata endereço
      const shippingAddress = {
        cep: cep.trim(),
        street: street.trim(),
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        state: state.trim()
      }

      // Limpa itens vazios
      const validItems = items
        .filter(i => i.name.trim() !== '' || Number(i.price) > 0)
        .map(i => ({
          name: i.name.trim() || 'Item Manual',
          quantity: Number(i.quantity) || 1,
          price: Number(i.price) || 0
        }))

      const baseNotes = notes.trim()
      const cleanNotes = baseNotes.replace(/<!--DELIVERY:[a-zA-Z_]+-->/g, '').trim()
      const taggedNotes = cleanNotes ? `${cleanNotes}\n<!--DELIVERY:${statusEntrega}-->` : `<!--DELIVERY:${statusEntrega}-->`

      const payload = {
        customer_name: customerName.trim() || 'Cliente Balcão/Manual',
        customer_email: customerEmail.trim() || null,
        customer_phone: customerPhone.trim() || null,
        customer_cpf: customerCpf.trim() || null,
        shipping_address: shippingAddress,
        items: validItems.length > 0 ? validItems : [{ name: 'Venda Manual', quantity: 1, price: finalTotal }],
        total_amount: Number(finalTotal) || 0,
        payment_method: paymentMethod,
        status: status,
        status_entrega: statusEntrega,
        comments: taggedNotes,
        created_at: orderDate ? new Date(orderDate).toISOString() : new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      if (order && order.id) {
        // Atualiza venda existente
        let { error: updateErr } = await supabase
          .from('orders')
          .update(payload)
          .eq('id', order.id)

        if (updateErr && updateErr.message && updateErr.message.includes('status_entrega')) {
          const fallback = { ...payload }
          delete fallback.status_entrega
          const { error: fbErr } = await supabase.from('orders').update(fallback).eq('id', order.id)
          updateErr = fbErr
        }

        if (updateErr) throw updateErr
      } else {
        // Insere nova venda
        let { error: insertErr } = await supabase
          .from('orders')
          .insert([payload])

        if (insertErr && insertErr.message && insertErr.message.includes('status_entrega')) {
          const fallback = { ...payload }
          delete fallback.status_entrega
          const { error: fbErr } = await supabase.from('orders').insert([fallback])
          insertErr = fbErr
        }

        if (insertErr) throw insertErr
      }

      if (onSave) onSave()
      onClose()
    } catch (err) {
      console.error('Erro ao salvar venda:', err)
      setError('Erro ao salvar venda: ' + (err.message || 'Ocorreu um erro inesperado'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 sticky top-0 z-10 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                {order ? 'Editar Venda / Pedido' : 'Cadastrar Nova Venda Manual'}
              </h3>
              <p className="text-xs text-slate-400">
                Preencha os dados da venda. Todos os campos de cliente são <strong className="text-emerald-400 font-semibold">opcionais</strong>.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Seção 1: Dados do Cliente */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
              <User className="w-4 h-4" /> Dados do Cliente (Opcionais)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nome do Cliente</label>
                <input
                  type="text"
                  placeholder="Ex: João da Silva (ou deixe em branco)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">WhatsApp / Telefone</label>
                <input
                  type="text"
                  placeholder="Ex: 11999998888"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">E-mail</label>
                <input
                  type="email"
                  placeholder="Ex: cliente@email.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">CPF</label>
                <input
                  type="text"
                  placeholder="Ex: 000.000.000-00 (Opcional)"
                  value={customerCpf}
                  onChange={(e) => setCustomerCpf(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* Seção 2: Endereço de Entrega */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
              <MapPin className="w-4 h-4" /> Endereço de Entrega (Opcional)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">CEP</label>
                <input
                  type="text"
                  placeholder="Ex: 01000-000"
                  value={cep}
                  onChange={(e) => setCep(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Rua / Logradouro e Número</label>
                <input
                  type="text"
                  placeholder="Ex: Av. Paulista, 1000"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Bairro</label>
                <input
                  type="text"
                  placeholder="Ex: Centro"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Cidade</label>
                <input
                  type="text"
                  placeholder="Ex: São Paulo"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Estado (UF)</label>
                <input
                  type="text"
                  placeholder="Ex: SP"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* Seção 3: Itens da Venda */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                <ShoppingCart className="w-4 h-4" /> Produtos / Itens da Venda
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-emerald-500/10 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Item
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row items-center gap-3 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                  <div className="flex-1 w-full">
                    <label className="block text-[11px] text-slate-500 mb-1">Descrição / Nome do Produto</label>
                    <input
                      type="text"
                      placeholder="Ex: Vasos Decorativos 3D"
                      value={item.name}
                      onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="w-full sm:w-28">
                    <label className="block text-[11px] text-slate-500 mb-1">Qtd</label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="w-full sm:w-36">
                    <label className="block text-[11px] text-slate-500 mb-1">Preço Unit. (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={item.price}
                      onChange={(e) => handleItemChange(idx, 'price', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="self-end sm:self-center pt-2 sm:pt-4">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-2 text-slate-500 hover:text-rose-400 transition-colors"
                      title="Remover Item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* Seção 4: Valores, Pagamento e Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Valor Total da Venda (R$)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">R$</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder={calculatedItemsTotal.toFixed(2)}
                  value={manualTotal}
                  onChange={(e) => setManualTotal(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-emerald-400 font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Calculado: R$ {calculatedItemsTotal.toFixed(2).replace('.', ',')}
              </span>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Forma de Pagamento</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="pix">PIX</option>
                <option value="credit_card">Cartão de Crédito</option>
                <option value="dinheiro">Dinheiro Espécie</option>
                <option value="bank_transfer">Transferência / TED</option>
                <option value="infinitepay">InfinitePay</option>
                <option value="mercadopago">Mercado Pago</option>
                <option value="outros">Outro Método</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Status do Pagamento</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="paid">✅ Pago (Confirmado)</option>
                <option value="shipped">📦 Enviado / Entregue</option>
                <option value="processing">⏳ Em Processamento</option>
                <option value="abandoned">⚠️ Checkout Abandonado</option>
                <option value="cancelled">❌ Cancelado</option>
              </select>
            </div>

            {['paid', 'shipped', 'processing'].includes(status) && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">Status da Entrega (Cliente)</label>
                <select
                  value={statusEntrega}
                  onChange={(e) => setStatusEntrega(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-sky-400 font-bold focus:outline-none focus:border-sky-500"
                >
                  <option value="imprimindo">🖨️ 1. Imprimindo</option>
                  <option value="a_caminho">🚚 2. A caminho</option>
                  <option value="entregue">🎉 3. Entregue</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs text-slate-400 mb-1">Data / Hora da Venda</label>
              <input
                type="datetime-local"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{order ? 'Salvar Alterações' : 'Confirmar & Registrar Venda'}</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}
