import React, { useState, useEffect } from 'react'
import { X, Printer, Truck, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

// Imagem 3D genérica / IA para fallback quando o produto não existir no catálogo
const GENERIC_3D_IMAGE = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80'

export default function InstagramOrderCardModal({ isOpen, onClose, order }) {
  if (!isOpen || !order) return null

  const [catalogProducts, setCatalogProducts] = useState([])
  const [selectedItemIndex, setSelectedItemIndex] = useState(0)

  // Carrega catálogo completo do Supabase para busca do produto exato
  useEffect(() => {
    let isMounted = true
    async function loadCatalog() {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, images, price')
          .order('created_at', { ascending: false })

        if (!error && data && isMounted) {
          setCatalogProducts(data)
        }
      } catch (err) {
        console.error('Erro ao carregar produtos para correspondência:', err)
      }
    }

    loadCatalog()
    return () => {
      isMounted = false
    }
  }, [isOpen, order?.id])

  // Processa a lista de itens do pedido
  const rawItems = Array.isArray(order.items)
    ? order.items
    : typeof order.items === 'string'
    ? (() => {
        try {
          return JSON.parse(order.items)
        } catch (e) {
          return []
        }
      })()
    : []

  const itemsList = rawItems.length > 0
    ? rawItems
    : [{ name: 'Impressão 3D Personalizada', price: order.total_amount || 0 }]

  const currentItem = itemsList[selectedItemIndex] || itemsList[0]

  // Normalização de strings para busca precisa (remove acentos, espaços extras, etc.)
  const normalize = (str) =>
    String(str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, ' ')
      .trim()

  // Função para resolver a imagem do produto exato comprado
  const getExactProductImage = () => {
    if (!currentItem) return GENERIC_3D_IMAGE

    // 1. Se o próprio item do pedido já tem uma imagem direta válida (e não é genérica)
    if (
      currentItem.image &&
      typeof currentItem.image === 'string' &&
      !currentItem.image.includes('unsplash.com') &&
      currentItem.image.trim() !== ''
    ) {
      return currentItem.image
    }
    if (
      Array.isArray(currentItem.images) &&
      currentItem.images.length > 0 &&
      !currentItem.images[0].includes('unsplash.com') &&
      currentItem.images[0].trim() !== ''
    ) {
      return currentItem.images[0]
    }

    // 2. Busca no catálogo do Supabase o produto correspondente exato
    if (catalogProducts && catalogProducts.length > 0) {
      const itemNameNorm = normalize(currentItem.name)
      const itemWords = itemNameNorm.split(/\s+/).filter((w) => w.length > 2)

      // A) Match exato por nome
      let match = catalogProducts.find((p) => normalize(p.name) === itemNameNorm)

      // B) Match por ID (se houver product_id ou id no item)
      if (!match && (currentItem.product_id || currentItem.id)) {
        const targetId = currentItem.product_id || currentItem.id
        match = catalogProducts.find((p) => p.id === targetId)
      }

      // C) Match onde o nome do catálogo contém o nome do produto ou vice-versa
      if (!match && itemNameNorm.length > 2) {
        match = catalogProducts.find((p) => {
          const pNameNorm = normalize(p.name)
          return pNameNorm.includes(itemNameNorm) || itemNameNorm.includes(pNameNorm)
        })
      }

      // D) Match por palavras-chave principais (ex: 'patolino', 'coyote', 'monster', 'pernalonga')
      if (!match && itemWords.length > 0) {
        match = catalogProducts.find((p) => {
          const pNameNorm = normalize(p.name)
          return itemWords.some((w) => pNameNorm.includes(w))
        })
      }

      // Se encontrou o produto correspondente no catálogo e ele tem imagem real
      if (match) {
        if (Array.isArray(match.images) && match.images.length > 0 && match.images[0]) {
          return match.images[0]
        }
        if (typeof match.images === 'string' && match.images) {
          return match.images
        }
      }
    }

    // 3. Fallback: Se não encontrou o produto comprado no catálogo, usa a imagem genérica 3D / IA
    return GENERIC_3D_IMAGE
  }

  const productImage = getExactProductImage()

  // Nome do produto
  const productName = currentItem?.name || 'Impressão 3D Personalizada'

  // Preço formatado
  const itemPrice = currentItem?.price
    ? Number(currentItem.price)
    : Number(order.total_amount || 0)

  const formattedPrice = `R$ ${itemPrice.toFixed(2).replace('.', ',')}`

  // Nome do cliente formatado
  const customerName = (() => {
    if (order.customer_name && order.customer_name !== 'Cliente em Checkout') {
      return order.customer_name.trim()
    }
    if (order.customer_email) {
      return order.customer_email
        .split('@')[0]
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase())
        .trim()
    }
    return 'Cliente Especial'
  })()

  // Detecta o status de entrega definido no pedido
  const deliveryStatus = (() => {
    if (order.status_entrega) return order.status_entrega.toLowerCase()
    if (order.comments && order.comments.includes('<!--DELIVERY:')) {
      const match = order.comments.match(/<!--DELIVERY:(imprimindo|a_caminho|entregue)-->/i)
      if (match && match[1]) return match[1].toLowerCase()
    }
    const rawComments = String(order.comments || '').toLowerCase()
    if (rawComments.includes('entregue')) return 'entregue'
    if (rawComments.includes('caminho') || rawComments.includes('enviado')) return 'a_caminho'
    return 'imprimindo'
  })()

  // Configurações visuais por status
  const statusConfig = {
    imprimindo: {
      tag: '🖨️ IMPRIMINDO',
      headline: `Imprimindo para ${customerName}`,
      badgeBg: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
      glow: 'rgba(245, 158, 11, 0.15)',
      borderColor: 'border-amber-500/30',
      icon: Printer
    },
    a_caminho: {
      tag: '🚚 ENTREGANDO',
      headline: `Entregando para ${customerName}`,
      badgeBg: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
      glow: 'rgba(14, 165, 233, 0.15)',
      borderColor: 'border-sky-500/30',
      icon: Truck
    },
    entregando: {
      tag: '🚚 ENTREGANDO',
      headline: `Entregando para ${customerName}`,
      badgeBg: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
      glow: 'rgba(14, 165, 233, 0.15)',
      borderColor: 'border-sky-500/30',
      icon: Truck
    },
    entregue: {
      tag: '🎉 ENTREGUE',
      headline: `Entregue para ${customerName}`,
      badgeBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
      glow: 'rgba(16, 185, 129, 0.15)',
      borderColor: 'border-emerald-500/30',
      icon: CheckCircle2
    }
  }

  const currentConfig = statusConfig[deliveryStatus] || statusConfig.imprimindo

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão Fechar no canto */}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-20 p-2 rounded-full bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-all shadow-lg"
          title="Fechar"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Card Horizontal */}
        <div
          className={`w-full rounded-3xl p-6 sm:p-7 bg-slate-950 border ${currentConfig.borderColor} shadow-2xl relative overflow-hidden flex flex-col sm:flex-row items-center gap-6 transition-all`}
          style={{
            background: 'linear-gradient(135deg, #090c14 0%, #0d121f 50%, #080a11 100%)',
            boxShadow: `0 25px 60px -15px ${currentConfig.glow}`
          }}
        >
          {/* Efeito sutil de luz ambiente */}
          <div
            className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-30"
            style={{ background: currentConfig.glow }}
          />

          {/* Imagem do Produto Exato (ou Fallback Genérico) */}
          <div className="w-28 h-28 sm:w-36 sm:h-36 shrink-0 rounded-2xl overflow-hidden bg-slate-900 border border-slate-700/60 shadow-xl relative">
            <img
              src={productImage}
              alt={productName}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent pointer-events-none" />
          </div>

          {/* Informações: Status, Cliente, Produto e Preço */}
          <div className="flex-1 text-center sm:text-left space-y-2 relative z-10 min-w-0">
            {/* Tag de Status */}
            <div>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider border shadow-sm ${currentConfig.badgeBg}`}
              >
                {currentConfig.tag}
              </span>
            </div>

            {/* Frase com Nome do Cliente */}
            <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight leading-snug break-words">
              {currentConfig.headline}
            </h2>

            {/* Nome do Produto */}
            <p className="text-sm font-semibold text-slate-300 truncate">
              {productName}
            </p>

            {/* Preço */}
            <div className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight pt-0.5">
              {formattedPrice}
            </div>

            {/* Seletor sutil se o pedido tiver mais de 1 item */}
            {itemsList.length > 1 && (
              <div className="pt-2 flex items-center gap-1.5 flex-wrap justify-center sm:justify-start">
                <span className="text-[11px] text-slate-500 font-medium">Itens:</span>
                {itemsList.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedItemIndex(idx)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                      selectedItemIndex === idx
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {idx + 1}. {item.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
